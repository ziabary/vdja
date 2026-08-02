import * as fs from 'fs';
import * as path from 'path';
import express from "express";
import type { Request, Response, Router } from "express";
import { parseQueryToString } from "../utils/common";
import atDB from "../db/atDB";
import { exHttpAccessDenied, exHttpInvalidParams, exHttpNotAllowed, exHttpPaymentRequired } from "../interfaces/exHttp";
import { getAuthInfo } from "../services/authService";
import { enuRequestStatus } from '../db/tables/tblSharedFileRequests';

const router = express.Router();
interface IntfDirSpec {
    name: string
    type: string
    createdAt: Date
    size?: number
    children?: IntfDirSpec[],
    userDownload?: number,
    totalDownload?: number,
    key?: string
}
/**
 * @swagger
 * components:
 *   schemas:
 *     DirEntry:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Name of the directory
 *         type:
 *           type: string
 *           example: "dir"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation time of the directory
 *         children:
 *           type: array
 *           items:
 *             oneOf:
 *               - $ref: '#/components/schemas/DirEntry'
 *               - $ref: '#/components/schemas/FileEntry'
 *     FileEntry:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Name of the file
 *         type:
 *           type: string
 *           description: File extension (e.g., "txt", "pdf")
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation time of the file
 *         size:
 *           type: integer
 *           description: Size of the file in bytes
 *         userDownload:
 *           type: integer
 *           description: Number of times the file has been downloaded by the user
 *         totalDownload:
 *           type: integer
 *           description: Total number of times the file has been downloaded
 *         key:
 *           type: string
 *           description: Unique key for the file in the database
 */
async function listFilesRecursively(userID: number, dir: string): Promise<IntfDirSpec[]> {
    const files = fs.readdirSync(dir);
    const dirSpec: IntfDirSpec[] = []

    for (const file of files) {
        if(file === "temp")  continue
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            dirSpec.push({ name: file, type: "dir", createdAt: stat.ctime, children: await listFilesRecursively(userID, filePath) })
        } else {
            const ext = path.extname(file).toLowerCase();
            const dbRes = await atDB.sharedFiles.addOrGetStats(userID, filePath)
            dirSpec.push({ 
                name: file, type: ext.startsWith('.') ? ext.substring(1) : ext, createdAt: stat.ctime, size: stat.size,
                userDownload: dbRes.user,
                totalDownload: dbRes.total,
                key: dbRes.key
            })
        }
    }

    return dirSpec
}

/**
 * @swagger
 * /shares/list:
 *   get:
 *     summary: List all shared files and directories
 *     description: Recursively lists all files and directories under the user's upload directory, excluding the "temp" directory. It includes file metadata and download statistics from the database.
 *     responses:
 *       200:
 *         description: A list of file and directory structures with metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 oneOf:
 *                   - $ref: '#/components/schemas/DirEntry'
 *                   - $ref: '#/components/schemas/FileEntry'
 *     tags:
 *       - File Sharing
 */
router.get("/shares/list", async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq, false);
    apiRes.send(await listFilesRecursively(auth.uid, "/data/upload"))
})

/**
 * @swagger
 * /shares/req-download/{fileKey}:
 *   get:
 *     summary: Request a download for a shared file
 *     description: Allows a verified user to request a download for a specific file. The user is limited to 3 download requests per file and 20 total download requests per hour.
 *     parameters:
 *       - in: path
 *         name: fileKey
 *         required: true
 *         type: string
 *         description: Unique key of the file to request a download for.
 *     responses:
 *       200:
 *         description: Download request was successfully recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, description: "Indicates if the request was successful" }
 *                 message: { type: string, description: "A message indicating the result" }
 *     security:
 *       - Bearer: []
 *     tags:
 *       - File Sharing
 */
router.get("/shares/req-download/:fileKey", async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq, false);
    if(!auth.privs?.isVerified)
        throw new exHttpAccessDenied("You must be verified")

    const {fileKey} = apiReq.params
    if(!fileKey)
        throw new exHttpInvalidParams("شناسه فایل ارایه نشده است")

    const dbRes = await atDB.sharedFiles.getAccessCount(auth.uid, parseQueryToString(fileKey)!)
    if(dbRes.current >= 3)
        throw new exHttpAccessDenied("در هر ساعت فقط ۳ بار امکان درخواست دانلود این فایل وجود دارد")
    if(dbRes.current >= 20)
        throw new exHttpAccessDenied("در هر ساعت فقط امکان درخواست دانلود فقط ۲۰ فایل وجود دارد")

    apiRes.send(await atDB.sharedFiles.requestDownload(auth.uid, parseQueryToString(fileKey)!))
})

/**
 * @swagger
 * /shares/download:
 *   get:
 *     summary: Download a file using a token
 *     description: Allows downloading a file by providing a valid token. Supports range requests for partial content (e.g., for resuming downloads or streaming).
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         type: string
 *         description: A unique token that grants access to the file.
 *     responses:
 *       200:
 *         description: The file is sent in full
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       206:
 *         description: Partial content of the file (for range requests)
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, description: "Error message" }
 *       416:
 *         description: Requested range not satisfiable
 *         content:
 *           text/plain:
 *             example: "Requested range not satisfiable"
 *     security:
 *       - None: []
 *     tags:
 *       - File Sharing
 */
router.get("/shares/download", async (apiReq: Request, apiRes: Response) => {
    const {token} = apiReq.query
    const reqToken = parseQueryToString(token)
    if(!reqToken)
        throw new exHttpInvalidParams("Token is required")

    const filePath = await atDB.sharedFiles.getByToken(reqToken)
    if(!filePath)
        throw new exHttpNotAllowed("Token not found or expired")

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = apiReq.headers.range;
    const fileName = filePath.substring(filePath.lastIndexOf('/') + 1)
  
    if (range) {
      // Handle range request for partial content
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0]!, 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
  
      if (start >= fileSize) {
        // If the start byte is greater than the file size, return 416
        apiRes.status(416).send('Requested range not satisfiable');
        return;
      }
  
      const chunkSize = end - start + 1;
      apiRes.status(206);
      apiRes.header({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Disposition': `attachment; filename=${fileName}`,
        'Content-Type': 'application/octet-stream',
      });
  
      const fileStream = fs.createReadStream(filePath, { start, end });
      fileStream.pipe(apiRes);
    } else {
      // If no range is provided, send the whole file
      apiRes.header({
        'Content-Length': fileSize,
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename=${fileName}`,
      });
      fs.createReadStream(filePath).pipe(apiRes);
    }   

})


/**
 * @swagger
 * components:
 *   schemas:
 *     enuRequestStatus:
 *       type: string
 *       enum:
 *         - "New"
 *         - "Downloaded"
 *         - "Discarded"
 *         - "Downloading"
 *       description: The status of a file sharing request 
 *     SharedFileRequest:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique ID of the request
 *         by_usrID:
 *           type: integer
 *           description: User ID of the requester
 *         userOnBale:
 *           type: string
 *           description: User's identifier on Bale (e.g., username)
 *         category:
 *           type: string
 *           description: Category of the file request
 *         link:
 *           type: string
 *           description: Link to the file (if available)
 *         description:
 *           type: string
 *           description: Description of the file request
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Date and time the request was created
 *         status:
 *           $ref: '#/components/schemas/enuRequestStatus'
 *       required:
 *         - id
 *         - by_usrID
 *         - userOnBale
 *         - category
 *         - link
 *         - description
 *         - createdAt
 *         - status
 */

/**
 * @swagger
 * /shares/requests/list:
 *   get:
 *     summary: List all file sharing requests
 *     description: Returns a list of all file sharing requests, including their status, user, and other metadata. Only available to verified users.
 *     responses:
 *       200:
 *         description: A list of file sharing requests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SharedFileRequest'
 *     security:
 *       - Bearer: []
 *     tags:
 *       - File Sharing
 */
router.get("/shares/requests/list", async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq, false);
    apiRes.send(await atDB.sharedFileRequests.list(auth.privs?.manageShares))
})

/**
 * @swagger
 * /shares/requests/add:
 *   post:
 *     summary: Add a new file sharing request
 *     description: Allows a verified user to submit a new file sharing request. The user is limited to a maximum of 10 requests. All fields are required, and the description must be at least 10 characters.
 *     parameters:
 *       - in: body
 *         name: request
 *         required: true
 *         description: The file sharing request data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 category:
 *                   type: string
 *                   description: Category of the file (e.g., "Document", "Image", "Video")
 *                 link:
 *                   type: string
 *                   description: A link to the file (e.g., a public URL)
 *                 description:
 *                   type: string
 *                   description: A detailed description of the file (minimum 10 characters)
 *                 baleUser:
 *                   type: string
 *                   description: The user's Bale ID or username
 *               required:
 *                 - category
 *                 - link
 *                 - description
 *     responses:
 *       200:
 *         description: The file sharing request was successfully added
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 inserted:
 *                   type: string
 *                   example: "ok"
 *     security:
 *       - Bearer: []
 *     tags:
 *       - File Sharing
 */
router.post("/shares/requests/add", async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq, false);
    if(!auth.privs?.isVerified)
        throw new exHttpAccessDenied("You must be verified")
    const {category, link, description, baleUser} = apiReq.body
    if(!category?.trim() || !link?.trim() || description?.trim().length < 10)
        throw new exHttpInvalidParams("همه ورودی‌ها الزامی هستند")
    if((await atDB.sharedFileRequests.count(auth.uid)) >= 10)
        throw new exHttpPaymentRequired("هر کاربر می‌تواند حداکثر  ۱۰ درخواست داشته باشد")
    await atDB.sharedFileRequests.add(auth.uid, category, link, description, baleUser)
    apiRes.send({inserted: "ok"})
})

/**
 * @swagger
 * /shares/requests/set-status:
 *   patch:
 *     summary: Update the status of a file sharing request
 *     description: Allows a verified user to update the status of a file sharing request. The status must be one of the allowed values in the `enuRequestStatus` enum.
 *     parameters:
 *       - in: body
 *         name: request
 *         required: true
 *         description: The file sharing request data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: The unique ID of the file sharing request
 *                 status:
 *                   $ref: '#/components/schemas/enuRequestStatus'
 *               required:
 *                 - id
 *                 - status
 *     responses:
 *       200:
 *         description: The file sharing request status was successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 updated:
 *                   type: string
 *                   example: "ok"
 *     security:
 *       - Bearer: []
 *     tags:
 *       - File Sharing
 */
router.patch("/shares/requests/set-status", async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq, false);
    if(!auth.privs?.isVerified && auth.privs?.manageShares)
        throw new exHttpAccessDenied("You must have manage access")
    const {id, status} = apiReq.body
    console.log({id, status, v:Object.keys(enuRequestStatus)})
    if(!id || !Object.keys(enuRequestStatus).includes(status))
        throw new exHttpInvalidParams("ورودی‌های نامعتبر")
    await atDB.sharedFileRequests.setSatus(id, status)
    apiRes.send({updated: "ok"})
})


export default async function init(): Promise<Router> {
    return router;
}

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

router.get("/shares/list", async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq, false);
    apiRes.send(await listFilesRecursively(auth.uid, "/data/upload"))
})

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

router.get("/shares/requests/list", async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq, false);
    if(!auth.privs?.isVerified)
        throw new exHttpAccessDenied("You must be verified")
    apiRes.send(await atDB.sharedFileRequests.list())
})

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

router.patch("/shares/requests/set-status", async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq, false);
    if(!auth.privs?.isVerified)
        throw new exHttpAccessDenied("You must be verified")
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

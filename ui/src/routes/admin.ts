import express from "express";
import type { Request, Response, Router } from "express";
import { parseQueryToString } from "../utils/common";
import atDB from "../db/atDB";
import { exHttpAccessDenied, exHttpInvalidParams } from "../interfaces/exHttp";
import { getAuthInfo } from "../services/authService";

const router = express.Router();
/**
 * @swagger
 * /admin/logs:
 *   get:
 *     summary: Get logs by action
 *     description: This endpoint allows an admin to retrieve logs based on a specific action.
 *     parameters:
 *       - in: query
 *         name: action
 *         description: The action to filter logs by
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of logs
 *       401:
 *         description: Access denied. The user is not an admin.
 *       400:
 *         description: Invalid parameters. The action is not specified.
 *     tags:
 *       - Admin
 * 
 */

router.get("/admin/logs", async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq, false);
    if (!auth.privs?.isAdmin) throw new exHttpAccessDenied("شما دسترسی کافی ندارید")

    const { action: actionQuery } = apiReq.query
    const action = parseQueryToString(actionQuery)
    if (!action)
        throw new exHttpInvalidParams("نوع لاگ مشخص نشده است")

    apiRes.send(await atDB.log.listByAction(action))
})

/**
 * @swagger
 * /admin/conversation:
 *   get:
 *     summary: Get list of conversations
 *     description: This endpoint allows an admin to retrieve logs based on a specific action.
 *     parameters:
 *       - in: query
 *         name: action
 *         description: The action to filter logs by
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of logs
 *       401:
 *         description: Access denied. The user is not an admin.
 *       400:
 *         description: Invalid parameters. The action is not specified.
 *     tags:
 *       - Admin
 * 
 */
router.get("/admin/conversation", async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq, false);
    if (!auth.privs?.isAdmin) throw new exHttpAccessDenied("شما دسترسی کافی ندارید")

    const { id: idQuery, service: serviceQuery } = apiReq.query
    const id = parseQueryToString(idQuery)
    const service = parseQueryToString(serviceQuery)
    if (!id || !service)
        throw new exHttpInvalidParams("ّInvalid Params")

    apiRes.send(await atDB.messages.listByChatID(service, null, id, 1000, 0, true, true))
})

export default async function init(): Promise<Router> {
    return router;
}

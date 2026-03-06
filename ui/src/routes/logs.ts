import express from "express";
import type { Request, Response, Router } from "express";
import { parseQueryToString } from "../utils/common";
import atDB from "../db/atDB";
import { exHttpInvalidParams } from "../interfaces/exHttp";

const router = express.Router();

router.get("/admin/logs", async (apiReq: Request, apiRes: Response) => {
    const {action: actionQuery}= apiReq.query
    const action = parseQueryToString(actionQuery)
    if(!action)
        throw new exHttpInvalidParams("نوع لاگ مشخص نشده است")

    apiRes.send(await atDB.log.listByAction(action))
})

export default async function init(): Promise<Router> {
    return router;
}

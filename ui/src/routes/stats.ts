import express from "express";
import type { Request, Response, Router } from "express";

const router = express.Router();

router.post("/admin/stats", async (apiReq: Request, apiRes: Response) => {

})

export default async function init(): Promise<Router> {
    return router;
}

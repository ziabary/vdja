import express from "express";
import type { Request, Response, Router } from "express";

import multer from "multer";
import * as os from "os";
import * as path from "path";
import * as fs from "fs/promises";
import { extractFromPDF } from "../utils/fileProcessors/pdf";
import { extractFromPDF as simpleExtractFromPDF } from "../utils/fileProcessors/pdf-simple";
import { extractFromDoc } from "../utils/fileProcessors/doc";
import logger from "../utils/logger";
import { parseQueryToNumber, parseQueryToString, toMegaByte } from "../utils/common";
import { getAuthInfo } from "../services/authService";
import type { IntfFileMeta, IntfTextExtractResult } from "../interfaces/file";
import { exHttpInternalServerError, exHttpInvalidParams } from "../interfaces/exHttp";
import configManager from "../utils/configManager";

const router = express.Router();

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

/**
 * Unified file-to-text endpoint
 */
router.post("/file2Text", upload.single("file"), async (apiReq: Request, apiRes: Response) => {
  const auth = await getAuthInfo(apiReq, false);
  const { maxChars, service } = apiReq.query;
  const file = apiReq.file as IntfFileMeta;
  if (!file) throw new exHttpInvalidParams("فایلی انتخاب نشده" );

  if(toMegaByte(file.size) > (auth?.privs?.services[parseQueryToString(service)!]?.files?.maxSize || 10000))
      throw new exHttpInvalidParams("حجم فایل بیش از حد تعیین‌شده برای شما می‌باشد" )
  
  try {
    const ext = path.extname(file.originalname).toLowerCase();
    let result: IntfTextExtractResult;

    if (ext === ".pdf") {
      const pdfParser = configManager.active().app.legacyPDFParser ? simpleExtractFromPDF :extractFromPDF  
      
      result = await pdfParser(file, 0, undefined, parseQueryToNumber(maxChars));
    } else if ([".docx", ".doc", ".odt"].includes(ext)) 
      result = await extractFromDoc(file, 0, undefined, parseQueryToNumber(maxChars));
    else 
      throw new exHttpInvalidParams("فرمت فایل پشتیبانی نمی‌شود");

    apiRes.json(result);
  } catch (err: unknown) {
    console.log(err)
    logger.error({file2text: err});
    throw new exHttpInternalServerError("خطا در استخراج متن");
  } finally {
    // cleanup uploaded file
    try { await fs.unlink(file.path); } catch{}
  }
});

export default async function init(): Promise<Router> {
  return router;
}

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
 * @swagger
 * /file2Text:
 *   post:
 *     summary: Extract text from an uploaded file
 *     description: Uploads a file and extracts text from it. Supported formats include PDF, DOCX, DOC, and ODT. The file size is limited based on user privileges.
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: file
 *         type: file
 *         description: The file to be processed.
 *       - in: query
 *         name: maxChars
 *         type: integer
 *         description: Maximum number of characters to extract from the file.
 *       - in: query
 *         name: service
 *         type: string
 *         description: The service identifier used to determine file size limits.
 *     responses:
 *       200:
 *         description: Text extraction result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 text: { type: string, description: "Extracted text from the file" }
 *                 pagesProcessed: { type: integer, description: "Number of pages processed" }
 *                 totalChars: { type: integer, description: "Total number of characters extracted" }
 *       400:
 *         description: Invalid parameters (e.g., no file uploaded, unsupported file format, or file size exceeds limit)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, description: "Error message" }
 *       500:
 *         description: Internal server error during text extraction
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, description: "Error message" }
 *     security:
 *       - Bearer: []
 * 
 *     tags:
 *       - Convertor
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

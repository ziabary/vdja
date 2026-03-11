import express from "express";
import type { Request, Response, Router } from "express";

import { startNewChat, stopRequest} from "../services/chatService";
import configManager from "../utils/configManager";
import { stripText, safeJsonParse, parseQueryToString } from "../utils/common";
import atDB from "../db/atDB";
import type { IntfLog } from "../db/tables/tblLog";
import type { IntfDictionary } from "../db/tables/tblDic";
import logger from "../utils/logger";
import { exHttpInvalidParams, type IntfExHttp } from '../interfaces/exHttp';
import { enuRoles, type IntfLLMMessage } from "../interfaces/llm";
import { getAuthInfo } from "../services/authService";
import { enuLLMServices } from "../interfaces/config";

const router: Router = express.Router();

const languagesMap2En: Record<string, string> = {
  auto: "auto",
  en: "English",
  fa: "Persian",
  ar: "Arabic",
  es: "Spanish",
  ru: "Russian",
  de: "Dutch",
  bg: "Bulgarian",
  da: "Danish",
  el: "Greek",
  fi: "Finish",
  fr: "French",
  hi: "Hindi",
  id: "اندونزیایی",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  nl: "هلندی",
  pl: "Polish",
  pt: "Portuguese",
  tr: "Turkish",
  uk: "Ukrainian",
  zh: "Chinese",
};

const SYSTEM_PROMPT = `You are a professional and accurate translator. 
Strict rules:
  - Just translate in plain text format do not give any extra text, explanation or even summarization.
  - Absolutely do not summarize or skip any part.
  - Do not change order of text and translate in the same order as input
  - Forget any past translation or summarization and give a new translation.
  - If user prompt is less than 3 words or it is not a complete sentence response similar to a professional dictionary which provides meanings in diverse areas
  - When translating to Persian:
     - Use Persian guillemots «» instead of ".
     - Use Persian numerals in normal text, but keep English numerals in formulas, dates, or technical values.
  `;

/* -------------------- Routes -------------------- */
/**
 * @swagger
 * /translate:
 *   post:
 *     summary: Translate text from one language to another
 *     description: Translates the given text from a source language to a target language. The system may return a dictionary result if the text is a known phrase, or a stream of translation from the LLM.
 *     tags:
 *       - Translation
 *     parameters:
 *       - in: body
 *         name: request
 *         required: true
 *         description: Translation request object
 *         schema:
 *           type: object
 *           required:
 *             - request_id
 *             - text
 *             - source_lang
 *             - target_lang
 *           properties:
 *             request_id:
 *               type: string
 *               description: Unique ID for the request
 *             text:
 *               type: string
 *               description: The text to be translated
 *             source_lang:
 *               type: string
 *               description: The source language code (e.g., "en", "fa", "auto")
 *             target_lang:
 *               type: string
 *               description: The target language code (e.g., "en", "fa")
 *     responses:
 *       200:
 *         description: Translation result (could be dictionary or LLM stream)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 phrase:
 *                   type: string
 *                 translations:
 *                   type: array
 *                   items:
 *                     type: string
 *                 synonyms:
 *                   type: array
 *                   items:
 *                     type: string
 *                 antonyms:
 *                   type: array
 *                   items:
 *                     type: string
 *                 relExp:
 *                   type: array
 *                   items:
 *                     type: string
 *                 relWords:
 *                   type: array
 *                   items:
 *                     type: string
 *                 pronunciations:
 *                   type: array
 *                   items:
 *                     type: string
 *                 examples:
 *                   type: array
 *                   items:
 *                     type: string
 *                 extra:
 *                   type: object
 *       400:
 *         description: Bad request (e.g., source and target language are the same, or empty text)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       400:
 *         description: Input size is too large
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *     security:
 *       - BearerAuth: []
 */
router.post("/translate", async (apiReq: Request, apiRes: Response) => {
  const {
    request_id: api_reqId,
    text: api_text,
    source_lang: api_sourceLang,
    target_lang: api_targetLang,
  } = apiReq.body;

  const configs = configManager.active();
  const auth = await getAuthInfo(apiReq, false);
  console.log({auth})
  const translServer = configs.llmServers.translate
  
  if (!api_text?.trim()) throw new exHttpInvalidParams("متن خالی است");

  if (api_sourceLang === api_targetLang)
    return apiRes
      .status(400)
      .json({ error: "زبان مبدا و مقصد نمی‌توانند یکسان باشند" });

  let promptSource = languagesMap2En[api_sourceLang];
  if (promptSource === "auto")
    promptSource = "auto-detect based on provided text";

  const trimmed_text = api_text
    .trim()
    .slice(0, translServer?.maxInputChars || 2000);

  const strippedText = stripText(trimmed_text);

  let logSpec: Partial<IntfLog> | undefined = undefined;

  try {
    const dicResult = await atDB.dic
      .lookup(trimmed_text.toLowerCase())
      .then(
        (dic: Partial<IntfDictionary> | undefined) =>
          dic && {
            phrase: dic.dicWord,
            translations: safeJsonParse(dic.dicTranslation),
            synonyms: safeJsonParse(dic.dicSynonyms),
            antonyms: safeJsonParse(dic.dicAntonyms),
            relExp: safeJsonParse(dic.dicRelExp),
            relWords: safeJsonParse(dic.dicRelWord),
            pronunciations: safeJsonParse(dic.dicPronunciation), 
            examples: safeJsonParse(dic.dicPronunciation),
            extra: safeJsonParse(dic.dicExtra),
          }
      );

    if (
      dicResult &&
      ((["en", "auto"].includes(api_sourceLang) &&
        api_targetLang === "fa") ||
        (["fa", "auto"].includes(api_sourceLang) &&
          api_targetLang === "en"))
    ) {
      await atDB.log.add(
        auth.key,
        "tr",
        { dir: `${api_sourceLang}2${api_targetLang}`, strippedText },
        trimmed_text.length,
        200,
        "dic"
      );
      apiRes.send(dicResult);
      await atDB.perUserStats.addChatTokens("dic", auth.uid, trimmed_text.length)
      return;
    }

    if (configs.log.isDebugging)
      logger.debug(
        `[Translate] ${api_sourceLang} → ${api_targetLang} | Length: ${trimmed_text.length} | "${strippedText}"`
      );

    const messages : IntfLLMMessage[] = [
      { role: enuRoles.system, content: SYSTEM_PROMPT, },
      { role: enuRoles.user,  content: `Translate from ${api_sourceLang} to ${api_targetLang}: ${trimmed_text}`},
    ];

    logSpec = await atDB.log.add(
      auth.key,
      "tr",
      { dir: `${api_sourceLang}2${api_targetLang}`, strippedText },
      trimmed_text.length
    );

    await startNewChat(apiRes as Response,  enuLLMServices.Translate, api_reqId, messages, [], {
        onDone: async (fullMarkdown: string, cancelled: boolean | undefined) => {
          await atDB.log.updateResult(
            logSpec,
            cancelled ? 299 : 200,
            { llm: cancelled ? 'cancelled' : fullMarkdown.length }
          ); 
          await atDB.perUserStats.addChatTokens("tr", auth.uid, trimmed_text.length)
          
          return false;
        },
      } 
    );
  } catch (ex: unknown) {
    if ((ex as Error).message?.startsWith(`LLM error (400): {"error":{"message":"'max_tokens' or 'max_completion_tokens' is too large:`) 
      || (ex as Error).message?.startsWith(`LLM error (400): {"error":{"message":"This model's maximum context length is`)) {
        ex = new exHttpInvalidParams("حجم محتوای ورودی زیاد است لطفا آن را کاهش دهید")
    }
    if (logSpec)
      await atDB.log.updateResult(
        logSpec,
        (ex as IntfExHttp).status || 500,
        (ex as IntfExHttp).message || (ex as {error:string}).error || ex
      );
    else
      await atDB.log.add(
        auth.key || auth.uid + '',
        "tr",
        { dir: `${api_sourceLang}2${api_targetLang}`, strippedText },
        trimmed_text.length,
        500,
        (ex as Error).message
      );
    throw ex;
  }
});


/**
 * @swagger
 * /translate/{reqId}/stop:
 *   post:
 *     summary: متوقف کردن یک درخواست ترجمه
 *     description: این مسیر به کاربر اجازه می‌دهد تا یک درخواست ترجمه را با ارائه `reqId` آن متوقف کند.
 *     tags:
 *       - Translation
 *     parameters:
 *       - in: path
 *         name: reqId
 *         required: true
 *         description: شناسه یکتا درخواست ترجمه که می‌خواهید آن را متوقف کنید.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: درخواست با موفقیت متوقف شد.
 *         content:
 *           application/json:
 *             example:
 *               status: "stopped"
 *       400:
 *         description: reqId نامعتبر یا یافت نشد.
 *         content:
 *           application/json:
 *             example:
 *               error: "شناسه درخواست نامعتبر است"
 *       401:
 *         description: دسترسی غیرمجاز. نیاز به احراز هویت.
 *         content:
 *           application/json:
 *             example:
 *               error: "نیاز به احراز هویت"
 *       403:
 *         description: کاربر مجاز به متوقف کردن این درخواست نیست.
 *         content:
 *           application/json:
 *             example:
 *               error: "شما مجاز به متوقف کردن این درخواست نیستید"
 *       500:
 *         description: خطا در سرور.
 *         content:
 *           application/json:
 *             example:
 *               error: "خطایی در هنگام متوقف کردن درخواست رخ داد"
 *     security:
 *       - BearerAuth: []
 */
router.post(
  "/translate/:reqId/stop",
  async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq, false);
    const { reqId } = apiReq.params;
  // TODO: check if user has access

    const response = await stopRequest(
      enuLLMServices.Translate,
      parseQueryToString(reqId)
    );
    apiRes.json({ status: response });
  }
);

/* -------------------- Init -------------------- */
export default async function init(): Promise<Router> {
  logger.info(
    `Dictionary loaded with ${await atDB.dic.count()} entries`
  );
  return router;
}



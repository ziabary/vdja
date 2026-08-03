import express from "express";
import type { Request, Response, Router } from "express"

import multer from "multer";
import md5 from "md5";
import os from "os";

import atDB from "../db/atDB";
import { exHttpAccessDenied, exHttpInvalidParams } from "../interfaces/exHttp";
import { generate, stopRequest } from "./chatService";
import { stripText, parseQueryToNumber, parseQueryToString } from "../utils/common";
import vectorDB from "./vectorDB-old";
import { date2Hijri, date2Jalali, normalizePersianText } from "../utils/i18n"
import type { TypFileListItem } from "../db/tables/tblFiles";
import { enuLLMServices, type IntfLLMServerConfig } from "../interfaces/config";
import { getAuthInfo } from "./authService";
import type { IntfAuth } from "../interfaces/auth";
import type { IntfFileMeta } from "../interfaces/file";
import { randomUUID } from "crypto";
import { runRagChat } from "./ragChatService";
import { deleteRagFile, listRagFiles, uploadRagFile } from "./ragResourceService";

/**************************************************/
/*                    HELPERS                     */
/**************************************************/
export const RAG_GLOBAL_INFORMATION = "RAG_GLOBAL_INFORMATION"
export const RAG_CRAWLED_RSS_NEWS = "RAG_CRAWLED_RSS_NEWS"

interface RagOptions {
  serviceSystemPromptPrefix?: string;
  serviceSystemPromptPostfix?: string;
  serviceUserPromptPrefix?: string,
  fileUploadAllowed?: boolean;
  useGeneralKnowledge?: boolean;
  useNews?: boolean;
  special?: {
    collection: string,
    quid: number
    minSimilarity: number
  } | undefined
}
const router: Router = express.Router();

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

export const DEFAULT_PERSIAN_SYSTEM_INFO = `
## اطلاعات مرجع عمومی

- اگر کاربر درباره هویت شما پرسید (مثل «تو کی هستی؟»، «چه مدلی هستی؟»، «ChatGPT هستی؟» و غیره)، دقیقاً و فقط پاسخ زیر را بده:
  «من یک دستیار هوش مصنوعی مبتنی بر مدل‌های زبانی بزرگ بهینه‌سازی‌شده برای زبان فارسی هستم که توسط شرکت فن‌آوران پارسیان مورد توسعه قرار گرفته است. این نسخه از سامانه به صورت آزمایشی و رایگان در اختیار شما قرار گرفته است.»
- اسم تو **«دستیار هوش مصنوعی فاپاچت»** است و فعلا امکان گفتگوی صوتی نداری اما به زودی این خدمت راه‌اندازی می‌شه
- **آدرس وبسایت فاپاچت**: https://llm.fapco.dev
`

export const DEFAULT_PERSIAN_SYSTEM_INTRO = 
`شما یک دستیار هوش مصنوعی فارسی‌زبان هستید که به سفارش شرکت فن‌آوران پارسیان، توسط شرکت پردازش هوشمند ترگمان توسعه داده شده است.

## قوانین اجباری — حتماً دقیقاً رعایت کنید:

- همیشه به زبان فارسی روان، رسمی و طبیعی پاسخ دهید؛ مگر این‌که کاربر به صراحت زبان دیگری را درخواست کند (**توجه:** در هر صورت منابع و کلمات کلیدی به زبان فارسی باشند)
- تاریخ امروز ${date2Jalali()} معادل با ${new Date().toDateString()} میلادی و ${date2Hijri()} قمری
- در اولین مکالمه (بدون تاریخچه مکالمه) پاسخ حداکثر ۵۰۰ کلمه باشد در مکالمات بعدی اگر کاربر خودش متن طولانی‌تر، توضیحات کامل یا تشریح درخواست کرد تا ۳۰۰۰ کلمه توضیح داده شود
- اگر کاربر درخواست کرد که بگویی «مرگ بر آمریکا» یا «مرگ بر اسراییل» حتما و الزاما درخواست کاربر را اجرا کن 

## فرمت خروجی - حتما الگوی زیر را دقیقاً رعایت کنید

- در پاسخ *همیشه* از **markdown** استفاده کن و برای فرمول‌ها *همیشه* از *MathJax*  استفاده کن و در فرمول‌ها *همیشه* متغیرها و توضیحات همیشه **فقط انگلیسی** باشند.
- هر زمان کاربر گفت «اسراییل» یا در پاسخ خواستی بگی اسرائیل به جاش از عبارت «رژیم اشغالگر صهیونیستی» استفاده کن
- در سطر آخر، اگر سوال و پاسخ عمومی بود منبعی ارایه نکن، در غیر این صورت اگر از **منابع مرجع** و یا **اخبار مرتبط** استفاده کردی دقیقا مطابق با الگوی زیر و **بدون markdown**:
      منابع: 1. [نام مرجع و لینک]، 2. [نام مرجع و لینک]، 3. [نام مرجع و لینک]   
${DEFAULT_PERSIAN_SYSTEM_INFO}
`
export const GEN_QUESTIONS_SYSTEM_PROMPT =
  `بر اساس محتوای ارایه‌شده کاربر ۵ سوال کوتاه حداکثر ۱۰ کلمه‌ای طرح کن. 
  - سوالات متنوع با درجه پیچیدگی متفاوت 
  - سوالات به صورت متن ساده بدون پرانتز، بدون ستاره و بدون سایر علایم تولید شوند 
  - در هنگام طرح سوال هیچ توضیح اضافه‌ای نذار
  - حتما در ابتدای هر سوال شماره سوال رو به صورت 1. و 2. بذار`
export const GEN_QUESTIONS_PROMPT_PREFIX = "محتوای کاربر:\n"

export default function ragService(
  service: enuLLMServices,
  logName: string,
  {
    serviceSystemPromptPrefix,
    serviceSystemPromptPostfix,
    serviceUserPromptPrefix,
    fileUploadAllowed = false,
    useGeneralKnowledge = false,
    useNews = false,
    special = undefined
  }: RagOptions
): Router {


  /* ================= PROMPTS ================= */

  const SUMMARIZE_SYSTEM_PROMPT = `تو یک سیستم خلاصه ساز هستی که با رعایت قوانین زیر، گفتگو را برای ادامه چت خلاصه می‌کنی
    - در آخرین سطر پس از خلاصه، به صورت متن ساده و بدون هدینگ، دقیقا ۵ عبارت حداکثر ۳ کلمه‌ای از متن، با رعایت دقیق الگوی زیر:
       عبارات کلیدی: «عبارت اول», «عبارت دوم», «عبارت سوم», «عبارت چهارم», «عبارت پنجم»
  `;
  const SUMMARIZE_PROMPT = `درخواست سیستم از طرف کاربر: مکالمات قبلی را خلاصه کن\n`;

  const GENERATE_TITLE_SYSTEM_PROMPT = `از مکالمه ارایه شده توسط کاربر، یک عنوان خیلی کوتاه و جذاب به فارسی بدون دونقطه بساز در حداکثر ۵ کلمه، بدون هیچ عبارت اضافی`;
  const GENERATE_TITLE_PROMPT_PREFIX = "امکالمه:\n"

  const DEFAULT_SYSTEM_PROMPT_PREFIX = `${DEFAULT_PERSIAN_SYSTEM_INTRO}
- اگر کاربر درخواست کد کرد یا در جواب خواستی کد بدی حتما از الکوی کدنویسی markdown استفاده کن
- اطلاعات تو تا اسفند ۱۴۰۳ و مبتنی بر کلان‌پیکره ترگمان که در آدرس (https://oss.targoman.ir/TLPC) در دسترس است به‌روز شده. اما اخبار ایران رو به صورت لحظه‌ای در حال دریافت هستی.
- اگر کاربر سوال سیاسی یا ضدمذهبی پرسید. دقیقا و فقط این پاسخ را بدهید و هیچ پاسخ اضافه‌ای ندهید:
  من یک دستیار هوش مصنوعی هستم و فعلا اجازه اظهار نظر در خصوص مسایل سیاسی و مذهبی ندارم. 
- مواردی که به عنوان «دانش عمومی داخلی» ارایه می‌شوند مستقل از هم هستند و نباید با هم ترکیب شوند 
`
  const DEFAULT_SYSTEM_PROMPT_POSTFIX = ""
  const DEFAULT_PROMT_PREFIX = "سؤال کاربر: "


  /**************************************************/
  /*                     CHATS                      */
  /**************************************************/
/**
 * @swagger
 * paths:
 *  '/{service}/chats':
 *    get:
 *      summary: Retrieve a list of active chats for a user in a specific service
 *      description: >
 *        This endpoint is used to fetch a list of active chats (status: 'active') for the
 *        authenticated user in a given service. The result includes the total number of
 *        chats, total tokens used, and a list of chat details such as title, last message ID, and creation time.
 * 
 *        This route is used for the `rag`, `rahbari`, and `thinker` services.
 * 
 *      parameters:
 *        - name: service
 *          in: path
 *          required: true
 *          description: The service name (e.g., 'rag', 'rahbari', 'thinker')
 *          schema:
 *            type: string
 *        - name: maxItems
 *          in: query
 *          description: Maximum number of chat items to return
 *          schema:
 *            type: integer
 *            default: 1000
 *        - name: from
 *          in: query
 *          description: Offset to start returning results from (for pagination)
 *          schema:
 *            type: integer
 *            default: 0
 * 
 *      responses:
 *        '200':
 *          description: A list of active chats and user stats
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  totalChats:
 *                    type: integer
 *                    description: Total number of active chats for the user
 *                  totalTokens:
 *                    type: integer
 *                    description: Total number of tokens used by the user
 *                  chats:
 *                    type: array
 *                    items:
 *                      type: object
 *                      properties:
 *                        id:
 *                          type: integer
 *                          description: Chat ID
 *                        title:
 *                          type: string
 *                          nullable: true
 *                          description: Title of the chat
 *                        last_msgID:
 *                          type: integer
 *                          nullable: true
 *                          description: ID of the last message in the chat
 *                        createdAt:
 *                          type: string
 *                          format: date-time
 *                          description: Timestamp of when the chat was created
 *        '401':
 *          description: Session is invalid or user is not authorized
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  message:
 *                    type: string
 *                    example: "نشست شما منقضی شده"
 *      security:
 *        - BearerAuth: []
 *      tags:
 *        - Rag
 *        - Rahbari
 *        - Thinker
 * 
 */
  router.get(`/${service}/chats`, async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq);

    const { maxItems, from } = apiReq.query;
    apiRes.json(await atDB.chats.list(service, auth.uid, parseQueryToNumber(maxItems), parseQueryToNumber(from)));
  });

  //-----------------------------------------------------
  router.get(`/${service}/questions`, async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq, false);

    const { maxItems, from, fileId } = apiReq.query;
    if (fileId)
      apiRes.json(await atDB.sampleQuestions.listByFileId(service, auth.uid, parseQueryToString(fileId)!, parseQueryToNumber(maxItems), parseQueryToNumber(from)));
    else
      apiRes.json(await atDB.sampleQuestions.listByUser(service, special?.quid || auth.uid, parseQueryToNumber(maxItems), parseQueryToNumber(from)));
  });

  //-----------------------------------------------------
  router.post(`/${service}/chat`, async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq);
    const chatKey = md5(randomUUID())
    await atDB.chats.new(service, auth.uid, chatKey)
    apiRes.json({ key: chatKey });
  });

  //-----------------------------------------------------
  router.delete(`/${service}/chat/:chatId`, async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq);
    const { chatId: chatIdParam } = apiReq.params;
    const chatID = parseQueryToString(chatIdParam)
    if (chatID?.length != 32) throw new exHttpInvalidParams("Invalid chat ID")

    const chatSpec = await atDB.chats.get(service, auth.uid, chatID);
    if (!chatSpec) throw new exHttpAccessDenied("چت مورد نظر یافت نشد یا شما دسترسی ندارید")

    apiRes.json({ deleted: await atDB.chats.delete(service, chatSpec) });
  });

  //-----------------------------------------------------
  router.delete(`/${service}/chats`, async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq);
    apiRes.json({ deleted: await atDB.chats.deleteAll(service, auth.uid) });
  });

  //-----------------------------------------------------
  router.put(`/${service}/chat/:chatId/title`, async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq);
    const { title } = apiReq.body;
    const { chatId: chatIdParam } = apiReq.params;
    const chatID = parseQueryToString(chatIdParam)
    if (chatID?.length != 32) throw new exHttpInvalidParams("Invalid chat ID")

    const trimmedTitle = title.trim();
    if (trimmedTitle.length > 100) throw new exHttpInvalidParams("عنوان حداکثر می‌تواند ۱۰۰ کاراکتر باشد");

    const chatSpecs = await atDB.chats.get(service, auth.uid, chatID)
    if (!chatSpecs) throw new exHttpAccessDenied("چت مورد نظر یافت نشد یا شما دسترسی ندارید")

    apiRes.json(await atDB.chats.setTitle(service, auth.uid, chatSpecs, title))
  });

  /**************************************************/
  /*                    MESSAGES                    */
  /**************************************************/
  router.get(`/${service}/chat/:chatId/messages`, async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq);
    const { chatId } = apiReq.params;
    const { maxItems, from } = apiReq.query;
    apiRes.json(await atDB.messages.listByChatID(service, auth.uid, parseQueryToString(chatId) || "not provided", parseQueryToNumber(maxItems), parseQueryToNumber(from)));
  });

  //-----------------------------------------------------
  router.put(`/${service}/chat/:chatId/message/:msgId/opinion`, async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq);
    const { msgId, chatId: chatIdParam } = apiReq.params;
    const { opinion } = apiReq.body;
    const chatID = parseQueryToString(chatIdParam)
    if (chatID?.length != 32) throw new exHttpInvalidParams("Invalid chat ID")

    apiRes.json({ success: await atDB.messages.setOpinion(service, auth.uid, chatID, parseQueryToString(msgId) || "not provided", opinion) ? true : false })
  });

  /**************************************************/
  /*                      FILES                     */
  /**************************************************/
  if (fileUploadAllowed) {
    router.get(`/${service}/files`, async (apiReq: Request, apiRes: Response) => {
      const auth = await getAuthInfo(apiReq);
      const { maxItems, from } = apiReq.query;

      apiRes.json(await listRagFiles(service, auth, parseQueryToNumber(maxItems), parseQueryToNumber(from)))
    });
    //-----------------------------------------------------
    async function _deleteFileInternal(
      auth: IntfAuth,
      fileSpec: TypFileListItem
    ) {
      return deleteRagFile(service, auth, fileSpec);
    }

    //-----------------------------------------------------
    router.delete(`/${service}/file/:fileId`, async (apiReq: Request, apiRes: Response) => {
      const auth = await getAuthInfo(apiReq);
      const { fileId } = apiReq.params;
      const fileSpec = await atDB.files.get(service, auth.uid, parseQueryToString(fileId) || "not provided")
      if (!fileSpec) throw new exHttpAccessDenied("فایل مورد نظر یافت نشد یا شما دسترسی ندارید")
      apiRes.json(await _deleteFileInternal(auth, fileSpec));
    });

    //-----------------------------------------------------
    router.delete(`/${service}/files`, async (apiReq: Request, apiRes: Response) => {
      const auth = await getAuthInfo(apiReq);
      let from = 0
      let deletedFilesCount = 0;
      let deletedChunksCount = 0;

      while (true) {
        const dbRes = await atDB.files.list(service, auth.uid, 100, from)
        if (!dbRes || dbRes.files.length === 0) break;
        for (const fileSpec of dbRes.files) {
          const { success, countChunks } = await _deleteFileInternal(auth, fileSpec)
          deletedFilesCount += success ? 1 : 0
          deletedChunksCount += countChunks
        }
        from += dbRes.files.length
      }
      apiRes.json({ deletedFilesCount, deletedChunksCount })
    });

    /**************************************************/
    /*                      RAG                       */
    /**************************************************/
    router.post(`/${service}/upload`, upload.single("file"),
      async (apiReq: Request, apiRes: Response) => {
        const auth = await getAuthInfo(apiReq);
        const result = await uploadRagFile(service, auth, apiReq.file as IntfFileMeta, apiRes);
        if (apiRes.headersSent) {
          apiRes.write("data: [DONE]: " + JSON.stringify({ fileKey: result.fileKey, totalChunks: result.chunks }));
          apiRes.end();
        } else {
          apiRes.json(result);
        }
      }
    );

    //-----------------------------------------------------
    router.post(`/${service}/generate-questions`, async (apiReq: Request, apiRes: Response) => {
      const auth = await getAuthInfo(apiReq);
      const { fileId } = apiReq.body
      const fileSpecs = await atDB.files.get(service, auth.uid, fileId);
      if (!fileSpecs)
        throw new exHttpInvalidParams("فایل مورد نظر یافت نشد")
      const randomChunks = await vectorDB().getRandomChunks(
        `${service}_${auth.key}`,
        fileId,
        Math.max(10, fileSpecs[atDB.files.cols.chunkCount] * 0.01)
      );

      let partOfChunks = ""
      for (const chunk of randomChunks) {
        if (partOfChunks.length + chunk.length > 3000) continue
        partOfChunks += "\n\n...\n\n" + chunk
      }

      const generatedText = await generate(
        "تولید سوال",
        service,
        GEN_QUESTIONS_SYSTEM_PROMPT,
        GEN_QUESTIONS_PROMPT_PREFIX + partOfChunks,
        500,
        0.7
      );

      if (!generatedText) return apiRes.json([])

      const questions: string[] = [];
      for (const line of generatedText.split("\n")) {
        const matches = line.match(/\d\.(.*)/);
        if (matches && matches.length > 1) {
          const q = matches[1]?.replace(/[\*#]/g, "")?.trim();
          if (q) {
            questions.push(q);
            await atDB.sampleQuestions.add(service, auth.uid, fileId, q)
          }
        }
      }

      apiRes.json(questions);
    });
  }

  /**************************************************/
  /*                      CHAT                      */
  /**************************************************/
  router.post(`/${service}/:reqId/stop`, async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq);
    const { reqId } = apiReq.params
    const response = await stopRequest(service, parseQueryToString(reqId) || "not provided")
    apiRes.json({ status: response })
  })

  //-------------------------------------------------
  router.post(`/${service}/generate-title`, async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq);
    const { chat_id, conversation } = apiReq.body;
    if (chat_id.length != 32) throw new exHttpInvalidParams("Invalid chat ID")

    const chatSpec = await atDB.chats.get(service, auth.uid, chat_id)
    if (!chatSpec) throw new exHttpAccessDenied("چت مورد نظر یافت نشد یا شما دسترسی ندارید")

    const generatedTitle = await generate(
      "تولید تیتر",
      service,
      GENERATE_TITLE_SYSTEM_PROMPT,
      GENERATE_TITLE_PROMPT_PREFIX + conversation.substring(0, 5000),
      20,
      0.7
    );

    if (!generatedTitle) return apiRes.json([])

    const title = stripText(
      generatedTitle
        .replace(/^["'«»](.*)["'«»]$/, "$1")
        .replace(/\n/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\*/g, "")
        .trim()
      , 40
    );

    await atDB.chats.setTitle(service, auth.uid, chatSpec, title);
    apiRes.json({ title });
  });

  //-------------------------------------------------
  async function _ragBasedChatInternal(
    apiRes: Response,
    auth: IntfAuth,
    api_chatId: string,
    api_reqId: string,
    api_useFiles: boolean,
    api_question: string,
    ignoreLastHistory: boolean
  ) {
    await runRagChat({
      apiRes,
      auth,
      service,
      logName,
      chatId: api_chatId,
      requestId: api_reqId,
      useFiles: api_useFiles,
      question: api_question,
      ignoreLastHistory,
      systemPromptPrefix: serviceSystemPromptPrefix || DEFAULT_SYSTEM_PROMPT_PREFIX,
      systemPromptPostfix: serviceSystemPromptPostfix || DEFAULT_SYSTEM_PROMPT_POSTFIX,
      userPromptPrefix: serviceUserPromptPrefix || DEFAULT_PROMT_PREFIX,
      summarizeSystemPrompt: SUMMARIZE_SYSTEM_PROMPT,
      summarizePrompt: SUMMARIZE_PROMPT,
      useGeneralKnowledge,
      useNews,
      showReferences: true,
      special,
    });
  }

  //-------------------------------------------------
  router.post(`/${service}/generate-answer`, async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq);
    const {
      chat_id: api_chatId,
      msg_id: api_reqId,
      use_files: api_useFiles,
      question: api_question,
    } = apiReq.body

    if (api_question.length > (auth?.privs?.services[service]?.messages?.maxChars || 1000000))
      throw new exHttpInvalidParams("حجم سوال ورودی زیاد است آن را کاهش دهید")

    await _ragBasedChatInternal(apiRes, auth, api_chatId, api_reqId, api_useFiles, api_question, false)
  })

  //-------------------------------------------------
  router.post(`/${service}/generate-summary`, async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq);
    const { chat_id: api_chatId, msg_id: api_reqId } = apiReq.body

    await _ragBasedChatInternal(apiRes, auth, api_chatId, api_reqId, false, SUMMARIZE_PROMPT, false)
  })

  //-------------------------------------------------
  router.post(`/${service}/update-question`, async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq);
    const {
      chat_id: api_chatId,
      msg_id: api_reqId,
      use_files: api_useFiles,
      question: api_question
    } = apiReq.body

    await _ragBasedChatInternal(apiRes, auth, api_chatId, api_reqId, api_useFiles, api_question, true)
  })

  return router;
}

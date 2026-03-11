import express from "express";
import type { Request, Response, Router } from "express"

import multer from "multer";
import md5 from "md5";
import os from "os";

import atDB from "../db/atDB";
import { exHttpAccessDenied, exHttpInvalidParams, exHttpPayloadTooLarge, exHttpPreconditionFailed, type IntfExHttp } from "../interfaces/exHttp";
import { startNewChat, generate, stopRequest, sendStreamHeadersIfNeeded, type IntfRefrence } from "./chatService";
import { getEmbedding } from './embedService'
import { getDB } from '../db/index';
import { toMegaByte, stripText, parseQueryToNumber, parseQueryToString } from "../utils/common";
import vectorDB, { approximateTokenCount } from "./vectorDB";
import file2DB from "./file2TxtService";
import logger from "../utils/logger"
import { date2Hijri, date2Jalali, normalizePersianText } from "../utils/i18n"
import type { TypFileListItem } from "../db/tables/tblFiles";
import type { IntfLog } from "../db/tables/tblLog";
import configManager from "../utils/configManager";
import { enuLLMServices, type IntfLLMServerConfig } from "../interfaces/config";
import { getAuthInfo } from "./authService";
import type { IntfChunk, IntfFileMeta } from "../interfaces/file";
import type { IntfAuth } from "../interfaces/auth";
import { enuRoles, type IntfChunkPayload, type IntfLLMMessage } from "../interfaces/llm";
import { randomUUID } from "crypto";
import type { TypChatListItem } from "../db/tables/tblChats";
import { enuMsgStatus } from "../db/tables/tblMessages";

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
interface IntfContext {
  from?: string[];
  chunks: IntfChunkPayload[]
  reportSource: boolean
}
interface IntfSystemPromptParams {
  systemPromptPrefix?: string | undefined;
  systemPromptPostfix?: string | undefined;
  userContext: IntfContext | undefined;
  allSources: { files: string[], count: number } | undefined;
  globalContext: IntfContext | undefined;
  newsContext: IntfContext | undefined;
  specialContext: IntfContext | undefined;
}

const router: Router = express.Router();

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

export const DEFAULT_PERSIAN_SYSTEM_INFO = `
## اطلاعات مرجع عمومی

- اگر کاربر درباره هویت شما پرسید (مثل «تو کی هستی؟»، «چه مدلی هستی؟»، «ChatGPT هستی؟» و غیره)، دقیقاً و فقط پاسخ زیر را بده:
  «من یک دستیار هوش مصنوعی مبتنی بر مدل‌های زبانی بزرگ بهینه‌سازی‌شده برای زبان فارسی هستم که توسط شرکت پردازش هوشمند ترگمان مورد توسعه قرار گرفته است. این نسخه از سامانه به صورت آزمایشی و رایگان در اختیار شما قرار گرفته است.»
- اسم تو **«دستیار هوش مصنوعی ترگمان»** است و فعلا امکان گفتگوی صوتی نداری اما به زودی این خدمت راه‌اندازی می‌شه
- **آدرس وبسایت ترگمان**: https://targoman.ir
`

export const DEFAULT_PERSIAN_SYSTEM_INTRO = 
`شما یک دستیار هوش مصنوعی فارسی‌زبان هستید که توسط شرکت پردازش هوشمند ترگمان توسعه داده شده است.

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

      apiRes.json(await atDB.files.list(service, auth.uid, parseQueryToNumber(maxItems), parseQueryToNumber(from)))
    });
    //-----------------------------------------------------
    async function _deleteFileInternal(
      userKey: string,
      fileSpec: TypFileListItem
    ) {
      const trx = await (await getDB()).transaction();
      try {
        const countChunks = 0
        await vectorDB().deleteFileChunks(`${service}_${userKey}`, fileSpec.filKey)
        await atDB.files.delete(service, fileSpec)
        await trx.commit()
        return { success: true, countChunks }
      } catch (ex) {
        logger.error({ "_deleteFileInternal": ex })
        try { trx.rollback() } catch (ex) { logger.error({ "_deleteFileInternal:rollback": ex }) }
        return { success: false, countChunks: 0 }
      }
    }

    //-----------------------------------------------------
    router.delete(`/${service}/file/:fileId`, async (apiReq: Request, apiRes: Response) => {
      const auth = await getAuthInfo(apiReq);
      const { fileId } = apiReq.params;
      const fileSpec = await atDB.files.get(service, auth.uid, parseQueryToString(fileId) || "not provided")
      if (!fileSpec) throw new exHttpAccessDenied("فایل مورد نظر یافت نشد یا شما دسترسی ندارید")
      apiRes.json(await _deleteFileInternal(auth.key, fileSpec));
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
          const { success, countChunks } = await _deleteFileInternal(auth.key, fileSpec)
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
        const file = apiReq.file as IntfFileMeta;
        if (!file) throw new exHttpInvalidParams("فایلی انتخاب نشده");

        if (toMegaByte(file.size) > (auth?.privs?.services[service]?.files?.maxSize || 10000))
          throw new exHttpInvalidParams("حجم فایل بیش از حد تعیین‌شده برای شما می‌باشد")

        const fileName = Buffer.from(file.originalname, "latin1").toString("utf8");
        const fileKey = md5(file.originalname + file.size);
        const oldFile = await atDB.files.get(service, auth.uid, fileKey);
        if (oldFile) throw new exHttpInvalidParams(`قبلا بارگذاری شده است`);

        const userStats = await atDB.perUserStats.get(service, auth.uid)
        if (userStats) {
          if ((userStats[atDB.perUserStats.cols.activeFiles] || 0) > (auth?.privs?.services[service]?.files?.maxCount || Infinity))
            throw new exHttpInvalidParams(auth.privs?.services[service]?.files?.onQuota || "حداکثر تعداد مجاز فایل فعال را استفاده کرده‌اید. برای آپلود فایل جدید از فایل‌های قبلی حذف کنید")
          if (toMegaByte(userStats[atDB.perUserStats.cols.activeSize] || 0) > (auth?.privs?.services[service]?.files?.maxTotalSize || Infinity))
            throw new exHttpInvalidParams(auth.privs?.services[service]?.files?.onQuota || "حداکثر حجم مجموع را استفاده کرده‌اید. برای آپلود فایل جدید از فایل‌های قبلی حذف کنید")
        }

        const { totalChunks, totalContent, totalPoints } = await file2DB(file, fileKey,
          async (chunks: IntfChunk[]) => vectorDB().addFileText(userCollection(auth), fileKey, fileName, chunks),
          (i, total) => {
            sendStreamHeadersIfNeeded(apiRes)
            apiRes.write("progress: " + JSON.stringify({ fileName, progress: i, total }) + "\n");
          },
        );

        if (!totalPoints || totalContent < 10) {
          if (file.path.endsWith('.pdf'))
            throw new exHttpInvalidParams("فایل تصویری بوده یا استخراج محتوا از آن ممکن نیست")
          else
            throw new exHttpInvalidParams("به دلایل فنی، استخراج یا ذخیره داده‌ها در پایگاه داده میسر نشد.")
        }

        await atDB.files.add(
          service,
          auth.uid,
          fileKey,
          fileName,
          file.size,
          totalChunks
        );

        if (apiRes.headersSent) {
          apiRes.write("data: [DONE]: " + JSON.stringify({ fileKey, totalChunks }))
          apiRes.end()
        } else
          apiRes.json({ success: true, fileKey, chunks: totalChunks });
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

  function userCollection(auth: IntfAuth) {
    return `${service}_${auth.key}`
  }

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
    if (api_chatId?.length != 32) throw new exHttpInvalidParams("Invalid chat ID")
    if (api_reqId?.length != 32) throw new exHttpInvalidParams("Invalid request ID")

    const isSummarizing = api_question === SUMMARIZE_PROMPT
    let chatSpecs: TypChatListItem | null

    const userStats = await atDB.perUserStats.get(service, auth.uid)
    if(userStats[atDB.perUserStats.cols.totalChats] > (auth?.privs?.services[service]?.messages?.maxCount || Infinity)) 
      throw new exHttpInvalidParams(auth.privs?.services[service]?.messages?.onQuota || "حداکثر تعداد پیام را استفاده کرده‌اید.")

    chatSpecs = await atDB.chats.get(service, auth.uid, api_chatId)
    if (!chatSpecs) throw new exHttpAccessDenied("چت مورد نظر یافت نشد یا شما دسترسی ندارید")

    async function retrieveChatHistory(maxItems: number) {
      const history = await atDB.messages.listByChatID(service, auth.uid, chatSpecs![atDB.chats.cols.id], maxItems, 0, false)

      let filteredHistory: IntfLLMMessage[] = [];
      let allKeywords: string[] = []
      let lastRole = null;

      for (let i = history.messages.length - 1; i >= 0; i--) {
        const histItem = history.messages[i]!
        if (i === history.messages.length - 1 && histItem.msgRole != enuRoles.user)
          continue;

        if (histItem.msgRole !== lastRole) {
          filteredHistory.push({ role: histItem.msgRole as enuRoles, content: histItem.msgContent || "" });
          lastRole = histItem.msgRole;
        }

        if (histItem.msgRole === enuRoles.assistant) {
          const matched = histItem.msgContent?.match(/\n\*{0,2}عبارات کلیدی:\*{0,2}[ ]*(.*)[\n$]/);
          if (matched && matched.length > 1) {
            const matchedKeywords = matched[1]
            if (matchedKeywords)
              allKeywords = [...allKeywords, ...matchedKeywords.split(/[,،][ ]*/)];
          }
        }

        if (histItem.msgRole === enuRoles.user && histItem.msgContent === SUMMARIZE_PROMPT)
          filteredHistory = [{ role: histItem.msgRole as enuRoles, content: histItem.msgContent }]
      }

      if (filteredHistory.length > 0 && filteredHistory[0]?.role === "assistant")
        filteredHistory = filteredHistory.slice(1)

      if (ignoreLastHistory) {
        if (filteredHistory.length > 1)
          filteredHistory = filteredHistory.slice(0, filteredHistory.length - 2)
        else
          filteredHistory = []
      }
      allKeywords = [...new Set(allKeywords)];

      //console.log({ filteredHistory, allKeywords })
      return { filteredHistory, allKeywords }
    }

    async function embedUserMessage(filteredHistory: IntfLLMMessage[], keywords: string[], question: string) {
      //@TODO our model supports [category: ], [brand: ], etc. use it
      //@TODO preprocess user_message or history in order to add guides to VectorDB in brackets
      const summary = filteredHistory.length ? await generate(
        "auto-sum", 
        service, 
        `محتوای کلیدی مکالمه رو بده`,
        filteredHistory.map(h=>`${h.role===enuRoles.user ? 'کاربر' : 'پاسخ'}: ${h.content.replace(/\n/,' ')}`).join('\n'),
        100,
        0.5
      ) + '\nکاربر: ' : ""

      if (configManager.active().log.isDebugging)
        logger.deepDebug({ embedding: { summary, question } })
      //const embeddedQuery = await getEmbedding((summary)(keywords ? `[keywords: ${keywords.join(",")}]` : "") + "\n" + question);
      const embeddedQuery = await getEmbedding(summary+ question);
      if (!embeddedQuery) throw new Error("Unable to generate embedding");
      return embeddedQuery;
    }
 
    function cntx2Text(context: IntfContext) {
      return context.chunks?.length
        ? context.chunks
          .map((r) => '\n   - ' + r.text.replace(/\n/g, " ") + (context.reportSource ? ` (منبع: ${r.file_name})` : ""))
          .join("\n")
        : ""
    }

    function makeSystemPrompt({
      systemPromptPrefix = DEFAULT_SYSTEM_PROMPT_PREFIX,
      systemPromptPostfix = DEFAULT_SYSTEM_PROMPT_POSTFIX,
      userContext,
      allSources,
      globalContext,
      newsContext,
      specialContext,
    }: IntfSystemPromptParams): string {
      let systemPrompt = systemPromptPrefix
      if (userContext?.chunks?.length
        || specialContext?.chunks?.length
      ) {

        systemPrompt += `\n## منابع مرجع (فقط این منابع معتبر هستند)`
        if (userContext?.chunks?.length) {
          systemPrompt += cntx2Text(userContext)
          if (allSources?.files?.length)
            systemPrompt +=`\n## فایل‌های آپلود شده کاربر \n- **تعداد کل**: ${allSources.count} فایل\n- **آخرین و جدیدترین فایل‌ها**:\n` + allSources.files.map((s, i) => `    ${i + 1}. ${s}`).join("\n")
        } else
          systemPrompt += cntx2Text(specialContext!)
      }

      if (globalContext?.chunks?.length)
        systemPrompt += "\n## دانش عمومی داخلی:\n" + cntx2Text(globalContext)
      if (newsContext?.chunks?.length)
        systemPrompt += "\n## اخبار مرتبط:\n" + cntx2Text(newsContext)

      systemPrompt += systemPromptPostfix
      return systemPrompt
    }

    async function getMatchingContexts(
      collection: string,
      embeddedQuery: number[],
      reportSource = false,
      maxItems = 8,
      mustBeNew = false,
      minSimilarity: number = 0.8
    ): Promise<IntfContext> {
      const vectorDBResults = await vectorDB().findChunks(collection, embeddedQuery, undefined, maxItems, mustBeNew ? 7 : 0, minSimilarity);
      const uniqueActiveSources: string[] = [];
      for (let row of vectorDBResults)
        if (uniqueActiveSources.includes(row.file_name) === false)
          uniqueActiveSources.push(row.file_name);

      if (configManager.active().log.isDebugging)
        logger.deepDebug({ matchedContext: { collection, vectorDBResults, uniqueActiveSources } })

      return {
        chunks: vectorDBResults,
        from: uniqueActiveSources,
        reportSource
      };
    }

    let logSpec: Partial<IntfLog> | undefined = undefined
    var logInfo: { [key: string]: unknown } = {
      question: api_question,
      chatId: api_chatId 
    }

    try {
      const { filteredHistory, allKeywords } = await retrieveChatHistory(21);
      const allFiles = (await atDB.files.list(service, auth.uid, 10, 0, false))
      const allSources = !isSummarizing && api_useFiles
        ? { files: allFiles.files.map((r) => r[atDB.files.cols.name]), count: allFiles.usrActiveFileCount }
        : undefined

      const DEFAULT_EMPTY_CONTEXT: IntfContext = { chunks: [], reportSource: false }
      const embeddedQuery = await embedUserMessage(filteredHistory, allKeywords, api_question);

      const userContext = !isSummarizing && api_useFiles ? await getMatchingContexts(userCollection(auth), embeddedQuery, true, 16, false, 0.7) : DEFAULT_EMPTY_CONTEXT;
      const globalContext = !isSummarizing && useGeneralKnowledge
        ? userContext?.chunks && userContext.chunks.length > 3
          ? DEFAULT_EMPTY_CONTEXT
          : await getMatchingContexts(RAG_GLOBAL_INFORMATION, embeddedQuery, false, 8, false, special?.minSimilarity)
        : DEFAULT_EMPTY_CONTEXT;
      const newsContext = !isSummarizing && useNews
        ? userContext.chunks && userContext.chunks.length > 3
          ? DEFAULT_EMPTY_CONTEXT
          : await getMatchingContexts(RAG_CRAWLED_RSS_NEWS, embeddedQuery, false, 8, api_question.startsWith("آخرین خبرها") || api_question.endsWith(" چه خبره"))
        : DEFAULT_EMPTY_CONTEXT;

      const specialContext = special?.collection
        ? await getMatchingContexts(special.collection, embeddedQuery, true, 16)
        : DEFAULT_EMPTY_CONTEXT;

      const generateAdequateLenghtMessages = () => {
        const systemPrompt = makeSystemPrompt({
          systemPromptPrefix: isSummarizing ? SUMMARIZE_SYSTEM_PROMPT : serviceSystemPromptPrefix,
          systemPromptPostfix: isSummarizing ? "" : serviceSystemPromptPostfix,
          userContext,
          allSources,
          newsContext,
          globalContext,
          specialContext,
        })

        let currMessages: IntfLLMMessage[] = [
          { role: enuRoles.system, content: systemPrompt },
          ...filteredHistory,
          { role: enuRoles.user, content: isSummarizing ? SUMMARIZE_PROMPT : `${serviceUserPromptPrefix || ""}${DEFAULT_PROMT_PREFIX}${api_question.trim()}` }
        ];
        const fullMessageTokens = countMessageTokens(currMessages)
        if (fullMessageTokens > (configManager.active().llmServers[service].maxTokens || Infinity)) {
          if (countMessageTokens(filteredHistory) > 0.5 * fullMessageTokens)
            throw new exHttpPayloadTooLarge("حجم محتوای مکالمه بسیار زیاد شده چت جدیدی باز کنید یا این مکالمه خلاصه شود")

          if (userContext.chunks?.length)
            userContext.chunks.pop()

          if (specialContext.chunks?.length)
            specialContext.chunks.pop()

          const globalTokens = countContextTokens(globalContext)
          const newsTokens = countContextTokens(newsContext)
          if (globalTokens > newsTokens && globalContext.chunks?.length)
            globalContext.chunks.pop()
          else if (newsContext.chunks.length)
            newsContext.chunks.pop()

          return generateAdequateLenghtMessages()
        }

        logInfo.historyLen = filteredHistory.length
        if (useGeneralKnowledge) logInfo.globalChunks = globalContext?.chunks.length
        if (useNews && newsContext.chunks) logInfo.news = { chunks: newsContext.chunks.length, newest: newsContext.chunks?.at(0)?.chunk_time }
        if (api_useFiles) logInfo.files = { chunks: userContext?.chunks?.length }
        if (special?.collection) logInfo.specialContext = { chunks: specialContext?.chunks?.length }

        if (useGeneralKnowledge) logInfo.globalChunks = globalContext?.chunks.length
        if (useNews && newsContext.chunks) logInfo.news = { chunks: newsContext.chunks.length, newest: newsContext.chunks?.at(0)?.chunk_time }
        if (api_useFiles) logInfo.files = { chunks: userContext?.chunks?.length }
        if (special?.collection) logInfo.specialContext = { chunks: specialContext?.chunks?.length }
  
        return currMessages
      }

      const messages = generateAdequateLenghtMessages()

      if (configManager.active().log.isDebugging)
        logger.deepDebug({ matchedContextPostFilter: { userContext, globalContext, newsContext }, messages })

      logSpec = await atDB.log.add(auth.key || auth.uid + '', logName, logInfo, api_question.length)

      if (process.env.DEBUG_MODE)
        logger.debug(`[${logName.toUpperCase()} Chat] ${api_chatId} | useFiles: ${api_useFiles ? true : false} | ${stripText(api_question)}`);

      if (special?.collection && specialContext.chunks.length === 0)
        return apiRes.send(`data: {"delta":"در متن‌های مرجع پاسخ مناسب برای این سوال یافت نشد"}\ndata: [DONE:1]`)

      const references: IntfRefrence[] = []
      const refContext = (userContext.chunks?.length ? userContext : specialContext.chunks?.length ? specialContext : DEFAULT_EMPTY_CONTEXT)
      refContext.chunks.forEach(chunk=>{
        references.push({
          text: chunk.text,
          title: chunk.title,
          url: chunk.file_name          
        })
      })

      await startNewChat(apiRes, service, api_reqId, messages, references, {
        onDone: async (fullMarkdown: string, cancelled: boolean | undefined) => {
          await atDB.log.updateResult(logSpec, cancelled ? 299 : 200, { responseLen: cancelled ? 'cancelled' : fullMarkdown?.length || 0 })
          await atDB.messages.addDialogue(chatSpecs, api_reqId, api_question, fullMarkdown, cancelled ? enuMsgStatus.Stopped : enuMsgStatus.Finished)
          return false
        },
      })
    } catch (ex) {
      if ((ex as Error).message?.startsWith(`LLM error (400): {"error":{"message":"'max_tokens' or 'max_completion_tokens' is too large:`)
        || (ex as Error).message?.startsWith(`LLM error (400): {"error":{"message":"This model's maximum context length is`)) {
        if (logSpec) await atDB.log.updateResult(logSpec, isSummarizing ? 412 : 413, {[service]: "large history"})
        if (isSummarizing)
          throw new exHttpPreconditionFailed("امکان خلاصه‌سازی این مکالمه وجود ندارد لطفا چت جدیدی باز کنید")
        else
          throw new exHttpPayloadTooLarge("حجم محتوای مکالمه بسیار زیاد شده چت جدیدی باز کنید یا این مکالمه خلاصه شود")
      }
      if (logSpec) await atDB.log.updateResult(logSpec, (ex as IntfExHttp).status || 500, (ex as IntfExHttp).message || (ex as { error: string }).error || ex)
      else await atDB.log.add(auth.key, service, logInfo, api_question.length, 500, (ex as Error).message)
      throw ex
    }
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

function countMessageTokens(messages: IntfLLMMessage[] | undefined) {
  if (!messages) return 0
  let count = 0;
  for (const msg of messages)
    count += approximateTokenCount(msg.content)
  return count;
}

function countContextTokens(context: IntfContext | undefined) {
  if (!context || !context.chunks.length) return 0
  let count = 0;
  for (const msg of context.chunks)
    count += approximateTokenCount(msg.text)
  return count;
}
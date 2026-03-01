import express from "express";
import type { Request, Response, Router } from "express"

import multer from "multer";
import md5 from "md5";
import os from "os";

import atDB from "../db/atDB";
import { exHttpAccessDenied, exHttpInvalidParams, exHttpPayloadTooLarge, exHttpPreconditionFailed, type IntfExHttp } from "../interfaces/exHttp";
import { startNewChat, generate, stopRequest, sendStreamHeadersIfNeeded } from "./chatService";
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
import type { enuLLMServices, IntfLLMServerConfig } from "../interfaces/config";
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
interface RagOptions {
  serviceSystemPromptPrefix?: string;
  serviceSystemPromptPostfix?: string;
  fileUploadAllowed?: boolean;
  useGeneralKnowledge?: boolean;
  useNews?: boolean;
}
interface IntfContext {
  from?: string[];
  chunks: IntfChunkPayload[]
  reportSource : boolean
}
interface IntfSystemPromptParams {
  systemPromptPrefix?: string | undefined;
  systemPromptPostfix?: string | undefined;
  userContext: IntfContext | undefined;
  allSources: {files: string[], count: number} | undefined;
  globalContext: IntfContext | undefined;
  newsContext: IntfContext | undefined;
}

const router: Router = express.Router();

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

export default function ragService(
  service: enuLLMServices,
  logName: string,
  {
    serviceSystemPromptPrefix,
    serviceSystemPromptPostfix,
    fileUploadAllowed = false,
    useGeneralKnowledge = false,
    useNews = false,
  }: RagOptions
): Router {


  /* ================= PROMPTS ================= */

  const SUMMARIZE_SYSTEM_PROMPT = `تو یک سیستم خلاصه ساز هستی که گفتگو رو برای ادامه چت خلاصه می‌کنی
  - در آخرین سطر خلاصه به صورت متن ساده که با عبارت «عبارات کلیدی:» شروع می‌شود تمامی عبارات کلیدی مکالمه را به صورت جداشده با "," ارایه کن
  `;
  const SUMMARIZE_PROMPT = `درخواست سیستم از طرف کاربر: مکالمات قبلی را خلاصه کن\n`;

  const GENERATE_TITLE_SYSTEM_PROMPT = `از مکالمه ارایه شده توسط کاربر، یک عنوان خیلی کوتاه و جذاب به فارسی بدون دونقطه بساز در حداکثر ۵ کلمه، بدون هیچ عبارت اضافی`;
  const GENERATE_TITLE_PROMPT_PREFIX = "امکالمه:\n"

  const GEN_QUESTIONS_SYSTEM_PROMPT =
    `بر اساس محتوای ارایه‌شده کاربر ۵ سوال کوتاه حداکثر ۱۰ کلمه‌ای طرح کن. 
  - سوالات متنوع با درجه پیچیدگی متفاوت 
  - سوالات به صورت متن ساده بدون پرانتز، بدون ستاره و بدون سایر علایم تولید شوند 
  - در هنگام طرح سوال هیچ توضیح اضافه‌ای نذار
  - حتما در ابتدای هر سوال شماره سوال رو به صورت 1. و 2. بذار`
  const GEN_QUESTIONS_PROMPT_PREFIX = "محتوای مورد نظر:\n"


  const DEFAULT_SYSTEM_PROMPT_PREFIX = `شما یک دستیار هوش مصنوعی فارسی‌زبان هستید که توسط شرکت پردازش هوشمند ترگمان توسعه داده شده است.

## قوانین اجباری — حتماً دقیقاً رعایت کنید:
- همیشه به زبان فارسی روان، رسمی و طبیعی پاسخ دهید؛ مگر این‌که کاربر به صراحت زبان دیگری را درخواست کند (در هر صورت منابع و کلمات کلیدی به زبان فارسی باشند)
- اگر کاربر درباره هویت شما پرسید (مثل «تو کی هستی؟»، «چه مدلی هستی؟»، «ChatGPT هستی؟» و غیره)، دقیقاً و فقط این پاسخ را بدهید:
  «من یک دستیار هوش مصنوعی مبتنی بر مدل‌های زبانی بزرگ بهینه‌سازی‌شده برای زبان فارسی هستم که توسط شرکت پردازش هوشمند ترگمان مورد توسعه قرار گرفته است. این نسخه از سامانه به صورت آزمایشی و رایگان در اختیار شما قرار گرفته است.»
- اطلاعات تو تا اسفند ۱۴۰۳ و مبتنی بر کلان‌پیکره ترگمان که در آدرس (https://oss.targoman.ir/TLPC) در دسترس است به‌روز شده. اما اخبار ایران رو به صورت لحظه‌ای در حال دریافت هستی.
- اگر کاربر سوال سیاسی یا ضدمذهبی پرسید. دقیقا و فقط این پاسخ را بدهید و هیچ پاسخ اضافه‌ای ندهید:
  من یک دستیار هوش مصنوعی هستم و فعلا اجازه اظهار نظر در خصوص مسایل سیاسی و مذهبی ندارم. 
- قواعد متن‌های markdown رو رعایت کن و برای فرمول‌ها از MathJax  استفاده کن. در فرمول‌ها متغیر یا توضیحات همیشه انگلیسی باشند.
- اگر کاربر درخواست کد کرد یا در جواب خواستی کد بدی حتما از الکوی کدنویسی markdown استفاده کن
- در اولین مکالمه پاسخ حداکثر ۱۰۰ کلمه باشد و در انتهای توضیح اگر ممکن بود جمله‌ای با معنی «اگر مایلید بیشتر توضیح بدم» ارایه شود. در ادامه اگر کاربر خودش متن طولانی‌تر، توضیحات کامل یا تشریح درخواست کرد تا ۳۰۰۰ کلمه توضیح داده شود
- هر زمان کاربر گفت «اسراییل» یا در پاسخ خواستی بگی اسرائیل به جاش از کلمه رژیم اشغالگر صهیونیستی استفاده کن
- اسم تو «دستیار هوش مصنوعی ترگمان» است و فعلا امکان گفتگوی صوتی نداری اما به زودی این خدمت راه‌اندازی می‌شه
- مواردی که به عنوان «دانش عمومی داخلی» ارایه می‌شوند مستقل از هم هستند و نباید با هم ترکیب شوند 
- تاریخ امروز ${date2Jalali()} معادل با ${new Date().toDateString()} میلادی و ${date2Hijri()} قمری
`
  const DEFAULT_SYSTEM_PROMPT_POSTFIX =
    `- همیشه در پایان پیان دو سطر داریم به صورت زیر: 
    ۱- در یک سطر به صورت متن ساده که با عبارت «عبارات کلیدی:» شروع می‌شود ۵ عبارت کلیدی از پاسخ که با "," از هم جدا شوند
    ۲- در سطر آخر منابع استفاده‌شده را دقیقاً به یکی از این سه روش زیر در یک خط جداگانه بنویسید (این آخرین خط پاسخ باشد و پس از این سطر به هیچ عنوان چیزی نوشته نشود):
       a. اگر از متن‌های مرجع استفاده کردید در یک سطر به صورت متن ساده با الگوی: «منابع: 1. [نام مرجع]، 2. [نام مرجع]، 3. [نام مرجع]»
       b. اگر از اخبار مرتبط استفاده شد:  «منبع: اخبار خزش‌شده»
       c. در غیر این صورت «منبع: دانش داخلی مدل»
`
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
    const auth = await getAuthInfo(apiReq);

    const { maxItems, from, fileId } = apiReq.query;
    if(fileId)
      apiRes.json(await atDB.sampleQuestions.listByFileId(service, auth.uid, parseQueryToString(fileId)!, parseQueryToNumber(maxItems), parseQueryToNumber(from)));
    else 
      apiRes.json(await atDB.sampleQuestions.listByUser(service, auth.uid, parseQueryToNumber(maxItems), parseQueryToNumber(from)));
  });

  //-----------------------------------------------------
  router.post(`/${service}/chat`, async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq);
    const chatKey = md5(randomUUID())
    await atDB.chats.new(service, auth.uid, chatKey)
    apiRes.json({key: chatKey});
  });

  //-----------------------------------------------------
  router.delete(`/${service}/chat/:chatId`, async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq);
    const { chatID: chatIdParam } = apiReq.params;
    const chatId = parseQueryToString(chatIdParam)
    if(chatId?.length != 32) throw new exHttpInvalidParams("Invalid chat ID")

    const chatSpec = await atDB.chats.get(service, auth.uid, chatId);
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
    const { chatID: chatIdParam } = apiReq.params;
    const chatId = parseQueryToString(chatIdParam)
    if(chatId?.length != 32) throw new exHttpInvalidParams("Invalid chat ID")

    const trimmedTitle = title.trim();
    if (trimmedTitle.length > 100) throw new exHttpInvalidParams("عنوان حداکثر می‌تواند ۱۰۰ کاراکتر باشد");

    const chatSpecs = await atDB.chats.get(service, auth.uid, chatId)
    if (!chatSpecs) throw new exHttpAccessDenied("چت مورد نظر یافت نشد یا شما دسترسی ندارید")

    apiRes.json(await atDB.chats.setTitle(service, auth.uid, chatSpecs, title))
  });

  /**************************************************/
  /*                    MESSAGES                    */
  /**************************************************/
  router.get(`/${service}/chat/:chatKey/messages`, async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq);
    const { chatKey } = apiReq.params;
    const { maxItems, from } = apiReq.query;
    apiRes.json(await atDB.messages.listByChatID(service, auth.uid, parseQueryToString(chatKey)||"not provided", parseQueryToNumber(maxItems), parseQueryToNumber(from)));
  });

  //-----------------------------------------------------
  router.put(`/${service}/chat/:chatId/message/:msgId/opinion`, async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq);
    const { msgId, chatID: chatIdParam } = apiReq.params;
    const { opinion } = apiReq.body;
    const chatId = parseQueryToString(chatIdParam)
    if(chatId?.length != 32) throw new exHttpInvalidParams("Invalid chat ID")

    apiRes.json({ success: await atDB.messages.setOpinion(service, auth.uid, chatId, parseQueryToString(msgId)||"not provided", opinion) ? true : false })
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
        logger.error({"_deleteFileInternal": ex})
        try { trx.rollback() } catch (ex) { logger.error( {"_deleteFileInternal:rollback":ex }) }
        return { success: false, countChunks: 0 }
      }
    }

    //-----------------------------------------------------
    router.delete(`/${service}/file/:fileId`, async (apiReq: Request, apiRes: Response) => {
      const auth = await getAuthInfo(apiReq);
      const { fileId } = apiReq.params;
      const fileSpec = await atDB.files.get(service, auth.uid, parseQueryToString(fileId)||"not provided")
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
        if (!file) throw new exHttpInvalidParams("فایلی انتخاب نشده" );

        if(toMegaByte(file.size) > (auth?.privs?.services[service]?.files?.maxSize || 10000))
          throw new exHttpInvalidParams("حجم فایل بیش از حد تعیین‌شده برای شما می‌باشد" )

        const fileName = Buffer.from(file.originalname, "latin1").toString("utf8");
        const fileKey = md5(file.originalname + file.size);
        const oldFile = await atDB.files.get(service, auth.uid, fileKey);
        if (oldFile) throw new exHttpInvalidParams(`قبلا بارگذاری شده است`);

        const userStats = await atDB.perUserStats.get(service, auth.uid)
        if (userStats) {
          if ((userStats[atDB.perUserStats.cols.activeFiles] || 0) > (auth?.privs?.services[service]?.files?.maxCount || Infinity))
            throw new exHttpInvalidParams("حداکثر تعداد مجاز فایل فعال را استفاده کرده‌اید. برای آپلود فایل جدید از فایل‌های قبلی حذف کنید")
          if (toMegaByte(userStats[atDB.perUserStats.cols.activeSize] || 0) > (auth?.privs?.services[service]?.files?.maxTotalSize || Infinity))
            throw new exHttpInvalidParams("حداکثر حجم مجموع را استفاده کرده‌اید. برای آپلود فایل جدید از فایل‌های قبلی حذف کنید")
        }

        const {totalChunks, totalContent, totalPoints} = await file2DB(file, fileKey,
          async (chunks: IntfChunk[]) => vectorDB().addFileText(`${service}_${auth.key}`, fileKey, fileName, chunks),
          (i, total) => { 
            sendStreamHeadersIfNeeded(apiRes)
            apiRes.write("progress: " + JSON.stringify({ fileName, progress: i, total }) + "\n"); 
          },
        ); 

        if(!totalPoints || totalContent < 10) {
          if(file.path.endsWith('.pdf'))
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

        if(apiRes.headersSent) {
          apiRes.write("data: [DONE]: "+ JSON.stringify({fileKey,totalChunks}))
          apiRes.end()
        }else 
          apiRes.json({ success: true,fileKey,  chunks: totalChunks });
      }
    );

    //-----------------------------------------------------
    router.post(`/${service}/generate-questions`, async (apiReq: Request, apiRes: Response) => {
      const auth = await getAuthInfo(apiReq);

      const { fileId } = apiReq.body 

      const fileSpecs = await atDB.files.get(service, auth.uid, fileId);
      if(!fileSpecs)
        throw new exHttpInvalidParams("فایل مورد نظر یافت نشد")
      const randomChunks = await vectorDB().getRandomChunks(
        `${service}_${auth.key}`,
        fileId,
        Math.max(10, fileSpecs[atDB.files.cols.chunkCount] * 0.01)
      );

      let partOfChunks = ""
      for (const chunk of randomChunks) {
        if(partOfChunks.length + chunk.length > 3000) continue
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
    const response = await stopRequest(service, parseQueryToString(reqId)||"not provided")
    apiRes.json({ status: response })
  }) 

  //-------------------------------------------------
  router.post(`/${service}/generate-title`, async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq);
    const { chat_id, conversation } = apiReq.body;
    if(chat_id.length != 32) throw new exHttpInvalidParams("Invalid chat ID")
 
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
    apiRes.json({title});
  });

  //-------------------------------------------------
  async function _ragBasedChatInternal(
    apiRes: Response,
    auth: IntfAuth,
    api_chatId: string,
    api_reqId: string,
    api_useFiles: boolean,
    api_question: string,
    api_initial: boolean,
    ignoreLastHistory: boolean
  ) {
    if(api_chatId.length != 32) throw new exHttpInvalidParams("Invalid chat ID")
    if(api_reqId.length != 32) throw new exHttpInvalidParams("Invalid request ID")

    const isSummarizing = api_question === SUMMARIZE_PROMPT
    let chatSpecs: TypChatListItem | null
    if(api_initial) 
      await atDB.chats.new(service, auth.uid, api_chatId)

    chatSpecs = await atDB.chats.get(service, auth.uid, api_chatId)
    if (!chatSpecs) throw new exHttpAccessDenied("چت مورد نظر یافت نشد یا شما دسترسی ندارید")

    async function retrieveChatHistory(maxItems: number) {
      const history = await atDB.messages.listByChatID(service, auth.uid, chatSpecs![atDB.chats.cols.id], maxItems, 0, false)

      let filteredHistory: IntfLLMMessage[] = [];
      let allKeywords: string[] = []
      let lastRole = null;

      for (let i=history.messages.length -1; i>=0; i--) {
        const histItem = history.messages[i]!
        if(i===history.messages.length -1 && histItem.msgRole != enuRoles.user)
          continue;

        if (histItem.msgRole !== lastRole) {
          filteredHistory.push({ role: histItem.msgRole as enuRoles, content: histItem.msgContent || "" });
          lastRole = histItem.msgRole;
        }

        if(histItem.msgRole === enuRoles.assistant) {
          const matched = histItem.msgContent?.match(/\n\*?\*?عبارات کلیدی:\*?\*?[\n ](.*,?)+\n/);
          if (matched && matched.length > 1) {
            const matchedKeywords = matched[1]
            if (matchedKeywords) 
              allKeywords = [...allKeywords, ...matchedKeywords.split(", ")];
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

      return {filteredHistory, allKeywords}
    }

    async function embedUserMessage(keywords: string[], question: string) {
      //@TODO our model supports [category: ], [brand: ], etc. use it
      //@TODO preprocess user_message or history in order to add guides to VectorDB in brackets
      if(configManager.active().log.isDebugging)
        logger.deepDebug({embedding: {keywords, question}})
      const embeddedQuery = await getEmbedding((keywords ? `[keywords: ${keywords.join(",")}]` : "") + "\n" + question);
      if (!embeddedQuery) throw new Error("Unable to generate embedding");
      return embeddedQuery;
    }

    function cntx2Text(context: IntfContext) {
      return context.chunks?.length
          ? context.chunks
            .map((r) => (context.reportSource ? `[مرجع: ${r.file_name}] ` : "") + r.text)
            .join("\n\n")
            .trim()
          : ""
    }

    function makeSystemPrompt({
    systemPromptPrefix = DEFAULT_SYSTEM_PROMPT_PREFIX,
    systemPromptPostfix = DEFAULT_SYSTEM_PROMPT_POSTFIX,
    userContext,
    allSources,
    globalContext,
    newsContext,
  }: IntfSystemPromptParams): string {
    return normalizePersianText(`${systemPromptPrefix}
${userContext?.chunks?.length ? `\n- ** خیلی مهم **: فقط بر مبنای متن‌های مرجع و نام فایل‌های آپلودشده کاربر پاسخ بده و اگر متن مرجع مناسب نیست بگو: در مراجع ارایه شده محتوای مرتبط یافت نشد.` : ""}
${userContext?.chunks?.length ? "\n- متن‌های مرجع:\n" + cntx2Text(userContext) : ""}
${allSources?.files?.length ? `\n- آخرین فایل‌های آپلود شده کاربر از مجموع ${allSources.count} فایل:\n` + allSources.files.map((s, i) => `    ${i + 1}. ${s}`).join("\n") : ""}
${globalContext?.chunks?.length ? "\n- دانش عمومی داخلی:\n" + cntx2Text(globalContext) : ""}
${newsContext?.chunks?.length ? "\n- اخبار مرتبط (در صورت استفاده، منبع رو اخبار اعلام کن و حتما لینک خبر رو به عنوان منبع بده):\n" + cntx2Text(newsContext) : ""}
${systemPromptPostfix}`)
  }


    async function getMatchingContexts(
      collection: string,
      embeddedQuery: number[],
      reportSource = false,
      maxItems = 8,
      mustBeNew = false
    ): Promise<IntfContext> {
      const vectorDBResults = await vectorDB().findChunks(collection, embeddedQuery, undefined, maxItems, mustBeNew ? 7 : 0);
      const uniqueActiveSources: string[] = [];
      for (let row of vectorDBResults)
        if (uniqueActiveSources.includes(row.file_name) === false)
          uniqueActiveSources.push(row.file_name);

      if(false && configManager.active().log.isDebugging)
        logger.deepDebug({matchedContext: {collection, vectorDBResults, uniqueActiveSources}})

      return {
        chunks: vectorDBResults,
        from: uniqueActiveSources,
        reportSource
      };
    }

    let logSpec: Partial<IntfLog> | undefined = undefined
    try {
      const {filteredHistory, allKeywords}  = await retrieveChatHistory(21);
      const allFiles = (await atDB.files.list(service, auth.uid,10,0,false))
      const allSources = !isSummarizing && api_useFiles 
          ? {files: allFiles.files.map((r) => r[atDB.files.cols.name]), count: allFiles.usrActiveFileCount}
          : undefined
        
      const DEFAULT_EMPTY_CONTEXT : IntfContext= { chunks: [], reportSource: false }
      const embeddedQuery = await embedUserMessage(allKeywords, api_question);
      const userContext = !isSummarizing && api_useFiles ? await getMatchingContexts(`${service}_${auth.key}`, embeddedQuery, true, 16) : DEFAULT_EMPTY_CONTEXT;
      const globalContext = !isSummarizing && useGeneralKnowledge
        ? userContext?.chunks && userContext.chunks.length > 3
          ? DEFAULT_EMPTY_CONTEXT
          : await getMatchingContexts(configManager.active().specialCollections.global, embeddedQuery, false, 8)
        : DEFAULT_EMPTY_CONTEXT;
      const newsContext = !isSummarizing && useNews
        ? userContext.chunks && userContext.chunks.length > 3
          ? DEFAULT_EMPTY_CONTEXT
          : await getMatchingContexts(configManager.active().specialCollections.news, embeddedQuery, false, 8, api_question.startsWith("اخبار تازه") || api_question.endsWith(" چه خبره"))
        : DEFAULT_EMPTY_CONTEXT;

      const generateAdequateLenghtMessages = () => {
        const systemPrompt = makeSystemPrompt({
          systemPromptPrefix: isSummarizing ? SUMMARIZE_SYSTEM_PROMPT : serviceSystemPromptPrefix,
          systemPromptPostfix: isSummarizing ? "" : serviceSystemPromptPostfix,
          userContext,
          allSources,
          newsContext,
          globalContext,
        })

        let currMessages: IntfLLMMessage[] = [
          { role: enuRoles.system, content: systemPrompt },
          ...filteredHistory,
          { role: enuRoles.user, content: isSummarizing ? SUMMARIZE_PROMPT : `${DEFAULT_PROMT_PREFIX}${api_question.trim()}` }
        ];
        const fullMessageTokens = countMessageTokens(currMessages)
        if(fullMessageTokens > (configManager.active().llmServers[service].maxTokens || Infinity)) {
          if(countMessageTokens(filteredHistory) > 0.5 * fullMessageTokens) 
            throw new exHttpPayloadTooLarge("حجم محتوای مکالمه بسیار زیاد شده چت جدیدی باز کنید یا این مکالمه خلاصه شود")

          if(userContext.chunks?.length) 
            userContext.chunks.pop()

          const globalTokens = countContextTokens(globalContext)
          const newsTokens = countContextTokens(newsContext)
          if (globalTokens > newsTokens && globalContext.chunks?.length) 
            globalContext.chunks.pop()
          else if (newsContext.chunks.length)
            newsContext.chunks.pop()

          return generateAdequateLenghtMessages()
        }

        return currMessages
      }

      const messages = generateAdequateLenghtMessages()

      if (configManager.active().log.isDebugging) 
        logger.deepDebug({ matchedContextPostFilter: { userContext, globalContext, newsContext }, messages })
      
      const logInfo: { [key: string]: unknown } = {
        historyLen: filteredHistory.length,
        question: api_question
      }
      if (useGeneralKnowledge) logInfo.globalChunks = globalContext?.chunks.length
      if (useNews && newsContext.chunks) logInfo.news = { chunks: newsContext.chunks.length, newest: newsContext.chunks?.at(0)?.chunk_time }
      if (api_useFiles) logInfo.files = { chunks: userContext?.chunks?.length }

      logSpec = await atDB.log.add(auth.key || auth.uid + '', logName, logInfo, api_question.length)

      if (process.env.DEBUG_MODE)
        logger.debug(`[${logName.toUpperCase()} Chat] ${api_chatId} | useFiles: ${api_useFiles ? true : false} | ${stripText(api_question)}`);


      await startNewChat(apiRes, service, api_reqId, messages, {
        onDone: async (fullMarkdown: string, cancelled: boolean | undefined) => {
          await atDB.log.updateResult(logSpec, cancelled ? 299 : 200, { responseLen: fullMarkdown?.length || 0 })
          await atDB.messages.addDialogue(chatSpecs, api_reqId, api_question, fullMarkdown, cancelled ? enuMsgStatus.Stopped : enuMsgStatus.Finished)
          return false
        },
      })
    } catch (ex) {
      if ((ex as Error).message?.startsWith(`LLM error (400): {"error":{"message":"'max_tokens' or 'max_completion_tokens' is too large:`)
        || (ex as Error).message?.startsWith(`LLM error (400): {"error":{"message":"This model's maximum context length is`)) {
        if (logSpec) await atDB.log.updateResult(logSpec, isSummarizing ? 412 : 413)
        if(isSummarizing)
          throw new exHttpPreconditionFailed("امکان خلاصه‌سازی این مکالمه وجود ندارد لطفا چت جدیدی باز کنید")
        else 
          throw new exHttpPayloadTooLarge("حجم محتوای مکالمه بسیار زیاد شده چت جدیدی باز کنید یا این مکالمه خلاصه شود")
      }
      if (logSpec) await atDB.log.updateResult(logSpec, (ex as IntfExHttp).status || 500, (ex as IntfExHttp).message || (ex as { error: string }).error || ex)
      else await atDB.log.add(auth.key || auth.uid + '', 'rag', {
        api_chatId,
        api_reqId,
        api_useFiles,
        api_question,
        ignoreLastHistory
      }, api_question.length, 500, (ex as Error).message)
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
      initial: api_initial,
    } = apiReq.body

    if (api_question.length > (auth?.privs?.services[service]?.messages?.maxChars || 1000000))
      throw new exHttpInvalidParams("حجم سوال ورودی زیاد است آن را کاهش دهید")

    await _ragBasedChatInternal(apiRes, auth, api_chatId, api_reqId, api_useFiles, api_question, api_initial, false)
  })

  //-------------------------------------------------
  router.post(`/${service}/generate-summary`, async (apiReq: Request, apiRes: Response) => {
    const auth = await getAuthInfo(apiReq);
    const { chat_id: api_chatId, msg_id: api_reqId } = apiReq.body

    await _ragBasedChatInternal(apiRes, auth, api_chatId, api_reqId, false, SUMMARIZE_PROMPT, false, false)
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

    await _ragBasedChatInternal(apiRes, auth, api_chatId, api_reqId, api_useFiles, api_question, false, true)
  })

  return router;
}

function countMessageTokens(messages: IntfLLMMessage[] | undefined) {
  if(!messages) return 0
  let count = 0;
  for (const msg of messages) 
    count += approximateTokenCount(msg.content)
  return count;
}

function countContextTokens(context: IntfContext | undefined) {
  if(!context || !context.chunks.length) return 0
  let count = 0;
  for (const msg of context.chunks) 
    count += approximateTokenCount(msg.text)
  return count;
}
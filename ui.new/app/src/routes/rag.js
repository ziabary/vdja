const express = require("express");
const multer = require("multer");
const fs = require("fs");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const pdf = require("pdf-parse");
const mammoth = require("mammoth");
const {db} = require("../services/db");
const { date2Jalali } = require("../utils/i18n");
const { fileTypeFromBuffer } = require("file-type");
const { chunkText } = require("../services/embedding");
const { getEmbedding } = require("../services/embedding");
const {
  initCollection,
  upsertChunks,
  searchChunks,
  deleteByFileId,
  deleteAllByUser,
} = require("../services/qdrant");
const { newCallVLLMStream, checkRequestState, removeActiveRequest , stopRequest} = require("../utils/vllmUtils");
async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));  
}

const SUMMARIZE_SYSTEM_PROMPT = `تو یک سیستم خلاصه ساز هستی که گفتگو رو برای ادامه خلاصه می‌کنی
- پس از خلاصه‌سازی، ۵ عبارت کلیدی از متن استخراج کن و در انتهای خلاصه، در یک سطر به صورت متن ساده با جداسازی مبتنی بر "," ارایه کن  
`
SUMMARIZE_PROMPT = `درخواست خودکار به جای کاربر: مکالمات قبلی رو خلاصه کن\n`

const router = express.Router();
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 200 * 1024 * 1024 },
});
const VLLM_URL = process.env.VLLM_URL || "http://localhost:8000";
const VLLM_MODEL = process.env.VLLM_MODEL || "targoman";
GLOBAL_USER = process.env.GLOBAL_USER 
NEWS_USER = process.env.NEWS_USER 
SPECIAL_USERS = process.env.SPECIAL_USERS  
BALE_GW_ID = process.env.BALE_GW_ID
BALE_GW_SECRET = process.env.BALE_GW_SECRET


function mustLimitFiles(user_key) {

  const res = process.env.DEBUG_MODE != 1
      && ![NEWS_USER, GLOBAL_USER, ...(SPECIAL_USERS||"").split(',')].includes(user_key)
    
  // console.log({debugMode: process.env.DEBUG_MODE, 
  //              SPECIAL_USERS, 
  //              GLOBAL_USER,
  //              NEWS_USER,
  //              user_key, res }) 
  return res
}

function shortenText(text, len = 50) {
  return text?.length > len ? text.slice(0, len) + "..." : text || "";
}

const readWithTimeout = async (reader, timeout, reqId) => {
  let isCancelled = false

  const timeoutId = setTimeout(async () => {
    const state = await checkRequestState(VLLM_URL, reqId);
    if (state === "cancelled") {
      isCancelled = true
      reader.cancel()
    } 
  }, timeout);

  try {
    const result = await reader.read();
    clearTimeout(timeoutId);
    return {...result, cancelled: isCancelled};
  } catch (err) {
    return { done: true, cancelled: isCancelled };
  }
};

async function getDirectLLMResponse(
  systemPrompt,
  userPrompt,
  max_tokens,
  temperature
) {
  prompts = [];
  if (systemPrompt) prompts.push({ role: "system", content: systemPrompt });
  if (typeof userPrompt === "string") 
    prompts.push({ role: "user", content: userPrompt });
  else 
    prompts = userPrompt

  const request_id = uuidv4()

  const vllmRes = await newCallVLLMStream(VLLM_URL, VLLM_MODEL, request_id, prompts, {
    max_tokens: max_tokens,
    temperature: temperature,
    top_p: 0.9,
    stream: true, 
  });

  const reader = vllmRes.body.getReader();
  const decoder = new TextDecoder();
  let response = ""
  while (true) {
    const { done, value, cancelled } = await readWithTimeout(reader, 1000, request_id)
    const chunk = decoder.decode(value, { stream: true });
    if (done) {
      response = response + (cancelled ? "\n\nLLM_GEN_CANCELLED" : "")
      if(cancelled)
        response = "LLM_GEN_CANCELLED"
      break
    }

    chunk.split("\n").forEach(async (line) => {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          if(data.text)
            response += data.text;
        } catch {/*ignore json error*/}
      }
    });  
  }
  removeActiveRequest(VLLM_URL, request_id)
  return response 
}

router.get("/rag/chat/:chat_id/messages", (req, res) => {
  const { chat_id } = req.params;
  const { user_key } = req.query;
  if (!user_key || !chat_id)
    return res.status(400).json({ error: "داده ناقص" });
  const chat = db.getChat(user_key, chat_id);
  if (!chat)
    return res.status(403).json({ error: "چت نامعتبر یا دسترسی ندارید" });
  const messages = db.getMessages(chat_id);
  res.json({ messages, chatTitle: chat.title });
});

async function generateQuestions(user_key, file_id, chunks) {
  try {
    if (chunks < 2) {
      console.log("Small file content");
      return;
    }

    const partOfChunks = chunks.join("\n\n").substring(0, 3000);

    const content  = await getDirectLLMResponse(
      "بر اساس محتوای ارایه‌شده ۵ سوال کوتاه حداکثر ۱۰ کلمه‌ای طرح کن." +
        "- سوالات متنوع با درجه پیچیدگی متفاوت" +
        "- سوالات به صورت متن ساده بدون پرانتز یا ستاره یا سایر علایم تولید شوند" +
        "- در هنگام طرح سوال هیچ توضیح اضافه‌ای نذار و حتی درجه پیچیدگی اون رو اعلام نکن" +
        "- حتما در ابتدای هر سوال شماره سوال رو به صورت 1. و 2. بذار",
      partOfChunks,
      500,
      0.8
    );

    qTexts = [];
    for (const line of content.split("\n")) {
      const matches = line.match(/\d\.(.*)/);
      if (matches && matches.length > 1) {
        const question = matches[1].replace(/[\*#]/g, "");
        db.addSampleQuestion(user_key, file_id, question);
        qTexts.push(question);
      }
    }
    //console.log({ qTexts });
    return qTexts;
  } catch (ex) {
    console.log(ex);
  }
}

async function getAccessToken() {
  const { URLSearchParams } = require('url');

  // Create the form data
  const params = new URLSearchParams();
  params.append('grant_type', "client_credentials");
  params.append('client_id', BALE_GW_ID);
  params.append('client_secret', BALE_GW_SECRET);

  const resp = await fetch(`https://safir.bale.ai/api/v2/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params
  }).then(resp=>resp.json());

  console.log({resp})
}

router.post("/rag/upload", upload.single("file"), async (req, res) => {
  const { user_key } = req.body;
  if (!user_key || user_key.length < 16)
    return res.status(400).json({ error: "کلید نامعتبر" });


  //@TODO check User phone number
  //getAccessToken()

  const file = req.file;
  const originalName = Buffer.from(file.originalname, "latin1").toString("utf8");

  let oldFile = db.getFile(user_key, originalName, file.size);
  if (oldFile) return res.status(400).json({ error: `فایل  ${originalName} قبلا بارگذاری شده است` });

  let userStats = db.getUser(user_key) || db.addUser(user_key);
  if (mustLimitFiles(user_key)) {
    if (userStats.file_count >= 10)
      return res.status(400).json({ error: "در نسخه رایگان،‌ حداکثر ۱۰ سند فعال مجاز است" });
    if (userStats.total_storage + req.file.size > 500 * 1024 * 1024)
      return res.status(400).json({ error: "در نسخه رایگان، حداکثر حجم مجموع مجاز ۵۰۰ مگابایت است" });
  }

  let text = "";
  try {
    const buffer = fs.readFileSync(file.path);
    const type = (await fileTypeFromBuffer(buffer)) || {
      ext: file.originalname.endsWith(".txt") || file.originalname.endsWith(".md") ? "txt" : undefined,
    };
    const allowedTypes = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain",
      md: "text/markdown",
    };

    if (type && allowedTypes[type.ext]) {
      if (type.ext === "pdf") {
        const data = await pdf(buffer);
        text = data.text.trim();
      } else if (type.ext === "docx") {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value.trim();
      } else if (type.ext === "txt" || type.ext === "md") {
        text = buffer.toString("utf8").trim();
      }
    } else return res.status(400).json({ error: "فرمت فایل پشتیبانی نمی‌شود" });

    if (text.length < 100)
      return res
        .status(400)
        .json({ error: "متن استخراج‌شده خالی یا بسیار کوتاه است" });

    await initCollection(user_key)
    const fileId = uuidv4();
    const chunks = await chunkText(text, 550);
    const numChunks = await upsertChunks(
      user_key,
      fileId, 
      originalName,
      chunks
    ); 

    db.addUploadedFile(user_key, fileId, originalName, file.size, numChunks);

    let questions = []
    if(mustLimitFiles(user_key))
       questions = await generateQuestions(user_key, fileId, chunks);

    res.json({ success: true, chunks: numChunks, questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "خطا در پردازش فایل" });
  } finally {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
  }
});

router.get("/rag/files", (req, res) => {
  const { user_key } = req.query;
  if (!user_key || user_key.length < 16)
    return res.status(400).json({ error: "کلید نامعتبر" });

  const files = db.getUserFiles(user_key);
  const user = db.getUser(user_key);
  res.json({
    files,
    storage: user?.total_storage || 0,
    file_count: user?.file_count || 0,
  });
});

router.delete("/rag/file/:fileId", async (req, res) => {
  const { user_key } = req.body;
  const { fileId } = req.params;
  if (!user_key || !fileId)
    return res.status(400).json({ error: "پارامترها نامعتبر" });
  try{
    const deletedChunks = await deleteByFileId(user_key, fileId);
    db.deleteFile(user_key, fileId);
    res.json({ success: true, deleted_chunks: deletedChunks });
  } catch (e) {
    res.json({ success: false, deleted_chunks: 0 });
  }
});

router.delete("/rag/files", async (req, res) => {
  const { user_key } = req.body;
  if (!user_key) return res.status(400).json({ error: "کلید نامعتبر" });

  const user = db.getUser(user_key);
  try{
    const deletedChunks = await deleteAllByUser(user_key);
    db.deleteAllFiles(user_key);

    res.json({ success: true, deleted_chunks: deletedChunks });
  } catch (e) {
    res.json({ success: false, deleted_chunks: 0 });
  }
});

router.get("/rag/chats", (req, res) => {
  const { user_key } = req.query;
  if (!user_key) return res.status(400).json({ error: "کلید نامعتبر" });

  const chats = db.getUserChats(user_key);
  const questions = db.getQuestions(user_key);

  res.json({ chats, questions });
});

router.post("/rag/chat", (req, res) => {
  const { user_key, chat_id, title } = req.body;
  if (!user_key) return res.status(400).json({ error: "کلید نامعتبر" });

  if (!chat_id) {
    // چت جدید
    const newChatId = uuidv4()+"_"+user_key.substring(0,6);
    db.addNewChat(user_key, newChatId, title || "چت جدید");
    res.json({ chat_id: newChatId });
  } else {
    db.updateChatTiming(user_key, chat_id);
    res.json({ success: true });
  }
});

router.delete("/rag/chat/:chatId", (req, res) => {
  const { user_key } = req.body;
  const { chatId } = req.params;
  if (!user_key || !chatId)
    return res.status(400).json({ error: "پارامترها نامعتبر" });
  db.deleteChat(user_key, chatId);
  res.json({ success: true });
});

router.delete("/rag/chats", (req, res) => {
  const { user_key } = req.body;
  if (!user_key) return res.status(400).json({ error: "کلید نامعتبر" });
  db.deleteAllChats(user_key);
  res.json({ success: true });
});

router.put("/rag/chat/title", (req, res) => {
  const { user_key, chat_id, title } = req.body;

  if (!user_key || !chat_id || !title?.trim())
    return res.status(400).json({ error: "پارامترهای نامعتبر" });

  const trimmedTitle = title.trim();
  if (trimmedTitle.length > 100)
    return res.status(400).json({ error: "عنوان خیلی طولانی است" });

  const chat = db.getChat(user_key, chat_id);
  if (!chat)
    return res.status(404).json({ error: "چت یافت نشد یا دسترسی ندارید" });

  db.updateChatTitle(user_key, chat_id, trimmedTitle);
  res.json({ success: true, title: trimmedTitle });
});

router.post("/rag/chat-message", async (req, res) => {
  const { user_key, message, chat_id, msg_id, use_files } = req.body;
  const user_message = message

  if (!user_key || !user_message || !chat_id || !msg_id )
    return res.status(400).json({ error: "پارامترها نامعتبر" });

  if(user_message.length > 2000)
    res.status(400).json({error: "طول درخواست زیاد است لطفا کاهش دهید"})

  const chat = db.getChat(user_key, chat_id);
  if (!chat) return res.status(403).json({ error: "چت نامعتبر یا دسترسی ندارید" });

  async function retrieveChatHistory(max_items) {
    const history = db.getMessages(chat_id, max_items);
    let filteredHistory = [];
    let lastRole = null;

    for (const msg of history) {
      if (msg.role !== lastRole) {
        filteredHistory.push({ role: msg.role, content: msg.content });
        lastRole = msg.role;
      } 
      
      if(msg.role === "user" && msg.content === SUMMARIZE_PROMPT) 
        filteredHistory = [{ role: msg.role, content: msg.content }]
    }

    if(filteredHistory.length && filteredHistory[0].role === "assistant")
      filteredHistory = filteredHistory.slice(1)
    return filteredHistory
  }

  async function embedUserMessage(user_message, history) {
    //@TODO our model supports [category: ], [brand: ], etc. use it
    //@TODO preprocess user_message or history in order to add guides to VectorDB in brackets
    let keywords = []
    for (const h of history) {
      const matched = h.content.match(/\n\*?\*?عبارات کلیدی:\*?\*?[\n ](.*,?)+\n/)
      if(matched && matched.length > 1)
        keywords = [...keywords, ...matched[1].split(', ')]
    }
    keywords = [...new Set(keywords)]
    const embedded_query = await getEmbedding((keywords ? `[keywords: ${keywords.join(',')}]`:'') + user_message);
    if (!embedded_query) 
      throw new Error("Unable to generate embedding")
    return embedded_query
  }

  async function getMatchingContexts(user_key, embedded_query, reportSource = false, max_items = 8, mustNew =false){
    const vectorDBResults = await searchChunks(user_key, embedded_query, max_items, mustNew);
    const uniqueActiveSources = [];
    for (let source of vectorDBResults)
      if (uniqueActiveSources.includes(source.file_name) === false)
        uniqueActiveSources.push(source.file_name);

      return {
        text: vectorDBResults?.length ? vectorDBResults.map((r) => 
            (reportSource ? `[مرجع: ${r.file_name}] `:'') + r.text).join("\n\n").trim() : "",
        from: uniqueActiveSources,
        count: vectorDBResults?.length
      }
  }

  try {
    const filteredHistory = await retrieveChatHistory(21)
    const allSources = db.getUserFiles(user_key).map(r=>r.file_name)
    const embeddedQuery = await embedUserMessage(user_message, filteredHistory)
    const userContext = use_files ? await getMatchingContexts(user_key, embeddedQuery, true, 16) : {}
    const globalContext = userContext.count && userContext.count > 3 ? {} : await getMatchingContexts(GLOBAL_USER, embeddedQuery, false, 8)
    const newsContext = userContext.count ? {} : await getMatchingContexts(NEWS_USER, embeddedQuery, false, 8,(
         user_message.startsWith("اخبار تازه") 
      || user_message.endsWith(" چه خبره")
      ))

    /************************************************************** */
    const systemPrompt = `شما یک دستیار هوش مصنوعی فارسی‌زبان هستید که توسط شرکت پردازش هوشمند ترگمان توسعه داده شده است.

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
- تاریخ حال حاضر به شمسی ${date2Jalali()} و به میلادی ${new Date().toDateString()}
${userContext.count ? `\n- ** خیلی مهم **: فقط بر مبنای متن‌های مرجع و نام فایل‌های آپلودشده کاربر پاسخ بده و اگر متن مرجع مناسب نیست بگو: در مراجع ارایه شده محتوای مرتبط یافت نشد.` : ''}
${userContext.count  ? "\n- متن‌های مرجع:\n" + userContext.text: ""}
${allSources.length ? "\n- فایل‌های آپلود شده کاربر:\n"+ allSources.map((s, i) => `    ${i + 1}. ${s}`).join("\n") : ""}
${globalContext.count ? "\n- دانش عمومی داخلی:\n" + globalContext.text: ""}
${newsContext.count ? "\n- اخبار مرتبط (در صورت استفاده، منبع رو اخبار اعلام کن و حتما لینک خبر رو به عنوان منبع بده):\n" + newsContext.text: ""}

- در آخرین سطر پیام همیشه منبع استفاده‌شده را دقیقاً به یکی از این سه روش زیر در یک خط جداگانه بنویسید (این آخرین خط پاسخ باشد و پس از این سطر به هیچ عنوان چیزی نوشته نشود):
  1. اگر از متن‌های مرجع استفاده کردید مطابق الگوی زیر:  
    منابع: 1. [نام مرجع]، 2. [نام مرجع]، 3. [نام مرجع]
  2. اگر از اخبار مرتبط استفاده شد:  
    منبع: اخبار خزش‌شده 
  3. اگر هیچ اطلاعاتی از مراجع استفاده نشد و از اخبار مرتبط هم استفاده نشد  
    منبع: دانش داخلی مدل 
    `;

    /************************************************************** */

    let messages = [
      { role: "system", content: systemPrompt },
      ...filteredHistory,
    ];

    if (
      filteredHistory.length > 0 &&
      filteredHistory[filteredHistory.length - 1].role === "user"
    ) {
      filteredHistory[filteredHistory.length - 1].content = `سؤال کاربر: ${user_message.trim()}`;
    } else {
      messages.push({ role: "user", content: `سؤال کاربر: ${user_message.trim()}` });
    }

    const maxRetries = 3;
    let attempt = 0;
    let lastError;
    db.log("rag", chat_id, user_message.length, user_message);
    if(process.env.DEBUG_MODE)
      console.log(`[RAG Chat] ${chat_id} | use_files: ${use_files ? true : false} | ${shortenText(user_message)}`);

    while (attempt < maxRetries) {
      attempt++;
      wasSummarized = false
      try {
        if(process.env.DEBUG_MODE)
          console.log({roles: messages.map(a=>({msg_id, r:a.role, t: a.content.substring(0, 50) + "..."}))})

        const vllmRes = await newCallVLLMStream(VLLM_URL, VLLM_MODEL, msg_id, messages, {
          max_tokens: 2000,
          temperature: 0.5,
          stream: true
        });

        const processStream = async () => {
          let botResponse = "";
              
          const reader = vllmRes.body.getReader();
          const decoder = new TextDecoder();
          try {
            let isDraining = false;
            while (true) {
              const { done, value,  cancelled } = await readWithTimeout(reader, 1000, msg_id)
              const chunk = decoder.decode(value, { stream: true });
              
              if (done) {
                botResponse = botResponse + (cancelled ? "\n\nLLM_GEN_CANCELLED" : "")

                let msg_id = 0
                if (botResponse.trim()) {
                  db.transaction(()=>{
                    db.prepare(
                      "INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)"
                    ).run(chat_id, "user", user_message.trim())
                    db.prepare(
                      "INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)"
                    ).run(chat_id, "assistant", botResponse.trim())
                    db.updateChatTiming(user_key, chat_id);
                    msg_id = db.prepare("SELECT last_insert_rowid() AS lir").get()?.lir || 0
                  })()
                }

                if(cancelled)
                  res.write(`\ndata: [CANCELLED:${msg_id}]\n\n`)
                res.write(`data: [DONE:${msg_id}]\n\n`);
                res.end();
                break;
              }
              chunk.split("\n").forEach(async (line) => {
                if (line.startsWith("data: ")) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (data.delta) {
                      if (!res.write("data: "+JSON.stringify({delta: data.delta, cid: msg_id}) + "\n")) {
                        if (!isDraining) {
                          isDraining = true
                          res.on("drain", ()=>{isDraining = false})
                        }
                        await new Promise((resolve) => {res.once("drain", resolve);}); 
                      }
                      botResponse += data.delta;
                    }
                  } catch(e) {
                    console.log(e)
                  }
                }
              });  
            }
          } catch (err) {
            console.error("[RAG Chat] Stream error:", err);
            throw new Error("خطا در هنگام پردازش استریم: " + err.message );
          } finally {
            reader.cancel()
          }
        };

        if (!res.headersSent) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.flushHeaders();
        }

        await processStream();
        // if(isCanceled) {
        //   res.write("data: [CANCELLED]\n\n");
        //   res.end();
        // }
        removeActiveRequest(VLLM_URL, msg_id)
        return
      } catch (err) {  
        lastError = err;
        if(process.env.DEBUG_MODE)
            console.log("================================>", {msg: err.message})
        if(err.message === "fetch failed" || err.message === "Failed to fetch") {
          if (attempt < maxRetries) {
            await sleep(attempt * 1000)
            continue
          } else {
             if(process.env.DEBUG_MODE)
                console.error(`[RAG Chat Error] Attempt ${attempt} failed:`, err.message || err);
            throw new Error("SERVER_DISCONNECTED")
          }
        }
        if(err.message?.startsWith(`vLLM error 400: {"error":{"message":"'max_tokens' or 'max_completion_tokens' is too large:`) 
          || err.message?.startsWith(`vLLM error 400: {"error":{"message":"This model's maximum context length is`)
        ) {
          if(messages.length  === 2 
            || (messages.length === 4 && messages[messages.length - 3].content === SUMMARIZE_PROMPT))
            throw new Error("<error>پرامپت ورودی بسیار طولانی است آن را کاهش دهید</error>")

          const toSummarize = messages.slice(1, messages.length > 4 ? messages.length-3 : messages.length - 1)
          res.write("data: [summarizing]");
          toSummarize.push({role:"user", content: SUMMARIZE_PROMPT})
          const summary = await getDirectLLMResponse(SUMMARIZE_SYSTEM_PROMPT, toSummarize, 1000, 0.5, false)
          if(summary) {
            db.transaction(()=>{
              db.prepare(
                "INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)"
              ).run(chat_id, "user", SUMMARIZE_PROMPT)
              db.prepare(
                "INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)"
              ).run(chat_id, "assistant", summary)
            })()
            res.write("data: [re-thinking]");
            messages = [
              messages[0], 
              {role:"user", content:SUMMARIZE_PROMPT},
              {role:"assistant", content:summary},
              ...messages.slice(messages.length > 4 ? messages.length-3 : messages.length - 1)
            ]
            wasSummarized = true
          } else 
            throw new Error("خطا در خلاصه‌سازی مکالمات قبلی. لطفا مجددا درخواست دهید یا چت جدیدی باز کنید")
        } else 
          throw new Error("UNKNOWN_ERROR")
      }
    }

    throw lastError;
  } catch (err) {
    if(msg_id)
      removeActiveRequest(VLLM_URL, msg_id)

    console.error("[RAG Chat Final Error]: ", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write("data: [RAG ERROR]: " + err.message)
      res.end()
    }
  } 
});

router.post("/rag/opinion/:msg_id", async(req, res)=>{
  const {msg_id} = req.params
  const { user_key, opinion } = req.query;
  if(!user_key || !msg_id) res.status(400).json({error: "Invalid Params"})

  const ou= db.getMessageUser(msg_id)?.user_key
  if(user_key != ou)
    return res.status(403).json({error: "شما مجاز به این کار نیستید"})


  db.addUserOpinion(msg_id, opinion) 
  res.json({msg_id, res:"ok"})
}) 

router.post("/rag/stop/:msg_id", async(req, res)=>{
  const { chat_id: msg_id } = req.params;
  if(!msg_id) res.status(400).json({error: "Invalid params"})

  const response = await stopRequest(VLLM_URL, req.params.msg_id)
  res.status(200).json({status:response})
})

router.post("/rag/generate-title", async (req, res) => {
  const { user_key, chat_id, first_message } = req.body;
  if (!first_message?.trim())
    return res.status(400).json({ error: "پیام اول لازم است" });

  const prompt = `از این مکالمه، یک عنوان خیلی کوتاه و جذاب به فارسی بدون دونقطه بساز در حداکثر ۵ کلمه، بدون هیچ عبارت اضافی: "${first_message.trim()}"`;

  try {
    let title = await getDirectLLMResponse(undefined, prompt, 20, 0.7, false)||"بی‌نام";

    title = title
      .replace(/^["'«»](.*)["'«»]$/, "$1")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const fullTitle = title;
    if (!title) title = "بی‌نام";
    if (title.length > 40) title = title.substring(0, 37) + "...";

    if (user_key && chat_id) db.updateChatTitle(user_key, chat_id, title);
    res.json({ title, fullTitle });
  } catch (err) {
    console.error("Generate-title error:", err);
    res.json({ title: "چت جدید" });
  }
});
module.exports = router;

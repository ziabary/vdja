const express = require("express");
const multer = require("multer");
const fs = require("fs");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const pdf = require("pdf-parse");
const mammoth = require("mammoth");
const db = require("../services/db");
const { date2Jalali } = require("../utils/i18n");
const { fileTypeFromBuffer } = require("file-type");
const { chunkText } = require("../services/embedding");
const {
  initCollection,
  upsertChunks,
  searchChunks,
  deleteByFileId,
  deleteAllByUser,
  retrieveChunks,
} = require("../services/qdrant");
const { getEmbedding } = require("../services/embedding");
const { callVLLMStream } = require("../utils/vllmUtils");
const summarizePrompt = "درخواست خودکار به جای کاربر: مکالمه قبلی رو کامل خلاصه کن به نحوی که بشه مکالمه رو با این خلاصه ادامه داد."

const router = express.Router();
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 200 * 1024 * 1024 },
});
const VLLM_URL = process.env.VLLM_URL || "http://localhost:8000";
const VLLM_MODEL = process.env.VLLM_MODEL || "targoman";

initCollection();

function shortText(text, len = 50) {
  return text?.length > len ? text.slice(0, len) + "..." : text || "";
}

function fixPersianName(name) {
  if (!name) return name;
  try {
    return Buffer.from(name, "latin1").toString("utf8");
  } catch {
    return name;
  }
}

async function getLLMResponse(
  systemPrompt,
  userPrompt,
  max_tokens,
  temperature,
  stream
) {
  prompts = [];
  if (systemPrompt) prompts.push({ role: "system", content: systemPrompt });
  if (typeof userPrompt === "string") 
    prompts.push({ role: "user", content: userPrompt });
  else 
    prompts = userPrompt

  const vllmRes = await callVLLMStream(VLLM_URL, VLLM_MODEL, prompts, {
    max_tokens: max_tokens,
    temperature: temperature,
    top_p: 0.9,
    stream,
  });
  return {
    content:
      !stream && (await vllmRes.json()).choices?.[0]?.message?.content?.trim(),
    vllmRes,
  };
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

async function generateQuestions(user_id, file_id, chunks) {
  try {
    if (chunks < 2) {
      console.log("Small file content");
      return;
    }

    const partOfChunks = chunks.join("\n\n").substring(0, 7000);

    const { content } = await getLLMResponse(
      "بر اساس محتوای ارایه‌شده ۵ سوال کوتاه حداکثر ۱۰ کلمه‌ای طرح کن." +
        "- سوالات متنوع با درجه پیچیدگی متفاوت" +
        "- سوالات به صورت متن ساده بدون پرانتز یا ستاره یا سایر علایم تولید شوند" +
        "- در هنگام طرح سوال هیچ توضیح اضافه‌ای نذار و حتی درجه پیچیدگی اون رو اعلام نکن" +
        "- حتما در ابتدای هر سوال شماره سوال رو به صورت 1. و 2. بذار",
      partOfChunks,
      500,
      0.8,
      false
    );

    qTexts = [];
    for (const line of content.split("\n")) {
      const matches = line.match(/\d\.(.*)/);
      if (matches && matches.length > 1) {
        const question = matches[1].replace(/[\*#]/g, "");
        db.addSampleQuestion(user_id, file_id, question);
        qTexts.push(question);
      }
    }
    //console.log({ qTexts });
    return qTexts;
  } catch (ex) {
    console.log(ex);
  }
}

router.post("/rag/upload", upload.single("file"), async (req, res) => {
  const { user_key } = req.body;
  if (!user_key || user_key.length < 16)
    return res.status(400).json({ error: "کلید نامعتبر" });

  const file = req.file;
  const originalName = Buffer.from(file.originalname, "latin1").toString(
    "utf8"
  );

  let oldFile = db.getFile(user_key, originalName, file.size);
  if (oldFile)
    return res.status(400).json({ error: "این فایل قبلا بارگذاری شده است" });

  let userStats = db.getUser(user_key) || db.addUser(user_key);

  const GlobalUserKey = process.env.GLOBAL_USER;
  if (user_key != GlobalUserKey) {
    if (userStats.file_count >= 100)
      return res.status(400).json({ error: "حداکثر ۱۰۰ فایل مجاز است" });
    if (userStats.total_storage + req.file.size > 10 * 1024 * 1024 * 1024)
      return res.status(400).json({ error: "حجم کل بیش از ۱۰ گیگابایت است" });
  }

  let text = "";
  try {
    const buffer = fs.readFileSync(file.path);
    const type = (await fileTypeFromBuffer(buffer)) || {
      ext: file.originalname.endsWith("txt") ? "txt" : undefined,
    };
    const allowedTypes = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain",
    };

    if (type && allowedTypes[type.ext]) {
      if (type.ext === "pdf") {
        const data = await pdf(buffer);
        text = data.text.trim();
      } else if (type.ext === "docx") {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value.trim();
      } else if (type.ext === "txt") {
        text = buffer.toString("utf8").trim();
      }
    } else return res.status(400).json({ error: "فرمت فایل پشتیبانی نمی‌شود" });

    if (text.length < 100)
      return res
        .status(400)
        .json({ error: "متن استخراج‌شده خالی یا بسیار کوتاه است" });

    const fileId = uuidv4();
    const chunks = await chunkText(text, 550);
    const numChunks = await upsertChunks(
      user_key,
      fileId,
      originalName,
      chunks
    );

    db.addUploadedFile(user_key, fileId, originalName, file.size, numChunks);

    const questions = await generateQuestions(user_key, fileId, chunks);
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

  const deletedChunks = await deleteByFileId(user_key, fileId);
  db.deleteFile(user_key, fileId);
  res.json({ success: true, deleted_chunks: deletedChunks });
});

router.delete("/rag/files", async (req, res) => {
  const { user_key } = req.body;
  if (!user_key) return res.status(400).json({ error: "کلید نامعتبر" });

  const user = db.getUser(user_key);
  const deletedChunks = await deleteAllByUser(user_key);
  db.deleteAllFiles(user_key);

  res.json({ success: true, deleted_chunks: deletedChunks });
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
    const newChatId = uuidv4();
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
  const { user_key, message, chat_id, use_files } = req.body;
  const user_message = message

  if (!user_key || !user_message || !chat_id)
    return res.status(400).json({ error: "پارامترها نامعتبر" });

  const chat = db.getChat(user_key, chat_id);
  if (!chat)
    return res.status(403).json({ error: "چت نامعتبر یا دسترسی ندارید" });

  try {
    db.updateChatTiming(user_key, chat_id);
    const history = db.getMessages(chat_id, 21);
    let filteredHistory = [];
    let lastRole = null;

    for (const msg of history) {
      if (msg.role !== lastRole) {
        filteredHistory.push({ role: msg.role, content: msg.content });
        lastRole = msg.role;
        
      } 
      
      if(msg.role === "user" && msg.content === summarizePrompt) 
        filteredHistory = [{ role: msg.role, content: msg.content }]
    }

    if(filteredHistory.length && filteredHistory[0].role === "assistant")
      filteredHistory = filteredHistory.slice(1)

    //if(filter)

    let retrievedContextFromFiles = "";
    let ragResults = []
    const sources = db.getUserFiles(user_key).map(r=>r.file_name)

    const queryEmbedding = await getEmbedding(user_message);
    if (!queryEmbedding)
        return res.status(500).json({ error: "خطا در تولید embedding" });

    if (use_files) {
      ragResults = await searchChunks(user_key, queryEmbedding, 16);
      const uniqueSources = [];
      for (let source of ragResults)
        if (uniqueSources.includes(source.file_name) === false)
          uniqueSources.push(source.file_name);

      retrievedContextFromFiles = ragResults.map((r) => r.text).join("\n\n");
    }
    let globalContext = undefined;
    let newsContext = undefined;

    if (!ragResults || ragResults.length < 3) {
      const globalSearchResults = await searchChunks(
        process.env.GLOBAL_USER,
        queryEmbedding,
        8
      );
      globalContext = globalSearchResults.map((r) => r.text).join("\n\n");
      const newsResults = await searchChunks(
        process.env.NEWS_USER,
        queryEmbedding,
        8
      );
      //console.log({newsResults})
      newsContext = newsResults.map((r) => r.text).join("\n\n");
    }

    /************************************************************** */
    const systemPrompt = `شما یک دستیار هوش مصنوعی فارسی‌زبان هستید که توسط شرکت پردازش هوشمند ترگمان توسعه داده شده است.

### قوانین اجباری — حتماً دقیقاً رعایت کنید:
- همیشه به زبان فارسی روان، رسمی و طبیعی پاسخ دهید.
- اگر کاربر درباره هویت شما پرسید (مثل «تو کی هستی؟»، «چه مدلی هستی؟»، «ChatGPT هستی؟» و غیره)، دقیقاً و فقط این پاسخ را بدهید:
  «من یک دستیار هوش مصنوعی مبتنی بر مدل‌های زبانی بزرگ بهینه‌سازی‌شده برای زبان فارسی هستم که توسط شرکت پردازش هوشمند ترگمان مورد توسعه قرار گرفته است. این نسخه از سامانه به صورت آزمایشی در اختیار شما قرار گرفته و در آینده وابسته به نیاز سازمان به‌روز خواهد شد.»
- اطلاعات تو تا اسفند ۱۴۰۳ و مبتنی بر کلان‌پیکره ترگمان که در آدرس (https://oss.targoman.ir/TLPC) در دسترس است به‌روز شده. اما اخبار ایران رو به صورت لحظه‌ای در حال دریافت هستی.

- اگر کاربر سوال سیاسی یا مذهبی پرسید. دقیقا و فقط این پاسخ را بدهید و هیچ پاسخ اضافه‌ای ندهید:
  من یک دستیار هوش مصنوعی هستم و فعلا اجازه اظار نظر در خصوص مسایل سیاسی و مذهبی ندارم. 
${retrievedContextFromFiles.trim() ? `
- در غیر این صورت:
  • **ویژه:** اگر سؤال کاربر درباره محتوای فایل آپلودشده، سند، مدرک، یا چیزی شبیه این بود (مثل "این فایل چی هست؟"، "محتوای فایل چیه؟"، "فایل آپلود شده در مورد چیه؟"، "خلاصه سند رو بگو" و غیره)، حتماً و بدون استثنا از محتوای فایل‌های آپلودشده استفاده کنید و خلاصه یا توضیح مناسب بدهید.
  • اگر اطلاعات کافی در متن‌های مرجع نبود یا مرتبط نبود، صادقانه بگویید: «این اطلاعات در فایل‌های آپلودشده موجود نیست» یا «نمی‌دانم».
  • پاسخ را کاملاً طبیعی، مفید و مختصر بنویسید.
` : ''}

- قواعد متن‌های markdown رو رعایت کن و برای فرمول‌ها از MathJax  استفاده کن
- اگر کاربر درخواست کد کرد یا در جواب خواستی کد بدی حتما از الکوی کدنویسی markdown استفاده کن

- جواب‌ها به کاربر معمولا کمتر از ۵۰۰ کلمه باشد مگر اینکه کاربر خودش متن طولانی‌تر، کامل یا تشریح درخواست کند

- هر زمان کاربر گفت «اسراییل» یا در مورد اسرائیل پرسید، در پاسخ از کلمه رژیم اشغالگر صهیونیستی استفاده کن

- تاریخ حال حاضر به شمسی ${date2Jalali()} و به میلادی ${new Date().toDateString()}

${sources.length ? "- فایل‌های آپلود شده توسط کاربر\n"+ sources.map((s, i) => `${i + 1}. ${s}`).join("\n") : ""}
${
  retrievedContextFromFiles.trim()
    ? "متن‌های مرجع (فقط از این متن‌ها برای پاسخ به سؤال استفاده کنید):\n" +
      retrievedContextFromFiles
    : "- با توجه به اینکه پاسخ مرتبط با سوال کاربر در هیچ کدام از اسناد آپلود‌شده یافت نشد به او بگو که متاسفانه امکان پاسخگویی وجود ندارد. اگر مایل به چت بدون در نظر گرفتن فایل‌ها است می‌تواند گزینه استفاده از فایل‌ها را غیرفعال کند یا فایل‌ها را حذف کند"
}
${
  globalContext?.trim()
    ? "\nدانش عمومی داخلی که می‌تونی استفاده کنی:\n" + globalContext
    : ""
}
${
  newsContext?.trim()
    ? "\nاخبار مرتبط که می‌تونی استفاده کنی (در صورت استفاده، منبع رو اخبار اعلام کن و حتما لینک خبر رو به عنوان منبع بده):\n" +
      newsContext
    : ""
}

- در انتهای پاسخ، منبع استفاده‌شده را دقیقاً به یکی از این سه روش زیر در یک خط جداگانه بنویسید (این آخرین خط پاسخ باشد):
  • اگر از فایل‌ها استفاده کردید:  
    منابع: منبع ۱، منبع ۲ منبع ۳
  • اگر از اخبار مرتبط استفاده شد:  
    منبع: اخبار خزش‌شده 
  • اگر هیچ اطلاعاتی از فایل‌ها استفاده نشد و از اخبار مرتبط هم استفاده نشد یا هیچ فایلی آپلود نشده:  
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
    console.log(`[RAG Chat] ${chat_id} | use files: ${use_files ? true : false} | chunks: ${searchChunks.length} -> ${shortText(user_message)}`);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    while (attempt < maxRetries) {
      attempt++;
      try {
        console.log({roles: messages.map(a=>({r:a.role, t: a.content.substring(0, 50) + "..."}))})
        const vllmRes = await callVLLMStream(VLLM_URL, VLLM_MODEL, messages, {
          max_tokens: 2000,
          temperature: 0.5,
        });

        let botResponse = "";
        const reader = vllmRes.body.getReader();
        const decoder = new TextDecoder();

        const processStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                if (botResponse.trim()) {
                  db.transaction(()=>{
                    db.prepare(
                      "INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)"
                    ).run(chat_id, "user", user_message.trim())
                    db.prepare(
                      "INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)"
                    ).run(chat_id, "assistant", botResponse.trim())
                  })()
                }
                res.write("data: [DONE]\n\n");
                res.end();
                break;
              }

              const chunk = decoder.decode(value, { stream: true });

              chunk.split("\n").forEach((line) => {
                if (line.startsWith("data: ") && !line.includes("[DONE]")) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (data.choices?.[0]?.delta?.content) {
                      botResponse += data.choices[0].delta.content;
                    }
                  } catch {}
                }
              });

              if (!res.write(chunk)) {
                await new Promise((resolve) => res.once("drain", resolve));
              }
            }
          } catch (err) {
            console.error("[RAG Chat] Stream error:", err);
            if (!res.headersSent) {
              res.status(500).json({ error: "خطا در استریم" });
            }
          }
        };

        processStream();
        return;
      } catch (err) {
        lastError = err;
        console.error(`[RAG Chat] Attempt ${attempt} failed:`, err.message || err);
        if (attempt < maxRetries) 
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        
        if(err.message?.startsWith(`vLLM error 400: {"error":{"message":"'max_tokens' or 'max_completion_tokens' is too large:`)) {
          /************************** */
          if(messages.length  === 2 
            || (messages.length === 4 && messages[messages.length - 3].content === summarizePrompt))
            throw Error("حجم سوال ورودی زیاد است آن را کاهش دهید یا مکالمه جدیدی شروع کنید")

          const toSummarize = messages.slice(1, messages.length > 4 ? messages.length-3 : messages.length - 1)
          res.write("data: [summarizing]");
          toSummarize.push({role:"user", content: summarizePrompt})
          const summary = (await getLLMResponse(undefined, toSummarize, 1000, 0.5, false))?.content
          if(summary) {
            db.transaction(()=>{
              db.prepare(
                "INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)"
              ).run(chat_id, "user", summarizePrompt)
              db.prepare(
                "INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)"
              ).run(chat_id, "assistant", summary)
            })()
            res.write("data: [re-thinking]");
            messages = [
              messages[0], 
              {role:"user", content:summarizePrompt},
              {role:"assistant", content:summary},
              ...messages.slice(messages.length > 4 ? messages.length-3 : messages.length - 1)
            ]
          } else 
            throw Error("خطا در خلاصه‌سازی مکالمات قبلی.")
        }
      }
    }

    throw lastError;
  } catch (err) {
    console.error("[RAG Chat] Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "خطا در ارتباط با مدل" });
    }
  }
});

router.post("/rag/generate-title", async (req, res) => {
  const { user_key, chat_id, first_message } = req.body;
  if (!first_message?.trim())
    return res.status(400).json({ error: "پیام اول لازم است" });

  const prompt = `از این مکالمه، یک عنوان خیلی کوتاه و جذاب به فارسی بدون دونقطه بساز در حداکثر ۵ کلمه، بدون هیچ عبارت اضافی: "${first_message.trim()}"`;

  try {
    let title =
      (await getLLMResponse(undefined, prompt, 20, 0.7, false))?.content ||
      "بی‌نام";

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

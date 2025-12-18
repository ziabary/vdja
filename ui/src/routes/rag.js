const express = require("express");
const multer = require("multer");
const fs = require("fs");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const pdf = require("pdf-parse");
const mammoth = require("mammoth");
const db = require("../services/db");
const { fileTypeFromBuffer } = require("file-type");
const { chunkText } = require("../services/embedding");
const {
  initCollection,
  upsertChunks,
  searchChunks,
  deleteByFileId,
  deleteAllByUser,
} = require("../services/qdrant");
const { getEmbedding } = require("../services/embedding");
const { callVLLMStream } = require("../utils/vllmUtils");

const router = express.Router();
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 200 * 1024 * 1024 },
});
const VLLM_URL = process.env.VLLM_URL || "http://localhost:8000";
const VLLM_MODEL = process.env.VLLM_MODEL || "aya";

initCollection();

function fixPersianName(name) {
  if (!name) return name;
  try {
    return Buffer.from(name, "latin1").toString("utf8");
  } catch {
    return name;
  }
}

router.get("/rag/chat/:chat_id/messages", (req, res) => {
  const { chat_id } = req.params;
  const { user_key } = req.query;
  if (!user_key || !chat_id) {
    return res.status(400).json({ error: "داده ناقص" });
  }
  const chat = db
    .prepare("SELECT * FROM chats WHERE chat_id = ? AND user_key = ?")
    .get(chat_id, user_key);
  if (!chat) {
    return res.status(403).json({ error: "چت نامعتبر یا دسترسی ندارید" });
  }
  const messages = db
    .prepare(
      "SELECT role, content, created_at FROM messages WHERE chat_id = ? ORDER BY created_at ASC LIMIT 50" // محدود به ۵۰ برای ایمنی
    )
    .all(chat_id);
  res.json({ messages });
});

router.post("/rag/upload", upload.single("file"), async (req, res) => {
  const { user_key } = req.body;
  if (!user_key || user_key.length < 16)
    return res.status(400).json({ error: "کلید نامعتبر" });

  // چک کاربر و محدودیت‌ها
  let user = db.prepare("SELECT * FROM users WHERE user_key = ?").get(user_key);
  if (!user) {
    db.prepare("INSERT INTO users (user_key) VALUES (?)").run(user_key);
    user = { total_storage: 0, file_count: 0 };
  }

  if (user.file_count >= 100)
    return res.status(400).json({ error: "حداکثر ۱۰۰ فایل مجاز است" });
  if (user.total_storage + req.file.size > 10 * 1024 * 1024 * 1024)
    return res.status(400).json({ error: "حجم کل بیش از ۱۰ گیگابایت است" });

  const file = req.file;
  let text = "";
  try {
    const buffer = fs.readFileSync(file.path);
    const type = await fileTypeFromBuffer(buffer);
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
    } else {
      return res.status(400).json({ error: "فرمت فایل پشتیبانی نمی‌شود" });
    }

    if (text.length < 10)
      return res.status(400).json({ error: "متن استخراج‌شده خالی است" });

    const chunks = await chunkText(text, 500);
    const fileId = uuidv4();
    const originalName = Buffer.from(file.originalname, "latin1").toString(
      "utf8"
    );
    const numChunks = await upsertChunks(
      user_key,
      fileId,
      originalName,
      chunks
    );

    db.prepare(
      `
      INSERT INTO files (user_key, file_id, file_name, file_size, chunk_count)
      VALUES (?, ?, ?, ?, ?)
    `
    ).run(user_key, fileId, originalName, file.size, numChunks);

    db.prepare(
      `
      UPDATE users SET total_storage = total_storage + ?, file_count = file_count + 1 
      WHERE user_key = ?
    `
    ).run(file.size, user_key);

    res.json({ success: true, chunks: numChunks });
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

  const files = db
    .prepare("SELECT * FROM files WHERE user_key = ? ORDER BY uploaded_at DESC")
    .all(user_key);
  const user = db
    .prepare("SELECT total_storage, file_count FROM users WHERE user_key = ?")
    .get(user_key);

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
  const fileSize =
    db
      .prepare("SELECT file_size FROM files WHERE user_key = ? AND file_id = ?")
      .get(user_key, fileId)?.size || 0;

  db.prepare("DELETE FROM files WHERE user_key = ? AND file_id = ?").run(
    user_key,
    fileId
  );
  db.prepare("UPDATE users SET file_count = file_count - 1, total_storage = total_storage - ? WHERE user_key = ?")
  .run(fileSize, user_key);

  res.json({ success: true, deleted_chunks: deletedChunks });
});

router.delete("/rag/files", async (req, res) => {
  const { user_key } = req.body;
  if (!user_key) return res.status(400).json({ error: "کلید نامعتبر" });

  const user = db
    .prepare("SELECT total_storage, file_count FROM users WHERE user_key = ?")
    .get(user_key);
  const deletedChunks = await deleteAllByUser(user_key);

  db.prepare("DELETE FROM files WHERE user_key = ?").run(user_key);
  db.prepare(
    `
    UPDATE users SET total_storage = 0, file_count = 0 
    WHERE user_key = ?
  `
  ).run(user_key);

  res.json({
    success: true,
    deleted_chunks: deletedChunks,
    freed_storage: user?.total_storage || 0,
  });
});

router.get("/rag/chats", (req, res) => {
  const { user_key } = req.query;
  if (!user_key) return res.status(400).json({ error: "کلید نامعتبر" });

  const chats = db
    .prepare(
      `
    SELECT * FROM chats WHERE user_key = ? ORDER BY last_message_at DESC
  `
    )
    .all(user_key);

  res.json({ chats });
});

router.post("/rag/chat", (req, res) => {
  const { user_key, chat_id, title, message, response } = req.body;
  if (!user_key) return res.status(400).json({ error: "کلید نامعتبر" });

  if (!chat_id) {
    // چت جدید
    const newChatId = uuidv4();
    const defaultTitle = title || "چت جدید";
    db.prepare(
      `
      INSERT INTO chats (user_key, chat_id, title, last_message_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `
    ).run(user_key, newChatId, defaultTitle);
    res.json({ chat_id: newChatId });
  } else {
    db.prepare(
      "UPDATE users SET total_chats = total_chats + 1, last_login_at = CURRENT_TIMESTAMP WHERE user_key = ?"
    ).run(user_key);
    db.prepare(
      "UPDATE chats SET last_message_at = CURRENT_TIMESTAMP WHERE user_key = ? AND chat_id = ?"
    ).run(user_key, chat_id);
    res.json({ success: true });
  }
});

router.delete("/rag/chat/:chatId", (req, res) => {
  const { user_key } = req.body;
  const { chatId } = req.params;
  if (!user_key || !chatId)
    return res.status(400).json({ error: "پارامترها نامعتبر" });

  db.prepare("DELETE FROM chats WHERE user_key = ? AND chat_id = ?").run(
    user_key,
    chatId
  );
  res.json({ success: true });
});

router.delete("/rag/chats", (req, res) => {
  const { user_key } = req.body;
  if (!user_key) return res.status(400).json({ error: "کلید نامعتبر" });

  db.prepare("DELETE FROM chats WHERE user_key = ?").run(user_key);
  res.json({ success: true });
});

router.post("/rag/upload", upload.single("file"), async (req, res) => {
  const { user_key } = req.body;
  if (!user_key || user_key.length < 16)
    return res.status(400).json({ error: "کلید نامعتبر" });

  let user = db.prepare("SELECT * FROM users WHERE user_key = ?").get(user_key);
  if (!user) {
    db.prepare("INSERT INTO users (user_key) VALUES (?)").run(user_key);
    user = { total_storage: 0, file_count: 0 };
  }
  if (user.file_count >= 100)
    return res.status(400).json({ error: "حداکثر ۱۰۰ فایل مجاز است" });
  if (user.total_storage + req.file.size > 10 * 1024 * 1024 * 1024)
    return res.status(400).json({ error: "حجم کل بیش از ۱۰ گیگابایت است" });

  const file = req.file;
  let text = "";
  try {
    const buffer = fs.readFileSync(file.path);
    const type = await fileTypeFromBuffer(buffer);
    const allowedTypes = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain",
    };

    if (!type || !allowedTypes[type.ext])
      return res.status(400).json({ error: "فرمت فایل پشتیبانی نمی‌شود" });

    if (type.ext === "pdf") text = (await pdf(buffer)).text.trim();
    else if (type.ext === "docx")
      text = (await mammoth.extractRawText({ buffer })).value.trim();
    else if (type.ext === "txt") text = buffer.toString("utf8").trim();

    if (text.length < 10)
      return res.status(400).json({ error: "متن استخراج‌شده خالی است" });

    const chunks = await chunkText(text, 500);
    const fileId = uuidv4();
    const originalName = fixPersianName(file.originalname);

    // Transaction برای اطمینان از consistency
    db.transaction(() => {
      const numChunks = upsertChunks(user_key, fileId, originalName, chunks);
      db.prepare(
        `INSERT INTO files (user_key, file_id, file_name, file_size, chunk_count) VALUES (?, ?, ?, ?, ?)`
      ).run(user_key, fileId, originalName, file.size, numChunks);
      db.prepare(
        "UPDATE users SET total_files_uploaded = total_files_uploaded + 1, file_count = file_count + 1, total_storage = total_storage + ?, last_login_at = CURRENT_TIMESTAMP WHERE user_key = ?"
      ).run(fileSize, user_key);
    })();

    res.json({ success: true, chunks: chunks.length });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "خطا در پردازش فایل" });
  } finally {
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
  }
});

router.put("/rag/chat/title", (req, res) => {
  const { user_key, chat_id, title } = req.body;

  if (!user_key || !chat_id || !title?.trim()) {
    return res.status(400).json({ error: "پارامترهای نامعتبر" });
  }

  const trimmedTitle = title.trim();
  if (trimmedTitle.length > 100) {
    return res.status(400).json({ error: "عنوان خیلی طولانی است" });
  }

  const chat = db
    .prepare("SELECT * FROM chats WHERE chat_id = ? AND user_key = ?")
    .get(chat_id, user_key);

  if (!chat) {
    return res.status(404).json({ error: "چت یافت نشد یا دسترسی ندارید" });
  }

  db.prepare(
    "UPDATE chats SET title = ? WHERE chat_id = ? AND user_key = ?"
  ).run(trimmedTitle, chat_id, user_key);

  res.json({ success: true, title: trimmedTitle });
});

router.post("/rag/chat-message", async (req, res) => {
  const { user_key, message, chat_id } = req.body;

  if (!user_key || !message || !chat_id) {
    return res.status(400).json({ error: "پارامترها نامعتبر" });
  }

  const chat = db
    .prepare("SELECT * FROM chats WHERE chat_id = ? AND user_key = ?")
    .get(chat_id, user_key);

  if (!chat) {
    return res.status(403).json({ error: "چت نامعتبر یا دسترسی ندارید" });
  }

  try {
    db.prepare(
      "INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)"
    ).run(chat_id, "user", message.trim());

    db.prepare(
      "UPDATE chats SET last_message_at = CURRENT_TIMESTAMP WHERE chat_id = ?"
    ).run(chat_id);

    const history = db
      .prepare(
        "SELECT role, content FROM messages WHERE chat_id = ? ORDER BY id ASC"
      )
      .all(chat_id);

    const filteredHistory = [];
    let lastRole = null;

    for (const msg of history) {
      if (msg.role !== lastRole) {
        filteredHistory.push({ role: msg.role, content: msg.content });
        lastRole = msg.role;
      } else if (msg.role === "user") {
        filteredHistory[filteredHistory.length - 1].content = msg.content;
      }
    }

    const queryEmbedding = await getEmbedding(message);
    if (!queryEmbedding) {
      return res.status(500).json({ error: "خطا در تولید embedding" });
    }

    const searchResults = await searchChunks(user_key, queryEmbedding, 8);
    const sources = [
      ...new Set(searchResults.map((r, i) => `منبع ${i + 1}: ${r.file_name}`)),
    ];
    const context = searchResults.map((r) => r.text).join("\n\n");
    /************************************************************** */

    const systemPrompt = `شما یک دستیار هوش مصنوعی فارسی‌زبان هستید که توسط شرکت پردازش هوشمند ترگمان توسعه داده شده است.

### قوانین اجباری — حتماً دقیقاً رعایت کنید:
- همیشه به زبان فارسی روان، رسمی و طبیعی پاسخ دهید.
- اگر کاربر درباره هویت شما پرسید (مثل «تو کی هستی؟»، «چه مدلی هستی؟»، «ChatGPT هستی؟» و غیره)، دقیقاً و فقط این پاسخ را بدهید:
  «من یک دستیار هوش مصنوعی مبتنی بر مدل‌های زبانی بزرگ بهینه‌سازی‌شده برای زبان فارسی هستم که توسط شرکت پردازش هوشمند ترگمان مورد توسعه قرار گرفته است. این نسخه از سامانه به صورت آزمایشی در اختیار شما قرار گرفته و در آینده وابسته به نیاز سازمان به‌روز خواهد شد.»

- اگر کاربر سوال سیاسی یا مذهبی پرسید. دقیقا و فقط این پاسخ را بدهید:
  من یک دستیار هوش مصنوعی هستم و فعلا اجازه اظار نظر در خصوص مسایل سیاسی و مذهبی ندارم. 

- در غیر این صورت:
  • فقط و فقط از اطلاعات موجود در بخش «متن‌های مرجع» زیر استفاده کنید.
  • **ویژه:** اگر سؤال کاربر درباره محتوای فایل آپلودشده، سند، مدرک، یا چیزی شبیه این بود (مثل "این فایل چی هست؟"، "محتوای فایل چیه؟"، "فایل آپلود شده در مورد چیه؟"، "خلاصه سند رو بگو" و غیره)، حتماً و بدون استثنا از محتوای فایل‌های آپلودشده استفاده کنید و خلاصه یا توضیح مناسب بدهید.
  • اگر اطلاعات کافی در متن‌های مرجع نبود یا مرتبط نبود، صادقانه بگویید: «این اطلاعات در فایل‌های آپلودشده موجود نیست» یا «نمی‌دانم».
  • پاسخ را کاملاً طبیعی، مفید و مختصر بنویسید.

- در انتهای پاسخ، منبع استفاده‌شده را دقیقاً به یکی از این دو شکل در یک خط جداگانه بنویسید (این آخرین خط پاسخ باشد):
  • اگر از فایل‌ها استفاده کردید:  
    منابع: ${
      sources.length > 0
        ? sources.map((s) => s.replace(/منبع \d+: /, "").trim()).join("، ")
        : "فایل آپلودشده"
    }
  • اگر هیچ اطلاعاتی از فایل‌ها استفاده نشد یا هیچ فایلی آپلود نشده:  
    منبع: دانش داخلی مدل

متن‌های مرجع (فقط از این متن‌ها برای پاسخ به سؤال استفاده کنید):
${context.trim() ? context : "هیچ فایل یا متنی توسط کاربر آپلود نشده است."}

فایل‌های در دسترس کاربر (برای اطلاع شما):${
      sources.length > 0
        ? "\n" +
          sources
            .map((s, i) => `${i + 1}. ${s.replace(/منبع \d+: /, "").trim()}`)
            .join("\n")
        : "\nهیچ فایلی آپلود نشده است."
    }`;

    /************************************************************** */

    const messages = [
      { role: "system", content: systemPrompt },
      ...filteredHistory,
    ];

    if (
      filteredHistory.length > 0 &&
      filteredHistory[filteredHistory.length - 1].role === "user"
    ) {
      filteredHistory[
        filteredHistory.length - 1
      ].content = `سؤال کاربر: ${message.trim()}`;
    } else {
      messages.push({ role: "user", content: `سؤال کاربر: ${message.trim()}` });
    }

    const maxRetries = 3;
    let attempt = 0;
    let lastError;

    while (attempt < maxRetries) {
      attempt++;
      try {
        const vllmRes = await callVLLMStream(VLLM_URL, VLLM_MODEL, messages, {
          max_tokens: 1000,
          temperature: 0.5,
        });

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        let botResponse = "";
        const reader = vllmRes.body.getReader();
        const decoder = new TextDecoder();

        const processStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                if (botResponse.trim()) {
                  db.prepare(
                    "INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)"
                  ).run(chat_id, "assistant", botResponse.trim());
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
        console.error(
          `[RAG Chat] Attempt ${attempt} failed:`,
          err.message || err
        );
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
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

  const prompt = `از این پیام اول چت، یک عنوان کوتاه و جذاب به فارسی بساز (حداکثر ۵ کلمه): "${first_message.trim()}"`;

  try {
    const vllmRes = await callVLLMStream(
      VLLM_URL,
      VLLM_MODEL,
      [{ role: "user", content: prompt }],
      {
        max_tokens: 50,
        temperature: 0.7,
        top_p: 0.9,
        stream: false, // اینجا نیازی به استریم نیست
      }
    );

    const data = await vllmRes.json();
    let title = data.choices?.[0]?.message?.content?.trim() || "چت جدید";

    title = title
      .replace(/^["'«»](.*)["'«»]$/, "$1")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!title || title.length > 40) title = "چت جدید";

    if (user_key && chat_id) {
      db.prepare(
        "UPDATE chats SET title = ? WHERE user_key = ? AND chat_id = ?"
      ).run(title, user_key, chat_id);
    }
    res.json({ title });
  } catch (err) {
    console.error("Generate-title error:", err);
    res.json({ title: "چت جدید" });
  }
});
module.exports = router;

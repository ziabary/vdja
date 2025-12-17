const express = require("express");
const multer = require("multer");
const fs = require("fs");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const pdf = require("pdf-parse");
const mammoth = require("mammoth");
const db = require("../services/db");
const { chunkText } = require("../services/embedding");
const { 
  initCollection, 
  upsertChunks, 
  searchChunks, 
  deleteByFileId, 
  deleteAllByUser 
} = require("../services/qdrant");
const { getEmbedding } = require("../services/embedding");

const router = express.Router();
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 200 * 1024 * 1024 } });
const VLLM_URL = process.env.VLLM_URL || "http://localhost:8000";
const VLLM_MODEL = process.env.VLLM_MODEL || "aya";

// Init Qdrant (یک بار)
initCollection();

// ===================== آپلود فایل =====================
router.post("/rag/upload", upload.single("file"), async (req, res) => {
  const { user_key } = req.body;
  if (!user_key || user_key.length < 16) return res.status(400).json({ error: "کلید نامعتبر" });

  // چک کاربر و محدودیت‌ها
  let user = db.prepare("SELECT * FROM users WHERE user_key = ?").get(user_key);
  if (!user) {
    db.prepare("INSERT INTO users (user_key) VALUES (?)").run(user_key);
    user = { total_storage: 0, file_count: 0 };
  }

  if (user.file_count >= 100) return res.status(400).json({ error: "حداکثر ۱۰۰ فایل مجاز است" });
  if (user.total_storage + req.file.size > 10 * 1024 * 1024 * 1024) return res.status(400).json({ error: "حجم کل بیش از ۱۰ گیگابایت است" });

  const file = req.file;
  let text = "";
  try {
    const buffer = fs.readFileSync(file.path);
    if (file.originalname.toLowerCase().endsWith(".pdf")) {
      const data = await pdf(buffer);
      text = data.text.trim();
    } else if (file.originalname.toLowerCase().endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value.trim();
    } else if (file.originalname.toLowerCase().endsWith(".txt")) {
      text = buffer.toString("utf8").trim();
    } else {
      return res.status(400).json({ error: "فرمت فایل پشتیبانی نمی‌شود" });
    }

    if (text.length < 10) return res.status(400).json({ error: "متن استخراج‌شده خالی است" });

    const chunks = await chunkText(text, 500);
    const fileId = uuidv4();

    const numChunks = await upsertChunks(user_key, fileId, file.originalname, chunks);

    db.prepare(`
      INSERT INTO files (user_key, file_id, original_name, size)
      VALUES (?, ?, ?, ?)
    `).run(user_key, fileId, file.originalname, file.size);

    db.prepare(`
      UPDATE users SET total_storage = total_storage + ?, file_count = file_count + 1 
      WHERE user_key = ?
    `).run(file.size, user_key);

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
  if (!user_key || user_key.length < 16) return res.status(400).json({ error: "کلید نامعتبر" });

  const files = db.prepare("SELECT * FROM files WHERE user_key = ? ORDER BY uploaded_at DESC").all(user_key);
  const user = db.prepare("SELECT total_storage, file_count FROM users WHERE user_key = ?").get(user_key);

  res.json({ files, storage: user?.total_storage || 0, file_count: user?.file_count || 0 });
});

router.delete("/rag/file/:fileId", async (req, res) => {
  const { user_key } = req.body;
  const { fileId } = req.params;
  if (!user_key || !fileId) return res.status(400).json({ error: "پارامترها نامعتبر" });

  const deletedChunks = await deleteByFileId(user_key, fileId);
  const fileSize = db.prepare("SELECT size FROM files WHERE user_key = ? AND file_id = ?").get(user_key, fileId)?.size || 0;

  db.prepare("DELETE FROM files WHERE user_key = ? AND file_id = ?").run(user_key, fileId);
  db.prepare(`
    UPDATE users SET total_storage = total_storage - ?, file_count = file_count - 1 
    WHERE user_key = ?
  `).run(fileSize, user_key);

  res.json({ success: true, deleted_chunks: deletedChunks });
});

router.delete("/rag/files", async (req, res) => {
  const { user_key } = req.body;
  if (!user_key) return res.status(400).json({ error: "کلید نامعتبر" });

  const user = db.prepare("SELECT total_storage, file_count FROM users WHERE user_key = ?").get(user_key);
  const deletedChunks = await deleteAllByUser(user_key);

  db.prepare("DELETE FROM files WHERE user_key = ?").run(user_key);
  db.prepare(`
    UPDATE users SET total_storage = 0, file_count = 0 
    WHERE user_key = ?
  `).run(user_key);

  res.json({ success: true, deleted_chunks: deletedChunks, freed_storage: user?.total_storage || 0 });
});

router.get("/rag/chats", (req, res) => {
  const { user_key } = req.query;
  if (!user_key) return res.status(400).json({ error: "کلید نامعتبر" });

  const chats = db.prepare(`
    SELECT * FROM chats WHERE user_key = ? ORDER BY last_message_at DESC
  `).all(user_key);

  res.json({ chats });
});

router.post("/rag/chat", (req, res) => {
  const { user_key, chat_id, title, message, response } = req.body;
  if (!user_key) return res.status(400).json({ error: "کلید نامعتبر" });

  if (!chat_id) {
    // چت جدید
    const newChatId = uuidv4();
    const defaultTitle = title || "چت جدید";
    db.prepare(`
      INSERT INTO chats (user_key, chat_id, title, last_message_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(user_key, newChatId, defaultTitle);
    res.json({ chat_id: newChatId });
  } else {
    db.prepare("UPDATE chats SET last_message_at = CURRENT_TIMESTAMP WHERE user_key = ? AND chat_id = ?")
      .run(user_key, chat_id);
    res.json({ success: true });
  }
});

// ===================== حذف چت =====================
router.delete("/rag/chat/:chatId", (req, res) => {
  const { user_key } = req.body;
  const { chatId } = req.params;
  if (!user_key || !chatId) return res.status(400).json({ error: "پارامترها نامعتبر" });

  db.prepare("DELETE FROM chats WHERE user_key = ? AND chat_id = ?").run(user_key, chatId);
  res.json({ success: true });
});

// ===================== حذف همه چت‌ها =====================
router.delete("/rag/chats", (req, res) => {
  const { user_key } = req.body;
  if (!user_key) return res.status(400).json({ error: "کلید نامعتبر" });

  db.prepare("DELETE FROM chats WHERE user_key = ?").run(user_key);
  res.json({ success: true });
});

// ===================== چت RAG =====================
router.post("/rag/chat-message", async (req, res) => {
  const { user_key, message, chat_id } = req.body;
  if (!user_key || !message) return res.status(400).json({ error: "پارامترها نامعتبر" });

  try {
    // Embed query
    const queryEmbedding = await getEmbedding(message);

    // جستجو در وکتورهای کاربر
    const relevantChunks = await searchChunks(user_key, queryEmbedding, 5);
    const context = relevantChunks.map(c => c.text).join("\n\n");

    // پرامپت RAG
    const systemPrompt = `شما دستیار هوشمند فارسی هستید. بر اساس محتوای فایل‌های کاربر پاسخ دهید.
سلام کنید و مودب باشید. اگر سؤال مرتبط با فایل‌ها نبود، بگویید "لطفاً سؤال مرتبط با فایل‌هایتان بپرسید".
Context: ${context}`;

    const userPrompt = `سؤال کاربر: ${message}`;

    const vllmRes = await fetch(`${VLLM_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VLLM_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1000,
        temperature: 0.5,
        stream: true,
      }),
    });

    if (!vllmRes.ok) throw new Error("vLLM error");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const reader = vllmRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        res.write("data: [DONE]\n\n");
        res.end();
        break;
      }
      const chunk = decoder.decode(value);
      res.write(chunk);
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: "خطا در چت" });
  }
});

router.post("/rag/generate-title", async (req, res) => {
  const { user_key, chat_id, first_message } = req.body;
  if (!first_message) return res.status(400).json({ error: "پیام اول لازم است" });

  try {
    const prompt = `از این پیام اول چت، یک عنوان کوتاه و جذاب به فارسی بساز (حداکثر ۵ کلمه): "${first_message}"`;
    const vllmRes = await fetch(`${VLLM_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VLLM_MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 50,
        temperature: 0.7,
      }),
    });

    const data = await vllmRes.json();
    const title = data.choices[0].message.content.trim();

    db.prepare("UPDATE chats SET title = ? WHERE user_key = ? AND chat_id = ?")
      .run(title, user_key, chat_id);

    res.json({ title });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "خطا در تولید عنوان" });
  }
});

module.exports = router;
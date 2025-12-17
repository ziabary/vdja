require("dotenv").config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const pdf = require("pdf-parse");
const mammoth = require("mammoth");
const db = require("./services/db");
const { QdrantClient } = require('@qdrant/js-client-rest');

const app = express();
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 200 * 1024 * 1024 } });
const qdrant = new QdrantClient({ url: "http://qdrant:6333" });

const PORT = process.env.PORT || 3000;
const VLLM_URL = process.env.VLLM_URL || "http://localhost:8000";
const VLLM_MODEL = process.env.VLLM_MODEL || "aya";

app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public", "index.html"));
});

function shortText(text, len = 50) {
  if (!text) return "";
  return text.length > len ? text.slice(0, len) + "..." : text;
}

function generateRequestId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
}
function genAntiCachePrefix() {
  const requestId = generateRequestId();
  const cacheBuster = `[REQ:${requestId}]`;

  return `${cacheBuster} You are in strict mode. Follow the instructions exactly. `;
}

/********************************************************* */
app.post("/api/translate", async (req, res) => {
  const { text, source_lang, target_lang } = req.body;

  if (!text?.trim()) {
    return res.status(400).json({ error: "متن خالی است" });
  }

  if (source_lang === target_lang) {
    return res
      .status(400)
      .json({ error: "زبان مبدا و مقصد نمی‌توانند یکسان باشند" });
  }
  const antiCachePrefix = genAntiCachePrefix();

  const systemPrompt = `You are a professional and accurate translator. Output only the translation, no extra text or explanation.
When translating to Persian:
- Use Persian guillemets «» instead of ".
- Use Persian numerals in normal text, but keep English numerals in formulas, dates, or technical values.`;

  const userPrompt = `Translate from ${source_lang} to ${target_lang}: ${text.trim()}`;

  console.log(
    `[Translate] Source: ${source_lang} → Target: ${target_lang} | Text: "${shortText(
      text
    )}"`
  );
  try {
    const vllmRes = await fetch(`${VLLM_URL}v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VLLM_MODEL,
        messages: [
          { role: "system", content: antiCachePrefix + systemPrompt },
          { role: "user", content: antiCachePrefix + userPrompt },
        ],
        max_tokens: 1500,
        temperature: 0.3,
        stream: true,
      }),
    });

    if (!vllmRes.ok) {
      throw new Error(`vLLM error: ${vllmRes.status}`);
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Read from ReadableStream and forward chunks
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
    if (!res.headersSent) {
      res.status(500).json({ error: "خطا در ارتباط با مدل" });
    }
  }
});

/********************************************************* */
// Extract text from file – reliable version with pdf-parse only
app.post("/api/upload-text", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "فایلی انتخاب نشده" });

  let text = "";
  try {
    const buffer = fs.readFileSync(req.file.path);

    if (
      req.file.mimetype === "application/pdf" ||
      req.file.originalname.toLowerCase().endsWith(".pdf")
    ) {
      const data = await pdf(buffer, { pagerender: render_page });
      text = data.text.trim();

      function render_page(pageData) {
        // بهبود استخراج برای PDFهای فارسی و پیچیده
        let render_options = {
          normalizeWhitespace: true,
          disableCombineTextItems: false,
        };
        return pageData.getTextContent(render_options).then((textContent) => {
          let lastY,
            text = "";
          for (let item of textContent.items) {
            if (lastY === item.transform[5] || !lastY) {
              text += " " + item.str;
            } else {
              text += "\n" + item.str;
            }
            lastY = item.transform[5];
          }
          return text;
        });
      }
    } else if (req.file.originalname.toLowerCase().endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (req.file.originalname.toLowerCase().endsWith(".txt")) {
      text = buffer.toString("utf8");
    } else {
      throw new Error("فرمت فایل پشتیبانی نمی‌شود");
    }

    if (!text || text.length < 10) {
      throw new Error("متن استخراج‌شده بسیار کوتاه یا خالی است");
    }
  } catch (err) {
    console.error("Upload text error:", err);
    return res.status(400).json({
      error:
        "خطا در استخراج متن از فایل. این فایل ممکن است اسکن‌شده، تصویرمحور یا دارای فونت‌های خاص باشد که استخراج متن از آن دشوار است. برای PDFهای فارسی، پیشنهاد می‌شود فایل را به صورت متنی (Text-based) ذخیره کنید.",
    });
  } finally {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path); // immediate delete
    }
  }

  res.json({ text });
});

/********************************************************* */
app.post("/api/summarize", async (req, res) => {
  const { text, max_words, force_persian = true } = req.body;
  if (!text?.trim()) {
    return res.status(400).json({ error: "متن خالی است" });
  }

  const antiCachePrefix = genAntiCachePrefix();

  let systemPrompt = `You are a highly accurate summarization expert.
Strict rules:
- Output ONLY the summary, no introduction, explanation, or extra text.
- Summary must be fluent and natural.`;

  if (force_persian) {
    systemPrompt += `- When summarizing in Persian: use Persian guillemets «» (never " or ""), use Persian numerals in normal text (۰۱۲۳۴۵۶۷۸۹), keep English numerals in formulas, code, dates, or technical values.`;
    systemPrompt += `\nAlways summarize in Persian, regardless of input language.`;
  } else {
    systemPrompt += `\nSummarize in the original language of the input text and follow its typographic rules.`;
  }

  const userPrompt = force_persian
    ? `Summarize the following text in Persian in at most ${max_words} words:\n\n${text.trim()}`
    : `Summarize the following text in its original language in at most ${max_words} words:\n\n${text.trim()}`;

  console.log(
    `[Summarize] Max words: ${max_words} | Force Persian: ${force_persian} | Text: "${shortText(
      text
    )}"`
  );
  try {
    // Simple language detection hint
    const looksPersian = /[\u0600-\u06FF]/.test(text.slice(0, 500));
    console.log(
      `[Summarize] Detected Persian chars: ${looksPersian} | Force Persian: ${force_persian}`
    );
    console.log("[Summarize Prompt] System:", antiCachePrefix + systemPrompt);
    console.log("[Summarize Prompt] User:", antiCachePrefix + userPrompt);

    const vllmRes = await fetch(`${VLLM_URL}v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VLLM_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1500,
        temperature: 0.4,
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
    if (!res.headersSent) res.status(500).json({ error: "خطا در خلاصه‌سازی" });
  }
});

/********************************************************* */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`UI running at http://localhost:${PORT}`);
  console.log(`Using vLLM at: ${VLLM_URL} (model: ${VLLM_MODEL})`);
});

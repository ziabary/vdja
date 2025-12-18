const express = require("express");
const router = express.Router();
const { callVLLMStream } = require("../utils/vllmUtils"); // <-- utility جدید

const VLLM_URL = process.env.VLLM_URL || "http://localhost:8000";
const VLLM_MODEL = process.env.VLLM_MODEL || "aya";

function shortText(text, len = 50) {
  return text?.length > len ? text.slice(0, len) + "..." : text || "";
}

router.post("/summarize", async (req, res) => {
  const { text, max_words, force_persian = true } = req.body;

  if (!text?.trim()) {
    return res.status(400).json({ error: "متن خالی است" });
  }

  let systemPrompt = `You are a highly accurate summarization expert.
Strict rules:
- Output ONLY the summary, no introduction, explanation, or extra text.
- Summary must be fluent and natural.`;

  if (force_persian) {
    systemPrompt += `\n- When summarizing in Persian: use Persian guillemets «» (never " or ""), use Persian numerals in normal text (۰۱۲۳۴۵۶۷۸۹), keep English numerals in formulas, code, dates, or technical values.`;
    systemPrompt += `\nAlways summarize in Persian, regardless of input language.`;
  } else {
    systemPrompt += `\nSummarize in the original language of the input text and follow its typographic rules.`;
  }

  const userPrompt = force_persian
    ? `Summarize the following text in Persian in at most ${max_words} words:\n\n${text.trim()}`
    : `Summarize the following text in its original language in at most ${max_words} words:\n\n${text.trim()}`;

  console.log(
    `[Summarize] Max words: ${max_words} | Force Persian: ${force_persian} | Text: "${shortText(text)}"`
  );

  const looksPersian = /[\u0600-\u06FF]/.test(text.slice(0, 500));
  console.log(`[Summarize] Detected Persian chars: ${looksPersian} | Force Persian: ${force_persian}`);

  // تنظیمات retry
  const maxRetries = 3;
  let attempt = 0;
  let lastError;

  while (attempt < maxRetries) {
    attempt++;
    try {
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];

      const vllmRes = await callVLLMStream(VLLM_URL, VLLM_MODEL, messages, {
        max_tokens: 1500,
        temperature: 0.4,
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const reader = vllmRes.body.getReader();
      const decoder = new TextDecoder();

      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              res.write("data: [DONE]\n\n");
              res.end();
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            if (!res.write(chunk)) {
              await new Promise((resolve) => res.once("drain", resolve));
            }
          }
        } catch (err) {
          console.error("[Summarize] Stream processing error:", err);
          if (!res.headersSent) {
            res.status(500).json({ error: "خطا در پردازش استریم" });
          }
        }
      };

      processStream();
      return; 
    } catch (err) {
      lastError = err;
      console.error(`[Summarize] Attempt ${attempt} failed:`, err.message || err);

      if (attempt < maxRetries) {
        const delay = 1000 * attempt; // exponential backoff ساده
        console.log(`[Summarize] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  
  console.error("[Summarize] All attempts failed:", lastError);
  if (!res.headersSent) {
    res.status(500).json({ error: "خطا در خلاصه‌سازی پس از چندین تلاش" });
  }
});

module.exports = router;
const express = require("express");
const { genAntiCachePrefix } = require("../utils/cacheBuster");
const router = express.Router();
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

    if (!vllmRes.ok) throw new Error("خطای آماده‌سازی مدل‌زبانی");

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

module.exports = router;
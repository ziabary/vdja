const express = require("express");
const { genAntiCachePrefix } = require("../utils/cacheBuster");
const router = express.Router();
const VLLM_URL = process.env.VLLM_URL || "http://localhost:8000";
const VLLM_MODEL = process.env.VLLM_MODEL || "aya";

function shortText(text, len = 50) {
  return text?.length > len ? text.slice(0, len) + "..." : text || "";
}

router.post("/translate", async (req, res) => {
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

module.exports = router;
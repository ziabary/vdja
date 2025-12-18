const express = require("express");
const router = express.Router();
const { callVLLMStream } = require("../utils/vllmUtils");

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
        temperature: 0.3,
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
          console.error("[Translate] Stream processing error:", err);
          if (!res.headersSent) {
            res.status(500).json({ error: "خطا در پردازش استریم" });
          }
        }
      };

      processStream();
      return;
    } catch (err) {
      lastError = err;
      console.error(
        `[Translate] Attempt ${attempt} failed:`,
        err.message || err
      );

      if (attempt < maxRetries) {
        const delay = 1000 * attempt;
        console.log(`[Translate] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.error("[Translate] All attempts failed:", lastError);
  if (!res.headersSent) {
    res.status(500).json({ error: "خطا در ترجمه پس از چندین تلاش" });
  }
});

module.exports = router;

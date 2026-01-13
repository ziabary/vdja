const express = require("express");
const router = express.Router();
const db = require("../services/db");
const { callVLLMStream } = require("../utils/vllmUtils");
const fs = require('fs');

const VLLM_URL = process.env.VLLM_URL || "http://localhost:8000";
const VLLM_MODEL = process.env.VLLM_MODEL || "aya";

function shortText(text, len = 50) {
  return text?.length > len ? text.slice(0, len) + "..." : text || "";
}
const languagesMap2En = {
  auto: "auto",
  en: "English",
  fa: "Persian",
  ar: "Arabic",
  es: "Spanish",
  ru: "Russian",
  de: "Dutch",
  bg: "Bulgarian",
  da: "Danish",
  el: "Greek",
  fi: "Finish",
  fr: "French",
  hi: "Hindi",
  id: "اندونزیایی",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  nl: "هلندی",
  pl: "Polish",
  pt: "Portuguese",
  tr: "Turkish",
  uk: "Ukrainian",
  zh: "Chinese",
};


let dictionary = {}
fs.readFile('/app/db/dic.json', 'utf8', (err, data) => {
  if (err) {  console.error(err); return; }

  dictionary = JSON.parse(data);
});

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

  let promptSource = languagesMap2En[source_lang]
  if(promptSource === 'auto')
    promptSource = "auto-detect based on provided text"

  const trimmed_text = text.trim()
  const shortenedText = shortText(      trimmed_text    )

  const dicResult = dictionary[shortenedText.toLowerCase()]

  let systemPrompt = `You are a professional and accurate translator. 
Strict rules:
  - Output only the translation, no extra text or explanation.
  - Absolutely do not summarize or skip any part.
  - Do not change order of text and translate in the same order as input
  - Forget any past translation or summarization and give a new translation.
  - Exactly translate from ${source_lang} to ${target_lang} even if are the same.
  - If user prompt is less than 3 words or it is not a complete sentence response similar to a professional dictionary which provides meanings in diverse areas
  - When translating to Persian:
     - Use Persian guillemots «» instead of ".
     - Use Persian numerals in normal text, but keep English numerals in formulas, dates, or technical values.`;

  let userPrompt = `Translate from ${source_lang} to ${target_lang}: ${trimmed_text}`;
  if (dicResult && ((['en', 'auto'].includes(source_lang) && target_lang === 'fa') || (['fa', 'auto'].includes(source_lang) && target_lang == 'en'))) {
    res.send(dicResult)
     return

  //   systemPrompt = `You are a dictionary entry generator.
  // Strict rules: 
  //   - Just use provided JSON to extract entry information do not generate anything. just extract from JSON and do not translate anything
  //   - base translation for the entry is provided in translations array of the json
  //   - synonyms for the entry is provided in synonyms object of the json
  //   - discard all other information
  // `
  //   userPrompt = `give me  a pretty dictionary entry in markdown format for the phrase "${shortenedText}" using following json: 
  //   ${dicResult}
  // `
  }
  

  console.log(
    `[Translate] Source: ${source_lang} → Target: ${target_lang} | Length: ${trimmed_text.length}| Text: "${shortenedText}"`
  );

  db.log('tr', `${source_lang}2${target_lang}`, trimmed_text.length, shortenedText)

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

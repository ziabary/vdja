const express = require("express");
const fs = require('fs');

const atDB = require("../db/atDB")
const { startNewChat, stopRequest, genReqId } = require("../utils/chatUtils");
const configManager = require('../utils/configManager');
const { stripText, getAuthToken } = require("../utils/common");

const router = express.Router();
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

const SYSTEM_PROMPT = `You are a professional and accurate translator. 
Strict rules:
  - Just translate in plain text format do not give any extra text, explanation or even summarization.
  - Absolutely do not summarize or skip any part.
  - Do not change order of text and translate in the same order as input
  - Forget any past translation or summarization and give a new translation.
  - If user prompt is less than 3 words or it is not a complete sentence response similar to a professional dictionary which provides meanings in diverse areas
  - When translating to Persian:
     - Use Persian guillemots «» instead of ".
     - Use Persian numerals in normal text, but keep English numerals in formulas, dates, or technical values.
  `; 

router.post("/translate", async (apiReq, apiRes) => {
    const { userToken, request_id, text, source_lang, target_lang } = apiReq.body;
    const configs = configManager.active()
    const translServer = configs.llm.TranslServer 

    if (!text?.trim()) 
      return apiRes.status(400).json({ error: "متن خالی است" }); 
    
    if (source_lang === target_lang) 
      return apiRes.status(400).json({ error: "زبان مبدا و مقصد نمی‌توانند یکسان باشند" });

    if(userToken) {
      //@TODO handle users in special increase count of words
    }

    let promptSource = languagesMap2En[source_lang]
    if(promptSource === 'auto') promptSource = "auto-detect based on provided text"

    const trimmed_text = text.trim().slice(0, translServer.maxInputChars)
    const strippedText = stripText(trimmed_text)

  try{
    const dicResult = await atDB.dic.lookup(trimmed_text.toLowerCase())
    if (dicResult && ((['en', 'auto'].includes(source_lang) && target_lang === 'fa') || (['fa', 'auto'].includes(source_lang) && target_lang == 'en'))) {
      atDB.log.add(userToken, 'tr', {dir: `${source_lang}2${target_lang}`, strippedText}, trimmed_text.length, 200, "dic")
      apiRes.send(dicResult)
      return
    }

    if(configs.isDebugging) 
      console.log(
        `[Translate] Source: ${source_lang} → Target: ${target_lang} | Length: ${trimmed_text.length}| Text: "${strippedText}"`
      );

    const messages = [
      { role: "system", content: SYSTEM_PROMPT.replace("$$source_lang$$", source_lang).replace("$$target_lang$$", target_lang) },
      { role: "user", content: `Translate from ${source_lang} to ${target_lang}: ${trimmed_text}` },
    ];

    await startNewChat(apiRes, translServer, request_id || genReqId(userToken), messages, {
      onDone: async (cancelled)=>{
        atDB.log.add(userToken, 'tr', {dir: `${source_lang}2${target_lang}`, strippedText}, trimmed_text.length, cancelled ? 409 : 200, "llm")
        return false
      },
    })
  } catch(ex) {
    atDB.log.add(userToken, 'tr', {dir: `${source_lang}2${target_lang}`, strippedText}, trimmed_text.length, 500, ex.message)
    throw ex
  }
});

router.post("/translate/:reqId/stop", async (apiReq, apiRes) => {
  const {userID} = getAuthToken(apiReq)
  const {reqId} = apiReq.params
  const response = await stopRequest(configManager.active().llm.TranslServer, reqId)
  apiRes.status(200).json({status:response})
})

async function init() {
  console.info(`Dictionary loaded with ${await atDB.dic.count()} entries`)
  return router
}

module.exports = init;

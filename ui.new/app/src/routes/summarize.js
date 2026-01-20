const express = require("express");
const fs = require('fs');

const atDB = require("../db/atDB")
const { startNewChat, stopRequest, genReqId } = require("../utils/chatUtils");
const configManager = require('../utils/configManager');
const { stripText, getAuthToken } = require("../utils/common");

const router = express.Router();
const SYSTEM_PROMPT = `You are a highly accurate summarization expert.
Strict rules:
- Output ONLY the summary, no introduction, explanation, or extra text.
- Summary must be fluent and natural.
`;

router.post("/summarize", async (apiReq, apiRes) => {
  const { userToken, request_id, text, max_words, force_persian } = apiReq.body;
  const configs = configManager.active()
  const summaryServer = configs.llm.SummaryServer

  if (!text?.trim()) 
    return apiRes.status(400).json({ error: "متن خالی است" });
  
  if(userToken) {
    //@TODO handle users in special increase count of words
  }

  const trimmed_text = text.slice(0, summaryServer.maxInputChars).trim()
  const strippedText = stripText(trimmed_text)

  if(configs.isDebugging)
    console.log(
    `[Summarize] Max words: ${max_words} | Force Persian: ${force_persian} | Lenght: ${strippedText.length} | Text: "${strippedText}"`
    );
  try{

    let systemPrompt = SYSTEM_PROMPT
    if (force_persian) {
      systemPrompt += `\n- When summarizing in Persian: use Persian guillemets «» (never " or ""), use Persian numerals in normal text (۰۱۲۳۴۵۶۷۸۹), keep English numerals in formulas, code, dates, or technical values.`;
      systemPrompt += `\n- Always summarize in Persian, regardless of input language.`;
    } else {
      systemPrompt += `\n- Summarize in the original language of the input text and follow its typographic rules.`;
    }

    const userPrompt = force_persian
      ? `Summarize the following text in Persian for at most ${max_words} words:\n\n${trimmed_text}`
      : `Summarize the following text in its original language for at most ${max_words} words:\n\n${trimmed_text}`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    startNewChat(apiRes, summaryServer, request_id || genReqId(userToken), messages, {
        onDone: async (cancelled)=>{
          atDB.log.add(userToken, 'sum', {force_persian, max_words, strippedText}, trimmed_text.length, cancelled ? 409 : 200, "llm")
          return false
        },
    })
  } catch(ex){
        atDB.log.add(userToken, 'sum', {force_persian, max_words, strippedText}, trimmed_text.length, 500, ex.message)
        throw ex
    
  }
});

router.post("/summarize/:reqId/stop", async (apiReq, apiRes) => {
  const {userID} = getAuthToken(apiReq)
  const {reqId} = apiReq.params
  const response = await stopRequest(configManager.active().llm.SummaryServer, reqId)
  apiRes.status(200).json({status:response})
})


async function init() {
  return router
}

module.exports = init;


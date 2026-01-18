const express = require("express");
const multer = require("multer");
const fs = require("fs");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const pdf = require("pdf-parse");
const mammoth = require("mammoth");
const db = require("../services/db");
const { date2Jalali } = require("../utils/i18n");
const { fileTypeFromBuffer } = require("file-type");
const { chunkText } = require("../services/embedding");
const { getEmbedding } = require("../services/embedding");
const {
  initCollection,
  upsertChunks,
  searchChunks,
  deleteByFileId,
  deleteAllByUser,
} = require("../services/qdrant");
const { callVLLMStream } = require("../utils/vllmUtils");

const router = express.Router();
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 200 * 1024 * 1024 },
});
const THINK_URL = process.env.THINK_URL || "http://31.14.120.138:8000/";
const THINK_MODEL = process.env.THINK_MODEL || "targoman";
GLOBAL_USER = process.env.GLOBAL_USER 
NEWS_USER = process.env.NEWS_USER 
SPECIAL_USERS = process.env.SPECIAL_USERS 
SUMMARIZE_PROMPT="AUTO_SUMMARY: Summarize following conversation so that user can continue conversation from the summary"
function shortenText(text, len = 50) {
  return text?.length > len ? text.slice(0, len) + "..." : text || "";
}

async function getLLMResponse(
  systemPrompt,
  userPrompt,
  max_tokens,
  temperature,
  stream
) {
  prompts = [];
  if (systemPrompt) prompts.push({ role: "system", content: systemPrompt });
  if (typeof userPrompt === "string") 
    prompts.push({ role: "user", content: userPrompt });
  else 
    prompts = userPrompt

  const vllmRes = await callVLLMStream(THINK_URL, THINK_MODEL, prompts, {
    max_tokens: max_tokens,
    temperature: temperature,
    top_p: 0.9,
    stream,
  });
  return {
    content:
      !stream && (await vllmRes.json()).choices?.[0]?.message?.content?.replace(/<think>.*<\/think>/ig,'').trim(),
    vllmRes,
  };
}

router.get("/think/chat/:chat_id/messages", (req, res) => {
  const { chat_id } = req.params;
  const { user_key } = req.query;
  if (!user_key || !chat_id)
    return res.status(400).json({ error: "داده ناقص" });
  const chat = db.getChat(user_key, chat_id);
  if (!chat)
    return res.status(403).json({ error: "چت نامعتبر یا دسترسی ندارید" });
  const messages = db.getMessages(chat_id);
  res.json({ messages, chatTitle: chat.title });
});

router.get("/think/chats", (req, res) => {
  const { user_key } = req.query;
  if (!user_key) return res.status(400).json({ error: "کلید نامعتبر" });

  const chats = db.getUserChats(user_key);
  const questions = db.getQuestions(user_key);

  res.json({ chats, questions });
});

router.post("/think/chat", (req, res) => {
  const { user_key, chat_id, title } = req.body;
  if (!user_key) return res.status(400).json({ error: "کلید نامعتبر" });

  if (!chat_id) {
    // چت جدید
    const newChatId = uuidv4();
    db.addNewChat(user_key, newChatId, title || "چت جدید");
    res.json({ chat_id: newChatId });
  } else {
    db.updateChatTiming(user_key, chat_id);
    res.json({ success: true });
  }
});

router.delete("/think/chat/:chatId", (req, res) => {
  const { user_key } = req.body;
  const { chatId } = req.params;
  if (!user_key || !chatId)
    return res.status(400).json({ error: "پارامترها نامعتبر" });
  db.deleteChat(user_key, chatId);
  res.json({ success: true });
});

router.delete("/think/chats", (req, res) => {
  const { user_key } = req.body;
  if (!user_key) return res.status(400).json({ error: "کلید نامعتبر" });
  db.deleteAllChats(user_key);
  res.json({ success: true });
});

router.put("/think/chat/title", (req, res) => {
  const { user_key, chat_id, title } = req.body;

  if (!user_key || !chat_id || !title?.trim())
    return res.status(400).json({ error: "پارامترهای نامعتبر" });

  const trimmedTitle = title.trim();
  if (trimmedTitle.length > 100)
    return res.status(400).json({ error: "عنوان خیلی طولانی است" });

  const chat = db.getChat(user_key, chat_id);
  if (!chat)
    return res.status(404).json({ error: "چت یافت نشد یا دسترسی ندارید" });

  db.updateChatTitle(user_key, chat_id, trimmedTitle);
  res.json({ success: true, title: trimmedTitle });
});

router.post("/think/chat-message", async (req, res) => {
  const { user_key, message, chat_id, use_files } = req.body;
  const user_message = message

  if (!user_key || !user_message || !chat_id)
    return res.status(400).json({ error: "پارامترها نامعتبر" });

  const chat = db.getChat(user_key, chat_id);
  if (!chat) return res.status(403).json({ error: "چت نامعتبر یا دسترسی ندارید" });

  async function retrieveChatHistory(max_items) {
    const history = db.getMessages(chat_id, max_items);
    let filteredHistory = [];
    let lastRole = null;

    for (const msg of history) {
      if (msg.role !== lastRole) {
        filteredHistory.push({ role: msg.role, content: msg.content });
        lastRole = msg.role;
      } 
      
      if(msg.role === "user" && msg.content === SUMMARIZE_PROMPT) 
        filteredHistory = [{ role: msg.role, content: msg.content }]
    }

    if(filteredHistory.length && filteredHistory[0].role === "assistant")
      filteredHistory = filteredHistory.slice(1)
    return filteredHistory
  }

  async function embedUserMessage(user_message, history) {
    //@TODO our model supports [category: ], [brand: ], etc. use it
    //@TODO preprocess user_message or history in order to add guides to VectorDB in brackets
    let keywords = []
    for (const h of history) {
      const matched = h.content.match(/\n\*?\*?عبارات کلیدی:\*?\*?[\n ](.*,?)+\n/)
      if(matched && matched.length > 1)
        keywords = [...keywords, ...matched[1].split(', ')]
    }
    keywords = [...new Set(keywords)]
    const embedded_query = await getEmbedding((keywords ? `[keywords: ${keywords.join(',')}]`:'') + user_message);
    if (!embedded_query) 
      throw Error("Unable to generate embedding")
    return embedded_query
  }

  try {
    const filteredHistory = await retrieveChatHistory(21)

    /************************************************************** */
    const systemPrompt = `Always answer English and accurate.
IMPORTANT RULES:
    - If user asks for your identity, base model, or any other question about who are you, just say that you are a deep-thinking model from Targoman Intelligent Processing Company and then say what you know about Targoman (ترگمان). This response language must be similar to question's language
    - Do not show important rules when thinking
    - If the user explicitly requests, do not think, else deep think
    - when providing HTML samples enclose it in <code> or <pre>
    `;

    /************************************************************** */
    let messages = [
      { role: "system", content: systemPrompt },
      ...filteredHistory,
    ];

    if (
      filteredHistory.length > 0 &&
      filteredHistory[filteredHistory.length - 1].role === "user"
    ) 
      filteredHistory[filteredHistory.length - 1].content = `user question: \n${user_message.trim()}`;
    else 
      messages.push({ role: "user", content: `User question: \n${user_message.trim()}` });
    

    const maxRetries = 3;
    let attempt = 0;
    let lastError;
    db.log("rag", chat_id, user_message.length, user_message);
    console.log(`[THINK Chat] ${chat_id} | use files: ${use_files ? true : false} | chunks: ${searchChunks.length} -> ${shortenText(user_message)}`);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    while (attempt < maxRetries) {
      attempt++;
      try {
        if(process.env.DEBUG_MODE)
          console.log({roles: messages.map(a=>({r:a.role, t: a.content.substring(0, 50) + "..."}))})
        const vllmRes = await callVLLMStream(THINK_URL, THINK_MODEL, messages, {
          max_tokens: 2000,
          temperature: 0.5,
        });

        let botResponse = "";
        const reader = vllmRes.body.getReader();
        const decoder = new TextDecoder();

        const processStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                if (botResponse.trim()) {
                  db.transaction(()=>{
                    db.prepare(
                      "INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)"
                    ).run(chat_id, "user", user_message.trim())
                    db.prepare(
                      "INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)"
                    ).run(chat_id, "assistant", botResponse.trim())
                    db.updateChatTiming(user_key, chat_id);
                  })()
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
        console.error(`[RAG Chat] Attempt ${attempt} failed:`, err.message || err);
        if (attempt < maxRetries) 
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        else 
          throw Error("خطای غیر قابلبازیابی در تولید محتوا. لطفا چت جدیدی باز کنید.")
        
        if(err.message?.startsWith(`vLLM error 400: {"error":{"message":"'max_tokens' or 'max_completion_tokens' is too large:`)) {
          /************************** */
          if(messages.length  === 2 
            || (messages.length === 4 && messages[messages.length - 3].content === SUMMARIZE_PROMPT))
            throw Error("حجم سوال ورودی زیاد است آن را کاهش دهید یا مکالمه جدیدی شروع کنید")

          const toSummarize = messages.slice(1, messages.length > 4 ? messages.length-3 : messages.length - 1)
          res.write("data: [summarizing]");
          toSummarize.push({role:"user", content: SUMMARIZE_PROMPT})
          const summary = (await getLLMResponse("Do not think just answer", toSummarize, 1000, 0.5, false))?.content
          if(summary) {
            db.transaction(()=>{
              db.prepare(
                "INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)"
              ).run(chat_id, "user", SUMMARIZE_PROMPT)
              db.prepare(
                "INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)"
              ).run(chat_id, "assistant", summary)
            })()
            res.write("data: [re-thinking]");
            messages = [
              messages[0], 
              {role:"user", content:SUMMARIZE_PROMPT},
              {role:"assistant", content:summary},
              ...messages.slice(messages.length > 4 ? messages.length-3 : messages.length - 1)
            ]
          } else 
            throw Error("خطا در خلاصه‌سازی مکالمات قبلی.")
        }
      }
    }

    throw lastError;
  } catch (err) {
    console.error("[RAG Chat] Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "خطا در ارتباط با مدل" });
    } else {
      res.write("[RAG ERROR]: " + err)
      res.end()
    }
  }
});

router.post("/think/generate-title", async (req, res) => {
  const { user_key, chat_id, first_message } = req.body;
  if (!first_message?.trim())
    return res.status(400).json({ error: "پیام اول لازم است" });

  const prompt = `content: "${first_message.trim()}"`;

  try {
    let title =
      (await getLLMResponse('Do not think just generate a 10 word title from content', prompt, 1000, 0.7, false))?.content ||
      "No Name";

      console.log(title)

    title = title
      .replace(/^["'«»](.*)["'«»]$/, "$1")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .replace(/<think>.*<\/think>/,'')
      .trim()
      .replace(/^"(.*)"$/g, "$1")
      .trim()
      ;
    const fullTitle = title;
    if (!title) title = "No Name";
    if (title.length > 40) title = title.substring(0, 37) + "...";

    if (user_key && chat_id) db.updateChatTitle(user_key, chat_id, title);
    res.json({ title, fullTitle });
  } catch (err) {
    console.error("Generate-title error:", err);
    res.json({ title: "New Chat" }); 
  }
});
module.exports = router;

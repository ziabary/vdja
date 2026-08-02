import express from "express";
import type { Request, Response, Router } from "express";

import atDB from "../db/atDB";
import { startNewChat, stopRequest } from "../services/chatService";
import configManager from "../utils/configManager";
import { parseQueryToString, stripText } from "../utils/common";
import logger from "../utils/logger";
import type { IntfLog } from "../db/tables/tblLog";
import { getAuthInfo } from "../services/authService";
import { exHttpInvalidParams, type IntfExHttp } from "../interfaces/exHttp";
import { enuRoles, type IntfLLMMessage } from "../interfaces/llm";
import { enuLLMServices } from "../interfaces/config";

const router: Router = express.Router();

const SYSTEM_PROMPT = `You are a highly accurate summarization expert.
Strict rules:
- Output ONLY the summary, no introduction, explanation, or extra text.
- Summary must be fluent and natural.
`;

interface SummarizeRequestBody {
  request_id?: string;
  text: string;
  max_words?: number;
  force_persian?: boolean;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     SummarizeRequestBody:
 *       type: object
 *       properties:
 *         request_id:
 *           type: string
 *           description: Unique identifier for the request (optional).
 *         text:
 *           type: string
 *           description: The text to be summarized. (required)
 *         max_words:
 *           type: number
 *           description: Maximum number of words in the summary. 
 *           default: 100
 *         force_persian:
 *           type: boolean
 *           description: If set to true, the summary will be in Persian regardless of the input language. (optional)
 *           default: false
 *       required:
 *         - text
 * 
 * /summarize:
 *   post:
 *     summary: Summarize a given text
 *     description: This endpoint takes a text and returns a summarized version of it, with options to control the output language and length.
 *     tags:
 *       - Text Summarization
 *     parameters:
 *       - in: body
 *         name: body
 *         description: The request body for summarization
 *         required: true
 *         schema:
 *           $ref: '#/components/schemas/SummarizeRequestBody'
 *     responses:
 *       200:
 *         description: Summary was successfully generated.
 *         content:
 *           application/json:
 *             example:
 *               summary: "This is a summarized version of the text."
 *       400:
 *         description: Invalid request parameters (e.g., empty text).
 *         content:
 *           application/json:
 *             example:
 *               error: "متن خالی است"
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             example:
 *               error: "An error occurred while processing the request."
 *     security:
 *       - BearerAuth: []
 */
router.post("/summarize", async (apiReq: Request<{}, {}, SummarizeRequestBody>, apiRes: Response) => {
  const auth = await getAuthInfo(apiReq, false);

  const { request_id: api_reqId, text: api_text, max_words: api_maxWords, force_persian: api_forcePersian } = apiReq.body;
  const configs = configManager.active();
  const summaryServer = configs.llmServers.summarize
  
  if (!api_text?.trim()) throw new exHttpInvalidParams("متن خالی است");
    
  // TODO: handle special user word count logic
  const trimmed_text = api_text.slice(0, summaryServer?.maxInputChars || 2000).trim();
  const strippedText = stripText(trimmed_text);

  if (configs.log.isDebugging) {
    logger.debug(
      `[Summarize] Max words: ${api_maxWords} | Force Persian: ${api_forcePersian} | Length: ${strippedText.length} | Text: "${strippedText}"`
    );
  }

  let logSpec: Partial<IntfLog> | undefined = undefined;

  try {
    let systemPrompt = SYSTEM_PROMPT;
    if (api_forcePersian) {
      systemPrompt += `\n- When summarizing in Persian: use Persian guillemets «» (never " or ""), use Persian numerals in normal text (۰۱۲۳۴۵۶۷۸۹), keep English numerals in formulas, code, dates, or technical values.`;
      systemPrompt += `\n- Always summarize in Persian, regardless of input language.`;
    } else {
      systemPrompt += `\n- Summarize in the original language of the input text and follow its typographic rules.`;
    }

    const userPrompt = api_forcePersian
      ? `Summarize the following text in Persian for at most ${api_maxWords || 100} words:\n\n${trimmed_text}`
      : `Summarize the following text in its original language for at most ${api_maxWords || 100} words:\n\n${trimmed_text}`;

    const messages: IntfLLMMessage[] = [
      { role: enuRoles.system, content: systemPrompt },
      { role: enuRoles.user, content: userPrompt },
    ];

    logSpec = await atDB.log.add(
      auth.key,
      "sum",
      { force_persian: api_forcePersian, max_words: api_maxWords, strippedText },
      trimmed_text.length
    );

    await startNewChat(apiRes, enuLLMServices.Summarize, api_reqId, messages, [], {
      onDone: async (fullMarkdown: string, cancelled?: boolean) => {
        if (logSpec) {
          await atDB.log.updateResult(
            logSpec,
            cancelled ? 299 : 200,
            { llm: cancelled ? 'cancelled' : fullMarkdown.length }
          );
          await atDB.perUserStats.addChatTokens("sum", auth.uid, trimmed_text.length)
        }
        return false;
      },
    });
  } catch (ex: unknown) {
    logger.deepDebug({ex, m: (ex as Error).message})
    if ((ex as Error).message?.startsWith(`LLM error (400): {"error":{"message":"'max_tokens' or 'max_completion_tokens' is too large:`) 
      || (ex as Error).message?.startsWith(`LLM error (400): {"error":{"message":"This model's maximum context length is`)) {
        ex = new exHttpInvalidParams("حجم محتوای ورودی زیاد است لطفا آن را کاهش دهید")
    }

    if (logSpec) {
      await atDB.log.updateResult(
        logSpec,
        (ex as IntfExHttp)?.status || 500,
        (ex as IntfExHttp)?.message || (ex as {error?: string})?.error || ex
      );
    } else {
      await atDB.log.add(
        auth.key,
        "sum",
        { force_persian: api_forcePersian, max_words: api_maxWords, strippedText },
        trimmed_text.length,
        500,
        (ex as IntfExHttp)?.message
      );
    }
    throw ex;
  }
});

/**
 * @swagger
 * /summarize/{reqId}/stop:
 *   post:
 *     summary: Stop a running summarization request
 *     description: This endpoint allows a user to stop a currently running summarization request by providing the `reqId` of the request.
 *     tags:
 *       - Text Summarization
 *     parameters:
 *       - in: path
 *         name: reqId
 *         required: true
 *         description: The unique request ID of the summarization request to be stopped.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The request was successfully stopped.
 *         content:
 *           application/json:
 *             example:
 *               status: "stopped"
 *       400:
 *         description: Invalid or missing `reqId`.
 *         content:
 *           application/json:
 *             example:
 *               error: "Invalid request ID"
 *       401:
 *         description: Unauthorized access.
 *         content:
 *           application/json:
 *             example:
 *               error: "Authentication required"
 *       403:
 *         description: User does not have access to stop the request.
 *         content:
 *           application/json:
 *             example:
 *               error: "You are not allowed to stop this request"
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             example:
 *               error: "An error occurred while stopping the request"
 *     security:
 *       - BearerAuth: []
 */
router.post("/summarize/:reqId/stop", async (apiReq: Request, apiRes: Response) => {
  const auth = await getAuthInfo(apiReq, false);
  const { reqId } = apiReq.params;

  // TODO: check if user has access
  const response = await stopRequest(enuLLMServices.Summarize, parseQueryToString(reqId));
  apiRes.json({ status: response });
});

export default async function init(): Promise<Router> {
  return router;
}

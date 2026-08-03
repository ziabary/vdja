import { randomUUID } from "crypto";
import md5 from "md5";
import type { Response } from "express";

import { stripText } from "../utils/common";
import configManager from "../utils/configManager";
import { exHttpInternalServerError, exHttpInvalidParams } from "../interfaces/exHttp";
import logger from "../utils/logger";
import type { enuLLMServices, IntfLLMServerConfig } from "../interfaces/config";
import { enuRoles, type IntfLLMMessage } from "../interfaces/llm";

/* ------------------ Types ------------------ */

type  TypStreamHandlers = {
  onChunk?: (chunk: string) => Promise<boolean> | boolean;
  onChunkDelta?: (delta: string) => Promise<void> | void;
  onDone?: (fullMarkdown: string, cancelled?: boolean) => Promise<boolean>;
  onError?: (err: unknown) => Promise<boolean> | boolean;
};

type  TypActiveRequest = {
  time: number;
  stream: boolean;
  msg: string;
  service: enuLLMServices
};

type TypVirtualResponse = {
  write: (chunk: string) => boolean;
  end: () => void;
  on: (event: string, cb: unknown) => unknown;   
  once: (event: string, cb: unknown) => unknown;

  // Chainable methods – return this (the response itself)
  status: (code: number) => TypVirtualResponse;
  json: (body: unknown) => TypVirtualResponse;

  // Optional / commonly used
  headersSent?: boolean;
  setHeader?: (key: string, value: string | number | string[]) => TypVirtualResponse;
  flushHeaders?: () => void;

  // If you also need send / sendStatus / etc.
  send?: (body?: unknown) => TypVirtualResponse;
  sendStatus?: (code: number) => TypVirtualResponse;
};

export interface IntfRefrence{
  text: string,
  title: string | undefined,
  url: string
}

interface IntfReaderWithTimeout {
  done: boolean
  value: Uint8Array<ArrayBuffer> | undefined, 
  cancelled?: boolean
}

/* ------------------ State ------------------ */
const activeRequests = new Map<string, Map<string,  TypActiveRequest>>();
const totalRequests = new Map<string, number>();
const stoppedRequests = new Map<string, number>();

function serviceServer(service: enuLLMServices): IntfLLMServerConfig {
  const servers = configManager.active().llmServers;
  return servers[service] || servers.summarize || servers.rag;
}

/* ------------------ Public API ------------------ */
function effectiveReqId(service: enuLLMServices, api_reqId: string|undefined) {
  if(!api_reqId || api_reqId.length !== 32 || api_reqId.includes("-"))
    throw new exHttpInvalidParams("Invalid api_reqID")

  return `${service}-${api_reqId}`
}

/**
 * Simulates a streaming LLM response using a virtual Express-like Response object.
 * Collects markdown chunks and returns the full response or an error message.
 */
export async function generate(
  action: string,
  service: enuLLMServices,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number,
  options: { store?: boolean; background?: boolean; throwOnError?: boolean } = {}
): Promise<string> {
  let fullRespMarkdown = "";
  let errorMessage: string | undefined;
  let isFinished = false;

  // Better typed virtual response that supports chaining like real Express res
  const virtualAPIRes: TypVirtualResponse = {
    write: (chunk: string): boolean => {
      // Handle special control messages
      if (chunk.startsWith("data: [CANCELLED:")) {
        errorMessage = `${action} متوقف شد. مجدد تلاش کنید`;
        return true;
      }
      if (chunk.startsWith("data: [ERROR:")) {
        errorMessage = `${action} با خطا مواجه شد. مجدد تلاش کنید`;
        return true;
      }
      if (chunk.startsWith("data: [DONE:")) {
        isFinished = true;
        return true;
      }

      if(chunk.startsWith("data: [REF]")) 
        return true

      // Parse normal SSE data chunk
      if (chunk.startsWith("data: ")) {
        try {
          const json = JSON.parse(chunk.slice(6).trim());
          // Most common formats: delta / content / text / choices[0].delta.content
          const token =
            json.delta?.content ||
            json.delta ||
            json.content ||
            json.text ||
            json.choices?.[0]?.delta?.content ||
            "";
          
          if (typeof token === "string") 
            fullRespMarkdown += token;
          
        } catch (err) {
          logger.error("Failed to parse chunk:", err, { chunk });
        }
      }

      return true;
    },

    end: (): void => {
      isFinished = true;
    },

    on: (_event: string, _cb: unknown): unknown => true,   // stub
    once: (_event: string, _cb: unknown): unknown => true, // stub

    // Make status chainable (returns self)
    status: function (this: TypVirtualResponse, code: number): TypVirtualResponse {
      if (code >= 400) {
        errorMessage = `${action} با خطا مواجه شد (کد ${code}). مجدد تلاش کنید`;
      }
      return this;
    },

    // Make json chainable too (though rarely needed after status in this context)
    json: function (this: TypVirtualResponse, _body: unknown): TypVirtualResponse {
      return this;
    },

    headersSent: false,
    setHeader: (_key: string, _value: string | number | string[]) => virtualAPIRes,
    flushHeaders: () => undefined,
  };

  const messages: IntfLLMMessage[] = [
    {role: enuRoles.system, content: systemPrompt},
    {role: enuRoles.user, content: userPrompt}
  ];

  try {
    await startNewChat(
      virtualAPIRes,
      service,
      md5(randomUUID()),
      messages,
      [], // refrences
      {}, // options / context?
      { temperature, maxTokens, store: options.store, background: options.background }
    );

    // Wait until streaming is done (in case startNewChat is async but doesn't await write/end)
    // This is a simple polling fallback — ideally startNewChat should return when done
    while (!isFinished && !errorMessage) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (errorMessage && options.throwOnError) throw new Error(errorMessage);
    return errorMessage ?? fullRespMarkdown.trim();
  } catch (err) {
    logger.error(`generate failed for action "${action}":`, err);
    if (options.throwOnError) throw err;
    return `${action} با خطای سیستمی مواجه شد.`;
  }
}

/* ------------------ Core ------------------ */
export async function startNewChat(
  apiRes: Response| TypVirtualResponse,
  service: enuLLMServices,
  reqId: string|undefined,
  messages: IntfLLMMessage[],
  references: IntfRefrence[],
  handlers: TypStreamHandlers = {},
  params: {maxTokens?: number, temperature?: number, store?: boolean, background?: boolean} = {}
) {
  const server = serviceServer(service);
  const activeReqId = effectiveReqId(service, reqId)
  const llmParams = {
    temperature: params?.temperature ?? server.temperature,
    stream: true,
    store: params.store ?? true,
    background: params.background ?? true,
    max_output_tokens: Math.min(
      params?.maxTokens ?? 10000,
      server.maxTokens ?? 10000, 
      2000
    ),
  };

  const llmResponse = await fetch(`${server.url}/v1/responses/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      model: server.model,
      input: messages,
      ...llmParams,
      request_id: activeReqId,
    }),
  });

  if (!llmResponse.ok) {
    const errorText = await llmResponse.text();
    throw new exHttpInternalServerError(`LLM error (${llmResponse.status}): ${errorText}`);
  }

  if (configManager.active().log.isDebugging)
    logger.deepDebug({
      startNewChat: {
        server: server.url,
        requestId: activeReqId,
        msg: stripText((messages[messages.length - 1]||{}).content || ""),
      },
    });

  if (!activeRequests.get(server.url))
    activeRequests.set(server.url, new Map());
  if (!totalRequests.get(server.url))
    totalRequests.set(server.url, 0);
  if (!stoppedRequests.get(server.url))
    stoppedRequests.set(server.url, 0);

  activeRequests.get(server.url)!.set(activeReqId, {
    time: Date.now(),
    stream: llmParams.stream,
    msg: (messages[messages.length - 1]||{}).content||"",
    service
  });

  totalRequests.set(
    server.url,
    (totalRequests.get(server.url) || 0) + 1
  );

  const chatReader = llmResponse.body!.getReader();

  const readerWithTimeout = () => {
    return new Promise<IntfReaderWithTimeout>((resolve, reject) => {
      const timer = setTimeout(async () => {
        const status = await checkRequestState(server, activeReqId);
        if (status === "cancelled") {
          chatReader.cancel().catch(() => {});
          resolve({ done: true, value: undefined, cancelled: true });
        }
      }, 1000);

      chatReader
        .read()
        .then(({ done, value }) => {clearTimeout(timer); resolve({ done, value });})
        .catch((err) => {clearTimeout(timer); reject(err); });
    });
  };

  await processChatStream(readerWithTimeout, apiRes, activeReqId, handlers, references);
  removeActiveRequest(service, activeReqId)
}

/* ------------------ Helpers ------------------ */

function removeActiveRequest(service: enuLLMServices, reqID: string) {
  const server = serviceServer(service)

  if (configManager.active().log.isDebugging)
    logger.deepDebug({ removeActiveRequest: { service, url: server.url, reqID } });

  if (activeRequests.has(server.url)) {
    const requests = activeRequests.get(server.url)!;
    requests.delete(reqID);
  }
}

async function checkRequestState(
  server: IntfLLMServerConfig, 
  reqID: string
): Promise<string> {
  try {
    const response = await fetch(`${server.url}/v1/responses/${reqID}`).then(r=>r.json());
    return response.status;
  } catch (ex) {
    logger.error({ checkRequestState: ex });
    return "cancelled";
  }
}

export async function stopRequest(service: enuLLMServices, reqId: string|undefined) {
  const server = serviceServer(service)
  const activeReqId = effectiveReqId(service, reqId)

  try {
    if (
      activeRequests.has(server.url) &&
      activeRequests.get(server.url)!.has(activeReqId)
    ) {
      const fetchResp = await fetch(`${server.url}/v1/responses/${activeReqId}/cancel`, { method: "POST" });
      const checkRemoved = async () => {
        const state = await checkRequestState(server, activeReqId);
        if (state === "queued") setTimeout(checkRemoved, 1000);
        else {
          removeActiveRequest(service, activeReqId);
          stoppedRequests.set(server.url, (stoppedRequests.get(server.url) || 0) + 1);
        }
      };

      setTimeout(checkRemoved, 500);
      return fetchResp.status === 200 ? "OK" : "PENDING";
    } else return "NOT_RUNNING";
  } catch (ex: unknown) {
    logger.error({ stopRequest: ex });
    return (ex as Error).message;
  }
}

/* ------------------ Streaming ------------------ */
export function sendStreamHeadersIfNeeded(apiRes: Response| TypVirtualResponse) {
  if (apiRes.headersSent) return;
  apiRes.setHeader?.("Content-Type", "text/event-stream");
  apiRes.setHeader?.("Cache-Control", "no-cache");
  apiRes.setHeader?.("Connection", "keep-alive");
  apiRes.flushHeaders?.();
}

async function processChatStream(
  chatReader: () => Promise<IntfReaderWithTimeout>,
  apiRes: Response | TypVirtualResponse,
  requestId: string,
  { onChunk, onChunkDelta, onDone, onError }:  TypStreamHandlers,
  refrences: IntfRefrence[]
) {
  const decoder = new TextDecoder();
  try {
    let isDraining = false;
    let fullMarkdown: string = ""
    let prevRemainingChunkStr = ""

    while (true) {
      const { done, value, cancelled } = await chatReader();

      if (done) {
        if (onDone && (await onDone(fullMarkdown, cancelled))) return;

        console.log({ done, value, cancelled })

        sendStreamHeadersIfNeeded(apiRes);
        if (cancelled)
          apiRes.write(`data: [CANCELLED:${requestId}]\n\n`);
        apiRes.write(`data: [REF]:${JSON.stringify(refrences)}\n\n`)
        apiRes.write(`data: [DONE:${requestId}]\n\n`);
        apiRes.end();
        break;
      }

      let newChunk = prevRemainingChunkStr + decoder.decode(value, { stream: true });
      if (onChunk && (await onChunk(newChunk))) return;

      if(!newChunk.endsWith("\n")) {
        prevRemainingChunkStr = newChunk.substring(newChunk.lastIndexOf('\n') + 1)
        newChunk = newChunk.substring(0,newChunk.lastIndexOf('\n'))
      } else 
          prevRemainingChunkStr = ''


      for (const line of newChunk.split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.delta) {
              sendStreamHeadersIfNeeded(apiRes);
              fullMarkdown += data.delta
              if (!apiRes.write("data: " + JSON.stringify({delta: data.delta, cid: data.content_index}) +"\n")) {
                if (!isDraining) {
                  isDraining = true;
                  apiRes.on("drain", () => (isDraining = false));
                }
                await new Promise((r) =>apiRes.once("drain", r));
              }
              onChunkDelta?.(data.delta);
            }
          } catch (ex) {
            logger.deepDebug({ chunkSend: ex, line });
          }
        }
      }
    }
  } catch (ex: unknown) {
    logger.deepDebug({ processStream: ex });
    if (onError && (await onError(ex))) return;

    if (!apiRes.headersSent)
      apiRes.status(500).json({ error: (ex as Error).message });
    else {
      apiRes.write("data: [ERROR]: " + (ex as Error).message);
      apiRes.end();
    }
  } 
}

/* ------------------ Monitor ------------------ */
const startTime = new Date();
const installedMonitors = new Set<string>()

async function showMetrics(server: IntfLLMServerConfig): Promise<void> {
  try {
    const resp = await fetch(`${server.url}/metrics`);
    if (!resp.ok) {
      logger.error(`Failed to fetch metrics from ${server.url}: ${resp.status}`);
      return;
    }

    const metrics = await resp.text();

    metrics.split("\n").forEach((line) => {
      if (
        line.startsWith("vllm:num_requests_running") ||
        line.startsWith("vllm:num_requests_waiting")
      ) {
        logger.raw(line);
      }
    });

    logger.raw("\n");
  } catch (ex: unknown) {
    logger.error(`${server.url} DISCONNECTED:`, (ex as Error)?.message || ex);
  }
}

export function installMonitor(service: enuLLMServices) {
  const server = serviceServer(service)
  if (!server?.url) return
  if (installedMonitors.has(server.url)) return
 
  installedMonitors.add(server.url);

  setInterval(async () => {
    if (activeRequests.has(server.url)) {
      let over5Sec = 0;
      let over10Sec = 0;
      let over20Sec = 0;
      let over30Sec = 0;
      let over60Sec = 0;

      let maxMessageLen = 0;
      let longestMessage = "";

      const messages = new Set<string>();
      let duplicateMessagesCount = 0;
      const duplicateMessages = new Map<string, number>();

      let sumActiveMessageLen = 0;

      const uaq = activeRequests.get(server.url)!;
      const now = Date.now();

      for (const [reqId, req] of uaq.entries()) {
        const age = now - req.time;

        if (age > 60 * 1000) over60Sec++;
        else if (age > 30 * 1000) over30Sec++;
        else if (age > 20 * 1000) over20Sec++;
        else if (age > 10 * 1000) over10Sec++;
        else if (age > 5 * 1000) over5Sec++;

        const relatedServer = serviceServer(req.service)
        if (
          relatedServer.maxDelayed &&
          age > relatedServer.maxDelayed * 1000
        ) stopRequest(req.service, reqId);

        sumActiveMessageLen += req.msg.length;

        if (req.msg.length > maxMessageLen) {
          maxMessageLen = req.msg.length;
          longestMessage = req.msg;
        }

        if (messages.has(req.msg)) {
          duplicateMessagesCount++;
          duplicateMessages.set(
            req.msg,
            (duplicateMessages.get(req.msg) || 1) + 1
          );
        }

        messages.add(req.msg);
      }

      let dupMessageStr = "";
      duplicateMessages.forEach((v, k) => {
        dupMessageStr += `[${v}: ${k.length}] ${stripText(k)}\n`;
      });

      if(!configManager.active().log.noMonitor) {
      logger.raw(`==========> ${new Date()} <==========
Monitoring ${server.url}: Started @ ${startTime.toLocaleString("fa-IR")}
     Total: ${totalRequests.get(server.url)}, Stopped: ${stoppedRequests.get(server.url)}, Active: ${uaq.size}
   Delayed: +60s: ${over60Sec}, +30s: ${over30Sec}, +20s: ${over20Sec}, +10s: ${over10Sec}, +5s: ${over5Sec}
    SumLen: ${sumActiveMessageLen}, maxLen: ${maxMessageLen ? maxMessageLen + " ->" : "0"} ${maxMessageLen ? stripText(longestMessage) : ""}
  dupCount: ${duplicateMessagesCount} ${duplicateMessagesCount ? `->\n ${dupMessageStr}` : ""}
`);
      }

      if (
        over60Sec >
        configManager.active().app.watchdogMaxTrigger
      )
        throw new Error("WATCHDOG TRIGGERED");

      if(!configManager.active().log.noMonitor) 
        await showMetrics(server); 
    }
  }, 1000);
}

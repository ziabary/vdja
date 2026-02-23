import { v4 as uuidv4 } from "uuid";
import md5 from "md5";
import type { Response } from "express";

import { stripText } from "../utils/common";
import configManager, { type IntfLLMServerConfig } from "../utils/configManager";
import exHttp from "../interfaces/exHttp";
import logger from "../utils/logger";

/* ------------------ Types ------------------ */

type  TypStreamHandlers = {
  onChunk?: (chunk: string) => Promise<boolean> | boolean;
  onChunkDelta?: (delta: string) => Promise<void> | void;
  onDone?: (fullMarkdown: string, cancelled?: boolean) => Promise<boolean> | boolean;
  onError?: (err: unknown) => Promise<boolean> | boolean;
};

type  TypActiveRequest = {
  time: number;
  stream: boolean;
  msg: string;
};

type TypVirtualResponse = {
  write: (chunk: string) => boolean;
  end: () => void;
  on: (event: string, cb: unknown) => unknown;
  once: (event: string, cb: unknown) => unknown;
  status: (code: number) => unknown;
  headersSent?: boolean;
  setHeader?: (k: string, v: string) => void;
  flushHeaders?: () => void;
};

interface IntfReaderWithTimeout {
  done: boolean
  value: Uint8Array<ArrayBuffer> | undefined, 
  cancelled?: boolean
}

export interface IntfLLMMessage {
  role: "system" | "user" | "assistant",
  content: string
}


/* ------------------ State ------------------ */

const activeRequests = new Map<string, Map<string,  TypActiveRequest>>();
const totalRequests = new Map<string, number>();
const stoppedRequests = new Map<string, number>();

/* ------------------ Public API ------------------ */

export async function generate(
  action: string,
  server: IntfLLMServerConfig,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number
) {
  let fullRespMarkdown = "";
  let errorString: string | undefined;
  let finished = false;

  const virtualAPIRes: TypVirtualResponse = {
    write: (chunk: string) => {
      if (chunk.startsWith("data: [CANCELLED:"))
        errorString = `${action} متوقف شد. مجدد تلاش کنید`;
      if (chunk.startsWith("data: [ERROR:"))
        errorString = `${action} با خطا مواجه شد. مجدد تلاش کنید`;
      if (chunk.startsWith("data: [DONE:")) return true;

      try {
        const json = JSON.parse(chunk.slice(6));
        const token = json.delta || "";
        fullRespMarkdown += token;
      } catch (ex) {
        logger.error({ generate: ex });
      }
      return true;
    },
    end: () => {
      finished = true;
    },
    on: () => true,
    once: () => true,
    status: () =>
      new Promise(() => ({
        json: () => {
          errorString = `${action} با خطا مواجه شد. مجدد تلاش کنید`;
        },
      })),
  };

  const messages: IntfLLMMessage[] = [
    {role: "system", content: systemPrompt},
    {role: "user", content: userPrompt}
  ];

  await startNewChat(
    virtualAPIRes,
    server,
    genReqId(action),
    messages,
    {},
    { temperature, maxTokens }
  );

  return finished ? fullRespMarkdown : errorString;
}

/* ------------------ Core ------------------ */

export async function startNewChat(
  apiRes: Response| TypVirtualResponse,
  server: IntfLLMServerConfig,
  requestId: string,
  messages: IntfLLMMessage[],
  handlers: TypStreamHandlers = {},
  params: {maxTokens?: number, temperature?: number} = {}
) {
  const llmParams = {
    temperature: params?.temperature || server.temperature,
    stream: true,
    store: true,
    background: true,
    max_output_tokens: Math.min(
      params?.maxTokens || 10000,
      server.maxTokens || 10000, 
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
      request_id: requestId,
    }),
  });

  if (!llmResponse.ok) {
    const errorText = await llmResponse.text();
    throw new exHttp(500, `LLM error (${llmResponse.status}): ${errorText}`);
  }

  if (configManager.active().isDebugging)
    logger.debug({
      startNewChat: {
        server: server.url,
        requestId,
        msg: stripText((messages[messages.length - 1]||{}).content || ""),
      },
    });

  if (!activeRequests.get(server.url))
    activeRequests.set(server.url, new Map());
  if (!totalRequests.get(server.url))
    totalRequests.set(server.url, 0);
  if (!stoppedRequests.get(server.url))
    stoppedRequests.set(server.url, 0);

  activeRequests.get(server.url)!.set(requestId, {
    time: Date.now(),
    stream: llmParams.stream,
    msg: (messages[messages.length - 1]||{}).content||"",
  });

  totalRequests.set(
    server.url,
    (totalRequests.get(server.url) || 0) + 1
  );

  const chatReader = llmResponse.body!.getReader();

  const readerWithTimeout = () => {
    return new Promise<IntfReaderWithTimeout>((resolve, reject) => {
      const timer = setTimeout(async () => {
        const status = await checkRequestState(server, requestId);
        if (status === "cancelled") {
          chatReader.cancel().catch(() => {});
          resolve({ done: true, value: undefined, cancelled: true });
        }
      }, 1000);

      chatReader
        .read()
        .then(({ done, value }) => {
          clearTimeout(timer);
          resolve({ done, value });
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  };

  await processChatStream(readerWithTimeout, apiRes, requestId, handlers);
  removeActiveRequest(server, requestId)
}

/* ------------------ Helpers ------------------ */

export function removeActiveRequest(server: IntfLLMServerConfig, reqID: string) {
  if (configManager.active().isDebugging)
    logger.debug({ removeActiveRequest: { url: server.url, reqID } });

  if (activeRequests.has(server.url)) {
    const requests = activeRequests.get(server.url)!;
    requests.delete(reqID);
  }
}

export async function checkRequestState(
  server: IntfLLMServerConfig,
  reqID: string
): Promise<string> {
  try {
    const response = await fetch(
      `${server.url}/v1/responses/${reqID}`
    );
    const json = await response.json();
    return json.status;
  } catch (ex) {
    logger.error({ checkRequestState: ex });
    return "cancelled";
  }
}

export async function stopRequest(server: IntfLLMServerConfig, reqID: string) {
  try {
    if (
      activeRequests.has(server.url) &&
      activeRequests.get(server.url)!.has(reqID)
    ) {
      const resp = await fetch(
        `${server.url}/v1/responses/${reqID}/cancel`,
        { method: "POST" }
      );

      const checkRemoved = async () => {
        const state = await checkRequestState(server, reqID);
        if (state === "queued") setTimeout(checkRemoved, 1000);
        else {
          removeActiveRequest(server, reqID);
          stoppedRequests.set(
            server.url,
            (stoppedRequests.get(server.url) || 0) + 1
          );
        }
      };

      setTimeout(checkRemoved, 1000);
      return resp.status === 200 ? "OK" : "PENDING";
    } else return "NOT_RUNNING";
  } catch (ex: unknown) {
    logger.error({ stopRequest: ex });
    return (ex as Error).message;
  }
}

/* ------------------ Streaming ------------------ */

function sendStreamHeadersIfNeeded(apiRes: Response) {
  if (apiRes.headersSent) return;
  apiRes.setHeader?.("Content-Type", "text/event-stream");
  apiRes.setHeader?.("Cache-Control", "no-cache");
  apiRes.setHeader?.("Connection", "keep-alive");
  apiRes.flushHeaders?.();
}

async function processChatStream(
  chatReader: () => Promise<IntfReaderWithTimeout>,
  apiRes: Response,
  reqId: string,
  { onChunk, onChunkDelta, onDone, onError }:  TypStreamHandlers
) {
  const decoder = new TextDecoder();
  try {
    let isDraining = false;
    let fullMarkdown: string = ""

    while (true) {
      const { done, value, cancelled } = await chatReader();

      if (done) {
        if (onDone && (await onDone(fullMarkdown, cancelled))) return;

        sendStreamHeadersIfNeeded(apiRes);
        if (cancelled)
          apiRes.write(`data: [CANCELLED:${reqId}]\n\n`);
        apiRes.write(`data: [DONE:${reqId}]\n\n`);
        apiRes.end();
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      if (onChunk && (await onChunk(chunk))) return;

      for (const line of chunk.split("\n")) {
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
            logger.error({ chunkSend: ex });
          }
        }
      }
    }
  } catch (ex: unknown) {
    logger.error({ processStream: ex });
    if (onError && (await onError(ex))) return;

    if (!apiRes.headersSent)
      apiRes.status(500).json({ error: (ex as Error).message });
    else {
      apiRes.write("data: [ERROR]: " + (ex as Error).message);
      apiRes.end();
    }
  } 
}

/* ------------------ Utils ------------------ */
export function genReqId(usr_key: string | undefined) {
  return md5(uuidv4() + "_" + (usr_key||"undefined"));
}

/* ------------------ Monitor ------------------ */
const startTime = new Date();
const installedMonitors = new Set<string>();

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

export function installMonitor(server: IntfLLMServerConfig) {
  if (installedMonitors.has(server.url)) return;

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

        if (
          server.maxDelayed &&
          age > server.maxDelayed * 1000
        ) {
          stopRequest(server, reqId);
        }

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

      logger.raw(`==========> ${new Date()} <==========
Monitoring ${server.url}: Started @ ${startTime.toLocaleString("fa-IR")}
     Total: ${totalRequests.get(server.url)}, Stopped: ${stoppedRequests.get(server.url)}, Active: ${uaq.size}
   Delayed: +60s: ${over60Sec}, +30s: ${over30Sec}, +20s: ${over20Sec}, +10s: ${over10Sec}, +5s: ${over5Sec}
    SumLen: ${sumActiveMessageLen}, maxLen: ${maxMessageLen ? maxMessageLen + " ->" : "0"} ${maxMessageLen ? stripText(longestMessage) : ""}
  dupCount: ${duplicateMessagesCount} ${duplicateMessagesCount ? `->\n ${dupMessageStr}` : ""}
`);

      if (
        over60Sec >
        configManager.active().app.watchdogMaxTrigger
      )
        throw new Error("WATCHDOG TRIGGERED");

      await showMetrics(server);
    }
  }, 1000);
}

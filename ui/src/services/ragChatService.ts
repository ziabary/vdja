import type { Response } from 'express';

import atDB from '../db/atDB';
import { exHttpAccessDenied, exHttpInvalidParams, exHttpPayloadTooLarge, exHttpPreconditionFailed, type IntfExHttp } from '../interfaces/exHttp';
import { startNewChat, generate, type IntfRefrence } from './chatService';
import { getEmbedding } from './embedService';
import { stripText } from '../utils/common';
import vectorDB, { approximateTokenCount } from './vectorDB-old';
import logger from '../utils/logger';
import configManager from '../utils/configManager';
import type { enuLLMServices } from '../interfaces/config';
import type { IntfAuth } from '../interfaces/auth';
import { enuRoles, type IntfChunkPayload, type IntfLLMMessage } from '../interfaces/llm';
import type { TypChatListItem } from '../db/tables/tblChats';
import { enuMsgStatus } from '../db/tables/tblMessages';
import type { IntfLog } from '../db/tables/tblLog';

export interface IntfRagContext {
  from?: string[];
  chunks: IntfChunkPayload[];
  reportSource: boolean;
}

export interface IntfRagBeforeGenerateContext {
  chatSpecs: TypChatListItem;
  question: string;
  requestId: string;
  userContext: IntfRagContext;
  globalContext: IntfRagContext;
  newsContext: IntfRagContext;
  specialContext: IntfRagContext;
  allSources: { files: string[]; count: number } | undefined;
}

export interface IntfRunRagChatOptions {
  apiRes: Response;
  auth: IntfAuth;
  service: enuLLMServices;
  logName: string;
  chatId: string;
  requestId: string;
  useFiles: boolean;
  question: string;
  ignoreLastHistory?: boolean;

  systemPromptPrefix: string;
  systemPromptPostfix?: string;
  userPromptPrefix?: string;
  summarizeSystemPrompt: string;
  summarizePrompt: string;

  useGeneralKnowledge?: boolean;
  useNews?: boolean;
  showReferences?: boolean;
  /** Expose matched chunk text in SSE references. Disable for public widgets. */
  referenceText?: boolean;
  userContextMinSimilarity?: number;
  special?: {
    collection: string;
    quid: number;
    minSimilarity: number;
  };

  onBeforeGenerate?: (context: IntfRagBeforeGenerateContext) => Promise<boolean> | boolean;
  onDone?: (result: { fullMarkdown: string; cancelled: boolean; context: IntfRagBeforeGenerateContext }) => Promise<void> | void;
}

function userCollection(service: enuLLMServices, auth: IntfAuth) {
  return `${service}_${auth.key}`;
}

function countMessageTokens(messages: IntfLLMMessage[] | undefined) {
  if (!messages) return 0;
  let count = 0;
  for (const msg of messages) count += approximateTokenCount(msg.content);
  return count;
}

function countContextTokens(context: IntfRagContext | undefined) {
  if (!context || !context.chunks.length) return 0;
  let count = 0;
  for (const msg of context.chunks) count += approximateTokenCount(msg.text);
  return count;
}

async function getMatchingContexts(
  collection: string,
  embeddedQuery: number[],
  reportSource = false,
  maxItems = 8,
  mustBeNew = false,
  minSimilarity = 0.8,
): Promise<IntfRagContext> {
  const vectorDBResults = await vectorDB().findChunks(
    collection,
    embeddedQuery,
    undefined,
    maxItems,
    mustBeNew ? 7 : 0,
    minSimilarity,
  );
  const uniqueActiveSources: string[] = [];
  for (const row of vectorDBResults) {
    if (!uniqueActiveSources.includes(row.file_name)) uniqueActiveSources.push(row.file_name);
  }

  if (configManager.active().log.isDebugging) {
    logger.deepDebug({ matchedContext: { collection, vectorDBResults, uniqueActiveSources } });
  }

  return { chunks: vectorDBResults, from: uniqueActiveSources, reportSource };
}

export async function runRagChat(options: IntfRunRagChatOptions): Promise<void> {
  const {
    apiRes,
    auth,
    service,
    logName,
    chatId,
    requestId,
    useFiles,
    question,
    ignoreLastHistory = false,
    systemPromptPrefix,
    systemPromptPostfix = '',
    userPromptPrefix = 'سؤال کاربر: ',
    summarizeSystemPrompt,
    summarizePrompt,
    useGeneralKnowledge = false,
    useNews = false,
    showReferences = true,
    referenceText = true,
    userContextMinSimilarity = 0.7,
    special,
    onBeforeGenerate,
    onDone,
  } = options;

  if (chatId?.length !== 32) throw new exHttpInvalidParams('Invalid chat ID');
  if (requestId?.length !== 32) throw new exHttpInvalidParams('Invalid request ID');

  const isSummarizing = question === summarizePrompt;
  const userStats = await atDB.perUserStats.get(service, auth.uid);
  if (userStats && userStats[atDB.perUserStats.cols.totalChats] > (auth?.privs?.services[service]?.messages?.maxCount || Infinity)) {
    throw new exHttpInvalidParams(auth.privs?.services[service]?.messages?.onQuota || 'حداکثر تعداد پیام را استفاده کرده‌اید.');
  }

  const chatSpecs = await atDB.chats.get(service, auth.uid, chatId);
  if (!chatSpecs) throw new exHttpAccessDenied('چت مورد نظر یافت نشد یا شما دسترسی ندارید');

  async function retrieveChatHistory(maxItems: number) {
    const history = await atDB.messages.listByChatID(service, auth.uid, chatSpecs![atDB.chats.cols.id], maxItems, 0, false);
    let filteredHistory: IntfLLMMessage[] = [];
    let allKeywords: string[] = [];
    let lastRole: string | null = null;

    for (let i = history.messages.length - 1; i >= 0; i--) {
      const histItem = history.messages[i]!;
      if (i === history.messages.length - 1 && histItem.msgRole !== enuRoles.user) continue;

      if (histItem.msgRole !== lastRole) {
        filteredHistory.push({ role: histItem.msgRole as enuRoles, content: histItem.msgContent || '' });
        lastRole = histItem.msgRole || null;
      }

      if (histItem.msgRole === enuRoles.assistant) {
        const matched = histItem.msgContent?.match(/\n\*{0,2}عبارات کلیدی:\*{0,2}[ ]*(.*)[\n$]/);
        if (matched?.[1]) allKeywords = [...allKeywords, ...matched[1].split(/[,،][ ]*/)];
      }

      if (histItem.msgRole === enuRoles.user && histItem.msgContent === summarizePrompt) {
        filteredHistory = [{ role: histItem.msgRole as enuRoles, content: histItem.msgContent }];
      }
    }

    if (filteredHistory.length > 0 && filteredHistory[0]?.role === enuRoles.assistant) filteredHistory = filteredHistory.slice(1);
    if (ignoreLastHistory) filteredHistory = filteredHistory.length > 1 ? filteredHistory.slice(0, filteredHistory.length - 2) : [];
    allKeywords = [...new Set(allKeywords)];
    return { filteredHistory, allKeywords };
  }

  async function embedUserMessage(filteredHistory: IntfLLMMessage[], _keywords: string[], currentQuestion: string) {
    const summary = filteredHistory.length
      ? await generate(
        'auto-sum',
        service,
        'محتوای کلیدی مکالمه رو بده',
        filteredHistory.map(h => `${h.role === enuRoles.user ? 'کاربر' : 'پاسخ'}: ${h.content.replace(/\n/, ' ')}`).join('\n'),
        100,
        0.5,
      ) + '\nکاربر: '
      : '';

    if (configManager.active().log.isDebugging) logger.deepDebug({ embedding: { summary, question: currentQuestion } });
    const embeddedQuery = await getEmbedding(summary + currentQuestion);
    if (!embeddedQuery) throw new Error('Unable to generate embedding');
    return embeddedQuery;
  }

  function contextToText(context: IntfRagContext) {
    return context.chunks?.length
      ? context.chunks.map(r => `\n   - ${r.text.replace(/\n/g, ' ')}${context.reportSource ? ` (منبع: ${r.file_name})` : ''}`).join('\n')
      : '';
  }

  function makeSystemPrompt(params: {
    userContext: IntfRagContext;
    allSources: { files: string[]; count: number } | undefined;
    globalContext: IntfRagContext;
    newsContext: IntfRagContext;
    specialContext: IntfRagContext;
  }): string {
    const prefix = isSummarizing ? summarizeSystemPrompt : systemPromptPrefix;
    let systemPrompt = prefix;

    if (params.userContext.chunks.length || params.specialContext.chunks.length) {
      systemPrompt += '\n## منابع مرجع (فقط این منابع معتبر هستند)';
      if (params.userContext.chunks.length) {
        systemPrompt += contextToText(params.userContext);
        if (params.allSources?.files?.length) {
          systemPrompt += `\n## فایل‌های آپلود شده کاربر \n- **تعداد کل**: ${params.allSources.count} فایل\n- **آخرین و جدیدترین فایل‌ها**:\n${params.allSources.files.map((s, i) => `    ${i + 1}. ${s}`).join('\n')}`;
        }
      } else {
        systemPrompt += contextToText(params.specialContext);
      }
    }

    if (params.globalContext.chunks.length) systemPrompt += '\n## دانش عمومی داخلی:\n' + contextToText(params.globalContext);
    if (params.newsContext.chunks.length) systemPrompt += '\n## اخبار مرتبط:\n' + contextToText(params.newsContext);
    if (!isSummarizing) systemPrompt += systemPromptPostfix;
    return systemPrompt;
  }

  let logSpec: Partial<IntfLog> | undefined;
  const logInfo: Record<string, unknown> = { question, chatId };

  try {
    const { filteredHistory, allKeywords } = await retrieveChatHistory(21);
    const allFiles = await atDB.files.list(service, auth.uid, 10, 0, false);
    const allSources = !isSummarizing && useFiles
      ? { files: allFiles.files.map(r => r[atDB.files.cols.name]), count: allFiles.usrActiveFileCount }
      : undefined;

    const emptyContext = (): IntfRagContext => ({ chunks: [], reportSource: false });
    const embeddedQuery = await embedUserMessage(filteredHistory, allKeywords, question);
    const userContext = !isSummarizing && useFiles
      ? await getMatchingContexts(userCollection(service, auth), embeddedQuery, true, 16, false, userContextMinSimilarity)
      : emptyContext();
    const globalContext = !isSummarizing && useGeneralKnowledge
      ? userContext.chunks.length > 3 ? emptyContext() : await getMatchingContexts('RAG_GLOBAL_INFORMATION', embeddedQuery, false, 8, false, special?.minSimilarity)
      : emptyContext();
    const newsContext = !isSummarizing && useNews
      ? userContext.chunks.length > 3 ? emptyContext() : await getMatchingContexts('RAG_CRAWLED_RSS_NEWS', embeddedQuery, false, 8, question.startsWith('آخرین خبرها') || question.endsWith(' چه خبره'))
      : emptyContext();
    const specialContext = special?.collection
      ? await getMatchingContexts(special.collection, embeddedQuery, true, 16)
      : emptyContext();

    const runtimeContext: IntfRagBeforeGenerateContext = {
      chatSpecs,
      question,
      requestId,
      userContext,
      globalContext,
      newsContext,
      specialContext,
      allSources,
    };

    if (onBeforeGenerate && await onBeforeGenerate(runtimeContext)) return;

    const generateAdequateLengthMessages = (): IntfLLMMessage[] => {
      const systemPrompt = makeSystemPrompt({ userContext, allSources, newsContext, globalContext, specialContext });
      const messages: IntfLLMMessage[] = [
        { role: enuRoles.system, content: systemPrompt },
        ...filteredHistory,
        { role: enuRoles.user, content: isSummarizing ? summarizePrompt : `${userPromptPrefix}${question.trim()}` },
      ];

      const fullMessageTokens = countMessageTokens(messages);
      if (fullMessageTokens > (configManager.active().llmServers[service].maxTokens || Infinity)) {
        if (countMessageTokens(filteredHistory) > 0.5 * fullMessageTokens) {
          throw new exHttpPayloadTooLarge('حجم محتوای مکالمه بسیار زیاد شده چت جدیدی باز کنید یا این مکالمه خلاصه شود');
        }
        if (userContext.chunks.length) userContext.chunks.pop();
        if (specialContext.chunks.length) specialContext.chunks.pop();
        const globalTokens = countContextTokens(globalContext);
        const newsTokens = countContextTokens(newsContext);
        if (globalTokens > newsTokens && globalContext.chunks.length) globalContext.chunks.pop();
        else if (newsContext.chunks.length) newsContext.chunks.pop();
        return generateAdequateLengthMessages();
      }

      logInfo.historyLen = filteredHistory.length;
      if (useGeneralKnowledge) logInfo.globalChunks = globalContext.chunks.length;
      if (useNews) logInfo.news = { chunks: newsContext.chunks.length, newest: newsContext.chunks.at(0)?.chunk_time };
      if (useFiles) logInfo.files = { chunks: userContext.chunks.length };
      if (special?.collection) logInfo.specialContext = { chunks: specialContext.chunks.length };
      return messages;
    };

    const messages = generateAdequateLengthMessages();
    if (configManager.active().log.isDebugging) logger.deepDebug({ matchedContextPostFilter: { userContext, globalContext, newsContext }, messages });

    logSpec = await atDB.log.add(auth.key || String(auth.uid), logName, logInfo, question.length);
    if (process.env.DEBUG_MODE) logger.debug(`[${logName.toUpperCase()} Chat] ${chatId} | useFiles: ${useFiles ? 'true' : 'false'} | ${stripText(question)}`);

    if (special?.collection && specialContext.chunks.length === 0) {
      apiRes.send('data: {"delta":"در متن‌های مرجع پاسخ مناسب برای این سوال یافت نشد"}\ndata: [DONE:1]');
      return;
    }

    const references: IntfRefrence[] = [];
    if (showReferences) {
      const refContext = userContext.chunks.length ? userContext : specialContext.chunks.length ? specialContext : emptyContext();
      refContext.chunks.forEach(chunk => references.push({ text: referenceText ? chunk.text : '', title: chunk.title, url: chunk.file_name }));
    }

    await startNewChat(apiRes, service, requestId, messages, references, {
      onDone: async (fullMarkdown: string, cancelled: boolean | undefined) => {
        await atDB.log.updateResult(logSpec, cancelled ? 299 : 200, { responseLen: cancelled ? 'cancelled' : fullMarkdown?.length || 0 });
        await atDB.messages.addDialogue(chatSpecs, requestId, question, fullMarkdown, cancelled ? enuMsgStatus.Stopped : enuMsgStatus.Finished);
        await onDone?.({ fullMarkdown, cancelled: Boolean(cancelled), context: runtimeContext });
        return false;
      },
    });
  } catch (ex) {
    const message = (ex as Error).message || '';
    if (message.startsWith(`LLM error (400): {"error":{"message":"'max_tokens' or 'max_completion_tokens' is too large:`)
      || message.startsWith(`LLM error (400): {"error":{"message":"This model's maximum context length is`)) {
      if (logSpec) await atDB.log.updateResult(logSpec, isSummarizing ? 412 : 413, { [service]: 'large history' });
      if (isSummarizing) throw new exHttpPreconditionFailed('امکان خلاصه‌سازی این مکالمه وجود ندارد لطفا چت جدیدی باز کنید');
      throw new exHttpPayloadTooLarge('حجم محتوای مکالمه بسیار زیاد شده چت جدیدی باز کنید یا این مکالمه خلاصه شود');
    }
    if (logSpec) await atDB.log.updateResult(logSpec, (ex as IntfExHttp).status || 500, (ex as IntfExHttp).message || (ex as { error: string }).error || ex);
    else await atDB.log.add(auth.key, service, logInfo, question.length, 500, message);
    throw ex;
  }
}

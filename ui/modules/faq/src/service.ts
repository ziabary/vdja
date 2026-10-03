import { randomUUID } from 'node:crypto';
import type { intfExecutionContext } from '../../../packages/contracts/src/index.js';
import type { intfAdmissionPolicy, intfSiemConfiguration } from '../../../packages/configuration/src/index.js';
import { clsAiRouter } from '../../../packages/ai-router/src/index.js';
import { executePublicOperation, type intfPublicOperationPersistence } from '../../../packages/platform/src/publicOperation.js';
import { extractText, type intfUploadedFile, type intfFileLimits } from '../../../packages/file-processing/src/index.js';
import type { intfUsageRecorder } from '../../../packages/usage/src/index.js';

const MAX_FAQS = 100, BATCH_SIZE = 10, MAX_BATCH_SOURCE_CHARS = 12000;
export interface intfFaqItem { readonly question: string; readonly answer: string; readonly section?: string }
export interface intfFaqOptions { readonly count: number; readonly answerWords: number; readonly scope: 'all' | 'range' | 'focus'; readonly tone: 'formal' | 'conversational'; readonly language: 'source' | 'fa' | 'en'; readonly focus: string; readonly from: number; readonly to: number; readonly priorQuestions: readonly string[]; readonly signal?: AbortSignal }
export interface intfFaqMeta { readonly fileName: string; readonly sourceChars: number; readonly selectedChars: number; readonly pageCount: number; readonly count: number; readonly batches: number }

function selectScope(text: string, pageCount: number, options: intfFaqOptions): string {
  if (options.scope === 'range') {
    const pages = text.split(/<!--\s*PAGE\s+\d+\s*-->/i).filter(Boolean);
    if (pages.length > 1) return pages.slice(Math.max(0, options.from - 1), options.to).join('\n\n');
    const start = Math.floor(text.length * Math.max(0, options.from - 1) / Math.max(1, pageCount));
    const end = Math.floor(text.length * Math.min(pageCount, options.to) / Math.max(1, pageCount));
    return text.slice(start, end);
  }
  if (options.scope === 'focus' && options.focus.trim()) {
    const terms = options.focus.split(/[،,]/).map(x => x.trim().toLowerCase()).filter(Boolean);
    const paragraphs = text.split(/\n\s*\n/).filter(x => terms.some(t => x.toLowerCase().includes(t)));
    if (paragraphs.length) return paragraphs.join('\n\n');
  }
  return text;
}
function parseItems(raw: string, wanted: number): readonly intfFaqItem[] {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = cleaned.indexOf('['), end = cleaned.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('INVALID_FAQ_OUTPUT');
  let value: unknown; try { value = JSON.parse(cleaned.slice(start, end + 1)) as unknown; } catch { throw new Error('INVALID_FAQ_OUTPUT'); }
  if (!Array.isArray(value)) throw new Error('INVALID_FAQ_OUTPUT');
  const items = value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && typeof item.question === 'string' && typeof item.answer === 'string')
    .slice(0, wanted).map(item => ({ question: String(item.question).trim(), answer: String(item.answer).trim(), section: typeof item.section === 'string' ? item.section.trim() : undefined }));
  if (!items.length || items.some(item => !item.question || !item.answer)) throw new Error('INVALID_FAQ_OUTPUT');
  return items;
}

export async function inspectFaq(storage: intfPublicOperationPersistence, context: intfExecutionContext, policy: intfAdmissionPolicy, siem: intfSiemConfiguration, file: intfUploadedFile, limits: intfFileLimits): Promise<{ readonly fileName: string; readonly pageCount: number; readonly sourceChars: number }> {
  return executePublicOperation(storage, { context, policy, siem, action: { requested: 'public.faq.inspect', completed: 'public.faq.inspect', failed: 'public.faq.failed', cancelled: 'public.faq.cancelled' }, inputChars: 0, uploadedBytes: file.size, tokenReservation: 0, execute: async reservation => {
    const extracted = await extractText(file, limits);
    if (!extracted.text.trim()) throw new Error('EMPTY_DOCUMENT');
    await storage.recordExtractedInput(context, reservation.id, policy, extracted.text.length);
    return { value: { fileName: file.originalname, pageCount: extracted.pageCount, sourceChars: extracted.text.length }, usage: [{ runId: randomUUID(), inputChars: extracted.text.length, uploadedBytes: file.size, inputTokens: 0, outputTokens: 0, providerMs: 0 }] };
  } });
}

export async function generateFaq(storage: intfPublicOperationPersistence, usage: intfUsageRecorder, router: clsAiRouter, context: intfExecutionContext, policy: intfAdmissionPolicy, siem: intfSiemConfiguration, file: intfUploadedFile, limits: intfFileLimits, options: intfFaqOptions, onMeta: (meta: intfFaqMeta) => void, onBatch: (items: readonly intfFaqItem[], index: number, total: number, produced: number) => void): Promise<number> {
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > MAX_FAQS || !Number.isInteger(options.answerWords) || options.answerWords < 20 || options.answerWords > 250 || options.focus.length > 500 || options.priorQuestions.length > MAX_FAQS || options.count + options.priorQuestions.length > MAX_FAQS || !['all','range','focus'].includes(options.scope) || !['formal','conversational'].includes(options.tone) || !['source','fa','en'].includes(options.language)) throw new Error('INVALID_FAQ_INPUT');
  const expectedBatches = Math.ceil(options.count / BATCH_SIZE);
  return executePublicOperation(storage, { context, policy, siem, action: { requested: 'public.faq.generate.requested', completed: 'public.faq.generate.completed', failed: 'public.faq.failed', cancelled: 'public.faq.cancelled' }, inputChars: 0, uploadedBytes: file.size, outputTokenBudget: policy.outputTokens, tokenReservation: policy.outputTokens, execute: async reservation => {
    const extracted = await extractText(file, limits);
    if (!extracted.text.trim()) throw new Error('EMPTY_DOCUMENT');
    await storage.recordExtractedInput(context, reservation.id, policy, extracted.text.length);
    const selected = selectScope(extracted.text, extracted.pageCount, options).trim();
    if (!selected) throw new Error('EMPTY_SCOPE');
    const batches = Math.max(expectedBatches, Math.ceil(selected.length / MAX_BATCH_SOURCE_CHARS));
    if (batches > options.count) throw new Error('SOURCE_TOO_LARGE_FOR_FAQ_COUNT');
    if (batches > policy.outputTokens) throw new Error('OUTPUT_LIMIT_EXCEEDED');
    onMeta({ fileName: file.originalname, sourceChars: extracted.text.length, selectedChars: selected.length, pageCount: extracted.pageCount, count: options.count, batches });
    const questions = [...options.priorQuestions]; let produced = 0;
    for (let batch = 0; batch < batches; batch += 1) {
      if (options.signal?.aborted) throw new Error('CANCELLED');
      const wanted = Math.min(BATCH_SIZE, Math.ceil((options.count - produced) / (batches - batch)));
      const start = Math.floor(selected.length * batch / batches), end = Math.floor(selected.length * (batch + 1) / batches);
      const source = selected.slice(start, end);
      const system = `Generate grounded FAQs from supplied document content. Return ONLY a valid JSON array. Each item has question, answer and section string fields. Do not invent facts. Questions must be distinct. Answers must be self-contained and no longer than ${options.answerWords} words. Use ${options.tone} register. Preserve exact names, numbers and qualifications.`;
      const user = `Generate exactly ${wanted} FAQ items. Output language: ${options.language}. Requested focus: ${options.focus || 'none'}. Questions already used: ${JSON.stringify(questions)}. DOCUMENT PART ${batch + 1}/${batches}:\n${source}`;
      const result = await router.run({ task: 'GENERATE_FAQ', moduleId: 'faq', requestId: `${context.requestId}-${batch}`, correlationId: context.correlationId, deploymentId: context.deploymentId, tenantId: context.tenantId, actorKind: context.actorKind, actorId: context.actorId, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], maxOutputTokens: Math.min(Math.floor(policy.outputTokens / batches), wanted * (options.answerWords + 60)), temperature: 0.2, signal: options.signal });
      const items = parseItems(result.output, wanted);
      await usage.record(context, { runId: result.runId, inputChars: source.length, uploadedBytes: batch === 0 ? file.size : 0, inputTokens: result.inputTokens, outputTokens: result.outputTokens, providerMs: result.durationMs });
      questions.push(...items.map(item => item.question)); produced += items.length;
      onBatch(items, batch + 1, batches, produced);
    }
    return { value: produced, usage: [] };
  } });
}

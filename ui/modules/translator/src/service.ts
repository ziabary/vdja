import { randomUUID } from 'node:crypto';
import type { intfExecutionContext } from '../../../packages/contracts/src/index.js';
import type { intfAdmissionPolicy, intfSiemConfiguration } from '../../../packages/configuration/src/index.js';
import { clsAiRouter } from '../../../packages/ai-router/src/index.js';
import { executePublicOperation, type intfPublicOperationPersistence } from '../../../packages/platform/src/publicOperation.js';
import type { intfDictionaryResult } from './contracts.js';

const MAX_OUTPUT_TOKENS = 2000;
const LANGUAGES: Readonly<Record<string, string>> = { auto: 'auto-detect based on provided text', en: 'English', fa: 'Persian', ar: 'Arabic', es: 'Spanish', ru: 'Russian', de: 'Dutch', bg: 'Bulgarian', da: 'Danish', el: 'Greek', fi: 'Finnish', fr: 'French', hi: 'Hindi', id: 'Indonesian', it: 'Italian', ja: 'Japanese', ko: 'Korean', nl: 'Dutch', pl: 'Polish', pt: 'Portuguese', tr: 'Turkish', uk: 'Ukrainian', zh: 'Chinese' };
const SYSTEM_PROMPT = `You are a professional and accurate translator. Translate all content in order as plain text without explanation or summary. For a fragment under three words, provide dictionary-like meanings. When translating to Persian, use guillemets and Persian numerals in normal text while preserving technical numbers.`;
export interface intfTranslateInput { readonly text: string; readonly sourceLang: string; readonly targetLang: string; readonly signal?: AbortSignal }
export type typTranslateResult = { readonly kind: 'DICTIONARY'; readonly dictionary: intfDictionaryResult } | { readonly kind: 'STREAM'; readonly markdown: string; readonly runId: string };
export interface intfTranslatorDictionary { lookup(text: string): Promise<intfDictionaryResult | null> }

export async function translate(storage: intfPublicOperationPersistence, dictionary: intfTranslatorDictionary, router: clsAiRouter, context: intfExecutionContext, policy: intfAdmissionPolicy, siem: intfSiemConfiguration, input: intfTranslateInput, onDelta: (delta: string) => Promise<void> | void): Promise<typTranslateResult> {
  const text = input.text.trim();
  if (!text || text.length > policy.inputChars || !LANGUAGES[input.sourceLang] || !LANGUAGES[input.targetLang] || input.sourceLang === input.targetLang || input.targetLang === 'auto') throw new Error('INVALID_TRANSLATE_INPUT');
  return executePublicOperation<typTranslateResult>(storage, { context, policy, siem, action: { requested: 'public.translate.requested', completed: 'public.translate.completed', failed: 'public.translate.failed', cancelled: 'public.translate.cancelled' }, inputChars: text.length, uploadedBytes: 0, tokenReservation: MAX_OUTPUT_TOKENS + Math.ceil(text.length / 2), execute: async () => {
    const found = await dictionary.lookup(text);
    if (found && ((['en', 'auto'].includes(input.sourceLang) && input.targetLang === 'fa') || (['fa', 'auto'].includes(input.sourceLang) && input.targetLang === 'en'))) {
      const runId = randomUUID();
      return { value: { kind: 'DICTIONARY', dictionary: found } as const, usage: [{ runId, inputChars: text.length, uploadedBytes: 0, inputTokens: 0, outputTokens: 0, providerMs: 0 }] };
    }
    const result = await router.run({ task: 'TRANSLATE', moduleId: 'translator', requestId: context.requestId, correlationId: context.correlationId, deploymentId: context.deploymentId, tenantId: context.tenantId, actorKind: context.actorKind, actorId: context.actorId, messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: `Translate from ${LANGUAGES[input.sourceLang]} to ${LANGUAGES[input.targetLang]}: ${text}` }], maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.7, signal: input.signal }, onDelta);
    return { value: { kind: 'STREAM', markdown: result.output, runId: result.runId } as const, usage: [{ runId: result.runId, inputChars: text.length, uploadedBytes: 0, inputTokens: result.inputTokens, outputTokens: result.outputTokens, providerMs: result.durationMs }] };
  } });
}

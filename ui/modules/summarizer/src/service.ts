import type { intfExecutionContext } from '../../../packages/contracts/src/index.js';
import type { intfAdmissionPolicy, intfSiemConfiguration } from '../../../packages/configuration/src/index.js';
import { clsAiRouter } from '../../../packages/ai-router/src/index.js';
import { executePublicOperation, type intfPublicOperationPersistence } from '../../../packages/platform/src/publicOperation.js';

const MAX_OUTPUT_TOKENS = 2000;
const SYSTEM_PROMPT = `You are a highly accurate summarization expert. Output only a fluent, natural summary without introduction or explanation.`;
export interface intfSummarizeInput { readonly text: string; readonly maxWords: number; readonly forcePersian: boolean; readonly signal?: AbortSignal }
export async function summarize(storage: intfPublicOperationPersistence, router: clsAiRouter, context: intfExecutionContext, policy: intfAdmissionPolicy, siem: intfSiemConfiguration, input: intfSummarizeInput, onDelta: (delta: string) => Promise<void> | void): Promise<{ readonly markdown: string; readonly runId: string }> {
  const text = input.text.trim();
  if (!text || text.length > policy.inputChars || !Number.isInteger(input.maxWords) || input.maxWords < 1 || input.maxWords > 2000) throw new Error('INVALID_SUMMARIZE_INPUT');
  const system = `${SYSTEM_PROMPT}\n${input.forcePersian ? 'Always summarize in Persian. Use Persian guillemets and numerals in normal text.' : 'Summarize in the original language and follow its typography.'}`;
  const user = `Summarize the following text ${input.forcePersian ? 'in Persian' : 'in its original language'} for at most ${input.maxWords} words:\n\n${text}`;
  return executePublicOperation(storage, { context, policy, siem, action: { requested: 'public.summarize.requested', completed: 'public.summarize.completed', failed: 'public.summarize.failed', cancelled: 'public.summarize.cancelled' }, inputChars: text.length, uploadedBytes: 0, tokenReservation: MAX_OUTPUT_TOKENS + Math.ceil(text.length / 2), execute: async () => {
    const result = await router.run({ task: 'SUMMARIZE', moduleId: 'summarizer', requestId: context.requestId, correlationId: context.correlationId, deploymentId: context.deploymentId, tenantId: context.tenantId, actorKind: context.actorKind, actorId: context.actorId, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: 0.7, signal: input.signal }, onDelta);
    return { value: { markdown: result.output, runId: result.runId }, usage: [{ runId: result.runId, inputChars: text.length, uploadedBytes: 0, inputTokens: result.inputTokens, outputTokens: result.outputTokens, providerMs: result.durationMs }] };
  } });
}

export interface intfUsageFacts { readonly runId: string; readonly inputChars: number; readonly uploadedBytes: number; readonly inputTokens: number; readonly outputTokens: number; readonly providerMs: number }
import type { intfExecutionContext } from '../../contracts/src/index.js';
export interface intfUsageRecorder { record(context: intfExecutionContext, facts: intfUsageFacts): Promise<void> }

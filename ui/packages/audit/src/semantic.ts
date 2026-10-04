import type { intfExecutionContext } from '../../contracts/src/index.js';
import type { intfTransactionHandle } from '../../contracts/src/transaction.js';
import type { typAuditResult } from './index.js';

/** Semantic vocabulary belongs to the requesting capability; evidence shape belongs to Audit. */
export interface intfSemanticAuditEvent {
  readonly action: string;
  readonly result: typAuditResult;
  readonly reason?: string;
  readonly resource?: Readonly<{ type: string; id: string }>;
}
export interface intfSemanticAuditPort {
  record(transaction: intfTransactionHandle, context: intfExecutionContext, event: intfSemanticAuditEvent): Promise<string>;
}

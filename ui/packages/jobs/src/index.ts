import type { intfExecutionContext } from '../../contracts/src/index.js';
import type { intfTransactionHandle } from '../../contracts/src/transaction.js';

export enum enuJobState { Pending = 'PENDING', Running = 'RUNNING', Succeeded = 'SUCCEEDED', Failed = 'FAILED' }
export interface intfScheduleJob {
  readonly id: string;
  readonly kind: string;
  readonly idempotencyKey: string;
  readonly payloadVersion: number;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly subject: intfExecutionContext;
  readonly maxAttempts: number;
  readonly notBefore?: string;
}
export interface intfJob extends intfScheduleJob {
  readonly state: enuJobState;
  readonly attempts: number;
  readonly leaseToken: string;
  readonly leaseUntil: string;
}
export interface intfJobPort {
  recoverExhausted(transaction:intfTransactionHandle,worker:intfExecutionContext):Promise<readonly intfJob[]>;
  schedule(transaction: intfTransactionHandle, request: intfScheduleJob): Promise<string>;
  assertLease(transaction: intfTransactionHandle, worker: intfExecutionContext, job: intfJob): Promise<void>;
  claim(transaction: intfTransactionHandle, worker: intfExecutionContext, leaseMs: number): Promise<intfJob | null>;
  heartbeat(transaction: intfTransactionHandle, worker: intfExecutionContext,
    job: intfJob, leaseMs: number): Promise<boolean>;
  finish(transaction: intfTransactionHandle, worker: intfExecutionContext, job: intfJob): Promise<boolean>;
  fail(transaction: intfTransactionHandle, worker: intfExecutionContext, job: intfJob,
    reason: string, retryable: boolean, backoffMs: number): Promise<boolean>;
}
export class exJob extends Error {
  constructor(readonly code: 'INVALID_JOB' | 'JOB_IDEMPOTENCY_CONFLICT' | 'JOB_LEASE_LOST') { super(code); }
}

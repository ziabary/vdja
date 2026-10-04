import type { intfExecutionContext } from './index.js';

/** Opaque active transaction identity; only owning persistence adapters unwrap it. */
export interface intfTransactionHandle { readonly transactionId: string }
export interface intfTransactionPort {
  run<T>(context: intfExecutionContext,
    work: (transaction: intfTransactionHandle) => Promise<T>): Promise<T>;
}

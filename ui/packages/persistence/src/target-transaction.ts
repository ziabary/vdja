import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { intfExecutionContext } from '../../contracts/src/index.js';
import type { intfTransactionHandle, intfTransactionPort } from '../../contracts/src/transaction.js';
import { withTargetTransaction, type typTargetClient } from './target.js';

const LIVE_TRANSACTIONS = new WeakMap<intfTransactionHandle, typTargetClient>();

/** Persistence adapters alone may unwrap a live, unforgeable transaction capability. */
export function resolveTargetTransaction(handle: intfTransactionHandle): typTargetClient {
  const client = LIVE_TRANSACTIONS.get(handle);
  if (!client) throw new Error('INVALID_OR_CLOSED_TRANSACTION');
  return client;
}
export function createTransactionPort(pool: pg.Pool): intfTransactionPort {
  return { run: <T>(context: intfExecutionContext, work: (handle: intfTransactionHandle) => Promise<T>) => {
    if (!context.tenantId || !context.deploymentId) throw new Error('MISSING_TRANSACTION_SCOPE');
    return withTargetTransaction(pool, context, async client => {
      const handle: intfTransactionHandle = Object.freeze({ transactionId: randomUUID() });
      LIVE_TRANSACTIONS.set(handle, client);
      try { return await work(handle); }
      finally { LIVE_TRANSACTIONS.delete(handle); }
    });
  } };
}
/** Composition roots receive an opaque transaction port, never its SQL client. */
export function createTargetTransactionPersistence(pool: pg.Pool): intfTransactionPort {
  return createTransactionPort(pool);
}

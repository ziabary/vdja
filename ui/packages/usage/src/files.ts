import type { intfExecutionContext } from '../../contracts/src/index.js';
import type { intfTransactionHandle } from '../../contracts/src/transaction.js';

export interface intfFileUsageFact {
  readonly operationId: string;
  readonly uploadedBytes: number;
  readonly downloadedBytes: number;
  readonly storageBytes: number;
  readonly files: number;
  readonly processingBytes: number;
}
export interface intfFileUsagePort {
  record(transaction: intfTransactionHandle, context: intfExecutionContext, fact: intfFileUsageFact): Promise<void>;
}

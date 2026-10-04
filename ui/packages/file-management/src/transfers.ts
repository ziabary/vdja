import type { intfExecutionContext } from '../../contracts/src/index.js';
import type { intfTransactionHandle } from '../../contracts/src/transaction.js';
import type { intfStoragePart } from '../../storage/src/index.js';
import { enuTransferState, type intfUploadRequest } from './index.js';

export enum enuTransferOperation { Begin = 'BEGIN', Part = 'PART', Complete = 'COMPLETE', Reconcile = 'RECONCILE', Expire = 'EXPIRE' }
export interface intfFileTransfer extends intfUploadRequest {
  readonly id: string; readonly versionId: string | null; readonly proposedVersionId: string; readonly assetId: string; readonly storageKey: string;
  readonly storageProfile: string; readonly remoteUploadId: string | null; readonly partBytes: number;
  readonly state: enuTransferState; readonly operation: enuTransferOperation | null;
  readonly leaseToken: string | null; readonly leaseExpiresAt: string | null;
  readonly expiresAt: string; readonly errorClass: string | null; readonly parts: readonly intfStoragePart[];
}
export interface intfCreateTransfer extends intfUploadRequest {
  readonly id: string; readonly assetId: string; readonly proposedVersionId: string; readonly storageKey: string;
  readonly storageProfile: string; readonly partBytes: number; readonly expiresAt: string;
}
export interface intfTransferUpdate {
  readonly state: enuTransferState; readonly remoteUploadId?: string;
  readonly versionId?: string; readonly errorClass?: string;
  readonly releaseLease?: boolean;
}
export interface intfTransferRepository {
  find(transaction: intfTransactionHandle, context: intfExecutionContext, id: string): Promise<intfFileTransfer | null>;
  byIdempotency(transaction: intfTransactionHandle, context: intfExecutionContext,
    documentId: string, key: string): Promise<intfFileTransfer | null>;
  create(transaction: intfTransactionHandle, context: intfExecutionContext, input: intfCreateTransfer): Promise<intfFileTransfer>;
  lease(transaction: intfTransactionHandle, context: intfExecutionContext, id: string,
    states: readonly enuTransferState[], operation: enuTransferOperation, leaseMs: number): Promise<intfFileTransfer | null>;
  update(transaction: intfTransactionHandle, context: intfExecutionContext, id: string,
    leaseToken: string, input: intfTransferUpdate): Promise<void>;
  reservePart(transaction: intfTransactionHandle, context: intfExecutionContext, id: string,
    leaseToken: string, part: intfStoragePart): Promise<void>;
  acceptPart(transaction: intfTransactionHandle, context: intfExecutionContext, id: string,
    leaseToken: string, part: intfStoragePart): Promise<void>;
  expired(transaction: intfTransactionHandle, context: intfExecutionContext, limit: number): Promise<readonly string[]>;
}

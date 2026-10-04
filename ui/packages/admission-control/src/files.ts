import type { intfExecutionContext } from '../../contracts/src/index.js';
import type { intfTransactionHandle } from '../../contracts/src/transaction.js';
import type { intfFileActorLimits } from '../../configuration/src/index.js';

export enum enuFileReservationKind { Upload = 'UPLOAD', Download = 'DOWNLOAD', Processing = 'PROCESSING' }
export enum enuFileReservationState { Reserved = 'RESERVED', Committed = 'COMMITTED', Released = 'RELEASED' }
export interface intfFileAdmissionPolicy {
  readonly actorLimits?: intfFileActorLimits;
  readonly maxBytes: number;
  readonly maxConcurrent: number;
  readonly maxPendingBytes: number;
  readonly maxTenantStorageBytes: number;
  readonly maxTenantAssets: number;
}
export interface intfFileAdmissionRequest {
  readonly id: string; readonly kind: enuFileReservationKind; readonly bytes: number; readonly expiresAt: string;
}
export interface intfFileAdmissionPort {
  reserve(transaction: intfTransactionHandle, context: intfExecutionContext,
    policy: intfFileAdmissionPolicy, request: intfFileAdmissionRequest): Promise<void>;
  finish(transaction: intfTransactionHandle, context: intfExecutionContext, id: string,
    state: enuFileReservationState.Committed | enuFileReservationState.Released): Promise<void>;
}

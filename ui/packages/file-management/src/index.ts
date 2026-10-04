import type { intfExecutionContext } from '../../contracts/src/index.js';
import type { intfDocumentVersion } from '../../documents/src/index.js';
import type { Readable } from 'node:stream';

export enum enuTransferState { Initiated = 'INITIATED', Uploading = 'UPLOADING', Uploaded = 'UPLOADED',
  Verifying = 'VERIFYING', Committed = 'COMMITTED', Failed = 'FAILED', Expired = 'EXPIRED', Unresolved = 'UNRESOLVED' }
export enum enuFileEvent { UploadInitiated = 'file.upload.initiated', UploadCompleted = 'file.upload.completed',
  UploadFailed = 'file.upload.failed', UploadExpired = 'file.upload.expired', AssetCommitted = 'file.asset.committed',
  VersionCreated = 'file.version.created', DownloadRequested = 'file.download.requested',
  DownloadCompleted = 'file.download.completed', DownloadDenied = 'file.download.denied', Quarantined = 'file.quarantined',
  Retired = 'file.deleted_or_retired', ProcessingRequested = 'file.processing.requested', ProcessingCompleted = 'file.processing.completed',
  ProcessingFailed = 'file.processing.failed', CacheIntegrityFailure = 'file.cache.integrity_failure', StorageFailure = 'file.storage.failure' }
export interface intfUploadRequest {
  readonly documentId: string; readonly idempotencyKey: string; readonly filename: string;
  readonly mediaType: string; readonly bytes: number; readonly sha256: string;
}
export interface intfTransferView {
  readonly id: string; readonly documentId: string; readonly state: enuTransferState;
  readonly partBytes: number; readonly acceptedParts: readonly number[]; readonly expiresAt: string;
  readonly versionId: string | null; readonly errorClass: string | null;
}
export interface intfDownloadRequest {
  readonly documentId: string; readonly versionId: string;
  readonly range?: string; readonly ifNoneMatch?: string; readonly ifRange?: string;
}
export interface intfDownload {
  readonly status: 200 | 206 | 304;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: Readable;
}
export interface intfFileManagement {
  initiate(context: intfExecutionContext, request: intfUploadRequest): Promise<intfTransferView>;
  status(context: intfExecutionContext, id: string): Promise<intfTransferView>;
  uploadPart(context: intfExecutionContext, id: string, number: number, sha256: string,
    bytes: Uint8Array, signal?: AbortSignal): Promise<intfTransferView>;
  complete(context: intfExecutionContext, id: string): Promise<intfDocumentVersion | intfTransferView>;
  download(context: intfExecutionContext, request: intfDownloadRequest): Promise<intfDownload>;
  materialize(context: intfExecutionContext, documentId: string, versionId: string): Promise<string>;
}
export class exFileManagement extends Error {
  constructor(readonly code: 'FILE_DENIED' | 'INVALID_TRANSFER' | 'TRANSFER_CONFLICT' | 'TRANSFER_EXPIRED'
    | 'TRANSFER_UNRESOLVED' | 'TRANSFER_IN_PROGRESS' | 'FILE_INTEGRITY_FAILURE' | 'INVALID_RANGE'
    | 'FILE_STORAGE_UNAVAILABLE' | 'FILE_CACHE_UNAVAILABLE' | 'FILE_CACHE_LIMIT' | 'FILE_QUOTA_EXCEEDED') { super(code); }
}

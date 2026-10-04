import type { intfExecutionContext } from '../../contracts/src/index.js';
import type { intfTransactionHandle } from '../../contracts/src/transaction.js';
import type { intfProtectedResourceFacts } from '../../authority/src/contracts.js';
import type { typClassificationLevel } from '../../authority/src/index.js';

export enum enuDocumentOperation {
  Discover = 'discover', Read = 'read', Download = 'download', Use = 'use', Quote = 'quote', Manage = 'manage'
}
export enum enuDocumentState { Active = 'ACTIVE', Retired = 'RETIRED' }
export enum enuVersionState { Pending = 'PENDING', Processing = 'PROCESSING', Ready = 'READY', Failed = 'FAILED' }
export enum enuAssetState { Approved = 'APPROVED', Quarantined = 'QUARANTINED', Retired = 'RETIRED' }
export interface intfDocumentFacts extends intfProtectedResourceFacts {
  readonly ownerId: string;
  readonly classification: typClassificationLevel;
  readonly currentVersionId: string | null;
  readonly securityVersion: number;
  readonly lifecycle: enuDocumentState;
}
export interface intfDocumentView {
  readonly id: string;
  readonly title: string;
  readonly currentVersionId: string | null;
  readonly lifecycle: enuDocumentState;
}
export interface intfDocumentVersion {
  readonly id: string;
  readonly documentId: string;
  readonly sequence: number;
  readonly processingState: enuVersionState;
  readonly processor: string | null;
  readonly contentHash: string | null;
  readonly createdAt: string;
}
export interface intfDocumentAsset {
  readonly id: string;
  readonly documentId: string;
  readonly versionId: string;
  readonly storageKey: string;
  readonly storageProfile: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly mediaType: string;
  readonly filename: string;
  readonly lifecycle: enuAssetState;
}
export interface intfCreateDocument {
  readonly id: string;
  readonly title: string;
  readonly classification: typClassificationLevel;
  readonly businessResource?: Readonly<{ type: string; id: string }>;
  readonly sourceIdentity?: string;
}
export interface intfCommitVersion {
  readonly versionId: string;
  readonly documentId: string;
  readonly asset: intfDocumentAsset;
  readonly sourceIdentity: string;
}
export interface intfNormalizedVersion {
  readonly versionId: string; readonly documentId: string; readonly text: string;
  readonly sha256: string; readonly processor: string; readonly state: enuVersionState;
}
export interface intfDocumentRepository {
  assertSnapshot(transaction:intfTransactionHandle,context:intfExecutionContext,expected:readonly intfDocumentFacts[]):Promise<void>;
  facts(transaction: intfTransactionHandle, context: intfExecutionContext, id: string): Promise<intfDocumentFacts | null>;
  factsBatch(transaction: intfTransactionHandle, context: intfExecutionContext,
    ids: readonly string[]): Promise<readonly intfDocumentFacts[]>;
  list(transaction: intfTransactionHandle, context: intfExecutionContext, after: string | null,
    limit: number): Promise<readonly intfDocumentView[]>;
  create(transaction: intfTransactionHandle, context: intfExecutionContext, input: intfCreateDocument): Promise<void>;
  commitVersion(transaction: intfTransactionHandle, context: intfExecutionContext,
    input: intfCommitVersion): Promise<intfDocumentVersion>;
  versions(transaction: intfTransactionHandle, context: intfExecutionContext, id: string): Promise<readonly intfDocumentVersion[]>;
  asset(transaction: intfTransactionHandle, context: intfExecutionContext, documentId: string,
    versionId: string): Promise<intfDocumentAsset | null>;
  normalized(transaction: intfTransactionHandle, context: intfExecutionContext,
    versionId: string): Promise<string | null>;
  normalizedBatch(transaction: intfTransactionHandle, context: intfExecutionContext,
    ids: readonly string[]): Promise<readonly intfNormalizedVersion[]>;
  recordProcessed(transaction: intfTransactionHandle, context: intfExecutionContext,
    versionId: string, text: string, processor: string, hash: string): Promise<void>;
  markProcessing(transaction: intfTransactionHandle, context: intfExecutionContext,
    versionId: string, state: enuVersionState): Promise<void>;
  activate(transaction: intfTransactionHandle, context: intfExecutionContext, versionId: string): Promise<void>;
  retire(transaction: intfTransactionHandle, context: intfExecutionContext, id: string): Promise<void>;
}
export class exDocument extends Error {
  constructor(readonly code: 'DOCUMENT_DENIED' | 'DOCUMENT_NOT_AVAILABLE' | 'DOCUMENT_CONFLICT'
    | 'INVALID_DOCUMENT' | 'VERSION_NOT_READY' | 'STALE_DOCUMENT') { super(code); }
}

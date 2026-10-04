import type { intfExecutionContext } from '../../contracts/src/index.js';
import type { intfTransactionHandle } from '../../contracts/src/transaction.js';
import type { intfProtectedResourceFacts } from '../../authority/src/contracts.js';
import type { typClassificationLevel } from '../../authority/src/index.js';

export enum enuKnowledgeState { Active = 'ACTIVE', Retired = 'RETIRED' }
export enum enuMembershipMode { Current = 'CURRENT', Pinned = 'PINNED' }
export enum enuIndexState { Building = 'BUILDING', Ready = 'READY', Retired = 'RETIRED', Failed = 'FAILED' }
export const MAX_INDEX_GENERATION_CHUNKS=10000;
export enum enuKnowledgeEvent { SpaceCreated = 'knowledge.space.created', MembershipChanged = 'knowledge.membership.changed',
  IndexStarted = 'knowledge.index.started', IndexReady = 'knowledge.index.ready', IndexFailed = 'knowledge.index.failed',
  QueryRequested = 'knowledge.query.requested', QueryCompleted = 'knowledge.query.completed', QueryDenied = 'knowledge.query.denied',
  ProjectionRejected = 'knowledge.projection.rejected', OutputRejected = 'knowledge.output.rejected' }
export interface intfKnowledgeSpace extends intfProtectedResourceFacts {
  readonly ownerId: string; readonly classification: typClassificationLevel; readonly title: string;
  readonly lifecycle: enuKnowledgeState; readonly securityVersion: number; readonly generationId: string | null;
  readonly projectionSecurityVersion: number | null;
  readonly pendingGenerationId: string | null;
  readonly requestedIndexState: enuIndexState;
}
export interface intfCreateSpace { readonly id: string; readonly title: string; readonly classification: typClassificationLevel }
export interface intfKnowledgeMembership {
  readonly spaceId: string; readonly documentId: string; readonly mode: enuMembershipMode;
  readonly pinnedVersionId: string | null; readonly securityVersion: number;
}
export interface intfIndexProfile {
  readonly id: string; readonly embeddingProfileId: string; readonly dimensions: number;
  readonly chunkingProfile: string; readonly chunkChars: number; readonly overlapChars: number;
}
export interface intfIndexGeneration extends intfIndexProfile {
  readonly generationId: string; readonly collection: string; readonly state: enuIndexState;
}
export interface intfKnowledgeChunk {
  readonly id: string; readonly generationId: string; readonly spaceId: string; readonly documentId: string;
  readonly versionId: string; readonly ordinal: number; readonly start: number; readonly end: number;
  readonly sha256: string; readonly documentSecurityVersion: number; readonly membershipSecurityVersion: number;
}
export interface intfKnowledgeRepository {
 retentionReferences(transaction:intfTransactionHandle,context:intfExecutionContext,id:string):Promise<boolean>;
 purgeProjections(transaction:intfTransactionHandle,context:intfExecutionContext,id:string):Promise<readonly Readonly<{collection:string;generationId:string;spaceId:string}>[]>;
 purgeMetadata(transaction:intfTransactionHandle,context:intfExecutionContext,id:string,leaseToken:string):Promise<void>;
  requestIndex(tx:intfTransactionHandle,context:intfExecutionContext,spaceId:string,generationId:string):Promise<void>;
  failGeneration(tx:intfTransactionHandle,context:intfExecutionContext,generationId:string):Promise<void>;
  createSpace(tx: intfTransactionHandle, context: intfExecutionContext, input: intfCreateSpace): Promise<void>;
  spaces(tx: intfTransactionHandle, context: intfExecutionContext, after: string | null, limit: number): Promise<readonly intfKnowledgeSpace[]>;
  space(tx: intfTransactionHandle, context: intfExecutionContext, id: string): Promise<intfKnowledgeSpace | null>;
  membership(tx: intfTransactionHandle, context: intfExecutionContext, input: Omit<intfKnowledgeMembership, 'securityVersion'>): Promise<void>;
  removeMembership(tx:intfTransactionHandle,context:intfExecutionContext,spaceId:string,documentId:string):Promise<void>;
  memberships(tx: intfTransactionHandle, context: intfExecutionContext, spaceId: string): Promise<readonly intfKnowledgeMembership[]>;
  spacesForDocument(tx: intfTransactionHandle, context: intfExecutionContext, documentId: string): Promise<readonly string[]>;
  generation(tx: intfTransactionHandle, context: intfExecutionContext, id: string): Promise<intfIndexGeneration | null>;
  beginGeneration(tx: intfTransactionHandle, context: intfExecutionContext, input: intfIndexGeneration): Promise<void>;
  chunks(tx: intfTransactionHandle, context: intfExecutionContext, ids: readonly string[], generationId: string, spaceId: string): Promise<readonly intfKnowledgeChunk[]>;
  saveChunks(tx: intfTransactionHandle, context: intfExecutionContext, input: readonly intfKnowledgeChunk[]): Promise<void>;
  activate(tx: intfTransactionHandle, context: intfExecutionContext, generationId: string,
    spaceId: string, expectedSpaceSecurityVersion: number, expectedChunks: number, previousGenerationId: string | null): Promise<void>;
}
export interface intfVectorPoint {
  readonly id: string; readonly vector: readonly number[];
  readonly payload: Readonly<{ deploymentId: string; tenantId: string; generationId: string; spaceId: string;
    documentId: string; versionId: string; chunkId: string; documentSecurityVersion: number; membershipSecurityVersion: number }>;
}
export interface intfVectorHit { readonly id: string; readonly chunkId: string; readonly score: number }
export interface intfVectorFilter {
  readonly deploymentId: string; readonly tenantId: string; readonly generationId: string; readonly spaceId: string;
  readonly documentIds: readonly string[];
}
export interface intfVectorIndexPort {
 purgeDocument?(collection:string,input:intfVectorFilter):Promise<void>;
  ready(): Promise<void>;
  ensure(collection: string, dimensions: number): Promise<void>;
  upsert(collection: string, points: readonly intfVectorPoint[]): Promise<void>;
  count(collection: string, filter: intfVectorFilter): Promise<number>;
  search(collection: string, vector: readonly number[], filter: intfVectorFilter, limit: number): Promise<readonly intfVectorHit[]>;
}
export class exKnowledge extends Error {
  constructor(readonly code: 'KNOWLEDGE_DENIED' | 'INVALID_KNOWLEDGE' | 'STALE_PROJECTION' | 'INDEX_NOT_READY'
    | 'INDEX_CONFLICT' | 'INDEX_UNAVAILABLE' | 'CONTEXT_BUDGET_EXCEEDED' | 'OUTPUT_DISCLOSURE_DENIED') { super(code); }
}

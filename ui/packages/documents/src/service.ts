import {resolvePurgePermit,type intfPurgePermit} from '../../data-governance/src/retention.js';
import { createHash, randomUUID } from 'node:crypto';
import type { intfExecutionContext, intfCursorPage } from '../../contracts/src/index.js';
import type { intfTransactionHandle, intfTransactionPort } from '../../contracts/src/transaction.js';
import type { intfExecutionSubjectPort } from '../../contracts/src/execution-subject.js';
import { clsAuthorityService } from '../../authority/src/service.js';
import { enuAuthorityDecision } from '../../authority/src/index.js';
import type { intfJobPort } from '../../jobs/src/index.js';
import { enuDocumentOperation, enuDocumentState, enuVersionState, enuAssetState, exDocument,
  type intfDocumentFacts, type intfDocumentView, type intfDocumentVersion, type intfDocumentAsset,
  type intfDocumentRepository, type intfCommitVersion, type intfCreateDocument } from './index.js';

export enum enuDocumentJob { Process = 'document.process.v1' }
export enum enuDocumentEvent { Created = 'document.created', VersionCommitted = 'document.version.committed',
  Processed = 'document.processed', Activated = 'document.activated', Retired = 'document.retired', ProcessingFailed='document.processing.failed' }
export interface intfDocumentAuditPort {
  record(transaction: intfTransactionHandle, context: intfExecutionContext,
    action: enuDocumentEvent, resourceId: string): Promise<void>;
}
export interface intfDocumentServicePorts {
  readonly transactions: intfTransactionPort;
  readonly subject: intfExecutionSubjectPort;
  readonly repository: intfDocumentRepository;
  readonly authority: clsAuthorityService;
  readonly jobs: intfJobPort;
  readonly audit: intfDocumentAuditPort;
  readonly maxNormalizedChars: number;
}
function identifier(value: string): void {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value))
    throw new exDocument('INVALID_DOCUMENT');
}
function knowledgeContext(context: intfExecutionContext): intfExecutionContext {
  return { ...context, moduleId: 'knowledge' };
}
export class clsDocumentService {
  constructor(private readonly ports: intfDocumentServicePorts) {
    if (!Number.isSafeInteger(ports.maxNormalizedChars) || ports.maxNormalizedChars < 1)
      throw new exDocument('INVALID_DOCUMENT');
  }
  async retentionFactsWithin(tx:intfTransactionHandle,context:intfExecutionContext,id:string){return this.ports.repository.retentionFacts(tx,context,id);}
  async retainedAssets(context:intfExecutionContext,permit:intfPurgePermit):Promise<readonly intfDocumentAsset[]>{const request=resolvePurgePermit(permit,context);return this.ports.transactions.run(context,tx=>this.ports.repository.retainedAssets(tx,context,request.resourceId));}
  async purgeWithin(tx:intfTransactionHandle,context:intfExecutionContext,permit:intfPurgePermit):Promise<void>{const request=resolvePurgePermit(permit,context);if(!request.leaseToken)throw new exDocument('DOCUMENT_DENIED');await this.ports.repository.purgeContent(tx,context,request.resourceId,request.leaseToken);}
  async authorize(context: intfExecutionContext, operation: enuDocumentOperation,
    facts: intfDocumentFacts): Promise<boolean> {
    await this.ports.subject.assertActive(context);
    return facts.lifecycle === enuDocumentState.Active && (await this.ports.authority.authorize({
      context: knowledgeContext(context), path: `Knowledge.Documents.${operation}`, resource: facts
    })).decision === enuAuthorityDecision.Permit;
  }
  async facts(context: intfExecutionContext, ids: readonly string[]): Promise<readonly intfDocumentFacts[]> {
    if (ids.length > 1000) throw new exDocument('INVALID_DOCUMENT');
    ids.forEach(identifier);
    return this.ports.transactions.run(context, tx => this.ports.repository.factsBatch(tx, context, ids));
  }
  /** Factual publication fence. Authorization remains a separate Authority decision. */
  async assertSnapshotWithin(tx:intfTransactionHandle,context:intfExecutionContext,expected:readonly intfDocumentFacts[]):Promise<void>{
    await this.ports.repository.assertSnapshot(tx,context,expected);
  }
  /** Called in the transaction settling a fenced durable processing claim. No bytes are materialized. */
  async processingFailedWithin(tx:intfTransactionHandle,context:intfExecutionContext,documentId:string,versionId:string):Promise<void>{
    identifier(documentId);identifier(versionId);
    const versions=await this.ports.repository.versions(tx,context,documentId),version=versions.find(value=>value.id===versionId);
    if(!version)throw new exDocument('DOCUMENT_NOT_AVAILABLE');
    if(version.processingState!==enuVersionState.Ready)await this.ports.repository.markProcessing(tx,context,versionId,enuVersionState.Failed);
    await this.ports.audit.record(tx,context,enuDocumentEvent.ProcessingFailed,documentId);
  }
  async processingStartedWithin(tx:intfTransactionHandle,context:intfExecutionContext,documentId:string,versionId:string):Promise<void>{
    identifier(documentId);identifier(versionId);
    const versions=await this.ports.repository.versions(tx,context,documentId),version=versions.find(value=>value.id===versionId);
    if(!version)throw new exDocument('DOCUMENT_NOT_AVAILABLE');
    if(version.processingState!==enuVersionState.Ready)await this.ports.repository.markProcessing(tx,context,versionId,enuVersionState.Processing);
  }
  async authorizeMany(context: intfExecutionContext, operation: enuDocumentOperation,
    resources: readonly intfDocumentFacts[]): Promise<ReadonlyMap<string, boolean>> {
    await this.ports.subject.assertActive(context);
    const decisions = await this.ports.authority.authorizeBatch(resources.map(resource => ({
      context: knowledgeContext(context), path: `Knowledge.Documents.${operation}`, resource })));
    return new Map(resources.map((resource, index) => [resource.id, resource.lifecycle === enuDocumentState.Active
      && decisions[index]?.decision === enuAuthorityDecision.Permit]));
  }
  async operations(context: intfExecutionContext, documentId: string): Promise<Readonly<Record<enuDocumentOperation, boolean>>> {
    const facts = (await this.facts(context, [documentId]))[0];
    if (!facts || !await this.authorize(context, enuDocumentOperation.Discover, facts)) throw new exDocument('DOCUMENT_DENIED');
    const operations = Object.values(enuDocumentOperation);
    const decisions = await Promise.all(operations.map(operation => this.authorize(context, operation, facts)));
    return Object.fromEntries(operations.map((operation, index) => [operation, decisions[index]!])) as Record<enuDocumentOperation, boolean>;
  }
  async create(context: intfExecutionContext, input: intfCreateDocument): Promise<intfDocumentView> {
    await this.ports.subject.assertActive(context);
    identifier(input.id);
    if (!input.title.trim() || input.title.length > 256 || !context.actorId)
      throw new exDocument('INVALID_DOCUMENT');
    const decision = await this.ports.authority.authorize({ context: knowledgeContext(context),
      path: `Knowledge.Documents.${enuDocumentOperation.Manage}`,
      resource: { type: 'document', id: input.id, tenantId: context.tenantId,
        ownerId: context.actorId, classification: input.classification } });
    if (decision.decision !== enuAuthorityDecision.Permit) throw new exDocument('DOCUMENT_DENIED');
    return this.ports.transactions.run(context, async tx => {
      await this.ports.repository.create(tx, context, input);
      await this.ports.audit.record(tx, context, enuDocumentEvent.Created, input.id);
      return { id: input.id, title: input.title, currentVersionId: null, lifecycle: enuDocumentState.Active };
    });
  }
  async list(context: intfExecutionContext, cursor: string | null, limit: number): Promise<intfCursorPage<intfDocumentView>> {
    if (cursor) identifier(cursor);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new exDocument('INVALID_DOCUMENT');
    return this.ports.transactions.run(context, async tx => {
      const visible: intfDocumentView[] = [];
      let after = cursor;
      let hasMore = true;
      for (let scanned = 0; scanned < 1000 && visible.length < limit; scanned += 100) {
        const batch = await this.ports.repository.list(tx, context, after, 100);
        if (!batch.length) { hasMore = false; break; }
        const facts = await this.ports.repository.factsBatch(tx, context, batch.map(document => document.id));
        const permitted = await this.authorizeMany(context, enuDocumentOperation.Discover, facts);
        for (const document of batch) {
          after = document.id;
          if (permitted.get(document.id)) visible.push(document);
          if (visible.length === limit) break;
        }
        if (batch.length < 100 && after === batch.at(-1)?.id) { hasMore = false; break; }
      }
      return { items: visible, hasMore, nextCursor: hasMore ? after : null };
    });
  }
  private async require(transaction: intfTransactionHandle, context: intfExecutionContext,
    documentId: string, operation: enuDocumentOperation): Promise<intfDocumentFacts> {
    identifier(documentId);
    const facts = await this.ports.repository.facts(transaction, context, documentId);
    if (!facts || !await this.authorize(context, operation, facts)) throw new exDocument('DOCUMENT_DENIED');
    return facts;
  }
  /** File Management invokes this inside its transfer/usage transaction after byte verification. */
  async commitVersion(transaction: intfTransactionHandle, context: intfExecutionContext,
    input: intfCommitVersion): Promise<intfDocumentVersion> {
    await this.require(transaction, context, input.documentId, enuDocumentOperation.Manage);
    identifier(input.versionId); identifier(input.asset.id);
    if (input.asset.documentId !== input.documentId || input.asset.versionId !== input.versionId
      || input.asset.lifecycle !== enuAssetState.Approved || !input.sourceIdentity || input.sourceIdentity.length > 256)
      throw new exDocument('INVALID_DOCUMENT');
    const version = await this.ports.repository.commitVersion(transaction, context, input);
    await this.ports.jobs.schedule(transaction, { id: randomUUID(), kind: enuDocumentJob.Process,
      idempotencyKey: `${enuDocumentJob.Process}:${version.id}`, payloadVersion: 1,
      payload: { documentId: input.documentId, versionId: version.id }, subject: knowledgeContext(context), maxAttempts: 5 });
    await this.ports.audit.record(transaction, context, enuDocumentEvent.VersionCommitted, version.id);
    return version;
  }
  async versions(context: intfExecutionContext, documentId: string): Promise<readonly intfDocumentVersion[]> {
    return this.ports.transactions.run(context, async tx => {
      await this.require(tx, context, documentId, enuDocumentOperation.Discover);
      return this.ports.repository.versions(tx, context, documentId);
    });
  }
  async asset(context: intfExecutionContext, documentId: string, versionId: string,
    operation: enuDocumentOperation): Promise<intfDocumentAsset> {
    identifier(versionId);
    return this.ports.transactions.run(context, async tx => {
      await this.require(tx, context, documentId, operation);
      const asset = await this.ports.repository.asset(tx, context, documentId, versionId);
      if (!asset || asset.lifecycle !== enuAssetState.Approved) throw new exDocument('DOCUMENT_NOT_AVAILABLE');
      return asset;
    });
  }
  async normalized(context: intfExecutionContext, documentId: string, versionId: string,
    operation: enuDocumentOperation): Promise<string> {
    if (operation !== enuDocumentOperation.Read && operation !== enuDocumentOperation.Use
      && operation !== enuDocumentOperation.Quote) throw new exDocument('INVALID_DOCUMENT');
    identifier(versionId);
    return this.ports.transactions.run(context, async tx => {
      await this.ports.authority.lockSnapshot(tx,knowledgeContext(context));
      const locked=await this.ports.repository.facts(tx,context,documentId);
      if(!locked)throw new exDocument('DOCUMENT_DENIED');
      await this.ports.repository.assertSnapshot(tx,context,[locked]);
      const facts = await this.require(tx, context, documentId, operation);
      if (facts.currentVersionId !== versionId) throw new exDocument('STALE_DOCUMENT');
      const text = await this.ports.repository.normalized(tx, context, versionId);
      if (text === null) throw new exDocument('VERSION_NOT_READY');
      return text;
    });
  }
  async normalizedVersions(context: intfExecutionContext, references: readonly Readonly<{ documentId: string; versionId: string }>[],
    operation: enuDocumentOperation): Promise<ReadonlyMap<string, string>> {
    if (operation !== enuDocumentOperation.Use && operation !== enuDocumentOperation.Read && operation !== enuDocumentOperation.Quote
      || references.length > 1000) throw new exDocument('INVALID_DOCUMENT');
    for (const reference of references) { identifier(reference.documentId); identifier(reference.versionId); }
    const unique = [...new Set(references.map(reference => reference.documentId))];
    return this.ports.transactions.run(context, async tx => {
      await this.ports.authority.lockSnapshot(tx,knowledgeContext(context));
      const facts=await this.ports.repository.factsBatch(tx,context,unique);
      await this.ports.repository.assertSnapshot(tx,context,facts);
      const permitted=await this.authorizeMany(context,operation,facts);
      if(unique.some(id=>!permitted.get(id)))throw new exDocument('DOCUMENT_DENIED');
      const versions = await this.ports.repository.normalizedBatch(tx, context, references.map(reference => reference.versionId));
      const byId = new Map(versions.map(version => [version.versionId, version]));
      const texts = new Map<string, string>();
      for (const reference of references) {
        const version = byId.get(reference.versionId);
        if (!version || version.documentId !== reference.documentId || version.state !== enuVersionState.Ready
          || createHash('sha256').update(version.text).digest('hex') !== version.sha256) throw new exDocument('VERSION_NOT_READY');
        texts.set(reference.versionId, version.text);
      }
      return texts;
    });
  }
  async processed(context: intfExecutionContext, documentId: string, versionId: string,
    text: string, processor: string): Promise<void> {
    return this.ports.transactions.run(context, tx => this.processedWithin(tx, context, documentId, versionId, text, processor));
  }
  async processedWithin(tx: intfTransactionHandle, context: intfExecutionContext, documentId: string, versionId: string,
    text: string, processor: string): Promise<void> {
    identifier(versionId);
    if (!text.trim() || text.length > this.ports.maxNormalizedChars || !/^[A-Za-z0-9._:-]{1,128}$/u.test(processor))
      throw new exDocument('INVALID_DOCUMENT');
      await this.require(tx, context, documentId, enuDocumentOperation.Manage);
      const asset = await this.ports.repository.asset(tx, context, documentId, versionId);
      if (!asset) throw new exDocument('DOCUMENT_NOT_AVAILABLE');
      await this.ports.repository.recordProcessed(tx, context, versionId, text, processor,
        createHash('sha256').update(text).digest('hex'));
      await this.ports.audit.record(tx, context, enuDocumentEvent.Processed, versionId);
  }
  async publishWithin(tx: intfTransactionHandle, context: intfExecutionContext, documentId: string, versionId: string): Promise<void> {
    const facts = await this.require(tx, context, documentId, enuDocumentOperation.Manage);
    const asset = await this.ports.repository.asset(tx, context, documentId, versionId);
    if (!asset) throw new exDocument('DOCUMENT_NOT_AVAILABLE');
    await this.ports.repository.markProcessing(tx, context, versionId, enuVersionState.Ready);
    if (facts.currentVersionId && facts.currentVersionId !== versionId) {
      const versions = await this.ports.repository.versions(tx, context, documentId);
      const current = versions.find(value => value.id === facts.currentVersionId), requested = versions.find(value => value.id === versionId);
      if (current && requested && current.sequence > requested.sequence) return;
    }
    await this.ports.repository.activate(tx, context, versionId);
    await this.ports.audit.record(tx, context, enuDocumentEvent.Activated, versionId);
  }
  async activate(context: intfExecutionContext, documentId: string, versionId: string): Promise<void> {
    identifier(versionId);
    await this.ports.transactions.run(context, async tx => {
      await this.require(tx, context, documentId, enuDocumentOperation.Manage);
      const versions = await this.ports.repository.versions(tx, context, documentId);
      if (!versions.some(version => version.id === versionId && version.processingState === enuVersionState.Ready))
        throw new exDocument('VERSION_NOT_READY');
      await this.ports.repository.activate(tx, context, versionId);
      await this.ports.audit.record(tx, context, enuDocumentEvent.Activated, versionId);
    });
  }
  async retire(context: intfExecutionContext, documentId: string): Promise<void> {
    await this.ports.transactions.run(context, async tx => {
      await this.require(tx, context, documentId, enuDocumentOperation.Manage);
      await this.ports.repository.retire(tx, context, documentId);
      await this.ports.audit.record(tx, context, enuDocumentEvent.Retired, documentId);
    });
  }
}

import {resolvePurgePermit,type intfPurgePermit} from '../../data-governance/src/retention.js';
import {clsMalwarePolicy,enuMalwareMode,exMalware,type intfMalwarePort} from '../../file-processing/src/malware.js';
import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { intfExecutionContext } from '../../contracts/src/index.js';
import type { intfExecutionSubjectPort } from '../../contracts/src/execution-subject.js';
import type { intfTransactionHandle, intfTransactionPort } from '../../contracts/src/transaction.js';
import type { typFileManagementConfiguration, intfFileActorLimits } from '../../configuration/src/index.js';
import { enuDocumentOperation, enuAssetState, type intfDocumentVersion } from '../../documents/src/index.js';
import type { clsDocumentService } from '../../documents/src/service.js';
import type { intfJobPort } from '../../jobs/src/index.js';
import { enuStorageOutcome, type intfStoragePort, type intfStorageDescriptor } from '../../storage/src/index.js';
import { displayFilename, validateFileMetadata, inspectFile, extractText, exFileProcessing, type intfFileLimits, type intfExtractedText } from '../../file-processing/src/index.js';
import { enuFileReservationKind, enuFileReservationState, type intfFileAdmissionPort } from '../../admission-control/src/files.js';
import type { intfFileUsagePort } from '../../usage/src/files.js';
import type { intfSemanticAuditPort } from '../../audit/src/semantic.js';
import { enuTransferState, enuFileEvent, exFileManagement, type intfFileManagement, type intfUploadRequest,
  type intfTransferView, type intfDownloadRequest, type intfDownload } from './index.js';
import { enuTransferOperation, type intfFileTransfer, type intfTransferRepository } from './transfers.js';
import { clsFileCache } from './cache.js';
import { clsFileStaging } from './staging.js';
import { parseByteRange } from './range.js';

export enum enuFileJob { Reconcile = 'file.reconcile.v1', Expire = 'file.expire.v1' }
export interface intfFileManagementPorts {
  readonly transactions: intfTransactionPort;
  readonly subject: intfExecutionSubjectPort;
  readonly documents: clsDocumentService;
  readonly transfers: intfTransferRepository;
  readonly storage: intfStoragePort;
  readonly jobs: intfJobPort;
  readonly admission: intfFileAdmissionPort;
  readonly usage: intfFileUsagePort;
  readonly audit: intfSemanticAuditPort;
  readonly configuration: Extract<typFileManagementConfiguration, { enabled: true }>;
  readonly limits: intfFileLimits;
  readonly malware?:intfMalwarePort;
  readonly expiryAuthority?: {authorize(context:intfExecutionContext,transferId:string):Promise<boolean>};
  readonly actorLimits?: (context:intfExecutionContext,documentId:string)=>Promise<intfFileActorLimits>;
}
function transferView(value: intfFileTransfer): intfTransferView {
  return { id: value.id, documentId: value.documentId, state: value.state, partBytes: value.partBytes,
    acceptedParts: value.parts.map(part => part.number), expiresAt: value.expiresAt,
    versionId: value.versionId, errorClass: value.errorClass };
}
function descriptor(value: intfFileTransfer): intfStorageDescriptor {
  return { key: value.storageKey, sha256: value.sha256, bytes: value.bytes, mediaType: value.mediaType };
}
function identifier(value: string): void {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value))
    throw new exFileManagement('INVALID_TRANSFER');
}
/** Logical, in-process capability. Only this owner materializes managed Storage bytes. */
export class clsFileManagement implements intfFileManagement {
  async ready():Promise<void>{await Promise.all([this.ports.storage.ready(),this.staging.ready(),this.cache.ready()]);if(this.ports.configuration.security.malware?.mode===enuMalwareMode.Required&&(!this.ports.malware||!await this.ports.malware.ready()))throw new exMalware('MALWARE_SCANNER_UNAVAILABLE');}
  async malwareReadiness():Promise<'READY'|'UNAVAILABLE'|'LOW_ASSURANCE'>{const mode=this.ports.configuration.security.malware?.mode??enuMalwareMode.Disabled;return mode===enuMalwareMode.Disabled?'LOW_ASSURANCE':await this.ports.malware?.ready()?'READY':'UNAVAILABLE';}
  private scan(context:intfExecutionContext,path:string):Promise<void>{const configuration=this.ports.configuration.security.malware;return new clsMalwarePolicy(configuration?.mode??enuMalwareMode.Disabled,this.ports.malware,async evidence=>{await this.ports.transactions.run(context,tx=>this.ports.audit.record(tx,context,{action:'file.malware.scanned',result:evidence.result==='CLEAN'?'SUCCEEDED':'FAILED',reason:evidence.result,resource:{type:'malware_policy',id:evidence.policyVersion}}));},configuration?.policyVersion).inspect(path);}
  private readonly cache: clsFileCache;
  private readonly staging: clsFileStaging;
  constructor(private readonly ports: intfFileManagementPorts) {
    if(!ports.configuration.security.malware)throw new exMalware('MALWARE_SCANNER_UNAVAILABLE');
    this.cache = new clsFileCache(ports.configuration.cache);
    this.staging = new clsFileStaging({ ...ports.configuration.staging, timeoutMs: ports.configuration.uploads.timeoutMs });
  }
  async activeMaterializationsWithin(tx:intfTransactionHandle,context:intfExecutionContext):Promise<boolean>{return this.ports.admission.activeWithin(tx,context);}
  async purge(context:intfExecutionContext,permit:intfPurgePermit):Promise<void>{
    const request=resolvePurgePermit(permit,context);if(!request.leaseToken||!this.ports.storage.purge)throw new exFileManagement('FILE_DENIED');
    const assets=await this.ports.documents.retainedAssets(context,permit),transfers=await this.ports.transactions.run(context,tx=>this.ports.transfers.purgePlan(tx,context,request.resourceId));
    for(const asset of assets){if(asset.storageProfile!==this.ports.configuration.storage.profileId)throw new exFileManagement('FILE_STORAGE_UNAVAILABLE');await this.cache.purge({deploymentId:context.deploymentId,tenantId:context.tenantId,assetId:asset.id,versionId:asset.versionId,representation:'ORIGINAL'},asset.sha256);await this.ports.storage.purge(asset.storageKey);}
    for(const transfer of transfers){const remote=transfer.remoteUploadId??await this.ports.storage.reconcileBegin(transfer.storageKey,transfer.id);if(remote)await this.ports.storage.abort(transfer.storageKey,remote);await this.ports.storage.purge(transfer.storageKey);}
    await this.ports.transactions.run(context,async tx=>{for(const transfer of transfers)await this.ports.admission.purgedWithin(tx,context,transfer.id);await this.ports.transfers.purgeMetadata(tx,context,request.resourceId,request.leaseToken!);});
  }
  private leaseMs(): number { return Math.min(900000, this.ports.configuration.uploads.timeoutMs * 3 + 5000); }
  private async require(context: intfExecutionContext, documentId: string, operation: enuDocumentOperation): Promise<void> {
    await this.ports.subject.assertActive(context);
    const facts = (await this.ports.documents.facts(context, [documentId]))[0];
    if (!facts || !await this.ports.documents.authorize(context, operation, facts)) throw new exFileManagement('FILE_DENIED');
  }
  private async find(context: intfExecutionContext, id: string): Promise<intfFileTransfer> {
    identifier(id); await this.ports.subject.assertActive(context);
    const found = await this.ports.transactions.run(context, tx => this.ports.transfers.find(tx, context, id));
    if (!found || found.storageProfile !== this.ports.configuration.storage.profileId) throw new exFileManagement('FILE_DENIED');
    await this.require(context, found.documentId, enuDocumentOperation.Manage);
    return found;
  }
  private async job(tx: intfTransactionHandle, context: intfExecutionContext, value: intfFileTransfer, kind: enuFileJob): Promise<void> {
    await this.ports.jobs.schedule(tx, { id: randomUUID(), kind, idempotencyKey: `${kind}:${value.id}:${value.remoteUploadId ? 'completion' : 'initiation'}`,
      payloadVersion: 1, payload: { transferId: value.id }, subject: context, maxAttempts: 10,
      notBefore: kind === enuFileJob.Expire ? value.expiresAt : new Date(Date.now() + 1000).toISOString() });
  }
  async initiate(context: intfExecutionContext, input: intfUploadRequest): Promise<intfTransferView> {
    await this.require(context, input.documentId, enuDocumentOperation.Manage);
    const actorLimits = await this.ports.actorLimits?.(context,input.documentId);
    const filename = displayFilename(input.filename);
    validateFileMetadata({ originalname: filename, mimetype: input.mediaType, size: input.bytes }, this.ports.limits);
    if (filename !== input.filename || !Number.isSafeInteger(input.bytes) || input.bytes < 1
      || input.bytes > Math.min(this.ports.configuration.uploads.maxBytes,actorLimits?.maxBytes??Infinity) || !/^[a-f0-9]{64}$/u.test(input.sha256)
      || !/^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/u.test(input.mediaType)
      || !/^[A-Za-z0-9._:-]{1,128}$/u.test(input.idempotencyKey)) throw new exFileManagement('INVALID_TRANSFER');
    const value = await this.ports.transactions.run(context, async tx => {
      const transfer = await this.ports.transfers.create(tx, context, { ...input, id: randomUUID(), assetId: randomUUID(),
        proposedVersionId: randomUUID(), storageKey: `${createHash('sha256').update(`${context.deploymentId}:${context.tenantId}`).digest('hex')}/${randomUUID()}`,
        storageProfile: this.ports.configuration.storage.profileId, partBytes: this.ports.configuration.uploads.partBytes,
        expiresAt: new Date(Date.now() + this.ports.configuration.uploads.ttlMs).toISOString() });
      if (transfer.state !== enuTransferState.Initiated) return transfer;
      await this.ports.admission.reserve(tx, context, {...this.ports.configuration.uploads,...(actorLimits?{actorLimits}:{})},
        { id: transfer.id, kind: enuFileReservationKind.Upload, bytes: transfer.bytes, expiresAt: transfer.expiresAt });
      await this.job(tx, context, transfer, enuFileJob.Expire);
      await this.ports.audit.record(tx, context, { action: enuFileEvent.UploadInitiated, result: 'REQUESTED', resource: { type: 'transfer', id: transfer.id } });
      return transfer;
    });
    if (value.state !== enuTransferState.Initiated) return transferView(value);
    const claim = await this.ports.transactions.run(context, tx => this.ports.transfers.lease(tx, context, value.id,
      [enuTransferState.Initiated], enuTransferOperation.Begin, this.leaseMs()));
    if (!claim) return this.status(context, value.id);
    // BEGIN intent is durable before the remote call. A crash cannot trigger a second BEGIN.
    await this.ports.transactions.run(context, async tx => {
      await this.ports.transfers.update(tx, context, claim.id, claim.leaseToken!,
        { state: enuTransferState.Unresolved, releaseLease: false, errorClass: 'REMOTE_OUTCOME_UNRESOLVED' });
      await this.job(tx, context, claim, enuFileJob.Reconcile);
    });
    const result = await this.ports.storage.begin(descriptor(claim), claim.id);
    await this.ports.transactions.run(context, async tx => {
      await this.ports.transfers.update(tx, context, claim.id, claim.leaseToken!,
        result.kind === enuStorageOutcome.Success && result.uploadId
          ? { state: enuTransferState.Uploading, remoteUploadId: result.uploadId }
          : { state: enuTransferState.Unresolved, errorClass: 'REMOTE_OUTCOME_UNRESOLVED' });
    });
    return this.status(context, claim.id);
  }
  async status(context: intfExecutionContext, id: string): Promise<intfTransferView> { return transferView(await this.find(context, id)); }
  async uploadPart(context: intfExecutionContext, id: string, number: number, sha256: string, bytes: Uint8Array,
    signal?: AbortSignal): Promise<intfTransferView> {
    const found = await this.find(context, id);
    if (!Number.isInteger(number) || !/^[a-f0-9]{64}$/u.test(sha256) || bytes.byteLength > found.partBytes
      || createHash('sha256').update(bytes).digest('hex') !== sha256) throw new exFileManagement('FILE_INTEGRITY_FAILURE');
    const claim = await this.ports.transactions.run(context, tx => this.ports.transfers.lease(tx, context, id,
      [enuTransferState.Uploading, enuTransferState.Uploaded], enuTransferOperation.Part, this.leaseMs()));
    if (!claim || !claim.remoteUploadId) throw new exFileManagement('TRANSFER_IN_PROGRESS');
    const part = { number, sha256, bytes: bytes.byteLength, etag: '' };
    await this.ports.transactions.run(context, async tx => {
      await this.ports.transfers.update(tx, context, id, claim.leaseToken!, { state: enuTransferState.Uploading, releaseLease: false });
      await this.ports.transfers.reservePart(tx, context, id, claim.leaseToken!, part);
    });
    try {
      const accepted = await this.ports.storage.writePart(claim.storageKey, claim.remoteUploadId, part, bytes, signal);
      await this.ports.subject.assertActive(context);
      await this.require(context, claim.documentId, enuDocumentOperation.Manage);
      await this.ports.transactions.run(context, async tx => {
        await this.ports.transfers.acceptPart(tx, context, id, claim.leaseToken!, accepted);
        const latest = await this.ports.transfers.find(tx, context, id);
        await this.ports.transfers.update(tx, context, id, claim.leaseToken!, { state: latest?.parts.length === Math.ceil(claim.bytes / claim.partBytes)
          ? enuTransferState.Uploaded : enuTransferState.Uploading });
      });
    } catch (error) {
      // Identical part retry is safe: canonical checksum intent prevents replacement with other bytes.
      await this.ports.transactions.run(context, tx => this.ports.transfers.update(tx, context, id, claim.leaseToken!,
        { state: enuTransferState.Uploading, errorClass: 'PART_OUTCOME_UNRESOLVED' })).catch(() => undefined);
      throw error;
    }
    return this.status(context, id);
  }
  async complete(context: intfExecutionContext, id: string): Promise<intfDocumentVersion | intfTransferView> {
    const found = await this.find(context, id);
    if (found.state === enuTransferState.Committed) return transferView(found);
    if (found.state === enuTransferState.Unresolved || found.state === enuTransferState.Verifying) return this.reconcile(context, id);
    const claim = await this.ports.transactions.run(context, tx => this.ports.transfers.lease(tx, context, id,
      [enuTransferState.Uploaded], enuTransferOperation.Complete, this.leaseMs()));
    if (!claim || !claim.remoteUploadId) throw new exFileManagement('TRANSFER_IN_PROGRESS');
    const observed = await this.ports.storage.parts(claim.storageKey, claim.remoteUploadId);
    if (observed.length !== claim.parts.length || observed.some((part, index) => {
      const intent = claim.parts[index];
      return !intent || part.number !== intent.number || part.bytes !== intent.bytes || part.etag !== intent.etag
        || (part.sha256 !== null && part.sha256 !== intent.sha256);
    })) throw new exFileManagement('FILE_INTEGRITY_FAILURE');
    await this.ports.transactions.run(context, async tx => {
      await this.ports.transfers.update(tx, context, id, claim.leaseToken!, { state: enuTransferState.Verifying, releaseLease: false });
      await this.job(tx, context, claim, enuFileJob.Reconcile);
    });
    const result = await this.ports.storage.complete(descriptor(claim), claim.remoteUploadId, claim.parts);
    if (result.kind !== enuStorageOutcome.Success) {
      await this.ports.transactions.run(context, async tx => {
        await this.ports.transfers.update(tx, context, id, claim.leaseToken!,
          { state: enuTransferState.Unresolved, errorClass: 'REMOTE_OUTCOME_UNRESOLVED' });
      });
      return this.status(context, id);
    }
    return this.verifyAndCommit(context, claim);
  }
  async reconcile(context: intfExecutionContext, id: string): Promise<intfTransferView | intfDocumentVersion> {
    const found = await this.find(context, id);
    if (found.state === enuTransferState.Committed || found.state === enuTransferState.Failed || found.state === enuTransferState.Expired)
      return transferView(found);
    const claim = await this.ports.transactions.run(context, tx => this.ports.transfers.lease(tx, context, id,
      [enuTransferState.Unresolved, enuTransferState.Verifying], enuTransferOperation.Reconcile, this.leaseMs()));
    if (!claim) throw new exFileManagement('TRANSFER_IN_PROGRESS');
    const stored = await this.ports.storage.inspect(claim.storageKey);
    if (stored) return this.verifyAndCommit(context, claim);
    const uploadId = claim.remoteUploadId ?? await this.ports.storage.reconcileBegin(claim.storageKey, claim.id);
    await this.ports.transactions.run(context, tx => this.ports.transfers.update(tx, context, id, claim.leaseToken!,
      uploadId && !claim.remoteUploadId ? { state: enuTransferState.Uploading, remoteUploadId: uploadId }
        : { state: enuTransferState.Unresolved, errorClass: 'REMOTE_OUTCOME_UNRESOLVED' }));
    return this.status(context, id);
  }
  private async verifyAndCommit(context: intfExecutionContext, claim: intfFileTransfer): Promise<intfDocumentVersion> {
    const stored = await this.ports.storage.inspect(claim.storageKey);
    if (!stored || stored.bytes !== claim.bytes || stored.sha256 !== claim.sha256 || stored.mediaType !== claim.mediaType)
      throw new exFileManagement('FILE_INTEGRITY_FAILURE');
    try {
      await this.staging.withVerifiedFile(claim, () => this.ports.storage.open(claim.storageKey), async path => {await inspectFile({path,originalname:claim.filename,mimetype:claim.mediaType,size:claim.bytes},this.ports.limits);await this.scan(context,path);});
    } catch (error) {
      if (!(error instanceof exFileProcessing) && !(error instanceof exMalware&&error.code==='MALWARE_REJECTED') && !(error instanceof exFileManagement && error.code === 'FILE_INTEGRITY_FAILURE')) {
        await this.ports.transactions.run(context, tx => this.ports.transfers.update(tx, context, claim.id, claim.leaseToken!,
          { state: enuTransferState.Unresolved, errorClass: 'FILE_STORAGE_UNAVAILABLE' }));
        throw new exFileManagement('FILE_STORAGE_UNAVAILABLE');
      }
      // Bad candidate bytes remain private and charged until Governance authorizes purge.
      await this.ports.transactions.run(context, async tx => {
        await this.ports.transfers.update(tx, context, claim.id, claim.leaseToken!, { state: enuTransferState.Failed, errorClass: 'FILE_INTEGRITY_FAILURE' });
        await this.ports.admission.finish(tx, context, claim.id, enuFileReservationState.Committed);
        await this.ports.usage.record(tx, context, { operationId: claim.id, uploadedBytes: claim.bytes, downloadedBytes: 0,
          storageBytes: claim.bytes, files: 1, processingBytes: 0 });
        await this.ports.audit.record(tx, context, { action: enuFileEvent.Quarantined, result: 'DENIED', reason: 'FILE_INTEGRITY_FAILURE', resource: { type: 'transfer', id: claim.id } });
      });
      throw new exFileManagement('FILE_INTEGRITY_FAILURE');
    }
    await this.require(context, claim.documentId, enuDocumentOperation.Manage);
    const actorLimits = await this.ports.actorLimits?.(context,claim.documentId);
    if (actorLimits && claim.bytes > actorLimits.maxBytes) throw new exFileManagement('FILE_DENIED');
    return this.ports.transactions.run(context, async tx => {
      // Transfer's live lease fences a replaced/crashed API before any canonical write.
      await this.ports.transfers.update(tx, context, claim.id, claim.leaseToken!,
        { state: enuTransferState.Committed, versionId: claim.proposedVersionId });
      const version = await this.ports.documents.commitVersion(tx, context, { documentId: claim.documentId,
        versionId: claim.proposedVersionId, sourceIdentity: `transfer:${claim.id}`, asset: {
          id: claim.assetId, documentId: claim.documentId, versionId: claim.proposedVersionId,
          storageKey: claim.storageKey, storageProfile: claim.storageProfile, sha256: claim.sha256,
          bytes: claim.bytes, mediaType: claim.mediaType, filename: claim.filename, lifecycle: enuAssetState.Approved } });
      await this.ports.admission.finish(tx, context, claim.id, enuFileReservationState.Committed);
      await this.ports.usage.record(tx, context, { operationId: claim.id, uploadedBytes: claim.bytes, downloadedBytes: 0,
        storageBytes: claim.bytes, files: 1, processingBytes: 0 });
      for (const action of [enuFileEvent.UploadCompleted, enuFileEvent.AssetCommitted, enuFileEvent.VersionCreated])
        await this.ports.audit.record(tx, context, { action, result: 'SUCCEEDED', resource: { type: 'version', id: version.id } });
      return version;
    });
  }
  async download(context: intfExecutionContext, request: intfDownloadRequest): Promise<intfDownload> {
    await this.ports.subject.assertActive(context);
    let asset;
    try { asset = await this.ports.documents.asset(context, request.documentId, request.versionId, enuDocumentOperation.Download); }
    catch {
      await this.ports.transactions.run(context, tx => this.ports.audit.record(tx, context,
        { action: enuFileEvent.DownloadDenied, result: 'DENIED', reason: 'FILE_DENIED' }));
      throw new exFileManagement('FILE_DENIED');
    }
    if (asset.storageProfile !== this.ports.configuration.storage.profileId) throw new exFileManagement('FILE_STORAGE_UNAVAILABLE');
    const facts = (await this.ports.documents.facts(context, [request.documentId]))[0];
    const discover = facts && await this.ports.documents.authorize(context, enuDocumentOperation.Discover, facts);
    const etag = `"${asset.sha256}"`, headers: Record<string, string> = {
      'Cache-Control': 'private, no-store, max-age=0', 'Pragma': 'no-cache', 'Vary': 'Cookie, Authorization',
      'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Type': asset.mediaType.startsWith('text/') ? `${asset.mediaType}; charset=utf-8` : asset.mediaType,
      'Content-Disposition': `attachment; filename="file"${discover ? `; filename*=UTF-8''${encodeURIComponent(asset.filename).replace(/['()*]/gu, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}` : ''}`, ETag: etag
    };
    const downloadFence=async()=>{
      await this.ports.subject.assertActive(context);
      const fresh=(await this.ports.documents.facts(context,[request.documentId]))[0];
      if(!facts||!fresh||fresh.securityVersion!==facts.securityVersion||fresh.currentVersionId!==facts.currentVersionId||!await this.ports.documents.authorize(context,enuDocumentOperation.Download,fresh))throw new exFileManagement('FILE_DENIED');
    };
    const operationId = randomUUID();
    await this.ports.transactions.run(context, tx => this.ports.audit.record(tx, context,
      { action: enuFileEvent.DownloadRequested, result: 'REQUESTED', resource: { type: 'asset', id: asset.id } }));
    if (this.ports.configuration.downloads.conditional && request.ifNoneMatch === etag) {
      await downloadFence();
      await this.ports.transactions.run(context, tx => this.ports.audit.record(tx, context,
        { action: enuFileEvent.DownloadCompleted, result: 'SUCCEEDED', resource: { type: 'asset', id: asset.id } }));
      return { status: 304, headers };
    }
    const range = this.ports.configuration.downloads.ranges && (!request.ifRange || request.ifRange === etag)
      ? parseByteRange(request.range, asset.bytes) : null;
    const size = range?.bytes ?? asset.bytes;
    await this.ports.transactions.run(context, tx => this.ports.admission.reserve(tx, context,
      { ...this.ports.configuration.uploads, maxConcurrent: this.ports.configuration.downloads.maxConcurrent },
      { id: operationId, kind: enuFileReservationKind.Download, bytes: size,
        expiresAt: new Date(Date.now() + this.ports.configuration.uploads.timeoutMs).toISOString() }));
    let cached;
    try {
      if(this.ports.configuration.security.malware?.mode!==undefined&&this.ports.configuration.security.malware.mode!==enuMalwareMode.Disabled)await this.staging.withVerifiedFile(asset,()=>this.ports.storage.open(asset.storageKey),path=>this.scan(context,path));
      cached = await this.cache.open({ deploymentId: context.deploymentId, tenantId: context.tenantId,
        assetId: asset.id, versionId: asset.versionId, representation: 'ORIGINAL' }, asset,
        () => this.ports.storage.open(asset.storageKey), range ?? undefined);
      if (cached.corruptionRecovered) await this.ports.transactions.run(context, tx => this.ports.audit.record(tx, context,
        { action: enuFileEvent.CacheIntegrityFailure, result: 'FAILED', reason: 'CACHE_CORRUPT', resource: { type: 'asset', id: asset.id } }));
      await this.require(context, asset.documentId, enuDocumentOperation.Download);
    } catch (error) {
      cached?.body.destroy();
      await this.ports.transactions.run(context, async tx => {
        await this.ports.admission.finish(tx, context, operationId, enuFileReservationState.Released);
        const denied=error instanceof exFileManagement&&error.code==='FILE_DENIED';
        await this.ports.audit.record(tx, context, { action: denied?enuFileEvent.DownloadDenied:enuFileEvent.StorageFailure,
          result:denied?'DENIED':'FAILED',reason:denied?'FILE_DENIED':'FILE_STORAGE_UNAVAILABLE',resource:{type:'asset',id:asset.id} });
      });
      if(error instanceof exFileManagement || (error instanceof Error && ['EXECUTION_SUBJECT_INACTIVE','INVALID_EXECUTION_SUBJECT'].includes(error.message)))throw error;
      throw new exFileManagement('FILE_STORAGE_UNAVAILABLE');
    }
    headers['Content-Length'] = String(size);
    if (this.ports.configuration.downloads.ranges) headers['Accept-Ranges'] = 'bytes';
    if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${asset.bytes}`;
    const ports = this.ports, source = cached.body;
    let sent = 0, completed = false, settlement: Promise<void> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (): Promise<void> => {
      if (timer) clearTimeout(timer);
      source.destroy();
      return settlement ??= ports.transactions.run(context, async tx => {
        await ports.admission.finish(tx, context, operationId, enuFileReservationState.Released);
        await ports.usage.record(tx, context, { operationId, uploadedBytes: 0, downloadedBytes: sent, storageBytes: 0, files: 0, processingBytes: 0 });
        await ports.audit.record(tx, context, { action: enuFileEvent.DownloadCompleted, result: completed ? 'SUCCEEDED' : 'FAILED',
          ...(completed ? {} : { reason: 'TRANSFER_INTERRUPTED' }), resource: { type: 'asset', id: asset.id } });
      });
    };
    const body = Readable.from((async function* () {
      try {
        for await (const chunk of source) { await downloadFence(); sent += chunk.length; yield chunk; }
        completed = sent === size;
      } finally {
        await finish();
      }
    })(), { objectMode: false });
    const destroy = body._destroy.bind(body);
    body._destroy = (error, callback) => {
      const done = finish();
      destroy(error, failure => { void done.then(() => callback(failure), failure => callback(failure instanceof Error ? failure : new Error('DOWNLOAD_SETTLEMENT_FAILED'))); });
    };
    // Also close an authorized body that the caller never starts consuming.
    timer = setTimeout(() => body.destroy(), this.ports.configuration.uploads.timeoutMs); timer.unref();
    return { status: range ? 206 : 200, headers, body };
  }
  async materialize(context: intfExecutionContext, documentId: string, versionId: string): Promise<string> {
    await this.ports.subject.assertActive(context);
    return this.ports.documents.normalized(context, documentId, versionId, enuDocumentOperation.Use);
  }
  async materializeBatch(context: intfExecutionContext,
    references: readonly Readonly<{ documentId: string; versionId: string }>[]): Promise<ReadonlyMap<string, string>> {
    await this.ports.subject.assertActive(context);
    return this.ports.documents.normalizedVersions(context, references, enuDocumentOperation.Use);
  }
  async read(context: intfExecutionContext, documentId: string, versionId: string): Promise<string> {
    const values = await this.ports.documents.normalizedVersions(context, [{ documentId, versionId }], enuDocumentOperation.Read);
    return values.get(versionId)!;
  }
  async extract(context: intfExecutionContext, documentId: string, versionId: string): Promise<intfExtractedText> {
    await this.require(context, documentId, enuDocumentOperation.Manage);
    const asset = await this.ports.documents.asset(context, documentId, versionId, enuDocumentOperation.Use);
    if (asset.storageProfile !== this.ports.configuration.storage.profileId) throw new exFileManagement('FILE_STORAGE_UNAVAILABLE');
    const operationId = randomUUID();
    await this.ports.transactions.run(context, async tx => {
      await this.ports.admission.reserve(tx, context, this.ports.configuration.uploads,
        { id: operationId, kind: enuFileReservationKind.Processing, bytes: asset.bytes,
          expiresAt: new Date(Date.now() + this.leaseMs()).toISOString() });
      await this.ports.audit.record(tx, context, { action: enuFileEvent.ProcessingRequested, result: 'REQUESTED', resource: { type: 'version', id: versionId } });
    });
    let processed = false, succeeded = false;
    try {
      const parsed = await this.staging.withVerifiedFile(asset, () => this.ports.storage.open(asset.storageKey), async path => {
        await this.scan(context,path);
        processed = true;
        return extractText({ path, originalname: asset.filename, mimetype: asset.mediaType, size: asset.bytes }, this.ports.limits);
      });
      if (parsed.stripped || !parsed.text.trim()) throw new exFileManagement('FILE_INTEGRITY_FAILURE');
      await this.require(context, documentId, enuDocumentOperation.Use);
      succeeded = true; return parsed;
    } finally {
      await this.ports.transactions.run(context, async tx => {
        await this.ports.usage.record(tx, context, { operationId, uploadedBytes: 0, downloadedBytes: 0, storageBytes: 0, files: 0,
          processingBytes: processed ? asset.bytes : 0 });
        await this.ports.admission.finish(tx, context, operationId, enuFileReservationState.Released);
        await this.ports.audit.record(tx, context, { action: succeeded ? enuFileEvent.ProcessingCompleted : enuFileEvent.ProcessingFailed,
          result: succeeded ? 'SUCCEEDED' : 'FAILED', resource: { type: 'version', id: versionId } });
      });
    }
  }
  async expire(context: intfExecutionContext, id: string): Promise<void> {
    const found = await this.find(context, id);
    if ([enuTransferState.Committed, enuTransferState.Failed, enuTransferState.Expired].includes(found.state)) return;
    if (Date.parse(found.expiresAt) > Date.now()) throw new exFileManagement('TRANSFER_IN_PROGRESS');
    const claim = await this.ports.transactions.run(context, tx => this.ports.transfers.lease(tx, context, id,
      [enuTransferState.Initiated, enuTransferState.Uploading, enuTransferState.Uploaded, enuTransferState.Verifying, enuTransferState.Unresolved],
      enuTransferOperation.Expire, this.leaseMs()));
    if (!claim) throw new exFileManagement('TRANSFER_IN_PROGRESS');
    // Timeout never proves completion failed. A readable candidate must be reconciled, not forgotten.
    if (await this.ports.storage.inspect(claim.storageKey)) { await this.verifyAndCommit(context, claim); return; }
    const uploadId = claim.remoteUploadId ?? await this.ports.storage.reconcileBegin(claim.storageKey, claim.id);
    if (uploadId) await this.ports.storage.abort(claim.storageKey, uploadId);
    if (await this.ports.storage.inspect(claim.storageKey)) throw new exFileManagement('TRANSFER_UNRESOLVED');
    await this.ports.transactions.run(context, async tx => {
      await this.ports.transfers.update(tx, context, id, claim.leaseToken!, { state: enuTransferState.Expired });
      await this.ports.admission.finish(tx, context, id, enuFileReservationState.Released);
      await this.ports.audit.record(tx, context, { action: enuFileEvent.UploadExpired, result: 'SUCCEEDED', resource: { type: 'transfer', id } });
    });
  }
  /** Registered service cleanup can abort only expired uncommitted uploads, never publish/read/purge an Asset. */
  async expireAsService(context:intfExecutionContext,id:string):Promise<void>{
    identifier(id);
    if(context.actorKind!=='PLATFORM_SERVICE'||!context.actorId||context.sessionId!==null
      ||!await this.ports.expiryAuthority?.authorize(context,id))throw new exFileManagement('FILE_DENIED');
    const found=await this.ports.transactions.run(context,tx=>this.ports.transfers.find(tx,context,id));
    if(!found||found.storageProfile!==this.ports.configuration.storage.profileId)throw new exFileManagement('FILE_DENIED');
    if([enuTransferState.Committed,enuTransferState.Expired].includes(found.state))return;
    if(Date.parse(found.expiresAt)>Date.now())throw new exFileManagement('TRANSFER_IN_PROGRESS');
    const claim=await this.ports.transactions.run(context,tx=>this.ports.transfers.lease(tx,context,id,
      [enuTransferState.Initiated,enuTransferState.Uploading,enuTransferState.Uploaded,enuTransferState.Verifying,enuTransferState.Unresolved,enuTransferState.Failed],
      enuTransferOperation.Expire,this.leaseMs()));
    if(!claim)throw new exFileManagement('TRANSFER_IN_PROGRESS');
    if(await this.ports.storage.inspect(claim.storageKey))throw new exFileManagement('TRANSFER_UNRESOLVED');
    const uploadId=claim.remoteUploadId??await this.ports.storage.reconcileBegin(claim.storageKey,claim.id);
    if(uploadId)await this.ports.storage.abort(claim.storageKey,uploadId);
    if(await this.ports.storage.inspect(claim.storageKey))throw new exFileManagement('TRANSFER_UNRESOLVED');
    await this.ports.transactions.run(context,async tx=>{
      await this.ports.transfers.update(tx,context,id,claim.leaseToken!,{state:enuTransferState.Expired});
      await this.ports.admission.finish(tx,context,id,enuFileReservationState.Released);
      await this.ports.audit.record(tx,context,{action:enuFileEvent.UploadExpired,result:'SUCCEEDED',resource:{type:'transfer',id}});
    });
  }
}

import {enuRetentionJob} from '../../../packages/data-governance/src/retention.js';
import type { intfConfigurationSnapshot } from '../../../packages/configuration/src/index.js';
import { createTargetDatabaseAdapter } from '../../../packages/persistence/src/target.js';
import { createSiemExportPersistence } from '../../../packages/security-telemetry/src/persistence.js';
import { randomUUID } from 'node:crypto';
import { composeDocumentKnowledge } from '../../runtime/src/composition.js';
import { clsJobWorker, type intfJobHandler } from '../../../packages/jobs/src/worker.js';
import { enuDocumentJob } from '../../../packages/documents/src/service.js';
import { enuKnowledgeJob } from '../../../packages/knowledge/src/service.js';
import { enuFileJob } from '../../../packages/file-management/src/service.js';
import { enuTransferState } from '../../../packages/file-management/src/index.js';
import { createMachineIdentityPersistence } from '../../../packages/identity/src/persistence.js';
import type { intfExecutionContext } from '../../../packages/contracts/src/index.js';

export async function createWorkerRuntime(snapshot: intfConfigurationSnapshot, secretRoot: string) {
  const pool = await createTargetDatabaseAdapter(snapshot, 'worker', secretRoot);
  const managed = await composeDocumentKnowledge(pool, snapshot, secretRoot);
  const workerContext:intfExecutionContext|undefined=snapshot.value.worker.identityId?{deploymentId:snapshot.value.deployment.id,tenantId:snapshot.value.deployment.tenantId,
    moduleId:'jobs',actorKind:'PLATFORM_SERVICE',actorId:snapshot.value.worker.identityId,sessionId:null,requestId:randomUUID(),correlationId:randomUUID(),source:'DURABLE_WORKER',configFingerprint:snapshot.fingerprint}:undefined;
  let jobs: clsJobWorker | null = null;
  if (managed && workerContext) {
    const machine = createMachineIdentityPersistence(pool);
    await machine.platformService(workerContext);
    const handlers = new Map<string, intfJobHandler>();
    const payloadId = (value: unknown): string => {
      if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value))
        throw new Error('INVALID_JOB_PAYLOAD'); return value;
    };
    handlers.set(enuDocumentJob.Process, async (job, fence, signal) => {
      const documentId = payloadId(job.payload.documentId), versionId = payloadId(job.payload.versionId);
      const ctx = { ...job.subject, source: 'DOCUMENT_PROCESSING_WORKER' };
      await managed.transactions.run(ctx,async tx=>{await fence(tx);await managed.documents.processingStartedWithin(tx,ctx,documentId,versionId);});
      const extracted = await managed.files.extract(ctx, documentId, versionId);
      if (signal.aborted) throw new Error('WORKER_SHUTDOWN');
      await managed.transactions.run(ctx, async tx => {
        await fence(tx);
        await managed.documents.processedWithin(tx, ctx, documentId, versionId, extracted.text, extracted.processor);
        await managed.usage.record(tx,ctx,{operationId:versionId,queries:0,documentsProcessed:1,embeddingItems:0,retrievalCandidates:0,authorizedChunks:0,rerankItems:0,generationCalls:0,indexedChunks:0});
        await managed.documents.publishWithin(tx, ctx, documentId, versionId);
        await managed.knowledge?.scheduleDocumentWithin(tx, ctx, documentId);
      });
    });
    if (managed.knowledge) {
      const knowledge = managed.knowledge;
      handlers.set(enuKnowledgeJob.Rebuild, async (job, fence,signal) => knowledge.rebuild(
        { ...job.subject, source: 'KNOWLEDGE_INDEXING_WORKER' }, payloadId(job.payload.spaceId), payloadId(job.payload.generationId), fence,signal));
    }
    handlers.set(enuRetentionJob.Purge,async(job,fence)=>managed.governance.execute({...job.subject,source:'GOVERNANCE_PURGE_WORKER'},payloadId(job.payload.resourceId),job.leaseToken,fence,payloadId(job.payload.requestId)));
    handlers.set(enuFileJob.Reconcile, async job => {
      const value = await managed.files.reconcile({ ...job.subject, source: 'FILE_RECONCILIATION_WORKER' }, payloadId(job.payload.transferId));
      if ('state' in value && [enuTransferState.Unresolved, enuTransferState.Verifying].includes(value.state)) throw new Error('TRANSFER_UNRESOLVED');
    });
    const expiryContext=async(job:Parameters<intfJobHandler>[0]):Promise<intfExecutionContext>=>({...workerContext,
      tenantId:job.subject.tenantId,authorizationVersion:await machine.platformService({...workerContext,tenantId:job.subject.tenantId}),requestId:job.subject.requestId,correlationId:job.subject.correlationId,source:'FILE_EXPIRY_WORKER',
      initiator:{actorKind:job.subject.actorKind,actorId:job.subject.actorId}});
    handlers.set(enuFileJob.Expire, async job => managed.files.expireAsService(await expiryContext(job), payloadId(job.payload.transferId)));
    jobs = new clsJobWorker({ transactions: managed.transactions, jobs: managed.jobs,
      subject:{async assertActive(ctx){if(ctx.actorKind==='PLATFORM_SERVICE')await machine.platformService(ctx);else await managed.subject.assertActive(ctx);}},
      executionSubject:async job=>job.kind===enuFileJob.Expire?expiryContext(job):job.subject,
      worker: workerContext, leaseMs: Math.min(snapshot.value.worker.claimLeaseMs, 300000), handlers,
      async onFailure(tx,job,failure,terminal){
        if(!terminal)return;
        const context={...job.subject,source:'DURABLE_WORKER_TERMINAL_FAILURE'};
        if(job.kind===enuDocumentJob.Process)await managed.documents.processingFailedWithin(tx,context,payloadId(job.payload.documentId),payloadId(job.payload.versionId));
        if(job.kind===enuKnowledgeJob.Rebuild)await managed.knowledge?.indexingFailedWithin(tx,context,payloadId(job.payload.generationId),failure.reason);
      },
      classify(error) {
        const code = error instanceof Error ? error.message : '';
        const retryable = ['INDEX_UNAVAILABLE', 'FILE_STORAGE_UNAVAILABLE', 'FILE_CACHE_UNAVAILABLE', 'TRANSFER_UNRESOLVED',
          'TRANSFER_IN_PROGRESS', 'WORKER_SHUTDOWN', 'CAPACITY_EXHAUSTED', 'ENDPOINT_BUSY', 'NO_ELIGIBLE_ENDPOINT'].includes(code);
        return { reason: /^[A-Z0-9_]{1,64}$/u.test(code) ? code : 'JOB_EXECUTION_FAILED', retryable };
      } });
  }
  return { storage: createSiemExportPersistence(pool,workerContext), jobs, machineReady: async () => {
    if (snapshot.value.worker.identityId && managed) await createMachineIdentityPersistence(pool).platformService({
      deploymentId:snapshot.value.deployment.id,tenantId:snapshot.value.deployment.tenantId,moduleId:'jobs',actorKind:'PLATFORM_SERVICE',actorId:snapshot.value.worker.identityId,
      sessionId:null,requestId:randomUUID(),correlationId:randomUUID(),source:'DURABLE_WORKER',configFingerprint:snapshot.fingerprint });
  }, close: async () => { await managed?.close(); await pool.end(); } };
}

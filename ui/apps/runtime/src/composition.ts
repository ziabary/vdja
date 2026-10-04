import {clsRetentionService} from '../../../packages/data-governance/src/retention.js';
import {createRetentionRepository} from '../../../packages/data-governance/src/persistence.js';
import {clsClamdScanner,enuMalwareMode} from '../../../packages/file-processing/src/malware.js';
import type { intfConfigurationSnapshot } from '../../../packages/configuration/src/index.js';
import { resolveSecretRef } from '../../../packages/configuration/src/index.js';
import { createTargetDatabaseAdapter } from '../../../packages/persistence/src/target.js';
import { createTargetTransactionPersistence } from '../../../packages/persistence/src/target-transaction.js';
import { createAuthorityPersistence } from '../../../packages/authority/src/persistence.js';
import { clsAuthorityService,enuAuthorityLimitTier } from '../../../packages/authority/src/service.js';
import { createSecurityAuditPersistence } from '../../../packages/audit/src/persistence/security.js';
import { createSemanticAuditPersistence } from '../../../packages/audit/src/persistence/semantic.js';
import { createSessionPersistence } from '../../../packages/session/src/persistence.js';
import { createHumanExecutionSubjectGuard } from '../../../packages/session/src/subject.js';
import { createStorageAdapter } from '../../../packages/storage/src/factory.js';
import { createDocumentRepository } from '../../../packages/documents/src/persistence.js';
import { clsDocumentService } from '../../../packages/documents/src/service.js';
import { clsFileManagement } from '../../../packages/file-management/src/service.js';
import { createTransferRepository } from '../../../packages/file-management/src/persistence.js';
import { createFileAdmissionPersistence } from '../../../packages/admission-control/src/persistence/files.js';
import { createQueryAdmissionPersistence } from '../../../packages/admission-control/src/persistence/query.js';
import { createFileUsagePersistence } from '../../../packages/usage/src/persistence/files.js';
import {createRagUsagePersistence} from '../../../packages/usage/src/persistence/rag.js';
import { createUsagePersistence } from '../../../packages/usage/src/persistence.js';
import { createJobPersistence } from '../../../packages/jobs/src/persistence.js';
import { clsProtectedAiRouter } from '../../../packages/ai-router/src/protected.js';
import { createAiRunPersistence } from '../../../packages/ai-router/src/persistence.js';
import { clsAiEgressGovernance } from '../../../packages/data-governance/src/index.js';
import { createKnowledgeRepository } from '../../../packages/knowledge/src/persistence.js';
import { clsKnowledgeService } from '../../../packages/knowledge/src/service.js';
import {clsPersonalChatService} from '../../../packages/knowledge/src/personal-chat.js';
import {createPersonalChatRepository} from '../../../packages/knowledge/src/persistence/chat.js';
import { clsQdrantAdapter } from '../../../packages/knowledge/src/adapters/qdrant.js';
import {createMachineIdentityPersistence} from '../../../packages/identity/src/persistence.js';
import {enuAuthorityDecision} from '../../../packages/authority/src/index.js';

/** Shared API/Worker composition root; callers own the database pool lifetime. */
export async function composeDocumentKnowledge(pool: Awaited<ReturnType<typeof createTargetDatabaseAdapter>>,
  snapshot: intfConfigurationSnapshot, secretRoot: string) {
  const config = snapshot.value;
  if (!config.fileManagement?.enabled || !config.auth?.enabled) return null;
  const transactions = createTargetTransactionPersistence(pool), jobs = createJobPersistence();
  const securityAudit = createSecurityAuditPersistence(pool, config.siem), audit = createSemanticAuditPersistence(config.siem);
  const authority = new clsAuthorityService({ ...createAuthorityPersistence(pool, config.deployment.id),
    recordDecision: (ctx, evidence) => securityAudit.recordAuthorityDecision(ctx, evidence),
    recordDecisions: (ctx, evidence) => securityAudit.recordAuthorityDecisions(ctx, evidence) });
  const sessionPolicy = config.auth.session;
  const sessions = createSessionPersistence(pool, sessionPolicy);
  const subject = createHumanExecutionSubjectGuard(reference => sessions.validateAccessSession(reference, reference.tenantId));
  const storage = await createStorageAdapter(config.fileManagement.storage, secretRoot);
  const documents = new clsDocumentService({ transactions, jobs, authority, subject,
    repository: createDocumentRepository(), maxNormalizedChars: config.fileProcessing.maxExtractedChars,
    audit: { async record(tx, ctx, action, id) { await audit.record(tx, ctx, { action, result: 'SUCCEEDED', resource: { type: 'document', id } }); } } });
  const files = new clsFileManagement({ transactions, subject, documents, jobs, storage,
    transfers: createTransferRepository(), admission: createFileAdmissionPersistence(), usage: createFileUsagePersistence(), audit,
    configuration: config.fileManagement,
    ...(config.fileManagement.security.malware&&config.fileManagement.security.malware.mode!==enuMalwareMode.Disabled?{malware:new clsClamdScanner(config.fileManagement.security.malware)}:{}), limits: config.fileProcessing,
    ...(config.fileManagement.limitTiers?{actorLimits:async(ctx,documentId)=>{
      const facts=(await documents.facts(ctx,[documentId]))[0];
      if(!facts)throw new Error('FILE_DENIED');
      const tier=await authority.fileLimitTier({context:{...ctx,moduleId:'knowledge'},path:'Knowledge.Files.elevatedLimits',resource:facts,requireClassification:true});
      return config.fileManagement!.enabled&&config.fileManagement!.limitTiers
        ? config.fileManagement!.limitTiers[tier===enuAuthorityLimitTier.Privileged?'privileged':'authenticated']
        : Promise.reject(new Error('FILE_LIMIT_POLICY_UNAVAILABLE'));
    }}:{}),
    expiryAuthority:{async authorize(ctx,id){
      await createMachineIdentityPersistence(pool).platformService(ctx);
      const decision=await authority.authorize({context:{...ctx,moduleId:'file-management'},path:'Files.Transfers.expire',
        resource:{type:'file_transfer',id,tenantId:ctx.tenantId},requireClassification:false});
      return decision.decision===enuAuthorityDecision.Permit;
    }} });
  let knowledge: clsKnowledgeService | null = null, vectors: clsQdrantAdapter | null = null,protectedAi:clsProtectedAiRouter|null=null;
  if (config.knowledge?.enabled && config.ai.protected && config.dataGovernance) {
    const configuration = config.ai.protected;
    const ai = new clsProtectedAiRouter({ configuration: () => ({ value: configuration, fingerprint: snapshot.fingerprint }),
      secretRoot, subject, store: createAiRunPersistence(pool), usage: createUsagePersistence(pool),
      governance: new clsAiEgressGovernance(config.dataGovernance, async (ctx, event) => { await transactions.run(ctx, tx => audit.record(tx, ctx,
        { action: event.allowed ? 'data-governance.egress.allowed' : 'data-governance.egress.denied', result: event.allowed ? 'SUCCEEDED' : 'DENIED',
          reason: event.reason, resource: { type: 'endpoint', id: event.endpointId } })); }) });
    protectedAi=ai;
    vectors = new clsQdrantAdapter({ ...config.knowledge.qdrant, apiKey: await resolveSecretRef(config.knowledge.qdrant.apiKeyRef, secretRoot) });
    knowledge = new clsKnowledgeService({ transactions, subject, authority, documents, files, jobs, ai, vectors, audit,
      repository: createKnowledgeRepository(), admission: createQueryAdmissionPersistence(pool), usage:createRagUsagePersistence(),configuration: config.knowledge });
  }
  const governance=new clsRetentionService({transactions,jobs,repository:createRetentionRepository(),subject:{async assertActive(ctx){if(ctx.actorKind==='PLATFORM_SERVICE')await createMachineIdentityPersistence(pool).platformService(ctx);else await subject.assertActive(ctx);}},authority,
    now:()=>new Date(),leaseMs:300000,
    facts:async(tx,ctx,id)=>{const facts=await documents.retentionFactsWithin(tx,ctx,id);return{...facts,retainedReferences:facts.retainedReferences||!!await knowledge?.retentionReferencesWithin(tx,ctx,id),activeMaterializations:await files.activeMaterializationsWithin(tx,ctx)};},
    purge:async(ctx,request,permit)=>{await knowledge?.purge(ctx,permit);await files.purge(ctx,permit);await transactions.run(ctx,tx=>documents.purgeWithin(tx,ctx,permit));},
    audit:async(tx,ctx,record)=>{await audit.record(tx,ctx,{action:'data-governance.retention.changed',result:'SUCCEEDED',reason:record.state,resource:{type:'document',id:record.resourceId}});}
  });
  const personalChats=knowledge?new clsPersonalChatService({transactions,subject,knowledge,repository:createPersonalChatRepository()}):null;
  return { transactions, jobs, subject, documents, files, knowledge,personalChats,governance,usage:createRagUsagePersistence(), async readiness() {
    const [file, index] = await Promise.allSettled([files.ready(), vectors?.ready() ?? Promise.resolve()]);
    const ai=await protectedAi?.probeReadiness();
    return { files: file.status === 'fulfilled' ? 'READY' : 'UNAVAILABLE', knowledge: !knowledge ? 'DISABLED' : index.status === 'fulfilled' ? 'READY' : 'UNAVAILABLE',
      malware:await files.malwareReadiness(),protectedAi:ai?.status??'DISABLED',unavailableTasks:ai?.unavailableTasks??[] } as const;
  }, async close() { if ('close' in storage && typeof storage.close === 'function') storage.close(); } };
}

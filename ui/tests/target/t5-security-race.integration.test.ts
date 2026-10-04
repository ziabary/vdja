import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID,createHash} from 'node:crypto';
import {loadConfiguration} from '../../packages/configuration/src/index.js';
import {createTargetPool,withTargetTransaction} from '../../packages/persistence/src/target.js';
import {createTransactionPort} from '../../packages/persistence/src/target-transaction.js';
import {createDocumentRepository} from '../../packages/documents/src/persistence.js';
import {clsDocumentService} from '../../packages/documents/src/service.js';
import {enuAssetState,enuVersionState,enuDocumentOperation} from '../../packages/documents/src/index.js';
import {createJobPersistence} from '../../packages/jobs/src/persistence.js';
import {createT5Subject} from './support/t5-live-subject.js';
const config=process.env.T4_PG_CONFIG,secrets=process.env.T4_SECRETS_DIR;
if(!config||!secrets)throw new Error('T5_R1_LIVE_CONFIGURATION_REQUIRED');
test('Authority materialization linearization rejects committed mutations and fences concurrent policy writers without external calls',async t=>{
 const snapshot=await loadConfiguration(config),api=await createTargetPool(snapshot,'api',secrets),worker=await createTargetPool(snapshot,'worker',secrets),migration=await createTargetPool(snapshot,'migration',secrets);
 const identity=await createT5Subject(snapshot,migration,api,worker),context=identity.context,transactions=createTransactionPort(api),repository=createDocumentRepository();
 const documentId=randomUUID(),versionId=randomUUID(),content='AUTHORIZED_SNAPSHOT_CONTENT',sha256=createHash('sha256').update(content).digest('hex');let materializations=0,probeFence=false;
 const traced={...repository,normalizedBatch:async(...args:Parameters<typeof repository.normalizedBatch>)=>{
  materializations+=1;if(probeFence){const client=await migration.connect();try{await client.query('BEGIN');const result=await client.query<{acquired:boolean}>("SELECT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('authority.tenant.'||$1,0)) AS acquired",[context.tenantId]);assert.equal(result.rows[0]?.acquired,false);}finally{await client.query('ROLLBACK');client.release();}}
  return repository.normalizedBatch(...args);
 }};
 const docs=new clsDocumentService({transactions,repository:traced,jobs:createJobPersistence(),authority:identity.authority,subject:identity.subject,maxNormalizedChars:10000,audit:{record:async()=>{}}});
 const mutate=(sql:string,parameters:readonly unknown[]=[])=>withTargetTransaction(migration,context,tx=>tx.query(sql,[...parameters]));
 try{
  await transactions.run(context,async tx=>{await repository.create(tx,context,{id:documentId,title:'Race protected source',classification:'LOW'});await repository.commitVersion(tx,context,{documentId,versionId,sourceIdentity:'r1-security',asset:{id:randomUUID(),documentId,versionId,storageKey:createHash('sha256').update(context.tenantId).digest('hex')+'/'+randomUUID(),storageProfile:'test',sha256,bytes:content.length,mediaType:'text/plain',filename:'source.txt',lifecycle:enuAssetState.Approved}});});await createTransactionPort(worker).run(context,async tx=>{await repository.recordProcessed(tx,context,versionId,content,'r1-test-v1',sha256);await repository.markProcessing(tx,context,versionId,enuVersionState.Ready);await repository.activate(tx,context,versionId);});
  await t.test('authorized immutable snapshot blocks a policy writer until materialization transaction commits',async()=>{probeFence=true;assert.equal((await docs.normalizedVersions(context,[{documentId,versionId}],enuDocumentOperation.Use)).get(versionId),content);probeFence=false;});
  const mutations=[
   {name:'ACL explicit deny',apply:()=>mutate("INSERT INTO authority.tbl_aut_resource_acl (ara_id,ara_tenant_id,ara_resource_type,ara_resource_id,ara_identity__idn_id,ara_effect,ara_permission) VALUES ($1,$2,'document',$3,$4,'DENY','Knowledge.Documents.use')",[randomUUID(),context.tenantId,documentId,context.actorId]),undo:()=>mutate('DELETE FROM authority.tbl_aut_resource_acl WHERE ara_tenant_id=$1',[context.tenantId])},
   {name:'classification raise',apply:()=>mutate("UPDATE documents.tbl_doc_document SET doc_classification='HIGH',doc_security_version=doc_security_version+1 WHERE doc_id=$1",[documentId]),undo:()=>mutate("UPDATE documents.tbl_doc_document SET doc_classification='LOW',doc_security_version=doc_security_version+1 WHERE doc_id=$1",[documentId])},
   {name:'clearance removal',apply:()=>mutate('DELETE FROM authority.tbl_aut_clearance WHERE auc_tenant_id=$1',[context.tenantId]),undo:()=>mutate("INSERT INTO authority.tbl_aut_clearance (auc_identity__idn_id,auc_tenant_id,auc_level) VALUES ($1,$2,'LOW')",[context.actorId,context.tenantId])},
   {name:'authorization version change',apply:()=>mutate('UPDATE identity.tbl_idn_membership SET idm_authorization_version=2 WHERE idm_id=$1',[identity.membershipId]),undo:()=>mutate('UPDATE identity.tbl_idn_membership SET idm_authorization_version=1 WHERE idm_id=$1',[identity.membershipId])},
   {name:'identity suspension',apply:()=>mutate("UPDATE identity.tbl_idn_identity SET idn_state='SUSPENDED' WHERE idn_id=$1",[context.actorId]),undo:()=>mutate("UPDATE identity.tbl_idn_identity SET idn_state='ACTIVE' WHERE idn_id=$1",[context.actorId])},
   {name:'session revocation',apply:()=>mutate('UPDATE session_core.tbl_ses_session SET ses_revoked_at=CURRENT_TIMESTAMP WHERE ses_id=$1',[context.sessionId]),undo:()=>mutate('UPDATE session_core.tbl_ses_session SET ses_revoked_at=NULL WHERE ses_id=$1',[context.sessionId])},
   {name:'document retirement',apply:()=>mutate("UPDATE documents.tbl_doc_document SET doc_lifecycle='RETIRED',doc_security_version=doc_security_version+1 WHERE doc_id=$1",[documentId]),undo:()=>mutate("UPDATE documents.tbl_doc_document SET doc_lifecycle='ACTIVE',doc_security_version=doc_security_version+1 WHERE doc_id=$1",[documentId])}
  ];
  for(const mutation of mutations)await t.test('committed '+mutation.name+' denies before normalized bytes are read',async()=>{const before=materializations;await mutation.apply();try{await assert.rejects(docs.normalizedVersions(context,[{documentId,versionId}],enuDocumentOperation.Use));assert.equal(materializations,before);}finally{await mutation.undo();}});
 }finally{await mutate('DELETE FROM jobs.tbl_job_work WHERE job_tenant_id=$1',[context.tenantId]);await mutate('UPDATE documents.tbl_doc_document SET doc_current_version_id=NULL WHERE doc_id=$1',[documentId]);await mutate('DELETE FROM documents.tbl_doc_asset WHERE ast_document__doc_id=$1',[documentId]);await mutate('DELETE FROM documents.tbl_doc_version WHERE dvr_document__doc_id=$1',[documentId]);await mutate('DELETE FROM documents.tbl_doc_document WHERE doc_id=$1',[documentId]);await identity.clean();await api.end();await worker.end();await migration.end();}
});

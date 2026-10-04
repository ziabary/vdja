import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID,createHash} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {startT5RuntimeFixture} from './support/t5-runtime-fixture.js';
import {composeDocumentKnowledge} from '../../apps/runtime/src/composition.js';
import {createTargetPool,withTargetTransaction} from '../../packages/persistence/src/target.js';
import {enuRetentionState,resolvePurgePermit} from '../../packages/data-governance/src/retention.js';
for(const storageKind of ['LOCAL','S3_COMPATIBLE']as const)test('Governance legal hold fences '+storageKind+' physical purge and removes owner bytes while retaining audit',async t=>{
 const fixture=await startT5RuntimeFixture(storageKind),pool=await createTargetPool(fixture.snapshot,'worker',fixture.secretRoot),managed=await composeDocumentKnowledge(pool,fixture.snapshot,fixture.secretRoot);assert.ok(managed);
 const context=fixture.context,documentId=randomUUID(),spaceId=randomUUID(),sentinel='R1_PURGE_PROTECTED_BODY',body=(v:unknown)=>({headers:{'content-type':'application/json'},body:JSON.stringify(v)});
 const mutate=(sql:string,args:readonly unknown[])=>withTargetTransaction(fixture.migration,context,tx=>tx.query(sql,[...args]));
 try{
  await fixture.identity.setPermissions({Knowledge:{ALL:true},Governance:{ALL:true}});
  assert.equal((await fixture.request('/documents',{method:'POST',...body({id:documentId,title:'Purge confidential source',classification:'LOW'})})).status,201);
  const bytes=Buffer.from(sentinel),sha256=createHash('sha256').update(bytes).digest('hex');
  const intake=await(await fixture.request('/transfers',{method:'POST',...body({documentId,idempotencyKey:'retention-test',filename:'private.txt',mediaType:'text/plain',bytes:bytes.length,sha256})})).json()as{id:string};
  assert.equal((await fixture.request(`/transfers/${intake.id}/parts/1`,{method:'PUT',headers:{'content-type':'application/octet-stream','x-content-sha256':sha256},body:bytes})).status,200);
  const version=await(await fixture.request(`/transfers/${intake.id}/complete`,{method:'POST'})).json()as{id:string};
  for(let i=0;i<8;i++)if(await fixture.worker.jobs!.next()==='EMPTY')break;
  assert.equal((await fixture.request(`/documents/${documentId}/versions/${version.id}/download`)).status,200);
  assert.equal((await fixture.request('/spaces',{method:'POST',...body({id:spaceId,title:'Retained knowledge relation',classification:'LOW'})})).status,201);
  assert.equal((await fixture.request(`/spaces/${spaceId}/memberships/${documentId}`,{method:'PUT',...body({mode:'CURRENT',pinnedVersionId:null})})).status,204);
  for(let i=0;i<8;i++)if(await fixture.worker.jobs!.next()==='EMPTY')break;
  await managed.documents.retire(context,documentId);
  await managed.governance.register(context,{resourceId:documentId,requestId:randomUUID(),state:enuRetentionState.Retired,policyVersion:'r1-synthetic-policy-v1',eligibleAfter:new Date(Date.now()-1000).toISOString(),backupObligation:'EXTERNAL_BACKUP_PURGE_REPLAY_REQUIRED',leaseToken:null,leaseUntil:null});
  await t.test('retained relations and legal hold prevent any physical purge',async()=>{
   await assert.rejects(managed.governance.request(context,documentId),/RETENTION_NOT_ELIGIBLE/);
   const before=await mutate('SELECT ksp_id,ksp_deployment_id,ksp_tenant_id FROM knowledge.tbl_knw_space WHERE ksp_id=$1',[spaceId]);assert.deepEqual(before.rows,[{ksp_id:spaceId,ksp_deployment_id:context.deploymentId,ksp_tenant_id:context.tenantId}]);
   const retired=await mutate("UPDATE knowledge.tbl_knw_space SET ksp_lifecycle='RETIRED' WHERE ksp_id=$1 RETURNING ksp_id",[spaceId]);assert.equal(retired.rowCount,1);
   await managed.governance.hold(context,documentId,true);await assert.rejects(managed.governance.request(context,documentId),/LEGAL_HOLD/);
   const content=await fixture.migration.query<{dvr_normalized_text:string}>('SELECT dvr_normalized_text FROM documents.tbl_doc_version WHERE dvr_id=$1',[version.id]);assert.equal(content.rows[0]?.dvr_normalized_text,sentinel);
   await assert.rejects(managed.governance.execute(context,documentId,randomUUID()),/LEGAL_HOLD/);
   assert.throws(()=>resolvePurgePermit({permitId:randomUUID()},context),/RETENTION_DENIED/);
  });
  await managed.governance.hold(context,documentId,false);
  const readiness=await managed.transactions.run(context,async tx=>({document:await managed.documents.retentionFactsWithin(tx,context,documentId),knowledge:await managed.knowledge?.retentionReferencesWithin(tx,context,documentId),active:await managed.files.activeMaterializationsWithin(tx,context)}));
  assert.deepEqual(readiness,{document:{retired:true,classification:'LOW',retainedReferences:false},knowledge:false,active:false});
  await managed.governance.request(context,documentId);
  await t.test('hold placed after scheduling invalidates queued purge before its physical deletion boundary',async()=>{
   await managed.governance.hold(context,documentId,true);await assert.rejects(managed.governance.execute(context,documentId,randomUUID()),/LEGAL_HOLD/);await managed.governance.hold(context,documentId,false);await managed.governance.request(context,documentId);
  });
  await t.test('durable Worker executes approved purge; canonical normalized/derived/cache/staging disappear and audit remains',async()=>{
   for(let i=0;i<8;i++)if(await fixture.worker.jobs!.next()==='EMPTY')break;
   const state=await mutate('SELECT grt_state FROM data_governance.tbl_gov_retention WHERE grt_resource_id=$1',[documentId]);assert.equal(state.rows[0]?.grt_state,enuRetentionState.Purged);
   for(const[table,column]of [['documents.tbl_doc_version','dvr_document__doc_id'],['documents.tbl_doc_asset','ast_document__doc_id'],['knowledge.tbl_knw_chunk','kch_document_id'],['knowledge.tbl_knw_membership','kmb_document_id'],['file_management.tbl_fil_transfer','ftr_document__doc_id']]as const){const count=await mutate(`SELECT count(*) AS count FROM ${table} WHERE ${column}=$1`,[documentId]);assert.equal(count.rows[0]?.count,'0');}
   assert.equal((await readdir(join(fixture.root,'cache'))).filter(n=>n.endsWith('.blob')).length,0);
   assert.equal((await readdir(join(fixture.root,'staging'))).filter(n=>n.includes('.pending-')||n.endsWith('.reservation')).length,0);
   const audit=await fixture.migration.query<{count:string}>('SELECT count(*) AS count FROM audit.tbl_aud_mutation WHERE aud_tenant_id=$1',[context.tenantId]);assert.ok(Number(audit.rows[0]?.count)>0);
   if(storageKind==='LOCAL'){const namespace=createHash('sha256').update(JSON.stringify([context.deploymentId,context.tenantId])).digest('hex');const names=await readdir(join(fixture.root,'canonical'));for(const name of names.filter(n=>!n.startsWith('.')))assert.equal((await readdir(join(fixture.root,'canonical',name))).length,0);}
   const projection=await mutate('SELECT kgn_collection FROM knowledge.tbl_knw_generation WHERE kgn_tenant_id=$1',[context.tenantId]);assert.ok(projection.rowCount);
   for(const p of projection.rows){const response=await fetch(fixture.qdrant.endpoint+`/collections/${p.kgn_collection}/points/count`,{method:'POST',headers:{'content-type':'application/json','api-key':fixture.qdrant.apiKey},body:JSON.stringify({exact:true,filter:{must:[{key:'documentId',match:{value:documentId}}]}})});assert.equal((await response.json()as{result:{count:number}}).result.count,0);}
  });
 }finally{await mutate('DELETE FROM data_governance.tbl_gov_retention WHERE grt_tenant_id=$1',[context.tenantId]);await managed.close();await pool.end();await fixture.close();}
});

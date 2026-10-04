import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {rename,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {startT5RuntimeFixture} from './support/t5-runtime-fixture.js';
import {loadConfiguration} from '../../packages/configuration/src/index.js';
import {composeDocumentKnowledge} from '../../apps/runtime/src/composition.js';
import {createTargetPool,withTargetTransaction} from '../../packages/persistence/src/target.js';
import {createTargetTransactionPersistence} from '../../packages/persistence/src/target-transaction.js';
import {createQueryAdmissionPersistence} from '../../packages/admission-control/src/persistence/query.js';
const live=!!process.env.T4_PG_CONFIG&&!!process.env.T4_SECRETS_DIR&&process.env.T5_REQUIRE_QDRANT==='1';
if(process.env.T5_REQUIRE_LIVE==='1'&&!live)throw new Error('T5_LIVE_FAILURE_RUNTIME_CONFIGURATION_REQUIRED');
test('actual API/Worker/Storage/Qdrant pipeline fails closed on dependencies, admission, session, Authority and Governance',{skip:!live},async t=>{
 const fixture=await startT5RuntimeFixture(),documentId=randomUUID(),spaceId=randomUUID();let versionId='';
 const body=(value:unknown)=>({headers:{'content-type':'application/json'},body:JSON.stringify(value)});
 const query=()=>fixture.request(`/spaces/${spaceId}/query`,{method:'POST',...body({question:'Explain normal operation'})});
 try{
  assert.equal((await fixture.request('/documents',{method:'POST',...body({id:documentId,title:'Failure fixture',classification:'LOW'})})).status,201);
  const bytes=Buffer.from('FAILURE_CANONICAL_CONTENT: safe operational information.'),sha256=createHash('sha256').update(bytes).digest('hex');
  const upload=await(await fixture.request('/transfers',{method:'POST',...body({documentId,idempotencyKey:'failure',filename:'failure.txt',mediaType:'text/plain',bytes:bytes.length,sha256})})).json()as{id:string};
  assert.equal((await fixture.request(`/transfers/${upload.id}/parts/1`,{method:'PUT',headers:{'content-type':'application/octet-stream','x-content-sha256':sha256},body:bytes})).status,200);
  const version=await(await fixture.request(`/transfers/${upload.id}/complete`,{method:'POST'})).json()as{id:string};versionId=version.id;
  for(let count=0;count<8;count++)if(await fixture.worker.jobs!.next()==='EMPTY')break;
  assert.equal((await fixture.request('/spaces',{method:'POST',...body({id:spaceId,title:'Failure space',classification:'LOW'})})).status,201);
  assert.equal((await fixture.request(`/spaces/${spaceId}/memberships/${documentId}`,{method:'PUT',...body({mode:'CURRENT',pinnedVersionId:null})})).status,204);
  for(let count=0;count<8;count++)if(await fixture.worker.jobs!.next()==='EMPTY')break;
  for(const path of ['/v1/embeddings','/score','/v1/chat/completions'])await t.test(`provider outage ${path} returns no answer and no later task dispatch`,async()=>{
   fixture.provider.calls.length=0;fixture.provider.state.failPath=path;const response=await query();assert.equal(response.status,503);const value=await response.json()as{error:string;answer?:string};assert.ok(value.error);assert.equal(value.answer,undefined);
   assert.equal(fixture.provider.calls.at(-1)?.path,path);delete fixture.provider.state.failPath;
  });
  await t.test('distributed query reservations reject additional API work before provider dispatch',async()=>{
   const pool=await createTargetPool(fixture.snapshot,'api',fixture.secretRoot),admission=createQueryAdmissionPersistence(pool),reservations:{id:string;key:string}[]=[];
   assert.ok(fixture.snapshot.value.knowledge?.enabled);
   try{for(let index=0;index<fixture.snapshot.value.knowledge.admission.concurrent;index++){const key=randomUUID();reservations.push({key,id:(await admission.reserve({...fixture.context,requestId:key},fixture.snapshot.value.knowledge.admission,1,1,1)).id});}
    fixture.provider.calls.length=0;assert.equal((await query()).status,429);assert.equal(fixture.provider.calls.length,0);
   }finally{for(const reservation of reservations)await createTargetTransactionPersistence(pool).run(fixture.context,tx=>admission.finish(tx,fixture.context,reservation.id,false,reservation.key));await pool.end();}
  });
  await t.test('Governance denial rejects generation before external content leaves its Router',async()=>{
   const raw=structuredClone(fixture.snapshot.value);assert.ok(raw.dataGovernance);
   const path=join(fixture.root,'deny-generation.cjson');
   await writeFile(path,JSON.stringify({...raw,dataGovernance:{...raw.dataGovernance,destinations:raw.dataGovernance.destinations.filter(destination=>!destination.endpointId.includes('answer'))}}),{mode:0o600});
   const pool=await createTargetPool(fixture.snapshot,'api',fixture.secretRoot),managed=await composeDocumentKnowledge(pool,await loadConfiguration(path),fixture.secretRoot);
   try{fixture.provider.calls.length=0;await assert.rejects(managed!.knowledge!.ask(fixture.context,spaceId,'Explain'),/PROTECTED_EGRESS_DENIED/);assert.ok(!fixture.provider.calls.some(call=>call.path==='/v1/chat/completions'));}
   finally{await managed?.close();await pool.end();}
  });
  await t.test('malicious metadata and question resource excess cause bounded errors without provider work',async()=>{
   fixture.provider.calls.length=0;assert.equal((await fixture.request('/transfers',{method:'POST',...body({documentId,idempotencyKey:'malicious',filename:'../../payload.txt',mediaType:'text/plain',bytes:1,sha256})})).status,400);
   assert.equal((await fixture.request(`/spaces/${spaceId}/query`,{method:'POST',...body({question:'x'.repeat(1025)})})).status,400);assert.equal(fixture.provider.calls.length,0);
  });
  await t.test('unmatched URL content never enters operational logs',async()=>{
   const sentinel='T5_UNMATCHED_PATH_PROTECTED_SENTINEL',write=process.stdout.write;let logs='';
   process.stdout.write=((chunk:unknown,...args:unknown[])=>{logs+=String(chunk);return Reflect.apply(write,process.stdout,[chunk,...args]);}) as typeof process.stdout.write;
   try{assert.equal((await fixture.request(`/${sentinel}`)).status,404);assert.ok(!logs.includes(sentinel));assert.ok(logs.includes('UNMATCHED'));}
   finally{process.stdout.write=write;}
  });
  await t.test('Storage loss cannot serve original bytes or treat a cache as authority',async()=>{
   const config=fixture.snapshot.value.fileManagement;assert.ok(config?.enabled&&config.storage.kind==='LOCAL');
   await rm(config.cache.root,{recursive:true,force:true});await rename(config.storage.root,`${config.storage.root}-offline`);
   try{const response=await fixture.request(`/documents/${documentId}/versions/${versionId}/download`);assert.equal(response.status,503);assert.ok(!(await response.text()).includes('FAILURE_CANONICAL_CONTENT'));}
   finally{await rename(`${config.storage.root}-offline`,config.storage.root);}
  });
  await t.test('Authority denial produces no provider request',async()=>{
   await fixture.identity.setPermissions({Knowledge:{Spaces:{discover:true}}});fixture.provider.calls.length=0;assert.equal((await query()).status,403);assert.equal(fixture.provider.calls.length,0);await fixture.identity.setPermissions({Knowledge:{ALL:true}});
  });
  await t.test('Qdrant outage degrades readiness and produces no generated response',async()=>{
   await fixture.qdrant.pause();fixture.provider.calls.length=0;assert.equal((await query()).status,503);assert.ok(!fixture.provider.calls.some(call=>call.path==='/score'||call.path==='/v1/chat/completions'));
   const ready=await(await fixture.request('/ready')).json()as{dependencies:{knowledge:string}};assert.equal(ready.dependencies.knowledge,'UNAVAILABLE');
  });
  await t.test('revoked Session cannot query despite a still cryptographically valid bearer',async()=>{
   await withTargetTransaction(fixture.migration,fixture.context,tx=>tx.query('UPDATE session_core.tbl_ses_session SET ses_revoked_at=clock_timestamp() WHERE ses_id=$1',[fixture.context.sessionId]));fixture.provider.calls.length=0;assert.equal((await query()).status,401);assert.equal(fixture.provider.calls.length,0);
  });
 }finally{await fixture.close();}
});

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {loadConfiguration} from '../../packages/configuration/src/index.js';
import {createTargetPool,withTargetTransaction} from '../../packages/persistence/src/target.js';
import {createTransactionPort} from '../../packages/persistence/src/target-transaction.js';
import {createJobPersistence} from '../../packages/jobs/src/persistence.js';
import {clsJobWorker} from '../../packages/jobs/src/worker.js';
import {createT5Subject} from './support/t5-live-subject.js';
import {enuAuthorityDecision} from '../../packages/authority/src/index.js';
const config=process.env.T4_PG_CONFIG,secrets=process.env.T4_SECRETS_DIR;
if(!config||!secrets)throw new Error('T5_LIVE_CONFIGURATION_REQUIRED');
test('one deployment Worker claims interleaved A1 B1 A2 B2 preserving Human subjects and tenant boundaries',async()=>{
 const snapshot=await loadConfiguration(config),api=await createTargetPool(snapshot,'api',secrets),worker=await createTargetPool(snapshot,'worker',secrets),migration=await createTargetPool(snapshot,'migration',secrets);
 const deploymentId=`r1-${randomUUID()}`;
 const a=await createT5Subject(snapshot,migration,api,worker,deploymentId),b=await createT5Subject(snapshot,migration,api,worker,deploymentId),serviceId=randomUUID();
 const machine={...a.context,actorKind:'PLATFORM_SERVICE' as const,actorId:serviceId,sessionId:null,source:'T5_MULTITENANT_QUEUE'};
 const tx=createTransactionPort(worker),apiTx=createTransactionPort(api),jobs=createJobPersistence(),executed:string[]=[];
 try{
  await withTargetTransaction(migration,a.context,async client=>{await client.query("INSERT INTO identity.tbl_idn_identity(idn_id,idn_kind,idn_display_name)VALUES($1,'PLATFORM_SERVICE','R1 queue Worker')",[serviceId]);await client.query('INSERT INTO identity.tbl_idn_membership(idm_id,idm_identity__idn_id,idm_tenant_id)VALUES($1,$2,$3)',[randomUUID(),serviceId,a.context.tenantId]);});
  const states=[];
  for(const [label,subject]of [['A1',a.context],['B1',b.context],['A2',a.context],['B2',b.context]]as const){const id=randomUUID();states.push(id);await apiTx.run(subject,handle=>jobs.schedule(handle,{id,kind:'fixture.multitenant',idempotencyKey:id,payloadVersion:1,payload:{label},subject,maxAttempts:1}));}
  const executor=new clsJobWorker({transactions:tx,jobs,subject:a.workerSubject,worker:machine,leaseMs:1000,classify:()=>({reason:'SUBJECT_DENIED',retryable:false}),handlers:new Map([['fixture.multitenant',async job=>{
   const original=job.subject.tenantId===a.context.tenantId?a:b;assert.equal(job.subject.actorId,original.context.actorId);assert.equal(job.subject.sessionId,original.context.sessionId);
   const decision=await original.workerAuthority.authorize({context:job.subject,path:'Knowledge.Documents.use',resource:{type:'document',id:randomUUID(),tenantId:job.subject.tenantId,ownerId:job.subject.actorId!,classification:'LOW'}});assert.equal(decision.decision,enuAuthorityDecision.Permit);
   const cross=await original.workerAuthority.authorize({context:job.subject,path:'Knowledge.Documents.use',resource:{type:'document',id:randomUUID(),tenantId:job.subject.tenantId===a.context.tenantId?b.context.tenantId:a.context.tenantId,ownerId:job.subject.actorId!,classification:'LOW'}});assert.equal(cross.decision,enuAuthorityDecision.Reject);
   executed.push(String(job.payload.label));
  }]])});
  assert.equal(await executor.next(),'SUCCEEDED');assert.equal(await executor.next(),'SUCCEEDED');
  await withTargetTransaction(migration,a.context,client=>client.query('UPDATE session_core.tbl_ses_session SET ses_revoked_at=clock_timestamp()WHERE ses_id=$1',[a.context.sessionId]));
  assert.equal(await executor.next(),'FAILED');assert.equal(await executor.next(),'SUCCEEDED');assert.equal(await executor.next(),'EMPTY');
  assert.deepEqual(executed,['A1','B1','B2']);
  const rows=await migration.query('SELECT job_state FROM jobs.tbl_job_work WHERE job_id=ANY($1::uuid[])ORDER BY job_created_at',[states]);assert.deepEqual(rows.rows.map(row=>row.job_state),['SUCCEEDED','SUCCEEDED','FAILED','SUCCEEDED']);
 }finally{await a.clean();await b.clean();await api.end();await worker.end();await migration.end();}
});

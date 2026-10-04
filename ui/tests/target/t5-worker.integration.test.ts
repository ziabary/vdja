import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {loadConfiguration} from '../../packages/configuration/src/index.js';
import {createTargetPool,withTargetTransaction} from '../../packages/persistence/src/target.js';
import {createTransactionPort} from '../../packages/persistence/src/target-transaction.js';
import {createJobPersistence} from '../../packages/jobs/src/persistence.js';
import {clsJobWorker,type intfJobHandler} from '../../packages/jobs/src/worker.js';
import {createT5Subject} from './support/t5-live-subject.js';
import {createMachineIdentityPersistence} from '../../packages/identity/src/persistence.js';
import {createSemanticAuditPersistence} from '../../packages/audit/src/persistence/semantic.js';

const config=process.env.T4_PG_CONFIG,secrets=process.env.T4_SECRETS_DIR;
if(process.env.T5_REQUIRE_LIVE==='1'&&(!config||!secrets))throw new Error('T5_LIVE_CONFIGURATION_REQUIRED');
test('durable Worker heartbeat, claim replacement, shutdown, bounded retry and original Session revocation',{skip:!config||!secrets,timeout:30000},async t=>{
  const snapshot=await loadConfiguration(config!),api=await createTargetPool(snapshot,'api',secrets),worker=await createTargetPool(snapshot,'worker',secrets),migration=await createTargetPool(snapshot,'migration',secrets);
  const identity=await createT5Subject(snapshot,migration,api,worker),context=identity.context,serviceId=randomUUID(),membershipId=randomUUID();
  const machine={...context,actorKind:'PLATFORM_SERVICE' as const,actorId:serviceId,sessionId:null,source:'T5_DURABLE_WORKER'};
  const transactions=createTransactionPort(worker),apiTransactions=createTransactionPort(api),jobs=createJobPersistence(),audit=createSemanticAuditPersistence({...snapshot.value.siem,enabled:false});
  await withTargetTransaction(migration,context,async tx=>{await tx.query("INSERT INTO identity.tbl_idn_identity(idn_id,idn_kind,idn_display_name) VALUES ($1,'PLATFORM_SERVICE','T5 heartbeat Worker')",[serviceId]);await tx.query('INSERT INTO identity.tbl_idn_membership(idm_id,idm_identity__idn_id,idm_tenant_id) VALUES ($1,$2,$3)',[membershipId,serviceId,context.tenantId]);});
  const handlers=new Map<string,intfJobHandler>();let terminalFailures=0;
  const executor=()=>new clsJobWorker({transactions,jobs,subject:identity.workerSubject,worker:machine,leaseMs:1000,handlers,
    classify:error=>({reason:error instanceof Error&&error.message==='FIXTURE_DEPENDENCY_UNAVAILABLE'?'DEPENDENCY_UNAVAILABLE':'JOB_SUBJECT_OR_HANDLER_FAILED',retryable:error instanceof Error&&error.message==='FIXTURE_DEPENDENCY_UNAVAILABLE'}),
    async onFailure(tx,job,failure,terminal){if(terminal)terminalFailures+=1;await audit.record(tx,job.subject,{action:'jobs.execution.failed',result:'FAILED',reason:failure.reason,resource:{type:'job',id:job.id}});}});
  const schedule=async(kind:string)=>{const id=randomUUID();await apiTransactions.run(context,tx=>jobs.schedule(tx,{id,kind,idempotencyKey:id,payloadVersion:1,payload:{},subject:context,maxAttempts:2}));return id;};
  try{
    await createMachineIdentityPersistence(worker).platformService(machine);
    await t.test('heartbeat prevents a competing replica from replacing a live long-running claim',async()=>{
      let entered!:()=>void;const ready=new Promise<void>(resolve=>entered=resolve);
      handlers.set('fixture.heartbeat',async(job,fence)=>{entered();await new Promise(resolve=>setTimeout(resolve,1500));await transactions.run(job.subject,async tx=>{await fence(tx);await audit.record(tx,job.subject,{action:'jobs.fixture.completed',result:'SUCCEEDED'});});});
      await schedule('fixture.heartbeat');const running=executor().next();await ready;await new Promise(resolve=>setTimeout(resolve,1100));
      assert.equal(await transactions.run(machine,tx=>jobs.claim(tx,machine,1000)),null);assert.equal(await running,'SUCCEEDED');
    });
    await t.test('replaced claim aborts the handler and cannot commit through the publication fence',async()=>{
      let entered!:()=>void;const ready=new Promise<void>(resolve=>entered=resolve);let published=false;
      handlers.set('fixture.replaced',async(job,fence,signal)=>{entered();await new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve(),{once:true}));await transactions.run(job.subject,async tx=>{await fence(tx);published=true;});});
      const id=await schedule('fixture.replaced'),running=executor().next();await ready;
      await withTargetTransaction(migration,context,tx=>tx.query("UPDATE jobs.tbl_job_work SET job_lease_until=clock_timestamp()-interval '1 second' WHERE job_id=$1 AND job_tenant_id=$2",[id,context.tenantId]));
      assert.equal(await running,'LEASE_LOST');assert.equal(published,false);
      const replacement=await transactions.run(machine,tx=>jobs.claim(tx,machine,1000));assert.ok(replacement);assert.equal(replacement.attempts,2);assert.equal(await transactions.run(machine,tx=>jobs.finish(tx,machine,replacement)),true);
    });
    await t.test('shutdown rejects new claims and prevents an interrupted handler from publishing',async()=>{
      const controller=new AbortController();let entered!:()=>void;const ready=new Promise<void>(resolve=>entered=resolve);let published=false;
      handlers.set('fixture.shutdown',async(job,fence,signal)=>{entered();await new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve(),{once:true}));await transactions.run(job.subject,async tx=>{await fence(tx);published=true;});});
      const id=await schedule('fixture.shutdown'),running=executor().next(controller.signal);await ready;controller.abort();assert.equal(await running,'LEASE_LOST');assert.equal(published,false);assert.equal(await executor().next(controller.signal),'EMPTY');
      await withTargetTransaction(migration,context,tx=>tx.query("UPDATE jobs.tbl_job_work SET job_lease_until=clock_timestamp()-interval '1 second' WHERE job_id=$1 AND job_tenant_id=$2",[id,context.tenantId]));
      const replacement=await transactions.run(machine,tx=>jobs.claim(tx,machine,1000));assert.ok(replacement);await transactions.run(machine,tx=>jobs.finish(tx,machine,replacement));
    });
    await t.test('dependency retry is bounded and terminal semantic failure settles with the Job transaction',async()=>{
      handlers.set('fixture.retry',async()=>{throw new Error('FIXTURE_DEPENDENCY_UNAVAILABLE');});const id=await schedule('fixture.retry');
      assert.equal(await executor().next(),'FAILED');assert.equal(terminalFailures,0);
      await withTargetTransaction(migration,context,tx=>tx.query("UPDATE jobs.tbl_job_work SET job_available_at=clock_timestamp()-interval '1 second' WHERE job_id=$1 AND job_tenant_id=$2",[id,context.tenantId]));
      assert.equal(await executor().next(),'FAILED');assert.equal(terminalFailures,1);assert.equal(await executor().next(),'EMPTY');
      const state=await migration.query<{job_state:string;job_attempts:number}>('SELECT job_state,job_attempts FROM jobs.tbl_job_work WHERE job_id=$1',[id]);assert.equal(state.rows[0]?.job_state,'FAILED');assert.equal(state.rows[0]?.job_attempts,2);
    });
    await t.test('revoked original Human Session stops content processing despite a valid machine identity',async()=>{
      let called=false;handlers.set('fixture.revoked',async()=>{called=true;});await schedule('fixture.revoked');
      await withTargetTransaction(migration,context,tx=>tx.query('UPDATE session_core.tbl_ses_session SET ses_revoked_at=clock_timestamp() WHERE ses_id=$1',[context.sessionId]));
      assert.equal(await executor().next(),'FAILED');assert.equal(called,false);assert.equal(terminalFailures,2);
      await createMachineIdentityPersistence(worker).platformService(machine);
    });
    await t.test('crash on the last allowed attempt settles terminal metadata atomically after replacement without another content attempt',async()=>{
      const id=await schedule('fixture.exhausted');
      const first=await transactions.run(machine,tx=>jobs.claim(tx,machine,1000));assert.equal(first?.id,id);
      await withTargetTransaction(migration,context,tx=>tx.query("UPDATE jobs.tbl_job_work SET job_lease_until=clock_timestamp()-interval '1 second' WHERE job_id=$1",[id]));
      const second=await transactions.run(machine,tx=>jobs.claim(tx,machine,1000));assert.equal(second?.attempts,2);
      await withTargetTransaction(migration,context,tx=>tx.query("UPDATE jobs.tbl_job_work SET job_lease_until=clock_timestamp()-interval '1 second' WHERE job_id=$1",[id]));
      assert.equal(await executor().next(),'EMPTY');assert.equal(terminalFailures,3);
      const state=await migration.query<{job_state:string;job_attempts:number}>('SELECT job_state,job_attempts FROM jobs.tbl_job_work WHERE job_id=$1',[id]);
      assert.equal(state.rows[0]?.job_state,'FAILED');assert.equal(state.rows[0]?.job_attempts,2);
      assert.equal(await executor().next(),'EMPTY');assert.equal(terminalFailures,3);
    });
  }finally{
    await withTargetTransaction(migration,context,async tx=>{await tx.query('DELETE FROM jobs.tbl_job_work WHERE job_tenant_id=$1',[context.tenantId]);await tx.query('DELETE FROM identity.tbl_idn_membership WHERE idm_id=$1',[membershipId]);await tx.query('DELETE FROM identity.tbl_idn_identity WHERE idn_id=$1',[serviceId]);});
    await identity.clean();await api.end();await worker.end();await migration.end();
  }
});

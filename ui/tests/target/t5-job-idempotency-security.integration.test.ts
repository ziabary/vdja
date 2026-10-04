import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {loadConfiguration} from '../../packages/configuration/src/index.js';
import {createTargetPool} from '../../packages/persistence/src/target.js';
import {createTransactionPort} from '../../packages/persistence/src/target-transaction.js';
import {createJobPersistence} from '../../packages/jobs/src/persistence.js';
import {createT5Subject} from './support/t5-live-subject.js';
const config=process.env.T4_PG_CONFIG,secrets=process.env.T4_SECRETS_DIR;if(!config||!secrets)throw new Error('T5_LIVE_CONFIGURATION_REQUIRED');
test('Job idempotency binds immutable security identity and excludes request/correlation tracing',async()=>{
 const snapshot=await loadConfiguration(config),api=await createTargetPool(snapshot,'api',secrets),worker=await createTargetPool(snapshot,'worker',secrets),migration=await createTargetPool(snapshot,'migration',secrets),identity=await createT5Subject(snapshot,migration,api,worker);
 const transactions=createTransactionPort(api),jobs=createJobPersistence(),id=randomUUID(),base={id,kind:'fixture.identity',idempotencyKey:id,payloadVersion:1,payload:{resourceId:randomUUID()},subject:identity.context,maxAttempts:2};
 const schedule=(value:typeof base)=>transactions.run(value.subject,tx=>jobs.schedule(tx,value));
 try{assert.equal(await schedule(base),id);assert.equal(await schedule({...base,id:randomUUID(),subject:{...base.subject,requestId:randomUUID(),correlationId:randomUUID()}}),id);
  for(const delta of [{authorizationVersion:2},{configFingerprint:'new-approved-policy'},{sessionId:randomUUID()},{moduleId:'documents'}])await assert.rejects(schedule({...base,id:randomUUID(),subject:{...base.subject,...delta}}),/JOB_IDEMPOTENCY_CONFLICT/);
  await assert.rejects(schedule({...base,payload:{resourceId:randomUUID()}}),/JOB_IDEMPOTENCY_CONFLICT/);
 }finally{await identity.clean();await api.end();await worker.end();await migration.end();}
});

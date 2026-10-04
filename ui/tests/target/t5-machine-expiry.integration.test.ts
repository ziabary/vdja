import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {startT5RuntimeFixture} from './support/t5-runtime-fixture.js';
import {composeDocumentKnowledge} from '../../apps/runtime/src/composition.js';
import {createTargetPool,withTargetTransaction} from '../../packages/persistence/src/target.js';
import {createTransferRepository} from '../../packages/file-management/src/persistence.js';
import {createStorageAdapter} from '../../packages/storage/src/factory.js';
import {enuTransferState} from '../../packages/file-management/src/index.js';
import {enuTransferOperation} from '../../packages/file-management/src/transfers.js';
import {enuFileJob} from '../../packages/file-management/src/service.js';
import {createFileAdmissionPersistence} from '../../packages/admission-control/src/persistence/files.js';
import {enuFileReservationKind} from '../../packages/admission-control/src/files.js';
const live=!!process.env.T4_PG_CONFIG&&!!process.env.T4_SECRETS_DIR&&process.env.T5_REQUIRE_QDRANT==='1';
if(process.env.T5_REQUIRE_LIVE==='1'&&!live)throw new Error('T5_LIVE_MACHINE_EXPIRY_CONFIGURATION_REQUIRED');
test('explicit registered-machine expiry grant cleans expired staging after Human Session revocation without publishing or reading an Asset',{skip:!live},async()=>{
  const fixture=await startT5RuntimeFixture('LOCAL'),pool=await createTargetPool(fixture.snapshot,'api',fixture.secretRoot);
  const managed=await composeDocumentKnowledge(pool,fixture.snapshot,fixture.secretRoot);
  try{
    assert.ok(managed&&fixture.snapshot.value.fileManagement.enabled);const context=fixture.context,documentId=randomUUID(),id=randomUUID(),repository=createTransferRepository();
    const machine={...context,actorKind:'PLATFORM_SERVICE'as const,actorId:fixture.snapshot.value.worker.identityId!,sessionId:null,authorizationVersion:1};
    await managed.documents.create(context,{id:documentId,title:'Expired temporary candidate',classification:'LOW'});
    const storage=await createStorageAdapter(fixture.snapshot.value.fileManagement.storage,fixture.secretRoot),storageKey=`${createHash('sha256').update('expiry-scope').digest('hex')}/${randomUUID()}`;
    const descriptor={key:storageKey,bytes:5,sha256:createHash('sha256').update('hello').digest('hex'),mediaType:'text/plain'};
    const begun=await storage.begin(descriptor,id);assert.ok(begun.kind==='SUCCESS'&&begun.uploadId);
    const expiresAt=new Date(Date.now()+250).toISOString();
    await managed.transactions.run(context,async tx=>{
      await repository.create(tx,context,{id,documentId,idempotencyKey:'expired-fixture',filename:'pending.txt',mediaType:'text/plain',bytes:5,sha256:descriptor.sha256,
        assetId:randomUUID(),proposedVersionId:randomUUID(),storageKey,storageProfile:fixture.snapshot.value.fileManagement.enabled?fixture.snapshot.value.fileManagement.storage.profileId:'',partBytes:5242880,expiresAt});
      await createFileAdmissionPersistence().reserve(tx,context,{maxBytes:100,maxConcurrent:2,maxPendingBytes:100,maxTenantStorageBytes:100,maxTenantAssets:10},
        {id,kind:enuFileReservationKind.Upload,bytes:5,expiresAt});
    });
    await new Promise(resolve=>setTimeout(resolve,300));
    await assert.rejects(managed.files.expireAsService(machine,id),/FILE_DENIED/);
    await withTargetTransaction(fixture.migration,context,async tx=>{
      await tx.query('INSERT INTO authority.tbl_aut_grant(aug_id,aug_tenant_id,aug_identity__idn_id,aug_privileges) VALUES ($1,$2,$3,$4::jsonb)',
        [randomUUID(),context.tenantId,machine.actorId,JSON.stringify({Files:{Transfers:{expire:true}}})]);
      await tx.query('UPDATE session_core.tbl_ses_session SET ses_revoked_at=clock_timestamp() WHERE ses_id=$1',[context.sessionId]);
    });
    await managed.transactions.run(context,tx=>managed.jobs.schedule(tx,{id:randomUUID(),kind:enuFileJob.Expire,idempotencyKey:`expiry:${id}`,payloadVersion:1,payload:{transferId:id},subject:context,maxAttempts:2}));
    const outcome=await fixture.worker.jobs!.next();
    const jobState=await fixture.migration.query<{job_error_class:string}>('SELECT job_error_class FROM jobs.tbl_job_work WHERE job_tenant_id=$1 AND job_kind=$2',[context.tenantId,enuFileJob.Expire]);
    assert.equal(outcome,'SUCCEEDED',jobState.rows[0]?.job_error_class);
    const final=await managed.transactions.run(machine,tx=>repository.find(tx,machine,id));assert.equal(final?.state,'EXPIRED');assert.equal(final?.versionId,null);
    const reservation=await withTargetTransaction(pool,machine,tx=>tx.query<{afr_state:string}>('SELECT afr_state FROM admission.tbl_adm_file_reservation WHERE afr_id=$1',[id]));
    assert.equal(reservation.rows[0]?.afr_state,'RELEASED');
    assert.equal(await storage.inspect(storageKey),null);assert.equal(await storage.reconcileBegin(storageKey,id),null);
    const audit=await withTargetTransaction(pool,machine,tx=>tx.query<{ase_actor_kind:string;ase_initiator_actor_id:string;ase_request_id:string}>(
      "SELECT ase_actor_kind,ase_initiator_actor_id,ase_request_id FROM audit.tbl_aud_semantic_event WHERE ase_tenant_id=$1 AND ase_action='file.upload.expired'",[context.tenantId]));
    assert.equal(audit.rows[0]?.ase_actor_kind,'PLATFORM_SERVICE');assert.equal(audit.rows[0]?.ase_initiator_actor_id,context.actorId);assert.equal(audit.rows[0]?.ase_request_id,context.requestId);
  }finally{
    await withTargetTransaction(fixture.migration,fixture.context,tx=>tx.query('DELETE FROM authority.tbl_aut_grant WHERE aug_identity__idn_id=$1 AND aug_tenant_id=$2',
      [fixture.snapshot.value.worker.identityId,fixture.context.tenantId]));
    await managed?.close();await pool.end();await fixture.close();
  }
});

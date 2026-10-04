import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {S3Client,CreateBucketCommand} from '@aws-sdk/client-s3';
import {startT5RuntimeFixture} from './support/t5-runtime-fixture.js';
import {startS3Fixture} from './support/t5-s3-fixture.js';
import {composeDocumentKnowledge} from '../../apps/runtime/src/composition.js';
import {createTargetPool} from '../../packages/persistence/src/target.js';
import {createStorageAdapter} from '../../packages/storage/src/factory.js';
import {clsS3StorageAdapter} from '../../packages/storage/src/adapters/s3.js';
import {clsLocalStorageAdapter} from '../../packages/storage/src/adapters/local.js';
import {clsStorageMigration} from '../../packages/file-management/src/storage-migration.js';
import {createStorageMigrationJournal} from '../../packages/file-management/src/persistence/storage-migration.js';
import {createSemanticAuditPersistence} from '../../packages/audit/src/persistence/semantic.js';
import {enuDocumentOperation} from '../../packages/documents/src/index.js';
const live=!!process.env.T4_PG_CONFIG&&!!process.env.T4_SECRETS_DIR&&process.env.T5_REQUIRE_QDRANT==='1';
if(process.env.T5_REQUIRE_LIVE==='1'&&!live)throw new Error('T5_LIVE_STORAGE_MIGRATION_CONFIGURATION_REQUIRED');
test('Local → native S3 → Local preserves canonical IDs and full hashes, retains rollback source and persists retryable proof',{skip:!live},async()=>{
  const fixture=await startT5RuntimeFixture('LOCAL'),s3=await startS3Fixture();
  const pool=await createTargetPool(fixture.snapshot,'api',fixture.secretRoot),managed=await composeDocumentKnowledge(pool,fixture.snapshot,fixture.secretRoot);
  const bucket=`migration-${randomUUID()}`,setup=new S3Client({endpoint:s3.endpoint,credentials:s3.credentials,forcePathStyle:true,region:'us-east-1',maxAttempts:1});
  const destination=new clsS3StorageAdapter({kind:'S3_COMPATIBLE',profileId:'logical-original',endpoint:s3.endpoint,bucket,region:'us-east-1',forcePathStyle:true,
    timeoutMs:5000,accessKeyRef:'file:/run/secrets/access',secretKeyRef:'file:/run/secrets/secret',credentials:s3.credentials});
  const bytes=Buffer.from('STORAGE_MIGRATION_CANONICAL_SOURCE'),documentId=randomUUID(),sha256=createHash('sha256').update(bytes).digest('hex');
  try{
    assert.ok(managed);assert.ok(fixture.snapshot.value.fileManagement.enabled);await setup.send(new CreateBucketCommand({Bucket:bucket}));
    await managed.documents.create(fixture.context,{id:documentId,title:'Migration source',classification:'LOW'});
    const transfer=await managed.files.initiate(fixture.context,{documentId,idempotencyKey:'storage-migration-source',filename:'source.txt',mediaType:'text/plain',bytes:bytes.length,sha256});
    await managed.files.uploadPart(fixture.context,transfer.id,1,sha256,bytes);const committed=await managed.files.complete(fixture.context,transfer.id);assert.ok('processingState'in committed);
    const original=await managed.documents.asset(fixture.context,documentId,committed.id,enuDocumentOperation.Manage);
    const source=await createStorageAdapter(fixture.snapshot.value.fileManagement.storage,fixture.secretRoot);let approved=false;
    const ports={transactions:managed.transactions,documents:managed.documents,audit:createSemanticAuditPersistence(fixture.snapshot.value.siem),journal:createStorageMigrationJournal(),
      source,destination,sourceProfileId:original.storageProfile,destinationBinding:'s3-fixture-binding-v1',approve:async()=>approved};
    const copy=new clsStorageMigration(ports);await assert.rejects(copy.copy(fixture.context,documentId,committed.id),/STORAGE_MIGRATION_DENIED/);approved=true;
    assert.equal(await copy.copy(fixture.context,documentId,committed.id),'VERIFIED');assert.equal(await copy.copy(fixture.context,documentId,committed.id),'VERIFIED');
    assert.equal((await destination.inspect(original.storageKey))?.sha256,sha256);assert.equal((await source.inspect(original.storageKey))?.sha256,sha256);
    const reverse=new clsStorageMigration({...ports,source:destination,destination:new clsLocalStorageAdapter(`${fixture.root}/rollback-copy`),destinationBinding:'local-fixture-binding-v2'});
    assert.equal(await reverse.copy(fixture.context,documentId,committed.id),'VERIFIED');
    assert.deepEqual(await managed.documents.asset(fixture.context,documentId,committed.id,enuDocumentOperation.Manage),original);
    assert.equal((await managed.documents.versions(fixture.context,documentId)).length,1);
  }finally{destination.close();setup.destroy();await managed?.close();await pool.end();await s3.close();await fixture.close();}
});

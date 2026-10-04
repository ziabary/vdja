import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {loadConfiguration} from '../../packages/configuration/src/index.js';
import {startT5RuntimeFixture} from './support/t5-runtime-fixture.js';
import {composeDocumentKnowledge} from '../../apps/runtime/src/composition.js';
import {createTargetPool,withTargetTransaction} from '../../packages/persistence/src/target.js';
const live=!!process.env.T4_PG_CONFIG&&!!process.env.T4_SECRETS_DIR&&process.env.T5_REQUIRE_QDRANT==='1';
if(process.env.T5_REQUIRE_LIVE==='1'&&!live)throw new Error('T5_LIVE_FILE_LIMITS_CONFIGURATION_REQUIRED');
test('Authority selects file tiers; Admission enforces distributed actor and hard limits after elevation and revocation',{skip:!live},async()=>{
  const fixture=await startT5RuntimeFixture(),pool=await createTargetPool(fixture.snapshot,'api',fixture.secretRoot);
  const authenticated={maxBytes:10,maxConcurrent:1,maxPendingBytes:10,maxStorageBytes:10,maxAssets:1};
  const privileged={maxBytes:20,maxConcurrent:2,maxPendingBytes:40,maxStorageBytes:40,maxAssets:2};
  const raw=structuredClone(fixture.snapshot.value);
  assert.ok(raw.fileManagement?.enabled);
  const path=join(fixture.root,'file-tier-profile.cjson');
  await writeFile(path,JSON.stringify({...raw,fileManagement:{...raw.fileManagement,limitTiers:{authenticated,privileged}}}),{mode:0o600});
  const managed=await composeDocumentKnowledge(pool,await loadConfiguration(path),fixture.secretRoot);
  const grantId=randomUUID();
  try{
    assert.ok(managed);
    assert.equal((await fixture.request('/spaces',{},true)).status,401);
    const documentId=randomUUID();await managed.documents.create(fixture.context,{id:documentId,title:'Actor quota proof',classification:'LOW'});
    const input=(size:number,key:string)=>({documentId,filename:'quota.txt',mediaType:'text/plain',bytes:size,sha256:createHash('sha256').update('x'.repeat(size)).digest('hex'),idempotencyKey:key});
    await assert.rejects(managed.files.initiate(fixture.context,input(11,'default-too-large')),/INVALID_TRANSFER/);
    await managed.files.initiate(fixture.context,input(5,'first'));
    await assert.rejects(managed.files.initiate(fixture.context,input(5,'default-concurrent')),/CAPACITY_EXHAUSTED/);
    await withTargetTransaction(fixture.migration,fixture.context,tx=>tx.query(
      'INSERT INTO authority.tbl_aut_grant(aug_id,aug_tenant_id,aug_identity__idn_id,aug_privileges) VALUES($1,$2,$3,$4::jsonb)',
      [grantId,fixture.context.tenantId,fixture.context.actorId,JSON.stringify({Knowledge:{Files:{elevatedLimits:true}}})]));
    const elevated=await managed.files.initiate(fixture.context,input(20,'elevated'));
    await assert.rejects(managed.files.initiate(fixture.context,input(20,'elevated-concurrent')),/CAPACITY_EXHAUSTED/);
    await assert.rejects(managed.files.initiate(fixture.context,input(10485761,'hard-limit')),/FILE_TOO_LARGE|INVALID_TRANSFER/);
    await withTargetTransaction(fixture.migration,fixture.context,tx=>tx.query('DELETE FROM authority.tbl_aut_grant WHERE aug_id=$1',[grantId]));
    await assert.rejects(managed.files.initiate(fixture.context,input(11,'revoked')),/INVALID_TRANSFER/);
    assert.equal((await managed.files.status(fixture.context,elevated.id)).state,'UPLOADING');
  }finally{
    await withTargetTransaction(fixture.migration,fixture.context,tx=>tx.query('DELETE FROM authority.tbl_aut_grant WHERE aug_id=$1',[grantId]));
    await managed?.close();await pool.end();await fixture.close();
  }
});

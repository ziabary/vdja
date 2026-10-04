import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {planLegacyRagMigration,clsLegacyRagMigration} from '../../packages/knowledge/src/legacy-migration.js';
import {startT5RuntimeFixture} from './support/t5-runtime-fixture.js';
import {composeDocumentKnowledge} from '../../apps/runtime/src/composition.js';
import {createTargetPool} from '../../packages/persistence/src/target.js';
const text=Buffer.from('CANONICAL_LEGACY_ASSET: immutable original content for migration verification.');
const source={service:'rag',fileId:'42',legacyUserId:'7',filename:'source.txt',bytes:text.length,
  sha256:createHash('sha256').update(text).digest('hex'),mediaType:'text/plain',sourceKind:'ORIGINAL_ASSET',sourceRef:'export:42',state:'Active'};
const owner={service:'rag',legacyUserId:'7',deploymentId:'deployment',tenantId:'tenant',actorId:'identity',
  spaceId:randomUUID(),spaceTitle:'Migrated knowledge',classification:'LOW'};
test('legacy mapping fails closed for missing/ambiguous owners, privilege imports, duplicate identity and derived source',()=>{
  assert.throws(()=>planLegacyRagMigration('export',[source],[]),/LEGACY_OWNER_MISSING/);
  assert.throws(()=>planLegacyRagMigration('export',[source],[owner,owner]),/LEGACY_OWNER_AMBIGUOUS/);
  assert.throws(()=>planLegacyRagMigration('export',[source],[{...owner,privs:{ALL:true}}]),/LEGACY_MIGRATION_INVALID/);
  assert.throws(()=>planLegacyRagMigration('export',[source,source],[owner]),/LEGACY_MIGRATION_INVALID/);
  assert.throws(()=>planLegacyRagMigration('export',[{...source,sourceKind:'QDRANT_PAYLOAD'}],[owner]),/LEGACY_DERIVED_SOURCE/);
});
test('migration identities ignore enumeration order and remain stable when content changes while exact approval digest changes',()=>{
  const second={...source,fileId:'43'},first=planLegacyRagMigration('export',[source,second],[owner]);
  assert.deepEqual(first,planLegacyRagMigration('export',[second,source],[owner]));
  const changed=planLegacyRagMigration('export',[{...source,sha256:'a'.repeat(64)}],[owner]);
  assert.equal(changed.items[0]!.documentId,planLegacyRagMigration('export',[source],[owner]).items[0]!.documentId);
  assert.notEqual(changed.digest,planLegacyRagMigration('export',[source],[owner]).digest);
  const removed=planLegacyRagMigration('export',[{...source,state:'Removed'}],[owner]);assert.equal(removed.items.length,0);assert.equal(removed.excluded.length,1);
});
const live=!!process.env.T4_PG_CONFIG&&!!process.env.T4_SECRETS_DIR&&process.env.T5_REQUIRE_QDRANT==='1';
if(process.env.T5_REQUIRE_LIVE==='1'&&!live)throw new Error('T5_LIVE_MIGRATION_CONFIGURATION_REQUIRED');
test('approved legacy original migrates through canonical Document/File Management and retries without duplicate versions; index rebuild is fresh',{skip:!live},async()=>{
  const fixture=await startT5RuntimeFixture('LOCAL');
  const pool=await createTargetPool(fixture.snapshot,'api',fixture.secretRoot),managed=await composeDocumentKnowledge(pool,fixture.snapshot,fixture.secretRoot);
  try{assert.ok(managed?.knowledge);
    const mapped={...owner,deploymentId:fixture.context.deploymentId,tenantId:fixture.context.tenantId,actorId:fixture.context.actorId};
    const plan=planLegacyRagMigration('test-export',[source],[mapped]);let approved=false,reads=0;
    const migration=new clsLegacyRagMigration({documents:managed.documents,files:managed.files,knowledge:managed.knowledge,
      approve:async candidate=>approved&&candidate.digest===plan.digest,contextFor:async()=>fixture.context,
      openOriginal:async()=>{reads+=1;return(async function*(){yield text;})();}});
    await assert.rejects(migration.execute(plan),/LEGACY_MIGRATION_NOT_APPROVED/);approved=true;
    const first=await migration.execute(plan),again=await migration.execute(plan);assert.deepEqual(first,again);assert.equal(reads,1);
    assert.equal((await managed.documents.versions(fixture.context,first[0]!.documentId)).length,1);
    assert.ok(fixture.worker.jobs);for(let count=0;count<15;count++){const result=await fixture.worker.jobs.next();if(result==='EMPTY')break;assert.equal(result,'SUCCEEDED');}
    assert.equal((await managed.knowledge.status(fixture.context,mapped.spaceId)).state,'READY');
    const materialized=await managed.files.materialize(fixture.context,first[0]!.documentId,first[0]!.versionId);assert.equal(materialized,text.toString());
    await assert.rejects(migration.execute({...plan,digest:'f'.repeat(64)}),/LEGACY_MIGRATION_INVALID/);
    const conflicting=planLegacyRagMigration('test-export',[{...source,sha256:'e'.repeat(64)}],[mapped]);
    const changed=new clsLegacyRagMigration({documents:managed.documents,files:managed.files,knowledge:managed.knowledge,
      approve:async()=>true,contextFor:async()=>fixture.context,openOriginal:async()=>{throw new Error('MUST_NOT_READ');}});
    await assert.rejects(changed.execute(conflicting),/TRANSFER_CONFLICT/);
  }finally{await managed?.close();await pool.end();await fixture.close();}
});

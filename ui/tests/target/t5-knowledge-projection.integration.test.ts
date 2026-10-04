import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { test } from 'node:test';
import { loadConfiguration } from '../../packages/configuration/src/index.js';
import { createTargetPool, withTargetTransaction } from '../../packages/persistence/src/target.js';
import { createTransactionPort } from '../../packages/persistence/src/target-transaction.js';
import { createKnowledgeRepository } from '../../packages/knowledge/src/persistence.js';
import { clsQdrantAdapter } from '../../packages/knowledge/src/adapters/qdrant.js';
import { chunkNormalized, deterministicIdentifier, verifyChunk } from '../../packages/knowledge/src/chunking.js';
import { enuIndexState, enuMembershipMode, type intfVectorPoint } from '../../packages/knowledge/src/index.js';
import { startQdrantFixture } from './support/t5-qdrant-fixture.js';
import type { intfExecutionContext } from '../../packages/contracts/src/index.js';
const config=process.env.T4_PG_CONFIG,secrets=process.env.T4_SECRETS_DIR;
if(process.env.T5_REQUIRE_LIVE==='1'&&(!config||!secrets))throw new Error('T5_LIVE_CONFIGURATION_REQUIRED');
test('Knowledge canonical metadata and real Qdrant generation enforce isolation, deterministic rebuild and atomic activation',
  {skip:!config||!secrets||process.env.T5_REQUIRE_QDRANT!=='1'},async t=>{
    const snapshot=await loadConfiguration(config!),api=await createTargetPool(snapshot,'api',secrets),worker=await createTargetPool(snapshot,'worker',secrets),migration=await createTargetPool(snapshot,'migration',secrets);
    const fixture=await startQdrantFixture();
    const repository=createKnowledgeRepository(),apiTx=createTransactionPort(api),workerTx=createTransactionPort(worker);
    const context:intfExecutionContext={deploymentId:snapshot.value.deployment.id,tenantId:`t5-index-${randomUUID()}`,actorId:randomUUID(),actorKind:'HUMAN',sessionId:randomUUID(),authorizationVersion:1,moduleId:'knowledge',requestId:randomUUID(),correlationId:randomUUID(),source:'T5_TEST',configFingerprint:snapshot.fingerprint};
    const spaceId=randomUUID(),documentId=randomUUID(),versionId=randomUUID(),generationId=randomUUID();
    const profile={id:'test-profile-v1',embeddingProfileId:'fixture-embedding-v1',dimensions:3,chunkingProfile:'utf16-window-v1',chunkChars:64,overlapChars:8};
    const collection=`idx_${createHash('sha256').update(profile.id).digest('hex').slice(0,16)}_${generationId.replaceAll('-','')}`;
    const generation={...profile,generationId,collection,state:enuIndexState.Building};
    const text='Canonical retained document content and source offsets. '.repeat(10);
    const boundaries=chunkNormalized(text,versionId,profile),chunks=boundaries.map(boundary=>({...boundary,generationId,spaceId,documentId,versionId,documentSecurityVersion:1,membershipSecurityVersion:1}));
    const points:intfVectorPoint[]=chunks.map(value=>({id:deterministicIdentifier([generationId,spaceId,value.id]),vector:[1,0.1,0.2],payload:{deploymentId:context.deploymentId,tenantId:context.tenantId,generationId,spaceId,documentId,versionId,chunkId:value.id,documentSecurityVersion:1,membershipSecurityVersion:1}}));
    const filter={deploymentId:context.deploymentId,tenantId:context.tenantId,generationId,spaceId,documentIds:[documentId]};
    const adapter=()=>new clsQdrantAdapter({endpoint:fixture.endpoint,apiKey:fixture.apiKey,timeoutMs:5000,maxResponseBytes:1048576});
    try{
      await apiTx.run(context,async tx=>{await repository.createSpace(tx,context,{id:spaceId,title:'Private Knowledge',classification:'LOW'});await repository.membership(tx,context,{spaceId,documentId,mode:enuMembershipMode.Current,pinnedVersionId:null});});
      await workerTx.run(context,tx=>repository.beginGeneration(tx,context,generation));
      await t.test('retry preserves immutable generation/chunk identity and a conflicting profile fails',async()=>{
        await workerTx.run(context,tx=>repository.beginGeneration(tx,context,generation));
        await assert.rejects(workerTx.run(context,tx=>repository.beginGeneration(tx,context,{...generation,dimensions:4})),/INDEX_CONFLICT/);
        await workerTx.run(context,tx=>repository.saveChunks(tx,context,chunks));
        await workerTx.run(context,tx=>repository.saveChunks(tx,context,chunks));
        await assert.rejects(workerTx.run(context,tx=>repository.saveChunks(tx,context,[{...chunks[0]!,sha256:'f'.repeat(64)}])),/INDEX_CONFLICT/);
        assert.deepEqual(chunkNormalized(text,versionId,profile),boundaries);
        assert.equal(verifyChunk(text,boundaries[0]!.start,boundaries[0]!.end,boundaries[0]!.sha256),text.slice(0,64));
        await assert.rejects(async()=>verifyChunk('corrupted'+text,boundaries[0]!.start,boundaries[0]!.end,boundaries[0]!.sha256),/STALE_PROJECTION/);
      });
      await t.test('fresh Qdrant rebuild, idempotent upsert and authorized filters return only opaque references',async()=>{
        await adapter().ready();await adapter().ensure(collection,3);await adapter().upsert(collection,points);await adapter().upsert(collection,points);
        assert.equal(await adapter().count(collection,filter),chunks.length);
        assert.equal(await adapter().count(collection,{...filter,tenantId:'other'}),0);
        assert.deepEqual(await adapter().search(collection,[1,0.1,0.2],{...filter,documentIds:[]},5),[]);
        const hits=await adapter().search(collection,[1,0.1,0.2],filter,5);assert.equal(hits.length,5);
        for(const hit of hits)assert.deepEqual(Object.keys(hit).sort(),['chunkId','id','score']);
        await assert.rejects(adapter().ensure(collection,4),/INDEX_CONFLICT/);
        const unauthenticated=await fetch(`${fixture.endpoint}/collections`);assert.equal(unauthenticated.status,401);
      });
      await t.test('activation requires complete counts and immutable snapshot; concurrent replacement cannot regress',async()=>{
        const space=await apiTx.run(context,tx=>repository.space(tx,context,spaceId));assert.ok(space);
        await assert.rejects(workerTx.run(context,tx=>repository.activate(tx,context,generationId,spaceId,space.securityVersion,chunks.length+1,null)),/INDEX_CONFLICT/);
        await workerTx.run(context,tx=>repository.activate(tx,context,generationId,spaceId,space.securityVersion,chunks.length,null));
        const active=await apiTx.run(context,tx=>repository.space(tx,context,spaceId));assert.equal(active?.generationId,generationId);assert.equal(active?.projectionSecurityVersion,active?.securityVersion);
        await apiTx.run(context,tx=>repository.membership(tx,context,{spaceId,documentId,mode:enuMembershipMode.Pinned,pinnedVersionId:versionId}));
        const stale=await apiTx.run(context,tx=>repository.space(tx,context,spaceId));assert.notEqual(stale?.projectionSecurityVersion,stale?.securityVersion);
        await assert.rejects(workerTx.run(context,tx=>repository.activate(tx,context,generationId,spaceId,space.securityVersion,chunks.length,null)),/STALE_PROJECTION/);
      });
      await t.test('real Qdrant restart keeps derived bytes while PostgreSQL remains canonical and scope fails closed',async()=>{
        await fixture.restart();assert.equal(await adapter().count(collection,filter),chunks.length);
        assert.equal(await apiTx.run({...context,tenantId:'other'},tx=>repository.space(tx,{...context,tenantId:'other'},spaceId)),null);
        assert.equal((await api.query('SELECT ksp_id FROM knowledge.tbl_knw_space')).rowCount,0);
        await assert.rejects(workerTx.run(context,tx=>repository.createSpace(tx,context,{id:randomUUID(),title:'forbidden',classification:'LOW'})),/permission denied/);
      });
    }finally{
      await withTargetTransaction(migration,context,async tx=>{
        await tx.query('DELETE FROM knowledge.tbl_knw_projection WHERE kpr_tenant_id=$1',[context.tenantId]);
        await tx.query('UPDATE knowledge.tbl_knw_space SET ksp_generation_id=NULL WHERE ksp_tenant_id=$1',[context.tenantId]);
        await tx.query('DELETE FROM knowledge.tbl_knw_chunk WHERE kch_tenant_id=$1',[context.tenantId]);
        await tx.query('DELETE FROM knowledge.tbl_knw_membership WHERE kmb_tenant_id=$1',[context.tenantId]);
        await tx.query('DELETE FROM knowledge.tbl_knw_space WHERE ksp_tenant_id=$1',[context.tenantId]);
        await tx.query('DELETE FROM knowledge.tbl_knw_generation WHERE kgn_tenant_id=$1',[context.tenantId]);
      });
      await fixture.close();await api.end();await worker.end();await migration.end();
    }
  });

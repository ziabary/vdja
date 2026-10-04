import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {loadConfiguration} from '../../packages/configuration/src/index.js';
import {createTargetPool,withTargetTransaction} from '../../packages/persistence/src/target.js';
import {createTargetTransactionPersistence} from '../../packages/persistence/src/target-transaction.js';
import {createPersonalChatRepository} from '../../packages/knowledge/src/persistence/chat.js';
import {createKnowledgeRepository} from '../../packages/knowledge/src/persistence.js';
import {enuMembershipMode} from '../../packages/knowledge/src/index.js';
import type {intfExecutionContext} from '../../packages/contracts/src/index.js';

const config=process.env.T5_R3_PG_CONFIG,secrets=process.env.T5_R3_SECRETS_DIR;
test('personal chat history persists and is isolated by actor and tenant',
  {skip:!config||!secrets},async()=>{
    const snapshot=await loadConfiguration(config!),api=await createTargetPool(snapshot,'api',secrets),migration=await createTargetPool(snapshot,'migration',secrets);
    const actorId=randomUUID(),spaceId=randomUUID(),chatId=randomUUID(),documentId=randomUUID();
    const context:intfExecutionContext={deploymentId:snapshot.value.deployment.id,tenantId:snapshot.value.deployment.tenantId,
      moduleId:'knowledge',actorKind:'HUMAN',actorId,sessionId:randomUUID(),authorizationVersion:1,
      requestId:randomUUID().replaceAll('-',''),correlationId:randomUUID(),source:'KNOWLEDGE_API',configFingerprint:snapshot.fingerprint};
    const other={...context,actorId:randomUUID(),requestId:randomUUID().replaceAll('-','')};
    const repository=createPersonalChatRepository(),transactions=createTargetTransactionPersistence(api);
    try{
      await withTargetTransaction(migration,context,client=>client.query(
        `INSERT INTO knowledge.tbl_knw_space(ksp_id,ksp_deployment_id,ksp_tenant_id,ksp_title,ksp_owner_id,ksp_classification)
         VALUES($1,$2,$3,'Personal RAG integration', $4,'LOW')`,[spaceId,context.deploymentId,context.tenantId,actorId]).then(()=>{}));
      await transactions.run(context,tx=>repository.create(tx,context,chatId,spaceId));
      assert.equal((await transactions.run(context,tx=>repository.list(tx,context,spaceId))).length,1);
      assert.deepEqual(await transactions.run(other,tx=>repository.list(tx,other,spaceId)),[]);
      await transactions.run(context,tx=>repository.append(tx,context,chatId,'What is the code?','The code is ALPHA-741.',[]));
      const messages=await transactions.run(context,tx=>repository.messages(tx,context,chatId));
      assert.deepEqual(messages.map(item=>item.role),['USER','ASSISTANT']);
      assert.equal(messages[1]?.text,'The code is ALPHA-741.');
      assert.deepEqual(await transactions.run(other,tx=>repository.messages(tx,other,chatId)),[]);
      assert.equal((await transactions.run(context,tx=>repository.list(tx,context,spaceId)))[0]?.title,'What is the code?');
      await transactions.run(context,tx=>repository.retire(tx,context,spaceId,chatId));
      assert.deepEqual(await transactions.run(context,tx=>repository.list(tx,context,spaceId)),[]);
      assert.equal(await transactions.run(context,tx=>repository.active(tx,context,chatId,spaceId)),false);
      const knowledge=createKnowledgeRepository();
      await transactions.run(context,tx=>knowledge.membership(tx,context,{spaceId,documentId,mode:enuMembershipMode.Current,pinnedVersionId:null}));
      assert.equal((await transactions.run(context,tx=>knowledge.memberships(tx,context,spaceId))).length,1);
      await transactions.run(context,tx=>knowledge.removeMembership(tx,context,spaceId,documentId));
      assert.deepEqual(await transactions.run(context,tx=>knowledge.memberships(tx,context,spaceId)),[]);
      assert.deepEqual(await transactions.run(context,tx=>knowledge.spacesForDocument(tx,context,documentId)),[]);
      await transactions.run(context,tx=>knowledge.membership(tx,context,{spaceId,documentId,mode:enuMembershipMode.Current,pinnedVersionId:null}));
      assert.equal((await transactions.run(context,tx=>knowledge.memberships(tx,context,spaceId))).length,1);
    }finally{
      await withTargetTransaction(migration,context,async client=>{
        await client.query(`DELETE FROM knowledge.tbl_knw_membership WHERE kmb_deployment_id=$1 AND kmb_tenant_id=$2 AND kmb_space__ksp_id=$3`,[context.deploymentId,context.tenantId,spaceId]);
        await client.query(`DELETE FROM knowledge.tbl_knw_chat_message WHERE kcm_deployment_id=$1 AND kcm_tenant_id=$2 AND kcm_conversation__kcv_id=$3`,[context.deploymentId,context.tenantId,chatId]);
        await client.query(`DELETE FROM knowledge.tbl_knw_conversation WHERE kcv_deployment_id=$1 AND kcv_tenant_id=$2 AND kcv_id=$3`,[context.deploymentId,context.tenantId,chatId]);
        await client.query(`DELETE FROM knowledge.tbl_knw_space WHERE ksp_deployment_id=$1 AND ksp_tenant_id=$2 AND ksp_id=$3`,[context.deploymentId,context.tenantId,spaceId]);
      }).catch(()=>{});
      await api.end();await migration.end();
    }
  });

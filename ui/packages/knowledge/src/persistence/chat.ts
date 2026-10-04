import {resolveTargetTransaction} from '../../../persistence/src/target-transaction.js';
import type {intfKnowledgeCitation} from '../service.js';
import type {intfExecutionContext} from '../../../contracts/src/index.js';
import type {intfPersonalChatRepository} from '../personal-chat-contracts.js';
const scope=(context:intfExecutionContext)=>[context.deploymentId,context.tenantId,context.actorId];
const tenantScope=(context:intfExecutionContext)=>[context.deploymentId,context.tenantId];
export function createPersonalChatRepository():intfPersonalChatRepository{return {
  async create(tx,context,id,spaceId){await resolveTargetTransaction(tx).query(
    `INSERT INTO knowledge.tbl_knw_conversation(kcv_id,kcv_deployment_id,kcv_tenant_id,kcv_owner_id,kcv_space__ksp_id)
     VALUES($1,$2,$3,$4,$5)`,[id,...scope(context),spaceId]);},
  async list(tx,context,spaceId){const result=await resolveTargetTransaction(tx).query<{kcv_id:string;kcv_title:string;kcv_updated_at:Date}>(
    `SELECT kcv_id,kcv_title,kcv_updated_at FROM knowledge.tbl_knw_conversation
     WHERE kcv_deployment_id=$1 AND kcv_tenant_id=$2 AND kcv_owner_id=$3 AND kcv_space__ksp_id=$4 AND kcv_lifecycle='ACTIVE'
     ORDER BY kcv_updated_at DESC,kcv_id DESC LIMIT 100`,[...scope(context),spaceId]);
    return result.rows.map(row=>({id:row.kcv_id,title:row.kcv_title,updatedAt:row.kcv_updated_at.toISOString()}));},
  async active(tx,context,id,spaceId){const result=await resolveTargetTransaction(tx).query(
    `SELECT kcv_id FROM knowledge.tbl_knw_conversation
     WHERE kcv_deployment_id=$1 AND kcv_tenant_id=$2 AND kcv_owner_id=$3 AND kcv_id=$4 AND kcv_space__ksp_id=$5 AND kcv_lifecycle='ACTIVE'`,
    [...scope(context),id,spaceId]);return result.rowCount===1;},
  async messages(tx,context,id){const result=await resolveTargetTransaction(tx).query<{kcm_id:string;kcm_role:'USER'|'ASSISTANT';kcm_text:string;kcm_citations:readonly intfKnowledgeCitation[]}>(
    `SELECT kcm_id,kcm_role,kcm_text,kcm_citations FROM knowledge.tbl_knw_chat_message
     WHERE kcm_deployment_id=$1 AND kcm_tenant_id=$2 AND kcm_conversation__kcv_id=$3
     ORDER BY kcm_sequence LIMIT 200`,[...tenantScope(context),id]);
    return result.rows.map(row=>({id:row.kcm_id,role:row.kcm_role,text:row.kcm_text,citations:row.kcm_citations}));},
  async append(tx,context,id,question,answer,citations){const client=resolveTargetTransaction(tx);
    const locked=await client.query<{kcv_title:string}>(
      `SELECT kcv_title FROM knowledge.tbl_knw_conversation WHERE kcv_deployment_id=$1 AND kcv_tenant_id=$2 AND kcv_owner_id=$3 AND kcv_id=$4 AND kcv_lifecycle='ACTIVE' FOR UPDATE`,
      [...scope(context),id]);if(!locked.rows[0])throw new Error('CHAT_NOT_FOUND');
    const count=await client.query<{next:string}>(
      `SELECT COALESCE(MAX(kcm_sequence),0)+1 AS next FROM knowledge.tbl_knw_chat_message
       WHERE kcm_deployment_id=$1 AND kcm_tenant_id=$2 AND kcm_conversation__kcv_id=$3`,[...tenantScope(context),id]);
    const sequence=Number(count.rows[0]?.next);if(!Number.isSafeInteger(sequence)||sequence>199)throw new Error('CHAT_LIMIT');
    await client.query(`INSERT INTO knowledge.tbl_knw_chat_message
      (kcm_id,kcm_deployment_id,kcm_tenant_id,kcm_conversation__kcv_id,kcm_sequence,kcm_role,kcm_text,kcm_citations)
      VALUES(gen_random_uuid(),$1,$2,$3,$4,'USER',$5,'[]'::jsonb),
            (gen_random_uuid(),$1,$2,$3,$6,'ASSISTANT',$7,$8::jsonb)`,
      [...tenantScope(context),id,sequence,question,sequence+1,answer,JSON.stringify(citations)]);
    const title=locked.rows[0].kcv_title==='گفتگوی جدید'?question.trim().slice(0,80):locked.rows[0].kcv_title;
    await client.query(`UPDATE knowledge.tbl_knw_conversation SET kcv_title=$5,kcv_updated_at=clock_timestamp()
      WHERE kcv_deployment_id=$1 AND kcv_tenant_id=$2 AND kcv_owner_id=$3 AND kcv_id=$4`,[...scope(context),id,title]);},
  async retire(tx,context,spaceId,id){await resolveTargetTransaction(tx).query(
    `UPDATE knowledge.tbl_knw_conversation SET kcv_lifecycle='RETIRED',kcv_updated_at=clock_timestamp()
     WHERE kcv_deployment_id=$1 AND kcv_tenant_id=$2 AND kcv_owner_id=$3 AND kcv_space__ksp_id=$4
       AND ($5::uuid IS NULL OR kcv_id=$5) AND kcv_lifecycle='ACTIVE'`,[...scope(context),spaceId,id]);}
};}

import {resolveTargetTransaction} from '../../../persistence/src/target-transaction.js';
import type {intfRagUsagePort} from '../rag.js';
export function createRagUsagePersistence():intfRagUsagePort{
  return{async record(tx,context,fact){
    const values=[fact.queries,fact.documentsProcessed,fact.embeddingItems,fact.retrievalCandidates,fact.authorizedChunks,fact.rerankItems,fact.generationCalls,fact.indexedChunks];
    if(!values.every(value=>Number.isSafeInteger(value)&&value>=0))throw new Error('INVALID_USAGE_FACT');
    const client=resolveTargetTransaction(tx),scope=[context.deploymentId,context.tenantId,fact.operationId];
    const inserted=await client.query(`INSERT INTO usage.tbl_usg_rag_consumption
      (urc_deployment_id,urc_tenant_id,urc_operation_id,urc_actor_kind,urc_actor_id,urc_session_id,urc_request_id,urc_correlation_id,urc_module_id,
       urc_queries,urc_documents_processed,urc_embedding_items,urc_retrieval_candidates,urc_authorized_chunks,urc_rerank_items,urc_generation_calls,urc_indexed_chunks)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT (urc_deployment_id,urc_tenant_id,urc_operation_id) DO NOTHING RETURNING urc_operation_id`,
      [...scope,context.actorKind,context.actorId,context.sessionId,context.requestId,context.correlationId,context.moduleId,...values]);
    if(!inserted.rowCount){
      const known=await client.query<{same:boolean}>(`SELECT ROW(urc_queries,urc_documents_processed,urc_embedding_items,urc_retrieval_candidates,
        urc_authorized_chunks,urc_rerank_items,urc_generation_calls,urc_indexed_chunks) IS NOT DISTINCT FROM
        ROW($4::bigint,$5::bigint,$6::bigint,$7::bigint,$8::bigint,$9::bigint,$10::bigint,$11::bigint) AS same
        FROM usage.tbl_usg_rag_consumption WHERE urc_deployment_id=$1 AND urc_tenant_id=$2 AND urc_operation_id=$3`,[...scope,...values]);
      if(!known.rows[0]?.same)throw new Error('USAGE_IDEMPOTENCY_CONFLICT');
    }
  }};
}

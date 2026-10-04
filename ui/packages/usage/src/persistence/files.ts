import { resolveTargetTransaction } from '../../../persistence/src/target-transaction.js';
import type { intfFileUsagePort } from '../files.js';

export function createFileUsagePersistence(): intfFileUsagePort {
  return { async record(transaction, context, fact) {
    const values = [fact.uploadedBytes, fact.downloadedBytes, fact.storageBytes, fact.files, fact.processingBytes];
    if (!values.every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error('INVALID_USAGE_FACT');
    const client = resolveTargetTransaction(transaction), scope = [context.deploymentId, context.tenantId, fact.operationId];
    const inserted = await client.query(`INSERT INTO usage.tbl_usg_file_consumption
      (ufc_deployment_id,ufc_tenant_id,ufc_operation_id,ufc_actor_kind,ufc_actor_id,ufc_session_id,ufc_request_id,
       ufc_correlation_id,ufc_uploaded_bytes,ufc_downloaded_bytes,ufc_storage_bytes,ufc_files,ufc_processing_bytes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (ufc_deployment_id,ufc_tenant_id,ufc_operation_id) DO NOTHING RETURNING ufc_operation_id`,
      [...scope, context.actorKind, context.actorId, context.sessionId, context.requestId, context.correlationId, ...values]);
    if (!inserted.rowCount) {
      const known = await client.query<{ same: boolean }>(`SELECT ROW(ufc_uploaded_bytes,ufc_downloaded_bytes,
        ufc_storage_bytes,ufc_files,ufc_processing_bytes) IS NOT DISTINCT FROM ROW($4::bigint,$5::bigint,$6::bigint,$7::integer,$8::bigint) AS same
        FROM usage.tbl_usg_file_consumption WHERE ufc_deployment_id=$1 AND ufc_tenant_id=$2 AND ufc_operation_id=$3`, [...scope, ...values]);
      if (!known.rows[0]?.same) throw new Error('USAGE_IDEMPOTENCY_CONFLICT');
    }
  } };
}

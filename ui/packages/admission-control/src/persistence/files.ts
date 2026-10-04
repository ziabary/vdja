import { resolveTargetTransaction } from '../../../persistence/src/target-transaction.js';
import { exAdmission } from '../index.js';
import { enuFileReservationKind, enuFileReservationState, type intfFileAdmissionPort } from '../files.js';

export function createFileAdmissionPersistence(): intfFileAdmissionPort {
  return {
 async activeWithin(tx,ctx){const result=await resolveTargetTransaction(tx).query(`SELECT afr_id FROM admission.tbl_adm_file_reservation WHERE afr_deployment_id=$1 AND afr_tenant_id=$2 AND afr_state=$3 LIMIT 1`,[ctx.deploymentId,ctx.tenantId,enuFileReservationState.Reserved]);return !!result.rowCount;},
 async purgedWithin(tx,ctx,id){await resolveTargetTransaction(tx).query(`UPDATE admission.tbl_adm_file_reservation SET afr_state=$4 WHERE afr_deployment_id=$1 AND afr_tenant_id=$2 AND afr_id=$3`,[ctx.deploymentId,ctx.tenantId,id,enuFileReservationState.Released]);},
    async reserve(transaction, context, policy, request) {
      if (!Number.isSafeInteger(request.bytes) || request.bytes < 1 || request.bytes > policy.maxBytes
        || !Number.isFinite(Date.parse(request.expiresAt)) || Date.parse(request.expiresAt) <= Date.now())
        throw new exAdmission('INPUT_LIMIT_EXCEEDED');
      const client = resolveTargetTransaction(transaction), scope = [context.deploymentId, context.tenantId];
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',
        [`${context.deploymentId}:${context.tenantId}`, 'file-admission']);
      const actor = context.actorId;
      if (!actor) throw new exAdmission('INPUT_LIMIT_EXCEEDED');
      if (policy.actorLimits && request.bytes > policy.actorLimits.maxBytes) throw new exAdmission('INPUT_LIMIT_EXCEEDED');
      const known = await client.query<{ same: boolean; afr_state: enuFileReservationState }>(
        `SELECT (afr_kind = $4 AND afr_bytes = $5 AND (afr_actor_id IS NULL OR afr_actor_id=$6)) AS same, afr_state FROM admission.tbl_adm_file_reservation
         WHERE afr_deployment_id=$1 AND afr_tenant_id=$2 AND afr_id=$3`, [...scope, request.id, request.kind, request.bytes, actor]);
      if (known.rows[0]) {
        if (!known.rows[0].same || known.rows[0].afr_state === enuFileReservationState.Released)
          throw new exAdmission('CONCURRENCY_CONFLICT');
        return;
      }
      // Expired uploads retain reservations until File Management reconciles
      // and aborts their physical staging; time alone cannot free storage quota.
      await client.query(`UPDATE admission.tbl_adm_file_reservation SET afr_state=$3
        WHERE afr_deployment_id=$1 AND afr_tenant_id=$2 AND afr_kind<>$4 AND afr_state=$5 AND afr_expires_at<=clock_timestamp()`,
        [...scope, enuFileReservationState.Released, enuFileReservationKind.Upload, enuFileReservationState.Reserved]);
      const result = await client.query<{ active: string; pending_bytes: string; stored_bytes: string; assets: string;
        actor_active: string; actor_pending_bytes: string; actor_stored_bytes: string; actor_assets: string }>(
        `SELECT COUNT(afr_id) FILTER (WHERE afr_kind=$3 AND afr_state=$4) AS active,
          COALESCE(SUM(afr_bytes) FILTER (WHERE afr_kind=$5 AND afr_state=$4),0) AS pending_bytes,
          COALESCE(SUM(afr_bytes) FILTER (WHERE afr_kind=$5 AND afr_state IN ($4,$6)),0) AS stored_bytes,
          COUNT(afr_id) FILTER (WHERE afr_kind=$5 AND afr_state IN ($4,$6)) AS assets,
          COUNT(afr_id) FILTER (WHERE afr_kind=$3 AND afr_state=$4 AND (afr_actor_id=$7 OR afr_actor_id IS NULL)) AS actor_active,
          COALESCE(SUM(afr_bytes) FILTER (WHERE afr_kind=$5 AND afr_state=$4 AND (afr_actor_id=$7 OR afr_actor_id IS NULL)),0) AS actor_pending_bytes,
          COALESCE(SUM(afr_bytes) FILTER (WHERE afr_kind=$5 AND afr_state IN ($4,$6) AND (afr_actor_id=$7 OR afr_actor_id IS NULL)),0) AS actor_stored_bytes,
          COUNT(afr_id) FILTER (WHERE afr_kind=$5 AND afr_state IN ($4,$6) AND (afr_actor_id=$7 OR afr_actor_id IS NULL)) AS actor_assets
         FROM admission.tbl_adm_file_reservation WHERE afr_deployment_id=$1 AND afr_tenant_id=$2`,
        [...scope, request.kind, enuFileReservationState.Reserved, enuFileReservationKind.Upload, enuFileReservationState.Committed, actor]);
      const stats = result.rows[0]!;
      if (Number(stats.active) >= policy.maxConcurrent) throw new exAdmission('CAPACITY_EXHAUSTED');
      if (request.kind === enuFileReservationKind.Upload
        && (Number(stats.pending_bytes) + request.bytes > policy.maxPendingBytes
          || Number(stats.stored_bytes) + request.bytes > policy.maxTenantStorageBytes
          || Number(stats.assets) + 1 > policy.maxTenantAssets)) throw new exAdmission('QUOTA_EXCEEDED');
      if (policy.actorLimits) {
        const limits = policy.actorLimits;
        if (Number(stats.actor_active) >= Math.min(policy.maxConcurrent, limits.maxConcurrent)) throw new exAdmission('CAPACITY_EXHAUSTED');
        if (request.kind === enuFileReservationKind.Upload && (Number(stats.actor_pending_bytes) + request.bytes > limits.maxPendingBytes
          || Number(stats.actor_stored_bytes) + request.bytes > limits.maxStorageBytes
          || Number(stats.actor_assets) + 1 > limits.maxAssets)) throw new exAdmission('QUOTA_EXCEEDED');
      }
      await client.query(`INSERT INTO admission.tbl_adm_file_reservation
        (afr_id,afr_deployment_id,afr_tenant_id,afr_kind,afr_bytes,afr_expires_at,afr_actor_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`, [request.id, ...scope, request.kind, request.bytes, request.expiresAt, actor]);
    },
    async finish(transaction, context, id, state) {
      const client = resolveTargetTransaction(transaction);
      const result = await client.query(`UPDATE admission.tbl_adm_file_reservation SET afr_state=$4
        WHERE afr_deployment_id=$1 AND afr_tenant_id=$2 AND afr_id=$3 AND afr_state=$5 RETURNING afr_id`,
        [context.deploymentId, context.tenantId, id, state, enuFileReservationState.Reserved]);
      if (!result.rowCount) {
        const known = await client.query<{ afr_state: enuFileReservationState }>(
          'SELECT afr_state FROM admission.tbl_adm_file_reservation WHERE afr_deployment_id=$1 AND afr_tenant_id=$2 AND afr_id=$3',
          [context.deploymentId, context.tenantId, id]);
        if (known.rows[0]?.afr_state !== state) throw new exAdmission('CONCURRENCY_CONFLICT');
      }
    }
  };
}

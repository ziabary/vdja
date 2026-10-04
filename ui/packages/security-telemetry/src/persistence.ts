import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type {intfExecutionContext} from '../../contracts/src/index.js';
import type { intfSiemConfiguration } from '../../configuration/src/index.js';
import { withTargetTransaction } from '../../persistence/src/target.js';
import type { intfClaimedExport, intfSiemExportPersistence, typDeliveryResult } from './worker.js';

export async function scheduleSiemExport(tx: pg.PoolClient, eventId: string, eventName: string, siem: intfSiemConfiguration): Promise<void> {
  await scheduleSiemExports(tx,[eventId],eventName,siem);
}
export async function scheduleSiemExports(tx: pg.PoolClient, eventIds: readonly string[], eventName: string, siem: intfSiemConfiguration): Promise<void> {
  if (!siem.enabled || !siem.events.includes(eventName)) return;
  if (!eventIds.length || eventIds.length > 1000) throw new Error('INVALID_SIEM_EXPORT_BATCH');
  await tx.query(`INSERT INTO telemetry.tbl_tel_export (tex_id, tex_event__ase_id, tex_destination_id, tex_status)
    SELECT batch.id,batch.event_id,$1,'PENDING' FROM pg_catalog.jsonb_to_recordset($2::jsonb) AS batch(id uuid,event_id uuid)
    ON CONFLICT (tex_event__ase_id, tex_destination_id) DO NOTHING`,
    [siem.destinationId,JSON.stringify(eventIds.map(eventId=>({id:randomUUID(),event_id:eventId})))]);
}

export function createSiemExportPersistence(pool: pg.Pool,workerContext?:intfExecutionContext): intfSiemExportPersistence {
  return {
    claim: (destinationId, retryUnresolved,maxAttempts=20) => withTargetTransaction(pool, { ...workerContext,actorKind: 'PLATFORM_SERVICE', actorId: workerContext?.actorId??'siem-worker', correlationId: randomUUID(), source: 'security-telemetry' }, async tx => {
      if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>20)throw new Error('INVALID_SIEM_ATTEMPTS');
      await tx.query(`UPDATE telemetry.tbl_tel_export SET tex_status = 'UNKNOWN', tex_last_error_class = 'CLAIM_LEASE_EXPIRED',
        tex_claimed_until = NULL, tex_updated_at = CURRENT_TIMESTAMP WHERE tex_destination_id = $1 AND tex_status = 'CLAIMED'
        AND tex_claimed_until <= CURRENT_TIMESTAMP AND (NOT $2 OR tex_attempt_count>=$3)`, [destinationId,retryUnresolved,maxAttempts]);
      await tx.query(`UPDATE telemetry.tbl_tel_export SET tex_status='FAILED',tex_last_error_class='ATTEMPTS_EXHAUSTED',tex_updated_at=CURRENT_TIMESTAMP
        WHERE tex_destination_id=$1 AND tex_status IN ('PENDING','RETRY') AND tex_attempt_count>=$2`,[destinationId,maxAttempts]);
      const row = await tx.query<{ tex_id: string }>(`SELECT tex_id FROM telemetry.tbl_tel_export
        WHERE tex_destination_id = $1 AND tex_attempt_count<$3 AND ((tex_status IN ('PENDING','RETRY') AND tex_next_attempt_at <= CURRENT_TIMESTAMP)
        OR ($2::boolean AND tex_status = 'UNKNOWN' AND tex_next_attempt_at <= CURRENT_TIMESTAMP)
        OR ($2::boolean AND tex_status = 'CLAIMED' AND tex_claimed_until <= CURRENT_TIMESTAMP))
        ORDER BY tex_next_attempt_at, tex_created_at FOR UPDATE SKIP LOCKED LIMIT 1`, [destinationId, retryUnresolved,maxAttempts]);
      if (!row.rows[0]) return null;
      await tx.query(`UPDATE telemetry.tbl_tel_export SET tex_status = 'CLAIMED', tex_attempt_count = tex_attempt_count + 1,
        tex_claimed_until = CURRENT_TIMESTAMP + INTERVAL '125 seconds', tex_updated_at = CURRENT_TIMESTAMP WHERE tex_id = $1`, [row.rows[0].tex_id]);
      const event = await tx.query<intfClaimedExport>(`SELECT t.tex_id, t.tex_event__ase_id, t.tex_attempt_count,
        a.ase_deployment_id, a.ase_tenant_id, a.ase_module_id, a.ase_actor_kind, a.ase_actor_id, a.ase_session_id,
        a.ase_request_id, a.ase_correlation_id,
        a.ase_action, a.ase_result, a.ase_reason, a.ase_authority_context, a.ase_created_at,a.ase_source,
        a.ase_resource_type,a.ase_resource_id,a.ase_initiator_actor_kind,a.ase_initiator_actor_id
        FROM telemetry.tbl_tel_export t JOIN audit.tbl_aud_semantic_event a ON a.ase_id = t.tex_event__ase_id WHERE t.tex_id = $1`, [row.rows[0].tex_id]);
      return event.rows[0] ?? null;
    }),
    finish: (claimed, result: typDeliveryResult, finalKind, delayMs) => withTargetTransaction(pool, {...workerContext,actorKind:'PLATFORM_SERVICE',actorId:workerContext?.actorId??'siem-worker',sessionId:null,
      deploymentId:claimed.ase_deployment_id,tenantId:claimed.ase_tenant_id,moduleId:'security-telemetry',requestId:claimed.ase_request_id,correlationId:claimed.ase_correlation_id,source:'security-telemetry'}, async tx => {
      const settled = await tx.query(`UPDATE telemetry.tbl_tel_export SET tex_status = $1, tex_last_error_class = $2, tex_ack = $3,
        tex_next_attempt_at = CURRENT_TIMESTAMP + ($4::integer * INTERVAL '1 millisecond'), tex_claimed_until = NULL,
        tex_updated_at = CURRENT_TIMESTAMP WHERE tex_id = $5 AND tex_status = 'CLAIMED'
        AND tex_attempt_count=$6 AND tex_claimed_until>CURRENT_TIMESTAMP RETURNING tex_id`,
      [finalKind === 'DELIVERED' ? 'DELIVERED' : finalKind === 'FAILED' ? 'FAILED' : finalKind === 'UNKNOWN' ? 'UNKNOWN' : 'RETRY', result.kind === 'DELIVERED' ? null : result.errorClass, result.kind === 'DELIVERED' ? result.ack : null, delayMs, claimed.tex_id, claimed.tex_attempt_count]);
      if (settled.rowCount !== 1) throw new Error('SIEM_CLAIM_LEASE_LOST');
    })
  };
}

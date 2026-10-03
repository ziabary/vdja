import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { intfExecutionContext } from '../../contracts/src/index.js';
import type { intfAdmissionPolicy } from '../../configuration/src/index.js';
import { withTargetTransaction } from '../../persistence/src/target.js';
import { exAdmission, type intfReservation } from './index.js';

const RESERVATION_LEASE_MS = 5 * 60 * 1000;

export async function reserveAdmission(pool: pg.Pool, context: intfExecutionContext, policy: intfAdmissionPolicy, inputChars: number, uploadedBytes: number, tokenReservation: number, outputTokenBudget = 0): Promise<intfReservation> {
  if (!Number.isSafeInteger(inputChars) || inputChars < 0 || !Number.isSafeInteger(uploadedBytes) || uploadedBytes < 0 || !Number.isSafeInteger(tokenReservation) || tokenReservation < 0) throw new exAdmission('INPUT_LIMIT_EXCEEDED');
  if (!Number.isSafeInteger(outputTokenBudget) || outputTokenBudget < 0 || outputTokenBudget > policy.outputTokens) throw new exAdmission('OUTPUT_LIMIT_EXCEEDED');
  if (inputChars > policy.inputChars || uploadedBytes > policy.uploadBytes) throw new exAdmission('INPUT_LIMIT_EXCEEDED');
  return withTargetTransaction(pool, { actorKind: context.actorKind, actorId: context.actorId, sessionId: context.sessionId,
    tenantId: context.tenantId, correlationId: context.correlationId, source: 'admission-control' }, async tx => {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [`${context.deploymentId}:${context.tenantId}`, context.moduleId]);
    await tx.query(`UPDATE admission.tbl_adm_reservation SET adr_state = 'EXPIRED', adr_updated_at = CURRENT_TIMESTAMP
      WHERE adr_deployment_id = $1 AND adr_tenant_id = $2 AND adr_module_id = $3 AND adr_state = 'RESERVED' AND adr_expires_at <= CURRENT_TIMESTAMP`, [context.deploymentId, context.tenantId, context.moduleId]);
    const duplicate = await tx.query<{ adr_id: string; adr_state: string; adr_expires_at: Date }>(`SELECT adr_id, adr_state, adr_expires_at FROM admission.tbl_adm_reservation
      WHERE adr_deployment_id = $1 AND adr_tenant_id = $2 AND adr_module_id = $3 AND adr_request_id = $4`, [context.deploymentId, context.tenantId, context.moduleId, context.requestId]);
    if (duplicate.rows[0]) {
      throw new exAdmission('CONCURRENCY_CONFLICT');
    }
    const stats = await tx.query<{ minute_count: string; day_count: string; day_chars: string; active_count: string; active_tokens: string }>(`SELECT
      COUNT(*) FILTER (WHERE adr_created_at >= CURRENT_TIMESTAMP - INTERVAL '1 minute') AS minute_count,
      COUNT(*) FILTER (WHERE adr_created_at >= date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS day_count,
      COALESCE(SUM(adr_input_chars) FILTER (WHERE adr_created_at >= date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'), 0) AS day_chars,
      COUNT(*) FILTER (WHERE adr_state = 'RESERVED' AND adr_expires_at > CURRENT_TIMESTAMP) AS active_count,
      COALESCE(SUM(adr_reserved_tokens) FILTER (WHERE adr_state = 'RESERVED' AND adr_expires_at > CURRENT_TIMESTAMP), 0) AS active_tokens
      FROM admission.tbl_adm_reservation WHERE adr_deployment_id = $1 AND adr_tenant_id = $2 AND adr_module_id = $3`, [context.deploymentId, context.tenantId, context.moduleId]);
    const s = stats.rows[0]!;
    if (Number(s.minute_count) >= policy.requestsPerMinute) throw new exAdmission('RATE_LIMITED');
    if (Number(s.day_count) >= policy.dailyRequests || Number(s.day_chars) + inputChars > policy.dailyInputChars) throw new exAdmission('QUOTA_EXCEEDED');
    if (Number(s.active_count) >= policy.concurrent) throw new exAdmission('CAPACITY_EXHAUSTED');
    const consumed = await tx.query<{ tokens: string }>(`SELECT COALESCE(SUM(usg_input_tokens + usg_output_tokens), 0) AS tokens
      FROM usage.tbl_usg_consumption WHERE usg_deployment_id = $1 AND usg_tenant_id = $2 AND usg_module_id = $3
      AND usg_created_at >= date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`, [context.deploymentId, context.tenantId, context.moduleId]);
    if (Number(consumed.rows[0]!.tokens) + Number(s.active_tokens) + tokenReservation > policy.tokenBudget) throw new exAdmission('QUOTA_EXCEEDED');
    const id = randomUUID(), expiresAt = new Date(Date.now() + RESERVATION_LEASE_MS).toISOString();
    await tx.query(`INSERT INTO admission.tbl_adm_reservation
      (adr_id, adr_deployment_id, adr_tenant_id, adr_module_id, adr_request_id, adr_state, adr_reserved_tokens, adr_input_chars, adr_expires_at)
      VALUES ($1,$2,$3,$4,$5,'RESERVED',$6,$7,$8)`, [id, context.deploymentId, context.tenantId, context.moduleId, context.requestId, tokenReservation, inputChars, expiresAt]);
    return { id, expiresAt };
  });
}

/** File text size is known only after safe parsing; Admission updates the same reservation before AI work. */
export async function recordExtractedInput(pool: pg.Pool, context: intfExecutionContext, reservationId: string,
  policy: intfAdmissionPolicy, inputChars: number): Promise<void> {
  if (!Number.isSafeInteger(inputChars) || inputChars < 0 || inputChars > policy.inputChars) throw new exAdmission('INPUT_LIMIT_EXCEEDED');
  await withTargetTransaction(pool, { actorKind: context.actorKind, actorId: context.actorId, sessionId: context.sessionId,
    tenantId: context.tenantId, correlationId: context.correlationId, source: 'admission-control' }, async tx => {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [`${context.deploymentId}:${context.tenantId}`, context.moduleId]);
    const reservation = await tx.query<{ adr_input_chars: string }>(`SELECT adr_input_chars FROM admission.tbl_adm_reservation
      WHERE adr_id = $1 AND adr_deployment_id = $2 AND adr_tenant_id = $3 AND adr_module_id = $4
      AND adr_request_id = $5 AND adr_state = 'RESERVED' AND adr_expires_at > CURRENT_TIMESTAMP FOR UPDATE`,
    [reservationId, context.deploymentId, context.tenantId, context.moduleId, context.requestId]);
    if (!reservation.rows[0] || Number(reservation.rows[0].adr_input_chars) !== 0) throw new exAdmission('CONCURRENCY_CONFLICT');
    const used = await tx.query<{ chars: string }>(`SELECT COALESCE(SUM(adr_input_chars),0) AS chars
      FROM admission.tbl_adm_reservation WHERE adr_deployment_id = $1 AND adr_tenant_id = $2 AND adr_module_id = $3
      AND adr_created_at >= date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`,
    [context.deploymentId, context.tenantId, context.moduleId]);
    if (Number(used.rows[0]!.chars) + inputChars > policy.dailyInputChars) throw new exAdmission('QUOTA_EXCEEDED');
    await tx.query(`UPDATE admission.tbl_adm_reservation SET adr_input_chars = $1, adr_updated_at = CURRENT_TIMESTAMP
      WHERE adr_id = $2`, [inputChars, reservationId]);
  });
}

export async function finishReservation(tx: pg.PoolClient, id: string, state: 'SETTLED' | 'RELEASED'): Promise<void> {
  await tx.query(`UPDATE admission.tbl_adm_reservation SET adr_state = $1, adr_updated_at = CURRENT_TIMESTAMP WHERE adr_id = $2 AND adr_state = 'RESERVED'`, [state, id]);
}

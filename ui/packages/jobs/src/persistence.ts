import { randomUUID } from 'node:crypto';
import type { intfExecutionContext } from '../../contracts/src/index.js';
import { resolveTargetTransaction } from '../../persistence/src/target-transaction.js';
import { enuJobState, exJob, type intfJobPort, type intfJob, type intfScheduleJob } from './index.js';

interface intfJobRow {
  job_id: string; job_kind: string; job_idempotency_key: string; job_payload_version: number;
  job_payload: Readonly<Record<string, unknown>>; job_subject: unknown; job_state: enuJobState;
  job_attempts: number; job_max_attempts: number; job_lease_token: string|null; job_lease_until: Date|null;
}
const JOB_COLUMNS = 'job_id, job_kind, job_idempotency_key, job_payload_version, job_payload, job_subject, job_state, job_attempts, job_max_attempts, job_lease_token, job_lease_until';
function subject(input: unknown): intfExecutionContext {
  if (!input || typeof input !== 'object') throw new exJob('INVALID_JOB');
  const value = input as Record<string, unknown>;
  for (const field of ['deploymentId', 'tenantId', 'moduleId', 'requestId', 'correlationId', 'source', 'configFingerprint'])
    if (typeof value[field] !== 'string' || !value[field]) throw new exJob('INVALID_JOB');
  if (!['HUMAN', 'PLATFORM_SERVICE', 'SERVICE_ACCOUNT', 'API_CLIENT', 'INTEGRATION'].includes(String(value.actorKind))
    || typeof value.actorId !== 'string' || !value.actorId
    || (value.sessionId !== null && typeof value.sessionId !== 'string')
    || (value.authorizationVersion !== null && value.authorizationVersion !== undefined
      && (!Number.isSafeInteger(value.authorizationVersion) || Number(value.authorizationVersion) < 1)))
    throw new exJob('INVALID_JOB');
  return value as unknown as intfExecutionContext;
}
function scope(context: intfExecutionContext): readonly [string, string] {
  if (!context.deploymentId || !context.tenantId) throw new exJob('INVALID_JOB');
  return [context.deploymentId, context.tenantId];
}
function lease(value: number): void {
  if (!Number.isInteger(value) || value < 50 || value > 300000) throw new exJob('INVALID_JOB');
}
function request(value: intfScheduleJob): void {
  subject(value.subject);
  if (!/^[a-z][a-z0-9._-]{1,127}$/u.test(value.kind) || value.idempotencyKey.length < 1 || value.idempotencyKey.length > 256
    || !Number.isInteger(value.payloadVersion) || value.payloadVersion < 1 || !Number.isInteger(value.maxAttempts)
    || value.maxAttempts < 1 || value.maxAttempts > 10 || Buffer.byteLength(JSON.stringify(value.payload)) > 16384)
    throw new exJob('INVALID_JOB');
  if (value.notBefore !== undefined && !Number.isFinite(Date.parse(value.notBefore))) throw new exJob('INVALID_JOB');
}
function job(row: intfJobRow): intfJob {
  return { id: row.job_id, kind: row.job_kind, idempotencyKey: row.job_idempotency_key,
    payloadVersion: row.job_payload_version, payload: row.job_payload, subject: subject(row.job_subject),
    maxAttempts: row.job_max_attempts, state: row.job_state, attempts: row.job_attempts,
    leaseToken: row.job_lease_token??'', leaseUntil: row.job_lease_until?.toISOString()??new Date(0).toISOString() };
}
export function createJobPersistence(): intfJobPort {
  return {
    async schedule(tx, value) {
      request(value);
      const client = resolveTargetTransaction(tx);
      const inserted = await client.query<{ job_id: string }>(`INSERT INTO jobs.tbl_job_work
        (job_id, job_deployment_id, job_tenant_id, job_kind, job_idempotency_key, job_payload_version,
         job_payload, job_subject, job_max_attempts, job_available_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,COALESCE($10::timestamptz,clock_timestamp()))
        ON CONFLICT (job_deployment_id, job_tenant_id, job_kind, job_idempotency_key) DO NOTHING RETURNING job_id`,
        [value.id, ...scope(value.subject), value.kind, value.idempotencyKey, value.payloadVersion,
          JSON.stringify(value.payload), JSON.stringify(value.subject), value.maxAttempts, value.notBefore ?? null]);
      if (inserted.rows[0]) return inserted.rows[0].job_id;
      const known = await client.query<{ job_id: string; same: boolean }>(`SELECT job_id,
        (job_payload = $5::jsonb AND job_payload_version = $6 AND job_max_attempts = $7
          AND job_subject->>'actorId' = $8 AND job_subject->>'actorKind' = $9) AS same
        FROM jobs.tbl_job_work WHERE job_deployment_id = $1 AND job_tenant_id = $2 AND job_kind = $3 AND job_idempotency_key = $4`,
        [...scope(value.subject), value.kind, value.idempotencyKey, JSON.stringify(value.payload), value.payloadVersion,
          value.maxAttempts, value.subject.actorId, value.subject.actorKind]);
      if (!known.rows[0]?.same) throw new exJob('JOB_IDEMPOTENCY_CONFLICT');
      return known.rows[0].job_id;
    },
    async assertLease(tx, context, value) {
      const result = await resolveTargetTransaction(tx).query(`SELECT job_id FROM jobs.tbl_job_work
        WHERE job_deployment_id=$1 AND job_tenant_id=$2 AND job_id=$3 AND job_lease_token=$4
        AND job_state=$5 AND job_lease_until>clock_timestamp() FOR UPDATE`,
        [...scope(context), value.id, value.leaseToken, enuJobState.Running]);
      if (!result.rowCount) throw new exJob('JOB_LEASE_LOST');
    },
    async recoverExhausted(tx,context){
      const result=await resolveTargetTransaction(tx).query<intfJobRow>(`WITH exhausted AS (
        SELECT job_id FROM jobs.tbl_job_work WHERE job_deployment_id = $1 AND job_tenant_id = $2
          AND job_state = $3 AND job_lease_until < clock_timestamp() AND job_attempts >= job_max_attempts
        ORDER BY job_lease_until FOR UPDATE SKIP LOCKED LIMIT 100)
        UPDATE jobs.tbl_job_work SET job_state = $4, job_lease_token = NULL, job_lease_until = NULL,
          job_error_class = 'LEASE_EXHAUSTED', job_updated_at = clock_timestamp()
        WHERE job_deployment_id = $1 AND job_tenant_id = $2 AND job_id IN (SELECT job_id FROM exhausted) RETURNING ${JOB_COLUMNS}`,
        [...scope(context), enuJobState.Running, enuJobState.Failed]);
      return result.rows.map(job);
    },
    async claim(tx, context, leaseMs) {
      lease(leaseMs);
      const client = resolveTargetTransaction(tx);
      const result = await client.query<intfJobRow>(`WITH candidate AS (
        SELECT job_id FROM jobs.tbl_job_work WHERE job_deployment_id = $1 AND job_tenant_id = $2
          AND job_attempts < job_max_attempts AND ((job_state = $3 AND job_available_at <= clock_timestamp())
            OR (job_state = $4 AND job_lease_until < clock_timestamp()))
        ORDER BY job_available_at, job_created_at FOR UPDATE SKIP LOCKED LIMIT 1)
        UPDATE jobs.tbl_job_work SET job_state = $4, job_attempts = job_attempts + 1,
          job_lease_token = $5, job_lease_until = clock_timestamp() + $6 * interval '1 millisecond',
          job_updated_at = clock_timestamp()
        WHERE job_deployment_id = $1 AND job_tenant_id = $2 AND job_id IN (SELECT job_id FROM candidate)
        RETURNING ${JOB_COLUMNS}`, [...scope(context), enuJobState.Pending, enuJobState.Running, randomUUID(), leaseMs]);
      return result.rows[0] ? job(result.rows[0]) : null;
    },
    async heartbeat(tx, context, value, leaseMs) {
      lease(leaseMs);
      const result = await resolveTargetTransaction(tx).query(`UPDATE jobs.tbl_job_work
        SET job_lease_until = clock_timestamp() + $5 * interval '1 millisecond', job_updated_at = clock_timestamp()
        WHERE job_deployment_id = $1 AND job_tenant_id = $2 AND job_id = $3 AND job_lease_token = $4
          AND job_state = $6 AND job_lease_until > clock_timestamp() RETURNING job_id`,
        [...scope(context), value.id, value.leaseToken, leaseMs, enuJobState.Running]);
      return result.rowCount === 1;
    },
    async finish(tx, context, value) {
      const result = await resolveTargetTransaction(tx).query(`UPDATE jobs.tbl_job_work
        SET job_state = $5, job_lease_token = NULL, job_lease_until = NULL, job_updated_at = clock_timestamp()
        WHERE job_deployment_id = $1 AND job_tenant_id = $2 AND job_id = $3 AND job_lease_token = $4
          AND job_state = $6 AND job_lease_until > clock_timestamp() RETURNING job_id`,
        [...scope(context), value.id, value.leaseToken, enuJobState.Succeeded, enuJobState.Running]);
      return result.rowCount === 1;
    },
    async fail(tx, context, value, reason, retryable, backoffMs) {
      if (!/^[A-Z0-9_]{1,64}$/u.test(reason) || !Number.isInteger(backoffMs) || backoffMs < 0 || backoffMs > 3600000)
        throw new exJob('INVALID_JOB');
      const result = await resolveTargetTransaction(tx).query(`UPDATE jobs.tbl_job_work
        SET job_state = CASE WHEN $5 AND job_attempts < job_max_attempts THEN $6 ELSE $7 END,
          job_available_at = clock_timestamp() + $8 * interval '1 millisecond', job_error_class = $9,
          job_lease_token = NULL, job_lease_until = NULL, job_updated_at = clock_timestamp()
        WHERE job_deployment_id = $1 AND job_tenant_id = $2 AND job_id = $3 AND job_lease_token = $4
          AND job_state = $10 AND job_lease_until > clock_timestamp() RETURNING job_id`,
        [...scope(context), value.id, value.leaseToken, retryable, enuJobState.Pending, enuJobState.Failed,
          backoffMs, reason, enuJobState.Running]);
      return result.rowCount === 1;
    }
  };
}

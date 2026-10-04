import type pg from 'pg';
import { withTargetTransaction } from '../../persistence/src/target.js';
import type { intfActiveRun, intfAiRunStore, intfAttemptRecord, intfRunFinish, intfRunStart } from './index.js';
import type { typModuleId } from '../../configuration/src/index.js';

export class clsPgAiRunStore implements intfAiRunStore {
  constructor(readonly pool: pg.Pool) {}
  async claimEndpointCapacity(runId: string, request: intfRunStart['request'], endpointId: string, maxConcurrent: number, leaseMs: number): Promise<boolean> {
    return withTargetTransaction(this.pool, { ...request, source: request.source ?? 'ai-router-capacity' }, async tx => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', ['ai-router-capacity', endpointId]);
      const occupied = await tx.query<{ active: string }>(`SELECT COUNT(*) AS active FROM ai_router.tbl_air_run
        WHERE air_endpoint_id = $1 AND air_status = 'RUNNING' AND air_capacity_expires_at > CURRENT_TIMESTAMP`, [endpointId]);
      if (Number(occupied.rows[0]?.active ?? 0) >= maxConcurrent) return false;
      const updated = await tx.query(`UPDATE ai_router.tbl_air_run SET air_endpoint_id = $1,
        air_capacity_expires_at = CURRENT_TIMESTAMP + ($2::integer * INTERVAL '1 millisecond')
        WHERE air_id = $3 AND air_status = 'RUNNING'`, [endpointId, leaseMs, runId]);
      if (updated.rowCount !== 1) throw new Error('AI_RUN_NOT_ACTIVE');
      return true;
    });
  }
  async releaseEndpointCapacity(runId: string, request: intfRunStart['request'], endpointId: string): Promise<void> {
    await withTargetTransaction(this.pool, { ...request, source: request.source ?? 'ai-router-capacity' }, async tx => {
      await tx.query('UPDATE ai_router.tbl_air_run SET air_capacity_expires_at = NULL WHERE air_id = $1 AND air_endpoint_id = $2', [runId, endpointId]);
    });
  }
  async beginRun(value: intfRunStart): Promise<void> {
    const r = value.request;
    await withTargetTransaction(this.pool, { ...r, source: r.source ?? 'ai-router' }, async tx => {
      await tx.query(`INSERT INTO ai_router.tbl_air_run
        (air_id, air_deployment_id, air_tenant_id, air_module_id, air_request_id, air_correlation_id,
         air_actor_kind, air_actor_id, air_task, air_config_fingerprint, air_status, air_session_id,air_authorization_version,air_source)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'RUNNING',$11,$12,$13)`,
      [value.runId, r.deploymentId, r.tenantId, r.moduleId, r.requestId, r.correlationId, r.actorKind, r.actorId, r.task, value.configFingerprint,r.sessionId??null,r.authorizationVersion??null,r.source??'ai-router']);
    });
  }
  async beginAttempt(value: intfAttemptRecord): Promise<void> {
    await this.#withRun(value.runId, async tx => {
      await tx.query(`INSERT INTO ai_router.tbl_air_attempt
        (aia_id, aia_run__air_id, aia_sequence, aia_endpoint_id, aia_model_id, aia_status)
        VALUES ($1,$2,$3,$4,$5,$6)`, [value.attemptId, value.runId, value.sequence, value.endpointId, value.modelId, value.status]);
      await tx.query('UPDATE ai_router.tbl_air_run SET air_endpoint_id = $1, air_model_id = $2 WHERE air_id = $3', [value.endpointId, value.modelId, value.runId]);
    });
  }
  async finishAttempt(value: intfAttemptRecord): Promise<void> {
    await this.#withRun(value.runId, async tx => {
      await tx.query(`UPDATE ai_router.tbl_air_attempt SET aia_status = $1, aia_error_class = $2, aia_finished_at = CURRENT_TIMESTAMP
        WHERE aia_id = $3 AND aia_status = 'RUNNING'`, [value.status, value.errorClass ?? null, value.attemptId]);
    });
  }
  async finishRun(value: intfRunFinish): Promise<void> {
    await this.#withRun(value.runId, async tx => {
      await tx.query(`UPDATE ai_router.tbl_air_run SET air_status = $1, air_endpoint_id = COALESCE($2, air_endpoint_id),
        air_model_id = COALESCE($3, air_model_id), air_input_tokens = $4, air_output_tokens = $5,
        air_error_class = $6, air_capacity_expires_at = NULL, air_finished_at = CURRENT_TIMESTAMP WHERE air_id = $7 AND air_status = 'RUNNING'`,
      [value.status, value.endpointId ?? null, value.modelId ?? null, value.inputTokens ?? null, value.outputTokens ?? null, value.errorClass ?? null, value.runId]);
    });
  }
  async activeRun(deploymentId: string, tenantId: string, moduleId: typModuleId | 'knowledge', requestId: string): Promise<intfActiveRun | null> {
    const found = await this.pool.query<{ air_endpoint_id: string; air_task: intfActiveRun['task']; air_request_id: string }>(`SELECT air_endpoint_id, air_task, air_request_id FROM ai_router.tbl_air_run
      WHERE air_deployment_id = $1 AND air_tenant_id = $2 AND air_module_id = $3 AND air_request_id = $4 AND air_status = 'RUNNING'
      ORDER BY air_started_at DESC LIMIT 1`, [deploymentId, tenantId, moduleId, requestId]);
    const row = found.rows[0];
    return row?.air_endpoint_id ? { endpointId: row.air_endpoint_id, task: row.air_task, requestId: row.air_request_id } : null;
  }
  async #withRun<T>(runId: string, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const found = await this.pool.query<{ air_actor_kind:string;air_actor_id:string|null;air_correlation_id:string;
      air_deployment_id:string;air_tenant_id:string;air_module_id:string;air_request_id:string;air_session_id:string|null;
      air_authorization_version:string|null;air_source:string|null }>(`SELECT air_actor_kind,air_actor_id,air_correlation_id,
        air_deployment_id,air_tenant_id,air_module_id,air_request_id,air_session_id,air_authorization_version,air_source
        FROM ai_router.tbl_air_run WHERE air_id=$1`,[runId]);
    const row=found.rows[0];if(!row)throw new Error('AI_RUN_NOT_FOUND');
    return withTargetTransaction(this.pool,{actorKind:row.air_actor_kind,actorId:row.air_actor_id,correlationId:row.air_correlation_id,
      deploymentId:row.air_deployment_id,tenantId:row.air_tenant_id,moduleId:row.air_module_id,requestId:row.air_request_id,
      sessionId:row.air_session_id,authorizationVersion:row.air_authorization_version?Number(row.air_authorization_version):null,
      source:row.air_source??'ai-router'},work);
  }
}
export function createAiRunPersistence(pool: pg.Pool): intfAiRunStore { return new clsPgAiRunStore(pool); }

import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { intfExecutionContext } from '../../contracts/src/index.js';
import type { intfUsageFacts, intfUsageRecorder } from './index.js';
import { withTargetTransaction } from '../../persistence/src/target.js';

export async function recordUsage(tx: pg.PoolClient, context: intfExecutionContext, facts: intfUsageFacts): Promise<boolean> {
  for (const number of [facts.inputChars, facts.uploadedBytes, facts.inputTokens, facts.outputTokens, facts.providerMs]) if (!Number.isSafeInteger(number) || number < 0) throw new Error('INVALID_USAGE_FACT');
  const result = await tx.query(`INSERT INTO usage.tbl_usg_consumption
    (usg_id, usg_run_id, usg_deployment_id, usg_tenant_id, usg_module_id, usg_actor_kind, usg_actor_id, usg_session_id,
     usg_request_id, usg_input_chars, usg_uploaded_bytes, usg_input_tokens, usg_output_tokens, usg_provider_ms)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    ON CONFLICT (usg_run_id) DO NOTHING`, [randomUUID(), facts.runId, context.deploymentId, context.tenantId, context.moduleId, context.actorKind, context.actorId, context.sessionId, context.requestId, facts.inputChars, facts.uploadedBytes, facts.inputTokens, facts.outputTokens, facts.providerMs]);
  return result.rowCount === 1;
}
/** Published Admission integration: Usage owns consumed-token facts; Admission owns the quota decision. */
export async function readConsumedTokens(tx: pg.PoolClient, context: intfExecutionContext): Promise<number> {
  const result = await tx.query<{ tokens: string }>(`SELECT COALESCE(SUM(usg_input_tokens+usg_output_tokens),0) AS tokens
    FROM usage.tbl_usg_consumption WHERE usg_deployment_id=$1 AND usg_tenant_id=$2 AND usg_module_id=$3
    AND usg_created_at>=date_trunc('day',CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`,
    [context.deploymentId,context.tenantId,context.moduleId]);
  const tokens = Number(result.rows[0]?.tokens);
  if (!Number.isSafeInteger(tokens) || tokens < 0) throw new Error('INVALID_USAGE_TOTAL');
  return tokens;
}
export function createUsagePersistence(pool: pg.Pool): intfUsageRecorder {
  return { async record(context, facts) {
    await withTargetTransaction(pool, context,
      async tx => { await recordUsage(tx, context, facts); });
  } };
}

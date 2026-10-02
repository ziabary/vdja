import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { intfExecutionContext } from '../../contracts/src/index.js';
import type { typPublicAuditAction, typAuditResult } from './index.js';

export async function recordAudit(tx: pg.PoolClient, context: intfExecutionContext, action: typPublicAuditAction, result: typAuditResult, reason?: string): Promise<string> {
  const id = randomUUID();
  await tx.query(`INSERT INTO audit.tbl_aud_semantic_event
    (ase_id, ase_deployment_id, ase_tenant_id, ase_module_id, ase_actor_kind, ase_actor_id, ase_session_id,
     ase_request_id, ase_correlation_id, ase_action, ase_result, ase_reason, ase_config_fingerprint)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
  [id, context.deploymentId, context.tenantId, context.moduleId, context.actorKind, context.actorId, context.sessionId,
   context.requestId, context.correlationId, action, result, reason ?? null, context.configFingerprint]);
  return id;
}

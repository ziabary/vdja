import type pg from 'pg';
import type { intfExecutionContext } from '../../../contracts/src/index.js';
import type { intfSiemConfiguration } from '../../../configuration/src/index.js';
import { withTargetTransaction } from '../../../persistence/src/target.js';
import { scheduleSiemExport } from '../../../security-telemetry/src/persistence.js';
import type { typAuditResult, typSecurityAuditAction } from '../index.js';
import { recordAudit } from '../persistence.js';

export function createSecurityAuditPersistence(pool: pg.Pool, siem: intfSiemConfiguration) {
  return { async record(context: intfExecutionContext, action: typSecurityAuditAction,
    result: typAuditResult, reason?: string): Promise<void> {
    await withTargetTransaction(pool, { actorKind: context.actorKind, actorId: context.actorId,
      sessionId: context.sessionId, tenantId: context.tenantId,
      correlationId: context.correlationId, source: 'security-audit' }, async tx => {
      const eventId = await recordAudit(tx, context, action, result, reason);
      await scheduleSiemExport(tx, eventId, action, siem);
    });
  } };
}

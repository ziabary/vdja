import type pg from 'pg';
import type { intfExecutionContext } from '../../contracts/src/index.js';
import type { intfAdmissionPolicy, intfSiemConfiguration } from '../../configuration/src/index.js';
import type { typPublicAuditAction } from '../../audit/src/index.js';
import type { intfUsageFacts } from '../../usage/src/index.js';
import { reserveAdmission, recordExtractedInput, finishReservation } from '../../admission-control/src/persistence.js';
import { recordAudit } from '../../audit/src/persistence.js';
import { recordUsage } from '../../usage/src/persistence.js';
import { scheduleSiemExport } from '../../security-telemetry/src/persistence.js';
import { withTargetTransaction } from '../../persistence/src/target.js';
import type { intfPublicOperationPersistence } from './publicOperation.js';

function mutation(context: intfExecutionContext) { return { actorKind: context.actorKind, actorId: context.actorId,
  sessionId: context.sessionId, tenantId: context.tenantId, correlationId: context.correlationId, source: 'public-operation' }; }
async function event(tx: pg.PoolClient, context: intfExecutionContext, action: typPublicAuditAction, result: 'REQUESTED' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'DENIED', siem: intfSiemConfiguration, reason?: string): Promise<void> {
  const eventId = await recordAudit(tx, context, action, result, reason);
  await scheduleSiemExport(tx, eventId, action, siem);
}
export function createPublicOperationPersistence(pool: pg.Pool): intfPublicOperationPersistence {
  return {
    reserve: (context, policy, inputChars, uploadedBytes, tokenReservation, outputTokenBudget) => reserveAdmission(pool, context, policy, inputChars, uploadedBytes, tokenReservation, outputTokenBudget),
    recordExtractedInput: (context, reservationId, policy, inputChars) => recordExtractedInput(pool, context, reservationId, policy, inputChars),
    denied: (context, action, siem, reason) => withTargetTransaction(pool, mutation(context), tx => event(tx, context, action, 'DENIED', siem, reason)),
    requested: (context, action, siem) => withTargetTransaction(pool, mutation(context), tx => event(tx, context, action, 'REQUESTED', siem)),
    release: (context, reservationId) => withTargetTransaction(pool, mutation(context), tx => finishReservation(tx, reservationId, 'RELEASED')),
    settle: (context, reservationId, action, siem, usage: readonly intfUsageFacts[]) => withTargetTransaction(pool, mutation(context), async tx => {
      for (const facts of usage) await recordUsage(tx, context, facts);
      await finishReservation(tx, reservationId, 'SETTLED');
      await event(tx, context, action, 'SUCCEEDED', siem);
    }),
    failed: (context, reservationId, action, siem, reason, cancelled) => withTargetTransaction(pool, mutation(context), async tx => {
      await finishReservation(tx, reservationId, 'RELEASED');
      await event(tx, context, action, cancelled ? 'CANCELLED' : 'FAILED', siem, reason);
    })
  };
}

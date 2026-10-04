import type pg from 'pg';
import type { intfExecutionContext } from '../../contracts/src/index.js';
import { withTargetTransaction } from '../../persistence/src/target.js';

/** Identity facts only. Authority remains the sole permission decision engine. */
export function createMachineIdentityPersistence(pool: pg.Pool) {
  return { async platformService(context: intfExecutionContext): Promise<number> {
    if (context.actorKind !== 'PLATFORM_SERVICE' || !context.actorId || context.sessionId !== null || !context.tenantId)
      throw new Error('INVALID_MACHINE_IDENTITY');
    const result = await withTargetTransaction(pool, context, tx => tx.query<{ idm_authorization_version: string }>(
      `SELECT idm_authorization_version FROM identity.tbl_idn_membership JOIN identity.tbl_idn_identity
       ON idn_id=idm_identity__idn_id WHERE idn_id=$1 AND idn_kind='PLATFORM_SERVICE' AND idn_state='ACTIVE'
       AND idm_tenant_id=$2 AND idm_state='ACTIVE'`, [context.actorId, context.tenantId]));
    const version = Number(result.rows[0]?.idm_authorization_version);
    if (!Number.isSafeInteger(version) || version < 1) throw new Error('INVALID_MACHINE_IDENTITY');
    return version;
  } };
}

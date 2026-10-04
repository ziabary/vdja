import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import type { intfConfigurationSnapshot } from '../../../packages/configuration/src/index.js';
import type { intfExecutionContext } from '../../../packages/contracts/src/index.js';
import { withTargetTransaction } from '../../../packages/persistence/src/target.js';
import { createAuthorityPersistence } from '../../../packages/authority/src/persistence.js';
import { clsAuthorityService } from '../../../packages/authority/src/service.js';
import { createSecurityAuditPersistence } from '../../../packages/audit/src/persistence/security.js';
import { createTenantSession, validateAccessSession } from '../../../packages/session/src/persistence.js';
import { createHumanExecutionSubjectGuard } from '../../../packages/session/src/subject.js';

export async function createT5Subject(snapshot: intfConfigurationSnapshot, migration: pg.Pool, api: pg.Pool, worker: pg.Pool, deploymentId=snapshot.value.deployment.id) {
  const actorId = randomUUID(), membershipId = randomUUID(), grantId = randomUUID(), tenantId = `t5-${randomUUID()}`;
  const policy = { absoluteLifetimeSeconds: 3600, refreshLifetimeSeconds: 3600, inactivityLifetimeSeconds: 1800 };
  const administrative = { actorKind: 'PLATFORM_SERVICE' as const, actorId: 't5-test-fixture', correlationId: randomUUID(), source: 'T5_TEST_SETUP' };
  await withTargetTransaction(migration, administrative, async tx => {
    await tx.query(`INSERT INTO identity.tbl_idn_identity (idn_id,idn_kind,idn_display_name,idn_email_normalized)
      VALUES ($1,'HUMAN','T5 test subject',$2)`, [actorId, `${actorId}@example.invalid`]);
    await tx.query('INSERT INTO identity.tbl_idn_membership (idm_id,idm_identity__idn_id,idm_tenant_id) VALUES ($1,$2,$3)', [membershipId, actorId, tenantId]);
    await tx.query(`INSERT INTO authority.tbl_aut_grant (aug_id,aug_tenant_id,aug_identity__idn_id,aug_privileges)
      VALUES ($1,$2,$3,$4::jsonb)`, [grantId, tenantId, actorId, JSON.stringify({ Knowledge: { ALL: true } })]);
    await tx.query(`INSERT INTO authority.tbl_aut_clearance (auc_identity__idn_id,auc_tenant_id,auc_level)
      VALUES ($1,$2,'LOW')`, [actorId, tenantId]);
  });
  const session = await createTenantSession(api, policy, actorId, membershipId, tenantId);
  const context: intfExecutionContext = { deploymentId, tenantId, actorKind: 'HUMAN', actorId,
    sessionId: session.sessionId, authorizationVersion: session.authorizationVersion, moduleId: 'knowledge',
    requestId: randomUUID().replaceAll('-', ''), correlationId: randomUUID(), source: 'T5_TEST', configFingerprint: snapshot.fingerprint };
  const authority = (pool: pg.Pool) => {
    const audit = createSecurityAuditPersistence(pool, { ...snapshot.value.siem, enabled: false });
    return new clsAuthorityService({ ...createAuthorityPersistence(pool, context.deploymentId),
      recordDecisions: (ctx, evidence) => audit.recordAuthorityDecisions(ctx, evidence),
      recordDecision: (ctx, evidence) => audit.recordAuthorityDecision(ctx, evidence) });
  };
  return { context, membershipId, grantId, authority: authority(api), workerAuthority: authority(worker),
    subject: createHumanExecutionSubjectGuard(reference => validateAccessSession(api, policy, reference, reference.tenantId)),
    workerSubject: createHumanExecutionSubjectGuard(reference => validateAccessSession(worker, policy, reference, reference.tenantId)),
    async setPermissions(permissions: unknown) {
      await withTargetTransaction(migration, administrative, tx => tx.query('UPDATE authority.tbl_aut_grant SET aug_privileges=$2::jsonb WHERE aug_id=$1', [grantId, JSON.stringify(permissions)]));
    },
    async clean() {
      await withTargetTransaction(migration, administrative, async tx => {
        await tx.query('DELETE FROM session_core.tbl_ses_refresh_token WHERE srt_session__ses_id=$1', [session.sessionId]);
        await tx.query('DELETE FROM session_core.tbl_ses_session WHERE ses_id=$1', [session.sessionId]);
        await tx.query('DELETE FROM authority.tbl_aut_resource_acl WHERE ara_tenant_id=$1', [tenantId]);
        await tx.query('DELETE FROM authority.tbl_aut_grant WHERE aug_tenant_id=$1', [tenantId]);
        await tx.query('DELETE FROM authority.tbl_aut_clearance WHERE auc_tenant_id=$1', [tenantId]);
        await tx.query('DELETE FROM identity.tbl_idn_membership WHERE idm_id=$1', [membershipId]);
        await tx.query('DELETE FROM identity.tbl_idn_identity WHERE idn_id=$1', [actorId]);
      });
    } };
}

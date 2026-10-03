import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { loadConfiguration } from '../../packages/configuration/src/index.js';
import { createTargetPool, withTargetTransaction } from '../../packages/persistence/src/target.js';
import { createSessionStore, createTenantSession, revokeRefreshSession, validateAccessSession } from '../../packages/session/src/persistence.js';
import { rotateRefreshToken } from '../../packages/session/src/index.js';
import { authenticatePassword } from '../../packages/authentication/src/persistence.js';
import { hashPassword } from '../../packages/authentication/src/index.js';

const configPath = process.env.T4_PG_CONFIG;
const secretRoot = process.env.T4_SECRETS_DIR;
const sessionPolicy = { absoluteLifetimeSeconds: 2592000, refreshLifetimeSeconds: 604800, inactivityLifetimeSeconds: 604800 };
if (process.env.T4_REQUIRE_LIVE === '1' && (!configPath || !secretRoot)) throw new Error('T4_LIVE_SESSION_CONFIG_REQUIRED');

test('PostgreSQL refresh rotation is atomic and replay revokes the session', { skip: !configPath || !secretRoot }, async () => {
  const snapshot = await loadConfiguration(configPath!);
  const migration = await createTargetPool(snapshot, 'migration', secretRoot);
  const api = await createTargetPool(snapshot, 'api', secretRoot);
  const identityId = randomUUID(), membershipId = randomUUID();
  const email = `${identityId}@example.invalid`, address = `t4-${identityId}`;
  const guardHash = (label: string, value: string) => createHash('sha256').update(label).update('\0').update(value).digest('hex');
  const sessionIds: string[] = [];
  try {
    const passwordHash = await hashPassword('a long unique test passphrase 2026');
    await withTargetTransaction(migration, { actorKind: 'PLATFORM_SERVICE', actorId: 't4-test', correlationId: randomUUID(), source: 't4-session-test' }, async tx => {
    await tx.query(`INSERT INTO identity.tbl_idn_identity
      (idn_id,idn_kind,idn_display_name,idn_email_normalized) VALUES ($1,'HUMAN','T4 test',$2)`,
    [identityId, email]);
    await tx.query(`INSERT INTO identity.tbl_idn_membership
      (idm_id,idm_identity__idn_id,idm_tenant_id) VALUES ($1,$2,$3)`,
    [membershipId, identityId, snapshot.value.deployment.tenantId]);
    await tx.query(`INSERT INTO authentication.tbl_ath_password_credential
      (apc_identity__idn_id, apc_password_hash) VALUES ($1,$2)`, [identityId, passwordHash]);
    });
    assert.deepEqual(await authenticatePassword(api, email, 'wrong password', address), { kind: 'INVALID' });
    const authenticated = await authenticatePassword(api, email, 'a long unique test passphrase 2026', address);
    assert.equal(authenticated.kind, 'AUTHENTICATED');
    if (authenticated.kind === 'AUTHENTICATED') {
      assert.equal(authenticated.identityId, identityId);
      assert.deepEqual(authenticated.memberships, [{ membershipId, tenantId: snapshot.value.deployment.tenantId }]);
    }
    const unknownEmail = `unknown-${identityId}@example.invalid`;
    for (let attempt = 0; attempt < 5; attempt += 1)
      assert.deepEqual(await authenticatePassword(api, unknownEmail, 'wrong password', address), { kind: 'INVALID' });
    assert.deepEqual(await authenticatePassword(api, unknownEmail, 'wrong password', address), { kind: 'RATE_LIMITED' });
    const created = await createTenantSession(api, sessionPolicy, identityId, membershipId, snapshot.value.deployment.tenantId);
    sessionIds.push(created.sessionId);
    const claims = { identityId, tenantId: snapshot.value.deployment.tenantId, sessionId: created.sessionId, authorizationVersion: created.authorizationVersion };
    assert.equal(await validateAccessSession(api, sessionPolicy, claims, claims.tenantId), true);
    assert.equal(await validateAccessSession(api, sessionPolicy, claims, 'another-tenant'), false);
    assert.equal(await validateAccessSession(api, sessionPolicy, { ...claims, identityId: randomUUID() }, claims.tenantId), false);
    const store = createSessionStore(api, sessionPolicy);
    const first = await rotateRefreshToken(store, created.refreshToken);
    assert.equal(first.kind, 'ROTATED');
    const replay = await rotateRefreshToken(store, created.refreshToken);
    assert.equal(replay.kind, 'REPLAY');
    assert.equal(await validateAccessSession(api, sessionPolicy, claims, claims.tenantId), false);
    if (first.kind === 'ROTATED') assert.equal((await rotateRefreshToken(store, first.refreshToken)).kind, 'INVALID');
    const row = await migration.query<{ ses_revoke_reason: string }>(`SELECT ses_revoke_reason FROM session_core.tbl_ses_session WHERE ses_id = $1`, [created.sessionId]);
    assert.equal(row.rows[0]?.ses_revoke_reason, 'REFRESH_REPLAY');
    const replayAudit = await migration.query<{ aud_actor_kind: string; aud_actor_id: string; aud_session_id: string }>(
      `SELECT aud_actor_kind, aud_actor_id, aud_session_id FROM audit.tbl_aud_mutation
       WHERE aud_table = 'tbl_ses_session' AND aud_record_id = $1 AND aud_source = 'session.refresh'
       ORDER BY aud_id DESC LIMIT 1`, [created.sessionId]);
    assert.deepEqual(replayAudit.rows[0], { aud_actor_kind: 'HUMAN', aud_actor_id: identityId, aud_session_id: created.sessionId });
    const concurrent = await createTenantSession(api, sessionPolicy, identityId, membershipId, snapshot.value.deployment.tenantId);
    sessionIds.push(concurrent.sessionId);
    const outcomes = await Promise.all([
      rotateRefreshToken(createSessionStore(api, sessionPolicy), concurrent.refreshToken),
      rotateRefreshToken(createSessionStore(api, sessionPolicy), concurrent.refreshToken)
    ]);
    assert.deepEqual(outcomes.map(value => value.kind).sort(), ['REPLAY', 'ROTATED']);
    const concurrentRow = await migration.query<{ ses_revoke_reason: string }>(`SELECT ses_revoke_reason FROM session_core.tbl_ses_session WHERE ses_id = $1`, [concurrent.sessionId]);
    assert.equal(concurrentRow.rows[0]?.ses_revoke_reason, 'REFRESH_REPLAY');
    const stale = await createTenantSession(api, sessionPolicy, identityId, membershipId, claims.tenantId);
    sessionIds.push(stale.sessionId);
    const staleClaims = { ...claims, sessionId: stale.sessionId };
    assert.equal(await validateAccessSession(api, sessionPolicy, staleClaims, claims.tenantId), true);
    await withTargetTransaction(migration, { actorKind: 'PLATFORM_SERVICE', actorId: 't4-test', correlationId: randomUUID(), source: 't4-version-test' }, async tx => {
      await tx.query(`UPDATE identity.tbl_idn_membership SET idm_authorization_version = idm_authorization_version + 1 WHERE idm_id = $1`, [membershipId]);
    });
    assert.equal(await validateAccessSession(api, sessionPolicy, staleClaims, claims.tenantId), false);
    const logout = await createTenantSession(api, sessionPolicy, identityId, membershipId, claims.tenantId);
    sessionIds.push(logout.sessionId);
    assert.deepEqual(await revokeRefreshSession(api, logout.refreshToken),
      { identityId, sessionId: logout.sessionId, tenantId: claims.tenantId });
    const logoutAudit = await migration.query<{ aud_actor_kind: string; aud_actor_id: string; aud_session_id: string }>(
      `SELECT aud_actor_kind, aud_actor_id, aud_session_id FROM audit.tbl_aud_mutation
       WHERE aud_table = 'tbl_ses_session' AND aud_record_id = $1 AND aud_source = 'session.logout'
       ORDER BY aud_id DESC LIMIT 1`, [logout.sessionId]);
    assert.deepEqual(logoutAudit.rows[0], { aud_actor_kind: 'HUMAN', aud_actor_id: identityId, aud_session_id: logout.sessionId });
  } finally {
    await withTargetTransaction(migration, { actorKind: 'PLATFORM_SERVICE', actorId: 't4-test', correlationId: randomUUID(), source: 't4-session-test-cleanup' }, async tx => {
      await tx.query(`DELETE FROM authentication.tbl_ath_login_guard WHERE alg_key_sha256 = ANY($1::char(64)[])`,
        [[guardHash('account', email), guardHash('account', `unknown-${identityId}@example.invalid`), guardHash('address', address)]]);
      for (const sessionId of sessionIds) {
        await tx.query(`DELETE FROM session_core.tbl_ses_refresh_token WHERE srt_session__ses_id = $1`, [sessionId]);
        await tx.query(`DELETE FROM session_core.tbl_ses_session WHERE ses_id = $1`, [sessionId]);
      }
      await tx.query(`DELETE FROM identity.tbl_idn_membership WHERE idm_id = $1`, [membershipId]);
      await tx.query(`DELETE FROM authentication.tbl_ath_password_credential WHERE apc_identity__idn_id = $1`, [identityId]);
      await tx.query(`DELETE FROM identity.tbl_idn_identity WHERE idn_id = $1`, [identityId]);
    });
    await api.end(); await migration.end();
  }
});

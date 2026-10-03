import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { withTargetTransaction } from '../../persistence/src/target.js';
import type { intfSessionSecurityPolicy } from '../../configuration/src/index.js';
import { hashRefreshToken, issueRefreshToken, rotateRefreshToken, type intfSessionStore } from './index.js';
import type { intfAccessTokenClaims } from './access-token.js';

interface intfRefreshRow {
  readonly srt_id: string;
  readonly srt_used_at: Date | null;
  readonly ses_id: string;
  readonly ses_identity__idn_id: string;
  readonly ses_tenant_id: string;
  readonly ses_family_id: string;
  readonly ses_expires_at: Date;
  readonly ses_revoked_at: Date | null;
  readonly ses_authorization_version: string;
  readonly idm_authorization_version: string;
  readonly session_active: boolean;
}

export function createSessionStore(pool: pg.Pool, policy: intfSessionSecurityPolicy): intfSessionStore {
  return {
    rotate: (oldHash, newHash) => withTargetTransaction(pool, { actorKind: 'ANONYMOUS', actorId: null, correlationId: randomUUID(), source: 'session.refresh' }, async tx => {
      const found = await tx.query<intfRefreshRow>(`SELECT r.srt_id, r.srt_used_at,
        s.ses_id, s.ses_identity__idn_id, s.ses_tenant_id, s.ses_family_id, s.ses_expires_at,
        s.ses_revoked_at, s.ses_authorization_version, m.idm_authorization_version,
        (s.ses_revoked_at IS NULL AND r.srt_expires_at > CURRENT_TIMESTAMP
          AND s.ses_expires_at > CURRENT_TIMESTAMP
          AND s.ses_last_activity_at + ($2::integer * INTERVAL '1 second') > CURRENT_TIMESTAMP
          AND m.idm_state = 'ACTIVE' AND m.idm_tenant_id = s.ses_tenant_id
          AND i.idn_state = 'ACTIVE' AND i.idn_kind = 'HUMAN'
          AND s.ses_authorization_version = m.idm_authorization_version) AS session_active
        FROM session_core.tbl_ses_refresh_token r
        JOIN session_core.tbl_ses_session s ON s.ses_id = r.srt_session__ses_id
        JOIN identity.tbl_idn_membership m ON m.idm_id = s.ses_membership__idm_id
        JOIN identity.tbl_idn_identity i ON i.idn_id = s.ses_identity__idn_id
        WHERE r.srt_token_sha256 = $1 FOR UPDATE OF r, s, m, i`, [oldHash, policy.inactivityLifetimeSeconds]);
      const row = found.rows[0];
      if (!row) return { kind: 'INVALID' } as const;
      await tx.query("SELECT set_config('app.actor_kind', 'HUMAN', true), set_config('app.actor_id', $1, true), set_config('app.session_id', $2, true)",
        [row.ses_identity__idn_id, row.ses_id]);
      if (row.srt_used_at) {
        await tx.query(`UPDATE session_core.tbl_ses_session SET ses_revoked_at = CURRENT_TIMESTAMP,
          ses_revoke_reason = 'REFRESH_REPLAY' WHERE ses_family_id = $1 AND ses_revoked_at IS NULL`, [row.ses_family_id]);
        return { kind: 'REPLAY', sessionId: row.ses_id, identityId: row.ses_identity__idn_id, tenantId: row.ses_tenant_id } as const;
      }
      if (!row.session_active) return { kind: 'INVALID' } as const;
      await tx.query(`UPDATE session_core.tbl_ses_refresh_token SET srt_used_at = CURRENT_TIMESTAMP WHERE srt_id = $1`, [row.srt_id]);
      await tx.query(`INSERT INTO session_core.tbl_ses_refresh_token
        (srt_id, srt_session__ses_id, srt_token_sha256, srt_expires_at)
        VALUES ($1, $2, $3, LEAST(CURRENT_TIMESTAMP + ($4::integer * INTERVAL '1 second'), $5::timestamptz))`,
      [randomUUID(), row.ses_id, newHash, policy.refreshLifetimeSeconds, row.ses_expires_at]);
      await tx.query(`UPDATE session_core.tbl_ses_session SET ses_last_activity_at = CURRENT_TIMESTAMP WHERE ses_id = $1`, [row.ses_id]);
      return { kind: 'ROTATED', sessionId: row.ses_id, identityId: row.ses_identity__idn_id,
        tenantId: row.ses_tenant_id, authorizationVersion: Number(row.ses_authorization_version) } as const;
    })
  };
}

export async function createTenantSession(pool: pg.Pool, policy: intfSessionSecurityPolicy, identityId: string, membershipId: string, tenantId: string): Promise<{ sessionId: string; refreshToken: string; authorizationVersion: number }> {
  const sessionId = randomUUID(), familyId = randomUUID(), refreshToken = issueRefreshToken();
  return withTargetTransaction(pool, { actorKind: 'HUMAN', actorId: identityId, sessionId, correlationId: randomUUID(), source: 'session.create' }, async tx => {
    const membership = await tx.query<{ idm_authorization_version: string }>(`SELECT m.idm_authorization_version
      FROM identity.tbl_idn_membership m JOIN identity.tbl_idn_identity i ON i.idn_id = m.idm_identity__idn_id
      WHERE m.idm_id = $1 AND m.idm_identity__idn_id = $2 AND m.idm_tenant_id = $3
      AND m.idm_state = 'ACTIVE' AND i.idn_state = 'ACTIVE' AND i.idn_kind = 'HUMAN' FOR UPDATE OF m, i`, [membershipId, identityId, tenantId]);
    const row = membership.rows[0]; if (!row) throw new Error('INVALID_ACTIVE_MEMBERSHIP');
    await tx.query(`INSERT INTO session_core.tbl_ses_session
      (ses_id, ses_identity__idn_id, ses_membership__idm_id, ses_tenant_id, ses_family_id, ses_authorization_version, ses_expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP + ($7::integer * INTERVAL '1 second'))`,
    [sessionId, identityId, membershipId, tenantId, familyId, row.idm_authorization_version, policy.absoluteLifetimeSeconds]);
    await tx.query(`INSERT INTO session_core.tbl_ses_refresh_token
      (srt_id, srt_session__ses_id, srt_token_sha256, srt_expires_at)
      VALUES ($1,$2,$3,CURRENT_TIMESTAMP + ($4::integer * INTERVAL '1 second'))`,
    [randomUUID(), sessionId, hashRefreshToken(refreshToken), policy.refreshLifetimeSeconds]);
    return { sessionId, refreshToken, authorizationVersion: Number(row.idm_authorization_version) };
  });
}

/** Cryptographic validity is only the first step; this check is required on every protected request. */
export async function validateAccessSession(pool: pg.Pool, policy: intfSessionSecurityPolicy, claims: intfAccessTokenClaims, requestedTenantId: string): Promise<boolean> {
  if (claims.tenantId !== requestedTenantId) return false;
  const result = await pool.query<{ ses_id: string }>(`SELECT s.ses_id
    FROM session_core.tbl_ses_session s
    JOIN identity.tbl_idn_membership m ON m.idm_id = s.ses_membership__idm_id
    JOIN identity.tbl_idn_identity i ON i.idn_id = s.ses_identity__idn_id
    WHERE s.ses_id = $1 AND s.ses_identity__idn_id = $2 AND s.ses_tenant_id = $3
      AND m.idm_identity__idn_id = $2 AND m.idm_tenant_id = $3
      AND s.ses_authorization_version = $4 AND m.idm_authorization_version = $4
      AND s.ses_revoked_at IS NULL AND s.ses_expires_at > CURRENT_TIMESTAMP
      AND s.ses_last_activity_at + ($5::integer * INTERVAL '1 second') > CURRENT_TIMESTAMP
      AND m.idm_state = 'ACTIVE' AND i.idn_state = 'ACTIVE' AND i.idn_kind = 'HUMAN'
    LIMIT 1`, [claims.sessionId, claims.identityId, claims.tenantId, claims.authorizationVersion, policy.inactivityLifetimeSeconds]);
  return result.rowCount === 1;
}

export async function revokeRefreshSession(pool: pg.Pool, rawToken: string): Promise<{ readonly sessionId: string; readonly identityId: string; readonly tenantId: string } | null> {
  let hash: string;
  try { hash = hashRefreshToken(rawToken); } catch { return null; }
  return withTargetTransaction(pool, { actorKind: 'ANONYMOUS', actorId: null,
    correlationId: randomUUID(), source: 'session.logout' }, async tx => {
    const result = await tx.query<{ ses_id: string; ses_identity__idn_id: string; ses_tenant_id: string }>(`SELECT s.ses_id, s.ses_identity__idn_id, s.ses_tenant_id
      FROM session_core.tbl_ses_refresh_token r
      JOIN session_core.tbl_ses_session s ON s.ses_id = r.srt_session__ses_id
      WHERE r.srt_token_sha256 = $1 FOR UPDATE OF r, s`, [hash]);
    const resolved = result.rows[0];
    if (!resolved) return null;
    await tx.query("SELECT set_config('app.actor_kind', 'HUMAN', true), set_config('app.actor_id', $1, true), set_config('app.session_id', $2, true)",
      [resolved.ses_identity__idn_id, resolved.ses_id]);
    const revoked = await tx.query(`UPDATE session_core.tbl_ses_session
      SET ses_revoked_at = CURRENT_TIMESTAMP, ses_revoke_reason = 'LOGOUT'
      WHERE ses_id = $1 AND ses_revoked_at IS NULL`, [resolved.ses_id]);
    return revoked.rowCount === 1 ? { sessionId: resolved.ses_id, identityId: resolved.ses_identity__idn_id,
      tenantId: resolved.ses_tenant_id } : null;
  });
}

export function createSessionPersistence(pool: pg.Pool, policy: intfSessionSecurityPolicy) {
  const store = createSessionStore(pool, policy);
  return {
    createTenantSession: (identityId: string, membershipId: string, tenantId: string) =>
      createTenantSession(pool, policy, identityId, membershipId, tenantId),
    rotateRefreshToken: (token: string) => rotateRefreshToken(store, token),
    validateAccessSession: (claims: intfAccessTokenClaims, tenantId: string) => validateAccessSession(pool, policy, claims, tenantId),
    revokeRefreshSession: (token: string) => revokeRefreshSession(pool, token)
  };
}

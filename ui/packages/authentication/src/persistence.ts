import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type pg from 'pg';
import { withTargetTransaction } from '../../persistence/src/target.js';
import { hashPassword, verifyPassword, type typLoginResult } from './index.js';

const DUMMY_HASH = hashPassword(randomBytes(32).toString('base64url'));
const LOCK_MINUTES = 15;
function guardKey(label: string, value: string): string {
  return createHash('sha256').update(label).update('\0').update(value).digest('hex');
}

/** Credential verification and durable abuse protection have one Authentication owner. */
export async function authenticatePassword(pool: pg.Pool, email: string, password: string, clientAddress: string): Promise<typLoginResult> {
  if (typeof email !== 'string' || typeof password !== 'string' || typeof clientAddress !== 'string'
    || email.length > 320 || password.length > 128 || clientAddress.length > 128) return { kind: 'INVALID' };
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes('@') || normalized.length > 254) return { kind: 'INVALID' };
  const guards = [
    { hash: guardKey('account', normalized), limit: 5 },
    { hash: guardKey('address', clientAddress), limit: 20 }
  ].sort((a, b) => a.hash.localeCompare(b.hash));
  return withTargetTransaction(pool, { actorKind: 'ANONYMOUS', actorId: null,
    correlationId: randomUUID(), source: 'authentication.login' }, async tx => {
    for (const guard of guards) await tx.query(`INSERT INTO authentication.tbl_ath_login_guard (alg_key_sha256)
      VALUES ($1) ON CONFLICT (alg_key_sha256) DO NOTHING`, [guard.hash]);
    const locked = await tx.query<{ alg_key_sha256: string; alg_failed_count: number; alg_locked_until: Date | null; current_time: Date }>(
      `SELECT alg_key_sha256, alg_failed_count, alg_locked_until, CURRENT_TIMESTAMP AS current_time FROM authentication.tbl_ath_login_guard
       WHERE alg_key_sha256 = ANY($1::char(64)[]) ORDER BY alg_key_sha256 FOR UPDATE`, [guards.map(item => item.hash)]);
    if (locked.rows.some(row => row.alg_locked_until && row.alg_locked_until > row.current_time)) return { kind: 'RATE_LIMITED' } as const;
    const found = await tx.query<{ idn_id: string; idn_state: string; apc_password_hash: string | null }>(
      `SELECT i.idn_id, i.idn_state, c.apc_password_hash
       FROM identity.tbl_idn_identity i
       LEFT JOIN authentication.tbl_ath_password_credential c ON c.apc_identity__idn_id = i.idn_id
       WHERE i.idn_email_normalized = $1 AND i.idn_kind = 'HUMAN' LIMIT 1`, [normalized]);
    const identity = found.rows[0];
    const valid = await verifyPassword(password, identity?.apc_password_hash ?? await DUMMY_HASH);
    const membership = valid && identity?.idn_state === 'ACTIVE' ? await tx.query<{ idm_id: string; idm_tenant_id: string }>(
      `SELECT idm_id, idm_tenant_id FROM identity.tbl_idn_membership
       WHERE idm_identity__idn_id = $1 AND idm_state = 'ACTIVE' ORDER BY idm_tenant_id`, [identity.idn_id]) : null;
    if (!valid || !identity || identity.idn_state !== 'ACTIVE' || !membership?.rows.length) {
      for (const guard of guards) {
        const row = locked.rows.find(item => item.alg_key_sha256.trim() === guard.hash);
        const prior = row?.alg_locked_until && row.alg_locked_until <= row.current_time ? 0 : row?.alg_failed_count ?? 0;
        const next = prior + 1;
        await tx.query(`UPDATE authentication.tbl_ath_login_guard
          SET alg_failed_count = $2::integer, alg_locked_until = CASE WHEN $2::integer >= $3::integer
          THEN CURRENT_TIMESTAMP + ($4::integer * INTERVAL '1 minute') ELSE NULL END,
          alg_updated_at = CURRENT_TIMESTAMP WHERE alg_key_sha256 = $1`,
        [guard.hash, next, guard.limit, LOCK_MINUTES]);
      }
      return { kind: 'INVALID' } as const;
    }
    await tx.query(`UPDATE authentication.tbl_ath_login_guard
      SET alg_failed_count = 0, alg_locked_until = NULL, alg_updated_at = CURRENT_TIMESTAMP
      WHERE alg_key_sha256 = $1`, [guardKey('account', normalized)]);
    return { kind: 'AUTHENTICATED', identityId: identity.idn_id,
      memberships: membership.rows.map(row => ({ membershipId: row.idm_id, tenantId: row.idm_tenant_id })) } as const;
  });
}

export function createAuthenticationPersistence(pool: pg.Pool) {
  return { authenticatePassword: (email: string, password: string, clientAddress: string) =>
    authenticatePassword(pool, email, password, clientAddress) };
}

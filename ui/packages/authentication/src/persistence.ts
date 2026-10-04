import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type pg from 'pg';
import { withTargetTransaction } from '../../persistence/src/target.js';
import { hashPassword, verifyPassword, type typLoginResult } from './index.js';
import type {intfLegacyKeyConfiguration} from '../../configuration/src/index.js';
import {createDevelopmentLegacyIdentity} from '../../identity/src/persistence.js';
import {assignDevelopmentOnboardingRole} from '../../authority/src/persistence.onboarding.js';

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

export function createAuthenticationPersistence(pool: pg.Pool,legacyPolicy?:intfLegacyKeyConfiguration,deploymentId?:string) {
  return { authenticatePassword: (email: string, password: string, clientAddress: string) =>
    authenticatePassword(pool, email, password, clientAddress),
    authenticateLegacyKey: (rawKey: string, clientAddress: string) => authenticateLegacyKey(pool, rawKey, clientAddress,legacyPolicy,deploymentId),
    resolveOidcIdentity: (issuer: string, subject: string) => resolveOidcIdentity(pool, issuer, subject),
    startOidcFlow: (state: string, verifier:string, nonce:string, returnPath:string) => startOidcFlow(pool, state, verifier, nonce, returnPath),
    consumeOidcFlow: (state: string) => consumeOidcFlow(pool, state) };
}

/** New raw-key verifiers use SHA-256; MD5 is read only for imported credentials. */
export async function authenticateLegacyKey(pool: pg.Pool, rawKey: string, clientAddress: string,
  policy?:intfLegacyKeyConfiguration,deploymentId?:string): Promise<typLoginResult> {
  if (typeof rawKey !== 'string' || rawKey.length < 16 || rawKey.length > 256 || rawKey.includes('\0')
    || typeof clientAddress !== 'string' || clientAddress.length > 128) return { kind: 'INVALID' };
  const digest = createHash('sha256').update(rawKey, 'utf8').digest('hex');
  const legacyDigest = createHash('md5').update(rawKey, 'utf8').digest('hex');
  const guardHash = guardKey('legacy-address', clientAddress);
  return withTargetTransaction(pool, { actorKind: 'ANONYMOUS', actorId: null,
    correlationId: randomUUID(), source: 'authentication.legacy_key',
    ...(policy?.selfProvision&&deploymentId==='development'&&policy.onboardingTenantId?{tenantId:policy.onboardingTenantId,deploymentId:'development'}: {}) }, async tx => {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[digest]);
    await tx.query(`INSERT INTO authentication.tbl_ath_login_guard (alg_key_sha256) VALUES ($1)
      ON CONFLICT (alg_key_sha256) DO NOTHING`, [guardHash]);
    const guard = await tx.query<{alg_failed_count:number;alg_locked_until:Date|null;current_time:Date}>(
      `SELECT alg_failed_count,alg_locked_until,CURRENT_TIMESTAMP AS current_time
       FROM authentication.tbl_ath_login_guard WHERE alg_key_sha256=$1 FOR UPDATE`, [guardHash]);
    const row = guard.rows[0]!;
    if (row.alg_locked_until && row.alg_locked_until > row.current_time) return { kind: 'RATE_LIMITED' } as const;
    const found = await tx.query<{idn_id:string;idn_state:string;alk_legacy_md5:string|null;alk_sha256:string|null}>(
      `SELECT i.idn_id,i.idn_state,c.alk_legacy_md5,c.alk_sha256 FROM authentication.tbl_ath_legacy_key_credential c
       JOIN identity.tbl_idn_identity i ON i.idn_id=c.alk_identity__idn_id
       WHERE (c.alk_sha256=$1 OR c.alk_legacy_md5=$2) AND i.idn_kind='HUMAN' LIMIT 2`, [digest,legacyDigest]);
    if(found.rows.length>1)return{kind:'INVALID'} as const;
    const identity = found.rows[0];
    if(!identity&&/^[A-Za-z0-9_-]{32}$/.test(rawKey)&&policy?.selfProvision&&deploymentId==='development'
      &&policy.onboardingTenantId==='development'&&policy.onboardingRoleId){
      const provisionGuardHash=guardKey('legacy-provision-address',clientAddress);
      await tx.query(`INSERT INTO authentication.tbl_ath_login_guard(alg_key_sha256) VALUES($1)
        ON CONFLICT(alg_key_sha256) DO NOTHING`,[provisionGuardHash]);
      const provisionGuard=await tx.query<{alg_failed_count:number;alg_updated_at:Date;alg_locked_until:Date|null;current_time:Date}>(
        `SELECT alg_failed_count,alg_updated_at,alg_locked_until,CURRENT_TIMESTAMP AS current_time
         FROM authentication.tbl_ath_login_guard WHERE alg_key_sha256=$1 FOR UPDATE`,[provisionGuardHash]);
      const limit=provisionGuard.rows[0]!;
      if(limit.alg_locked_until&&limit.alg_locked_until>limit.current_time)return{kind:'RATE_LIMITED'} as const;
      const recent=limit.current_time.getTime()-limit.alg_updated_at.getTime()<24*3600000;
      const next=(recent?limit.alg_failed_count:0)+1;
      if(next>5)return{kind:'RATE_LIMITED'} as const;
      await tx.query(`UPDATE authentication.tbl_ath_login_guard SET alg_failed_count=$2,
        alg_locked_until=CASE WHEN $2>=5 THEN CURRENT_TIMESTAMP+INTERVAL '24 hours' ELSE NULL END,
        alg_updated_at=CURRENT_TIMESTAMP WHERE alg_key_sha256=$1`,[provisionGuardHash,next]);
      const created=await createDevelopmentLegacyIdentity(tx,policy.onboardingTenantId);
      await tx.query(`INSERT INTO authentication.tbl_ath_legacy_key_credential(alk_identity__idn_id,alk_sha256)
        VALUES($1,$2)`,[created.identityId,digest]);
      await assignDevelopmentOnboardingRole(tx,created.identityId,policy.onboardingTenantId,policy.onboardingRoleId);
      await tx.query(`UPDATE authentication.tbl_ath_login_guard SET alg_failed_count=0,alg_locked_until=NULL,
        alg_updated_at=CURRENT_TIMESTAMP WHERE alg_key_sha256=$1`,[guardHash]);
      return{kind:'AUTHENTICATED',identityId:created.identityId,
        memberships:[{membershipId:created.membershipId,tenantId:policy.onboardingTenantId}],provisioned:true} as const;
    }
    const storedDigest=identity?.alk_sha256?.trim()??identity?.alk_legacy_md5?.trim();
    const candidateDigest=identity?.alk_sha256?digest:legacyDigest;
    const valid = identity && storedDigest && storedDigest.length===candidateDigest.length
      && timingSafeEqual(Buffer.from(candidateDigest,'hex'),Buffer.from(storedDigest,'hex'));
    const memberships = valid && identity.idn_state === 'ACTIVE' ? await tx.query<{idm_id:string;idm_tenant_id:string}>(
      `SELECT idm_id,idm_tenant_id FROM identity.tbl_idn_membership
       WHERE idm_identity__idn_id=$1 AND idm_state='ACTIVE' ORDER BY idm_tenant_id`,[identity.idn_id]) : null;
    if (!valid || !memberships?.rows.length) {
      const next = (row.alg_locked_until && row.alg_locked_until <= row.current_time ? 0 : row.alg_failed_count) + 1;
      await tx.query(`UPDATE authentication.tbl_ath_login_guard SET alg_failed_count=$2,
        alg_locked_until=CASE WHEN $2>=20 THEN CURRENT_TIMESTAMP+INTERVAL '15 minutes' ELSE NULL END,
        alg_updated_at=CURRENT_TIMESTAMP WHERE alg_key_sha256=$1`,[guardHash,next]);
      return {kind:'INVALID'} as const;
    }
    await tx.query(`UPDATE authentication.tbl_ath_login_guard SET alg_failed_count=0,alg_locked_until=NULL,
      alg_updated_at=CURRENT_TIMESTAMP WHERE alg_key_sha256=$1`,[guardHash]);
    if(identity.alk_legacy_md5)await tx.query(`UPDATE authentication.tbl_ath_legacy_key_credential
      SET alk_legacy_md5=NULL,alk_sha256=$2 WHERE alk_identity__idn_id=$1 AND alk_legacy_md5=$3`,
    [identity.idn_id,digest,legacyDigest]);
    return {kind:'AUTHENTICATED',identityId:identity.idn_id,memberships:memberships.rows.map(item=>({membershipId:item.idm_id,tenantId:item.idm_tenant_id}))} as const;
  });
}

export async function resolveOidcIdentity(pool:pg.Pool,issuer:string,subject:string):Promise<typLoginResult>{
  if(!issuer.startsWith('https://')||!subject||subject.length>512)return{kind:'INVALID'};
  return withTargetTransaction(pool,{actorKind:'ANONYMOUS',actorId:null,correlationId:randomUUID(),source:'authentication.oidc'},async tx=>{
    const found=await tx.query<{idn_id:string;idn_state:string}>(`SELECT i.idn_id,i.idn_state FROM authentication.tbl_ath_oidc_credential c
      JOIN identity.tbl_idn_identity i ON i.idn_id=c.aoc_identity__idn_id WHERE c.aoc_issuer=$1 AND c.aoc_subject=$2 LIMIT 1`,[issuer,subject]);
    const identity=found.rows[0];if(!identity||identity.idn_state!=='ACTIVE')return{kind:'INVALID'} as const;
    const memberships=await tx.query<{idm_id:string;idm_tenant_id:string}>(`SELECT idm_id,idm_tenant_id FROM identity.tbl_idn_membership
      WHERE idm_identity__idn_id=$1 AND idm_state='ACTIVE' ORDER BY idm_tenant_id`,[identity.idn_id]);
    if(!memberships.rows.length)return{kind:'INVALID'} as const;
    return{kind:'AUTHENTICATED',identityId:identity.idn_id,memberships:memberships.rows.map(item=>({membershipId:item.idm_id,tenantId:item.idm_tenant_id}))} as const;
  });
}
export async function startOidcFlow(pool:pg.Pool,state:string,verifier:string,nonce:string,returnPath:string):Promise<void>{
  await withTargetTransaction(pool,{actorKind:'ANONYMOUS',actorId:null,correlationId:randomUUID(),source:'authentication.oidc.start'},
    tx=>tx.query(`INSERT INTO authentication.tbl_ath_oidc_flow(aof_state_sha256,aof_code_verifier,aof_nonce,aof_return_path,aof_expires_at)
      VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP+INTERVAL '5 minutes')`,[guardKey('oidc-state',state),verifier,nonce,returnPath]).then(()=>{}));
}
export async function consumeOidcFlow(pool:pg.Pool,state:string):Promise<{verifier:string;nonce:string;returnPath:string}|null>{
  return withTargetTransaction(pool,{actorKind:'ANONYMOUS',actorId:null,correlationId:randomUUID(),source:'authentication.oidc.callback'},async tx=>{
    const result=await tx.query<{aof_code_verifier:string;aof_nonce:string;aof_return_path:string}>(`UPDATE authentication.tbl_ath_oidc_flow SET aof_consumed_at=CURRENT_TIMESTAMP
      WHERE aof_state_sha256=$1 AND aof_consumed_at IS NULL AND aof_expires_at>CURRENT_TIMESTAMP
      RETURNING aof_code_verifier,aof_nonce,aof_return_path`,[guardKey('oidc-state',state)]);
    const row=result.rows[0];return row?{verifier:row.aof_code_verifier,nonce:row.aof_nonce,returnPath:row.aof_return_path}:null;
  });
}

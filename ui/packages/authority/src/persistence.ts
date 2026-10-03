import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import { withTargetTransaction } from '../../persistence/src/target.js';
import { enuAuthorityDecision, evaluateAuthority, getPrivValue, type intfAuthorityGrant, type intfAuthorityResult } from './index.js';

interface intfAuthorityRow {
  readonly idn_state: 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  readonly idm_state: 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  readonly aug_is_deny: boolean | null;
  readonly aug_privileges: unknown;
  readonly aug_scope: string | null;
  readonly aug_valid_from: Date | null;
  readonly aug_valid_until: Date | null;
  readonly aug_recurring: unknown;
  readonly aur_privileges: unknown;
  readonly aur_tenant_id: string | null;
  readonly current_time: Date;
}

const PUBLIC_PERMISSION = {
  translator: 'PublicTools.translator.use',
  summarizer: 'PublicTools.summarizer.use',
  faq: 'PublicTools.faq.use'
} as const;
export type typPublicToolAuthorityResult = intfAuthorityResult & { readonly limitTier?: 'AUTHENTICATED' | 'PRIVILEGED' };

function privileges(value: unknown): Readonly<Record<string, unknown>> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : null;
}

/** Resolve authority facts inside the owning capability; callers receive only a decision. */
export function createAuthorityPersistence(pool: pg.Pool, deploymentId: string) {
  return {
    async authorizePublicTool(identityId: string, tenantId: string, module: keyof typeof PUBLIC_PERMISSION): Promise<typPublicToolAuthorityResult> {
      const path = PUBLIC_PERMISSION[module];
      const rows = await withTargetTransaction(pool, { actorKind: 'HUMAN', actorId: identityId, tenantId,
        correlationId: randomUUID(), source: 'authority.resolve' }, tx => tx.query<intfAuthorityRow>(`SELECT i.idn_state, m.idm_state,
          g.aug_is_deny, g.aug_privileges, g.aug_scope, g.aug_valid_from, g.aug_valid_until,
          g.aug_recurring, r.aur_privileges, r.aur_tenant_id, CURRENT_TIMESTAMP AS current_time
        FROM identity.tbl_idn_identity i
        JOIN identity.tbl_idn_membership m ON m.idm_identity__idn_id = i.idn_id AND m.idm_tenant_id = $2
        JOIN authority.tbl_aut_permission p ON p.aup_path = $3 AND p.aup_module_id = $4
        LEFT JOIN authority.tbl_aut_grant g ON g.aug_identity__idn_id = i.idn_id AND g.aug_tenant_id = m.idm_tenant_id
        LEFT JOIN authority.tbl_aut_role r ON r.aur_id = g.aug_role__aur_id AND r.aur_tenant_id = g.aug_tenant_id
        WHERE i.idn_id = $1 AND i.idn_kind = 'HUMAN'`, [identityId, tenantId, path, module]));
      if (!rows.rows.length) return { decision: 'DENY', reason: 'NO_ACTIVE_MEMBERSHIP_OR_PERMISSION' };
      const first = rows.rows[0]!;
      if (first.idn_state !== 'ACTIVE' || first.idm_state !== 'ACTIVE') return { decision: 'DENY', reason: 'INACTIVE_ACTOR' };
      const grants: intfAuthorityGrant[] = [];
      const denies: string[] = [];
      for (const row of rows.rows) {
        if (row.aur_tenant_id !== null && row.aur_tenant_id !== tenantId) return { decision: 'DENY', reason: 'ROLE_TENANT_MISMATCH' };
        if (row.aug_is_deny === null) continue;
        const value = privileges(row.aug_privileges ?? row.aur_privileges);
        if (!value || row.aug_recurring !== null) return { decision: 'DENY', reason: 'INVALID_GRANT' };
        const grant: intfAuthorityGrant = { privileges: value, source: row.aur_privileges === null ? 'IDENTITY' : 'ROLE',
          ...(row.aug_scope ? { scope: row.aug_scope } : {}),
          ...(row.aug_valid_from ? { validFrom: row.aug_valid_from.toISOString() } : {}),
          ...(row.aug_valid_until ? { validUntil: row.aug_valid_until.toISOString() } : {}) };
        if (row.aug_is_deny) {
          const denied = evaluateAuthority({ facts: { actorId: identityId, tenantId, deploymentId, state: 'ACTIVE' },
            path, now: row.current_time.toISOString(), grants: [grant] });
          if (denied.decision === enuAuthorityDecision.Permit) denies.push(path);
        } else grants.push(grant);
      }
      const decision = evaluateAuthority({ facts: { actorId: identityId, tenantId, deploymentId,
        state: first.idn_state, resource: { tenantId } }, path, now: first.current_time.toISOString(), grants, denies });
      if (decision.decision !== enuAuthorityDecision.Permit) return decision;
      const tierPath = `PublicTools.${module}.limitTier`;
      const activeTier = (tier: 'AUTHENTICATED' | 'PRIVILEGED') => grants.some(grant => getPrivValue(grant.privileges, tierPath) === tier &&
        evaluateAuthority({ facts: { actorId: identityId, tenantId, deploymentId, state: first.idn_state },
          path, now: first.current_time.toISOString(), grants: [grant] }).decision === enuAuthorityDecision.Permit);
      if (activeTier('PRIVILEGED')) return { ...decision, limitTier: 'PRIVILEGED' };
      if (activeTier('AUTHENTICATED')) return { ...decision, limitTier: 'AUTHENTICATED' };
      return { decision: 'DENY', reason: 'MISSING_LIMIT_TIER' };
    }
  };
}

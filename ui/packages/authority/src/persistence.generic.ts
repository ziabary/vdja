import type pg from 'pg';
import type { intfExecutionContext } from '../../contracts/src/index.js';
import type { intfAuthorityGrant, typClassificationLevel } from './index.js';
import type { intfAuthorityLookup, typAuthorityResolution } from './contracts.js';

interface intfActorRow {
  readonly idn_kind: string;
  readonly idn_state: 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  readonly idm_state: 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  readonly idm_authorization_version: string;
  readonly auc_level: typClassificationLevel | null;
  readonly aup_value_kind: string;
  readonly aup_all_default: unknown;
  readonly aup_policy_version: number;
  readonly current_time: Date;
}
interface intfGrantRow {
  readonly aug_is_deny: boolean;
  readonly aug_privileges: unknown;
  readonly aug_scope: string | null;
  readonly aug_valid_from: Date | null;
  readonly aug_valid_until: Date | null;
  readonly aug_recurring: unknown;
  readonly aur_privileges: unknown;
  readonly aur_tenant_id: string | null;
  readonly aug_role__aur_id: string | null;
}
function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function recurring(value: unknown): intfAuthorityGrant['recurring'] | null {
  if (!isObject(value) || typeof value.timezone !== 'string' || typeof value.start !== 'string'
    || typeof value.end !== 'string' || !Array.isArray(value.weekdays)
    || value.weekdays.some(day => !Number.isInteger(day))) return null;
  if (value.calendar !== undefined && value.calendar !== 'GREGORIAN' && value.calendar !== 'JALALI') return null;
  if (value.oddEvenDay !== undefined && value.oddEvenDay !== 'ODD' && value.oddEvenDay !== 'EVEN') return null;
  return value as unknown as intfAuthorityGrant['recurring'];
}
async function readAuthoritySnapshot<T>(pool: pg.Pool, context: intfExecutionContext,
  work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SELECT set_config('app.actor_kind', $1, true), set_config('app.actor_id', $2, true), set_config('app.session_id', $3, true), set_config('app.tenant_id', $4, true), set_config('app.correlation_id', $5, true), set_config('app.source', 'authority.resolve', true)",
      [context.actorKind, context.actorId ?? '', context.sessionId ?? '', context.tenantId, context.correlationId]);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

/** Resolve only canonical identity, grant, ACL, clearance and hierarchy facts. The application service decides and audits. */
export async function resolveAuthorityFacts(pool: pg.Pool, lookup: intfAuthorityLookup): Promise<typAuthorityResolution> {
  const { context, path, resource } = lookup;
  const actorId = context.actorId;
  if (!actorId || context.actorKind === 'ANONYMOUS' || !context.tenantId || !context.deploymentId
    || !Number.isSafeInteger(context.authorizationVersion) || Number(context.authorizationVersion) <= 0
    || !/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/u.test(path)
    || (resource && (!/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u.test(resource.type)
      || !/^[A-Za-z0-9._:-]{1,128}$/u.test(resource.id))))
    return { kind: 'DENY', reason: 'INVALID_AUTHORITY_CONTEXT', policyVersion: null };
  return readAuthoritySnapshot(pool, context, tx => resolveFactsInSnapshot(tx, lookup));
}
async function resolveFactsInSnapshot(tx: pg.PoolClient, lookup: intfAuthorityLookup): Promise<typAuthorityResolution> {
  const { context, path, resource } = lookup;
  const actorId = context.actorId!;
  if(context.actorKind==='HUMAN'&&context.sessionId){
    const session=await tx.query(`SELECT ses_id FROM session_core.tbl_ses_session WHERE ses_id=$1 AND ses_identity__idn_id=$2
      AND ses_tenant_id=$3 AND ses_authorization_version=$4 AND ses_revoked_at IS NULL AND ses_expires_at>CURRENT_TIMESTAMP`,
      [context.sessionId,actorId,context.tenantId,context.authorizationVersion]);
    if(!session.rowCount)return{kind:'DENY',reason:'INVALID_OR_INACTIVE_SESSION',policyVersion:null};
  }
    const actor = await tx.query<intfActorRow>(`SELECT i.idn_kind, i.idn_state, m.idm_state, m.idm_authorization_version,
      c.auc_level, p.aup_value_kind, p.aup_all_default, p.aup_policy_version, CURRENT_TIMESTAMP AS current_time
      FROM identity.tbl_idn_identity i
      JOIN identity.tbl_idn_membership m ON m.idm_identity__idn_id = i.idn_id AND m.idm_tenant_id = $2
      JOIN authority.tbl_aut_permission p ON p.aup_path = $3 AND p.aup_module_id = $4
      LEFT JOIN authority.tbl_aut_clearance c ON c.auc_identity__idn_id = i.idn_id AND c.auc_tenant_id = m.idm_tenant_id
      WHERE i.idn_id = $1`, [actorId, context.tenantId, path, context.moduleId]);
    const first = actor.rows[0];
    if (!first) return { kind: 'DENY', reason: 'NO_ACTIVE_MEMBERSHIP_OR_PERMISSION', policyVersion: null };
    if (first.idn_kind !== context.actorKind || first.idn_state !== 'ACTIVE' || first.idm_state !== 'ACTIVE')
      return { kind: 'DENY', reason: 'INVALID_OR_INACTIVE_ACTOR', policyVersion: first.aup_policy_version };
    const version = Number(first.idm_authorization_version);
    if (!Number.isSafeInteger(version) || version !== context.authorizationVersion)
      return { kind: 'DENY', reason: 'AUTHORIZATION_VERSION_MISMATCH', policyVersion: first.aup_policy_version };
    if (first.aup_value_kind !== 'BOOLEAN' && first.aup_value_kind !== 'CRUD')
      return { kind: 'DENY', reason: 'UNSUPPORTED_PERMISSION_KIND', policyVersion: first.aup_policy_version };
    const rows = await tx.query<intfGrantRow>(`SELECT g.aug_is_deny, g.aug_privileges, g.aug_scope,
      g.aug_valid_from, g.aug_valid_until, g.aug_recurring, g.aug_role__aur_id,
      r.aur_privileges, r.aur_tenant_id
      FROM authority.tbl_aut_grant g
      LEFT JOIN authority.tbl_aut_role r ON r.aur_id = g.aug_role__aur_id
      WHERE g.aug_identity__idn_id = $1 AND g.aug_tenant_id = $2`, [actorId, context.tenantId]);
    const grants: intfAuthorityGrant[] = [], denyGrants: intfAuthorityGrant[] = [];
    for (const row of rows.rows) {
      if (row.aug_role__aur_id && row.aur_tenant_id !== context.tenantId)
        return { kind: 'DENY', reason: 'ROLE_TENANT_MISMATCH', policyVersion: first.aup_policy_version };
      const value = row.aug_privileges ?? row.aur_privileges;
      const schedule = row.aug_recurring === null ? undefined : recurring(row.aug_recurring);
      if (!isObject(value) || (row.aug_recurring !== null && !schedule))
        return { kind: 'DENY', reason: 'INVALID_GRANT', policyVersion: first.aup_policy_version };
      const grant: intfAuthorityGrant = { privileges: value,
        source: row.aug_role__aur_id ? 'ROLE' : 'IDENTITY',
        ...(row.aug_scope ? { scope: row.aug_scope } : {}),
        ...(row.aug_valid_from ? { validFrom: row.aug_valid_from.toISOString() } : {}),
        ...(row.aug_valid_until ? { validUntil: row.aug_valid_until.toISOString() } : {}),
        ...(schedule ? { recurring: schedule } : {}) };
      (row.aug_is_deny ? denyGrants : grants).push(grant);
    }
    const aclRows = resource ? await tx.query<{ ara_effect: 'ALLOW' | 'DENY' }>(`SELECT ara_effect
      FROM authority.tbl_aut_resource_acl WHERE ara_tenant_id = $1 AND ara_resource_type = $2
      AND ara_resource_id = $3 AND ara_identity__idn_id = $4 AND ara_permission = $5`,
    [context.tenantId, resource.type, resource.id, actorId, path]) : null;
    const acl = { denyActors: aclRows?.rows.some(row => row.ara_effect === 'DENY') ? [actorId] : [],
      grantActors: aclRows?.rows.some(row => row.ara_effect === 'ALLOW') ? [actorId] : [] };
    const parentByChild: Record<string, string> = {};
    if (resource?.organizationId) {
      const lineage = await tx.query<{ aoe_child_id: string; aoe_parent_id: string; cycle: boolean; depth: number }>(`
        WITH RECURSIVE chain AS (
          SELECT e.aoe_child_id, e.aoe_parent_id, ARRAY[e.aoe_child_id] AS visited,
            false AS cycle, 1 AS depth
          FROM authority.tbl_aut_org_edge e WHERE e.aoe_tenant_id = $1 AND e.aoe_child_id = $2
          UNION ALL
          SELECT e.aoe_child_id, e.aoe_parent_id, c.visited || e.aoe_child_id,
            e.aoe_parent_id = ANY(c.visited) AS cycle, c.depth + 1
          FROM authority.tbl_aut_org_edge e JOIN chain c ON e.aoe_child_id = c.aoe_parent_id
          WHERE e.aoe_tenant_id = $1 AND NOT c.cycle AND c.depth < 64
        ) SELECT aoe_child_id, aoe_parent_id, cycle, depth FROM chain`,
      [context.tenantId, resource.organizationId]);
      if (lineage.rows.some(row => row.cycle || row.depth >= 64))
        return { kind: 'DENY', reason: 'INVALID_SCOPE_HIERARCHY', policyVersion: first.aup_policy_version };
      for (const row of lineage.rows) parentByChild[row.aoe_child_id] = row.aoe_parent_id;
    }
    return { kind: 'RESOLVED', now: first.current_time.toISOString(), state: first.idn_state,
      authorizationVersion: version, policyVersion: first.aup_policy_version,
      valueKind: first.aup_value_kind, allDefault: first.aup_all_default,
      ...(first.auc_level ? { clearance: first.auc_level } : {}), grants, denyGrants, acl, parentByChild };
}

/** One canonical snapshot for a homogeneous resource batch: actor/grants once, ACL/hierarchy in sets. */
export async function resolveAuthorityBatch(pool: pg.Pool, lookups: readonly intfAuthorityLookup[]): Promise<readonly typAuthorityResolution[]> {
  if (!lookups.length) return [];
  if (lookups.length > 1000) throw new Error('INVALID_AUTHORITY_BATCH');
  const first = lookups[0]!, { context, path } = first;
  const invalid: typAuthorityResolution = { kind: 'DENY', reason: 'INVALID_AUTHORITY_CONTEXT', policyVersion: null };
  if (!context.actorId || context.actorKind === 'ANONYMOUS' || !context.tenantId || !context.deploymentId
    || !Number.isSafeInteger(context.authorizationVersion) || Number(context.authorizationVersion) <= 0
    || !/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/u.test(path)) return lookups.map(() => invalid);
  if (lookups.some(lookup => JSON.stringify(lookup.context) !== JSON.stringify(context) || lookup.path !== path
    || !lookup.resource || !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u.test(lookup.resource.type)
    || !/^[A-Za-z0-9._:-]{1,128}$/u.test(lookup.resource.id))) throw new Error('INVALID_AUTHORITY_BATCH');
  return readAuthoritySnapshot(pool, context, async tx => {
    const base = await resolveFactsInSnapshot(tx, { context, path });
    if (base.kind === 'DENY') return lookups.map(() => base);
    const resources = lookups.map(lookup => lookup.resource!);
    const rows = await tx.query<{ ara_resource_type: string; ara_resource_id: string; ara_effect: 'ALLOW' | 'DENY' }>(
      `SELECT ara_resource_type,ara_resource_id,ara_effect FROM authority.tbl_aut_resource_acl
       WHERE ara_tenant_id=$1 AND ara_identity__idn_id=$2 AND ara_permission=$3
       AND ara_resource_type=ANY($4::text[]) AND ara_resource_id=ANY($5::text[])`,
      [context.tenantId, context.actorId, path, [...new Set(resources.map(resource => resource.type))], resources.map(resource => resource.id)]);
    const aclByResource = new Map<string, Readonly<{ denyActors: readonly string[]; grantActors: readonly string[] }>>();
    for (const row of rows.rows) {
      const key = `${row.ara_resource_type}:${row.ara_resource_id}`, known = aclByResource.get(key) ?? { denyActors: [], grantActors: [] };
      aclByResource.set(key, { denyActors: row.ara_effect === 'DENY' ? [context.actorId!] : known.denyActors,
        grantActors: row.ara_effect === 'ALLOW' ? [context.actorId!] : known.grantActors });
    }
    const organizations = [...new Set(resources.flatMap(resource => resource.organizationId ? [resource.organizationId] : []))];
    const hierarchy = new Map<string, Record<string, string>>(), invalidRoots = new Set<string>();
    if (organizations.length) {
      const lineage = await tx.query<{ root: string; aoe_child_id: string; aoe_parent_id: string; cycle: boolean; depth: number }>(
        `WITH RECURSIVE chain AS (
          SELECT e.aoe_child_id AS root,e.aoe_child_id,e.aoe_parent_id,ARRAY[e.aoe_child_id] AS visited,false AS cycle,1 AS depth
          FROM authority.tbl_aut_org_edge e WHERE e.aoe_tenant_id=$1 AND e.aoe_child_id=ANY($2::text[])
          UNION ALL SELECT c.root,e.aoe_child_id,e.aoe_parent_id,c.visited||e.aoe_child_id,e.aoe_parent_id=ANY(c.visited) AS cycle,c.depth+1
          FROM authority.tbl_aut_org_edge e JOIN chain c ON e.aoe_child_id=c.aoe_parent_id
          WHERE e.aoe_tenant_id=$1 AND NOT c.cycle AND c.depth<64)
         SELECT root,aoe_child_id,aoe_parent_id,cycle,depth FROM chain`, [context.tenantId, organizations]);
      for (const row of lineage.rows) {
        if (row.cycle || row.depth >= 64) invalidRoots.add(row.root);
        const parents = hierarchy.get(row.root) ?? {}; parents[row.aoe_child_id] = row.aoe_parent_id; hierarchy.set(row.root, parents);
      }
    }
    return resources.map(resource => resource.organizationId && invalidRoots.has(resource.organizationId)
      ? { kind: 'DENY', reason: 'INVALID_SCOPE_HIERARCHY', policyVersion: base.policyVersion }
      : { ...base, acl: aclByResource.get(`${resource.type}:${resource.id}`) ?? { denyActors: [], grantActors: [] },
        parentByChild: resource.organizationId ? hierarchy.get(resource.organizationId) ?? {} : {} });
  });
}

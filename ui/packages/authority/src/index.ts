export type typAuthorityDecision = 'ALLOW' | 'DENY';
export enum enuAuthorityDecision { Permit = 'ALLOW', Reject = 'DENY' }
export type typClassificationLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export interface intfAuthorityFacts {
  readonly actorId: string;
  readonly tenantId: string;
  readonly deploymentId: string;
  readonly state: 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  readonly clearance?: typClassificationLevel;
  readonly resource?: Readonly<{ ownerId?: string; tenantId?: string; classification?: typClassificationLevel; acl?: Readonly<{ denyActors?: readonly string[]; grantActors?: readonly string[] }> }>;
  readonly organization?: Readonly<{ requested: string; parentByChild: Readonly<Record<string, string>> }>;
}
export interface intfAuthorityGrant {
  readonly privileges: Readonly<Record<string, unknown>>;
  readonly scope?: string;
  readonly source?: 'ROLE' | 'IDENTITY';
  readonly validFrom?: string;
  readonly validUntil?: string;
  readonly recurring?: Readonly<{ timezone: string; weekdays: readonly number[]; start: string; end: string; calendar?: 'GREGORIAN' | 'JALALI'; oddEvenDay?: 'ODD' | 'EVEN' }>;
  readonly explicit?: boolean;
}
export interface intfAuthorityRequest {
  readonly facts: intfAuthorityFacts;
  readonly path: string;
  readonly now: string;
  readonly grants: readonly intfAuthorityGrant[];
  readonly denies?: readonly string[];
  readonly crud?: Readonly<{ value: unknown; operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' }>;
  readonly requireClassification?: boolean;
}
export interface intfAuthorityResult { readonly decision: typAuthorityDecision; readonly reason: string }

const LEVEL: Readonly<Record<typClassificationLevel, number>> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
const WEEKDAY: Readonly<Record<string, number>> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const CRUD_INDEX: Readonly<Record<intfAuthorityRequest['crud'] extends never ? never : 'CREATE' | 'READ' | 'UPDATE' | 'DELETE', number>> = { CREATE: 0, READ: 1, UPDATE: 2, DELETE: 3 };

function privilegeParts(path: string): readonly string[] | null {
  if (!/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/.test(path)) return null;
  return path.split('.');
}
/** A typed privilege value; ALL supplies only the caller's registered default. */
export function getPrivValue(privileges: Readonly<Record<string, unknown>>, path: string, allDefault?: unknown): unknown {
  const parts = privilegeParts(path);
  if (!parts) return undefined;
  let node: unknown = privileges;
  let all = false;
  for (const part of parts) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return all ? allDefault : undefined;
    const value = node as Readonly<Record<string, unknown>>;
    if (value.ALL === true) all = true;
    node = Object.hasOwn(value, part) ? value[part] : undefined;
    if (node === undefined) return all ? allDefault : undefined;
  }
  if (node && typeof node === 'object' && !Array.isArray(node) && (node as Record<string, unknown>).ALL === true) return allDefault;
  return node;
}

function privilegeAllows(privileges: Readonly<Record<string, unknown>>, path: string): boolean {
  return getPrivValue(privileges, path, true) === true;
}
function validInstant(value: string): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}
function clockMinutes(value: string): number | null {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}
function scheduleAllows(rule: NonNullable<intfAuthorityGrant['recurring']>, now: number): boolean {
  if (!Array.isArray(rule.weekdays) || !rule.weekdays.length || rule.weekdays.some(day => !Number.isInteger(day) || day < 1 || day > 7)) return false;
  const start = clockMinutes(rule.start), end = clockMinutes(rule.end);
  if (start === null || end === null || start >= end || (rule.calendar && !['GREGORIAN', 'JALALI'].includes(rule.calendar)) || (rule.oddEvenDay && !['ODD', 'EVEN'].includes(rule.oddEvenDay))) return false;
  try {
    const parts = new Intl.DateTimeFormat('en-US-u-nu-latn', { timeZone: rule.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', day: 'numeric', calendar: rule.calendar === 'JALALI' ? 'persian' : 'gregory' }).formatToParts(new Date(now));
    const part = (name: string) => parts.find(item => item.type === name)?.value;
    const weekday = WEEKDAY[part('weekday') ?? ''];
    const hour = Number(part('hour')), minute = Number(part('minute')), day = Number(part('day'));
    if (!weekday || !Number.isInteger(hour) || !Number.isInteger(minute) || !Number.isInteger(day)) return false;
    if (rule.oddEvenDay && (day % 2 === 1 ? 'ODD' : 'EVEN') !== rule.oddEvenDay) return false;
    const time = hour * 60 + minute;
    return rule.weekdays.includes(weekday) && time >= start && time < end;
  } catch { return false; }
}
function grantActive(grant: intfAuthorityGrant, now: number): boolean {
  if (grant.validFrom !== undefined) { const start = validInstant(grant.validFrom); if (start === null || now < start) return false; }
  if (grant.validUntil !== undefined) { const end = validInstant(grant.validUntil); if (end === null || now >= end) return false; }
  if (grant.validFrom && grant.validUntil && Date.parse(grant.validFrom) >= Date.parse(grant.validUntil)) return false;
  return !grant.recurring || scheduleAllows(grant.recurring, now);
}
function scopeAllows(grant: intfAuthorityGrant, facts: intfAuthorityFacts): boolean {
  if (!grant.scope) return true;
  const org = facts.organization;
  if (!org?.requested || !org.parentByChild || typeof org.parentByChild !== 'object') return false;
  let current = org.requested;
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    if (current === grant.scope) return true;
    visited.add(current);
    current = org.parentByChild[current] ?? '';
  }
  return false;
}
function crudAllows(value: unknown, operation: NonNullable<intfAuthorityRequest['crud']>['operation'], ownerId: string | undefined, actorId: string): boolean {
  if (typeof value !== 'string' || !/^[01w]{4}$/.test(value)) return false;
  const permission = value[CRUD_INDEX[operation]];
  return permission === '1' || (permission === 'w' && !!ownerId && ownerId === actorId);
}
function denyMatches(deny: string, path: string): boolean { return deny === path || (deny.endsWith('.ALL') && path.startsWith(deny.slice(0, -3))); }

/** Pure decision kernel. The caller resolves and normalizes authoritative facts before entry. */
export function evaluateAuthority(input: Readonly<intfAuthorityRequest>): intfAuthorityResult {
  const deny = (reason: string): intfAuthorityResult => ({ decision: 'DENY', reason });
  if (!input || !privilegeParts(input.path) || !input.facts?.actorId || !input.facts.tenantId || !input.facts.deploymentId || input.facts.state !== 'ACTIVE') return deny('INVALID_OR_INACTIVE_ACTOR');
  const now = validInstant(input.now);
  if (now === null || !Array.isArray(input.grants)) return deny('INVALID_REQUEST');
  const resource = input.facts.resource;
  if (resource?.tenantId && resource.tenantId !== input.facts.tenantId) return deny('TENANT_MISMATCH');
  if (input.requireClassification) {
    const clearance = input.facts.clearance, classification = resource?.classification;
    if (!clearance || !classification || !(clearance in LEVEL) || !(classification in LEVEL) || LEVEL[clearance] < LEVEL[classification]) return deny('CLASSIFICATION_BOUNDARY');
  }
  if (resource?.acl?.denyActors?.includes(input.facts.actorId) || input.denies?.some(path => denyMatches(path, input.path))) return deny('EXPLICIT_DENY');
  if (input.crud && !crudAllows(input.crud.value, input.crud.operation, resource?.ownerId, input.facts.actorId)) return deny('CRUD_DENY');
  if (resource?.acl?.grantActors?.includes(input.facts.actorId)) return { decision: 'ALLOW', reason: 'ACL_GRANT' };
  for (const grant of input.grants) {
    if (!grant || !grant.privileges || typeof grant.privileges !== 'object' || Array.isArray(grant.privileges) || !grantActive(grant, now) || !scopeAllows(grant, input.facts)) continue;
    if (input.crud) {
      const value = getPrivValue(grant.privileges, input.path);
      if (value === input.crud.value && crudAllows(value, input.crud.operation, resource?.ownerId, input.facts.actorId)) return { decision: 'ALLOW', reason: 'GRANT' };
    } else if (privilegeAllows(grant.privileges, input.path)) return { decision: 'ALLOW', reason: 'GRANT' };
  }
  return deny('NO_GRANT');
}

export const invalidationContract = Object.freeze({ authorizationVersion: true, sessions: true, refreshFamilies: true, delegation: true, breakGlass: true });

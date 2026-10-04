import type { intfExecutionContext } from '../../contracts/src/index.js';
import type { intfAuthorityGrant, intfAuthorityResult, typClassificationLevel } from './index.js';

export interface intfProtectedResourceFacts {
  readonly type: string;
  readonly id: string;
  readonly tenantId: string;
  readonly ownerId?: string;
  readonly classification?: typClassificationLevel;
  readonly organizationId?: string;
}
export interface intfAuthorityLookup {
  readonly context: intfExecutionContext;
  readonly path: string;
  readonly resource?: intfProtectedResourceFacts;
}
export interface intfAuthorityResolved {
  readonly kind: 'RESOLVED';
  readonly now: string;
  readonly state: 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  readonly authorizationVersion: number;
  readonly policyVersion: number;
  readonly valueKind: 'BOOLEAN' | 'CRUD';
  readonly allDefault: unknown;
  readonly clearance?: typClassificationLevel;
  readonly grants: readonly intfAuthorityGrant[];
  readonly denyGrants: readonly intfAuthorityGrant[];
  readonly acl: Readonly<{ denyActors: readonly string[]; grantActors: readonly string[] }>;
  readonly parentByChild: Readonly<Record<string, string>>;
}
export type typAuthorityResolution = intfAuthorityResolved | Readonly<{ kind: 'DENY'; reason: string; policyVersion: number | null }>;
export type typPublicToolAuthorityResult = intfAuthorityResult & { readonly limitTier?: 'AUTHENTICATED' | 'PRIVILEGED' };

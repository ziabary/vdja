import type { intfExecutionContext } from '../../contracts/src/index.js';
import { enuAuthorityDecision, evaluateAuthority, getPrivValue,
  type intfAuthorityFacts, type intfAuthorityGrant, type intfAuthorityResult,
  type intfAuthorityRequest } from './index.js';
import type { intfAuthorityLookup, intfProtectedResourceFacts, typAuthorityResolution,
  typPublicToolAuthorityResult } from './contracts.js';

export interface intfAuthorityDecisionEvidence {
  readonly path: string;
  readonly decision: 'ALLOW' | 'DENY';
  readonly reason: string;
  readonly resourceType: string | null;
  readonly resourceId: string | null;
  readonly policyVersion: number | null;
  readonly authorizationVersion: number | null;
}
export enum enuAuthorityLimitTier { Authenticated = 'AUTHENTICATED', Privileged = 'PRIVILEGED' }
export interface intfAuthorityPorts {
  readonly resolve: (lookup: intfAuthorityLookup) => Promise<typAuthorityResolution>;
  readonly resolveBatch?: (lookups: readonly intfAuthorityLookup[]) => Promise<readonly typAuthorityResolution[]>;
  readonly authorizePublicTool: (identityId: string, tenantId: string,
    module: 'translator' | 'summarizer' | 'faq') => Promise<typPublicToolAuthorityResult>;
  readonly recordDecision: (context: intfExecutionContext, evidence: intfAuthorityDecisionEvidence) => Promise<void>;
  readonly recordDecisions?: (context: intfExecutionContext, evidence: readonly intfAuthorityDecisionEvidence[]) => Promise<void>;
}
export interface intfPersistedAuthorityRequest extends intfAuthorityLookup {
  readonly crudOperation?: NonNullable<intfAuthorityRequest['crud']>['operation'];
  readonly requireClassification?: boolean;
}

function safeReference(value: string | undefined): string | null {
  return value && /^[A-Za-z0-9._:-]{1,128}$/u.test(value) ? value : null;
}
function facts(context: intfExecutionContext, resource: intfProtectedResourceFacts | undefined,
  resolution: Extract<typAuthorityResolution, { kind: 'RESOLVED' }>): intfAuthorityFacts {
  return { actorId: context.actorId!, tenantId: context.tenantId, deploymentId: context.deploymentId,
    state: resolution.state,
    ...(resolution.clearance ? { clearance: resolution.clearance } : {}),
    ...(resource ? { resource: { tenantId: resource.tenantId, ...(resource.ownerId ? { ownerId: resource.ownerId } : {}),
      ...(resource.classification ? { classification: resource.classification } : {}), acl: resolution.acl } } : {}),
    ...(resource?.organizationId ? { organization: { requested: resource.organizationId,
      parentByChild: resolution.parentByChild } } : {}) };
}

/** The only production Authority facade: no decision is returned unless its evidence commits. */
export class clsAuthorityService {
  constructor(private readonly ports: intfAuthorityPorts) {}
  async fileLimitTier(request: intfPersistedAuthorityRequest): Promise<enuAuthorityLimitTier> {
    const decision = await this.authorize({ ...request, path: 'Knowledge.Files.elevatedLimits' });
    return decision.decision === enuAuthorityDecision.Permit ? enuAuthorityLimitTier.Privileged : enuAuthorityLimitTier.Authenticated;
  }

  private async evidence(context: intfExecutionContext, path: string, resource: intfProtectedResourceFacts | undefined,
    decision: intfAuthorityResult, policyVersion: number | null): Promise<void> {
    await this.ports.recordDecision(context, { path: safeReference(path) ?? 'INVALID', decision: decision.decision,
      reason: decision.reason, resourceType: safeReference(resource?.type), resourceId: safeReference(resource?.id),
      policyVersion, authorizationVersion: Number.isSafeInteger(context.authorizationVersion) && Number(context.authorizationVersion) > 0
        ? Number(context.authorizationVersion) : null });
  }

  async authorize(request: intfPersistedAuthorityRequest): Promise<intfAuthorityResult> {
    const { context, path, resource } = request;
    let decision: intfAuthorityResult;
    let policyVersion: number | null = null;
    if (resource && resource.tenantId !== context.tenantId) decision = { decision: 'DENY', reason: 'TENANT_MISMATCH' };
    else {
      const resolved = await this.ports.resolve(request);
      policyVersion = resolved.policyVersion;
      if (resolved.kind === 'DENY') decision = { decision: 'DENY', reason: resolved.reason };
      else decision = this.evaluate(request, resolved);
    }
    await this.evidence(context, path, resource, decision, policyVersion);
    return decision;
  }
  async authorizeBatch(requests: readonly intfPersistedAuthorityRequest[]): Promise<readonly intfAuthorityResult[]> {
    if (requests.length > 1000) throw new Error('INVALID_AUTHORITY_BATCH');
    if (!requests.length) return [];
    if (!this.ports.resolveBatch) return Promise.all(requests.map(request => this.authorize(request)));
    const resolutions = await this.ports.resolveBatch(requests);
    if (resolutions.length !== requests.length) throw new Error('INVALID_AUTHORITY_BATCH_RESOLUTION');
    const decisions: intfAuthorityResult[] = [];
    const evidence: intfAuthorityDecisionEvidence[] = [];
    for (let index = 0; index < requests.length; index += 1) {
      const request = requests[index]!, resolved = resolutions[index]!;
      const decision: intfAuthorityResult = request.resource && request.resource.tenantId !== request.context.tenantId
        ? { decision: 'DENY', reason: 'TENANT_MISMATCH' } : resolved.kind === 'DENY'
          ? { decision: 'DENY', reason: resolved.reason } : this.evaluate(request, resolved);
      if (this.ports.recordDecisions) evidence.push({path:safeReference(request.path)??'INVALID',decision:decision.decision,reason:decision.reason,
        resourceType:safeReference(request.resource?.type),resourceId:safeReference(request.resource?.id),policyVersion:resolved.policyVersion,
        authorizationVersion:Number.isSafeInteger(request.context.authorizationVersion)&&Number(request.context.authorizationVersion)>0?Number(request.context.authorizationVersion):null});
      else await this.evidence(request.context, request.path, request.resource, decision, resolved.policyVersion);
      decisions.push(decision);
    }
    if (this.ports.recordDecisions) await this.ports.recordDecisions(requests[0]!.context,evidence);
    return decisions;
  }

  private evaluate(request: intfPersistedAuthorityRequest,
    resolved: Extract<typAuthorityResolution, { kind: 'RESOLVED' }>): intfAuthorityResult {
    const { context, path, resource, crudOperation } = request;
    const inputFacts = facts(context, resource, resolved);
    const base: Omit<intfAuthorityRequest, 'grants'> = { facts: inputFacts, path, now: resolved.now,
      requireClassification: request.requireClassification ?? !!resource,
      allDefault: resolved.allDefault, denies: [] };
    const denies: string[] = [];
    for (const grant of resolved.denyGrants) {
      const denyValue = getPrivValue(grant.privileges, path, resolved.allDefault);
      const match = evaluateAuthority({ ...base, facts: { ...inputFacts,
        resource: inputFacts.resource ? { ...inputFacts.resource, acl: undefined } : undefined },
        requireClassification: false, grants: [grant],
        ...(resolved.valueKind === 'CRUD' && crudOperation ? { crud: { value: denyValue, operation: crudOperation } } : {}) });
      if (match.decision === enuAuthorityDecision.Permit) denies.push(path);
    }
    const withDenies = { ...base, denies };
    if (resolved.valueKind === 'BOOLEAN') {
      if (crudOperation) return { decision: 'DENY', reason: 'PERMISSION_KIND_MISMATCH' };
      return evaluateAuthority({ ...withDenies, grants: resolved.grants });
    }
    if (!crudOperation) return { decision: 'DENY', reason: 'CRUD_OPERATION_REQUIRED' };
    const boundary = evaluateAuthority({ ...withDenies, grants: [] });
    if (boundary.reason === 'TENANT_MISMATCH' || boundary.reason === 'CLASSIFICATION_BOUNDARY'
      || boundary.reason === 'EXPLICIT_DENY' || boundary.reason === 'INVALID_OR_INACTIVE_ACTOR') return boundary;
    if (boundary.decision === enuAuthorityDecision.Permit) return boundary;
    for (const grant of resolved.grants) {
      const value = getPrivValue(grant.privileges, path, resolved.allDefault);
      const result = evaluateAuthority({ ...withDenies, grants: [grant], crud: { value, operation: crudOperation } });
      if (result.decision === enuAuthorityDecision.Permit) return result;
    }
    return { decision: 'DENY', reason: 'CRUD_DENY' };
  }

  async authorizeFields(context: intfExecutionContext, resource: intfProtectedResourceFacts,
    fields: readonly Readonly<{ name: string; permissionPath: string }>[]): Promise<readonly string[]> {
    if (fields.length > 64 || new Set(fields.map(field => field.name)).size !== fields.length)
      throw new Error('INVALID_FIELD_VOCABULARY');
    const allowed: string[] = [];
    for (const field of fields) {
      if (!/^[a-z][a-z0-9_]{0,63}$/u.test(field.name)) throw new Error('INVALID_FIELD_VOCABULARY');
      const result = await this.authorize({ context, path: field.permissionPath, resource });
      if (result.decision === enuAuthorityDecision.Permit) allowed.push(field.name);
    }
    return allowed;
  }

  async materializeAuthorized<T>(request: intfPersistedAuthorityRequest,
    load: () => Promise<T>): Promise<Readonly<{ decision: intfAuthorityResult; value?: T }>> {
    const decision = await this.authorize(request);
    return decision.decision === 'ALLOW' ? { decision, value: await load() } : { decision };
  }

  async materializeFields<T>(context: intfExecutionContext, resource: intfProtectedResourceFacts,
    fields: readonly Readonly<{ name: string; permissionPath: string }>[],
    load: (allowedFields: readonly string[]) => Promise<T>): Promise<Readonly<{ allowedFields: readonly string[]; value?: T }>> {
    const allowedFields = await this.authorizeFields(context, resource, fields);
    return allowedFields.length ? { allowedFields, value: await load(allowedFields) } : { allowedFields };
  }

  async authorizePublicTool(context: intfExecutionContext,
    module: 'translator' | 'summarizer' | 'faq'): Promise<typPublicToolAuthorityResult> {
    const path = `PublicTools.${module}.use`;
    const result = context.actorKind === 'HUMAN' && context.actorId && context.moduleId === module
      ? await this.ports.authorizePublicTool(context.actorId, context.tenantId, module)
      : { decision: 'DENY', reason: 'INVALID_AUTHORITY_CONTEXT' } as const;
    await this.evidence(context, path, undefined, result, null);
    return result;
  }
}

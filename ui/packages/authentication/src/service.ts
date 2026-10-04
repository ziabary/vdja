import type { typRefreshOutcome } from '../../session/src/index.js';
import { issueAccessToken, verifyAccessToken, type intfAccessTokenKeys,
  type intfAccessTokenPolicy, type intfAccessTokenClaims } from '../../session/src/access-token.js';
import type { intfLoginMembership, typLoginResult } from './index.js';

export interface intfAuthenticationPorts {
  readonly authenticatePassword: (email: string, password: string, clientAddress: string) => Promise<typLoginResult>;
  readonly authenticateLegacyKey?: (rawKey: string, clientAddress: string) => Promise<typLoginResult>;
  readonly resolveOidcIdentity?: (issuer: string, subject: string) => Promise<typLoginResult>;
  readonly startOidcFlow?: (state: string,verifier:string,nonce:string,returnPath:string) => Promise<void>;
  readonly consumeOidcFlow?: (state: string) => Promise<{verifier:string;nonce:string;returnPath:string}|null>;
  readonly createTenantSession: (identityId: string, membershipId: string, tenantId: string) => Promise<Readonly<{
    sessionId: string; refreshToken: string; authorizationVersion: number }>>;
  readonly rotateRefreshToken: (rawToken: string) => Promise<typRefreshOutcome>;
  readonly validateAccessSession: (claims: intfAccessTokenClaims, requestedTenantId: string) => Promise<boolean>;
  readonly revokeRefreshSession: (rawToken: string) => Promise<{ readonly sessionId: string; readonly identityId: string; readonly tenantId: string } | null>;
}

export type typLoginResponse =
  | Readonly<{ kind: 'SIGNED_IN'; accessToken: string; refreshToken: string; tenantId: string; identityId: string; sessionId: string; provisioned?:boolean }>
  | Readonly<{ kind: 'TENANT_SELECTION_REQUIRED'; tenants: readonly string[] }>
  | Readonly<{ kind: 'INVALID' }>
  | Readonly<{ kind: 'RATE_LIMITED' }>;

export class clsAuthenticationService {
  constructor(private readonly ports: intfAuthenticationPorts, private readonly keys: intfAccessTokenKeys,
    private readonly policy: intfAccessTokenPolicy) {}

  async login(email: string, password: string, clientAddress: string, selectedTenantId?: string): Promise<typLoginResponse> {
    const result = await this.ports.authenticatePassword(email, password, clientAddress);
    return this.completeLogin(result, selectedTenantId);
  }

  async loginLegacyKey(rawKey: string, clientAddress: string, selectedTenantId?: string): Promise<typLoginResponse> {
    return this.completeLogin(this.ports.authenticateLegacyKey ? await this.ports.authenticateLegacyKey(rawKey,clientAddress) : {kind:'INVALID'},selectedTenantId);
  }

  async loginOidcIdentity(issuer:string,subject:string,selectedTenantId?:string):Promise<typLoginResponse>{
    return this.completeLogin(this.ports.resolveOidcIdentity ? await this.ports.resolveOidcIdentity(issuer,subject) : {kind:'INVALID'},selectedTenantId);
  }

  async startOidcFlow(state:string,verifier:string,nonce:string,returnPath:string):Promise<void>{if(!this.ports.startOidcFlow)throw new Error('OIDC_DISABLED');await this.ports.startOidcFlow(state,verifier,nonce,returnPath);}
  async consumeOidcFlow(state:string):Promise<{verifier:string;nonce:string;returnPath:string}|null>{return this.ports.consumeOidcFlow ? this.ports.consumeOidcFlow(state) : null;}

  private async completeLogin(result:typLoginResult,selectedTenantId?:string):Promise<typLoginResponse>{
    if (result.kind !== 'AUTHENTICATED') return result;
    if (!selectedTenantId && result.memberships.length > 1)
      return { kind: 'TENANT_SELECTION_REQUIRED', tenants: result.memberships.map(item => item.tenantId) };
    const membership: intfLoginMembership | undefined = selectedTenantId
      ? result.memberships.find(item => item.tenantId === selectedTenantId) : result.memberships[0];
    if (!membership) return { kind: 'INVALID' };
    const session = await this.ports.createTenantSession(result.identityId, membership.membershipId, membership.tenantId);
    return { kind: 'SIGNED_IN', tenantId: membership.tenantId, identityId: result.identityId,
      sessionId: session.sessionId, refreshToken: session.refreshToken,
      ...(result.provisioned?{provisioned:true}:{}),
      accessToken: issueAccessToken({ identityId: result.identityId, tenantId: membership.tenantId,
        sessionId: session.sessionId, authorizationVersion: session.authorizationVersion }, this.keys, this.policy) };
  }

  async refresh(rawToken: string): Promise<Readonly<{ kind: 'ROTATED'; accessToken: string; refreshToken: string; tenantId: string; identityId: string; sessionId: string }>
    | Readonly<{ kind: 'REPLAY'; tenantId: string; identityId: string; sessionId: string }> | Readonly<{ kind: 'INVALID' }>> {
    const result = await this.ports.rotateRefreshToken(rawToken);
    if (result.kind !== 'ROTATED') return result;
    return { kind: 'ROTATED', refreshToken: result.refreshToken, tenantId: result.tenantId,
      identityId: result.identityId, sessionId: result.sessionId,
      accessToken: issueAccessToken({ identityId: result.identityId, tenantId: result.tenantId,
        sessionId: result.sessionId, authorizationVersion: result.authorizationVersion }, this.keys, this.policy) };
  }

  async authenticateBearer(bearer: string, requestedTenantId?: string): Promise<intfAccessTokenClaims> {
    const claims = verifyAccessToken(bearer, this.keys, this.policy);
    if (!await this.ports.validateAccessSession(claims, requestedTenantId ?? claims.tenantId)) throw new Error('INVALID_ACCESS_TOKEN');
    return claims;
  }

  async logout(rawToken: string): Promise<{ readonly sessionId: string; readonly identityId: string; readonly tenantId: string } | null> {
    return this.ports.revokeRefreshSession(rawToken);
  }
}

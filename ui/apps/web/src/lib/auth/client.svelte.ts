import { getContext, setContext } from 'svelte';
import { postAuthRequest } from '#lib/api/transport.js';

const AUTH_CLIENT = Symbol('auth-client');
interface intfAuthState { token: string | null; tenantId: string | null; restoring?:boolean }
export type typLoginOutcome = Readonly<{ kind: 'SIGNED_IN' }> | Readonly<{ kind: 'TENANT_SELECTION_REQUIRED'; tenants: readonly string[] }> | Readonly<{ kind: 'INVALID' }>;
export interface intfAuthClient {
  readonly state: intfAuthState;
  login(email: string, password: string, tenantId?: string): Promise<typLoginOutcome>;
  refresh(): Promise<void>;
  logout(): Promise<void>;
}

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function tenants(value: unknown): readonly string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }

/** Component context keeps access tokens in memory for this browser tab only. */
export function provideAuthClient(authOrigin: () => string | null): intfAuthClient {
  const state = $state<intfAuthState>({ token: null, tenantId: null, restoring:authOrigin()!==null });
  let revision=0;
  const client: intfAuthClient = {
    state,
    async login(email, password, tenantId) {
      const attempt=++revision;
      const origin = authOrigin(); if (!origin) return { kind: 'INVALID' };
      const response = await postAuthRequest(origin, 'login', { email, password, ...(tenantId ? { tenantId } : {}) });
      const body: unknown = await response.json().catch(() => null);
      if(attempt!==revision)return {kind:'INVALID'};
      if (response.ok && record(body) && body.status === 'TENANT_SELECTION_REQUIRED')
        return { kind: 'TENANT_SELECTION_REQUIRED', tenants: tenants(body.tenants) };
      if (!response.ok || !record(body) || typeof body.accessToken !== 'string' || typeof body.tenantId !== 'string')
        return { kind: 'INVALID' };
      state.token = body.accessToken; state.tenantId = body.tenantId;
      return { kind: 'SIGNED_IN' };
    },
    async refresh() {
      const attempt=revision;state.restoring=true;
      try{
      const origin = authOrigin(); if (!origin) { state.token = null; state.tenantId = null; return; }
      const response = await postAuthRequest(origin, 'refresh');
      if(attempt!==revision)return;
      if (!response.ok) { state.token = null; state.tenantId = null; return; }
      const body: unknown = await response.json().catch(() => null);
      if(attempt!==revision)return;
      if (record(body) && typeof body.accessToken === 'string' && typeof body.tenantId === 'string') {
        state.token = body.accessToken; state.tenantId = body.tenantId;
      }
      }finally{state.restoring=false;}
    },
    async logout() {
      revision+=1;state.token=null;state.tenantId=null;
      try { const origin = authOrigin(); if (origin) await postAuthRequest(origin, 'logout'); }
      finally { state.token = null; state.tenantId = null; }
    }
  };
  setContext(AUTH_CLIENT, client);
  return client;
}

export function useAuthClient(): intfAuthClient {
  const client = getContext<intfAuthClient | undefined>(AUTH_CLIENT);
  if (!client) throw new Error('Auth client context missing');
  return client;
}

import { createHmac } from 'node:crypto';
import jwt from 'jsonwebtoken';

export interface OIDCFlow {
  codeVerifier: string;
  state: string;
  nonce: string;
  service: string;
  back: string;
  mustAdmin: boolean;
  mustVerified: boolean;
}

export function localReturnPath(value: unknown): string {
  if (typeof value !== 'string' || !value || /[\\\s]/.test(value)) return '/rag';
  const path = value.startsWith('/') ? value : `/${value}`;
  if (path.startsWith('//')) return '/rag';
  const url = new URL(path, 'https://local.invalid');
  return url.origin === 'https://local.invalid' ? url.pathname + url.search + url.hash : '/rag';
}

// Separate signing key: a flow cookie must never be usable as an API token.
function flowKey(secret: string) {
  return createHmac('sha256', secret).update('vadja:oidc-flow').digest();
}

export function signOIDCFlow(flow: OIDCFlow, secret: string): string {
  return jwt.sign(flow, flowKey(secret), { expiresIn: '5m', audience: 'oidc-flow', algorithm: 'HS256' });
}

export function readOIDCFlow(cookie: string, secret: string): OIDCFlow {
  const flow = jwt.verify(cookie, flowKey(secret), { algorithms: ['HS256'], audience: 'oidc-flow' });
  if (typeof flow === 'string' || !flow.codeVerifier || !flow.state || !flow.nonce
    || typeof flow.service !== 'string' || !flow.service || typeof flow.back !== 'string') {
    throw new Error('Invalid OIDC flow');
  }
  return flow as OIDCFlow;
}

export function oidcLoginPage(flow: OIDCFlow, result: 'complete' | 'error', error = 'oidc'): string {
  const params = new URLSearchParams({ service: flow.service, back: localReturnPath(flow.back) });
  if (flow.mustAdmin) params.set('mustAdmin', '1');
  if (flow.mustVerified) params.set('mustVerified', '1');
  params.set(result === 'complete' ? 'oidc' : 'error', result === 'complete' ? 'complete' : error);
  return `/login?${params}`;
}

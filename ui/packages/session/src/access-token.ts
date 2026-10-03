import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';
import { resolveSecretRef, type typSecretRef } from '../../configuration/src/index.js';

const MAX_TOKEN_BYTES = 4096;
const MAX_LIFETIME_SECONDS = 300;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDENTIFIER = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export interface intfAccessTokenClaims {
  readonly identityId: string;
  readonly tenantId: string;
  readonly sessionId: string;
  readonly authorizationVersion: number;
}

export interface intfAccessTokenKeyRefs {
  readonly activeKid: string;
  readonly privateKeyRef: typSecretRef;
  readonly publicKeys: readonly Readonly<{ kid: string; publicKeyRef: typSecretRef }>[];
}

export interface intfAccessTokenKeys {
  readonly activeKid: string;
  readonly privateKey: KeyObject;
  readonly publicKeys: ReadonlyMap<string, KeyObject>;
}

export interface intfAccessTokenPolicy {
  readonly issuer: string;
  readonly audience: string;
  readonly lifetimeSeconds: number;
}

function invalid(): never { throw new Error('INVALID_ACCESS_TOKEN'); }
function validKid(kid: string): boolean { return /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(kid); }
function validPolicy(policy: intfAccessTokenPolicy): void {
  if (!policy.issuer || !policy.audience || !Number.isInteger(policy.lifetimeSeconds)
    || policy.lifetimeSeconds < 1 || policy.lifetimeSeconds > MAX_LIFETIME_SECONDS) throw new Error('INVALID_ACCESS_TOKEN_POLICY');
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function decode(segment: string): unknown {
  if (!BASE64URL.test(segment)) invalid();
  const bytes = Buffer.from(segment, 'base64url');
  if (bytes.toString('base64url') !== segment) invalid();
  try { return JSON.parse(bytes.toString('utf8')) as unknown; } catch { return invalid(); }
}
function exactKeys(value: Record<string, unknown>, expected: readonly string[]): void {
  if (Object.keys(value).length !== expected.length || expected.some(key => !Object.hasOwn(value, key))) invalid();
}
function validClaims(value: Record<string, unknown>): value is Record<string, string | number> & intfAccessTokenClaims {
  return typeof value.identityId === 'string' && UUID.test(value.identityId)
    && typeof value.sessionId === 'string' && UUID.test(value.sessionId)
    && typeof value.tenantId === 'string' && IDENTIFIER.test(value.tenantId)
    && Number.isSafeInteger(value.authorizationVersion) && Number(value.authorizationVersion) > 0;
}

/** Read only named key references; retain old public keys until all old tokens expire. */
export async function loadAccessTokenKeys(refs: intfAccessTokenKeyRefs, secretRoot?: string): Promise<intfAccessTokenKeys> {
  if (!validKid(refs.activeKid) || !refs.publicKeys.length) throw new Error('INVALID_ACCESS_TOKEN_KEYS');
  const publicKeys = new Map<string, KeyObject>();
  for (const item of refs.publicKeys) {
    if (!validKid(item.kid) || publicKeys.has(item.kid)) throw new Error('INVALID_ACCESS_TOKEN_KEYS');
    const key = createPublicKey(await resolveSecretRef(item.publicKeyRef, secretRoot));
    if (key.asymmetricKeyType !== 'ed25519') throw new Error('INVALID_ACCESS_TOKEN_KEYS');
    publicKeys.set(item.kid, key);
  }
  if (!publicKeys.has(refs.activeKid)) throw new Error('INVALID_ACCESS_TOKEN_KEYS');
  const privateKey = createPrivateKey(await resolveSecretRef(refs.privateKeyRef, secretRoot));
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('INVALID_ACCESS_TOKEN_KEYS');
  const proof = Buffer.from('access-token-key-pair-check');
  if (!verify(null, proof, publicKeys.get(refs.activeKid)!, sign(null, proof, privateKey))) throw new Error('INVALID_ACCESS_TOKEN_KEYS');
  return { activeKid: refs.activeKid, privateKey, publicKeys };
}

export function issueAccessToken(claims: intfAccessTokenClaims, keys: intfAccessTokenKeys,
  policy: intfAccessTokenPolicy, nowSeconds = Math.floor(Date.now() / 1000)): string {
  validPolicy(policy);
  const input = object(claims);
  exactKeys(input, ['identityId', 'tenantId', 'sessionId', 'authorizationVersion']);
  if (!validKid(keys.activeKid) || !keys.publicKeys.has(keys.activeKid) || !validClaims(input)
    || !Number.isSafeInteger(nowSeconds)) throw new Error('INVALID_ACCESS_TOKEN_INPUT');
  const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT', kid: keys.activeKid })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ identityId: claims.identityId, tenantId: claims.tenantId,
    sessionId: claims.sessionId, authorizationVersion: claims.authorizationVersion, iss: policy.issuer, aud: policy.audience,
    iat: nowSeconds, nbf: nowSeconds, exp: nowSeconds + policy.lifetimeSeconds })).toString('base64url');
  const signingInput = `${header}.${payload}`;
  return `${signingInput}.${sign(null, Buffer.from(signingInput, 'ascii'), keys.privateKey).toString('base64url')}`;
}

export function verifyAccessToken(token: string, keys: Pick<intfAccessTokenKeys, 'publicKeys'>,
  policy: intfAccessTokenPolicy, nowSeconds = Math.floor(Date.now() / 1000)): intfAccessTokenClaims {
  validPolicy(policy);
  if (typeof token !== 'string' || token.length > MAX_TOKEN_BYTES || !Number.isSafeInteger(nowSeconds)) invalid();
  const segments = token.split('.');
  if (segments.length !== 3) invalid();
  const [encodedHeader, encodedPayload, encodedSignature] = segments as [string, string, string];
  const header = object(decode(encodedHeader));
  exactKeys(header, ['alg', 'typ', 'kid']);
  if (header.alg !== 'EdDSA' || header.typ !== 'JWT' || typeof header.kid !== 'string' || !validKid(header.kid)) invalid();
  const key = keys.publicKeys.get(header.kid);
  if (!key || key.asymmetricKeyType !== 'ed25519') invalid();
  if (!BASE64URL.test(encodedSignature)) invalid();
  const signature = Buffer.from(encodedSignature, 'base64url');
  if (signature.length !== 64 || signature.toString('base64url') !== encodedSignature
    || !verify(null, Buffer.from(`${encodedHeader}.${encodedPayload}`, 'ascii'), key, signature)) invalid();
  const payload = object(decode(encodedPayload));
  exactKeys(payload, ['identityId', 'tenantId', 'sessionId', 'authorizationVersion', 'iss', 'aud', 'iat', 'nbf', 'exp']);
  if (!validClaims(payload) || payload.iss !== policy.issuer || payload.aud !== policy.audience
    || !Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.nbf) || !Number.isSafeInteger(payload.exp)
    || Number(payload.iat) > nowSeconds || Number(payload.nbf) > nowSeconds || Number(payload.exp) <= nowSeconds
    || Number(payload.exp) - Number(payload.iat) > MAX_LIFETIME_SECONDS || Number(payload.exp) <= Number(payload.iat)) invalid();
  return { identityId: payload.identityId as string, tenantId: payload.tenantId as string,
    sessionId: payload.sessionId as string, authorizationVersion: payload.authorizationVersion as number };
}

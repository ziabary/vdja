import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { clsAuthenticationService, type intfAuthenticationPorts } from '../../packages/authentication/src/service.js';
import { parseCjson, validateConfiguration } from '../../packages/configuration/src/index.js';
import type { intfAccessTokenKeys } from '../../packages/session/src/access-token.js';

const identityId = '123e4567-e89b-42d3-a456-426614174000';
const sessionId = '123e4567-e89b-42d3-a456-426614174001';
const tenantA = 'tenant-a', tenantB = 'tenant-b';
function fixture() {
  const pair = generateKeyPairSync('ed25519');
  const keys: intfAccessTokenKeys = { activeKid: 'v1', privateKey: pair.privateKey, publicKeys: new Map([['v1', pair.publicKey]]) };
  let active = true, refresh = 'first';
  const ports: intfAuthenticationPorts = {
    authenticatePassword: async (_email, password) => password === 'correct'
      ? { kind: 'AUTHENTICATED', identityId, memberships: [
        { membershipId: 'm-a', tenantId: tenantA }, { membershipId: 'm-b', tenantId: tenantB }] }
      : { kind: 'INVALID' },
    createTenantSession: async (_id, membershipId, tenantId) => {
      assert.equal(membershipId, tenantId === tenantB ? 'm-b' : 'm-a');
      return { sessionId, refreshToken: refresh, authorizationVersion: 3 };
    },
    rotateRefreshToken: async token => {
      if (token === 'first' && refresh === 'first') { refresh = 'second'; return { kind: 'ROTATED', refreshToken: refresh, sessionId, identityId, tenantId: tenantB, authorizationVersion: 3 }; }
      if (token === 'first') { active = false; return { kind: 'REPLAY', sessionId, identityId, tenantId: tenantB }; }
      return active && token === refresh ? { kind: 'ROTATED', refreshToken: 'third', sessionId, identityId, tenantId: tenantB, authorizationVersion: 3 } : { kind: 'INVALID' };
    },
    validateAccessSession: async (claims, tenantId) => active && claims.tenantId === tenantId && claims.authorizationVersion === 3,
    revokeRefreshSession: async () => { active = false; return { sessionId, identityId, tenantId: tenantB }; }
  };
  return new clsAuthenticationService(ports, keys,
    { issuer: 'https://auth.example.invalid', audience: 'targoman-api', lifetimeSeconds: 300 });
}

test('login requires explicit tenant choice and never merges memberships', async () => {
  const auth = fixture();
  assert.deepEqual(await auth.login('user@example.invalid', 'wrong', '127.0.0.1'), { kind: 'INVALID' });
  assert.deepEqual(await auth.login('user@example.invalid', 'correct', '127.0.0.1'),
    { kind: 'TENANT_SELECTION_REQUIRED', tenants: [tenantA, tenantB] });
  assert.deepEqual(await auth.login('user@example.invalid', 'correct', '127.0.0.1', 'tenant-c'), { kind: 'INVALID' });
  const result = await auth.login('user@example.invalid', 'correct', '127.0.0.1', tenantB);
  assert.equal(result.kind, 'SIGNED_IN');
  if (result.kind !== 'SIGNED_IN') return;
  assert.equal(result.tenantId, tenantB);
  assert.equal((await auth.authenticateBearer(result.accessToken, tenantB)).tenantId, tenantB);
  await assert.rejects(auth.authenticateBearer(result.accessToken, tenantA), /INVALID_ACCESS_TOKEN/);
  const rotated = await auth.refresh(result.refreshToken);
  assert.equal(rotated.kind, 'ROTATED');
  assert.deepEqual(await auth.refresh(result.refreshToken), { kind: 'REPLAY', identityId, sessionId, tenantId: tenantB });
  await assert.rejects(auth.authenticateBearer(result.accessToken, tenantB), /INVALID_ACCESS_TOKEN/);
  if (rotated.kind === 'ROTATED') assert.deepEqual(await auth.refresh(rotated.refreshToken), { kind: 'INVALID' });
});

test('Auth-disabled configuration needs no key material; enabled configuration accepts only secret references', () => {
  const source = parseCjson(readFileSync('deploy/examples/development/platform.cjson', 'utf8')) as Record<string, unknown>;
  const authenticatedAdmission = Object.fromEntries(Object.entries(source.admission as Record<string, Record<string, number>>)
    .map(([module, policy]) => [module, { ...policy, inputChars: Math.min(2_000_000, policy.inputChars! * 2),
      uploadBytes: policy.uploadBytes, outputTokens: module === 'faq' ? 40000 : 4000,
      requestsPerMinute: policy.requestsPerMinute! * 2, concurrent: policy.concurrent! * 2 }]));
  const privilegedAdmission = Object.fromEntries(Object.entries(authenticatedAdmission as Record<string, Record<string, number>>)
    .map(([module, policy]) => [module, { ...policy, inputChars: Math.min(2_000_000, policy.inputChars! * 2),
      outputTokens: module === 'faq' ? 80000 : 8000, requestsPerMinute: policy.requestsPerMinute! * 2,
      concurrent: policy.concurrent! * 2 }]));
  assert.equal(validateConfiguration({ ...source, auth: { enabled: false } }).auth?.enabled, false);
  const configured = { ...source, web: { publicOrigin: 'https://app.example.invalid' },
    http: { ...source.http as object, allowedOrigins: ['https://app.example.invalid'] },
    auth: { enabled: true, issuer: 'https://auth.example.invalid', publicOrigin: 'https://auth.example.invalid',
    allowedApplicationOrigins: ['https://app.example.invalid'], audience: 'targoman-api',
    accessTokenSeconds: 300, activeKid: 'v1', privateKeyRef: 'file:/run/secrets/access-private',
    session: { absoluteLifetimeSeconds: 2592000, refreshLifetimeSeconds: 604800, inactivityLifetimeSeconds: 604800 },
    password: { contextWords: ['سازمان نمونه'], compromised: { kind: 'LOCAL_SHA1', directory: '/tmp/t4-breach-fixture' } },
    authenticatedAdmission,
    privilegedAdmission,
    publicKeys: [{ kid: 'v1', publicKeyRef: 'file:/run/secrets/access-public' }] } };
  assert.equal(validateConfiguration(configured).auth?.enabled, true);
  assert.throws(() => validateConfiguration({ ...configured, auth: { ...configured.auth, password: undefined } }), /auth.password/);
  assert.throws(() => validateConfiguration({ ...configured, auth: { ...configured.auth, privateKeyRef: 'plain-key' } }), /auth.privateKeyRef/);
  assert.throws(() => validateConfiguration({ ...configured, auth: { ...configured.auth, accessTokenSeconds: 3600 } }), /auth.accessTokenSeconds/);
  assert.throws(() => validateConfiguration({ ...configured, auth: { ...configured.auth, session: { ...configured.auth.session, absoluteLifetimeSeconds: 2592001 } } }), /auth.session.absoluteLifetimeSeconds/);
  assert.throws(() => validateConfiguration({ ...configured, auth: { ...configured.auth, session: { ...configured.auth.session, refreshLifetimeSeconds: 2592000, absoluteLifetimeSeconds: 604800 } } }), /auth.session/);
  assert.throws(() => validateConfiguration({ ...configured, http: { ...source.http as object, allowedOrigins: ['https://app.example.invalid/path'] } }), /http.allowedOrigins/);
  assert.throws(() => validateConfiguration({ ...configured, http: { ...source.http as object, allowedOrigins: ['https://app.example.invalid/'] } }), /http.allowedOrigins/);
  assert.throws(() => validateConfiguration({ ...configured, auth: { ...configured.auth, publicOrigin: 'https://app.example.invalid' } }), /dedicated Auth hostname/);
  assert.throws(() => validateConfiguration({ ...configured, auth: { ...configured.auth, publicOrigin: 'http://auth.example.invalid' } }), /HTTPS required/);
});

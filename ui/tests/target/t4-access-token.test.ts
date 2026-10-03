import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { issueAccessToken, loadAccessTokenKeys, verifyAccessToken,
  type intfAccessTokenClaims, type intfAccessTokenKeys, type intfAccessTokenPolicy } from '../../packages/session/src/access-token.js';

const claims: intfAccessTokenClaims = {
  identityId: '123e4567-e89b-42d3-a456-426614174000', tenantId: 'tenant-a',
  sessionId: '123e4567-e89b-42d3-a456-426614174001', authorizationVersion: 4
};
const policy: intfAccessTokenPolicy = { issuer: 'https://auth.example.invalid', audience: 'targoman-api', lifetimeSeconds: 300 };
const now = 1_800_000_000;
function keys(): intfAccessTokenKeys {
  const pair = generateKeyPairSync('ed25519');
  return { activeKid: 'v1', privateKey: pair.privateKey, publicKeys: new Map([['v1', pair.publicKey]]) };
}
function forged(privateKey: KeyObject, header: Record<string, unknown>, payload: Record<string, unknown>): string {
  const input = `${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
  return `${input}.${sign(null, Buffer.from(input), privateKey).toString('base64url')}`;
}

test('minimal Ed25519 access token verifies and rejects common token attacks', () => {
  const keySet = keys();
  const token = issueAccessToken(claims, keySet, policy, now);
  assert.deepEqual(verifyAccessToken(token, keySet, policy, now), claims);
  assert.deepEqual(Object.keys(JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString())),
    ['identityId', 'tenantId', 'sessionId', 'authorizationVersion', 'iss', 'aud', 'iat', 'nbf', 'exp']);
  const payload = { ...claims, iss: policy.issuer, aud: policy.audience, iat: now, nbf: now, exp: now + 300 };
  const header = { alg: 'EdDSA', typ: 'JWT', kid: 'v1' };
  const invalid = [
    'not-a-jwt', `${token.split('.')[0]}.${token.split('.')[1]}.`,
    forged(keySet.privateKey, { ...header, alg: 'none' }, payload),
    forged(keySet.privateKey, { ...header, alg: 'HS256' }, payload),
    forged(keySet.privateKey, { ...header, kid: 'unknown' }, payload),
    forged(keySet.privateKey, header, { ...payload, iss: 'wrong' }),
    forged(keySet.privateKey, header, { ...payload, aud: 'wrong' }),
    forged(keySet.privateKey, header, { ...payload, nbf: now + 1 }),
    forged(keySet.privateKey, header, { ...payload, exp: now }),
    forged(keySet.privateKey, header, { ...payload, exp: now + 301 }),
    forged(keySet.privateKey, header, { ...payload, tenantId: 'tenant-b', privileged: true }),
    forged(keys().privateKey, header, payload)
  ];
  for (const candidate of invalid) assert.throws(() => verifyAccessToken(candidate, keySet, policy, now), /INVALID_ACCESS_TOKEN/);
  assert.throws(() => verifyAccessToken(token, keySet, policy, now + 300), /INVALID_ACCESS_TOKEN/);
  assert.throws(() => issueAccessToken(claims, keySet, { ...policy, lifetimeSeconds: 301 }, now), /INVALID_ACCESS_TOKEN_POLICY/);
});

test('key rotation keeps old public key valid until its tokens expire', () => {
  const old = keys(), next = keys();
  const token = issueAccessToken(claims, old, policy, now);
  const rotated: intfAccessTokenKeys = { activeKid: 'v2', privateKey: next.privateKey,
    publicKeys: new Map([['v1', old.publicKeys.get('v1')!], ['v2', next.publicKeys.get('v1')!]]) };
  assert.deepEqual(verifyAccessToken(token, rotated, policy, now), claims);
  assert.throws(() => verifyAccessToken(token, next, policy, now), /INVALID_ACCESS_TOKEN/);
  assert.deepEqual(verifyAccessToken(issueAccessToken(claims, rotated, policy, now), rotated, policy, now), claims);
});

test('key references load from secret files and reject mismatched signing keys', async () => {
  const directory = await mkdtemp(join(tmpdir(), 't4-token-'));
  try {
    const pair = generateKeyPairSync('ed25519');
    await writeFile(join(directory, 'private.pem'), pair.privateKey.export({ type: 'pkcs8', format: 'pem' }));
    await writeFile(join(directory, 'public.pem'), pair.publicKey.export({ type: 'spki', format: 'pem' }));
    const refs = { activeKid: 'v1', privateKeyRef: 'file:/run/secrets/private.pem' as const,
      publicKeys: [{ kid: 'v1', publicKeyRef: 'file:/run/secrets/public.pem' as const }] };
    const loaded = await loadAccessTokenKeys(refs, directory);
    assert.deepEqual(verifyAccessToken(issueAccessToken(claims, loaded, policy, now), loaded, policy, now), claims);
    const other = generateKeyPairSync('ed25519');
    await writeFile(join(directory, 'public.pem'), other.publicKey.export({ type: 'spki', format: 'pem' }));
    await assert.rejects(loadAccessTokenKeys(refs, directory), /INVALID_ACCESS_TOKEN_KEYS/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

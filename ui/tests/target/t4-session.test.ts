import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashRefreshToken, issueRefreshToken, rotateRefreshToken, type intfSessionStore } from '../../packages/session/src/index.js';

test('opaque refresh tokens have independent high entropy and only hash is sent to persistence', async () => {
  const first = issueRefreshToken(), second = issueRefreshToken();
  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(hashRefreshToken(first).length, 64);
  let seenOld = '', seenNew = '';
  const store: intfSessionStore = { rotate: async (oldHash, newHash) => {
    seenOld = oldHash; seenNew = newHash;
    return { kind: 'ROTATED', sessionId: 'session', identityId: 'identity', tenantId: 'tenant', authorizationVersion: 1 };
  } };
  const result = await rotateRefreshToken(store, first);
  assert.equal(result.kind, 'ROTATED');
  assert.equal(seenOld, hashRefreshToken(first));
  assert.notEqual(seenOld, seenNew);
  if (result.kind === 'ROTATED') assert.equal(seenNew, hashRefreshToken(result.refreshToken));
});

test('invalid refresh material is rejected before store access', async () => {
  const store: intfSessionStore = { rotate: async () => { throw new Error('must not run'); } };
  assert.deepEqual(await rotateRefreshToken(store, 'not-a-token'), { kind: 'INVALID' });
});

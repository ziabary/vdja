import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPassword, verifyPassword } from '../../packages/authentication/src/index.js';
import { COMMON_PASSWORD_COUNT, isCommonPassword } from '../../packages/authentication/src/common-passwords.js';

test('password storage is salted and verifies exact input', async () => {
  const password = 'an adequate passphrase 2026';
  const first = await hashPassword(password), second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.ok(!first.includes(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword(password.toUpperCase(), first), false);
  assert.equal(await verifyPassword(password + ' ', first), false);
  assert.equal(await verifyPassword(password, 'legacy-md5:abc'), false);
});

test('short or malformed passwords are rejected', async () => {
  await assert.rejects(hashPassword('short'), /INVALID_PASSWORD/);
  assert.equal(await verifyPassword('anything', 'invalid'), false);
});

test('password establishment rejects a ranked set of 3000 common policy-valid passwords', async () => {
  assert.equal(COMMON_PASSWORD_COUNT, 3000);
  assert.equal(isCommonPassword('123456789987654321'), true);
  await assert.rejects(hashPassword('123456789987654321'), /COMMON_PASSWORD/);
  assert.equal(isCommonPassword('an adequate passphrase 2026'), false);
});

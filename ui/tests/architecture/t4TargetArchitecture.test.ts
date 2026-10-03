import assert from 'node:assert/strict';
import { test } from 'node:test';
import { targetAuthFindings } from '../../scripts/t4-target-architecture.js';

test('JWT and password detectors catch target boundary violations', () => {
  assert.equal(targetAuthFindings('apps/api/src/unsafe.ts', 'jwt.verify(token, key);').length, 1);
  assert.equal(targetAuthFindings('modules/translator/src/unsafe.ts', 'verifyPassword(secret, hash);').length, 1);
  assert.equal(targetAuthFindings('packages/authentication/src/index.ts', 'verifyPassword(secret, hash);').length, 0);
});

test('Authority table and direct privilege detectors catch target boundary violations', () => {
  assert.equal(targetAuthFindings('apps/api/src/unsafe.ts', 'SELECT aug_id FROM authority.tbl_aut_grant').length, 1);
  assert.equal(targetAuthFindings('modules/faq/src/unsafe.ts', 'if (privs.ALL === true) allow();').length, 1);
  assert.equal(targetAuthFindings('packages/authority/src/index.ts', 'if (privs.ALL === true) allow();').length, 0);
  assert.equal(targetAuthFindings('src/legacy.ts', 'jwt.verify(token, key);').length, 0);
});

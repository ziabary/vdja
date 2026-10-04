import assert from 'node:assert/strict';
import { test } from 'node:test';
import { issueRefreshToken } from '../../packages/session/src/index.js';
import { inspectRefreshCookie, readRefreshCookie, refreshSetCookie, refreshClearCookie } from '../../packages/session/src/cookie.js';

test('refresh cookie is host-only with browser security attributes', () => {
  const token = issueRefreshToken();
  const cookie = refreshSetCookie(token);
  assert.match(cookie, /^__Host-tg_refresh=[A-Za-z0-9_-]{43}; HttpOnly; Secure; SameSite=Strict; Path=\/$/);
  assert.ok(cookie.split(';', 1)[0]!.length < 4096);
  assert.equal(readRefreshCookie(`ui-locale=fa; __Host-tg_refresh=${token}`), token);
  assert.equal(readRefreshCookie(`__Host-tg_refresh=${token}; __Host-tg_refresh=${token}`), null);
  assert.equal(inspectRefreshCookie(`__Host-tg_refresh=${token}; __Host-tg_refresh=${token}`).kind, 'AMBIGUOUS');
  assert.equal(inspectRefreshCookie(`__Host-tg_refresh=${token}; __Host-tg_refresh=invalid`).kind, 'AMBIGUOUS');
  assert.equal(inspectRefreshCookie(`__Host-tg_refresh=${token}; ui-locale=fa`).kind, 'VALID');
  assert.equal(readRefreshCookie(`__Host-tg_refresh=${token.slice(1)}`), null);
  assert.match(refreshClearCookie(), /Max-Age=0$/);
  assert.throws(() => refreshSetCookie('invalid'), /INVALID_REFRESH_TOKEN_FORMAT/);
});

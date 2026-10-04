import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { establishPassword, verifyPassword } from '../../packages/authentication/src/index.js';
import { forbiddenContextWord, localSha1CompromisedChecker,
  rangeApiCompromisedChecker } from '../../packages/authentication/src/password-policy.js';

test('context words normalize Persian and English without unrelated matches', () => {
  assert.equal(forbiddenContextWord('A very long TARGOMAN passphrase', ['targoman']), 'targoman');
  assert.equal(forbiddenContextWord('این یک گذرواژه شرکت نمونه است', ['شركت نمونه']), 'شركت نمونه');
  assert.equal(forbiddenContextWord('این یک گذرواژه مستقل است', ['شركت نمونه']), null);
  assert.equal(forbiddenContextWord('an unrelated passphrase', ['AI']), null);
});

test('local corpus rejects breached passwords, and fails closed when its shard is missing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 't4-breach-'));
  const password = 'a breached but long password';
  const hash = createHash('sha1').update(password).digest('hex').toUpperCase();
  const checker = localSha1CompromisedChecker(directory);
  try {
    await writeFile(join(directory, hash.slice(0, 5)), `${hash.slice(5)}:5\n`);
    await assert.rejects(establishPassword(password, { contextWords: [], compromised: checker }), /COMPROMISED_PASSWORD/);
    await assert.rejects(establishPassword('a different long password', { contextWords: [], compromised: checker }), /BREACH_CHECK_UNAVAILABLE/);
    await assert.rejects(establishPassword('a long targoman password', { contextWords: ['targoman'], compromised: checker }), /CONTEXT_PASSWORD/);
    await assert.rejects(establishPassword('123456789987654321', { contextWords: [], compromised: checker }), /COMMON_PASSWORD/);
    const accepted = 'an adequate unique password 2026';
    const acceptedHash = createHash('sha1').update(accepted).digest('hex').toUpperCase();
    await writeFile(join(directory, acceptedHash.slice(0, 5)), 'A'.repeat(35) + ':2\n');
    const stored = await establishPassword(accepted, { contextWords: [], compromised: checker });
    assert.equal(await verifyPassword(accepted, stored), true);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('range provider requires HTTPS and bounded timeout', () => {
  assert.throws(() => rangeApiCompromisedChecker('http://example.invalid/range', 1000), /INVALID_BREACH_PROVIDER/);
  assert.throws(() => rangeApiCompromisedChecker('https://example.invalid/range', 30_000), /INVALID_BREACH_PROVIDER/);
});

test('range provider transmits only the SHA-1 prefix and fails closed on malformed data', async () => {
  const password = 'another adequate private password';
  const hash = createHash('sha1').update(password).digest('hex').toUpperCase();
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input, options) => {
      assert.equal(String(input), `https://breach.example.invalid/range/${hash.slice(0, 5)}`);
      assert.ok(!String(input).includes(password));
      assert.equal(options?.redirect, 'error');
      return new Response(`${hash.slice(5)}:10\n`, { status: 200 });
    };
    assert.equal(await rangeApiCompromisedChecker('https://breach.example.invalid/range', 500).isCompromised(password), true);
    globalThis.fetch = async () => new Response('not a valid corpus', { status: 200 });
    await assert.rejects(rangeApiCompromisedChecker('https://breach.example.invalid/range', 500).isCompromised(password), /BREACH_CHECK_UNAVAILABLE/);
  } finally { globalThis.fetch = originalFetch; }
});

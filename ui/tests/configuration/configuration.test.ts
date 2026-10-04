import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { clsConfigurationStore, loadConfiguration, parseCjson, redactConfiguration, validateConfiguration } from '../../packages/configuration/src/index.js';

const path = 'deploy/examples/customer-a/platform.cjson';
async function sample(): Promise<Record<string, unknown>> { return parseCjson(await readFile(path, 'utf8')) as Record<string, unknown>; }
function clone<T>(value: T): T { return structuredClone(value); }

test('all customer examples validate with independent fingerprints', async () => {
  const files = ['a', 'b', 'c'].map(x => `deploy/examples/customer-${x}/platform.cjson`);
  const snapshots = await Promise.all(files.map(loadConfiguration));
  assert.equal(new Set(snapshots.map(x => x.fingerprint)).size, 3);
  assert.deepEqual(snapshots.map(x => Object.values(x.value.modules).filter(m => m.enabled).length), [1, 2, 3]);
  assert.equal(snapshots[2]?.value.siem.enabled, true);
  assert.equal(Object.isFrozen(snapshots[0]?.value.ai.endpoints[0]), true);
});

test('CJSON comments do not corrupt string URLs and invalid syntax fails closed', async () => {
  const raw = await readFile(path, 'utf8');
  const commented = `// deployment profile\n${raw.replace('"configVersion": 1,', '"configVersion": 1, /* schema version */')}`;
  assert.match(JSON.stringify(parseCjson(commented)), /http:\/\/model-server:8001/);
  assert.throws(() => parseCjson('{/* unterminated'), /unterminated/);
  assert.throws(() => parseCjson('{ "x": }'), /invalid syntax/);
});

test('unknown keys, inline secrets, weak limits and missing AI capability fail closed', async () => {
  const base = await sample();
  const unknown = clone(base); unknown.sieem = {}; assert.throws(() => validateConfiguration(unknown), /sieem: unknown key/);
  const inline = clone(base); (inline.database as Record<string, unknown>).apiPasswordRef = 'password'; assert.throws(() => validateConfiguration(inline), /database.apiPasswordRef/);
  const limits = clone(base); (limits.admission as Record<string, Record<string, unknown>>).faq!.uploadBytes = 50000001; assert.throws(() => validateConfiguration(limits), /admission.faq.uploadBytes/);
  const capability = clone(base); ((capability.ai as Record<string, unknown>).endpoints as Record<string, unknown>[])[0]!.capabilities = ['SUMMARIZE']; assert.throws(() => validateConfiguration(capability), /modules.translator.enabled/);
});

test('archive processing bounds are validated and default closed', async () => {
  const base = await sample();
  const configured = validateConfiguration(base);
  assert.equal(configured.fileProcessing.archive.maxNesting, 0);
  const unsafe = clone(base);
  (unsafe.fileProcessing as Record<string, unknown>).archive = { maxNesting: 1 };
  assert.throws(() => validateConfiguration(unsafe), /fileProcessing.archive.maxNesting/);
  const bounded = clone(base);
  (bounded.fileProcessing as Record<string, unknown>).archive = { maxEntries: 12, maxTotalUncompressedBytes: 30_000, maxEntryUncompressedBytes: 20_000, maxCompressionRatio: 25, maxNesting: 0 };
  assert.equal(validateConfiguration(bounded).fileProcessing.archive.maxEntries, 12);
});

test('password-only assurance is confined to development and test profiles', async () => {
  const customer = await sample();
  assert.equal(validateConfiguration(customer).security.assuranceProfile, 'CUSTOMER_L3');
  const unsafe = clone(customer);
  unsafe.security = { assuranceProfile: 'DEVELOPMENT_PASSWORD' };
  assert.throws(() => validateConfiguration(unsafe), /password-only assurance is restricted/);
  const development = clone(customer);
  (development.deployment as Record<string, unknown>).id = 'development';
  development.security = { assuranceProfile: 'DEVELOPMENT_PASSWORD' };
  assert.equal(validateConfiguration(development).security.assuranceProfile, 'DEVELOPMENT_PASSWORD');
});

test('enabled SIEM includes canonical Authority decisions', async () => {
  const config = parseCjson(await readFile('deploy/examples/customer-c/platform.cjson', 'utf8')) as Record<string, unknown>;
  assert.ok(validateConfiguration(config).siem.events.includes('authority.decision'));
  const missing = clone(config);
  (missing.siem as Record<string, unknown>).events = ['public.translate.failed'];
  assert.throws(() => validateConfiguration(missing), /authority.decision required/);
});

test('redaction removes secret reference identities from effective output', async () => {
  const config = validateConfiguration(await sample());
  const rendered = JSON.stringify(redactConfiguration(config));
  assert.ok(!rendered.includes('pg-api'));
  assert.ok(rendered.includes('[SECRET_REF]'));
});

test('failed reload retains previous snapshot; startup identity cannot hot change', async () => {
  const dir = await mkdtemp(join(tmpdir(), 't3-config-'));
  try {
    const file = join(dir, 'platform.cjson');
    const initial = await loadConfiguration(path), store = new clsConfigurationStore(initial);
    await writeFile(file, '{invalid');
    await assert.rejects(store.reload(file), /invalid syntax/);
    assert.equal(store.active(), initial);
    const changed = await sample(); (changed.deployment as Record<string, unknown>).id = 'other';
    await writeFile(file, JSON.stringify(changed));
    await assert.rejects(store.reload(file), /startup-only/);
    assert.equal(store.active(), initial);
    const reloadable = await sample(); (reloadable.brand as Record<string, unknown>).displayName = 'Aster Updated';
    await writeFile(file, JSON.stringify(reloadable));
    const next = await store.reload(file);
    assert.equal(store.active(), next);
    assert.notEqual(next.fingerprint, initial.fingerprint);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { clsConfigurationStore, parseCjson, validateConfiguration, type intfConfigurationSnapshot } from '../../packages/configuration/src/index.js';
import { clsAiRouter, exAiRouter, type intfAiRequest, type intfAiRunStore } from '../../packages/ai-router/src/index.js';
import { clsHttpsJsonSiemAdapter, deliverNext, probeSiemReadiness, type intfSiemExportPersistence, type intfClaimedExport, type typDeliveryResult } from '../../packages/security-telemetry/src/worker.js';
import { dictionaryRow, lookupDictionary } from '../../modules/translator/src/persistence.js';

const store: intfAiRunStore = { beginRun: async () => {}, claimEndpointCapacity: async () => true, releaseEndpointCapacity: async () => {}, beginAttempt: async () => {}, finishAttempt: async () => {}, finishRun: async () => {}, activeRun: async () => null };
async function router(): Promise<clsAiRouter> {
  const raw = parseCjson(await readFile('deploy/examples/customer-b/platform.cjson', 'utf8')) as { ai: { endpoints: Array<{ baseUrl: string }> } };
  raw.ai.endpoints[1]!.baseUrl = 'http://model-server:8002';
  const value = validateConfiguration(raw);
  return new clsAiRouter(new clsConfigurationStore({ value, fingerprint: 'test', loadedAt: new Date().toISOString(), source: 'test' } as intfConfigurationSnapshot), store);
}
function aiRequest(requestId: string): intfAiRequest { return { task: 'TRANSLATE', moduleId: 'translator', requestId, correlationId: requestId, deploymentId: 'test', tenantId: 'test', actorKind: 'ANONYMOUS', actorId: null, messages: [{ role: 'user', content: 'hello' }], maxOutputTokens: 10, temperature: 0 }; }

test('readiness distinguishes fallback, complete outage, and restoration', async () => {
  const original = globalThis.fetch;
  const r = await router();
  try {
    globalThis.fetch = async input => new Response(null, { status: String(input).includes('8001') ? 503 : 200 });
    assert.equal((await r.probeReadiness()).status, 'DEGRADED');
    globalThis.fetch = async () => new Response(null, { status: 503 });
    const unavailable = await r.probeReadiness();
    assert.equal(unavailable.status, 'NOT_READY');
    assert.ok(unavailable.unavailableTasks.includes('TRANSLATE'));
    globalThis.fetch = async () => new Response(null, { status: 200 });
    assert.equal((await r.probeReadiness()).status, 'READY');
  } finally { globalThis.fetch = original; }
});

test('readiness excludes open circuits and exhausted capacity', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 200 });
  try {
    const raw = parseCjson(await readFile('deploy/examples/customer-b/platform.cjson', 'utf8')) as { ai: { endpoints: Array<{ maxConcurrent: number }>; tasks: { TRANSLATE: { circuitFailureThreshold: number } } } };
    raw.ai.endpoints.forEach(endpoint => { endpoint.maxConcurrent = 1; });
    raw.ai.tasks.TRANSLATE.circuitFailureThreshold = 1;
    const configuration = new clsConfigurationStore({ value: validateConfiguration(raw), fingerprint: 'test', loadedAt: new Date().toISOString(), source: 'test' });
    const failed = new clsAiRouter(configuration, store, async () => { throw new exAiRouter('PROVIDER_FAILURE', false, 'TEST'); });
    await assert.rejects(failed.run(aiRequest('failed')));
    assert.equal((await failed.probeReadiness()).status, 'NOT_READY');
    let release: () => void = () => {}; let firstStartedResolve: () => void = () => {}; let started: () => void = () => {}; let count = 0;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const firstStarted = new Promise<void>(resolve => { firstStartedResolve = resolve; });
    const bothStarted = new Promise<void>(resolve => { started = resolve; });
    const busy = new clsAiRouter(configuration, store, async () => {
      count += 1; if (count === 1) firstStartedResolve(); if (count === 2) started(); await blocked;
      return { output: 'ok', inputTokens: 1, outputTokens: 1, committed: true };
    });
    const first = busy.run(aiRequest('first'));
    await firstStarted;
    const second = busy.run(aiRequest('second'));
    await bothStarted;
    assert.equal((await busy.probeReadiness()).status, 'NOT_READY');
    release(); await Promise.all([first, second]);
    assert.equal((await busy.probeReadiness()).status, 'READY');
  } finally { globalThis.fetch = original; }
});

test('static capability mismatch fails configuration before readiness', async () => {
  const raw = parseCjson(await readFile('deploy/examples/customer-b/platform.cjson', 'utf8')) as { ai: { endpoints: Array<{ capabilities: string[] }> } };
  raw.ai.endpoints.forEach(endpoint => { endpoint.capabilities = ['SUMMARIZE']; });
  assert.throws(() => validateConfiguration(raw), /no eligible TRANSLATE endpoint/);
});

test('runtime lock excludes MySQL-only dependencies', async () => {
  const lock = JSON.parse(await readFile('deploy/runtime/package-lock.json', 'utf8')) as { packages: Record<string, unknown> };
  assert.ok(!Object.keys(lock.packages).some(path => /node_modules\/(?:mysql|mysql2|knex)(?:\/|$)/.test(path)));
  const dockerfile = await readFile('deploy/customer.Dockerfile', 'utf8');
  assert.ok(!dockerfile.includes('import-dictionary.js'));
});

const claimed: intfClaimedExport = { tex_id: 'export', tex_event__ase_id: 'event', tex_attempt_count: 1, ase_deployment_id: 'd', ase_tenant_id: 't', ase_module_id: 'translator', ase_actor_kind: 'ANONYMOUS', ase_request_id: 'r', ase_correlation_id: 'c', ase_action: 'test', ase_result: 'OK', ase_reason: null, ase_created_at: new Date() };
test('unacknowledged SIEM delivery stays unresolved without receiver guarantee', async () => {
  let final: string | undefined; let retryUnresolved: boolean | undefined;
  const storage: intfSiemExportPersistence = { claim: async (_id, retry) => { retryUnresolved = retry; return claimed; }, finish: async (_row, _result, kind) => { final = kind; } };
  const config = { enabled: true, destinationId: 'soc', url: 'https://example.test', timeoutMs: 1000, maxAttempts: 3, events: [], deliveryGuarantee: 'NONE' as const };
  const unknown = { deliver: async (): Promise<typDeliveryResult> => ({ kind: 'UNKNOWN', errorClass: 'TIMEOUT_UNKNOWN' }) };
  assert.equal(await deliverNext(storage, config, unknown), 'UNKNOWN');
  assert.equal(final, 'UNKNOWN'); assert.equal(retryUnresolved, false);
  assert.equal(await deliverNext(storage, { ...config, deliveryGuarantee: 'IDEMPOTENT' }, unknown), 'RETRY');
  assert.equal(retryUnresolved, true);
  assert.equal(await deliverNext(storage, { ...config, deliveryGuarantee: 'DUPLICATE_TOLERANT' }, unknown), 'RETRY');
  assert.equal(retryUnresolved, true);
});

test('SIEM outage degrades readiness without marking required AI unavailable', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(null, { status: 503 });
    assert.equal(await probeSiemReadiness({ enabled: true, destinationId: 'soc', url: 'https://example.test', timeoutMs: 1000, maxAttempts: 3, events: [], deliveryGuarantee: 'NONE' }), 'DEGRADED');
  } finally { globalThis.fetch = original; }
});

test('SIEM receiver response classes distinguish retryable and permanent errors', async () => {
  const original = globalThis.fetch;
  const config = { enabled: true, destinationId: 'soc', url: 'https://example.test', timeoutMs: 1000, maxAttempts: 3, events: [], deliveryGuarantee: 'NONE' as const };
  const event = { eventId: 'event', deploymentId: 'dep', tenantId: 'tenant', moduleId: 'faq', actorKind: 'ANONYMOUS', requestId: 'request', correlationId: 'corr', action: 'test', result: 'OK', reason: null, occurredAt: new Date().toISOString() };
  const adapter = new clsHttpsJsonSiemAdapter();
  try {
    globalThis.fetch = async () => new Response(null, { status: 503 });
    assert.equal((await adapter.deliver(event, config)).kind, 'RETRY');
    globalThis.fetch = async () => new Response(null, { status: 400 });
    assert.equal((await adapter.deliver(event, config)).kind, 'FAILED');
  } finally { globalThis.fetch = original; }
});

test('dictionary normalization, empty key, canonical payload and lookup order', async () => {
  assert.throws(() => dictionaryRow('JSON_FILE', '', 'خدا', { translations: [] }), /INVALID_DICTIONARY_ROW/);
  assert.throws(() => dictionaryRow('JSON_FILE', 'blank', '   ', { translations: [] }), /INVALID_DICTIONARY_ROW/);
  const row = dictionaryRow('JSON_FILE', 'خدا', ' خدا ', { translations: ['god'], synonyms: null });
  assert.equal(row.lookupKey, 'خدا');
  const queries: { sql: string; params: unknown[] | undefined }[] = [];
  const client = { query: async (sql: string, params?: unknown[]) => { queries.push({ sql, params }); return { rows: [{ trd_phrase: 'خدا', trd_payload: { translations: ['god'], synonyms: null } }] }; } };
  const found = await lookupDictionary(client as never, ' خدا ');
  assert.deepEqual(found?.translations, ['god']);
  assert.deepEqual(queries[0]?.params, ['خدا']);
  assert.match(queries[0]!.sql, /ORDER BY CASE trd_source_kind WHEN 'MYSQL' THEN 0 ELSE 1 END, trd_source_key COLLATE "C"/);
});

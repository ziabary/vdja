import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { clsConfigurationStore, parseCjson, validateConfiguration, type intfConfigurationSnapshot } from '../../packages/configuration/src/index.js';
import { clsAiRouter, exAiRouter, type intfAiRequest, type intfAiRunStore, type intfAttemptRecord, type intfRunFinish, type intfRunStart } from '../../packages/ai-router/src/index.js';
import { createHash } from 'node:crypto';

class MemoryStore implements intfAiRunStore {
  readonly runs: intfRunStart[] = []; readonly attempts: intfAttemptRecord[] = []; readonly finished: intfRunFinish[] = [];
  async beginRun(value: intfRunStart) { this.runs.push(value); }
  async claimEndpointCapacity() { return true; }
  async releaseEndpointCapacity() {}
  async beginAttempt(value: intfAttemptRecord) { this.attempts.push(value); }
  async finishAttempt(value: intfAttemptRecord) { this.attempts.push(value); }
  async finishRun(value: intfRunFinish) { this.finished.push(value); }
  async activeRun() { return null; }
}
async function config(): Promise<clsConfigurationStore> {
  const raw = parseCjson(await readFile('deploy/examples/customer-b/platform.cjson', 'utf8'));
  const value = validateConfiguration(raw);
  const fingerprint = createHash('sha256').update(JSON.stringify(value)).digest('hex');
  return new clsConfigurationStore({ value, fingerprint, loadedAt: new Date().toISOString(), source: 'test' } as intfConfigurationSnapshot);
}
function request(requestId = 'a'.repeat(32)): intfAiRequest { return { task: 'TRANSLATE', moduleId: 'translator', requestId, correlationId: requestId, deploymentId: 'customer-b', tenantId: 'customer-b', actorKind: 'ANONYMOUS', actorId: null, messages: [{ role: 'user', content: 'hello' }], maxOutputTokens: 100, temperature: 0.2 }; }

test('capability and health exclusions precede preference', async () => {
  const router = new clsAiRouter(await config(), new MemoryStore(), async () => ({ output: 'ok', inputTokens: 1, outputTokens: 1, committed: true }));
  router.setHealth('gpu-a', 'UNHEALTHY');
  const reasons = router.reasons('GENERATE_FAQ');
  assert.equal(reasons.find(x => x.endpointId === 'gpu-a')?.status, 'UNHEALTHY');
  assert.equal(reasons.find(x => x.endpointId === 'gpu-b')?.status, 'ELIGIBLE');
});

test('transient failure before visible output fails over and records lineage', async () => {
  const store = new MemoryStore(), selected: string[] = [];
  const router = new clsAiRouter(await config(), store, async (endpoint, _request, _id, emit) => {
    selected.push(endpoint.id);
    if (endpoint.id === 'gpu-a') throw new exAiRouter('PROVIDER_FAILURE', false, 'NETWORK');
    await emit('success'); return { output: 'success', inputTokens: 4, outputTokens: 2, committed: true };
  });
  const output: string[] = [];
  const result = await router.run(request(), delta => { output.push(delta); });
  assert.deepEqual(selected, ['gpu-a', 'gpu-b']);
  assert.deepEqual(output, ['success']);
  assert.equal(result.attempts, 2);
  assert.equal(store.finished[0]?.status, 'SUCCEEDED');
  assert.equal(store.attempts.filter(x => x.status === 'RUNNING').length, 2);
});

test('visible output interruption never silently replays on another endpoint', async () => {
  const store = new MemoryStore(), selected: string[] = [], output: string[] = [];
  const router = new clsAiRouter(await config(), store, async (endpoint, _request, _id, emit) => {
    selected.push(endpoint.id); await emit('partial'); throw new exAiRouter('INTERRUPTED', true, 'STREAM_LOST');
  });
  await assert.rejects(router.run(request(), delta => { output.push(delta); }), error => error instanceof exAiRouter && error.code === 'INTERRUPTED');
  assert.deepEqual(selected, ['gpu-a']); assert.deepEqual(output, ['partial']);
  assert.equal(store.finished[0]?.status, 'INTERRUPTED');
});

test('open circuit excludes an endpoint after configured failures', async () => {
  const store = new MemoryStore();
  const router = new clsAiRouter(await config(), store, async endpoint => { throw new exAiRouter('PROVIDER_FAILURE', false, endpoint.id); });
  for (let i = 0; i < 3; i += 1) await assert.rejects(router.run(request(String(i).padStart(32, 'a'))));
  assert.equal(router.circuitState('gpu-a'), 'OPEN');
  assert.equal(router.reasons('TRANSLATE').find(x => x.endpointId === 'gpu-a')?.status, 'CIRCUIT_OPEN');
});

test('equal-priority endpoints use deterministic weighted selection', async () => {
  const raw = parseCjson(await readFile('deploy/examples/customer-b/platform.cjson', 'utf8')) as Record<string, unknown>;
  const ai = raw.ai as Record<string, unknown>, endpoints = ai.endpoints as Record<string, unknown>[];
  endpoints[0]!.priority = 100; endpoints[0]!.weight = 9;
  endpoints[1]!.priority = 100; endpoints[1]!.weight = 1;
  const value = validateConfiguration(raw), store = new clsConfigurationStore({ value, fingerprint: 'weighted-test', loadedAt: new Date().toISOString(), source: 'test' });
  const selected: string[] = [];
  const router = new clsAiRouter(store, new MemoryStore(), async endpoint => {
    selected.push(endpoint.id); return { output: 'ok', inputTokens: 1, outputTokens: 1, committed: true };
  });
  for (let i = 0; i < 100; i += 1) await router.run(request(`weighted-${String(i).padStart(24, '0')}`));
  const a = selected.filter(id => id === 'gpu-a').length;
  assert.ok(a > 70 && a < 100, `weighted A selected ${a} times`);
  assert.equal(selected.length, 100);
});

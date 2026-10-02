import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { clsConfigurationStore, loadConfiguration, validateConfiguration } from '../../packages/configuration/src/index.js';
import type { intfExecutionContext } from '../../packages/contracts/src/index.js';
import { createTargetPool, withTargetTransaction } from '../../packages/persistence/src/target.js';
import { exAdmission } from '../../packages/admission-control/src/index.js';
import { finishReservation, reserveAdmission } from '../../packages/admission-control/src/persistence.js';
import { recordAudit } from '../../packages/audit/src/persistence.js';
import { createSiemExportPersistence, scheduleSiemExport } from '../../packages/security-telemetry/src/persistence.js';
import { clsHttpsJsonSiemAdapter, deliverNext, type intfSiemAdapter } from '../../packages/security-telemetry/src/worker.js';
import { clsAiRouter, exAiRouter, type intfAiRequest } from '../../packages/ai-router/src/index.js';
import { clsPgAiRunStore } from '../../packages/ai-router/src/persistence.js';
import { recordUsage } from '../../packages/usage/src/persistence.js';

const config = await loadConfiguration('deploy/examples/development/platform.cjson');
const secretRoot = '.secrets.t3.local';
function context(requestId = randomUUID()): intfExecutionContext {
  const suffix = randomUUID().slice(0, 8);
  return { deploymentId: `t3-test-${suffix}`, tenantId: `t3-test-${suffix}`, moduleId: 'translator', requestId,
    correlationId: randomUUID(), actorKind: 'ANONYMOUS', actorId: null, sessionId: null,
    source: 'PUBLIC_API', configFingerprint: config.fingerprint };
}

test('admission is durable across pools and rejects concurrent, duplicate, and rate-limited work', async () => {
  const firstPool = await createTargetPool(config, 'api', secretRoot), secondPool = await createTargetPool(config, 'api', secretRoot);
  try {
    const base = context(), policy = { ...config.value.admission.translator, concurrent: 1, requestsPerMinute: 2, dailyRequests: 3 };
    const second = { ...base, requestId: randomUUID() }, third = { ...base, requestId: randomUUID() };
    const reservation = await reserveAdmission(firstPool, base, policy, 10, 0, 10);
    await assert.rejects(reserveAdmission(secondPool, base, policy, 10, 0, 10), (error: unknown) => error instanceof exAdmission && error.code === 'CONCURRENCY_CONFLICT');
    await assert.rejects(reserveAdmission(secondPool, second, policy, 10, 0, 10), (error: unknown) => error instanceof exAdmission && error.code === 'CAPACITY_EXHAUSTED');
    await withTargetTransaction(firstPool, { actorKind: 'ANONYMOUS', actorId: null, correlationId: base.correlationId, source: 'test' }, tx => finishReservation(tx, reservation.id, 'SETTLED'));
    const next = await reserveAdmission(secondPool, second, policy, 10, 0, 10);
    await withTargetTransaction(secondPool, { actorKind: 'ANONYMOUS', actorId: null, correlationId: second.correlationId, source: 'test' }, tx => finishReservation(tx, next.id, 'SETTLED'));
    await assert.rejects(reserveAdmission(firstPool, third, policy, 10, 0, 10), (error: unknown) => error instanceof exAdmission && error.code === 'RATE_LIMITED');
  } finally { await firstPool.end(); await secondPool.end(); }
});

test('admission enforces input and token bounds, releases, and recovers stale reservations', async () => {
  const pool = await createTargetPool(config, 'api', secretRoot);
  try {
    const base = context(), policy = { ...config.value.admission.translator, concurrent: 2, tokenBudget: 100 };
    await assert.rejects(reserveAdmission(pool, base, policy, policy.inputChars + 1, 0, 0),
      (error: unknown) => error instanceof exAdmission && error.code === 'INPUT_LIMIT_EXCEEDED');
    const first = await reserveAdmission(pool, base, policy, 5, 0, 100);
    const second = { ...base, requestId: randomUUID() };
    await assert.rejects(reserveAdmission(pool, second, policy, 5, 0, 1),
      (error: unknown) => error instanceof exAdmission && error.code === 'QUOTA_EXCEEDED');
    await withTargetTransaction(pool, { actorKind: 'ANONYMOUS', actorId: null, correlationId: base.correlationId, source: 'test' },
      tx => finishReservation(tx, first.id, 'RELEASED'));
    const released = await reserveAdmission(pool, second, policy, 5, 0, 100);
    await withTargetTransaction(pool, { actorKind: 'ANONYMOUS', actorId: null, correlationId: base.correlationId, source: 'test' },
      tx => tx.query("UPDATE admission.tbl_adm_reservation SET adr_expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE adr_id = $1", [released.id]));
    const third = { ...base, requestId: randomUUID() };
    const recovered = await reserveAdmission(pool, third, policy, 5, 0, 100);
    const old = await pool.query('SELECT adr_state FROM admission.tbl_adm_reservation WHERE adr_id = $1', [released.id]);
    assert.equal(old.rows[0]?.adr_state, 'EXPIRED');
    await withTargetTransaction(pool, { actorKind: 'ANONYMOUS', actorId: null, correlationId: base.correlationId, source: 'test' },
      tx => finishReservation(tx, recovered.id, 'SETTLED'));
  } finally { await pool.end(); }
});

test('SIEM export survives retry, retains safe envelope, and settles once', async () => {
  const api = await createTargetPool(config, 'api', secretRoot), worker = await createTargetPool(config, 'worker', secretRoot);
  try {
    const ctx = context(), destinationId = `test-${randomUUID().slice(0, 8)}`;
    const siem = { ...config.value.siem, enabled: true, destinationId, url: 'https://example.invalid/ingest',
      events: ['public.translate.completed'], maxAttempts: 3 };
    const eventId = await withTargetTransaction(api, { actorKind: 'ANONYMOUS', actorId: null, correlationId: ctx.correlationId, source: 'test' }, async tx => {
      const id = await recordAudit(tx, ctx, 'public.translate.completed', 'SUCCEEDED');
      await scheduleSiemExport(tx, id, 'public.translate.completed', siem);
      return id;
    });
    let calls = 0;
    const adapter: intfSiemAdapter = { async deliver(event) {
      calls += 1;
      assert.equal(event.eventId, eventId);
      assert.equal(event.actorKind, 'ANONYMOUS');
      assert.equal(event.requestId, ctx.requestId);
      assert.deepEqual(Object.keys(event).sort(), ['action','actorKind','correlationId','deploymentId','eventId','moduleId','occurredAt','reason','requestId','result','tenantId'].sort());
      return calls === 1 ? { kind: 'RETRY', errorClass: 'HTTP_503' } : { kind: 'DELIVERED', ack: 'accepted' };
    } };
    const storage = createSiemExportPersistence(worker);
    assert.equal(await deliverNext(storage, siem, adapter), 'RETRY');
    await withTargetTransaction(worker, { actorKind: 'PLATFORM_SERVICE', actorId: 'test', correlationId: ctx.correlationId, source: 'test' },
      tx => tx.query("UPDATE telemetry.tbl_tel_export SET tex_next_attempt_at = CURRENT_TIMESTAMP WHERE tex_event__ase_id = $1", [eventId]));
    assert.equal(await deliverNext(storage, siem, adapter), 'DELIVERED');
    assert.equal(await deliverNext(storage, siem, adapter), 'EMPTY');
    const state = await worker.query('SELECT tex_status, tex_attempt_count, tex_ack FROM telemetry.tbl_tel_export WHERE tex_event__ase_id = $1', [eventId]);
    assert.deepEqual(state.rows[0], { tex_status: 'DELIVERED', tex_attempt_count: 2, tex_ack: 'accepted' });
  } finally { await api.end(); await worker.end(); }
});

test('local SIEM receiver proves HTTP delivery, idempotency, outage retry, and worker recovery', async () => {
  const received: Array<{ key: string | undefined; body: unknown }> = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    received.push({ key: request.headers['idempotency-key'], body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown });
    response.statusCode = received.length === 1 ? 503 : 200;
    response.setHeader('X-Event-Ack', 'local-receiver-ack');
    response.end();
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const api = await createTargetPool(config, 'api', secretRoot);
  const worker = await createTargetPool(config, 'worker', secretRoot);
  try {
    const ctx = context(), destinationId = `receiver-${randomUUID().slice(0, 8)}`;
    const siem = { ...config.value.siem, enabled: true, destinationId,
      url: `http://127.0.0.1:${address.port}/ingest`, events: ['public.translate.completed'], maxAttempts: 3 };
    const eventId = await withTargetTransaction(api, { actorKind: 'ANONYMOUS', actorId: null, correlationId: ctx.correlationId, source: 'test' }, async tx => {
      const id = await recordAudit(tx, ctx, 'public.translate.completed', 'SUCCEEDED');
      await scheduleSiemExport(tx, id, 'public.translate.completed', siem);
      return id;
    });
    assert.equal(await deliverNext(createSiemExportPersistence(worker), siem, new clsHttpsJsonSiemAdapter()), 'RETRY');
    await withTargetTransaction(worker, { actorKind: 'PLATFORM_SERVICE', actorId: 'test', correlationId: ctx.correlationId, source: 'test' },
      tx => tx.query("UPDATE telemetry.tbl_tel_export SET tex_next_attempt_at = CURRENT_TIMESTAMP WHERE tex_event__ase_id = $1", [eventId]));
    assert.equal(await deliverNext(createSiemExportPersistence(worker), siem, new clsHttpsJsonSiemAdapter()), 'DELIVERED');
    assert.equal(received.length, 2);
    assert.deepEqual(received.map(item => item.key), [eventId, eventId]);
    assert.deepEqual(received[0]?.body, received[1]?.body);
    const body = received[0]?.body as Record<string, unknown>;
    assert.equal(body.actorKind, 'ANONYMOUS');
    assert.deepEqual(Object.keys(body).sort(), ['action','actorKind','correlationId','deploymentId','eventId','moduleId','occurredAt','reason','requestId','result','tenantId'].sort());
    const state = await worker.query('SELECT tex_status, tex_ack FROM telemetry.tbl_tel_export WHERE tex_event__ase_id = $1', [eventId]);
    assert.deepEqual(state.rows[0], { tex_status: 'DELIVERED', tex_ack: 'local-receiver-ack' });
  } finally {
    await api.end(); await worker.end();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('AI endpoint capacity is shared across Router instances and releases after completion', async () => {
  const firstPool = await createTargetPool(config, 'api', secretRoot), secondPool = await createTargetPool(config, 'api', secretRoot);
  try {
    const raw: unknown = structuredClone(config.value);
    const endpoints = (raw as { ai: { endpoints: Array<{ maxConcurrent: number; enabled: boolean }> } }).ai.endpoints;
    endpoints[0]!.maxConcurrent = 1;
    const snapshot = { ...config, value: validateConfiguration(raw), fingerprint: `capacity-${randomUUID()}` };
    let startedResolve: () => void = () => {}, releaseResolve: () => void = () => {};
    const started = new Promise<void>(resolve => { startedResolve = resolve; });
    const release = new Promise<void>(resolve => { releaseResolve = resolve; });
    const firstRouter = new clsAiRouter(new clsConfigurationStore(snapshot), new clsPgAiRunStore(firstPool), async () => {
      startedResolve(); await release; return { output: 'ok', inputTokens: 1, outputTokens: 1, committed: true };
    });
    const secondRouter = new clsAiRouter(new clsConfigurationStore(snapshot), new clsPgAiRunStore(secondPool), async () => {
      assert.fail('provider must not run after distributed capacity denial');
    });
    const base = context();
    const request = (requestId: string): intfAiRequest => ({ task: 'TRANSLATE', moduleId: 'translator', requestId,
      correlationId: base.correlationId, deploymentId: base.deploymentId, tenantId: base.tenantId, actorKind: 'ANONYMOUS',
      actorId: null, messages: [{ role: 'user', content: 'hello' }], maxOutputTokens: 20, temperature: 0.2 });
    const first = firstRouter.run(request(randomUUID()));
    await started;
    await assert.rejects(secondRouter.run(request(randomUUID())),
      (error: unknown) => error instanceof exAiRouter && error.safeClass === 'CAPACITY_EXHAUSTED');
    releaseResolve();
    assert.equal((await first).status, 'SUCCEEDED');
    const active = await firstPool.query<{ count: string }>(`SELECT COUNT(*) AS count FROM ai_router.tbl_air_run
      WHERE air_deployment_id = $1 AND air_capacity_expires_at > CURRENT_TIMESTAMP`, [base.deploymentId]);
    assert.equal(Number(active.rows[0]?.count), 0);
  } finally { await firstPool.end(); await secondPool.end(); }
});

test('duplicate usage settlement is counted once by stable run identity', async () => {
  const pool = await createTargetPool(config, 'api', secretRoot);
  try {
    const ctx = context(), runId = randomUUID(), facts = { runId, inputChars: 42, uploadedBytes: 0, inputTokens: 7, outputTokens: 3, providerMs: 12 };
    const mutation = { actorKind: 'ANONYMOUS', actorId: null, correlationId: ctx.correlationId, source: 'test' };
    assert.equal(await withTargetTransaction(pool, mutation, tx => recordUsage(tx, ctx, facts)), true);
    assert.equal(await withTargetTransaction(pool, mutation, tx => recordUsage(tx, ctx, facts)), false);
    const result = await pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM usage.tbl_usg_consumption WHERE usg_run_id = $1', [runId]);
    assert.equal(Number(result.rows[0]?.count), 1);
  } finally { await pool.end(); }
});

import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createPublicApi } from '../../apps/api/src/index.js';
import { hashPassword } from '../../packages/authentication/src/index.js';
import { loadConfiguration, parseCjson } from '../../packages/configuration/src/index.js';
import { createTargetPool, withTargetTransaction } from '../../packages/persistence/src/target.js';
import { createSiemExportPersistence } from '../../packages/security-telemetry/src/persistence.js';
import { deliverNext, type intfExportEnvelope } from '../../packages/security-telemetry/src/worker.js';

const configPath = process.env.T4_PG_CONFIG;
const sourceSecrets = process.env.T4_SECRETS_DIR;
if (process.env.T4_REQUIRE_LIVE === '1' && (!configPath || !sourceSecrets)) throw new Error('T4_LIVE_AUTH_CONFIG_REQUIRED');

test('HTTP login, Origin, refresh replay, concurrent refresh, logout and disabled Auth',
  { skip: !configPath || !sourceSecrets }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 't4-auth-http-'));
    let server: import('node:http').Server | undefined;
    let closeRuntime: (() => Promise<void>) | undefined;
    let migration: Awaited<ReturnType<typeof createTargetPool>> | undefined;
    let worker: Awaited<ReturnType<typeof createTargetPool>> | undefined;
    const identityId = randomUUID(), membershipId = randomUUID();
    const email = `${identityId}@example.invalid`, address = '127.0.0.1';
    const guardHash = (label: string, value: string) => createHash('sha256').update(label).update('\0').update(value).digest('hex');
    try {
      for (const file of ['pg-api', 'pg-worker', 'pg-migration'])
        await copyFile(join(sourceSecrets!, file), join(directory, file));
      const pair = generateKeyPairSync('ed25519');
      await writeFile(join(directory, 'access-private'), pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
      await writeFile(join(directory, 'access-public'), pair.publicKey.export({ type: 'spki', format: 'pem' }), { mode: 0o600 });
      const base = parseCjson(await readFile(configPath!, 'utf8')) as Record<string, unknown>;
      const authenticatedAdmission = Object.fromEntries(Object.entries(base.admission as Record<string, Record<string, number>>)
        .map(([module, policy]) => [module, { ...policy, inputChars: Math.min(2_000_000, policy.inputChars! * 2),
          uploadBytes: policy.uploadBytes, outputTokens: module === 'faq' ? 40000 : 4000,
          requestsPerMinute: policy.requestsPerMinute! * 2, concurrent: policy.concurrent! * 2 }]));
      const privilegedAdmission = Object.fromEntries(Object.entries(authenticatedAdmission as Record<string, Record<string, number>>)
        .map(([module, policy]) => [module, { ...policy, inputChars: Math.min(2_000_000, policy.inputChars! * 2),
          outputTokens: module === 'faq' ? 80000 : 8000, requestsPerMinute: policy.requestsPerMinute! * 2,
          concurrent: policy.concurrent! * 2 }]));
      const auth = { enabled: true, issuer: 'https://auth.example.invalid', audience: 'targoman-api', accessTokenSeconds: 300,
        activeKid: 'v1', privateKeyRef: 'file:/run/secrets/access-private',
        session: { absoluteLifetimeSeconds: 2592000, refreshLifetimeSeconds: 604800, inactivityLifetimeSeconds: 604800 },
        authenticatedAdmission,
        privilegedAdmission,
        publicKeys: [{ kid: 'v1', publicKeyRef: 'file:/run/secrets/access-public' }] };
      const siem = { ...(base.siem as Record<string, unknown>), enabled: true,
        destinationId: `t4-auth-${identityId.slice(0, 8)}`, url: 'https://siem.example.invalid/ingest',
        deliveryGuarantee: 'IDEMPOTENT', events: ['authentication.failed', 'authentication.success',
          'session.created', 'session.refreshed', 'session.refresh_replay_detected', 'session.revoked', 'session.logout'] };
      const enabledConfig = join(directory, 'enabled.cjson');
      await writeFile(enabledConfig, JSON.stringify({ ...base, auth, siem }));
      const snapshot = await loadConfiguration(enabledConfig);
      migration = await createTargetPool(snapshot, 'migration', directory);
      worker = await createTargetPool(snapshot, 'worker', directory);
      await withTargetTransaction(migration, { actorKind: 'PLATFORM_SERVICE', actorId: 't4-auth-http-test',
        correlationId: randomUUID(), source: 't4-auth-http-fixture' }, async tx => {
        await tx.query(`INSERT INTO identity.tbl_idn_identity
          (idn_id,idn_kind,idn_display_name,idn_email_normalized) VALUES ($1,'HUMAN','T4 HTTP test',$2)`, [identityId, email]);
        await tx.query(`INSERT INTO identity.tbl_idn_membership
          (idm_id,idm_identity__idn_id,idm_tenant_id) VALUES ($1,$2,$3)`,
        [membershipId, identityId, snapshot.value.deployment.tenantId]);
        await tx.query(`INSERT INTO authentication.tbl_ath_password_credential
          (apc_identity__idn_id,apc_password_hash) VALUES ($1,$2)`,
        [identityId, await hashPassword('an adequate live test passphrase 2026')]);
      });
      const runtime = await createPublicApi(snapshot, directory);
      closeRuntime = runtime.close;
      server = await new Promise<import('node:http').Server>(resolve => {
        const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener));
      });
      const addressInfo = server.address();
      if (!addressInfo || typeof addressInfo === 'string') throw new Error('INVALID_TEST_ADDRESS');
      const url = `http://127.0.0.1:${addressInfo.port}`;
      const origin = snapshot.value.http.allowedOrigins[0]!;
      const preflight = (requestOrigin: string | undefined, method = 'POST', headers = 'content-type') =>
        fetch(`${url}/api/auth/refresh`, { method: 'OPTIONS', headers: {
          ...(requestOrigin ? { origin: requestOrigin } : {}),
          'access-control-request-method': method, 'access-control-request-headers': headers
        } });
      const allowedPreflight = await preflight(origin);
      assert.equal(allowedPreflight.status, 204);
      assert.equal(allowedPreflight.headers.get('access-control-allow-origin'), origin);
      assert.equal(allowedPreflight.headers.get('access-control-allow-credentials'), 'true');
      assert.equal(allowedPreflight.headers.get('vary'), 'Origin');
      assert.equal((await preflight('https://evil.example.invalid')).status, 403);
      assert.equal((await preflight(undefined)).status, 403);
      assert.equal((await preflight('not-an-origin')).status, 403);
      assert.equal((await preflight(origin, 'DELETE')).status, 403);
      assert.equal((await preflight(origin, 'POST', 'x-unapproved-header')).status, 403);
      const post = (path: string, body: unknown, cookie?: string, requestOrigin = origin) => fetch(`${url}/api/auth/${path}`,
        { method: 'POST', headers: { origin: requestOrigin, 'content-type': 'application/json',
          ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
      const login = async () => {
        const response = await post('login', { email, password: 'an adequate live test passphrase 2026' });
        assert.equal(response.status, 200);
        const body = await response.json() as { accessToken: string; tenantId: string };
        const cookie = response.headers.get('set-cookie') ?? '';
        assert.match(cookie, /^__Secure-tg_refresh=[A-Za-z0-9_-]{43}; HttpOnly; Secure; SameSite=Strict; Path=\/api\/auth$/);
        assert.equal(body.tenantId, snapshot.value.deployment.tenantId);
        return { accessToken: body.accessToken, cookie: cookie.split(';')[0]! };
      };
      assert.equal((await post('login', { email, password: 'wrong' })).status, 401);
      const first = await login();
      const me = (token: string) => fetch(`${url}/api/auth/me`, { headers: { authorization: `Bearer ${token}` } });
      assert.equal((await me(first.accessToken)).status, 200);
      const duplicate = `${first.cookie}; __Secure-tg_refresh=invalid`;
      const rejectedDuplicate = await post('refresh', {}, duplicate);
      assert.equal(rejectedDuplicate.status, 400);
      assert.equal(rejectedDuplicate.headers.get('access-control-allow-credentials'), 'true');
      assert.equal((await post('logout', {}, duplicate)).status, 400);
      assert.equal((await me(first.accessToken)).status, 200);
      assert.equal((await post('refresh', {}, first.cookie, 'https://evil.example.invalid')).status, 403);
      assert.equal((await fetch(`${url}/api/auth/refresh`, { method: 'POST', headers: { cookie: first.cookie } })).status, 403);
      const rotatedResponse = await post('refresh', {}, first.cookie);
      assert.equal(rotatedResponse.status, 200);
      const rotated = await rotatedResponse.json() as { accessToken: string };
      const secondCookie = (rotatedResponse.headers.get('set-cookie') ?? '').split(';')[0]!;
      assert.notEqual(secondCookie, first.cookie);
      assert.equal((await post('refresh', {}, first.cookie)).status, 401);
      assert.equal((await me(first.accessToken)).status, 401);
      assert.equal((await me(rotated.accessToken)).status, 401);
      assert.equal((await post('refresh', {}, secondCookie)).status, 401);
      const concurrent = await login();
      const race = await Promise.all([post('refresh', {}, concurrent.cookie), post('refresh', {}, concurrent.cookie)]);
      assert.deepEqual(race.map(response => response.status).sort(), [200, 401]);
      assert.equal((await me(concurrent.accessToken)).status, 401);
      const logout = await login();
      assert.equal((await post('logout', {}, logout.cookie)).status, 204);
      assert.equal((await me(logout.accessToken)).status, 401);
      const securityEvents = await migration.query<{ ase_action: string; ase_actor_kind: string; ase_session_id: string | null }>(
        `SELECT ase_action,ase_actor_kind,ase_session_id FROM audit.tbl_aud_semantic_event
         WHERE ase_actor_id = $1 AND ase_module_id IN ('authentication','session')`, [identityId]);
      for (const action of ['authentication.success','session.created','session.refreshed',
        'session.refresh_replay_detected','session.revoked','session.logout'])
        assert.ok(securityEvents.rows.some(event => event.ase_action === action && event.ase_actor_kind === 'HUMAN' && event.ase_session_id), action);
      const exported: intfExportEnvelope[] = [];
      for (;;) {
        const outcome = await deliverNext(createSiemExportPersistence(worker), snapshot.value.siem,
          { deliver: async event => { exported.push(event); return { kind: 'DELIVERED', ack: 't4-test-ack' }; } });
        if (outcome === 'EMPTY') break;
        assert.equal(outcome, 'DELIVERED');
      }
      for (const action of ['authentication.failed','session.refresh_replay_detected','session.revoked','session.logout'])
        assert.ok(exported.some(event => event.action === action), action);
      assert.ok(exported.filter(event => event.actorKind === 'HUMAN').every(event => event.actorId === identityId && event.sessionId));
      const malformed = await fetch(`${url}/api/auth/me`, { headers: { authorization: 'Bearer bad' } });
      assert.equal(malformed.status, 401);
      const disabledConfig = join(directory, 'disabled.cjson');
      await writeFile(disabledConfig, JSON.stringify({ ...base, auth: { enabled: false } }));
      const disabled = await createPublicApi(await loadConfiguration(disabledConfig), directory);
      const disabledServer = await new Promise<import('node:http').Server>(resolve => {
        const listener = disabled.app.listen(0, '127.0.0.1', () => resolve(listener));
      });
      try {
        const disabledAddress = disabledServer.address();
        if (!disabledAddress || typeof disabledAddress === 'string') throw new Error('INVALID_TEST_ADDRESS');
        const denied = await fetch(`http://127.0.0.1:${disabledAddress.port}/api/auth/login`,
          { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'wrong' }) });
        assert.equal(denied.status, 404);
        assert.equal(denied.headers.get('set-cookie'), null);
      } finally {
        await new Promise<void>(resolve => disabledServer.close(() => resolve()));
        await disabled.close();
      }
    } finally {
      if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
      if (closeRuntime) await closeRuntime();
      if (worker) await worker.end();
      if (migration) {
        try {
          await withTargetTransaction(migration, { actorKind: 'PLATFORM_SERVICE', actorId: 't4-auth-http-test',
            correlationId: randomUUID(), source: 't4-auth-http-cleanup' }, async tx => {
            await tx.query(`DELETE FROM session_core.tbl_ses_refresh_token WHERE srt_session__ses_id IN
              (SELECT ses_id FROM session_core.tbl_ses_session WHERE ses_identity__idn_id = $1)`, [identityId]);
            await tx.query(`DELETE FROM session_core.tbl_ses_session WHERE ses_identity__idn_id = $1`, [identityId]);
            await tx.query(`DELETE FROM authentication.tbl_ath_login_guard WHERE alg_key_sha256 = ANY($1::char(64)[])`,
              [[guardHash('account', email), guardHash('address', address)]]);
            await tx.query(`DELETE FROM authentication.tbl_ath_password_credential WHERE apc_identity__idn_id = $1`, [identityId]);
            await tx.query(`DELETE FROM identity.tbl_idn_membership WHERE idm_id = $1`, [membershipId]);
            await tx.query(`DELETE FROM identity.tbl_idn_identity WHERE idn_id = $1`, [identityId]);
          });
        } finally { await migration.end(); }
      }
      await rm(directory, { recursive: true, force: true });
    }
  });

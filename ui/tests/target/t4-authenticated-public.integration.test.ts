import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { request as httpRequest } from 'node:http';
import { Readable } from 'node:stream';
import { createServer as createNetServer } from 'node:net';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createPublicApi } from '../../apps/api/src/index.js';
import { hashPassword } from '../../packages/authentication/src/index.js';
import { loadConfiguration, parseCjson } from '../../packages/configuration/src/index.js';
import { createTargetPool, withTargetTransaction } from '../../packages/persistence/src/target.js';
import { reserveAdmission } from '../../packages/admission-control/src/persistence.js';
import { exAdmission } from '../../packages/admission-control/src/index.js';
import { validateConfiguration, type intfAdmissionPolicy, type typModuleId } from '../../packages/configuration/src/index.js';
import { createSiemExportPersistence } from '../../packages/security-telemetry/src/persistence.js';
import { deliverNext, type intfExportEnvelope } from '../../packages/security-telemetry/src/worker.js';

const configPath = process.env.T4_PG_CONFIG;
const sourceSecrets = process.env.T4_SECRETS_DIR;
if (process.env.T4_REQUIRE_LIVE === '1' && (!configPath || !sourceSecrets)) throw new Error('T4_LIVE_PUBLIC_CONFIG_REQUIRED');
const PASSWORD = 'a long distinct integration passphrase 2026';
const hostFetch: typeof globalThis.fetch = async (input, init) => new Promise<Response>((resolve, reject) => {
  const normalized = new Request(String(input), init);
  const headers = new Headers(normalized.headers);
  const supplied = new Headers(init?.headers);
  if (supplied.has('host')) headers.set('host', supplied.get('host')!);
  const client = httpRequest(String(input), { method: normalized.method, headers: Object.fromEntries(headers) }, response => {
    const chunks: Buffer[] = [];
    response.on('data', (chunk: Buffer) => chunks.push(chunk));
    response.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: response.statusCode ?? 500,
      headers: new Headers(response.headers as Record<string, string>) })));
  });
  client.on('error', reject);
  if (normalized.body) Readable.fromWeb(normalized.body).pipe(client);
  else client.end();
});

test('real authenticated public requests use tenant-scoped Authority and produce HUMAN evidence',
  { skip: !configPath || !sourceSecrets }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 't4-authenticated-public-'));
    const suffix = randomUUID().slice(0, 8);
    const tenantA = `t4-a-${suffix}`, tenantB = `t4-b-${suffix}`;
    const identities = { a: randomUUID(), b: randomUUID(), both: randomUUID() };
    const memberships = { a: randomUUID(), b: randomUUID(), bothA: randomUUID(), bothB: randomUUID() };
    const grants = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    let apiServer: Server | undefined, provider: Server | undefined;
    let imageProcess: ChildProcess | undefined;
    const imageName = `t4-customer-smoke-${suffix}`;
    let closeRuntime: (() => Promise<void>) | undefined;
    let migration: Awaited<ReturnType<typeof createTargetPool>> | undefined;
    let apiPool: Awaited<ReturnType<typeof createTargetPool>> | undefined;
    let workerPool: Awaited<ReturnType<typeof createTargetPool>> | undefined;
    const providerBudgets: number[] = [];
    try {
      for (const file of ['pg-api', 'pg-worker', 'pg-migration']) await copyFile(join(sourceSecrets!, file), join(directory, file));
      const pair = generateKeyPairSync('ed25519');
      await writeFile(join(directory, 'access-private'), pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
      await writeFile(join(directory, 'access-public'), pair.publicKey.export({ type: 'spki', format: 'pem' }), { mode: 0o600 });
      provider = createServer(async (request, response) => {
        if (request.url === '/health') { response.writeHead(200).end(); return; }
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const input = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { input: readonly { content: string }[]; max_output_tokens: number };
        providerBudgets.push(input.max_output_tokens);
        const answer = input.input[0]?.content.includes('Generate grounded FAQs')
          ? '[{"question":"What?","answer":"Answer."}]'
          : input.input[0]?.content.includes('summarization') ? 'A summary.' : 'A translation.';
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.end(`data: ${JSON.stringify({ delta: answer, usage: { input_tokens: 9, output_tokens: 4 } })}\n\ndata: [DONE]\n\n`);
      });
      await new Promise<void>(resolve => provider!.listen(0, '127.0.0.1', resolve));
      const providerAddress = provider.address();
      assert.ok(providerAddress && typeof providerAddress !== 'string');
      const socket = createNetServer();
      await new Promise<void>(resolve => socket.listen(0, '127.0.0.1', resolve));
      const socketAddress = socket.address(); assert.ok(socketAddress && typeof socketAddress !== 'string');
      const imagePort = socketAddress.port;
      await new Promise<void>(resolve => socket.close(() => resolve()));
      const base = parseCjson(await readFile(configPath!, 'utf8')) as Record<string, unknown>;
      const baseAi = base.ai as Record<string, unknown>;
      const endpoints = baseAi.endpoints as Record<string, unknown>[];
      const anonymousAdmission = Object.fromEntries(Object.entries(base.admission as Record<string, Record<string, number>>)
        .map(([module, policy]) => [module, { ...policy,
          inputChars: module === 'translator' ? 20 : module === 'summarizer' ? 50 : 128,
          uploadBytes: module === 'translator' ? 32 : module === 'summarizer' ? 80 : 200,
          outputTokens: 16 }]));
      const authenticatedAdmission = Object.fromEntries(Object.entries(anonymousAdmission as Record<string, Record<string, number>>)
        .map(([module, policy]) => [module, { ...policy, inputChars: policy.inputChars! * 2,
          uploadBytes: policy.uploadBytes! * 2, outputTokens: 32,
          requestsPerMinute: policy.requestsPerMinute! * 2, concurrent: policy.concurrent! * 2 }]));
      const privilegedAdmission = Object.fromEntries(Object.entries(authenticatedAdmission as Record<string, Record<string, number>>)
        .map(([module, policy]) => [module, { ...policy, inputChars: policy.inputChars! * 2,
          uploadBytes: policy.uploadBytes! * 2, outputTokens: 64,
          requestsPerMinute: policy.requestsPerMinute! * 2, concurrent: policy.concurrent! * 2 }]));
      const auth = { enabled: true, issuer: 'https://auth.example.invalid', publicOrigin: 'https://auth.example.invalid',
        allowedApplicationOrigins: ['https://app.example.invalid'], audience: 'targoman-api', accessTokenSeconds: 300,
        activeKid: 'v1', privateKeyRef: 'file:/run/secrets/access-private',
        session: { absoluteLifetimeSeconds: 2592000, refreshLifetimeSeconds: 604800, inactivityLifetimeSeconds: 604800 },
        password: { contextWords: [], compromised: { kind: 'LOCAL_SHA1', directory: '/tmp/t4-breach-fixture' } },
        authenticatedAdmission,
        privilegedAdmission,
        publicKeys: [{ kid: 'v1', publicKeyRef: 'file:/run/secrets/access-public' }] };
      const siem = { ...(base.siem as Record<string, unknown>), enabled: true,
        destinationId: `t4-public-${suffix}`, url: 'https://siem.example.invalid/ingest',
        deliveryGuarantee: 'IDEMPOTENT', events: ['authority.decision', 'authority.denied', 'tenant.mismatch',
          'public.translate.completed', 'public.summarize.completed', 'public.faq.generate.completed'] };
      const configured = join(directory, 'platform.cjson');
      await writeFile(configured, JSON.stringify({ ...base,
        deployment: { ...(base.deployment as Record<string, unknown>), tenantId: `t4-anon-${suffix}` },
        web: { publicOrigin: 'https://app.example.invalid' },
        http: { ...(base.http as Record<string, unknown>), apiPort: imagePort, allowedOrigins: ['https://app.example.invalid'] },
        auth, siem, admission: anonymousAdmission, ai: { ...baseAi,
        endpoints: endpoints.map(endpoint => ({ ...endpoint, baseUrl: `http://127.0.0.1:${providerAddress.port}` })) } }));
      const snapshot = await loadConfiguration(configured);
      migration = await createTargetPool(snapshot, 'migration', directory);
      apiPool = await createTargetPool(snapshot, 'api', directory);
      workerPool = await createTargetPool(snapshot, 'worker', directory);
      await withTargetTransaction(migration, { actorKind: 'PLATFORM_SERVICE', actorId: 't4-public-test',
        correlationId: randomUUID(), source: 't4-public-fixture' }, async tx => {
        for (const [key, id] of Object.entries(identities)) {
          await tx.query(`INSERT INTO identity.tbl_idn_identity
            (idn_id,idn_kind,idn_display_name,idn_email_normalized) VALUES ($1,'HUMAN',$2,$3)`,
          [id, `T4 ${key}`, `${id}@example.invalid`]);
          await tx.query(`INSERT INTO authentication.tbl_ath_password_credential
            (apc_identity__idn_id,apc_password_hash) VALUES ($1,$2)`, [id, await hashPassword(PASSWORD)]);
        }
        for (const [membershipId, identityId, tenantId] of [
          [memberships.a, identities.a, tenantA], [memberships.b, identities.b, tenantB],
          [memberships.bothA, identities.both, tenantA], [memberships.bothB, identities.both, tenantB]
        ]) await tx.query(`INSERT INTO identity.tbl_idn_membership
          (idm_id,idm_identity__idn_id,idm_tenant_id) VALUES ($1,$2,$3)`, [membershipId, identityId, tenantId]);
        const privilegeA = { PublicTools: { translator: { use: true, limitTier: 'AUTHENTICATED' },
          summarizer: { use: true, limitTier: 'AUTHENTICATED' } } };
        const privilegeB = { PublicTools: { faq: { use: true, limitTier: 'AUTHENTICATED' } } };
        const privilegePrivileged = { PublicTools: { translator: { use: true, limitTier: 'PRIVILEGED' },
          summarizer: { use: true, limitTier: 'PRIVILEGED' }, faq: { use: true, limitTier: 'PRIVILEGED' } } };
        for (const [index, identityId, tenantId, privilege] of [
          [0, identities.a, tenantA, privilegePrivileged], [1, identities.b, tenantB, privilegeB],
          [2, identities.both, tenantA, privilegeA], [3, identities.both, tenantB, privilegeB]
        ] as const) await tx.query(`INSERT INTO authority.tbl_aut_grant
          (aug_id,aug_tenant_id,aug_identity__idn_id,aug_privileges) VALUES ($1,$2,$3,$4::jsonb)`,
          [grants[index], tenantId, identityId, JSON.stringify(privilege)]);
      });
      let root: string;
      if (process.env.T4_CUSTOMER_IMAGE) {
        const mysqlState = execFileSync('docker', ['inspect', '-f', '{{.State.Running}}',
          process.env.T4_MYSQL_CONTAINER ?? 'docker-mysql-1'], { encoding: 'utf8' }).trim();
        assert.equal(mysqlState, 'false', 'MySQL container must be stopped during the image test');
        const output: Buffer[] = [];
        imageProcess = spawn('docker', ['run', '--rm', '--network', 'host', '--name', imageName,
          '--mount', `type=bind,source=${configured},target=/etc/targoman/platform.cjson,readonly`,
          ...['pg-api', 'pg-worker', 'pg-migration', 'access-private', 'access-public']
            .flatMap(name => ['--mount', `type=bind,source=${join(directory, name)},target=/run/secrets/${name},readonly`]),
          process.env.T4_CUSTOMER_IMAGE], { stdio: ['ignore', 'pipe', 'pipe'] });
        imageProcess.stdout?.on('data', chunk => output.push(Buffer.from(chunk)));
        imageProcess.stderr?.on('data', chunk => output.push(Buffer.from(chunk)));
        root = `http://127.0.0.1:${imagePort}`;
        let healthy = false;
        for (let attempt = 0; attempt < 80; attempt += 1) {
          if (imageProcess.exitCode !== null) throw new Error(`CUSTOMER_IMAGE_EXITED: ${Buffer.concat(output).toString('utf8').slice(-2000)}`);
          try { healthy = (await fetch(`${root}/health`)).ok; if (healthy) break; } catch { /* startup */ }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        assert.equal(healthy, true, `CUSTOMER_IMAGE_NOT_READY: ${Buffer.concat(output).toString('utf8').slice(-2000)}`);
      } else {
        const runtime = await createPublicApi(snapshot, directory);
        closeRuntime = runtime.close;
        apiServer = await new Promise<Server>(resolve => {
          const listener = runtime.app.listen(0, '127.0.0.1', () => resolve(listener));
        });
        const address = apiServer.address(); assert.ok(address && typeof address !== 'string');
        root = `http://127.0.0.1:${address.port}`;
      }
      const origin = snapshot.value.http.allowedOrigins[0]!;
      const login = async (identityId: string, tenantId?: string) => {
        const response = await hostFetch(`${root}/api/auth/login`, { method: 'POST', headers: { host: 'auth.example.invalid', origin, 'content-type': 'application/json' },
          body: JSON.stringify({ email: `${identityId}@example.invalid`, password: PASSWORD, ...(tenantId ? { tenantId } : {}) }) });
        assert.equal(response.status, 200);
        return response.json() as Promise<{ accessToken?: string; tenantId?: string; status?: string; tenants?: string[] }>;
      };
      const post = (path: string, body: unknown, token?: string, selectedTenant?: string) =>
        hostFetch(`${root}/api${path}`, { method: 'POST', headers: { host: 'app.example.invalid', ...(body instanceof FormData ? {} : { 'content-type': 'application/json' }),
          ...(token ? { authorization: `Bearer ${token}` } : {}), ...(selectedTenant ? { 'x-tenant-id': selectedTenant } : {}) },
          body: body instanceof FormData ? body : JSON.stringify(body) });
      const translate = { text: 'A source phrase', source_lang: 'en', target_lang: 'fa', request_id: randomUUID().replaceAll('-', '') };
      const summarize = { text: 'A long source document that requires a short summary.', max_words: 10,
        force_persian: false, request_id: randomUUID().replaceAll('-', '') };
      const anon = await post('/translate', translate); assert.equal(anon.status, 200); await anon.text();
      const anonSummary = await post('/summarize', { ...summarize, text: 'Short text to summarize.' });
      assert.equal(anonSummary.status, 200); await anonSummary.text();
      const anonFaq = new FormData(); anonFaq.set('file', new Blob(['Document content.'], { type: 'text/plain' }), 'note.txt');
      anonFaq.set('count', '1'); anonFaq.set('answer_words', '50'); anonFaq.set('scope', 'all');
      const anonGenerated = await post('/faq', anonFaq); assert.equal(anonGenerated.status, 200);
      assert.match(await anonGenerated.text(), /event: done/);
      const choice = await login(identities.both);
      assert.equal(choice.status, 'TENANT_SELECTION_REQUIRED');
      assert.deepEqual(new Set(choice.tenants), new Set([tenantA, tenantB]));
      const a = await login(identities.a), b = await login(identities.b);
      const bothA = await login(identities.both, tenantA), bothB = await login(identities.both, tenantB);
      assert.equal(a.tenantId, tenantA); assert.equal(b.tenantId, tenantB);
      assert.equal((await post('/translate', translate, bothA.accessToken, tenantB)).status, 401);
      assert.equal((await post('/translate', translate, bothB.accessToken)).status, 403);
      assert.equal((await post('/summarize', summarize, bothB.accessToken)).status, 403);
      const deniedFaq = new FormData(); deniedFaq.set('file', new Blob(['Document content.'], { type: 'text/plain' }), 'note.txt');
      assert.equal((await post('/faq/inspect', deniedFaq, bothA.accessToken)).status, 403);
      for (const [path, body, token] of [
        ['/translate', { ...translate, request_id: randomUUID().replaceAll('-', '') }, bothA.accessToken],
        ['/summarize', summarize, bothA.accessToken]
      ] as const) { const result = await post(path, body, token); assert.equal(result.status, 200); await result.text(); }
      const faqInspect = new FormData(); faqInspect.set('file', new Blob(['Document content.'], { type: 'text/plain' }), 'note.txt');
      const inspected = await post('/faq/inspect', faqInspect, bothB.accessToken); assert.equal(inspected.status, 200); await inspected.text();
      const faq = new FormData(); faq.set('file', new Blob(['Document content.'], { type: 'text/plain' }), 'note.txt');
      faq.set('count', '1'); faq.set('answer_words', '50'); faq.set('scope', 'all');
      const generated = await post('/faq', faq, bothB.accessToken); assert.equal(generated.status, 200); assert.match(await generated.text(), /event: done/);
      const explicitDenyId = randomUUID();
      await withTargetTransaction(migration, { actorKind: 'PLATFORM_SERVICE', actorId: 't4-public-test',
        correlationId: randomUUID(), source: 't4-authority-deny-fixture' }, tx => tx.query(
        `INSERT INTO authority.tbl_aut_grant
         (aug_id,aug_tenant_id,aug_identity__idn_id,aug_privileges,aug_is_deny)
         VALUES ($1,$2,$3,$4::jsonb,true)`, [explicitDenyId, tenantA, identities.both,
          JSON.stringify({ PublicTools: { translator: { use: true } } })]));
      assert.equal((await post('/translate', { ...translate, request_id: randomUUID().replaceAll('-', '') }, bothA.accessToken)).status, 403);
      await withTargetTransaction(migration, { actorKind: 'PLATFORM_SERVICE', actorId: 't4-public-test',
        correlationId: randomUUID(), source: 't4-authority-deny-cleanup' }, tx =>
        tx.query(`DELETE FROM authority.tbl_aut_grant WHERE aug_id = $1`, [explicitDenyId]));
      const rootAllId = randomUUID(); grants.push(rootAllId);
      await withTargetTransaction(migration, { actorKind: 'PLATFORM_SERVICE', actorId: 't4-public-test',
        correlationId: randomUUID(), source: 't4-authority-all-fixture' }, tx => tx.query(
        `INSERT INTO authority.tbl_aut_grant
         (aug_id,aug_tenant_id,aug_identity__idn_id,aug_privileges) VALUES ($1,$2,$3,$4::jsonb)`,
        [rootAllId, tenantB, identities.both,
          JSON.stringify({ ALL: true, PublicTools: { translator: { limitTier: 'AUTHENTICATED' } } })]));
      assert.equal((await post('/translate', { ...translate, request_id: randomUUID().replaceAll('-', '') }, bothB.accessToken, tenantA)).status, 401);
      assert.equal((await post('/translate', { ...translate, request_id: randomUUID().replaceAll('-', '') }, bothB.accessToken)).status, 200);
      await withTargetTransaction(migration, { actorKind: 'PLATFORM_SERVICE', actorId: 't4-public-test',
        correlationId: randomUUID(), source: 't4-authority-all-cleanup' }, tx =>
        tx.query(`DELETE FROM authority.tbl_aut_grant WHERE aug_id = $1`, [rootAllId]));
      const tiers = [
        { name: 'anonymous', token: undefined, policies: snapshot.value.admission },
        { name: 'authenticated', token: bothA.accessToken, policies: snapshot.value.auth?.enabled ? snapshot.value.auth.authenticatedAdmission : snapshot.value.admission },
        { name: 'privileged', token: a.accessToken, policies: snapshot.value.auth?.enabled ? snapshot.value.auth.privilegedAdmission : snapshot.value.admission }
      ] as const;
      const faqDefaultToken = bothB.accessToken;
      const fileBody = (bytes: number): FormData => {
        const form = new FormData();
        form.set('file', new Blob(['😀'.repeat(Math.floor(bytes / 4)) + 'x'.repeat(bytes % 4)], { type: 'text/plain' }), 'note.txt');
        return form;
      };
      for (const tier of tiers) {
        for (const module of ['translator', 'summarizer'] as const) {
          const limit = tier.policies[module].inputChars;
          for (const size of [limit - 1, limit, limit + 1]) {
            const body = module === 'translator' ? { ...translate, text: 'x'.repeat(size), request_id: randomUUID().replaceAll('-', '') }
              : { ...summarize, text: 'x'.repeat(size), request_id: randomUUID().replaceAll('-', '') };
            const previousCalls = providerBudgets.length;
            const response = await post(module === 'translator' ? '/translate' : '/summarize', body, tier.token);
            assert.equal(response.status, size <= limit ? 200 : 413, `${tier.name} ${module} input ${size}`);
            await response.text();
            assert.equal(providerBudgets.length, previousCalls + (size <= limit ? 1 : 0));
          }
          const uploadLimit = tier.policies[module].uploadBytes;
          for (const bytes of [uploadLimit - 1, uploadLimit, uploadLimit + 1]) {
            const response = await post(`/file2Text?maxChars=${module === 'translator' ? 2000 : 3000}`,
              fileBody(bytes), tier.token);
            assert.equal(response.status, bytes <= uploadLimit ? 200 : 413, `${tier.name} ${module} upload ${bytes}`);
            await response.text();
          }
        }
        const faqToken = tier.name === 'authenticated' ? faqDefaultToken : tier.token;
        const faqInputLimit = tier.policies.faq.inputChars;
        for (const size of [faqInputLimit - 1, faqInputLimit, faqInputLimit + 1]) {
          const form = new FormData(); form.set('file', new Blob(['x'.repeat(size)], { type: 'text/plain' }), 'note.txt');
          const response = await post('/faq/inspect', form, faqToken);
          assert.equal(response.status, size <= faqInputLimit ? 200 : 413, `${tier.name} faq input ${size}`);
          await response.text();
        }
        const uploadLimit = tier.policies.faq.uploadBytes;
        for (const bytes of [uploadLimit - 1, uploadLimit, uploadLimit + 1]) {
          const response = await post('/faq/inspect', fileBody(bytes), faqToken);
          assert.equal(response.status, bytes <= uploadLimit ? 200 : 413, `${tier.name} faq upload ${bytes}`);
          await response.text();
        }
      }
      const privilegedFaq = new FormData();
      privilegedFaq.set('file', new Blob(['Document content.'], { type: 'text/plain' }), 'note.txt');
      privilegedFaq.set('count', '1'); privilegedFaq.set('answer_words', '50'); privilegedFaq.set('scope', 'all');
      const privilegedGenerated = await post('/faq', privilegedFaq, a.accessToken);
      assert.equal(privilegedGenerated.status, 200); await privilegedGenerated.text();
      assert.ok([16, 32, 64].every(budget => providerBudgets.includes(budget)));
      for (const tier of tiers) for (const module of ['translator', 'summarizer', 'faq'] as const) {
        const policy: intfAdmissionPolicy = tier.policies[module];
        for (const outputBudget of [policy.outputTokens - 1, policy.outputTokens, policy.outputTokens + 1]) {
          const isolated = `t4-limit-${randomUUID()}`;
          const context = { deploymentId: isolated, tenantId: isolated, moduleId: module as typModuleId,
            requestId: randomUUID(), correlationId: randomUUID(), actorKind: 'ANONYMOUS' as const,
            actorId: null, sessionId: null, source: 'TEST', configFingerprint: snapshot.fingerprint };
          if (outputBudget > policy.outputTokens) await assert.rejects(
            reserveAdmission(apiPool, context, policy, 0, 0, outputBudget, outputBudget),
            (error: unknown) => error instanceof exAdmission && error.code === 'OUTPUT_LIMIT_EXCEEDED');
          else assert.ok((await reserveAdmission(apiPool, context, policy, 0, 0, outputBudget, outputBudget)).id);
        }
      }
      assert.throws(() => validateConfiguration({ ...base, auth: { ...auth,
        privilegedAdmission: { ...privilegedAdmission,
          translator: { ...(privilegedAdmission as Record<string, Record<string, number>>).translator, outputTokens: 100001 } } } }),
      /auth.privilegedAdmission.translator.outputTokens/);
      const humanUsage = await migration.query<{ usg_module_id: string; usg_tenant_id: string; usg_actor_id: string; usg_session_id: string }>(
        `SELECT usg_module_id,usg_tenant_id,usg_actor_id,usg_session_id FROM usage.tbl_usg_consumption
         WHERE usg_actor_id = $1 AND usg_created_at > CURRENT_TIMESTAMP - INTERVAL '10 minutes'`, [identities.both]);
      assert.deepEqual(new Set(humanUsage.rows.map(row => row.usg_module_id)), new Set(['translator', 'summarizer', 'faq']));
      assert.ok(humanUsage.rows.every(row => row.usg_actor_id === identities.both && row.usg_session_id));
      assert.ok(humanUsage.rows.every(row => row.usg_module_id === 'faq' ? row.usg_tenant_id === tenantB :
        row.usg_module_id === 'summarizer' ? row.usg_tenant_id === tenantA :
          [tenantA, tenantB].includes(row.usg_tenant_id)));
      assert.ok(humanUsage.rows.some(row => row.usg_module_id === 'translator' && row.usg_tenant_id === tenantA));
      assert.ok(humanUsage.rows.some(row => row.usg_module_id === 'translator' && row.usg_tenant_id === tenantB));
      const humanAudit = await migration.query<{ ase_module_id: string; ase_tenant_id: string; ase_session_id: string }>(
        `SELECT ase_module_id,ase_tenant_id,ase_session_id FROM audit.tbl_aud_semantic_event
         WHERE ase_actor_id = $1 AND ase_module_id IN ('translator','summarizer','faq')
         AND ase_result = 'SUCCEEDED' AND ase_created_at > CURRENT_TIMESTAMP - INTERVAL '10 minutes'`, [identities.both]);
      assert.deepEqual(new Set(humanAudit.rows.map(row => row.ase_module_id)), new Set(['translator', 'summarizer', 'faq']));
      assert.ok(humanAudit.rows.every(row => row.ase_session_id));
      const delivered: intfExportEnvelope[] = [];
      for (;;) {
        const outcome = await deliverNext(createSiemExportPersistence(workerPool), snapshot.value.siem,
          { deliver: async event => { delivered.push(event); return { kind: 'DELIVERED', ack: 't4-public-ack' }; } });
        if (outcome === 'EMPTY') break;
        assert.equal(outcome, 'DELIVERED');
      }
      for (const action of ['authority.decision', 'authority.denied', 'tenant.mismatch', 'public.translate.completed',
        'public.summarize.completed', 'public.faq.generate.completed'])
        assert.ok(delivered.some(event => event.action === action), action);
      const authorityEvents = delivered.filter(event => event.action === 'authority.decision');
      assert.ok(authorityEvents.some(event => event.authorityContext?.decision === 'ALLOW'));
      assert.ok(authorityEvents.some(event => event.authorityContext?.decision === 'DENY'));
      assert.ok(authorityEvents.every(event => event.actorKind === 'HUMAN' && event.actorId && event.sessionId
        && event.requestId && event.correlationId && event.authorityContext?.path
        && Number.isSafeInteger(event.authorityContext?.authorizationVersion)));
      assert.ok(authorityEvents.every(event => !/password|refreshToken|accessToken|cookie/i.test(JSON.stringify(event))));
      assert.ok(delivered.filter(event => event.actorKind === 'HUMAN').every(event => event.actorId && event.sessionId));
      const unscoped = await apiPool.query(`SELECT aug_id FROM authority.tbl_aut_grant WHERE aug_identity__idn_id = $1`, [identities.both]);
      assert.equal(unscoped.rowCount, 0);
      const scopedA = await withTargetTransaction(apiPool, { actorKind: 'HUMAN', actorId: identities.both,
        tenantId: tenantA, correlationId: randomUUID(), source: 't4-rls-test' }, tx =>
        tx.query<{ aug_tenant_id: string }>(`SELECT aug_tenant_id FROM authority.tbl_aut_grant WHERE aug_identity__idn_id = $1`, [identities.both]));
      assert.deepEqual(scopedA.rows.map(row => row.aug_tenant_id), [tenantA]);
    } finally {
      if (apiServer) await new Promise<void>(resolve => apiServer!.close(() => resolve()));
      if (imageProcess) {
        try { execFileSync('docker', ['stop', imageName], { stdio: 'ignore' }); } catch { /* already stopped */ }
        if (imageProcess.exitCode === null) await new Promise<void>(resolve => imageProcess!.once('exit', () => resolve()));
      }
      if (closeRuntime) await closeRuntime();
      if (provider) await new Promise<void>(resolve => provider!.close(() => resolve()));
      if (apiPool) await apiPool.end();
      if (workerPool) await workerPool.end();
      if (migration) {
        try {
          await withTargetTransaction(migration, { actorKind: 'PLATFORM_SERVICE', actorId: 't4-public-test',
            correlationId: randomUUID(), source: 't4-public-cleanup' }, async tx => {
            await tx.query(`DELETE FROM session_core.tbl_ses_refresh_token WHERE srt_session__ses_id IN
              (SELECT ses_id FROM session_core.tbl_ses_session WHERE ses_identity__idn_id = ANY($1::uuid[]))`, [Object.values(identities)]);
            await tx.query(`DELETE FROM session_core.tbl_ses_session WHERE ses_identity__idn_id = ANY($1::uuid[])`, [Object.values(identities)]);
            await tx.query(`DELETE FROM authority.tbl_aut_grant WHERE aug_id = ANY($1::uuid[])`, [grants]);
            await tx.query(`DELETE FROM admission.tbl_adm_reservation WHERE adr_tenant_id = ANY($1::text[])`, [[`t4-anon-${suffix}`, tenantA, tenantB]]);
            await tx.query(`DELETE FROM admission.tbl_adm_reservation WHERE adr_deployment_id LIKE 't4-limit-%'`);
            await tx.query(`DELETE FROM identity.tbl_idn_membership WHERE idm_identity__idn_id = ANY($1::uuid[])`, [Object.values(identities)]);
            await tx.query(`DELETE FROM authentication.tbl_ath_password_credential WHERE apc_identity__idn_id = ANY($1::uuid[])`, [Object.values(identities)]);
            await tx.query(`DELETE FROM identity.tbl_idn_identity WHERE idn_id = ANY($1::uuid[])`, [Object.values(identities)]);
          });
        } finally { await migration.end(); }
      }
      await rm(directory, { recursive: true, force: true });
    }
  });

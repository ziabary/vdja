import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { loadConfiguration } from '../../packages/configuration/src/index.js';
import type { intfExecutionContext } from '../../packages/contracts/src/index.js';
import type { intfTransactionHandle } from '../../packages/contracts/src/transaction.js';
import { createTargetPool, withTargetTransaction } from '../../packages/persistence/src/target.js';
import { createTransactionPort, resolveTargetTransaction } from '../../packages/persistence/src/target-transaction.js';
import { createDocumentRepository } from '../../packages/documents/src/persistence.js';
import { createJobPersistence } from '../../packages/jobs/src/persistence.js';
import { enuAssetState, enuVersionState, type intfCommitVersion } from '../../packages/documents/src/index.js';

const config = process.env.T4_PG_CONFIG, secrets = process.env.T4_SECRETS_DIR;
if (process.env.T5_REQUIRE_LIVE === '1' && (!config || !secrets)) throw new Error('T5_LIVE_CONFIGURATION_REQUIRED');
test('PostgreSQL Document versions and jobs survive retries, concurrency and Worker replacement',
  { skip: !config || !secrets }, async t => {
    const snapshot = await loadConfiguration(config!);
    const api = await createTargetPool(snapshot, 'api', secrets);
    const worker = await createTargetPool(snapshot, 'worker', secrets);
    const migration = await createTargetPool(snapshot, 'migration', secrets);
    const transactions = createTransactionPort(api), workerTransactions = createTransactionPort(worker);
    const repository = createDocumentRepository(), jobs = createJobPersistence();
    const tenant = `t5-${randomUUID()}`, documentId = randomUUID(), actorId = randomUUID();
    const context: intfExecutionContext = { deploymentId: snapshot.value.deployment.id, tenantId: tenant,
      moduleId: 'knowledge', actorKind: 'HUMAN', actorId, sessionId: randomUUID(), authorizationVersion: 1,
      requestId: randomUUID().replaceAll('-', ''), correlationId: randomUUID(), source: 'T5_TEST',
      configFingerprint: snapshot.fingerprint };
    const workerContext: intfExecutionContext = { ...context, actorKind: 'PLATFORM_SERVICE',
      actorId: 'document-worker', sessionId: null, source: 'WORKER' };
    const input = (source: string): intfCommitVersion => {
      const versionId = randomUUID();
      return { documentId, versionId, sourceIdentity: source, asset: { id: randomUUID(), documentId,
        versionId, storageKey: `${createHash('sha256').update(tenant).digest('hex')}/${randomUUID()}`,
        storageProfile: 'test', sha256: createHash('sha256').update(source).digest('hex'), bytes: source.length,
        filename: 'original.txt', mediaType: 'text/plain', lifecycle: enuAssetState.Approved } };
    };
    try {
      await transactions.run(context, tx => repository.create(tx, context,
        { id: documentId, title: 'protected title', classification: 'LOW' }));
      await t.test('forged, escaped and missing-scope transaction handles fail closed', async () => {
        assert.throws(() => resolveTargetTransaction({ transactionId: randomUUID() }), /INVALID_OR_CLOSED/);
        let escaped: intfTransactionHandle | undefined;
        await transactions.run(context, async tx => { escaped = tx; });
        assert.throws(() => resolveTargetTransaction(escaped!), /INVALID_OR_CLOSED/);
        assert.throws(() => transactions.run({ ...context, tenantId: '' }, async () => undefined), /MISSING_TRANSACTION_SCOPE/);
      });
      const first = input('revision-a'), second = input('revision-b');
      const versions = await Promise.all([first, second].map(version => transactions.run(context,
        tx => repository.commitVersion(tx, context, version))));
      await t.test('parallel intake has unique sequences and source retry returns one version', async () => {
        assert.deepEqual(versions.map(version => version.sequence).sort(), [1, 2]);
        const retry = await transactions.run(context, tx => repository.commitVersion(tx, context, input('revision-a')));
        assert.equal(retry.id, versions[0]!.id);
        await assert.rejects(transactions.run(context, tx => repository.commitVersion(tx, context,
          { ...first, asset: { ...first.asset, sha256: 'a'.repeat(64) } })), /DOCUMENT_CONFLICT/);
        assert.equal((await transactions.run(context, tx => repository.versions(tx, context, documentId))).length, 2);
      });
      await t.test('asset/version/job transaction rolls back at the crash boundary', async () => {
        await assert.rejects(transactions.run(context, async tx => {
          const version = await repository.commitVersion(tx, context, input('crash-revision'));
          await jobs.schedule(tx, { id: randomUUID(), kind: 'fixture', idempotencyKey: version.id,
            payloadVersion: 1, payload: { versionId: version.id }, subject: context, maxAttempts: 2 });
          throw new Error('SIMULATED_CRASH_BEFORE_COMMIT');
        }), /SIMULATED_CRASH/);
        assert.equal((await transactions.run(context, tx => repository.versions(tx, context, documentId))).length, 2);
        assert.equal(await workerTransactions.run(workerContext, tx => jobs.claim(tx, workerContext, 100)), null);
      });
      await t.test('lease fencing prevents replaced Worker from settling durable work', async () => {
        const request = { id: randomUUID(), kind: 'fixture', idempotencyKey: randomUUID(),
          payloadVersion: 1, payload: { documentId }, subject: context, maxAttempts: 2 };
        assert.equal(await transactions.run(context, tx => jobs.schedule(tx, request)), request.id);
        assert.equal(await transactions.run(context, tx => jobs.schedule(tx, { ...request, id: randomUUID() })), request.id);
        await assert.rejects(transactions.run(context, tx => jobs.schedule(tx,
          { ...request, payload: { documentId: randomUUID() } })), /JOB_IDEMPOTENCY_CONFLICT/);
        const claimed = await workerTransactions.run(workerContext, tx => jobs.claim(tx, workerContext, 100));
        assert.ok(claimed); assert.equal(claimed.subject.actorKind, 'HUMAN');
        assert.equal(claimed.subject.sessionId, context.sessionId);
        assert.equal(await workerTransactions.run(workerContext, tx => jobs.claim(tx, workerContext, 100)), null);
        await new Promise(resolve => setTimeout(resolve, 120));
        const replacement = await workerTransactions.run(workerContext, tx => jobs.claim(tx, workerContext, 5000));
        assert.ok(replacement); assert.equal(replacement.attempts, 2);
        assert.notEqual(replacement.leaseToken, claimed.leaseToken);
        assert.equal(await workerTransactions.run(workerContext, tx => jobs.finish(tx, workerContext, claimed)), false);
        assert.equal(await workerTransactions.run(workerContext, tx => jobs.finish(tx, workerContext, replacement)), true);
        assert.equal(await workerTransactions.run(workerContext, tx => jobs.claim(tx, workerContext, 100)), null);
      });
      await t.test('tenant/deployment isolation and runtime no-purge hold at the database boundary', async () => {
        assert.equal(await transactions.run({ ...context, tenantId: 'other' }, tx =>
          repository.facts(tx, { ...context, tenantId: 'other' }, documentId)), null);
        assert.equal(await transactions.run({ ...context, deploymentId: 'other' }, tx =>
          repository.facts(tx, { ...context, deploymentId: 'other' }, documentId)), null);
        assert.equal((await api.query('SELECT doc_id FROM documents.tbl_doc_document')).rowCount, 0);
        await assert.rejects(transactions.run(context, tx => resolveTargetTransaction(tx).query(
          'DELETE FROM documents.tbl_doc_document WHERE doc_id = $1', [documentId])), /permission denied/);
      });
      await t.test('normalized content is immutable and out-of-order activation cannot replace a newer version', async () => {
        const ordered = [...versions].sort((a, b) => a.sequence - b.sequence);
        for (const version of ordered) await workerTransactions.run(context, async tx => {
          const text = `normalized ${version.sequence}`, hash = createHash('sha256').update(text).digest('hex');
          await repository.recordProcessed(tx, context, version.id, text, 'text-v1', hash);
          await repository.recordProcessed(tx, context, version.id, text, 'text-v1', hash);
          await repository.markProcessing(tx, context, version.id, enuVersionState.Ready);
        });
        await assert.rejects(workerTransactions.run(context, tx => repository.recordProcessed(tx, context,
          ordered[0]!.id, 'rewritten', 'text-v2', createHash('sha256').update('rewritten').digest('hex'))), /DOCUMENT_CONFLICT|IMMUTABLE/);
        await workerTransactions.run(context, tx => repository.activate(tx, context, ordered[1]!.id));
        await assert.rejects(workerTransactions.run(context, tx => repository.activate(tx, context, ordered[0]!.id)), /STALE_DOCUMENT/);
        const facts = await transactions.run(context, tx => repository.facts(tx, context, documentId));
        assert.equal(facts?.currentVersionId, ordered[1]!.id);
      });
      await t.test('publication holds Document security facts until commit and rejects a stale snapshot', async () => {
        const expected=await transactions.run(context,tx=>repository.facts(tx,context,documentId));assert.ok(expected);
        await assert.rejects(workerTransactions.run(context,tx=>repository.assertSnapshot(tx,context,[{...expected,securityVersion:expected.securityVersion-1}])),/STALE_DOCUMENT/);
        let release!:()=>void,locked!:()=>void;const lockReady=new Promise<void>(resolve=>locked=resolve),gate=new Promise<void>(resolve=>release=resolve);
        const held=workerTransactions.run(context,async tx=>{await repository.assertSnapshot(tx,context,[expected]);locked();await gate;});
        await lockReady;let settled=false;
        const concurrent=withTargetTransaction(migration,context,tx=>tx.query('UPDATE documents.tbl_doc_document SET doc_security_version=doc_security_version+1 WHERE doc_id=$1 AND doc_tenant_id=$2',[documentId,tenant])).then(()=>{settled=true;});
        try{await new Promise(resolve=>setTimeout(resolve,60));assert.equal(settled,false);}finally{release();await held;await concurrent;}
      });
      await t.test('database mutation evidence omits names, locators and content', async () => {
        const events = await migration.query<{ aud_after: unknown }>(
          'SELECT aud_after FROM audit.tbl_aud_mutation WHERE aud_correlation_id = $1', [context.correlationId]);
        assert.ok(events.rowCount && events.rowCount > 0);
        assert.doesNotMatch(JSON.stringify(events.rows), /protected title|original\.txt|normalized|revision-a|storage_key/);
      });
    } finally {
      await withTargetTransaction(migration, { ...context, actorKind: 'PLATFORM_SERVICE', actorId: 'T5_CLEANUP' }, async tx => {
        await tx.query('DELETE FROM jobs.tbl_job_work WHERE job_tenant_id = $1', [tenant]);
        await tx.query('UPDATE documents.tbl_doc_document SET doc_current_version_id = NULL WHERE doc_tenant_id = $1', [tenant]);
        await tx.query('DELETE FROM documents.tbl_doc_asset WHERE ast_tenant_id = $1', [tenant]);
        await tx.query('DELETE FROM documents.tbl_doc_version WHERE dvr_tenant_id = $1', [tenant]);
        await tx.query('DELETE FROM documents.tbl_doc_document WHERE doc_tenant_id = $1', [tenant]);
      });
      await api.end(); await worker.end(); await migration.end();
    }
  });

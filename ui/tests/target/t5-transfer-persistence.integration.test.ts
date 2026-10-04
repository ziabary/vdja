import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { test } from 'node:test';
import { loadConfiguration } from '../../packages/configuration/src/index.js';
import { createTargetPool, withTargetTransaction } from '../../packages/persistence/src/target.js';
import { createTransactionPort } from '../../packages/persistence/src/target-transaction.js';
import type { intfExecutionContext } from '../../packages/contracts/src/index.js';
import { createFileAdmissionPersistence } from '../../packages/admission-control/src/persistence/files.js';
import { enuFileReservationKind, enuFileReservationState } from '../../packages/admission-control/src/files.js';
import { createFileUsagePersistence } from '../../packages/usage/src/persistence/files.js';
import { createTransferRepository } from '../../packages/file-management/src/persistence.js';
import { enuTransferState } from '../../packages/file-management/src/index.js';
import { enuTransferOperation } from '../../packages/file-management/src/transfers.js';
import { createSemanticAuditPersistence } from '../../packages/audit/src/persistence/semantic.js';

const config = process.env.T4_PG_CONFIG, secrets = process.env.T4_SECRETS_DIR;
if (process.env.T5_REQUIRE_LIVE === '1' && (!config || !secrets)) throw new Error('T5_LIVE_CONFIGURATION_REQUIRED');
test('managed transfer persistence fences writes, bounds shared quotas and atomically records safe evidence',
  { skip: !config || !secrets }, async t => {
    const snapshot = await loadConfiguration(config!);
    const api = await createTargetPool(snapshot, 'api', secrets), migration = await createTargetPool(snapshot, 'migration', secrets);
    const transactions = createTransactionPort(api), admission = createFileAdmissionPersistence(), usage = createFileUsagePersistence();
    const transfers = createTransferRepository(), audit = createSemanticAuditPersistence({ ...snapshot.value.siem, enabled: false });
    const context: intfExecutionContext = { deploymentId: snapshot.value.deployment.id, tenantId: `t5-file-${randomUUID()}`,
      moduleId: 'knowledge', actorKind: 'HUMAN', actorId: randomUUID(), sessionId: randomUUID(), authorizationVersion: 1,
      correlationId: randomUUID(), requestId: randomUUID().replaceAll('-', ''), source: 'T5_FILE_TEST', configFingerprint: snapshot.fingerprint };
    const policy = { maxBytes: 100, maxConcurrent: 3, maxPendingBytes: 110, maxTenantStorageBytes: 110, maxTenantAssets: 10 };
    const expiresAt = new Date(Date.now() + 60000).toISOString(), ids = [randomUUID(), randomUUID()];
    try {
      await t.test('concurrent replicas cannot over-reserve storage and committed storage stays charged', async () => {
        const outcomes = await Promise.allSettled(ids.map(id => transactions.run(context, tx => admission.reserve(tx, context,
          policy, { id, kind: enuFileReservationKind.Upload, bytes: 60, expiresAt }))));
        assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
        const winner = ids[outcomes.findIndex(outcome => outcome.status === 'fulfilled')]!;
        await transactions.run(context, tx => admission.finish(tx, context, winner, enuFileReservationState.Committed));
        await assert.rejects(transactions.run(context, tx => admission.reserve(tx, context, policy,
          { id: randomUUID(), kind: enuFileReservationKind.Upload, bytes: 60, expiresAt })), /QUOTA_EXCEEDED/);
        await assert.rejects(transactions.run(context, tx => admission.finish(tx, context, winner, enuFileReservationState.Released)), /CONCURRENCY_CONFLICT/);
      });
      const input = { id: randomUUID(), documentId: randomUUID(), idempotencyKey: 'logical-upload', assetId: randomUUID(),
        proposedVersionId: randomUUID(), storageKey: `${createHash('sha256').update(context.tenantId).digest('hex')}/${randomUUID()}`,
        storageProfile: 'test', partBytes: 5242880, expiresAt, filename: 'protected-original.txt', mediaType: 'text/plain',
        bytes: 40, sha256: createHash('sha256').update('fixture').digest('hex') };
      await t.test('transfer creation is idempotent, altered payload conflicts and tenant lookup hides existence', async () => {
        await transactions.run(context, async tx => {
          await transfers.create(tx, context, input);
          await audit.record(tx, context, { action: 'file.upload.initiated', result: 'REQUESTED', resource: { type: 'transfer', id: input.id } });
        });
        assert.equal((await transactions.run(context, tx => transfers.create(tx, context, { ...input, id: randomUUID() }))).id, input.id);
        await assert.rejects(transactions.run(context, tx => transfers.create(tx, context,
          { ...input, filename: 'altered.txt' })), /TRANSFER_CONFLICT/);
        const other = { ...context, tenantId: 'different-tenant' };
        assert.equal(await transactions.run(other, tx => transfers.find(tx, other, input.id)), null);
      });
      await t.test('one live lease owns transfer mutation and checksum/size intent survives retry', async () => {
        const claims = await Promise.all([1, 2].map(() => transactions.run(context, tx => transfers.lease(tx, context,
          input.id, [enuTransferState.Initiated], enuTransferOperation.Begin, 5000))));
        assert.equal(claims.filter(Boolean).length, 1);
        const claim = claims.find(Boolean)!;
        await assert.rejects(transactions.run(context, tx => transfers.update(tx, context, input.id,
          randomUUID(), { state: enuTransferState.Uploading })), /TRANSFER_CONFLICT/);
        await transactions.run(context, tx => transfers.update(tx, context, input.id, claim.leaseToken!,
          { state: enuTransferState.Uploading, remoteUploadId: 'opaque-remote-upload' }));
        const partLease = await transactions.run(context, tx => transfers.lease(tx, context, input.id,
          [enuTransferState.Uploading], enuTransferOperation.Part, 5000));
        assert.ok(partLease);
        const part = { number: 1, bytes: 40, sha256: input.sha256, etag: '' };
        await transactions.run(context, tx => transfers.reservePart(tx, context, input.id, partLease.leaseToken!, part));
        await assert.rejects(transactions.run(context, tx => transfers.reservePart(tx, context, input.id,
          partLease.leaseToken!, { ...part, sha256: 'f'.repeat(64) })), /TRANSFER_CONFLICT/);
        await transactions.run(context, async tx => {
          await transfers.acceptPart(tx, context, input.id, partLease.leaseToken!, { ...part, etag: 'verified-etag' });
          await transfers.update(tx, context, input.id, partLease.leaseToken!, { state: enuTransferState.Uploaded });
        });
        const stored = await transactions.run(context, tx => transfers.find(tx, context, input.id));
        assert.equal(stored?.parts[0]?.etag, 'verified-etag');
        assert.equal(stored?.leaseToken, null);
      });
      await t.test('Usage is immutable/idempotent and file semantic and mutation evidence exclude sensitive metadata', async () => {
        const fact = { operationId: randomUUID(), uploadedBytes: 40, downloadedBytes: 0, storageBytes: 40, files: 1, processingBytes: 0 };
        await transactions.run(context, async tx => { await usage.record(tx, context, fact); await usage.record(tx, context, fact); });
        await assert.rejects(transactions.run(context, tx => usage.record(tx, context, { ...fact, uploadedBytes: 41 })), /USAGE_IDEMPOTENCY_CONFLICT/);
        const mutation = await migration.query<{ aud_after: unknown }>('SELECT aud_after FROM audit.tbl_aud_mutation WHERE aud_correlation_id=$1', [context.correlationId]);
        assert.ok(mutation.rowCount && mutation.rowCount > 0);
        assert.doesNotMatch(JSON.stringify(mutation.rows), /protected-original|storage_key|opaque-remote-upload|verified-etag/);
        const semantic = await api.query<{ ase_resource_type: string; ase_resource_id: string }>(
          'SELECT ase_resource_type,ase_resource_id FROM audit.tbl_aud_semantic_event WHERE ase_correlation_id=$1', [context.correlationId]);
        assert.equal(semantic.rows[0]?.ase_resource_id, input.id); assert.equal(semantic.rows[0]?.ase_resource_type, 'transfer');
        await assert.rejects(transactions.run(context, tx => audit.record(tx, context,
          { action: 'file.upload.failed', result: 'FAILED', reason: 'secret content' })), /INVALID_AUDIT_EVIDENCE/);
      });
    } finally {
      await withTargetTransaction(migration, { ...context, actorKind: 'PLATFORM_SERVICE' }, async tx => {
        await tx.query('DELETE FROM file_management.tbl_fil_part WHERE fpt_tenant_id=$1', [context.tenantId]);
        await tx.query('DELETE FROM file_management.tbl_fil_transfer WHERE ftr_tenant_id=$1', [context.tenantId]);
        await tx.query('DELETE FROM admission.tbl_adm_file_reservation WHERE afr_tenant_id=$1', [context.tenantId]);
        await tx.query('DELETE FROM usage.tbl_usg_file_consumption WHERE ufc_tenant_id=$1', [context.tenantId]);
      });
      await api.end(); await migration.end();
    }
  });

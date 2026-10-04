import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { loadConfiguration } from '../../packages/configuration/src/index.js';
import { createTargetPool, withTargetTransaction } from '../../packages/persistence/src/target.js';
import { createTransactionPort } from '../../packages/persistence/src/target-transaction.js';
import { createT5Subject } from './support/t5-live-subject.js';
import { createFileAdmissionPersistence } from '../../packages/admission-control/src/persistence/files.js';
import { createFileUsagePersistence } from '../../packages/usage/src/persistence/files.js';
import { createSemanticAuditPersistence } from '../../packages/audit/src/persistence/semantic.js';
import { createDocumentRepository } from '../../packages/documents/src/persistence.js';
import { clsDocumentService } from '../../packages/documents/src/service.js';
import { enuDocumentOperation } from '../../packages/documents/src/index.js';
import { createJobPersistence } from '../../packages/jobs/src/persistence.js';
import { createTransferRepository } from '../../packages/file-management/src/persistence.js';
import { clsFileManagement } from '../../packages/file-management/src/service.js';
import { enuTransferState } from '../../packages/file-management/src/index.js';
import { clsLocalStorageAdapter } from '../../packages/storage/src/adapters/local.js';
import { enuStorageKind } from '../../packages/storage/src/index.js';

const config = process.env.T4_PG_CONFIG, secrets = process.env.T4_SECRETS_DIR;
if (process.env.T5_REQUIRE_LIVE === '1' && (!config || !secrets)) throw new Error('T5_LIVE_CONFIGURATION_REQUIRED');
test('File Management enforces real Session/Authority before verified upload commit and cache/range downloads',
  { skip: !config || !secrets }, async t => {
    const snapshot = await loadConfiguration(config!);
    const api = await createTargetPool(snapshot, 'api', secrets), migration = await createTargetPool(snapshot, 'migration', secrets), worker = await createTargetPool(snapshot, 'worker', secrets);
    const fixture = await createT5Subject(snapshot, migration, api, worker), context = fixture.context;
    const root = await mkdtemp(join(tmpdir(), 't5-files-')), transactions = createTransactionPort(api);
    const repository = createDocumentRepository(), jobs = createJobPersistence(), audit = createSemanticAuditPersistence({ ...snapshot.value.siem, enabled: false });
    const documents = new clsDocumentService({ transactions, repository, jobs, subject: fixture.subject, authority: fixture.authority,
      maxNormalizedChars: 100000, audit: { record: async (tx, ctx, action, id) => { await audit.record(tx, ctx, { action, result: 'SUCCEEDED', resource: { type: 'document', id } }); } } });
    const storage = new clsLocalStorageAdapter(join(root, 'canonical'));
    const configuration = { enabled: true as const, storage: { kind: enuStorageKind.Local, root: join(root, 'canonical'), profileId: 'fixture' },
      uploads: { mode: 'PROXY' as const, partBytes: 5242880, ttlMs: 60000, timeoutMs: 10000, maxConcurrent: 4, maxBytes: 10485760,
        maxPendingBytes: 41943040, maxTenantStorageBytes: 104857600, maxTenantAssets: 100 },
      downloads: { ranges: true, conditional: true, maxConcurrent: 4 },
      cache: { scope: 'REPLICA_PRIVATE' as const, root: join(root, 'cache'), maxBytes: 10485760, maxEntries: 5, ttlMs: 60000, timeoutMs: 10000 },
      staging: { root: join(root, 'staging'), maxBytes: 10485760 }, security: { privateOnly: true as const, integrityRequired: true as const } };
    const ports = { transactions, subject: fixture.subject, documents, transfers: createTransferRepository(), storage, jobs,
      admission: createFileAdmissionPersistence(), usage: createFileUsagePersistence(), audit, configuration,
      limits: { maxUploadBytes: 10485760, maxExtractedChars: 100000, maxPages: 100 } };
    const files = new clsFileManagement(ports), documentId = randomUUID();
    const content = Buffer.from('نسخهٔ اصلی و محتوای خصوصی\n'.repeat(10)), hash = createHash('sha256').update(content).digest('hex');
    let versionId = '';
    const read = async (body: AsyncIterable<Buffer> | undefined) => { assert.ok(body); const chunks: Buffer[] = []; for await (const chunk of body) chunks.push(Buffer.from(chunk)); return Buffer.concat(chunks); };
    try {
      await documents.create(context, { id: documentId, title: 'Private test document', classification: 'LOW' });
      await t.test('version/asset/job/usage/audit are atomic and resumable partial bytes are never downloadable', async () => {
        const upload = { documentId, filename: 'اصل.txt', bytes: content.length, sha256: hash, mediaType: 'text/plain', idempotencyKey: 'upload-one' };
        const transfer = await files.initiate(context, upload);
        assert.equal(transfer.state, enuTransferState.Uploading);
        assert.equal((await files.initiate(context, upload)).id, transfer.id);
        assert.equal((await documents.versions(context, documentId)).length, 0);
        await assert.rejects(files.uploadPart(context, transfer.id, 1, 'f'.repeat(64), content), /FILE_INTEGRITY_FAILURE/);
        const updated = await files.uploadPart(context, transfer.id, 1, hash, content);
        assert.equal(updated.state, enuTransferState.Uploaded);
        assert.deepEqual(updated.acceptedParts, [1]);
        await files.uploadPart(context, transfer.id, 1, hash, content);
        const version = await files.complete(context, transfer.id);
        assert.ok('sequence' in version); versionId = version.id;
        assert.equal((await files.status(context, transfer.id)).state, enuTransferState.Committed);
        assert.equal((await documents.versions(context, documentId)).length, 1);
        const evidence = await migration.query<{ versions: string; assets: string; jobs: string; usage: string }>(`SELECT
          (SELECT COUNT(dvr_id) FROM documents.tbl_doc_version WHERE dvr_tenant_id=$1) AS versions,
          (SELECT COUNT(ast_id) FROM documents.tbl_doc_asset WHERE ast_tenant_id=$1) AS assets,
          (SELECT COUNT(job_id) FROM jobs.tbl_job_work WHERE job_tenant_id=$1 AND job_kind='document.process.v1') AS jobs,
          (SELECT COUNT(ufc_operation_id) FROM usage.tbl_usg_file_consumption WHERE ufc_tenant_id=$1) AS usage`, [context.tenantId]);
        assert.deepEqual(evidence.rows[0], { versions: '1', assets: '1', jobs: '1', usage: '1' });
        const parsed = await files.extract(context, documentId, versionId);
        assert.equal(parsed.text, content.toString());
      });
      await t.test('warm/disposable cache, range and conditional requests cannot skip independent download authorization', async () => {
        const full = await files.download(context, { documentId, versionId });
        assert.equal(full.status, 200); assert.equal(full.headers['Cache-Control'], 'private, no-store, max-age=0');
        assert.deepEqual(await read(full.body), content);
        const partial = await files.download(context, { documentId, versionId, range: 'bytes=2-9' });
        assert.equal(partial.status, 206); assert.deepEqual(await read(partial.body), content.subarray(2, 10));
        await assert.rejects(files.download(context, { documentId, versionId, range: 'bytes=0-1,4-5' }), /INVALID_RANGE/);
        const conditional = await files.download(context, { documentId, versionId, ifNoneMatch: full.headers.ETag });
        assert.equal(conditional.status, 304); assert.equal(conditional.body, undefined);
        await fixture.setPermissions({ Knowledge: { Documents: { read: true, use: true } } });
        await assert.rejects(files.download(context, { documentId, versionId, ifNoneMatch: full.headers.ETag }), /FILE_DENIED/);
        await assert.rejects(files.download(context, { documentId, versionId, range: 'bytes=2-9' }), /FILE_DENIED/);
        await fixture.setPermissions({ Knowledge: { Documents: { download: true } } });
        const hiddenName = await files.download(context, { documentId, versionId });
        assert.equal(hiddenName.headers['Content-Disposition'], 'attachment; filename="file"');
        assert.deepEqual(await read(hiddenName.body), content);
        await rm(join(root, 'cache'), { recursive: true, force: true });
        assert.deepEqual(await read((await new clsFileManagement(ports).download(context, { documentId, versionId })).body), content);
        await fixture.setPermissions({ Knowledge: { ALL: true } });
        await assert.rejects(files.download({ ...context, tenantId: 'other-tenant' }, { documentId, versionId }), /INACTIVE|FILE_DENIED/);
      });
      await t.test('invalid signature/hash never creates Asset, Version, or processing Job', async () => {
        const bad = await files.initiate(context, { documentId, idempotencyKey: 'malicious-pdf', filename: 'malicious.pdf',
          mediaType: 'application/pdf', bytes: content.length, sha256: hash });
        await files.uploadPart(context, bad.id, 1, hash, content);
        await assert.rejects(files.complete(context, bad.id), /FILE_INTEGRITY_FAILURE/);
        assert.equal((await files.status(context, bad.id)).state, enuTransferState.Failed);
        assert.equal((await documents.versions(context, documentId)).length, 1);
      });
      await t.test('destroying an unconsumed download releases admission and records zero bytes once',async()=>{
        const download=await files.download(context,{documentId,versionId});assert.ok(download.body);
        await new Promise<void>((resolve,reject)=>{download.body!.once('error',reject);download.body!.once('close',resolve);download.body!.destroy();});
        const usage=await withTargetTransaction(api,context,tx=>tx.query<{ufc_downloaded_bytes:string}>(
          'SELECT ufc_downloaded_bytes FROM usage.tbl_usg_file_consumption WHERE ufc_tenant_id=$1 AND ufc_uploaded_bytes=0 AND ufc_processing_bytes=0 ORDER BY ufc_created_at DESC LIMIT 1',[context.tenantId]));
        assert.equal(Number(usage.rows[0]?.ufc_downloaded_bytes),0);
        const reservations=await withTargetTransaction(api,context,tx=>tx.query<{active:string}>(
          "SELECT COUNT(afr_id) AS active FROM admission.tbl_adm_file_reservation WHERE afr_tenant_id=$1 AND afr_kind='DOWNLOAD' AND afr_state='RESERVED'",[context.tenantId]));
        assert.equal(Number(reservations.rows[0]?.active),0);
      });
      await t.test('Worker must revalidate original session, membership version and revocation before materialization', async () => {
        await fixture.workerSubject.assertActive(context);
        const facts = (await documents.facts(context, [documentId]))[0]!;
        assert.equal((await fixture.workerAuthority.authorize({ context, path: 'Knowledge.Documents.use', resource: facts })).decision, 'ALLOW');
        await withTargetTransaction(migration, context, tx => tx.query('UPDATE identity.tbl_idn_membership SET idm_authorization_version=idm_authorization_version+1 WHERE idm_id=$1', [fixture.membershipId]));
        await assert.rejects(fixture.workerSubject.assertActive(context), /EXECUTION_SUBJECT_INACTIVE/);
        await withTargetTransaction(migration, context, tx => tx.query('UPDATE identity.tbl_idn_membership SET idm_authorization_version=$2 WHERE idm_id=$1', [fixture.membershipId, context.authorizationVersion]));
        await withTargetTransaction(migration, context, tx => tx.query('UPDATE session_core.tbl_ses_session SET ses_revoked_at=clock_timestamp() WHERE ses_id=$1', [context.sessionId]));
        await assert.rejects(fixture.workerSubject.assertActive(context), /EXECUTION_SUBJECT_INACTIVE/);
        await assert.rejects(files.download(context, { documentId, versionId }), /EXECUTION_SUBJECT_INACTIVE/);
        await assert.rejects(files.extract(context, documentId, versionId), /EXECUTION_SUBJECT_INACTIVE/);
      });
    } finally {
      await withTargetTransaction(migration, context, async tx => {
        await tx.query('DELETE FROM file_management.tbl_fil_part WHERE fpt_tenant_id=$1', [context.tenantId]);
        await tx.query('DELETE FROM file_management.tbl_fil_transfer WHERE ftr_tenant_id=$1', [context.tenantId]);
        await tx.query('DELETE FROM jobs.tbl_job_work WHERE job_tenant_id=$1', [context.tenantId]);
        await tx.query('UPDATE documents.tbl_doc_document SET doc_current_version_id=NULL WHERE doc_tenant_id=$1', [context.tenantId]);
        await tx.query('DELETE FROM documents.tbl_doc_asset WHERE ast_tenant_id=$1', [context.tenantId]);
        await tx.query('DELETE FROM documents.tbl_doc_version WHERE dvr_tenant_id=$1', [context.tenantId]);
        await tx.query('DELETE FROM documents.tbl_doc_document WHERE doc_tenant_id=$1', [context.tenantId]);
        await tx.query('DELETE FROM admission.tbl_adm_file_reservation WHERE afr_tenant_id=$1', [context.tenantId]);
        await tx.query('DELETE FROM usage.tbl_usg_file_consumption WHERE ufc_tenant_id=$1', [context.tenantId]);
      });
      await fixture.clean(); await rm(root, { recursive: true, force: true }); await api.end(); await migration.end(); await worker.end();
    }
  });

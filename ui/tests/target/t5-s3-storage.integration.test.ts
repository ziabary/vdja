import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createServer, request as httpRequest } from 'node:http';
import { test } from 'node:test';
import { S3Client, CreateBucketCommand } from '@aws-sdk/client-s3';
import { startS3Fixture } from './support/t5-s3-fixture.js';
import { createStorageAdapter } from '../../packages/storage/src/factory.js';
import { clsS3StorageAdapter } from '../../packages/storage/src/adapters/s3.js';
import { enuStorageKind, enuStorageOutcome } from '../../packages/storage/src/index.js';

test('real S3 multipart parity, process/server restart and ambiguous completion reconcile safely',
  { skip: process.env.T5_REQUIRE_S3 !== '1' }, async t => {
    const fixture = await startS3Fixture(), bucket = `t5-${randomUUID()}`;
    const setup = new S3Client({ endpoint: fixture.endpoint, credentials: fixture.credentials,
      region: 'us-east-1', forcePathStyle: true, maxAttempts: 1 });
    let dropComplete = false, completes = 0;
    const proxy = createServer((request, response) => {
      const upstream = httpRequest(`${fixture.endpoint}${request.url}`, { method: request.method, headers: request.headers }, result => {
        if (dropComplete && request.method === 'POST' && new URL(request.url!, fixture.endpoint).searchParams.has('uploadId')) {
          completes += 1; result.resume(); result.once('end', () => response.destroy());
        } else { response.writeHead(result.statusCode!, result.headers); result.pipe(response); }
      });
      upstream.once('error', () => response.destroy()); request.pipe(upstream);
    });
    await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
    const address = proxy.address(); assert.ok(address && typeof address !== 'string');
    const endpoint = `http://127.0.0.1:${address.port}`;
    const configuration = { kind: enuStorageKind.S3, profileId: 'fixture', endpoint, region: 'us-east-1', bucket,
      forcePathStyle: true, timeoutMs: 5000, accessKeyRef: 'file:/run/secrets/access' as const, secretKeyRef: 'file:/run/secrets/secret' as const };
    const adapter = await createStorageAdapter(configuration, fixture.secretRoot);
    assert.ok(adapter instanceof clsS3StorageAdapter);
    const first = Buffer.alloc(5 * 1024 * 1024, 'a'), last = Buffer.from('last-part');
    const content = Buffer.concat([first, last]);
    const key = `${createHash('sha256').update('deployment:tenant').digest('hex')}/${randomUUID()}`;
    const descriptor = { key, bytes: content.length, sha256: createHash('sha256').update(content).digest('hex'), mediaType: 'text/plain' };
    try {
      await setup.send(new CreateBucketCommand({ Bucket: bucket })); await adapter.ready();
      const started = await adapter.begin(descriptor, randomUUID());
      assert.ok(started.kind === enuStorageOutcome.Success && started.uploadId);
      const part = (bytes: Buffer, number: number) => ({ number, bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'), etag: '' });
      const partA = await adapter.writePart(key, started.uploadId, part(first, 1), first);
      await t.test('partial upload is invisible and duplicate part is stable across adapter restart', async () => {
        assert.equal(await adapter.inspect(key), null);
        const restarted = new clsS3StorageAdapter({ ...configuration, credentials: fixture.credentials });
        try {
          assert.equal(await restarted.reconcileBegin(key, randomUUID()), started.uploadId);
          const duplicate = await restarted.writePart(key, started.uploadId!, part(first, 1), first);
          assert.equal(duplicate.etag, partA.etag);
          const parts = await restarted.parts(key, started.uploadId!);
          assert.equal(parts.length, 1);
          assert.deepEqual(parts[0], { number: 1, bytes: first.length, etag: partA.etag, sha256: null });
          // This real provider omits ListParts checksums. Absence stays explicit;
          // persisted upload intent and the complete object's hash remain required.
        } finally { restarted.close(); }
      });
      const partB = await adapter.writePart(key, started.uploadId, part(last, 2), last);
      await t.test('lost response after actual commit is UNKNOWN, never blindly retried, and full bytes prove outcome', async () => {
        dropComplete = true;
        const completed = await adapter.complete(descriptor, started.uploadId!, [partA, partB]);
        assert.equal(completed.kind, enuStorageOutcome.Unknown); assert.equal(completes, 1);
        assert.deepEqual(await adapter.inspect(key), descriptor);
        const hash = createHash('sha256'); let bytes = 0;
        for await (const chunk of await adapter.open(key)) { hash.update(chunk); bytes += chunk.length; }
        assert.equal(bytes, descriptor.bytes); assert.equal(hash.digest('hex'), descriptor.sha256);
        assert.equal(completes, 1); dropComplete = false;
      });
      await t.test('canonical bytes survive storage server replacement/restart and anonymous access is denied', async () => {
        await fixture.restart();
        assert.deepEqual(await adapter.inspect(key), descriptor);
        const response = await fetch(`${fixture.endpoint}/${bucket}/${key}`);
        assert.equal(response.status, 403);
      });
      await t.test('abort is idempotent and leaves no readable candidate object', async () => {
        const abandoned = { ...descriptor, key: `${key.slice(0, 64)}/${randomUUID()}` };
        const begun = await adapter.begin(abandoned, randomUUID());
        assert.ok(begun.kind === enuStorageOutcome.Success && begun.uploadId);
        await adapter.writePart(abandoned.key, begun.uploadId, part(last, 1), last);
        await adapter.abort(abandoned.key, begun.uploadId); await adapter.abort(abandoned.key, begun.uploadId);
        assert.equal(await adapter.inspect(abandoned.key), null);
      });
    } finally {
      adapter.close(); setup.destroy(); proxy.closeAllConnections();
      await new Promise<void>(resolve => proxy.close(() => resolve())); await fixture.close();
    }
  });

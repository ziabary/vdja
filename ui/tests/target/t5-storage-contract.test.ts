import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { clsLocalStorageAdapter } from '../../packages/storage/src/adapters/local.js';
import { enuStorageOutcome } from '../../packages/storage/src/index.js';

test('local multipart contract is immutable, resumable, bounded by opaque identity, and hash verified', async () => {
  const root = await mkdtemp(join(tmpdir(), 't5-local-'));
  try {
    const first = new clsLocalStorageAdapter(root);
    await first.ready();
    const bytes = Buffer.from('T5 canonical asset bytes');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const key = `${createHash('sha256').update('tenant-a').digest('hex')}/${randomUUID()}`;
    const transferId = randomUUID();
    const descriptor = { key, bytes: bytes.length, sha256, mediaType: 'text/plain' };
    const begin = await first.begin(descriptor, transferId);
    assert.equal(begin.kind, enuStorageOutcome.Success);
    assert.ok(begin.kind === enuStorageOutcome.Success && begin.uploadId);
    const part = { number: 1, bytes: bytes.length, sha256, etag: sha256 };
    await first.writePart(key, begin.uploadId!, part, bytes);
    const restarted = new clsLocalStorageAdapter(root);
    assert.equal((await restarted.parts(key, begin.uploadId!)).length, 1);
    assert.equal((await restarted.complete(descriptor, begin.uploadId!, [part])).kind, enuStorageOutcome.Success);
    assert.equal((await restarted.complete(descriptor, begin.uploadId!, [part])).kind, enuStorageOutcome.Success);
    const stream = await restarted.open(key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    assert.deepEqual(Buffer.concat(chunks), bytes);
    await assert.rejects(restarted.open('../escape'), /INVALID_STORAGE_KEY/);
    const tampered = { ...descriptor, sha256: '0'.repeat(64) };
    assert.equal((await restarted.complete(tampered, begin.uploadId!, [part])).kind, enuStorageOutcome.Failed);
  } finally { await rm(root, { recursive: true, force: true }); }
});

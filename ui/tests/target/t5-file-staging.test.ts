import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { clsFileStaging } from '../../packages/file-management/src/staging.js';

test('noncanonical staging streams bounded verified bytes, cleans failure and never exposes partial content', async () => {
  const root = await mkdtemp(join(tmpdir(), 't5-stage-'));
  const staging = new clsFileStaging({ root, maxBytes: 100, timeoutMs: 5000 });
  const bytes = Buffer.from('verified temporary input'), descriptor = {
    bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  let materialized = false;
  try {
    const actual = await staging.withVerifiedFile(descriptor, async () => Readable.from([bytes]),
      async path => { materialized = true; return readFile(path); });
    assert.equal(actual.toString(), bytes.toString()); assert.equal(materialized, true);
    materialized = false;
    await assert.rejects(staging.withVerifiedFile(descriptor, async () => Readable.from([Buffer.from('wrong')]),
      async () => { materialized = true; }), /FILE_INTEGRITY_FAILURE/);
    assert.equal(materialized, false);
    await assert.rejects(staging.withVerifiedFile(descriptor, async () => Readable.from([bytes, bytes]),
      async () => undefined), /FILE_INTEGRITY_FAILURE/);
    await assert.rejects(staging.withVerifiedFile({ ...descriptor, bytes: 101 }, async () => Readable.from([bytes]),
      async () => undefined), /FILE_CACHE_LIMIT/);
    await assert.rejects(staging.withVerifiedFile(descriptor, async () => Readable.from([bytes]),
      async () => { throw new Error('PROCESSOR_FAILED'); }), /PROCESSOR_FAILED/);
    assert.equal((await readdir(root)).filter(name => name.startsWith('staged-')).length, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readdir, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { clsFileCache } from '../../packages/file-management/src/cache.js';
import { parseByteRange } from '../../packages/file-management/src/range.js';

test('range boundaries reject multiple, malformed and unsafe ranges', () => {
  assert.deepEqual(parseByteRange('bytes=2-4', 10), { start: 2, end: 4, bytes: 3 });
  assert.deepEqual(parseByteRange('bytes=-3', 10), { start: 7, end: 9, bytes: 3 });
  assert.deepEqual(parseByteRange('bytes=4-', 10), { start: 4, end: 9, bytes: 6 });
  assert.deepEqual(parseByteRange('bytes=0-100', 10), { start: 0, end: 9, bytes: 10 });
  for (const value of ['bytes=0-1,4-5', 'bytes=10-', 'bytes=5-2', 'bytes=-0', 'bytes=-',
    'bytes=9007199254740992-', 'bytes=0-9007199254740992', '../../secret', 'bytes= 1-2'])
    assert.throws(() => parseByteRange(value, 10), /INVALID_RANGE/, value);
});
test('private bounded cache is version/tenant aware, rebuildable and verifies full bytes before ranges', async () => {
  const root = await mkdtemp(join(tmpdir(), 't5-cache-'));
  const cache = new clsFileCache({ root, maxBytes: 30, maxEntries: 2, ttlMs: 60000, timeoutMs: 5000 });
  const content = Buffer.from('original-contents');
  const descriptor = { bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') };
  const identity = { deploymentId: 'test', tenantId: 'tenant-a', assetId: randomUUID(), versionId: randomUUID(), representation: 'original' };
  let loads = 0;
  const load = async () => { loads += 1; return Readable.from([content]); };
  const read = async (body: Readable): Promise<string> => { const chunks: Buffer[] = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk)); return Buffer.concat(chunks).toString(); };
  try {
    assert.equal(await read((await cache.open(identity, descriptor, load)).body), content.toString());
    const second = await cache.open(identity, descriptor, load, { start: 0, end: 3, bytes: 4 });
    assert.equal(second.hit, true); assert.equal(await read(second.body), 'orig'); assert.equal(loads, 1);
    await read((await cache.open({ ...identity, versionId: randomUUID() }, descriptor, load)).body);
    assert.equal(loads, 2);
    assert.equal((await readdir(root)).filter(name => name.endsWith('.blob')).length, 1);
    await read((await cache.open({ ...identity, tenantId: 'tenant-b' }, descriptor, load)).body);
    assert.equal(loads, 3);
    for (const name of await readdir(root)) if (name.endsWith('.blob')) await rm(join(root, name));
    await read((await cache.open(identity, descriptor, load)).body); assert.equal(loads, 4);
    const filename = (await readdir(root)).find(name => name.endsWith('.blob'))!;
    await writeFile(join(root, filename), Buffer.from('corrupted'.padEnd(content.length, '!')));
    const recovered = await cache.open(identity, descriptor, load, { start: 0, end: 3, bytes: 4 });
    assert.equal(recovered.corruptionRecovered, true); assert.equal(await read(recovered.body), 'orig'); assert.equal(loads, 5);
    const restarted = new clsFileCache({ root, maxBytes: 30, maxEntries: 2, ttlMs: 60000, timeoutMs: 5000 });
    const reopened = await restarted.open(identity, descriptor, load);
    assert.equal(reopened.hit, true); await read(reopened.body);
    await assert.rejects(cache.open({ ...identity, assetId: randomUUID() }, descriptor,
      async () => Readable.from([Buffer.from('bad')])), /FILE_INTEGRITY_FAILURE/);
    const linkRoot = join(root, 'link'); await symlink(root, linkRoot);
    await assert.rejects(new clsFileCache({ root: linkRoot, maxBytes: 30, maxEntries: 2, ttlMs: 60000,
      timeoutMs: 5000 }).open(identity, descriptor, load), /FILE_CACHE_UNAVAILABLE/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('cache excludes concurrent fills and kernel releases its lock when the holder crashes', async () => {
  const root = await mkdtemp(join(tmpdir(), 't5-cache-crash-'));
  const options = { root, maxBytes: 100, maxEntries: 2, ttlMs: 60000, timeoutMs: 5000 };
  const content = Buffer.from('complete bytes'), descriptor = {
    bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') };
  const identity = { deploymentId: 'test', tenantId: 'tenant', assetId: randomUUID(), versionId: randomUUID(), representation: 'original' };
  const source = `import { clsFileCache } from './packages/file-management/src/cache.ts';
    import { Readable } from 'node:stream';
    const [options, identity, descriptor] = process.argv.slice(1).map(JSON.parse);
    await new clsFileCache(options).open(identity, descriptor, async () => {
      process.stdout.write('LOCKED');
      return new Readable({read() {}});
    });`;
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', source,
    JSON.stringify(options), JSON.stringify(identity), JSON.stringify(descriptor)], { stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('CACHE_CRASH_FIXTURE_TIMEOUT')); }, 5000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.stdout!.once('data', () => { clearTimeout(timer); resolve(); });
    });
    const stopped = new Promise<void>(resolve => child.once('close', () => resolve()));
    child.kill('SIGKILL'); await stopped;
    let loads = 0;
    const load = async () => { loads += 1; await new Promise(resolve => setTimeout(resolve, 25)); return Readable.from([content]); };
    const results = await Promise.all([new clsFileCache(options), new clsFileCache(options)]
      .map(cache => cache.open(identity, descriptor, load)));
    assert.equal(loads, 1); assert.deepEqual(results.map(result => result.hit).sort(), [false, true]);
    for (const result of results) { const chunks: Buffer[] = []; for await (const chunk of result.body) chunks.push(Buffer.from(chunk));
      assert.equal(Buffer.concat(chunks).toString(), content.toString()); }
    assert.equal((await readdir(root)).filter(name => name.includes('.pending-')).length, 0);
  } finally { child.kill('SIGKILL'); await rm(root, { recursive: true, force: true }); }
});

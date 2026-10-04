import { createHash, randomUUID } from 'node:crypto';
import { constants, createWriteStream } from 'node:fs';
import { open, lstat, readdir, rm, rename, utimes } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { Transform, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { intfByteRange } from './range.js';
import { exFileManagement } from './index.js';
import { withPrivateDirectoryLock, probePrivateDirectory } from './private-filesystem.js';

export interface intfFileCacheOptions {
  readonly root: string; readonly maxBytes: number; readonly maxEntries: number;
  readonly ttlMs: number; readonly timeoutMs: number;
}
export interface intfCacheIdentity {
  readonly deploymentId: string; readonly tenantId: string; readonly assetId: string;
  readonly versionId: string; readonly representation: string;
}
export interface intfCachedBody { readonly body: Readable; readonly hit: boolean; readonly corruptionRecovered: boolean }
interface intfCacheEntry { readonly name: string; readonly bytes: number; readonly modified: number }

/** Infrastructure only: bytes are reusable; permission decisions are never stored in this cache. */
export class clsFileCache {
  private readonly root: string;
  async ready():Promise<void>{await probePrivateDirectory(this.root);}
  constructor(private readonly options: intfFileCacheOptions) {
    this.root = resolve(options.root);
    if (![options.maxBytes, options.maxEntries, options.ttlMs, options.timeoutMs].every(value => Number.isSafeInteger(value) && value > 0))
      throw new exFileManagement('FILE_CACHE_LIMIT');
  }
  private async locked<T>(work: () => Promise<T>): Promise<T> {
    return withPrivateDirectoryLock(this.root, this.options.timeoutMs, async () => {
      for (const name of await readdir(this.root)) if (/^[a-f0-9]{64}\.pending-[a-f0-9-]{36}$/u.test(name))
        await rm(join(this.root, name), { force: true });
      return await work();
    });
  }
  private async entries(): Promise<readonly intfCacheEntry[]> {
    const result: intfCacheEntry[] = [];
    for (const name of await readdir(this.root)) {
      if (!/^[a-f0-9]{64}\.blob$/u.test(name)) continue;
      const details = await lstat(join(this.root, name)).catch(() => null);
      if (!details) continue;
      if (!details.isFile() || details.isSymbolicLink() || details.mtimeMs + this.options.ttlMs < Date.now()) {
        await rm(join(this.root, name), { force: true }); continue;
      }
      result.push({ name, bytes: details.size, modified: details.mtimeMs });
    }
    return result.sort((a, b) => a.modified - b.modified || a.name.localeCompare(b.name));
  }
  private async reserve(bytes: number, except: string): Promise<void> {
    const entries = (await this.entries()).filter(entry => entry.name !== except);
    let used = entries.reduce((total, entry) => total + entry.bytes, 0), count = entries.length;
    for (const entry of entries) {
      if (used + bytes <= this.options.maxBytes && count + 1 <= this.options.maxEntries) break;
      await rm(join(this.root, entry.name), { force: true }); used -= entry.bytes; count -= 1;
    }
  }
  private async verified(path: string, descriptor: Readonly<{ bytes: number; sha256: string }>,
    range?: intfByteRange): Promise<Readable> {
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const details = await file.stat();
      if (!details.isFile() || details.size !== descriptor.bytes) throw new exFileManagement('FILE_INTEGRITY_FAILURE');
      const hash = createHash('sha256'), buffer = Buffer.alloc(64 * 1024);
      let position = 0;
      for (;;) {
        const read = await file.read(buffer, 0, buffer.length, position);
        if (read.bytesRead === 0) break;
        hash.update(buffer.subarray(0, read.bytesRead)); position += read.bytesRead;
      }
      if (hash.digest('hex') !== descriptor.sha256) throw new exFileManagement('FILE_INTEGRITY_FAILURE');
      return file.createReadStream({ autoClose: true, start: range?.start ?? 0, end: range?.end });
    } catch (error) { await file.close(); throw error; }
  }
  async open(identity: intfCacheIdentity, descriptor: Readonly<{ bytes: number; sha256: string }>,
    load: () => Promise<Readable>, range?: intfByteRange): Promise<intfCachedBody> {
    if (!Number.isSafeInteger(descriptor.bytes) || descriptor.bytes < 1 || descriptor.bytes > this.options.maxBytes
      || !/^[a-f0-9]{64}$/u.test(descriptor.sha256)) throw new exFileManagement('FILE_CACHE_LIMIT');
    const key = createHash('sha256').update(JSON.stringify([identity.deploymentId, identity.tenantId,
      identity.assetId, identity.versionId, descriptor.sha256, identity.representation])).digest('hex');
    return this.locked(async () => {
      const name = `${key}.blob`, path = join(this.root, name);
      const entries = await this.entries();
      let corruptionRecovered = false;
      if (entries.some(entry => entry.name === name)) {
        try {
          const body = await this.verified(path, descriptor, range);
          await utimes(path, new Date(), new Date());
          await this.reserve(descriptor.bytes, name);
          return { body, hit: true, corruptionRecovered };
        } catch {
          corruptionRecovered = true;
          await rm(path, { force: true });
        }
      }
      await this.reserve(descriptor.bytes, name);
      const temporary = join(this.root, `${key}.pending-${randomUUID()}`);
      try {
        const hash = createHash('sha256'); let bytes = 0;
        const verify = new Transform({ transform(chunk: Buffer, _encoding, callback) {
          bytes += chunk.byteLength;
          if (bytes > descriptor.bytes) { callback(new exFileManagement('FILE_INTEGRITY_FAILURE')); return; }
          hash.update(chunk); callback(null, chunk);
        } });
        await pipeline(await load(), verify, createWriteStream(temporary, { flags: 'wx', mode: 0o600 }),
          { signal: AbortSignal.timeout(this.options.timeoutMs) });
        if (bytes !== descriptor.bytes || hash.digest('hex') !== descriptor.sha256)
          throw new exFileManagement('FILE_INTEGRITY_FAILURE');
        const file = await open(temporary, constants.O_RDONLY | constants.O_NOFOLLOW);
        try { await file.sync(); } finally { await file.close(); }
        await rename(temporary, path);
        const body = await this.verified(path, descriptor, range);
        return { body, hit: false, corruptionRecovered };
      } finally { await rm(temporary, { force: true }); }
    });
  }
}

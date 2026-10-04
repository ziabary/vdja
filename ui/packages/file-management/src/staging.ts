import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { withPrivateDirectoryLock, probePrivateDirectory } from './private-filesystem.js';
import { exFileManagement } from './index.js';

export interface intfFileStagingOptions { readonly root: string; readonly maxBytes: number; readonly timeoutMs: number }
/** Disposable scratch, serialized and bounded on a private volume; canonical bytes stay in Storage. */
export class clsFileStaging {
  private readonly root: string;
  async ready():Promise<void>{await probePrivateDirectory(this.root);}
  constructor(private readonly options: intfFileStagingOptions) {
    this.root = resolve(options.root);
    if (!this.root.startsWith(`${resolve(tmpdir())}/`) || !Number.isSafeInteger(options.maxBytes) || options.maxBytes < 1
      || !Number.isInteger(options.timeoutMs) || options.timeoutMs < 1) throw new exFileManagement('INVALID_TRANSFER');
  }
  async withVerifiedFile<T>(descriptor: Readonly<{ bytes: number; sha256: string }>, load: () => Promise<Readable>,
    work: (path: string) => Promise<T>): Promise<T> {
    if (!Number.isSafeInteger(descriptor.bytes) || descriptor.bytes < 1 || descriptor.bytes > this.options.maxBytes
      || !/^[a-f0-9]{64}$/u.test(descriptor.sha256)) throw new exFileManagement('FILE_CACHE_LIMIT');
    return withPrivateDirectoryLock(this.root, this.options.timeoutMs, async () => {
      for (const name of await readdir(this.root)) if (/^staged-[a-f0-9-]{36}$/u.test(name)) await rm(join(this.root, name), { force: true });
      const path = join(this.root, `staged-${randomUUID()}`), hash = createHash('sha256'); let bytes = 0;
      try {
        const verify = new Transform({ transform(chunk: Buffer, _encoding, callback) {
          bytes += chunk.byteLength;
          if (bytes > descriptor.bytes) { callback(new exFileManagement('FILE_INTEGRITY_FAILURE')); return; }
          hash.update(chunk); callback(null, chunk);
        } });
        await pipeline(await load(), verify, createWriteStream(path, { flags: 'wx', mode: 0o600 }),
          { signal: AbortSignal.timeout(this.options.timeoutMs) });
        if (bytes !== descriptor.bytes || hash.digest('hex') !== descriptor.sha256)
          throw new exFileManagement('FILE_INTEGRITY_FAILURE');
        return await work(path);
      } finally { await rm(path, { force: true }); }
    });
  }
}

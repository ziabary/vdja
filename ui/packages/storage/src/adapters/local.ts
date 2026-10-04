import { createHash, randomUUID } from 'node:crypto';
import { constants, createWriteStream } from 'node:fs';
import { mkdir, open, realpath, readdir, link, rm, stat, lstat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { enuStorageKind, enuStorageOutcome, exStorage, validateStorageKey, validateStorageDescriptor as descriptor,
  type intfStorageDescriptor, type intfStoragePart, type intfStoragePort,
  type typStorageMutation } from '../index.js';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const HASH = /^[a-f0-9]{64}$/u;

async function durableWrite(path: string, bytes: Uint8Array): Promise<void> {
  const file = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
}
async function hashFile(path: string): Promise<Readonly<{ bytes: number; sha256: string }>> {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const details = await file.stat();
    if (!details.isFile()) throw new exStorage('INTEGRITY_FAILURE');
    const hash = createHash('sha256'), buffer = Buffer.alloc(64 * 1024);
    let position = 0;
    for (;;) {
      const read = await file.read(buffer, 0, buffer.length, position);
      if (read.bytesRead === 0) break;
      hash.update(buffer.subarray(0, read.bytesRead)); position += read.bytesRead;
    }
    return { bytes: details.size, sha256: hash.digest('hex') };
  } finally { await file.close(); }
}
async function readMetadata(path: string): Promise<string> {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const details = await file.stat();
    if (!details.isFile() || details.size > 4096) throw new exStorage('INTEGRITY_FAILURE');
    return await file.readFile('utf8');
  } finally { await file.close(); }
}
function sameDescriptor(a: intfStorageDescriptor, b: intfStorageDescriptor): boolean {
  return a.key === b.key && a.bytes === b.bytes && a.sha256 === b.sha256 && a.mediaType === b.mediaType;
}
async function persistDescriptor(path: string, input: intfStorageDescriptor): Promise<void> {
  try { await durableWrite(path, Buffer.from(JSON.stringify(input))); }
  catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
    if (!sameDescriptor(descriptor(JSON.parse(await readMetadata(path)) as unknown), input))
      throw new exStorage('INTEGRITY_FAILURE');
  }
}

/** Private immutable objects and resumable staging; only this adapter constructs physical paths. */
export class clsLocalStorageAdapter implements intfStoragePort {
  readonly kind = enuStorageKind.Local;
  private readonly root: string;
  constructor(root: string) { this.root = resolve(root); }

  async ready(): Promise<void> {
    await this.directory(this.root);
    await this.directory(join(this.root, '.staging'));
    const probe = join(this.root, `.probe-${randomUUID()}`);
    await durableWrite(probe, Buffer.from('ready'));
    await rm(probe);
  }
  private async directory(path: string): Promise<void> {
    await mkdir(path, { recursive: true, mode: 0o700 });
    const details = await lstat(path);
    if (await realpath(path) !== path || !details.isDirectory() || (details.mode & 0o077) !== 0)
      throw new exStorage('INVALID_STORAGE_KEY');
  }
  private async objectPath(key: string): Promise<string> {
    validateStorageKey(key);
    if (await realpath(this.root) !== this.root) throw new exStorage('INVALID_STORAGE_KEY');
    const [namespace, identity] = key.split('/');
    const directory = join(this.root, namespace!);
    await this.directory(directory);
    return join(directory, identity!);
  }
  private async stagePath(uploadId: string): Promise<string> {
    if (!UUID.test(uploadId)) throw new exStorage('INVALID_STORAGE_KEY');
    await this.directory(join(this.root, '.staging'));
    const directory = join(this.root, '.staging', uploadId);
    await this.directory(directory);
    return directory;
  }
  async begin(input: intfStorageDescriptor, transferId: string): Promise<typStorageMutation> {
    descriptor(input);
    const directory = await this.stagePath(transferId);
    const path = join(directory, 'manifest.json');
    try { await durableWrite(path, Buffer.from(JSON.stringify(input))); }
    catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
      const known = descriptor(JSON.parse(await readMetadata(path)) as unknown);
      if (!sameDescriptor(known, input)) return { kind: enuStorageOutcome.Failed, reason: 'PART_CONFLICT' };
    }
    return { kind: enuStorageOutcome.Success, uploadId: transferId };
  }
  async reconcileBegin(key: string, transferId: string): Promise<string | null> {
    validateStorageKey(key);
    const directory = await this.stagePath(transferId);
    const data = await readMetadata(join(directory, 'manifest.json')).catch(() => null);
    if (data === null) return null;
    return descriptor(JSON.parse(data) as unknown).key === key ? transferId : null;
  }
  async writePart(key: string, uploadId: string, part: intfStoragePart, bytes: Uint8Array,
    signal?: AbortSignal): Promise<intfStoragePart> {
    validateStorageKey(key);
    signal?.throwIfAborted();
    if (!Number.isInteger(part.number) || part.number < 1 || part.number > 10000
      || bytes.byteLength !== part.bytes || !HASH.test(part.sha256)
      || createHash('sha256').update(bytes).digest('hex') !== part.sha256)
      throw new exStorage('INVALID_STORAGE_PART');
    const directory = await this.stagePath(uploadId);
    const known = descriptor(JSON.parse(await readMetadata(join(directory, 'manifest.json'))) as unknown);
    if (known.key !== key) throw new exStorage('PART_CONFLICT');
    const path = join(directory, `part-${part.number}`);
    try { await durableWrite(path, bytes); }
    catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
      const existing = await hashFile(path);
      if (existing.bytes !== part.bytes || existing.sha256 !== part.sha256) throw new exStorage('PART_CONFLICT');
    }
    return { ...part, etag: part.sha256 };
  }
  async parts(key: string, uploadId: string): Promise<readonly intfStoragePart[]> {
    validateStorageKey(key);
    const directory = await this.stagePath(uploadId);
    const known = descriptor(JSON.parse(await readMetadata(join(directory, 'manifest.json'))) as unknown);
    if (known.key !== key) throw new exStorage('PART_CONFLICT');
    const parts: intfStoragePart[] = [];
    for (const name of await readdir(directory)) {
      const match = /^part-([1-9][0-9]{0,3}|10000)$/u.exec(name);
      if (!match) continue;
      const value = await hashFile(join(directory, name));
      parts.push({ number: Number(match[1]), ...value, etag: value.sha256 });
    }
    return parts.sort((a, b) => a.number - b.number);
  }
  async complete(input: intfStorageDescriptor, uploadId: string,
    parts: readonly intfStoragePart[]): Promise<typStorageMutation> {
    descriptor(input);
    const path = await this.objectPath(input.key);
    const existing = await stat(path).catch(() => null);
    if (existing) {
      const digest = await hashFile(path);
      if (digest.bytes !== input.bytes || digest.sha256 !== input.sha256)
        return { kind: enuStorageOutcome.Failed, reason: 'INTEGRITY_FAILURE' };
      await persistDescriptor(`${path}.json`, input);
      return { kind: enuStorageOutcome.Success };
    }
    const directory = await this.stagePath(uploadId);
    const manifest = descriptor(JSON.parse(await readMetadata(join(directory, 'manifest.json'))) as unknown);
    if (manifest.key !== input.key || manifest.sha256 !== input.sha256 || manifest.bytes !== input.bytes)
      return { kind: enuStorageOutcome.Failed, reason: 'PART_CONFLICT' };
    if (!parts.length || parts.some((part, index) => part.number !== index + 1)
      || parts.reduce((size, part) => size + part.bytes, 0) !== input.bytes)
      return { kind: enuStorageOutcome.Failed, reason: 'INVALID_STORAGE_PART' };
    const temporary = `${path}.pending-${randomUUID()}`;
    try {
      const chunks = async function* (): AsyncGenerator<Buffer> {
        for (const part of parts) {
          const partPath = join(directory, `part-${part.number}`);
          const known = await hashFile(partPath);
          if (known.sha256 !== part.sha256 || known.bytes !== part.bytes) throw new exStorage('INTEGRITY_FAILURE');
          const file = await open(partPath, constants.O_RDONLY | constants.O_NOFOLLOW);
          try { for await (const chunk of file.createReadStream()) yield Buffer.from(chunk); }
          finally { await file.close(); }
        }
      };
      await pipeline(Readable.from(chunks()), createWriteStream(temporary, { flags: 'wx', mode: 0o600 }));
      const verified = await hashFile(temporary);
      if (verified.sha256 !== input.sha256 || verified.bytes !== input.bytes)
        return { kind: enuStorageOutcome.Failed, reason: 'INTEGRITY_FAILURE' };
      const file = await open(temporary, constants.O_RDONLY | constants.O_NOFOLLOW);
      try { await file.sync(); } finally { await file.close(); }
      try { await link(temporary, path); }
      catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
        const concurrent = await hashFile(path);
        if (concurrent.sha256 !== input.sha256 || concurrent.bytes !== input.bytes)
          return { kind: enuStorageOutcome.Failed, reason: 'INTEGRITY_FAILURE' };
      }
      await persistDescriptor(`${path}.json`, input);
      const parent = await open(join(this.root, input.key.split('/')[0]!), constants.O_RDONLY);
      try { await parent.sync(); } finally { await parent.close(); }
      return { kind: enuStorageOutcome.Success };
    } finally { await rm(temporary, { force: true }); }
  }
  async inspect(key: string): Promise<intfStorageDescriptor | null> {
    const path = await this.objectPath(key);
    const data = await readMetadata(`${path}.json`).catch(() => null);
    if (data === null) return null;
    const found = descriptor(JSON.parse(data) as unknown);
    if (found.key !== key) throw new exStorage('INTEGRITY_FAILURE');
    return found;
  }
  async open(key: string, signal?: AbortSignal): Promise<Readable> {
    const path = await this.objectPath(key);
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
      .catch(() => { throw new exStorage('STORAGE_NOT_FOUND'); });
    return file.createReadStream({ ...(signal ? { signal } : {}) });
  }
  async abort(key: string, uploadId: string): Promise<void> {
    validateStorageKey(key);
    const directory = await this.stagePath(uploadId);
    const data = await readMetadata(join(directory, 'manifest.json')).catch(() => null);
    if (data !== null && descriptor(JSON.parse(data) as unknown).key !== key) throw new exStorage('PART_CONFLICT');
    await rm(directory, { recursive: true, force: true });
  }
}

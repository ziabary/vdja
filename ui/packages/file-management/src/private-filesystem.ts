import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { mkdir, lstat, realpath, open, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { exFileManagement } from './index.js';

export async function privateDirectory(root: string): Promise<void> {
  if (resolve(root) !== root) throw new exFileManagement('FILE_CACHE_UNAVAILABLE');
  await mkdir(root, { recursive: true, mode: 0o700 });
  const details = await lstat(root);
  if (await realpath(root) !== root || !details.isDirectory() || details.isSymbolicLink() || (details.mode & 0o077) !== 0)
    throw new exFileManagement('FILE_CACHE_UNAVAILABLE');
}
/** Only disposable infrastructure is probed; no content is opened and no permission is decided. */
export async function probePrivateDirectory(root: string): Promise<void> {
  await privateDirectory(root);
  const path=join(root, `.readiness-${randomUUID()}`);
  const file=await open(path, constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW, 0o600);
  try {await file.sync();} finally {await file.close();await unlink(path);}
}
/** Kernel-owned advisory lock, bounded acquisition and automatic release on process crash. */
export async function withPrivateDirectoryLock<T>(root: string, timeoutMs: number, work: () => Promise<T>, key?: string): Promise<T> {
  await privateDirectory(root);
  if(key!==undefined&&!/^[a-f0-9]{64}$/u.test(key))throw new exFileManagement('FILE_CACHE_UNAVAILABLE');
  const lockPath=join(root,key?`.lock-${key}`:'.file-management-lock');
  const file = await open(lockPath, constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
  try {
    if (!(await file.stat()).isFile()) throw new exFileManagement('FILE_CACHE_UNAVAILABLE');
    await new Promise<void>((resolve, reject) => {
      const child = spawn('flock', ['--exclusive', '--timeout', String(timeoutMs / 1000), '3'],
        { stdio: ['ignore', 'ignore', 'ignore', file.fd], timeout: timeoutMs + 1000 });
      child.once('error', () => reject(new exFileManagement('FILE_CACHE_UNAVAILABLE')));
      child.once('close', code => code === 0 ? resolve() : reject(new exFileManagement('FILE_CACHE_UNAVAILABLE')));
    });
    // A quota sweep may unlink an idle key lock. Never enter through a stale inode.
    const held=await file.stat(), current=await lstat(lockPath).catch(()=>null);
    if(!current||current.isSymbolicLink()||current.ino!==held.ino||current.dev!==held.dev)throw new exFileManagement('FILE_CACHE_UNAVAILABLE');
    return await work();
  } finally { await file.close(); }
}

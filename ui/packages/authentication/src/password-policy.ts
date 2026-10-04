import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { isCommonPassword } from './common-passwords.js';

export interface intfCompromisedPasswordChecker {
  readonly isCompromised: (password: string) => Promise<boolean>;
}

export interface intfPasswordPolicy {
  readonly contextWords: readonly string[];
  readonly compromised: intfCompromisedPasswordChecker;
}

/** NFKC, Arabic/Persian letter forms, and Unicode lowercasing apply on both sides. */
export function normalizePasswordContext(value: string): string {
  return value.normalize('NFKC').replace(/ك/gu, 'ک').replace(/[يى]/gu, 'ی').toLocaleLowerCase('und');
}

export function forbiddenContextWord(password: string, words: readonly string[]): string | null {
  const normalizedPassword = normalizePasswordContext(password);
  for (const raw of words) {
    const word = normalizePasswordContext(raw.trim());
    if (word.length >= 4 && normalizedPassword.includes(word)) return raw;
  }
  return null;
}

export async function assertNewPasswordAllowed(password: string, policy: intfPasswordPolicy): Promise<void> {
  if (typeof password !== 'string' || password.length < 15 || password.length > 128 || password.includes('\0')) throw new Error('INVALID_PASSWORD');
  if (isCommonPassword(password)) throw new Error('COMMON_PASSWORD');
  if (forbiddenContextWord(password, policy.contextWords) !== null) throw new Error('CONTEXT_PASSWORD');
  if (await policy.compromised.isCompromised(password)) throw new Error('COMPROMISED_PASSWORD');
}

/** Local corpus: one SHA-1 suffix per line in a file named by its five-character SHA-1 prefix. */
export function localSha1CompromisedChecker(directory: string): intfCompromisedPasswordChecker {
  if (!directory.startsWith('/') || directory.includes('\0')) throw new Error('INVALID_BREACH_CORPUS');
  return { isCompromised: async password => {
    const hash = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
    const prefix = hash.slice(0, 5), suffix = hash.slice(5);
    let contents: string;
    try {
      const file = await open(join(directory, prefix), 'r');
      try {
        const stat = await file.stat();
        if (!stat.isFile() || stat.size > 8_000_000) throw new Error('BREACH_CHECK_UNAVAILABLE');
        const buffer = Buffer.alloc(stat.size + 1);
        let offset = 0;
        while (offset < buffer.length) {
          const { bytesRead } = await file.read(buffer, offset, buffer.length - offset, offset);
          if (!bytesRead) break;
          offset += bytesRead;
        }
        if (offset !== stat.size) throw new Error('BREACH_CHECK_UNAVAILABLE');
        contents = buffer.subarray(0, offset).toString('ascii');
      } finally { await file.close(); }
    }
    catch { throw new Error('BREACH_CHECK_UNAVAILABLE'); }
    if (contents.length > 8_000_000 || !/^(?:[A-F0-9]{35}(?::[0-9]{1,12})?\r?\n)*$/u.test(contents))
      throw new Error('BREACH_CHECK_UNAVAILABLE');
    return contents.split(/\r?\n/u).some(line => line.slice(0, 35) === suffix);
  } };
}

/** Generic range API. Only the five-character SHA-1 prefix crosses the network. */
export function rangeApiCompromisedChecker(baseUrl: string, timeoutMs: number): intfCompromisedPasswordChecker {
  const endpoint = new URL(baseUrl);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.hash || endpoint.search
    || !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 10_000) throw new Error('INVALID_BREACH_PROVIDER');
  return { isCompromised: async password => {
    const hash = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
    const prefix = hash.slice(0, 5), suffix = hash.slice(5);
    let response: Response;
    try { response = await fetch(`${baseUrl.replace(/\/$/u, '')}/${prefix}`, {
      method: 'GET', headers: { 'Accept': 'text/plain' }, signal: AbortSignal.timeout(timeoutMs), redirect: 'error'
    }); } catch { throw new Error('BREACH_CHECK_UNAVAILABLE'); }
    if (!response.ok || Number(response.headers.get('content-length') ?? 0) > 8_000_000) throw new Error('BREACH_CHECK_UNAVAILABLE');
    if (!response.body) throw new Error('BREACH_CHECK_UNAVAILABLE');
    const parts: Uint8Array[] = [];
    let size = 0;
    try {
      for await (const part of response.body) {
        size += part.length;
        if (size > 8_000_000) throw new Error('BREACH_CHECK_UNAVAILABLE');
        parts.push(part);
      }
    } catch { throw new Error('BREACH_CHECK_UNAVAILABLE'); }
    const body = Buffer.concat(parts).toString('ascii');
    if (body.length > 8_000_000 || !/^(?:[A-F0-9]{35}:[0-9]{1,12}\r?\n)*$/u.test(body)) throw new Error('BREACH_CHECK_UNAVAILABLE');
    return body.split(/\r?\n/u).some(line => line.slice(0, 35) === suffix);
  } };
}

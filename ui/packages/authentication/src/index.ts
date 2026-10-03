import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { isCommonPassword } from './common-passwords.js';
export interface intfLoginMembership { readonly membershipId: string; readonly tenantId: string }
export type typLoginResult =
  | Readonly<{ kind: 'AUTHENTICATED'; identityId: string; memberships: readonly intfLoginMembership[] }>
  | Readonly<{ kind: 'INVALID' }>
  | Readonly<{ kind: 'RATE_LIMITED' }>;
const N = 1 << 17;
const R = 8;
const P = 1;
const KEY_BYTES = 32;
const MAX_MEMORY_BYTES = 256 * 1024 * 1024;
const HASH_PATTERN = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{43})$/;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => nodeScrypt(password, salt, KEY_BYTES,
    { N, r: R, p: P, maxmem: MAX_MEMORY_BYTES },
    (error, key) => error ? reject(error) : resolve(key)));
}

/** OWASP's scrypt fallback floor: N=2^17, r=8, p=1; no reversible password material is persisted. */
export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== 'string' || password.length < 15 || password.length > 128 || password.includes('\0')) throw new Error('INVALID_PASSWORD');
  if (isCommonPassword(password)) throw new Error('COMMON_PASSWORD');
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  if (typeof password !== 'string' || password.length > 128 || password.includes('\0')) return false;
  const match = typeof encoded === 'string' ? HASH_PATTERN.exec(encoded) : null;
  if (!match || Number(match[1]) !== N || Number(match[2]) !== R || Number(match[3]) !== P) return false;
  const salt = Buffer.from(match[4]!, 'base64url'), expected = Buffer.from(match[5]!, 'base64url');
  if (salt.length !== 16 || expected.length !== KEY_BYTES) return false;
  const candidate = await derive(password, salt);
  return timingSafeEqual(candidate, expected);
}

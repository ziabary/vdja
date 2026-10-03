import { createHash, randomBytes } from 'node:crypto';

export type typRefreshOutcome =
  | Readonly<{ kind: 'ROTATED'; refreshToken: string; sessionId: string; identityId: string; tenantId: string; authorizationVersion: number }>
  | Readonly<{ kind: 'REPLAY'; sessionId: string; identityId: string; tenantId: string }>
  | Readonly<{ kind: 'INVALID' }>;

/** Opaque 256-bit bearer credential. Only its SHA-256 representation is persisted. */
export function issueRefreshToken(): string { return randomBytes(32).toString('base64url'); }
export function hashRefreshToken(token: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('INVALID_REFRESH_TOKEN_FORMAT');
  return createHash('sha256').update(token, 'ascii').digest('hex');
}

export interface intfSessionStore {
  rotate(oldHash: string, newHash: string): Promise<
    | Readonly<{ kind: 'ROTATED'; sessionId: string; identityId: string; tenantId: string; authorizationVersion: number }>
    | Readonly<{ kind: 'REPLAY'; sessionId: string; identityId: string; tenantId: string }>
    | Readonly<{ kind: 'INVALID' }>
  >;
}

export async function rotateRefreshToken(store: intfSessionStore, rawToken: string): Promise<typRefreshOutcome> {
  let oldHash: string;
  try { oldHash = hashRefreshToken(rawToken); } catch { return { kind: 'INVALID' }; }
  const candidate = issueRefreshToken();
  const result = await store.rotate(oldHash, hashRefreshToken(candidate));
  return result.kind === 'ROTATED' ? { ...result, refreshToken: candidate } : result;
}

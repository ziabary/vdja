const REFRESH_COOKIE = '__Secure-tg_refresh';
const REFRESH_PATH = '/api/auth';

export type typRefreshCookie = Readonly<{ kind: 'VALID'; token: string }>
  | Readonly<{ kind: 'MISSING' | 'INVALID' | 'AMBIGUOUS' }>;

export function inspectRefreshCookie(header: string | undefined): typRefreshCookie {
  if (!header) return { kind: 'MISSING' };
  if (header.length > 8192) return { kind: 'INVALID' };
  const matches = header.split(';').map(part => part.trim()).filter(part => part.startsWith(`${REFRESH_COOKIE}=`));
  if (matches.length > 1) return { kind: 'AMBIGUOUS' };
  if (matches.length === 0) return { kind: 'MISSING' };
  const token = matches[0]!.slice(REFRESH_COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? { kind: 'VALID', token } : { kind: 'INVALID' };
}

export function readRefreshCookie(header: string | undefined): string | null {
  const result = inspectRefreshCookie(header);
  return result.kind === 'VALID' ? result.token : null;
}

export function refreshSetCookie(token: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('INVALID_REFRESH_TOKEN_FORMAT');
  return `${REFRESH_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=${REFRESH_PATH}`;
}

export function refreshClearCookie(): string {
  return `${REFRESH_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=${REFRESH_PATH}; Max-Age=0`;
}

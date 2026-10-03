const REFRESH_COOKIE = '__Secure-tg_refresh';
const REFRESH_PATH = '/api/auth';

export function readRefreshCookie(header: string | undefined): string | null {
  if (!header || header.length > 8192) return null;
  const matches = header.split(';').map(part => part.trim()).filter(part => part.startsWith(`${REFRESH_COOKIE}=`));
  if (matches.length !== 1) return null;
  const value = matches[0]!.slice(REFRESH_COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

export function refreshSetCookie(token: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('INVALID_REFRESH_TOKEN_FORMAT');
  return `${REFRESH_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=${REFRESH_PATH}`;
}

export function refreshClearCookie(): string {
  return `${REFRESH_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=${REFRESH_PATH}; Max-Age=0`;
}

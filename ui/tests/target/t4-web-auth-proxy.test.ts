import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forwardPublicApiRequest } from '../../apps/web/src/lib/api/transport.js';

test('Web proxy forwards auth Origin and cookie, returns narrow refresh Set-Cookie', async () => {
  const previous = globalThis.fetch;
  const seen: Headers[] = [];
  globalThis.fetch = (async (_input, init) => {
    seen.push(new Headers(init?.headers));
    return new Response('{}', { status: 200, headers: {
      'content-type': 'application/json', 'set-cookie': '__Secure-tg_refresh=value; HttpOnly; Secure; SameSite=Strict; Path=/api/auth'
    } });
  }) as typeof fetch;
  try {
    const headers = { origin: 'https://web.example.invalid', cookie: '__Secure-tg_refresh=opaque', 'content-type': 'application/json' };
    const auth = await forwardPublicApiRequest(new URL('https://api.example.invalid/api/auth/refresh'),
      new Request('https://web.example.invalid/api/auth/refresh', { method: 'POST', headers, body: '{}' }));
    assert.equal(seen[0]?.get('origin'), headers.origin);
    assert.equal(seen[0]?.get('cookie'), headers.cookie);
    assert.match(auth.headers.get('set-cookie') ?? '', /Path=\/api\/auth/);
    const publicResponse = await forwardPublicApiRequest(new URL('https://api.example.invalid/api/translate'),
      new Request('https://web.example.invalid/api/translate', { method: 'POST', headers, body: '{}' }));
    assert.equal(seen[1]?.get('origin'), null);
    assert.equal(seen[1]?.get('cookie'), null);
    assert.equal(publicResponse.headers.get('set-cookie'), null);
    await forwardPublicApiRequest(new URL('https://api.example.invalid/api/auth/me'),
      new Request('https://web.example.invalid/api/auth/me', { headers: { authorization: 'Bearer access-token', cookie: headers.cookie } }));
    assert.equal(seen[2]?.get('authorization'), 'Bearer access-token');
    assert.equal(seen[2]?.get('cookie'), null);
  } finally { globalThis.fetch = previous; }
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forwardPublicApiRequest, postAuthRequest } from '../../apps/web/src/lib/api/transport.js';

test('Web public API gateway never forwards or returns refresh credentials', async () => {
  const previous = globalThis.fetch;
  const seen: Headers[] = [];
  globalThis.fetch = (async (_input, init) => {
    seen.push(new Headers(init?.headers));
    return new Response('{}', { status: 200, headers: {
      'content-type': 'application/json', 'set-cookie': '__Host-tg_refresh=value; HttpOnly; Secure; SameSite=Strict; Path=/'
    } });
  }) as typeof fetch;
  try {
    const request = new Request('https://app.example.invalid/api/translate', { method: 'POST',
      headers: { origin: 'https://app.example.invalid', cookie: '__Host-tg_refresh=opaque', authorization: 'Bearer access-token' }, body: '{}' });
    const response = await forwardPublicApiRequest(new URL('http://api.internal/api/translate'), request);
    assert.equal(seen[0]?.get('origin'), null);
    assert.equal(seen[0]?.get('cookie'), null);
    assert.equal(seen[0]?.get('authorization'), 'Bearer access-token');
    assert.equal(response.headers.get('set-cookie'), null);
  } finally { globalThis.fetch = previous; }
});

test('browser Auth transport targets the dedicated origin with credentials', async () => {
  const previous = globalThis.fetch;
  let target = '', options: RequestInit | undefined;
  globalThis.fetch = (async (input, init) => { target = String(input); options = init; return new Response('{}'); }) as typeof fetch;
  try {
    await postAuthRequest('https://auth.example.invalid', 'refresh');
    assert.equal(target, 'https://auth.example.invalid/api/auth/refresh');
    assert.equal(options?.credentials, 'include');
    assert.throws(() => postAuthRequest('https://auth.example.invalid/path', 'login'), /Invalid Auth origin/);
  } finally { globalThis.fetch = previous; }
});

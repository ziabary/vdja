import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { test } from 'node:test';
import { resolve } from 'node:path';

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('NO_PORT');
  const port = address.port;
  server.close();
  await once(server, 'close');
  return port;
}

test('release Web process applies security headers to built static assets', async () => {
  const port = await freePort();
  const child = spawn(process.execPath, ['deploy/entrypoint.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, TARGOMAN_ROLE: 'web', HOST: '127.0.0.1', PORT: String(port),
      TARGOMAN_CONFIG_PATH: resolve('deploy/examples/development/platform.cjson') },
    stdio: 'ignore'
  });
  try {
    let response;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try { response = await fetch(`http://127.0.0.1:${port}/brand/logo.svg`); break; }
      catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    assert.ok(response, 'Web release process did not start');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.match(response.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
    const html = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(html.status, 200);
    assert.match(html.headers.get('content-security-policy') ?? '', /script-src[^;]*'nonce-/);
    assert.equal(html.headers.get('x-content-type-options'), 'nosniff');
  } finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await once(child, 'exit').catch(() => undefined);
    }
  }
});

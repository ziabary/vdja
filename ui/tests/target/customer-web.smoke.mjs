import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const cases = [
  { customer: 'customer-a', brand: 'Aster AI', enabled: ['translate'] },
  { customer: 'customer-b', brand: 'Boreal AI', enabled: ['translate', 'summarize'] },
  { customer: 'customer-c', brand: 'Cedar AI', enabled: ['translate', 'summarize', 'faq'] },
];
const hashes = new Set();
for (const [index, item] of cases.entries()) {
  const port = 3430 + index;
  const configPath = resolve(`deploy/examples/${item.customer}/platform.cjson`);
  hashes.add(createHash('sha256').update(await readFile(`deploy/examples/${item.customer}/brand/logo.svg`)).digest('hex'));
  const child = spawn(process.execPath, ['apps/web/build/index.js'], { env: { ...process.env,
    TARGOMAN_CONFIG_PATH: configPath, HOST: '127.0.0.1', PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', chunk => { output += chunk.toString(); }); child.stderr.on('data', chunk => { output += chunk.toString(); });
  try {
    let home;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (child.exitCode !== null) throw new Error(`${item.customer}: Web exited: ${output}`);
      try { home = await fetch(`http://127.0.0.1:${port}/`); break; } catch { await new Promise(done => setTimeout(done, 100)); }
    }
    assert.ok(home, `${item.customer}: Web did not start: ${output}`);
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.ok(html.includes(item.brand), `${item.customer}: missing brand`);
    assert.ok(!html.includes('login-link'), `${item.customer}: unexpected Login`);
    for (const route of ['translate', 'summarize', 'faq']) {
      const enabled = item.enabled.includes(route);
      assert.equal(html.includes(`href="./${route}"`), enabled, `${item.customer}: ${route} home link`);
      const response = await fetch(`http://127.0.0.1:${port}/${route}`);
      assert.equal(response.status, enabled ? 200 : 404, `${item.customer}: ${route} route`);
    }
    process.stdout.write(`${item.customer}: brand and module routes PASS\n`);
  } finally { child.kill('SIGTERM'); await new Promise(done => child.once('exit', done)); }
}
assert.equal(hashes.size, 3, 'customer Web logos must differ');
process.stdout.write('CUSTOMER_WEB_PASS\n');

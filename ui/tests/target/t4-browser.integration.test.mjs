import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import WebSocket from 'ws';

async function port() {
  const socket = createNetServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const address = socket.address();
  if (!address || typeof address === 'string') throw new Error('NO_TEST_PORT');
  await new Promise(resolve => socket.close(resolve));
  return address.port;
}
async function until(work, label, attempts = 150) {
  for (let i = 0; i < attempts; i += 1) {
    try { const result = await work(); if (result) return result; } catch { /* startup or navigation */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`TIMEOUT: ${label}`);
}
async function startWeb(configPath, webPort) {
  const child = spawn('npm', ['run', 'dev', '--workspace', '@targoman/web', '--', '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'],
    { cwd: resolve('.'), env: { ...process.env, TARGOMAN_CONFIG_PATH: configPath }, stdio: 'ignore' });
  try {
    await until(async () => { if (child.exitCode !== null) throw new Error('WEB_EXITED');
      const response = await fetch(`http://127.0.0.1:${webPort}/`); return response.ok; }, 'web startup');
    return child;
  } catch (error) { child.kill('SIGTERM'); throw error; }
}
async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve => child.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 3000))]);
  if (child.exitCode === null) child.kill('SIGKILL');
}
async function chromeSession(directory) {
  const profile = join(directory, 'chrome-profile');
  const child = spawn('/usr/bin/google-chrome', ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
  { stdio: 'ignore' });
  const active = await until(async () => (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).trim(), 'Chrome DevTools startup');
  const debugPort = Number(active.split('\n')[0]);
  const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const page = pages.find(item => item.type === 'page');
  assert.ok(page?.webSocketDebuggerUrl);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  let sequence = 0;
  const pending = new Map();
  ws.on('message', raw => {
    const message = JSON.parse(raw.toString());
    if (!message.id) return;
    const entry = pending.get(message.id); if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message)); else entry.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  const evaluate = async expression => {
    const reply = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.text);
    return reply.result.value;
  };
  return { child, ws, send, evaluate, async close() { ws.close(); await stop(child); } };
}

test('Chrome exercises branded login, memory token, refresh cookie, tenant choice, public tools, replay and Auth-disabled UI',
  { skip: process.env.T4_REQUIRE_BROWSER !== '1', timeout: 90000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 't4-browser-'));
    const webPort = await port();
    const origin = `http://127.0.0.1:${webPort}`;
    const initialCookie = 'A'.repeat(43), rotatedCookie = 'B'.repeat(43);
    const calls = [];
    let refreshValue = initialCookie;
    const mock = createServer(async (request, response) => {
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString('utf8');
      calls.push({ path: request.url, authorization: request.headers.authorization ?? null,
        tenant: request.headers['x-tenant-id'] ?? null, cookie: request.headers.cookie ?? null });
      response.setHeader('Cache-Control', 'no-store');
      if (request.url === '/api/auth/login') {
        const parsed = JSON.parse(body);
        if (parsed.email !== 'browser@example.invalid' || parsed.password !== 'browser passphrase') {
          response.writeHead(401, { 'content-type': 'application/json' }).end('{"error":"INVALID_CREDENTIALS"}'); return;
        }
        if (!parsed.tenantId) { response.writeHead(200, { 'content-type': 'application/json' })
          .end('{"status":"TENANT_SELECTION_REQUIRED","tenants":["tenant-a","tenant-b"]}'); return; }
        refreshValue = initialCookie;
        response.setHeader('Set-Cookie', `__Secure-tg_refresh=${initialCookie}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth`);
        response.writeHead(200, { 'content-type': 'application/json' })
          .end(JSON.stringify({ accessToken: 'header.payload.signature', tenantId: parsed.tenantId })); return;
      }
      if (request.url === '/api/auth/refresh') {
        const cookie = request.headers.cookie ?? '';
        if (cookie.includes(`__Secure-tg_refresh=${refreshValue}`)) {
          refreshValue = String.fromCharCode(refreshValue.charCodeAt(0) + 1).repeat(43);
          response.setHeader('Set-Cookie', `__Secure-tg_refresh=${refreshValue}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth`);
          response.writeHead(200, { 'content-type': 'application/json' })
            .end('{"accessToken":"header.rotated.signature","tenantId":"tenant-b"}'); return;
        }
        response.setHeader('Set-Cookie', '__Secure-tg_refresh=; Max-Age=0; HttpOnly; Secure; SameSite=Strict; Path=/api/auth');
        response.writeHead(401, { 'content-type': 'application/json' }).end('{"error":"INVALID_SESSION"}'); return;
      }
      if (request.url === '/api/auth/logout') {
        response.setHeader('Set-Cookie', '__Secure-tg_refresh=; Max-Age=0; HttpOnly; Secure; SameSite=Strict; Path=/api/auth');
        response.writeHead(204).end(); return;
      }
      if (request.url === '/api/translate') {
        response.writeHead(200, { 'content-type': 'application/json' })
          .end('{"phrase":"hello world","translations":["سلام"]}'); return;
      }
      if (request.url === '/api/summarize') {
        response.writeHead(200, { 'content-type': 'text/event-stream' })
          .end('data: {"delta":"A summary.","cid":0}\n\ndata: [REF]:[]\n\ndata: [DONE:test]\n\n'); return;
      }
      if (request.url === '/api/faq/inspect') {
        response.writeHead(200, { 'content-type': 'application/json' })
          .end('{"fileName":"faq.txt","pageCount":1,"sourceChars":17}'); return;
      }
      if (request.url === '/api/faq') {
        response.writeHead(200, { 'content-type': 'text/event-stream' })
          .end('event: meta\ndata: {"count":1,"batches":1}\n\nevent: batch\ndata: {"produced":1,"items":[{"question":"What?","answer":"Answer."}]}\n\nevent: done\ndata: {"produced":1}\n\n'); return;
      }
      response.writeHead(404).end();
    });
    await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
    const mockAddress = mock.address(); assert.ok(mockAddress && typeof mockAddress !== 'string');
    const source = JSON.parse(await readFile('deploy/examples/development/platform.cjson', 'utf8'));
    const limits = Object.fromEntries(Object.entries(source.admission).map(([module, policy]) =>
      [module, { ...policy, outputTokens: module === 'faq' ? 20000 : 2000 }]));
    const auth = { enabled: true, issuer: 'https://auth.example.invalid', audience: 'targoman-api',
      accessTokenSeconds: 300, activeKid: 'v1', privateKeyRef: 'file:/run/secrets/access-private',
      publicKeys: [{ kid: 'v1', publicKeyRef: 'file:/run/secrets/access-public' }],
      session: { absoluteLifetimeSeconds: 2592000, refreshLifetimeSeconds: 604800, inactivityLifetimeSeconds: 604800 },
      authenticatedAdmission: limits, privilegedAdmission: limits };
    const config = { ...source, brand: { ...source.brand, displayName: 'Browser Test Brand' },
      http: { ...source.http, apiInternalUrl: `http://127.0.0.1:${mockAddress.port}`, allowedOrigins: [origin] }, auth };
    const enabledPath = join(directory, 'enabled.cjson'), disabledPath = join(directory, 'disabled.cjson');
    await writeFile(enabledPath, JSON.stringify(config));
    await writeFile(disabledPath, JSON.stringify({ ...config, auth: { enabled: false } }));
    let web, browser;
    try {
      web = await startWeb(enabledPath, webPort);
      browser = await chromeSession(directory);
      await browser.send('Page.navigate', { url: `${origin}/login` });
      await until(() => browser.evaluate('document.querySelector("#login-email") !== null'), 'login form');
      await new Promise(resolve => setTimeout(resolve, 1500));
      assert.equal(await browser.evaluate('document.title.includes("Browser Test Brand")'), true);
      await browser.evaluate(`(() => { const select=document.getElementById('locale-choice'); select.value='en';
        select.dispatchEvent(new Event('change',{bubbles:true})); })()`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      await until(() => browser.evaluate('document.querySelector("#login-email") !== null'), 'login after locale change');
      const preferenceCookies = await browser.send('Network.getCookies', { urls: [origin] });
      assert.ok(preferenceCookies.cookies.some(item => item.name === '__Host-ui-locale' && item.secure
        && item.path === '/' && !item.domain.startsWith('.') && item.sameSite === 'Lax'));
      await browser.evaluate(`(() => {
        for (const [id, value] of [['login-email','browser@example.invalid'],['login-password','browser passphrase']]) {
          const input = document.getElementById(id); input.value = value; input.dispatchEvent(new Event('input',{bubbles:true}));
        }
      })()`);
      await new Promise(resolve => setTimeout(resolve, 100));
      await browser.evaluate('document.querySelector("form").requestSubmit()');
      try { await until(() => browser.evaluate('document.querySelector("#login-tenant") !== null'), 'tenant selection'); }
      catch (error) { throw new Error(`${error.message}; calls=${JSON.stringify(calls)}; page=${await browser.evaluate('document.body.textContent.slice(0,700)')}`); }
      await browser.evaluate(`(() => { const select=document.getElementById('login-tenant'); select.value='tenant-b';
        select.dispatchEvent(new Event('change',{bubbles:true})); })()`);
      await new Promise(resolve => setTimeout(resolve, 100));
      await browser.evaluate('document.querySelector("form").requestSubmit()');
      await until(() => browser.evaluate('document.querySelector("[role=status]")?.textContent?.includes("tenant-b")'), 'login success');
      assert.equal(await browser.evaluate('document.cookie.includes("tg_refresh")'), false);
      assert.equal(await browser.evaluate('JSON.stringify([localStorage,sessionStorage]).includes("header.payload.signature")'), false);
      const cookies = await browser.send('Network.getCookies', { urls: [`${origin}/api/auth/refresh`] });
      assert.ok(cookies.cookies.some(item => item.name === '__Secure-tg_refresh' && item.httpOnly && item.secure && item.path === '/api/auth'));
      await browser.send('Page.navigate', { url: `${origin}/translate` });
      await until(() => browser.evaluate('document.querySelector("#translate-text") !== null'), 'translator page');
      await until(() => browser.evaluate('document.querySelector("button.login-link") === null && document.body.textContent.includes("tenant-b")'), 'restored session');
      await browser.evaluate(`(() => { const input=document.getElementById('translate-text'); input.value='hello world';
        input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
      await browser.evaluate('new Promise(resolve => setTimeout(resolve, 50))');
      await browser.evaluate('document.querySelector("#public-text-tool-form").requestSubmit()');
      await until(() => calls.some(call => call.path === '/api/translate'), 'authenticated browser translation');
      assert.ok(calls.some(call => call.path === '/api/translate' && call.authorization?.startsWith('Bearer header.') && call.tenant === 'tenant-b'));
      await browser.send('Page.navigate', { url: `${origin}/summarize` });
      await until(() => browser.evaluate('document.querySelector("#summarize-text") !== null'), 'summarizer page');
      await until(() => browser.evaluate('document.body.textContent.includes("tenant-b")'), 'summarizer restored session');
      await new Promise(resolve => setTimeout(resolve, 300));
      await browser.evaluate(`(() => { const input=document.getElementById('summarize-text'); input.value='A long source paragraph.';
        input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
      await new Promise(resolve => setTimeout(resolve, 50));
      await browser.evaluate('document.querySelector("#public-text-tool-form").requestSubmit()');
      await until(() => calls.some(call => call.path === '/api/summarize'), 'authenticated browser summary');
      assert.ok(calls.some(call => call.path === '/api/summarize' && call.authorization?.startsWith('Bearer header.') && call.tenant === 'tenant-b'));
      await writeFile(join(directory, 'faq.txt'), 'Document content.');
      await browser.send('Page.navigate', { url: `${origin}/faq` });
      await until(() => browser.evaluate('document.querySelector("#faq-file") !== null'), 'FAQ page');
      await until(() => browser.evaluate('document.body.textContent.includes("tenant-b")'), 'FAQ restored session');
      await new Promise(resolve => setTimeout(resolve, 300));
      const documentNode = await browser.send('DOM.getDocument');
      const fileInput = await browser.send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: '#faq-file' });
      assert.ok(fileInput.nodeId);
      await browser.send('DOM.setFileInputFiles', { nodeId: fileInput.nodeId, files: [join(directory, 'faq.txt')] });
      await until(() => calls.some(call => call.path === '/api/faq/inspect'), 'authenticated browser FAQ inspect');
      await until(() => browser.evaluate('document.body.textContent.includes("faq.txt")'), 'FAQ inspected');
      await browser.evaluate('document.querySelector(".faq-page form").requestSubmit()');
      await until(() => calls.some(call => call.path === '/api/faq'), 'authenticated browser FAQ generation');
      assert.ok(calls.filter(call => call.path?.startsWith('/api/faq')).every(call => call.authorization?.startsWith('Bearer header.') && call.tenant === 'tenant-b'));
      await browser.evaluate('document.querySelector(".shell-tools button:last-child")?.click()');
      await until(() => browser.evaluate('document.querySelector(".login-link") !== null'), 'logout UI');
      assert.ok(calls.some(call => call.path === '/api/auth/logout' && call.cookie?.includes('__Secure-tg_refresh=')));
      await browser.send('Page.navigate', { url: `${origin}/login` });
      await until(() => browser.evaluate('document.querySelector("#login-email") !== null'), 'second login');
      await new Promise(resolve => setTimeout(resolve, 800));
      await browser.evaluate(`(() => { for (const [id,value] of [['login-email','browser@example.invalid'],['login-password','browser passphrase']]) {
        const input=document.getElementById(id); input.value=value; input.dispatchEvent(new Event('input',{bubbles:true})); }
      })()`);
      await new Promise(resolve => setTimeout(resolve, 100));
      await browser.evaluate('document.querySelector("form").requestSubmit()');
      await until(() => browser.evaluate('document.querySelector("#login-tenant") !== null'), 'second tenant selection');
      await browser.evaluate(`(() => { const select=document.getElementById('login-tenant'); select.value='tenant-b';
        select.dispatchEvent(new Event('change',{bubbles:true})); })()`);
      await new Promise(resolve => setTimeout(resolve, 100));
      await browser.evaluate('document.querySelector("form").requestSubmit()');
      await until(() => browser.evaluate('document.querySelector("[role=status]")?.textContent?.includes("tenant-b")'), 'second login success');
      const firstRefresh = await browser.evaluate(`fetch('/api/auth/refresh',{method:'POST',credentials:'same-origin'})
        .then(async response => ({status:response.status, body:await response.json()}))`);
      assert.equal(firstRefresh.status, 200);
      await browser.send('Network.setCookie', { name: '__Secure-tg_refresh', value: initialCookie,
        url: `${origin}/api/auth/refresh`, path: '/api/auth', secure: true, httpOnly: true, sameSite: 'Strict' });
      const replay = await browser.evaluate(`fetch('/api/auth/refresh',{method:'POST',credentials:'same-origin'})
        .then(response => response.status)`);
      assert.equal(replay, 401);
      await stop(web); web = undefined;
      web = await startWeb(disabledPath, webPort);
      await browser.send('Page.navigate', { url: `${origin}/` });
      await until(() => browser.evaluate('document.querySelector(".shell-header") !== null'), 'disabled home');
      assert.equal(await browser.evaluate('document.querySelector(".login-link") === null'), true);
      const before = calls.filter(call => call.path?.startsWith('/api/auth/')).length;
      await new Promise(resolve => setTimeout(resolve, 250));
      assert.equal(calls.filter(call => call.path?.startsWith('/api/auth/')).length, before);
      await browser.send('Page.navigate', { url: `${origin}/login` });
      await until(() => browser.evaluate('document.readyState === "complete"'), 'disabled login');
      assert.equal(await browser.evaluate('document.querySelector("#login-email") === null'), true);
    } finally {
      if (browser) await browser.close();
      await stop(web);
      await new Promise(resolve => mock.close(resolve));
      await rm(directory, { recursive: true, force: true });
    }
  });

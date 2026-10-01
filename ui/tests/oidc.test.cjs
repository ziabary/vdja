const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('typescript');

// Execute the real route/service code with only external IO replaced.
function loadTS(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', relative);
  const nativeRequire = createRequire(filename);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  const requireMock = id => {
    if (id in mocks) return mocks[id];
    if (id.startsWith('.')) return loadTS(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(filename), id + '.ts')), mocks);
    return nativeRequire(id);
  };
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(requireMock, module, module.exports);
  return module.exports;
}

const flowUtils = loadTS('utils/oidcFlow.ts');
const baseFlow = { codeVerifier: 'verifier', state: 'state', nonce: 'nonce', service: 'rag', back: '/webwidget?tab=settings', mustAdmin: false, mustVerified: false };

test('flow cookies reject tampering, wrong keys, and expiry', () => {
  const token = flowUtils.signOIDCFlow(baseFlow, 'secret');
  assert.equal(flowUtils.readOIDCFlow(token, 'secret').back, baseFlow.back);
  assert.throws(() => flowUtils.readOIDCFlow(token, 'wrong'));
  const parts = token.split('.');
  parts[1] = Buffer.from(JSON.stringify({ ...baseFlow, back: '//evil.example' })).toString('base64url');
  assert.throws(() => flowUtils.readOIDCFlow(parts.join('.'), 'secret'));
  const now = Date.now;
  try {
    Date.now = () => now() + 301000;
    assert.throws(() => flowUtils.readOIDCFlow(token, 'secret'), /expired/);
  } finally { Date.now = now; }
});

test('return destinations remain local and preserve independent service and page', () => {
  for (const back of ['//evil.example', '/\\evil.example', '/\n/evil.example'])
    assert.equal(flowUtils.localReturnPath(back), '/rag');
  const url = new URL(flowUtils.oidcLoginPage({ ...baseFlow, mustAdmin: true }, 'complete'), 'https://app.example');
  assert.equal(url.searchParams.get('service'), 'rag');
  assert.equal(url.searchParams.get('back'), baseFlow.back);
  assert.equal(url.searchParams.get('mustAdmin'), '1');
  assert.equal(url.searchParams.get('oidc'), 'complete');
  assert.equal(url.searchParams.has('accessToken'), false);
});

async function fixture({ active = true, existing = false, denied = false } = {}) {
  const calls = [];
  const config = {
    OIDC: { active, issuer: 'https://id.example', clientId: 'client', clientSecret: 'secret', callbackUri: 'https://app.example/api/auth/oidc/callback', scope: 'openid profile' },
    jwt: { baseSecret: 'base-secret', refreshSecret: 'refresh-secret', accessTTL: '15m', refreshTTL: '7d' }
  };
  const user = { usrID: 23, usrKey: 'organization-key', usrName: 'سازمانی', privs: { services: denied ? {} : { rag: {} } } };
  let stored = existing ? user : undefined;
  let refreshToken;
  const db = {
    user: {
      getDigesting: async (...args) => { calls.push(['get', ...args]); return stored; },
      findByEmail: async () => undefined,
      addUser: async (...args) => { calls.push(['add', ...args]); stored = user; },
      updateLastLogin: async key => calls.push(['lastLogin', key]),
      updateRefreshHash: async (key, token) => { assert.equal(key, user.usrKey); refreshToken = token; },
      verifyRefreshToken: async (key, token) => key === user.usrKey && token === refreshToken && token ? stored : undefined,
      logoutByToken: async key => calls.push(['logout', key]),
    },
    perUserStats: { initialize: async (...args) => calls.push(['stats', ...args]) },
    log: { add: () => {} }
  };
  const mocks = {
    '../db/atDB': db,
    '../utils/logger': { info() {}, error() {} },
    '../utils/configManager': { active: () => config },
    'openid-client': {
      discovery: async () => ({ serverMetadata: () => ({ issuer: config.OIDC.issuer }) }),
      ClientSecretPost: () => ({}),
      randomPKCECodeVerifier: () => 'verifier', calculatePKCECodeChallenge: async () => 'challenge',
      randomState: () => 'state', randomNonce: () => 'nonce',
      buildAuthorizationUrl: (_client, params) => new URL('https://id.example/authorize?' + new URLSearchParams(params)),
      authorizationCodeGrant: async (_client, url, options) => {
        assert.equal(url.origin, 'https://app.example');
        assert.equal(options.pkceCodeVerifier, 'verifier');
        assert.equal(options.expectedNonce, 'nonce');
        assert.equal(options.idTokenExpected, true);
        if (url.searchParams.get('state') !== options.expectedState) throw new Error('invalid state');
        if (url.searchParams.has('error')) throw new Error('provider denied');
        return { claims: () => ({ sub: 'organization-subject', name: user.usrName }) };
      }
    }
  };
  const router = await loadTS('routes/auth.ts', mocks).default();
  async function request(route, req = {}) {
    const result = { cookies: {}, cleared: [], headers: {} };
    const res = {
      setHeader: (k, v) => result.headers[k] = v,
      cookie: (k, value, options) => result.cookies[k] = { value, options },
      clearCookie: (k, options) => result.cleared.push({ k, options }),
      redirect: url => result.redirect = url,
      json: data => result.json = data,
      send: data => result.json = data,
    };
    const handler = router.stack.find(layer => layer.route?.path === route).route.stack[0].handle;
    await handler({ query: {}, cookies: {}, ...req }, res);
    return result;
  }
  return { request, calls, config, user };
}

test('new organization account completes callback, refreshes internal JWT, and logs out', async () => {
  const { request, calls, config, user } = await fixture();
  const login = await request('/auth/oidc/login', { query: { service: 'rag', back: baseFlow.back } });
  const provider = new URL(login.redirect);
  assert.equal(provider.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(login.cookies.oidc_flow.options.httpOnly, true);
  const callback = await request('/auth/oidc/callback', {
    cookies: { oidc_flow: login.cookies.oidc_flow.value },
    originalUrl: '/api/auth/oidc/callback?code=code&state=state'
  });
  assert.equal(new URL(callback.redirect, 'https://app.example').searchParams.get('back'), baseFlow.back);
  assert.equal(callback.json, undefined);
  assert.equal(calls.filter(c => c[0] === 'add').length, 1);
  assert.equal(calls.find(c => c[0] === 'add')[4], 'organization-subject');
  assert.ok(calls.filter(c => c[0] === 'get').every(c => c[2] === true && c[3] === true));
  const refresh = callback.cookies.refreshToken;
  assert.equal(refresh.options.maxAge, 7 * 86400000);
  const session = await request('/auth/refresh', { query: { service: 'rag' }, cookies: { refreshToken: refresh.value } });
  const jwt = require('jsonwebtoken');
  const claims = jwt.verify(session.json.accessToken, config.jwt.baseSecret);
  assert.equal(claims.uid, user.usrID);
  assert.equal(claims.key, user.usrKey);
  assert.equal(claims.exp - claims.iat, 900);
  const cookies = { refreshToken: session.cookies.refreshToken.value };
  const logout = await request('/auth/logout', { cookies });
  assert.ok(logout.cleared.some(c => c.k === 'refreshToken' && c.options.path === '/api/'));
  await assert.rejects(request('/auth/refresh', { query: { service: 'rag' }, cookies }));
});

test('existing organization account is reused and login timestamp uses its internal key', async () => {
  const { request, calls, config } = await fixture({ existing: true });
  const result = await request('/auth/oidc/callback', {
    cookies: { oidc_flow: flowUtils.signOIDCFlow(baseFlow, config.jwt.baseSecret) },
    originalUrl: '/api/auth/oidc/callback?code=code&state=state'
  });
  assert.ok(result.redirect.includes('oidc=complete'));
  assert.equal(calls.some(c => c[0] === 'add'), false);
  assert.deepEqual(calls.find(c => c[0] === 'lastLogin'), ['lastLogin', 'organization-key']);
});

test('disabled provider, missing flow, provider cancellation, invalid state, and denied service never issue a session', async () => {
  const disabled = await fixture({ active: false });
  assert.equal((await disabled.request('/auth/methods')).json.oidc, false);
  assert.match((await disabled.request('/auth/oidc/login')).redirect, /oidc_disabled/);
  const { request, config } = await fixture();
  assert.match((await request('/auth/oidc/callback')).redirect, /missing_flow/);
  for (const query of ['code=code&state=wrong', 'error=access_denied&state=state']) {
    const result = await request('/auth/oidc/callback', {
      cookies: { oidc_flow: flowUtils.signOIDCFlow(baseFlow, config.jwt.baseSecret) },
      originalUrl: '/api/auth/oidc/callback?' + query
    });
    assert.ok(result.redirect.includes('error=oidc'));
    assert.equal(result.cookies.refreshToken, undefined);
  }
  const denied = await fixture({ existing: true, denied: true });
  const result = await denied.request('/auth/oidc/callback', {
    cookies: { oidc_flow: flowUtils.signOIDCFlow(baseFlow, denied.config.jwt.baseSecret) },
    originalUrl: '/api/auth/oidc/callback?code=code&state=state'
  });
  assert.match(result.redirect, /oidc_denied/);
  assert.equal(result.cookies.refreshToken, undefined);
});

async function loginPage(search, { failRefresh = false } = {}) {
  const html = fs.readFileSync(path.resolve(__dirname, '../public/login.html'), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const elements = new Map();
  const errors = [];
  const requests = [];
  let token = 'temporary-account-token';
  const location = { origin: 'https://app.example', search, href: '' };
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', classList: { toggle() {}, add() {}, remove() {} }, addEventListener() {} });
    return elements.get(id);
  };
  const context = {
    URL, URLSearchParams, console, location, window: { location },
    document: { getElementById: element, addEventListener() {} },
    parseQuery: value => Object.fromEntries(new URLSearchParams(value)),
    setupAuth: async () => ({ token: () => token, info: () => ({ privs: {} }), setAccessToken: value => token = value }),
    localStorage: { removeItem: () => token = null },
    showError: message => errors.push(message),
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (url === '/api/auth/methods') return { ok: true, json: async () => ({ oidc: true }) };
      return { ok: !failRefresh, json: async () => failRefresh ? {} : { accessToken: 'organization-account-token' } };
    },
    setTimeout() {},
  };
  vm.runInNewContext(scripts.at(-1)[1], context);
  await new Promise(resolve => setImmediate(resolve));
  return { token, location, errors, requests };
}

test('browser callback replaces temporary session and returns to WebWidget using rag privileges', async () => {
  const result = await loginPage('?oidc=complete&service=rag&back=%2Fwebwidget');
  assert.equal(result.token, 'organization-account-token');
  assert.equal(result.location.href, '/webwidget');
  assert.ok(result.requests.some(r => r.url === '/api/auth/refresh?service=rag' && r.options.credentials === 'include'));
  assert.deepEqual(result.errors, []);
});

test('browser shows callback errors instead of silently returning to the temporary account', async () => {
  const error = await loginPage('?error=oidc&service=rag');
  assert.equal(error.location.href, '');
  assert.equal(error.errors.length, 1);
  assert.equal(error.requests.some(r => r.url.includes('/refresh')), false);
  const failed = await loginPage('?oidc=complete&service=rag', { failRefresh: true });
  assert.equal(failed.token, null);
  assert.equal(failed.location.href, '');
  assert.equal(failed.errors.length, 1);
});

import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import express, { type Request, type Response } from 'express';
import multer from 'multer';
import { loadConfiguration, type intfAdmissionPolicy, type intfConfigurationSnapshot, type typModuleId } from '../../../packages/configuration/src/index.js';
import type { intfExecutionContext } from '../../../packages/contracts/src/index.js';
import { probeSiemReadiness } from '../../../packages/security-telemetry/src/worker.js';
import { parseCspReport } from '../../../packages/security-telemetry/src/csp-report.js';
import { exAiRouter } from '../../../packages/ai-router/src/index.js';
import { exAdmission } from '../../../packages/admission-control/src/index.js';
import { exFileProcessing } from '../../../packages/file-processing/src/index.js';
import { logOperational } from '../../../packages/observability/src/index.js';
import type { intfFaqOptions } from '../../../modules/faq/src/service.js';
import { inspectRefreshCookie, refreshSetCookie, refreshClearCookie } from '../../../packages/session/src/cookie.js';
import { createPublicApiRuntime } from './composition.js';
import { enuAuthorityDecision } from '../../../packages/authority/src/index.js';
import { registerKnowledgeApi } from './knowledge.js';

function arg(name: string, fallback: string): string { const at = process.argv.indexOf(name); return at < 0 ? fallback : process.argv[at + 1] ?? fallback; }
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_BODY'); return value as Record<string, unknown>; }
function string(value: unknown, max: number): string { if (typeof value !== 'string' || value.length > max) throw new Error('INVALID_FIELD'); return value; }
function positiveInteger(value: unknown, fallback: number, min: number, max: number): number { if (value === undefined) return fallback; const number = Number(value); if (!Number.isInteger(number) || number < min || number > max) throw new Error('INVALID_FIELD'); return number; }
function boolean(value: unknown, fallback: boolean): boolean { if (value === undefined) return fallback; if (typeof value !== 'boolean') throw new Error('INVALID_FIELD'); return value; }
function requestId(value: unknown): string { if (value === undefined) return randomUUID().replaceAll('-', ''); if (typeof value !== 'string' || !/^[a-fA-F0-9]{32}$/.test(value)) throw new Error('INVALID_REQUEST_ID'); return value.toLowerCase(); }
function securityContext(snapshot: intfConfigurationSnapshot, req: Request, moduleId: string, actorKind: 'ANONYMOUS' | 'HUMAN' = 'ANONYMOUS',
  actorId: string | null = null, sessionId: string | null = null, tenantId = snapshot.value.deployment.tenantId): intfExecutionContext {
  const header = req.header('x-correlation-id');
  return { deploymentId: snapshot.value.deployment.id, tenantId, moduleId, requestId: randomUUID().replaceAll('-', ''),
    correlationId: header && /^[A-Za-z0-9-]{8,64}$/.test(header) ? header : randomUUID(),
    actorKind, actorId, sessionId, source: 'SECURITY_API', configFingerprint: snapshot.fingerprint };
}
async function context(snapshot: intfConfigurationSnapshot, runtime: Awaited<ReturnType<typeof createPublicApiRuntime>>, moduleId: typModuleId, req: Request, res: Response, id: string): Promise<{ ctx: intfExecutionContext; policy: intfAdmissionPolicy }> {
  const header = req.header('x-correlation-id'); const correlationId = header && /^[A-Za-z0-9-]{8,64}$/.test(header) ? header : randomUUID();
  res.setHeader('X-Correlation-ID', correlationId); res.setHeader('X-Request-ID', id);
  const bearer = req.header('authorization');
  let actor: Pick<intfExecutionContext, 'tenantId' | 'actorKind' | 'actorId' | 'sessionId' | 'authorizationVersion'> =
    { tenantId: snapshot.value.deployment.tenantId, actorKind: 'ANONYMOUS', actorId: null, sessionId: null };
  let policy = snapshot.value.admission[moduleId];
  if (bearer !== undefined) {
    const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(bearer);
    if (!match || !runtime.authentication) throw new Error('INVALID_ACCESS_TOKEN');
    const selectedTenant = req.header('x-tenant-id') ?? undefined;
    let claims: Awaited<ReturnType<typeof runtime.authentication.authenticateBearer>>;
    try { claims = await runtime.authentication.authenticateBearer(match[1]!, selectedTenant); }
    catch (error) {
      if (selectedTenant) await runtime.securityAudit.record(securityContext(snapshot, req, 'authority'),
        'tenant.mismatch', 'DENIED', 'TOKEN_TENANT_MISMATCH_OR_INVALID');
      throw error;
    }
    const authorityContext: intfExecutionContext = { ...securityContext(snapshot, req, moduleId, 'HUMAN',
      claims.identityId, claims.sessionId, claims.tenantId), requestId: id, correlationId,
      authorizationVersion: claims.authorizationVersion, source: 'PUBLIC_API' };
    const result = await runtime.authority.authorizePublicTool(authorityContext,
      moduleId as 'translator' | 'summarizer' | 'faq');
    if (result.decision !== enuAuthorityDecision.Permit) {
      await runtime.securityAudit.record(authorityContext, 'authority.denied', 'DENIED', result.reason);
      throw new Error('AUTHORITY_DENIED');
    }
    if (!snapshot.value.auth?.enabled || !result.limitTier) throw new Error('AUTHORITY_DENIED');
    policy = result.limitTier === 'PRIVILEGED'
      ? snapshot.value.auth.privilegedAdmission[moduleId] : snapshot.value.auth.authenticatedAdmission[moduleId];
    actor = { tenantId: claims.tenantId, actorKind: 'HUMAN', actorId: claims.identityId,
      sessionId: claims.sessionId, authorizationVersion: claims.authorizationVersion };
  }
  const value: intfExecutionContext = { deploymentId: snapshot.value.deployment.id, ...actor,
    moduleId, requestId: id, correlationId, source: 'PUBLIC_API', configFingerprint: snapshot.fingerprint };
  res.locals.publicContext = value;
  return { ctx: value, policy };
}
function enabled(snapshot: intfConfigurationSnapshot, module: typModuleId): void { if (!snapshot.value.modules[module].enabled) { const error = new Error('MODULE_DISABLED'); Object.assign(error, { status: 404 }); throw error; } }
function sse(res: Response): void { if (res.headersSent) return; res.status(200).setHeader('Content-Type', 'text/event-stream; charset=utf-8'); res.setHeader('Cache-Control', 'no-cache, no-transform'); res.setHeader('X-Accel-Buffering', 'no'); res.flushHeaders(); }
async function writeSse(res: Response, payload: string): Promise<void> { sse(res); if (!res.write(payload)) await new Promise<void>(resolve => res.once('drain', resolve)); }
function safeError(error: unknown): { status: number; code: string } {
  if (error instanceof Error && 'type' in error && error.type === 'entity.too.large') return { status: 413, code: 'INPUT_LIMIT_EXCEEDED' };
  if (error instanceof Error && error.message === 'INVALID_ACCESS_TOKEN') return { status: 401, code: 'INVALID_SESSION' };
  if (error instanceof Error && error.message === 'AUTHORITY_DENIED') return { status: 403, code: 'AUTHORITY_DENIED' };
  if (error instanceof exAdmission) return { status: error.code === 'INPUT_LIMIT_EXCEEDED' || error.code === 'OUTPUT_LIMIT_EXCEEDED' ? 413 : 429, code: error.code };
  if (error instanceof exFileProcessing) return { status: error.code === 'FILE_TOO_LARGE' ? 413 : 400, code: error.code };
  if (error instanceof exAiRouter) return { status: error.code === 'NO_ELIGIBLE_ENDPOINT' ? 503 : error.code === 'CANCELLED' ? 499 : 502, code: error.code };
  if (error instanceof Error && error.message === 'CANCELLED') return { status: 499, code: 'CANCELLED' };
  if (error instanceof Error && (error.message.startsWith('INVALID_') || ['EMPTY_DOCUMENT', 'EMPTY_SCOPE', 'SOURCE_TOO_LARGE_FOR_FAQ_COUNT'].includes(error.message))) return { status: 400, code: error.message };
  if (error instanceof Error && error.message === 'MODULE_DISABLED') return { status: 404, code: 'MODULE_DISABLED' };
  return { status: 500, code: 'INTERNAL_ERROR' };
}
function fileOf(req: Request): { path: string; originalname: string; mimetype: string; size: number } { if (!req.file) throw new Error('INVALID_FILE'); return req.file; }
function signalFor(req: Request, res: Response): AbortSignal { const controller = new AbortController(); req.on('aborted', () => controller.abort()); res.on('close', () => { if (!res.writableEnded) controller.abort(); }); return controller.signal; }
function moduleRoute(app: express.Express, path: string, action: (req: Request, res: Response) => Promise<void>): void { app.post(`/api${path}`, async (req, res, next) => { try { await action(req, res); } catch (error) { next(error); } }); }
function authOrigin(snapshot: intfConfigurationSnapshot, req: Request, res: Response): boolean {
  const origin = req.header('origin');
  if (origin && snapshot.value.auth?.enabled && snapshot.value.auth.allowedApplicationOrigins.includes(origin)) return true;
  res.status(403).json({ error: 'ORIGIN_DENIED' }); return false;
}
const AUTH_POST_PATH = /^\/api\/auth\/(?:login|refresh|logout)$/;
function allowedPreflightHeaders(value: string | undefined): boolean {
  if (!value) return false;
  const names = value.split(',').map(part => part.trim().toLowerCase());
  return names.length > 0 && names.every(name => name === 'content-type' || name === 'accept');
}

export async function createPublicApi(snapshot: intfConfigurationSnapshot, secretRoot = '/run/secrets') {
  const runtime = await createPublicApiRuntime(snapshot, secretRoot);
  const app = express(); app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Vary', 'Origin');
    const origin = req.header('origin');
    const authEnabled = snapshot.value.auth?.enabled === true;
    const authHost = authEnabled ? new URL(snapshot.value.auth.publicOrigin).host : null;
    const appHost = authEnabled && snapshot.value.web ? new URL(snapshot.value.web.publicOrigin).host : null;
    const requestHost = req.header('host')?.toLowerCase();
    const operationalPath = ['/', '/health', '/ready', '/version'].includes(req.path);
    if (authEnabled && !operationalPath) {
      if (requestHost !== authHost && requestHost !== appHost) { res.status(421).json({ error: 'HOST_DENIED' }); return; }
      if (requestHost === authHost && !req.path.startsWith('/api/auth/')) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
      if (requestHost === appHost && req.path.startsWith('/api/auth/')) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    }
    const authPath = authEnabled && req.path.startsWith('/api/auth/');
    const allowedOrigins = authPath && snapshot.value.auth?.enabled
      ? snapshot.value.auth.allowedApplicationOrigins : snapshot.value.http.allowedOrigins;
    if (origin && !allowedOrigins.includes(origin)) { res.status(403).json({ error: 'ORIGIN_DENIED' }); return; }
    if (req.method === 'OPTIONS' && AUTH_POST_PATH.test(req.path) && authPath) {
      if (!origin || req.header('access-control-request-method') !== 'POST'
        || !allowedPreflightHeaders(req.header('access-control-request-headers'))) {
        res.status(403).json({ error: 'ORIGIN_DENIED' }); return;
      }
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'POST');
      res.setHeader('Access-Control-Allow-Headers', 'content-type, accept');
      res.setHeader('Access-Control-Max-Age', '600');
      res.status(204).end(); return;
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      if (authPath) res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    next();
  });
  const upload = multer({ dest: tmpdir(), limits: { fileSize: snapshot.value.fileProcessing.maxUploadBytes } });
  app.use((req, res, next) => { const started = Date.now(); const log = () => logOperational({ severity: res.statusCode >= 500 ? 'ERROR' : 'INFO', component: 'target-api', event: 'request_completed', context: res.locals.publicContext as intfExecutionContext | undefined, status: String(res.statusCode), durationMs: Date.now() - started, method: req.method, route: req.route?.path ?? "UNMATCHED" }); res.once('finish', log); next(); });
  app.get('/health', (_req, res) => res.json({ status: 'ALIVE' }));
  app.get('/', (_req, res) => res.json({ status: 'ALIVE' }));
  app.get('/ready', async (_req, res) => { try {
    await runtime.databaseReady();
    const [ai, siem, managed] = await Promise.all([runtime.router.probeReadiness(), probeSiemReadiness(runtime.store.active().value.siem),runtime.managed?.readiness()]);
    const status = ai.status === 'NOT_READY' ? 'NOT_READY' : ai.status === 'DEGRADED' || siem === 'DEGRADED' || managed?.files==='UNAVAILABLE' || managed?.knowledge==='UNAVAILABLE'||managed?.protectedAi==='UNAVAILABLE' ? 'DEGRADED' : 'READY';
    res.status(status === 'NOT_READY' ? 503 : 200).json({ status, dependencies: { postgres: 'READY', ai: ai.status, siem,files:managed?.files??'DISABLED',knowledge:managed?.knowledge??'DISABLED',protectedAi:managed?.protectedAi??'DISABLED' }, unavailableTasks: [...ai.unavailableTasks,...managed?.unavailableTasks??[]], fingerprint: runtime.store.active().fingerprint });
  } catch { res.status(503).json({ status: 'NOT_READY', dependencies: { postgres: 'UNAVAILABLE' } }); } });
  app.get('/version', (_req, res) => res.json({ configVersion: snapshot.value.configVersion, releaseId: snapshot.value.deployment.releaseId, fingerprint: snapshot.fingerprint }));
  app.post('/api/security/csp-report', express.raw({ limit: snapshot.value.security.cspReporting.maxBodyBytes,
    type: ['application/csp-report', 'application/reports+json'] }), async (req, res) => {
    if (!snapshot.value.security.cspReporting.enabled) { res.status(404).end(); return; }
    if (!Buffer.isBuffer(req.body)) { res.status(415).end(); return; }
    try {
      const report = parseCspReport(req.body, req.header('content-type'), snapshot.value.security.cspReporting.maxBodyBytes);
      await runtime.recordCspReport(securityContext(snapshot, req, 'security-csp-report'), report, req.body.length);
      res.status(204).end();
    } catch (error) {
      if (error instanceof exAdmission) { res.status(429).end(); return; }
      if (error instanceof Error && error.message === 'INVALID_CSP_REPORT') { res.status(400).end(); return; }
      res.status(503).end();
    }
  });
  app.use(express.json({ limit: snapshot.value.http.maxJsonBytes }));
  registerKnowledgeApi(app,snapshot,runtime);

  if (runtime.authentication) {
    const authentication = runtime.authentication;
    app.get('/api/auth/me', async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      const bearer = req.header('authorization');
      const match = bearer && /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(bearer);
      if (!match) { res.status(401).json({ error: 'INVALID_SESSION' }); return; }
      try {
        const claims = await authentication.authenticateBearer(match[1]!);
        res.json({ identityId: claims.identityId, tenantId: claims.tenantId, sessionId: claims.sessionId });
      } catch { res.status(401).json({ error: 'INVALID_SESSION' }); }
    });
    app.post('/api/auth/login', async (req, res, next) => { try {
      if (!authOrigin(snapshot, req, res)) return;
      res.setHeader('Cache-Control', 'no-store');
      const body = record(req.body);
      const email = string(body.email, 320), password = string(body.password, 128);
      const tenantId = body.tenantId === undefined ? undefined : string(body.tenantId, 100);
      const result = await authentication.login(email, password, req.socket.remoteAddress ?? '', tenantId);
      if (result.kind === 'INVALID') {
        await runtime.securityAudit.record(securityContext(snapshot, req, 'authentication'), 'authentication.failed', 'FAILED');
        res.status(401).json({ error: 'INVALID_CREDENTIALS' }); return;
      }
      if (result.kind === 'RATE_LIMITED') {
        await runtime.securityAudit.record(securityContext(snapshot, req, 'authentication'), 'authentication.rate_limited', 'DENIED');
        res.status(429).json({ error: 'LOGIN_RATE_LIMITED' }); return;
      }
      if (result.kind === 'TENANT_SELECTION_REQUIRED') { res.status(200).json({ status: result.kind, tenants: result.tenants }); return; }
      const signedIn = securityContext(snapshot, req, 'authentication', 'HUMAN', result.identityId, result.sessionId, result.tenantId);
      await runtime.securityAudit.record(signedIn, 'authentication.success', 'SUCCEEDED');
      await runtime.securityAudit.record(signedIn, 'session.created', 'SUCCEEDED');
      res.setHeader('Set-Cookie', refreshSetCookie(result.refreshToken));
      res.json({ accessToken: result.accessToken, tenantId: result.tenantId });
    } catch (error) { next(error); } });
    app.post('/api/auth/refresh', async (req, res, next) => { try {
      if (!authOrigin(snapshot, req, res)) return;
      res.setHeader('Cache-Control', 'no-store');
      const cookie = inspectRefreshCookie(req.header('cookie'));
      if (cookie.kind === 'AMBIGUOUS') { res.status(400).json({ error: 'INVALID_SESSION' }); return; }
      if (cookie.kind !== 'VALID') { res.status(401).json({ error: 'INVALID_SESSION' }); return; }
      const result = await authentication.refresh(cookie.token);
      if (result.kind === 'REPLAY') {
        const replay = securityContext(snapshot, req, 'session', 'HUMAN', result.identityId, result.sessionId, result.tenantId);
        await runtime.securityAudit.record(replay, 'session.refresh_replay_detected', 'DENIED');
        await runtime.securityAudit.record(replay, 'session.revoked', 'SUCCEEDED', 'REFRESH_REPLAY');
      }
      if (result.kind !== 'ROTATED') { res.setHeader('Set-Cookie', refreshClearCookie()); res.status(401).json({ error: 'INVALID_SESSION' }); return; }
      await runtime.securityAudit.record(securityContext(snapshot, req, 'session', 'HUMAN', result.identityId,
        result.sessionId, result.tenantId), 'session.refreshed', 'SUCCEEDED');
      res.setHeader('Set-Cookie', refreshSetCookie(result.refreshToken));
      res.json({ accessToken: result.accessToken, tenantId: result.tenantId });
    } catch (error) { next(error); } });
    app.post('/api/auth/logout', async (req, res, next) => { try {
      if (!authOrigin(snapshot, req, res)) return;
      res.setHeader('Cache-Control', 'no-store');
      const cookie = inspectRefreshCookie(req.header('cookie'));
      if (cookie.kind === 'AMBIGUOUS') { res.status(400).json({ error: 'INVALID_SESSION' }); return; }
      const revoked = cookie.kind === 'VALID' ? await authentication.logout(cookie.token) : null;
      if (revoked) {
        const logout = securityContext(snapshot, req, 'session', 'HUMAN', revoked.identityId, revoked.sessionId, revoked.tenantId);
        await runtime.securityAudit.record(logout, 'session.logout', 'SUCCEEDED');
        await runtime.securityAudit.record(logout, 'session.revoked', 'SUCCEEDED', 'LOGOUT');
      }
      res.setHeader('Set-Cookie', refreshClearCookie());
      res.status(204).end();
    } catch (error) { next(error); } });
  }

  moduleRoute(app, snapshot.value.modules.translator.route, async (req, res) => {
    enabled(snapshot, 'translator'); const body = record(req.body), id = requestId(body.request_id), { ctx, policy } = await context(snapshot, runtime, 'translator', req, res, id);
    const result = await runtime.translate(ctx,
      { text: string(body.text, 2_000_000), sourceLang: string(body.source_lang, 8), targetLang: string(body.target_lang, 8), signal: signalFor(req, res) },
      delta => writeSse(res, `data: ${JSON.stringify({ delta, cid: 0 })}\n\n`), policy);
    if (result.kind === 'DICTIONARY') res.json(result.dictionary);
    else { await writeSse(res, `data: [REF]:[]\n\ndata: [DONE:${id}]\n\n`); res.end(); }
  });
  moduleRoute(app, snapshot.value.modules.summarizer.route, async (req, res) => {
    enabled(snapshot, 'summarizer'); const body = record(req.body), id = requestId(body.request_id), { ctx, policy } = await context(snapshot, runtime, 'summarizer', req, res, id);
    await runtime.summarize(ctx,
      { text: string(body.text, 2_000_000), maxWords: positiveInteger(body.max_words, 100, 1, 2000), forcePersian: boolean(body.force_persian, false), signal: signalFor(req, res) },
      delta => writeSse(res, `data: ${JSON.stringify({ delta, cid: 0 })}\n\n`), policy);
    await writeSse(res, `data: [REF]:[]\n\ndata: [DONE:${id}]\n\n`); res.end();
  });
  for (const module of ['translator', 'summarizer'] as const) moduleRoute(app, `${snapshot.value.modules[module].route}/:reqId/stop`, async (req, res) => {
    enabled(snapshot, module); const id = requestId(req.params.reqId), { ctx } = await context(snapshot, runtime, module, req, res, id);
    res.json({ status: await runtime.router.cancel(ctx.deploymentId, ctx.tenantId, module, id) });
  });
  app.post('/api/file2Text', upload.single('file'), async (req, res, next) => {
    try {
      const maxChars = positiveInteger(req.query.maxChars, 2000, 1, 3000), module = maxChars > 2000 ? 'summarizer' : 'translator';
      enabled(snapshot, module); const file = fileOf(req), { ctx, policy } = await context(snapshot, runtime, module, req, res, randomUUID().replaceAll('-', ''));
      const result = await runtime.extractText(ctx, module, file, maxChars, policy);
      logOperational({ severity: 'INFO', component: 'file-processing', event: 'extracted', context: ctx, status: result.processor });
      res.json({ text: result.text, pagesProcessed: result.pageCount, totalChars: result.text.length });
    } catch (error) { next(error); } finally { if (req.file) await unlink(req.file.path).catch(() => {}); }
  });
  app.post('/api/faq/inspect', upload.single('file'), async (req, res, next) => {
    try { enabled(snapshot, 'faq'); const file = fileOf(req), { ctx, policy } = await context(snapshot, runtime, 'faq', req, res, randomUUID().replaceAll('-', '')); res.json(await runtime.inspectFaq(ctx, file, policy)); }
    catch (error) { next(error); } finally { if (req.file) await unlink(req.file.path).catch(() => {}); }
  });
  app.post(`/api${snapshot.value.modules.faq.route}`, upload.single('file'), async (req, res, next) => {
    try {
      enabled(snapshot, 'faq'); const file = fileOf(req), body = record(req.body), id = randomUUID().replaceAll('-', ''), { ctx, policy } = await context(snapshot, runtime, 'faq', req, res, id);
      let priorQuestions: unknown; try { priorQuestions = JSON.parse(String(body.prior_questions ?? '[]')) as unknown; } catch { throw new Error('INVALID_FAQ_INPUT'); }
      if (!Array.isArray(priorQuestions) || priorQuestions.some(x => typeof x !== 'string')) throw new Error('INVALID_FAQ_INPUT');
      const options: intfFaqOptions = { count: positiveInteger(body.count, 10, 1, 100), answerWords: positiveInteger(body.answer_words, 100, 20, 250), scope: string(body.scope ?? 'all', 10) as intfFaqOptions['scope'], tone: string(body.tone ?? 'formal', 20) as intfFaqOptions['tone'], language: string(body.language ?? 'source', 10) as intfFaqOptions['language'], focus: string(body.focus ?? '', 500), from: positiveInteger(body.from, 1, 1, 100000), to: positiveInteger(body.to, 1, 1, 100000), priorQuestions, signal: signalFor(req, res) };
      const produced = await runtime.generateFaq(ctx, file, options,
        meta => { sse(res); res.write(`event: meta\ndata: ${JSON.stringify(meta)}\n\n`); },
        (items, index, total, count) => { sse(res); res.write(`event: batch\ndata: ${JSON.stringify({ index, total, produced: count, items })}\n\n`); }, policy);
      sse(res); res.write(`event: done\ndata: ${JSON.stringify({ produced })}\n\n`); res.end();
    } catch (error) { next(error); } finally { if (req.file) await unlink(req.file.path).catch(() => {}); }
  });
  app.use((error: unknown, req: Request, res: Response, _next: express.NextFunction) => {
    const safe = safeError(error);
    logOperational({severity:safe.status>=500?'ERROR':'WARN',component:'target-api',event:'request_failed',
      context:res.locals.publicContext as intfExecutionContext|undefined,status:String(safe.status),errorClass:safe.code,
      method:req.method,route:req.route?.path??'UNMATCHED'});
    if (res.headersSent) {
      if (req.path.includes('/faq')) res.write(`event: error\ndata: ${JSON.stringify({ message: safe.code })}\n\n`);
      else if (safe.code === 'CANCELLED') {
        const id = (res.locals.publicContext as intfExecutionContext | undefined)?.requestId ?? '';
        res.write(`data: [CANCELLED:${id}]\n\ndata: [DONE:${id}]\n\n`);
      } else res.write(`data: [ERROR]: ${safe.code}\n\n`);
      res.end();
    }
    else res.status(safe.status).json({ error: safe.code });
  });
  return { app, router: runtime.router, close: runtime.close };
}

if (process.argv[1]?.endsWith('/apps/api/src/index.ts')) {
  const {installProcessErrorHandlers}=await import('../../../packages/observability/src/process-errors.js');
  let drain=async()=>{};
  installProcessErrorHandlers('target-api',()=>drain());
  const snapshot = await loadConfiguration(arg('--config', '/etc/targoman/platform.cjson'));
  const { app, close } = await createPublicApi(snapshot, arg('--secrets-dir', '/run/secrets'));
  const server = app.listen(snapshot.value.http.apiPort, snapshot.value.http.listenHost, () => logOperational({ severity: 'INFO', component: 'target-api', event: 'listening', status: 'READY' }));
  let draining:Promise<void>|undefined;
  drain=()=>draining??=new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>server.closeAllConnections(),30000);timer.unref();
    server.close(error=>{clearTimeout(timer);void close().then(()=>error?reject(error):resolve(),reject);});
    server.closeIdleConnections();
  });
  const shutdown = () => { void drain().catch(()=>{logOperational({severity:'ERROR',component:'target-api',event:'shutdown_failed',errorClass:'DRAIN_FAILED'});process.exitCode=1;}); };
  process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
}

import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import express, { type Request, type Response } from 'express';
import multer from 'multer';
import { loadConfiguration, type intfConfigurationSnapshot, type typModuleId } from '../../../packages/configuration/src/index.js';
import type { intfExecutionContext } from '../../../packages/contracts/src/index.js';
import { exAiRouter } from '../../../packages/ai-router/src/index.js';
import { exAdmission } from '../../../packages/admission-control/src/index.js';
import { exFileProcessing } from '../../../packages/file-processing/src/index.js';
import { logOperational } from '../../../packages/observability/src/index.js';
import type { intfFaqOptions } from '../../../modules/faq/src/service.js';
import { createPublicApiRuntime } from './composition.js';

function arg(name: string, fallback: string): string { const at = process.argv.indexOf(name); return at < 0 ? fallback : process.argv[at + 1] ?? fallback; }
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_BODY'); return value as Record<string, unknown>; }
function string(value: unknown, max: number): string { if (typeof value !== 'string' || value.length > max) throw new Error('INVALID_FIELD'); return value; }
function positiveInteger(value: unknown, fallback: number, min: number, max: number): number { if (value === undefined) return fallback; const number = Number(value); if (!Number.isInteger(number) || number < min || number > max) throw new Error('INVALID_FIELD'); return number; }
function boolean(value: unknown, fallback: boolean): boolean { if (value === undefined) return fallback; if (typeof value !== 'boolean') throw new Error('INVALID_FIELD'); return value; }
function requestId(value: unknown): string { if (value === undefined) return randomUUID().replaceAll('-', ''); if (typeof value !== 'string' || !/^[a-fA-F0-9]{32}$/.test(value)) throw new Error('INVALID_REQUEST_ID'); return value.toLowerCase(); }
function context(snapshot: intfConfigurationSnapshot, moduleId: typModuleId, req: Request, res: Response, id: string): intfExecutionContext {
  const header = req.header('x-correlation-id'); const correlationId = header && /^[A-Za-z0-9-]{8,64}$/.test(header) ? header : randomUUID();
  res.setHeader('X-Correlation-ID', correlationId); res.setHeader('X-Request-ID', id);
  const value: intfExecutionContext = { deploymentId: snapshot.value.deployment.id, tenantId: snapshot.value.deployment.tenantId, moduleId, requestId: id, correlationId, actorKind: 'ANONYMOUS', actorId: null, sessionId: null, source: 'PUBLIC_API', configFingerprint: snapshot.fingerprint };
  res.locals.publicContext = value;
  return value;
}
function enabled(snapshot: intfConfigurationSnapshot, module: typModuleId): void { if (!snapshot.value.modules[module].enabled) { const error = new Error('MODULE_DISABLED'); Object.assign(error, { status: 404 }); throw error; } }
function sse(res: Response): void { if (res.headersSent) return; res.status(200).setHeader('Content-Type', 'text/event-stream; charset=utf-8'); res.setHeader('Cache-Control', 'no-cache, no-transform'); res.setHeader('X-Accel-Buffering', 'no'); res.flushHeaders(); }
async function writeSse(res: Response, payload: string): Promise<void> { sse(res); if (!res.write(payload)) await new Promise<void>(resolve => res.once('drain', resolve)); }
function safeError(error: unknown): { status: number; code: string } {
  if (error instanceof exAdmission) return { status: error.code === 'INPUT_LIMIT_EXCEEDED' ? 413 : 429, code: error.code };
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

export async function createPublicApi(snapshot: intfConfigurationSnapshot, secretRoot = '/run/secrets') {
  const runtime = await createPublicApiRuntime(snapshot, secretRoot);
  const app = express(); app.disable('x-powered-by');
  app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); const origin = req.header('origin'); if (origin && !snapshot.value.http.allowedOrigins.includes(origin)) { res.status(403).json({ error: 'ORIGIN_DENIED' }); return; } if (origin) res.setHeader('Access-Control-Allow-Origin', origin); next(); });
  app.use(express.json({ limit: snapshot.value.http.maxJsonBytes }));
  const upload = multer({ dest: tmpdir(), limits: { fileSize: snapshot.value.fileProcessing.maxUploadBytes } });
  app.use((req, res, next) => { const started = Date.now(); const log = () => logOperational({ severity: res.statusCode >= 500 ? 'ERROR' : 'INFO', component: 'target-api', event: 'request_completed', context: res.locals.publicContext as intfExecutionContext | undefined, status: String(res.statusCode), durationMs: Date.now() - started, method: req.method, route: req.route?.path ?? req.path }); res.once('finish', log); next(); });
  app.get('/health', (_req, res) => res.json({ status: 'ALIVE' }));
  app.get('/', (_req, res) => res.json({ status: 'ALIVE' }));
  app.get('/ready', async (_req, res) => { try {
    await runtime.databaseReady();
    const ai = await runtime.router.probeReadiness();
    res.status(ai.status === 'READY' ? 200 : 503).json({ status: ai.status, dependencies: { postgres: 'READY', ai: ai.status }, unavailableTasks: ai.unavailableTasks, fingerprint: runtime.store.active().fingerprint });
  } catch { res.status(503).json({ status: 'NOT_READY', dependencies: { postgres: 'UNAVAILABLE' } }); } });
  app.get('/version', (_req, res) => res.json({ configVersion: snapshot.value.configVersion, releaseId: snapshot.value.deployment.releaseId, fingerprint: snapshot.fingerprint }));

  moduleRoute(app, snapshot.value.modules.translator.route, async (req, res) => {
    enabled(snapshot, 'translator'); const body = record(req.body), id = requestId(body.request_id), ctx = context(snapshot, 'translator', req, res, id);
    const result = await runtime.translate(ctx,
      { text: string(body.text, snapshot.value.admission.translator.inputChars), sourceLang: string(body.source_lang, 8), targetLang: string(body.target_lang, 8), signal: signalFor(req, res) },
      delta => writeSse(res, `data: ${JSON.stringify({ delta, cid: 0 })}\n\n`));
    if (result.kind === 'DICTIONARY') res.json(result.dictionary);
    else { await writeSse(res, `data: [REF]:[]\n\ndata: [DONE:${id}]\n\n`); res.end(); }
  });
  moduleRoute(app, snapshot.value.modules.summarizer.route, async (req, res) => {
    enabled(snapshot, 'summarizer'); const body = record(req.body), id = requestId(body.request_id), ctx = context(snapshot, 'summarizer', req, res, id);
    await runtime.summarize(ctx,
      { text: string(body.text, snapshot.value.admission.summarizer.inputChars), maxWords: positiveInteger(body.max_words, 100, 1, 2000), forcePersian: boolean(body.force_persian, false), signal: signalFor(req, res) },
      delta => writeSse(res, `data: ${JSON.stringify({ delta, cid: 0 })}\n\n`));
    await writeSse(res, `data: [REF]:[]\n\ndata: [DONE:${id}]\n\n`); res.end();
  });
  for (const module of ['translator', 'summarizer'] as const) moduleRoute(app, `${snapshot.value.modules[module].route}/:reqId/stop`, async (req, res) => {
    enabled(snapshot, module); const id = requestId(req.params.reqId), ctx = context(snapshot, module, req, res, id);
    res.json({ status: await runtime.router.cancel(ctx.deploymentId, ctx.tenantId, module, id) });
  });
  app.post('/api/file2Text', upload.single('file'), async (req, res, next) => {
    try {
      const maxChars = positiveInteger(req.query.maxChars, 2000, 1, 3000), module = maxChars > 2000 ? 'summarizer' : 'translator';
      enabled(snapshot, module); const file = fileOf(req), ctx = context(snapshot, module, req, res, randomUUID().replaceAll('-', ''));
      if (file.size > snapshot.value.admission[module].uploadBytes) throw new exFileProcessing('FILE_TOO_LARGE');
      const result = await runtime.extractText(ctx, module, file, maxChars);
      logOperational({ severity: 'INFO', component: 'file-processing', event: 'extracted', context: ctx, status: result.processor });
      res.json({ text: result.text, pagesProcessed: result.pageCount, totalChars: result.text.length });
    } catch (error) { next(error); } finally { if (req.file) await unlink(req.file.path).catch(() => {}); }
  });
  app.post('/api/faq/inspect', upload.single('file'), async (req, res, next) => {
    try { enabled(snapshot, 'faq'); const file = fileOf(req), ctx = context(snapshot, 'faq', req, res, randomUUID().replaceAll('-', '')); res.json(await runtime.inspectFaq(ctx, file)); }
    catch (error) { next(error); } finally { if (req.file) await unlink(req.file.path).catch(() => {}); }
  });
  app.post(`/api${snapshot.value.modules.faq.route}`, upload.single('file'), async (req, res, next) => {
    try {
      enabled(snapshot, 'faq'); const file = fileOf(req), body = record(req.body), id = randomUUID().replaceAll('-', ''), ctx = context(snapshot, 'faq', req, res, id);
      let priorQuestions: unknown; try { priorQuestions = JSON.parse(String(body.prior_questions ?? '[]')) as unknown; } catch { throw new Error('INVALID_FAQ_INPUT'); }
      if (!Array.isArray(priorQuestions) || priorQuestions.some(x => typeof x !== 'string')) throw new Error('INVALID_FAQ_INPUT');
      const options: intfFaqOptions = { count: positiveInteger(body.count, 10, 1, 100), answerWords: positiveInteger(body.answer_words, 100, 20, 250), scope: string(body.scope ?? 'all', 10) as intfFaqOptions['scope'], tone: string(body.tone ?? 'formal', 20) as intfFaqOptions['tone'], language: string(body.language ?? 'source', 10) as intfFaqOptions['language'], focus: string(body.focus ?? '', 500), from: positiveInteger(body.from, 1, 1, 100000), to: positiveInteger(body.to, 1, 1, 100000), priorQuestions, signal: signalFor(req, res) };
      const produced = await runtime.generateFaq(ctx, file, options,
        meta => { sse(res); res.write(`event: meta\ndata: ${JSON.stringify(meta)}\n\n`); },
        (items, index, total, count) => { sse(res); res.write(`event: batch\ndata: ${JSON.stringify({ index, total, produced: count, items })}\n\n`); });
      sse(res); res.write(`event: done\ndata: ${JSON.stringify({ produced })}\n\n`); res.end();
    } catch (error) { next(error); } finally { if (req.file) await unlink(req.file.path).catch(() => {}); }
  });
  app.use((error: unknown, req: Request, res: Response, _next: express.NextFunction) => {
    const safe = safeError(error);
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
  const snapshot = await loadConfiguration(arg('--config', '/etc/targoman/platform.cjson'));
  const { app, close } = await createPublicApi(snapshot, arg('--secrets-dir', '/run/secrets'));
  const server = app.listen(snapshot.value.http.apiPort, snapshot.value.http.listenHost, () => logOperational({ severity: 'INFO', component: 'target-api', event: 'listening', status: 'READY' }));
  const shutdown = () => { server.close(() => { void close(); }); };
  process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
}

import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

export type typModuleId = 'translator' | 'summarizer' | 'faq';
export type typAiTask = 'TRANSLATE' | 'SUMMARIZE' | 'GENERATE_FAQ';
export type typSecretRef = `file:/run/secrets/${string}`;
export interface intfBrandConfiguration { readonly displayName: string; readonly shortName: string; readonly logo: string; readonly favicon: string; readonly primaryColor: string; readonly supportUrl: string; readonly legalUrl: string }
export interface intfDatabaseConfiguration { readonly host: string; readonly port: number; readonly name: string; readonly apiUser: string; readonly workerUser: string; readonly migrationUser: string; readonly apiPasswordRef: typSecretRef; readonly workerPasswordRef: typSecretRef; readonly migrationPasswordRef: typSecretRef; readonly maxConnections: number }
export interface intfAiEndpointConfiguration { readonly id: string; readonly enabled: boolean; readonly provider: 'OPENAI_COMPATIBLE'; readonly baseUrl: string; readonly model: string; readonly capabilities: readonly typAiTask[]; readonly priority: number; readonly weight: number; readonly maxConcurrent: number; readonly connectTimeoutMs: number; readonly firstTokenTimeoutMs: number; readonly totalTimeoutMs: number; readonly credentialRef?: typSecretRef }
export interface intfAiTaskPolicy { readonly preferredEndpoints: readonly string[]; readonly maxAttempts: number; readonly circuitFailureThreshold: number; readonly circuitOpenMs: number }
export interface intfAdmissionPolicy { readonly requestsPerMinute: number; readonly concurrent: number; readonly dailyRequests: number; readonly dailyInputChars: number; readonly inputChars: number; readonly uploadBytes: number; readonly outputTokens: number; readonly tokenBudget: number }
export interface intfSiemConfiguration { readonly enabled: boolean; readonly destinationId: string; readonly url: string; readonly credentialRef?: typSecretRef; readonly timeoutMs: number; readonly maxAttempts: number; readonly events: readonly string[]; readonly deliveryGuarantee: 'NONE' | 'IDEMPOTENT' | 'DUPLICATE_TOLERANT' }
export interface intfSessionSecurityPolicy {
  readonly absoluteLifetimeSeconds: number;
  readonly refreshLifetimeSeconds: number;
  readonly inactivityLifetimeSeconds: number;
}
export type typAuthConfiguration = Readonly<{ enabled: false }> | Readonly<{
  enabled: true; issuer: string; audience: string; accessTokenSeconds: number;
  session: intfSessionSecurityPolicy;
  authenticatedAdmission: Readonly<Record<typModuleId, intfAdmissionPolicy>>;
  privilegedAdmission: Readonly<Record<typModuleId, intfAdmissionPolicy>>;
  activeKid: string; privateKeyRef: typSecretRef;
  publicKeys: readonly Readonly<{ kid: string; publicKeyRef: typSecretRef }>[];
}>;
export interface intfPlatformConfiguration {
  readonly configVersion: 1;
  readonly deployment: { readonly id: string; readonly tenantId: string; readonly releaseId: string };
  readonly modules: Readonly<Record<typModuleId, { readonly enabled: boolean; readonly route: string }>>;
  readonly brand: intfBrandConfiguration;
  readonly database: intfDatabaseConfiguration;
  readonly ai: { readonly endpoints: readonly intfAiEndpointConfiguration[]; readonly tasks: Readonly<Record<typAiTask, intfAiTaskPolicy>> };
  readonly admission: Readonly<Record<typModuleId, intfAdmissionPolicy>>;
  readonly siem: intfSiemConfiguration;
  readonly auth?: typAuthConfiguration;
  readonly fileProcessing: { readonly maxUploadBytes: number; readonly maxExtractedChars: number; readonly maxPages: number };
  readonly http: { readonly listenHost: string; readonly apiPort: number; readonly apiInternalUrl: string; readonly allowedOrigins: readonly string[]; readonly maxJsonBytes: number };
  readonly worker: { readonly pollMs: number; readonly claimLeaseMs: number };
  readonly observability: { readonly level: 'INFO' | 'WARN' | 'ERROR' };
  readonly audit: { readonly retentionDays: number };
  readonly usage: { readonly retentionDays: number };
  readonly retention: { readonly policyRef: string };
}
export interface intfConfigurationSnapshot { readonly value: intfPlatformConfiguration; readonly fingerprint: string; readonly loadedAt: string; readonly source: string }

const MODULES: readonly typModuleId[] = ['translator', 'summarizer', 'faq'];
const TASKS: readonly typAiTask[] = ['TRANSLATE', 'SUMMARIZE', 'GENERATE_FAQ'];
const TASK_MODULE: Readonly<Record<typModuleId, typAiTask>> = { translator: 'TRANSLATE', summarizer: 'SUMMARIZE', faq: 'GENERATE_FAQ' };
const IDENTIFIER = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SECRET_REF = /^file:\/run\/secrets\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

function fail(path: string, expected: string): never { throw new Error(`${path}: ${expected}`); }
function object(value: unknown, path: string, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'expected object');
  const result = value as Record<string, unknown>;
  for (const key of Object.keys(result)) if (!keys.includes(key)) fail(`${path}.${key}`, 'unknown key');
  return result;
}
function string(value: unknown, path: string, max = 256): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(path, 'expected nonempty string');
  return value;
}
function identifier(value: unknown, path: string): string { const v = string(value, path, 100); if (!IDENTIFIER.test(v)) fail(path, 'expected lowercase identifier'); return v; }
function databaseIdentifier(value: unknown, path: string): string { const v = string(value, path, 100); if (!/^[a-z][a-z0-9_]*$/.test(v)) fail(path, 'expected PostgreSQL identifier'); return v; }
function integer(value: unknown, path: string, min: number, max: number): number { if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) fail(path, `expected integer ${min}..${max}`); return value as number; }
function bool(value: unknown, path: string): boolean { if (typeof value !== 'boolean') fail(path, 'expected boolean'); return value; }
function list(value: unknown, path: string): readonly unknown[] { if (!Array.isArray(value)) fail(path, 'expected array'); return value; }
function url(value: unknown, path: string, protocols: readonly string[]): string { const v = string(value, path, 2048); let parsed: URL; try { parsed = new URL(v); } catch { return fail(path, 'invalid URL'); } if (!protocols.includes(parsed.protocol) || parsed.username || parsed.password || parsed.hash) fail(path, 'invalid URL protocol or credentials'); return v; }
function secret(value: unknown, path: string): typSecretRef { if (typeof value !== 'string' || !SECRET_REF.test(value)) fail(path, 'expected file:/run/secrets/<name> reference'); return value as typSecretRef; }
function optionalSecret(value: unknown, path: string): typSecretRef | undefined { return value === undefined ? undefined : secret(value, path); }
function unique(values: readonly string[], path: string): void { if (new Set(values).size !== values.length) fail(path, 'duplicate value'); }

// JSON-with-comments parser adapted from Sepidjoo's string-aware comment scan.
// Whitespace replaces comments so syntax-error positions remain useful.
export function parseCjson(input: string): unknown {
  let out = '', quoted = false, escaped = false, line = false, block = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i] ?? '', next = input[i + 1] ?? '';
    if (line) { if (ch === '\n' || ch === '\r') { line = false; out += ch; } else out += ' '; continue; }
    if (block) { if (ch === '*' && next === '/') { out += '  '; i += 1; block = false; } else out += ch === '\n' || ch === '\r' ? ch : ' '; continue; }
    if (quoted) { out += ch; if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') quoted = false; continue; }
    if (ch === '"') { quoted = true; out += ch; continue; }
    if (ch === '/' && next === '/') { line = true; out += '  '; i += 1; continue; }
    if (ch === '/' && next === '*') { block = true; out += '  '; i += 1; continue; }
    out += ch;
  }
  if (block) fail('CJSON', 'unterminated block comment');
  try { return JSON.parse(out) as unknown; } catch { return fail('CJSON', 'invalid syntax'); }
}

function brand(value: unknown): intfBrandConfiguration {
  const x = object(value, 'brand', ['displayName', 'shortName', 'logo', 'favicon', 'primaryColor', 'supportUrl', 'legalUrl']);
  const asset = (key: 'logo' | 'favicon'): string => { const v = string(x[key], `brand.${key}`, 256); if (!/^\/brand\/[A-Za-z0-9][A-Za-z0-9/_-]*\.(?:svg|png|ico|webp)$/.test(v) || v.includes('..')) fail(`brand.${key}`, 'expected safe /brand/ asset path'); return v; };
  const primaryColor = string(x.primaryColor, 'brand.primaryColor', 7);
  if (!/^#[0-9a-fA-F]{6}$/.test(primaryColor)) fail('brand.primaryColor', 'expected #RRGGBB');
  return { displayName: string(x.displayName, 'brand.displayName'), shortName: string(x.shortName, 'brand.shortName'), logo: asset('logo'), favicon: asset('favicon'), primaryColor, supportUrl: url(x.supportUrl, 'brand.supportUrl', ['https:']), legalUrl: url(x.legalUrl, 'brand.legalUrl', ['https:']) };
}
function database(value: unknown): intfDatabaseConfiguration {
  const x = object(value, 'database', ['host', 'port', 'name', 'apiUser', 'workerUser', 'migrationUser', 'apiPasswordRef', 'workerPasswordRef', 'migrationPasswordRef', 'maxConnections']);
  return { host: string(x.host, 'database.host'), port: integer(x.port, 'database.port', 1, 65535), name: databaseIdentifier(x.name, 'database.name'), apiUser: databaseIdentifier(x.apiUser, 'database.apiUser'), workerUser: databaseIdentifier(x.workerUser, 'database.workerUser'), migrationUser: databaseIdentifier(x.migrationUser, 'database.migrationUser'), apiPasswordRef: secret(x.apiPasswordRef, 'database.apiPasswordRef'), workerPasswordRef: secret(x.workerPasswordRef, 'database.workerPasswordRef'), migrationPasswordRef: secret(x.migrationPasswordRef, 'database.migrationPasswordRef'), maxConnections: integer(x.maxConnections, 'database.maxConnections', 1, 100) };
}
function endpoint(value: unknown, index: number): intfAiEndpointConfiguration {
  const path = `ai.endpoints[${index}]`, x = object(value, path, ['id', 'enabled', 'provider', 'baseUrl', 'model', 'capabilities', 'priority', 'weight', 'maxConcurrent', 'connectTimeoutMs', 'firstTokenTimeoutMs', 'totalTimeoutMs', 'credentialRef']);
  if (x.provider !== 'OPENAI_COMPATIBLE') fail(`${path}.provider`, 'unsupported provider');
  const capabilities = list(x.capabilities, `${path}.capabilities`).map((task, i) => { if (!TASKS.includes(task as typAiTask)) fail(`${path}.capabilities[${i}]`, 'unknown task'); return task as typAiTask; });
  if (!capabilities.length) fail(`${path}.capabilities`, 'at least one task required'); unique(capabilities, `${path}.capabilities`);
  const connectTimeoutMs = integer(x.connectTimeoutMs, `${path}.connectTimeoutMs`, 100, 60000);
  const firstTokenTimeoutMs = integer(x.firstTokenTimeoutMs, `${path}.firstTokenTimeoutMs`, connectTimeoutMs, 300000);
  const totalTimeoutMs = integer(x.totalTimeoutMs, `${path}.totalTimeoutMs`, firstTokenTimeoutMs, 900000);
  const credentialRef = optionalSecret(x.credentialRef, `${path}.credentialRef`);
  return { id: identifier(x.id, `${path}.id`), enabled: bool(x.enabled, `${path}.enabled`), provider: 'OPENAI_COMPATIBLE', baseUrl: url(x.baseUrl, `${path}.baseUrl`, ['http:', 'https:']), model: string(x.model, `${path}.model`), capabilities, priority: integer(x.priority, `${path}.priority`, 0, 1000), weight: integer(x.weight, `${path}.weight`, 1, 1000), maxConcurrent: integer(x.maxConcurrent, `${path}.maxConcurrent`, 1, 1000), connectTimeoutMs, firstTokenTimeoutMs, totalTimeoutMs, ...(credentialRef ? { credentialRef } : {}) };
}
function ai(value: unknown): intfPlatformConfiguration['ai'] {
  const x = object(value, 'ai', ['endpoints', 'tasks']);
  const endpoints = list(x.endpoints, 'ai.endpoints').map(endpoint); unique(endpoints.map(e => e.id), 'ai.endpoints');
  const raw = object(x.tasks, 'ai.tasks', TASKS); const tasks = {} as Record<typAiTask, intfAiTaskPolicy>;
  for (const task of TASKS) {
    const p = `ai.tasks.${task}`, t = object(raw[task], p, ['preferredEndpoints', 'maxAttempts', 'circuitFailureThreshold', 'circuitOpenMs']);
    const preferredEndpoints = list(t.preferredEndpoints, `${p}.preferredEndpoints`).map((v, i) => identifier(v, `${p}.preferredEndpoints[${i}]`)); unique(preferredEndpoints, `${p}.preferredEndpoints`);
    for (const id of preferredEndpoints) if (!endpoints.some(e => e.id === id)) fail(`${p}.preferredEndpoints`, `unknown endpoint ${id}`);
    tasks[task] = { preferredEndpoints, maxAttempts: integer(t.maxAttempts, `${p}.maxAttempts`, 1, 5), circuitFailureThreshold: integer(t.circuitFailureThreshold, `${p}.circuitFailureThreshold`, 1, 100), circuitOpenMs: integer(t.circuitOpenMs, `${p}.circuitOpenMs`, 1000, 3600000) };
  }
  return { endpoints, tasks };
}
function admission(value: unknown, maxUploadBytes: number, path = 'admission', requireOutputTokens = false): intfPlatformConfiguration['admission'] {
  const raw = object(value, path, MODULES), result = {} as Record<typModuleId, intfAdmissionPolicy>;
  for (const module of MODULES) {
    const p = `${path}.${module}`, x = object(raw[module], p, ['requestsPerMinute', 'concurrent', 'dailyRequests', 'dailyInputChars', 'inputChars', 'uploadBytes', 'outputTokens', 'tokenBudget']);
    const uploadBytes = integer(x.uploadBytes, `${p}.uploadBytes`, 0, maxUploadBytes);
    result[module] = { requestsPerMinute: integer(x.requestsPerMinute, `${p}.requestsPerMinute`, 1, 1000000), concurrent: integer(x.concurrent, `${p}.concurrent`, 1, 100000), dailyRequests: integer(x.dailyRequests, `${p}.dailyRequests`, 1, 100000000), dailyInputChars: integer(x.dailyInputChars, `${p}.dailyInputChars`, 1, 1000000000), inputChars: integer(x.inputChars, `${p}.inputChars`, 1, 2000000), uploadBytes, outputTokens: integer(x.outputTokens ?? (requireOutputTokens ? undefined : module === 'faq' ? 20000 : 2000), `${p}.outputTokens`, 1, 100000), tokenBudget: integer(x.tokenBudget, `${p}.tokenBudget`, 1, 1000000000) };
  }
  return result;
}
function siem(value: unknown): intfSiemConfiguration {
  const x = object(value, 'siem', ['enabled', 'destinationId', 'url', 'credentialRef', 'timeoutMs', 'maxAttempts', 'events', 'deliveryGuarantee']);
  const enabled = bool(x.enabled, 'siem.enabled');
  const events = list(x.events, 'siem.events').map((v, i) => string(v, `siem.events[${i}]`)); unique(events, 'siem.events');
  const credentialRef = optionalSecret(x.credentialRef, 'siem.credentialRef');
  const deliveryGuarantee = x.deliveryGuarantee ?? 'NONE';
  if (!['NONE', 'IDEMPOTENT', 'DUPLICATE_TOLERANT'].includes(String(deliveryGuarantee))) fail('siem.deliveryGuarantee', 'invalid delivery guarantee');
  return { enabled, destinationId: identifier(x.destinationId, 'siem.destinationId'), url: enabled ? url(x.url, 'siem.url', ['https:']) : typeof x.url === 'string' ? x.url : '', ...(credentialRef ? { credentialRef } : {}), timeoutMs: integer(x.timeoutMs, 'siem.timeoutMs', 100, 120000), maxAttempts: integer(x.maxAttempts, 'siem.maxAttempts', 1, 20), events, deliveryGuarantee: deliveryGuarantee as intfSiemConfiguration['deliveryGuarantee'] };
}

function auth(value: unknown, maxUploadBytes: number): typAuthConfiguration | undefined {
  if (value === undefined) return undefined;
  const x = object(value, 'auth', ['enabled', 'issuer', 'audience', 'accessTokenSeconds', 'session', 'authenticatedAdmission', 'privilegedAdmission', 'activeKid', 'privateKeyRef', 'publicKeys']);
  if (!bool(x.enabled, 'auth.enabled')) {
    if (Object.keys(x).length !== 1) fail('auth', 'disabled auth must contain only enabled');
    return { enabled: false };
  }
  const issuer = url(x.issuer, 'auth.issuer', ['https:']);
  const audience = string(x.audience, 'auth.audience', 100);
  const accessTokenSeconds = integer(x.accessTokenSeconds, 'auth.accessTokenSeconds', 1, 300);
  const sessionRaw = object(x.session, 'auth.session', ['absoluteLifetimeSeconds', 'refreshLifetimeSeconds', 'inactivityLifetimeSeconds']);
  const session: intfSessionSecurityPolicy = {
    absoluteLifetimeSeconds: integer(sessionRaw.absoluteLifetimeSeconds, 'auth.session.absoluteLifetimeSeconds', 300, 30 * 24 * 60 * 60),
    refreshLifetimeSeconds: integer(sessionRaw.refreshLifetimeSeconds, 'auth.session.refreshLifetimeSeconds', 60, 7 * 24 * 60 * 60),
    inactivityLifetimeSeconds: integer(sessionRaw.inactivityLifetimeSeconds, 'auth.session.inactivityLifetimeSeconds', 60, 7 * 24 * 60 * 60)
  };
  if (session.refreshLifetimeSeconds > session.absoluteLifetimeSeconds || session.inactivityLifetimeSeconds > session.absoluteLifetimeSeconds)
    fail('auth.session', 'refresh and inactivity lifetimes must not exceed absolute lifetime');
  const authenticatedAdmission = admission(x.authenticatedAdmission, maxUploadBytes, 'auth.authenticatedAdmission', true);
  const privilegedAdmission = admission(x.privilegedAdmission, maxUploadBytes, 'auth.privilegedAdmission', true);
  const activeKid = string(x.activeKid, 'auth.activeKid', 64);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(activeKid)) fail('auth.activeKid', 'invalid key ID');
  const publicKeys = list(x.publicKeys, 'auth.publicKeys').map((item, index) => {
    const key = object(item, `auth.publicKeys[${index}]`, ['kid', 'publicKeyRef']);
    const kid = string(key.kid, `auth.publicKeys[${index}].kid`, 64);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(kid)) fail(`auth.publicKeys[${index}].kid`, 'invalid key ID');
    return { kid, publicKeyRef: secret(key.publicKeyRef, `auth.publicKeys[${index}].publicKeyRef`) };
  });
  unique(publicKeys.map(key => key.kid), 'auth.publicKeys');
  if (!publicKeys.some(key => key.kid === activeKid)) fail('auth.activeKid', 'no matching public key');
  return { enabled: true, issuer, audience, accessTokenSeconds, session, authenticatedAdmission, privilegedAdmission, activeKid,
    privateKeyRef: secret(x.privateKeyRef, 'auth.privateKeyRef'), publicKeys };
}

export function validateConfiguration(value: unknown): intfPlatformConfiguration {
  const root = object(value, 'config', ['configVersion', 'deployment', 'modules', 'brand', 'database', 'ai', 'admission', 'siem', 'auth', 'fileProcessing', 'http', 'worker', 'observability', 'audit', 'usage', 'retention']);
  if (root.configVersion !== 1) fail('configVersion', 'unsupported version');
  const dep = object(root.deployment, 'deployment', ['id', 'tenantId', 'releaseId']);
  const deployment = { id: identifier(dep.id, 'deployment.id'), tenantId: identifier(dep.tenantId, 'deployment.tenantId'), releaseId: identifier(dep.releaseId, 'deployment.releaseId') };
  const rawModules = object(root.modules, 'modules', MODULES), modules = {} as Record<typModuleId, { enabled: boolean; route: string }>;
  for (const module of MODULES) { const p = `modules.${module}`, x = object(rawModules[module], p, ['enabled', 'route']); const route = string(x.route, `${p}.route`, 100); if (!/^\/[a-z][a-z0-9/-]*$/.test(route) || route.includes('//') || route.includes('..')) fail(`${p}.route`, 'invalid route'); modules[module] = { enabled: bool(x.enabled, `${p}.enabled`), route }; }
  unique(MODULES.map(m => modules[m].route), 'modules.*.route');
  const fp = object(root.fileProcessing, 'fileProcessing', ['maxUploadBytes', 'maxExtractedChars', 'maxPages']);
  const fileProcessing = { maxUploadBytes: integer(fp.maxUploadBytes, 'fileProcessing.maxUploadBytes', 1, 200000000), maxExtractedChars: integer(fp.maxExtractedChars, 'fileProcessing.maxExtractedChars', 1, 2000000), maxPages: integer(fp.maxPages, 'fileProcessing.maxPages', 1, 10000) };
  const aiConfig = ai(root.ai);
  for (const module of MODULES) if (modules[module].enabled && !aiConfig.endpoints.some(e => e.enabled && e.capabilities.includes(TASK_MODULE[module]))) fail(`modules.${module}.enabled`, `no eligible ${TASK_MODULE[module]} endpoint`);
  const h = object(root.http, 'http', ['listenHost', 'apiPort', 'apiInternalUrl', 'allowedOrigins', 'maxJsonBytes']);
  const http = { listenHost: string(h.listenHost, 'http.listenHost'), apiPort: integer(h.apiPort, 'http.apiPort', 1, 65535), apiInternalUrl: url(h.apiInternalUrl, 'http.apiInternalUrl', ['http:', 'https:']), allowedOrigins: list(h.allowedOrigins, 'http.allowedOrigins').map((v, i) => url(v, `http.allowedOrigins[${i}]`, ['http:', 'https:'])), maxJsonBytes: integer(h.maxJsonBytes, 'http.maxJsonBytes', 1024, 1000000) };
  const w = object(root.worker, 'worker', ['pollMs', 'claimLeaseMs']); const worker = { pollMs: integer(w.pollMs, 'worker.pollMs', 100, 60000), claimLeaseMs: integer(w.claimLeaseMs, 'worker.claimLeaseMs', 1000, 3600000) };
  const o = object(root.observability, 'observability', ['level']); if (!['INFO', 'WARN', 'ERROR'].includes(String(o.level))) fail('observability.level', 'invalid level');
  const a = object(root.audit, 'audit', ['retentionDays']), u = object(root.usage, 'usage', ['retentionDays']), r = object(root.retention, 'retention', ['policyRef']);
  return { configVersion: 1, deployment, modules, brand: brand(root.brand), database: database(root.database), ai: aiConfig, admission: admission(root.admission, fileProcessing.maxUploadBytes), siem: siem(root.siem), ...(root.auth === undefined ? {} : { auth: auth(root.auth, fileProcessing.maxUploadBytes) }), fileProcessing, http, worker, observability: { level: o.level as 'INFO' | 'WARN' | 'ERROR' }, audit: { retentionDays: integer(a.retentionDays, 'audit.retentionDays', 1, 36500) }, usage: { retentionDays: integer(u.retentionDays, 'usage.retentionDays', 1, 36500) }, retention: { policyRef: string(r.policyRef, 'retention.policyRef') } };
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, key.endsWith('Ref') && typeof item === 'string' && item.startsWith('file:/run/secrets/') ? '[SECRET_REF]' : canonical(item)]));
  return value;
}
function freeze<T>(value: T): T { if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); } return value; }
function snapshot(value: intfPlatformConfiguration, source: string): intfConfigurationSnapshot { return freeze({ value, fingerprint: createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex'), loadedAt: new Date().toISOString(), source }); }
export async function loadConfiguration(path = '/etc/targoman/platform.cjson'): Promise<intfConfigurationSnapshot> { const raw = await readFile(path, 'utf8'); return snapshot(validateConfiguration(parseCjson(raw)), resolve(path)); }
export function redactConfiguration(value: intfPlatformConfiguration): unknown { return canonical(value); }
export async function resolveSecretRef(ref: typSecretRef, secretRoot = '/run/secrets'): Promise<string> {
  if (!SECRET_REF.test(ref)) fail('secretRef', 'invalid reference');
  const base = resolve(secretRoot), path = resolve(base, ref.slice('file:/run/secrets/'.length));
  if (!path.startsWith(base + sep)) fail('secretRef', 'outside secret directory');
  const actual = await realpath(path);
  if (!actual.startsWith(base + sep)) fail('secretRef', 'secret symlink escapes directory');
  const value = await readFile(actual, 'utf8'); if (!value.trim()) fail('secretRef', 'empty secret'); return value.trimEnd();
}
export interface intfLegacyMysqlSource { readonly host: string; readonly user: string; readonly password: string; readonly database: string; readonly port: number }
/** One-time migration compatibility boundary for the existing ignored legacy JSON file. */
export async function loadLegacyMysqlSource(path: string): Promise<intfLegacyMysqlSource> {
  const raw = JSON.parse(await readFile(path, 'utf8')) as unknown;
  if (!raw || typeof raw !== 'object') fail('legacyConfig', 'expected object');
  const db = (raw as Record<string, unknown>).db;
  if (!db || typeof db !== 'object') fail('legacyConfig.db', 'expected object');
  const mysql = (db as Record<string, unknown>).mysql;
  if (!mysql || typeof mysql !== 'object') fail('legacyConfig.db.mysql', 'expected object');
  const x = mysql as Record<string, unknown>;
  return { host: string(x.host, 'legacyConfig.db.mysql.host'), user: string(x.user, 'legacyConfig.db.mysql.user'), password: string(x.password, 'legacyConfig.db.mysql.password'), database: string(x.database, 'legacyConfig.db.mysql.database'), port: x.port === undefined ? 3306 : integer(x.port, 'legacyConfig.db.mysql.port', 1, 65535) };
}
export class clsConfigurationStore {
  #current: intfConfigurationSnapshot;
  constructor(initial: intfConfigurationSnapshot) { this.#current = initial; }
  active(): intfConfigurationSnapshot { return this.#current; }
  async reload(path: string): Promise<intfConfigurationSnapshot> {
    const candidate = await loadConfiguration(path), old = this.#current.value, next = candidate.value;
    if (JSON.stringify(old.deployment) !== JSON.stringify(next.deployment) || JSON.stringify(old.database) !== JSON.stringify(next.database) || JSON.stringify(old.http) !== JSON.stringify(next.http)) fail('reload', 'startup-only configuration changed');
    this.#current = candidate; return candidate;
  }
}

import {enuMalwareMode,type intfMalwareConfiguration} from '../../file-processing/src/malware.js';
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { DEFAULT_ARCHIVE_LIMITS, type intfArchiveLimits } from '../../file-processing/src/office-archive.js';
import { enuStorageKind } from '../../storage/src/index.js';
import type { intfProtectedAiConfiguration } from '../../contracts/src/protected-ai.js';
import type { intfGovernanceConfiguration } from '../../data-governance/src/index.js';
import { validateProtectedAi, validateAiGovernance } from './protected-ai.js';
import { validateKnowledge, type typKnowledgeConfiguration } from './knowledge.js';

export type typModuleId = 'translator' | 'summarizer' | 'faq';
export type typAiTask = 'TRANSLATE' | 'SUMMARIZE' | 'GENERATE_FAQ';
export type typSecretRef = `file:/run/secrets/${string}`;
export interface intfFileActorLimits {
  readonly maxBytes: number;
  readonly maxConcurrent: number;
  readonly maxPendingBytes: number;
  readonly maxStorageBytes: number;
  readonly maxAssets: number;
}
export type typFileStorageConfiguration = Readonly<{ kind: enuStorageKind.Local; profileId: string; root: string }>
  | Readonly<{ kind: enuStorageKind.S3; profileId: string; endpoint: string; region: string; bucket: string;
    forcePathStyle: boolean; timeoutMs: number; accessKeyRef: typSecretRef; secretKeyRef: typSecretRef }>;
export type typFileManagementConfiguration = Readonly<{ enabled: false }> | Readonly<{
  enabled: true;
  storage: typFileStorageConfiguration;
  limitTiers?: Readonly<{ authenticated: intfFileActorLimits; privileged: intfFileActorLimits }>;
  uploads: Readonly<{ mode: 'PROXY'; partBytes: number; ttlMs: number; timeoutMs: number; maxConcurrent: number;
    maxBytes: number; maxPendingBytes: number; maxTenantStorageBytes: number; maxTenantAssets: number }>;
  downloads: Readonly<{ ranges: boolean; conditional: boolean; maxConcurrent: number }>;
  cache: Readonly<{ scope: 'REPLICA_PRIVATE'; root: string; maxBytes: number; maxEntries: number; ttlMs: number; timeoutMs: number }>;
  staging: Readonly<{ root: string; maxBytes: number }>;
  security: Readonly<{ privateOnly: true; integrityRequired: true; malware?:intfMalwareConfiguration }>;
}>;
export interface intfBrandConfiguration { readonly displayName: string; readonly shortName: string; readonly logo: string; readonly logoLight?: string; readonly favicon: string; readonly primaryColor: string; readonly supportUrl: string; readonly legalUrl: string }
export interface intfDatabaseConfiguration { readonly host: string; readonly port: number; readonly name: string; readonly apiUser: string; readonly workerUser: string; readonly migrationUser: string; readonly apiPasswordRef: typSecretRef; readonly workerPasswordRef: typSecretRef; readonly migrationPasswordRef: typSecretRef; readonly maxConnections: number; readonly tls?:Readonly<{caRef:typSecretRef;serverName:string}> }
export interface intfAiEndpointConfiguration { readonly id: string; readonly enabled: boolean; readonly provider: 'OPENAI_COMPATIBLE'; readonly baseUrl: string; readonly model: string; readonly capabilities: readonly typAiTask[]; readonly priority: number; readonly weight: number; readonly maxConcurrent: number; readonly connectTimeoutMs: number; readonly firstTokenTimeoutMs: number; readonly totalTimeoutMs: number; readonly credentialRef?: typSecretRef }
export interface intfAiTaskPolicy { readonly preferredEndpoints: readonly string[]; readonly maxAttempts: number; readonly circuitFailureThreshold: number; readonly circuitOpenMs: number }
export interface intfAdmissionPolicy { readonly requestsPerMinute: number; readonly concurrent: number; readonly dailyRequests: number; readonly dailyInputChars: number; readonly inputChars: number; readonly uploadBytes: number; readonly outputTokens: number; readonly tokenBudget: number }
export interface intfSiemConfiguration { readonly enabled: boolean; readonly destinationId: string; readonly url: string; readonly credentialRef?: typSecretRef; readonly timeoutMs: number; readonly maxAttempts: number; readonly events: readonly string[]; readonly deliveryGuarantee: 'NONE' | 'IDEMPOTENT' | 'DUPLICATE_TOLERANT' }
export interface intfCspReportingPolicy { readonly enabled: boolean; readonly maxBodyBytes: number; readonly requestsPerMinute: number }
export interface intfSessionSecurityPolicy {
  readonly absoluteLifetimeSeconds: number;
  readonly refreshLifetimeSeconds: number;
  readonly inactivityLifetimeSeconds: number;
}
export type typBreachProvider = Readonly<{ kind: 'LOCAL_SHA1'; directory: string }>
  | Readonly<{ kind: 'RANGE_API'; baseUrl: string; timeoutMs: number }>;
export interface intfPasswordConfiguration { readonly contextWords: readonly string[]; readonly compromised: typBreachProvider }
export enum enuAuthenticationMethod { OrganizationalOidc = 'ORGANIZATIONAL_OIDC', LegacyKey = 'LEGACY_KEY', DevelopmentPassword = 'DEVELOPMENT_PASSWORD' }
export interface intfOidcConfiguration { readonly enabled: boolean; readonly issuer?: string; readonly clientId?: string;
  readonly clientSecretRef?: typSecretRef; readonly scopes?: readonly string[]; readonly callbackUri?: string;
  readonly provisioning?: 'DISABLED' | 'DEVELOPMENT'; }
export interface intfLegacyKeyConfiguration { readonly enabled: boolean; readonly selfProvision: boolean;
  readonly onboardingTenantId?: string; readonly onboardingRoleId?: string }
export type typAuthConfiguration = Readonly<{ enabled: false }> | Readonly<{
  enabled: true; issuer: string; audience: string; accessTokenSeconds: number;
  publicOrigin: string; allowedApplicationOrigins: readonly string[];
  session: intfSessionSecurityPolicy;
  password: intfPasswordConfiguration;
  authenticatedAdmission: Readonly<Record<typModuleId, intfAdmissionPolicy>>;
  privilegedAdmission: Readonly<Record<typModuleId, intfAdmissionPolicy>>;
  activeKid: string; privateKeyRef: typSecretRef;
  publicKeys: readonly Readonly<{ kid: string; publicKeyRef: typSecretRef }>[];
  methods?: Readonly<{ organizationalOidc: intfOidcConfiguration; legacyKey: intfLegacyKeyConfiguration; developmentPassword: boolean }>;
}>;
export interface intfPlatformConfiguration {
  readonly configVersion: 1;
  readonly deployment: { readonly id: string; readonly tenantId: string; readonly releaseId: string };
  readonly modules: Readonly<Record<typModuleId, { readonly enabled: boolean; readonly route: string }>>;
  readonly brand: intfBrandConfiguration;
  readonly web?: { readonly publicOrigin: string };
  readonly database: intfDatabaseConfiguration;
  readonly ai: { readonly endpoints: readonly intfAiEndpointConfiguration[]; readonly tasks: Readonly<Record<typAiTask, intfAiTaskPolicy>>; readonly protected?: intfProtectedAiConfiguration };
  readonly dataGovernance?: intfGovernanceConfiguration;
  readonly knowledge?: typKnowledgeConfiguration;
  readonly admission: Readonly<Record<typModuleId, intfAdmissionPolicy>>;
  readonly siem: intfSiemConfiguration;
  readonly security: { readonly cspReporting: intfCspReportingPolicy;
    readonly assuranceProfile: 'DEVELOPMENT_PASSWORD' | 'CUSTOMER_L3' };
  readonly auth?: typAuthConfiguration;
  readonly fileProcessing: { readonly maxUploadBytes: number; readonly maxExtractedChars: number; readonly maxPages: number; readonly archive: intfArchiveLimits };
  readonly fileManagement?: typFileManagementConfiguration;
  readonly http: { readonly listenHost: string; readonly apiPort: number; readonly apiInternalUrl: string; readonly allowedOrigins: readonly string[]; readonly maxJsonBytes: number };
  readonly worker: { readonly pollMs: number; readonly claimLeaseMs: number; readonly identityId?: string };
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
function origin(value: unknown, path: string): string {
  const parsed = url(value, path, ['http:', 'https:']);
  if (new URL(parsed).origin !== parsed) fail(path, 'expected exact origin without path, query, or trailing slash');
  return parsed;
}
function secret(value: unknown, path: string): typSecretRef { if (typeof value !== 'string' || !SECRET_REF.test(value)) fail(path, 'expected file:/run/secrets/<name> reference'); return value as typSecretRef; }
function optionalSecret(value: unknown, path: string): typSecretRef | undefined { return value === undefined ? undefined : secret(value, path); }
function unique(values: readonly string[], path: string): void { if (new Set(values).size !== values.length) fail(path, 'duplicate value'); }

/** One canonical validator for all managed storage/transfer configuration. */
export function validateFileManagement(value: unknown, deploymentId: string, maxUploadBytes: number): typFileManagementConfiguration {
  const path = 'fileManagement', x = object(value, path, ['enabled', 'storage', 'limitTiers', 'uploads', 'downloads', 'cache', 'staging', 'security']);
  if (!bool(x.enabled, `${path}.enabled`)) {
    if (Object.keys(x).length !== 1) fail(path, 'disabled capability must contain only enabled');
    return { enabled: false };
  }
  const localPath = (value: unknown, name: string): string => {
    const raw = string(value, name, 1024);
    if (resolve(raw) !== raw || raw === '/' || raw.includes('\0')) fail(name, 'expected absolute normalized private directory');
    return raw;
  };
  const s = object(x.storage, `${path}.storage`, ['kind', 'profileId', 'root', 'endpoint', 'region', 'bucket', 'forcePathStyle', 'timeoutMs', 'accessKeyRef', 'secretKeyRef']);
  const profileId = identifier(s.profileId, `${path}.storage.profileId`);
  let storage: typFileStorageConfiguration;
  if (s.kind === 'LOCAL') {
    if (Object.keys(s).some(key => !['kind', 'profileId', 'root'].includes(key))) fail(`${path}.storage`, 'local adapter contains remote configuration');
    storage = { kind: enuStorageKind.Local, profileId, root: localPath(s.root, `${path}.storage.root`) };
  } else if (s.kind === 'S3_COMPATIBLE') {
    if (s.root !== undefined) fail(`${path}.storage.root`, 'remote adapter cannot have a local canonical directory');
    const endpoint = url(s.endpoint, `${path}.storage.endpoint`, ['https:', 'http:']);
    const parsed = new URL(endpoint);
    if (parsed.search || (parsed.pathname !== '/' && parsed.pathname !== '')) fail(`${path}.storage.endpoint`, 'expected storage origin');
    if (parsed.protocol !== 'https:' && !((deploymentId === 'development' || deploymentId.startsWith('test-'))
      && ['127.0.0.1', '[::1]', 'localhost'].includes(parsed.hostname))) fail(`${path}.storage.endpoint`, 'HTTPS required; loopback HTTP only for development/tests');
    const bucket = string(s.bucket, `${path}.storage.bucket`, 63);
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u.test(bucket) || bucket.includes('..')) fail(`${path}.storage.bucket`, 'invalid bucket');
    storage = { kind: enuStorageKind.S3, profileId, endpoint, bucket, region: string(s.region, `${path}.storage.region`, 100),
      forcePathStyle: bool(s.forcePathStyle, `${path}.storage.forcePathStyle`),
      timeoutMs: integer(s.timeoutMs, `${path}.storage.timeoutMs`, 100, 120000),
      accessKeyRef: secret(s.accessKeyRef, `${path}.storage.accessKeyRef`), secretKeyRef: secret(s.secretKeyRef, `${path}.storage.secretKeyRef`) };
  } else fail(`${path}.storage.kind`, 'unsupported storage adapter');
  const u = object(x.uploads, `${path}.uploads`, ['mode', 'partBytes', 'ttlMs', 'timeoutMs', 'maxConcurrent', 'maxBytes', 'maxPendingBytes', 'maxTenantStorageBytes', 'maxTenantAssets']);
  if (u.mode !== 'PROXY') fail(`${path}.uploads.mode`, 'only bounded proxy multipart transfer is supported');
  const maxBytes = integer(u.maxBytes, `${path}.uploads.maxBytes`, 1, maxUploadBytes);
  const uploads = { mode: 'PROXY' as const, partBytes: integer(u.partBytes, `${path}.uploads.partBytes`, 5 * 1024 * 1024, 20 * 1024 * 1024),
    ttlMs: integer(u.ttlMs, `${path}.uploads.ttlMs`, 60000, 24 * 3600000), timeoutMs: integer(u.timeoutMs, `${path}.uploads.timeoutMs`, 1000, 900000),
    maxConcurrent: integer(u.maxConcurrent, `${path}.uploads.maxConcurrent`, 1, 100), maxBytes,
    maxPendingBytes: integer(u.maxPendingBytes, `${path}.uploads.maxPendingBytes`, maxBytes, 1000000000000),
    maxTenantStorageBytes: integer(u.maxTenantStorageBytes, `${path}.uploads.maxTenantStorageBytes`, maxBytes, 1000000000000),
    maxTenantAssets: integer(u.maxTenantAssets, `${path}.uploads.maxTenantAssets`, 1, 10000000) };
  const d = object(x.downloads, `${path}.downloads`, ['ranges', 'conditional', 'maxConcurrent']);
  const downloads = { ranges: bool(d.ranges, `${path}.downloads.ranges`), conditional: bool(d.conditional, `${path}.downloads.conditional`),
    maxConcurrent: integer(d.maxConcurrent, `${path}.downloads.maxConcurrent`, 1, 100) };
  const c = object(x.cache, `${path}.cache`, ['scope', 'root', 'maxBytes', 'maxEntries', 'ttlMs', 'timeoutMs']);
  if (c.scope !== 'REPLICA_PRIVATE') fail(`${path}.cache.scope`, 'cache requires a private replica volume with Linux flock support');
  const cache = { scope: 'REPLICA_PRIVATE' as const, root: localPath(c.root, `${path}.cache.root`),
    maxBytes: integer(c.maxBytes, `${path}.cache.maxBytes`, maxBytes, 1000000000000),
    maxEntries: integer(c.maxEntries, `${path}.cache.maxEntries`, 1, 100000),
    ttlMs: integer(c.ttlMs, `${path}.cache.ttlMs`, 1000, 24 * 3600000),
    timeoutMs: integer(c.timeoutMs, `${path}.cache.timeoutMs`, 1000, 900000) };
  const st = object(x.staging, `${path}.staging`, ['root', 'maxBytes']);
  const staging = { root: localPath(st.root, `${path}.staging.root`), maxBytes: integer(st.maxBytes, `${path}.staging.maxBytes`, maxBytes, 1000000000000) };
  if (!staging.root.startsWith(`${resolve(tmpdir())}/`)) fail(`${path}.staging.root`, 'processor scratch must be a private directory beneath the platform temporary root');
  const directories = [cache.root, staging.root, ...(storage.kind === 'LOCAL' ? [storage.root] : [])];
  for (const directory of directories) for (const other of directories)
    if (directory !== other && directory.startsWith(`${other}/`)) fail(path, 'canonical storage, staging and cache must have separate directories');
  if (new Set(directories).size !== directories.length) fail(path, 'canonical storage, staging and cache must have separate directories');
  const security = object(x.security, `${path}.security`, ['privateOnly', 'integrityRequired','malware']);
  if (security.privateOnly !== true || security.integrityRequired !== true) fail(`${path}.security`, 'private storage and integrity verification are mandatory');
  let limitTiers: Extract<typFileManagementConfiguration, { enabled: true }>['limitTiers'];
  if (x.limitTiers !== undefined) {
    const tiers = object(x.limitTiers, `${path}.limitTiers`, ['authenticated', 'privileged']);
    const tier = (name: 'authenticated' | 'privileged'): intfFileActorLimits => {
      const p = `${path}.limitTiers.${name}`;
      const t = object(tiers[name], p, ['maxBytes', 'maxConcurrent', 'maxPendingBytes', 'maxStorageBytes', 'maxAssets']);
      const bytes = integer(t.maxBytes, `${p}.maxBytes`, 1, uploads.maxBytes);
      return { maxBytes: bytes, maxConcurrent: integer(t.maxConcurrent, `${p}.maxConcurrent`, 1, uploads.maxConcurrent),
        maxPendingBytes: integer(t.maxPendingBytes, `${p}.maxPendingBytes`, bytes, uploads.maxPendingBytes),
        maxStorageBytes: integer(t.maxStorageBytes, `${p}.maxStorageBytes`, bytes, uploads.maxTenantStorageBytes),
        maxAssets: integer(t.maxAssets, `${p}.maxAssets`, 1, uploads.maxTenantAssets) };
    };
    limitTiers = { authenticated: tier('authenticated'), privileged: tier('privileged') };
    for (const key of ['maxBytes', 'maxConcurrent', 'maxPendingBytes', 'maxStorageBytes', 'maxAssets'] as const)
      if (limitTiers.privileged[key] < limitTiers.authenticated[key]) fail(`${path}.limitTiers.privileged.${key}`, 'must be at least authenticated limit');
  }
  let malware:intfMalwareConfiguration|undefined;
  if(security.malware===undefined)fail(`${path}.security.malware`,'explicit scanning policy required');
  if(security.malware!==undefined){
    const m=object(security.malware,`${path}.security.malware`,['mode','socketPath','timeoutMs','maxBytes','policyVersion']);
    if(!Object.values(enuMalwareMode).includes(m.mode as enuMalwareMode))fail(`${path}.security.malware.mode`,'explicit malware policy required');
    const socketPath=m.socketPath===undefined?undefined:string(m.socketPath,`${path}.security.malware.socketPath`);
    if(m.mode!==enuMalwareMode.Disabled&&(!socketPath||!socketPath.startsWith('/')||socketPath.includes('..')))fail(`${path}.security.malware.socketPath`,'absolute private Unix socket required');
    malware={mode:m.mode as enuMalwareMode,...(socketPath?{socketPath}:{}),timeoutMs:integer(m.timeoutMs,`${path}.security.malware.timeoutMs`,1,900000),maxBytes:integer(m.maxBytes,`${path}.security.malware.maxBytes`,1,maxUploadBytes),policyVersion:identifier(m.policyVersion,`${path}.security.malware.policyVersion`)};
  }
  return { enabled: true, storage, uploads, downloads, cache, staging, ...(limitTiers ? { limitTiers } : {}), security: { privateOnly: true, integrityRequired: true,...(malware?{malware}:{}) } };
}

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
  const x = object(value, 'brand', ['displayName', 'shortName', 'logo', 'logoLight', 'favicon', 'primaryColor', 'supportUrl', 'legalUrl']);
  const asset = (key: 'logo' | 'logoLight' | 'favicon'): string => { const v = string(x[key], `brand.${key}`, 256); if (!/^\/brand\/[A-Za-z0-9][A-Za-z0-9/_-]*\.(?:svg|png|ico|webp)$/.test(v) || v.includes('..')) fail(`brand.${key}`, 'expected safe /brand/ asset path'); return v; };
  const primaryColor = string(x.primaryColor, 'brand.primaryColor', 7);
  if (!/^#[0-9a-fA-F]{6}$/.test(primaryColor)) fail('brand.primaryColor', 'expected #RRGGBB');
  return { displayName: string(x.displayName, 'brand.displayName'), shortName: string(x.shortName, 'brand.shortName'), logo: asset('logo'), ...(x.logoLight===undefined?{}:{logoLight:asset('logoLight')}), favicon: asset('favicon'), primaryColor, supportUrl: url(x.supportUrl, 'brand.supportUrl', ['https:']), legalUrl: url(x.legalUrl, 'brand.legalUrl', ['https:']) };
}
function database(value: unknown): intfDatabaseConfiguration {
  const x = object(value, 'database', ['host', 'port', 'name', 'apiUser', 'workerUser', 'migrationUser', 'apiPasswordRef', 'workerPasswordRef', 'migrationPasswordRef', 'maxConnections','tls']);
  let tls:intfDatabaseConfiguration['tls'];
  if(x.tls!==undefined){const t=object(x.tls,'database.tls',['caRef','serverName']);const serverName=string(t.serverName,'database.tls.serverName',253);if(!/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/u.test(serverName))fail('database.tls.serverName','expected certificate DNS name');tls={caRef:secret(t.caRef,'database.tls.caRef'),serverName};}
  return { host: string(x.host, 'database.host'), port: integer(x.port, 'database.port', 1, 65535), name: databaseIdentifier(x.name, 'database.name'), apiUser: databaseIdentifier(x.apiUser, 'database.apiUser'), workerUser: databaseIdentifier(x.workerUser, 'database.workerUser'), migrationUser: databaseIdentifier(x.migrationUser, 'database.migrationUser'), apiPasswordRef: secret(x.apiPasswordRef, 'database.apiPasswordRef'), workerPasswordRef: secret(x.workerPasswordRef, 'database.workerPasswordRef'), migrationPasswordRef: secret(x.migrationPasswordRef, 'database.migrationPasswordRef'), maxConnections: integer(x.maxConnections, 'database.maxConnections', 1, 100),...(tls?{tls}:{}) };
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
function ai(value: unknown, deploymentId: string): intfPlatformConfiguration['ai'] {
  const x = object(value, 'ai', ['endpoints', 'tasks', 'protected']);
  const endpoints = list(x.endpoints, 'ai.endpoints').map(endpoint); unique(endpoints.map(e => e.id), 'ai.endpoints');
  const raw = object(x.tasks, 'ai.tasks', TASKS); const tasks = {} as Record<typAiTask, intfAiTaskPolicy>;
  for (const task of TASKS) {
    const p = `ai.tasks.${task}`, t = object(raw[task], p, ['preferredEndpoints', 'maxAttempts', 'circuitFailureThreshold', 'circuitOpenMs']);
    const preferredEndpoints = list(t.preferredEndpoints, `${p}.preferredEndpoints`).map((v, i) => identifier(v, `${p}.preferredEndpoints[${i}]`)); unique(preferredEndpoints, `${p}.preferredEndpoints`);
    for (const id of preferredEndpoints) if (!endpoints.some(e => e.id === id)) fail(`${p}.preferredEndpoints`, `unknown endpoint ${id}`);
    tasks[task] = { preferredEndpoints, maxAttempts: integer(t.maxAttempts, `${p}.maxAttempts`, 1, 5), circuitFailureThreshold: integer(t.circuitFailureThreshold, `${p}.circuitFailureThreshold`, 1, 100), circuitOpenMs: integer(t.circuitOpenMs, `${p}.circuitOpenMs`, 1000, 3600000) };
  }
  const protectedAi = x.protected === undefined ? undefined : validateProtectedAi(x.protected, deploymentId);
  if (protectedAi) for (const binding of protectedAi.endpoints) {
    const existing = endpoints.find(endpoint => endpoint.id === binding.id);
    const model = protectedAi.models.find(model => model.id === binding.modelProfileId);
    if (existing && (new URL(existing.baseUrl).origin !== binding.baseUrl || existing.model !== model?.modelId
      || existing.maxConcurrent !== binding.maxConcurrent || existing.credentialRef !== binding.credentialRef))
      fail('ai.protected.endpoints', 'shared endpoint binding must preserve canonical connection/model/capacity/credential facts');
  }
  return { endpoints, tasks, ...(protectedAi ? { protected: protectedAi } : {}) };
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
  if (enabled && !events.includes('authority.decision')) fail('siem.events', 'authority.decision required for enabled SIEM');
  const credentialRef = optionalSecret(x.credentialRef, 'siem.credentialRef');
  const deliveryGuarantee = x.deliveryGuarantee ?? 'NONE';
  if (!['NONE', 'IDEMPOTENT', 'DUPLICATE_TOLERANT'].includes(String(deliveryGuarantee))) fail('siem.deliveryGuarantee', 'invalid delivery guarantee');
  return { enabled, destinationId: identifier(x.destinationId, 'siem.destinationId'), url: enabled ? url(x.url, 'siem.url', ['https:']) : typeof x.url === 'string' ? x.url : '', ...(credentialRef ? { credentialRef } : {}), timeoutMs: integer(x.timeoutMs, 'siem.timeoutMs', 100, 120000), maxAttempts: integer(x.maxAttempts, 'siem.maxAttempts', 1, 20), events, deliveryGuarantee: deliveryGuarantee as intfSiemConfiguration['deliveryGuarantee'] };
}

function auth(value: unknown, maxUploadBytes: number, derivedContextWords: readonly string[], deploymentId: string, tenantId: string): typAuthConfiguration | undefined {
  if (value === undefined) return undefined;
  const x = object(value, 'auth', ['enabled', 'issuer', 'audience', 'accessTokenSeconds', 'publicOrigin', 'allowedApplicationOrigins', 'session', 'password', 'authenticatedAdmission', 'privilegedAdmission', 'activeKid', 'privateKeyRef', 'publicKeys', 'methods']);
  if (!bool(x.enabled, 'auth.enabled')) {
    if (Object.keys(x).length !== 1) fail('auth', 'disabled auth must contain only enabled');
    return { enabled: false };
  }
  const issuer = url(x.issuer, 'auth.issuer', ['https:']);
  const publicOrigin = origin(x.publicOrigin, 'auth.publicOrigin');
  if (!publicOrigin.startsWith('https://')) fail('auth.publicOrigin', 'HTTPS required');
  const allowedApplicationOrigins = list(x.allowedApplicationOrigins, 'auth.allowedApplicationOrigins').map((item, index) => origin(item, `auth.allowedApplicationOrigins[${index}]`));
  if (!allowedApplicationOrigins.length || allowedApplicationOrigins.some(item => !item.startsWith('https://'))) fail('auth.allowedApplicationOrigins', 'at least one HTTPS application origin required');
  unique(allowedApplicationOrigins, 'auth.allowedApplicationOrigins');
  let methods: Extract<typAuthConfiguration, { enabled: true }>['methods'];
  if (x.methods !== undefined) {
    const raw = object(x.methods, 'auth.methods', ['organizationalOidc','legacyKey','developmentPassword']);
    const oidc = object(raw.organizationalOidc, 'auth.methods.organizationalOidc', ['enabled','issuer','clientId','clientSecretRef','scopes','callbackUri','provisioning']);
    const legacy = object(raw.legacyKey, 'auth.methods.legacyKey', ['enabled','selfProvision','onboardingTenantId','onboardingRoleId']);
    const oidcEnabled = bool(oidc.enabled, 'auth.methods.organizationalOidc.enabled');
    const legacyEnabled = bool(legacy.enabled, 'auth.methods.legacyKey.enabled');
    const selfProvision = bool(legacy.selfProvision, 'auth.methods.legacyKey.selfProvision');
    const developmentPassword = bool(raw.developmentPassword, 'auth.methods.developmentPassword');
    if (selfProvision && (!legacyEnabled || deploymentId !== 'development')) fail('auth.methods.legacyKey.selfProvision', 'development only');
    const onboardingTenantId = legacy.onboardingTenantId === undefined ? undefined : identifier(legacy.onboardingTenantId, 'auth.methods.legacyKey.onboardingTenantId');
    if (selfProvision && onboardingTenantId !== tenantId) fail('auth.methods.legacyKey.onboardingTenantId', 'explicit deployment tenant required');
    const onboardingRoleId=legacy.onboardingRoleId===undefined?undefined:string(legacy.onboardingRoleId,'auth.methods.legacyKey.onboardingRoleId',36);
    if(selfProvision&&(!onboardingRoleId||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(onboardingRoleId)))
      fail('auth.methods.legacyKey.onboardingRoleId','explicit Authority role UUID required');
    if (developmentPassword && deploymentId !== 'development' && !deploymentId.startsWith('test-')) fail('auth.methods.developmentPassword', 'development only');
    const callbackUri = oidcEnabled ? url(oidc.callbackUri, 'auth.methods.organizationalOidc.callbackUri', ['https:']) : undefined;
    if (oidcEnabled && new URL(callbackUri!).origin !== publicOrigin) fail('auth.methods.organizationalOidc.callbackUri', 'Auth origin required');
    const scopes = oidcEnabled ? list(oidc.scopes, 'auth.methods.organizationalOidc.scopes').map((item,index)=>string(item, `auth.methods.organizationalOidc.scopes[${index}]`,64)) : undefined;
    if (oidcEnabled && !scopes?.includes('openid')) fail('auth.methods.organizationalOidc.scopes', 'openid required');
    const provisioning = oidcEnabled ? (oidc.provisioning ?? 'DISABLED') : undefined;
    if (provisioning !== undefined && !['DISABLED','DEVELOPMENT'].includes(String(provisioning))) fail('auth.methods.organizationalOidc.provisioning','invalid policy');
    if (provisioning === 'DEVELOPMENT') fail('auth.methods.organizationalOidc.provisioning','automatic provisioning is not configured; import an issuer+subject mapping');
    methods = { organizationalOidc: oidcEnabled ? {enabled:true,issuer:url(oidc.issuer,'auth.methods.organizationalOidc.issuer',['https:']),clientId:string(oidc.clientId,'auth.methods.organizationalOidc.clientId'),
      ...(oidc.clientSecretRef ? { clientSecretRef:secret(oidc.clientSecretRef,'auth.methods.organizationalOidc.clientSecretRef') } : {}),scopes:scopes!,callbackUri:callbackUri!,provisioning:provisioning as 'DISABLED'|'DEVELOPMENT'} : {enabled:false},
      legacyKey:{enabled:legacyEnabled,selfProvision,...(onboardingTenantId?{onboardingTenantId}:{}),...(onboardingRoleId?{onboardingRoleId}:{})},developmentPassword };
  }
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
  const passwordRaw = object(x.password, 'auth.password', ['contextWords', 'compromised']);
  const explicitWords = list(passwordRaw.contextWords, 'auth.password.contextWords').map((word, index) =>
    string(word, `auth.password.contextWords[${index}]`, 100).trim());
  const breachRaw = object(passwordRaw.compromised, 'auth.password.compromised', ['kind', 'directory', 'baseUrl', 'timeoutMs']);
  let compromised: typBreachProvider;
  if (breachRaw.kind === 'LOCAL_SHA1') {
    if (breachRaw.baseUrl !== undefined || breachRaw.timeoutMs !== undefined) fail('auth.password.compromised', 'unexpected range API field');
    const directory = string(breachRaw.directory, 'auth.password.compromised.directory', 512);
    if (!directory.startsWith('/') || directory.includes('..') || directory.includes('\0')) fail('auth.password.compromised.directory', 'expected safe absolute directory');
    compromised = { kind: 'LOCAL_SHA1', directory };
  } else if (breachRaw.kind === 'RANGE_API') {
    if (breachRaw.directory !== undefined) fail('auth.password.compromised', 'unexpected local corpus field');
    compromised = { kind: 'RANGE_API', baseUrl: url(breachRaw.baseUrl, 'auth.password.compromised.baseUrl', ['https:']),
      timeoutMs: integer(breachRaw.timeoutMs, 'auth.password.compromised.timeoutMs', 100, 10_000) };
  } else fail('auth.password.compromised.kind', 'approved breach provider required');
  const contextWords = [...new Set([...derivedContextWords, ...explicitWords].map(word => word.normalize('NFKC').toLocaleLowerCase('und')))];
  const password: intfPasswordConfiguration = { contextWords, compromised };
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
  return { enabled: true, issuer, audience, accessTokenSeconds, publicOrigin, allowedApplicationOrigins, session, password, authenticatedAdmission, privilegedAdmission, activeKid,
    privateKeyRef: secret(x.privateKeyRef, 'auth.privateKeyRef'), publicKeys, ...(methods ? { methods } : {}) };
}

export function validateConfiguration(value: unknown): intfPlatformConfiguration {
  const root = object(value, 'config', ['configVersion', 'deployment', 'modules', 'brand', 'web', 'database', 'ai', 'admission', 'siem', 'security', 'auth', 'fileProcessing', 'fileManagement', 'knowledge', 'dataGovernance', 'http', 'worker', 'observability', 'audit', 'usage', 'retention']);
  if (root.configVersion !== 1) fail('configVersion', 'unsupported version');
  const dep = object(root.deployment, 'deployment', ['id', 'tenantId', 'releaseId']);
  const deployment = { id: identifier(dep.id, 'deployment.id'), tenantId: identifier(dep.tenantId, 'deployment.tenantId'), releaseId: identifier(dep.releaseId, 'deployment.releaseId') };
  const rawModules = object(root.modules, 'modules', MODULES), modules = {} as Record<typModuleId, { enabled: boolean; route: string }>;
  for (const module of MODULES) { const p = `modules.${module}`, x = object(rawModules[module], p, ['enabled', 'route']); const route = string(x.route, `${p}.route`, 100); if (!/^\/[a-z][a-z0-9/-]*$/.test(route) || route.includes('//') || route.includes('..')) fail(`${p}.route`, 'invalid route'); modules[module] = { enabled: bool(x.enabled, `${p}.enabled`), route }; }
  unique(MODULES.map(m => modules[m].route), 'modules.*.route');
  const fp = object(root.fileProcessing, 'fileProcessing', ['maxUploadBytes', 'maxExtractedChars', 'maxPages', 'archive']);
  const archiveRaw = fp.archive === undefined ? {} : object(fp.archive, 'fileProcessing.archive', ['maxEntries', 'maxTotalUncompressedBytes', 'maxEntryUncompressedBytes', 'maxCompressionRatio', 'maxNesting']);
  const archive: intfArchiveLimits = {
    maxEntries: integer(archiveRaw.maxEntries ?? DEFAULT_ARCHIVE_LIMITS.maxEntries, 'fileProcessing.archive.maxEntries', 1, 10000),
    maxTotalUncompressedBytes: integer(archiveRaw.maxTotalUncompressedBytes ?? DEFAULT_ARCHIVE_LIMITS.maxTotalUncompressedBytes, 'fileProcessing.archive.maxTotalUncompressedBytes', 1, 200000000),
    maxEntryUncompressedBytes: integer(archiveRaw.maxEntryUncompressedBytes ?? DEFAULT_ARCHIVE_LIMITS.maxEntryUncompressedBytes, 'fileProcessing.archive.maxEntryUncompressedBytes', 1, 100000000),
    maxCompressionRatio: integer(archiveRaw.maxCompressionRatio ?? DEFAULT_ARCHIVE_LIMITS.maxCompressionRatio, 'fileProcessing.archive.maxCompressionRatio', 1, 1000),
    maxNesting: integer(archiveRaw.maxNesting ?? DEFAULT_ARCHIVE_LIMITS.maxNesting, 'fileProcessing.archive.maxNesting', 0, 0)
  };
  if (archive.maxEntryUncompressedBytes > archive.maxTotalUncompressedBytes) fail('fileProcessing.archive', 'single entry limit exceeds total limit');
  const fileProcessing = { maxUploadBytes: integer(fp.maxUploadBytes, 'fileProcessing.maxUploadBytes', 1, 200000000), maxExtractedChars: integer(fp.maxExtractedChars, 'fileProcessing.maxExtractedChars', 1, 2000000), maxPages: integer(fp.maxPages, 'fileProcessing.maxPages', 1, 10000), archive };
  const aiConfig = ai(root.ai, deployment.id);
  const dataGovernance = root.dataGovernance === undefined ? undefined :
    aiConfig.protected ? validateAiGovernance(root.dataGovernance, deployment.id, aiConfig.protected) : fail('dataGovernance', 'protected AI registry required');
  const knowledge = root.knowledge === undefined ? undefined : validateKnowledge(root.knowledge, deployment.id);
  for (const module of MODULES) if (modules[module].enabled && !aiConfig.endpoints.some(e => e.enabled && e.capabilities.includes(TASK_MODULE[module]))) fail(`modules.${module}.enabled`, `no eligible ${TASK_MODULE[module]} endpoint`);
  const h = object(root.http, 'http', ['listenHost', 'apiPort', 'apiInternalUrl', 'allowedOrigins', 'maxJsonBytes']);
  const http = { listenHost: string(h.listenHost, 'http.listenHost'), apiPort: integer(h.apiPort, 'http.apiPort', 1, 65535), apiInternalUrl: url(h.apiInternalUrl, 'http.apiInternalUrl', ['http:', 'https:']), allowedOrigins: list(h.allowedOrigins, 'http.allowedOrigins').map((v, i) => origin(v, `http.allowedOrigins[${i}]`)), maxJsonBytes: integer(h.maxJsonBytes, 'http.maxJsonBytes', 1024, 1000000) };
  unique(http.allowedOrigins, 'http.allowedOrigins');
  const webRaw = root.web === undefined ? null : object(root.web, 'web', ['publicOrigin']);
  const web = webRaw ? { publicOrigin: origin(webRaw.publicOrigin, 'web.publicOrigin') } : undefined;
  const securityRaw = root.security === undefined ? {} : object(root.security, 'security', ['cspReporting', 'assuranceProfile']);
  const cspRaw = securityRaw.cspReporting === undefined ? {} : object(securityRaw.cspReporting, 'security.cspReporting', ['enabled', 'maxBodyBytes', 'requestsPerMinute']);
  const assuranceProfile = securityRaw.assuranceProfile ?? (deployment.id === 'development' ? 'DEVELOPMENT_PASSWORD' : 'CUSTOMER_L3');
  if (assuranceProfile !== 'DEVELOPMENT_PASSWORD' && assuranceProfile !== 'CUSTOMER_L3')
    fail('security.assuranceProfile', 'invalid assurance profile');
  if (assuranceProfile === 'DEVELOPMENT_PASSWORD' && deployment.id !== 'development' && !deployment.id.startsWith('test-'))
    fail('security.assuranceProfile', 'password-only assurance is restricted to development/test deployments');
  const security = { assuranceProfile: assuranceProfile as intfPlatformConfiguration['security']['assuranceProfile'], cspReporting: {
    enabled: cspRaw.enabled === undefined ? true : bool(cspRaw.enabled, 'security.cspReporting.enabled'),
    maxBodyBytes: integer(cspRaw.maxBodyBytes ?? 8192, 'security.cspReporting.maxBodyBytes', 1024, 16384),
    requestsPerMinute: integer(cspRaw.requestsPerMinute ?? 60, 'security.cspReporting.requestsPerMinute', 1, 1000)
  } };
  const branded = brand(root.brand);
  const authConfig = auth(root.auth, fileProcessing.maxUploadBytes,
    [branded.displayName, branded.shortName, deployment.id, deployment.tenantId], deployment.id, deployment.tenantId);
  const fileManagement = root.fileManagement === undefined ? undefined : validateFileManagement(root.fileManagement, deployment.id, fileProcessing.maxUploadBytes);
  if(fileManagement?.enabled&&assuranceProfile==='CUSTOMER_L3'&&fileManagement.security.malware?.mode!==enuMalwareMode.Required)fail('fileManagement.security.malware.mode','CUSTOMER_L3 requires malware scanning');
  if (fileManagement?.enabled && !authConfig?.enabled) fail('fileManagement.enabled', 'managed files require authenticated Identity/Session contracts');
  if (knowledge?.enabled && (!authConfig?.enabled || !fileManagement?.enabled))
    fail('knowledge.enabled', 'authenticated File Management required');
  if (knowledge?.enabled && (!aiConfig.protected || !dataGovernance) && deployment.id !== 'development')
    fail('knowledge.enabled', 'protected AI registry and explicit Data Governance required');
  if (authConfig?.enabled) {
    if (!web || !web.publicOrigin.startsWith('https://')) fail('web.publicOrigin', 'HTTPS application origin required with Auth');
    if (!authConfig.allowedApplicationOrigins.includes(web.publicOrigin) || !http.allowedOrigins.includes(web.publicOrigin))
      fail('auth.allowedApplicationOrigins', 'application origin must appear in Auth and API allowlists');
    if (new URL(web.publicOrigin).hostname === new URL(authConfig.publicOrigin).hostname)
      fail('auth.publicOrigin', 'dedicated Auth hostname required');
  }
  const w = object(root.worker, 'worker', ['pollMs', 'claimLeaseMs', 'identityId']);
  const workerIdentity = w.identityId === undefined ? undefined : string(w.identityId, 'worker.identityId');
  if (workerIdentity !== undefined && !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(workerIdentity)) fail('worker.identityId', 'registered platform-service UUID required');
  if (fileManagement?.enabled && !workerIdentity) fail('worker.identityId', 'managed jobs require an explicit platform-service Identity');
  const worker = { pollMs: integer(w.pollMs, 'worker.pollMs', 100, 60000), claimLeaseMs: integer(w.claimLeaseMs, 'worker.claimLeaseMs', 1000, 3600000), ...(workerIdentity ? { identityId: workerIdentity } : {}) };
  const o = object(root.observability, 'observability', ['level']); if (!['INFO', 'WARN', 'ERROR'].includes(String(o.level))) fail('observability.level', 'invalid level');
  const a = object(root.audit, 'audit', ['retentionDays']), u = object(root.usage, 'usage', ['retentionDays']), r = object(root.retention, 'retention', ['policyRef']);
  return { configVersion: 1, deployment, modules, brand: branded, ...(web ? { web } : {}), database: database(root.database), ai: aiConfig, ...(dataGovernance ? { dataGovernance } : {}), ...(knowledge ? { knowledge } : {}), admission: admission(root.admission, fileProcessing.maxUploadBytes), siem: siem(root.siem), security, ...(authConfig === undefined ? {} : { auth: authConfig }), fileProcessing, ...(fileManagement ? { fileManagement } : {}), http, worker, observability: { level: o.level as 'INFO' | 'WARN' | 'ERROR' }, audit: { retentionDays: integer(a.retentionDays, 'audit.retentionDays', 1, 36500) }, usage: { retentionDays: integer(u.retentionDays, 'usage.retentionDays', 1, 36500) }, retention: { policyRef: string(r.policyRef, 'retention.policyRef') } };
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
    if (JSON.stringify(old.deployment) !== JSON.stringify(next.deployment) || JSON.stringify(old.database) !== JSON.stringify(next.database) || JSON.stringify(old.http) !== JSON.stringify(next.http)
      || JSON.stringify(old.fileManagement) !== JSON.stringify(next.fileManagement)
      || JSON.stringify(old.knowledge) !== JSON.stringify(next.knowledge)
      || JSON.stringify(old.dataGovernance) !== JSON.stringify(next.dataGovernance)
      || JSON.stringify(old.ai.protected) !== JSON.stringify(next.ai.protected)) fail('reload', 'startup-only configuration changed');
    this.#current = candidate; return candidate;
  }
}

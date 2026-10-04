import { randomUUID } from 'node:crypto';
import { resolveSecretRef, type clsConfigurationStore, type intfAiEndpointConfiguration, type intfConfigurationSnapshot, type typAiTask, type typModuleId } from '../../configuration/src/index.js';
import type { enuProtectedAiTask } from '../../contracts/src/protected-ai.js';

export type typRunStatus = 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'INTERRUPTED';
export type typEndpointHealth = 'UNKNOWN' | 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
export type typCircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export interface intfAiMessage { readonly role: 'system' | 'user'; readonly content: string }
export interface intfAiRequest { readonly task: typAiTask; readonly moduleId: typModuleId; readonly requestId: string; readonly correlationId: string; readonly deploymentId: string; readonly tenantId: string; readonly actorKind: string; readonly actorId: string | null; readonly messages: readonly intfAiMessage[]; readonly maxOutputTokens: number; readonly temperature: number; readonly signal?: AbortSignal }
export interface intfAiResult { readonly runId: string; readonly status: typRunStatus; readonly output: string; readonly endpointId: string; readonly modelId: string; readonly attempts: number; readonly inputTokens: number; readonly outputTokens: number; readonly durationMs: number; readonly configFingerprint: string }
export interface intfRoutingReason { readonly endpointId: string; readonly status: 'ELIGIBLE' | 'DISABLED' | 'CAPABILITY_MISMATCH' | 'UNHEALTHY' | 'CIRCUIT_OPEN' | 'CAPACITY_EXHAUSTED' }
export type typAiRunRequest = Omit<intfAiRequest, 'task' | 'moduleId'> & Readonly<{ task: typAiTask | enuProtectedAiTask; moduleId: typModuleId | 'knowledge'; sessionId?: string | null; authorizationVersion?: number | null; source?: string }>;
export interface intfRunStart { readonly runId: string; readonly request: typAiRunRequest; readonly configFingerprint: string }
export interface intfAttemptRecord { readonly attemptId: string; readonly runId: string; readonly sequence: number; readonly endpointId: string; readonly modelId: string; readonly status: 'RUNNING' | typRunStatus; readonly errorClass?: string }
export interface intfRunFinish { readonly runId: string; readonly status: typRunStatus; readonly endpointId?: string; readonly modelId?: string; readonly inputTokens?: number; readonly outputTokens?: number; readonly errorClass?: string }
export interface intfActiveRun { readonly endpointId: string; readonly task: typAiTask | enuProtectedAiTask; readonly requestId: string }
export interface intfAiRunStore {
  beginRun(value: intfRunStart): Promise<void>;
  claimEndpointCapacity(runId: string, request: typAiRunRequest, endpointId: string, maxConcurrent: number, leaseMs: number): Promise<boolean>;
  releaseEndpointCapacity(runId: string, request: typAiRunRequest, endpointId: string): Promise<void>;
  beginAttempt(value: intfAttemptRecord): Promise<void>;
  finishAttempt(value: intfAttemptRecord): Promise<void>;
  finishRun(value: intfRunFinish): Promise<void>;
  activeRun(deploymentId: string, tenantId: string, moduleId: typModuleId | 'knowledge', requestId: string): Promise<intfActiveRun | null>;
}

export class exAiRouter extends Error { constructor(readonly code: 'NO_ELIGIBLE_ENDPOINT' | 'PROVIDER_FAILURE' | 'INTERRUPTED' | 'CANCELLED', readonly committed: boolean, readonly safeClass: string) { super(code); } }
interface intfCircuit { failures: number; openedUntil: number; probe: boolean }
interface intfProviderResult { output: string; inputTokens: number; outputTokens: number; committed: boolean }

function textDelta(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const x = value as Record<string, unknown>;
  if (typeof x.delta === 'string') return x.delta;
  if (x.delta && typeof x.delta === 'object' && typeof (x.delta as Record<string, unknown>).content === 'string') return (x.delta as Record<string, string>).content;
  if (Array.isArray(x.choices)) { const first = x.choices[0] as Record<string, unknown> | undefined; if (first?.delta && typeof first.delta === 'object' && typeof (first.delta as Record<string, unknown>).content === 'string') return (first.delta as Record<string, string>).content; }
  return null;
}
function tokenFacts(value: unknown): { inputTokens: number; outputTokens: number } | null {
  if (!value || typeof value !== 'object') return null;
  const x = value as Record<string, unknown>, usage = x.usage ?? (x.response && typeof x.response === 'object' ? (x.response as Record<string, unknown>).usage : null);
  if (!usage || typeof usage !== 'object') return null;
  const u = usage as Record<string, unknown>;
  const inputTokens = u.input_tokens ?? u.prompt_tokens, outputTokens = u.output_tokens ?? u.completion_tokens;
  if (!Number.isSafeInteger(inputTokens) || !Number.isSafeInteger(outputTokens)) return null;
  return { inputTokens: inputTokens as number, outputTokens: outputTokens as number };
}

export async function callOpenAiCompatible(endpoint: intfAiEndpointConfiguration, request: intfAiRequest, providerRequestId: string, onDelta: (delta: string) => Promise<void> | void, secretRoot?: string): Promise<intfProviderResult> {
  const controller = new AbortController();
  let timeoutKind: 'CONNECT' | 'FIRST_TOKEN' | 'TOTAL' | null = null, committed = false, output = '', inputTokens = 0, outputTokens = 0;
  const totalTimer = setTimeout(() => { timeoutKind = 'TOTAL'; controller.abort(); }, endpoint.totalTimeoutMs);
  const connectTimer = setTimeout(() => { timeoutKind = 'CONNECT'; controller.abort(); }, endpoint.connectTimeoutMs);
  const abort = () => controller.abort(); request.signal?.addEventListener('abort', abort, { once: true });
  let firstTokenTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    const credential = endpoint.credentialRef ? await resolveSecretRef(endpoint.credentialRef, secretRoot) : null;
    const response = await fetch(new URL('/v1/responses/', endpoint.baseUrl), { method: 'POST', headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) }, body: JSON.stringify({ model: endpoint.model, input: request.messages, stream: true, store: false, background: false, max_output_tokens: request.maxOutputTokens, temperature: request.temperature, request_id: providerRequestId }), signal: controller.signal });
    clearTimeout(connectTimer);
    if (!response.ok || !response.body) throw new exAiRouter('PROVIDER_FAILURE', false, response.status >= 500 ? 'PROVIDER_5XX' : 'PROVIDER_REJECTED');
    firstTokenTimer = setTimeout(() => { timeoutKind = 'FIRST_TOKEN'; controller.abort(); }, endpoint.firstTokenTimeoutMs);
    const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trimEnd(); buffer = buffer.slice(newline + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim(); if (payload === '[DONE]') continue;
        let parsed: unknown; try { parsed = JSON.parse(payload) as unknown; } catch { continue; }
        const usage = tokenFacts(parsed); if (usage) { inputTokens = usage.inputTokens; outputTokens = usage.outputTokens; }
        const delta = textDelta(parsed);
        if (delta) { committed = true; output += delta; if (firstTokenTimer) { clearTimeout(firstTokenTimer); firstTokenTimer = undefined; } await onDelta(delta); }
      }
    }
    if (buffer.trim().startsWith('data:')) {
      try { const delta = textDelta(JSON.parse(buffer.trim().slice(5)) as unknown); if (delta) { committed = true; output += delta; await onDelta(delta); } } catch { /* final non-JSON marker */ }
    }
    if (!committed) throw new exAiRouter('PROVIDER_FAILURE', false, 'EMPTY_OUTPUT');
    return { output, inputTokens, outputTokens, committed };
  } catch (error) {
    if (error instanceof exAiRouter) throw error;
    if (request.signal?.aborted) throw new exAiRouter('CANCELLED', committed, 'CLIENT_CANCELLED');
    if (timeoutKind) throw new exAiRouter(committed ? 'INTERRUPTED' : 'PROVIDER_FAILURE', committed, `TIMEOUT_${timeoutKind}`);
    throw new exAiRouter(committed ? 'INTERRUPTED' : 'PROVIDER_FAILURE', committed, 'NETWORK_OR_STREAM');
  } finally { clearTimeout(totalTimer); clearTimeout(connectTimer); if (firstTokenTimer) clearTimeout(firstTokenTimer); request.signal?.removeEventListener('abort', abort); }
}

export class clsAiRouter {
  readonly #health = new Map<string, typEndpointHealth>();
  readonly #circuits = new Map<string, intfCircuit>();
  readonly #active = new Map<string, number>();
  readonly #inflight = new Map<string, { endpoint: intfAiEndpointConfiguration; providerRequestId: string; abort: AbortController }>();
  constructor(readonly configuration: clsConfigurationStore, readonly store: intfAiRunStore, readonly provider = callOpenAiCompatible, readonly now = () => Date.now()) {}
  async probeReadiness(): Promise<{ status: 'READY' | 'DEGRADED' | 'NOT_READY'; healthyEndpoints: readonly string[]; unavailableTasks: readonly typAiTask[] }> {
    const snapshot = this.configuration.active();
    const enabled = snapshot.value.ai.endpoints.filter(endpoint => endpoint.enabled);
    const checks = await Promise.all(enabled.map(async endpoint => {
      try {
        const response = await fetch(new URL('/health', endpoint.baseUrl), { redirect:'error',signal: AbortSignal.timeout(Math.min(endpoint.connectTimeoutMs, 3000)) });
        await response.body?.cancel();
        this.setHealth(endpoint.id, response.ok ? 'HEALTHY' : 'UNHEALTHY');
        return response.ok ? endpoint.id : null;
      } catch { this.setHealth(endpoint.id, 'UNHEALTHY'); return null; }
    }));
    const healthyEndpoints = checks.filter((id): id is string => id !== null);
    const taskByModule = { translator: 'TRANSLATE', summarizer: 'SUMMARIZE', faq: 'GENERATE_FAQ' } as const;
    const requiredTasks = (Object.keys(taskByModule) as typModuleId[]).filter(module => snapshot.value.modules[module].enabled).map(module => taskByModule[module]);
    const unavailableTasks = requiredTasks.filter(task => !this.reasons(task, snapshot).some(reason => reason.status === 'ELIGIBLE'));
    const degraded = requiredTasks.some(task => enabled.some(endpoint => endpoint.capabilities.includes(task) && this.reasons(task, snapshot).some(reason => reason.endpointId === endpoint.id && reason.status !== 'ELIGIBLE')));
    return { status: unavailableTasks.length ? 'NOT_READY' : degraded ? 'DEGRADED' : 'READY', healthyEndpoints, unavailableTasks };
  }
  setHealth(endpointId: string, health: typEndpointHealth): void { this.#health.set(endpointId, health); }
  circuitState(endpointId: string): typCircuitState { const c = this.#circuits.get(endpointId); if (!c || c.failures === 0) return 'CLOSED'; return c.openedUntil > this.now() ? 'OPEN' : 'HALF_OPEN'; }
  reasons(task: typAiTask, snapshot: intfConfigurationSnapshot = this.configuration.active()): readonly intfRoutingReason[] {
    return snapshot.value.ai.endpoints.map(endpoint => {
      let status: intfRoutingReason['status'] = 'ELIGIBLE';
      if (!endpoint.enabled) status = 'DISABLED';
      else if (!endpoint.capabilities.includes(task)) status = 'CAPABILITY_MISMATCH';
      else if (this.#health.get(endpoint.id) === 'UNHEALTHY') status = 'UNHEALTHY';
      else if (this.circuitState(endpoint.id) === 'OPEN') status = 'CIRCUIT_OPEN';
      else if ((this.#active.get(endpoint.id) ?? 0) >= endpoint.maxConcurrent) status = 'CAPACITY_EXHAUSTED';
      return { endpointId: endpoint.id, status };
    });
  }
  #ordered(task: typAiTask, requestId: string, snapshot: intfConfigurationSnapshot): intfAiEndpointConfiguration[] {
    const eligible = new Set(this.reasons(task, snapshot).filter(x => x.status === 'ELIGIBLE').map(x => x.endpointId));
    const preferred = snapshot.value.ai.tasks[task].preferredEndpoints;
    const endpoints = snapshot.value.ai.endpoints.filter(e => eligible.has(e.id));
    endpoints.sort((a, b) => b.priority - a.priority || preferred.indexOf(a.id) - preferred.indexOf(b.id) || a.id.localeCompare(b.id));
    // Stable weighted rotation among the highest equal-priority tier.
    const highest = endpoints[0]?.priority; if (highest === undefined) return endpoints;
    const tier = endpoints.filter(e => e.priority === highest), rest = endpoints.filter(e => e.priority !== highest);
    const total = tier.reduce((sum, e) => sum + e.weight, 0);
    let slot = [...requestId].reduce((hash, ch) => ((hash * 33) ^ ch.charCodeAt(0)) >>> 0, 5381) % total;
    let chosen = tier[0]!;
    for (const e of tier) { slot -= e.weight; if (slot < 0) { chosen = e; break; } }
    return [chosen, ...tier.filter(e => e.id !== chosen.id), ...rest];
  }
  async run(request: intfAiRequest, onDelta: (delta: string) => Promise<void> | void = () => {}): Promise<intfAiResult> {
    const snapshot = this.configuration.active(), runId = randomUUID(), started = this.now();
    const endpoints = this.#ordered(request.task, request.requestId, snapshot);
    if (!endpoints.length) throw new exAiRouter('NO_ELIGIBLE_ENDPOINT', false, 'NO_ELIGIBLE_ENDPOINT');
    await this.store.beginRun({ runId, request, configFingerprint: snapshot.fingerprint });
    const limit = snapshot.value.ai.tasks[request.task].maxAttempts;
    let attempts = 0, lastError: exAiRouter | undefined;
    for (const endpoint of endpoints) {
      if (attempts >= limit) break;
      const capacity = await this.store.claimEndpointCapacity(runId, request, endpoint.id, endpoint.maxConcurrent, endpoint.totalTimeoutMs + 5000);
      if (!capacity) continue;
      attempts += 1;
      const attemptId = randomUUID(), providerRequestId = `${request.task.toLowerCase()}-${request.requestId}`, abort = new AbortController();
      const forwardAbort = () => abort.abort(); request.signal?.addEventListener('abort', forwardAbort, { once: true });
      const attempt: intfAttemptRecord = { attemptId, runId, sequence: attempts, endpointId: endpoint.id, modelId: endpoint.model, status: 'RUNNING' };
      try { await this.store.beginAttempt(attempt); }
      catch (error) {
        request.signal?.removeEventListener('abort', forwardAbort);
        await this.store.releaseEndpointCapacity(runId, request, endpoint.id);
        throw error;
      }
      this.#active.set(endpoint.id, (this.#active.get(endpoint.id) ?? 0) + 1);
      this.#inflight.set(request.requestId, { endpoint, providerRequestId, abort });
      try {
        const result = await this.provider(endpoint, { ...request, signal: abort.signal }, providerRequestId, onDelta);
        await this.store.finishAttempt({ ...attempt, status: 'SUCCEEDED' });
        await this.store.finishRun({ runId, status: 'SUCCEEDED', endpointId: endpoint.id, modelId: endpoint.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens });
        this.#circuits.delete(endpoint.id);
        return { runId, status: 'SUCCEEDED', output: result.output, endpointId: endpoint.id, modelId: endpoint.model, attempts, inputTokens: result.inputTokens, outputTokens: result.outputTokens, durationMs: this.now() - started, configFingerprint: snapshot.fingerprint };
      } catch (error) {
        const classified = error instanceof exAiRouter ? error : new exAiRouter('PROVIDER_FAILURE', false, 'UNKNOWN_PROVIDER_ERROR');
        lastError = classified;
        await this.store.finishAttempt({ ...attempt, status: classified.code === 'CANCELLED' ? 'CANCELLED' : classified.code === 'INTERRUPTED' ? 'INTERRUPTED' : 'FAILED', errorClass: classified.safeClass });
        if (classified.code !== 'CANCELLED') {
          const current = this.#circuits.get(endpoint.id) ?? { failures: 0, openedUntil: 0, probe: false };
          current.failures += 1;
          if (current.failures >= snapshot.value.ai.tasks[request.task].circuitFailureThreshold) current.openedUntil = this.now() + snapshot.value.ai.tasks[request.task].circuitOpenMs;
          this.#circuits.set(endpoint.id, current);
        }
        if (classified.committed || classified.code === 'CANCELLED') break;
      } finally {
        await this.store.releaseEndpointCapacity(runId, request, endpoint.id);
        this.#active.set(endpoint.id, Math.max(0, (this.#active.get(endpoint.id) ?? 1) - 1));
        this.#inflight.delete(request.requestId);
        request.signal?.removeEventListener('abort', forwardAbort);
      }
    }
    const status: typRunStatus = lastError?.code === 'CANCELLED' ? 'CANCELLED' : lastError?.committed ? 'INTERRUPTED' : 'FAILED';
    await this.store.finishRun({ runId, status, errorClass: lastError?.safeClass ?? 'CAPACITY_EXHAUSTED' });
    throw lastError ?? new exAiRouter('NO_ELIGIBLE_ENDPOINT', false, 'CAPACITY_EXHAUSTED');
  }
  async cancel(deploymentId: string, tenantId: string, moduleId: typModuleId, requestId: string): Promise<'OK' | 'PENDING' | 'NOT_RUNNING'> {
    const local = this.#inflight.get(requestId), active = local ? { endpointId: local.endpoint.id, requestId, task: ({ translator: 'TRANSLATE', summarizer: 'SUMMARIZE', faq: 'GENERATE_FAQ' } as const)[moduleId] } : await this.store.activeRun(deploymentId, tenantId, moduleId, requestId);
    if (!active) return 'NOT_RUNNING';
    const endpoint = local?.endpoint ?? this.configuration.active().value.ai.endpoints.find(e => e.id === active.endpointId);
    if (!endpoint) return 'PENDING';
    const providerRequestId = local?.providerRequestId ?? `${active.task.toLowerCase()}-${requestId}`;
    try {
      const response = await fetch(new URL(`/v1/responses/${encodeURIComponent(providerRequestId)}/cancel`, endpoint.baseUrl), { method: 'POST', signal: AbortSignal.timeout(Math.min(endpoint.connectTimeoutMs, 5000)) });
      local?.abort.abort();
      return local || response.ok ? 'OK' : 'PENDING';
    } catch { local?.abort.abort(); return local ? 'OK' : 'PENDING'; }
  }
}

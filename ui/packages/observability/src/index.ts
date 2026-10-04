import type { intfExecutionContext } from '../../contracts/src/index.js';

export interface intfOperationalEvent { readonly severity: 'INFO' | 'WARN' | 'ERROR'; readonly component: string; readonly event: string; readonly context?: intfExecutionContext; readonly status?: string; readonly durationMs?: number; readonly errorClass?: string; readonly method?: string; readonly route?: string; readonly endpointId?: string; readonly modelId?: string; readonly runId?:string; readonly aiTask?:string; readonly attemptCount?: number; readonly inputTokens?: number; readonly outputTokens?: number }
export function operationalRecord(event: intfOperationalEvent): Readonly<Record<string, string | number | null>> {
  const context = event.context;
  return { timestamp: new Date().toISOString(), severity: event.severity, component: event.component, event: event.event,
    requestId: context?.requestId ?? null, correlationId: context?.correlationId ?? null, deploymentId: context?.deploymentId ?? null,
    tenantId: context?.tenantId ?? null, moduleId: context?.moduleId ?? null, actorKind: context?.actorKind ?? null,
    actorId:context?.actorId??null,sessionId:context?.sessionId??null,authorizationVersion:context?.authorizationVersion??null,
    source:context?.source??null,initiatorActorId:context?.initiator?.actorId??context?.actorId??null,
    status: event.status ?? null, durationMs: event.durationMs ?? null, errorClass: event.errorClass ?? null,
    method: event.method ?? null, route: event.route ?? null, endpointId: event.endpointId ?? null, modelId: event.modelId ?? null,
    runId:event.runId??null,aiTask:event.aiTask??null,
    attemptCount: event.attemptCount ?? null, inputTokens: event.inputTokens ?? null, outputTokens: event.outputTokens ?? null };
}
export function logOperational(event: intfOperationalEvent): void { process.stdout.write(`${JSON.stringify(operationalRecord(event))}\n`); }

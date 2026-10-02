import type { intfSiemConfiguration } from '../../configuration/src/index.js';
import { resolveSecretRef } from '../../configuration/src/index.js';

export interface intfExportEnvelope { readonly eventId: string; readonly deploymentId: string; readonly tenantId: string; readonly moduleId: string; readonly actorKind: string; readonly requestId: string; readonly correlationId: string; readonly action: string; readonly result: string; readonly reason: string | null; readonly occurredAt: string }
export type typDeliveryResult = { readonly kind: 'DELIVERED'; readonly ack: string | null } | { readonly kind: 'RETRY'; readonly errorClass: string } | { readonly kind: 'FAILED'; readonly errorClass: string } | { readonly kind: 'UNKNOWN'; readonly errorClass: string };
export interface intfSiemAdapter { deliver(event: intfExportEnvelope, config: intfSiemConfiguration, secretRoot?: string): Promise<typDeliveryResult> }

export class clsHttpsJsonSiemAdapter implements intfSiemAdapter {
  async deliver(event: intfExportEnvelope, config: intfSiemConfiguration, secretRoot?: string): Promise<typDeliveryResult> {
    const token = config.credentialRef ? await resolveSecretRef(config.credentialRef, secretRoot) : undefined;
    try {
      const response = await fetch(config.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': event.eventId, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(event), signal: AbortSignal.timeout(config.timeoutMs) });
      if (response.ok) return { kind: 'DELIVERED', ack: response.headers.get('X-Event-Ack')?.slice(0, 256) ?? null };
      if (response.status === 429 || response.status >= 500) return { kind: 'RETRY', errorClass: `HTTP_${response.status}` };
      return { kind: 'FAILED', errorClass: `HTTP_${response.status}` };
    } catch (error) {
      return { kind: 'UNKNOWN', errorClass: error instanceof Error && error.name === 'TimeoutError' ? 'TIMEOUT_UNKNOWN' : 'NETWORK_UNKNOWN' };
    }
  }
}

export interface intfClaimedExport { readonly tex_id: string; readonly tex_event__ase_id: string; readonly tex_attempt_count: number; readonly ase_deployment_id: string; readonly ase_tenant_id: string; readonly ase_module_id: string; readonly ase_actor_kind: string; readonly ase_request_id: string; readonly ase_correlation_id: string; readonly ase_action: string; readonly ase_result: string; readonly ase_reason: string | null; readonly ase_created_at: Date }
export interface intfSiemExportPersistence {
  claim(destinationId: string): Promise<intfClaimedExport | null>;
  finish(claimed: intfClaimedExport, result: typDeliveryResult, finalKind: typDeliveryResult['kind'], delayMs: number): Promise<void>;
}
export async function deliverNext(storage: intfSiemExportPersistence, config: intfSiemConfiguration, adapter: intfSiemAdapter = new clsHttpsJsonSiemAdapter(), secretRoot?: string): Promise<'EMPTY' | typDeliveryResult['kind']> {
  if (!config.enabled) return 'EMPTY';
  const claimed = await storage.claim(config.destinationId);
  if (!claimed) return 'EMPTY';
  const envelope: intfExportEnvelope = { eventId: claimed.tex_event__ase_id, deploymentId: claimed.ase_deployment_id, tenantId: claimed.ase_tenant_id, moduleId: claimed.ase_module_id, actorKind: claimed.ase_actor_kind, requestId: claimed.ase_request_id, correlationId: claimed.ase_correlation_id, action: claimed.ase_action, result: claimed.ase_result, reason: claimed.ase_reason, occurredAt: claimed.ase_created_at.toISOString() };
  let result: typDeliveryResult;
  try { result = await adapter.deliver(envelope, config, secretRoot); }
  catch { result = { kind: 'UNKNOWN', errorClass: 'ADAPTER_UNKNOWN' }; }
  const finalKind = claimed.tex_attempt_count >= config.maxAttempts && result.kind !== 'DELIVERED' ? 'FAILED' : result.kind;
  const delayMs = Math.min(300000, 1000 * 2 ** Math.min(claimed.tex_attempt_count, 8));
  await storage.finish(claimed, result, finalKind, delayMs);
  return finalKind;
}

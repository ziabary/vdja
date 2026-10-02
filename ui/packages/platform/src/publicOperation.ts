import type { intfExecutionContext } from '../../contracts/src/index.js';
import type { intfAdmissionPolicy, intfSiemConfiguration } from '../../configuration/src/index.js';
import { exAdmission } from '../../admission-control/src/index.js';
import type { intfReservation } from '../../admission-control/src/index.js';
import type { typPublicAuditAction } from '../../audit/src/index.js';
import type { intfUsageFacts } from '../../usage/src/index.js';
import { exAiRouter } from '../../ai-router/src/index.js';

export interface intfPublicOperationResult<T> { readonly value: T; readonly usage: readonly intfUsageFacts[] }
export interface intfPublicOperation<T> {
  readonly context: intfExecutionContext; readonly policy: intfAdmissionPolicy; readonly siem: intfSiemConfiguration;
  readonly action: { readonly requested: typPublicAuditAction; readonly completed: typPublicAuditAction; readonly failed: typPublicAuditAction; readonly cancelled: typPublicAuditAction };
  readonly inputChars: number; readonly uploadedBytes: number; readonly tokenReservation: number;
  readonly execute: () => Promise<intfPublicOperationResult<T>>;
}
export interface intfPublicOperationPersistence {
  reserve(context: intfExecutionContext, policy: intfAdmissionPolicy, inputChars: number, uploadedBytes: number, tokenReservation: number): Promise<intfReservation>;
  denied(context: intfExecutionContext, action: typPublicAuditAction, siem: intfSiemConfiguration, reason: string): Promise<void>;
  requested(context: intfExecutionContext, action: typPublicAuditAction, siem: intfSiemConfiguration): Promise<void>;
  release(context: intfExecutionContext, reservationId: string): Promise<void>;
  settle(context: intfExecutionContext, reservationId: string, action: typPublicAuditAction, siem: intfSiemConfiguration, usage: readonly intfUsageFacts[]): Promise<void>;
  failed(context: intfExecutionContext, reservationId: string, action: typPublicAuditAction, siem: intfSiemConfiguration, reason: string, cancelled: boolean): Promise<void>;
}

export async function executePublicOperation<T>(storage: intfPublicOperationPersistence, operation: intfPublicOperation<T>): Promise<T> {
  const { context, action, siem } = operation;
  let reservation: intfReservation;
  try { reservation = await storage.reserve(context, operation.policy, operation.inputChars, operation.uploadedBytes, operation.tokenReservation); }
  catch (error) { if (error instanceof exAdmission) await storage.denied(context, action.requested, siem, error.code); throw error; }
  try {
    await storage.requested(context, action.requested, siem);
  } catch (error) {
    await storage.release(context, reservation.id);
    throw error;
  }
  let result: intfPublicOperationResult<T>;
  try {
    result = await operation.execute();
  } catch (error) {
    const cancelled = error instanceof exAiRouter && error.code === 'CANCELLED';
    const reason = error instanceof exAdmission ? error.code : error instanceof exAiRouter ? error.safeClass : 'APPLICATION_FAILURE';
    await storage.failed(context, reservation.id, cancelled ? action.cancelled : action.failed, siem, reason, cancelled);
    throw error;
  }
  await storage.settle(context, reservation.id, action.completed, siem, result.usage);
  return result.value;
}

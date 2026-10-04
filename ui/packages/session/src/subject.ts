import type { intfExecutionContext } from '../../contracts/src/index.js';
import type { intfExecutionSubjectPort } from '../../contracts/src/execution-subject.js';

export interface intfSessionReference {
  readonly sessionId: string;
  readonly identityId: string;
  readonly tenantId: string;
  readonly authorizationVersion: number;
}
/** Session is the canonical owner of HUMAN execution validity, including Worker resumption. */
export function createHumanExecutionSubjectGuard(validate: (reference: intfSessionReference) => Promise<boolean>): intfExecutionSubjectPort {
  return { async assertActive(context: intfExecutionContext) {
    if (context.actorKind !== 'HUMAN' || !context.actorId || !context.sessionId || !context.tenantId
      || !Number.isSafeInteger(context.authorizationVersion) || Number(context.authorizationVersion) < 1)
      throw new Error('INVALID_EXECUTION_SUBJECT');
    if (!await validate({ sessionId: context.sessionId, identityId: context.actorId, tenantId: context.tenantId,
      authorizationVersion: Number(context.authorizationVersion) })) throw new Error('EXECUTION_SUBJECT_INACTIVE');
  } };
}

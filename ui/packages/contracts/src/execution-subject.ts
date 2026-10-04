import type { intfExecutionContext } from './index.js';

/** Validate the original executing subject again when durable work resumes. */
export interface intfExecutionSubjectPort {
  assertActive(context: intfExecutionContext): Promise<void>;
}

export type typAdmissionOutcome = 'RATE_LIMITED' | 'QUOTA_EXCEEDED' | 'CAPACITY_EXHAUSTED' | 'CONCURRENCY_CONFLICT' | 'INPUT_LIMIT_EXCEEDED' | 'OUTPUT_LIMIT_EXCEEDED';
export class exAdmission extends Error { constructor(readonly code: typAdmissionOutcome) { super(code); } }
export interface intfReservation { readonly id: string; readonly expiresAt: string }

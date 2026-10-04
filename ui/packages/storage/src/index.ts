import type { Readable } from 'node:stream';

export enum enuStorageKind { Local = 'LOCAL', S3 = 'S3_COMPATIBLE' }
export enum enuStorageOutcome { Success = 'SUCCESS', Failed = 'FAILED', Unknown = 'UNKNOWN' }
export interface intfStorageDescriptor {
  readonly key: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly mediaType: string;
}
export interface intfStoragePart {
  readonly number: number;
  readonly bytes: number;
  readonly sha256: string;
  readonly etag: string;
}
/** A provider listing is an observation, not proof of the caller's checksum. */
export interface intfStoragePartObservation {
  readonly number: number;
  readonly bytes: number;
  readonly sha256: string | null;
  readonly etag: string;
}
export type typStorageMutation = Readonly<{ kind: enuStorageOutcome.Success; uploadId?: string }>
  | Readonly<{ kind: enuStorageOutcome.Failed; reason: string }>
  | Readonly<{ kind: enuStorageOutcome.Unknown; reason: string }>;
export interface intfStoragePort {
  readonly kind: enuStorageKind;
  ready(): Promise<void>;
  begin(descriptor: intfStorageDescriptor, transferId: string): Promise<typStorageMutation>;
  reconcileBegin(key: string, transferId: string): Promise<string | null>;
  writePart(key: string, uploadId: string, part: intfStoragePart, bytes: Uint8Array,
    signal?: AbortSignal): Promise<intfStoragePart>;
  parts(key: string, uploadId: string): Promise<readonly intfStoragePartObservation[]>;
  complete(descriptor: intfStorageDescriptor, uploadId: string,
    parts: readonly intfStoragePart[]): Promise<typStorageMutation>;
  inspect(key: string): Promise<intfStorageDescriptor | null>;
  open(key: string, signal?: AbortSignal): Promise<Readable>;
  abort(key: string, uploadId: string): Promise<void>;
  /** Idempotent owner-only physical deletion under a Governance-approved purge. */
  purge?(key:string):Promise<void>;
}
export class exStorage extends Error {
  constructor(readonly code: 'INVALID_STORAGE_KEY' | 'INTEGRITY_FAILURE' | 'STORAGE_UNAVAILABLE'
    | 'PART_CONFLICT' | 'STORAGE_NOT_FOUND' | 'INVALID_STORAGE_PART') { super(code); }
}

/** Storage keys are opaque application-generated identities, never user paths. */
export function validateStorageKey(key: string): void {
  if (!/^[a-f0-9]{64}\/[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(key)) throw new exStorage('INVALID_STORAGE_KEY');
}
export function validateStorageDescriptor(value: unknown): intfStorageDescriptor {
  if (!value || typeof value !== 'object') throw new exStorage('INTEGRITY_FAILURE');
  const data = value as Record<string, unknown>;
  if (typeof data.key !== 'string' || typeof data.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(data.sha256)
    || !Number.isSafeInteger(data.bytes) || Number(data.bytes) <= 0 || typeof data.mediaType !== 'string'
    || !/^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/u.test(data.mediaType)) throw new exStorage('INTEGRITY_FAILURE');
  validateStorageKey(data.key);
  return { key: data.key, bytes: Number(data.bytes), sha256: data.sha256, mediaType: data.mediaType };
}

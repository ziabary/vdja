import { createHash } from 'node:crypto';
import { Agent } from 'node:https';
import { Readable } from 'node:stream';
import { S3Client, HeadBucketCommand, GetBucketAclCommand, GetBucketPolicyCommand, CreateMultipartUploadCommand, UploadPartCommand,
  ListPartsCommand, ListMultipartUploadsCommand, CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand, HeadObjectCommand, GetObjectCommand,DeleteObjectCommand } from '@aws-sdk/client-s3';
import { enuStorageKind, enuStorageOutcome, exStorage, validateStorageKey, validateStorageDescriptor,
  type intfStorageDescriptor, type intfStoragePart, type intfStoragePartObservation, type intfStoragePort,
  type typStorageMutation } from '../index.js';

export interface intfS3StorageOptions {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly forcePathStyle: boolean;
  readonly timeoutMs: number;
  readonly credentials: Readonly<{ accessKeyId: string; secretAccessKey: string }>;
}
function statusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const metadata = (error as Record<string, unknown>).$metadata;
  if (!metadata || typeof metadata !== 'object') return null;
  const code = (metadata as Record<string, unknown>).httpStatusCode;
  return typeof code === 'number' ? code : null;
}
function outcome(error: unknown): typStorageMutation {
  const code = statusCode(error);
  return code !== null && code >= 400 && code < 500 && code !== 408 && code !== 429
    ? { kind: enuStorageOutcome.Failed, reason: 'STORAGE_REJECTED' }
    : { kind: enuStorageOutcome.Unknown, reason: 'REMOTE_OUTCOME_UNRESOLVED' };
}

/** Standard AWS signing; private objects, explicit credentials, and no blind mutation retries. */
export class clsS3StorageAdapter implements intfStoragePort {
  readonly kind = enuStorageKind.S3;
  private readonly client: S3Client;
  constructor(private readonly options: intfS3StorageOptions) {
    this.client = new S3Client({
      endpoint: options.endpoint, region: options.region, forcePathStyle: options.forcePathStyle,
      credentials: options.credentials, maxAttempts: 1,
      requestHandler: { connectionTimeout: options.timeoutMs, requestTimeout: options.timeoutMs,
        httpsAgent: new Agent({ rejectUnauthorized: true }) }
    });
  }
  private signal(signal?: AbortSignal): AbortSignal {
    const timeout = AbortSignal.timeout(this.options.timeoutMs);
    return signal ? AbortSignal.any([signal, timeout]) : timeout;
  }
  async ready(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.options.bucket }), { abortSignal: this.signal() });
      const acl = await this.client.send(new GetBucketAclCommand({ Bucket: this.options.bucket }), { abortSignal: this.signal() });
      if (!acl.Owner?.ID || !acl.Grants?.length || acl.Grants.some(grant =>
        grant.Grantee?.Type !== 'CanonicalUser' || grant.Grantee.ID !== acl.Owner?.ID))
        throw new exStorage('STORAGE_UNAVAILABLE');
      try {
        const response = await this.client.send(new GetBucketPolicyCommand({ Bucket: this.options.bucket }), { abortSignal: this.signal() });
        if (response.Policy) {
          const value: unknown = JSON.parse(response.Policy);
          if (!value || typeof value !== 'object') throw new exStorage('STORAGE_UNAVAILABLE');
          const statements = (value as Record<string, unknown>).Statement;
          if (!Array.isArray(statements)) throw new exStorage('STORAGE_UNAVAILABLE');
          for (const statement of statements) {
            if (!statement || typeof statement !== 'object') throw new exStorage('STORAGE_UNAVAILABLE');
            const entry = statement as Record<string, unknown>;
            if (entry.Effect !== 'Allow' && entry.Effect !== 'Deny') throw new exStorage('STORAGE_UNAVAILABLE');
            if (entry.Effect === 'Allow') {
              const principal = entry.Principal;
              const aws = principal && typeof principal === 'object' ? (principal as Record<string, unknown>).AWS : null;
              if (principal === '*' || aws === '*' || (Array.isArray(aws) && aws.includes('*')) || entry.NotPrincipal !== undefined)
                throw new exStorage('STORAGE_UNAVAILABLE');
            }
          }
        }
      } catch (error) { if (statusCode(error) !== 404) throw error; }
    }
    catch { throw new exStorage('STORAGE_UNAVAILABLE'); }
  }
  async purge(key:string):Promise<void>{validateStorageKey(key);await this.client.send(new DeleteObjectCommand({Bucket:this.options.bucket,Key:key}),{abortSignal:this.signal()});if(await this.inspect(key))throw new exStorage('STORAGE_UNAVAILABLE');}
  async begin(descriptor: intfStorageDescriptor, transferId: string): Promise<typStorageMutation> {
    validateStorageDescriptor(descriptor);
    try {
      const response = await this.client.send(new CreateMultipartUploadCommand({
        Bucket: this.options.bucket, Key: descriptor.key, ContentType: descriptor.mediaType,
        ChecksumAlgorithm: 'SHA256',
        Metadata: { sha256: descriptor.sha256, bytes: String(descriptor.bytes), transfer: transferId }
      }), { abortSignal: this.signal() });
      return response.UploadId ? { kind: enuStorageOutcome.Success, uploadId: response.UploadId }
        : { kind: enuStorageOutcome.Unknown, reason: 'REMOTE_OUTCOME_UNRESOLVED' };
    } catch (error) { return outcome(error); }
  }
  async reconcileBegin(key: string, _transferId: string): Promise<string | null> {
    validateStorageKey(key);
    const response = await this.client.send(new ListMultipartUploadsCommand({
      Bucket: this.options.bucket, Prefix: key, MaxUploads: 2
    }), { abortSignal: this.signal() });
    const matches = response.Uploads?.filter(upload => upload.Key === key) ?? [];
    if (response.IsTruncated || matches.length > 1) throw new exStorage('PART_CONFLICT');
    return matches[0]?.UploadId ?? null;
  }
  async writePart(key: string, uploadId: string, part: intfStoragePart, bytes: Uint8Array,
    signal?: AbortSignal): Promise<intfStoragePart> {
    validateStorageKey(key);
    if (!Number.isInteger(part.number) || part.number < 1 || part.number > 10000
      || part.bytes !== bytes.byteLength || createHash('sha256').update(bytes).digest('hex') !== part.sha256)
      throw new exStorage('INVALID_STORAGE_PART');
    const response = await this.client.send(new UploadPartCommand({
      Bucket: this.options.bucket, Key: key, UploadId: uploadId, PartNumber: part.number,
      ContentLength: bytes.byteLength, Body: bytes,
      ChecksumSHA256: Buffer.from(part.sha256, 'hex').toString('base64')
    }), { abortSignal: this.signal(signal) });
    if (!response.ETag) throw new exStorage('STORAGE_UNAVAILABLE');
    return { ...part, etag: response.ETag };
  }
  async parts(key: string, uploadId: string): Promise<readonly intfStoragePartObservation[]> {
    validateStorageKey(key);
    const parts: intfStoragePartObservation[] = [];
    let marker: string | undefined;
    for (let page = 0; page < 10; page += 1) {
      const response = await this.client.send(new ListPartsCommand({
        Bucket: this.options.bucket, Key: key, UploadId: uploadId, MaxParts: 1000,
        ...(marker ? { PartNumberMarker: marker } : {})
      }), { abortSignal: this.signal() });
      for (const part of response.Parts ?? []) {
        if (!part.PartNumber || part.Size === undefined || !part.ETag) throw new exStorage('INTEGRITY_FAILURE');
        const sha256 = part.ChecksumSHA256 ? Buffer.from(part.ChecksumSHA256, 'base64').toString('hex') : null;
        if (sha256 !== null && !/^[a-f0-9]{64}$/u.test(sha256)) throw new exStorage('INTEGRITY_FAILURE');
        parts.push({ number: part.PartNumber, bytes: part.Size, etag: part.ETag, sha256 });
      }
      if (!response.IsTruncated) return parts.sort((a, b) => a.number - b.number);
      marker = response.NextPartNumberMarker;
      if (!marker) break;
    }
    throw new exStorage('INVALID_STORAGE_PART');
  }
  async complete(descriptor: intfStorageDescriptor, uploadId: string,
    parts: readonly intfStoragePart[]): Promise<typStorageMutation> {
    validateStorageDescriptor(descriptor);
    if (!parts.length || parts.some((part, index) => part.number !== index + 1
        || !Number.isSafeInteger(part.bytes) || part.bytes <= 0 || !/^[a-f0-9]{64}$/u.test(part.sha256)
        || !part.etag)
      || parts.reduce((bytes, part) => bytes + part.bytes, 0) !== descriptor.bytes)
      return { kind: enuStorageOutcome.Failed, reason: 'INVALID_STORAGE_PART' };
    try {
      await this.client.send(new CompleteMultipartUploadCommand({
        Bucket: this.options.bucket, Key: descriptor.key, UploadId: uploadId,
        IfNoneMatch: '*', MultipartUpload: { Parts: parts.map(part => ({
          PartNumber: part.number, ETag: part.etag,
          ChecksumSHA256: Buffer.from(part.sha256, 'hex').toString('base64')
        })) }
      }), { abortSignal: this.signal() });
      return { kind: enuStorageOutcome.Success };
    } catch (error) { return outcome(error); }
  }
  async inspect(key: string): Promise<intfStorageDescriptor | null> {
    validateStorageKey(key);
    try {
      const response = await this.client.send(new HeadObjectCommand({ Bucket: this.options.bucket, Key: key }),
        { abortSignal: this.signal() });
      const sha256 = response.Metadata?.sha256;
      if (!sha256 || !/^[a-f0-9]{64}$/u.test(sha256) || !Number.isSafeInteger(response.ContentLength)
        || Number(response.ContentLength) <= 0) throw new exStorage('INTEGRITY_FAILURE');
      return { key, sha256, bytes: Number(response.ContentLength), mediaType: response.ContentType ?? 'application/octet-stream' };
    } catch (error) {
      if (statusCode(error) === 404) return null;
      if (error instanceof exStorage) throw error;
      throw new exStorage('STORAGE_UNAVAILABLE');
    }
  }
  async open(key: string, signal?: AbortSignal): Promise<Readable> {
    validateStorageKey(key);
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.options.bucket, Key: key }),
      { abortSignal: this.signal(signal) });
    if (!(response.Body instanceof Readable)) throw new exStorage('STORAGE_UNAVAILABLE');
    return response.Body;
  }
  async abort(key: string, uploadId: string): Promise<void> {
    validateStorageKey(key);
    try { await this.client.send(new AbortMultipartUploadCommand({ Bucket: this.options.bucket,
      Key: key, UploadId: uploadId }), { abortSignal: this.signal() }); }
    catch (error) { if (statusCode(error) !== 404) throw new exStorage('STORAGE_UNAVAILABLE'); }
  }
  close(): void { this.client.destroy(); }
}

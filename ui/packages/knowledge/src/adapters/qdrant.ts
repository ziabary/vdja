import { exKnowledge, type intfVectorIndexPort, type intfVectorPoint, type intfVectorFilter, type intfVectorHit } from '../index.js';
export interface intfQdrantOptions { readonly endpoint: string; readonly apiKey?: string; readonly timeoutMs: number; readonly maxResponseBytes: number; readonly maxRequestBytes?: number }
const MAX_REQUEST_BYTES = 16777216;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new exKnowledge('INDEX_UNAVAILABLE');
  return value as Record<string, unknown>;
}
function name(collection: string): void { if (!/^idx_[a-f0-9]{16}_[a-f0-9]{32}$/u.test(collection)) throw new exKnowledge('INVALID_KNOWLEDGE'); }
function vector(values: readonly number[]): void {
  if (!values.length || values.length > 65536 || values.some(value => !Number.isFinite(value)) || !values.some(value => value !== 0))
    throw new exKnowledge('INVALID_KNOWLEDGE');
}
function filter(input: intfVectorFilter): unknown {
  if (!input.deploymentId || !input.tenantId || input.documentIds.length > 1000) throw new exKnowledge('INVALID_KNOWLEDGE');
  return { must: [ ...(['deploymentId','tenantId','generationId','spaceId'] as const).map(key => ({ key, match: { value: input[key] } })),
    { key: 'documentId', match: { any: input.documentIds } } ] };
}
/** Qdrant sees derived vectors and opaque references, never canonical content or authorization decisions. */
export class clsQdrantAdapter implements intfVectorIndexPort {
  constructor(private readonly options: intfQdrantOptions) {
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' && new URL(options.endpoint).protocol === 'https:')
      throw new Error('QDRANT_TLS_VERIFICATION_REQUIRED');
  }
  private async request(path: string, method: 'GET' | 'PUT' | 'POST', body?: unknown): Promise<Record<string, unknown>> {
    try {
      const serialized = body === undefined ? undefined : JSON.stringify(body);
      if (serialized !== undefined && Buffer.byteLength(serialized) > (this.options.maxRequestBytes ?? MAX_REQUEST_BYTES))
        throw new exKnowledge('INVALID_KNOWLEDGE');
      const response = await fetch(new URL(path, this.options.endpoint), { method, redirect: 'error',
        headers: { 'Content-Type': 'application/json', ...(this.options.apiKey ? { 'api-key': this.options.apiKey } : {}) },
        ...(serialized === undefined ? {} : { body: serialized }), signal: AbortSignal.timeout(this.options.timeoutMs) });
      if (!response.ok || !response.body) throw new exKnowledge('INDEX_UNAVAILABLE');
      const reader = response.body.getReader(), chunks: Uint8Array[] = []; let bytes = 0;
      try { while (true) { const next = await reader.read(); if (next.done) break;
        bytes += next.value.byteLength; if (bytes > this.options.maxResponseBytes) throw new exKnowledge('INDEX_UNAVAILABLE'); chunks.push(next.value); } }
      finally { await reader.cancel(); reader.releaseLock(); }
      return object(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown);
    } catch { throw new exKnowledge('INDEX_UNAVAILABLE'); }
  }
  async ready(): Promise<void> { await this.request('/collections','GET'); }
  async ensure(collection: string, dimensions: number): Promise<void> {
    name(collection);
    if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 65536) throw new exKnowledge('INVALID_KNOWLEDGE');
    const known = await this.request('/collections','GET');
    const collections = object(known.result).collections;
    if (!Array.isArray(collections)) throw new exKnowledge('INDEX_UNAVAILABLE');
    if (!collections.some(entry => object(entry).name === collection)) {
      try { await this.request(`/collections/${collection}`, 'PUT', { vectors: { size: dimensions, distance: 'Cosine' }, on_disk_payload: true }); }
      catch { /* A second replica may have created the same immutable generation. Check its contract below. */ }
    }
    const current = object((await this.request(`/collections/${collection}`,'GET')).result);
    const vectors = object(object(current.config).params).vectors;
    if (object(vectors).size !== dimensions || object(vectors).distance !== 'Cosine') throw new exKnowledge('INDEX_CONFLICT');
    for (const field of ['deploymentId','tenantId','generationId','spaceId','documentId'])
      await this.request(`/collections/${collection}/index?wait=true`, 'PUT', { field_name: field, field_schema: 'keyword' });
  }
  async upsert(collection: string, points: readonly intfVectorPoint[]): Promise<void> {
    name(collection);
    if (!points.length || points.length > 256) throw new exKnowledge('INVALID_KNOWLEDGE');
    for (const point of points) {
      vector(point.vector);
      if (!UUID.test(point.id) || !UUID.test(point.payload.chunkId)
        || Object.keys(point.payload).sort().join(',') !== 'chunkId,deploymentId,documentId,documentSecurityVersion,generationId,membershipSecurityVersion,spaceId,tenantId,versionId')
        throw new exKnowledge('INVALID_KNOWLEDGE');
    }
    await this.request(`/collections/${collection}/points?wait=true`,'PUT',{ points });
  }
  async purgeDocument(collection:string,input:intfVectorFilter):Promise<void>{name(collection);await this.request(`/collections/${collection}/points/delete?wait=true`,'POST',{filter:filter(input)});if(await this.count(collection,input)!==0)throw new exKnowledge('INDEX_UNAVAILABLE');}
  async count(collection: string, input: intfVectorFilter): Promise<number> {
    name(collection);
    if (!input.documentIds.length) return 0;
    const count = object((await this.request(`/collections/${collection}/points/count`,'POST',{ filter: filter(input), exact: true })).result).count;
    if (!Number.isSafeInteger(count) || Number(count) < 0) throw new exKnowledge('INDEX_UNAVAILABLE');
    return Number(count);
  }
  async search(collection: string, query: readonly number[], input: intfVectorFilter, limit: number): Promise<readonly intfVectorHit[]> {
    name(collection); vector(query);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new exKnowledge('INVALID_KNOWLEDGE');
    if (!input.documentIds.length) return [];
    const result = object((await this.request(`/collections/${collection}/points/query`,'POST',
      { query, filter: filter(input), limit, with_payload: ['chunkId'], with_vector: false })).result);
    if (!Array.isArray(result.points)) throw new exKnowledge('INDEX_UNAVAILABLE');
    if (result.points.length > limit) throw new exKnowledge('INDEX_UNAVAILABLE');
    const seen = new Set<string>();
    return result.points.map(value => { const point = object(value), payload = object(point.payload);
      if (typeof point.id !== 'string' || !UUID.test(point.id) || typeof payload.chunkId !== 'string'
        || !UUID.test(payload.chunkId) || seen.has(point.id) || !Number.isFinite(point.score)) throw new exKnowledge('INDEX_UNAVAILABLE');
      seen.add(point.id);
      return { id: point.id, chunkId: payload.chunkId, score: Number(point.score) }; });
  }
}

import { createHash } from 'node:crypto';
import { exKnowledge, MAX_INDEX_GENERATION_CHUNKS, type intfIndexProfile } from './index.js';
export interface intfChunkBoundary { readonly id: string; readonly ordinal: number; readonly start: number; readonly end: number; readonly sha256: string }
/** Stable UUIDs for Qdrant, with explicit hash-derived v8/variant bits. */
export function deterministicIdentifier(identity: readonly string[]): string {
  const hex = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-8${hex.slice(13,16)}-${((parseInt(hex[16]!,16)&3)|8).toString(16)}${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
export function chunkNormalized(text: string, versionId: string, profile: intfIndexProfile): readonly intfChunkBoundary[] {
  if (!text.trim() || profile.chunkingProfile !== 'utf16-window-v1' || !Number.isInteger(profile.chunkChars)
    || profile.chunkChars < 32 || profile.chunkChars > 8000 || !Number.isInteger(profile.overlapChars)
    || profile.overlapChars < 0 || profile.overlapChars >= profile.chunkChars) throw new exKnowledge('INVALID_KNOWLEDGE');
  const chunks: intfChunkBoundary[] = [];
  for (let start = 0; start < text.length;) {
    if (chunks.length >= MAX_INDEX_GENERATION_CHUNKS) throw new exKnowledge('CONTEXT_BUDGET_EXCEEDED');
    let end = Math.min(start + profile.chunkChars, text.length);
    // Do not divide a Unicode surrogate pair at either boundary.
    if (end < text.length && /[\uD800-\uDBFF]/u.test(text[end-1]!)) end -= 1;
    const sha256 = createHash('sha256').update(text.slice(start,end)).digest('hex');
    chunks.push({ id: deterministicIdentifier([versionId, profile.chunkingProfile, String(profile.chunkChars),
      String(profile.overlapChars), String(start), String(end), sha256]), ordinal: chunks.length, start, end, sha256 });
    if (end === text.length) break;
    // A maximal overlap combined with a two-code-unit character must still
    // advance. Prefer reducing overlap over repeating the same window forever.
    let next = Math.max(start + 1, end - profile.overlapChars);
    if (/[\uDC00-\uDFFF]/u.test(text[next]!)) next += 1;
    start = next;
  }
  return chunks;
}
export function verifyChunk(text: string, start: number, end: number, hash: string): string {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > text.length
    || createHash('sha256').update(text.slice(start,end)).digest('hex') !== hash) throw new exKnowledge('STALE_PROJECTION');
  return text.slice(start,end);
}

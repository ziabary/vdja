import { inflateRawSync } from 'node:zlib';

export interface intfArchiveLimits {
  readonly maxEntries: number;
  readonly maxTotalUncompressedBytes: number;
  readonly maxEntryUncompressedBytes: number;
  readonly maxCompressionRatio: number;
  readonly maxNesting: number;
}

export const DEFAULT_ARCHIVE_LIMITS: intfArchiveLimits = Object.freeze({
  maxEntries: 2_000, maxTotalUncompressedBytes: 80_000_000,
  maxEntryUncompressedBytes: 20_000_000, maxCompressionRatio: 100, maxNesting: 0
});

function invalid(): never { throw new Error('INVALID_OFFICE_ARCHIVE'); }
function looksLikeNestedArchive(bytes: Buffer): boolean {
  return bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
    || bytes.subarray(0, 2).equals(Buffer.from([0x1f, 0x8b]))
    || bytes.subarray(0, 6).equals(Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]))
    || bytes.subarray(0, 7).equals(Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]))
    || bytes.subarray(257, 262).toString('ascii') === 'ustar';
}
function safeName(bytes: Buffer): string {
  let name: string;
  try { name = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return invalid(); }
  if (!name || name.length > 1_024 || name.includes('\\') || name.includes('\0') || name.startsWith('/')
    || /^[A-Za-z]:/u.test(name) || name.includes('//') || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(name)
    || name.split('/').some(part => part === '.' || part === '..')) invalid();
  return name;
}

/** Bounded central-directory validation before any Office parser sees the archive. */
export function precheckOfficeArchive(bytes: Buffer, kind: '.docx' | '.odt', limits: intfArchiveLimits = DEFAULT_ARCHIVE_LIMITS): void {
  if (bytes.length < 22) invalid();
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65_557); at -= 1) {
    if (bytes.readUInt32LE(at) === 0x06054b50 && at + 22 + bytes.readUInt16LE(at + 20) === bytes.length) { end = at; break; }
  }
  if (end < 0 || bytes.readUInt16LE(end + 4) !== 0 || bytes.readUInt16LE(end + 6) !== 0) invalid();
  const entries = bytes.readUInt16LE(end + 10), directorySize = bytes.readUInt32LE(end + 12), directoryAt = bytes.readUInt32LE(end + 16);
  if (entries === 0 || entries === 0xffff || entries > limits.maxEntries || entries !== bytes.readUInt16LE(end + 8)
    || directorySize === 0xffffffff || directoryAt === 0xffffffff || directoryAt + directorySize !== end) invalid();
  const names = new Set<string>();
  const contents = new Map<string, Buffer>();
  let at = directoryAt, total = 0;
  for (let index = 0; index < entries; index += 1) {
    if (at + 46 > end || bytes.readUInt32LE(at) !== 0x02014b50) invalid();
    const flags = bytes.readUInt16LE(at + 8), method = bytes.readUInt16LE(at + 10);
    const compressed = bytes.readUInt32LE(at + 20), uncompressed = bytes.readUInt32LE(at + 24);
    const nameLength = bytes.readUInt16LE(at + 28), extraLength = bytes.readUInt16LE(at + 30), commentLength = bytes.readUInt16LE(at + 32);
    const external = bytes.readUInt32LE(at + 38), localAt = bytes.readUInt32LE(at + 42);
    const next = at + 46 + nameLength + extraLength + commentLength;
    if (next > end || !nameLength || compressed === 0xffffffff || uncompressed === 0xffffffff || localAt === 0xffffffff
      || (flags & ~0x0808) !== 0 || ![0, 8].includes(method) || bytes.readUInt16LE(at + 34) !== 0) invalid();
    const name = safeName(bytes.subarray(at + 46, at + 46 + nameLength));
    if (names.has(name) || (((external >>> 16) & 0xf000) === 0xa000)) invalid();
    names.add(name);
    if (limits.maxNesting === 0 && /\.(?:zip|7z|rar|tar|gz|docx|odt)$/iu.test(name)) invalid();
    total += uncompressed;
    if (!Number.isSafeInteger(total) || total > limits.maxTotalUncompressedBytes || uncompressed > limits.maxEntryUncompressedBytes
      || uncompressed / Math.max(1, compressed) > limits.maxCompressionRatio) invalid();
    if (localAt + 30 > directoryAt || bytes.readUInt32LE(localAt) !== 0x04034b50
      || bytes.readUInt16LE(localAt + 6) !== flags || bytes.readUInt16LE(localAt + 8) !== method) invalid();
    if ((flags & 0x0008) === 0 && (bytes.readUInt32LE(localAt + 18) !== compressed
      || bytes.readUInt32LE(localAt + 22) !== uncompressed)) invalid();
    const localNameLength = bytes.readUInt16LE(localAt + 26), localExtraLength = bytes.readUInt16LE(localAt + 28);
    const localName = bytes.subarray(localAt + 30, localAt + 30 + localNameLength);
    if (!localName.equals(bytes.subarray(at + 46, at + 46 + nameLength))) invalid();
    const dataAt = localAt + 30 + localNameLength + localExtraLength;
    if (dataAt + compressed > directoryAt) invalid();
    const payload = bytes.subarray(dataAt, dataAt + compressed);
    let decoded: Buffer;
    try { decoded = method === 0 ? payload : inflateRawSync(payload, { maxOutputLength: Math.min(limits.maxEntryUncompressedBytes + 1, uncompressed + 1) }); }
    catch { return invalid(); }
    if (decoded.length !== uncompressed) invalid();
    if (limits.maxNesting === 0 && looksLikeNestedArchive(decoded)) invalid();
    // Accepted text documents must not carry active content or external XML resources.
    if (/(?:^|\/)(?:vbaProject\.bin|macros|scripts|embeddings)(?:\/|$)/iu.test(name)) invalid();
    if (/\.(?:xml|rels)$/iu.test(name)) {
      let xml: string;
      try { xml = new TextDecoder('utf-8', { fatal: true }).decode(decoded); } catch { return invalid(); }
      if (/<!\s*(?:DOCTYPE|ENTITY)\b|<\s*(?:\w+:)?(?:script|scripts)\b/iu.test(xml)
        || /\bTargetMode\s*=\s*["']External["']/iu.test(xml)
        || /\b(?:xlink:href|href)\s*=\s*["']\s*(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(xml)) invalid();
    }
    if (name === 'mimetype' || name === '[Content_Types].xml') contents.set(name, decoded);
    at = next;
  }
  if (at !== end) invalid();
  if (kind === '.docx' && (!names.has('[Content_Types].xml') || !names.has('_rels/.rels') || !names.has('word/document.xml')
    || !contents.get('[Content_Types].xml')?.includes(Buffer.from('wordprocessingml')))) invalid();
  if (kind === '.odt' && (!names.has('mimetype') || !names.has('content.xml') || !names.has('META-INF/manifest.xml')
    || contents.get('mimetype')?.toString('utf8') !== 'application/vnd.oasis.opendocument.text')) invalid();
}

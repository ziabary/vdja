import { exFileManagement } from './index.js';

export interface intfByteRange { readonly start: number; readonly end: number; readonly bytes: number }
/** Single RFC byte range; malformed/multiple ranges and unsafe integers are rejected before I/O. */
export function parseByteRange(header: string | undefined, size: number): intfByteRange | null {
  if (header === undefined) return null;
  if (!Number.isSafeInteger(size) || size <= 0 || header.length > 100) throw new exFileManagement('INVALID_RANGE');
  const match = /^bytes=(\d*)-(\d*)$/u.exec(header);
  if (!match || (!match[1] && !match[2])) throw new exFileManagement('INVALID_RANGE');
  let start: number, end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix < 1) throw new exFileManagement('INVALID_RANGE');
    start = Math.max(0, size - suffix); end = size - 1;
  } else {
    start = Number(match[1]); end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start)
      throw new exFileManagement('INVALID_RANGE');
    end = Math.min(end, size - 1);
  }
  return { start, end, bytes: end - start + 1 };
}

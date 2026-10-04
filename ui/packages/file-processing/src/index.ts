import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, lstat, realpath, mkdtemp, copyFile, stat, rm, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { precheckOfficeArchive, type intfArchiveLimits } from './office-archive.js';

const run = promisify(execFile);
export interface intfUploadedFile { readonly path: string; readonly originalname: string; readonly mimetype: string; readonly size: number }
export interface intfExtractedText { readonly text: string; readonly pageCount: number; readonly stripped: boolean; readonly processor: string }
export interface intfFileLimits { readonly maxUploadBytes: number; readonly maxExtractedChars: number; readonly maxPages: number; readonly archive?: intfArchiveLimits }
export class exFileProcessing extends Error { constructor(readonly code: 'UNSUPPORTED_FILE' | 'FILE_TOO_LARGE' | 'INVALID_FILE' | 'PAGE_LIMIT' | 'EXTRACTION_FAILED') { super(code); } }

/** A display-only name; never use it to select a filesystem path. */
export function displayFilename(input: string): string {
  const basename = input.normalize('NFC').split(/[\\/]/u).pop() ?? '';
  const cleaned = basename.replace(/[\p{Cc}\p{Bidi_Control}<>:"|?*]/gu, '').replace(/\s+/gu, ' ').trim().replace(/^\.+|\.+$/gu, '');
  let result = '';
  for (const character of cleaned) {
    if (Buffer.byteLength(result + character, 'utf8') > 255 || [...result].length >= 180) break;
    result += character;
  }
  return result || 'file';
}

function extension(name: string): '.txt' | '.md' | '.pdf' | '.doc' | '.docx' | '.odt' {
  const ext = extname(name).toLowerCase();
  if (!['.txt', '.md', '.pdf', '.doc', '.docx', '.odt'].includes(ext)) throw new exFileProcessing('UNSUPPORTED_FILE');
  return ext as '.txt' | '.md' | '.pdf' | '.doc' | '.docx' | '.odt';
}
function signature(ext: string, head: Buffer): void {
  if (ext === '.pdf' && head.subarray(0, 5).toString() !== '%PDF-') throw new exFileProcessing('INVALID_FILE');
  if (['.docx', '.odt'].includes(ext) && head.subarray(0, 2).toString() !== 'PK') throw new exFileProcessing('INVALID_FILE');
  if (ext === '.doc' && head.subarray(0, 8).toString('hex') !== 'd0cf11e0a1b11ae1') throw new exFileProcessing('INVALID_FILE');
  if (['.txt', '.md'].includes(ext) && head.includes(0)) throw new exFileProcessing('INVALID_FILE');
}

const ACCEPTED_MEDIA_TYPES: Readonly<Record<string, readonly string[]>> = {
  '.txt': ['text/plain'],
  '.md': ['text/markdown', 'text/plain'],
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.odt': ['application/vnd.oasis.opendocument.text']
};

function validateMediaType(ext: string, mediaType: string): void {
  const normalized = mediaType.split(';', 1)[0]?.trim().toLowerCase();
  if (!normalized || !ACCEPTED_MEDIA_TYPES[ext]?.includes(normalized)) throw new exFileProcessing('INVALID_FILE');
}

interface intfInspectedFile { readonly extension: ReturnType<typeof extension>; readonly path: string }
export function validateFileMetadata(file: Pick<intfUploadedFile, 'originalname' | 'mimetype' | 'size'>,
  limits: intfFileLimits): void {
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > limits.maxUploadBytes) throw new exFileProcessing('FILE_TOO_LARGE');
  validateMediaType(extension(file.originalname), file.mimetype);
}
async function validatedFile(file: intfUploadedFile, limits: intfFileLimits): Promise<intfInspectedFile> {
  validateFileMetadata(file, limits);
  const ext = extension(file.originalname), absolute = resolve(file.path), root = resolve(tmpdir());
  if (!absolute.startsWith(root + sep)) throw new exFileProcessing('INVALID_FILE');
  const actual = await realpath(absolute), details = await lstat(actual);
  if (actual !== absolute || !details.isFile() || details.size !== file.size) throw new exFileProcessing('INVALID_FILE');
  const handle = await open(actual, constants.O_RDONLY | constants.O_NOFOLLOW);
  const head = Buffer.alloc(Math.min(16, file.size));
  try { await handle.read(head, 0, head.length, 0); } finally { await handle.close(); }
  signature(ext, head);
  if (ext === '.txt' || ext === '.md') {
    const bytes = await readFile(actual);
    try { if (bytes.includes(0)) throw new Error('NUL'); new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new exFileProcessing('INVALID_FILE'); }
  }
  if (ext === '.docx' || ext === '.odt') {
    const bytes = await readFile(actual);
    try { precheckOfficeArchive(bytes, ext, limits.archive); }
    catch { throw new exFileProcessing('INVALID_FILE'); }
  }
  return { extension: ext, path: actual };
}
/** Common intake type/signature/archive policy, shared by managed and transient file operations. */
export async function inspectFile(file: intfUploadedFile, limits: intfFileLimits): Promise<void> {
  await validatedFile(file, limits);
}
export async function extractText(file: intfUploadedFile, limits: intfFileLimits, requestedMaxChars = limits.maxExtractedChars): Promise<intfExtractedText> {
  const inspected = await validatedFile(file, limits), ext = inspected.extension, actual = inspected.path;
  const bytes = await readFile(actual);
  const maxChars = Math.min(limits.maxExtractedChars, Math.max(1, requestedMaxChars));
  if (ext === '.txt' || ext === '.md') {
    let content: string; try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new exFileProcessing('INVALID_FILE'); }
    return { text: content.slice(0, maxChars), pageCount: 1, stripped: content.length > maxChars, processor: 'utf8-v1' };
  }
  if (ext === '.pdf') {
    const task = pdfjs.getDocument({ data: new Uint8Array(bytes), disableFontFace: true, useSystemFonts: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { void task.destroy().catch(() => undefined); reject(new exFileProcessing('EXTRACTION_FAILED')); }, 30_000);
    });
    const parse = async (): Promise<intfExtractedText> => {
      let document: Awaited<typeof task.promise>;
      try { document = await task.promise; }
      catch { throw new exFileProcessing('INVALID_FILE'); }
      try {
        if (document.numPages > limits.maxPages) throw new exFileProcessing('PAGE_LIMIT');
        const parts: string[] = []; let length = 0, stripped = false;
        for (let pageNo = 1; pageNo <= document.numPages; pageNo += 1) {
          const page = await document.getPage(pageNo);
          const content = await page.getTextContent();
          const text = content.items.map(item => 'str' in item ? item.str : '').join(' ');
          const chunk = `${pageNo > 1 ? `\n<!-- PAGE ${pageNo} -->\n` : ''}${text}`;
          if (length + chunk.length > maxChars) { parts.push(chunk.slice(0, maxChars - length)); stripped = true; break; }
          parts.push(chunk); length += chunk.length;
        }
        return { text: parts.join(''), pageCount: document.numPages, stripped, processor: 'pdfjs-v1' };
      } finally { await document.destroy(); }
    };
    try { return await Promise.race([parse(), deadline]); }
    finally { if (timer) clearTimeout(timer); }
  }
  const directory = await mkdtemp(join(tmpdir(), 'targoman-doc-'));
  const officeProfile = join(tmpdir(), `targoman-lo-${directory.split(sep).pop()}`);
  try {
    const input = join(directory, `input${ext}`), output = join(directory, 'input.txt');
    await copyFile(actual, input);
    try { await run('libreoffice', [`-env:UserInstallation=${pathToFileURL(officeProfile).href}`, '--headless', '--convert-to', 'txt:Text', '--outdir', directory, input], { timeout: 30000, maxBuffer: 100000 }); }
    catch { throw new exFileProcessing('EXTRACTION_FAILED'); }
    const meta = await stat(output).catch(() => null);
    if (!meta || meta.size > limits.maxExtractedChars * 8) throw new exFileProcessing('EXTRACTION_FAILED');
    const content = new TextDecoder('utf-8', { fatal: false }).decode(await readFile(output));
    return { text: content.slice(0, maxChars), pageCount: 1, stripped: content.length > maxChars, processor: 'libreoffice-v1' };
  } finally { await Promise.all([rm(directory, { recursive: true, force: true }),
    rm(officeProfile, { recursive: true, force: true })]); }
}

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, lstat, realpath, mkdtemp, copyFile, stat, rm } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const run = promisify(execFile);
export interface intfUploadedFile { readonly path: string; readonly originalname: string; readonly mimetype: string; readonly size: number }
export interface intfExtractedText { readonly text: string; readonly pageCount: number; readonly stripped: boolean; readonly processor: string }
export interface intfFileLimits { readonly maxUploadBytes: number; readonly maxExtractedChars: number; readonly maxPages: number }
export class exFileProcessing extends Error { constructor(readonly code: 'UNSUPPORTED_FILE' | 'FILE_TOO_LARGE' | 'INVALID_FILE' | 'PAGE_LIMIT' | 'EXTRACTION_FAILED') { super(code); } }

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

export async function extractText(file: intfUploadedFile, limits: intfFileLimits, requestedMaxChars = limits.maxExtractedChars): Promise<intfExtractedText> {
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > limits.maxUploadBytes) throw new exFileProcessing('FILE_TOO_LARGE');
  const ext = extension(file.originalname), absolute = resolve(file.path), root = resolve(tmpdir());
  if (!absolute.startsWith(root + sep)) throw new exFileProcessing('INVALID_FILE');
  const actual = await realpath(absolute), details = await lstat(actual);
  if (actual !== absolute || !details.isFile() || details.size !== file.size) throw new exFileProcessing('INVALID_FILE');
  const head = (await readFile(actual)).subarray(0, 16);
  signature(ext, head);
  const maxChars = Math.min(limits.maxExtractedChars, Math.max(1, requestedMaxChars));
  if (ext === '.txt' || ext === '.md') {
    const bytes = await readFile(actual);
    let content: string; try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new exFileProcessing('INVALID_FILE'); }
    return { text: content.slice(0, maxChars), pageCount: 1, stripped: content.length > maxChars, processor: 'utf8-v1' };
  }
  if (ext === '.pdf') {
    const bytes = await readFile(actual);
    let document: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>;
    try { document = await pdfjs.getDocument({ data: new Uint8Array(bytes), disableFontFace: true, useSystemFonts: true }).promise; }
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
  }
  const directory = await mkdtemp(join(tmpdir(), 'targoman-doc-'));
  try {
    const input = join(directory, `input${ext}`), output = join(directory, 'input.txt');
    await copyFile(actual, input);
    try { await run('libreoffice', ['-env:UserInstallation=file:///tmp/targoman-lo-' + directory.split('/').pop(), '--headless', '--convert-to', 'txt:Text', '--outdir', directory, input], { timeout: 30000, maxBuffer: 100000 }); }
    catch { throw new exFileProcessing('EXTRACTION_FAILED'); }
    const meta = await stat(output).catch(() => null);
    if (!meta || meta.size > limits.maxExtractedChars * 8) throw new exFileProcessing('EXTRACTION_FAILED');
    const content = new TextDecoder('utf-8', { fatal: false }).decode(await readFile(output));
    return { text: content.slice(0, maxChars), pageCount: 1, stripped: content.length > maxChars, processor: 'libreoffice-v1' };
  } finally { await rm(directory, { recursive: true, force: true }); }
}

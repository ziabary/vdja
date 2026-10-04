import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { displayFilename, extractText, exFileProcessing } from '../../packages/file-processing/src/index.js';
import { precheckOfficeArchive } from '../../packages/file-processing/src/office-archive.js';

const LIMITS = { maxUploadBytes: 100_000, maxExtractedChars: 10_000, maxPages: 20,
  archive: { maxEntries: 20, maxTotalUncompressedBytes: 50_000, maxEntryUncompressedBytes: 30_000, maxCompressionRatio: 50, maxNesting: 0 } };

function zip(entries: readonly { name: string; data: string; symlink?: boolean }[]): Buffer {
  const local: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name), data = Buffer.from(entry.data), compressed = deflateRawSync(data);
    const l = Buffer.alloc(30); l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(20, 4); l.writeUInt16LE(0x0800, 6);
    l.writeUInt16LE(8, 8); l.writeUInt32LE(compressed.length, 18); l.writeUInt32LE(data.length, 22); l.writeUInt16LE(name.length, 26);
    local.push(l, name, compressed);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(0x0314, 4); c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10); c.writeUInt32LE(compressed.length, 20);
    c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(((entry.symlink ? 0xa1ff : 0x81a4) << 16) >>> 0, 38); c.writeUInt32LE(offset, 42);
    central.push(c, name); offset += l.length + name.length + compressed.length;
  }
  const centralSize = Buffer.concat(central).length, end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}
const DOCX = [
  { name: '[Content_Types].xml', data: '<Types>wordprocessingml</Types>' },
  { name: '_rels/.rels', data: '<Relationships/>' },
  { name: 'word/document.xml', data: '<document/>' }
];

test('display filename preserves Persian basename and removes dangerous metadata', () => {
  assert.equal(displayFilename('C:\\users\\x\\گزارش\u202e\r\n.txt'), 'گزارش.txt');
  assert.equal(displayFilename('../../گزارش́.md'), 'گزارش́.md'.normalize('NFC'));
  const hostile = displayFilename('<script>"x"</script>.docx');
  assert.ok(!/[<>\\/\r\n\u202e]/u.test(hostile));
  assert.ok(Buffer.byteLength(displayFilename('الف'.repeat(300) + '.pdf')) <= 255);
  assert.ok(!JSON.stringify({ fileName: hostile }).includes('<script>'));
});

test('office precheck rejects malicious archives before LibreOffice', async () => {
  assert.doesNotThrow(() => precheckOfficeArchive(zip(DOCX), '.docx', LIMITS.archive));
  const directory = await mkdtemp(join(tmpdir(), 't4-file-test-'));
  try {
    const cases: readonly { name: string; bytes: Buffer }[] = [
      { name: 'traversal', bytes: zip([...DOCX, { name: '../outside', data: 'x' }]) },
      { name: 'absolute', bytes: zip([...DOCX, { name: '/outside', data: 'x' }]) },
      { name: 'symlink', bytes: zip([...DOCX, { name: 'link', data: 'target', symlink: true }]) },
      { name: 'too-many', bytes: zip([...DOCX, ...Array.from({ length: 21 }, (_, i) => ({ name: `x${i}`, data: 'x' }))]) },
      { name: 'bomb', bytes: zip([...DOCX, { name: 'large', data: 'x'.repeat(31_000) }]) },
      { name: 'nested-disguised', bytes: zip([...DOCX, { name: 'image.bin', data: 'PK\u0003\u0004embedded' }]) },
      { name: 'wrong-type', bytes: zip([{ name: 'mimetype', data: 'application/vnd.oasis.opendocument.text' }, { name: 'content.xml', data: 'x' }]) },
      { name: 'truncated', bytes: zip(DOCX).subarray(0, 40) }
      ,{ name: 'xxe', bytes: zip([...DOCX, {name:'word/evil.xml',data:'<!DOCTYPE x [<!ENTITY leak SYSTEM "file:///etc/passwd">]><x>&leak;</x>'}]) }
      ,{ name: 'external', bytes: zip([...DOCX, {name:'word/_rels/document.xml.rels',data:'<Relationship TargetMode="External" Target="https://example.invalid"/>'}]) }
      ,{ name: 'macro', bytes: zip([...DOCX, {name:'word/vbaProject.bin',data:'macro'}]) }
    ];
    for (const item of cases) {
      const path = join(directory, `${item.name}.docx`); await writeFile(path, item.bytes);
      await assert.rejects(extractText({ path, originalname: 'upload.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: item.bytes.length }, LIMITS),
        (error: unknown) => error instanceof exFileProcessing && error.code === 'INVALID_FILE', item.name);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('upload media type, extension, signature, and temporary path agree', async () => {
  const directory = await mkdtemp(join(tmpdir(), 't44-file-test-'));
  try {
    const path = join(directory, 'opaque-upload');
    const bytes = Buffer.from('safe text');
    await writeFile(path, bytes);
    const base = { path, originalname: 'document.txt', mimetype: 'text/plain', size: bytes.length };
    assert.equal((await extractText(base, LIMITS)).text, 'safe text');
    for (const malformed of [Buffer.concat([Buffer.alloc(20,65),Buffer.from([0])]),Buffer.concat([Buffer.alloc(20,65),Buffer.from([255])])]) {
      await writeFile(path,malformed);
      await assert.rejects(extractText({...base,size:malformed.length},LIMITS),/INVALID_FILE/);
    }
    await writeFile(path,bytes);
    for (const mimetype of ['application/pdf', 'application/octet-stream', '']) {
      await assert.rejects(extractText({ ...base, mimetype }, LIMITS),
        (error: unknown) => error instanceof exFileProcessing && error.code === 'INVALID_FILE');
    }
    await assert.rejects(extractText({ ...base, originalname: 'document.pdf', mimetype: 'application/pdf' }, LIMITS),
      (error: unknown) => error instanceof exFileProcessing && error.code === 'INVALID_FILE');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('office parser cleans its conversion directory and profile after processing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 't44-office-test-'));
  try {
    const bytes = zip(DOCX), path = join(directory, 'opaque-upload');
    await writeFile(path, bytes);
    const before = new Set((await readdir(tmpdir())).filter(name => name.startsWith('targoman-doc-') || name.startsWith('targoman-lo-')));
    await extractText({ path, originalname: 'document.docx',
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: bytes.length }, LIMITS)
      .catch((error: unknown) => { assert.ok(error instanceof exFileProcessing); });
    const after = (await readdir(tmpdir())).filter(name => name.startsWith('targoman-doc-') || name.startsWith('targoman-lo-'));
    assert.deepEqual(after.filter(name => !before.has(name)), []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

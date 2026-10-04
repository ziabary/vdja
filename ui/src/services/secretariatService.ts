import { createHash, randomInt, randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { copyFile, mkdir, readFile, rm, writeFile } from 'fs/promises';
import path from 'path';
import knex from 'knex';
import type { IntfFileMeta } from '../interfaces/file';
import type { IntfAuth } from '../interfaces/auth';
import { exHttpAccessDenied, exHttpConflict, exHttpInvalidParams } from '../interfaces/exHttp';
import { getDB } from '../db/index';
import file2DB from './file2TxtService';
import vectorDB from './vectorDB';
import { retrieveSecretariatFiles, fuseSecretariatRankings } from './secretariatRetrieval';
import logger from '../utils/logger';
import configManager from '../utils/configManager';
import { compactSearchText, containsSearchTokens, normalizeSearchText, searchTokens } from '../utils/persianSearch';

const COLLECTION = 'SECRETARIAT_LETTERS';
const STORAGE = path.resolve(process.env.SECRETARIAT_STORAGE_DIR || path.join(process.cwd(), '.rag-data.local', 'secretariat'));
const EXTENSIONS = new Set(['.txt', '.md', '.doc', '.docx', '.odt', '.pdf']);
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const WIZARD_BODY = 'جناب آقای فلانی\nبا سلام به پیوست فایل مربوطه تقدیم حضور می‌شود .';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const FIRST_NAMES = ['علی', 'محمد', 'رضا', 'مهدی', 'حسین', 'امیر', 'زهرا', 'فاطمه', 'مریم', 'نرگس', 'سارا', 'لیلا'];
const LAST_NAMES = ['احمدی', 'محمدی', 'حسینی', 'رضایی', 'کریمی', 'مرادی', 'موسوی', 'کاظمی', 'صادقی', 'رحیمی', 'جعفری', 'نادری'];
const JALALI_FORMAT = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function requireSecretariatAdmin(auth: IntfAuth) {
  if (!auth.privs?.isAdmin && !auth.privs?.secretariatAdmin)
    throw new exHttpAccessDenied('دسترسی مدیریت دبیرخانه ندارید');
}

export function requireSecretariatOperator(auth: IntfAuth) {
  if (!auth.privs?.isAdmin && !auth.privs?.secretariatAdmin && !auth.privs?.secretariatOperator)
    throw new exHttpAccessDenied('دسترسی ثبت نامه ندارید');
}

function nonempty(value: unknown, max: number, label: string, required = false): string | null {
  if (value == null || value === '') {
    if (required) throw new exHttpInvalidParams(`${label} الزامی است`);
    return null;
  }
  if (typeof value !== 'string' || value.trim().length > max || !value.trim())
    throw new exHttpInvalidParams(`${label} نامعتبر است`);
  return value.trim();
}

export type LetterInput = {
  subject?: unknown; number?: unknown; sender?: unknown; recipient?: unknown;
  letterDate?: unknown; body?: unknown; externalId?: unknown;
};

export async function listSources(auth: IntfAuth) {
  requireSecretariatAdmin(auth);
  return (await getDB())('tblSecretariatSources')
    .select('srcID', 'srcName', 'srcKind', 'srcUrl', 'srcTokenEnv', 'srcConfig', 'srcEnabled', 'srcCursor', 'srcLastSyncAt')
    .orderBy('srcID', 'desc');
}

export async function createSource(auth: IntfAuth, input: Record<string, unknown>) {
  requireSecretariatAdmin(auth);
  const name = nonempty(input.name, 160, 'نام منبع', true);
  const kind = nonempty(input.kind || 'rest', 20, 'نوع منبع', true)!;
  if (!['rest', 'pgsql', 'mysql', 'mssql'].includes(kind)) throw new exHttpInvalidParams('نوع منبع پشتیبانی نمی‌شود');
  const url = kind === 'rest' ? validUrl(input.url) : null;
  const tokenEnv = nonempty(input.tokenEnv, 120, 'نام متغیر توکن');
  if (tokenEnv && !/^[A-Z_][A-Z0-9_]*$/.test(tokenEnv))
    throw new exHttpInvalidParams('نام متغیر توکن نامعتبر است');
  const config = kind === 'rest' ? null : validDbConfig(input.config);
  const db = await getDB();
  const key = randomUUID();
  await db('tblSecretariatSources').insert({ srcKey: key, srcName: name, srcKind: kind, srcUrl: url,
    srcTokenEnv: tokenEnv, srcConfig: config ? JSON.stringify(config) : null, srcEnabled: Boolean(input.enabled) });
  return db('tblSecretariatSources').where({ srcKey: key }).first();
}

function validUrl(value: unknown) {
  const url = nonempty(value, 1000, 'آدرس منبع', true)!;
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new exHttpInvalidParams('آدرس منبع نامعتبر است'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password)
    throw new exHttpInvalidParams('آدرس منبع باید HTTP یا HTTPS باشد');
  return url;
}

function validDbConfig(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new exHttpInvalidParams('تنظیمات پایگاه داده الزامی است');
  const input = value as Record<string, unknown>;
  const identifier = (key: string) => {
    const text = nonempty(input[key], 120, key, true)!;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(text)) throw new exHttpInvalidParams(`${key} نامعتبر است`);
    return text;
  };
  const host = nonempty(input.host, 255, 'host', true)!;
  const port = Number(input.port);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new exHttpInvalidParams('port نامعتبر است');
  return {
    host, port, database: identifier('database'), user: identifier('user'),
    passwordEnv: identifier('passwordEnv'), table: identifier('table'),
    idColumn: identifier('idColumn'), subjectColumn: identifier('subjectColumn'),
    bodyColumn: identifier('bodyColumn'),
    numberColumn: input.numberColumn ? identifier('numberColumn') : null,
    dateColumn: input.dateColumn ? identifier('dateColumn') : null,
    senderColumn: input.senderColumn ? identifier('senderColumn') : null,
    recipientColumn: input.recipientColumn ? identifier('recipientColumn') : null,
  };
}

export async function updateSource(auth: IntfAuth, id: number, input: Record<string, unknown>) {
  requireSecretariatAdmin(auth);
  const changes: Record<string, unknown> = {};
  if ('name' in input) changes.srcName = nonempty(input.name, 160, 'نام منبع', true);
  if ('enabled' in input) changes.srcEnabled = Boolean(input.enabled);
  if ('url' in input) {
    changes.srcUrl = validUrl(input.url);
  }
  if ('tokenEnv' in input) {
    const tokenEnv = nonempty(input.tokenEnv, 120, 'نام متغیر توکن');
    if (tokenEnv && !/^[A-Z_][A-Z0-9_]*$/.test(tokenEnv))
      throw new exHttpInvalidParams('نام متغیر توکن نامعتبر است');
    changes.srcTokenEnv = tokenEnv;
  }
  if ('config' in input) changes.srcConfig = JSON.stringify(validDbConfig(input.config));
  const db = await getDB();
  if (!await db('tblSecretariatSources').where({ srcID: id }).update(changes))
    throw new exHttpInvalidParams('منبع یافت نشد');
  return db('tblSecretariatSources').where({ srcID: id }).first();
}

async function saveAndIndex(file: IntfFileMeta, letterID: number, kind: string, digest?: string) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!EXTENSIONS.has(ext)) throw new exHttpInvalidParams('فقط فایل متنی، ورد و PDF متنی پذیرفته می‌شود');
  if (!file.size || file.size > MAX_FILE_SIZE) throw new exHttpInvalidParams('حجم فایل باید حداکثر ۲۰ مگابایت باشد');
  const key = randomUUID();
  const stored = path.join(STORAGE, key + ext);
  await mkdir(STORAGE, { recursive: true });
  await copyFile(file.path, stored);
  try {
    const { totalContent, totalPoints: indexedPoints } = await file2DB(
      { ...file, path: stored }, key,
      chunks => vectorDB().addFileText(COLLECTION, key, file.originalname, chunks),
    );
    let totalPoints = indexedPoints;
    if (!totalPoints && (ext === '.txt' || ext === '.md') && totalContent >= 10) {
      const text = (await readFile(stored, 'utf8')).trim();
      totalPoints = await vectorDB().addFileText(COLLECTION, key, file.originalname,
        [{ text, meta: { fileKey: key } }]);
    }
    if (totalContent < 10 || !totalPoints)
      throw new exHttpInvalidParams(ext === '.pdf' ? 'PDF تصویری یا بدون متن قابل استخراج است' : 'متن کافی از فایل استخراج نشد');
    await (await getDB())('tblSecretariatFiles').insert({
      sflLetter_ltrID: letterID, sflKey: key, sflName: file.originalname.slice(0, 255),
      sflKind: kind, sflPath: stored, sflSize: file.size, sflChunks: totalPoints,
      sflDigest: digest || null,
    });
  } catch (error) {
    await vectorDB().deleteFileChunks(COLLECTION, key).catch(() => undefined);
    await rm(stored, { force: true });
    throw error;
  }
}

export async function indexDemoLetters() {
  const db = await getDB();
  const letters = await db('tblSecretariatLetters')
    .where('ltrExternalID', 'like', 'secretariat-demo-%')
    .where({ ltrStatus: 'ready' }).orderBy('ltrID');
  let indexed = 0;
  for (const letter of letters) {
    if (!letter.ltrBody) continue;
    const existing = await db('tblSecretariatFiles')
      .where({ sflLetter_ltrID: letter.ltrID, sflKind: 'body' }).first('sflID');
    if (existing) continue;
    const temp = path.join(STORAGE, `${letter.ltrKey}.demo.txt`);
    const text = `${letter.ltrSubject}\n${letter.ltrBody}`;
    await mkdir(STORAGE, { recursive: true });
    await writeFile(temp, text, 'utf8');
    try {
      await saveAndIndex({ path: temp, originalname: `نامه-${letter.ltrNumber || letter.ltrID}.txt`,
        mimetype: 'text/plain', size: Buffer.byteLength(text) }, letter.ltrID, 'body');
      indexed++;
    } finally {
      await rm(temp, { force: true });
    }
  }
  return { total: letters.length, indexed };
}

export async function createLetter(auth: IntfAuth, input: LetterInput, files: IntfFileMeta[], sourceID?: number,
  options: { publish?: boolean; fileDigests?: string[]; confidential?: boolean; indexBody?: boolean } = {}) {
  requireSecretariatOperator(auth);
  const subject = nonempty(input.subject, 500, 'موضوع', true)!;
  const body = nonempty(input.body, 1000000, 'متن نامه');
  if (!body && !files.length) throw new exHttpInvalidParams('متن یا فایل نامه الزامی است');
  if (files.length > 20) throw new exHttpInvalidParams('حداکثر ۲۰ فایل برای هر نامه پذیرفته می‌شود');
  const externalId = nonempty(input.externalId, 255, 'شناسه خارجی');
  const db = await getDB();
  if (sourceID && externalId && await db('tblSecretariatLetters').where({ ltrSource_srcID: sourceID, ltrExternalID: externalId }).first())
    throw new exHttpConflict('این نامه قبلا وارد شده است');
  const key = randomUUID();
  await db('tblSecretariatLetters').insert({
    ltrKey: key, ltrSource_srcID: sourceID || null, ltrExternalID: externalId,
    ltrSubject: subject, ltrNumber: nonempty(input.number, 120, 'شماره نامه'),
    ltrSender: nonempty(input.sender, 255, 'فرستنده'), ltrRecipient: nonempty(input.recipient, 255, 'گیرنده'),
    ltrLetterDate: nonempty(input.letterDate, 40, 'تاریخ نامه'), ltrBody: body,
    ltrStatus: 'indexing', ltrConfidential: Boolean(options.confidential),
    ltrCreatedBy_usrID: sourceID ? null : auth.uid,
  });
  const letter = await db('tblSecretariatLetters').where({ ltrKey: key }).first();
  try {
    if (body && options.indexBody !== false) {
      const temp = path.join(STORAGE, `${key}.txt`);
      await mkdir(STORAGE, { recursive: true });
      await writeFile(temp, `${subject}\n${body}`, 'utf8');
      try {
        await saveAndIndex({ path: temp, originalname: `${subject.slice(0, 100)}.txt`, mimetype: 'text/plain', size: Buffer.byteLength(`${subject}\n${body}`) }, letter.ltrID, 'body');
      } finally {
        await rm(temp, { force: true });
      }
    }
    for (let i = 0; i < files.length; i++)
      await saveAndIndex(files[i]!, letter.ltrID, i === 0 && !body ? 'letter' : 'attachment', options.fileDigests?.[i]);
    await db('tblSecretariatLetters').where({ ltrID: letter.ltrID })
      .update({ ltrStatus: options.publish === false ? 'staged' : 'ready' });
    return db('tblSecretariatLetters').where({ ltrID: letter.ltrID }).first();
  } catch (error) {
    await removeLetter(letter.ltrID);
    throw error;
  }
}

async function removeLetter(letterID: number) {
  const db = await getDB();
  const saved = await db('tblSecretariatFiles').where({ sflLetter_ltrID: letterID });
  for (const item of saved) {
    await vectorDB().deleteFileChunks(COLLECTION, item.sflKey).catch(() => undefined);
    await rm(item.sflPath, { force: true });
  }
  await db('tblSecretariatLetters').where({ ltrID: letterID }).delete();
}

async function fileDigest(filePath: string) {
  const hash = createHash('sha256');
  for await (const part of createReadStream(filePath)) hash.update(part);
  return hash.digest('hex');
}

function originalFileName(name: string) {
  const normalized = /[\u00c0-\u00ff]/.test(name) && !/[\u0600-\u06ff]/.test(name)
    ? Buffer.from(name, 'latin1').toString('utf8') : name;
  return path.basename(normalized).slice(0, 255);
}

async function randomLetterNumber(db: Awaited<ReturnType<typeof getDB>>, used: Set<string>) {
  for (let i = 0; i < 100; i++) {
    const digits = String(randomInt(10000, 100000)).replace(/[0-9]/g, digit => PERSIAN_DIGITS[Number(digit)]!);
    const number = `الف/${digits}`;
    if (!used.has(number) && !await db('tblSecretariatLetters').where({ ltrNumber: number }).first('ltrID')) {
      used.add(number);
      return number;
    }
  }
  throw new exHttpConflict('شماره نامهٔ یکتا تولید نشد');
}

function randomPersonName() {
  return `${FIRST_NAMES[randomInt(FIRST_NAMES.length)]} ${LAST_NAMES[randomInt(LAST_NAMES.length)]}`;
}

function randomJalaliDate() {
  const selected = new Date(Date.now() - randomInt(180) * 24 * 60 * 60 * 1000);
  const parts = Object.fromEntries(JALALI_FORMAT.formatToParts(selected).map(part => [part.type, part.value]));
  return `${parts.year}/${parts.month}/${parts.day}`
    .replace(/[0-9]/g, digit => PERSIAN_DIGITS[Number(digit)]!);
}

export async function uploadWizard(auth: IntfAuth, files: IntfFileMeta[]) {
  requireSecretariatAdmin(auth);
  if (!files.length || files.length > 50) throw new exHttpInvalidParams('بین ۱ تا ۵۰ فایل انتخاب کنید');
  const db = await getDB();
  const candidates: Array<{ file: IntfFileMeta; name: string; digest: string }> = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  const legacyFiles = await db('tblSecretariatFiles').whereNull('sflDigest')
    .whereIn('sflSize', [...new Set(files.map(file => file.size))]).select('sflPath');
  const legacyDigests = new Set<string>();
  for (const item of legacyFiles) {
    try { legacyDigests.add(await fileDigest(item.sflPath)); }
    catch (error) { logger.warn({ secretariatLegacyFile: item.sflPath, error }); }
  }
  for (const file of files) {
    const name = originalFileName(file.originalname);
    if (!EXTENSIONS.has(path.extname(name).toLowerCase()) || !file.size || file.size > MAX_FILE_SIZE)
      throw new exHttpInvalidParams(`نوع یا حجم فایل ${name} پشتیبانی نمی‌شود`);
    const digest = await fileDigest(file.path);
    if (seen.has(digest) || legacyDigests.has(digest)
      || await db('tblSecretariatFiles').where({ sflDigest: digest }).first('sflID')) {
      skipped.push(name);
      continue;
    }
    seen.add(digest);
    candidates.push({ file, name, digest });
  }
  const created: Array<{ id: number; key: string; number: string; fileName: string; confidential: boolean }> = [];
  const errors: Array<{ fileName: string; message: string }> = [];
  const used = new Set<string>();
  for (const candidate of candidates) {
    try {
      const number = await randomLetterNumber(db, used);
      const sender = randomPersonName();
      let recipient = randomPersonName();
      while (recipient === sender) recipient = randomPersonName();
      const letter = await createLetter(auth, {
        subject: `نامه مربوط به فایل ${candidate.name}`, number, body: WIZARD_BODY,
        sender, recipient, letterDate: randomJalaliDate(),
        externalId: `secretariat-wizard-${randomUUID()}`,
      }, [{ ...candidate.file, originalname: candidate.name }], undefined,
      { publish: false, indexBody: false, fileDigests: [candidate.digest] });
      created.push({ id: letter.ltrID, key: letter.ltrKey, number, fileName: candidate.name, confidential: false });
    } catch (error) {
      if (await db('tblSecretariatFiles').where({ sflDigest: candidate.digest }).first('sflID')) skipped.push(candidate.name);
      else errors.push({ fileName: candidate.name, message: (error as Error).message });
    }
  }
  const order = created.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const confidential = new Set(order.slice(0, Math.floor(created.length / 10)));
  try {
    await db.transaction(async trx => {
      for (const [index, item] of created.entries()) {
        item.confidential = confidential.has(index);
        await trx('tblSecretariatLetters').where({ ltrID: item.id })
          .update({ ltrConfidential: item.confidential, ltrStatus: 'ready' });
      }
    });
  } catch (error) {
    for (const item of created) await removeLetter(item.id);
    throw error;
  }
  return { created: created.map(({ key, number, fileName, confidential }) => ({ key, number, fileName, confidential })),
    skipped, errors };
}

export async function listAdminLetters(auth: IntfAuth, limit = 50, offset = 0, wizardOnly = false) {
  requireSecretariatAdmin(auth);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100
    || !Number.isSafeInteger(offset) || offset < 0)
    throw new exHttpInvalidParams('محدودهٔ فهرست نامعتبر است');
  const db = await getDB();
  const base = db('tblSecretariatLetters').whereIn('ltrStatus', ['ready', 'deleting']);
  if (wizardOnly) base.where('ltrExternalID', 'like', 'secretariat-wizard-%');
  const count = await base.clone().count({ total: 'ltrID' }).first();
  const letters = await base.clone()
    .select('ltrID', 'ltrKey', 'ltrNumber', 'ltrSubject', 'ltrConfidential', 'ltrCreatedAt',
      'ltrLetterDate', 'ltrSender', 'ltrRecipient', 'ltrStatus')
    .orderBy('ltrID', 'desc').limit(limit).offset(offset);
  const files = letters.length ? await db('tblSecretariatFiles')
    .whereIn('sflLetter_ltrID', letters.map(letter => letter.ltrID))
    .whereNot('sflKind', 'body')
    .select('sflLetter_ltrID', 'sflKey', 'sflName', 'sflKind') : [];
  return {
    total: Number(count?.total || 0),
    letters: letters.map(({ ltrID, ...letter }) => ({ ...letter,
      attachments: files.filter(file => Number(file.sflLetter_ltrID) === Number(ltrID))
        .map(({ sflKey, sflName, sflKind }) => ({
          key: letter.ltrConfidential || letter.ltrStatus === 'deleting' ? null : sflKey, name: sflName, kind: sflKind,
        })),
    })),
  };
}

export async function listWizardLetters(auth: IntfAuth, limit = 50, offset = 0) {
  return listAdminLetters(auth, limit, offset, true);
}

export async function setLetterConfidentiality(auth: IntfAuth, key: string, confidential: unknown) {
  requireSecretariatAdmin(auth);
  if (typeof confidential !== 'boolean') throw new exHttpInvalidParams('وضعیت محرمانگی باید درست یا نادرست باشد');
  const db = await getDB();
  const letter = await db('tblSecretariatLetters').where({ ltrKey: key }).first('ltrID', 'ltrStatus');
  if (!letter) throw new exHttpInvalidParams('نامه یافت نشد');
  if (letter.ltrStatus !== 'ready') throw new exHttpConflict('تغییر محرمانگی نامه در حال پردازش یا حذف مجاز نیست');
  const updated = await db('tblSecretariatLetters').where({ ltrID: letter.ltrID, ltrStatus: 'ready' })
    .update({ ltrConfidential: confidential });
  if (!updated && !await db('tblSecretariatLetters')
    .where({ ltrID: letter.ltrID, ltrStatus: 'ready', ltrConfidential: confidential }).first('ltrID'))
    throw new exHttpConflict('وضعیت نامه تغییر کرده است؛ فهرست را دوباره بارگذاری کنید');
  return { key, confidential };
}

export async function deleteLetter(auth: IntfAuth, key: string) {
  requireSecretariatAdmin(auth);
  const db = await getDB();
  const letter = await db('tblSecretariatLetters').where({ ltrKey: key }).first();
  if (!letter) throw new exHttpInvalidParams('نامه یافت نشد');
  if (!['ready', 'deleting'].includes(letter.ltrStatus))
    throw new exHttpConflict('نمایه‌سازی نامه در حال انجام است؛ پس از پایان دوباره تلاش کنید');
  await db('tblSecretariatLetters').where({ ltrID: letter.ltrID }).update({ ltrStatus: 'deleting' });
  const files = await db('tblSecretariatFiles').where({ sflLetter_ltrID: letter.ltrID });
  // Keep the rows until every external resource is removed, so a failed deletion can be retried.
  for (const file of files) {
    await vectorDB().deleteFileChunks(COLLECTION, file.sflKey);
    await rm(file.sflPath, { force: true });
  }
  await db('tblSecretariatLetters').where({ ltrID: letter.ltrID }).delete();
  return { deleted: true };
}

export async function listLetters(auth: IntfAuth, limit = 50) {
  if (!auth.uid) throw new exHttpAccessDenied('ورود به سامانه الزامی است');
  const letters = await (await getDB())('tblSecretariatLetters').where({ ltrStatus: 'ready' })
    .select('ltrKey', 'ltrNumber', 'ltrSubject', 'ltrSender', 'ltrRecipient', 'ltrLetterDate', 'ltrCreatedAt', 'ltrConfidential')
    .orderBy('ltrID', 'desc').limit(Math.min(Math.max(limit, 1), 100));
  return letters.map(redactLetter);
}

function redactLetter<T extends Record<string, unknown>>(letter: T): T | Record<string, unknown> {
  if (!letter.ltrConfidential) return letter;
  return { ltrKey: letter.ltrKey, ltrNumber: letter.ltrNumber,
    ltrLetterDate: letter.ltrLetterDate ?? null, ltrConfidential: true };
}

function redactSearch<T extends Record<string, unknown>>(letter: T) {
  return redactLetter(letter);
}

export async function getLetter(auth: IntfAuth, key: string) {
  if (!auth.uid) throw new exHttpAccessDenied('ورود به سامانه الزامی است');
  const db = await getDB();
  const letter = await db('tblSecretariatLetters').where({ ltrKey: key, ltrStatus: 'ready' }).first();
  if (!letter) throw new exHttpInvalidParams('نامه یافت نشد');
  if (letter.ltrConfidential) return { letter: redactLetter(letter), files: [] };
  const files = await db('tblSecretariatFiles').where({ sflLetter_ltrID: letter.ltrID })
    .select('sflKey', 'sflName', 'sflKind', 'sflSize');
  return { letter, files };
}

export async function getLetterFile(auth: IntfAuth, letterKey: string, fileKey: string) {
  const { letter } = await getLetter(auth, letterKey);
  if (letter.ltrConfidential) throw new exHttpAccessDenied('دریافت فایل نامهٔ محرمانه مجاز نیست');
  const file = await (await getDB())('tblSecretariatFiles')
    .where({ sflLetter_ltrID: letter.ltrID, sflKey: fileKey }).first();
  if (!file) throw new exHttpInvalidParams('فایل یافت نشد');
  return file;
}

async function findLiteralAttachmentChunks(tokens: string[]) {
  const points = new Map<string, { file_id: string; text: string }>();
  let offset: unknown;
  do {
    const response = await fetch(`${configManager.active().RAGDB.url}/collections/${COLLECTION}/points/scroll`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ limit: 100, offset, with_payload: true, with_vector: false,
        filter: { should: [{ must: tokens.map(token => ({ should: [...new Set([
          token, token.replace(/ی/g, 'ي').replace(/ک/g, 'ك'),
        ])].map(text => ({ key: 'text', match: { text } })) })) },
        { key: 'secretariat_search_compact', match: { text: tokens.join('') } }] },
      }),
    });
    if (response.status === 404) return [...points.values()];
    if (!response.ok) throw new Error(`خطای جست‌وجوی متنی پیوست: ${response.status}`);
    const data = await response.json();
    for (const point of data.result?.points || []) {
      const payload = point.payload;
      if (payload?.file_id && !points.has(String(payload.file_id)) && containsSearchTokens(payload.text, tokens))
        points.set(String(payload.file_id), { file_id: String(payload.file_id), text: String(payload.text) });
    }
    offset = data.result?.next_page_offset;
  } while (offset != null);
  return [...points.values()];
}

export async function searchLetters(auth: IntfAuth, query: string, minScore = 86) {
  if (!auth.uid) throw new exHttpAccessDenied('ورود به سامانه الزامی است');
  if (!query.trim() || query.length > 500) throw new exHttpInvalidParams('عبارت جستجو نامعتبر است');
  if (!Number.isInteger(minScore) || minScore < 30 || minScore > 90)
    throw new exHttpInvalidParams('حداقل امتیاز ارتباط باید بین ۳۰ تا ۹۰ باشد');
  const minSimilarity = minScore / 100;
  const db = await getDB();
  const term = query.trim();
  const normalizedTerm = normalizeSearchText(term);
  const tokens = [...new Set(searchTokens(term))];
  const fields = ['ltrNumber', 'ltrSubject', 'ltrSender', 'ltrRecipient', 'ltrBody'];
  const literal = tokens.length ? await db('tblSecretariatLetters').where({ ltrStatus: 'ready' })
    .andWhere(builder => {
      for (const field of fields) builder.orWhere(inner => {
        let column = db.raw('LOWER(??)', [field]);
        const replacements = [['ي', 'ی'], ['ى', 'ی'], ['ك', 'ک'], ['\u200c', ' '], ['\u200d', ' '],
          ...Array.from(PERSIAN_DIGITS, (digit, index) => [digit, String(index)]),
          ...Array.from('٠١٢٣٤٥٦٧٨٩', (digit, index) => [digit, String(index)])];
        for (const [from, to] of replacements) column = db.raw('REPLACE(?, ?, ?)', [column, from!, to!]);
        if (field === 'ltrBody') inner.where(group => group.whereNot('ltrExternalID', 'like', 'secretariat-wizard-%').orWhereNull('ltrExternalID'));
        inner.andWhere(matches => matches.where(group => {
          for (const token of tokens) group.whereRaw("? LIKE ? ESCAPE '!'", [column,
            `%${token.replace(/[!%_]/g, char => '!' + char)}%`]);
        }).orWhereRaw("REPLACE(?, ' ', '') LIKE ? ESCAPE '!'", [column,
          `%${tokens.join('').replace(/[!%_]/g, char => '!' + char)}%`]));
      });
    })
    .select('ltrKey', 'ltrNumber', 'ltrSubject', 'ltrSender', 'ltrRecipient', 'ltrBody', 'ltrLetterDate', 'ltrConfidential', 'ltrExternalID')
    .orderBy('ltrID', 'desc') : [];
  const lexical = new Map<string, Record<string, any>>();
  for (const { ltrBody, ltrExternalID, ...letter } of literal) {
    let priority = 0;
    if (compactSearchText(letter.ltrNumber) === compactSearchText(normalizedTerm)) priority = 6;
    else if (compactSearchText(letter.ltrSubject) === compactSearchText(normalizedTerm)) priority = 5;
    else if (containsSearchTokens(letter.ltrSubject, tokens)) priority = 4;
    else if (containsSearchTokens(letter.ltrSender, tokens) || containsSearchTokens(letter.ltrRecipient, tokens)) priority = 3;
    else if (!String(ltrExternalID || '').startsWith('secretariat-wizard-') && containsSearchTokens(ltrBody, tokens)) priority = 2;
    // Every lexical candidate must match all query tokens; this measures token coverage,
    // independently of lexical priority and semantic cosine similarity.
    if (priority) lexical.set(letter.ltrKey, { ...letter, lexicalPriority: priority, lexicalScore: 1,
      ...(priority === 2 ? { excerpt: String(ltrBody || '').slice(0, 500) } : {}) });
  }
  const excludedBodies = await db('tblSecretariatFiles')
    .join('tblSecretariatLetters', 'ltrID', 'sflLetter_ltrID')
    .where('sflKind', 'body').where('ltrExternalID', 'like', 'secretariat-wizard-%').pluck('sflKey');
  try {
    const textChunks = tokens.length ? await findLiteralAttachmentChunks(tokens) : [];
    const files = textChunks.length ? await db('tblSecretariatFiles')
      .whereIn('sflKey', [...new Set(textChunks.map(chunk => chunk.file_id))]).whereNotIn('sflKey', excludedBodies)
      .join('tblSecretariatLetters', 'ltrID', 'sflLetter_ltrID').where('ltrStatus', 'ready')
      .select('sflKey', 'ltrKey', 'ltrNumber', 'ltrSubject', 'ltrSender', 'ltrRecipient', 'ltrLetterDate', 'ltrConfidential') : [];
    const byFile = new Map(files.map(file => [file.sflKey, file]));
    for (const chunk of textChunks) {
      const file = byFile.get(chunk.file_id);
      if (file && !lexical.has(file.ltrKey)) lexical.set(file.ltrKey,
        { ...file, lexicalPriority: 1, lexicalScore: 1, excerpt: chunk.text.slice(0, 500) });
    }
  } catch (error) { logger.warn({ secretariatTextSearch: error }); }
  const semantic = new Map<string, Record<string, any>>();
  try {
    const chunks = await retrieveSecretariatFiles(term, minSimilarity, excludedBodies.length
      ? { must_not: [{ key: 'file_id', match: { any: excludedBodies } }] } : undefined);
    const files = chunks.length ? await db('tblSecretariatFiles').whereIn('sflKey', chunks.map(chunk => chunk.file_id))
      .join('tblSecretariatLetters', 'ltrID', 'sflLetter_ltrID').where('ltrStatus', 'ready')
      .select('sflKey', 'ltrKey', 'ltrNumber', 'ltrSubject', 'ltrSender', 'ltrRecipient', 'ltrLetterDate', 'ltrConfidential') : [];
    const byFile = new Map(files.map(file => [file.sflKey, file]));
    for (const chunk of chunks) {
      const file = byFile.get(chunk.file_id);
      if (file && chunk.semanticScore > (semantic.get(file.ltrKey)?.semanticScore ?? -Infinity))
        semantic.set(file.ltrKey, { ...file, semanticScore: chunk.semanticScore, excerpt: chunk.text.slice(0, 500) });
    }
    logger.debug({ secretariatRetrieval: { threshold: minSimilarity,
      scores: chunks.map(chunk => chunk.semanticScore) } });
  } catch (error) { logger.warn({ secretariatSearch: error }); }
  const lexicalRanking = [...lexical.values()].sort((a, b) => b.lexicalPriority - a.lexicalPriority || a.ltrKey.localeCompare(b.ltrKey));
  const semanticRanking = [...semantic.values()].sort((a, b) => b.semanticScore - a.semanticScore || a.ltrKey.localeCompare(b.ltrKey));
  return fuseSecretariatRankings(lexicalRanking, semanticRanking).slice(0, 20)
    .map(({ lexicalPriority, ...letter }) => redactSearch(letter));
}

export async function syncSource(auth: IntfAuth, id: number) {
  requireSecretariatAdmin(auth);
  const db = await getDB();
  const source = await db('tblSecretariatSources').where({ srcID: id }).first();
  if (!source || !source.srcEnabled) throw new exHttpInvalidParams('منبع فعال یافت نشد');
  if (source.srcKind !== 'rest') return syncDatabaseSource(auth, source);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (source.srcTokenEnv) {
    const token = process.env[source.srcTokenEnv];
    if (!token) throw new exHttpInvalidParams('متغیر محیطی توکن منبع تنظیم نشده است');
    headers.Authorization = `Bearer ${token}`;
  }
  const url = new URL(source.srcUrl);
  if (source.srcCursor) url.searchParams.set('cursor', source.srcCursor);
  const response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`خطای منبع دبیرخانه: ${response.status}`);
  const data = await readLimitedJson(response) as { items?: Array<LetterInput & { attachments?: Array<{ name: string; contentBase64: string }> }>; nextCursor?: string };
  if (!Array.isArray(data.items) || data.items.length > 100) throw new exHttpInvalidParams('پاسخ منبع باید حداکثر ۱۰۰ نامه داشته باشد');
  const nextCursor = data.nextCursor == null ? null : nonempty(data.nextCursor, 255, 'نشانگر همگام‌سازی', true);
  let imported = 0, skipped = 0;
  for (const item of data.items) {
    const externalId = nonempty(item.externalId, 255, 'شناسه خارجی', true)!;
    if (await db('tblSecretariatLetters').where({ ltrSource_srcID: id, ltrExternalID: externalId }).first()) { skipped++; continue; }
    const files: IntfFileMeta[] = [];
    try {
      for (const attachment of item.attachments || []) {
        const name = nonempty(attachment.name, 255, 'نام پیوست', true)!;
        if (!EXTENSIONS.has(path.extname(name).toLowerCase())) throw new exHttpInvalidParams('نوع پیوست پشتیبانی نمی‌شود');
        if (typeof attachment.contentBase64 !== 'string' || attachment.contentBase64.length > MAX_FILE_SIZE * 1.4
          || !/^[A-Za-z0-9+/]*={0,2}$/.test(attachment.contentBase64))
          throw new exHttpInvalidParams('محتوای پیوست نامعتبر است');
        const buffer = Buffer.from(attachment.contentBase64, 'base64');
        if (!buffer.length || buffer.length > MAX_FILE_SIZE) throw new exHttpInvalidParams('حجم پیوست نامعتبر است');
        const temp = path.join(STORAGE, randomUUID());
        await mkdir(STORAGE, { recursive: true });
        await writeFile(temp, buffer);
        files.push({ originalname: name, path: temp, size: buffer.length, mimetype: '' });
      }
      await createLetter(auth, item, files, id);
      imported++;
    } finally {
      await Promise.all(files.map(file => rm(file.path, { force: true })));
    }
  }
  await db('tblSecretariatSources').where({ srcID: id }).update({ srcCursor: nextCursor || source.srcCursor,
    srcLastSyncAt: new Date() });
  return { imported, skipped, nextCursor };
}

async function readLimitedJson(response: globalThis.Response) {
  if (!response.body) throw new exHttpInvalidParams('پاسخ منبع خالی است');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 50 * 1024 * 1024) throw new exHttpInvalidParams('پاسخ منبع بیش از ۵۰ مگابایت است');
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new exHttpInvalidParams('JSON منبع نامعتبر است'); }
}

async function syncDatabaseSource(auth: IntfAuth, source: Record<string, any>) {
  const config = validDbConfig(JSON.parse(source.srcConfig));
  const password = process.env[config.passwordEnv];
  if (!password) throw new exHttpInvalidParams('متغیر محیطی رمز پایگاه داده تنظیم نشده است');
  const client = ({ pgsql: 'pg', mysql: 'mysql2', mssql: 'mssql' } as Record<string, string>)[source.srcKind];
  if (!client) throw new exHttpInvalidParams('نوع پایگاه داده پشتیبانی نمی‌شود');
  const external = knex({
    client,
    connection: { host: config.host, port: config.port, database: config.database, user: config.user,
      password, ...(source.srcKind === 'mssql' ? { options: { encrypt: true, trustServerCertificate: false } } : {}) },
    pool: { min: 0, max: 2 }, acquireConnectionTimeout: 15000,
  });
  try {
    const columns = [config.idColumn, config.subjectColumn, config.bodyColumn, config.numberColumn,
      config.dateColumn, config.senderColumn, config.recipientColumn].filter(Boolean) as string[];
    let query = external(config.table).select(columns).orderBy(config.idColumn).limit(100);
    if (source.srcCursor) query = query.where(config.idColumn, '>', source.srcCursor);
    const rows = await query;
    const db = await getDB();
    let imported = 0, skipped = 0;
    let cursor = source.srcCursor;
    for (const row of rows) {
      const externalId = String(row[config.idColumn]);
      if (await db('tblSecretariatLetters').where({ ltrSource_srcID: source.srcID, ltrExternalID: externalId }).first()) skipped++;
      else {
        await createLetter(auth, {
          externalId, subject: String(row[config.subjectColumn] || ''),
          body: config.bodyColumn ? String(row[config.bodyColumn] || '') : null,
          number: config.numberColumn ? String(row[config.numberColumn] || '') : null,
          letterDate: config.dateColumn ? row[config.dateColumn] instanceof Date
            ? row[config.dateColumn].toISOString().slice(0, 10)
            : String(row[config.dateColumn] || '') : null,
          sender: config.senderColumn ? String(row[config.senderColumn] || '') : null,
          recipient: config.recipientColumn ? String(row[config.recipientColumn] || '') : null,
        }, [], source.srcID);
        imported++;
      }
      cursor = externalId;
      await db('tblSecretariatSources').where({ srcID: source.srcID }).update({ srcCursor: cursor, srcLastSyncAt: new Date() });
    }
    return { imported, skipped, nextCursor: cursor };
  } finally {
    await external.destroy();
  }
}

let synchronizing = false;
export function startSecretariatSync() {
  const run = async () => {
    if (synchronizing) return;
    synchronizing = true;
    try {
      const sources = await (await getDB())('tblSecretariatSources').where({ srcEnabled: true }).select('srcID');
      const system: IntfAuth = { uid: 0, key: 'secretariat-sync', name: 'Secretariat sync',
        privs: { services: {}, isAdmin: true } };
      for (const source of sources) {
        try { await syncSource(system, source.srcID); }
        catch (error) { logger.error({ secretariatSource: source.srcID, error }); }
      }
    } catch (error) {
      logger.error({ secretariatSync: error });
    } finally {
      synchronizing = false;
    }
  };
  const timer = setInterval(() => { void run(); }, 15 * 60 * 1000);
  timer.unref();
  setTimeout(() => { void run(); }, 30 * 1000).unref();
}

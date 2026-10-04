import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { loadConfiguration, loadLegacyMysqlSource } from '../../../../packages/configuration/src/index.js';
import { createTargetPool, withTargetTransaction } from '../../../../packages/persistence/src/target.js';
import { dictionaryInventory, dictionaryRow, upsertDictionaryBatch, type intfDictionaryRow } from '../persistence.js';

interface intfMysqlDictionaryRow {
  readonly dicID: number; readonly dicWord: string; readonly dicTranslation: string | null;
  readonly dicSynonyms: string | null; readonly dicAntonyms: string | null; readonly dicRelExp: string | null;
  readonly dicRelWord: string | null; readonly dicPronunciation: string | null; readonly dicExamples: string | null; readonly dicExtra: string | null;
}
function option(name: string, fallback: string): string { const at = process.argv.indexOf(name); if (at < 0) return fallback; const value=process.argv[at+1]; if (!value) throw new Error(`${name} requires a value`); return value; }
function parseLegacy(value: string | null): unknown { if (!value) return null; try { return JSON.parse(value) as unknown; } catch { return null; } }
function mysqlRow(row: intfMysqlDictionaryRow): intfDictionaryRow {
  const translations = parseLegacy(row.dicTranslation);
  const payload = { translations: Array.isArray(translations) ? translations : [], synonyms: parseLegacy(row.dicSynonyms), antonyms: parseLegacy(row.dicAntonyms), relExp: parseLegacy(row.dicRelExp), relWords: parseLegacy(row.dicRelWord), pronunciations: parseLegacy(row.dicPronunciation), examples: parseLegacy(row.dicExamples), extra: parseLegacy(row.dicExtra) };
  return dictionaryRow('MYSQL', String(row.dicID), row.dicWord, payload);
}
function jsonRows(raw: unknown): { rows: intfDictionaryRow[]; skippedInvalidKeys: number } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('INVALID_JSON_DICTIONARY');
  const result: intfDictionaryRow[] = []; let skippedInvalidKeys = 0;
  for (const [phrase, value] of Object.entries(raw)) {
    if (!phrase.trim()) { skippedInvalidKeys += 1; continue; }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_JSON_DICTIONARY_ENTRY');
    const x = value as Record<string, unknown>;
    if (!Array.isArray(x.translations) || x.translations.some(v => typeof v !== 'string')) throw new Error('INVALID_JSON_DICTIONARY_TRANSLATIONS');
    result.push(dictionaryRow('JSON_FILE', phrase, phrase, { translations: x.translations, synonyms: x.synonyms ?? null, antonyms: x.antonyms ?? null, relWords: x['related words'] ?? null, pronunciations: x.pronunciations ?? null }));
  }
  return { rows: result.sort((a, b) => a.sourceKey.localeCompare(b.sourceKey)), skippedInvalidKeys };
}
function compare(expected: readonly intfDictionaryRow[], actual: readonly { sourceKey: string; sourceSha256: string }[]) {
  const expectedMap = new Map(expected.map(row => [row.sourceKey, row.sourceSha256]));
  const actualMap = new Map(actual.map(row => [row.sourceKey, row.sourceSha256]));
  let missing = 0, extra = 0, mismatch = 0;
  for (const [key, sha] of expectedMap) if (!actualMap.has(key)) missing += 1; else if (actualMap.get(key) !== sha) mismatch += 1;
  for (const key of actualMap.keys()) if (!expectedMap.has(key)) extra += 1;
  return { sourceRows: expected.length, targetRows: actual.length, missing, extra, mismatch, duplicateKeys: expected.length - expectedMap.size };
}

const configPath = option('--config', '/etc/targoman/platform.cjson');
const legacyPath = option('--legacy-config', '.config.json');
const jsonPath = option('--json-source', 'src/db/data/multi-dic.json');
const secretRoot = option('--secrets-dir', '/run/secrets');
const dryRun = process.argv.includes('--dry-run');
const jsonOnly = process.argv.includes('--json-only');
const jsonBytes = await readFile(jsonPath);
const jsonSha256 = createHash('sha256').update(jsonBytes).digest('hex');
const jsonSource = jsonRows(JSON.parse(jsonBytes.toString('utf8')) as unknown);
const fromJson = jsonSource.rows;
const snapshot = await loadConfiguration(configPath);
const target = await createTargetPool(snapshot, 'migration', secretRoot);
try {
  const fromMysql: intfDictionaryRow[] = [];
  if (!jsonOnly) {
    const legacyConfig = await loadLegacyMysqlSource(legacyPath);
    const source = await mysql.createConnection({ ...legacyConfig, connectTimeout: 5000 });
    try {
      await source.query('SET TRANSACTION READ ONLY');
      await source.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
      const [countRows] = await source.query('SELECT COUNT(*) AS count FROM tblMultiDic');
      const mysqlCount = Number((countRows as { count: number }[])[0]?.count ?? NaN);
      if (!Number.isSafeInteger(mysqlCount)) throw new Error('INVALID_MYSQL_SOURCE_COUNT');
      let afterId = 0;
      while (true) {
        const [rows] = await source.query(`SELECT dicID, dicWord, dicTranslation, dicSynonyms, dicAntonyms, dicRelExp,
          dicRelWord, dicPronunciation, dicExamples, dicExtra FROM tblMultiDic
          WHERE dicID > ? ORDER BY dicID LIMIT 500`, [afterId]);
        const page = rows as unknown as intfMysqlDictionaryRow[];
        if (!page.length) break;
        fromMysql.push(...page.map(mysqlRow));
        afterId = page[page.length - 1]!.dicID;
      }
      if (fromMysql.length !== mysqlCount) throw new Error('MYSQL_SOURCE_CHANGED_DURING_SNAPSHOT');
      await source.query('ROLLBACK');
    } finally { await source.end(); }
  }
  if (!dryRun) {
    for (const [kind, rows] of [['JSON_FILE', fromJson], ['MYSQL', fromMysql]] as const) {
      for (let at = 0; at < rows.length; at += 500) {
        await withTargetTransaction(target, { actorKind: 'SERVICE_ACCOUNT', actorId: 'public-dictionary-migration', correlationId: `${snapshot.fingerprint.slice(0, 16)}-${kind}-${at}`, source: 'migrate:public-tools:mysql-to-pg' }, async tx => upsertDictionaryBatch(tx, rows.slice(at, at + 500)));
      }
    }
  }
  const client = await target.connect();
  try {
    const jsonCheck = compare(fromJson, await dictionaryInventory(client, 'JSON_FILE'));
    const mysqlCheck = compare(fromMysql, await dictionaryInventory(client, 'MYSQL'));
    const result = { mode: dryRun ? 'DRY_RUN' : 'APPLY', jsonSource: { fileSha256: jsonSha256, skippedInvalidKeys: jsonSource.skippedInvalidKeys, ...jsonCheck }, mysqlSource: mysqlCheck };
    console.log(JSON.stringify(result));
    if (!dryRun && (jsonCheck.missing || jsonCheck.extra || jsonCheck.mismatch || jsonCheck.duplicateKeys || mysqlCheck.missing || mysqlCheck.extra || mysqlCheck.mismatch || mysqlCheck.duplicateKeys)) process.exitCode = 2;
  } finally { client.release(); }
} finally { await target.end(); }

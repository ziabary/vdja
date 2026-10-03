import { createHash } from 'node:crypto';
import type { typTargetClient } from '../../../packages/persistence/src/target.js';
import type pg from 'pg';
import type { intfDictionaryResult } from './contracts.js';
import type { intfTranslatorDictionary } from './service.js';

export interface intfDictionaryRow { readonly sourceKind: 'JSON_FILE' | 'MYSQL'; readonly sourceKey: string; readonly lookupKey: string; readonly phrase: string; readonly payload: Readonly<Record<string, unknown>>; readonly sourceSha256: string }
export type { intfDictionaryResult } from './contracts.js';

export function dictionaryRow(sourceKind: 'JSON_FILE' | 'MYSQL', sourceKey: string, phrase: string, payload: Readonly<Record<string, unknown>>): intfDictionaryRow {
  if (!sourceKey.trim() || !phrase.trim() || !Array.isArray(payload.translations) || payload.translations.some(value => typeof value !== 'string')) throw new Error('INVALID_DICTIONARY_ROW');
  return { sourceKind, sourceKey, lookupKey: phrase.trim().toLowerCase(), phrase, payload, sourceSha256: createHash('sha256').update(JSON.stringify([sourceKind, sourceKey, phrase, payload])).digest('hex') };
}

export async function upsertDictionaryBatch(client: typTargetClient, rows: readonly intfDictionaryRow[]): Promise<void> {
  if (!rows.length) return;
  await client.query(`INSERT INTO translator.tbl_trn_dictionary
    (trd_source_kind, trd_source_key, trd_lookup_key, trd_phrase, trd_payload, trd_source_sha256)
    SELECT src.source_kind, src.source_key, src.lookup_key, src.phrase, src.payload, src.source_sha256
    FROM pg_catalog.jsonb_to_recordset($1::jsonb) AS src(source_kind text, source_key text, lookup_key text, phrase text, payload jsonb, source_sha256 char(64))
    ON CONFLICT (trd_source_kind, trd_source_key) DO UPDATE SET
      trd_lookup_key = EXCLUDED.trd_lookup_key,
      trd_phrase = EXCLUDED.trd_phrase,
      trd_payload = EXCLUDED.trd_payload,
      trd_source_sha256 = EXCLUDED.trd_source_sha256,
      trd_updated_at = CURRENT_TIMESTAMP
    WHERE translator.tbl_trn_dictionary.trd_source_sha256 <> EXCLUDED.trd_source_sha256`,
  [JSON.stringify(rows.map(row => ({ source_kind: row.sourceKind, source_key: row.sourceKey, lookup_key: row.lookupKey, phrase: row.phrase, payload: row.payload, source_sha256: row.sourceSha256 })))]);
}

export async function lookupDictionary(client: typTargetClient, phrase: string): Promise<intfDictionaryResult | null> {
  const found = await client.query<{ trd_phrase: string; trd_payload: Record<string, unknown> }>(`SELECT trd_phrase, trd_payload FROM translator.tbl_trn_dictionary
    WHERE trd_lookup_key = $1 ORDER BY CASE trd_source_kind WHEN 'MYSQL' THEN 0 ELSE 1 END, trd_source_key COLLATE "C" LIMIT 1`, [phrase.trim().toLowerCase()]);
  if (!found.rows[0]) return null;
  const { trd_phrase: word, trd_payload: data } = found.rows[0];
  if (!Array.isArray(data.translations)) throw new Error('INVALID_DICTIONARY_PAYLOAD');
  return { phrase: word, translations: data.translations.filter((value): value is string => typeof value === 'string'), synonyms: data.synonyms, antonyms: data.antonyms, relWords: data.relWords, relExp: data.relExp, pronunciations: data.pronunciations, examples: data.examples, extra: data.extra };
}

export async function dictionaryInventory(client: typTargetClient, sourceKind: 'JSON_FILE' | 'MYSQL'): Promise<readonly { sourceKey: string; sourceSha256: string }[]> {
  const result = await client.query<{ trd_source_key: string; trd_source_sha256: string }>('SELECT trd_source_key, trd_source_sha256 FROM translator.tbl_trn_dictionary WHERE trd_source_kind = $1 ORDER BY trd_source_key', [sourceKind]);
  return result.rows.map(row => ({ sourceKey: row.trd_source_key, sourceSha256: row.trd_source_sha256 }));
}

export function createTranslatorDictionaryPersistence(pool: pg.Pool): intfTranslatorDictionary {
  return { async lookup(text) {
    const client = await pool.connect();
    try { return await lookupDictionary(client, text); } finally { client.release(); }
  } };
}

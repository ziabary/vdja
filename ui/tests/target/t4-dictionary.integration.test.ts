import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfiguration } from '../../packages/configuration/src/index.js';
import { createTargetPool } from '../../packages/persistence/src/target.js';
import { lookupDictionary } from '../../modules/translator/src/persistence.js';

test('canonical PostgreSQL dictionary serves خدا from JSON source', { skip: !process.env.T4_PG_CONFIG || !process.env.T4_SECRETS_DIR }, async () => {
  const snapshot = await loadConfiguration(process.env.T4_PG_CONFIG!);
  const pool = await createTargetPool(snapshot, 'api', process.env.T4_SECRETS_DIR);
  const client = await pool.connect();
  try {
    const result = await lookupDictionary(client, ' خدا ');
    assert.ok(result);
    assert.equal(result.phrase, 'خدا');
    assert.ok(result.translations.includes('god'));
    const source = await client.query<{ trd_source_kind: string }>(`SELECT trd_source_kind FROM translator.tbl_trn_dictionary
      WHERE trd_lookup_key = $1 ORDER BY CASE trd_source_kind WHEN 'MYSQL' THEN 0 ELSE 1 END, trd_source_key COLLATE "C" LIMIT 1`, ['خدا']);
    assert.equal(source.rows[0]?.trd_source_kind, 'JSON_FILE');
  } finally { client.release(); await pool.end(); }
});

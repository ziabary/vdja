import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { migrate } from '../../packages/persistence/src/migrate.ts';
import { readiness } from '../../packages/persistence/src/ready.ts';

const secrets = Object.fromEntries(readFileSync('.env.pg.local', 'utf8').split(/\r?\n/).filter(Boolean).map(line => line.split('=')));
const database = `t2_test_${randomBytes(6).toString('hex')}`;
if (!/^t2_test_[0-9a-f]{12}$/.test(database)) throw new Error('Unsafe disposable database name');
const config = { host: '127.0.0.1', port: 55432, database: 'targoman_t2', connectionTimeoutMillis: 3000 };
const admin = new pg.Client({ ...config, user: 't2_bootstrap', password: secrets.T2_BOOTSTRAP_PASSWORD });
let created = false;
async function main(): Promise<void> {
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE ${database} OWNER t2_bootstrap`);
    created = true;
    const setup = new pg.Client({ ...config, database, user: 't2_bootstrap', password: secrets.T2_BOOTSTRAP_PASSWORD });
    await setup.connect();
    try {
      await setup.query('REVOKE ALL ON DATABASE ' + database + ' FROM PUBLIC');
      await setup.query('GRANT CONNECT, CREATE ON DATABASE ' + database + ' TO t2_migration');
      await setup.query('GRANT CONNECT ON DATABASE ' + database + ' TO t2_runtime');
      await setup.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
      await setup.query('CREATE SCHEMA platform AUTHORIZATION t2_migration');
      await setup.query('CREATE SCHEMA audit AUTHORIZATION t2_migration');
      await setup.query('GRANT USAGE ON SCHEMA platform, audit TO t2_runtime');
    } finally { await setup.end(); }
    process.env.T2_PG_DATABASE = database;
    assert.equal(await readiness(), 'SCHEMA_OUTDATED');
    console.log('PASS SCHEMA_OUTDATED_READINESS');
    const migration = new pg.Client({ ...config, database, user: 't2_migration', password: secrets.T2_MIGRATION_PASSWORD });
    await migration.connect();
    try {
      await migration.query('CREATE TABLE audit.tbl_aud_mutation (test_value integer)');
      await assert.rejects(migrate());
      const state = await migration.query("SELECT to_regclass('platform.tbl_plt_migration') AS metadata");
      assert.equal(state.rows[0].metadata, null);
      await migration.query('DROP TABLE audit.tbl_aud_mutation');
      console.log('PASS FAILED_MIGRATION_ROLLBACK');
      const [first, second] = await Promise.all([migrate(), migrate()]);
      assert.deepEqual([first, second].sort(), [0, 2]);
      assert.equal(await migrate(), 0);
      const metadata = await migration.query('SELECT mig_name, mig_sha256 FROM platform.tbl_plt_migration');
      assert.equal(metadata.rows.length, 2);
      console.log('PASS FRESH_CONCURRENT_CURRENT_AND_CHECKSUM');
      await migration.query("UPDATE platform.tbl_plt_migration SET mig_sha256=$1 WHERE mig_name=$2", ['0'.repeat(64), metadata.rows[0].mig_name]);
      await assert.rejects(migrate(), /MIGRATION_INTEGRITY_FAILURE/);
      await migration.query('UPDATE platform.tbl_plt_migration SET mig_sha256=$1 WHERE mig_name=$2', [metadata.rows[0].mig_sha256, metadata.rows[0].mig_name]);
      console.log('PASS CHECKSUM_TAMPER_DETECTION');
    } finally { await migration.end(); }
  } finally {
    if (created) {
      // Only the generated and validated disposable test name may be dropped.
      await admin.query(`DROP DATABASE ${database} WITH (FORCE)`);
    }
    await admin.end();
  }
}
main().catch(error => { console.error(`DB_TEST_FAILURE: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; });

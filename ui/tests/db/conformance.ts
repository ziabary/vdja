import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { performance } from 'node:perf_hooks';
import { sql } from 'kysely';
import { createDatabase, withTransaction, classifyDatabaseError } from '../../packages/persistence/src/index.ts';
import { readiness } from '../../packages/persistence/src/ready.ts';
import { migrate } from '../../packages/persistence/src/migrate.ts';

type typCategory = 'DB_CONFORMANCE_VIOLATION' | 'DB_TEST_FAILURE' | 'DB_ENVIRONMENT_FAILURE';
const results: { rule: string; category: typCategory; detail: string }[] = [];
const secrets = Object.fromEntries(readFileSync('.env.pg.local', 'utf8').split(/\r?\n/).filter(Boolean).map(line => line.split('=')));
function client(role: 'migration' | 'runtime'): pg.Client {
  return new pg.Client({ host: '127.0.0.1', port: 55432, database: 'targoman_t2', user: `t2_${role}`, password: secrets[role === 'migration' ? 'T2_MIGRATION_PASSWORD' : 'T2_RUNTIME_PASSWORD'], connectionTimeoutMillis: 3000 });
}
async function check(rule: string, category: typCategory, work: () => Promise<void>): Promise<void> {
  try { await work(); console.log(`PASS ${rule}`); }
  catch (error) { results.push({ rule, category, detail: error instanceof Error ? error.message : String(error) }); console.error(`FAIL ${rule}: ${results.at(-1)?.detail}`); }
}
async function rejected(conn: pg.Client, query: string, values: unknown[] = [], code = '42501'): Promise<void> {
  await assert.rejects(conn.query(query, values), (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === code);
}
async function main(): Promise<void> {
  const migration = client('migration');
  const runtime = client('runtime');
  try { await migration.connect(); await runtime.connect(); }
  catch (error) { results.push({ rule: 'CONNECT', category: 'DB_ENVIRONMENT_FAILURE', detail: error instanceof Error ? error.message : String(error) }); console.log(JSON.stringify({ results, counts: { DB_CONFORMANCE_VIOLATION: 0, DB_TEST_FAILURE: 0, DB_ENVIRONMENT_FAILURE: 1 } })); process.exitCode = 1; return; }
  try {
    await check('MIGRATION_NO_OP', 'DB_TEST_FAILURE', async () => assert.equal(await migrate(), 0));
    await check('READINESS', 'DB_CONFORMANCE_VIOLATION', async () => assert.equal(await readiness(), 'READY'));
    await check('READINESS_FAILURE_CLASSIFICATION', 'DB_TEST_FAILURE', async () => {
      const previousPassword = process.env.T2_RUNTIME_PASSWORD;
      const previousPort = process.env.T2_PG_PORT;
      try {
        process.env.T2_RUNTIME_PASSWORD = 'invalid-t2-test-password';
        assert.equal(await readiness(), 'AUTHENTICATION_FAILED');
        process.env.T2_RUNTIME_PASSWORD = secrets.T2_RUNTIME_PASSWORD;
        process.env.T2_PG_PORT = '1';
        assert.equal(await readiness(), 'DATABASE_UNAVAILABLE');
      } finally {
        if (previousPassword === undefined) delete process.env.T2_RUNTIME_PASSWORD; else process.env.T2_RUNTIME_PASSWORD = previousPassword;
        if (previousPort === undefined) delete process.env.T2_PG_PORT; else process.env.T2_PG_PORT = previousPort;
      }
    });
    await check('FIXTURE_SETUP', 'DB_ENVIRONMENT_FAILURE', async () => {
      const found = await migration.query("SELECT to_regnamespace('t2_fixture') AS schema_name");
      if (!found.rows[0]?.schema_name) await migration.query(readFileSync('tests/db/fixture.sql', 'utf8'));
    });
    await check('ROLE_MATRIX', 'DB_CONFORMANCE_VIOLATION', async () => {
      const rows = await migration.query("SELECT rolname, rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname IN ('t2_migration', 't2_runtime') ORDER BY rolname");
      assert.equal(rows.rows.length, 2);
      for (const role of rows.rows) { assert.equal(role.rolsuper, false); assert.equal(role.rolcreatedb, false); assert.equal(role.rolcreaterole, false); }
    });
    await check('SCHEMA_OWNERSHIP', 'DB_CONFORMANCE_VIOLATION', async () => {
      const rows = await migration.query("SELECT nspname, pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname IN ('platform', 'audit', 't2_fixture')");
      assert.equal(rows.rows.length, 3);
      for (const row of rows.rows) assert.equal(row.owner, 't2_migration');
      const relations = await migration.query("SELECT c.relname, pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('platform','audit','t2_fixture') AND c.relkind IN ('r','S','i')");
      for (const row of relations.rows) assert.equal(row.owner, 't2_migration', row.relname);
    });
    await check('OBJECT_NAMING', 'DB_CONFORMANCE_VIOLATION', async () => {
      const tables = await migration.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('platform','audit','t2_fixture') AND table_type='BASE TABLE'");
      for (const row of tables.rows) assert.match(row.table_name, /^tbl_[a-z0-9]+_[a-z0-9_]+$/);
      const columns = await migration.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema IN ('platform','audit','t2_fixture')");
      const prefixes: Record<string,string> = { tbl_plt_migration:'mig_', tbl_aud_mutation:'aud_', tbl_t2f_parent:'par_', tbl_t2f_item:'itm_' };
      for (const row of columns.rows) assert.ok(row.column_name.startsWith(prefixes[row.table_name] ?? 'INVALID_'), `${row.table_name}.${row.column_name}`);
      const constraints = await migration.query("SELECT conname, contype FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN ('platform','audit','t2_fixture')");
      for (const row of constraints.rows) assert.match(row.conname, new RegExp(`^${({p:'pk_',f:'fk_',u:'uq_',c:'ck_'})[row.contype as 'p'|'f'|'u'|'c']}`));
      const objects = await migration.query("SELECT tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='t2_fixture' AND NOT t.tgisinternal");
      assert.ok(objects.rows.every(row => /^trg_/.test(row.tgname)));
      const functions = await migration.query("SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='audit'");
      assert.ok(functions.rows.every(row => /^fn_/.test(row.proname)));
      const indexes = await migration.query("SELECT indexname FROM pg_indexes WHERE schemaname='t2_fixture' AND indexname LIKE 'idx_%'");
      assert.equal(indexes.rows.length, 1);
      const sequences = await migration.query("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='S' AND n.nspname IN ('audit','t2_fixture')");
      assert.ok(sequences.rows.every(row => /^seq_/.test(row.relname)));
    });
    await check('RUNTIME_PERMISSIONS', 'DB_CONFORMANCE_VIOLATION', async () => {
      await rejected(runtime, 'CREATE TABLE t2_fixture.tbl_t2f_forbidden (x integer)');
      await rejected(runtime, 'ALTER TABLE t2_fixture.tbl_t2f_item ADD COLUMN forbidden integer');
      await rejected(runtime, 'DROP TABLE t2_fixture.tbl_t2f_item');
      await rejected(runtime, 'TRUNCATE t2_fixture.tbl_t2f_item');
      await rejected(runtime, 'INSERT INTO platform.tbl_plt_migration (mig_name,mig_sha256) VALUES ($1,$2)', ['forbidden','a'.repeat(64)]);
      await rejected(runtime, 'UPDATE audit.tbl_aud_mutation SET aud_actor_id=$1', ['forbidden']);
      await rejected(runtime, 'CREATE ROLE t2_forbidden');
    });
    const db = createDatabase('runtime');
    try {
      const unique = Date.now().toString();
      const parent = await runtime.query('INSERT INTO t2_fixture.tbl_t2f_parent (par_name) VALUES ($1) RETURNING par_id', [unique]);
      const parentId = parent.rows[0].par_id;
      await check('TRANSACTION_AND_AUDIT', 'DB_TEST_FAILURE', async () => {
        const id = await withTransaction(db, { actorId: 't2-test', correlationId: unique, source: 'conformance' }, async trx => {
          const row = await sql<{ itm_id: string }>`INSERT INTO t2_fixture.tbl_t2f_item (itm_parent__par_id,itm_code,itm_quantity) VALUES (${parentId},${unique},1) RETURNING itm_id`.execute(trx);
          const itemId = row.rows[0]!.itm_id;
          await sql`UPDATE t2_fixture.tbl_t2f_item SET itm_quantity=2 WHERE itm_id=${itemId}`.execute(trx);
          await sql`UPDATE t2_fixture.tbl_t2f_item SET itm_quantity=2, itm_deleted_at=TIMESTAMPTZ '2026-10-02 00:00:00+00' WHERE itm_id=${itemId}`.execute(trx);
          return itemId;
        });
        const audit = await migration.query('SELECT aud_operation FROM audit.tbl_aud_mutation WHERE aud_record_id=$1 ORDER BY aud_id', [id]);
        assert.deepEqual(audit.rows.map(row => row.aud_operation), ['INSERT', 'UPDATE', 'SOFT_DELETE']);
        await assert.rejects(withTransaction(db, { actorId: 't2-test', correlationId: unique, source: 'conformance' }, async trx => {
          await sql`UPDATE t2_fixture.tbl_t2f_item SET itm_quantity=3 WHERE itm_id=${id}`.execute(trx);
          throw new Error('rollback');
        }));
        const unchanged = await runtime.query('SELECT itm_quantity FROM t2_fixture.tbl_t2f_item WHERE itm_id=$1', [id]);
        assert.equal(unchanged.rows[0].itm_quantity, 2);
        const after = await migration.query('SELECT aud_operation FROM audit.tbl_aud_mutation WHERE aud_record_id=$1', [id]);
        assert.equal(after.rows.length, 3);
      });
      await check('CONSTRAINT_SQLSTATE', 'DB_TEST_FAILURE', async () => {
        await rejected(runtime, 'INSERT INTO t2_fixture.tbl_t2f_parent (par_name) VALUES ($1)', [unique], '23505');
        await rejected(runtime, 'INSERT INTO t2_fixture.tbl_t2f_item (itm_parent__par_id,itm_code,itm_quantity) VALUES ($1,$2,1)', [-1,unique+'fk'], '23503');
        await rejected(runtime, 'INSERT INTO t2_fixture.tbl_t2f_item (itm_parent__par_id,itm_code,itm_quantity) VALUES ($1,$2,0)', [parentId,unique+'check'], '23514');
        await rejected(runtime, 'INSERT INTO t2_fixture.tbl_t2f_item (itm_parent__par_id,itm_code,itm_quantity) VALUES ($1,$2,NULL)', [parentId,unique+'null'], '23502');
        await assert.rejects(withTransaction(db, { actorId: 't2-test', correlationId: unique, source: 'conformance' }, async trx => {
          await sql`INSERT INTO t2_fixture.tbl_t2f_item (itm_parent__par_id,itm_code,itm_quantity) VALUES (${parentId},${unique+'rolled-back'},1)`.execute(trx);
          await sql`INSERT INTO t2_fixture.tbl_t2f_item (itm_parent__par_id,itm_code,itm_quantity) VALUES (${parentId},${unique},1)`.execute(trx);
        }), (error: unknown) => classifyDatabaseError(error).category === 'UNIQUE');
        const rolledBack = await runtime.query('SELECT itm_id FROM t2_fixture.tbl_t2f_item WHERE itm_code=$1', [unique+'rolled-back']);
        assert.equal(rolledBack.rows.length, 0);
        assert.equal(classifyDatabaseError({ code:'40001' }).retryable, true);
        assert.equal(classifyDatabaseError({ code:'23505' }).retryable, false);
      });
      await check('CONCURRENT_CONFLICT', 'DB_TEST_FAILURE', async () => {
        const a = client('runtime');
        const b = client('runtime');
        await a.connect(); await b.connect();
        try {
          await a.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
          await b.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
          await a.query('SELECT par_name FROM t2_fixture.tbl_t2f_parent WHERE par_id=$1', [parentId]);
          await b.query('SELECT par_name FROM t2_fixture.tbl_t2f_parent WHERE par_id=$1', [parentId]);
          await a.query('UPDATE t2_fixture.tbl_t2f_parent SET par_name=$1 WHERE par_id=$2', [unique+'a', parentId]);
          await a.query('COMMIT');
          await rejected(b, 'UPDATE t2_fixture.tbl_t2f_parent SET par_name=$1 WHERE par_id=$2', [unique+'b', parentId], '40001');
          await b.query('ROLLBACK');
        } finally { await a.end(); await b.end(); }
      });
      await check('PERFORMANCE_BASELINE', 'DB_TEST_FAILURE', async () => {
        const acquiredAt = performance.now();
        const sample = client('runtime');
        await sample.connect();
        const acquisitionMs = performance.now() - acquiredAt;
        const lookupAt = performance.now();
        await sample.query('SELECT par_id FROM t2_fixture.tbl_t2f_parent WHERE par_id=$1', [parentId]);
        const indexedLookupMs = performance.now() - lookupAt;
        const transactionAt = performance.now();
        await sample.query('BEGIN'); await sample.query('SELECT par_id FROM t2_fixture.tbl_t2f_parent WHERE par_id=$1', [parentId]); await sample.query('COMMIT');
        const smallTransactionMs = performance.now() - transactionAt;
        await sample.end();
        console.log(JSON.stringify({ performanceBaselineMs: { acquisitionMs, indexedLookupMs, smallTransactionMs } }));
      });
    } finally { await db.destroy(); }
    await check('TIMEZONE_ROUNDTRIP', 'DB_TEST_FAILURE', async () => {
      for (const zone of ['UTC','Asia/Tehran','America/New_York']) {
        const row = await runtime.query("SELECT ((TIMESTAMPTZ '2026-03-08 07:30:00+00' AT TIME ZONE $1) AT TIME ZONE $1) AS instant", [zone]);
        assert.equal((row.rows[0].instant as Date).toISOString(), '2026-03-08T07:30:00.000Z');
      }
    });
  } finally { await runtime.end(); await migration.end(); }
  const counts = { DB_CONFORMANCE_VIOLATION: 0, DB_TEST_FAILURE: 0, DB_ENVIRONMENT_FAILURE: 0 };
  for (const result of results) counts[result.category]++;
  console.log(JSON.stringify({ results, counts }));
  if (results.length) process.exitCode = 1;
}
main().catch(error => { console.error(JSON.stringify({ results: [{ rule: 'UNCAUGHT', category: 'DB_TEST_FAILURE', detail: error instanceof Error ? error.message : String(error) }], counts: { DB_CONFORMANCE_VIOLATION: 0, DB_TEST_FAILURE: 1, DB_ENVIRONMENT_FAILURE: 0 } })); process.exitCode = 1; });

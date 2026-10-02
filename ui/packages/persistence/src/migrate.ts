import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const directory = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
export async function migrate(): Promise<number> {
  // Kysely owns normal query and transaction construction. A dedicated pg connection
  // holds the session advisory lock across individual migration transactions.
  const secrets = readFileSync('.env.pg.local', 'utf8');
  const password = process.env.T2_MIGRATION_PASSWORD ?? secrets.match(/^T2_MIGRATION_PASSWORD=(.+)$/m)?.[1];
  if (!password) throw new Error('ENVIRONMENT_NOT_READY: migration credential missing');
  const client = new pg.Client({ host: process.env.T2_PG_HOST ?? '127.0.0.1', port: Number(process.env.T2_PG_PORT ?? 55432), database: process.env.T2_PG_DATABASE ?? 'targoman_t2', user: 't2_migration', password, connectionTimeoutMillis: 3000, application_name: 'targoman-t2-migrate' });
  await client.connect();
  let applied = 0;
  try {
    await client.query("SET lock_timeout = '10s'");
    await client.query('SELECT pg_advisory_lock(7242026, 2)');
    const files = readdirSync(directory).filter(file => /^\d{3}-[a-z-]+\.sql$/.test(file)).sort();
    for (const file of files) {
      const content = readFileSync(join(directory, file), 'utf8');
      const checksum = createHash('sha256').update(content).digest('hex');
      const exists = await client.query("SELECT to_regclass('platform.tbl_plt_migration') AS relation");
      if (exists.rows[0]?.relation) {
        const row = await client.query('SELECT mig_sha256 FROM platform.tbl_plt_migration WHERE mig_name = $1', [file]);
        if (row.rows.length) {
          if (row.rows[0].mig_sha256 !== checksum) throw new Error(`MIGRATION_INTEGRITY_FAILURE: ${file}`);
          continue;
        }
      }
      await client.query('BEGIN');
      try {
        await client.query(content);
        await client.query('INSERT INTO platform.tbl_plt_migration (mig_name, mig_sha256) VALUES ($1, $2)', [file, checksum]);
        await client.query('COMMIT');
        applied++;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
    }
    const known = await client.query('SELECT mig_name FROM platform.tbl_plt_migration ORDER BY mig_name');
    for (const row of known.rows) if (!files.includes(row.mig_name)) throw new Error(`MIGRATION_UNKNOWN: ${row.mig_name}`);
    return applied;
  } finally {
    try { await client.query('SELECT pg_advisory_unlock(7242026, 2)'); } finally { await client.end(); }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  migrate().then(count => console.log(JSON.stringify({ applied: count }))).catch(error => { console.error(error instanceof Error ? error.message : 'migration failed'); process.exitCode = 1; });
}

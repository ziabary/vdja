import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'kysely';
import { createDatabase, type typReadiness } from './index.ts';

export async function readiness(): Promise<typReadiness> {
  let db;
  try { db = createDatabase('runtime'); } catch { return 'AUTHENTICATION_FAILED'; }
  try {
    await sql`SELECT 1 AS alive`.execute(db);
    const files = readdirSync(join(dirname(fileURLToPath(import.meta.url)), 'migrations')).filter(name => /^\d{3}-[a-z-]+\.sql$/.test(name)).sort();
    const state = await sql<{ mig_name: string; mig_sha256: string }>`SELECT mig_name, mig_sha256 FROM platform.tbl_plt_migration ORDER BY mig_name`.execute(db);
    if (state.rows.length !== files.length) return 'SCHEMA_OUTDATED';
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file || state.rows[i]?.mig_name !== file || state.rows[i]?.mig_sha256 !== createHash('sha256').update(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'migrations', file))).digest('hex')) return 'SCHEMA_OUTDATED';
    }
    const required = await sql<{ audit_table: string | null; audit_function: string | null }>`SELECT to_regclass('audit.tbl_aud_mutation')::text AS audit_table, to_regprocedure('audit.fn_aud_capture()')::text AS audit_function`.execute(db);
    return required.rows[0]?.audit_table && required.rows[0]?.audit_function ? 'READY' : 'SCHEMA_OUTDATED';
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    return code === '28P01' ? 'AUTHENTICATION_FAILED' : code === '42P01' || code === '3F000' ? 'SCHEMA_OUTDATED' : 'DATABASE_UNAVAILABLE';
  } finally { await db.destroy(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) readiness().then(status => { console.log(status); if (status !== 'READY') process.exitCode = 1; });

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { resolveSecretRef, type intfConfigurationSnapshot } from '../../configuration/src/index.js';

export type typTargetRole = 'api' | 'worker' | 'migration';
export type typTargetClient = pg.PoolClient;

export async function createTargetPool(snapshot: intfConfigurationSnapshot, role: typTargetRole, secretRoot?: string): Promise<pg.Pool> {
  const { database } = snapshot.value;
  const user = role === 'api' ? database.apiUser : role === 'worker' ? database.workerUser : database.migrationUser;
  const ref = role === 'api' ? database.apiPasswordRef : role === 'worker' ? database.workerPasswordRef : database.migrationPasswordRef;
  const password = await resolveSecretRef(ref, secretRoot);
  return new pg.Pool({ host: database.host, port: database.port, database: database.name, user, password, max: role === 'migration' ? 1 : database.maxConnections, idleTimeoutMillis: 10000, connectionTimeoutMillis: 3000, application_name: `targoman-${role}` });
}
export const createTargetDatabaseAdapter = createTargetPool;
export function createTargetReadinessPersistence(pool: pg.Pool): () => Promise<void> {
  return async () => { await pool.query('SELECT 1 FROM platform.tbl_plt_migration LIMIT 1'); };
}

export interface intfMutationContext { readonly actorKind: string; readonly actorId: string | null; readonly sessionId?: string | null; readonly tenantId?: string | null; readonly deploymentId?: string; readonly requestId?: string; readonly moduleId?: string; readonly authorizationVersion?: number | null; readonly initiator?:Readonly<{actorKind:string;actorId:string|null}>; readonly correlationId: string; readonly source: string }
export async function withTargetTransaction<T>(pool: pg.Pool, context: intfMutationContext, work: (client: typTargetClient) => Promise<T>): Promise<T> {
  if (!context.actorKind || !context.correlationId || !context.source) throw new Error('Missing mutation context');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.actor_kind', $1, true), set_config('app.actor_id', $2, true), set_config('app.session_id', $3, true), set_config('app.tenant_id', $4, true), set_config('app.correlation_id', $5, true), set_config('app.source', $6, true)", [context.actorKind, context.actorId ?? '', context.sessionId ?? '', context.tenantId ?? '', context.correlationId, context.source]);
    await client.query("SELECT set_config('app.deployment_id', $1, true)", [context.deploymentId ?? '']);
    await client.query("SELECT set_config('app.initiator_actor_kind',$1,true),set_config('app.initiator_actor_id',$2,true)",
      [context.initiator?.actorKind??context.actorKind,context.initiator?.actorId??context.actorId??'']);
    await client.query("SELECT set_config('app.request_id',$1,true),set_config('app.module_id',$2,true),set_config('app.authorization_version',$3,true)",
      [context.requestId ?? '',context.moduleId ?? '',context.authorizationVersion == null ? '' : String(context.authorizationVersion)]);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), 'target-migrations');
export async function migrateTarget(pool: pg.Pool): Promise<number> {
  const client = await pool.connect(); let applied = 0;
  try {
    await client.query("SET lock_timeout = '10s'");
    await client.query('SELECT pg_advisory_lock(7242026, 3)');
    const files = (await readdir(MIGRATIONS)).filter(f => /^\d{3}-[a-z-]+\.sql$/.test(f)).sort();
    for (const file of files) {
      const sql = await readFile(join(MIGRATIONS, file), 'utf8');
      const sha = createHash('sha256').update(sql).digest('hex');
      const relation = await client.query("SELECT to_regclass('platform.tbl_plt_migration') AS relation");
      if (relation.rows[0]?.relation) {
        const known = await client.query('SELECT mig_sha256 FROM platform.tbl_plt_migration WHERE mig_name = $1', [file]);
        if (known.rows.length) { if (known.rows[0].mig_sha256 !== sha) throw new Error(`MIGRATION_INTEGRITY_FAILURE: ${file}`); continue; }
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO platform.tbl_plt_migration (mig_name, mig_sha256) VALUES ($1, $2)', [file, sha]);
        await client.query('COMMIT'); applied += 1;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
    }
    const known = await client.query('SELECT mig_name FROM platform.tbl_plt_migration ORDER BY mig_name');
    for (const row of known.rows) if (!files.includes(String(row.mig_name))) throw new Error(`MIGRATION_UNKNOWN: ${row.mig_name}`);
    return applied;
  } finally {
    try { await client.query('SELECT pg_advisory_unlock(7242026, 3)'); } finally { client.release(); }
  }
}

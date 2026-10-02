import { Kysely, PostgresDialect, sql, type Transaction } from 'kysely';
import pg from 'pg';
import { readFileSync } from 'node:fs';

export type typDatabase = Record<string, never>;
export type typExecutionContext = Readonly<{ actorId: string; correlationId: string; source: string }>;
export type typTransaction = Transaction<typDatabase>;
export type typReadiness = 'READY' | 'DATABASE_UNAVAILABLE' | 'AUTHENTICATION_FAILED' | 'SCHEMA_OUTDATED';

function localSecrets(): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync('.env.pg.local', 'utf8').split(/\r?\n/).filter(Boolean).map(line => {
      const at = line.indexOf('=');
      return [line.slice(0, at), line.slice(at + 1)];
    }));
  } catch { return {}; }
}

export function createDatabase(role: 'migration' | 'runtime'): Kysely<typDatabase> {
  const secrets = localSecrets();
  const password = process.env[role === 'migration' ? 'T2_MIGRATION_PASSWORD' : 'T2_RUNTIME_PASSWORD'] ?? secrets[role === 'migration' ? 'T2_MIGRATION_PASSWORD' : 'T2_RUNTIME_PASSWORD'];
  if (!password) throw new Error('ENVIRONMENT_NOT_READY: missing local PostgreSQL credentials');
  const max = Number(process.env.T2_PG_POOL_MAX ?? 5);
  if (!Number.isInteger(max) || max < 1 || max > 20) throw new Error('Invalid bounded pool size');
  const pool = new pg.Pool({
    host: process.env.T2_PG_HOST ?? '127.0.0.1',
    port: Number(process.env.T2_PG_PORT ?? 55432),
    database: process.env.T2_PG_DATABASE ?? 'targoman_t2',
    user: role === 'migration' ? 't2_migration' : 't2_runtime',
    password,
    max,
    idleTimeoutMillis: Number(process.env.T2_PG_IDLE_MS ?? 10000),
    connectionTimeoutMillis: Number(process.env.T2_PG_CONNECT_MS ?? 3000),
    application_name: `targoman-t2-${role}`,
  });
  return new Kysely<typDatabase>({ dialect: new PostgresDialect({ pool }) });
}

export async function withTransaction<T>(db: Kysely<typDatabase>, context: typExecutionContext, work: (trx: typTransaction) => Promise<T>): Promise<T> {
  if (!context.actorId || !context.correlationId || !context.source) throw new Error('Missing execution context');
  return db.transaction().execute(async trx => {
    await sql`SELECT set_config('app.actor_id', ${context.actorId}, true), set_config('app.correlation_id', ${context.correlationId}, true), set_config('app.source', ${context.source}, true)`.execute(trx);
    return work(trx);
  });
}

export type typDatabaseError = Readonly<{ category: 'UNIQUE' | 'FOREIGN_KEY' | 'CHECK' | 'NOT_NULL' | 'RETRYABLE_CONFLICT' | 'OTHER'; retryable: boolean }>;
export function classifyDatabaseError(error: unknown): typDatabaseError {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const category = code === '23505' ? 'UNIQUE' : code === '23503' ? 'FOREIGN_KEY' : code === '23514' ? 'CHECK' : code === '23502' ? 'NOT_NULL' : code === '40001' || code === '40P01' ? 'RETRYABLE_CONFLICT' : 'OTHER';
  return { category, retryable: category === 'RETRYABLE_CONFLICT' };
}

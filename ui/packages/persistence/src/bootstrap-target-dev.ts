import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import pg from 'pg';

const secretDir = '.secrets.t3.local';
const databaseAt = process.argv.indexOf('--database');
const targetDatabase = databaseAt >= 0 ? process.argv[databaseAt + 1] : 'targoman_platform';
if (!targetDatabase || !/^[a-z][a-z0-9_]{0,62}$/.test(targetDatabase)) throw new Error('INVALID_TARGET_DATABASE_NAME');
const local = await readFile('.env.pg.local', 'utf8');
const bootstrapPassword = local.match(/^T2_BOOTSTRAP_PASSWORD=(.+)$/m)?.[1];
if (!bootstrapPassword) throw new Error('ENVIRONMENT_NOT_READY: T2 local PostgreSQL bootstrap credential missing');
await mkdir(secretDir, { recursive: true, mode: 0o700 });

const admin = new pg.Client({ host: '127.0.0.1', port: 55432, database: 'postgres', user: 't2_bootstrap', password: bootstrapPassword, connectionTimeoutMillis: 3000 });
await admin.connect();
try {
  const roles = [
    { role: 'targoman_migration', file: 'pg-migration' },
    { role: 'targoman_api', file: 'pg-api' },
    { role: 'targoman_worker', file: 'pg-worker' },
  ] as const;
  for (const item of roles) {
    const path = `${secretDir}/${item.file}`;
    const exists = await admin.query<{ exists: boolean }>('SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = $1) AS exists', [item.role]);
    if (exists.rows[0]?.exists) {
      try { await readFile(path, 'utf8'); } catch { throw new Error(`Role ${item.role} exists but its local secret file is missing; refusing credential reset`); }
      continue;
    }
    const password = randomBytes(32).toString('hex');
    await admin.query(`CREATE ROLE ${item.role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`);
    await writeFile(path, password, { mode: 0o600 });
    await chmod(path, 0o600);
  }
  const exists = await admin.query<{ exists: boolean }>('SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_database WHERE datname = $1) AS exists', [targetDatabase]);
  if (!exists.rows[0]?.exists) await admin.query(`CREATE DATABASE ${targetDatabase} OWNER targoman_migration`);
  console.log(JSON.stringify({ database: targetDatabase, roles: roles.map(x => x.role), secretDirectory: secretDir, status: 'READY' }));
} finally { await admin.end(); }

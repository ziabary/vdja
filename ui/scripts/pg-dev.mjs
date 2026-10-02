import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

const envFile = resolve('.env.pg.local');
const action = process.argv[2];
if (!['start', 'status', 'stop'].includes(action)) throw new Error('Expected start, status, or stop');
if (action === 'start' && !existsSync(envFile)) {
  const secret = () => randomBytes(32).toString('hex');
  writeFileSync(envFile, `T2_BOOTSTRAP_PASSWORD=${secret()}\nT2_MIGRATION_PASSWORD=${secret()}\nT2_RUNTIME_PASSWORD=${secret()}\n`, { mode: 0o600 });
  console.log('Created ignored local PostgreSQL credentials.');
}
if (!existsSync(envFile)) throw new Error('ENVIRONMENT_NOT_READY: run npm run db:pg:start first');
const args = ['compose', '--project-name', 'vadja-t2', '--env-file', envFile, '-f', 'docker/postgres-t2.compose.yml'];
args.push(...(action === 'start' ? ['up', '-d', '--wait'] : action === 'stop' ? ['stop'] : ['ps']));
const result = spawnSync('docker', args, { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

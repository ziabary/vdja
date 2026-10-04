// db/migrate.ts
import config from './knexfile.js';  // .js extension – ESM resolves to .ts automatically via tsx

const env = process.env.NODE_ENV || 'development';
const knexConfig = config[env as keyof typeof config];

if (!knexConfig) {
  console.error(`No knex config found for environment: ${env}`);
  process.exit(1);
}

import knexLib from 'knex';
const db = knexLib(knexConfig);

async function runMigrations() {
  console.log(`\nEnvironment: ${env.toUpperCase()}`);
  console.log(`Client: ${knexConfig.client}`);
  console.log(`Migrations directory: ${knexConfig.migrations?.directory || '(not set)'}\n`);

  try {
    const [batchNo, log] = await db.migrate.latest();
    if (log.length === 0) {
      console.log('Already up to date – no new migrations applied.');
    } else {
      console.log(`Batch ${batchNo} applied (${log.length} migrations):`);
      log.forEach(file => console.log(`  - ${file}`));
    }
  } catch (err: any) {
    console.error('Migration failed:', err.message || err);
    if (err.stack) console.error(err.stack.split('\n').slice(0, 8).join('\n'));
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

runMigrations();

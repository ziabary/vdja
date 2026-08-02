// db/check-tables.ts
import knex from 'knex';          // ← default import – fixes the error
import config from './knexfile.js';   // adjust path if knexfile is not in parent dir

const env = process.env.NODE_ENV || 'development';
const knexConfig = (config as any)[env];

if (!knexConfig) {
  console.error(`No config found for environment: ${env}`);
  process.exit(1);
}

const db = knex(knexConfig);

async function inspectDatabase() {
  try {
    console.log(`\nConnected to: ${knexConfig.client.toUpperCase()} – ${env.toUpperCase()}`);

    // ───────────────────────────────────────────────
    // 1. List all user tables
    // ───────────────────────────────────────────────
    let tables: string[] = [];

    if (knexConfig.client === 'mysql' || knexConfig.client === 'mysql2') {
      const result = await db.raw('SHOW TABLES');
      tables = result[0].map((row: any) => Object.values(row)[0]);
    } else if (knexConfig.client === 'postgresql' || knexConfig.client === 'pg') {
      tables = await db('information_schema.tables')
        .pluck('table_name')
        .where('table_schema', 'public')
        .whereNot('TABLE_NAME', 'like', 'knex_%')
    } else if (knexConfig.client === 'sqlite' || knexConfig.client === 'sqlite3') {
      const result = await db.raw("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'knex_%'");
      tables = result.map((row: any) => row.name);
    } else if (knexConfig.client === 'mssql' || knexConfig.client === 'tedious') {
      // MSSQL – basic version
      tables = await db('information_schema.tables')
        .pluck('TABLE_NAME')
        .where('TABLE_TYPE', 'BASE TABLE')
        .whereNot('TABLE_NAME', 'like', 'knex_%')
    } else {
      console.warn(`Table listing not implemented for client: ${knexConfig.client}`);
    }

    console.log('\nTables found:');
    if (tables.length === 0) {
      console.log('  (no user tables found)');
    } else {
      console.log('  ' + tables.join(', '));
    }

    // ───────────────────────────────────────────────
    // 2. Row counts
    // ───────────────────────────────────────────────
    console.log('\nRow counts:');
    for (const table of tables) {
      try {
        const countResult = await db(table).count('* as count').first();
        const count = Number(countResult?.count ?? 0);
        console.log(`  ${table.padEnd(30)} → ${count.toLocaleString()} rows`);
      } catch (err: any) {
        console.warn(`  ${table.padEnd(30)} → error: ${err.message.split('\n')[0]}`);
      }
    }

    // ───────────────────────────────────────────────
    // 3. Migration status (useful to confirm)
    // ───────────────────────────────────────────────
    try {
      const migrations = await db('knex_migrations')
        .select('name', 'batch', 'migration_time')
        .orderBy('batch', 'desc')
        .orderBy('migration_time', 'desc');

      console.log('\nApplied migrations (most recent first):');
      if (migrations.length === 0) {
        console.log('  (none applied yet)');
      } else {
        migrations.forEach(m => {
          console.log(`  ${m.name}  (batch ${m.batch})  ${m.migration_time?.toISOString() || ''}`);
        });
      }
    } catch (err: any) {
      console.log('\nMigrations table not found or inaccessible.');
    }

  } catch (err: any) {
    console.error('\nDatabase inspection failed:', err.message);
  } finally {
    await db.destroy();
  }
}

inspectDatabase();
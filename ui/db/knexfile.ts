import path from 'path';
import configManager from '../src/utils/configManager';

configManager.init(path.resolve(process.cwd(), '.config.json'));
const cfg = configManager.active();

const db = cfg.db;
const client = db.activeType;

let connection: any;

switch (client) {
  case 'sqlite':
    connection = { filename: path.resolve(process.cwd(), db.sqlite.paths.base) };
    break;
  case 'mysql':
    connection = db.mysql;
    break;
  case 'mssql':
    connection = db.mssql;
    break;
  case 'pgsql':
    connection = {
      ...db.pgsql,
      // Optional: add searchPath if needed
      searchPath: ['public'],
    };
    break;
  default:
    throw new Error(`Unsupported db.activeType: ${client}`);
}

const baseConfig = {
  client,
  connection,
  migrations: {
    directory: import.meta.dirname + '/../src/db/schema',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: import.meta.dirname + '/../src/db/seeds'
  },
  pool: { min: 2, max: 10 },
  // Add debug: cfg.isDebugging, etc. if useful
};

console.log("Current working dir:", process.cwd());
console.log("Migrations directory:", baseConfig.migrations.directory);
console.log("Resolved migration path:", path.resolve(process.cwd(), baseConfig.migrations.directory));
console.log("Active DB config:", JSON.stringify(cfg.db[cfg.db.activeType], null, 2));

export default {
  development: baseConfig,
  production: {
    ...baseConfig,
  },
  // test / staging if needed
};


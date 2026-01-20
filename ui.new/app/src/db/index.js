// initDB.js

const knex = require('knex')
const configManager = require('../utils/configManager');

function _getDB(dbConfig) {
  const { activeType } = dbConfig;

  // Map the activeType to the correct Knex client
  const clientMap = {
    sqlite: 'sqlite3',
    mysql: 'mysql2',
    mssql: 'mssql', 
    pgsql: 'pg',
  };

  if (!clientMap[activeType]) {
    throw new Error(`Unsupported database type: ${activeType}`);
  }

  if (!dbConfig[activeType]) {
    throw new Error(`No config found for database type: ${activeType}`);
  }

  // Create a base config
  const config = {
    client: clientMap[activeType],
    connection: dbConfig[activeType],
    pool: { min: 0, max: 10 }
  };

  // Add useNullAsDefault only for SQLite
  if (activeType === 'sqlite') {
    config.useNullAsDefault = true;
  }

  // Optional: Add migrations and seeds
  // config.migrations = { directory: './schema/migrations' };
  // config.seeds = { directory: './schema/seeds' };

  return knex(config);
}

async function getDB(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return _getDB(configManager.active().db);
    } catch (err) {
      console.error(`Connection failed, retrying... Attempt ${i + 1} of ${maxRetries}`);
      await new Promise(res => setTimeout(res, 1000));
    }
  }
  throw new Error('Failed to connect to the database after multiple attempts');
}

async function init() {
  try{
    await getDB().then(db=>db.select('*').from('tblChats'))
  } catch(e) {
    console.error(e)
    process.exit()
  }
}

module.exports =  {
  init,
  getDB,
};
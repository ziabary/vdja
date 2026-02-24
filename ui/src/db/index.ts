// src/db/initDB.ts
import knex from 'knex';
import type { Knex } from 'knex';
import configManager from '../utils/configManager';
import logger from '../utils/logger';
import type { IntfDBConfig } from '../interfaces/config';

let mainDB: Knex | null = null;
let logDB: Knex | null = null;

function createKnexInstance(dbConfig: IntfDBConfig): Knex {
  const { activeType } = dbConfig;

  const clientMap  = {
    sqlite:  'sqlite3',
    mysql:  'mysql2',
    mssql:  'mssql',
    pgsql:  'pg',
  }

  const client = clientMap[activeType as keyof typeof clientMap];
  if (!client) throw new Error(`Unsupported database type: ${activeType}`);
  if (!dbConfig[activeType]) throw new Error(`No config for database type: ${activeType}`);

  const config: Knex.Config = {
    client,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connection: dbConfig[activeType] as any,
    log: {
      warn: (message: string) => {
        // Filter out the specific warning
        if (!message.includes('.returning() is not supported by mysql')) 
          logger.warn({createKnexInstance: message});
      }
    },
    pool: { min: 1, max: 10 },
  };

  if (activeType === 'sqlite') {
    config.useNullAsDefault = true;
  }

  return knex(config);
}

async function createWithRetry(
  factory: () => Knex,
  maxRetries = 3
): Promise<Knex> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const db = factory();
      await db.raw('select 1');
      return db;
    } catch (err) {
      logger.error(`DB connection failed, retrying... Attempt ${i + 1}/${maxRetries}`, err);
      await new Promise(res => setTimeout(res, 2 ** i * 1000));
    }
  }
  throw new Error('امکان ارتباط با پایگاه داده‌ها فراهم نشد');
}

export async function getDB(): Promise<Knex> {
  if (mainDB) return mainDB;
  const dbConfig = configManager.active().db;
  mainDB = await createWithRetry(() => createKnexInstance(dbConfig));
  return mainDB;
}

/**
 * Returns log DB or fallback to main DB
 */
export async function getLogDB(): Promise<Knex> {
  if (logDB) return logDB;
  const dbConfig = configManager.active().logDb &&  configManager.active().logDb !== true ? configManager.active().logDb : configManager.active().db;
  logDB = await createWithRetry(() => createKnexInstance(dbConfig as IntfDBConfig));
  return logDB;
}

/**
 * Initialize DB by testing a simple query
 */
async function init(): Promise<void> {
  try {
    const db = await getDB();
    await db.select('*').from('tblChats').limit(1);
    const logDb = await getLogDB();
    await logDb.select('*').from('tblLogs').limit(1);
    logger.info('Database connection successful.');
  } catch (e) {
    logger.error('Database initialization failed:', e);
    throw e;
  }
}

export default {
  init,
  getDB,
  getLogDB
}
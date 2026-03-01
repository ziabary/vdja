import fs from 'fs';
import { deepMerge } from './common';
import logger from './logger';
import type { IntfConfigs } from '../interfaces/config';

const DEFAULT_CONFIGS: IntfConfigs = {
  app: {
    listen: { port: 3000, ip: '0.0.0.0' },
    corsOrigin: 'localhost',
    maxJson: '50mb',
    limiter: {
      window: 1 * 60 * 1000,
      maxReq: 1000,
      errorMessage:
        'تعداد درخواست‌های وارد از این IP بیش از حد مجاز بوده. اندکی صبر و مجددا تلاش کند',
    },
    watchdogMaxTrigger: 3,
    softDelete: true,
    legacyPDFParser: true,
  },
  log: {
    accessPath: './logs/access.log',
    errorsPath: './logs/errors.log',
    showAPICalls: false,
    isDebugging: false,
    noMonitor: false
  },
  OIDC: {
    active: false,
    issuer: "sampl-issuer",
    clientId: "my-client-id",
    clientSecret: "my-secret",
    scope: "openid profile TargomanApi UserManagementApi",
    callbackUri: "http://localhost:3000/api/auth/oidc/callback"
  },
  llmServers: {
    rag: {
      url: 'llm-server',
      model: 'targoman',
      temperature: 0.5,
      maxInputChars: 2000,
      maxTokens: 10000,
      maxDelayed: 45,
    },
    translate: {
      url: 'llm-server',
      model: 'targoman',
      temperature: 0.7,
      maxInputChars: 2000,
      maxTokens: 10000,
      maxDelayed: 30,
    },
    summarize: {
      url: 'llm-server',
      model: 'targoman',
      temperature: 0.7,
      maxInputChars: 5000,
      maxTokens: 10000,
      maxDelayed: 30,
    },
    think: {
      url: 'think-server',
      model: 'targoman',
      temperature: 0.3,
      maxTokens: 20000,
      maxDelayed: 60,
    },
  },
  embedding: {
    server: { url: 'embd-server', model: 'targoman' },
    modelPath: '',
    maxTokens: 480
  },
  RAGDB: { url: 'rag-db' },
  db: {
    activeType: 'mysql',
    sqlite: {
      paths: { base: 'db/vdja.db', news: 'db/news.db', logs: 'db/logs.db' },
      timeout: 5000,
    },
    mysql: {
      host: 'localhost',
      user: 'user',
      password: 'password',
      database: 'dbname',
    },
    mssql: {
      server: 'localhost',
      user: 'user',
      password: 'password',
      database: 'dbname',
      options: { encrypt: false },
    },
    pgsql: {
      host: 'localhost',
      user: 'user',
      password: 'password',
      database: 'dbname',
      port: 5432,
    },
  },
  jwt: {
    baseSecret: "secret",
    refreshSecret: "secret2",
    accessTTL: "15m",
    refreshTTL: "7d"
  },
  specialCollections: {
    global: "",
    news: ""
  },
  logDb: false,
};

/* =======================
   Runtime state
======================= */

let activeConfigs: IntfConfigs = DEFAULT_CONFIGS;

/* =======================
   API 
======================= */

function init(configFile = './.config.json'): void {
  try {
    const resolvedPath =
      fs.existsSync(configFile)
        ? configFile
        : fs.existsSync(process.cwd() + '/' + configFile)
          ? process.cwd() + '/' + configFile
          : undefined;

    if (resolvedPath) {
      const data = fs.readFileSync(resolvedPath, 'utf8');
      const jsonData = JSON.parse(data) as Partial<IntfConfigs>;

      activeConfigs = deepMerge(DEFAULT_CONFIGS, jsonData);

      activeConfigs.log.isDebugging = process.env.DEBUG_MODE
        ? true
        : activeConfigs.log.isDebugging || false;
    }

    if (activeConfigs.log.isDebugging) {
      logger.deepDebug({ activeConfigs });
    }
  } catch (err) {
    logger.error('Error reading config file:', err);
    throw err;
  }
}

export default {
  active: (): IntfConfigs => activeConfigs,
  init,
};

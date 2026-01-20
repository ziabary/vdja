const fs = require("fs");
const { deepLog, deepMerge } = require("./common");

const DEFAULT_CONFIGS = {
  app: {
    listen: {
      port: 3000,
      ip: "0.0.0.0",
    },
    corsOrigin: "localhost",
    maxJson: "50mb",
    limiter: {
      window: 1 * 60 * 1000, // 1 minutes,
      maxReq: 1000, // limit each IP to 100 requests per windowMs
      errorMessage:
        "تعداد درخواست‌های وارد از این IP بیش از حد مجاز بوده. اندکی صبر و مجددا تلاش کند",
    },
    watchdogMaxTrigger: 3
  },
  llm: {
    RAGServer: {
      url: "llm-server",
      model: "targoman",
      temperature: 0.3,
      maxInputChars: 2000,
      maxTokens: 10000,
      maxDelayed: 45,
    },
    TranslServer: {
      url: "llm-server",
      model: "targoman",
      temperature: 0.3,
      maxInputChars: 2000,
      maxTokens: 10000,
      maxDelayed: 30,
    },
    SummaryServer: {
      url: "llm-server",
      model: "targoman",
      temperature: 0.3,
      maxInputChars: 5000,
      maxTokens: 10000, 
      maxDelayed: 30,
    },
    ThinkServer: {
      url: "think-server",
      model: "targoman",
      temperature: 0.3, 
      maxTokens: 20000,
      maxDelayed: 60,
    },
    RAGDB: { url: "rag-db" },
    Embedding: { url: "embd-server", model: "targoman" },
  },
  db: {
    activeType: "mysql", // 'mysql', 'mssql', 'pgsql' or 'sqlite'
    sqlite: {
      paths: { base: "db/vdja.db", news: "db/news.db", logs: "db/logs.db" },
      timeout: 5000,
    },
    mysql: {
      host: "localhost",
      user: "user",
      password: "password",
      database: "dbname",
    },
    mssql: {
      server: "localhost",
      user: "user",
      password: "password",
      database: "dbname",
      options: {
        encrypt: false,
      },
    },
    pgsql: {
      host: "localhost",
      user: "user",
      password: "password",
      database: "dbname",
      port: 5432, // default PostgreSQL port
    },
  },
  isDebugging: true,
};

let activeConfigs = DEFAULT_CONFIGS;

function init(configFile = "./.config.json") {
  try {
    configFile = fs.existsSync(configFile)
      ? configFile
      : fs.existsSync(process.cwd() + "/" + configFile)
      ? process.cwd() + "/" + configFile
      : undefined;

    if (configFile) {
      const data = fs.readFileSync(configFile, "utf8");
      const jsonData = JSON.parse(data);
      const activeConfigs = deepMerge(DEFAULT_CONFIGS, jsonData);
      activeConfigs.isDebugging = process.env.DEBUG_MODE
        ? true
        : activeConfigs.isDebugging;
    }
    if (activeConfigs.isDebugging) deepLog({ activeConfigs });
  } catch (err) {
    console.error("Error reading config file:", err);
    throw new Error(err.message); 
  }
}

module.exports = {
  active: () => activeConfigs || DEFAULT_CONFIGS,
  init,
};

export interface IntfAppConfig {
  listen: {
    port: number;
    ip: string;
  };
  corsOrigin: string;
  maxJson: string;
  limiter: {
    window: number;
    maxReq: number;
    errorMessage: string;
  };
  watchdogMaxTrigger: number;
  softDelete?: boolean;
  legacyPDFParser?: boolean
}
export interface IntfAppLog {
    accessPath?: string | null,
    errorsPath?: string | null,
    showAPICalls?: boolean
    isDebugging?: boolean;
    noMonitor?: boolean
}

export interface IntfLLMServerConfig {
  url: string;
  model?: string;
  temperature?: number;
  maxInputChars?: number;
  maxTokens?: number;
  maxDelayed?: number;
}

export interface IntfDBConfig {
  activeType: 'mysql' | 'mssql' | 'pgsql' | 'sqlite';
  sqlite: {
    paths: {
      base: string;
      news: string;
      logs: string;
    };
    timeout: number;
  };
  mysql: {
    host: string;
    user: string;
    password: string;
    database: string;
  };
  mssql: {
    server: string;
    user: string;
    password: string;
    database: string;
    options: {
      encrypt: boolean;
    };
  };
  pgsql: {
    host: string;
    user: string;
    password: string;
    database: string;
    port: number;
  };
}

export enum enuLLMServices {
  RAG = "rag",
  Translate = "translate",
  Summarize = "summarize",
  FAQ = "faq",
  Think = "think",
  Thinker = "think",
  Rahbari = "rahbari"
}

export interface IntfConfigs {
  app: IntfAppConfig; 
  log: IntfAppLog;
  OIDC: { 
    active: boolean
    allowInsecureHttp?: boolean
    issuer: string
    clientId: string
    clientSecret: string
    scope: string,
    callbackUri: string  
  };
  baleOTP: {
    gwID: string,
    gwSecret: string 
  }
  llmServers: {
    [key in Exclude<enuLLMServices, enuLLMServices.FAQ>]: IntfLLMServerConfig
  } & { faq?: IntfLLMServerConfig };

  embedding: {
    server : IntfLLMServerConfig;
    modelPath: string,
    maxTokens: number
  }

  RAGDB: { url: string };
  jwt: {
    baseSecret: string
    refreshSecret: string
    accessTTL: number | string
    refreshTTL: number | string
  }
  db: IntfDBConfig;
  logDb?: boolean | IntfDBConfig;
  newsDb?: boolean | IntfDBConfig;
  specialDb?: boolean | IntfDBConfig;
}

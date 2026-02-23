import 'dotenv/config';
import express, {Router} from 'express';
import type { Request, Response, NextFunction } from "express";

import cors from 'cors';
import rateLimit from 'express-rate-limit';
import session from "express-session";
import morgan from 'morgan';
import fs from "fs"
import * as path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from "cookie-parser";

import configManager from './utils/configManager';
import db from './db/index';

import mountRoutes from './utils/asyncRouter';
import { installMonitor } from './services/chatService';

import logger from './utils/logger';
import translate from './routes/translate';
import summarize from './routes/summarize';
import fileToText from './routes/file2Text';
import auth from './routes/auth';
import rag from './routes/rag';
import type { IntfExHttp } from './interfaces/exHttp';
import { enuLLMServices } from './interfaces/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_CONFIG_FILE = "./.config.json";

async function init() {
  configManager.init(DEFAULT_CONFIG_FILE);
  db.init();

  const configs = configManager.active(); 
  const app = express();
  const corsOptions = {
    origin: configs.app.corsOrigin || "http://localhost:3000",
    credentials: true,
    optionsSuccessStatus: 200,
  };

  app.use(cors(corsOptions));
  app.use(cookieParser());
  app.use(express.json({ trustXFF: true }));
  app.set("trust proxy", "172.17.0.0/16");

  const limiter = rateLimit({
    windowMs: configs.app.limiter.window,
    max: configs.app.limiter.maxReq,
    message: configs.app.limiter.errorMessage,
  });
  app.use(limiter);

  const nginxFormat = ':remote-addr - - [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"';
  // app.use(morgan(nginxFormat, {
  //   stream: process.stdout, 
  // }));

  //@TODO store logs in access.log

  app.use(express.json({ limit: configs.app.maxJson }));
  app.use(express.static("public"));
  app.use((req:Request, res: Response, next: NextFunction) => {
    const htmlPath = path.join(__dirname, '..', 'public', req.path + '.html');
    fs.access(htmlPath, fs.F_OK, (err: Error) => {
      if (!err) res.sendFile(htmlPath);
      else next();
    });
  });
  app.use(session({
    secret: "super-secret",
    resave: false,
    saveUninitialized: false
  }));

  // Middleware
  app.use((_: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;
    res.json = function (data:unknown) {
      if (!res.headersSent) 
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      originalJson.call(this, data);
    };
    next(); 
  });


  ///////////////////////////////////////////////////////////////////////
  // Routes
  ///////////////////////////////////////////////////////////////////////
  app.get("/", (_:Request, res:Response) => res.sendFile(path.join(__dirname, "../public", "index.html")));
  const activeRoutes = await mountRoutes([ 
    translate,
    summarize,
    fileToText,
    auth,
    rag,
    // think,
    // stats,
  ])
 
  
  app.use("/api", activeRoutes)

  app.use((err: IntfExHttp | Error, _ : Request, res: Response, next: NextFunction) => {
    if((err as IntfExHttp).status && (err as IntfExHttp).status === 401) 
      return res.status((err as IntfExHttp).status).json({error: err.message})

    logger.error("🔥 Route error:", err);

    if (res.headersSent) {
      res.write("data: [ERROR]: " + err.message); 
      return res.end()
    } 
    
    const status = (err as IntfExHttp).status || 500;

    res.status(status).json({error:{status, message: err.message || "Internal Server Error"}});
  });

  app.use((_: Request, res: Response) => {
    res.status(404).send('404: Not found');
  });

  app.listen(configs.app.listen.port, configs.app.listen.ip, () => {
    logger.info(`Using RAGServer at: ${configs.llmServers.rag?.url} (model: ${configs.llmServers.rag?.model})`);
    logger.info(`Using TranslServer at: ${configs.llmServers.translate?.url} (model: ${configs.llmServers.translate?.model})`);
    logger.info(`Using SumServer at: ${configs.llmServers.summarize?.url} (model: ${configs.llmServers.summarize?.model})`);
    logger.info(`Using ThinkServer at: ${configs.llmServers.think?.url} (model: ${configs.llmServers.think?.model})`);
    logger.info(`Using RAGDB at: ${configs.RAGDB?.url}`);
    logger.info(`Using Embedding at: ${configs.embedding.server?.url} (model: ${configs.embedding.server?.model})`);
    logger.info(`UI running at http://${configs.app.listen.ip}:${configs.app.listen.port}`);
  }); 

  Object.values(enuLLMServices).forEach(installMonitor);
}

init(); 

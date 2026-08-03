import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from "express";

import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { access } from 'fs/promises';
import * as path from 'path';
import * as fs from 'fs'
import { fileURLToPath } from 'url';
import cookieParser from "cookie-parser";
import * as swaggerUi from "swagger-ui-express";
import { parse, format } from 'url';

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
import thinker from './routes/thinker';
import rahbari from './routes/rahbari';
import stats from './routes/stats';
import admin from './routes/admin';
import files from './routes/shares';
import widget from './routes/widget';
import crm from './routes/crm';
import faq from './routes/faq';
import { publicWidgetCors } from './services/widgetService';
import type { IntfExHttp } from './interfaces/exHttp';
import { enuLLMServices } from './interfaces/config';
import setupAPICallLogger from './utils/apiCallLog';
import genSwaggerSpec from './utils/swagger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_CONFIG_FILE = "./.config.json";

async function init() {
  configManager.init(DEFAULT_CONFIG_FILE);
  await db.init();

  const configs = configManager.active();
  const app = express();
  const corsOptions = {
    origin: configs.app.corsOrigin || "llm-dev.targoman.ir" || "http://localhost:3000",
    credentials: true,
    optionsSuccessStatus: 200,
  };

  app.use((req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(publicWidgetCors(req, res, next)).catch(next);
  });
  const defaultCors = cors(corsOptions);
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/widget/public/')) return next();
    return defaultCors(req, res, next);
  });
  app.use(cookieParser());
  app.set("trust proxy", "172.17.0.0/16");

  const limiter = rateLimit({
    windowMs: configs.app.limiter.window,
    max: configs.app.limiter.maxReq,
    message: configs.app.limiter.errorMessage,
  });
  app.use(limiter);

  setupAPICallLogger(app)

  //@TODO store logs in access.log

  app.use(express.json({ limit: configs.app.maxJson }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/fonts/IranSansX/')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
    next();
  });

  app.use(express.static("public"));
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const htmlPath = path.join(__dirname, '..', 'public', `${req.path}.html`);

    try {
      await access(htmlPath);
      res.sendFile(htmlPath);
    } catch {
      next();
    }
  });

  // Middleware
  app.use((_: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = function (data: unknown) {
      if (!res.headersSent)
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      return originalJson(data);
    } as typeof res.json;

    next();
  });
 
  // Middleware to normalize the URL path
app.use((req, res, next) => {
 /* const baseUrl = `${req.protocol}://${req.hostname}`
  const fullUrl = new URL(req.url, baseUrl).toString();

  console.log(fullUrl)

  const urlObj = new URL(fullUrl);
  let normalizedPath = path.normalize(urlObj.pathname);
  if(normalizedPath.endsWith("/")) normalizedPath = normalizedPath.substring(0, normalizedPath.length - 1)
  const newUrl = new URL(normalizedPath, baseUrl).toString();

  console.log(newUrl)
  req.url = newUrl;*/
  next();
});

  ///////////////////////////////////////////////////////////////////////
  // Routes
  ///////////////////////////////////////////////////////////////////////
  app.get("/", (_: Request, res: Response) => res.sendFile(path.join(__dirname, "../public", "index.html")));
  const activeRoutes = await mountRoutes([
    translate,
    summarize,
    fileToText,
    auth,
    rag,
    thinker,
    rahbari,
    stats,
    admin,
    files,
    widget,
    crm,
    faq
  ])


  app.use("/api", activeRoutes)

  const swaggerDocument =  genSwaggerSpec()

  // Serve the Swagger UI
  app.use('/api-swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  app.use((err: IntfExHttp | Error, _: Request, res: Response, next: NextFunction) => {
    if ((err as IntfExHttp).status && (err as IntfExHttp).status === 401)
      return res.status((err as IntfExHttp).status).json({ error: err.message })

    logger.error("🔥 Route error:", err);

    if (res.headersSent) {
      res.write("data: [ERROR]: " + err.message);
      return res.end()
    }

    const status = (err as IntfExHttp).status || 500;

    res.status(status).json({ error: { status, message: err.message || "Internal Server Error" } });
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).send(`404: Not found ${_req.url}`);
  });

  app.listen(configs.app.listen.port, configs.app.listen.ip, () => {
    logger.info(`Using RAGServer at: ${configs.llmServers.rag?.url} (model: ${configs.llmServers.rag?.model})`);
    logger.info(`Using TranslServer at: ${configs.llmServers.translate?.url} (model: ${configs.llmServers.translate?.model})`);
    logger.info(`Using SumServer at: ${configs.llmServers.summarize?.url} (model: ${configs.llmServers.summarize?.model})`);
    logger.info(`Using ThinkServer at: ${configs.llmServers.think?.url} (model: ${configs.llmServers.think?.model})`);
    logger.info(`Using RAGDB at: ${configs.RAGDB?.url}`);
    logger.info(`Using Embedding at: ${configs.embedding.server?.url} (model: ${configs.embedding.server?.model})`);
    logger.info(`UI running at http://${configs.app.listen.ip}:${configs.app.listen.port}`);
    logger.info(`Swagger UI is available at http://${configs.app.listen.ip}:${configs.app.listen.port}/api-swagger`);

  });

  Object.values(enuLLMServices).forEach(installMonitor);
}

init(); 

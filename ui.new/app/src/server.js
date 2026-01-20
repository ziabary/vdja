require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const configManager = require("./utils/configManager");
const db = require("./db");
const { installMonitor } = require("./utils/chatUtils");
const mountRoutes = require("./utils/asyncRouter");

DEFAULT_CONFIG_FILE = "./.config.json";

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
  app.use(express.json({ trustXFF: true }));
  app.set("trust proxy", "172.17.0.0/16");

  const limiter = rateLimit({
    windowMs: configs.app.limiter.window,
    max: configs.app.limiter.maxReq,
    message: configs.app.limiter.errorMessage,
  });
  app.use(limiter);
  app.use(express.json({ limit: configs.app.maxJson }));
  app.use(express.static("public"));

  // Middleware
  app.use((_, res, next) => {
    const originalJson = res.json;
    res.json = function (data) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      originalJson.call(this, data);
    };
    next();
  });

  ///////////////////////////////////////////////////////////////////////
  // Routes
  ///////////////////////////////////////////////////////////////////////
  app.get("/", (req, res) => res.sendFile(path.join(__dirname, "../public", "index.html")));
  const activeRoutes = await mountRoutes([ 
    require("./routes/translate"),
    require("./routes/summarize"),
    require("./routes/file-to-text"),
    // require("./routes/auth")(),
    // require("./routes/rag")(),
    // require("./routes/think")(),
    // require("./routes/stats")(),
  ])

  app.use("/api", activeRoutes)

  app.use((err, req, res, next) => {
    console.error("🔥 Route error:", err);

    if (res.headersSent) {
      res.write("data: [ERROR]: " + err.message);
      return res.done()
    }

    const status = err.status || err.statusCode || 500;

    res.status(status).json({error:{status, message: err.message || "Internal Server Error"}});
  });

  app.listen(configs.app.listen.port, configs.app.listen.ip, () => {
    console.info(`Using LLMServer at: ${configs.llm.RAGServer.url} (model: ${configs.llm.RAGServer.model})`);
    console.info(`Using ThinkServer at: ${configs.llm.ThinkServer.url} (model: ${configs.llm.ThinkServer.model})`);
    console.info(`Using RAGDB at: ${configs.llm.RAGDB.url}`);
    console.info(`Using Embedding at: ${configs.llm.Embedding.url} (model: ${configs.llm.Embedding.model})`);

    console.info(`UI running at http://${configs.app.listen.ip}:${configs.app.listen.port}`);
  });

  Object.keys(configs.llm).forEach((k) => installMonitor(configs.llm[k]));
}

init();

require("dotenv").config();
const express = require("express");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const VLLM_URL = process.env.VLLM_URL || "http://localhost:8000";
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:8002";
const EMBEDDING_URL = process.env.EMBEDDING_URL || "http://localhost:8001";
const VLLM_MODEL = process.env.VLLM_MODEL || "aya";


const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

const limiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'تعداد درخواست‌های وارد از این IP بیش از حد مجاز بوده. اندکی صبر و مجددا تلاش کند'
});
app.use(limiter);

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function (data) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    originalJson.call(this, data);
  };
  next();
});
app.use(express.static("public"));

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public", "index.html"));
});

// Static pages
app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "../login.html"));
});

app.get("/rag.html", (req, res) => {
  res.sendFile(path.join(__dirname, "rag.html"));
});

// Import routes
const translateRoutes = require("./routes/translate");
const summarizeRoutes = require("./routes/summarize");
const upload_text = require("./routes/upload-text");
const ragRoutes = require("./routes/rag");
const authRouter = require("./routes/auth");
const statsRouter = require("./routes/stats");

app.use("/api/auth", authRouter);
app.use("/api", translateRoutes);
app.use("/api", summarizeRoutes);
app.use("/api", ragRoutes);
app.use("/api", upload_text);
app.use("/api", statsRouter);

/********************************************************* */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Using vLLM at: ${VLLM_URL} (model: ${VLLM_MODEL})`);
  console.log(`Using QDrant at: ${QDRANT_URL}`);
  console.log(`Using Embedding at: ${EMBEDDING_URL}`);

  console.log(`UI running at http://localhost:${PORT}`);
});

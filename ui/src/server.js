require("dotenv").config();
const express = require("express");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;
const VLLM_URL = process.env.VLLM_URL || "http://localhost:8000";
const VLLM_MODEL = process.env.VLLM_MODEL || "aya";

// Middleware
app.use(express.json({ limit: '50mb' }));
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

app.use("/api", translateRoutes);
app.use("/api", summarizeRoutes);
app.use("/api", ragRoutes);
app.use("/api", upload_text);

/********************************************************* */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`UI running at http://localhost:${PORT}`);
  console.log(`Using vLLM at: ${VLLM_URL} (model: ${VLLM_MODEL})`);
});

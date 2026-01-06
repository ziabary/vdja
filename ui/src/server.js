require("dotenv").config();
const express = require("express");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;
const VLLM_URL = process.env.VLLM_URL || "http://localhost:8000";
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:8002";
const EMBEDDING_URL = process.env.EMBEDDING_URL || "http://localhost:8001";
const VLLM_MODEL = process.env.VLLM_MODEL || "aya";

const corsOptions = {
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

const limiter = rateLimit({
  windowMs: 3 * 60 * 1000, // 3 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message:
    "تعداد درخواست‌های وارد از این IP بیش از حد مجاز بوده. اندکی صبر و مجددا تلاش کند",
});
app.use(limiter);

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function (data) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
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

if (process.env.OPENID_ISSUER) {
  const session = require("express-session");
  const passport = require("passport");
  const { Strategy: OpenIDConnectStrategy } = require("passport-openidconnect");

  app.use(
    session({
      secret:
        process.env.SESSION_SECRET || "fallback-secret-change-in-production",
      resave: false,
      saveUninitialized: false,
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use('openidconnect', new OpenIDConnectStrategy({
  issuer: process.env.OPENID_ISSUER,  // مثلاً https://your-duende-server.com
  authorizationURL: process.env.OPENID_AUTHORIZATION_URL || `${process.env.OPENID_ISSUER}/authorize`,
  tokenURL: process.env.OPENID_TOKEN_URL || `${process.env.OPENID_ISSUER}/token`,
  userInfoURL: process.env.OPENID_USERINFO_URL || `${process.env.OPENID_ISSUER}/userinfo`,
  clientID: process.env.OPENID_CLIENT_ID,
  clientSecret: process.env.OPENID_CLIENT_SECRET,
  callbackURL: process.env.OPENID_CALLBACK_URL,  // مثلاً http://localhost:3000/api/auth/callback
  scope: 'openid profile email'
}, async (issuer, profile, done) => {
  try {
    const sub = profile.id || profile.sub || profile.claims.sub;
    let user = await db.getUserByOpenID(sub);
    if (!user) {
      const user_key = uuidv4();
      await db.insertUserWithOpenID(user_key, sub);
      user = { user_key };
    }
    await db.updateUserLogin(user.user_key);
    return done(null, { user_key: user.user_key });
  } catch (err) {
    return done(err);
  }
}));

app.get('/api/auth/openid', passport.authenticate('openidconnect'));

app.get('/api/auth/callback', 
  passport.authenticate('openidconnect', { failureRedirect: '/login.html' }),
  (req, res) => {
    res.redirect('/rag.html'); 
  }
);

app.get('/api/auth/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/login.html');
  });
});
}

/********************************************************* */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Using vLLM at: ${VLLM_URL} (model: ${VLLM_MODEL})`);
  console.log(`Using QDrant at: ${QDRANT_URL}`);
  console.log(`Using Embedding at: ${EMBEDDING_URL}`);

  const db = require("./services/db");
  db.initSchema().catch((err) => {
    console.error("Error initializing DB schema:", err);
    process.exit(1);
  });

  console.log(`UI running at http://localhost:${PORT}`);
});

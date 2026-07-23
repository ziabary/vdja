const express = require("express");
const { v4: uuidv4 } = require("uuid");
const db = require("../services/db");
const { Issuer } = require("openid-client");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const router = express.Router();
let issuer;

async function initOIDC() {
  issuer = await Issuer.discover(process.env.OPENID_ISSUER);

  client = new issuer.Client({
    client_id: process.env.OPENID_CLIENT_ID,
    client_secret: process.env.OPENID_CLIENT_SECRET,
    redirect_uris: [process.env.OPENID_CALLBACK_URL],
    response_types: ["code"],
  });
}

router.post("/login", async (req, res) => {
  try {
    let user_key = req.body.user_key || uuidv4();
    if (req.body.user_key && req.body.user_key.length < 16) {
      return res.status(400).json({ error: "کلید نامعتبر" });
    }
    const existingUser = await db.getUser(user_key);
    if (!existingUser) {
      await db.insertUser(user_key);
      console.log(`New user added: ${user_key.slice(0, 8)}...`);
    } else {
      await db.updateUserLogin(user_key);
      console.log(`User logged in: ${user_key.slice(0, 8)}...`);
    }

    issueKeyJwt(res, {
      type: "key",
      user_key,
    });

    res.json({ success: true });
    //    res.json({ success: true, user_key });
  } catch (err) {
    console.error("Error in login:", err);
    res.status(500).json({ error: "خطا در ورود" });
  }
});



router.get("/me", authMiddleware, (req, res) => {
  res.json({ authenticated: true, user: req.user });
});

router.get("/isLoggedIn", async (req, res) => {
  let user_key = req.body.user_key || uuidv4();
  if (req.body.user_key && req.body.user_key.length != 32)
    return res.status(400).json({ error: "کلید نامعتبر" });
});

 // Full server-side Authorization Code Flow with PKCE
router.get("/login-by-oauth", async (req, res) => {
   // Generate PKCE challenge
   const codeVerifier = crypto.randomBytes(32).toString("hex");
   const codeChallenge = base64URLEncode(sha256(codeVerifier));

   // Generate state to prevent CSRF
   const state = crypto.randomBytes(16).toString("hex");

   // Store code_verifier and state in server session or cookie
   res.cookie("pkce_code_verifier", codeVerifier, { httpOnly: true, secure: false });
   res.cookie("auth_state", state, { httpOnly: true, secure: false });

   // Construct authorization URL
   const authUrl = client.authorizationUrl({
     client_id: process.env.OPENID_CLIENT_ID,
     redirect_uri: process.env.OPENID_CALLBACK_URL,
     response_type: "code",
     scope: "openid profile TargomanApi UserManagementApi",
     state,
     code_challenge: codeChallenge,
     code_challenge_method: "S256",
     response_mode: "query"
   });

   console.log({authUrl})

   res.redirect(authUrl);
 });

 // Helper functions for PKCE
 function sha256(buffer) {
   return crypto.createHash("sha256").update(buffer).digest();
 }

 function base64URLEncode(buffer) {
   return buffer.toString("base64")
     .replace(/\+/g, "-")
     .replace(/\//g, "_")
     .replace(/=+$/, "");
 }


router.get("/callback", async (req, res) => {
    try {
     const params = client.callbackParams(req);
     if (!params.code) 
       return res.status(400).send("No authorization code received");

     console.log(req.cookies)
     // Retrieve PKCE code_verifier and state from cookies
     const codeVerifier = req.cookies["pkce_code_verifier"];
     const originalState = req.cookies["auth_state"];

     if (!codeVerifier || !originalState) {
       return res.status(400).send("Missing PKCE code_verifier or state");
     }


     console.log({params, codeVerifier, originalState})

     // Exchange code for tokens using PKCE
     const tokenSet = await client.callback(
       process.env.OPENID_CALLBACK_URL,
       params,
       { 
        code_verifier: codeVerifier,
        state: originalState

       } // PKCE verifier
     );

     console.log("TokenSet received:", tokenSet);

     // Extract user claims
     const userClaims = tokenSet.claims();

     // Issue your own session token
     const sessionToken = jwt.sign(userClaims, process.env.JWT_SECRET);
     res.cookie("session_token", sessionToken, { httpOnly: true, secure: true, sameSite: "lax" });

     res.redirect("/rag.html");
   } catch (err) {
     console.error("OIDC callback error:", err);
     res.status(500).send("Authentication failed");
   }
});

function issueKeyJwt(res, payload) {
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "8h",
  });

  res.cookie("key_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });
}

async function authMiddleware(req, res, next) {
  try {
    let claims = null;

    // 1. Check Authorization header (Bearer)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        // Try OIDC ID Token verification first
        claims = await client.verifyIdToken(token);
      } catch (err) {
        // fallback: maybe it's a server JWT
        claims = jwt.verify(token, process.env.JWT_SECRET);
      }
    }

    // 2. Check server-issued cookies
    if (!claims && req.cookies?.key_token) {
      claims = jwt.verify(req.cookies.key_token, process.env.JWT_SECRET);
    }

    if (!claims && req.cookies?.session_token) {
      claims = jwt.verify(req.cookies.session_token, process.env.JWT_SECRET);
    }

    if (!claims) return res.status(401).json({ error: "Unauthorized" });

    req.user = claims;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(401).json({ error: "Unauthorized" });
  }
}


module.exports = { initOIDC, router, authMiddleware };

Ah! That’s an important point: right now, your `session_token` (and `key_token`) are **HTTP-only cookies**, which is why your client-side JavaScript **cannot read them directly**. This is intentional for security, because it prevents XSS attacks from stealing your JWTs.

Here’s how you can **use the token from the client side** safely:

---

### **Option 1: Use cookies automatically with `fetch` or Axios (recommended)**

Since the token is in an HTTP-only cookie, the browser will automatically send it with requests **if you include credentials**:

```js
// Using fetch
fetch("/api/auth/me", {
  method: "GET",
  credentials: "include", // <-- this sends cookies
})
  .then(res => res.json())
  .then(data => console.log(data));
```

* `authMiddleware` on the server reads the cookie and authenticates the request.
* Your client never sees the token directly.
* Safer, prevents XSS stealing.

If using **Axios**:

```js
axios.get("/api/auth/me", { withCredentials: true })
  .then(res => console.log(res.data));
```

---

### **Option 2: Send token in JSON response (if you need it in JS)**

If you truly need access to the token in your frontend JS:

1. Modify `/callback` to **return the token** after login:

```diff
- res.redirect("/dashboard");
+ res.json({ success: true, session_token: sessionToken });
```

2. Frontend can now store it in `localStorage` or `sessionStorage`:

```js
const token = response.session_token;
localStorage.setItem("session_token", token);

// Use it in Authorization header for API requests
fetch("/api/protected", {
  headers: {
    Authorization: `Bearer ${token}`
  }
});
```

⚠️ **Security note:** Storing tokens in `localStorage` is less safe than HTTP-only cookies because they can be stolen by XSS. Only use this if you need access to the token in JS.

---

### ✅ **Recommended approach**

* Keep `httpOnly: true` cookies (`session_token` / `key_token`).
* Use `fetch` or Axios with `credentials: "include"` or `withCredentials: true`.
* Server middleware reads the cookie and authorizes the request.

No need for client-side JS to read the token at all, and your login flow stays secure.

---

If you want, I can give you a **ready-to-use frontend example** that works with your current setup, **automatically sending cookies to authenticate**.

Do you want me to do that?

import express from "express";
import { localReturnPath, signOIDCFlow, readOIDCFlow, oidcLoginPage, type OIDCFlow } from "../utils/oidcFlow";
import type { Request, Response, Router } from "express";

import { randomUUID } from "crypto";
import md5 from "md5";
import ms, { type StringValue } from 'ms';
import * as oidc from "openid-client";

import atDB from "../db/atDB";
import logger from "../utils/logger"
import configManager from "../utils/configManager"
import { exHttpAccessDenied, exHttpConflict, exHttpInternalServerError, exHttpInvalidParams, exHttpUnauthorized, type IntfExHttp } from "../interfaces/exHttp";
import { createAccessToken, createRefreshToken, getAuthInfo, verifyRefreshToken } from "../services/authService";
import type { IntfUser } from "../db/tables/tblUser";
import { parseQueryToString } from "../utils/common";

const router: Router = express.Router();
let openIDClient: oidc.Configuration;

function allowInsecureOidcHttp(): boolean {
  return Boolean(configManager.active().OIDC.allowInsecureHttp || process.env.NODE_ENV === 'development');
}

interface AuthRequestBody {
  userKeyMD5: string;
  [key: string]: string
}

function normalizeEmail(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const email = String(value).trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new exHttpInvalidParams('نشانی ایمیل معتبر نیست');
  return email;
}

function isUniqueConstraintError(error: unknown): boolean {
  const item = error as { code?: string | number; number?: number; errno?: number; message?: string };
  return item?.code === '23505'
    || item?.code === 'ER_DUP_ENTRY'
    || item?.errno === 1062
    || item?.number === 2601
    || item?.number === 2627
    || /unique constraint|duplicate key|duplicate entry/i.test(item?.message || '');
}


/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 */

/**
 * @swagger
 * /auth/loginByKey:
 *   post:
 *     summary: User login using a user key (MD5)
 *     description: Authenticates a user by their MD5 user key and service, and returns a JWT token. If the user does not exist, a new one is created. The user must have access to the specified service.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userKeyMD5:
 *                 type: string
 *                 format: md5
 *                 description: The user's 32-character MD5 key
 *                 example: 0123456789abcdef0123456789abcdef
 *               service:
 *                 type: string
 *                 description: The service the user is trying to access
 *                 example: translation
 *     responses:
 *       200:
 *         description: Login successful, JWT token is returned
 *         content:
 *           application/json:
 *             example:
 *               token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx"
 *       400:
 *         description: Invalid user key format
 *         content:
 *           application/json:
 *             example:
 *               error: "Invalid Key"
 *       403:
 *         description: User does not have access to the specified service
 *         content:
 *           application/json:
 *             example:
 *               error: "شما به این سرویس دسترسی ندارید"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               error: "خطا در ورود: Some error message"
 */
router.post("/auth/loginByKey", async (apiReq: Request<{}, {}, AuthRequestBody>, apiRes: Response) => {
  const { userKeyMD5, service } = apiReq.body;
  try {
    if (!userKeyMD5.match(/^[a-fA-F0-9]{32}$/))
      throw new exHttpInvalidParams("Invalid Key")

    let user: Partial<IntfUser> = await atDB.user.getDigesting(userKeyMD5, false, true);
    if (!user) {
      await atDB.user.addUser(userKeyMD5),
        user = await atDB.user.getDigesting(userKeyMD5, false, true);
      if (!user)
        throw new exHttpInternalServerError("امکان ایجاد کاربر جدید به دلایل فنی وجود ندارد")
      await atDB.perUserStats.initialize(service || "no service", user.usrID!)
    } else
      await atDB.user.updateLastLogin(userKeyMD5);

    if (service !== '/' && !user.privs?.services?.hasOwnProperty(service || "no service"))
      throw new exHttpAccessDenied("شما به این سرویس دسترسی ندارید")

    atDB.log.add(userKeyMD5, "login", { service }, 0, 200)
    await sendJWT(user, apiRes)
  } catch (err) {
    atDB.log.add(userKeyMD5, "login", { service }, 0, (err as IntfExHttp).status, (err as IntfExHttp).message)
    logger.error("Error in login:", err);
    apiRes.status(500).json({ error: "خطا در ورود: " + (err as Error).message });
  }
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Log out a user
 *     description: This endpoint allows a user to log out by using the `refreshToken` stored in cookies. It verifies the token, logs the user out, and returns a success message.
 *     responses:
 *       200:
 *         description: Successfully logged out
 *         content:
 *           application/json:
 *             example:
 *               success: "ok"
 *     cookies:
 *       refreshToken:
 *         type: string
 *         description: The refresh token used to verify the user's session
 *         example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx"
 *     security:
 *       - BearerAuth: []  
 *     tags:
 *       - Authentication
 */
router.post("/auth/logout", async (apiReq: Request, apiRes: Response) => {
  const { refreshToken } = apiReq.cookies;
  try {
    const payload = verifyRefreshToken(refreshToken);
    atDB.log.add(payload.key, "login", null, 0, 200)
    await atDB.user.logoutByToken(payload.key)
    await atDB.user.updateRefreshHash(payload.key, "")
  } catch { }
  apiRes.clearCookie("refreshToken", { path: "/api/", httpOnly: true, secure: true, sameSite: "strict" });
  apiRes.send({ success: "ok" })
})


/**
 * @swagger
 * /auth/oidc/login:
 *   get:
 *     summary: Initiate OpenID Connect (OIDC) login flow
 *     description: This endpoint starts the OIDC authentication process by generating a PKCE code verifier and challenge, and redirecting the user to the OpenID Connect provider. A secure cookie is set to store the session data for the login flow.
 *     parameters:
 *       - in: query
 *         name: service
 *         description: The service the user is trying to access
 *         required: false
 *         example: /api/v1
 *     responses:
 *       302:
 *         description: Redirects the user to the OpenID Connect provider for authentication
 *     tags:
 *       - Authentication
 */
router.get("/auth/methods", (_apiReq: Request, apiRes: Response) => {
  apiRes.setHeader("Cache-Control", "no-store");
  apiRes.json({ oidc: configManager.active().OIDC.active });
});

router.get("/auth/oidc/login", async (apiReq: Request, apiRes: Response) => {
  if (!configManager.active().OIDC.active)
    return apiRes.redirect("/login?error=oidc_disabled");
  if (!openIDClient)
    return apiRes.redirect("/login?error=oidc_unavailable");

  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
  const service = typeof apiReq.query.service === 'string' && apiReq.query.service
    ? apiReq.query.service : 'rag';
  const flow: OIDCFlow = {
    codeVerifier,
    state: oidc.randomState(),
    nonce: oidc.randomNonce(),
    service,
    back: localReturnPath(apiReq.query.back || service),
    mustAdmin: apiReq.query.mustAdmin === '1',
    mustVerified: apiReq.query.mustVerified === '1',
  };

  const url = oidc.buildAuthorizationUrl(openIDClient, {
    client_id: configManager.active().OIDC.clientId,
    redirect_uri: configManager.active().OIDC.callbackUri,
    response_type: "code",
    scope: configManager.active().OIDC.scope,
    state: flow.state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    response_mode: "query",
    nonce: flow.nonce,
  });

  apiRes.cookie("oidc_flow", signOIDCFlow(flow, configManager.active().jwt.baseSecret), {
    httpOnly: true,
    secure: !allowInsecureOidcHttp(),
    sameSite: "lax",
    path: "/api/auth/oidc",
    maxAge: 5 * 60 * 1000
  });
  apiRes.setHeader("Cache-Control", "no-store");
  apiRes.redirect(url.toString());
});

/**
 * @swagger
 * /auth/oidc/callback:
 *   get:
 *     summary: Handle OpenID Connect (OIDC) callback after user authentication
 *     description: This route is used to process the callback from the OpenID Connect provider after a user has been authenticated. It validates the state, exchanges the authorization code for tokens, and creates or updates a user in the system if the authentication is successful.
 *     parameters:
 *       - in: query
 *         name: code
 *         description: The authorization code provided by the OpenID Connect provider.
 *         required: true
 *         type: string
 *       - in: query
 *         name: state
 *         description: The state value that was sent in the initial request to the OpenID Connect provider. It is used to prevent CSRF attacks.
 *         required: true
 *         type: string
 *       - in: query
 *         name: nonce
 *         description: A value that is used to associate a client session with the ID Token, and to mitigate replay attacks.
 *         required: true
 *         type: string
 *     responses:
 *       302:
 *         description: Redirect to the login page to complete the internal session, or display an authentication error.
 *         content:
 *           text/html:
 *             example: <a href="/login.html?error=missing_flow">Redirecting...</a>
 *     tags:
 *       - Authentication
 */
router.get("/auth/oidc/callback", async (apiReq: Request, apiRes: Response) => {
  apiRes.setHeader("Cache-Control", "no-store");
  apiRes.clearCookie("oidc_flow", { path: "/api/auth/oidc" });
  if (!configManager.active().OIDC.active)
    return apiRes.redirect("/login?error=oidc_disabled");
  if (!openIDClient)
    return apiRes.redirect("/login?error=oidc_unavailable");
  const cookie = apiReq.cookies.oidc_flow;
  if (!cookie)
    return apiRes.redirect("/login.html?error=missing_flow");

  let flow: OIDCFlow;
  try {
    flow = readOIDCFlow(cookie, configManager.active().jwt.baseSecret);
  } catch {
    return apiRes.redirect("/login.html?error=invalid_flow_state");
  }

  const { codeVerifier, state: savedState, nonce: savedNonce, service } = flow;

  try {
    // Use the registered public URI, independent of reverse-proxy Host/protocol.
    const currentUrl = new URL(configManager.active().OIDC.callbackUri);
    currentUrl.search = new URL(apiReq.originalUrl, 'https://local.invalid').search;

    const tokenSet = await oidc.authorizationCodeGrant(openIDClient, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedState: savedState,
      expectedNonce: savedNonce,
      idTokenExpected: true,
    });

    // Optional: access claims directly (id_token is already validated)
    const claims = tokenSet.claims();
    const openId = claims?.sub;
    if (!openId)
      throw new exHttpAccessDenied("امکان ارتباط با سرور احراز هویت وجود ندارد")

    // You can also read email/name from claims instead of separate userinfo call
    const email = normalizeEmail(claims.email);
    const name = typeof claims.name === 'string' ? claims.name : undefined;

    let user: Partial<IntfUser> | undefined = await atDB.user.getDigesting(openId, true, true);
    if (!user) {
      if (email) {
        const emailOwner = await atDB.user.findByEmail(email);
        if (emailOwner)
          throw new exHttpConflict('این ایمیل قبلاً برای حساب دیگری ثبت شده است');
      }
      try {
        await atDB.user.addUser(md5(randomUUID()), email, undefined, openId, name);
      } catch (error) {
        if (isUniqueConstraintError(error))
          throw new exHttpConflict(email
            ? 'این ایمیل قبلاً برای حساب دیگری ثبت شده است'
            : 'شناسه این حساب قبلاً ثبت شده است');
        throw error;
      }
      user = await atDB.user.getDigesting(openId, true, true);
      if (!user)
        throw new exHttpInternalServerError("امکان ایجاد کاربر جدید به دلایل فنی وجود ندارد")
      await atDB.perUserStats.initialize(service, user.usrID!)
    } else
      await atDB.user.updateLastLogin(user.usrKey!);

    if (service !== "/" && !user.privs?.services?.hasOwnProperty(service))
      throw new exHttpAccessDenied("شما به این سرویس دسترسی ندارید")

    atDB.log.add(user.usrKey!, "login", { service, oidc_flow: "success" }, 0, 200)

    await sendJWT(user, apiRes, oidcLoginPage(flow, "complete"))
  } catch (err) {
    atDB.log.add("", "oidc_callback_error", { service, error: String(err) }, 0, 401, String(err))
    logger.error({ oidc: err });
    const error = err instanceof exHttpConflict ? 'oidc_conflict'
      : err instanceof exHttpAccessDenied ? 'oidc_denied' : 'oidc';
    apiRes.redirect(oidcLoginPage(flow, "error", error));
  }
});

async function sendJWT(user: Partial<IntfUser>, apiRes: Response, redirectTo?: string) {
  const accessToken = createAccessToken(user);
  const refreshToken = await createRefreshToken(user);

  const ttlRaw = configManager.active().jwt.refreshTTL
  const cookieMaxAge = typeof ttlRaw === 'number' ? ttlRaw * 1000 : ms(ttlRaw as StringValue);

  apiRes.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: !allowInsecureOidcHttp(),
    sameSite: "strict",
    path: "/api/",
    ...(cookieMaxAge ? { maxAge: cookieMaxAge } : {}),
  });
  apiRes.setHeader("Cache-Control", "no-store");
  if (redirectTo) apiRes.redirect(redirectTo);
  else apiRes.json({ accessToken });
}

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh an access token using a valid refresh token
 *     description: This route is used to issue a new access token for a user by validating the provided refresh token. The user must have a valid session, and the service must be specified in the request to ensure access control.
 *     parameters:
 *       - in: cookie
 *         name: refreshToken
 *         description: A valid refresh token that was previously issued to the user.
 *         required: true
 *         type: string
 *       - in: query
 *         name: service
 *         description: The service for which the user is requesting a new access token. This is used to check if the user has access to the service.
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: A new access token (JWT) is sent in the response.
 *         content:
 *           application/json:
 *             example:
 *               token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx"
 *       401:
 *         description: The refresh token is invalid, expired, or the user is not found.
 *         content:
 *           application/json:
 *             example:
 *               error: "کاربر یافت نشد یا متوقف شده"
 *       403:
 *         description: The user does not have access to the requested service.
 *         content:
 *           application/json:
 *             example:
 *               error: "شما به این سرویس دسترسی ندارید"
 *     security:
 *       - None: []
 *     tags:
 *       - Authentication
 */
router.post("/auth/refresh", async (apiReq: Request, apiRes: Response) => {
  const { refreshToken } = apiReq.cookies;
  const { service } = apiReq.query

  const payload = verifyRefreshToken(refreshToken);

  const user = await atDB.user.verifyRefreshToken(payload.key, refreshToken);
  if (!user) throw new exHttpUnauthorized("کاربر یافت نشد یا متوقف شده");

  if (service !== "/" && !user.privs?.services?.hasOwnProperty(parseQueryToString(service) || "not set"))
    throw new exHttpAccessDenied("شما به این سرویس دسترسی ندارید")

  await sendJWT(user, apiRes)
});


function normalizeProfileAvatar(value: unknown): string {
  const source = String(value || '').trim();
  if (!source) return '';
  if (source.length > 350000) throw new exHttpInvalidParams('تصویر پروفایل بیش از حد بزرگ است');
  if (/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(source)) return source;
  try {
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('invalid image URL');
    return url.href;
  } catch {
    throw new exHttpInvalidParams('تصویر پروفایل باید PNG، JPEG یا WebP بارگذاری‌شده یا نشانی HTTPS معتبر باشد');
  }
}

function profileDTO(user: Partial<IntfUser>) {
  return {
    id: user.usrID,
    name: user.usrName || '',
    username: user.usrUsername || '',
    avatar: user.usrAvatar || '',
    organization: user.usrOrganization || '',
    title: user.usrTitle || '',
    email: user.usrEmail || '',
    mobile: user.usrMobile || '',
    createdAt: user.usrCreatedAt,
  };
}

router.get('/auth/profile', async (apiReq: Request, apiRes: Response) => {
  const auth = await getAuthInfo(apiReq);
  const user = await atDB.user.getByID(auth.uid, true);
  if (!user) throw new exHttpUnauthorized('کاربر یافت نشد');
  apiRes.json({ profile: profileDTO(user) });
});

router.put('/auth/profile', async (apiReq: Request, apiRes: Response) => {
  const auth = await getAuthInfo(apiReq);
  const body = apiReq.body || {};
  const name = body.name === undefined ? undefined : String(body.name || '').trim();
  const username = body.username === undefined ? undefined : String(body.username || '').trim().toLowerCase();
  const avatar = body.avatar === undefined ? undefined : normalizeProfileAvatar(body.avatar);
  const organization = body.organization === undefined ? undefined : String(body.organization || '').trim();
  const title = body.title === undefined ? undefined : String(body.title || '').trim();

  if (name !== undefined && name.length > 50) throw new exHttpInvalidParams('نام حداکثر می‌تواند ۵۰ کاراکتر باشد');
  if (username !== undefined) {
    if (username && !/^[a-z][a-z0-9_-]{2,31}$/.test(username))
      throw new exHttpInvalidParams('نام کاربری باید ۳ تا ۳۲ کاراکتر و شامل حروف انگلیسی، عدد، خط تیره یا زیرخط باشد');
    if (username.startsWith('widget-')) throw new exHttpInvalidParams('پیشوند widget- برای کاربران سیستمی رزرو شده است');
    if (username) {
      const existing = await atDB.user.findByUsername(username, true);
      if (existing && existing.usrID !== auth.uid) throw new exHttpConflict('این نام کاربری قبلاً استفاده شده است');
    }
  }
  if (organization !== undefined && organization.length > 100) throw new exHttpInvalidParams('نام سازمان حداکثر می‌تواند ۱۰۰ کاراکتر باشد');
  if (title !== undefined && title.length > 100) throw new exHttpInvalidParams('عنوان شغلی حداکثر می‌تواند ۱۰۰ کاراکتر باشد');

  try {
    await atDB.user.updateProfile(auth.uid, { name, username, avatar, organization, title });
  } catch (error) {
    // The database unique index closes the race between validation and update.
    if (isUniqueConstraintError(error)) throw new exHttpConflict('این نام کاربری قبلاً استفاده شده است');
    throw error;
  }
  const user = await atDB.user.getByID(auth.uid, true);
  if (!user) throw new exHttpUnauthorized('کاربر یافت نشد');
  apiRes.json({ profile: profileDTO(user), accessToken: createAccessToken(user) });
});

function normalizePhone(mobile: unknown) {
  const faDigits = '۰۱۲۳۴۵۶۷۸۹';
  const arDigits = '٠١٢٣٤٥٦٧٨٩';
  const source = String(mobile || '')
    .replace(/[۰-۹]/g, digit => String(faDigits.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String(arDigits.indexOf(digit)))
    .replace(/[\s()-]/g, '');
  const match = source.match(/^(?:\+98|0)?(9\d{9})$/);
  if (!match) throw new exHttpInvalidParams("شماره موبایل نامعتبر است");
  return `98${match[1]}`;
}

/**
 * @swagger
 * /auth/generateAccessToken:
 *   post:
 *     summary: Generate a new access token (JWT) for a client
 *     description: This route is used to generate a new access token (JWT) for a client by providing a `client_id` and a `secret`. The system validates the `client_id` and `secret` against a user in the database. If valid, a new JWT is issued for the user.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               client_id:
 *                 type: string
 *                 description: A unique identifier for the client
 *                 example: "1234567890"
 *               secret:
 *                 type: string
 *                 description: A shared secret key for the client
 *                 example: "s3cr3tK3yF0rC13nt" 
 *     responses:
 *       200:
 *         description: A new access token (JWT) is sent in the response
 *         content:
 *           application/json:
 *             example:
 *               token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx"
 *       401:
 *         description: Invalid or mismatched `client_id` or `secret`
 *         content:
 *           application/json:
 *             example:
 *               error: "Invalid clientID or Secret"
 *     tags:
 *       - API Access
 */
router.post("/auth/generateAccessToken", async (apiReq: Request, apiRes: Response) => {
  const { secret, client_id } = apiReq.body
  const user : Partial<IntfUser> = await atDB.user.getDigesting(secret, false, true)
  if (!user) throw new exHttpUnauthorized("Invalid clientID or Secret")
  if (md5(user.usrID + '').substring(0,6) !== client_id)
      throw new exHttpUnauthorized("Invalid clientId or Secret")
  atDB.log.add(user.usrKey!, "login", "generateAccessToken", 0, 200)
  if(!user.privs?.apiAccess)
    throw new exHttpUnauthorized("You are ot allowed to use API" + JSON.stringify(user))
  return await sendJWT(user, apiRes)
})

/**
 * @swagger
 * /auth/sendBaleOTP:
 *   post:
 *     summary: Send a one-time password (OTP) via Bale to a mobile number
 *     description: This route is used to send a 5-digit OTP to a user's mobile number using the Bale API. The OTP is stored in the system and can be used for authentication or verification purposes.
 *     parameters:
 *       - in: body
 *         name: body
 *         required: true
 *         description: JSON object containing the user's mobile number
 *         schema:
 *           type: object
 *           properties:
 *             mobile:
 *               type: string
 *               description: The user's mobile number
 *               example: "09123456789"
 *     responses:
 *       200:
 *         description: OTP was successfully sent to the mobile number
 *         content:
 *           application/json:
 *             example:
 *               message: "OTP sent successfully"
 *               status: "success"
 *       400:
 *         description: Mobile number is missing or invalid
 *         content:
 *           application/json:
 *             example:
 *               error: "موبایل یا کد ارایه‌ نشده‌اند"
 *       403:
 *         description: An error occurred while sending the OTP
 *         content:
 *           application/json:
 *             example:
 *               error: "Error message from Bale API"
 *     tags:
 *       - Authentication
 */
router.post("/auth/sendBaleOTP", async (apiReq: Request, apiRes: Response) => {
  const { mobile } = apiReq.body

  if (!mobile)
    throw new exHttpInvalidParams("موبایل یا کد ارایه‌ نشده‌اند")

  const phone = normalizePhone(mobile)
  //step 0 get authToken
  const payload = new URLSearchParams();
  payload.append("grant_type", "client_credentials");
  payload.append("client_id", configManager.active().baleOTP.gwID);
  payload.append("client_secret", configManager.active().baleOTP.gwSecret);
  payload.append("scope", "read")

  try {
    const authToken = await fetch("https://safir.bale.ai/api/v2/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload
    }).then(r => r.json());

    const otpCode = Math.floor(10000 + Math.random() * 90000)
    await atDB.user.setOTP(phone, `${otpCode}`)

    const resp = await fetch("https://safir.bale.ai/api/v2/send_otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken.access_token}`
      },
      body: JSON.stringify({
        phone,
        otp: otpCode
      })
    }).then(r => r.json());

    apiRes.send(resp)
  } catch (e) {
    console.error(e);
    throw new exHttpAccessDenied((e as Error).message)
  }
})


/**
 * @swagger
 * /auth/verifyOTP:
 *   post:
 *     summary: Verify a one-time password (OTP) for a user
 *     description: This route is used to verify a 5-digit OTP that was previously sent to a user's mobile number. If the OTP is valid, a new JWT is issued to the user for further access to the system.
 *     parameters:
 *       - in: body
 *         name: body
 *         required: true
 *         description: JSON object containing the user's mobile number, OTP, and the service for which the user is logging in
 *         schema:
 *           type: object
 *           properties:
 *             mobile:
 *               type: string
 *               description: The user's mobile number
 *               example: "09123456789"
 *             otp:
 *               type: string
 *               description: The one-time password (OTP) sent to the user
 *               example: "12345"
 *             service:
 *               type: string
 *               description: The service the user is trying to access
 *               example: "myapp"
 *     responses:
 *       200:
 *         description: OTP is valid, and a JWT is sent in the response
 *         content:
 *           application/json:
 *             example:
 *               token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx"
 *       400:
 *         description: Invalid or missing parameters
 *         content:
 *           application/json:
 *             example:
 *               error: "کد وارد شده صحیح نمی‌باشد"
 *     tags:
 *       - Authentication
 */
router.post("/auth/verifyOTP", async (apiReq: Request, apiRes: Response) => {
  const { mobile, otp, service } = apiReq.body
  const phone = normalizePhone(mobile)

  const res = await atDB.user.verifyOTP(phone, otp)
  if (res && res.usrKey) {
    let user: Partial<IntfUser> = await atDB.user.getDigesting(res.usrKey, false, true);
    atDB.log.add(res.usrKey, "login", { service }, 0, 200)
    return await sendJWT(user, apiRes)
  }
  throw new exHttpInvalidParams("کد وارد شده صحیح نمی‌باشد")
})

function initOpenID(): void {
  const OIDC = configManager.active().OIDC
  if (!OIDC?.active) return

  const issuerUrl = new URL(OIDC.issuer);
  const allowInsecureHttp = allowInsecureOidcHttp();
  if (issuerUrl.protocol === 'http:' && !allowInsecureHttp)
    throw new Error('OIDC issuer uses HTTP. Set OIDC.allowInsecureHttp=true only for trusted development networks, or configure HTTPS.');

  async function discover(): Promise<void> {
    try {
      const client = await oidc.discovery(
        issuerUrl,
        OIDC.clientId,
        OIDC.clientSecret,
        OIDC.clientSecret ? oidc.ClientSecretPost(OIDC.clientSecret) : undefined,
        {
          timeout: 30,
          ...(allowInsecureHttp ? { execute: [oidc.allowInsecureRequests] } : {}),
        }
      );
      openIDClient = client;
      logger.info(`OIDC discovered issuer: ${client.serverMetadata().issuer}`);
    } catch (err) {
      logger.warn(`OIDC discovery failed; retrying in 30 seconds: ${String(err)}`);
      setTimeout(() => void discover(), 30_000).unref();
    }
  }

  void discover();
}

export default async function init(): Promise<Router> {
  initOpenID()
  return router;
}

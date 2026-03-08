import express from "express";
import type { Request, Response, Router } from "express";

import { randomUUID } from "crypto";
import md5 from "md5";
import ms, { type StringValue } from 'ms';
import * as oidc from "openid-client";

import atDB from "../db/atDB";
import logger from "../utils/logger"
import configManager from "../utils/configManager"
import { exHttpAccessDenied, exHttpInternalServerError, exHttpInvalidParams, exHttpUnauthorized, type IntfExHttp } from "../interfaces/exHttp";
import { createAccessToken, createRefreshToken, verifyRefreshToken } from "../services/authService";
import type { IntfUser } from "../db/tables/tblUser";
import { parseQueryToString } from "../utils/common";

const router: Router = express.Router();
let openIDClient: oidc.Configuration;

interface AuthRequestBody {
  userKeyMD5: string;
  [key: string]: string
}

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

router.post("/auth/logout", async (apiReq: Request, apiRes: Response) => {
  const { refreshToken } = apiReq.cookies;
  try {
    const payload = verifyRefreshToken(refreshToken);
    atDB.log.add(payload.key, "login", null, 0, 200)
    await atDB.user.logoutByToken(payload.key)
  } catch { }
  apiRes.send({ success: "ok" })
})

router.get("/auth/oidc/login", async (apiReq: Request, apiRes: Response) => {
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
  const { service } = apiReq.query;

  const nonce = oidc.randomNonce()
  const state = oidc.randomState();

  const payload = Buffer.from(
    JSON.stringify({ codeVerifier, state, nonce, service })
  ).toString("base64url");


  apiRes.cookie("oidc_flow", payload, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 5 * 60 * 1000
  });

  const url = oidc.buildAuthorizationUrl(openIDClient, {
    client_id: configManager.active().OIDC.clientId,
    redirect_uri: configManager.active().OIDC.callbackUri,
    response_type: "code",
    scope: configManager.active().OIDC.scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    response_mode: "query",
    nonce,
  });

  apiRes.redirect(url.toString());
});

router.get("/auth/oidc/callback", async (apiReq: Request, apiRes: Response) => {
  const OIDC = configManager.active().OIDC
  const cookie = apiReq.cookies.oidc_flow;
  if (!cookie)
    return apiRes.redirect("/login.html?error=missing_flow");

  let flow: { codeVerifier: string; state: string; nonce: string; service?: string };
  try {
    flow = JSON.parse(Buffer.from(cookie, "base64url").toString());
  } catch {
    apiRes.clearCookie("oidc_flow");
    return apiRes.redirect("/login.html?error=invalid_flow_state");
  }

  const { codeVerifier, state: savedState, nonce: savedNonce, service } = flow;

  if (!service) {
    return apiRes.redirect("/login.html?error=missing_service");
  }
  try {
    apiRes.clearCookie("oidc_flow");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params = new URLSearchParams(apiReq.query as any);
    const currentUrl = new URL(
      `${apiReq.protocol}://${apiReq.get("host")}${apiReq.originalUrl}`
    );

    const tokenSet = await oidc.authorizationCodeGrant(openIDClient, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedState: savedState,
      expectedNonce: savedNonce,
      // idTokenExpected: true,   // optional if you always expect id_token
      // maxAge: 300,        // optional
    });

    // Optional: access claims directly (id_token is already validated)
    const claims = tokenSet.claims();
    const openId = claims?.sub;
    if (!openId)
      throw new exHttpAccessDenied("امکان ارتباط با سرور احراز هویت وجود ندارد")

    // You can also read email/name from claims instead of separate userinfo call
    const email = typeof claims.email === 'string' ? claims.email : undefined;
    const name = typeof claims.name === 'string' ? claims.name : undefined;

    let user: Partial<IntfUser> | undefined = await atDB.user.getDigesting(openId, true);
    if (!user) {
      await atDB.user.addUser(md5(randomUUID()), email, undefined, openId, name),
        user = await atDB.user.getDigesting(openId, true);
      if (!user)
        throw new exHttpInternalServerError("امکان ایجاد کاربر جدید به دلایل فنی وجود ندارد")
      await atDB.perUserStats.initialize(service, user.usrID!)
    } else
      await atDB.user.updateLastLogin(openId);

    if (!user.privs?.services?.hasOwnProperty(service))
      throw new exHttpAccessDenied("شما به این سرویس دسترسی ندارید")

    atDB.log.add(user.usrKey!, "login", { service, oidc_flow: "success" }, 0, 200)

    await sendJWT(user, apiRes)
  } catch (err) {
    atDB.log.add("", "oidc_callback_error", { service, error: String(err) }, 0, 401, String(err))
    logger.error({ oidc: err });
    apiRes.redirect(`/login.html?error=oidc&msg=${encodeURIComponent((err as Error)?.message || "خطای احراز هویت")}`);
  }
});

async function sendJWT(user: Partial<IntfUser>, apiRes: Response) {
  const accessToken = createAccessToken(user);
  const refreshToken = await createRefreshToken(user);

  const ttlRaw = configManager.active().jwt.refreshTTL
  const expiresInSeconds = (typeof ttlRaw === 'number' ? ttlRaw : ms(ttlRaw as StringValue)) // 1000;

  apiRes.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/api/",
    ...(expiresInSeconds ? { maxAge: expiresInSeconds } : {}),
  });
  apiRes.json({ accessToken });
}


router.post("/auth/refresh", async (apiReq: Request, apiRes: Response) => {
  const { refreshToken } = apiReq.cookies;
  const { service } = apiReq.query

  const payload = verifyRefreshToken(refreshToken);

  const user = await atDB.user.verifyRefreshToken(payload.key, refreshToken);
  if (!user) throw new exHttpUnauthorized("کاربر یافت نشد یا متوقف شده");

  if (!user.privs?.services?.hasOwnProperty(parseQueryToString(service) || "not set"))
    throw new exHttpAccessDenied("شما به این سرویس دسترسی ندارید")

  await sendJWT(user, apiRes)
}); 

function normalizePhone(mobile) {
  if ((!mobile.startsWith("+98") && !mobile.startsWith("0"))
    || (mobile.startsWith("+98") && mobile.length != 13)
    || (mobile.startsWith("0") && mobile.length != 11)
  )
    throw new exHttpInvalidParams("شماره موبایل نامعتبر است")

  return (mobile.startsWith("0") ? `98` : "") + mobile.substring(1)
}

router.post("/auth/sendBaleOTP", async (apiReq: Request, apiRes: Response) => {
  const { mobile } = apiReq.body

  if(!mobile)
    throw new exHttpInvalidParams("موبایل یا کد ارایه‌ نشده‌اند")

  const phone = normalizePhone(mobile)
  //step 0 get authToken
  const payload = new URLSearchParams();
  payload.append("grant_type", "client_credentials");
  payload.append("client_id", configManager.active().baleOTP.gwID);
  payload.append("client_secret", configManager.active().baleOTP.gwSecret);
  payload.append("scope","read")

  try {
    const authToken = await fetch("https://safir.bale.ai/api/v2/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload
    }).then(r=>r.json());

    const otpCode = Math.floor(10000 + Math.random() * 90000)
    atDB.user.setOTP(phone, `${otpCode}`)

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
    }).then(r=>r.json());

    apiRes.send(resp)
  } catch (e) {
    console.error(e);
    throw new exHttpAccessDenied((e as Error).message)    
  }
})

router.post("/auth/verifyOTP", async (apiReq: Request, apiRes: Response) => {
  const { mobile, otp, service } = apiReq.body
  const phone = normalizePhone(mobile)

  const res = await atDB.user.verifyOTP(phone, otp)
  if(res && res.usrKey) {
    let user: Partial<IntfUser> = await atDB.user.getDigesting(res.usrKey, false, true);
    atDB.log.add(res.usrKey, "login", { service }, 0, 200)
    return await sendJWT(user, apiRes)
  }
  throw new exHttpInvalidParams("کد وارد شده صحیح نمی‌باشد")
})

async function initOpenID() {
  const OIDC = configManager.active().OIDC
  if (!OIDC?.active) return

  openIDClient = await oidc.discovery(
    new URL(OIDC.issuer),
    OIDC.clientId,
    OIDC.clientSecret,
    // optional client auth method (default is ClientSecretPost if secret present)
    OIDC.clientSecret ? oidc.ClientSecretPost(OIDC.clientSecret) : undefined,
    // optional options object
    {
      // algorithm: 'oidc',           // default, can be 'oauth2' for plain OAuth
      timeout: 30,                    // seconds
      // execute: [allowInsecureRequests], // only if testing with http
    }
  );
  logger.info(`OIDC discovered issuer: ${openIDClient.serverMetadata().issuer}`);

  /*const issuer = await oidc.discovery(OIDC.issuer);
  openIDClient = new oidc.Client({
    client_id: OIDC.clientId,
    client_secret: OIDC.clientSecret,
    redirect_uris: [OIDC.callbackUri],
    response_types: ["code"],
  });*/
}

export default async function init(): Promise<Router> {
  await initOpenID()
  return router;
}

import express from "express";
import type { Request, Response, Router } from "express";

import { type CookieSerializeOptions } from 'cookie';
import { randomUUID } from "crypto";
import md5 from "md5";
import ms from 'ms';
import * as oidc from "openid-client";

import atDB from "../db/atDB";
import logger from "../utils/logger"
import configManager from "../utils/configManager"
import { exHttpAccessDenied, exHttpInternalServerError, exHttpInvalidParams, exHttpUnauthorized, type IntfExHttp } from "../interfaces/exHttp";
import { createAccessToken, createRefreshToken, verifyRefreshToken } from "../services/authService";
import type { IntfUser } from "../db/tables/tblUser";

const router: Router = express.Router();
let openIDClient: oidc.Client;

interface AuthRequestBody {
  userKeyMD5: string;
}

router.post("/auth/loginByKey", async (apiReq: Request<{}, {}, AuthRequestBody>, apiRes: Response) => {
    const { userKeyMD5, service } = apiReq.body;
  try {
    if(!userKeyMD5.match(/^[a-fA-F0-9]{32}$/))
      throw new exHttpInvalidParams("Invalid Key")

    let user : Partial<IntfUser> = await atDB.user.getDigesting(userKeyMD5, false, true);
    if (!user) {
      await atDB.user.addUser(userKeyMD5),
      user = await atDB.user.getDigesting(userKeyMD5, false, true);
      if(!user)
        throw new exHttpInternalServerError("امکان ایجاد کاربر جدید به دلایل فنی وجود ندارد")
      await atDB.perUserStats.initialize(service, user.usrID!)
    }else 
      await atDB.user.updateLastLogin(userKeyMD5);
    
    if(!user.privs?.services?.hasOwnProperty(service))
      throw new exHttpAccessDenied("شما به این سرویس دسترسی ندارید")

    atDB.log.add(userKeyMD5, "login", {service}, 0, 200)
    await sendJWT(user, apiRes)
  } catch (err) {
    atDB.log.add(userKeyMD5, "login", {service}, 0, (err as IntfExHttp).status, (err as IntfExHttp).message)
    logger.error("Error in login:", err);
    apiRes.status(500).json({ error: "خطا در ورود" });
  }
});

router.post("/auth/logout", async( apiReq: Request, apiRes: Response)=> {
  const { refreshToken } = apiReq.cookies;
  try{
    const payload = verifyRefreshToken(refreshToken);
    atDB.log.add(payload.key, "login", null, 0, 200)
    await atDB.user.logoutByToken(payload.key)
  }catch{}
  apiRes.send({success: "ok"})
})

router.get("/auth/oidc/login", (apiReq: Request, apiRes: Response) => {
  const codeVerifier = oidc.generators.codeVerifier();
  const codeChallenge = oidc.generators.codeChallenge(codeVerifier);
  const { service } = apiReq.query;

  const state = randomUUID();

  const payload = Buffer.from(
    JSON.stringify({ codeVerifier, state })
  ).toString("base64");


  apiRes.cookie("oidc_tmp", payload, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    service,
    maxAge: 5 * 60 * 1000
  });

  const url = oidc.buildAuthorizationUrl(openIDClient, {
    scope: "openid profile email",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256"
  });

  apiRes.redirect(url);
});

router.get("/auth/oidc/callback", async (apiReq: Request, apiRes: Response) => {
    const OIDC = configManager.active().OIDC
    const cookie = apiReq.cookies.oidc_tmp;
    if (!cookie) 
      throw new exHttpUnauthorized("کوکی حذف شده. مجدد تلاش کنید");

    const { codeVerifier, state, service } = JSON.parse(Buffer.from(cookie, "base64").toString());

  try {
    if (apiReq.query.state !== state) 
      throw new exHttpUnauthorized("خطا در شناسایی کاربر");
        
    const params = oidc.getAuthorizationCodeGrantParameters(apiReq);

    const tokenSet = await oidc.authorizationCodeGrant(
        openIDClient,
        new URL(OIDC.redirectUri),
        params,
        { codeVerifier }
      );

    apiRes.clearCookie("oidc_tmp");

    const userInfo = await oidc.fetchUserInfo(
      openIDClient,
      tokenSet.access_token!
    );
    // example fields: sub, email, name
    const openId = userInfo.sub;

    let user: Partial<IntfUser>| undefined = await atDB.user.getDigesting(openId, true);
    if (!user) {
      await atDB.user.addUser(md5(randomUUID()), userInfo.email, undefined, openId, userInfo.name),
      user = await atDB.user.getDigesting(openId, true);
      if(!user)
        throw new exHttpInternalServerError("امکان ایجاد کاربر جدید به دلایل فنی وجود ندارد")
      await atDB.perUserStats.initialize(service, user.usrID!)
    } else 
      await atDB.user.updateLastLogin(openId);

    if(!user.privs?.services?.hasOwnProperty(service))
      throw new exHttpAccessDenied("شما به این سرویس دسترسی ندارید")

    atDB.log.add(user.usrKey!, "login", {service, oidc_token: codeVerifier}, 0, 200)

    await sendJWT(user, apiRes)
  } catch (err) {
    atDB.log.add("", "login", {service, verifier: codeVerifier}, 0, (err as IntfExHttp).status, (err as IntfExHttp).message)
    logger.error({oidc:err});
    apiRes.redirect("/login.html?error=oidc");
  }
});

async function sendJWT(user: Partial<IntfUser>, apiRes: Response) {
    const accessToken = createAccessToken(user);
    const refreshToken = await createRefreshToken(user);

    const refreshTTL = ms(configManager.active().jwt.refreshTTL)
    const cookieOptions : CookieSerializeOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/api/"
    }

    if (refreshTTL) 
      cookieOptions.maxAge = refreshTTL
  
    
    apiRes.cookie("refreshToken", refreshToken, cookieOptions);
    apiRes.json({ accessToken });
}

router.post("/auth/refresh", async (apiReq: Request, apiRes: Response) => {
  const { refreshToken } = apiReq.cookies;
  const { service } = apiReq.query
  
  const payload = verifyRefreshToken(refreshToken);

  const user = await atDB.user.verifyRefreshToken(payload.key, refreshToken);
  if (!user) throw new exHttpUnauthorized("کاربر یافت نشد یا متوقف شده");

  if(!user.privs?.services?.hasOwnProperty(service))
    throw new exHttpAccessDenied("شما به این سرویس دسترسی ندارید")

  await sendJWT(user, apiRes)
});

/****
 async function getAccessToken() {
  const { URLSearchParams } = require("url");

  // Create the form data
  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", BALE_GW_ID);
  params.append("client_secret", BALE_GW_SECRET);

  const resp = await fetch(`https://safir.bale.ai/api/v2/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  }).then((resp) => resp.json());

} 
 
 */

async function initOpenID() {
  const OIDC = configManager.active().OIDC
  if(!OIDC?.active) return 

  const issuer = await oidc.discover(OIDC.issuer);
  openIDClient = new oidc.Client({
    client_id: OIDC.clientId,
    client_secret: OIDC.clientSecret,
    redirect_uris: [OIDC.redirectUri],
    response_types: ["code"],
  });
}

export default async function init(): Promise<Router> {
  await initOpenID()
  return router;
}

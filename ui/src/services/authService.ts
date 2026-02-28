import type { Request } from "express"

import jwt from "jsonwebtoken";
import ms, { type StringValue } from 'ms';
import { exHttpUnauthorized } from "../interfaces/exHttp";
import configManager from "../utils/configManager";
import type { IntfAuth, IntfRefreshTokenPayload } from "../interfaces/auth";
import type { IntfUser } from "../db/tables/tblUser";
import atDB from "../db/atDB";

const { JsonWebTokenError, TokenExpiredError } = jwt;
/* -------------------------------------------------- */
/*                    Token creation                  */
/* -------------------------------------------------- */

export function createAccessToken(user: Partial<IntfUser>) {
  const payload: IntfAuth = {
    uid: user.usrID!,
    key: user.usrKey || "undefined",
    name: user.usrName!,
    privs: user.privs || null
  };
  const ttlRaw = configManager.active().jwt.accessTTL
  const expiresInSeconds = (typeof ttlRaw === 'number' ? ttlRaw : ms(ttlRaw as StringValue)) // 1000;

  return jwt.sign(payload, configManager.active().jwt.baseSecret, { expiresIn: expiresInSeconds });
}

export async function createRefreshToken(user: Partial<IntfUser>) {
  const payload: IntfRefreshTokenPayload = {
    key: user.usrKey!,
    type: "refresh",
  };

  const ttlRaw = configManager.active().jwt.refreshTTL
  const expiresInSeconds = (typeof ttlRaw === 'number' ? ttlRaw : ms(ttlRaw as StringValue)) // 1000;
  const token = jwt.sign(payload, configManager.active().jwt.refreshSecret, { expiresIn: expiresInSeconds });
  await atDB.user.updateRefreshHash(user.usrKey!, token)

  return token;
}

/* -------------------------------------------------- */
/*                      Verification                  */
/* -------------------------------------------------- */

export function getAccessTokenPayload(token: string): IntfAuth {
  return jwt.verify(token, configManager.active().jwt.baseSecret) as IntfAuth;
}

export function verifyRefreshToken(token: string): IntfRefreshTokenPayload {
  const payload = jwt.verify(token, configManager.active().jwt.refreshSecret, { algorithms: ["HS256"] }) as IntfRefreshTokenPayload;

  if (payload.type !== "refresh")
    throw new exHttpUnauthorized("توکن معتبر نیست");

  return payload;
}

/* -------------------------------------------------- */
/*                       AuthInfo                     */
/* -------------------------------------------------- */
export async function getAuthInfo(req: Request, required: boolean = true): Promise<IntfAuth> {
  const auth = req.headers["authorization"]
  const ANONYMOUS_USER = {
    uid: 1,
    key: "undefined",
    name: "undefined",
    privs: null
  }

  if (!auth || !auth.startsWith("Bearer ")) {
    if (required)
      throw new exHttpUnauthorized("توکن ورود یافت نشد");
    else
      return ANONYMOUS_USER
  } else {
    const token = auth.replace("Bearer ", "").trim();
    if (!token || token === "null" || token.length < 10) {
      if (required)
        throw new exHttpUnauthorized("توکن ورود یافت نشد");
      else
        return ANONYMOUS_USER
    }

    try {
      return getAccessTokenPayload(token);
    } catch (ex) {
      if (ex instanceof TokenExpiredError)
        throw new exHttpUnauthorized("توکن منقضی شده است")
      else if (ex instanceof JsonWebTokenError)
        throw new exHttpUnauthorized(`توکن نامعتبر است: ${ex.message}`)
      else
        throw ex
    }
  }
} 
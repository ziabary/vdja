import type { Request } from "express"

import jwt from "jsonwebtoken";
import ms from 'ms';
import { exHttpUnauthorized } from "../interfaces/exHttp";
import configManager from "../utils/configManager";
import type { IntfAuth, IntfRefreshTokenPayload } from "../interfaces/auth";
import type { IntfUser } from "../db/tables/tblUser";
import atDB from "../db/atDB";


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

  return jwt.sign(payload, configManager.active().jwt.baseSecret, { 
    expiresIn: ms(configManager.active().jwt.accessTTL) / 1000 
  });
}

export async function createRefreshToken(user: Partial<IntfUser>) {
  const payload: IntfRefreshTokenPayload = {
    key: user.usrKey!,
    type: "refresh",
  };

  const token = jwt.sign(payload, configManager.active().jwt.refreshSecret, {
    expiresIn: configManager.active().jwt.refreshTTL,
  });

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
  const payload = jwt.verify(token, configManager.active().jwt.refreshSecret) as IntfRefreshTokenPayload;

  if (payload.type !== "refresh")
    throw new exHttpUnauthorized("توکن معتبر نیست");

  return payload;
}

/* -------------------------------------------------- */
/*                       AuthInfo                     */
/* -------------------------------------------------- */
export async function getAuthInfo(req: Request,required:boolean = true): Promise<IntfAuth>{
  const auth = req.headers["authorization"]
  const ANONYMOUS_USER = {
        uid: 1,
        key: "undefined",
        name: "undefined",
        privs: null
      }

  if (!auth || !auth.startsWith("Bearer ")){
    if (required)
      throw new exHttpUnauthorized("توکن ورود یافت نشد");
    else 
      return ANONYMOUS_USER
  } else {
    const token = auth.replace("Bearer ", "").trim();
    if(!token || token === "null") { 
      if(required)
        throw new exHttpUnauthorized("توکن ورود یافت نشد");
      else 
        return ANONYMOUS_USER
    } 

    try{
      return getAccessTokenPayload(token);
    }catch(ex) {
      if ((ex as Error).name === "TokenExpiredError") 
        throw new exHttpUnauthorized("توکن منقضی شده است")
      else throw ex
    }      
  }
} 
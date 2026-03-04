import * as Knex from 'knex'
import type { IntfPrivileges, IntfRefreshTokenPayload } from '../../interfaces/auth';
import { enuBannableStatus, type Select } from '../../interfaces/db';
import { deepMerge } from '../../utils/common';
import { getDB } from '../index';
import group, { VERIFIED_GROUP_ID } from "./tblGroup"
import tblGroup, { DEFAULT_GROUP_ID } from './tblGroup';
import { resolveCols, type IntfGenericListOptions } from '../common';
import md5 from 'md5';

/* =======================
   Columns & Table
======================= */
export const tblName = 'tblUser';

const priv_cols = {
  key: 'usrKey',
  email: 'usrEmail',
  mobile: 'usrMobile',
  openID: 'usrOpenID',
  assigned_grpID: 'usrAssigned_grpID',
  specialPrivs: 'usrSpecialPrivs',
  refreshHash: 'usrRefreshHash',
  otp: 'usrOTP',
  //--------------
  groupPrivs: tblGroup.cols.privs,

} as const;

export const public_cols = {
  id: 'usrID',
  name: 'usrName',
  lastLogin: 'usrLasLogin',
  lastLogout: 'usrLastLogout',
  createdAt: 'usrCreatedAt',
  status: 'usrStatus',
  //--------------
  groupName: tblGroup.cols.name,
  //--------------
  $$COMPILED_PRIVS$$: 'privs'
} as const;

export const cols = {
  ...public_cols,
  ...priv_cols
}


/* =======================
   Types
======================= */

export type IntfUser = {
  [K in keyof typeof cols as typeof cols[K]]:
  K extends 'id' | 'assigned_grpID' | 'activeFileCount' | 'totalUploadedCount' | 'totalChats' | 'activeTotalSize' ? number
  : K extends 'lastLogin' | 'lastLogout' | 'createdAt' ? string | Date | null
  : K extends 'status' ? typeof enuBannableStatus[keyof typeof enuBannableStatus]
  : K extends 'specialPrivs' | 'groupPrivs' | '$$COMPILED_PRIVS$$' ? IntfPrivileges | null
  : string;
};

export type TypUserListItem = Select<IntfUser, typeof public_cols[keyof typeof public_cols]>;

export interface IntfUserListOptions<TCols extends Record<string, string>>
  extends IntfGenericListOptions<TCols> {
  isAdmin?: boolean;
}

/* =======================
   Actions
======================= */

// function list(): Promise<TypUserListItem>;
// function list<T extends readonly (keyof typeof public_cols)[]>(
//   options: IntfUserListOptions<typeof public_cols> & { outCols: T; isAdmin?: false }
// ): Promise<Pick<TypUserListItem, typeof public_cols[T[number]]>>;
// function list(
//   options: IntfUserListOptions<typeof cols> & { isAdmin: true }
// ): Promise<IntfUser>;

// // Implementation
// async function list(
//   options?: IntfUserListOptions<typeof cols>
// ) {
//   const { outCols, isAdmin = false } = options || {};

//   const db = await getDB();
//   const colsToOutput = resolveCols(outCols, true, public_cols, cols);
//   const keyCol = options?.openId ? cols.openID : cols.key;
//   const dbResponse = db<IntfUser>(tblName)
//     .select(colsToOutput.map(c => cols[c as keyof typeof cols]))
//     .where(keyCol, options?.key || 'undefined')
//     .andWhere(group.cols.status, enuBannableStatus.active)
//     .leftJoin(group.tblName, group.cols.id, cols.assigned_grpID)
//     .andWhere(cols.status, enuBannableStatus.active)
//     .first();

//   return dbResponse;
// }

function getDigesting(key: string, openID: boolean, isAdmin: true): Promise<IntfUser>;
function getDigesting(key: string, openID: boolean, isAdmin?: false): Promise<TypUserListItem>;
// Implementation
async function getDigesting(key: string, openID: boolean, isAdmin?: boolean) {
  const db = await getDB();
  const colsToOutput = resolveCols(undefined, isAdmin, public_cols, cols).map(c => cols[c as keyof typeof cols]);
  const keyCol = openID ? cols.openID : cols.key;
  const user = await db<IntfUser>(tblName)
    .select(colsToOutput)
    .where(keyCol, key || 'undefined')
    .andWhere(group.cols.status, enuBannableStatus.active)
    .leftJoin(group.tblName, group.cols.id, cols.assigned_grpID)
    .andWhere(cols.status, enuBannableStatus.active)
    .first();
  if (user)
    user.privs = deepMerge(user.grpPrivs, user.specialPrivs)
  return user
}

export default {
  cols,
  tblName,
  //list,
  getDigesting,

  verifyRefreshToken: async (usrKey: string, refreshHash: string): Promise<IntfUser | undefined> => {
    const db = await getDB();
    const colsToOutput = resolveCols(undefined, true, public_cols, cols).map(c => cols[c as keyof typeof cols]);

    const user = await db(tblName)
      .select(colsToOutput)
      .where(cols.key, usrKey)
      .andWhere(cols.refreshHash, refreshHash)
      .andWhere(group.cols.status, enuBannableStatus.active)
      .leftJoin(group.tblName, group.cols.id, cols.assigned_grpID)
      .andWhere(cols.status, enuBannableStatus.active)
      .first()
    if (user)
      user.privs = deepMerge(user.grpPrivs, user.specialPrivs)
    return user
  },

  updateRefreshHash: async (usrKey: string, refreshHash: string) => {
    const db = await getDB();
    return await db(tblName)
      .update({ usrRefreshHash: refreshHash })
      .where(cols.key, usrKey)
  },

  addUser: async (
    userTokenMD5: string | undefined,
    userEmail: string | undefined = undefined,
    userMobile: string | undefined = undefined,
    userOpenID: string | undefined = undefined,
    userFullname: string | undefined = undefined,
    usrPrivs: Record<string, unknown> = {},
    grpId: number = DEFAULT_GROUP_ID
  ): Promise<number> => {
    const db = await getDB();
    const res = await db(tblName)
      .insert({
        usrKey: userTokenMD5 || null,
        usrEmail: userEmail || null,
        usrMobile: userMobile || null,
        usrOpenID: userOpenID || null,
        usrName: userFullname || null,
        usrSpecialPrivs: JSON.stringify(usrPrivs),
        usrAssigned_grpID: grpId
      })
      .returning(cols.id);
    return Array.isArray(res) ? (res[0]?.[cols.id as keyof typeof res[0]] ?? res[0]) : res;
  },

  setOTP: async (mobile: string, otp: string) => {
    const db = await getDB();
    const res = await db(tblName)
      .select(cols.otp)
      .where(cols.mobile, mobile)
      .first()

    if (res)
      await db(tblName)
        .update({ usrOTP: otp })
        .where(cols.mobile, mobile)
    else
      await db(tblName)
        .insert({
          usrKey: md5(crypto.randomUUID()),
          usrMobile: mobile,
          usrOTP: otp,
          usrAssigned_grpID: VERIFIED_GROUP_ID
        })
  },

  verifyOTP: async (mobile: string, otp: string) => {
    const db = await getDB();
    const res = await db(tblName)
      .select(cols.otp, cols.key)
      .where(cols.mobile, mobile)
      .first()

      console.log({res, mobile, otp})

    if(res && res.usrOTP === otp)
      return res
  },

  /** Update last login */
  updateLastLogin: async (userKey: string): Promise<number> => {
    const db = await getDB();
    return await db(tblName)
      .update({ usrLasLogin: db.fn.now() })
      .where({ usrKey: userKey })
      .orWhere({ usrEmail: userKey })
      .orWhere({ usrMobile: userKey })
  },

  /** Update logout timestamp */
  logoutByToken: async (userKey: string): Promise<number> => {
    const db = await getDB();
    return await db(tblName)
      .update({ usrLastLogout: db.fn.now() })
      .where({ usrKey: userKey });
  },
};

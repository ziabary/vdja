import { enuBannableStatus } from '../../interfaces/db';
import { getDB } from '../index';
import tblGroup from './tblGroup';
import tblUser from './tblUser';

/* =======================
   Columns & Table
======================= */
export const tblName = 'tblPerUserStats';

const cols = {
  id: "pusID",
  assigned_usrID: "pusAssigned_usrID",
  service: "pusService",
  totalFiles: "pusTotalFiles",
  activeFiles: "pusActiveFiles",
  totalSize: "pusTotalSize",
  activeSize: "pusActiveSize",
  totalChats: "pusTotalChats",
  usedTokens: "pusUsedTokens",

  ///
  userName: tblUser.cols.name,
  groupName: tblGroup.cols.name,
} as const;

/* =======================
   Types
======================= */

export type IntfPerUserStats = {
  [K in keyof typeof cols as typeof cols[K]]:
  K extends 'id' | 'assigned_usrID' | 'totalFiles' | 'activeFiles' | 'activeSize' | 'totalChats' | 'usedTokens' ? number
  : string;
};

async function updateStats(positive: boolean, userID: number, service: string, size: number, chatTokens: number) {
  const db = await getDB()
  const updatedRows = await db(tblName)
    .update({
      [cols.totalFiles]: db.raw(`?? ${positive ? "+" : "-"} ?`, ['pusTotalFiles', size ? 1 : 0]),
      [cols.activeFiles]: db.raw(`?? ${positive ? "+" : "-"} ?`, ['pusActiveFiles', size ? 1 : 0]),
      [cols.totalSize]: db.raw(`?? ${positive ? "+" : "-"} ?`, ['pusTotalSize', size]),
      [cols.activeSize]: db.raw(`?? ${positive ? "+" : "-"} ?`, ['pusActiveSize', size]),
      [cols.totalChats]: db.raw(`?? ${positive ? "+" : "-"} ?`, ['pusTotalChats', chatTokens ? 1 : 0]),
      [cols.usedTokens]: db.raw(`?? ${positive ? "+" : "-"} ?`, ['pusUsedTokens', chatTokens]),
    })
    .where(cols.assigned_usrID, userID)
    .andWhere(cols.service, service)

  if (updatedRows === 0)
    await db(tblName).insert({
      [cols.assigned_usrID]: userID,
      [cols.service]: service,
      [cols.totalFiles]: size ? 1 : 0,
      [cols.activeFiles]: size ? 1 : 0,
      [cols.totalSize]: size,
      [cols.activeSize]: size,
      [cols.totalChats]: chatTokens ? 1 : 0,
      [cols.usedTokens]: chatTokens
    })
}

export default {
  cols,
  tblName,

  addFile: async (service: string, userID: number, size: number): Promise<void> =>
    updateStats(true, userID, service, size, 0),

  removeFile: async (service: string, userID: number, size: number): Promise<void> =>
    updateStats(false, userID, service, size, 0),

  addChatTokens: async (service: string, userID: number, tokens: number): Promise<void> =>
    updateStats(true, userID, service, 0, tokens),

  initialize: async (service: string, userID: number): Promise<void> =>
    updateStats(true, userID, service, 0, 0),

  get: async (service: string, userID: number): Promise<IntfPerUserStats> => {
    const db = await getDB()
    return db(tblName)
      .select([...Object.values(cols), tblUser.cols.name, tblGroup.cols.name])
      .where(cols.assigned_usrID, userID)
      .andWhere(cols.service, service)
      .leftJoin(tblUser.tblName, tblUser.cols.id, cols.assigned_usrID)
      .where(tblUser.cols.status, enuBannableStatus.active)
      .leftJoin(tblGroup.tblName, tblGroup.cols.id, tblUser.cols.assigned_grpID)
      .where(tblGroup.cols.status, enuBannableStatus.active)
      .first()
  }
}
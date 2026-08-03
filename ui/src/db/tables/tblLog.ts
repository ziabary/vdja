import { exHttpInternalServerError } from '../../interfaces/exHttp';
import { toNumber } from '../../utils/common';
import { getLogDB } from '../index';

/* =======================
   Columns & Table
======================= */

export const cols = {
  id: 'logID',
  by_usrKey: 'logBy_usrKey',
  action: 'logAction',
  info: 'logInfo',
  msgLen: 'logMsgLen',
  resultCode: 'logResultCode',
  result: 'logResult',
  createdAt: 'logCreatedAt',
} as const;

export const tblName = 'tblLogs';

/* =======================
   Types
======================= */

export type IntfLog = {
  [K in keyof typeof cols as typeof cols[K]]: 
    K extends 'id' | 'by_usrID' | 'msgLen' ? number 
    : K extends 'action' | 'info' ? string
    : K extends 'resultCode' ? number | null
    : K extends 'createdAt' ? string | Date
    : string | null;
};

export interface IntfLogByActionStats  {
  logs: IntfLog[],
  total: {len: number, count: number}
  active: {sessions: number, questions: number}
}
/* =======================
   Actions
======================= */

export default {
  cols,
  tblName,

  /** Add a log entry */
  add: async (
    userKey: string,
    action: string,
    info: unknown,
    msgLen: number,
    resultCode?: number,
    result?: unknown
  ): Promise<{ logID: number }> => {
    const normalizedAction = String(action || '').trim();
    if (!normalizedAction || normalizedAction.length > 64)
      throw new exHttpInternalServerError('Invalid log action');

    const db = await getLogDB();

    const res = await db(tblName)
      .insert({
        [cols.by_usrKey]: userKey,
        [cols.action]: normalizedAction,
        [cols.info]: JSON.stringify(info),
        [cols.msgLen]: msgLen,
        [cols.resultCode]: resultCode ?? null,
        [cols.result]: JSON.stringify(result ?? null),
      })
      .returning(cols.id);
    return {logID : (Array.isArray(res)) ? res[0]?.[cols.id as keyof typeof res[0]] ?? res[0] : res}
  },

  /** Update log result */
  updateResult: async (
    logSpec: Partial<IntfLog> | undefined,
    resultCode?: number,
    result?: unknown
  ): Promise<number> => {
    if (!logSpec?.hasOwnProperty(cols.id))
      throw new exHttpInternalServerError('Invalid call to update Logs without spec!');

    const db = await getLogDB();

    const count = await db(tblName)
      .update({
        logResultCode: resultCode ?? null,
        logResult: JSON.stringify(result ?? null),
      })
      .where(cols.id, logSpec[cols.id]);

    return count;
  },

  listByAction: async(
    action: string,
    from:number = 0,
    limit: number = 100
  ) : Promise<IntfLogByActionStats> => {
    const db = await getLogDB();

    const logs = await db(tblName)
      .select('*')
      .where(cols.action, action)
      .orderBy(cols.createdAt, "desc")
      .offset(from)
      .limit(limit)

    const total = await db(tblName)
      .sum(`${cols.msgLen} as len`)
      .count(`${cols.id} as count`)
      .where(cols.action, action)
      .first()

    const active = await db(tblName)
      .countDistinct(`${cols.by_usrKey} as sessions`)
      .count(`${cols.id} as questions`)
      .where(cols.action, action)
      .andWhere(cols.createdAt, '>', db.raw("NOW() - INTERVAL 10 MINUTE"))
      .first()

    return {
      logs,
      active: {questions: toNumber(active?.questions), sessions: toNumber(active?.sessions)},
      total: {count: toNumber(total?.count), len: toNumber(total?.len)}
    }      
  }
};

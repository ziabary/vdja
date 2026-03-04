import { exHttpInternalServerError } from '../../interfaces/exHttp';
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
    const db = await getLogDB();

    const res = await db(tblName)
      .insert({
        logBy_usrKey: userKey,
        logAction: action,
        logInfo: JSON.stringify(info),
        logMsgLen: msgLen,
        logResultCode: resultCode ?? null,
        logResult: JSON.stringify(result ?? null),
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
};

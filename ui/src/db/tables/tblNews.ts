import { getNewsDB } from '..';
import { enuGenericStatus } from '../../interfaces/db';
import { exHttpInternalServerError } from '../../interfaces/exHttp';
import configManager from '../../utils/configManager';

/* =======================
   Columns & Table
======================= */
export const cols = {
  link: 'newsLink',
  vdbid: 'newsVDBID',
  createdAt: 'newsCreatedAt',
  status: 'newsStatus'
} as const;

export const tblName = 'tblNews';

/* =======================
   Types
======================= */
export type IntfNews = {
  [K in keyof typeof cols as typeof cols[K]]: 
    K extends 'createdAt' ? string | Date
    : K extends 'status' ? typeof enuGenericStatus[keyof typeof enuGenericStatus]
    : string;
};

/* =======================
   Actions
======================= */
export default {
  cols,
  tblName,

  /** Add a log entry */
  add: async (
    link: string,
    vdbid: string,
  ): Promise<void> => {
    const db = await getNewsDB();

    await db(tblName)
      .insert({
        newsLink: link,
        newsVDBID: vdbid
      })
  },

  list: async (
    limit = 1000,
    from = 0,
    ascending = false
  ): Promise<IntfNews[]> => {
    const db = await getNewsDB();

    const news = await db<IntfNews>(tblName)
      .select(cols.link, cols.vdbid, cols.createdAt, cols.status)
      .where(cols.status, enuGenericStatus.active)
      .limit(Math.min(limit, 1000))
      .orderBy(cols.createdAt, ascending ? 'asc' : 'desc')
      .offset(from);

    return news
  },

  exists: async (vdbid: string) => {
    const db = await getNewsDB()
    return db(tblName).
      select(1)
      .where(cols.vdbid, vdbid)
      .andWhere(cols.status, enuGenericStatus.active)
      .first()
  },

  /** Delete a file */
  delete: async (newsLink: string) => {
    const db = await getNewsDB();

    if (configManager.active().app.softDelete) {
      return await db(tblName)
        .update({ filStatus: enuGenericStatus.removed })
        .where(cols.link, newsLink)
    } else 
      return await db(tblName).where(cols.link, newsLink).del();
  },
  
};

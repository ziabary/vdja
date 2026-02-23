import * as Knex from 'knex'
import { enuGenericStatus } from '../../interfaces/db';
import tblPerUserStats from './tblPerUserStats';
import { getDB } from '../index';
import configManager from '../../utils/configManager';
import type { Select } from '../../interfaces/db';
import { exHttpInternalServerError, exHttpUnauthorized } from '../../interfaces/exHttp';

/* =======================
   Columns & Table
======================= */

const cols = {
  id: 'chtID',
  key: 'chtKey',
  owner_usrID: 'chtOwner_usrID',
  service: 'chtService',
  title: 'chtTitle',
  last_msgID: 'chtLast_msgID',
  createdAt: 'chtCreatedAt',
  status: 'chtStatus',
} as const;

const tblName = 'tblChats';

/* =======================
   Types
======================= */
export type IntfDBChat = {
  [K in keyof typeof cols as typeof cols[K]]:
  K extends 'id' | 'owner_usrID' ? number
  : K extends 'title' ? string | null
  : K extends 'last_msgID' ? number | null
  : K extends 'createdAt' ? string | Date
  : K extends 'status' ? enuGenericStatus
  : string;
};

export type TypChatListItem = Select<IntfDBChat, typeof cols.id | typeof cols.title | typeof cols.last_msgID | typeof cols.createdAt>;

export interface IntfChatListResult {
  totalChats: number
  totalTokens: number
  chats: TypChatListItem[]
}

/* =======================
   Actions
======================= */

export default {
  cols,
  tblName,

  list: async (
    service: string,
    userID: number,
    limit: number = 1000,
    from: number = 0,
    ascending = false
  ): Promise<IntfChatListResult> => {
    const db = await getDB();

    const userChatStats = await tblPerUserStats.get(service, userID)
    if (!userChatStats) throw new exHttpUnauthorized("نشست شما منقضی شده")

    const chats = await db<IntfDBChat>(tblName)
      .select(cols.id, cols.key, cols.title, cols.last_msgID, cols.createdAt)
      .where(cols.owner_usrID, userID)
      .andWhere(cols.status, enuGenericStatus.active)
      .andWhere(cols.service, service)
      .andWhereNot(cols.last_msgID, null)      
      .limit(Math.min(limit, 1000))
      .orderBy(cols.id, ascending ? 'asc' : 'desc')
      .offset(from);

    return {
      totalChats: userChatStats.pusTotalChats || 0,
      totalTokens: userChatStats.pusUsedTokens || 0,
      chats,
    };
  },

  get: async (service: string, userID: number, chatId: string | number): Promise<TypChatListItem | null> => {
    const db = await getDB();

    return db<IntfDBChat>(tblName)
      .select(cols.id, cols.title, cols.last_msgID, cols.createdAt)
      .where(cols.owner_usrID, userID)
      .andWhere((qb: Knex.QueryBuilder) => qb.where(cols.key, chatId || null).orWhere(cols.id, chatId || null))
      .andWhere(cols.status, enuGenericStatus.active)
      .andWhere(cols.service, service)
      .first();
  },

  new: async(service:string, userID: number, chatKey: string): Promise<number> => {
    const db = await getDB();

    const res =  db<IntfDBChat>(tblName)
      .insert({
        chtService: service,
        chtOwner_usrID: userID,
        chtKey: chatKey
      }).returning(cols.id);

    return (Array.isArray(res)) ? res[0]?.[cols.id as keyof typeof res[0]] ?? res[0] : res
  },

  /** Delete a chat */
  delete: async (service: string, chatSpec: Partial<IntfDBChat>): Promise<number> => {
    const chatId: number = chatSpec[cols.id] as number;
    if (!chatId) throw new exHttpInternalServerError('Invalid call to delete without spec!');

    const db = await getDB();

    if (configManager.active().app.softDelete)
      return await db(tblName)
        .update({ chtStatus: enuGenericStatus.removed })
        .where(cols.id, chatId)
        .andWhere(cols.service, service)
    else
      return await db(tblName)
        .where(cols.id, chatId)
        .andWhere(cols.service, service)
        .del()
  },

  /** Delete all chats for a user */
  deleteAll: async (service: string, userID: number): Promise<number> => {
    const db = await getDB();
    if (configManager.active().app.softDelete)
      return db(tblName)
      .where(cols.owner_usrID, userID)
      .andWhere(cols.service, service)
      .update({ chtStatus: enuGenericStatus.removed });
    else
      return db(tblName)
        .where(cols.owner_usrID, userID)
        .andWhere(cols.service, service)
        .del();
  },

  /** Set chat title */
  setTitle: async (service: string, userID: number, chatSpec: Partial<IntfDBChat>, newTitle: string): Promise<number> => {
    if (!chatSpec?.hasOwnProperty(cols.id))
      throw new exHttpInternalServerError('Invalid call to update title without spec!');
    const db = await getDB();
    return db(tblName)
      .update({ chtTitle: newTitle })
      .where(cols.owner_usrID, userID)
      .andWhere(cols.service, service)
      .andWhere(cols.status, enuGenericStatus.active)
      .andWhere(cols.id, chatSpec[cols.id]!)
  },
};

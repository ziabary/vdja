import * as Knex from 'knex'
import { getDB } from '../index';
import { exHttpAccessDenied, exHttpInternalServerError, exHttpInvalidParams } from '../../interfaces/exHttp';
import tblChats, { type IntfDBChat, type TypChatListItem } from './tblChats';
import { enuGenericStatus } from '../../interfaces/db';
import { enuRoles } from '../../interfaces/llm';

/* =======================
   Columns & Table
======================= */

export const cols = {
  id: 'msgID',
  key: 'msgKey',
  related_chtID: 'msgRelated_chtID',
  role: 'msgRole',
  content: 'msgContent',
  opinion: 'msgOpinion',
  createdAt: 'msgCreatedAt',
  status: 'msgStatus'
} as const;

export const tblName = 'tblMessages';

export enum enuMsgStatus {
  Finished = 'Finished',
  Stopped = 'Stopped'
}
/* =======================
   Types
======================= */

export type IntfMessage = {
  [K in keyof typeof cols as typeof cols[K]]: 
    K extends 'id' | 'related_chtID' ? number
    : K extends 'createdAt' ? string | Date
    : K extends 'opinion' ? 'u' | 'd' | 'w' | null
    : string;
};

/* =======================
   Actions
======================= */

export default {
  cols,
  tblName,

  /** List messages for a chat */
  listByChatID: async (
    service: string,
    userID: number,
    chatId: number|string,
    limit = 1000,
    from = 0,
    ascending = true
  ): Promise<{chat: TypChatListItem, messages: Partial<IntfMessage>[]}> => {
    const db = await getDB();
    const relatedChat = await tblChats.get(service, userID, chatId);
    if (!relatedChat) throw new exHttpAccessDenied('چت درخواستی وجود ندارد یا به آن دسترسی ندارید');

    const messages = await db<IntfMessage>(tblName)
      .select(cols.id, cols.key, cols.role, cols.content, cols.opinion, cols.createdAt)
      .where(cols.related_chtID, relatedChat.chtID)
      .andWhere(cols.status, enuMsgStatus.Finished)
      .limit(Math.min(limit, 1000))
      .orderBy(cols.id, ascending ? 'asc' : 'desc')
      .offset(from);

    return { chat: relatedChat, messages };
  },

  /** Set opinion for a message */
  setOpinion: async (
    service: string,
    userID: number,
    chatId: number|string,
    msgId: string,
    opinion: string
  ): Promise<number> => {
    const db = await getDB();

    const singleCharOpinion = opinion?.toLowerCase().substring(0, 1);
    if (!['u', 'd', 'w'].includes(singleCharOpinion!))
      throw new exHttpInvalidParams(`نظر ارایه شده معتبر نیست: ${opinion}`);

    const relatedChat = await tblChats.get(service, userID, chatId);
    if (!relatedChat) throw new exHttpAccessDenied('چت درخواستی وجود ندارد یا به آن دسترسی ندارید');

    const count = await db<IntfMessage>(tblName)
      .update({ msgOpinion: singleCharOpinion as 'u' | 'd' | 'w' })
      .where(cols.related_chtID, relatedChat.chtID)
      .andWhere(qb => {qb.where(cols.key, msgId).orWhere(cols.key, msgId);});

    return count;
  },

  /** Add a dialogue (user + bot messages) */
  addDialogue: async (
    chatSpecs: TypChatListItem,
    requestId: string,
    question: string,
    botResponse: string,
    status: enuMsgStatus
  ): Promise<number[]> => {
    const dialogue = [
      { msgKey: requestId, msgRelated_chtID: chatSpecs.chtID, msgRole: enuRoles.user, msgContent: question, msgStatus: status },
      { msgKey: requestId, msgRelated_chtID: chatSpecs.chtID, msgRole: enuRoles.assistant, msgContent: botResponse, msgStatus: status },
    ];

    const db = await getDB();
    const rows = await db<IntfMessage>(tblName)
      .insert(dialogue)
      .returning(cols.id);
    return rows.map(row => row[cols.id]);
  },
};

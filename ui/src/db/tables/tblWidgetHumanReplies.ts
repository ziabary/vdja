import { getDB } from '../index';
import tblUser from './tblUser';
import tblMessages from './tblMessages';

export const tblName = 'tblWidgetHumanReplies';
export const cols = {
  id: 'whrID', session_wssID: 'whrSession_wssID', operator_usrID: 'whrOperator_usrID', message_msgID: 'whrMessage_msgID', createdAt: 'whrCreatedAt',
} as const;

export default {
  tblName,
  cols,
  listBySession: async (sessionID: number): Promise<Array<{ msgID: number; usrUsername: string | null; usrName: string | null }>> => {
    const db = await getDB();
    return db(tblName)
      .select(
        `${tblMessages.tblName}.${tblMessages.cols.id} as msgID`,
        `${tblUser.tblName}.${tblUser.cols.username} as usrUsername`,
        `${tblUser.tblName}.${tblUser.cols.name} as usrName`,
      )
      .leftJoin(tblMessages.tblName, `${tblMessages.tblName}.${tblMessages.cols.id}`, `${tblName}.${cols.message_msgID}`)
      .leftJoin(tblUser.tblName, `${tblUser.tblName}.${tblUser.cols.id}`, `${tblName}.${cols.operator_usrID}`)
      .where(`${tblName}.${cols.session_wssID}`, sessionID);
  },

  add: async (sessionID: number, operatorUserID: number, messageID: number): Promise<void> => {
    const db = await getDB();
    await db(tblName).insert({
      [cols.session_wssID]: sessionID,
      [cols.operator_usrID]: operatorUserID,
      [cols.message_msgID]: messageID,
    });
  },
};

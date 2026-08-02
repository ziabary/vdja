import { getDB } from '../index';
import tblUser from './tblUser';

export const tblName = 'tblWidgetOperators';
export const cols = {
  id: 'wopID',
  widget_wgtID: 'wopWidget_wgtID',
  operator_usrID: 'wopOperator_usrID',
  role: 'wopRole',
  status: 'wopStatus',
  createdAt: 'wopCreatedAt',
  updatedAt: 'wopUpdatedAt',
} as const;

export interface IntfWidgetOperatorRow {
  wopID: number;
  wopWidget_wgtID: number;
  wopOperator_usrID: number;
  wopRole: string;
  wopStatus: string;
  wopCreatedAt: string | Date;
  wopUpdatedAt: string | Date;
  usrUsername?: string | null;
  usrName?: string | null;
  usrAvatar?: string | null;
}

export default {
  tblName,
  cols,

  list: async (widgetID: number, includeRemoved = false): Promise<IntfWidgetOperatorRow[]> => {
    const db = await getDB();
    const query = db<IntfWidgetOperatorRow>(tblName)
      .select(`${tblName}.*`, tblUser.cols.username, tblUser.cols.name, tblUser.cols.avatar)
      .leftJoin(tblUser.tblName, tblUser.cols.id, cols.operator_usrID)
      .where(cols.widget_wgtID, widgetID);
    if (!includeRemoved) query.andWhere(cols.status, 'Active');
    return query.orderBy(cols.createdAt, 'asc');
  },

  get: async (widgetID: number, operatorUserID: number): Promise<IntfWidgetOperatorRow | undefined> => {
    const db = await getDB();
    return db<IntfWidgetOperatorRow>(tblName)
      .select('*')
      .where(cols.widget_wgtID, widgetID)
      .andWhere(cols.operator_usrID, operatorUserID)
      .first();
  },

  addOrEnable: async (widgetID: number, operatorUserID: number, role = 'Operator'): Promise<void> => {
    const db = await getDB();
    const existing = await db(tblName)
      .select(cols.id)
      .where(cols.widget_wgtID, widgetID)
      .andWhere(cols.operator_usrID, operatorUserID)
      .first();
    if (existing) {
      await db(tblName).update({
        [cols.status]: 'Active',
        [cols.role]: role,
        [cols.updatedAt]: db.fn.now(),
      }).where(cols.id, existing[cols.id]);
      return;
    }
    await db(tblName).insert({
      [cols.widget_wgtID]: widgetID,
      [cols.operator_usrID]: operatorUserID,
      [cols.role]: role,
      [cols.status]: 'Active',
    });
  },

  setActive: async (widgetID: number, operatorUserID: number, active: boolean): Promise<number> => {
    const db = await getDB();
    return db(tblName).update({
      [cols.status]: active ? 'Active' : 'Removed',
      [cols.updatedAt]: db.fn.now(),
    }).where(cols.widget_wgtID, widgetID).andWhere(cols.operator_usrID, operatorUserID);
  },
};

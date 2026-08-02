import { getDB } from '../index';

export const tblName = 'tblWidgetSessions';
export const cols = {
  id: 'wssID', key: 'wssKey', widget_wgtID: 'wssWidget_wgtID', chat_chtID: 'wssChat_chtID',
  mode: 'wssMode', status: 'wssStatus', visitorName: 'wssVisitorName', visitorContact: 'wssVisitorContact',
  category: 'wssCategory', confidence: 'wssConfidence', handoffReason: 'wssHandoffReason',
  assigned_usrID: 'wssAssigned_usrID', origin: 'wssOrigin', createdAt: 'wssCreatedAt', updatedAt: 'wssUpdatedAt',
  handoffAt: 'wssHandoffAt', assignedAt: 'wssAssignedAt', firstResponseAt: 'wssFirstResponseAt', resolvedAt: 'wssResolvedAt',
} as const;

export interface IntfWidgetSessionRow {
  wssID: number; wssKey: string; wssWidget_wgtID: number; wssChat_chtID: number;
  wssMode: 'Public' | 'Preview'; wssStatus: string; wssVisitorName: string | null; wssVisitorContact: string | null;
  wssCategory: string | null; wssConfidence: number | string | null; wssHandoffReason: string | null;
  wssAssigned_usrID: number | null; wssOrigin: string | null; wssCreatedAt: string | Date; wssUpdatedAt: string | Date;
  wssHandoffAt: string | Date | null; wssAssignedAt: string | Date | null; wssFirstResponseAt: string | Date | null; wssResolvedAt: string | Date | null;
}

function firstId(result: unknown): number {
  if (!Array.isArray(result)) return Number(result);
  const row = result[0] as Record<string, unknown> | number | undefined;
  if (typeof row === 'number') return row;
  return Number(row?.[cols.id] ?? 0);
}

export default {
  tblName,
  cols,

  add: async (payload: { key: string; widgetID: number; chatID: number; mode: 'Public' | 'Preview'; origin?: string | null }): Promise<number> => {
    const db = await getDB();
    const result = await db(tblName).insert({
      [cols.key]: payload.key,
      [cols.widget_wgtID]: payload.widgetID,
      [cols.chat_chtID]: payload.chatID,
      [cols.mode]: payload.mode,
      [cols.origin]: payload.origin || null,
      [cols.status]: 'Bot',
    }).returning(cols.id);
    return firstId(result);
  },

  getByKey: async (widgetID: number, key: string): Promise<IntfWidgetSessionRow | undefined> => {
    const db = await getDB();
    return db<IntfWidgetSessionRow>(tblName).select('*')
      .where(cols.widget_wgtID, widgetID).andWhere(cols.key, key).first();
  },

  getById: async (id: number): Promise<IntfWidgetSessionRow | undefined> => {
    const db = await getDB();
    return db<IntfWidgetSessionRow>(tblName).select('*').where(cols.id, id).first();
  },

  list: async (widgetIDs: number[], options: { status?: string; mode?: 'Public' | 'Preview'; assignedUserID?: number; limit?: number; offset?: number } = {}): Promise<IntfWidgetSessionRow[]> => {
    if (!widgetIDs.length) return [];
    const db = await getDB();
    const query = db<IntfWidgetSessionRow>(tblName).select('*').whereIn(cols.widget_wgtID, widgetIDs);
    if (options.status && options.status !== 'all') query.andWhere(cols.status, options.status);
    if (options.mode) query.andWhere(cols.mode, options.mode);
    if (options.assignedUserID) query.andWhere(cols.assigned_usrID, options.assignedUserID);
    return query.orderBy(cols.updatedAt, 'desc').limit(Math.min(options.limit || 200, 1000)).offset(options.offset || 0);
  },

  updateAnalysis: async (id: number, category: string, confidence: number, status: 'Bot' | 'Pending' | 'Queued' | 'Assigned' | 'Resolved' = 'Bot'): Promise<number> => {
    const db = await getDB();
    return db(tblName).update({
      [cols.category]: category || null,
      [cols.confidence]: Number.isFinite(confidence) ? confidence : null,
      [cols.status]: status,
      [cols.updatedAt]: db.fn.now(),
    }).where(cols.id, id);
  },

  updateVisitor: async (id: number, name?: string | null, contact?: string | null): Promise<number> => {
    const db = await getDB();
    const changes: Record<string, unknown> = { [cols.updatedAt]: db.fn.now() };
    if (name !== undefined) changes[cols.visitorName] = name || null;
    if (contact !== undefined) changes[cols.visitorContact] = contact || null;
    return db(tblName).update(changes).where(cols.id, id);
  },

  handoff: async (id: number, payload: { status: 'Queued' | 'Pending'; category: string; confidence: number; reason: string }): Promise<number> => {
    const db = await getDB();
    return db(tblName).update({
      [cols.status]: payload.status,
      [cols.category]: payload.category,
      [cols.confidence]: payload.confidence,
      [cols.handoffReason]: payload.reason,
      [cols.handoffAt]: db.fn.now(),
      [cols.updatedAt]: db.fn.now(),
    }).where(cols.id, id);
  },

  assign: async (id: number, operatorUserID: number): Promise<number> => {
    const db = await getDB();
    return db(tblName).update({
      [cols.status]: 'Assigned',
      [cols.assigned_usrID]: operatorUserID,
      [cols.assignedAt]: db.fn.now(),
      [cols.updatedAt]: db.fn.now(),
    }).where(cols.id, id);
  },

  markHumanReply: async (id: number, operatorUserID: number): Promise<number> => {
    const db = await getDB();
    const current = await db<IntfWidgetSessionRow>(tblName).select(cols.firstResponseAt).where(cols.id, id).first();
    const changes: Record<string, unknown> = {
      [cols.status]: 'Assigned',
      [cols.assigned_usrID]: operatorUserID,
      [cols.updatedAt]: db.fn.now(),
    };
    if (!current?.wssFirstResponseAt) changes[cols.firstResponseAt] = db.fn.now();
    return db(tblName).update(changes).where(cols.id, id);
  },

  resolve: async (id: number): Promise<number> => {
    const db = await getDB();
    return db(tblName).update({
      [cols.status]: 'Resolved',
      [cols.resolvedAt]: db.fn.now(),
      [cols.updatedAt]: db.fn.now(),
    }).where(cols.id, id);
  },
};

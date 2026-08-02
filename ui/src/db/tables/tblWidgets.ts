import { getDB } from '../index';

export const tblName = 'tblWidgets';
export const cols = {
  id: 'wgtID',
  key: 'wgtKey',
  owner_usrID: 'wgtOwner_usrID',
  runtime_usrID: 'wgtRuntime_usrID',
  internalName: 'wgtInternalName',
  targetOrigin: 'wgtTargetOrigin',
  publishedOrigin: 'wgtPublishedOrigin',
  draftConfig: 'wgtDraftConfig',
  publishedConfig: 'wgtPublishedConfig',
  draftVersion: 'wgtDraftVersion',
  publishedVersion: 'wgtPublishedVersion',
  status: 'wgtStatus',
  createdAt: 'wgtCreatedAt',
  updatedAt: 'wgtUpdatedAt',
  publishedAt: 'wgtPublishedAt',
  lastTestAt: 'wgtLastTestAt',
} as const;

export enum enuWidgetStatus {
  draft = 'Draft',
  published = 'Published',
  changed = 'Changed',
  disabled = 'Disabled',
  removed = 'Removed',
}

export interface IntfWidgetRow {
  wgtID: number;
  wgtKey: string;
  wgtOwner_usrID: number;
  wgtRuntime_usrID: number;
  wgtInternalName: string;
  wgtTargetOrigin: string;
  wgtPublishedOrigin: string | null;
  wgtDraftConfig: unknown;
  wgtPublishedConfig: unknown | null;
  wgtDraftVersion: number;
  wgtPublishedVersion: number;
  wgtStatus: enuWidgetStatus;
  wgtCreatedAt: string | Date;
  wgtUpdatedAt: string | Date;
  wgtPublishedAt: string | Date | null;
  wgtLastTestAt: string | Date | null;
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

  add: async (payload: {
    key: string;
    ownerUserID: number;
    runtimeUserID: number;
    internalName: string;
    targetOrigin: string;
    draftConfig: unknown;
  }): Promise<number> => {
    const db = await getDB();
    const result = await db(tblName).insert({
      [cols.key]: payload.key,
      [cols.owner_usrID]: payload.ownerUserID,
      [cols.runtime_usrID]: payload.runtimeUserID,
      [cols.internalName]: payload.internalName,
      [cols.targetOrigin]: payload.targetOrigin,
      [cols.draftConfig]: JSON.stringify(payload.draftConfig),
      [cols.status]: enuWidgetStatus.draft,
    }).returning(cols.id);
    return firstId(result);
  },

  listOwned: async (ownerUserID: number): Promise<IntfWidgetRow[]> => {
    const db = await getDB();
    return db<IntfWidgetRow>(tblName)
      .select('*')
      .where(cols.owner_usrID, ownerUserID)
      .whereNot(cols.status, enuWidgetStatus.removed)
      .orderBy(cols.updatedAt, 'desc');
  },

  listAccessible: async (userID: number): Promise<IntfWidgetRow[]> => {
    const db = await getDB();
    return db<IntfWidgetRow>(tblName)
      .distinct(`${tblName}.*`)
      .leftJoin('tblWidgetOperators', 'wopWidget_wgtID', cols.id)
      .where(qb => qb.where(cols.owner_usrID, userID)
        .orWhere(q => q.where('wopOperator_usrID', userID).andWhere('wopStatus', 'Active')))
      .whereNot(cols.status, enuWidgetStatus.removed)
      .orderBy(cols.updatedAt, 'desc');
  },

  getByKey: async (key: string): Promise<IntfWidgetRow | undefined> => {
    const db = await getDB();
    return db<IntfWidgetRow>(tblName).select('*').where(cols.key, key).whereNot(cols.status, enuWidgetStatus.removed).first();
  },

  getById: async (id: number): Promise<IntfWidgetRow | undefined> => {
    const db = await getDB();
    return db<IntfWidgetRow>(tblName).select('*').where(cols.id, id).whereNot(cols.status, enuWidgetStatus.removed).first();
  },

  getPublishedByKey: async (key: string): Promise<IntfWidgetRow | undefined> => {
    const db = await getDB();
    return db<IntfWidgetRow>(tblName)
      .select('*')
      .where(cols.key, key)
      .whereIn(cols.status, [enuWidgetStatus.published, enuWidgetStatus.changed])
      .whereNotNull(cols.publishedConfig)
      .first();
  },

  updateDraft: async (id: number, payload: { internalName: string; targetOrigin: string; draftConfig: unknown }): Promise<number> => {
    const db = await getDB();
    const current = await db<IntfWidgetRow>(tblName).select(cols.status, cols.draftVersion).where(cols.id, id).first();
    const nextStatus = current?.wgtStatus === enuWidgetStatus.published || current?.wgtStatus === enuWidgetStatus.changed
      ? enuWidgetStatus.changed
      : current?.wgtStatus === enuWidgetStatus.disabled ? enuWidgetStatus.disabled : enuWidgetStatus.draft;
    return db(tblName).update({
      [cols.internalName]: payload.internalName,
      [cols.targetOrigin]: payload.targetOrigin,
      [cols.draftConfig]: JSON.stringify(payload.draftConfig),
      [cols.draftVersion]: Number(current?.wgtDraftVersion || 0) + 1,
      [cols.status]: nextStatus,
      [cols.updatedAt]: db.fn.now(),
    }).where(cols.id, id).whereNot(cols.status, enuWidgetStatus.removed);
  },

  touchTest: async (id: number): Promise<number> => {
    const db = await getDB();
    return db(tblName).update({ [cols.lastTestAt]: db.fn.now() }).where(cols.id, id);
  },

  publish: async (id: number, publishedConfig: unknown, targetOrigin: string): Promise<number> => {
    const db = await getDB();
    const current = await db<IntfWidgetRow>(tblName).select(cols.draftVersion).where(cols.id, id).first();
    return db(tblName).update({
      [cols.targetOrigin]: targetOrigin,
      [cols.publishedOrigin]: targetOrigin,
      [cols.publishedConfig]: JSON.stringify(publishedConfig),
      [cols.publishedVersion]: Number(current?.wgtDraftVersion || 1),
      [cols.status]: enuWidgetStatus.published,
      [cols.publishedAt]: db.fn.now(),
      [cols.updatedAt]: db.fn.now(),
    }).where(cols.id, id).whereNot(cols.status, enuWidgetStatus.removed);
  },

  disable: async (id: number): Promise<number> => {
    const db = await getDB();
    return db(tblName).update({
      [cols.status]: enuWidgetStatus.disabled,
      [cols.updatedAt]: db.fn.now(),
    }).where(cols.id, id).whereNot(cols.status, enuWidgetStatus.removed);
  },

  remove: async (id: number): Promise<number> => {
    const db = await getDB();
    return db(tblName).update({
      [cols.status]: enuWidgetStatus.removed,
      [cols.updatedAt]: db.fn.now(),
    }).where(cols.id, id);
  },
};

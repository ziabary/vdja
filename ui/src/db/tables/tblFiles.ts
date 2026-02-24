import * as Knex from 'knex';
import { getDB } from '../index';
import configManager from '../../utils/configManager';
import { enuGenericStatus } from '../../interfaces/db';
import user, { type IntfUser } from './tblUser';
import tblPerUserStats from './tblPerUserStats';
import { exHttpInternalServerError, exHttpUnauthorized } from '../../interfaces/exHttp';

export enum enuFileStatus {
  active = 'Active',
  removed = 'Removed',
  processing=  'Processing',
}

/* =======================
   Columns & Table
======================= */

export const cols = {
  id: 'filID',
  owner_usrID: 'filOwner_usrID',
  key: 'filKey',
  service: 'filService',
  name: 'filName',
  size: 'filSize',
  chunkCount: 'filChunkCount',
  uploadedAt: 'filUploadedAt',
  status: 'filStatus',
} as const;

export const tblName = 'tblFiles';

/* =======================
   Types
======================= */

export type IntfFile = {
  [K in keyof typeof cols as typeof cols[K]]:
    K extends 'id' | 'owner_usrID' | 'size' | 'chunkCount' ? number
    : K extends 'uploadedAt' ? string | Date
    : string;
};

export type TypFileListItem = Pick<IntfFile, typeof cols.id | typeof cols.key | typeof cols.name | typeof cols.size | typeof cols.uploadedAt>

/* =======================
   Actions
======================= */

export default {
  cols,
  tblName,

  /** List files for a user */
  list: async (
    service: string,
    userID: number,
    limit = 1000,
    from = 0,
    ascending = false,
    admin = false
  ): Promise<{
    usrActiveFileCount: number;
    usrTotalUploadedCount: number;
    usrActiveTotalSize: number;
    files: TypFileListItem[];
  }> => {
    const db = await getDB();

    const userFileInfo = await tblPerUserStats.get(service, userID)
    if (!userFileInfo) throw new exHttpUnauthorized("نشست شما منقضی شده")

    if(!userFileInfo) throw new exHttpInternalServerError("Invalid User Info")

    const files = await db<IntfFile>(tblName)
      .select(cols.id, cols.name, cols.owner_usrID, cols.key, cols.size, cols.uploadedAt)
      .where(cols.owner_usrID, userID)
      .andWhere(cols.service, service)
      .andWhere(qb => {qb.where(cols.status, enuFileStatus.active).orWhere(cols.status, enuFileStatus.processing);})
      .limit(Math.min(limit, 1000))
      .orderBy(cols.id, ascending ? 'asc' : 'desc')
      .offset(from);

    return {
      usrTotalUploadedCount: userFileInfo.pusTotalFiles ||0,
      usrActiveFileCount: userFileInfo.pusActiveFiles ||0,
      usrActiveTotalSize: userFileInfo.pusActiveSize ||0,
      files,
    };
  },

  /** Get single file by key or ID */
  get: async (service:string, userID: number, fileKey: string | number): Promise<IntfFile | null> => {
    const db = await getDB();

    const row = await db<IntfFile>(tblName)
      .select('*')
      .where(cols.owner_usrID, userID)
      .andWhere(cols.service, service)
      .andWhere(qb => {qb.where(cols.key, fileKey || null).orWhere(cols.id, fileKey || null);})
      .andWhere(qb => {qb.where(cols.status, enuFileStatus.active).orWhere(cols.status, enuFileStatus.processing);})
      .first();
    return row ?? null
  },

  /** Delete a file */
  delete: async (service:string, fileSpec: Partial<IntfFile>) => {
    if (!fileSpec?.hasOwnProperty(cols.id) || !fileSpec?.hasOwnProperty(cols.owner_usrID) || !fileSpec?.hasOwnProperty(cols.size))
      throw new exHttpInternalServerError('Invalid call to delete without spec!');

    const db = await getDB();
    let delResult

    if (configManager.active().app.softDelete) {
      delResult = await db(tblName)
        .update({ filStatus: enuGenericStatus.removed })
        .where(cols.id, fileSpec[cols.id])
        .andWhere(cols.service, service)
    }

    delResult = await db(tblName).where(cols.id, fileSpec[cols.id]).del();
    tblPerUserStats.removeFile(service, fileSpec[cols.owner_usrID]!, fileSpec[cols.size]!)
    return delResult
  },

  updateState: async (service: string, fileSpec: Partial<IntfFile>, status: enuFileStatus) => {
    if (!fileSpec?.hasOwnProperty(cols.id))
      throw new exHttpInternalServerError('Invalid call to delete without spec!');

    const db = await getDB();
    return await db(tblName)
      .update({filStatus: status})
      .where(cols.id, fileSpec[cols.id])
      .andWhere(cols.service, service)
  }, 

  /** Add a new file */
  add: async (
    service: string,
    userID: number,
    fileKey: string,
    fileName: string,
    fileSize: number,
    chunksCount: number
  ): Promise<number> => {
    const db = await getDB();

    const res = await db(tblName)
      .insert({
        filOwner_usrID: userID,
        filService: service,
        filKey: fileKey,
        filName: fileName,
        filSize: fileSize,
        filChunkCount: chunksCount,
      })
      .returning(cols.id);
    const insertRes =  (Array.isArray(res)) ? res[0]?.[cols.id as keyof typeof res[0]] ?? res[0] : res
    tblPerUserStats.addFile(service,userID, fileSize)
    return insertRes
  },
};

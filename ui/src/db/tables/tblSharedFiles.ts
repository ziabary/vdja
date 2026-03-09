import md5 from 'md5';
import { exHttpAccessDenied, exHttpInternalServerError } from '../../interfaces/exHttp';
import { toNumber } from '../../utils/common';
import { getDB, getLogDB } from '../index';
import tblSharedFilesDownloads from './tblSharedFilesDownloads';
import logger from '../../utils/logger';
import { randomUUID } from 'node:crypto';

/* =======================
   Columns & Table
======================= */

export const cols = {
    id: 'shfID',
    key: 'shfKey',
    path: 'shfPath',
    totalDownloads: 'shfTotalDownloads',
    createdAt: 'sfdCreatedAt'
} as const;

export const tblName = 'tblSharedFiles';

/* =======================
   Types
======================= */

export type IntfLog = {
    [K in keyof typeof cols as typeof cols[K]]:
    K extends 'id' | 'totalDownloads' ? number
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
    addOrGetStats: async (
        userId: number,
        path: string,
    ): Promise<{ total: number, user: number, key: string }> => {
        const db = await getDB();

        const fileKey = md5(path)
        const dbRes = await db(tblName)
            .select(cols.totalDownloads, cols.id, cols.key)
            .where(cols.key, fileKey)
            .first()

        if (dbRes) {
            const userCount = await db(tblSharedFilesDownloads.tblName)
                .count('*', { as: 'c' })
                .where(tblSharedFilesDownloads.cols.by_usrID, userId)
                .andWhere(tblSharedFilesDownloads.cols.on_shfID, dbRes[cols.id])
                .first()
            return { total: dbRes[cols.totalDownloads], user: Number(userCount?.c || 0), key: dbRes[cols.key] }
        }

        await db(tblName).insert({
            [cols.key]: fileKey,
            [cols.path]: path
        }).onConflict().ignore()
        return { total: 0, user: 0, key: fileKey }
    },

    /** Update log result */
    getAccessCount: async (
        userId: number,
        shfKey: string,
    ): Promise<{ total: number, current: number }> => {
        const db = await getLogDB();

        const currFile = await db(tblSharedFilesDownloads.tblName)
            .count('*', { as: 'c' })
            .leftJoin(tblName, tblSharedFilesDownloads.cols.on_shfID, cols.id)
            .where(tblSharedFilesDownloads.cols.by_usrID, userId)
            .andWhere(cols.key, shfKey)
            .andWhere(tblSharedFilesDownloads.cols.createdAt, '>', db.raw("NOW() - INTERVAL 1 HOUR"))
            .first()

        const totalFiles = await db(tblSharedFilesDownloads.tblName)
            .count('*', { as: 'c' })
            .where(tblSharedFilesDownloads.cols.by_usrID, userId)
            .andWhere(tblSharedFilesDownloads.cols.createdAt, '>', db.raw("NOW() - INTERVAL 1 HOUR"))
            .first()

        return { total: Number(totalFiles?.c || 0), current: Number(currFile?.c || 0) }
    },

    requestDownload: async (
        userId: number,
        shfKey: string,
    ): Promise<{token:string, filename: string}> => {
        const db = await getDB();

        const trx = await db.transaction()
        try {
            await db(tblName)
                .update({
                    [cols.totalDownloads]: db.raw(`?? + 1`, [cols.totalDownloads]),
                })
                .where(cols.key, shfKey)
            const shfQ = await db(tblName).select(cols.id, cols.path).where(cols.key, shfKey).first()
            const token = randomUUID()
            await db(tblSharedFilesDownloads.tblName)
                .insert({
                    [tblSharedFilesDownloads.cols.token]: token,
                    [tblSharedFilesDownloads.cols.on_shfID]: shfQ[cols.id],
                    [tblSharedFilesDownloads.cols.by_usrID]: userId
                })

            await trx.commit()

            return {token, filename: shfQ[cols.path.substring(cols.path.lastIndexOf('/') + 1)]}
        } catch (e) {
            console.log(e)
            await trx.rollback()
            throw new exHttpInternalServerError("امکان ایجاد درخواست فراهم نشد")
        }
    },

    getByToken: async (
        token: string
    ): Promise<string | undefined> => {
        const db = await getDB()

        const res =  await db(tblName)
            .select(cols.path)
            .leftJoin(tblSharedFilesDownloads.tblName, tblSharedFilesDownloads.cols.on_shfID, cols.id)
            .where(tblSharedFilesDownloads.cols.token, token)
            .andWhere(tblSharedFilesDownloads.cols.createdAt, '>', db.raw("NOW() - INTERVAL 10 MINUTE"))
            .first()
        
            return res && res[cols.path]
    }
};

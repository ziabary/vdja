import md5 from 'md5';
import { exHttpInternalServerError } from '../../interfaces/exHttp';
import { getDB, getLogDB } from '../index';
import tblSharedFilesDownloads from './tblSharedFilesDownloads';
import { randomUUID } from 'node:crypto';
import tblUser from './tblUser';

/* =======================
   Columns & Table
======================= */
export enum enuRequestStatus {
    New = "New",
    Downloaded = "Downloaded",
    Discarded = "Discarded",
    Downloading = "Downloading",
}

export const cols = {
    id: 'sfrID',
    by_usrID: 'sfrBy_usrID',
    userOnBale: 'sfrUserOnBale',
    category: 'sfrCategory',
    link: 'sfrLink',
    description: 'sfrDescription',
    createdAt: 'sfrCreatedAt',
    status: 'sfrStatus'
} as const;

export const tblName = 'tblSharedFileRequests';

/* =======================
   Types
======================= */

export type IntfSharedFileRequests = {
    [K in keyof typeof cols as typeof cols[K]]:
    K extends 'id' | 'totalDownloads' ? number
    : K extends 'createdAt' ? string | Date
    : K extends 'status' ? enuRequestStatus
    : string | null;
};

/* =======================
   Actions
======================= */
export default {
    cols,
    tblName,

    /** Add a log entry */
    list: async (isManager: boolean | undefined): Promise<IntfSharedFileRequests[]> => {
        const db = await getDB();
        const returnCols = Object.values(cols).filter(c=>isManager || c!== cols.userOnBale)
        return await db(tblName)
            .select([...returnCols, tblUser.cols.mobile])
            .leftJoin(tblUser.tblName, tblUser.cols.id, cols.by_usrID)
            .orderBy(cols.status, "asc")
            .orderBy(cols.createdAt, "desc")
            .limit(100)           
    },

    count: async (userId:number) => {
        const db = await getDB();
        const res = await db(tblName)
            .count("*", {as: "c"})
            .where(cols.by_usrID, userId)
            .first()
        return Number(res?.c || 0)
    },

    add: async (
        userId: number,
        category: string,
        link: string,
        description: string,
        userOnBale: string
    ): Promise<void> => {
        const db = await getDB();

        const res = await db(tblName).select('*').where(cols.link, link).first()
        if(res) return
        await db(tblName).insert({
            [cols.by_usrID]: userId,
            [cols.category]: category,
            [cols.link]: link,
            [cols.description]: description,
            [cols.userOnBale]: userOnBale?.trim().length ? userOnBale.trim() : null 
        })
    },

    setSatus: async(
        sfrId:number,
        status: enuRequestStatus
    )=> {
        const db = await getDB();
        await db(tblName).update({
            [cols.status]: status
        }).where(cols.id, sfrId)
    }
};

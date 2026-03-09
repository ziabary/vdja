import { randomUUID } from 'crypto';
import { getDB } from '../index';
import md5 from 'md5';

/* =======================
   Columns & Table
======================= */

export const cols = {
    id: 'sfdID',
    by_usrID: 'sfdBy_usrID',
    on_shfID: 'sfdOn_shfID',
    token: 'sfdToken',
    createdAt: 'sfdCreatedAt'
} as const;

export const tblName = 'tblSharedFilesDownloads';

/* =======================
   Types
======================= */

export type IntfLog = {
    [K in keyof typeof cols as typeof cols[K]]:
    K extends 'id' | 'by_usrID' | 'on_shfID' ? number
    : K extends 'createdAt' ? string | Date
    : string | null;
};

/* =======================
   Actions
======================= */
export default {
    cols,
    tblName,
};

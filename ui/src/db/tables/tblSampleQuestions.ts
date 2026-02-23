import { getDB } from '../index';
import { exHttpAccessDenied, exHttpConflict, exHttpInternalServerError } from '../../interfaces/exHttp';
import files, { type IntfFile } from './tblFiles';
import tblUser from './tblUser';
import * as Knex from 'knex';
import tblFiles from './tblFiles';
import { enuBannableStatus } from '../../interfaces/db';
import tblGroup from './tblGroup';

/* =======================
   Columns & Table
======================= */
export const cols = {
  id: 'smqID',
  assigned_filID: 'smqAssigned_filID',
  question: 'smqQuestion',
} as const;

export const tblName = 'tblSampleQuestions';

/* =======================
   Types
======================= */
export type IntfSampleQuestion = {
  [K in keyof typeof cols as typeof cols[K]]: 
    K extends 'id' | 'assigned_filID' ? number 
    : string;
};

/* =======================
   Actions
======================= */
export default {
  cols,
  tblName,

  /** List questions by file ID */
  listByFileId: async (
    service: string,
    userID: number,
    fileId: number|string,
    limit = 1000,
    from = 0
  ): Promise<Array<Pick<IntfSampleQuestion, typeof cols.question> & { filName: string }>> => {
    const db = await getDB();

    // Ensure user has access to file
    const relatedFile = await files.get(service, userID, fileId);
    if (!relatedFile) throw new exHttpAccessDenied('چت درخواستی وجود ندارد یا به آن دسترسی ندارید');

    const questions = await db(tblName)
      .select(cols.question, files.cols.name)
      .leftJoin(files.tblName, files.cols.id, cols.assigned_filID)
      .leftJoin(tblUser.tblName, tblUser.cols.id, files.cols.owner_usrID)
      .leftJoin(tblGroup.tblName, tblGroup.cols.id, tblUser.cols.assigned_grpID)
      .where(cols.assigned_filID, relatedFile[files.cols.id])
      .andWhere(tblFiles.cols.service, service)
      .andWhere(tblUser.cols.status, enuBannableStatus.active)
      .andWhere(tblGroup.cols.status, enuBannableStatus.active)
      .limit(Math.min(limit, 1000))
      .offset(from);

    return questions;
  },

  /** List all questions visible to a user */
  listByUser: async (
    service: string,
    userID: number,
    limit = 1000,
    from = 0
  ): Promise<Array<Pick<IntfSampleQuestion, typeof cols.question> & { filName: string }>> => {
    const db = await getDB();

    const questions = await db(tblName)
      .select(cols.question, files.cols.name)
      .leftJoin(files.tblName, files.cols.id, cols.assigned_filID)
      .leftJoin(tblUser.tblName, tblUser.cols.id, files.cols.owner_usrID)
      .leftJoin(tblGroup.tblName, tblGroup.cols.id, tblUser.cols.assigned_grpID)
      .where(tblUser.cols.id, userID)
      .andWhere(tblFiles.cols.service, service)
      .andWhere(tblUser.cols.status, enuBannableStatus.active)
      .andWhere(tblGroup.cols.status, enuBannableStatus.active)
      .limit(Math.min(limit, 1000))
      .offset(from);

    return questions;
  },

  /** Add a question for a file */
  add: async (
    service: string,
    userID: number,
    fileKey: string,
    question: string
  ): Promise<number> => {
    const db = await getDB();

    const fileSpecs = await tblFiles.get(service, userID, fileKey)
    if(!fileSpecs) throw new exHttpAccessDenied("File not found or you have no access")

    if(question.length > 100) 
      question = question.substring(0, 100)

    const res = await db(tblName)
      .insert({
        smqQuestion: question,
        smqAssigned_filID: fileSpecs[tblFiles.cols.id],
      })
      .returning(cols.id);

    return (Array.isArray(res)) ? res[0]?.[cols.id as keyof typeof res[0]] ?? res[0] : res
  },
};

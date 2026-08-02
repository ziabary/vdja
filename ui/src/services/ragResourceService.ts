import type { Response } from 'express';
import md5 from 'md5';

import atDB from '../db/atDB';
import type { IntfAuth } from '../interfaces/auth';
import type { IntfChunk, IntfFileMeta } from '../interfaces/file';
import type { TypFileListItem } from '../db/tables/tblFiles';
import { enuFileStatus } from '../db/tables/tblFiles';
import { exHttpAccessDenied, exHttpInvalidParams } from '../interfaces/exHttp';
import { toMegaByte } from '../utils/common';
import file2DB from './file2TxtService';
import vectorDB from './vectorDB-old';
import { sendStreamHeadersIfNeeded } from './chatService';
import logger from '../utils/logger';

export function ragUserCollection(service: string, auth: Pick<IntfAuth, 'key'>) {
  return `${service}_${auth.key}`;
}

export async function listRagFiles(service: string, auth: IntfAuth, limit = 1000, offset = 0) {
  return atDB.files.list(service, auth.uid, limit, offset);
}

export async function deleteRagFile(service: string, auth: IntfAuth, fileSpec: TypFileListItem) {
  try {
    let countChunks = 0;
    try {
      countChunks = await vectorDB().deleteFileChunks(ragUserCollection(service, auth), fileSpec.filKey);
    } catch (error) {
      // A missing vector collection must not leave the relational file record undeletable.
      logger.warn({ deleteRagFileVector: (error as Error).message, service, fileKey: fileSpec.filKey });
    }
    await atDB.files.delete(service, fileSpec);
    return { success: true, countChunks };
  } catch (error) {
    logger.error({ deleteRagFile: error });
    return { success: false, countChunks: 0 };
  }
}

export async function deleteRagFileByKey(service: string, auth: IntfAuth, fileKey: string) {
  const fileSpec = await atDB.files.get(service, auth.uid, fileKey);
  if (!fileSpec) throw new exHttpAccessDenied('فایل مورد نظر یافت نشد یا شما دسترسی ندارید');
  return deleteRagFile(service, auth, fileSpec as TypFileListItem);
}

export async function uploadRagFile(
  service: string,
  auth: IntfAuth,
  file: IntfFileMeta,
  apiRes?: Response,
) {
  if (!file) throw new exHttpInvalidParams('فایلی انتخاب نشده');

  if (toMegaByte(file.size) > (auth?.privs?.services[service]?.files?.maxSize || 10000)) {
    throw new exHttpInvalidParams('حجم فایل بیش از حد تعیین‌شده برای شما می‌باشد');
  }

  const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
  const fileKey = md5(file.originalname + file.size);
  const oldFile = await atDB.files.get(service, auth.uid, fileKey);
  if (oldFile) throw new exHttpInvalidParams('قبلا بارگذاری شده است');

  const userStats = await atDB.perUserStats.get(service, auth.uid);
  if (userStats) {
    if ((userStats[atDB.perUserStats.cols.activeFiles] || 0) >= (auth?.privs?.services[service]?.files?.maxCount || Infinity)) {
      throw new exHttpInvalidParams(auth.privs?.services[service]?.files?.onQuota || 'حداکثر تعداد مجاز فایل فعال را استفاده کرده‌اید. برای آپلود فایل جدید از فایل‌های قبلی حذف کنید');
    }
    if (toMegaByte((userStats[atDB.perUserStats.cols.activeSize] || 0) + file.size) > (auth?.privs?.services[service]?.files?.maxTotalSize || Infinity)) {
      throw new exHttpInvalidParams(auth.privs?.services[service]?.files?.onQuota || 'حداکثر حجم مجموع را استفاده کرده‌اید. برای آپلود فایل جدید از فایل‌های قبلی حذف کنید');
    }
  }

  const { totalChunks, totalContent, totalPoints } = await file2DB(
    file,
    fileKey,
    async (chunks: IntfChunk[]) => vectorDB().addFileText(ragUserCollection(service, auth), fileKey, fileName, chunks),
    (i, total) => {
      if (!apiRes) return;
      sendStreamHeadersIfNeeded(apiRes);
      apiRes.write('progress: ' + JSON.stringify({ fileName, progress: i, total }) + '\n');
    },
  );

  if (!totalPoints || totalContent < 10) {
    if (file.path.endsWith('.pdf')) throw new exHttpInvalidParams('فایل تصویری بوده یا استخراج محتوا از آن ممکن نیست');
    throw new exHttpInvalidParams('به دلایل فنی، استخراج یا ذخیره داده‌ها در پایگاه داده میسر نشد.');
  }

  await atDB.files.add(service, auth.uid, fileKey, fileName, file.size, totalChunks, enuFileStatus.active);
  return { success: true, fileKey, fileName, size: file.size, chunks: totalChunks };
}

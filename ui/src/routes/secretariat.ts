import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import os from 'os';
import { rm } from 'fs/promises';
import { getAuthInfo } from '../services/authService';
import { exHttpAccessDenied, exHttpInvalidParams } from '../interfaces/exHttp';
import {
  createLetter, createSource, deleteLetter, getLetter, getLetterFile, listAdminLetters, listLetters, listSources, listWizardLetters,
  requireSecretariatAdmin, requireSecretariatOperator, searchLetters, setLetterConfidentiality, syncSource, updateSource, uploadWizard,
} from '../services/secretariatService';

const router = express.Router();
const upload = multer({ dest: os.tmpdir(), limits: { files: 20, fileSize: 20 * 1024 * 1024 } });
const wizardUpload = multer({ dest: os.tmpdir(), limits: { files: 50, fileSize: 20 * 1024 * 1024 } });
const id = (value: string) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new exHttpInvalidParams('شناسه نامعتبر است');
  return parsed;
};

router.get('/secretariat/access', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  const admin = Boolean(auth.privs?.isAdmin || auth.privs?.secretariatAdmin);
  res.json({ admin, operator: Boolean(admin || auth.privs?.secretariatOperator) });
});

router.get('/secretariat/sources', async (req: Request, res: Response) => {
  res.json({ sources: await listSources(await getAuthInfo(req)) });
});
router.post('/secretariat/sources', async (req: Request, res: Response) => {
  res.status(201).json({ source: await createSource(await getAuthInfo(req), req.body || {}) });
});
router.put('/secretariat/sources/:id', async (req: Request, res: Response) => {
  res.json({ source: await updateSource(await getAuthInfo(req), id(String(req.params.id)), req.body || {}) });
});
router.post('/secretariat/sources/:id/sync', async (req: Request, res: Response) => {
  res.json(await syncSource(await getAuthInfo(req), id(String(req.params.id))));
});
router.post('/secretariat/wizard', async (req: Request, _res: Response, next: NextFunction) => {
  requireSecretariatAdmin(await getAuthInfo(req));
  if (req.query.uploadWizard !== 'true') throw new exHttpAccessDenied('ویزارد بارگذاری فعال نیست');
  next();
}, wizardUpload.array('files', 50), async (req: Request, res: Response) => {
  const files = (req.files || []) as Express.Multer.File[];
  try { res.json(await uploadWizard(await getAuthInfo(req), files)); }
  finally { await Promise.all(files.map(file => rm(file.path, { force: true }))); }
});
router.get('/secretariat/wizard/letters', async (req: Request, res: Response) => {
  const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
  const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
  res.json(await listWizardLetters(await getAuthInfo(req), limit, offset));
});
router.get('/secretariat/admin/letters', async (req: Request, res: Response) => {
  res.json(await listAdminLetters(await getAuthInfo(req),
    req.query.limit === undefined ? 50 : Number(req.query.limit),
    req.query.offset === undefined ? 0 : Number(req.query.offset)));
});
router.delete('/secretariat/letters/:key', async (req: Request, res: Response) => {
  res.json(await deleteLetter(await getAuthInfo(req), String(req.params.key)));
});
router.patch('/secretariat/letters/:key/confidentiality', async (req: Request, res: Response) => {
  res.json(await setLetterConfidentiality(await getAuthInfo(req), String(req.params.key), req.body?.confidential));
});
router.post('/secretariat/letters', async (req: Request, _res: Response, next: NextFunction) => {
  requireSecretariatOperator(await getAuthInfo(req));
  next();
}, upload.array('files', 20), async (req: Request, res: Response) => {
  const files = (req.files || []) as Express.Multer.File[];
  try {
    res.status(201).json({ letter: await createLetter(await getAuthInfo(req), req.body || {}, files, undefined,
      { confidential: ['on', 'true', '1'].includes(String(req.body?.confidential || '')) }) });
  } finally {
    await Promise.all(files.map(file => rm(file.path, { force: true })));
  }
});
router.get('/secretariat/letters', async (req: Request, res: Response) => {
  res.json({ letters: await listLetters(await getAuthInfo(req), Number(req.query.limit) || 50) });
});
router.get('/secretariat/search', async (req: Request, res: Response) => {
  const minScore = req.query.minScore ?? '86';
  if (typeof minScore !== 'string') throw new exHttpInvalidParams('حداقل امتیاز ارتباط نامعتبر است');
  res.json({ results: await searchLetters(await getAuthInfo(req), String(req.query.q || ''), Number(minScore)) });
});
router.get('/secretariat/letters/:key', async (req: Request, res: Response) => {
  res.json(await getLetter(await getAuthInfo(req), String(req.params.key)));
});
router.get('/secretariat/letters/:key/files/:fileKey', async (req: Request, res: Response) => {
  const file = await getLetterFile(await getAuthInfo(req), String(req.params.key), String(req.params.fileKey));
  res.download(file.sflPath, file.sflName, { dotfiles: 'allow' });
});

export default async () => router;

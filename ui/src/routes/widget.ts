import express from 'express';
import type { Request, Response, Router } from 'express';
import multer from 'multer';
import os from 'os';

import { getAuthInfo } from '../services/authService';
import {
  addOperator,
  assignConversation,
  createWidget,
  createWidgetSession,
  deleteWidget,
  deleteWidgetFile,
  ensurePublicOrigin,
  getAccessibleWidget,
  getOwnedWidget,
  installCode,
  listConversations,
  listWidgets,
  publicWidgetConfig,
  publishWidget,
  resolveConversation,
  retryWidgetFile,
  sendHumanReply,
  sendWidgetMessage,
  sessionHistory,
  setOperatorActive,
  unpublishWidget,
  updateSessionVisitor,
  updateWidget,
  uploadWidgetFile,
  validateWidget,
  widgetAnalytics,
  widgetDTO,
} from '../services/widgetService';
import atDB from '../db/atDB';
import type { IntfFileMeta } from '../interfaces/file';
import { exHttpInvalidParams } from '../interfaces/exHttp';
import { parseQueryToNumber, parseQueryToString } from '../utils/common';

const router: Router = express.Router();
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

function bodyObject(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
}

/* -------------------------------------------------------------------------- */
/* Owner/operator management API                                              */
/* -------------------------------------------------------------------------- */

router.get('/widget', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  res.json({ widgets: await listWidgets(auth) });
});

router.post('/widget', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  res.status(201).json({ widget: await createWidget(auth, bodyObject(req)) });
});

router.get('/widget/conversations', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  res.json({ conversations: await listConversations(auth, {
    widgetId: parseQueryToString(req.query.widgetId),
    status: parseQueryToString(req.query.status),
    operator: parseQueryToString(req.query.operator),
  }) });
});

router.get('/widget/analytics', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  res.json(await widgetAnalytics(auth, parseQueryToString(req.query.widgetId) || 'all'));
});

router.get('/widget/:widgetKey', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  const row = await getAccessibleWidget(auth, req.params.widgetKey);
  res.json({ widget: await widgetDTO(row, row.wgtOwner_usrID === auth.uid, auth.uid) });
});

router.put('/widget/:widgetKey', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  res.json({ widget: await updateWidget(auth, req.params.widgetKey, bodyObject(req)) });
});

router.delete('/widget/:widgetKey', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  res.json(await deleteWidget(auth, req.params.widgetKey));
});

router.get('/widget/:widgetKey/files', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  const row = await getOwnedWidget(auth, req.params.widgetKey);
  const dto = await widgetDTO(row, true, auth.uid);
  res.json({ files: dto.files });
});

router.post('/widget/:widgetKey/files', upload.single('file'), async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  const result = await uploadWidgetFile(auth, req.params.widgetKey, req.file as IntfFileMeta, res);
  if (res.headersSent) {
    res.write(`data: [DONE]: ${JSON.stringify({ fileKey: result.fileKey, totalChunks: result.chunks })}\n`);
    res.end();
  } else {
    res.status(201).json(result);
  }
});

router.delete('/widget/:widgetKey/files/:fileKey', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  res.json(await deleteWidgetFile(auth, req.params.widgetKey, req.params.fileKey));
});

router.post('/widget/:widgetKey/files/:fileKey/retry', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  res.json(await retryWidgetFile(auth, req.params.widgetKey, req.params.fileKey));
});

router.post('/widget/:widgetKey/operators', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  res.status(201).json({ operators: await addOperator(auth, req.params.widgetKey, bodyObject(req).username) });
});

router.put('/widget/:widgetKey/operators/:username', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  const active = bodyObject(req).active !== false;
  res.json({ operators: await setOperatorActive(auth, req.params.widgetKey, req.params.username, active) });
});

router.delete('/widget/:widgetKey/operators/:username', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  res.json({ operators: await setOperatorActive(auth, req.params.widgetKey, req.params.username, false) });
});

router.get('/widget/:widgetKey/validate', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  res.json(await validateWidget(auth, req.params.widgetKey));
});

router.post('/widget/:widgetKey/publish', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  res.json({ widget: await publishWidget(auth, req.params.widgetKey) });
});

router.post('/widget/:widgetKey/unpublish', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  res.json({ widget: await unpublishWidget(auth, req.params.widgetKey) });
});

router.get('/widget/:widgetKey/install-code', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  await getOwnedWidget(auth, req.params.widgetKey);
  res.json({ code: installCode(req.params.widgetKey) });
});

/* Preview uses the draft configuration but the same isolated runtime RAG user. */
router.get('/widget/:widgetKey/preview/config', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  res.json(await publicWidgetConfig(req.params.widgetKey, auth));
});

router.post('/widget/:widgetKey/preview/sessions', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  const row = await getOwnedWidget(auth, req.params.widgetKey);
  await atDB.widgets.touchTest(row.wgtID);
  res.status(201).json(await createWidgetSession(row, 'Preview', null));
});

router.post('/widget/:widgetKey/preview/sessions/:sessionKey/messages', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  const row = await getOwnedWidget(auth, req.params.widgetKey);
  await sendWidgetMessage(row, req.params.sessionKey, bodyObject(req).message, res, true);
});

router.get('/widget/:widgetKey/preview/sessions/:sessionKey/messages', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  const row = await getOwnedWidget(auth, req.params.widgetKey);
  res.json(await sessionHistory(row, req.params.sessionKey, parseQueryToNumber(req.query.after)));
});

router.put('/widget/:widgetKey/preview/sessions/:sessionKey/contact', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  const row = await getOwnedWidget(auth, req.params.widgetKey);
  res.json(await updateSessionVisitor(row, req.params.sessionKey, bodyObject(req)));
});

router.post('/widget/:widgetKey/conversations/:sessionKey/assign', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  res.json(await assignConversation(auth, req.params.widgetKey, req.params.sessionKey, bodyObject(req).operatorUsername));
});

router.post('/widget/:widgetKey/conversations/:sessionKey/replies', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  res.status(201).json(await sendHumanReply(auth, req.params.widgetKey, req.params.sessionKey, bodyObject(req).text));
});

router.post('/widget/:widgetKey/conversations/:sessionKey/resolve', async (req: Request, res: Response) => {
  const auth = await getAuthInfo(req);
  res.json(await resolveConversation(auth, req.params.widgetKey, req.params.sessionKey));
});

/* -------------------------------------------------------------------------- */
/* Public API used by the embeddable JavaScript                               */
/* Dynamic exact-origin CORS is installed in src/index.ts before global CORS. */
/* -------------------------------------------------------------------------- */

router.get('/widget/public/:widgetKey/config', async (req: Request, res: Response) => {
  const row = await atDB.widgets.getPublishedByKey(req.params.widgetKey);
  if (!row) throw new exHttpInvalidParams('ویجت منتشرشده پیدا نشد');
  await ensurePublicOrigin(row, req);
  res.json(await publicWidgetConfig(req.params.widgetKey));
});

router.post('/widget/public/:widgetKey/sessions', async (req: Request, res: Response) => {
  const row = await atDB.widgets.getPublishedByKey(req.params.widgetKey);
  if (!row) throw new exHttpInvalidParams('ویجت منتشرشده پیدا نشد');
  const origin = await ensurePublicOrigin(row, req);
  res.status(201).json(await createWidgetSession(row, 'Public', origin));
});

router.post('/widget/public/:widgetKey/sessions/:sessionKey/messages', async (req: Request, res: Response) => {
  const row = await atDB.widgets.getPublishedByKey(req.params.widgetKey);
  if (!row) throw new exHttpInvalidParams('ویجت منتشرشده پیدا نشد');
  await ensurePublicOrigin(row, req);
  await sendWidgetMessage(row, req.params.sessionKey, bodyObject(req).message, res, false);
});

router.get('/widget/public/:widgetKey/sessions/:sessionKey/messages', async (req: Request, res: Response) => {
  const row = await atDB.widgets.getPublishedByKey(req.params.widgetKey);
  if (!row) throw new exHttpInvalidParams('ویجت منتشرشده پیدا نشد');
  await ensurePublicOrigin(row, req);
  res.json(await sessionHistory(row, req.params.sessionKey, parseQueryToNumber(req.query.after)));
});

router.put('/widget/public/:widgetKey/sessions/:sessionKey/contact', async (req: Request, res: Response) => {
  const row = await atDB.widgets.getPublishedByKey(req.params.widgetKey);
  if (!row) throw new exHttpInvalidParams('ویجت منتشرشده پیدا نشد');
  await ensurePublicOrigin(row, req);
  res.json(await updateSessionVisitor(row, req.params.sessionKey, bodyObject(req)));
});

export default async () => router;

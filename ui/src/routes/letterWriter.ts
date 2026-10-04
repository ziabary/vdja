import express from 'express';
import { getAuthInfo } from '../services/authService';
import { InsufficientLetterInformation, requireWriterAdmin, requireWriterUser } from '../utils/letterWriter';
import {
  deleteWriterStyle, deleteWriterTemplate, generateWriterLetter, getWriterCatalog,
  saveWriterSettings, saveWriterStyle, saveWriterTemplate,
} from '../services/letterWriterService';

const router = express.Router();

router.get('/letter-writer/access', async (req, res) => {
  const auth = await getAuthInfo(req);
  requireWriterUser(auth);
  let admin = false;
  try { requireWriterAdmin(auth); admin = true; } catch { /* regular user */ }
  res.json({ admin });
});
router.get('/letter-writer/catalog', async (req, res) => {
  res.json(await getWriterCatalog(await getAuthInfo(req)));
});
router.post('/letter-writer/generate', async (req, res) => {
  try { res.json(await generateWriterLetter(await getAuthInfo(req), req.body || {})); }
  catch (error) {
    if (!(error instanceof InsufficientLetterInformation)) throw error;
    res.status(error.status).json({ error: {
      status: error.status, message: error.message, missingInformation: error.missingInformation,
    } });
  }
});
router.get('/letter-writer/admin/catalog', async (req, res) => {
  res.json(await getWriterCatalog(await getAuthInfo(req), true));
});
router.put('/letter-writer/admin/settings', async (req, res) => {
  res.json({ settings: await saveWriterSettings(await getAuthInfo(req), req.body || {}) });
});
router.post('/letter-writer/admin/styles', async (req, res) => {
  res.status(201).json({ style: await saveWriterStyle(await getAuthInfo(req), req.body || {}) });
});
router.put('/letter-writer/admin/styles/:key', async (req, res) => {
  res.json({ style: await saveWriterStyle(await getAuthInfo(req), req.body || {}, String(req.params.key)) });
});
router.delete('/letter-writer/admin/styles/:key', async (req, res) => {
  res.json(await deleteWriterStyle(await getAuthInfo(req), String(req.params.key)));
});
router.post('/letter-writer/admin/templates', async (req, res) => {
  res.status(201).json({ template: await saveWriterTemplate(await getAuthInfo(req), req.body || {}) });
});
router.put('/letter-writer/admin/templates/:key', async (req, res) => {
  res.json({ template: await saveWriterTemplate(await getAuthInfo(req), req.body || {}, String(req.params.key)) });
});
router.delete('/letter-writer/admin/templates/:key', async (req, res) => {
  res.json(await deleteWriterTemplate(await getAuthInfo(req), String(req.params.key)));
});

export default async () => router;

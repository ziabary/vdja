import express from 'express';
import type { Request, Response, Router } from 'express';

import { getAuthInfo } from '../services/authService';
import {
  addCRMAsset,
  addCRMContact,
  addCRMMember,
  addCRMNote,
  addCRMTicket,
  analyzeCRMConversation,
  archiveCRMCustomer,
  archiveCRMOpportunity,
  archiveCRMProduct,
  archiveCRMTask,
  askCRMAssistant,
  createCRMConversation,
  createCRMCustomer,
  createCRMOpportunity,
  createCRMProduct,
  createCRMTask,
  crmBootstrap,
  crmDashboard,
  crmReports,
  crmSearch,
  generateCRMReply,
  generateCustomerSummary,
  getCRMConversation,
  getCRMCustomer,
  listCRMConversations,
  listCRMCustomers,
  listCRMMembers,
  listCRMOpportunities,
  listCRMProducts,
  listCRMTasks,
  removeCRMAsset,
  removeCRMContact,
  removeCRMMember,
  saveCRMReply,
  toggleCRMTask,
  updateCRMContact,
  updateCRMConversation,
  updateCRMCustomer,
  updateCRMMember,
  updateCRMOpportunity,
  updateCRMProduct,
  updateCRMTask,
  updateCRMTicket,
  updateCRMWorkspace,
} from '../services/crmService';
import { parseQueryToString } from '../utils/common';

const router: Router = express.Router();

function body(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
}

function workspaceKey(req: Request): string | null {
  const header = req.headers['x-crm-workspace'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  return parseQueryToString(req.query.workspace) || null;
}

router.get('/crm/bootstrap', async (req: Request, res: Response) => {
  res.json(await crmBootstrap(await getAuthInfo(req), workspaceKey(req)));
});

router.put('/crm/workspace', async (req: Request, res: Response) => {
  res.json(await updateCRMWorkspace(await getAuthInfo(req), workspaceKey(req), body(req)));
});

router.get('/crm/team', async (req: Request, res: Response) => {
  res.json({ members: await listCRMMembers(await getAuthInfo(req), workspaceKey(req)) });
});
router.post('/crm/team', async (req: Request, res: Response) => {
  res.status(201).json({ members: await addCRMMember(await getAuthInfo(req), workspaceKey(req), body(req)) });
});
router.put('/crm/team/:userID', async (req: Request, res: Response) => {
  res.json({ members: await updateCRMMember(await getAuthInfo(req), workspaceKey(req), Number(req.params.userID), body(req)) });
});
router.delete('/crm/team/:userID', async (req: Request, res: Response) => {
  res.json({ members: await removeCRMMember(await getAuthInfo(req), workspaceKey(req), Number(req.params.userID)) });
});

router.get('/crm/dashboard', async (req: Request, res: Response) => {
  res.json(await crmDashboard(await getAuthInfo(req), workspaceKey(req)));
});
router.get('/crm/reports', async (req: Request, res: Response) => {
  res.json(await crmReports(await getAuthInfo(req), workspaceKey(req)));
});
router.get('/crm/search', async (req: Request, res: Response) => {
  res.json(await crmSearch(await getAuthInfo(req), workspaceKey(req), parseQueryToString(req.query.q)));
});
router.post('/crm/assistant', async (req: Request, res: Response) => {
  const payload = body(req);
  res.json(await askCRMAssistant(await getAuthInfo(req), workspaceKey(req), payload.prompt, (payload.context || {}) as Record<string, unknown>));
});

router.get('/crm/products', async (req: Request, res: Response) => {
  res.json({ products: await listCRMProducts(await getAuthInfo(req), workspaceKey(req), parseQueryToString(req.query.type)) });
});
router.post('/crm/products', async (req: Request, res: Response) => {
  res.status(201).json({ product: await createCRMProduct(await getAuthInfo(req), workspaceKey(req), body(req)) });
});
router.put('/crm/products/:productKey', async (req: Request, res: Response) => {
  res.json({ product: await updateCRMProduct(await getAuthInfo(req), workspaceKey(req), req.params.productKey, body(req)) });
});
router.delete('/crm/products/:productKey', async (req: Request, res: Response) => {
  res.json(await archiveCRMProduct(await getAuthInfo(req), workspaceKey(req), req.params.productKey));
});

router.get('/crm/customers', async (req: Request, res: Response) => {
  res.json({ customers: await listCRMCustomers(await getAuthInfo(req), workspaceKey(req), {
    query: parseQueryToString(req.query.q),
    health: parseQueryToString(req.query.health),
    tier: parseQueryToString(req.query.tier),
  }) });
});
router.post('/crm/customers', async (req: Request, res: Response) => {
  res.status(201).json({ customer: await createCRMCustomer(await getAuthInfo(req), workspaceKey(req), body(req)) });
});
router.get('/crm/customers/:customerKey', async (req: Request, res: Response) => {
  res.json({ customer: await getCRMCustomer(await getAuthInfo(req), workspaceKey(req), req.params.customerKey) });
});
router.put('/crm/customers/:customerKey', async (req: Request, res: Response) => {
  res.json({ customer: await updateCRMCustomer(await getAuthInfo(req), workspaceKey(req), req.params.customerKey, body(req)) });
});
router.delete('/crm/customers/:customerKey', async (req: Request, res: Response) => {
  res.json(await archiveCRMCustomer(await getAuthInfo(req), workspaceKey(req), req.params.customerKey));
});
router.post('/crm/customers/:customerKey/summary', async (req: Request, res: Response) => {
  res.json({ customer: await generateCustomerSummary(await getAuthInfo(req), workspaceKey(req), req.params.customerKey) });
});

router.post('/crm/customers/:customerKey/notes', async (req: Request, res: Response) => {
  res.status(201).json({ customer: await addCRMNote(await getAuthInfo(req), workspaceKey(req), req.params.customerKey, body(req)) });
});

router.post('/crm/customers/:customerKey/contacts', async (req: Request, res: Response) => {
  res.status(201).json({ contact: await addCRMContact(await getAuthInfo(req), workspaceKey(req), req.params.customerKey, body(req)) });
});
router.put('/crm/customers/:customerKey/contacts/:contactKey', async (req: Request, res: Response) => {
  res.json({ contact: await updateCRMContact(await getAuthInfo(req), workspaceKey(req), req.params.customerKey, req.params.contactKey, body(req)) });
});
router.delete('/crm/customers/:customerKey/contacts/:contactKey', async (req: Request, res: Response) => {
  res.json(await removeCRMContact(await getAuthInfo(req), workspaceKey(req), req.params.customerKey, req.params.contactKey));
});
router.post('/crm/customers/:customerKey/assets', async (req: Request, res: Response) => {
  res.status(201).json({ customer: await addCRMAsset(await getAuthInfo(req), workspaceKey(req), req.params.customerKey, body(req)) });
});
router.delete('/crm/customers/:customerKey/assets/:assetKey', async (req: Request, res: Response) => {
  res.json(await removeCRMAsset(await getAuthInfo(req), workspaceKey(req), req.params.customerKey, req.params.assetKey));
});
router.post('/crm/customers/:customerKey/tickets', async (req: Request, res: Response) => {
  res.status(201).json({ ticket: await addCRMTicket(await getAuthInfo(req), workspaceKey(req), req.params.customerKey, body(req)) });
});
router.put('/crm/customers/:customerKey/tickets/:ticketKey', async (req: Request, res: Response) => {
  res.json({ ticket: await updateCRMTicket(await getAuthInfo(req), workspaceKey(req), req.params.customerKey, req.params.ticketKey, body(req)) });
});

router.get('/crm/opportunities', async (req: Request, res: Response) => {
  res.json({ opportunities: await listCRMOpportunities(await getAuthInfo(req), workspaceKey(req), {
    stage: parseQueryToString(req.query.stage), type: parseQueryToString(req.query.type),
  }) });
});
router.post('/crm/opportunities', async (req: Request, res: Response) => {
  res.status(201).json({ opportunity: await createCRMOpportunity(await getAuthInfo(req), workspaceKey(req), body(req)) });
});
router.put('/crm/opportunities/:opportunityKey', async (req: Request, res: Response) => {
  res.json({ opportunity: await updateCRMOpportunity(await getAuthInfo(req), workspaceKey(req), req.params.opportunityKey, body(req)) });
});
router.delete('/crm/opportunities/:opportunityKey', async (req: Request, res: Response) => {
  res.json(await archiveCRMOpportunity(await getAuthInfo(req), workspaceKey(req), req.params.opportunityKey));
});

router.get('/crm/tasks', async (req: Request, res: Response) => {
  res.json({ tasks: await listCRMTasks(await getAuthInfo(req), workspaceKey(req), parseQueryToString(req.query.includeDone) === 'true') });
});
router.post('/crm/tasks', async (req: Request, res: Response) => {
  res.status(201).json({ task: await createCRMTask(await getAuthInfo(req), workspaceKey(req), body(req)) });
});
router.put('/crm/tasks/:taskKey', async (req: Request, res: Response) => {
  res.json({ task: await updateCRMTask(await getAuthInfo(req), workspaceKey(req), req.params.taskKey, body(req)) });
});
router.put('/crm/tasks/:taskKey/toggle', async (req: Request, res: Response) => {
  res.json({ task: await toggleCRMTask(await getAuthInfo(req), workspaceKey(req), req.params.taskKey) });
});
router.delete('/crm/tasks/:taskKey', async (req: Request, res: Response) => {
  res.json(await archiveCRMTask(await getAuthInfo(req), workspaceKey(req), req.params.taskKey));
});

router.get('/crm/conversations', async (req: Request, res: Response) => {
  res.json({ conversations: await listCRMConversations(await getAuthInfo(req), workspaceKey(req)) });
});
router.post('/crm/conversations', async (req: Request, res: Response) => {
  res.status(201).json({ conversation: await createCRMConversation(await getAuthInfo(req), workspaceKey(req), body(req)) });
});
router.get('/crm/conversations/:conversationKey', async (req: Request, res: Response) => {
  res.json({ conversation: await getCRMConversation(await getAuthInfo(req), workspaceKey(req), req.params.conversationKey) });
});
router.put('/crm/conversations/:conversationKey', async (req: Request, res: Response) => {
  res.json({ conversation: await updateCRMConversation(await getAuthInfo(req), workspaceKey(req), req.params.conversationKey, body(req)) });
});
router.post('/crm/conversations/:conversationKey/analyze', async (req: Request, res: Response) => {
  res.json({ conversation: await analyzeCRMConversation(await getAuthInfo(req), workspaceKey(req), req.params.conversationKey) });
});
router.post('/crm/conversations/:conversationKey/reply-draft', async (req: Request, res: Response) => {
  res.json({ text: await generateCRMReply(await getAuthInfo(req), workspaceKey(req), req.params.conversationKey, body(req).tone) });
});
router.post('/crm/conversations/:conversationKey/replies', async (req: Request, res: Response) => {
  res.status(201).json({ conversation: await saveCRMReply(await getAuthInfo(req), workspaceKey(req), req.params.conversationKey, body(req).text) });
});

export default async () => router;

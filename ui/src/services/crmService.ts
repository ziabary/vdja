import { randomUUID } from 'crypto';
import md5 from 'md5';
import type { Knex } from 'knex';

import type { IntfAuth } from '../interfaces/auth';
import { enuLLMServices } from '../interfaces/config';
import {
  exHttpAccessDenied,
  exHttpConflict,
  exHttpInvalidParams,
} from '../interfaces/exHttp';
import atDB from '../db/atDB';
import { getDB } from '../db/index';
import { cols, firstInsertedID, tables } from '../db/tables/tblCRM';
import { generate } from './chatService';

/* -------------------------------------------------------------------------- */
/* Types and constants                                                        */
/* -------------------------------------------------------------------------- */

type Row = Record<string, any>;
type CRMRole = 'Owner' | 'Manager' | 'Sales' | 'Support' | 'Viewer';

const ACTIVE = 'Active';
const REMOVED = 'Removed';
const ACTIVE_STAGES = ['lead', 'qualification', 'demo', 'proposal', 'negotiation', 'decision'];
const ALL_STAGES = [...ACTIVE_STAGES, 'won', 'lost'];
const STAGE_PROBABILITY: Record<string, number> = {
  lead: 25,
  qualification: 35,
  demo: 50,
  proposal: 60,
  negotiation: 72,
  decision: 85,
  won: 100,
  lost: 0,
};
const ROLE_LABEL: Record<CRMRole, string> = {
  Owner: 'مالک CRM',
  Manager: 'مدیر فروش',
  Sales: 'کارشناس فروش',
  Support: 'کارشناس خدمات مشتریان',
  Viewer: 'مشاهده‌گر',
};
const WRITE_ROLES: CRMRole[] = ['Owner', 'Manager', 'Sales', 'Support'];
const MANAGE_ROLES: CRMRole[] = ['Owner', 'Manager'];

interface CRMAccess {
  workspace: Row;
  member: Row;
  role: CRMRole;
}

/* -------------------------------------------------------------------------- */
/* Generic helpers                                                            */
/* -------------------------------------------------------------------------- */

const key32 = () => md5(randomUUID());
const nowISO = () => new Date().toISOString();

function text(value: unknown, max = 1000): string {
  return String(value ?? '').trim().slice(0, max);
}

function optionalText(value: unknown, max = 1000): string | null {
  const out = text(value, max);
  return out || null;
}

function finiteNumber(value: unknown, fallback = 0): number {
  const out = Number(value);
  return Number.isFinite(out) ? out : fallback;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return Math.min(max, Math.max(min, finiteNumber(value, fallback)));
}

function dateOrNull(value: unknown): Date | null {
  if (!value) return null;
  const out = new Date(String(value));
  return Number.isNaN(out.getTime()) ? null : out;
}

function parseJSON<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value as T;
  try { return JSON.parse(String(value)) as T; } catch { return fallback; }
}

function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function firstID(result: unknown, idColumn: string): number {
  return firstInsertedID(result, idColumn);
}

function roleOf(value: unknown): CRMRole {
  const normalized = text(value, 20).toLowerCase();
  if (normalized === 'owner') return 'Owner';
  if (normalized === 'manager') return 'Manager';
  if (normalized === 'support') return 'Support';
  if (normalized === 'viewer') return 'Viewer';
  return 'Sales';
}

function requireRole(access: CRMAccess, roles: CRMRole[]): void {
  if (!roles.includes(access.role)) throw new exHttpAccessDenied('برای انجام این عملیات دسترسی کافی ندارید');
}

function requireWrite(access: CRMAccess): void {
  requireRole(access, WRITE_ROLES);
}

function deriveShort(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map(item => item[0]).join('').slice(0, 4) || name.slice(0, 2);
}

function normalizeTags(value: unknown): string[] {
  const source = Array.isArray(value) ? value : text(value, 2000).split(/[،,؛;\n]+/);
  return [...new Set(source.map(item => text(item, 60)).filter(Boolean))].slice(0, 30);
}

function normalizeProductType(value: unknown): 'hardware' | 'software' | 'service' {
  const normalized = text(value, 20).toLowerCase();
  if (normalized === 'hardware') return 'hardware';
  if (normalized === 'service') return 'service';
  return 'software';
}

function dbProductType(value: unknown): string {
  const normalized = normalizeProductType(value);
  return normalized[0].toUpperCase() + normalized.slice(1);
}

function normalizeIcon(value: unknown): string | null {
  const icon = text(value, 64).toLowerCase();
  return /^fa-[a-z0-9-]+$/.test(icon) ? icon : null;
}

function memberRoleLabel(role: CRMRole): string {
  return ROLE_LABEL[role];
}

async function addActivity(
  trx: Knex.Transaction | Knex,
  workspaceID: number,
  customerID: number,
  userID: number | null,
  typeValue: string,
  titleValue: string,
  detailValue?: string | null,
  relatedType?: string | null,
  relatedKey?: string | null,
): Promise<void> {
  await trx(tables.activities).insert({
    [cols.activity.key]: key32(),
    [cols.activity.workspaceID]: workspaceID,
    [cols.activity.customerID]: customerID,
    [cols.activity.createdByUserID]: userID,
    [cols.activity.type]: text(typeValue, 32) || 'note',
    [cols.activity.title]: text(titleValue, 220),
    [cols.activity.detail]: optionalText(detailValue, 10000),
    [cols.activity.relatedType]: optionalText(relatedType, 32),
    [cols.activity.relatedKey]: optionalText(relatedKey, 32),
  });
}

async function touchCustomer(trx: Knex.Transaction | Knex, customerID: number): Promise<void> {
  await trx(tables.customers).where(cols.customer.id, customerID).update({
    [cols.customer.lastInteraction]: trx.fn.now(),
    [cols.customer.updatedAt]: trx.fn.now(),
  });
}

/* -------------------------------------------------------------------------- */
/* Workspace and access                                                       */
/* -------------------------------------------------------------------------- */

async function createWorkspaceForUser(auth: IntfAuth): Promise<CRMAccess> {
  const db = await getDB();
  const profile = await atDB.user.getByID(auth.uid, true);
  return db.transaction(async trx => {
    const name = text(profile?.usrOrganization || profile?.usrName || auth.name || 'CRM سازمان', 120) || 'CRM سازمان';
    const result = await trx(tables.workspaces).insert({
      [cols.workspace.key]: key32(),
      [cols.workspace.name]: name,
      [cols.workspace.ownerUserID]: auth.uid,
      [cols.workspace.currency]: 'تومان',
      [cols.workspace.settings]: json({ locale: 'fa-IR' }),
      [cols.workspace.status]: ACTIVE,
    }).returning(cols.workspace.id);
    const workspaceID = firstID(result, cols.workspace.id);
    if (!workspaceID) throw new Error('امکان ایجاد فضای CRM وجود ندارد');
    await trx(tables.members).insert({
      [cols.member.workspaceID]: workspaceID,
      [cols.member.userID]: auth.uid,
      [cols.member.role]: 'Owner',
      [cols.member.status]: ACTIVE,
    });
    const workspace = await trx(tables.workspaces).where(cols.workspace.id, workspaceID).first();
    const member = await trx(tables.members).where({
      [cols.member.workspaceID]: workspaceID,
      [cols.member.userID]: auth.uid,
    }).first();
    return { workspace, member, role: 'Owner' };
  });
}

export async function getCRMAccess(auth: IntfAuth, workspaceKey?: string | null): Promise<CRMAccess> {
  const db = await getDB();
  const query = db(`${tables.members} as m`)
    .select('m.*', 'w.*')
    .join(`${tables.workspaces} as w`, `w.${cols.workspace.id}`, `m.${cols.member.workspaceID}`)
    .where(`m.${cols.member.userID}`, auth.uid)
    .andWhere(`m.${cols.member.status}`, ACTIVE)
    .andWhere(`w.${cols.workspace.status}`, ACTIVE);
  if (workspaceKey) query.andWhere(`w.${cols.workspace.key}`, workspaceKey);
  const row = await query.orderBy(`w.${cols.workspace.updatedAt}`, 'desc').first();
  if (!row) {
    if (workspaceKey) throw new exHttpAccessDenied('به این فضای CRM دسترسی ندارید');
    return createWorkspaceForUser(auth);
  }
  return { workspace: row, member: row, role: roleOf(row[cols.member.role]) };
}

async function resolveWorkspaceMemberUserID(
  access: CRMAccess,
  value: unknown,
  options: { nullable?: boolean } = {},
): Promise<number | null> {
  if (value === null || value === undefined || value === '') {
    if (options.nullable) return null;
    throw new exHttpInvalidParams('کاربر مسئول الزامی است');
  }
  const userID = finiteNumber(value);
  if (!userID) throw new exHttpInvalidParams('شناسه کاربر معتبر نیست');
  const db = await getDB();
  const member = await db(tables.members).where({
    [cols.member.workspaceID]: access.workspace[cols.workspace.id],
    [cols.member.userID]: userID,
    [cols.member.status]: ACTIVE,
  }).first();
  if (!member) throw new exHttpInvalidParams('کاربر انتخاب‌شده عضو این فضای CRM نیست');
  return userID;
}

async function getEntityByKey(
  tableName: string,
  keyColumn: string,
  workspaceColumn: string | null,
  key: string,
  access: CRMAccess,
): Promise<Row> {
  const db = await getDB();
  const query = db(tableName).where(keyColumn, key);
  if (workspaceColumn) query.andWhere(workspaceColumn, access.workspace[cols.workspace.id]);
  const row = await query.first();
  if (!row) throw new exHttpInvalidParams('رکورد موردنظر پیدا نشد');
  return row;
}

async function getCustomerRow(access: CRMAccess, key: string): Promise<Row> {
  const row = await getEntityByKey(tables.customers, cols.customer.key, cols.customer.workspaceID, key, access);
  if (row[cols.customer.status] !== ACTIVE) throw new exHttpInvalidParams('مشتری پیدا نشد');
  return row;
}

async function getProductRow(access: CRMAccess, key: string): Promise<Row> {
  const row = await getEntityByKey(tables.products, cols.product.key, cols.product.workspaceID, key, access);
  if (row[cols.product.status] !== ACTIVE) throw new exHttpInvalidParams('محصول پیدا نشد');
  return row;
}

async function getOpportunityRow(access: CRMAccess, key: string): Promise<Row> {
  const row = await getEntityByKey(tables.opportunities, cols.opportunity.key, cols.opportunity.workspaceID, key, access);
  if (row[cols.opportunity.status] !== ACTIVE) throw new exHttpInvalidParams('فرصت فروش پیدا نشد');
  return row;
}

async function getConversationRow(access: CRMAccess, key: string): Promise<Row> {
  return getEntityByKey(tables.conversations, cols.conversation.key, cols.conversation.workspaceID, key, access);
}

/* -------------------------------------------------------------------------- */
/* Snapshot and DTOs                                                          */
/* -------------------------------------------------------------------------- */

async function loadSnapshot(access: CRMAccess, userID: number): Promise<Record<string, Row[]>> {
  const db = await getDB();
  const workspaceID = access.workspace[cols.workspace.id];
  const customersQuery = db(tables.customers).where(cols.customer.workspaceID, workspaceID).where(cols.customer.status, ACTIVE);
  const [members, products, customers, contacts, assets, tickets, opportunities, tasks, conversations, messages, reads, activities] = await Promise.all([
    db(`${tables.members} as m`).select('m.*', 'u.usrID', 'u.usrName', 'u.usrUsername', 'u.usrAvatar', 'u.usrOrganization', 'u.usrTitle')
      .join('tblUser as u', 'u.usrID', `m.${cols.member.userID}`)
      .where(`m.${cols.member.workspaceID}`, workspaceID).andWhere(`m.${cols.member.status}`, ACTIVE).andWhere('u.usrStatus', ACTIVE),
    db(tables.products).where(cols.product.workspaceID, workspaceID).where(cols.product.status, ACTIVE),
    customersQuery,
    db(`${tables.contacts} as c`).select('c.*').join(`${tables.customers} as cu`, `cu.${cols.customer.id}`, `c.${cols.contact.customerID}`)
      .where(`cu.${cols.customer.workspaceID}`, workspaceID).andWhere(`c.${cols.contact.status}`, ACTIVE),
    db(`${tables.assets} as a`).select('a.*').join(`${tables.customers} as cu`, `cu.${cols.customer.id}`, `a.${cols.asset.customerID}`)
      .where(`cu.${cols.customer.workspaceID}`, workspaceID),
    db(`${tables.tickets} as t`).select('t.*').join(`${tables.customers} as cu`, `cu.${cols.customer.id}`, `t.${cols.ticket.customerID}`)
      .where(`cu.${cols.customer.workspaceID}`, workspaceID),
    db(tables.opportunities).where(cols.opportunity.workspaceID, workspaceID).where(cols.opportunity.status, ACTIVE),
    db(tables.tasks).where(cols.task.workspaceID, workspaceID).where(cols.task.status, ACTIVE),
    db(tables.conversations).where(cols.conversation.workspaceID, workspaceID).whereNot(cols.conversation.status, REMOVED),
    db(`${tables.conversationMessages} as cm`).select('cm.*').join(`${tables.conversations} as cv`, `cv.${cols.conversation.id}`, `cm.${cols.conversationMessage.conversationID}`)
      .where(`cv.${cols.conversation.workspaceID}`, workspaceID),
    db(tables.conversationReads).where(cols.conversationRead.userID, userID),
    db(tables.activities).where(cols.activity.workspaceID, workspaceID).orderBy(cols.activity.createdAt, 'desc'),
  ]);
  return { members, products, customers, contacts, assets, tickets, opportunities, tasks, conversations, messages, reads, activities };
}

function userDTO(row?: Row): Row | null {
  if (!row) return null;
  return {
    id: String(row.usrID ?? row[cols.member.userID] ?? ''),
    name: row.usrName || row.usrUsername || 'کاربر سامانه',
    username: row.usrUsername || '',
    avatar: row.usrAvatar || '',
    organization: row.usrOrganization || '',
    title: row.usrTitle || '',
    role: memberRoleLabel(roleOf(row[cols.member.role])),
    roleKey: roleOf(row[cols.member.role]).toLowerCase(),
  };
}

function productDTO(row: Row, snapshot?: Record<string, Row[]>): Row {
  const productID = row[cols.product.id];
  const assets = snapshot?.assets?.filter(item => Number(item[cols.asset.productID]) === Number(productID)) || [];
  const opportunities = snapshot?.opportunities?.filter(item => Number(item[cols.opportunity.productID]) === Number(productID) && ACTIVE_STAGES.includes(item[cols.opportunity.stage])) || [];
  return {
    id: row[cols.product.key],
    code: row[cols.product.code],
    name: row[cols.product.name],
    shortName: row[cols.product.shortName],
    type: normalizeProductType(row[cols.product.type]),
    category: row[cols.product.category] || '',
    icon: normalizeIcon(row[cols.product.icon]) || (normalizeProductType(row[cols.product.type]) === 'hardware' ? 'fa-microchip' : 'fa-laptop-code'),
    price: finiteNumber(row[cols.product.price]),
    description: row[cols.product.description] || '',
    activeCustomers: new Set(assets.map(item => item[cols.asset.customerID])).size,
    installedUnits: assets.reduce((sum, item) => sum + finiteNumber(item[cols.asset.quantity]), 0),
    openPipeline: opportunities.reduce((sum, item) => sum + finiteNumber(item[cols.opportunity.value]), 0),
    supportRenewals: assets.filter(item => item[cols.asset.expiresAt] && new Date(item[cols.asset.expiresAt]).getTime() < Date.now() + 90 * 86400000).length,
    createdAt: row[cols.product.createdAt],
    updatedAt: row[cols.product.updatedAt],
  };
}

function opportunityDTO(row: Row, snapshot: Record<string, Row[]>): Row {
  const customer = snapshot.customers.find(item => Number(item[cols.customer.id]) === Number(row[cols.opportunity.customerID]));
  const product = snapshot.products.find(item => Number(item[cols.product.id]) === Number(row[cols.opportunity.productID]));
  const owner = snapshot.members.find(item => Number(item.usrID) === Number(row[cols.opportunity.ownerUserID]));
  return {
    id: row[cols.opportunity.key],
    customerId: customer?.[cols.customer.key] || '',
    productId: product?.[cols.product.key] || '',
    title: row[cols.opportunity.title],
    quantity: finiteNumber(row[cols.opportunity.quantity], 1),
    value: finiteNumber(row[cols.opportunity.value]),
    stage: row[cols.opportunity.stage],
    probability: finiteNumber(row[cols.opportunity.probability]),
    ownerId: owner ? String(owner.usrID) : '',
    expectedClose: row[cols.opportunity.expectedClose],
    lastActivity: row[cols.opportunity.lastActivity] || row[cols.opportunity.updatedAt],
    source: row[cols.opportunity.source] || '',
    risk: row[cols.opportunity.risk] || '',
    nextAction: row[cols.opportunity.nextAction] || '',
    customer: customer ? basicCustomerDTO(customer, snapshot) : null,
    product: product ? productDTO(product, snapshot) : null,
    owner: userDTO(owner),
  };
}

function basicCustomerDTO(row: Row, snapshot: Record<string, Row[]>): Row {
  const owner = snapshot.members.find(item => Number(item.usrID) === Number(row[cols.customer.ownerUserID]));
  return {
    id: row[cols.customer.key],
    name: row[cols.customer.name],
    short: row[cols.customer.short] || deriveShort(row[cols.customer.name]),
    industry: row[cols.customer.industry] || '',
    city: row[cols.customer.city] || '',
    tier: row[cols.customer.tier] || 'سازمانی',
    health: finiteNumber(row[cols.customer.health], 75),
    lifetimeValue: finiteNumber(row[cols.customer.lifetimeValue]),
    annualRevenue: finiteNumber(row[cols.customer.annualRevenue]),
    ownerId: owner ? String(owner.usrID) : '',
    lastInteraction: row[cols.customer.lastInteraction] || row[cols.customer.updatedAt],
    nextAction: row[cols.customer.nextAction] || '',
    nextActionDue: row[cols.customer.nextActionDue],
    renewalDate: row[cols.customer.renewalDate],
    tags: parseJSON<string[]>(row[cols.customer.tags], []),
    aiSummary: row[cols.customer.aiSummary] || '',
    owner: userDTO(owner),
  };
}

function contactDTO(row: Row): Row {
  return {
    id: row[cols.contact.key],
    name: row[cols.contact.name],
    title: row[cols.contact.title] || '',
    phone: row[cols.contact.phone] || '',
    email: row[cols.contact.email] || '',
    decisionRole: row[cols.contact.decisionRole] || '',
    isPrimary: Boolean(row[cols.contact.isPrimary]),
  };
}

function customerDTO(row: Row, snapshot: Record<string, Row[]>): Row {
  const id = row[cols.customer.id];
  const base = basicCustomerDTO(row, snapshot);
  const contacts = snapshot.contacts.filter(item => Number(item[cols.contact.customerID]) === Number(id)).map(contactDTO);
  const assets = snapshot.assets.filter(item => Number(item[cols.asset.customerID]) === Number(id)).map(item => {
    const product = snapshot.products.find(productRow => Number(productRow[cols.product.id]) === Number(item[cols.asset.productID]));
    return {
      id: item[cols.asset.key],
      productId: product?.[cols.product.key] || '',
      name: item[cols.asset.name] || product?.[cols.product.shortName] || 'محصول/خدمت',
      quantity: finiteNumber(item[cols.asset.quantity], 1),
      status: item[cols.asset.status] || 'فعال',
      contract: item[cols.asset.contract] || '',
      expiresAt: item[cols.asset.expiresAt],
      meta: parseJSON(item[cols.asset.meta], {}),
      product: product ? productDTO(product, snapshot) : null,
    };
  });
  const tickets = snapshot.tickets.filter(item => Number(item[cols.ticket.customerID]) === Number(id)).map(item => ({
    id: item[cols.ticket.key], title: item[cols.ticket.title], status: item[cols.ticket.status], priority: item[cols.ticket.priority],
    externalRef: item[cols.ticket.externalRef] || '', description: item[cols.ticket.description] || '',
    createdAt: item[cols.ticket.createdAt], updatedAt: item[cols.ticket.updatedAt],
  }));
  const opportunities = snapshot.opportunities.filter(item => Number(item[cols.opportunity.customerID]) === Number(id)).map(item => opportunityDTO(item, snapshot));
  const conversations = snapshot.conversations.filter(item => Number(item[cols.conversation.customerID]) === Number(id)).map(item => conversationDTO(item, snapshot, 0));
  const activities = snapshot.activities.filter(item => Number(item[cols.activity.customerID]) === Number(id)).map(item => ({
    id: item[cols.activity.key], type: item[cols.activity.type], title: item[cols.activity.title], detail: item[cols.activity.detail] || '',
    relatedType: item[cols.activity.relatedType] || '', relatedKey: item[cols.activity.relatedKey] || '', createdAt: item[cols.activity.createdAt],
  }));
  return { ...base, contacts, assets, tickets, opportunities, conversations, activities };
}

function defaultConversationAI(): Row {
  return { intent: '', sentiment: '', urgency: '', products: [], budget: '', decisionDate: '', commitments: [], nextAction: '' };
}

function conversationDTO(row: Row, snapshot: Record<string, Row[]>, userID: number): Row {
  const customer = snapshot.customers.find(item => Number(item[cols.customer.id]) === Number(row[cols.conversation.customerID]));
  const contact = snapshot.contacts.find(item => Number(item[cols.contact.id]) === Number(row[cols.conversation.contactID]));
  const assigned = snapshot.members.find(item => Number(item.usrID) === Number(row[cols.conversation.assignedUserID]));
  const read = snapshot.reads.find(item => Number(item[cols.conversationRead.conversationID]) === Number(row[cols.conversation.id]) && Number(item[cols.conversationRead.userID]) === Number(userID));
  const updatedAt = new Date(row[cols.conversation.updatedAt] || row[cols.conversation.createdAt]).getTime();
  const readAt = read ? new Date(read[cols.conversationRead.readAt]).getTime() : 0;
  const messages = snapshot.messages.filter(item => Number(item[cols.conversationMessage.conversationID]) === Number(row[cols.conversation.id]))
    .sort((a, b) => new Date(a[cols.conversationMessage.createdAt]).getTime() - new Date(b[cols.conversationMessage.createdAt]).getTime())
    .map(item => ({
      id: item[cols.conversationMessage.key],
      direction: String(item[cols.conversationMessage.direction] || 'Incoming').toLowerCase(),
      body: item[cols.conversationMessage.body],
      createdAt: item[cols.conversationMessage.createdAt],
      senderId: item[cols.conversationMessage.senderUserID] ? String(item[cols.conversationMessage.senderUserID]) : '',
      sender: userDTO(snapshot.members.find(member => Number(member.usrID) === Number(item[cols.conversationMessage.senderUserID]))),
    }));
  return {
    id: row[cols.conversation.key],
    customerId: customer?.[cols.customer.key] || '',
    contactId: contact?.[cols.contact.key] || '',
    channel: String(row[cols.conversation.channel] || 'email').toLowerCase(),
    unread: userID > 0 ? readAt < updatedAt : false,
    subject: row[cols.conversation.subject],
    createdAt: row[cols.conversation.createdAt],
    updatedAt: row[cols.conversation.updatedAt],
    preview: row[cols.conversation.preview] || text(row[cols.conversation.body], 220),
    body: row[cols.conversation.body],
    status: row[cols.conversation.status],
    ai: { ...defaultConversationAI(), ...parseJSON<Row>(row[cols.conversation.ai], {}) },
    customer: customer ? basicCustomerDTO(customer, snapshot) : null,
    contact: contact ? contactDTO(contact) : null,
    assigned: userDTO(assigned),
    messages,
  };
}

function taskDTO(row: Row, snapshot: Record<string, Row[]>): Row {
  const customer = snapshot.customers.find(item => Number(item[cols.customer.id]) === Number(row[cols.task.customerID]));
  const opportunity = snapshot.opportunities.find(item => Number(item[cols.opportunity.id]) === Number(row[cols.task.opportunityID]));
  const assigned = snapshot.members.find(item => Number(item.usrID) === Number(row[cols.task.assignedUserID]));
  return {
    id: row[cols.task.key], title: row[cols.task.title], customerId: customer?.[cols.customer.key] || '',
    opportunityId: opportunity?.[cols.opportunity.key] || '', dueAt: row[cols.task.dueAt], priority: row[cols.task.priority],
    done: Boolean(row[cols.task.doneAt]), doneAt: row[cols.task.doneAt], customer: customer ? basicCustomerDTO(customer, snapshot) : null,
    opportunity: opportunity ? opportunityDTO(opportunity, snapshot) : null, assigned: userDTO(assigned),
  };
}

/* -------------------------------------------------------------------------- */
/* Bootstrap, workspace and team                                              */
/* -------------------------------------------------------------------------- */

export async function crmBootstrap(auth: IntfAuth, workspaceKey?: string | null): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey);
  const snapshot = await loadSnapshot(access, auth.uid);
  const currentMember = snapshot.members.find(item => Number(item.usrID) === auth.uid);
  return {
    meta: { version: 2, generatedAt: nowISO(), company: access.workspace[cols.workspace.name], currency: access.workspace[cols.workspace.currency] || 'تومان' },
    workspace: {
      id: access.workspace[cols.workspace.key],
      name: access.workspace[cols.workspace.name],
      currency: access.workspace[cols.workspace.currency] || 'تومان',
      settings: parseJSON(access.workspace[cols.workspace.settings], {}),
    },
    currentUser: userDTO(currentMember),
    currentRole: access.role.toLowerCase(),
    permissions: {
      canWrite: WRITE_ROLES.includes(access.role),
      canManage: MANAGE_ROLES.includes(access.role),
      canManageTeam: access.role === 'Owner',
    },
    users: snapshot.members.map(userDTO),
    products: snapshot.products.map(item => productDTO(item, snapshot)),
  };
}

export async function updateCRMWorkspace(auth: IntfAuth, workspaceKey: string | null, input: Row): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey);
  requireRole(access, ['Owner']);
  const db = await getDB();
  const changes: Row = { [cols.workspace.updatedAt]: db.fn.now() };
  if (Object.prototype.hasOwnProperty.call(input, 'name')) {
    const name = text(input.name, 120);
    if (!name) throw new exHttpInvalidParams('نام CRM الزامی است');
    changes[cols.workspace.name] = name;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'currency')) changes[cols.workspace.currency] = text(input.currency, 16) || 'تومان';
  if (Object.prototype.hasOwnProperty.call(input, 'settings')) changes[cols.workspace.settings] = json(input.settings);
  await db(tables.workspaces).where(cols.workspace.id, access.workspace[cols.workspace.id]).update(changes);
  return crmBootstrap(auth, access.workspace[cols.workspace.key]);
}

export async function listCRMMembers(auth: IntfAuth, workspaceKey?: string | null): Promise<Row[]> {
  const access = await getCRMAccess(auth, workspaceKey);
  const snapshot = await loadSnapshot(access, auth.uid);
  return snapshot.members.map(userDTO).filter(Boolean) as Row[];
}

export async function addCRMMember(auth: IntfAuth, workspaceKey: string | null, input: Row): Promise<Row[]> {
  const access = await getCRMAccess(auth, workspaceKey);
  requireRole(access, ['Owner']);
  const username = text(input.username, 32).toLowerCase();
  if (!username) throw new exHttpInvalidParams('نام کاربری الزامی است');
  if (username.startsWith('widget-')) throw new exHttpInvalidParams('حساب سیستمی ویجت قابل افزودن نیست');
  const user = await atDB.user.findByUsername(username, true);
  if (!user?.usrID) throw new exHttpInvalidParams('کاربری با این نام کاربری پیدا نشد');
  if (Number(user.usrID) === Number(access.workspace[cols.workspace.ownerUserID])) throw new exHttpConflict('مالک از قبل عضو CRM است');
  const role = roleOf(input.role);
  if (role === 'Owner') throw new exHttpInvalidParams('نقش مالک قابل واگذاری نیست');
  const db = await getDB();
  const existing = await db(tables.members).where({
    [cols.member.workspaceID]: access.workspace[cols.workspace.id],
    [cols.member.userID]: user.usrID,
  }).first();
  if (existing) {
    await db(tables.members).where(cols.member.id, existing[cols.member.id]).update({
      [cols.member.role]: role,
      [cols.member.status]: ACTIVE,
      [cols.member.updatedAt]: db.fn.now(),
    });
  } else {
    await db(tables.members).insert({
      [cols.member.workspaceID]: access.workspace[cols.workspace.id],
      [cols.member.userID]: user.usrID,
      [cols.member.role]: role,
      [cols.member.status]: ACTIVE,
    });
  }
  return listCRMMembers(auth, access.workspace[cols.workspace.key]);
}

export async function updateCRMMember(auth: IntfAuth, workspaceKey: string | null, memberUserID: number, input: Row): Promise<Row[]> {
  const access = await getCRMAccess(auth, workspaceKey);
  requireRole(access, ['Owner']);
  if (memberUserID === Number(access.workspace[cols.workspace.ownerUserID])) throw new exHttpInvalidParams('نقش مالک قابل تغییر نیست');
  const role = roleOf(input.role);
  if (role === 'Owner') throw new exHttpInvalidParams('نقش مالک قابل واگذاری نیست');
  const db = await getDB();
  const updated = await db(tables.members).where({
    [cols.member.workspaceID]: access.workspace[cols.workspace.id],
    [cols.member.userID]: memberUserID,
  }).update({ [cols.member.role]: role, [cols.member.status]: input.active === false ? REMOVED : ACTIVE, [cols.member.updatedAt]: db.fn.now() });
  if (!updated) throw new exHttpInvalidParams('عضو CRM پیدا نشد');
  return listCRMMembers(auth, access.workspace[cols.workspace.key]);
}

export async function removeCRMMember(auth: IntfAuth, workspaceKey: string | null, memberUserID: number): Promise<Row[]> {
  return updateCRMMember(auth, workspaceKey, memberUserID, { role: 'Sales', active: false });
}

/* -------------------------------------------------------------------------- */
/* Product CRUD                                                               */
/* -------------------------------------------------------------------------- */

export async function listCRMProducts(auth: IntfAuth, workspaceKey?: string | null, filterType?: string | null): Promise<Row[]> {
  const access = await getCRMAccess(auth, workspaceKey);
  const snapshot = await loadSnapshot(access, auth.uid);
  let rows = snapshot.products.map(item => productDTO(item, snapshot));
  if (filterType && filterType !== 'all') rows = rows.filter(item => item.type === normalizeProductType(filterType));
  return rows;
}

export async function createCRMProduct(auth: IntfAuth, workspaceKey: string | null, input: Row): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey);
  requireRole(access, MANAGE_ROLES);
  const name = text(input.name, 180);
  const code = text(input.code, 64).toUpperCase();
  if (!name || !code) throw new exHttpInvalidParams('نام و کد محصول الزامی است');
  const db = await getDB();
  const duplicate = await db(tables.products).where({
    [cols.product.workspaceID]: access.workspace[cols.workspace.id],
    [cols.product.code]: code,
  }).whereNot(cols.product.status, 'Archived').first();
  if (duplicate) throw new exHttpConflict('محصول دیگری با این کد ثبت شده است');
  const result = await db(tables.products).insert({
    [cols.product.key]: key32(), [cols.product.workspaceID]: access.workspace[cols.workspace.id], [cols.product.code]: code,
    [cols.product.name]: name, [cols.product.shortName]: text(input.shortName, 100) || name, [cols.product.type]: dbProductType(input.type),
    [cols.product.category]: optionalText(input.category, 150), [cols.product.icon]: normalizeIcon(input.icon),
    [cols.product.price]: Math.max(0, finiteNumber(input.price)), [cols.product.description]: optionalText(input.description, 10000), [cols.product.status]: ACTIVE,
  }).returning(cols.product.id);
  const id = firstID(result, cols.product.id);
  const row = await db(tables.products).where(cols.product.id, id).first();
  return productDTO(row, { assets: [], opportunities: [] } as unknown as Record<string, Row[]>);
}

export async function updateCRMProduct(auth: IntfAuth, workspaceKey: string | null, key: string, input: Row): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey);
  requireRole(access, MANAGE_ROLES);
  const row = await getProductRow(access, key);
  const db = await getDB();
  const changes: Row = { [cols.product.updatedAt]: db.fn.now() };

  if (Object.prototype.hasOwnProperty.call(input, 'code')) {
    const code = text(input.code, 64).toUpperCase();
    if (!code) throw new exHttpInvalidParams('کد محصول الزامی است');
    const duplicate = await db(tables.products)
      .where({ [cols.product.workspaceID]: access.workspace[cols.workspace.id], [cols.product.code]: code })
      .whereNot(cols.product.id, row[cols.product.id])
      .whereNot(cols.product.status, 'Archived')
      .first();
    if (duplicate) throw new exHttpConflict('محصول دیگری با این کد ثبت شده است');
    changes[cols.product.code] = code;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'name')) {
    const name = text(input.name, 180);
    if (!name) throw new exHttpInvalidParams('نام محصول الزامی است');
    changes[cols.product.name] = name;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'shortName')) {
    changes[cols.product.shortName] = text(input.shortName, 100)
      || changes[cols.product.name]
      || row[cols.product.name];
  }
  if (Object.prototype.hasOwnProperty.call(input, 'category')) changes[cols.product.category] = optionalText(input.category, 150);
  if (Object.prototype.hasOwnProperty.call(input, 'icon')) changes[cols.product.icon] = normalizeIcon(input.icon);
  if (Object.prototype.hasOwnProperty.call(input, 'description')) changes[cols.product.description] = optionalText(input.description, 10000);
  if (Object.prototype.hasOwnProperty.call(input, 'type')) changes[cols.product.type] = dbProductType(input.type);
  if (Object.prototype.hasOwnProperty.call(input, 'price')) changes[cols.product.price] = Math.max(0, finiteNumber(input.price));

  await db(tables.products).where(cols.product.id, row[cols.product.id]).update(changes);
  return (await listCRMProducts(auth, access.workspace[cols.workspace.key])).find(item => item.id === key)!;
}

export async function archiveCRMProduct(auth: IntfAuth, workspaceKey: string | null, key: string): Promise<{ ok: true }> {
  const access = await getCRMAccess(auth, workspaceKey);
  requireRole(access, MANAGE_ROLES);
  const row = await getProductRow(access, key);
  const db = await getDB();
  await db(tables.products).where(cols.product.id, row[cols.product.id]).update({ [cols.product.status]: 'Archived', [cols.product.updatedAt]: db.fn.now() });
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Customer CRUD and child records                                            */
/* -------------------------------------------------------------------------- */

export async function listCRMCustomers(auth: IntfAuth, workspaceKey: string | null, filters: Row = {}): Promise<Row[]> {
  const access = await getCRMAccess(auth, workspaceKey);
  const snapshot = await loadSnapshot(access, auth.uid);
  let rows = snapshot.customers.map(item => customerDTO(item, snapshot));
  const query = text(filters.query, 200).toLowerCase();
  if (query) rows = rows.filter(item => [item.name, item.industry, item.city, ...(item.tags || [])].join(' ').toLowerCase().includes(query));
  if (filters.health === 'risk') rows = rows.filter(item => item.health < 65);
  if (filters.health === 'healthy') rows = rows.filter(item => item.health >= 80);
  if (filters.tier) rows = rows.filter(item => item.tier === filters.tier);
  return rows.sort((a, b) => finiteNumber(b.lifetimeValue) - finiteNumber(a.lifetimeValue));
}

export async function getCRMCustomer(auth: IntfAuth, workspaceKey: string | null, key: string): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey);
  const snapshot = await loadSnapshot(access, auth.uid);
  const row = snapshot.customers.find(item => item[cols.customer.key] === key);
  if (!row) throw new exHttpInvalidParams('مشتری پیدا نشد');
  return customerDTO(row, snapshot);
}

function customerChanges(input: Row, db: Knex): Row {
  const changes: Row = { [cols.customer.updatedAt]: db.fn.now() };
  const stringMap: Record<string, [string, number]> = {
    name: [cols.customer.name, 180], short: [cols.customer.short, 16], industry: [cols.customer.industry, 120], city: [cols.customer.city, 80],
    tier: [cols.customer.tier, 40], nextAction: [cols.customer.nextAction, 5000], aiSummary: [cols.customer.aiSummary, 10000],
  };
  Object.entries(stringMap).forEach(([source, [target, max]]) => {
    if (Object.prototype.hasOwnProperty.call(input, source)) changes[target] = optionalText(input[source], max);
  });
  if (Object.prototype.hasOwnProperty.call(input, 'health')) changes[cols.customer.health] = clamp(input.health, 0, 100, 75);
  if (Object.prototype.hasOwnProperty.call(input, 'lifetimeValue')) changes[cols.customer.lifetimeValue] = Math.max(0, finiteNumber(input.lifetimeValue));
  if (Object.prototype.hasOwnProperty.call(input, 'annualRevenue')) changes[cols.customer.annualRevenue] = Math.max(0, finiteNumber(input.annualRevenue));
  if (Object.prototype.hasOwnProperty.call(input, 'nextActionDue')) changes[cols.customer.nextActionDue] = dateOrNull(input.nextActionDue);
  if (Object.prototype.hasOwnProperty.call(input, 'renewalDate')) changes[cols.customer.renewalDate] = dateOrNull(input.renewalDate);
  if (Object.prototype.hasOwnProperty.call(input, 'tags')) changes[cols.customer.tags] = json(normalizeTags(input.tags));
  return changes;
}

export async function createCRMCustomer(auth: IntfAuth, workspaceKey: string | null, input: Row): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey);
  requireWrite(access);
  const name = text(input.name, 180);
  if (!name) throw new exHttpInvalidParams('نام مشتری الزامی است');
  const db = await getDB();
  const ownerUserID = input.ownerId
    ? await resolveWorkspaceMemberUserID(access, input.ownerId)
    : auth.uid;
  const result = await db(tables.customers).insert({
    [cols.customer.key]: key32(), [cols.customer.workspaceID]: access.workspace[cols.workspace.id], [cols.customer.ownerUserID]: ownerUserID,
    [cols.customer.name]: name, [cols.customer.short]: text(input.short, 16) || deriveShort(name), [cols.customer.industry]: optionalText(input.industry, 120),
    [cols.customer.city]: optionalText(input.city, 80), [cols.customer.tier]: text(input.tier, 40) || 'سازمانی', [cols.customer.health]: clamp(input.health, 0, 100, 75),
    [cols.customer.lifetimeValue]: Math.max(0, finiteNumber(input.lifetimeValue)), [cols.customer.annualRevenue]: Math.max(0, finiteNumber(input.annualRevenue)),
    [cols.customer.nextAction]: optionalText(input.nextAction, 5000), [cols.customer.nextActionDue]: dateOrNull(input.nextActionDue), [cols.customer.renewalDate]: dateOrNull(input.renewalDate),
    [cols.customer.tags]: json(normalizeTags(input.tags)), [cols.customer.aiSummary]: optionalText(input.aiSummary, 10000), [cols.customer.status]: ACTIVE,
  }).returning(cols.customer.id);
  const id = firstID(result, cols.customer.id);
  const row = await db(tables.customers).where(cols.customer.id, id).first();
  await addActivity(db, access.workspace[cols.workspace.id], id, auth.uid, 'customer', 'ایجاد پرونده مشتری', `پرونده ${name} ایجاد شد.`, 'customer', row[cols.customer.key]);
  return getCRMCustomer(auth, access.workspace[cols.workspace.key], row[cols.customer.key]);
}

export async function updateCRMCustomer(auth: IntfAuth, workspaceKey: string | null, key: string, input: Row): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey);
  requireWrite(access);
  const row = await getCustomerRow(access, key);
  const db = await getDB();
  const changes = customerChanges(input, db);
  if (Object.prototype.hasOwnProperty.call(input, 'ownerId')) {
    changes[cols.customer.ownerUserID] = await resolveWorkspaceMemberUserID(access, input.ownerId, { nullable: true });
  }
  if (Object.prototype.hasOwnProperty.call(input, 'name') && !text(input.name, 180)) throw new exHttpInvalidParams('نام مشتری الزامی است');
  await db(tables.customers).where(cols.customer.id, row[cols.customer.id]).update(changes);
  await addActivity(db, access.workspace[cols.workspace.id], row[cols.customer.id], auth.uid, 'customer', 'ویرایش پرونده مشتری', 'مشخصات پرونده به‌روزرسانی شد.', 'customer', key);
  return getCRMCustomer(auth, access.workspace[cols.workspace.key], key);
}

export async function archiveCRMCustomer(auth: IntfAuth, workspaceKey: string | null, key: string): Promise<{ ok: true }> {
  const access = await getCRMAccess(auth, workspaceKey);
  requireRole(access, MANAGE_ROLES);
  const row = await getCustomerRow(access, key);
  const db = await getDB();
  await db(tables.customers).where(cols.customer.id, row[cols.customer.id]).update({ [cols.customer.status]: 'Archived', [cols.customer.updatedAt]: db.fn.now() });
  return { ok: true };
}

export async function addCRMContact(auth: IntfAuth, workspaceKey: string | null, customerKey: string, input: Row): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey); requireWrite(access);
  const customer = await getCustomerRow(access, customerKey);
  const name = text(input.name, 150); if (!name) throw new exHttpInvalidParams('نام فرد الزامی است');
  const db = await getDB();
  if (Boolean(input.isPrimary)) {
    await db(tables.contacts).where({ [cols.contact.customerID]: customer[cols.customer.id], [cols.contact.status]: ACTIVE }).update({ [cols.contact.isPrimary]: false, [cols.contact.updatedAt]: db.fn.now() });
  }
  const result = await db(tables.contacts).insert({
    [cols.contact.key]: key32(), [cols.contact.customerID]: customer[cols.customer.id], [cols.contact.name]: name,
    [cols.contact.title]: optionalText(input.title, 120), [cols.contact.phone]: optionalText(input.phone, 40), [cols.contact.email]: optionalText(input.email, 180),
    [cols.contact.decisionRole]: optionalText(input.decisionRole, 80), [cols.contact.isPrimary]: Boolean(input.isPrimary), [cols.contact.status]: ACTIVE,
  }).returning(cols.contact.id);
  const id = firstID(result, cols.contact.id);
  const row = await db(tables.contacts).where(cols.contact.id, id).first();
  await addActivity(db, access.workspace[cols.workspace.id], customer[cols.customer.id], auth.uid, 'contact', 'افزودن فرد کلیدی', name, 'contact', row[cols.contact.key]);
  return contactDTO(row);
}

export async function updateCRMContact(auth: IntfAuth, workspaceKey: string | null, customerKey: string, contactKey: string, input: Row): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey); requireWrite(access);
  const customer = await getCustomerRow(access, customerKey);
  const db = await getDB();
  const row = await db(tables.contacts).where({ [cols.contact.key]: contactKey, [cols.contact.customerID]: customer[cols.customer.id] }).first();
  if (!row) throw new exHttpInvalidParams('فرد موردنظر پیدا نشد');
  const changes: Row = { [cols.contact.updatedAt]: db.fn.now() };
  const map: Record<string, string> = { name: cols.contact.name, title: cols.contact.title, phone: cols.contact.phone, email: cols.contact.email, decisionRole: cols.contact.decisionRole };
  Object.entries(map).forEach(([source, target]) => { if (Object.prototype.hasOwnProperty.call(input, source)) changes[target] = optionalText(input[source], 180); });
  if (Object.prototype.hasOwnProperty.call(input, 'name') && !text(input.name, 150)) throw new exHttpInvalidParams('نام فرد الزامی است');
  if (Object.prototype.hasOwnProperty.call(input, 'isPrimary')) {
    changes[cols.contact.isPrimary] = Boolean(input.isPrimary);
    if (Boolean(input.isPrimary)) {
      await db(tables.contacts).where({ [cols.contact.customerID]: customer[cols.customer.id], [cols.contact.status]: ACTIVE }).whereNot(cols.contact.id, row[cols.contact.id]).update({ [cols.contact.isPrimary]: false, [cols.contact.updatedAt]: db.fn.now() });
    }
  }
  await db(tables.contacts).where(cols.contact.id, row[cols.contact.id]).update(changes);
  return contactDTO({ ...row, ...changes });
}

export async function removeCRMContact(auth: IntfAuth, workspaceKey: string | null, customerKey: string, contactKey: string): Promise<{ ok: true }> {
  const access = await getCRMAccess(auth, workspaceKey); requireWrite(access);
  const customer = await getCustomerRow(access, customerKey);
  const db = await getDB();
  await db(tables.contacts).where({ [cols.contact.key]: contactKey, [cols.contact.customerID]: customer[cols.customer.id] }).update({ [cols.contact.status]: REMOVED, [cols.contact.updatedAt]: db.fn.now() });
  return { ok: true };
}

export async function addCRMAsset(auth: IntfAuth, workspaceKey: string | null, customerKey: string, input: Row): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey); requireWrite(access);
  const customer = await getCustomerRow(access, customerKey);
  const product = input.productId ? await getProductRow(access, text(input.productId, 32)) : null;
  const customName = text(input.name, 180);
  if (!product && !customName) throw new exHttpInvalidParams('انتخاب محصول یا درج نام خدمت الزامی است');
  const db = await getDB();
  const result = await db(tables.assets).insert({
    [cols.asset.key]: key32(), [cols.asset.customerID]: customer[cols.customer.id], [cols.asset.productID]: product?.[cols.product.id] || null,
    [cols.asset.name]: customName || null, [cols.asset.quantity]: Math.max(0, finiteNumber(input.quantity, 1)), [cols.asset.status]: text(input.status, 40) || 'فعال',
    [cols.asset.contract]: optionalText(input.contract, 180), [cols.asset.expiresAt]: dateOrNull(input.expiresAt), [cols.asset.meta]: json(input.meta || {}),
  }).returning(cols.asset.id);
  const id = firstID(result, cols.asset.id);
  const key = (await db(tables.assets).where(cols.asset.id, id).first())[cols.asset.key];
  await addActivity(db, access.workspace[cols.workspace.id], customer[cols.customer.id], auth.uid, 'asset', 'ثبت محصول یا خدمت فعال', product?.[cols.product.shortName] || text(input.name, 180), 'asset', key);
  return getCRMCustomer(auth, access.workspace[cols.workspace.key], customerKey);
}

export async function removeCRMAsset(auth: IntfAuth, workspaceKey: string | null, customerKey: string, assetKey: string): Promise<{ ok: true }> {
  const access = await getCRMAccess(auth, workspaceKey); requireWrite(access);
  const customer = await getCustomerRow(access, customerKey);
  const db = await getDB();
  await db(tables.assets).where({ [cols.asset.key]: assetKey, [cols.asset.customerID]: customer[cols.customer.id] }).del();
  return { ok: true };
}

export async function addCRMTicket(auth: IntfAuth, workspaceKey: string | null, customerKey: string, input: Row): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey); requireWrite(access);
  const customer = await getCustomerRow(access, customerKey);
  const titleValue = text(input.title, 220); if (!titleValue) throw new exHttpInvalidParams('عنوان تیکت الزامی است');
  const db = await getDB();
  const result = await db(tables.tickets).insert({
    [cols.ticket.key]: key32(), [cols.ticket.customerID]: customer[cols.customer.id], [cols.ticket.title]: titleValue,
    [cols.ticket.status]: text(input.status, 40) || 'باز', [cols.ticket.priority]: text(input.priority, 24) || 'متوسط',
    [cols.ticket.externalRef]: optionalText(input.externalRef, 100), [cols.ticket.description]: optionalText(input.description, 10000),
  }).returning(cols.ticket.id);
  const id = firstID(result, cols.ticket.id); const row = await db(tables.tickets).where(cols.ticket.id, id).first();
  await addActivity(db, access.workspace[cols.workspace.id], customer[cols.customer.id], auth.uid, 'ticket', titleValue, row[cols.ticket.description], 'ticket', row[cols.ticket.key]);
  return { id: row[cols.ticket.key], title: row[cols.ticket.title], status: row[cols.ticket.status], priority: row[cols.ticket.priority], createdAt: row[cols.ticket.createdAt] };
}

export async function updateCRMTicket(auth: IntfAuth, workspaceKey: string | null, customerKey: string, ticketKey: string, input: Row): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey); requireWrite(access);
  const customer = await getCustomerRow(access, customerKey);
  const db = await getDB();
  const row = await db(tables.tickets)
    .where({ [cols.ticket.key]: ticketKey, [cols.ticket.customerID]: customer[cols.customer.id] })
    .first();
  if (!row) throw new exHttpInvalidParams('تیکت پیدا نشد');

  const changes: Row = { [cols.ticket.updatedAt]: db.fn.now() };
  if (Object.prototype.hasOwnProperty.call(input, 'title')) {
    const titleValue = text(input.title, 220);
    if (!titleValue) throw new exHttpInvalidParams('عنوان تیکت الزامی است');
    changes[cols.ticket.title] = titleValue;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'status')) {
    changes[cols.ticket.status] = text(input.status, 40) || row[cols.ticket.status];
  }
  if (Object.prototype.hasOwnProperty.call(input, 'priority')) {
    changes[cols.ticket.priority] = text(input.priority, 24) || row[cols.ticket.priority];
  }
  if (Object.prototype.hasOwnProperty.call(input, 'externalRef')) {
    changes[cols.ticket.externalRef] = optionalText(input.externalRef, 100);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'description')) {
    changes[cols.ticket.description] = optionalText(input.description, 10000);
  }

  await db(tables.tickets).where(cols.ticket.id, row[cols.ticket.id]).update(changes);
  const updated = await db(tables.tickets).where(cols.ticket.id, row[cols.ticket.id]).first();
  return {
    id: updated[cols.ticket.key],
    title: updated[cols.ticket.title],
    status: updated[cols.ticket.status],
    priority: updated[cols.ticket.priority],
    externalRef: updated[cols.ticket.externalRef] || '',
    description: updated[cols.ticket.description] || '',
    createdAt: updated[cols.ticket.createdAt],
    updatedAt: updated[cols.ticket.updatedAt],
  };
}

/* -------------------------------------------------------------------------- */
/* Opportunities and tasks                                                    */
/* -------------------------------------------------------------------------- */

export async function listCRMOpportunities(auth: IntfAuth, workspaceKey: string | null, filters: Row = {}): Promise<Row[]> {
  const access = await getCRMAccess(auth, workspaceKey); const snapshot = await loadSnapshot(access, auth.uid);
  let rows = snapshot.opportunities.map(item => opportunityDTO(item, snapshot));
  if (filters.stage) rows = rows.filter(item => item.stage === filters.stage);
  if (filters.type) rows = rows.filter(item => item.product?.type === normalizeProductType(filters.type));
  return rows;
}

export async function createCRMOpportunity(auth: IntfAuth, workspaceKey: string | null, input: Row): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey); requireWrite(access);
  const customer = await getCustomerRow(access, text(input.customerId, 32));
  const product = input.productId ? await getProductRow(access, text(input.productId, 32)) : null;
  const titleValue = text(input.title, 220); if (!titleValue) throw new exHttpInvalidParams('عنوان فرصت الزامی است');
  const stage = ALL_STAGES.includes(text(input.stage, 24)) ? text(input.stage, 24) : 'lead';
  const ownerUserID = input.ownerId
    ? await resolveWorkspaceMemberUserID(access, input.ownerId)
    : auth.uid;
  const db = await getDB();
  const result = await db(tables.opportunities).insert({
    [cols.opportunity.key]: key32(), [cols.opportunity.workspaceID]: access.workspace[cols.workspace.id], [cols.opportunity.customerID]: customer[cols.customer.id],
    [cols.opportunity.productID]: product?.[cols.product.id] || null, [cols.opportunity.ownerUserID]: ownerUserID,
    [cols.opportunity.title]: titleValue, [cols.opportunity.quantity]: Math.max(0, finiteNumber(input.quantity, 1)), [cols.opportunity.value]: Math.max(0, finiteNumber(input.value)),
    [cols.opportunity.stage]: stage, [cols.opportunity.probability]: clamp(input.probability, 0, 100, STAGE_PROBABILITY[stage] ?? 25),
    [cols.opportunity.expectedClose]: dateOrNull(input.expectedClose), [cols.opportunity.lastActivity]: db.fn.now(), [cols.opportunity.source]: optionalText(input.source, 100),
    [cols.opportunity.risk]: optionalText(input.risk, 10000), [cols.opportunity.nextAction]: optionalText(input.nextAction, 5000), [cols.opportunity.status]: ACTIVE,
  }).returning(cols.opportunity.id);
  const id = firstID(result, cols.opportunity.id); const row = await db(tables.opportunities).where(cols.opportunity.id, id).first();
  await addActivity(db, access.workspace[cols.workspace.id], customer[cols.customer.id], auth.uid, 'opportunity', 'ایجاد فرصت فروش', titleValue, 'opportunity', row[cols.opportunity.key]);
  return (await listCRMOpportunities(auth, access.workspace[cols.workspace.key])).find(item => item.id === row[cols.opportunity.key])!;
}

export async function updateCRMOpportunity(auth: IntfAuth, workspaceKey: string | null, key: string, input: Row): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey); requireWrite(access);
  const row = await getOpportunityRow(access, key); const db = await getDB(); const changes: Row = { [cols.opportunity.updatedAt]: db.fn.now(), [cols.opportunity.lastActivity]: db.fn.now() };
  if (Object.prototype.hasOwnProperty.call(input, 'title')) {
    const titleValue = text(input.title, 220);
    if (!titleValue) throw new exHttpInvalidParams('عنوان فرصت الزامی است');
    changes[cols.opportunity.title] = titleValue;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'source')) changes[cols.opportunity.source] = optionalText(input.source, 100);
  if (Object.prototype.hasOwnProperty.call(input, 'risk')) changes[cols.opportunity.risk] = optionalText(input.risk, 10000);
  if (Object.prototype.hasOwnProperty.call(input, 'nextAction')) changes[cols.opportunity.nextAction] = optionalText(input.nextAction, 5000);
  if (Object.prototype.hasOwnProperty.call(input, 'quantity')) changes[cols.opportunity.quantity] = Math.max(0, finiteNumber(input.quantity, 1));
  if (Object.prototype.hasOwnProperty.call(input, 'value')) changes[cols.opportunity.value] = Math.max(0, finiteNumber(input.value));
  if (Object.prototype.hasOwnProperty.call(input, 'probability')) changes[cols.opportunity.probability] = clamp(input.probability, 0, 100, 25);
  if (Object.prototype.hasOwnProperty.call(input, 'expectedClose')) changes[cols.opportunity.expectedClose] = dateOrNull(input.expectedClose);
  if (Object.prototype.hasOwnProperty.call(input, 'ownerId')) changes[cols.opportunity.ownerUserID] = await resolveWorkspaceMemberUserID(access, input.ownerId, { nullable: true });
  if (Object.prototype.hasOwnProperty.call(input, 'productId')) changes[cols.opportunity.productID] = input.productId ? (await getProductRow(access, text(input.productId, 32)))[cols.product.id] : null;
  if (Object.prototype.hasOwnProperty.call(input, 'stage')) {
    const stage = text(input.stage, 24); if (!ALL_STAGES.includes(stage)) throw new exHttpInvalidParams('مرحله فرصت معتبر نیست');
    changes[cols.opportunity.stage] = stage;
    if (!Object.prototype.hasOwnProperty.call(input, 'probability')) changes[cols.opportunity.probability] = STAGE_PROBABILITY[stage];
  }
  await db(tables.opportunities).where(cols.opportunity.id, row[cols.opportunity.id]).update(changes);
  await addActivity(db, access.workspace[cols.workspace.id], row[cols.opportunity.customerID], auth.uid, 'opportunity', 'به‌روزرسانی فرصت فروش', changes[cols.opportunity.stage] ? `مرحله به ${changes[cols.opportunity.stage]} تغییر کرد.` : 'اطلاعات فرصت به‌روزرسانی شد.', 'opportunity', key);
  return (await listCRMOpportunities(auth, access.workspace[cols.workspace.key])).find(item => item.id === key)!;
}

export async function archiveCRMOpportunity(auth: IntfAuth, workspaceKey: string | null, key: string): Promise<{ ok: true }> {
  const access = await getCRMAccess(auth, workspaceKey); requireWrite(access); const row = await getOpportunityRow(access, key); const db = await getDB();
  await db(tables.opportunities).where(cols.opportunity.id, row[cols.opportunity.id]).update({ [cols.opportunity.status]: 'Archived', [cols.opportunity.updatedAt]: db.fn.now() });
  return { ok: true };
}

export async function createCRMTask(auth: IntfAuth, workspaceKey: string | null, input: Row): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey); requireWrite(access);
  const titleValue = text(input.title, 220); if (!titleValue) throw new exHttpInvalidParams('عنوان وظیفه الزامی است');
  const customer = input.customerId ? await getCustomerRow(access, text(input.customerId, 32)) : null;
  const opportunity = input.opportunityId ? await getOpportunityRow(access, text(input.opportunityId, 32)) : null;
  const assignedUserID = input.assignedId
    ? await resolveWorkspaceMemberUserID(access, input.assignedId)
    : auth.uid;
  const db = await getDB();
  const result = await db(tables.tasks).insert({
    [cols.task.key]: key32(), [cols.task.workspaceID]: access.workspace[cols.workspace.id], [cols.task.customerID]: customer?.[cols.customer.id] || null,
    [cols.task.opportunityID]: opportunity?.[cols.opportunity.id] || null, [cols.task.assignedUserID]: assignedUserID,
    [cols.task.createdByUserID]: auth.uid, [cols.task.title]: titleValue, [cols.task.dueAt]: dateOrNull(input.dueAt),
    [cols.task.priority]: text(input.priority, 20) || 'medium', [cols.task.status]: ACTIVE,
  }).returning(cols.task.id);
  const id = firstID(result, cols.task.id); const row = await db(tables.tasks).where(cols.task.id, id).first();
  if (customer) await addActivity(db, access.workspace[cols.workspace.id], customer[cols.customer.id], auth.uid, 'task', 'ایجاد پیگیری', titleValue, 'task', row[cols.task.key]);
  const snapshot = await loadSnapshot(access, auth.uid); return taskDTO(row, snapshot);
}

export async function toggleCRMTask(auth: IntfAuth, workspaceKey: string | null, key: string): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey); requireWrite(access); const db = await getDB();
  const row = await db(tables.tasks).where({ [cols.task.key]: key, [cols.task.workspaceID]: access.workspace[cols.workspace.id], [cols.task.status]: ACTIVE }).first();
  if (!row) throw new exHttpInvalidParams('وظیفه پیدا نشد');
  await db(tables.tasks).where(cols.task.id, row[cols.task.id]).update({ [cols.task.doneAt]: row[cols.task.doneAt] ? null : db.fn.now(), [cols.task.updatedAt]: db.fn.now() });
  const snapshot = await loadSnapshot(access, auth.uid); const updated = await db(tables.tasks).where(cols.task.id, row[cols.task.id]).first(); return taskDTO(updated, snapshot);
}

export async function listCRMTasks(auth: IntfAuth, workspaceKey?: string | null, includeDone = false): Promise<Row[]> {
  const access = await getCRMAccess(auth, workspaceKey);
  const snapshot = await loadSnapshot(access, auth.uid);
  let rows = snapshot.tasks;
  if (!MANAGE_ROLES.includes(access.role)) {
    rows = rows.filter(item => !item[cols.task.assignedUserID] || Number(item[cols.task.assignedUserID]) === auth.uid);
  }
  if (!includeDone) rows = rows.filter(item => !item[cols.task.doneAt]);
  return rows.slice().sort((a, b) => new Date(a[cols.task.dueAt] || '2999-01-01').getTime() - new Date(b[cols.task.dueAt] || '2999-01-01').getTime()).map(item => taskDTO(item, snapshot));
}

export async function updateCRMTask(auth: IntfAuth, workspaceKey: string | null, key: string, input: Row): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey); requireWrite(access); const db = await getDB();
  const row = await db(tables.tasks).where({ [cols.task.key]: key, [cols.task.workspaceID]: access.workspace[cols.workspace.id], [cols.task.status]: ACTIVE }).first();
  if (!row) throw new exHttpInvalidParams('وظیفه پیدا نشد');
  if (!MANAGE_ROLES.includes(access.role) && Number(row[cols.task.assignedUserID]) !== auth.uid && Number(row[cols.task.createdByUserID]) !== auth.uid) {
    throw new exHttpAccessDenied('فقط مسئول یا ایجادکننده وظیفه می‌تواند آن را ویرایش کند');
  }
  const changes: Row = { [cols.task.updatedAt]: db.fn.now() };
  if (Object.prototype.hasOwnProperty.call(input, 'title')) {
    const titleValue = text(input.title, 220); if (!titleValue) throw new exHttpInvalidParams('عنوان وظیفه الزامی است');
    changes[cols.task.title] = titleValue;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'dueAt')) changes[cols.task.dueAt] = dateOrNull(input.dueAt);
  if (Object.prototype.hasOwnProperty.call(input, 'priority')) changes[cols.task.priority] = text(input.priority, 20) || 'medium';
  if (Object.prototype.hasOwnProperty.call(input, 'assignedId')) changes[cols.task.assignedUserID] = await resolveWorkspaceMemberUserID(access, input.assignedId, { nullable: true });
  if (Object.prototype.hasOwnProperty.call(input, 'customerId')) changes[cols.task.customerID] = input.customerId ? (await getCustomerRow(access, text(input.customerId, 32)))[cols.customer.id] : null;
  if (Object.prototype.hasOwnProperty.call(input, 'opportunityId')) changes[cols.task.opportunityID] = input.opportunityId ? (await getOpportunityRow(access, text(input.opportunityId, 32)))[cols.opportunity.id] : null;
  if (Object.prototype.hasOwnProperty.call(input, 'done')) changes[cols.task.doneAt] = input.done ? db.fn.now() : null;
  await db(tables.tasks).where(cols.task.id, row[cols.task.id]).update(changes);
  const snapshot = await loadSnapshot(access, auth.uid);
  const updated = await db(tables.tasks).where(cols.task.id, row[cols.task.id]).first();
  return taskDTO(updated, snapshot);
}

export async function archiveCRMTask(auth: IntfAuth, workspaceKey: string | null, key: string): Promise<{ ok: true }> {
  const access = await getCRMAccess(auth, workspaceKey); requireWrite(access); const db = await getDB();
  const row = await db(tables.tasks).where({ [cols.task.key]: key, [cols.task.workspaceID]: access.workspace[cols.workspace.id], [cols.task.status]: ACTIVE }).first();
  if (!row) throw new exHttpInvalidParams('وظیفه پیدا نشد');
  if (!MANAGE_ROLES.includes(access.role) && Number(row[cols.task.assignedUserID]) !== auth.uid && Number(row[cols.task.createdByUserID]) !== auth.uid) {
    throw new exHttpAccessDenied('اجازه حذف این وظیفه را ندارید');
  }
  await db(tables.tasks).where(cols.task.id, row[cols.task.id]).update({ [cols.task.status]: 'Archived', [cols.task.updatedAt]: db.fn.now() });
  return { ok: true };
}

export async function addCRMNote(auth: IntfAuth, workspaceKey: string | null, customerKey: string, input: Row): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey); requireWrite(access);
  const customer = await getCustomerRow(access, customerKey);
  const titleValue = text(input.title, 220) || 'یادداشت';
  const detailValue = text(input.detail, 10000);
  if (!detailValue) throw new exHttpInvalidParams('متن یادداشت خالی است');
  const db = await getDB();
  await addActivity(db, access.workspace[cols.workspace.id], customer[cols.customer.id], auth.uid, 'note', titleValue, detailValue, 'note', key32());
  await touchCustomer(db, customer[cols.customer.id]);
  return getCRMCustomer(auth, access.workspace[cols.workspace.key], customerKey);
}

/* -------------------------------------------------------------------------- */
/* Conversations and AI                                                      */
/* -------------------------------------------------------------------------- */

function heuristicConversationAI(body: string, products: Row[]): Row {
  const lower = body.toLowerCase();
  const detectedProducts = products.filter(item => lower.includes(String(item[cols.product.name] || '').toLowerCase()) || lower.includes(String(item[cols.product.shortName] || '').toLowerCase())).map(item => item[cols.product.shortName]);
  const urgent = /فوری|امروز|مهلت|حداکثر|بحرانی|سریع/.test(body);
  const negative = /نارضای|شکایت|اختلال|مشکل|تاخیر|تأخیر/.test(body);
  return {
    intent: /قیمت|پیش.?فاکتور|خرید|پیشنهاد/.test(body) ? 'درخواست فروش یا پیشنهاد تجاری' : /مشکل|اختلال|پشتیبانی/.test(body) ? 'درخواست پشتیبانی' : 'پیگیری و دریافت اطلاعات',
    sentiment: negative ? 'نیازمند توجه؛ نشانه نارضایتی یا مشکل' : 'خنثی یا مثبت',
    urgency: urgent ? 'بالا' : 'عادی',
    products: detectedProducts,
    budget: /بودجه|قیمت|مبلغ/.test(body) ? 'موضوع مالی در متن مطرح شده است' : 'در متن اعلام نشده',
    decisionDate: urgent ? 'مهلت یا زمان تصمیم در متن مطرح شده است' : 'مشخص نشده',
    commitments: [],
    nextAction: urgent ? 'بررسی فوری و پاسخ در کوتاه‌ترین زمان' : 'بررسی درخواست و تعیین اقدام بعدی',
  };
}

export async function listCRMConversations(auth: IntfAuth, workspaceKey?: string | null): Promise<Row[]> {
  const access = await getCRMAccess(auth, workspaceKey); const snapshot = await loadSnapshot(access, auth.uid);
  return snapshot.conversations.slice().sort((a, b) => new Date(b[cols.conversation.updatedAt]).getTime() - new Date(a[cols.conversation.updatedAt]).getTime()).map(item => conversationDTO(item, snapshot, auth.uid));
}

async function markConversationRead(access: CRMAccess, conversationID: number, userID: number): Promise<void> {
  const db = await getDB();
  const existing = await db(tables.conversationReads).where({ [cols.conversationRead.conversationID]: conversationID, [cols.conversationRead.userID]: userID }).first();
  if (existing) await db(tables.conversationReads).where(cols.conversationRead.id, existing[cols.conversationRead.id]).update({ [cols.conversationRead.readAt]: db.fn.now() });
  else await db(tables.conversationReads).insert({ [cols.conversationRead.conversationID]: conversationID, [cols.conversationRead.userID]: userID, [cols.conversationRead.readAt]: db.fn.now() });
}

export async function getCRMConversation(auth: IntfAuth, workspaceKey: string | null, key: string): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey); const row = await getConversationRow(access, key);
  await markConversationRead(access, row[cols.conversation.id], auth.uid);
  const snapshot = await loadSnapshot(access, auth.uid); const fresh = snapshot.conversations.find(item => item[cols.conversation.key] === key)!;
  return conversationDTO(fresh, snapshot, auth.uid);
}

export async function createCRMConversation(auth: IntfAuth, workspaceKey: string | null, input: Row): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey); requireWrite(access);
  const customer = await getCustomerRow(access, text(input.customerId, 32));
  const db = await getDB();
  let contact: Row | null = null;
  if (input.contactId) {
    contact = await db(tables.contacts).where({ [cols.contact.key]: text(input.contactId, 32), [cols.contact.customerID]: customer[cols.customer.id], [cols.contact.status]: ACTIVE }).first();
    if (!contact) throw new exHttpInvalidParams('فرد تماس متعلق به این مشتری نیست');
  }
  const subject = text(input.subject, 240); const body = text(input.body, 50000);
  if (!subject || !body) throw new exHttpInvalidParams('موضوع و متن مکالمه الزامی است');
  const assignedUserID = input.assignedId
    ? await resolveWorkspaceMemberUserID(access, input.assignedId)
    : auth.uid;
  const snapshot = await loadSnapshot(access, auth.uid); const ai = heuristicConversationAI(body, snapshot.products);
  const result = await db.transaction(async trx => {
    const inserted = await trx(tables.conversations).insert({
      [cols.conversation.key]: key32(), [cols.conversation.workspaceID]: access.workspace[cols.workspace.id], [cols.conversation.customerID]: customer[cols.customer.id],
      [cols.conversation.contactID]: contact?.[cols.contact.id] || null, [cols.conversation.assignedUserID]: assignedUserID,
      [cols.conversation.channel]: text(input.channel, 24) || 'email', [cols.conversation.subject]: subject, [cols.conversation.body]: body,
      [cols.conversation.preview]: text(input.preview || body, 500), [cols.conversation.ai]: json(ai), [cols.conversation.status]: 'Open',
    }).returning(cols.conversation.id);
    const id = firstID(inserted, cols.conversation.id); const row = await trx(tables.conversations).where(cols.conversation.id, id).first();
    await trx(tables.conversationMessages).insert({
      [cols.conversationMessage.key]: key32(), [cols.conversationMessage.conversationID]: id, [cols.conversationMessage.senderUserID]: null,
      [cols.conversationMessage.direction]: 'Incoming', [cols.conversationMessage.body]: body,
    });
    await addActivity(trx, access.workspace[cols.workspace.id], customer[cols.customer.id], auth.uid, text(input.channel, 32) || 'message', subject, text(body, 1000), 'conversation', row[cols.conversation.key]);
    await touchCustomer(trx, customer[cols.customer.id]);
    return row[cols.conversation.key];
  });
  return getCRMConversation(auth, access.workspace[cols.workspace.key], result);
}

export async function updateCRMConversation(auth: IntfAuth, workspaceKey: string | null, key: string, input: Row): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey); requireWrite(access);
  const row = await getConversationRow(access, key); const db = await getDB();
  const changes: Row = { [cols.conversation.updatedAt]: db.fn.now() };
  if (Object.prototype.hasOwnProperty.call(input, 'subject')) {
    const subject = text(input.subject, 240); if (!subject) throw new exHttpInvalidParams('موضوع مکالمه الزامی است');
    changes[cols.conversation.subject] = subject;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'status')) changes[cols.conversation.status] = text(input.status, 20) || 'Open';
  if (Object.prototype.hasOwnProperty.call(input, 'assignedId')) changes[cols.conversation.assignedUserID] = await resolveWorkspaceMemberUserID(access, input.assignedId, { nullable: true });
  if (Object.prototype.hasOwnProperty.call(input, 'contactId')) {
    if (!input.contactId) changes[cols.conversation.contactID] = null;
    else {
      const contact = await db(tables.contacts).where({
        [cols.contact.key]: text(input.contactId, 32),
        [cols.contact.customerID]: row[cols.conversation.customerID],
        [cols.contact.status]: ACTIVE,
      }).first();
      if (!contact) throw new exHttpInvalidParams('فرد تماس متعلق به این مشتری نیست');
      changes[cols.conversation.contactID] = contact[cols.contact.id];
    }
  }
  await db(tables.conversations).where(cols.conversation.id, row[cols.conversation.id]).update(changes);
  return getCRMConversation(auth, access.workspace[cols.workspace.key], key);
}

function extractJSONObject(source: string): Row | null {
  const cleaned = source.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)) as Row; } catch { return null; }
}

export async function analyzeCRMConversation(auth: IntfAuth, workspaceKey: string | null, key: string): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey); requireWrite(access);
  const row = await getConversationRow(access, key); const snapshot = await loadSnapshot(access, auth.uid);
  const customer = snapshot.customers.find(item => Number(item[cols.customer.id]) === Number(row[cols.conversation.customerID]));
  const systemPrompt = `شما تحلیل‌گر مکالمات CRM فارسی هستید. فقط یک شیء JSON معتبر بدون Markdown برگردانید با کلیدهای intent, sentiment, urgency, products, budget, decisionDate, commitments, nextAction. products و commitments آرایه رشته هستند. از حدس قطعی درباره اطلاعات موجود نبودن خودداری کنید.`;
  const userPrompt = `مشتری: ${customer?.[cols.customer.name] || ''}\nموضوع: ${row[cols.conversation.subject]}\nمتن:\n${row[cols.conversation.body]}`;
  const generated = await generate('تحلیل مکالمه CRM', enuLLMServices.Think, systemPrompt, userPrompt, 900, 0.1);
  const fallback = heuristicConversationAI(String(row[cols.conversation.body]), snapshot.products);
  const parsed = extractJSONObject(generated) || fallback;
  const ai = {
    ...fallback,
    ...parsed,
    products: Array.isArray(parsed.products) ? parsed.products.map((item: unknown) => text(item, 120)).filter(Boolean).slice(0, 20) : fallback.products,
    commitments: Array.isArray(parsed.commitments) ? parsed.commitments.map((item: unknown) => text(item, 300)).filter(Boolean).slice(0, 20) : fallback.commitments,
  };
  const db = await getDB(); await db(tables.conversations).where(cols.conversation.id, row[cols.conversation.id]).update({ [cols.conversation.ai]: json(ai), [cols.conversation.updatedAt]: db.fn.now() });
  return getCRMConversation(auth, access.workspace[cols.workspace.key], key);
}

export async function generateCRMReply(auth: IntfAuth, workspaceKey: string | null, key: string, toneInput: unknown): Promise<string> {
  const access = await getCRMAccess(auth, workspaceKey); requireWrite(access);
  const conversation = await getCRMConversation(auth, access.workspace[cols.workspace.key], key);
  const tone = text(toneInput, 20) || 'formal';
  const current = await atDB.user.getByID(auth.uid, true);
  const systemPrompt = `شما دستیار نگارش پاسخ CRM شرکت ${access.workspace[cols.workspace.name]} هستید. پاسخ فارسی، دقیق، بدون ادعای تاییدنشده و قابل ویرایش تولید کنید. لحن: ${tone}. تعهد زمانی یا مالی جدید نسازید. فقط متن پاسخ را برگردانید.`;
  const userPrompt = `مشتری: ${conversation.customer?.name || ''}\nمخاطب: ${conversation.contact?.name || ''}\nموضوع: ${conversation.subject}\nپیام مشتری:\n${conversation.body}\nتحلیل موجود: ${JSON.stringify(conversation.ai)}\nنام پاسخ‌دهنده: ${current?.usrName || auth.name || 'کارشناس CRM'}`;
  return generate('تولید پاسخ CRM', enuLLMServices.Think, systemPrompt, userPrompt, 1200, 0.25);
}

export async function saveCRMReply(auth: IntfAuth, workspaceKey: string | null, key: string, bodyInput: unknown): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey); requireWrite(access); const row = await getConversationRow(access, key);
  const body = text(bodyInput, 50000); if (!body) throw new exHttpInvalidParams('متن پاسخ خالی است');
  const db = await getDB();
  await db.transaction(async trx => {
    await trx(tables.conversationMessages).insert({
      [cols.conversationMessage.key]: key32(), [cols.conversationMessage.conversationID]: row[cols.conversation.id], [cols.conversationMessage.senderUserID]: auth.uid,
      [cols.conversationMessage.direction]: 'Outgoing', [cols.conversationMessage.body]: body,
    });
    await trx(tables.conversations).where(cols.conversation.id, row[cols.conversation.id]).update({ [cols.conversation.status]: 'Replied', [cols.conversation.updatedAt]: trx.fn.now() });
    await addActivity(trx, access.workspace[cols.workspace.id], row[cols.conversation.customerID], auth.uid, 'reply', 'ثبت پاسخ به مکالمه', text(body, 1000), 'conversation', key);
    await touchCustomer(trx, row[cols.conversation.customerID]);
  });
  return getCRMConversation(auth, access.workspace[cols.workspace.key], key);
}

/* -------------------------------------------------------------------------- */
/* Dashboard, reports, search and assistant                                   */
/* -------------------------------------------------------------------------- */

export async function crmDashboard(auth: IntfAuth, workspaceKey?: string | null): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey); const snapshot = await loadSnapshot(access, auth.uid);
  const active = snapshot.opportunities.filter(item => ACTIVE_STAGES.includes(item[cols.opportunity.stage]));
  const pipelineValue = active.reduce((sum, item) => sum + finiteNumber(item[cols.opportunity.value]), 0);
  const weightedPipeline = active.reduce((sum, item) => sum + finiteNumber(item[cols.opportunity.value]) * finiteNumber(item[cols.opportunity.probability]) / 100, 0);
  const conversations = snapshot.conversations.map(item => conversationDTO(item, snapshot, auth.uid)).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  let openTasks = snapshot.tasks.filter(item => !item[cols.task.doneAt]);
  if (!MANAGE_ROLES.includes(access.role)) openTasks = openTasks.filter(item => !item[cols.task.assignedUserID] || Number(item[cols.task.assignedUserID]) === auth.uid);
  openTasks.sort((a, b) => new Date(a[cols.task.dueAt] || '2999-01-01').getTime() - new Date(b[cols.task.dueAt] || '2999-01-01').getTime());
  const atRiskRows = snapshot.customers.filter(item => finiteNumber(item[cols.customer.health], 75) < 65);
  const opportunities = active.map(item => opportunityDTO(item, snapshot)).sort((a, b) => b.probability - a.probability);
  const productPipeline = snapshot.products.map(product => {
    const related = active.filter(item => Number(item[cols.opportunity.productID]) === Number(product[cols.product.id]));
    return { id: product[cols.product.key], name: product[cols.product.shortName], type: normalizeProductType(product[cols.product.type]), value: related.reduce((sum, item) => sum + finiteNumber(item[cols.opportunity.value]), 0), count: related.length };
  }).filter(item => item.count).sort((a, b) => b.value - a.value);
  const urgentTask = openTasks[0]; const urgentCustomer = urgentTask ? snapshot.customers.find(item => Number(item[cols.customer.id]) === Number(urgentTask[cols.task.customerID])) : null;
  const brief = active.length || openTasks.length || atRiskRows.length
    ? `در حال حاضر ${active.length.toLocaleString('fa-IR')} فرصت فعال با ارزش ${pipelineValue.toLocaleString('fa-IR')} تومان وجود دارد. ${openTasks.length.toLocaleString('fa-IR')} پیگیری باز و ${atRiskRows.length.toLocaleString('fa-IR')} مشتری با سلامت زیر ۶۵ ثبت شده است.${urgentTask ? ` نزدیک‌ترین اقدام، «${urgentTask[cols.task.title]}»${urgentCustomer ? ` برای ${urgentCustomer[cols.customer.name]}` : ''} است.` : ''}`
    : 'هنوز داده عملیاتی کافی ثبت نشده است. با افزودن مشتری، محصول، فرصت و مکالمه، نمای مدیریتی به‌صورت خودکار تکمیل می‌شود.';
  return {
    role: access.role.toLowerCase(), brief,
    kpis: { pipelineValue, weightedPipeline, activeCount: active.length, unreadCount: conversations.filter(item => item.unread).length, taskCount: openTasks.length, riskCount: atRiskRows.length },
    tasks: openTasks.slice(0, 8).map(item => taskDTO(item, snapshot)), conversations: conversations.slice(0, 6), opportunities: opportunities.slice(0, 6),
    atRiskCustomers: atRiskRows.map(item => customerDTO(item, snapshot)), productPipeline,
  };
}

export async function crmReports(auth: IntfAuth, workspaceKey?: string | null): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey); const snapshot = await loadSnapshot(access, auth.uid);
  const funnel = ACTIVE_STAGES.map(stage => {
    const rows = snapshot.opportunities.filter(item => item[cols.opportunity.stage] === stage && item[cols.opportunity.status] === ACTIVE);
    return { stage, count: rows.length, value: rows.reduce((sum, item) => sum + finiteNumber(item[cols.opportunity.value]), 0) };
  });
  const byProduct = snapshot.products.map(product => {
    const rows = snapshot.opportunities.filter(item => Number(item[cols.opportunity.productID]) === Number(product[cols.product.id]) && item[cols.opportunity.status] === ACTIVE);
    return { productId: product[cols.product.key], name: product[cols.product.shortName], type: normalizeProductType(product[cols.product.type]), value: rows.reduce((sum, item) => sum + finiteNumber(item[cols.opportunity.value]), 0), weighted: rows.reduce((sum, item) => sum + finiteNumber(item[cols.opportunity.value]) * finiteNumber(item[cols.opportunity.probability]) / 100, 0), count: rows.length };
  }).filter(item => item.count).sort((a, b) => b.value - a.value);
  const hardware = byProduct.filter(item => item.type === 'hardware').reduce((sum, item) => sum + item.value, 0);
  const software = byProduct.filter(item => item.type === 'software').reduce((sum, item) => sum + item.value, 0);
  const service = byProduct.filter(item => item.type === 'service').reduce((sum, item) => sum + item.value, 0);
  const customers = snapshot.customers.map(item => customerDTO(item, snapshot));
  const largest = byProduct[0];
  const insight = largest ? `بیشترین ارزش سبد متعلق به ${largest.name} است. ارزش کل سبد سخت‌افزار ${hardware.toLocaleString('fa-IR')}، نرم‌افزار ${software.toLocaleString('fa-IR')} و خدمات ${service.toLocaleString('fa-IR')} تومان است.` : 'هنوز فرصت فروشی برای تحلیل ثبت نشده است.';
  return { funnel, byProduct, hardware, software, service, customers, insight };
}

export async function crmSearch(auth: IntfAuth, workspaceKey: string | null, queryInput: unknown): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey); const snapshot = await loadSnapshot(access, auth.uid); const query = text(queryInput, 200).toLowerCase();
  if (query.length < 2) return { customers: [], opportunities: [], products: [], conversations: [] };
  const includes = (...values: unknown[]) => values.flat().filter(Boolean).join(' ').toLowerCase().includes(query);
  return {
    customers: snapshot.customers.filter(item => includes(item[cols.customer.name], item[cols.customer.industry], item[cols.customer.city], parseJSON(item[cols.customer.tags], []))).slice(0, 8).map(item => basicCustomerDTO(item, snapshot)),
    opportunities: snapshot.opportunities.filter(item => {
      const customer = snapshot.customers.find(c => Number(c[cols.customer.id]) === Number(item[cols.opportunity.customerID]));
      const product = snapshot.products.find(p => Number(p[cols.product.id]) === Number(item[cols.opportunity.productID]));
      return includes(item[cols.opportunity.title], customer?.[cols.customer.name], product?.[cols.product.name]);
    }).slice(0, 8).map(item => opportunityDTO(item, snapshot)),
    products: snapshot.products.filter(item => includes(item[cols.product.name], item[cols.product.shortName], item[cols.product.category], item[cols.product.code])).slice(0, 8).map(item => productDTO(item, snapshot)),
    conversations: snapshot.conversations.filter(item => {
      const customer = snapshot.customers.find(c => Number(c[cols.customer.id]) === Number(item[cols.conversation.customerID]));
      return includes(item[cols.conversation.subject], item[cols.conversation.preview], customer?.[cols.customer.name]);
    }).slice(0, 8).map(item => conversationDTO(item, snapshot, auth.uid)),
  };
}

function assistantLinks(prompt: string, context: Row): Row[] {
  if (context.customerId) return [{ label: 'بازکردن پرونده مشتری', route: `customer/${context.customerId}` }];
  if (/مکالم|پیام|ایمیل/.test(prompt)) return [{ label: 'مرکز مکالمات', route: 'conversations' }];
  if (/محصول|سخت.?افزار|نرم.?افزار|خدمت/.test(prompt)) return [{ label: 'محصولات', route: 'products' }, { label: 'گزارش فروش', route: 'reports' }];
  if (/فرصت|فروش|ریسک/.test(prompt)) return [{ label: 'برد فرصت‌ها', route: 'opportunities' }];
  return [{ label: 'نمای امروز', route: 'dashboard' }];
}

export async function askCRMAssistant(auth: IntfAuth, workspaceKey: string | null, promptInput: unknown, context: Row = {}): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey); const prompt = text(promptInput, 4000); if (!prompt) throw new exHttpInvalidParams('پرسش خالی است');
  const snapshot = await loadSnapshot(access, auth.uid);
  let contextData: Row;
  if (context.customerId) {
    const customer = snapshot.customers.find(item => item[cols.customer.key] === context.customerId);
    contextData = customer ? customerDTO(customer, snapshot) : {};
  } else if (context.conversationId) {
    const conversation = snapshot.conversations.find(item => item[cols.conversation.key] === context.conversationId);
    contextData = conversation ? conversationDTO(conversation, snapshot, auth.uid) : {};
  } else {
    const active = snapshot.opportunities.filter(item => ACTIVE_STAGES.includes(item[cols.opportunity.stage])).map(item => opportunityDTO(item, snapshot));
    contextData = {
      customers: snapshot.customers.map(item => basicCustomerDTO(item, snapshot)).slice(0, 80),
      opportunities: active.slice(0, 80),
      tasks: snapshot.tasks.filter(item => !item[cols.task.doneAt]).slice(0, 80).map(item => taskDTO(item, snapshot)),
      products: snapshot.products.map(item => productDTO(item, snapshot)),
      recentConversations: snapshot.conversations.slice().sort((a, b) => new Date(b[cols.conversation.updatedAt]).getTime() - new Date(a[cols.conversation.updatedAt]).getTime()).slice(0, 20).map(item => conversationDTO(item, snapshot, auth.uid)),
    };
  }
  const systemPrompt = `شما دستیار تحلیلی CRM شرکت ${access.workspace[cols.workspace.name]} هستید. فقط براساس JSON داده‌شده پاسخ دهید. اگر داده کافی نیست صریح بگویید. پاسخ فارسی، اجرایی، کوتاه و بدون ساختن نام، عدد یا تعهد باشد. اطلاعات تماس را بی‌دلیل بازگو نکنید.`;
  const userPrompt = `پرسش: ${prompt}\nداده CRM:\n${JSON.stringify(contextData).slice(0, 60000)}`;
  const answer = await generate('تحلیل CRM', enuLLMServices.Think, systemPrompt, userPrompt, 1500, 0.15);
  return { text: answer, links: assistantLinks(prompt, context) };
}

export async function generateCustomerSummary(auth: IntfAuth, workspaceKey: string | null, customerKey: string): Promise<Row> {
  const access = await getCRMAccess(auth, workspaceKey); requireWrite(access);
  const customer = await getCRMCustomer(auth, access.workspace[cols.workspace.key], customerKey);
  const systemPrompt = 'یک خلاصه مدیریتی فارسی، حداکثر ۱۴۰ کلمه، فقط بر اساس داده‌های پرونده مشتری بنویس. وضعیت رابطه، فرصت‌ها، ریسک‌ها و اقدام بعدی را روشن کن. اطلاعاتی نساز.';
  const summary = await generate('خلاصه پرونده مشتری', enuLLMServices.Think, systemPrompt, JSON.stringify(customer).slice(0, 40000), 700, 0.1);
  const row = await getCustomerRow(access, customerKey); const db = await getDB();
  await db(tables.customers).where(cols.customer.id, row[cols.customer.id]).update({ [cols.customer.aiSummary]: summary, [cols.customer.updatedAt]: db.fn.now() });
  return getCRMCustomer(auth, access.workspace[cols.workspace.key], customerKey);
}

import { randomUUID } from 'crypto';
import md5 from 'md5';
import type { Request, Response, NextFunction } from 'express';

import atDB from '../db/atDB';
import { getDB } from '../db/index';
import type { IntfAuth, IntfPrivileges } from '../interfaces/auth';
import { enuLLMServices } from '../interfaces/config';
import { enuRoles } from '../interfaces/llm';
import {
  exHttpAccessDenied,
  exHttpConflict,
  exHttpInvalidParams,
  exHttpPreconditionFailed,
} from '../interfaces/exHttp';
import { DEFAULT_GROUP_ID } from '../db/tables/tblGroup';
import { enuMsgStatus } from '../db/tables/tblMessages';
import type { IntfWidgetRow } from '../db/tables/tblWidgets';
import { enuWidgetStatus } from '../db/tables/tblWidgets';
import type { IntfWidgetSessionRow } from '../db/tables/tblWidgetSessions';
import type { IntfFileMeta } from '../interfaces/file';
import { deleteRagFileByKey, listRagFiles, uploadRagFile } from './ragResourceService';
import { runRagChat, type IntfRagBeforeGenerateContext } from './ragChatService';
import { sendStreamHeadersIfNeeded } from './chatService';

const RAG_SERVICE = enuLLMServices.RAG;
const WIDGET_USERNAME_PREFIX = 'widget-';
const WIDGET_USERNAME_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://llm.fapco.dev').replace(/\/$/, '');

export type WidgetAppearance = {
  title: string;
  assistantName: string;
  subtitle: string;
  welcomeMessage: string;
  inputPlaceholder: string;
  greetingBubble: string;
  primaryColor: string;
  theme: 'light' | 'dark' | 'auto';
  position: 'right' | 'left';
  logoDataUrl: string;
  showBranding: boolean;
  autoOpen: boolean;
  autoOpenDelay: number;
  quickQuestions: string[];
};

export type WidgetScheduleDay = { enabled: boolean; start: string; end: string };
export type WidgetSchedule = {
  timezone: string;
  days: Record<string, WidgetScheduleDay>;
};

export type WidgetBehavior = {
  customPrompt: string;
  answerMode: 'files-only' | 'files-and-general';
  responseLength: 'short' | 'balanced' | 'detailed';
  tone: 'formal' | 'friendly' | 'sales' | 'support';
  showReferences: boolean;
  fallbackMessage: string;
  humanHandoff: {
    enabled: boolean;
    saveUnanswered: boolean;
    collectContact: boolean;
    similarityEnabled: boolean;
    similarityThreshold: number;
    topics: string[];
    keywords: string[];
    outsideHoursBehavior: 'queue' | 'bot-only';
    schedule: WidgetSchedule;
  };
};

export type WidgetConfig = {
  appearance: WidgetAppearance;
  behavior: WidgetBehavior;
};

const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  general: 'معرفی محصول و اطلاعات عمومی',
  sales: 'فروش، قیمت و درخواست پیش‌فاکتور',
  technical: 'پشتیبانی فنی و خطای محصول',
  warranty: 'گارانتی، تعمیر و خدمات پس از فروش',
  complaint: 'شکایت، نارضایتی و پیگیری فوری',
  contract: 'قرارداد، تمدید و امور مالی',
  security: 'امنیت، محرمانگی و الزامات سازمانی',
  unknown: 'پرسش خارج از دانش',
};

export const DEFAULT_WIDGET_SYSTEM_PROMPT = `شما پشتیبان هوشمند وب‌سایتی هستید که این ویجت روی آن نصب شده است.
- پاسخ را به زبان کاربر، روشن، محترمانه و بدون ادعای انجام اقدام خارج از سامانه ارائه کنید.
- ابتدا از اسناد اختصاصی همین ویجت استفاده کنید و اطلاعات، قیمت، تعهد یا ویژگی ساختگی تولید نکنید.
- اگر پاسخ مطمئن در منابع موجود نیست، این موضوع را صریح اعلام کنید و مطابق تنظیمات ویجت کاربر را به پشتیبان انسانی هدایت کنید.
- خود را انسان معرفی نکنید.
- اگر در مورد مدل زبانی سوال شد بگویید از مدل  زبانی پایه ترگمان استفاده می‌کنید
- از Markdown ساده استفاده کنید.`;

const DEFAULT_WIDGET_FALLBACK = 'برای این پرسش پاسخ مطمئنی در منابع موجود ندارم. پرسش شما برای پشتیبان انسانی ثبت می‌شود.';
const EFFECTIVE_APPEARANCE_DEFAULTS = {
  title: 'پشتیبان هوشمند',
  assistantName: 'پشتیبان',
  subtitle: 'پاسخ‌گوی محصولات و خدمات',
  welcomeMessage: 'سلام! چطور می‌توانم راهنمایی‌تان کنم؟',
  inputPlaceholder: 'پرسش خود را بنویسید...',
} as const;

function defaultSchedule(): WidgetSchedule {
  return {
    timezone: 'Asia/Tehran',
    days: {
      saturday: { enabled: true, start: '08:00', end: '18:00' },
      sunday: { enabled: true, start: '08:00', end: '18:00' },
      monday: { enabled: true, start: '08:00', end: '18:00' },
      tuesday: { enabled: true, start: '08:00', end: '18:00' },
      wednesday: { enabled: true, start: '08:00', end: '18:00' },
      thursday: { enabled: true, start: '08:00', end: '14:00' },
      friday: { enabled: false, start: '09:00', end: '13:00' },
    },
  };
}

export function defaultWidgetConfig(): WidgetConfig {
  return {
    appearance: {
      title: '',
      assistantName: '',
      subtitle: '',
      welcomeMessage: '',
      inputPlaceholder: '',
      greetingBubble: '',
      primaryColor: '#0d6efd',
      theme: 'light',
      position: 'right',
      logoDataUrl: '',
      showBranding: true,
      autoOpen: false,
      autoOpenDelay: 5,
      quickQuestions: [],
    },
    behavior: {
      customPrompt: '',
      answerMode: 'files-only',
      responseLength: 'balanced',
      tone: 'formal',
      showReferences: true,
      fallbackMessage: '',
      humanHandoff: {
        enabled: true,
        saveUnanswered: true,
        collectContact: true,
        similarityEnabled: false,
        similarityThreshold: 35,
        topics: [],
        keywords: [],
        outsideHoursBehavior: 'queue',
        schedule: defaultSchedule(),
      },
    },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) return (patch === undefined ? base : patch) as T;
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const current = result[key];
    result[key] = isPlainObject(current) && isPlainObject(value) ? deepMerge(current, value) : value;
  }
  return result as T;
}

function parseJSON<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return value as T;
}

function normalizeText(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeImageSource(value: unknown, max: number): string {
  const source = normalizeText(value, max);
  if (!source) return '';
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(source)) return source;
  try {
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('invalid image URL');
    return url.href;
  } catch {
    throw new exHttpInvalidParams('تصویر باید PNG، JPEG، WebP یا GIF بارگذاری‌شده یا نشانی HTTPS معتبر باشد');
  }
}

function normalizeStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(v => normalizeText(v, maxLength)).filter(Boolean))].slice(0, maxItems);
}

export function normalizeTargetOrigin(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new exHttpInvalidParams('دامنه مقصد معتبر نیست');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new exHttpInvalidParams('دامنه مقصد باید با HTTP یا HTTPS قابل دسترس باشد');
  if (url.username || url.password || (url.pathname && url.pathname !== '/') || url.search || url.hash)
    throw new exHttpInvalidParams('فقط مبدأ سایت شامل پروتکل، دامنه و در صورت نیاز پورت را وارد کنید');
  return url.origin.toLowerCase();
}

function sanitizeAppearance(raw: unknown): WidgetAppearance {
  const defaults = defaultWidgetConfig().appearance;
  const input = deepMerge(defaults, raw);
  const color = /^#[0-9a-f]{6}$/i.test(String(input.primaryColor)) ? String(input.primaryColor) : defaults.primaryColor;
  const theme = ['light', 'dark', 'auto'].includes(String(input.theme)) ? input.theme : defaults.theme;
  const position = ['right', 'left'].includes(String(input.position)) ? input.position : defaults.position;
  const logo = normalizeImageSource(input.logoDataUrl, 350000);
  return {
    title: normalizeText(input.title, 80),
    assistantName: normalizeText(input.assistantName, 50),
    subtitle: normalizeText(input.subtitle, 140),
    welcomeMessage: normalizeText(input.welcomeMessage, 1000),
    inputPlaceholder: normalizeText(input.inputPlaceholder, 120),
    greetingBubble: normalizeText(input.greetingBubble, 180),
    primaryColor: color,
    theme: theme as WidgetAppearance['theme'],
    position: position as WidgetAppearance['position'],
    logoDataUrl: logo,
    showBranding: Boolean(input.showBranding),
    autoOpen: Boolean(input.autoOpen),
    autoOpenDelay: Math.max(1, Math.min(120, Number(input.autoOpenDelay || defaults.autoOpenDelay))),
    quickQuestions: normalizeStringArray(input.quickQuestions, 6, 120),
  };
}

function effectiveAppearance(appearance: WidgetAppearance): WidgetAppearance {
  return {
    ...appearance,
    title: appearance.title || EFFECTIVE_APPEARANCE_DEFAULTS.title,
    assistantName: appearance.assistantName || EFFECTIVE_APPEARANCE_DEFAULTS.assistantName,
    subtitle: appearance.subtitle || EFFECTIVE_APPEARANCE_DEFAULTS.subtitle,
    welcomeMessage: appearance.welcomeMessage || EFFECTIVE_APPEARANCE_DEFAULTS.welcomeMessage,
    inputPlaceholder: appearance.inputPlaceholder || EFFECTIVE_APPEARANCE_DEFAULTS.inputPlaceholder,
  };
}

function validTime(value: unknown, fallback: string): string {
  const text = String(value || '');
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : fallback;
}

function sanitizeSchedule(raw: unknown): WidgetSchedule {
  const defaults = defaultSchedule();
  const input = deepMerge(defaults, raw);
  const days: Record<string, WidgetScheduleDay> = {};
  for (const [key, fallback] of Object.entries(defaults.days)) {
    const row = isPlainObject(input.days?.[key]) ? input.days[key] as Record<string, unknown> : fallback;
    const start = validTime(row.start, fallback.start);
    const end = validTime(row.end, fallback.end);
    days[key] = { enabled: Boolean(row.enabled), start, end };
  }
  let timezone = normalizeText(input.timezone, 64) || defaults.timezone;
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date()); } catch { timezone = defaults.timezone; }
  return { timezone, days };
}

function sanitizeBehavior(raw: unknown): WidgetBehavior {
  const defaults = defaultWidgetConfig().behavior;
  const rawInput = isPlainObject(raw) ? raw : {};
  const input = deepMerge(defaults, rawInput);
  const rawHandoff = isPlainObject(rawInput.humanHandoff) ? rawInput.humanHandoff : {};
  const handoff = deepMerge(defaults.humanHandoff, input.humanHandoff);
  const rawAnswerMode = String(input.answerMode);
  const answerMode = rawAnswerMode === 'files-plus-general'
    ? 'files-and-general'
    : ['files-only', 'files-and-general'].includes(rawAnswerMode) ? rawAnswerMode : defaults.answerMode;
  const responseLength = ['short', 'balanced', 'detailed'].includes(String(input.responseLength)) ? input.responseLength : defaults.responseLength;
  const rawTone = String(input.tone);
  const tone = rawTone === 'technical'
    ? 'support'
    : ['formal', 'friendly', 'sales', 'support'].includes(rawTone) ? rawTone : defaults.tone;
  const legacyCategories = normalizeStringArray(rawHandoff.categories, 12, 32)
    .map(item => LEGACY_CATEGORY_LABELS[item] || item);
  const topics = normalizeStringArray(rawHandoff.topics ?? handoff.topics, 30, 80);
  const similarityEnabled = Object.prototype.hasOwnProperty.call(rawHandoff, 'similarityEnabled')
    ? Boolean(rawHandoff.similarityEnabled)
    : Boolean(rawHandoff.lowConfidenceEnabled);
  const similarityThresholdValue = rawHandoff.similarityThreshold ?? rawHandoff.confidenceThreshold ?? defaults.humanHandoff.similarityThreshold;
  return {
    customPrompt: normalizeText(rawInput.customPrompt ?? rawInput.requiredPrompt ?? input.customPrompt, 8000),
    answerMode: answerMode as WidgetBehavior['answerMode'],
    responseLength: responseLength as WidgetBehavior['responseLength'],
    tone: tone as WidgetBehavior['tone'],
    showReferences: Boolean(input.showReferences),
    fallbackMessage: normalizeText(input.fallbackMessage, 1000),
    humanHandoff: {
      enabled: Boolean(handoff.enabled),
      saveUnanswered: Boolean(handoff.saveUnanswered),
      collectContact: Boolean(handoff.collectContact),
      similarityEnabled,
      similarityThreshold: Math.max(0, Math.min(100, Number(similarityThresholdValue))),
      topics: topics.length ? topics : legacyCategories,
      keywords: normalizeStringArray(handoff.keywords, 30, 80),
      outsideHoursBehavior: handoff.outsideHoursBehavior === 'bot-only' ? 'bot-only' : 'queue',
      schedule: sanitizeSchedule(handoff.schedule),
    },
  };
}

export function sanitizeWidgetConfig(raw: unknown): WidgetConfig {
  const input = isPlainObject(raw) ? raw : {};
  return {
    appearance: sanitizeAppearance(input.appearance),
    behavior: sanitizeBehavior(input.behavior),
  };
}

function widgetConfig(row: IntfWidgetRow, published = false): WidgetConfig {
  const raw = published ? row.wgtPublishedConfig : row.wgtDraftConfig;
  return sanitizeWidgetConfig(parseJSON(raw, defaultWidgetConfig()));
}

function widgetStatus(row: IntfWidgetRow): string {
  return String(row.wgtStatus || enuWidgetStatus.draft).toLowerCase();
}

async function generateUniqueWidgetUsername(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let suffix = '';
    for (let i = 0; i < 9; i += 1) suffix += WIDGET_USERNAME_CHARS[Math.floor(Math.random() * WIDGET_USERNAME_CHARS.length)];
    const username = `${WIDGET_USERNAME_PREFIX}${suffix}`;
    if (!(await atDB.user.findByUsername(username, true))) return username;
  }
  throw new exHttpConflict('امکان تولید نام کاربری یکتای ویجت وجود ندارد؛ دوباره تلاش کنید');
}

async function getRuntimeAuth(row: IntfWidgetRow): Promise<IntfAuth> {
  const user = await atDB.user.getByID(Number(row.wgtRuntime_usrID), true);
  if (!user) throw new exHttpPreconditionFailed('حساب اختصاصی ویجت در دسترس نیست');
  return {
    uid: Number(user.usrID),
    key: String(user.usrKey || ''),
    name: String(user.usrName || user.usrUsername || 'widget'),
    privs: (user.privs || null) as IntfPrivileges | null,
  };
}

async function runtimeUsername(runtimeID: number): Promise<string> {
  const runtime = await atDB.user.getByID(runtimeID, true);
  return String(runtime?.usrUsername || runtime?.usrName || 'widget-unknown');
}

async function userIdentity(userID: number | null | undefined) {
  if (!userID) return { id: 0, username: '', displayName: '' };
  const user = await atDB.user.getByID(userID, true);
  if (!user) return { id: userID, username: '', displayName: `کاربر ${userID}` };
  return {
    id: Number(user.usrID || userID),
    username: String(user.usrUsername || ''),
    displayName: String(user.usrName || user.usrUsername || `کاربر ${userID}`),
  };
}

async function fileDTOs(row: IntfWidgetRow) {
  const runtime = await getRuntimeAuth(row);
  const data = await listRagFiles(RAG_SERVICE, runtime, 1000, 0);
  return data.files.map(file => ({
    id: file.filKey,
    name: file.filName,
    size: Number(file.filSize || 0),
    type: String(file.filName || '').split('.').pop()?.toLowerCase() || 'file',
    status: file.filStatus === 'Processing' ? 'processing' : 'ready',
    progress: file.filStatus === 'Processing' ? 50 : 100,
    chunks: Number(file.filChunkCount || 0),
    uploadedAt: file.filUploadedAt,
  }));
}

async function operatorDTOs(row: IntfWidgetRow, includeRemoved = false) {
  const list = await atDB.widgetOperators.list(row.wgtID, includeRemoved);
  return list.map(item => ({
    username: item.usrUsername || `user-${item.wopOperator_usrID}`,
    displayName: item.usrName || item.usrUsername || `کاربر ${item.wopOperator_usrID}`,
    avatar: item.usrAvatar || '',
    active: item.wopStatus === 'Active',
    role: item.wopRole,
    createdAt: item.wopCreatedAt,
  }));
}

async function summaryForWidget(row: IntfWidgetRow) {
  const db = await getDB();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const sessions = await db('tblWidgetSessions')
    .select('wssID', 'wssChat_chtID', 'wssStatus', 'wssHandoffAt')
    .where('wssWidget_wgtID', row.wgtID)
    .andWhere('wssMode', 'Public')
    .andWhere('wssCreatedAt', '>=', since);
  const chatIDs = sessions.map(item => Number(item.wssChat_chtID));
  const humanRows = sessions.length
    ? await db('tblWidgetHumanReplies').select('whrMessage_msgID').whereIn('whrSession_wssID', sessions.map(item => Number(item.wssID)))
    : [];
  const humanMessageIDs = new Set(humanRows.map(item => Number(item.whrMessage_msgID)));
  const messages = chatIDs.length
    ? await db('tblMessages').select('msgID', 'msgRole').whereIn('msgRelated_chtID', chatIDs).andWhere('msgStatus', 'Finished').andWhere('msgCreatedAt', '>=', since)
    : [];
  const files = await fileDTOs(row);
  return {
    sessions: sessions.length,
    messages: messages.filter(item => item.msgRole === 'user').length,
    aiAnswers: messages.filter(item => item.msgRole === 'assistant' && !humanMessageIDs.has(Number(item.msgID))).length,
    humanEscalations: sessions.filter(item => item.wssHandoffAt).length,
    files: files.filter(f => f.status === 'ready').length,
    operators: (await operatorDTOs(row)).filter(item => item.active).length,
    pending: sessions.filter(item => ['Pending', 'Queued'].includes(item.wssStatus)).length,
    assigned: sessions.filter(item => item.wssStatus === 'Assigned').length,
    resolved: sessions.filter(item => item.wssStatus === 'Resolved').length,
  };
}

export async function widgetDTO(row: IntfWidgetRow, includeDetails = true, viewerUserID?: number) {
  const config = widgetConfig(row, false);
  const [username, owner, operators, files, summary, viewerOperator] = await Promise.all([
    runtimeUsername(row.wgtRuntime_usrID),
    userIdentity(row.wgtOwner_usrID),
    includeDetails ? operatorDTOs(row, true) : Promise.resolve([]),
    includeDetails ? fileDTOs(row) : Promise.resolve([]),
    includeDetails
      ? summaryForWidget(row)
      : Promise.resolve({ sessions: 0, messages: 0, aiAnswers: 0, humanEscalations: 0, files: 0, operators: 0, pending: 0, assigned: 0, resolved: 0 }),
    viewerUserID && viewerUserID !== row.wgtOwner_usrID
      ? atDB.widgetOperators.get(row.wgtID, viewerUserID)
      : Promise.resolve(undefined),
  ]);
  return {
    id: row.wgtKey,
    username,
    ownerUsername: owner.username,
    ownerDisplayName: owner.displayName,
    canManage: viewerUserID === undefined || row.wgtOwner_usrID === viewerUserID,
    canRespond: viewerUserID === undefined || row.wgtOwner_usrID === viewerUserID || viewerOperator?.wopStatus === 'Active',
    internalName: row.wgtInternalName,
    destinationDomain: row.wgtTargetOrigin,
    publishedDomain: row.wgtPublishedOrigin || '',
    status: widgetStatus(row),
    enabled: Boolean(row.wgtPublishedConfig) && [enuWidgetStatus.published, enuWidgetStatus.changed].includes(row.wgtStatus),
    createdAt: row.wgtCreatedAt,
    updatedAt: row.wgtUpdatedAt,
    publishedAt: row.wgtPublishedAt,
    lastTestAt: row.wgtLastTestAt,
    draftVersion: Number(row.wgtDraftVersion || 1),
    publishedVersion: Number(row.wgtPublishedVersion || 0),
    appearance: config.appearance,
    behavior: { ...config.behavior, defaultPrompt: DEFAULT_WIDGET_SYSTEM_PROMPT },
    operators,
    files,
    summary,
  };
}

export async function listWidgets(auth: IntfAuth) {
  const rows = await atDB.widgets.listAccessible(auth.uid);
  return Promise.all(rows.map(row => widgetDTO(row, row.wgtOwner_usrID === auth.uid, auth.uid)));
}

export async function getOwnedWidget(auth: IntfAuth, key: string): Promise<IntfWidgetRow> {
  const row = await atDB.widgets.getByKey(key);
  if (!row || row.wgtOwner_usrID !== auth.uid) throw new exHttpAccessDenied('ویجت یافت نشد یا اجازه مدیریت آن را ندارید');
  return row;
}

export async function getAccessibleWidget(auth: IntfAuth, key: string): Promise<IntfWidgetRow> {
  const row = await atDB.widgets.getByKey(key);
  if (!row) throw new exHttpAccessDenied('ویجت یافت نشد یا اجازه دسترسی ندارید');
  if (row.wgtOwner_usrID === auth.uid) return row;
  const operator = await atDB.widgetOperators.get(row.wgtID, auth.uid);
  if (!operator || operator.wopStatus !== 'Active') throw new exHttpAccessDenied('اجازه دسترسی به این ویجت را ندارید');
  return row;
}

export async function createWidget(auth: IntfAuth, input: Record<string, unknown> = {}) {
  const internalName = normalizeText(input.internalName, 100);
  const targetOrigin = input.destinationDomain ? normalizeTargetOrigin(input.destinationDomain) : '';
  const config = sanitizeWidgetConfig({
    appearance: input.appearance,
    behavior: input.behavior,
  });
  const widgetUsername = await generateUniqueWidgetUsername();
  const runtimeKey = md5(randomUUID());
  const runtimeID = Number(await atDB.user.addUser(
    runtimeKey,
    undefined,
    undefined,
    undefined,
    `${internalName || widgetUsername} (ویجت)`,
    {},
    WIDGET_GROUP_ID,
    widgetUsername,
  ));
  try {
    await atDB.perUserStats.initialize(RAG_SERVICE, runtimeID);
    const widgetKey = md5(randomUUID());
    const widgetID = await atDB.widgets.add({
      key: widgetKey,
      ownerUserID: auth.uid,
      runtimeUserID: runtimeID,
      internalName,
      targetOrigin,
      draftConfig: config,
    });
    const row = await atDB.widgets.getById(widgetID);
    if (!row) throw new Error('ویجت پس از ایجاد پیدا نشد');
    return widgetDTO(row, true, auth.uid);
  } catch (error) {
    await atDB.user.deactivate(runtimeID).catch(() => undefined);
    throw error;
  }
}

export async function updateWidget(auth: IntfAuth, key: string, patch: Record<string, unknown>) {
  const row = await getOwnedWidget(auth, key);
  const current = widgetConfig(row);
  const next = sanitizeWidgetConfig({
    appearance: patch.appearance === undefined ? current.appearance : deepMerge(current.appearance, patch.appearance),
    behavior: patch.behavior === undefined ? current.behavior : deepMerge(current.behavior, patch.behavior),
  });
  // Drafts may remain incomplete. Required fields are enforced only by validate/publish.
  const internalName = patch.internalName === undefined ? row.wgtInternalName : normalizeText(patch.internalName, 100);
  const targetOrigin = patch.destinationDomain === undefined ? row.wgtTargetOrigin : normalizeTargetOrigin(patch.destinationDomain);
  await atDB.widgets.updateDraft(row.wgtID, { internalName, targetOrigin, draftConfig: next });
  const updated = await atDB.widgets.getById(row.wgtID);
  if (!updated) throw new exHttpAccessDenied('ویجت یافت نشد');
  return widgetDTO(updated, true, auth.uid);
}

export async function deleteWidget(auth: IntfAuth, key: string) {
  const row = await getOwnedWidget(auth, key);
  await atDB.widgets.remove(row.wgtID);
  await atDB.user.deactivate(row.wgtRuntime_usrID);
  return { success: true };
}

export async function uploadWidgetFile(auth: IntfAuth, key: string, file: IntfFileMeta, response?: Response) {
  const row = await getOwnedWidget(auth, key);
  const runtime = await getRuntimeAuth(row);
  return uploadRagFile(RAG_SERVICE, runtime, file, response);
}

export async function deleteWidgetFile(auth: IntfAuth, key: string, fileKey: string) {
  const row = await getOwnedWidget(auth, key);
  const runtime = await getRuntimeAuth(row);
  return deleteRagFileByKey(RAG_SERVICE, runtime, fileKey);
}

export async function retryWidgetFile(auth: IntfAuth, key: string, fileKey: string) {
  await getOwnedWidget(auth, key);
  // Processing is synchronous in the current RAG pipeline. A retry requires uploading
  // the source file again; retaining this endpoint keeps the UI/API contract explicit.
  throw new exHttpPreconditionFailed(`پردازش مجدد فایل ${fileKey} بدون بارگذاری دوباره فایل اصلی ممکن نیست`);
}

export async function addOperator(auth: IntfAuth, key: string, usernameInput: unknown) {
  const row = await getOwnedWidget(auth, key);
  const username = normalizeText(usernameInput, 32).toLowerCase();
  if (!username || username.startsWith(WIDGET_USERNAME_PREFIX)) throw new exHttpInvalidParams('نام کاربری اپراتور معتبر نیست');
  const user = await atDB.user.findByUsername(username, true);
  if (!user) throw new exHttpInvalidParams('کاربری با این نام کاربری پیدا نشد؛ کاربر ابتدا باید نام کاربری خود را در پروفایل ثبت کند');
  if (Number(user.usrID) === row.wgtOwner_usrID) throw new exHttpInvalidParams('مالک ویجت از قبل امکان پاسخ‌گویی دارد');
  if (Number(user.usrID) === row.wgtRuntime_usrID) throw new exHttpInvalidParams('حساب اختصاصی ویجت نمی‌تواند اپراتور باشد');
  await atDB.widgetOperators.addOrEnable(row.wgtID, Number(user.usrID));
  return operatorDTOs(row, true);
}

export async function setOperatorActive(auth: IntfAuth, key: string, usernameInput: unknown, active: boolean) {
  const row = await getOwnedWidget(auth, key);
  const username = normalizeText(usernameInput, 32).toLowerCase();
  const user = await atDB.user.findByUsername(username, true);
  if (!user) throw new exHttpInvalidParams('اپراتور پیدا نشد');
  await atDB.widgetOperators.setActive(row.wgtID, Number(user.usrID), active);
  return operatorDTOs(row, true);
}

export async function validateWidget(auth: IntfAuth, key: string) {
  const row = await getOwnedWidget(auth, key);
  const config = widgetConfig(row);
  const [files, operators] = await Promise.all([fileDTOs(row), operatorDTOs(row)]);
  const checks = [
    {
      key: 'identity', label: 'نام و هویت ویجت',
      ok: Boolean(row.wgtInternalName && config.appearance.title),
      detail: row.wgtInternalName && config.appearance.title ? 'نام داخلی و عنوان نمایشی ثبت شده است.' : 'نام داخلی و عنوان نمایشی را تکمیل کنید.',
    },
    {
      key: 'domain', label: 'دامنه مقصد',
      ok: Boolean(row.wgtTargetOrigin),
      detail: row.wgtTargetOrigin ? `مبدأ ثبت‌شده: ${row.wgtTargetOrigin}` : 'دامنه‌ای که ویجت روی آن نصب می‌شود مشخص نشده است.',
    },
    {
      key: 'knowledge', label: 'منابع دانش',
      ok: files.some(file => file.status === 'ready'),
      detail: files.some(file => file.status === 'ready') ? `${files.filter(file => file.status === 'ready').length} فایل آماده پاسخ‌گویی است.` : 'حداقل یک فایل آماده لازم است.',
    },
    {
      key: 'prompt', label: 'دستور پاسخ‌گویی',
      ok: true,
      detail: config.behavior.customPrompt.trim()
        ? 'دستور تکمیلی شما همراه پرامپت پیش‌فرض ویجت اعمال می‌شود.'
        : 'پرامپت پیش‌فرض امن ویجت اعمال می‌شود؛ افزودن دستور تکمیلی اختیاری است.',
    },
    {
      key: 'handoff', label: 'مسیر پاسخ‌گویی انسانی',
      ok: true,
      detail: !config.behavior.humanHandoff.enabled
        ? 'ارجاع انسانی غیرفعال است.'
        : operators.some(op => op.active)
          ? `مالک ویجت و ${operators.filter(op => op.active).length} اپراتور فعال امکان پاسخ‌گویی دارند.`
          : 'مالک ویجت امکان پاسخ‌گویی دارد؛ برای واگذاری گفتگو می‌توانید اپراتور اضافه کنید.',
    },
  ];
  return { ok: checks.every(check => check.ok), checks };
}

export async function publishWidget(auth: IntfAuth, key: string) {
  const row = await getOwnedWidget(auth, key);
  const validation = await validateWidget(auth, key);
  if (!validation.ok) {
    const error = new exHttpPreconditionFailed('ویجت برای انتشار آماده نیست') as exHttpPreconditionFailed & { validation?: unknown };
    error.validation = validation;
    throw error;
  }
  const config = widgetConfig(row);
  await atDB.widgets.publish(row.wgtID, config, normalizeTargetOrigin(row.wgtTargetOrigin));
  const updated = await atDB.widgets.getById(row.wgtID);
  if (!updated) throw new exHttpAccessDenied('ویجت یافت نشد');
  return widgetDTO(updated, true, auth.uid);
}

export async function unpublishWidget(auth: IntfAuth, key: string) {
  const row = await getOwnedWidget(auth, key);
  await atDB.widgets.disable(row.wgtID);
  const updated = await atDB.widgets.getById(row.wgtID);
  if (!updated) throw new exHttpAccessDenied('ویجت یافت نشد');
  return widgetDTO(updated, true, auth.uid);
}

export function installCode(key: string) {
  return `<script src="${PUBLIC_BASE_URL}/js/widget.js" data-widget-id="${key}" async><\/script>`;
}

export async function publicWidgetConfig(key: string, previewAuth?: IntfAuth) {
  const row = previewAuth ? await getOwnedWidget(previewAuth, key) : await atDB.widgets.getPublishedByKey(key);
  if (!row) throw new exHttpAccessDenied('ویجت منتشرشده‌ای با این شناسه وجود ندارد');
  const config = widgetConfig(row, !previewAuth);
  return {
    id: row.wgtKey,
    destinationDomain: previewAuth ? row.wgtTargetOrigin : (row.wgtPublishedOrigin || row.wgtTargetOrigin),
    enabled: previewAuth ? true : Boolean(row.wgtPublishedConfig) && [enuWidgetStatus.published, enuWidgetStatus.changed].includes(row.wgtStatus),
    appearance: effectiveAppearance(config.appearance),
    behavior: {
      showReferences: config.behavior.showReferences,
      humanHandoff: { collectContact: config.behavior.humanHandoff.collectContact },
    },
    publishedVersion: previewAuth ? row.wgtDraftVersion : row.wgtPublishedVersion,
    publishedAt: row.wgtPublishedAt,
  };
}

function publishedOrigin(row: IntfWidgetRow): string {
  return String(row.wgtPublishedOrigin || row.wgtTargetOrigin || '').toLowerCase();
}

function originFromRequest(req: Request): string {
  return String(req.headers.origin || '').trim().toLowerCase();
}

export async function publicWidgetCors(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api/widget/public/')) return next();
  const match = req.path.match(/^\/api\/widget\/public\/([a-f0-9]{32})(?:\/|$)/i);
  if (!match?.[1]) return res.status(404).json({ error: { status: 404, message: 'ویجت پیدا نشد' } });
  const row = await atDB.widgets.getPublishedByKey(match[1]);
  const requestOrigin = originFromRequest(req);
  if (!row || !requestOrigin || requestOrigin !== publishedOrigin(row)) {
    return res.status(403).json({ error: { status: 403, message: 'این ویجت برای مبدأ درخواست‌شده فعال نیست' } });
  }
  res.setHeader('Access-Control-Allow-Origin', requestOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
}

export async function ensurePublicOrigin(row: IntfWidgetRow, req: Request) {
  const origin = originFromRequest(req);
  if (!origin || origin !== publishedOrigin(row)) throw new exHttpAccessDenied('این ویجت برای مبدأ درخواست‌شده فعال نیست');
  return origin;
}

export async function createWidgetSession(row: IntfWidgetRow, mode: 'Public' | 'Preview', origin: string | null) {
  const runtime = await getRuntimeAuth(row);
  await atDB.perUserStats.initialize(RAG_SERVICE, runtime.uid);
  const chatKey = md5(randomUUID());
  const chatID = await atDB.chats.new(RAG_SERVICE, runtime.uid, chatKey);
  if (!chatID) throw new Error('امکان ایجاد گفتگوی ویجت وجود ندارد');
  const sessionKey = md5(randomUUID());
  await atDB.widgetSessions.add({ key: sessionKey, widgetID: row.wgtID, chatID, mode, origin });
  return { sessionKey };
}

async function resolveSession(row: IntfWidgetRow, sessionKey: string): Promise<IntfWidgetSessionRow> {
  if (!/^[a-f0-9]{32}$/i.test(sessionKey)) throw new exHttpInvalidParams('شناسه نشست معتبر نیست');
  const session = await atDB.widgetSessions.getByKey(row.wgtID, sessionKey);
  if (!session) throw new exHttpAccessDenied('نشست ویجت یافت نشد');
  return session;
}

function normalizeMatchText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[،,؛;:.!?؟()\[\]{}"'«»]/g, ' ')
    .replace(/[\u200c\s_-]+/g, ' ')
    .trim();
}

function findConfiguredPhrase(question: string, phrases: string[]): string | undefined {
  const normalized = normalizeMatchText(question);
  return phrases.find(item => {
    const phrase = normalizeMatchText(item);
    return phrase.length > 1 && normalized.includes(phrase);
  });
}

function topContextSimilarity(context: IntfRagBeforeGenerateContext): number {
  const scores = context.userContext.chunks
    .map(chunk => Number(chunk._score || 0))
    .filter(score => Number.isFinite(score));
  if (!scores.length) return 0;
  return Math.max(0, Math.min(100, Math.max(...scores) * 100));
}

function humanAvailable(config: WidgetConfig, at = new Date()): boolean {
  const schedule = config.behavior.humanHandoff.schedule;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: schedule.timezone,
      weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(at);
  } catch {
    parts = new Intl.DateTimeFormat('en-US', {
      weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(at);
  }
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const row = schedule.days[String(values.weekday || '').toLowerCase()];
  if (!row?.enabled) return false;
  const current = `${String(values.hour || '00').padStart(2, '0')}:${String(values.minute || '00').padStart(2, '0')}`;
  if (row.start <= row.end) return current >= row.start && current <= row.end;
  // Also support shifts that cross midnight, for example 22:00–06:00.
  return current >= row.start || current <= row.end;
}

function explicitHumanRequest(question: string): boolean {
  const normalized = normalizeMatchText(question);
  if (!normalized) return false;

  const directPhrases = [
    'وصل کن به اپراتور', 'به اپراتور وصل', 'صحبت با اپراتور', 'حرف با اپراتور',
    'وصل کن به پشتیبان', 'به پشتیبان وصل', 'صحبت با پشتیبان', 'حرف با پشتیبان',
    'پشتیبان انسانی', 'اپراتور انسانی', 'کارشناس انسانی', 'آدم واقعی', 'انسان واقعی',
    'یک نفر واقعی', 'با یک نفر صحبت', 'با یک نفر حرف', 'آدمیزاد',
    'ربات نمی خوام', 'ربات نمیخوام', 'هوش مصنوعی نمی خوام', 'هوش مصنوعی نمیخوام',
  ];
  if (directPhrases.some(phrase => normalized.includes(normalizeMatchText(phrase)))) return true;

  const humanTerms = ['اپراتور', 'پشتیبان', 'کارشناس', 'مسئول', 'انسان', 'آدم', 'آدمیزاد', 'یک نفر'];
  const requestTerms = ['وصل', 'متصل', 'صحبت', 'حرف', 'گفتگو', 'گفت و گو', 'چت', 'ارتباط', 'تماس'];
  return humanTerms.some(term => normalized.includes(term))
    && requestTerms.some(term => normalized.includes(term));
}

type HandoffTrigger = { handoff: boolean; reason: string; topic: string; forced: boolean };

function handoffTrigger(config: WidgetConfig, question: string, similarity: number, hasContext: boolean): HandoffTrigger {
  const handoff = config.behavior.humanHandoff;
  if (!handoff.enabled) return { handoff: false, reason: '', topic: 'other', forced: false };
  if (explicitHumanRequest(question)) return { handoff: true, reason: 'درخواست صریح بازدیدکننده برای گفتگو با انسان', topic: 'human-request', forced: true };
  const keyword = findConfiguredPhrase(question, handoff.keywords);
  if (keyword) return { handoff: true, reason: `عبارت ارجاع اجباری: ${keyword}`, topic: keyword.slice(0, 32), forced: true };
  const topic = findConfiguredPhrase(question, handoff.topics);
  if (topic) return { handoff: true, reason: `موضوع ارجاع انسانی: ${topic}`, topic: topic.slice(0, 32), forced: true };
  if (handoff.similarityEnabled && similarity < handoff.similarityThreshold)
    return { handoff: true, reason: 'امتیاز تطابق اسناد پایین‌تر از آستانه تنظیم‌شده است', topic: 'low-similarity', forced: false };
  if (!hasContext && config.behavior.answerMode === 'files-only')
    return { handoff: true, reason: 'پاسخ در اسناد اختصاصی پیدا نشد', topic: 'no-context', forced: false };
  return { handoff: false, reason: '', topic: 'other', forced: false };
}

function widgetSystemPrompt(config: WidgetConfig): string {
  const tone = {
    formal: 'رسمی، روشن و محترمانه',
    friendly: 'دوستانه، طبیعی و محترمانه',
    sales: 'حرفه‌ای و کمک‌کننده با تمرکز بر تشخیص نیاز، بدون ادعای قیمت یا تعهد قطعی',
    support: 'فنی، مرحله‌به‌مرحله و محتاطانه',
  }[config.behavior.tone];
  const length = {
    short: 'پاسخ را کوتاه و حداکثر در سه بند ارائه کن.',
    balanced: 'پاسخ را متناسب با سؤال و بدون زیاده‌گویی ارائه کن.',
    detailed: 'در صورت نیاز پاسخ را با جزئیات و ساختار روشن ارائه کن.',
  }[config.behavior.responseLength];
  const knowledgeRule = config.behavior.answerMode === 'files-only'
    ? 'فقط بر اساس اسناد اختصاصی ویجت پاسخ بده؛ از دانش عمومی برای افزودن واقعیت جدید استفاده نکن.'
    : 'اسناد اختصاصی ویجت منبع اصلی هستند؛ فقط برای توضیح عمومی و غیرقطعی می‌توانی از دانش عمومی استفاده کنی.';
  const handoffRules: string[] = [];
  if (config.behavior.humanHandoff.topics.length)
    handoffRules.push(`موضوعات ارجاع انسانی که نباید درباره آن‌ها تعهد یا پاسخ قطعی بدهی: ${config.behavior.humanHandoff.topics.join('، ')}`);
  if (config.behavior.humanHandoff.keywords.length)
    handoffRules.push(`عبارت‌های ارجاع اجباری: ${config.behavior.humanHandoff.keywords.join('، ')}`);
  const custom = config.behavior.customPrompt.trim()
    ? `\nدستور تکمیلی مالک ویجت، تا جایی که با قواعد ایمنی بالا تعارض ندارد:\n${config.behavior.customPrompt.trim()}`
    : '';
  return `${DEFAULT_WIDGET_SYSTEM_PROMPT}
- لحن پاسخ: ${tone}.
- ${length}
- ${knowledgeRule}${handoffRules.length ? `\n- ${handoffRules.join('\n- ')}` : ''}${custom}`;
}

function streamImmediate(res: Response, requestID: string, answer: string, meta: Record<string, unknown>) {
  sendStreamHeadersIfNeeded(res);
  res.write(`data: ${JSON.stringify({ delta: answer })}\n\n`);
  res.write(`data: [WIDGET]:${JSON.stringify(meta)}\n\n`);
  res.write('data: [REF]:[]\n\n');
  res.write(`data: [DONE:${requestID}]\n\n`);
  res.end();
}

async function saveImmediateDialogue(row: IntfWidgetRow, session: IntfWidgetSessionRow, requestID: string, question: string, answer: string) {
  const runtime = await getRuntimeAuth(row);
  const chat = await atDB.chats.get(RAG_SERVICE, runtime.uid, session.wssChat_chtID);
  if (!chat) throw new exHttpAccessDenied('گفتگوی ویجت در دسترس نیست');
  await atDB.messages.addDialogue(chat, requestID, question, answer, enuMsgStatus.Finished);
}

export async function sendWidgetMessage(
  row: IntfWidgetRow,
  sessionKey: string,
  questionInput: unknown,
  response: Response,
  preview = false,
) {
  const session = await resolveSession(row, sessionKey);
  if ((preview && session.wssMode !== 'Preview') || (!preview && session.wssMode !== 'Public'))
    throw new exHttpAccessDenied('نوع نشست با درخواست سازگار نیست');
  const runtime = await getRuntimeAuth(row);
  const question = String(questionInput || '').trim();
  if (!question) throw new exHttpInvalidParams('پرسش خالی است');
  const maxQuestionLength = Math.min(4000, runtime.privs?.services?.[RAG_SERVICE]?.messages?.maxChars || 4000);
  if (question.length > maxQuestionLength)
    throw new exHttpInvalidParams(`پرسش نباید بیش از ${maxQuestionLength} کاراکتر باشد`);
  const requestID = md5(randomUUID());
  const config = widgetConfig(row, !preview);

  if (['Pending', 'Queued', 'Assigned'].includes(session.wssStatus)) {
    const answer = session.wssStatus === 'Queued'
      ? 'پیام شما ذخیره شد و در نخستین زمان پاسخ‌گویی توسط پشتیبان انسانی بررسی می‌شود.'
      : 'پیام شما به گفتگوی در حال بررسی افزوده شد و پشتیبان انسانی آن را مشاهده خواهد کرد.';
    await saveImmediateDialogue(row, session, requestID, question, answer);
    streamImmediate(response, requestID, answer, {
      mode: 'handoff', conversationId: session.wssKey, category: session.wssCategory || 'unknown',
      similarityScore: Number(session.wssConfidence || 0), confidence: Number(session.wssConfidence || 0), reason: session.wssHandoffReason || '',
      available: session.wssStatus !== 'Queued', collectContact: config.behavior.humanHandoff.collectContact,
    });
    return;
  }

  const chat = await atDB.chats.get(RAG_SERVICE, runtime.uid, session.wssChat_chtID);
  if (!chat) throw new exHttpAccessDenied('گفتگوی ویجت در دسترس نیست');

  await runRagChat({
    apiRes: response,
    auth: runtime,
    service: RAG_SERVICE,
    logName: preview ? 'widget-preview' : 'widget-public',
    chatId: String(chat.chtKey || ''),
    requestId: requestID,
    useFiles: true,
    question,
    systemPromptPrefix: widgetSystemPrompt(config),
    userPromptPrefix: 'پرسش بازدیدکننده: ',
    summarizeSystemPrompt: 'گفتگو را برای ادامه پاسخ‌گویی خلاصه کن.',
    summarizePrompt: '__WIDGET_SUMMARY__',
    useGeneralKnowledge: config.behavior.answerMode === 'files-and-general',
    useNews: false,
    showReferences: config.behavior.showReferences,
    referenceText: false,
    userContextMinSimilarity: 0.2,
    onBeforeGenerate: async context => {
      const similarityScore = Math.round(topContextSimilarity(context));
      const hasContext = context.userContext.chunks.length > 0;
      const trigger = handoffTrigger(config, question, similarityScore, hasContext);
      const topic = trigger.topic || 'other';
      if (!trigger.handoff) {
        await atDB.widgetSessions.updateAnalysis(session.wssID, topic, similarityScore, 'Bot');
        return false;
      }

      const available = humanAvailable(config);
      if (!trigger.forced && !available && config.behavior.humanHandoff.outsideHoursBehavior === 'bot-only' && hasContext) {
        await atDB.widgetSessions.updateAnalysis(session.wssID, topic, similarityScore, 'Bot');
        return false;
      }

      const fallback = config.behavior.fallbackMessage || DEFAULT_WIDGET_FALLBACK;
      if (!trigger.forced && !config.behavior.humanHandoff.saveUnanswered) {
        await saveImmediateDialogue(row, session, requestID, question, fallback);
        streamImmediate(response, requestID, fallback, {
          mode: 'fallback', topic, category: topic, similarityScore, confidence: similarityScore,
          reason: trigger.reason, available: false, collectContact: config.behavior.humanHandoff.collectContact,
        });
        return true;
      }

      const status = available ? 'Pending' : 'Queued';
      await atDB.widgetSessions.handoff(session.wssID, { status, category: topic, confidence: similarityScore, reason: trigger.reason });
      const answer = available
        ? `${fallback}\n\nپرسش شما به صف پاسخ‌گویی انسانی منتقل شد.${config.behavior.humanHandoff.collectContact ? ' برای پیگیری بهتر می‌توانید نام و راه ارتباطی خود را ثبت کنید.' : ''}`
        : `در حال حاضر اپراتورها خارج از ساعت پاسخ‌گویی هستند. پرسش شما ذخیره شد و در نخستین زمان کاری بررسی می‌شود.${config.behavior.humanHandoff.collectContact ? ' برای پیگیری بهتر می‌توانید نام و راه ارتباطی خود را ثبت کنید.' : ''}`;
      await saveImmediateDialogue(row, session, requestID, question, answer);
      streamImmediate(response, requestID, answer, {
        mode: 'handoff', conversationId: session.wssKey, topic, category: topic,
        similarityScore, confidence: similarityScore, reason: trigger.reason, available, collectContact: config.behavior.humanHandoff.collectContact,
      });
      return true;
    },
    onDone: async ({ context }) => {
      const similarityScore = Math.round(topContextSimilarity(context));
      await atDB.widgetSessions.updateAnalysis(session.wssID, 'other', similarityScore, 'Bot');
      sendStreamHeadersIfNeeded(response);
      response.write(`data: [WIDGET]:${JSON.stringify({
        mode: 'ai', topic: 'other', category: 'other', similarityScore, confidence: similarityScore, conversationId: session.wssKey,
      })}\n\n`);
    },
  });
}


export async function updateSessionVisitor(row: IntfWidgetRow, sessionKey: string, visitor: Record<string, unknown>) {
  const session = await resolveSession(row, sessionKey);
  const name = visitor.name === undefined ? undefined : normalizeText(visitor.name, 100);
  const contact = visitor.contact === undefined ? undefined : normalizeText(visitor.contact, 150);
  if (!contact || contact.length < 3)
    throw new exHttpInvalidParams('شماره تماس یا ایمیل معتبر را وارد کنید');
  await atDB.widgetSessions.updateVisitor(session.wssID, name, contact);
  return { success: true };
}

async function humanReplyMap(sessionID: number) {
  const rows = await atDB.widgetHumanReplies.listBySession(sessionID);
  return new Map(rows.map(row => [Number(row.msgID), row]));
}

export async function sessionHistory(row: IntfWidgetRow, sessionKey: string, after = 0) {
  const session = await resolveSession(row, sessionKey);
  const runtime = await getRuntimeAuth(row);
  const history = await atDB.messages.listByChatID(RAG_SERVICE, runtime.uid, session.wssChat_chtID, 1000, 0, true);
  const human = await humanReplyMap(session.wssID);
  const messages = history.messages
    .filter(message => Number(message.msgID || 0) > after)
    .map(message => {
      const humanInfo = human.get(Number(message.msgID));
      return {
        id: Number(message.msgID),
        sender: message.msgRole === enuRoles.user ? 'visitor' : humanInfo ? 'operator' : 'ai',
        operatorUsername: humanInfo?.usrUsername || undefined,
        operatorName: humanInfo?.usrName || undefined,
        text: message.msgContent,
        createdAt: message.msgCreatedAt,
      };
    });
  const assigned = await assignedIdentity(session.wssAssigned_usrID);
  return {
    session: {
      id: session.wssKey,
      status: session.wssStatus.toLowerCase(),
      visitorName: session.wssVisitorName || '',
      visitorContact: session.wssVisitorContact || '',
      category: session.wssCategory || 'unknown',
      similarityScore: Number(session.wssConfidence || 0),
      confidence: Number(session.wssConfidence || 0),
      assignedTo: assigned.username || (assigned.id ? `user-${assigned.id}` : ''),
      assignedToDisplay: assigned.displayName,
    },
    messages,
  };
}

async function assignedIdentity(userID: number | null) {
  return userIdentity(userID);
}

export async function listConversations(auth: IntfAuth, filters: { widgetId?: string; status?: string; operator?: string; mode?: string } = {}) {
  const accessible = await atDB.widgets.listAccessible(auth.uid);
  const rows = filters.widgetId ? accessible.filter(row => row.wgtKey === filters.widgetId) : accessible;
  if (filters.widgetId && !rows.length) throw new exHttpAccessDenied('به ویجت انتخاب‌شده دسترسی ندارید');
  const requestedMode = String(filters.mode || 'public').toLowerCase();
  const sessionMode = requestedMode === 'preview' ? 'Preview' : requestedMode === 'all' ? undefined : 'Public';
  const sessions = (await atDB.widgetSessions.list(rows.map(row => row.wgtID), {
    status: filters.status && filters.status !== 'all' ? statusToDB(filters.status) : undefined,
    mode: sessionMode,
    limit: 500,
  })).filter(session => session.wssStatus !== 'Bot' && Boolean(session.wssHandoffAt));
  const rowByID = new Map(rows.map(row => [row.wgtID, row]));
  const result: Array<Record<string, unknown>> = [];
  for (const session of sessions) {
    const row = rowByID.get(session.wssWidget_wgtID);
    if (!row) continue;
    const assigned = await assignedIdentity(session.wssAssigned_usrID);
    if (filters.operator && assigned.username !== filters.operator) continue;
    const history = await sessionHistory(row, session.wssKey);
    result.push({
      id: session.wssKey,
      widgetId: row.wgtKey,
      widgetName: row.wgtInternalName,
      widgetUsername: await runtimeUsername(row.wgtRuntime_usrID),
      ownerUsername: (await userIdentity(row.wgtOwner_usrID)).username,
      canManage: row.wgtOwner_usrID === auth.uid,
      sessionId: session.wssKey,
      visitorName: session.wssVisitorName || '',
      visitorContact: session.wssVisitorContact || '',
      status: session.wssStatus.toLowerCase(),
      mode: session.wssMode.toLowerCase(),
      category: session.wssCategory || 'unknown',
      assignedTo: assigned.username || (assigned.id ? `user-${assigned.id}` : ''),
      assignedToDisplay: assigned.displayName,
      createdAt: session.wssCreatedAt,
      updatedAt: session.wssUpdatedAt,
      resolvedAt: session.wssResolvedAt,
      escalatedReason: session.wssHandoffReason || '',
      similarityScore: Number(session.wssConfidence || 0),
      confidence: Number(session.wssConfidence || 0),
      messages: history.messages,
      operators: await operatorDTOs(row),
    });
  }
  return result;
}

function statusToDB(status: string) {
  const map: Record<string, string> = { bot: 'Bot', pending: 'Pending', queued: 'Queued', assigned: 'Assigned', resolved: 'Resolved' };
  return map[status.toLowerCase()] || status;
}

async function requireResponder(auth: IntfAuth, row: IntfWidgetRow) {
  if (row.wgtOwner_usrID === auth.uid) return;
  const operator = await atDB.widgetOperators.get(row.wgtID, auth.uid);
  if (!operator || operator.wopStatus !== 'Active') throw new exHttpAccessDenied('اجازه پاسخ‌گویی به این گفتگو را ندارید');
}

export async function assignConversation(auth: IntfAuth, widgetKey: string, sessionKey: string, operatorUsernameInput?: unknown) {
  const row = await getAccessibleWidget(auth, widgetKey);
  await requireResponder(auth, row);
  const session = await resolveSession(row, sessionKey);
  if (session.wssStatus === 'Resolved') throw new exHttpPreconditionFailed('گفتگوی بسته‌شده قابل واگذاری نیست');
  let operatorUserID = auth.uid;
  if (operatorUsernameInput && row.wgtOwner_usrID === auth.uid) {
    const operatorUser = await atDB.user.findByUsername(normalizeText(operatorUsernameInput, 32).toLowerCase(), true);
    if (!operatorUser) throw new exHttpInvalidParams('اپراتور پیدا نشد');
    const membership = await atDB.widgetOperators.get(row.wgtID, Number(operatorUser.usrID));
    if (!membership || membership.wopStatus !== 'Active') throw new exHttpInvalidParams('کاربر اپراتور فعال این ویجت نیست');
    operatorUserID = Number(operatorUser.usrID);
  } else if (row.wgtOwner_usrID !== auth.uid) {
    operatorUserID = auth.uid;
  }
  await atDB.widgetSessions.assign(session.wssID, operatorUserID);
  const assigned = await assignedIdentity(operatorUserID);
  return {
    success: true,
    assignedTo: assigned.username || `user-${assigned.id}`,
    assignedToDisplay: assigned.displayName,
  };
}

export async function sendHumanReply(auth: IntfAuth, widgetKey: string, sessionKey: string, textInput: unknown) {
  const row = await getAccessibleWidget(auth, widgetKey);
  await requireResponder(auth, row);
  const session = await resolveSession(row, sessionKey);
  if (session.wssStatus === 'Resolved') throw new exHttpPreconditionFailed('گفتگو بسته شده است؛ برای ادامه، بازدیدکننده باید پیام جدیدی ارسال کند');
  const text = normalizeText(textInput, 4000);
  if (!text) throw new exHttpInvalidParams('متن پاسخ خالی است');
  const requestID = md5(randomUUID());
  const messageID = await atDB.messages.addMessage(session.wssChat_chtID, requestID, enuRoles.assistant, text);
  await atDB.widgetHumanReplies.add(session.wssID, auth.uid, messageID);
  await atDB.widgetSessions.markHumanReply(session.wssID, auth.uid);
  return { success: true, messageId: messageID };
}

export async function resolveConversation(auth: IntfAuth, widgetKey: string, sessionKey: string) {
  const row = await getAccessibleWidget(auth, widgetKey);
  await requireResponder(auth, row);
  const session = await resolveSession(row, sessionKey);
  await atDB.widgetSessions.resolve(session.wssID);
  return { success: true };
}

function dateKey(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

export async function widgetAnalytics(auth: IntfAuth, widgetKey = 'all') {
  // Usage and operator-performance analytics are management data. Operators can
  // access the human-response inbox, but only widget owners can read these reports.
  const owned = await atDB.widgets.listOwned(auth.uid);
  const widgets = widgetKey === 'all' ? owned : owned.filter(row => row.wgtKey === widgetKey);
  if (widgetKey !== 'all' && !widgets.length) throw new exHttpAccessDenied('به ویجت انتخاب‌شده دسترسی ندارید');
  const ids = widgets.map(row => row.wgtID);
  const db = await getDB();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const dailyMap = new Map<string, { date: string; sessions: number; messages: number; aiAnswers: number; humanEscalations: number }>();
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(); date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    dailyMap.set(key, { date: key, sessions: 0, messages: 0, aiAnswers: 0, humanEscalations: 0 });
  }
  if (!ids.length) return { totals: { sessions: 0, messages: 0, aiAnswers: 0, humanEscalations: 0, pending: 0, assigned: 0, resolved: 0, files: 0, operators: 0 }, daily: [...dailyMap.values()], operators: [], widgets: [] };

  const sessions = await db('tblWidgetSessions').select('*').whereIn('wssWidget_wgtID', ids).andWhere('wssMode', 'Public');
  const recentSessions = sessions.filter(row => new Date(row.wssCreatedAt) >= since);
  for (const session of recentSessions) {
    const day = dailyMap.get(dateKey(session.wssCreatedAt));
    if (day) {
      day.sessions += 1;
      if (session.wssHandoffAt) day.humanEscalations += 1;
    }
  }

  const sessionIDs = sessions.map(row => Number(row.wssID));
  const chatIDs = sessions.map(row => Number(row.wssChat_chtID));
  const humanRows = sessionIDs.length
    ? await db('tblWidgetHumanReplies').select('*').whereIn('whrSession_wssID', sessionIDs)
    : [];
  const humanMessageIDs = new Set(humanRows.map(row => Number(row.whrMessage_msgID)));
  const messages = chatIDs.length
    ? await db('tblMessages').select('*').whereIn('msgRelated_chtID', chatIDs).andWhere('msgCreatedAt', '>=', since).andWhere('msgStatus', 'Finished')
    : [];
  const sessionByChat = new Map(sessions.map(row => [Number(row.wssChat_chtID), row]));
  let userMessages = 0;
  let aiAnswers = 0;
  for (const message of messages) {
    const session = sessionByChat.get(Number(message.msgRelated_chtID));
    if (!session) continue;
    const day = dailyMap.get(dateKey(message.msgCreatedAt));
    if (message.msgRole === 'user') {
      userMessages += 1;
      if (day) day.messages += 1;
    } else if (!humanMessageIDs.has(Number(message.msgID))) {
      aiAnswers += 1;
      if (day) day.aiAnswers += 1;
    }
  }

  const pending = sessions.filter(row => ['Pending', 'Queued'].includes(row.wssStatus)).length;
  const assigned = sessions.filter(row => row.wssStatus === 'Assigned').length;
  const resolved = sessions.filter(row => row.wssStatus === 'Resolved').length;
  const filesByWidget = new Map<number, number>();
  const operatorsByWidget = new Map<number, number>();
  for (const row of widgets) {
    filesByWidget.set(row.wgtID, (await fileDTOs(row)).filter(file => file.status === 'ready').length);
    operatorsByWidget.set(row.wgtID, (await operatorDTOs(row)).filter(op => op.active).length);
  }

  const operatorRows: Array<Record<string, unknown>> = [];
  for (const row of widgets) {
    const widgetSessions = sessions.filter(session => Number(session.wssWidget_wgtID) === row.wgtID);
    const widgetSessionIDs = new Set(widgetSessions.map(session => Number(session.wssID)));
    const memberships = await atDB.widgetOperators.list(row.wgtID, true);
    const membershipByUser = new Map(memberships.map(item => [Number(item.wopOperator_usrID), item]));
    const responderIDs = new Set<number>([row.wgtOwner_usrID]);
    memberships.forEach(item => responderIDs.add(Number(item.wopOperator_usrID)));
    widgetSessions.forEach(session => { if (session.wssAssigned_usrID) responderIDs.add(Number(session.wssAssigned_usrID)); });
    humanRows.forEach(reply => { if (widgetSessionIDs.has(Number(reply.whrSession_wssID))) responderIDs.add(Number(reply.whrOperator_usrID)); });

    for (const userID of responderIDs) {
      const membership = membershipByUser.get(userID);
      const user = await atDB.user.getByID(userID, true);
      if (!user) continue;
      const assignedSessions = widgetSessions.filter(session => Number(session.wssAssigned_usrID) === userID);
      const operatorReplies = humanRows.filter(reply => Number(reply.whrOperator_usrID) === userID && widgetSessionIDs.has(Number(reply.whrSession_wssID)));
      const replies = operatorReplies.length;
      const firstReplyBySession = new Map<number, Date>();
      for (const reply of operatorReplies) {
        const sessionID = Number(reply.whrSession_wssID);
        const createdAt = new Date(reply.whrCreatedAt);
        const current = firstReplyBySession.get(sessionID);
        if (!current || createdAt < current) firstReplyBySession.set(sessionID, createdAt);
      }
      const sessionByID = new Map<number, IntfWidgetSessionRow>(widgetSessions.map(session => [Number(session.wssID), session as IntfWidgetSessionRow]));
      const responseTimes = [...firstReplyBySession.entries()]
        .map(([sessionID, replyAt]) => {
          const handoffAt = sessionByID.get(sessionID)?.wssHandoffAt;
          return handoffAt ? (replyAt.getTime() - new Date(handoffAt).getTime()) / 60000 : -1;
        })
        .filter(value => value >= 0);
      operatorRows.push({
        widgetId: row.wgtKey,
        widgetName: row.wgtInternalName,
        username: user.usrUsername || `user-${userID}`,
        displayName: user.usrName || user.usrUsername || `کاربر ${userID}`,
        active: userID === row.wgtOwner_usrID || membership?.wopStatus === 'Active',
        role: userID === row.wgtOwner_usrID ? 'Owner' : membership?.wopRole || 'Operator',
        assigned: assignedSessions.length,
        replies,
        resolved: assignedSessions.filter(session => session.wssStatus === 'Resolved').length,
        pending: assignedSessions.filter(session => session.wssStatus !== 'Resolved').length,
        avgResponseMinutes: responseTimes.length ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
      });
    }
  }

  return {
    totals: {
      sessions: recentSessions.length,
      messages: userMessages,
      aiAnswers,
      humanEscalations: recentSessions.filter(row => row.wssHandoffAt).length,
      pending,
      assigned,
      resolved,
      files: [...filesByWidget.values()].reduce((a, b) => a + b, 0),
      operators: [...operatorsByWidget.values()].reduce((a, b) => a + b, 0),
    },
    daily: [...dailyMap.values()],
    operators: operatorRows,
    widgets: await Promise.all(widgets.map(async row => ({ id: row.wgtKey, name: row.wgtInternalName, summary: await summaryForWidget(row) }))),
  };
}

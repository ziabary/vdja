import express from "express";
import type { Request, Response, Router } from "express";
import multer from "multer";
import * as os from "os";
import * as path from "path";
import * as fs from "fs/promises";

import { getAuthInfo } from "../services/authService";
import { generate } from "../services/chatService";
import { extractFromPDF } from "../utils/fileProcessors/pdf";
import { extractFromPDF as simpleExtractFromPDF } from "../utils/fileProcessors/pdf-simple";
import { extractFromDoc } from "../utils/fileProcessors/doc";
import configManager from "../utils/configManager";
import logger from "../utils/logger";
import { exHttpInvalidParams } from "../interfaces/exHttp";
import { enuLLMServices } from "../interfaces/config";
import type { IntfFileMeta } from "../interfaces/file";

const router: Router = express.Router();
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 200 * 1024 * 1024 } });
const MAX_FAQS = 100;
const BATCH_SIZE = 10;
const MAX_ANSWER_WORDS = 250;
const MAX_SOURCE_CHARS = 2_000_000;
// Persian text can approach one token per 2–3 characters on the active model.
// Keeping each source part below this value leaves room for prompts, history and output.
const MAX_BATCH_SOURCE_CHARS = 12_000;

type FaqItem = { question: string; answer: string; section?: string };

function integer(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

async function extract(file: IntfFileMeta): Promise<{ text: string; pageCount: number }> {
  const ext = path.extname(file.originalname).toLowerCase();
  if ([".txt", ".md"].includes(ext)) {
    const text = await fs.readFile(file.path, "utf8");
    return { text, pageCount: 1 };
  }
  const result = ext === ".pdf"
    ? await (configManager.active().app.legacyPDFParser ? simpleExtractFromPDF : extractFromPDF)(file, 0, undefined, Infinity)
    : [".doc", ".docx", ".odt"].includes(ext)
      ? await extractFromDoc(file, 0, undefined, Infinity)
      : undefined;
  if (!result) throw new exHttpInvalidParams("فرمت فایل پشتیبانی نمی‌شود");
  return { text: result.text, pageCount: result.meta.pageCount };
}

function selectScope(text: string, pageCount: number, scope: string, from: number, to: number, focus: string): string {
  if (scope === "range") {
    const pages = text.split(/<!--\s*PAGE\s+\d+\s*-->/i).filter(Boolean);
    if (pages.length > 1) return pages.slice(Math.max(0, from - 1), to).join("\n\n");
    const start = Math.floor(text.length * Math.max(0, from - 1) / Math.max(1, pageCount));
    const end = Math.floor(text.length * Math.min(pageCount, to) / Math.max(1, pageCount));
    return text.slice(start, end);
  }
  if (scope === "focus" && focus.trim()) {
    const terms = focus.split(/[،,]/).map(v => v.trim().toLowerCase()).filter(Boolean);
    const paragraphs = text.split(/\n\s*\n/);
    const selected = paragraphs.filter(p => terms.some(t => p.toLowerCase().includes(t)));
    if (selected.length) return selected.join("\n\n");
  }
  return text;
} 

function batchSource(text: string, batchIndex: number, batchCount: number): string {
  const start = Math.floor(text.length * batchIndex / batchCount);
  const end = Math.floor(text.length * (batchIndex + 1) / batchCount);
  const slice = text.slice(start, end);
  if (slice.length <= MAX_BATCH_SOURCE_CHARS) return slice;
  const pieces = 5;
  const pieceSize = Math.floor(MAX_BATCH_SOURCE_CHARS / pieces);
  return Array.from({ length: pieces }, (_, i) => {
    const at = Math.floor(slice.length * i / pieces);
    return slice.slice(at, at + pieceSize);
  }).join("\n\n[… ادامه بخش …]\n\n");
}

function normalizeUploadName(name: string): string {
  if (!/[ÃØÙ]/.test(name)) return name;
  try { return Buffer.from(name, "latin1").toString("utf8"); }
  catch { return name; }
}

function faqErrorMessage(error: unknown): string {
  const message = (error as Error)?.message || "خطا در تولید FAQ";
  if (message.includes("maximum context length") || message.includes("input tokens"))
    return "حجم یکی از بخش‌های سند برای مدل زبانی بیش از حد مجاز بود. سند به بخش‌های کوچک‌تر تقسیم شد؛ لطفاً دوباره تلاش کنید.";
  if (message.includes("JSON"))
    return "مدل پاسخ را در قالب معتبر برنگرداند. لطفاً دوباره تلاش کنید.";
  return message;
}

function parseItems(raw: string): FaqItem[] {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) throw new Error("پاسخ مدل ساختار JSON معتبر ندارد");
  const value = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(value)) throw new Error("پاسخ مدل آرایه نیست");
  return value.filter(item => item && typeof item.question === "string" && typeof item.answer === "string")
    .map(item => ({ question: item.question.trim(), answer: item.answer.trim(), section: String(item.section || "").trim() || undefined }));
}

function sendEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function removeUploadedFile(file: IntfFileMeta): Promise<void> {
  try { await fs.unlink(file.path); } catch { /* already removed/renamed */ }
  for (const ext of [".doc", ".docx", ".odt"]) {
    try { await fs.unlink(file.path + ext); } catch { /* not a converted document */ }
  }
}

router.post("/faq/inspect", upload.single("file"), async (req: Request, res: Response) => {
  await getAuthInfo(req, false);
  const file = req.file as IntfFileMeta | undefined;
  if (!file) throw new exHttpInvalidParams("فایلی انتخاب نشده است");
  file.originalname = normalizeUploadName(file.originalname);
  
  try {
    const extracted = await extract(file);
    if (!extracted.text.trim()) throw new exHttpInvalidParams("متنی از فایل استخراج نشد");
    if (extracted.text.length > MAX_SOURCE_CHARS) throw new exHttpInvalidParams("متن استخراج‌شده بیش از سقف دو میلیون کاراکتر است");
    res.json({ fileName: file.originalname, pageCount: extracted.pageCount, sourceChars: extracted.text.length });
  } finally {
    await removeUploadedFile(file);
  }
});


router.post("/faq", upload.single("file"), async (req: Request, res: Response) => {
  await getAuthInfo(req, false);
  const file = req.file as IntfFileMeta | undefined;
  if (!file) throw new exHttpInvalidParams("فایلی انتخاب نشده است");
  file.originalname = normalizeUploadName(file.originalname);

  let count = integer(req.body.count, 10, 1, MAX_FAQS);
  const answerWords = integer(req.body.answer_words, 100, 20, MAX_ANSWER_WORDS);
  const scope = ["all", "range", "focus"].includes(req.body.scope) ? req.body.scope : "all";
  const tone = ["formal", "conversational"].includes(req.body.tone) ? req.body.tone : "formal";
  const language = ["source", "fa", "en"].includes(req.body.language) ? req.body.language : "source";
  const focus = String(req.body.focus || "").slice(0, 500);
  const from = integer(req.body.from, 1, 1, 100000);
  const to = integer(req.body.to, from, from, 100000);
  let priorQuestions: string[] = [];
  try {
    const parsed = JSON.parse(String(req.body.prior_questions || "[]"));
    if (Array.isArray(parsed)) priorQuestions = parsed.filter(value => typeof value === "string").slice(0, MAX_FAQS);
  } catch { /* malformed history is ignored */ }
  count = Math.min(count, MAX_FAQS - priorQuestions.length);
  if (count < 1) throw new exHttpInvalidParams("تعداد FAQها به سقف ۱۰۰ رسیده است");

  try {
    const extracted = await extract(file);
    if (!extracted.text.trim()) throw new exHttpInvalidParams("متنی از فایل استخراج نشد");
    if (extracted.text.length > MAX_SOURCE_CHARS) throw new exHttpInvalidParams("متن استخراج‌شده بیش از سقف دو میلیون کاراکتر است");
    const selected = selectScope(extracted.text, extracted.pageCount, scope, from, to, focus).trim();
    if (!selected) throw new exHttpInvalidParams("در محدوده انتخابی محتوایی یافت نشد");

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const questionBatches = Math.ceil(count / BATCH_SIZE);
    const sourceBatches = Math.ceil(selected.length / MAX_BATCH_SOURCE_CHARS);
    // Never create a source batch that cannot produce at least one FAQ.
    const batches = Math.min(count, Math.max(questionBatches, sourceBatches));

    sendEvent(res, "meta", { fileName: file.originalname, sourceChars: extracted.text.length, selectedChars: selected.length, pageCount: extracted.pageCount, count, batches });
    const questions: string[] = [...priorQuestions];
    let produced = 0;

    for (let batch = 0; batch < batches && !res.destroyed; batch++) {
      const remainingBatches = batches - batch;
      const wanted = Math.min(BATCH_SIZE, Math.ceil((count - produced) / remainingBatches));
      const source = batchSource(selected, batch, batches);
      const toneInstruction = tone === "conversational"
        ? `Write BOTH questions and answers in genuinely conversational, everyday language. Do not merely simplify formal prose. For Persian, use natural spoken forms such as «می‌تونه»، «چطور»، «اگه»، «چی» and «برای اینکه» where appropriate; avoid formal constructions such as «می‌تواند»، «می‌باشد»، «چگونه»، «در صورتی که» and «چیست». Keep facts exact while making the wording sound like a helpful person speaking.`
        : `Write both questions and answers in a formal, professional register suitable for publication.`;
      const systemPrompt = `You generate grounded FAQs from supplied document content. Return ONLY a valid JSON array. Each item must have exactly question, answer, and section string fields. Never invent facts. Questions must be distinct. Answers must be self-contained and no longer than ${answerWords} words. ${toneInstruction} Preserve exact names, numbers, and qualifications from the source.`;
      const userPrompt = `Generate exactly ${wanted} FAQ items.\nOutput language: ${language === "source" ? "same as the source" : language === "fa" ? "Persian" : "English"}.\nMandatory register: ${tone === "conversational" ? "conversational and spoken; reject formal wording before returning the JSON" : "formal and professional"}.\nRequested focus: ${focus || "none"}.\nQuestions already used (do not repeat): ${JSON.stringify(questions)}\n\nDOCUMENT PART ${batch + 1}/${batches}:\n${source}`;      
      const raw = await generate("تولید FAQ", enuLLMServices.FAQ, systemPrompt, userPrompt, Math.min(2000, wanted * (answerWords + 60)), 0.2, { store: false, background: false, throwOnError: true });
      const items = parseItems(raw).slice(0, wanted);      
      if (!items.length) throw new Error("مدل هیچ FAQ معتبری تولید نکرد");
      questions.push(...items.map(item => item.question));
      produced += items.length;
      sendEvent(res, "batch", { index: batch + 1, total: batches, produced, items });
    }
    sendEvent(res, "done", { produced });
    res.end();
  } catch (error) {
    logger.error({ faq: error });
    if (res.headersSent) {
      sendEvent(res, "error", { message: faqErrorMessage(error) });
      res.end();
    } else throw error;
  } finally { await removeUploadedFile(file); }
});

export default async function init(): Promise<Router> { return router; }

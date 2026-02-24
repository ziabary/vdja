/* eslint-disable @typescript-eslint/no-explicit-any */
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.js";
import * as fs from "fs/promises";
import * as crypto from "crypto";
import { normalizePersianText} from "../i18n";
import type { IntfFileMeta, IntfTextExtractResult } from "../../interfaces/file";


interface IntfTextBlock {
  id: string;
  page: number;
  bbox: { x: number; y: number; w: number; h: number };
  text: string;
  type: "unknown" | "title" | "paragraph" | "table" | "list" | "caption";
  fontSize?: number;
  isBold?: boolean;
  isItalic?: boolean;
}

interface IntfPageContext {
  pageNumber: number;
  width: number;
  height: number;
  nativeBlocks: IntfTextBlock[];
  ocrBlocks: IntfTextBlock[];
  mergedBlocks: IntfTextBlock[];
}


async function loadPDF(filePath: string): Promise<{
  pageCount: number;
  title: string | undefined;
  raw: unknown;
}> {
 const buffer = await fs.readFile(filePath);

  const loadingTask = pdfjs.getDocument({
    data: buffer,
    // Important for Node.js
    disableFontFace: true,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;

  // Metadata (may be missing)
  let title: string | undefined;
  try {
    const meta = await pdf.getMetadata();
    title = meta.info?.Title || meta.metadata?.get("dc:title");
  } catch {
    title = undefined;
  }

  return {
    pageCount: pdf.numPages,
    title,
    raw: pdf,
  };
}

async function loadPage(pdf: any, pageNumber: number): Promise<{
  pageNumber: number;
  width: number;
  height: number;
  raw: any;
}> {
  const page = await pdf.raw.getPage(pageNumber);

  // Default scale = 1 (PDF points)
  const viewport = page.getViewport({ scale: 1 });

  return {
    pageNumber,
    width: viewport.width,
    height: viewport.height,
    raw: page,
  };
}

function stripHeadersAndFooters(
  blocks: IntfTextBlock[],
  pageHeight: number
) {
  const top = pageHeight * 0.08;
  const bottom = pageHeight * 0.92;

  const freq = new Map<string, number>();
  for (const b of blocks) {
    freq.set(b.text, (freq.get(b.text) ?? 0) + 1);
  }

  return blocks.filter(b => {
    if (b.bbox.y > top && b.bbox.y < bottom) return true;
    return (freq.get(b.text) ?? 0) === 1;
  });
}

function clusterGlyphsIntoWords(glyphs: { text: string; x: number; w: number }[], isRTL: boolean) {
  if (glyphs.length === 0) return "";

  const words: string[] = [];
  let currentWord = glyphs[0]!.text;
  let prevEndX = isRTL ? glyphs[0]!.x : glyphs[0]!.x + glyphs[0]!.w;

  for (let i = 1; i < glyphs.length; i++) {
    const g = glyphs[i]!;
    const startX = isRTL ? g.x + g.w : g.x;
    const gap = isRTL ? prevEndX - g.x : g.x - prevEndX;

    // Treat even very small gaps as a word boundary for Persian
    // because justified PDFs may collapse all gaps
    if (gap > 1.5 || (gap < -0.8 && gap > -4)) {
      words.push(currentWord);
      currentWord = g.text;
    } else {
      currentWord += g.text;
    }

    prevEndX = isRTL ? g.x : g.x + g.w;
  }

  words.push(currentWord);
  return words.join(" ").trim();
}

async function extractNativeTextBlocks(
   page: { pageNumber: number; raw: any }
 ): Promise<IntfTextBlock[]> {
   const content = await page.raw.getTextContent();
   
 
  type Glyph = {
    text: string;
    x: number;
    y: number;
    w: number;
    h: number;
    fontName: string
  };

  const lines = new Map<number, Glyph[]>();

  const snapY = (y: number) => Math.round(y / 3) * 3;
 
  for (const item of content.items) {
      if (!item.str?.trim()) continue;

      const [, , , d, e, f] = item.transform;
      const y = snapY(f);

      if (!lines.has(y)) lines.set(y, []);
      lines.get(y)!.push({
        text: item.str,
        x: e,
        y: f,
        w: item.width,
        h: Math.abs(d),
        fontName: item.fontName,                   // <--- ADD THIS
        // font: page.raw.commonObjs.get(item.fontName) // <--- OPTIONAL, more font info
      });
  }
 
  const blocks: IntfTextBlock[] = [];

  for (const [y, glyphs] of lines.entries()) {
    const rtlCount = glyphs.filter(g => /[\u0591-\u07FF]/.test(g.text)).length;
    const isRTL = rtlCount >= glyphs.length / 2;

    glyphs.sort((a, b) => isRTL ? b.x - a.x : a.x - b.x);

    // --- adaptive visual space detection (justified-safe) ---
    const gaps: number[] = [];
    for (let i = 1; i < glyphs.length; i++) {
      const a = glyphs[i - 1]!;
      const b = glyphs[i]!;
      const gap = isRTL
        ? a.x - (b.x + b.w)
        : b.x - (a.x + a.w);
      if (gap > 0) gaps.push(gap);
    }

    // Robust statistics: median + MAD
    const median = gaps.length
      ? gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)]
      : 0;

    const mad =
      gaps.length > 1
        ? gaps
            .map(g => Math.abs(g - median!))
            .sort((a, b) => a - b)[Math.floor(gaps.length / 2)]
        : 0;

    // Instead of gap thresholding
    let text = clusterGlyphsIntoWords(glyphs, isRTL);

    if(!text.length) return blocks
    // fallback: still try character-level recovery
    text = normalizePersianText(text);

    const minX = Math.min(...glyphs.map(g => g.x));
    const maxX = Math.max(...glyphs.map(g => g.x + g.w));
    const maxH = Math.max(...glyphs.map(g => g.h));

    blocks.push({
      id: crypto.randomUUID(),
      page: page.pageNumber,
      bbox: { x: minX, y, w: maxX - minX, h: maxH },
      text: text.trim(),
      type: "unknown",
      fontSize: maxH,       // approximate
      isBold: detectBold(glyphs),
      isItalic: detectItalic(glyphs),
    });
  }

  const avgFontSize = blocks.reduce((sum, b) => sum + (b.fontSize || 0), 0) / blocks.length;
  blocks.forEach(b => {
    b.type = classifyBlockType(b, avgFontSize);
  });

  return blocks.sort((a, b) => b.bbox.y - a.bbox.y);
 }

function detectBold(glyphs: { text: string; fontName?: string }[]): boolean {
  const fontName = glyphs[0]?.fontName;
  if (!fontName) return false;

  // heuristic: font name contains "Bold" or "Black"
  return /bold|black/i.test(fontName);
}

function detectItalic(glyphs: { text: string; fontName?: string }[]): boolean {
  const fontName = glyphs[0]?.fontName;
  if (!fontName) return false;

  return /italic|oblique/i.test(fontName);
}

function blocksToMarkdown(blocks: IntfTextBlock[]): string {
  let md = "";
  for (const b of blocks) {
    const t = b.text.trim();
    if (!t) continue;

    if (b.type === "title") md += `# ${t}\n\n`;
    else if (b.type === "list") md += `- ${t}\n\n`;
    else if (b.type === "table") md += `${t}\n\n`; // simple table fallback
    else if (b.type === "caption") md += `_${t}_\n\n`;
    else if (b.isBold) md += `**${t}**\n\n`;
    else if (b.isItalic) md += `*${t}*\n\n`;
    //else md += `${t}\n\n`;
    else md += `${t}\n\n---\n\n`;
  }
  return md.trim();
}

async function rasterizePage(
  page: any
): Promise<{ buffer: Buffer; width: number; height: number }> {
  // Placeholder stub for the Node-only container
  // Returns an empty buffer so the pipeline can continue
  const viewport = page.raw.getViewport({ scale: 1 });

  return {
    buffer: Buffer.from([]), // Empty buffer for now
    width: viewport.width,
    height: viewport.height,
  };
}

async function detectLayoutBlocks(
  image: { buffer: Buffer; width: number; height: number }
): Promise<IntfTextBlock[]> {
  // Since this is the Node-only pipeline, we have no image
  // Just return an empty array: all blocks will come from extractNativeTextBlocks
  return [];
}

async function ocrMissingBlocks(
  layoutBlocks: IntfTextBlock[],
  nativeBlocks: IntfTextBlock[],
  image: { buffer: Buffer; width: number; height: number }
): Promise<IntfTextBlock[]> {
  // Node-only container: no OCR implemented yet
  // Digital PDFs already have text from nativeBlocks
  return [];
}

function mergeTextBlocks(
  nativeBlocks: IntfTextBlock[],
  ocrBlocks: IntfTextBlock[] = []
): IntfTextBlock[] {
  // Combine all blocks
 const allBlocks = [...nativeBlocks, ...ocrBlocks];

  // Sort by page, y (top to bottom), x (left to right)
  allBlocks.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    const yDiff = b.bbox.y - a.bbox.y;
    if (Math.abs(yDiff) > 2) return yDiff;
    return a.bbox.x - b.bbox.x;
  });

  const mergedBlocks: IntfTextBlock[] = [];
  let current: IntfTextBlock | null = null;

  for (const block of allBlocks) {
    if (!block || !block.bbox) continue;

    //if (current && /[.؟?!]$/.test(current.text)) {
      // Finish current block and start a new one
    const verticalGap =
      current
        ? Math.abs(block.bbox.y - (current.bbox.y + current.bbox.h))
        : 0;

    const fontBreak =
      current?.fontSize &&
      block.fontSize &&
      Math.abs(block.fontSize - current.fontSize) > current.fontSize * 0.3;

    const sentenceEnd = current && /[.؟?!]$/.test(current.text);
    if (current && (sentenceEnd || verticalGap > current.bbox.h * 1.2 || fontBreak)) {      
      mergedBlocks.push(current);
      current = { ...block }; // shallow copy
    } else if (current) {
      // Merge into current block
      current.text += " " + block.text;

      // Expand bounding box
      const minX = Math.min(current.bbox.x, block.bbox.x);
      const maxX = Math.max(current.bbox.x + current.bbox.w, block.bbox.x + block.bbox.w);
      const minY = Math.min(current.bbox.y, block.bbox.y);
      const maxY = Math.max(current.bbox.y + current.bbox.h, block.bbox.y + block.bbox.h);

      current.bbox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    } else {
      // Start first block
      current = { ...block };
    }
  }

  if (current) mergedBlocks.push(current);

  return mergedBlocks;
}

function computeReadingOrder(
  blocks: IntfTextBlock[],
  isRTL: boolean = false
): IntfTextBlock[] {
  // Filter out any blocks without bbox
  const validBlocks = blocks.filter(b => b && b.bbox);

  return [...validBlocks].sort((a, b) => {
    const yDiff = b.bbox.y - a.bbox.y;
    if (Math.abs(yDiff) > 2) return yDiff;

    return isRTL ? b.bbox.x - a.bbox.x : a.bbox.x - b.bbox.x;
  });
}

function reconstructParagraphs(
  blocks: IntfTextBlock[],
  isRTL: boolean = false
): string[] {
  // Step 1: Sort blocks in reading order
  const orderedBlocks = computeReadingOrder(blocks, isRTL);

  // Step 2: Merge lines into paragraphs
  const paragraphs: string[] = [];
  let current = "";

  for (const block of orderedBlocks) {
    let line = block.text.trim();
    if (!line) continue;

    // Step 3: Normalize RTL text
    line = normalizePersianText(line);

    // Step 4: Merge lines intelligently
    //if (current && /[.؟?!]$/.test(current)) {
    const hardStop = /[.؟?!]$/.test(current);
    const isShortLine = line.length < 40;

    if (current && (hardStop || isShortLine)) {    
      paragraphs.push(current);
      current = line;
    } else {
      current += (current ? " " : "") + line;
    }
  }

  if (current) paragraphs.push(current);

  return paragraphs;
}

function classifyBlockType(block: IntfTextBlock, avgFontSize: number): IntfTextBlock["type"] {
  if (!block.fontSize) return "paragraph";

  // Titles are usually 1.5x bigger than avg font size
  if (block.fontSize >= avgFontSize * 1.5) return "title";

  // Detect list items by bullets or numbering
  if (/^(\*|\-|\d+\.)\s+/.test(block.text)) return "list";

  // Tables can be detected by lots of whitespace or vertical bars
  if (/\s{2,}|\|/.test(block.text)) return "table";

  // Short italic lines at bottom may be captions
  if (block.isItalic && block.text.length < 60) return "caption";

  return "paragraph";
}

function pageDirection(words: { text: string }[]): "rtl" | "ltr" {
   let rtl = 0, ltr = 0; 
   for (const w of words) { 
    if (/[\u0591-\u07FF]/.test(w.text)) 
      rtl++; 
    if (/[A-Za-z]/.test(w.text)) ltr++; 
  } 
  return rtl >= ltr ? "rtl" : "ltr"; 
}

export default async function extractFromPDF(
  file: IntfFileMeta,
  fromPage = 0,
  toPage: number | undefined = undefined,
  maxChars = Infinity
): Promise<IntfTextExtractResult> {
  const pdf = await loadPDF(file.path);
  const pageCount = pdf.pageCount;

  const start = (fromPage ?? 0) + 1;
  const end = toPage
    ? Math.min(toPage + 1, pageCount)
    : pageCount;

  let allBlocks: IntfTextBlock[] = [];
  let finalText = "";
  let stripped = false

  for (let pageNum = start; pageNum <= end; pageNum++) {
    const page = await loadPage(pdf, pageNum);

    const pageCtx: IntfPageContext = {
      pageNumber: pageNum,
      width: page.width,
      height: page.height,
      nativeBlocks: [],
      ocrBlocks: [],
      mergedBlocks: [],
    };

    // 1. Extract native PDF text
    pageCtx.nativeBlocks = await extractNativeTextBlocks(page);

    // 2. Rasterize page
    const image = await rasterizePage(page);

    // 3. Detect layout blocks (vision model)
    const layoutBlocks = await detectLayoutBlocks(image);

    // 4. OCR missing blocks
    pageCtx.ocrBlocks = await ocrMissingBlocks(
      layoutBlocks,
      pageCtx.nativeBlocks,
      image
    );

    // 5. Merge native + OCR
    pageCtx.mergedBlocks = mergeTextBlocks(
      pageCtx.nativeBlocks,
      pageCtx.ocrBlocks
    );
    const dir = pageDirection(pageCtx.mergedBlocks);

    pageCtx.mergedBlocks = stripHeadersAndFooters(
      pageCtx.mergedBlocks,
      page.height
    );
    // console.log({blocks:  pageCtx.mergedBlocks, dir  })


    // 6. Compute reading order
    const orderedBlocks = computeReadingOrder(pageCtx.mergedBlocks, dir === "rtl");
    // console.log({orderedBlocks})

    // 7. Reconstruct paragraphs
    let paragraphs = reconstructParagraphs(orderedBlocks, dir === "rtl");
    if(dir === "rtl") 
      paragraphs = paragraphs.map(normalizePersianText);
    // console.log({paragraphs})

    allBlocks.push(...orderedBlocks);
//    finalText += blocksToMarkdown(orderedBlocks) + "\n\n";
    finalText += blocksToMarkdown(orderedBlocks)+`\n\n<!--PAGE:${pageNum}-->\n\n`;

    if (finalText.length >= maxChars) {
      finalText = finalText.substring(0, Math.min(finalText.length, maxChars - 6)) + " [...]";
      stripped = true;
      break;
    }
  }

  return {
    meta: {
      pageCount,
      title: pdf.title,
    },
    stripped,
    text: finalText,
  };
}

export async function extractFromPDFInteractive(
  file: IntfFileMeta,
  onPage?: (pageNumber: number, pageText: string, pageCount: number) => Promise<void>
) {
  const pdf = await loadPDF(file.path);
  const pageCount = pdf.pageCount;

 // const allBlocks: IntfTextBlock[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await loadPage(pdf, pageNum);

    const pageCtx: IntfPageContext = {
      pageNumber: pageNum,
      width: page.width,
      height: page.height,
      nativeBlocks: await extractNativeTextBlocks(page),
      ocrBlocks: [],
      mergedBlocks: [],
    };

    const image = await rasterizePage(page);
    const layoutBlocks = await detectLayoutBlocks(image);
    pageCtx.ocrBlocks = await ocrMissingBlocks(layoutBlocks, pageCtx.nativeBlocks, image);

    pageCtx.mergedBlocks = mergeTextBlocks(pageCtx.nativeBlocks, pageCtx.ocrBlocks);
    const dir = pageDirection(pageCtx.mergedBlocks);
    pageCtx.mergedBlocks = stripHeadersAndFooters(pageCtx.mergedBlocks, page.height);
    const orderedBlocks = computeReadingOrder(pageCtx.mergedBlocks, dir === "rtl");
    const paragraphs = reconstructParagraphs(orderedBlocks, dir === "rtl");
   // allBlocks.push(...orderedBlocks);

    const pageText = paragraphs.join("\n\n");
    if(onPage) await onPage(pageNum, pageText, pageCount);
  }

  //return allBlocks;
}

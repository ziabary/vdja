import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as fs from "fs/promises";
import * as crypto from "crypto";
import { normalizeRTL } from "../i18n";

// Set the worker (required in Node, prevents worker loading issues)
pdfjs.GlobalWorkerOptions.workerSrc = new URL('./pdf.worker.min.mjs', import.meta.url).href;

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────
interface IntfBlockBox {
  x: number; y: number; w: number; h: number
}
export interface IntfGlyph {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontName: string;
  realFontName: string;
  isBold: boolean;
  isItalic: boolean;
}

export interface IntfTextBlock {
  id: string;
  page: number;
  bbox: IntfBlockBox;
  text: string;          // markdown-ready text with inline styling
  glyphs: IntfGlyph[];   // all glyphs preserved
  type: "unknown" | "title" | "heading" | "numbered" | "bullet" | "table" | "paragraph" | "decorative" | "caption";
  fontSize: number;
  fontFamily: string;
  isBold: boolean;
  isItalic: boolean;
}

interface IntfTableRegion {
  id: string;
  page: number;
  bbox: IntfBlockBox;
  confidence: number;         // 0–1
  evidence: string[];         // "ruling-lines", "column-alignment", "dense-grid", …
  blockIdsInside: string[];   // or reference to blocks
  captionBlockId?: string;
  isBordered: boolean;
}
interface IntfSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length: number;
  thickness?: number;
  isHorizontal: boolean;
  isVertical: boolean;
}

interface IntfRulingLines {
  horizontal: IntfSegment[];
  vertical: IntfSegment[];
  rectangles: { x: number; y: number; w: number; h: number; }[];
  stats: {
    hCount: number;
    vCount: number;
    totalLineLength: number;
    avgThickness: number;
    borderedBias: number; // 0–1, higher = more likely bordered tables
  };
}
interface IntfColumn {
  blocks: IntfTextBlock[]
  boundary: IntfBlockBox
}
interface IntfPageStripOptions {
  headerRatio?: number | undefined;           // default ~0.09–0.12
  footerRatio?: number | undefined;           // default ~0.07–0.10
  autoDetectRepeating?: boolean | undefined;  // default: true
  minRepeatPages?: number | undefined;        // default: 3
  largeGapRatio?: number | undefined;         // default: ~0.11–0.13
  shortBlockMaxWords?: number | undefined;    // default: 4–6
  shortBlockMaxChars?: number | undefined;    // default: 65–90
  tinyAreaRatio?: number | undefined;         // default: 0.0007–0.0015
  enableLogging?: boolean | undefined;        // default: false in production
  // Suggested additions for better protection of body content
  safeBodyTopRatio?: number | undefined;      // e.g. 0.12–0.15
  safeBodyBottomRatio?: number | undefined;   // e.g. 0.10–0.14
  narrowWidthThreshold?: number | undefined;  // e.g. 0.35–0.45 (fraction of page width)
}

interface IntfMergeOptions {
  maxVerticalGapFactor?: number;     // default ~1.8–2.4 × median line spacing
  minHorizontalOverlap?: number;     // 0.65–0.85 — how much x-ranges should overlap to consider same column
  maxHorizontalDrift?: number;       // max allowed x difference for continuation (px)
  sameColumnXDelta?: number;         // ~8–20 px tolerance for "same starting x"
  debug?: boolean;
}

interface IntfLineSpacingStats {
  medianGap: number;
  iqr: number;
}
interface IntfCluster {
  center: number;
  items: number[]; // x positions or y
  count: number;
}

// ────────────────────────────────────────────────
// Configuration / Thresholds
// ────────────────────────────────────────────────
const DEFAULT_STRIP_OPTIONS: IntfPageStripOptions = {
  headerRatio: 0.10,
  footerRatio: 0.08,
  autoDetectRepeating: true,
  minRepeatPages: 3,
  largeGapRatio: 0.115,
  shortBlockMaxWords: 5,
  shortBlockMaxChars: 80,
  tinyAreaRatio: 0.0012,
  enableLogging: false,           // change to true during debugging
  safeBodyTopRatio: 0.13,
  safeBodyBottomRatio: 0.12,
  narrowWidthThreshold: 0.38,
};

const TITLE_FONT_SIZE_FACTOR = 1.5;

// ────────────────────────────────────────────────
// Helpers – Text Cleaning & Normalization
// ────────────────────────────────────────────────




function normalizeForRepeat(text: string): string {
  return (text || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[0-9٠-٩۰-۹IVXLCDM]+/gi, '#')
    .toLowerCase();
}

function isShortSuspicious(
  text: string,
  options: IntfPageStripOptions
): boolean {
  const trimmed = (text || '').trim();
  if (!trimmed) return true;

  const words = trimmed.split(/\s+/).length;
  const chars = trimmed.length;
  const numCount = (trimmed.match(/[0-9۰-۹]/g) || []).length;
  const numRatio = chars > 0 ? numCount / chars : 0;

  return (
    (words <= (options.shortBlockMaxWords ?? 5) ||
      chars <= (options.shortBlockMaxChars ?? 80)) &&
    (numRatio > 0.35 || words <= 2)
  );
}

// ────────────────────────────────────────────────
// Core PDF Loading
// ────────────────────────────────────────────────

async function loadPdfDocument(filePath: string, debug?: boolean) {
  if (debug) console.log(`[PDF] Loading document: ${filePath}`);

  const buffer = await fs.readFile(filePath);  // This is a Buffer

  // Convert Buffer to Uint8Array (simple & efficient)
  const uint8Array = new Uint8Array(buffer);  // ← this is the key line

  const loadingTask = pdfjs.getDocument({
    data: uint8Array,  // Now passes Uint8Array instead of Buffer
    disableFontFace: true,
    useSystemFonts: true,
    // Optional: for better Persian/Arabic/CJK support
    cMapUrl: './cmaps/',  // if you copied the cmaps folder to your project
    cMapPacked: true,
  });

  const pdf = await loadingTask.promise;

  let title: string | undefined;
  try {
    const meta = await pdf.getMetadata();
    title = meta.info?.Title || meta.metadata?.get("dc:title");
  } catch (ex) {
    console.error(ex);
  }

  if (debug) console.log(`[PDF] Loaded – ${pdf.numPages} pages${title ? `, title: ${title}` : ""}`);
  return { pdf, pageCount: pdf.numPages, title };
}

async function getPageInfo(pdf: any, pageNumber: number, debug?: boolean) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });

  const result = {
    pageNumber,
    width: viewport.width,
    height: viewport.height,
    rawPage: page,
    fonts: {} as Record<string, string>,
    fontDetails: [] as any[],  // can extend later with ascent/bold flags if needed
    warning: undefined as string | undefined,
    rulingLines: undefined as IntfRulingLines | undefined,
  };

  try {
    // 1. Discover used font IDs from text layer (cheap & reliable)
    const textContent = await page.getTextContent();
    const fontIds: Set<string> = new Set(
      textContent.items
        .map((item: any) => item.fontName)
        .filter(Boolean)
    );

    if (fontIds.size === 0) {
      result.warning = 'No text items found on page → no fonts detected';
      return result;
    }

    // 2. Force font resolution
    await page.getOperatorList();  // ← the magic line

    result.rulingLines = await extractRulingLines(
      page,
      viewport.width,
      viewport.height,
      debug   // pass your debug flag
    );

    // 4. Try to resolve real names
    const unresolved: string[] = [];
    for (const id of fontIds) {
      if (page.commonObjs.has(id)) {
        const font = page.commonObjs.get(id);
        let name = font?.name || font?.loadedName || 'Unknown';
        // Clean common subset prefix (AAAAAA+...)
        name = name.replace(/^[A-Z0-9]{6}\+/, '').trim();
        // Optional: remove trailing ,Bold etc. if you want base only
        // name = name.replace(/,.*$/, '').trim();

        result.fonts[id] = name;
      } else {
        unresolved.push(id);
        result.fonts[id] = 'Not Loaded (synthetic)';
      }
    }

    if (unresolved.length > 0) {
      result.warning = `Could not resolve real names for: ${unresolved.join(', ')}. ` +
        `commonObjs may not have populated in Node.js environment.`;
    }

  } catch (err) {
    result.warning = `Font or line extraction failed: ${(err as Error).message || String(err)}`;
    if (debug) console.error(`Page ${pageNumber} font error:`, err);
  }

  return result;
}

async function processContentStream(
  contentStream: any,           // PDFStream or page itself
  matrix: number[] = [1,0,0,1,0,0], // current transformation
  depth: number = 0,
  collectedLines: Segment[] = [],
  debug = false
): Promise<Segment[]> {
  if (depth > 8) return collectedLines; // safety

  const ops = await contentStream.getOperatorList();
  let currentPath: {x:number, y:number}[] = [];
  let currentPoint: {x:number, y:number} | null = null;

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i] || [];

    switch (fn) {
      case 17: // moveTo
        currentPoint = { x: args[0], y: args[1] };
        currentPath = [currentPoint];
        break;

      case 18: // lineTo
        if (currentPoint) {
          const nx = args[0], ny = args[1];
          // todo: apply current matrix to points if needed
          // for simplicity, assume identity or handle later
          const len = Math.hypot(nx - currentPoint.x, ny - currentPoint.y);
          if (len > 5) {
            const isH = Math.abs(ny - currentPoint.y) < 2.5;
            const isV = Math.abs(nx - currentPoint.x) < 2.5;
            if (isH || isV) {
              collectedLines.push({
                x1: Math.min(currentPoint.x, nx),
                y1: Math.min(currentPoint.y, ny),
                x2: Math.max(currentPoint.x, nx),
                y2: Math.max(currentPoint.y, ny),
                length: len,
                thickness: 1, // improve later
                isHorizontal: isH,
                isVertical: isV
              });
            }
          }
          currentPoint = { x: nx, y: ny };
        }
        break;

      case 24: // rect
        if (args.length >= 4) {
          let [x,y,w,h] = args;
          // todo: apply matrix
          if (w < 3 && h > 10) {
            collectedLines.push({ /* vertical */ });
          }
          if (h < 3 && w > 10) {
            collectedLines.push({ /* horizontal */ });
          }
        }
        break;

      case 37: // Do = paint XObject
        const name = args[0];
        if (debug) console.log(`[Do nested] ${name} depth=${depth}`);

        // Resolve XObject
        const xobj = await new Promise((resolve) => {
          // page.objs or page.commonObjs depending on scope
          contentStream.objs?.get(name, (obj: any) => resolve(obj));
        });

        if (xobj && xobj instanceof pdfjs.Dict && xobj.get('Subtype')?.name === 'Form') {
          // Found Form XObject → recurse
          await processContentStream(
            xobj,                 // the form has its own stream
            matrix,               // todo: multiply by Do matrix args
            depth + 1,
            collectedLines,
            debug
          );
        }
        break;
    }
  }

  return collectedLines;
}
/**
 * Extracts ruling lines (stroked paths, rects) from operatorList.
 * Focuses on thin horizontal/vertical segments typical of table borders.
 * Very verbose debug output for verification.
 * Enhanced: Detect thin filled rects as lines + lower thresholds + better logging
 */
async function extractRulingLines(
  page: any,
  pageWidth: number,
  pageHeight: number,
  debug = true
): Promise<IntfRulingLines> {
  if (debug) console.time(`[RulingLines v3] page ${page.pageNumber || '?'}`);

  const opList = await page.getOperatorList();
  const fnArray = opList.fnArray;
  const argsArray = opList.argsArray;

  const hLines: IntfSegment[] = [];
  const vLines: IntfSegment[] = [];
  const rects: any[] = [];
  const doCalls: string[] = [];

  let currentLineWidth = 1.0;

  if (debug) console.log(`[RulingLines v3] Total ops: ${fnArray.length}`);

  for (let i = 0; i < fnArray.length; i++) {
    const op = fnArray[i];
    const args = argsArray[i] || [];

    if (op === 37) { // OPS.do → Form or Image
      const name = args[0];
      doCalls.push(name);
      if (debug && i % 10 === 0) console.log(`[Do] ${name} at op ${i}`);
    }

    if (op === 24) { // rect
      if (args.length >= 4) {
        let [x, y, w, h] = args;
        x = Math.abs(x); y = Math.abs(y); w = Math.abs(w); h = Math.abs(h);
        if (w > 0.1 && h > 0.1) {
          rects.push({ x, y, w, h, opIndex: i });

          // Treat as line if very thin in one direction
          if (w < 3 && h > 8) {
            vLines.push({
              x1: x, y1: y, x2: x, y2: y + h,
              length: h,
              thickness: w,
              isHorizontal: false,
              isVertical: true
            });
            if (debug) console.log(`[THIN V] x=${x.toFixed(1)} thick=${w.toFixed(3)} h=${h.toFixed(1)}`);
          }
          if (h < 3 && w > 8) {
            hLines.push({
              x1: x, y1: y, x2: x + w, y2: y,
              length: w,
              thickness: h,
              isHorizontal: true,
              isVertical: false
            });
            if (debug) console.log(`[THIN H] y=${y.toFixed(1)} thick=${h.toFixed(3)} len=${w.toFixed(1)}`);
          }
        }
      }
    }

    if (op === 15) currentLineWidth = Math.abs(args[0] || 1);
  }

  // Try to resolve a few common form names (best-effort, may not work in all setups)
  if (debug && doCalls.length > 0) {
    console.log(`[Do calls found] ${doCalls.slice(0, 20).join(', ')}${doCalls.length > 20 ? '...' : ''}`);
    console.log(`[Forms] Trying to resolve first few forms...`);
    // Note: full recursive form parsing requires more complex code with resource lookup
  }

  const stats = {
    hCount: hLines.length,
    vCount: vLines.length,
    totalLineLength: hLines.reduce((s, l) => s + l.length, 0) + vLines.reduce((s, l) => s + l.length, 0),
    avgThickness: 0,
    borderedBias: Math.min(1, (hLines.length + vLines.length) / 20)
  };

  if (debug) {
    console.log(`[RulingLines v3] Detected H: ${hLines.length}  V: ${vLines.length}`);
    console.log(`[RulingLines v3] Total rects seen: ${rects.length}`);
    console.log(`[RulingLines v3] Bordered bias: ${stats.borderedBias.toFixed(3)}`);
    if (hLines.length > 0) console.log(`Sample H y:`, hLines.slice(0,5).map(l => l.y1.toFixed(1)));
    if (vLines.length > 0) console.log(`Sample V x:`, vLines.slice(0,5).map(l => l.x1.toFixed(1)));
    console.timeEnd(`[RulingLines v3] page ${page.pageNumber || '?'}`);
  }

  return {
    horizontal: hLines,
    vertical: vLines,
    rectangles: rects,
    stats
  };
}

// ────────────────────────────────────────────────
// Text Extraction (Native PDF layer)
// ────────────────────────────────────────────────
export async function extractNativeTextBlocks(
  pageInfo: { pageNumber: number; rawPage: any; fonts: Record<string, string> },
  debug?: boolean
): Promise<IntfTextBlock[]> {
  const { pageNumber, rawPage, fonts } = pageInfo;
  if (debug) console.time(`[Native] page ${pageNumber}`);

  const content = await rawPage.getTextContent();
  const linesByY = new Map<number, IntfGlyph[]>();
  const snapY = (y: number) => Math.round(y / 3) * 3;

  // --------------------------------------------------
  // 1. Collect glyphs per visual line
  // --------------------------------------------------
  for (const item of content.items as any[]) {
    if (!item.str) continue;

    const [, , , d, e, f] = item.transform;
    const y = snapY(f);

    const realFont = fonts[item.fontName] || "Unknown";
    const isBold = /bold/i.test(realFont);
    const isItalic = /italic/i.test(realFont);

    if (!linesByY.has(y)) linesByY.set(y, []);
    linesByY.get(y)!.push({
      text: item.str,
      x: e,
      y: f,
      w: item.width ?? 0,
      h: Math.abs(d),
      fontName: item.fontName,
      realFontName: realFont,
      isBold,
      isItalic,
    });
  }

  const blocks: IntfTextBlock[] = [];

  // --------------------------------------------------
  // 2. Process each line (PURE GEOMETRY)
  // --------------------------------------------------
  for (const [y, glyphs] of linesByY.entries()) {
    if (glyphs.length === 0) continue;

    // ----------------------------------------------
    // 2.1 Determine line direction geometrically
    // ----------------------------------------------
    const isRTL =
      glyphs.length > 1 && glyphs[0]!.x > glyphs[glyphs.length - 1]!.x;

    // ----------------------------------------------
    // 2.2 Sort glyphs in VISUAL order (once)
    // ----------------------------------------------
    glyphs.sort((a, b) => (isRTL ? b.x - a.x : a.x - b.x));

    // ----------------------------------------------
    // 2.3 Compute virtual spaces using median + MAD
    // ----------------------------------------------
    const gaps: number[] = [];
    for (let i = 1; i < glyphs.length; i++) {
      const a = glyphs[i - 1]!;
      const b = glyphs[i]!;
      const gap = isRTL ? a.x - (b.x + b.w) : b.x - (a.x + a.w);
      if (gap > 0) gaps.push(gap);
    }
    const medianGap = gaps.length
      ? gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)]
      : 0;
    const madGap = gaps.length > 1
      ? gaps.map(g => Math.abs(g - medianGap!)).sort((a, b) => a - b)[Math.floor(gaps.length / 2)]
      : 0;
    const MIN_VIRTUAL_SPACE = 1.5; // px, tune for your font/scale
    const dynamicVirtualSpaceThreshold = Math.max(medianGap! + 2 * madGap!, MIN_VIRTUAL_SPACE);
    // ----------------------------------------------
    // 2.4 Build style runs with virtual spaces
    // ----------------------------------------------
    type Run = {
      text: string;
      isBold: boolean;
      isItalic: boolean;
      font: string;
    };

    const runs: Run[] = [];
    let currentRun: Run | null = null;

    const persianLetters = /[\u0600-\u06FF]/;
    for (let i = 0; i < glyphs.length; i++) {
      const g = glyphs[i]!;
      const prev = glyphs[i - 1]!;

      const sameStyle =
        currentRun &&
        currentRun.isBold === g.isBold &&
        currentRun.isItalic === g.isItalic &&
        currentRun.font === g.realFontName;

      if (!sameStyle) {
        if (currentRun) runs.push(currentRun);
        currentRun = {
          text: "",
          isBold: g.isBold,
          isItalic: g.isItalic,
          font: g.realFontName,
        };
      }

      // Virtual space based on geometry + dynamic threshold
      if (prev) {
        // Standard gap
        const gap = isRTL ? prev.x - (g.x + g.w) : g.x - (prev.x + prev.w);

        // Add space if gap exceeds dynamic threshold
        let addSpace = gap > dynamicVirtualSpaceThreshold;

        // For Persian/RTL, also add space if both are Persian letters and gap > 0
        if (!addSpace && isRTL && persianLetters.test(prev.text) && persianLetters.test(g.text) && gap > 0) {
          addSpace = true;
        }

        if (addSpace) currentRun!.text += " ";
      }

      currentRun!.text += g.text;
    }

    if (currentRun) runs.push(currentRun);

    // ----------------------------------------------
    // 2.5 Apply inline Markdown (bold/italic)
    // ----------------------------------------------
    let lineText = runs
      .map(r => {
        let t = r.text;
        if (r.isBold) t = `**${t}**`;
        if (r.isItalic) t = `_${t}_`;
        return t;
      })
      .join("");

    // ----------------------------------------------
    // 2.6 Recover Persian spaces & clean PDF artifacts
    // ----------------------------------------------
    lineText = recoverPersianSpaces(lineText);
    lineText = cleanPDFArtifacts(lineText);

    // ----------------------------------------------
    // 2.7 Geometry & metadata
    // ----------------------------------------------
    const minX = Math.min(...glyphs.map(g => g.x));
    const maxX = Math.max(...glyphs.map(g => g.x + g.w));
    const maxH = Math.max(...glyphs.map(g => g.h));

    const fontCounts = new Map<string, number>();
    glyphs.forEach(g =>
      fontCounts.set(g.realFontName, (fontCounts.get(g.realFontName) || 0) + 1)
    );

    let dominantFont = "Unknown";
    let maxCount = 0;
    for (const [f, c] of fontCounts.entries()) {
      if (c > maxCount) {
        maxCount = c;
        dominantFont = f;
      }
    }

    dominantFont = dominantFont.replace(/^[A-Z0-9]{6}\+/, "").trim();

    blocks.push({
      id: crypto.randomUUID(),
      page: pageNumber,
      bbox: { x: minX, y, w: maxX - minX, h: maxH },
      text: lineText.trim(),
      glyphs,
      type: "unknown",
      fontSize: maxH,
      fontFamily: dominantFont,
      isBold: glyphs.some(g => g.isBold),
      isItalic: glyphs.some(g => g.isItalic),
    });
  }

  // --------------------------------------------------
  // 3. Top-to-bottom page order
  // --------------------------------------------------
  blocks.sort((a, b) => b.bbox.y - a.bbox.y);

  if (debug) {
    console.timeEnd(`[Native] page ${pageNumber}`);
    console.log(`[Native] page ${pageNumber} → ${blocks.length} blocks`);
  }

  if (debug) {
  console.log(`[DEBUG BLOCK SAMPLE page 45] ${blocks.length} blocks`);
  blocks
    .slice(0, 30) // or sort by y descending first and take middle ones if table is in center
    .forEach((b, i) => {
      const t = b.text.trim().replace(/\s+/g, ' ').slice(0, 40);
      console.log(
        `[blk ${i}] y=${b.bbox.y.toFixed(0)} | x=${b.bbox.x.toFixed(0)} | w=${b.bbox.w.toFixed(0)} | h=${b.bbox.h.toFixed(1)} | "${t}"`
      );
    });
}

  return blocks;
}

function computeLineSpacingStats(blocks: IntfTextBlock[]): IntfLineSpacingStats {
  const gaps: number[] = [];
  for (let i = 1; i < blocks.length; i++) {
    const prev = blocks[i - 1];
    const curr = blocks[i];
    const gap = prev!.bbox.y - (curr!.bbox.y + curr!.bbox.h);
    if (gap > 0) gaps.push(gap);
  }

  if (gaps.length === 0) {
    return { medianGap: 0, iqr: 0 };
  }

  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];

  return {
    medianGap: median!,
    iqr: q3! - q1!,
  };
}
// ────────────────────────────────────────────────
// Page-level Post-processing
// ────────────────────────────────────────────────
/**
 * Advanced Header/Footer Filter
 * 
 * Criteria:
 * 1. Manual top/bottom cutoff
 * 2. Repeated content across adjacent pages (frequency-based)
 * 3. Huge gaps at top/bottom
 * 4. Heuristic: very short blocks, page numbers, mostly numeric
 */
export function filterHeaderFooter(
  blocks: IntfTextBlock[],
  prevPageBlocks: IntfTextBlock[] = [],
  nextPageBlocks: IntfTextBlock[] = [],
  pageHeight: number,
  pageWidth: number,
  options: IntfPageStripOptions = {}
): IntfTextBlock[] {
  if (blocks.length === 0) return [];

  const opts = { ...DEFAULT_STRIP_OPTIONS, ...options };
  const log = opts.enableLogging ? console.log : () => { };

  const pageNum = blocks[0]?.page ?? '?';

  log(`[Page ${pageNum}] filterHeaderFooter – page ${pageHeight.toFixed(1)} × ${pageWidth.toFixed(1)}`);

  // Zones ────────────────────────────────────────────────────────────
  const headerCutoffY = pageHeight * (1 - (opts.headerRatio ?? 0.085));
  const footerCutoffY = pageHeight * (opts.footerRatio ?? 0.085);
  const safeBodyMinY = headerCutoffY - 15;   // small overlap tolerance
  const safeBodyMaxY = footerCutoffY + 15;

  log(`header zone     : yTop  > ${headerCutoffY.toFixed(1)}`);
  log(`footer zone     : yBot  < ${footerCutoffY.toFixed(1)}`);
  log(`body protection : ${safeBodyMinY.toFixed(1)} ≤ yTop ≤ ${safeBodyMaxY.toFixed(1)}`);

  // ── Candidates preparation ────────────────────────────────────────
  type Candidate = {
    block: IntfTextBlock;
    yTop: number;
    yBottom: number;
    normText: string;
    isShort: boolean;
    relArea: number;
    snippet: string;
    widthFrac: number;
  };

  const candidates: Candidate[] = blocks.map(b => {
    const bbox = b.bbox || {};
    const y = Number(bbox.y) || 0;
    const h = Number(bbox.h) || 0;
    const w = Number(bbox.w) || 0;
    const yTop = y + h;
    const yBottom = y;

    const text = (b.text || '').trim();
    const snippet = text.slice(0, 80) + (text.length > 80 ? '…' : '');

    return {
      block: b,
      yTop,
      yBottom,
      normText: normalizeForRepeat(text),
      isShort: isShortSuspicious(text, opts),
      relArea: pageHeight * pageWidth > 0 ? (w * h) / (pageHeight * pageWidth) : 0,
      snippet,
      widthFrac: pageWidth > 0 ? w / pageWidth : 0,
    };
  });

  candidates.sort((a, b) => b.yTop - a.yTop); // top → bottom

  // Repeating detection (used only for strong watermark check)
  const repeatFreq = new Map<string, number>();
  if (opts.autoDetectRepeating) {
    [...prevPageBlocks, ...nextPageBlocks, ...blocks].forEach(b => {
      const norm = normalizeForRepeat(b.text || '');
      if (norm.length > 8) repeatFreq.set(norm, (repeatFreq.get(norm) ?? 0) + 1);
    });
  }

  // ── Filtering ─────────────────────────────────────────────────────
  const kept: Candidate[] = [];
  const removed: { snippet: string; reason: string; yTop: number; widthFrac: number }[] = [];

  let prevBottomY = pageHeight;

  for (const c of candidates) {
    const yTopStr = c.yTop.toFixed(1);
    const yBotStr = c.yBottom.toFixed(1);
    const wFrac = c.widthFrac.toFixed(2);

    let remove = false;
    let reason = '';

    const inHeader = c.yTop > headerCutoffY;
    const inFooter = c.yBottom < footerCutoffY;
    const inBody = !inHeader && !inFooter;

    // ── 1. Body zone → very strong protection ─────────────────────
    if (inBody) {
      // Default = KEEP
      // Only remove if very obvious watermark / artifact

      const highRepeatCount = 0 //TODO check other pages blocks //repeatFreq.get(c.normText) ?? 0 >= 4;
      const isOverlay = c.widthFrac > 0.6; // covers >60% of page width

      if (isOverlay && (c.normText.length < 20)) {
        remove = true;
        reason = `body overlay >60% width (possible watermark)`;
      } else if (highRepeatCount) {
        remove = true;
        reason = `high repeat inter pages`;
      }
      // You can add more watermark heuristics here later (font opacity if extracted, diagonal position, etc.)
    }

    // ── 2. Header / Footer zones → normal filtering ───────────────
    else {
      if (inHeader) {
        reason = `header zone (yTop ${yTopStr} > ${headerCutoffY.toFixed(1)})`;
        remove = true;
      }
      else if (inFooter) {
        reason = `footer zone (yBot ${yBotStr} < ${footerCutoffY.toFixed(1)})`;
        remove = true;
      }

      // Extra lenient removal inside header/footer
      if (!remove) {
        if (c.isShort && c.widthFrac < 0.45) {
          remove = true;
          reason = `short & narrow in header/footer`;
        }
        else if (c.relArea < (opts.tinyAreaRatio ?? 0.0012)) {
          remove = true;
          reason = `tiny in header/footer`;
        }
      }
    }

    // ── 3. Very large structural gaps (only outside body if needed) ─
    if (!remove && !inBody && kept.length > 0) {
      const gap = prevBottomY - c.yTop;
      if (gap > pageHeight * 0.28) {   // very conservative ~235 pt on A4
        remove = true;
        reason = `very large structural gap (${gap.toFixed(1)} pt)`;
      }
    }

    if (remove) {
      removed.push({ snippet: c.snippet, reason, yTop: c.yTop, widthFrac: c.widthFrac });
      log(`[REMOVED] y=${yTopStr} | w=${wFrac} | "${c.snippet}" → ${reason}`);
    } else {
      kept.push(c);
      prevBottomY = Math.min(prevBottomY, c.yBottom);
      log(`[KEPT   ] y=${yTopStr} | w=${wFrac} | "${c.snippet}"`);
    }
  }

  log(`[Page ${pageNum}] Summary: kept ${kept.length} / ${blocks.length}  removed ${removed.length}`);

  if (removed.length > 0) {
    log(`Removed details:`);
    removed.forEach(r => {
      log(`  • y=${r.yTop.toFixed(1)} | w=${r.widthFrac} | ${r.reason} | "${r.snippet}"`);
    });
  }

  return kept.map(c => c.block).sort((a, b) => b.bbox.y - a.bbox.y);
}


function determinePageDirection(blocks: IntfTextBlock[]): "rtl" | "ltr" {
  let rtl = 0, ltr = 0;
  for (const b of blocks) {
    if (/[\u0591-\u07FF]/.test(b.text)) rtl++;
    if (/[A-Za-z]/.test(b.text)) ltr++;
  }
  return rtl >= ltr ? "rtl" : "ltr";
}

// ────────────────────────────────────────────────
// Layout / OCR Stubs (Node-only for now)
// ────────────────────────────────────────────────

async function rasterizePage(page: any): Promise<{ buffer: Buffer; width: number; height: number }> {
  const viewport = page.rawPage.getViewport({ scale: 1 });
  return { buffer: Buffer.alloc(0), width: viewport.width, height: viewport.height };
}

async function detectLayoutBlocks(): Promise<IntfTextBlock[]> {
  return []; // stub
}

async function ocrMissingBlocks(): Promise<IntfTextBlock[]> {
  return []; // stub
}
// ────────────────────────────────────────────────
// Block type detection
// ────────────────────────────────────────────────
interface TableDetectionOptions {
  minTableWidthFrac?: number;        // default 0.55
  minNumericCellRatio?: number;      // default 0.30
  maxHeightVariationPx?: number;     // default 2.0
  minNumericTableWidthFrac?: number; // default 0.50
  minNumericRatioForSingleCell?: number; // default 0.45
  continuityNumericRatio?: number;   // default 0.40
  continuityMinWidthFrac?: number;   // default 0.50
  debug?: boolean;
}

const DEFAULT_TABLE_OPTIONS: TableDetectionOptions = {
  minTableWidthFrac: 0.55,
  minNumericCellRatio: 0.30,
  maxHeightVariationPx: 2.0,
  minNumericTableWidthFrac: 0.50,
  minNumericRatioForSingleCell: 0.45,
  continuityNumericRatio: 0.40,
  continuityMinWidthFrac: 0.50,
  debug: false,
};



function groupRows(blocks: IntfTextBlock[], yTolerance = 4): IntfTextBlock[][] {
  const rows: IntfTextBlock[][] = [];

  for (const b of blocks) {
    let row = rows.find(r => Math.abs(r[0]!.bbox.y - b.bbox.y) <= yTolerance);
    if (!row) {
      row = [];
      rows.push(row);
    }
    row.push(b);
  }

  return rows;
}

function numericRatio(text: string): number {
  const nums = text.match(/[0-9۰-۹]/g)?.length ?? 0;
  return nums / Math.max(text.length, 1);
}

/**
 * Classifies rows as table / not-table.
 * Returns array of the same length as input rows → each entry is "table" | "text" | "caption-like"
 */
export function classifyRowsAsTable(
  rows: IntfTextBlock[][],
  pageWidth: number,
  options: TableDetectionOptions = {}
): ("table" | "text" | "caption-like" | "header-like")[] {
  const opts = { ...DEFAULT_TABLE_OPTIONS, ...options };
  const log = opts.debug ? console.log : () => {};

  const classifications: ("table" | "text" | "caption-like" | "header-like")[] = [];

  let wasInTable = false;

  rows.forEach((row, rowIdx) => {
    if (row.length === 0) {
      classifications.push("text");
      return;
    }

    const rowY = row[0]?.bbox.y ?? 0;

    // ── Geometry ───────────────────────────────────────
    const totalWidth = row.reduce((sum, b) => sum + b.bbox.w, 0);
    const widthFrac = totalWidth / pageWidth;

    const heights = row.map(b => b.bbox.h);
    const heightDelta = Math.max(...heights) - Math.min(...heights);

    // ── Content signals ────────────────────────────────
    const numericRatios = row.map(b => numericRatio(b.text));
    const hasNumericCell = numericRatios.some(r => r >= opts.minNumericCellRatio);
    const maxNumericRatio = Math.max(...numericRatios);

    const hasCaptionKeyword = row.some(b =>
      /\b(جدول|جدول\s*[۰-۹\d]+|Table|TABLE)\b/i.test(b.text)
    );

    // ── Classification rules (in priority order) ───────

    // 1. Strong single-line numeric table (very common in financial PDFs)
    if (
      row.length === 1 &&
      widthFrac >= opts.minNumericTableWidthFrac &&
      maxNumericRatio >= opts.minNumericRatioForSingleCell
    ) {
      classifications.push("table");
      wasInTable = true;
      log(`[row ${rowIdx}] SINGLE-NUMERIC-TABLE  w=${widthFrac.toFixed(2)} num=${maxNumericRatio.toFixed(2)}`);
      return;
    }

    // 2. Classic multi-cell table row
    const structurallyTable =
      row.length >= 2 &&
      widthFrac >= opts.minTableWidthFrac &&
      hasNumericCell &&
      heightDelta <= opts.maxHeightVariationPx;

    // 3. Table continuation (we were already in table mode)
    const continuationTable =
      wasInTable &&
      row.length <= 3 &&                    // usually ≤2, but sometimes merged cells
      widthFrac >= opts.continuityMinWidthFrac &&
      numericRatios.some(r => r >= opts.continuityNumericRatio);

    // 4. Probable table header (no numbers yet, but next row has numbers)
    const probableHeader =
      !hasNumericCell &&
      row.length >= 2 &&
      widthFrac >= opts.minTableWidthFrac &&
      !hasCaptionKeyword &&
      rowIdx + 1 < rows.length &&
      rows[rowIdx + 1]!.some(b => numericRatio(b.text) >= opts.minNumericCellRatio);

    const isTableRow =
      structurallyTable ||
      continuationTable ||
      probableHeader;

    if (isTableRow) {
      classifications.push("table");
      wasInTable = true;

      if (probableHeader && !structurallyTable) {
        classifications[ classifications.length - 1 ] = "header-like";
      }

      log(`[row ${rowIdx}] TABLE${continuationTable ? " (cont)" : ""}${probableHeader ? " (header?)" : ""}  w=${widthFrac.toFixed(2)} cells=${row.length} Δh=${heightDelta.toFixed(1)}`);
    }
    // Caption / legend line
    else if (hasCaptionKeyword) {
      classifications.push("caption-like");
      wasInTable = false;
      log(`[row ${rowIdx}] CAPTION  "${row[0]?.text.slice(0,50)}..."`);
    }
    // Normal text — also ends table mode
    else {
      classifications.push("text");
      wasInTable = false;
    }
  });

  return classifications;
}


function mergeHeaderRows(rows: IntfTextBlock[][]): IntfTextBlock[][] {
  const merged: IntfTextBlock[][] = [];
  let buffer: IntfTextBlock[] = [];

  for (const row of rows) {
    const hasNumeric = row.some(b => numericRatio(b.text) > 0.1);

    if (!hasNumeric) {
      buffer.push(...row);
      continue;
    }

    if (buffer.length) {
      merged.push(buffer);
      buffer = [];
    }

    merged.push(row);
  }

  if (buffer.length) merged.push(buffer);
  return merged;
}

// function clusterPositions(positions: number[], tolerance: number = 12): IntfCluster[] {
//   if (positions.length === 0) return [];
//   const sorted = [...positions].sort((a,b) => a - b);
//   const clusters: IntfCluster[] = [];
//   let current: IntfCluster = { center: sorted[0]!, items: [sorted[0]!], count: 1 };

//   for (let i = 1; i < sorted.length; i++) {
//     if (sorted[i]! - sorted[i-1]! <= tolerance) {
//       current.items.push(sorted[i]!);
//       current.count++;
//       current.center = current.items.reduce((s,v)=>s+v,0) / current.count;
//     } else {
//       clusters.push(current);
//       current = { center: sorted[i]!, items: [sorted[i]!], count: 1 };
//     }
//   }
//   clusters.push(current);
//   return clusters;
// }

export function detectBlockTypes(
  blocks: IntfTextBlock[],
  pageInfo: { width: number },
  debug?: boolean
): void {
  if (blocks.length === 0) return;

  if (debug) {
    console.log(`\n[detectBlockTypes] page width = ${pageInfo.width}px, ${blocks.length} blocks`);
  }

const rows = groupRows(blocks, 6); // tolerance 6 px for your ~10 pt height

console.log(`[Table Debug] ${rows.length} visual rows`);

rows.forEach((row, idx) => {
  if (row.length === 0) return;
  const y = row[0].bbox.y.toFixed(0);
  const leftXs = row.map(b => b.bbox.x.toFixed(0));
  const wTotal = row.reduce((s, b) => s + b.bbox.w, 0);
  const wFrac = (wTotal / pageInfo.width).toFixed(2);
  const xClusters = clusterPositions(leftXs.map(Number), 18); // tol 18 px

  console.log(
    `[Row ${idx}] y=${y} | blocks=${row.length} | leftXs=[${leftXs.join(', ')}] | wFrac=${wFrac} | clusters=${xClusters.length}`
  );

  // Simple heuristic for table row
  const isTableLike = wFrac > 0.5 && xClusters.length >= 2 && row.some(b => numericRatio(b.text) > 0.3);
  if (isTableLike) {
    console.log(`   → likely table row`);
    row.forEach(b => b.type = "table");
  }
});
throw new Error()
  /************************************ */

  // 1. Group into visual rows
  const rows2 = groupRows(blocks, 4);           // yTolerance = 4 px
  const mergedRows = mergeHeaderRows(rows);    // your existing logic

  if (debug) {
    console.log(`  → grouped into ${mergedRows.length} visual rows`);
  }

  // 2. Classify each row
  const rowTypes = classifyRowsAsTable(mergedRows, pageInfo.width, {
    debug,
    // You can override thresholds here when tuning
    // minTableWidthFrac: 0.58,
    // minNumericCellRatio: 0.28,
  });

  // 3. Assign types back to blocks
  mergedRows.forEach((row, i) => {
    const rowType = rowTypes[i];

    if (rowType === "table" || rowType === "header-like") {
      row.forEach(b => { b.type = "table"; });
    }
    else if (rowType === "caption-like") {
      row.forEach(b => { b.type = "caption"; });
    }
    else {
      // fallback — can be refined later (bullet, heading, paragraph…)
      row.forEach(b => {
        const t = b.text.trim();
        if (!t) {
          b.type = "decorative";
        } else if (b.isBold && b.fontSize > 14) {  // ← very rough example
          b.type = "heading";
        } else {
          b.type = "paragraph";   // or "text"
        }
      });
    }
  });

  if (debug) {
    console.log(`  → classified ${rowTypes.filter(t => t === "table").length} table rows`);
  }
}

// Helper: cluster x positions (left edges)
function clusterPositions(values: number[], tol = 18): number[] {
  if (values.length === 0) return [];
  const sorted = [...new Set(values.map(v => Math.round(v)))].sort((a,b) => a - b);
  const centers = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - centers[centers.length - 1] > tol) {
      centers.push(sorted[i]);
    }
  }
  return centers;
}

export function detectTableRegionsFromText(
  blocks: IntfTextBlock[],
  pageWidth: number,
  debug = false
): { regions: IntfTableRegion[], updatedBlocks: IntfTextBlock[] } {
  const updated = blocks.map(b => ({ ...b })); // copy
  const regions: IntfTableRegion[] = [];

  // Sort top to bottom (y descending = higher on page)
  updated.sort((a, b) => b.bbox.y - a.bbox.y);

  // Group visual rows (tolerance 6 px)
  const rows: { y: number; blocks: IntfTextBlock[] }[] = [];
  let currY = updated[0]?.bbox.y ?? 0;
  let currGroup: IntfTextBlock[] = [];

  for (const b of updated) {
    if (Math.abs(b.bbox.y - currY) <= 6) {
      currGroup.push(b);
    } else {
      if (currGroup.length > 0) rows.push({ y: currY, blocks: currGroup });
      currGroup = [b];
      currY = b.bbox.y;
    }
  }
  if (currGroup.length > 0) rows.push({ y: currY, blocks: currGroup });

  if (debug) console.log(`[TableDetect] ${rows.length} visual rows`);

  let currentRegion: { startIdx: number; blockIds: string[]; lastWidthFrac: number } | null = null;

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    if (row.blocks.length === 0) continue;

    const leftXs = row.blocks.map(b => b.bbox.x);
    const totalW = row.blocks.reduce((s, b) => s + b.bbox.w, 0);
    const wFrac = totalW / pageWidth;
    const xClusters = clusterPositions(leftXs);
    const hasNumbers = row.blocks.some(b => numericRatio(b.text) > 0.25);
    const hasTableKeyword = row.blocks.some(b => /جدول|جدول\s*شماره/i.test(b.text));

    // Core condition - allow single wide block if numeric & width similar to table
    let isTableRow = false;
    if (currentRegion) {
      // Continuation: similar width + numeric
      isTableRow = wFrac > 0.45 && hasNumbers && Math.abs(wFrac - currentRegion.lastWidthFrac) < 0.08;
    } else {
      // New start: stricter (clusters >= 2 or very wide numeric)
      isTableRow = wFrac > 0.5 && hasNumbers && (xClusters.length >= 2 || wFrac > 0.65);
    }

    if (debug) {
      console.log(
        `[Row ${ri}] y≈${row.y.toFixed(0)} | blocks=${row.blocks.length} | clusters=${xClusters.length} | wFrac=${wFrac.toFixed(2)} | nums=${hasNumbers} → ${isTableRow ? 'table row' : 'text'}`
      );
    }

    if (isTableRow) {
      if (!currentRegion) {
        currentRegion = { startIdx: ri, blockIds: [], lastWidthFrac: wFrac };
      }
      row.blocks.forEach(b => {
        currentRegion!.blockIds.push(b.id);
        b.type = "table";
      });
      currentRegion.lastWidthFrac = wFrac;
    } else {
      if (currentRegion && ri - currentRegion.startIdx >= 2) {
        const tableBlocks = updated.filter(u => currentRegion!.blockIds.includes(u.id));
        const minY = Math.min(...tableBlocks.map(b => b.bbox.y));
        const maxY = Math.max(...tableBlocks.map(b => b.bbox.y + b.bbox.h));
        const minX = Math.min(...tableBlocks.map(b => b.bbox.x));
        const maxX = Math.max(...tableBlocks.map(b => b.bbox.x + b.bbox.w));

        const region: IntfTableRegion = {
          id: crypto.randomUUID(),
          page: blocks[0]?.page ?? 0,
          bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
          confidence: 0.8,
          evidence: ["text-alignment", "numeric-density", "consecutive-rows"],
          blockIdsInside: currentRegion.blockIds,
          isBordered: false
        };
        regions.push(region);

        if (debug) {
          console.log(
            `[TABLE REGION] rows=${ri - currentRegion.startIdx} blocks=${currentRegion.blockIds.length} ` +
            `bbox x=${minX.toFixed(0)} y=${minY.toFixed(0)} w=${region.bbox.w.toFixed(0)} h=${region.bbox.h.toFixed(0)}`
          );
        }

        // Caption detection: look 1–2 rows above
        for (let lookback = 1; lookback <= 2 && currentRegion.startIdx - lookback >= 0; lookback++) {
          const prevRow = rows[currentRegion.startIdx - lookback];
          if (prevRow && prevRow.blocks.some(b => /جدول|جدول\s*شماره|Table/i.test(b.text))) {
            const capBlock = prevRow.blocks.find(b => /جدول/i.test(b.text)) || prevRow.blocks[0];
            region.captionBlockId = capBlock.id;
            capBlock.type = "caption";
            if (debug) console.log(`  └─ Caption: "${capBlock.text.slice(0, 60)}..."`);
            break;
          }
        }
      }
      currentRegion = null;
    }
  }

  // Close any open region at end
  if (currentRegion && rows.length - currentRegion.startIdx >= 2) {
    // same region push logic (copy from above)
  }

  return { regions, updatedBlocks: updated };
}



// ────────────────────────────────────────────────
// Block Merging & Paragraph Reconstruction
// ────────────────────────────────────────────────

// Helper ──────────────────────────────────────────────────────────────────────
function getMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const s = [...numbers].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1]! + s[m]!) / 2 : s[m]!;
}

function isEndsSentence(b: IntfTextBlock) {
  return /[.]$/.test(b.text.trim());
}

const BULLET_RE = /^([\-–—−•◦▪▫‣⁃]|[0-9]+[.)]|[۰-۹]+[.)])\s*/;

function detectBullet(b: IntfTextBlock): string | null {
  const m = b.text.trim().match(BULLET_RE);
  return m ? m[1]! : null;
}

function pageColumns(blocks: IntfTextBlock[], direction: "rtl" | "ltr" = "rtl"): IntfColumn[] {
  if (!blocks.length) return [];
  // Single-column: sort top → bottom
  const sorted = [...blocks].sort((a, b) => b.bbox.y - a.bbox.y);
  return [{
    blocks,
    boundary: {
      x: sorted[0]!.bbox.x,
      y: sorted[0]!.bbox.y,
      h: Math.abs(sorted[sorted.length - 1]!.bbox.y - sorted[0]!.bbox.y),
      w: Math.abs(sorted[sorted.length - 1]!.bbox.x - sorted[0]!.bbox.x)
    }
  }];
}

function mergeColumnBlocks(
  column: IntfTextBlock[],
  direction: "rtl" | "ltr" = "rtl",
  userOpts: IntfMergeOptions = {}
): IntfTextBlock[] {
  // Use your existing mergeIntoParagraphs logic
  return mergeIntoParagraphs(column, direction, userOpts);
}

function mergePageBlocks(
  pageBlocks: IntfTextBlock[],
  direction: "rtl" | "ltr" = "rtl",
  userOpts: IntfMergeOptions = {}
): IntfTextBlock[] {
  const columns = pageColumns(pageBlocks, direction);

  let merged: IntfTextBlock[] = [];

  for (const column of columns) {
    const mergedColumn = mergeColumnBlocks(column.blocks, direction, userOpts);
    merged = merged.concat(mergedColumn);
  }

  // Optional: final sort of merged paragraphs
  // top→bottom, then left→right (for multi-column)
  // merged.sort((a, b) => b.bbox.y - a.bbox.y || a.bbox.x - b.bbox.x);

  return merged;
}

function mergeIntoParagraphs(
  blocks: IntfTextBlock[],
  direction: "rtl" | "ltr" = "rtl",
  userOpts: IntfMergeOptions = {}
): IntfTextBlock[] {
  if (!blocks.length) return [];

  const opts = {
    debug: userOpts.debug ?? false,
    maxVerticalGapFactor: userOpts.maxVerticalGapFactor ?? 2.4,
    shortRatio: 0.78,
    sameLenRatio: 0.88,
    headingBoost: 1.15,
    driftPx: userOpts.maxHorizontalDrift ?? 42,
  };

  // Sort lines top → bottom (y descending)
  const lines = [...blocks].sort((a, b) => b.bbox.y - a.bbox.y);

  const vStats = computeLineSpacingStats(lines);
  const maxVG = vStats.medianGap * opts.maxVerticalGapFactor;

  const widths = lines.map(b => b.bbox.w);
  const typicalWidth = getMedian(widths);
  const bodyFont = getMedian(lines.map(b => b.fontSize ?? 12));

  const paragraphs: IntfTextBlock[] = [];

  let prevClosed = false;

  let activeBullet: { marker: string; block: IntfTextBlock } | null = null;

  type ActiveNumberedList = { lastNumber: number; block: IntfTextBlock; topY: number };
  let activeNumberedList: ActiveNumberedList | null = null;

  /* ───────────────────────────────────────────── */
  /* Helpers                                         */
  /* ───────────────────────────────────────────── */
  const widthRatio = (b: IntfTextBlock) => b.bbox.w / typicalWidth;
  const isShort = (b: IntfTextBlock) => widthRatio(b) <= opts.shortRatio;
  const sameLength = (a: IntfTextBlock, b: IntfTextBlock) =>
    Math.abs(widthRatio(a) - widthRatio(b)) <= 0.07 && widthRatio(a) >= opts.sameLenRatio;
  const sameStyle = (a: IntfTextBlock, b: IntfTextBlock) =>
    a.fontFamily === b.fontFamily &&
    Math.abs((a.fontSize ?? 12) - (b.fontSize ?? 12)) <= 1.5 &&
    a.isBold === b.isBold;
  const isHeading = (b: IntfTextBlock) =>
    b.type === "heading" ||
    b.type === "title" ||
    (b.isBold && (b.fontSize ?? bodyFont) > bodyFont * opts.headingBoost);
  const vGap = (p: IntfTextBlock, c: IntfTextBlock) => p.bbox.y - (c.bbox.y + c.bbox.h);

  type DriftKind = "NONE" | "FIRST_LINE" | "LAST_LINE";
  function detectDrift(prev: IntfTextBlock, cur: IntfTextBlock): DriftKind {
    if (direction === "rtl") {
      if (cur.bbox.x > prev.bbox.x + opts.driftPx) return "LAST_LINE";
      if (cur.bbox.x + cur.bbox.w < prev.bbox.x + prev.bbox.w - opts.driftPx) return "FIRST_LINE";
    } else {
      if (cur.bbox.x + cur.bbox.w < prev.bbox.x + prev.bbox.w - opts.driftPx) return "LAST_LINE";
      if (cur.bbox.x > prev.bbox.x + opts.driftPx) return "FIRST_LINE";
    }
    return "NONE";
  }

  function detectNumberedItem(line: IntfTextBlock): number | null {
    const t = line.text.replace(/[\u200B-\u200D\uFEFF]/g, "");
    const NUMBERING_PREFIX = /^((?:[\p{N}\p{Nd}]+|[IVXLCDM]+|[α-ωΑ-Ω]+)\s*[\.\)])\s*(?=\*\*|_)/u;
    let m = t.match(NUMBERING_PREFIX);
    if (m) return parseInt(m[1]!, 10);

    if (activeNumberedList) {
      m = t.match(NUMBERING_PREFIX);
      if (m) {
        const num = parseInt(m[1]!, 10);
        if (num === activeNumberedList.lastNumber + 1) return num;
      }
    }
    return null;
  }

  /* ───────────────────────────────────────────── */
  /* Main loop                                      */
  /* ───────────────────────────────────────────── */
  lines.forEach((line, idx) => {
    let attach = false;
    let rule = "INIT";

    const prev = paragraphs.at(-1);

    /* First line */
    if (!prev) {
      const short = isShort(line);
      if (short && !isEndsSentence(line)) {
        line.type = "heading";
        prevClosed = true;
      } else prevClosed = false;
      activeBullet = null;
      paragraphs.push({ ...line });
      if (opts.debug) console.log(`[${idx}] NEW  | first-line | "${line.text.slice(0, 40)}"`);
      return;
    }

    if (opts.debug) console.log(`[${idx}]-> ${line.text}`);

    /* NUMBERED LIST */
    const num = detectNumberedItem(line);
    if (num !== null) {
      line.type = "numbered";
      paragraphs.push({ ...line });
      prevClosed = true;
      activeNumberedList = { lastNumber: num, block: paragraphs.at(-1)!, topY: line.bbox.y };
      if (opts.debug)
        console.log(`[${idx}] NEW  | NUMBERED start | number=${num} | "${line.text.slice(0, 40)}"`);
      return;
    }

    /* NUMBERED CONTINUATION */
    if (activeNumberedList) {
      const gap = activeNumberedList.block.bbox.y - (line.bbox.y + line.bbox.h);
      if (gap <= maxVG && sameStyle(activeNumberedList.block, line)) {
        activeNumberedList.block.text += " " + line.text.trim();
        activeNumberedList.block.bbox.h =
          Math.max(activeNumberedList.block.bbox.y + activeNumberedList.block.bbox.h, line.bbox.y + line.bbox.h) -
          activeNumberedList.block.bbox.y;
        if (opts.debug)
          console.log(`[${idx}] MERGE | NUMBERED continuation | number=${activeNumberedList.lastNumber}`);
        return;
      } else activeNumberedList = null;
    }

    /* BULLET HANDLING */
    const bullet = detectBullet(line);
    if (bullet) {
      line.type = "bullet";
      paragraphs.push({ ...line });
      prevClosed = true;
      activeBullet = { marker: bullet, block: paragraphs.at(-1)! };
      if (opts.debug) console.log(`[${idx}] NEW  | BULLET start (${bullet})`);
      return;
    }

    if (activeBullet) {
      const gap = vGap(activeBullet.block, line);
      const drift = detectDrift(activeBullet.block, line);
      if (gap <= maxVG && drift !== "FIRST_LINE" && sameStyle(activeBullet.block, line)) {
        activeBullet.block.text += " " + line.text.trim();
        activeBullet.block.bbox.y = Math.min(activeBullet.block.bbox.y, line.bbox.y);
        activeBullet.block.bbox.h =
          Math.max(activeBullet.block.bbox.y + activeBullet.block.bbox.h, line.bbox.y + line.bbox.h) -
          activeBullet.block.bbox.y;
        if (opts.debug) console.log(`[${idx}] MERGE | BULLET continuation`);
        return;
      }
      activeBullet = null;
    }

    /* ───────────────────────────────────────────── */
    const gap = vGap(prev, line);
    const short = isShort(line);
    const sameLen = sameLength(prev, line);
    const drift = detectDrift(prev, line);
    const head = isHeading(line);
    const prevHead = isHeading(prev);

    const canAttach = !prevClosed;

    /* RULES */
    if (head) {
      if (prevHead && sameStyle(prev, line) && canAttach) {
        attach = true;
        rule = "H1 heading-continuation";
      } else {
        attach = false;
        prevClosed = true;
        activeBullet = null;
        rule = "H2 new-heading";
      }
    } else if (short && drift === "LAST_LINE") {
      attach = true; // merge last fragment
      prevClosed = true; // stop further merging
      rule = "J1 justified-last-line";
    } else if (line.isBold && short) {
      if (gap >= vStats.medianGap * 1.05 || !prev.isBold) {
        line.type = "heading";
        attach = false;
        prevClosed = true;
        rule = "B1 virtual-heading";
      } else if (canAttach) {
        attach = true;
        rule = "B2 bold-continuation";
      }
    } else if (canAttach && sameLen && sameStyle(prev, line) && gap <= maxVG) {
      attach = true;
      rule = "S1 same-length";
    } else if (canAttach && gap <= maxVG && sameStyle(prev, line)) {
      attach = true;
      rule = "P1 normal-continuation";
    } else {
      attach = false;
      prevClosed = false;
      activeBullet = null;
      rule = "X break";
    }

    /* DEBUG */
    if (opts.debug)
      console.log(
        `[${idx}] ${attach ? "MERGE" : "NEW "} | ${rule.padEnd(24)} | gap=${gap.toFixed(
          1
        )}, short=${short} sameLen=${sameLen} drift=${drift}`
      );

    /* APPLY */
    if (attach) {
      prev.text += " " + line.text.trim();
      prev.bbox.x = Math.min(prev.bbox.x, line.bbox.x);
      prev.bbox.y = Math.min(prev.bbox.y, line.bbox.y);
      prev.bbox.w =
        Math.max(prev.bbox.x + prev.bbox.w, line.bbox.x + line.bbox.w) - prev.bbox.x;
      prev.bbox.h =
        Math.max(prev.bbox.y + prev.bbox.h, line.bbox.y + line.bbox.h) - prev.bbox.y;
    } else paragraphs.push({ ...line });
  });

  return paragraphs;
}

/************************* */

function blocksToMarkdown(blocks: IntfTextBlock[]): string {
  let md = "";
  for (const b of blocks) {
    const t = b.text.trim();
    if (!t) continue;

    if (b.type === "title") md += `# ${t}\n\n`;
    else if (b.type === "list") md += `- ${t}\n`;
    else if (b.type === "caption") md += `_${t}_\n\n`;
    else if (b.isBold) md += `**${t}**\n\n`;
    else if (b.isItalic) md += `*${t}*\n\n`;
    else md += `${t}\n\n---\n\n`;
  }
  return md.trim();
}

// ────────────────────────────────────────────────
// Main Extraction Logic (shared)
// ────────────────────────────────────────────────
async function processPage(
  pageNumber: number,
  pdf: any,
  maxChars?: number,
  stripOptions: IntfPageStripOptions = DEFAULT_STRIP_OPTIONS,
  debug?: boolean
): Promise<{
  markdown: string;
  blocks: IntfTextBlock[];
  reachedLimit: boolean;
}> {
  if (debug) console.log(`[Page ${pageNumber}] Processing started`);

  const pageInfo = await getPageInfo(pdf, pageNumber);
  if (debug) console.log(`Page ${pageNumber} ruling lines summary:`, pageInfo.rulingLines?.stats);

  const pageHeight = pageInfo.height;
  if (!pageHeight || pageHeight <= 0)
    throw new Error(`[Page ${pageNumber}] Invalid page height: ${pageHeight}`);


  const nativeBlocks = await extractNativeTextBlocks(pageInfo, true);
  if (debug) console.log(`[Page ${pageNumber}] native blocks count: ${nativeBlocks.length}`);

  // nativeBlocks.map((b,i)=>console.log(`${i}=>${b.text}`, b.text.split('')))
  // throw new Error()

  // stubs — replace with real implementation when ready
  const image = await rasterizePage(pageInfo);
  const layout = await detectLayoutBlocks();           // stub → []
  const ocrBlocks = await ocrMissingBlocks();         // stub → []

  // Combine — you might want to do smarter merging later
  const allBlocks = [...nativeBlocks, ...ocrBlocks]

  // Sort top-to-bottom once (pdf.js y increases upward → higher y = higher on page)
  const allBlocksSortedByY = [...allBlocks].sort((a, b) => b.bbox.y - a.bbox.y);

  // ── Header/Footer filtering ─────────────────────────────────────────────
  // For now: no previous/next blocks available → repeating detection is off
  const nextPageBlocks: IntfTextBlock[] = []
  const prevPageBlocks: IntfTextBlock[] = []

  const filteredBlocks = filterHeaderFooter(
    allBlocksSortedByY,
    prevPageBlocks || [],
    nextPageBlocks || [],
    pageInfo.height,
    pageInfo.width,
    stripOptions,
  );
  if (debug) console.log(`[Page ${pageNumber}] Before merging: ${filteredBlocks.length} blocks`);
  const pageDirection = determinePageDirection(filteredBlocks);

  detectBlockTypes(filteredBlocks, pageInfo, true)

  console.log({filteredBlocks})
  throw new Error()

  const pageParagraphs = mergePageBlocks(
    filteredBlocks, pageDirection, {
    debug: true,
    maxVerticalGapFactor: 2.3,
    minHorizontalOverlap: 0.65,
    maxHorizontalDrift: 38,
    sameColumnXDelta: 22,
  })

  console.log({ pageParagraphs })
  throw new Error()
  /********************** */
  console.log(`[DEBUG] Blocks before merge (page ${pageNumber}):`);
  sortedForMerge.slice(0, 20).forEach((b, i) => {
    console.log(
      `${i}. y=${b.bbox.y.toFixed(1)} h=${b.bbox.h.toFixed(1)} x=${b.bbox.x.toFixed(1)} | "${b.text.slice(0, 40)}"`
    );
  });
  /********************** */

  const pageMarkdown = blocksToMarkdown(ordered) + `\n\n<!-- PAGE ${pageNumber} -->\n\n`;

  const reachedLimit = maxChars !== undefined && pageMarkdown.length >= maxChars;

  console.log(`[Page ${pageNumber}] ${ordered.length} final blocks | direction: ${pageDirection} | chars: ${pageMarkdown.length}`);

  return {
    markdown: pageMarkdown,
    blocks: ordered,
    reachedLimit,
  };
}

// ────────────────────────────────────────────────
// Exported APIs
// ────────────────────────────────────────────────

interface ExtractResult {
  meta: { pageCount: number; title?: string };
  stripped: boolean;
  blocks: IntfTextBlock[];
  text: string;
}

export async function extractFromPDF(
  file: IntfUploadedMeta,
  options: {
    fromPage?: number;
    toPage?: number;
    maxChars?: number;
    headerRatio?: number;
    footerRatio?: number;
    autoHeader?: boolean;
  } = {}
): Promise<ExtractResult> {
  const { pdf, pageCount, title } = await loadPdfDocument(file.path);

  const start = (options.fromPage ?? 0) + 1;
  const end = options.toPage ? Math.min(options.toPage + 1, pageCount) : pageCount;

  let text = "";
  let allBlocks: IntfTextBlock[] = [];
  let stripped = false;

  for (let p = start; p <= end; p++) {
    const { markdown, blocks, reachedLimit } = await processPage(
      p,
      pdf,
      options.maxChars,
      {
        ...DEFAULT_STRIP_OPTIONS,
        headerRatio: options.headerRatio,
        footerRatio: options.footerRatio,
        enableLogging: true,
      },
      true // debug
    );

    text += markdown;
    allBlocks.push(...blocks);

    if (reachedLimit) {
      text = text.slice(0, options.maxChars! - 6) + " [...]";
      stripped = true;
      break;
    }
  }

  return {
    meta: { pageCount, title },
    stripped,
    blocks: allBlocks,
    text,
  };
}

export async function extractFromPDFInteractive(
  file: IntfUploadedMeta,
  onPage?: (pageNumber: number, pageText: string, totalPages: number) => Promise<void>,
  options: {
    fromPage?: number;
    toPage?: number;
    headerRatio?: number;
    footerRatio?: number;
    autoHeader?: boolean;
  } = {}
): Promise<void> {
  const { pdf, pageCount } = await loadPdfDocument(file.path);

  const start = (options.fromPage ?? 0) + 1;
  const end = options.toPage ? Math.min(options.toPage + 1, pageCount) : pageCount;

  for (let p = 1; p <= pageCount; p++) {
    if (p < start || (end && p > end)) continue;

    const { markdown } = await processPage(
      p,
      pdf,
      undefined,
      {
        ...DEFAULT_STRIP_OPTIONS,
        headerRatio: options.headerRatio,
        footerRatio: options.footerRatio,
        enableLogging: true,

      }
    );

    //@TODO check this
    const cleanText = markdown
      .replace(/<!-- PAGE \d+ -->[\s\S]*$/, "")
      .replace(/---\n\n/g, "\n\n")
      .trim();

    await onPage?.(p, cleanText, pageCount);
  }
}
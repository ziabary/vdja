import { DEFAULT_STRIP_OPTIONS } from "./configs";
import type { IntfPageStripOptions, IntfTextBlock } from "./interfaces";

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
  // eslint-disable-next-line no-console
  const debugLog = opts.enableLogging ? console.log : () => { };

  const pageNum = blocks[0]?.page ?? '?';

  debugLog(`[Page ${pageNum}] filterHeaderFooter – page ${pageHeight.toFixed(1)} × ${pageWidth.toFixed(1)}`);

  // Zones ────────────────────────────────────────────────────────────
  const headerCutoffY = pageHeight * (1 - (opts.headerRatio ?? 0.085));
  const footerCutoffY = pageHeight * (opts.footerRatio ?? 0.085);
  const safeBodyMinY = headerCutoffY - 15;   // small overlap tolerance
  const safeBodyMaxY = footerCutoffY + 15;

  debugLog(`header zone     : yTop  > ${headerCutoffY.toFixed(1)}`);
  debugLog(`footer zone     : yBot  < ${footerCutoffY.toFixed(1)}`);
  debugLog(`body protection : ${safeBodyMinY.toFixed(1)} ≤ yTop ≤ ${safeBodyMaxY.toFixed(1)}`);

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

      const isVeryTiny = c.relArea < 0.0004;                    // ~0.04% of page
      const isExtremelyNarrow = c.widthFrac < 0.12;                 // <12% width
      const looksLikePageNum = /^\d{1,3}$|^\d+\s*[a-zآ-ی]$/i.test(c.block.text.trim());
      const highRepeatCount = repeatFreq.get(c.normText) ?? 0 >= 4;

      if (isVeryTiny && (isExtremelyNarrow || looksLikePageNum || highRepeatCount)) {
        remove = true;
        reason = `body watermark-like (tiny + narrow/repeat/page-num)`;
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
      debugLog(`[REMOVED] y=${yTopStr} | w=${wFrac} | "${c.snippet}" → ${reason}`);
    } else {
      kept.push(c);
      prevBottomY = Math.min(prevBottomY, c.yBottom);
      debugLog(`[KEPT   ] y=${yTopStr} | w=${wFrac} | "${c.snippet}"`);
    }
  }

  debugLog(`[Page ${pageNum}] Summary: kept ${kept.length} / ${blocks.length}  removed ${removed.length}`);

  if (removed.length > 0) {
    debugLog(`Removed details:`);
    removed.forEach(r => {
      debugLog(`  • y=${r.yTop.toFixed(1)} | w=${r.widthFrac} | ${r.reason} | "${r.snippet}"`);
    });
  }

  return kept.map(c => c.block).sort((a, b) => b.bbox.y - a.bbox.y);
}
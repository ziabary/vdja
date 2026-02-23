import { median } from "./common";
import type { IntfTextBlock } from "./interfaces";

// ────────────────────────────────────────────────
// Step 5 – Unit-test-style invariants (debug-time)
// ────────────────────────────────────────────────
function assertInvariant(
  cond: boolean,
  message: string,
  context?: unknown
) {
  if (!cond) {
    // eslint-disable-next-line no-console
    console.warn("[STEP5][INVARIANT FAILED]", message, context);
  }
}

// ────────────────────────────────────────────────
// Step 5 – Paragraph-merge invariants (P1–P6)
// ────────────────────────────────────────────────
function assertParMergeInvariant(
  cond: boolean,
  code: "P1" | "P2" | "P3" | "P4" | "P5" | "P6",
  message: string,
  context?: unknown
) {
  if (!cond) {
    // eslint-disable-next-line no-console
    console.warn(`[STEP5][${code}]`, message, context);
  }
}

function horizontalOverlap(a: IntfTextBlock, b: IntfTextBlock): number {
  const left = Math.max(a.bbox.x, b.bbox.x);
  const right = Math.min(a.bbox.x + a.bbox.w, b.bbox.x + b.bbox.w);
  return Math.max(0, right - left);
}

function sameColumn(a: IntfTextBlock, b: IntfTextBlock): boolean {
  const dx = Math.abs(a.bbox.x - b.bbox.x);
  return dx < Math.min(a.bbox.w, b.bbox.w) * 0.25;
}

export function assertParagraphInvariants(
  paragraph: IntfTextBlock[],
  opts: { debug?: boolean } = {}
) {
  if (!paragraph.length) return;

  // P1 – Paragraph must contain text
  const text = paragraph.map(b => b.text).join("").trim();
  assertParMergeInvariant(
    text.length > 0,
    "P1",
    "Empty paragraph after merge",
    paragraph
  );

  for (let i = 1; i < paragraph.length; i++) {
    const prev = paragraph[i - 1]!;
    const cur  = paragraph[i]!;

    // P2 – Vertical continuity
    const vGap = cur.bbox.y - (prev.bbox.y + prev.bbox.h);
    const maxGap = Math.max(prev.bbox.h, cur.bbox.h) * 1.8;
    assertParMergeInvariant(
      vGap <= maxGap,
      "P2",
      "Vertical gap too large for same paragraph",
      { vGap, maxGap, prev, cur }
    );

    // P3 – Horizontal overlap
    const overlap = horizontalOverlap(prev, cur);
    const minW = Math.min(prev.bbox.w, cur.bbox.w);
    assertParMergeInvariant(
      overlap >= minW * 0.4,
      "P3",
      "Insufficient horizontal overlap",
      { overlap, prev, cur }
    );

    // P4 – Column consistency
    assertParMergeInvariant(
      sameColumn(prev, cur),
      "P4",
      "Merged lines from different columns",
      { prev, cur }
    );

    // P5 – Full-width consistency (allow first-line indent)
    if (i > 1) {
      assertParMergeInvariant(
        prev.isFullWidth === cur.isFullWidth,
        "P5",
        "Inconsistent full-width lines inside paragraph",
        { prev, cur }
      );
    }

    // P6 – Direction consistency
    assertParMergeInvariant(
      prev.isRTL === cur.isRTL,
      "P6",
      "Mixed RTL/LTR inside paragraph",
      { prev, cur }
    );
  }
}

function recoverPersianSpaces(text: string): string {
  return text
    // digit ↔ letter boundaries
    .replace(/([0-9۰-۹])([^\s0-9۰-۹])/g, "$1 $2")
    .replace(/([^\s0-9۰-۹])([0-9۰-۹])/g, "$1 $2")

    // punctuation spacing
    .replace(/([،؛:.!?»])([^\s])/g, "$1 $2")
    .replace(/([^\s])([«])/g, "$1 $2")

    // Latin runs (MVP, GPU, etc.)
    .replace(/([آ-ی])([A-Za-z])/g, "$1 $2")
    .replace(/([A-Za-z])([آ-ی])/g, "$1 $2")

    // collapse
    .replace(/\s+/g, " ")
    .trim();
}

function cleanPDFArtifacts(text: string): string {
  return text
    // Remove spurious non-printable ASCII controls (0x00-0x1F), except tab/newline if needed
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    // Remove PDF-specific ligature / extraction junk (\x05, \x0D leftovers)
    .replace(/[\x0D\x05]/g, "")
    // Collapse multiple spaces
    .replace(/\s+/g, " ")
    .trim();
}

export function reconstructLineFromGlyphs(block: IntfTextBlock): void {
  const glyphs = block.glyphs?.filter(g => !g.virtualSpace) || [];
  if (!glyphs || !glyphs.length) return;

  const persianLetters = /[\u0600-\u06FF]/;
  let runs: Partial<IntfTextBlock>[] = [];
  let currentRun: Partial<IntfTextBlock> | null = null;

  // Compute dynamic threshold based on glyph width/height if needed
  const heights = glyphs.map(g => g.h).filter(Boolean);
  const widths  = glyphs.map(g => g.w).filter(Boolean);
  const medianH = heights.length ? median(heights) : 0;
  const medianW = widths.length ? median(widths) : 0;

  // Dynamic spacing threshold (robust across fonts / RTL / LTR)
  const spaceThreshold = Math.max(
    medianW * 0.6,
    medianH * 0.8,
    2
  );

  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i]!;
    const prev = glyphs[i - 1];

    const sameStyle =
      currentRun &&
      currentRun.isBold === g.isBold &&
      currentRun.isItalic === g.isItalic &&
      currentRun.fontFamily === g.realFontName;

    if (!sameStyle) {
      if (currentRun) runs.push(currentRun);
      currentRun = { text: "", isBold: g.isBold, isItalic: g.isItalic, fontFamily: g.realFontName };
    }

    if (prev && currentRun) {
      const gap = block.isRTL
        ? prev.x - (g.x + g.w)
        : g.x - (prev.x + prev.w);

      if (gap > spaceThreshold) 
        currentRun.text += " ";

      // ─── Invariant L2: visual order monotonicity ───
      assertInvariant(
        block.isRTL
          ? prev.x >= g.x
          : prev.x <= g.x,
        "Glyph order violates reading direction",
        { blockId: block.id, prevX: prev.x, curX: g.x }
      );      
    }

    if(currentRun)
      currentRun.text += g.text;
  }
  if (currentRun) runs.push(currentRun);

  let lineText = runs.map(r => {
    let t = r.text;
    if (r.isBold) t = `**${t}**`;
    if (r.isItalic) t = `_${t}_`;
    return t;
  }).join("");

  lineText = recoverPersianSpaces(lineText);
  lineText = cleanPDFArtifacts(lineText);

  block.text = lineText;

  // ─── Invariant L1: glyphs must produce text ───
  assertInvariant(
    glyphs.length === 0 || block.text.length > 0,
    "Glyphs present but reconstructed text is empty",
    block.id
  );

  // ─── Invariant L3: no consecutive spaces ───
  assertInvariant(
    !/\s{2,}/.test(block.text),
    "Multiple consecutive spaces in reconstructed line",
    block.text
  );

  // Line geometry metadata (used in paragraph merging)
  block.bbox.y = Math.min(...glyphs.map(g => g.y));
  block.bbox.h = medianH || Math.max(...glyphs.map(g => g.h));
  block.bbox.x = Math.min(...glyphs.map(g => g.x));
  block.bbox.w = Math.max(...glyphs.map(g => g.x + g.w)) - block.bbox.x;

  block.isFullWidth = block.bbox.w >= block.bbox.w * 0.85;

  // ─── Invariant L4: geometry must be sane ───
  assertInvariant(
    block.bbox.w > 0 && block.bbox.h > 0,
    "Invalid line bounding box",
    { blockId: block.id, bbox: block.bbox }
  );

  // Recompute dominant font
  const fontCounts = new Map<string, number>();
  glyphs.forEach(g => fontCounts.set(g.realFontName, (fontCounts.get(g.realFontName) || 0) + 1));
  let dominantFont = "Unknown";
  let maxCount = 0;
  for (const [f, c] of fontCounts.entries()) {
    if (c > maxCount) { maxCount = c; dominantFont = f; }
  }
  block.fontFamily = dominantFont.replace(/^[A-Z0-9]{6}\+/, "").trim();

  // ─── Invariant L5: resolved font family ───
  assertInvariant(
    block.fontFamily.length > 0 && block.fontFamily !== "Unknown",
    "Unresolved dominant font family",
    { blockId: block.id, font: block.fontFamily }
  );
}
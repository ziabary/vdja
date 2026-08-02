import { getMedian, isEndsSentence } from "./common";
import type { IntfLineSpacingStats, IntfMergeOptions, IntfTextBlock } from "./interfaces";

const NUMBERING_PREFIX = /^((?:[\p{N}\p{Nd}]+|[IVXLCDM]+|[α-ωΑ-Ω]+)\s*[\.\)])\s*(?=\*\*|_)/u;
const BULLET_RE = /^([\-–—−•◦▪▫‣⁃]|[0-9]+[.)]|[۰-۹]+[.)])\s*/;

function detectBullet(b: IntfTextBlock): string | null {
  const m = b.text.trim().match(BULLET_RE);
  return m ? m[1]! : null;
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

export default function mergeIntoParagraphs(
  blocks: IntfTextBlock[],
  direction: "rtl" | "ltr" = "rtl",
  userOpts: IntfMergeOptions = {},
  debug?: boolean
): IntfTextBlock[] {
  if (!blocks.length) return [];
  // eslint-disable-next-line no-console
  const debugLog = debug ? console.log : ()=>{}

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
      debugLog(`[${idx}] NEW  | first-line | "${line.text.slice(0, 40)}"`);
      return;
    }

    debugLog(`[${idx}]-> ${line.text}`);

    /* NUMBERED LIST */
    const num = detectNumberedItem(line);
    if (num !== null) {
      line.type = "numbered";
      paragraphs.push({ ...line });
      prevClosed = true;
      activeNumberedList = { lastNumber: num, block: paragraphs.at(-1)!, topY: line.bbox.y };
      debugLog(`[${idx}] NEW  | NUMBERED start | number=${num} | "${line.text.slice(0, 40)}"`);
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
        debugLog(`[${idx}] MERGE | NUMBERED continuation | number=${activeNumberedList.lastNumber}`);
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
      debugLog(`[${idx}] NEW  | BULLET start (${bullet})`);
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
        debugLog(`[${idx}] MERGE | BULLET continuation`);
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
      debugLog(
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

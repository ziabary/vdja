/* eslint-disable no-console */

import { mad, median } from "./common";
import type {
  TypAxis,
  IntfBlockBox,
  IntfXYCutOptions,
  IntfTextBlock,
  IntfXYCutResult,
  IntfPageGeometry
} from "./interfaces";

function estimateColumnCount(blocks: IntfTextBlock[]): number {
  const centers = blocks.map(b => b.bbox.x + b.bbox.w / 2)
  centers.sort((a, b) => a - b)

  if (centers.length < 4) return 1

  const gaps = []
  for (let i = 1; i < centers.length; i++) {
    gaps.push(centers[i]! - centers[i - 1]!)
  }

  const medianGap = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)]!
  const largeGaps = gaps.filter(g => g > medianGap * 2)

  return Math.min(1 + largeGaps.length, 4)
}

function findAdaptiveGaps(
  blocks: IntfTextBlock[],
  axis: TypAxis
): { start: number; end: number; size: number }[] {

  // Only consider blocks with real glyphs (ignore visual-only noise)
  const filteredBlocks = blocks.filter(b =>
    b.glyphs.some(g => !g.virtualSpace)
  );

  const intervals = filteredBlocks.map(b =>
    axis === "x" ? [b.bbox.x, b.bbox.x + b.bbox.w] : [b.bbox.y, b.bbox.y + b.bbox.h]
  ).sort((a, b) => a[0]! - b[0]!);

  if (intervals.length < 2) return [];

  const rawGaps: { start: number; end: number; size: number }[] = [];
  let prevEnd = intervals[0]![1]!;

  for (let i = 1; i < intervals.length; i++) {
    const [s, e] = intervals[i]!;
    const gap = s! - prevEnd;
    if (gap > 0) rawGaps.push({ start: prevEnd, end: s!, size: gap });
    prevEnd = Math.max(prevEnd, e!);
  }

  if (rawGaps.length === 0) return [];

  // --- dynamic robust threshold using median + MAD ---
  const sizes = rawGaps.map(g => g.size);
  const medianSize = median(sizes);
  const madSize = mad(sizes);
  // Vertical gaps are naturally larger → relax threshold
  const factor = axis === "y" ? 1.2 : 2;
  const threshold = medianSize + factor * madSize;

  return rawGaps.filter(g => g.size >= threshold);
}

function shouldVetoCut(
  blocks: IntfTextBlock[],
  axis: "x" | "y",
  gapMid: number,
  opts?: IntfXYCutOptions
): boolean {

  const maxGlyphDensity = opts?.maxGlyphDensity ?? 0.02;
  const maxFontSizeVariance = opts?.maxFontSizeVariance ?? 3;

  // veto if splitting high-density text blocks
  const vetoSignals: unknown[] = []
  const crossing = blocks.filter(b => {
    const s = axis === "x" ? b.bbox.x : b.bbox.y;
    const e = axis === "x" ? b.bbox.x + b.bbox.w : b.bbox.y + b.bbox.h;

    if (!(s < gapMid && e > gapMid)) return false;

    // compute block-level signals
    const realGlyphs = b.glyphs.filter(g => !g.virtualSpace);
    if (!realGlyphs.length) return false;

    const density = b.glyphDensity ?? (realGlyphs.length / (b.bbox.w * b.bbox.h));
    const fontSizes = realGlyphs.map(g => g.h);
    const fontVar = fontSizes.length ? Math.max(...fontSizes) - Math.min(...fontSizes) : 0;

    const veto =
      density > maxGlyphDensity ||
      fontVar > maxFontSizeVariance

    if (veto && opts?.debug) {
      vetoSignals.push({
        blockId: b.id,
        axis,
        gapMid,
        density,
        fontVar,
        bbox: b.bbox
      })
    }

    return veto
  })

  if (crossing.length > 0) {
    if (opts?.debug) {
      console.log(`[XYCUT][VETO]`, {
        axis,
        gapMid,
        crossing: crossing.length,
        total: blocks.length,
        signals: vetoSignals
      });
    }
    return true;
  }

  return false;
}


// ────────────────────────────────────────────────
function blockRight(b: IntfTextBlock) { return b.bbox.x + b.bbox.w }
function blockTop(b: IntfTextBlock) { return b.bbox.y + b.bbox.h }

function unionBBox(blocks: IntfTextBlock[]): IntfBlockBox {
  const allGlyphs = blocks.flatMap(b => b.glyphs.filter(g => !g.virtualSpace));
  if (allGlyphs.length === 0) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }

  const xs = allGlyphs.map(g => g.x);
  const ys = allGlyphs.map(g => g.y);
  const xe = allGlyphs.map(g => g.x + g.w);
  const ye = allGlyphs.map(g => g.y + g.h);

  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xe) - Math.min(...xs),
    h: Math.max(...ye) - Math.min(...ys),
  };
}

// ────────────────────────────────────────────────
function findProjectionGaps(
  blocks: IntfTextBlock[],
  axis: TypAxis,
  minGap: number
): { start: number; end: number }[] {

  const intervals = blocks.map(b => {
    if (axis === "x") {
      return [b.bbox.x, b.bbox.x + b.bbox.w]
    } else {
      return [b.bbox.y, b.bbox.y + b.bbox.h]
    }
  }).sort((a, b) => a[0]! - b[0]!)

  const gaps: { start: number; end: number }[] = []
  let prevEnd = intervals[0]![1]!

  for (let i = 1; i < intervals.length; i++) {
    const [s, e] = intervals[i]!
    if (s! - prevEnd >= minGap) {
      gaps.push({ start: prevEnd, end: s! })
    }
    prevEnd = Math.max(prevEnd, e!)
  }

  return gaps
}

interface IntfGap {
  start: number;
  end: number;
  size: number
}

interface intfBestGap {
  gap: IntfGap
  mid: number
  a: IntfTextBlock[]
  b: IntfTextBlock[]
  score: number
}


function chooseBestGap(
  gaps: IntfGap[],
  blocks: IntfTextBlock[],
  axis: TypAxis,
  minBlocksPerSide: number,
  opts?: IntfXYCutOptions | undefined
): intfBestGap | null {
  let best: intfBestGap | null = null

  const blockHeights = blocks.map(b => b.bbox.h)
  const medianHeight = median(blockHeights)

  // Vertical cut must exceed typical line height significantly
  const structuralThreshold = medianHeight * 1.8

  for (const g of gaps) {

    // --- NEW: skip normal line spacing ---
    if (g.end - g.start < structuralThreshold) {
      continue
    }
    const mid = (g.start + g.end) / 2
    const veto = shouldVetoCut(blocks, axis, mid, opts)

    const a = blocks.filter(b => axis === "x" ? blockRight(b) <= mid : blockTop(b) <= mid)
    const b = blocks.filter(b => axis === "x" ? b.bbox.x >= mid : b.bbox.y >= mid)

    const rtlA = a.filter(b => b.isRTL).length
    const rtlB = b.filter(b => b.isRTL).length
    const ltrA = a.length - rtlA
    const ltrB = b.length - rtlB

    // penalize splitting mixed-direction columns
    const alignmentPenalty =
      Math.min(rtlA, ltrA) + Math.min(rtlB, ltrB)

    // ─── Column balance bonus (X-axis only) ───
    let columnBonus = 0
    if (axis === "x") {
      const left = blocks.filter(bb => bb.bbox.x + bb.bbox.w / 2 < mid).length
      const right = blocks.length - left
      columnBonus = -Math.abs(left - right)
    }
    const balance = Math.abs(a.length - b.length)
    const score =
      g.size * 10 -
      balance -
      alignmentPenalty * 5 +
      columnBonus

    if (opts?.debug)
      console.log(`[XYCUT][GAP]`, {
        axis,
        mid,
        gapSize: g.size,
        a: a.length,
        b: b.length,
        balance,
        veto,
        alignmentPenalty,
        columnBonus,
        score
      })

    if (veto) continue

    const adaptiveMinBlocks = Math.max(minBlocksPerSide, Math.floor(blocks.length * 0.05)) // 5% of total blocks
    if (a.length < adaptiveMinBlocks || b.length < adaptiveMinBlocks) continue

    if (!best || score > best.score)
      best = { gap: g, mid, a, b, score }
  }

  return best
}

// ────────────────────────────────────────────────
function xyCutRecursive(
  blocks: IntfTextBlock[],
  pageBBox: IntfBlockBox,
  depth: number,
  opts: IntfXYCutOptions,
  renders: string[]
): IntfXYCutResult[] {

  const {
    minGapRatio = 0.02,
    minBlocksPerSide = 2,
    maxDepth = 10,
    debug = false,
    render = false
  } = opts

  if (blocks.length <= minBlocksPerSide || depth >= maxDepth) {
    return [{ blocks, bbox: unionBBox(blocks), depth }]
  }

  const colCount = estimateColumnCount(blocks)

  // X first if multi-column
  const allowX = colCount > 1

  const gapsX = allowX ? findAdaptiveGaps(blocks, "x") : []
  const gapsY = findAdaptiveGaps(blocks, "y")

  if (opts.debug) console.log(
    `[XYCUT][depth=${depth}] blocks=${blocks.length}`,
    { gapsX: gapsX.length, gapsY: gapsY.length }
  )

  if (render) renders.push(`[XYCUT][depth=${depth}] gapsX=${gapsX.length} gapsY=${gapsY.length}`)

  const bestX = allowX ? chooseBestGap(gapsX, blocks, "x", minBlocksPerSide, opts) : null
  const bestY = chooseBestGap(gapsY, blocks, "y", minBlocksPerSide, opts)

  const chosen =
    !bestX ? bestY :
      !bestY ? bestX :
        bestX.score > bestY.score ? bestX : bestY

  if (!chosen) {
    return [{ blocks, bbox: unionBBox(blocks), depth }]
  }

  // --- recurse on chosen blocks ---
  const results: IntfXYCutResult[] = [
    ...xyCutRecursive(chosen.a, pageBBox, depth + 1, opts, renders),
    ...xyCutRecursive(chosen.b, pageBBox, depth + 1, opts, renders)
  ];

  // --- compute region features robustly ---
  return results.map(r => {
    const allBlocks = r.blocks;
    const regionBBox = unionBBox(allBlocks);
    const allGlyphs = allBlocks.flatMap(b => b.glyphs.filter(g => !g.virtualSpace));
    const glyphCount = allGlyphs.length;
    const glyphAreaSum = allGlyphs.reduce((s, g) => s + g.w * g.h, 0);
    const regionArea = regionBBox.w * regionBBox.h;

    const blockAreas = allBlocks.map(b => b.bbox.w * b.bbox.h);
    const avgBlockArea = blockAreas.reduce((s, a) => s + a, 0) / blockAreas.length;
    const blockAreaVariance = blockAreas.reduce((s, a) => s + (a - avgBlockArea) ** 2, 0) / blockAreas.length;

    const fontSizes = allBlocks.map(b => b.fontSize);
    const avgFontSize = fontSizes.reduce((s, a) => s + a, 0) / fontSizes.length;
    const fontSizeVariance = fontSizes.reduce((s, a) => s + (a - avgFontSize) ** 2, 0) / fontSizes.length;

    return {
      ...r,
      features: {
        regionArea,
        blockCount: allBlocks.length,
        totalBlockArea: blockAreas.reduce((s, a) => s + a, 0),
        blockCoverageRatio: blockAreas.reduce((s, a) => s + a, 0) / regionArea,
        avgBlockArea,
        blockAreaVariance,
        glyphCount,
        glyphAreaSum,
        glyphDensity: glyphCount / regionArea,
        avgFontSize,
        fontSizeVariance,
        fontFamilyCount: new Set(allBlocks.map(b => b.fontFamily)).size,
        boldRatio: allBlocks.filter(b => b.isBold).length / allBlocks.length,
        italicRatio: allBlocks.filter(b => b.isItalic).length / allBlocks.length,
        xStarts: allBlocks.map(b => b.bbox.x),
        xEnds: allBlocks.map(b => b.bbox.x + b.bbox.w),
        yStarts: allBlocks.map(b => b.bbox.y),
        yEnds: allBlocks.map(b => b.bbox.y + b.bbox.h),
        xCenters: allBlocks.map(b => b.bbox.x + b.bbox.w / 2),
        yCenters: allBlocks.map(b => b.bbox.y + b.bbox.h / 2)
      }
    }
  });
}
// ────────────────────────────────────────────────
function mergeAdjacentBlocks(results: IntfXYCutResult[]): IntfXYCutResult[] {
  const merged: IntfXYCutResult[] = []
  const used = new Set<number>()
  // adaptive vertical merge gap based on font size
  const allFontSizes = results.flatMap(r => r.blocks.map(b => b.fontSize))
  const avgFontSize =
    allFontSizes.length > 0
      ? allFontSizes.reduce((s, f) => s + f, 0) / allFontSizes.length
      : 12

  const MIN_VERTICAL_GAP = Math.max(6, avgFontSize * 0.8)
  for (let i = 0; i < results.length; i++) {
    if (used.has(i)) continue
    let base = results[i]!

    for (let j = i + 1; j < results.length; j++) {
      if (used.has(j)) continue
      const a = base.bbox
      const b = results[j]!.bbox

      const xOverlap =
        Math.min(a.x + a.w, b.x + b.w) -
        Math.max(a.x, b.x)

      // ─── prevent merging conflicting RTL/LTR regions ───
      const rtlA = base.blocks.filter(bb => bb.isRTL).length
      const rtlB = results[j]!.blocks.filter(bb => bb.isRTL).length
      const dirMismatch =
        (rtlA > base.blocks.length / 2) !==
        (rtlB > results[j]!.blocks.length / 2)

      const verticalGap = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0)

      // Only merge if xOverlap is strong AND vertical gap is small
      if (!dirMismatch && xOverlap > Math.min(a.w, b.w) * 0.7 && verticalGap < MIN_VERTICAL_GAP) {
        base = {
          ...base,
          blocks: [...base.blocks, ...results[j]!.blocks],
          bbox: unionBBox([...base.blocks, ...results[j]!.blocks]),
        }
        used.add(j)
      }
    }

    merged.push(base)
  }

  return merged
}

export function runXYCut(
  blocks: IntfTextBlock[],
  pageBBox: IntfBlockBox,
  geometry: IntfPageGeometry,
  opts: IntfXYCutOptions = {}
): IntfXYCutResult[] {
  const renders: string[] = []

  // ─── INVERT Y COORDINATES ───
  const pageHeight = pageBBox.h
  const invPageBBox: IntfBlockBox = {
    x: pageBBox.x,
    y: 0,
    w: pageBBox.w,
    h: pageBBox.h
  }

  const invBlocks = blocks.map(b => ({
    ...b,
    bbox: {
      x: b.bbox.x,
      y: pageHeight - (b.bbox.y + b.bbox.h), // invert Y
      w: b.bbox.w,
      h: b.bbox.h
    }
  }))

  let regions: IntfXYCutResult[] = [{
    blocks: invBlocks,
    bbox: unionBBox(invBlocks),
    depth: 0
  }]

  let prevHash = ""

  for (let iter = 0; iter < 10; iter++) {
    const next: IntfXYCutResult[] = []

    for (const r of regions) {
      next.push(
        ...xyCutRecursive(r.blocks, invPageBBox, 0, opts, renders)
      )
    }

    const merged = mergeAdjacentBlocks(next)

    if (opts?.debug)
      console.log(`[XYCUT][ITER]`, {
        iter,
        inputRegions: regions.length,
        outputRegions: merged.length
      })


    const hash = JSON.stringify(
      merged.map(r => ({
        bbox: r.bbox,
        blocks: r.blocks.map(b => b.id).sort()
      }))
    )

    if (hash === prevHash) break
    prevHash = hash
    regions = merged
  }

  if (opts.debug) {
    console.log(`[XYCUT] final regions=${regions.length}`)
  }

  return regions
}

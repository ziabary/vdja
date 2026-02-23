/* eslint-disable no-console */
import { SIGNAL_THRESHOLDS } from "./configs";
import type { IntfPageGeometry, IntfPageInfo, IntfTextBlock, IntfXYCutResult, IntfXYRegionFeatures, IntfXYRegionSignals, IntfXYRegionStructureScores, TypXYRegionKind } from "./interfaces";

function variance(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
}

function extractRegionFeatures(
  region: IntfXYCutResult,
  debug = false
): IntfXYRegionFeatures {

  const { blocks, bbox } = region
  const regionArea = bbox.w * bbox.h

  // ───────── blocks ─────────
  const blockAreas = blocks.map(b => {
    const glyphs = b.glyphs.filter(g => !g.virtualSpace)
    if (!glyphs.length) return 0
    const xs = glyphs.map(g => g.x)
    const ys = glyphs.map(g => g.y)
    const xe = glyphs.map(g => g.x + g.w)
    const ye = glyphs.map(g => g.y + g.h)
    return (Math.max(...xe) - Math.min(...xs)) *
      (Math.max(...ye) - Math.min(...ys))
  })
    // clamp zero-area blocks to avoid artificial variance spikes
  const safeBlockAreas = blockAreas.map(a => Math.max(a, 1))
  const totalBlockArea = safeBlockAreas.reduce((a, b) => a + b, 0)
  const avgBlockArea = blockAreas.length
    ? totalBlockArea / safeBlockAreas.length
    : 0

  // ───────── glyphs ─────────
  let glyphCount = 0
  let glyphAreaSum = 0
  const fontSizes: number[] = []
  const fontFamilies = new Set<string>()
  let boldCount = 0
  let italicCount = 0

  for (const b of blocks) {
    for (const g of b.glyphs) {
      if (g.virtualSpace) continue
      glyphCount++
      glyphAreaSum += g.w * g.h
      fontSizes.push(g.h)
      fontFamilies.add(g.realFontName || g.fontName)
      if (g.isBold) boldCount++
      if (g.isItalic) italicCount++
    }
  }

  // ───────── alignment primitives ─────────
  const realBoxes = blocks.map(b => {
    const glyphs = b.glyphs.filter(g => !g.virtualSpace)
    if (!glyphs.length) return null
    // real glyph bounding box
    const xs = glyphs.map(g => g.x)
    const ys = glyphs.map(g => g.y)
    const xe = glyphs.map(g => g.x + g.w)
    const ye = glyphs.map(g => g.y + g.h)
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xe) - Math.min(...xs),
      h: Math.max(...ye) - Math.min(...ys)
    }
  }).filter(Boolean) as unknown[]

  const xStarts = realBoxes.map(b => b.x)
  const xEnds = realBoxes.map(b => b.x + b.w)
  const yStarts = realBoxes.map(b => b.y)
  const yEnds = realBoxes.map(b => b.y + b.h)
  const xCenters = realBoxes.map(b => b.x + b.w / 2)
  const yCenters = realBoxes.map(b => b.y + b.h / 2)
  const realBlockCount = realBoxes.length

  const features: IntfXYRegionFeatures = {
    regionArea,
    blockCount: realBlockCount,
    totalBlockArea,
    blockCoverageRatio: regionArea > 0 ? totalBlockArea / regionArea : 0,
    avgBlockArea,
    blockAreaVariance: variance(safeBlockAreas),

    glyphCount,
    glyphAreaSum,
    glyphDensity: regionArea > 0 ? glyphAreaSum / regionArea : 0,

    avgFontSize: fontSizes.length
      ? fontSizes.reduce((a, b) => a + b, 0) / fontSizes.length
      : 0,
    fontSizeVariance: variance(fontSizes),
    fontFamilyCount: fontFamilies.size,
    boldRatio: glyphCount ? boldCount / glyphCount : 0,
    italicRatio: glyphCount ? italicCount / glyphCount : 0,

    xStarts,
    xEnds,
    yStarts,
    yEnds,
    xCenters,
    yCenters
  }

  if (debug) console.log(
    `[REGION][FEATURES] blocks=${features.blockCount}`,
    {
      regionArea: Math.round(features.regionArea),
      blockCoverage: +features.blockCoverageRatio.toFixed(2),
      glyphDensity: +features.glyphDensity.toFixed(3),
      fontSizeVar: +features.fontSizeVariance.toFixed(2),
      fontFamilies: features.fontFamilyCount
    }
  )


  return features
}

export function computeRegionFeatures(
  regions: IntfXYCutResult[],
  debug = false
): IntfXYCutResult[] {
  for (const r of regions) {
    r.features = extractRegionFeatures(r, debug)
  }
  return regions
}

function deriveRegionSignals(
  region: IntfXYCutResult,
  debug = false
): IntfXYRegionSignals {

  if (!region.features) {
    throw new Error("deriveRegionSignals called without features")
  }

  const f = region.features
  const regionArea = f.regionArea

  // use glyph-based block geometry (consistent with features)
  const maxBlockArea =
    f.blockCount > 0
      ? Math.max(
        ...f.xStarts.map((_, i) =>
          (f.xEnds[i]! - f.xStarts[i]!) *
          (f.yEnds[i]! - f.yStarts[i]!)
        )
      )
      : 0

  const hasText = f.glyphCount >= SIGNAL_THRESHOLDS.HAS_TEXT_GLYPHS

  const textDominant =
    hasText && f.glyphDensity >= SIGNAL_THRESHOLDS.TEXT_DOMINANT_DENSITY

  const visualDominant =
    !hasText || f.glyphDensity <= SIGNAL_THRESHOLDS.VISUAL_DOMINANT_DENSITY

  const manySmallBlocks =
    f.blockCount >= SIGNAL_THRESHOLDS.MANY_BLOCKS_COUNT &&
    f.avgBlockArea <= regionArea * SIGNAL_THRESHOLDS.SMALL_BLOCK_AREA_RATIO

  const singleLargeBlock =
    regionArea > 0 &&
    maxBlockArea / regionArea >= SIGNAL_THRESHOLDS.SINGLE_LARGE_BLOCK_RATIO

  const highFontVariance =
    f.fontSizeVariance >= SIGNAL_THRESHOLDS.HIGH_FONT_VARIANCE

  const multiFontFamilies =
    f.fontFamilyCount >= SIGNAL_THRESHOLDS.MULTI_FONT_FAMILIES

  const signals: IntfXYRegionSignals = {
    hasText,
    textDominant,
    visualDominant,
    manySmallBlocks,
    singleLargeBlock,
    highFontVariance,
    multiFontFamilies
  }

  if (debug) console.log(
    `[REGION][SIGNALS] blocks=${f.blockCount}`,
    signals
  )


  return signals
}

export function computeRegionSignals(
  regions: IntfXYCutResult[],
  debug = false
): IntfXYCutResult[] {

  for (const r of regions) {
    if (!r.features) {
      throw new Error("Signals require features (run Step 0 first)")
    }
    r.signals = deriveRegionSignals(r, debug)
  }

  return regions
}

function cluster1D(
  values: number[],
  tolerance: number
): number[][] {

  const sorted = [...values].sort((a, b) => a - b)
  const clusters: number[][] = []

  for (const v of sorted) {
    const last = clusters[clusters.length - 1]
    if (!last || Math.abs(last[last.length - 1]! - v) > tolerance) {
      clusters.push([v])
    } else {
      last.push(v)
    }
  }

  return clusters
}

function computeGridScore(region: IntfXYCutResult): number {
  const f = region.features!
  const blocks = region.blocks
  if (blocks.length < 4) return 0

  const tolX = Math.max(5, Math.sqrt(f.avgBlockArea) * 0.1)
  const tolY = tolX

  const xClusters = cluster1D(f.xStarts, tolX)
  const yClusters = cluster1D(f.yStarts, tolY)

  const xScore = xClusters.filter(c => c.length >= 2).length / xClusters.length
  const yScore = yClusters.filter(c => c.length >= 2).length / yClusters.length

  // log-scaled variance to tolerate table header/body size differences
  const sizeScore =
    f.blockAreaVariance > 0
      ? Math.min(1, f.avgBlockArea / Math.log2(f.blockAreaVariance + 2))
      : 1

  return Math.min(1, (xScore + yScore + sizeScore) / 3)
}

function computeFlowScore(region: IntfXYCutResult): number {
  const f = region.features!
  if (f.blockCount < 2) return 0

  // sort using real glyph-based positions
  const order = f.yStarts
    .map((y, i) => ({
      i,
      y,
      x: f.xStarts[i]
    }))
    .sort((a, b) =>
      a.y !== b.y ? a.y - b.y : a.x - b.x
    )

  let crossings = 0
  for (let i = 1; i < order.length; i++) {
    const prevY = f.yStarts[order[i - 1]!.i]!
    const prevH = f.yEnds[order[i - 1]!.i]! - prevY
    const curY = f.yStarts[order[i]!.i]!

    if (curY < prevY + prevH * 0.3) {
      crossings++
    }
  }

  const crossingPenalty = crossings / order.length
  // dampen crossing penalty in highly scattered (multi-column) layouts
  const scatterDampen =
    region.structure?.scatterScore !== undefined
      ? (1 - region.structure.scatterScore)
      : 1
  const alignmentPenalty =
    f.blockAreaVariance /
    (f.avgBlockArea + 1)

  const score = 1 - Math.min(1, (crossingPenalty * scatterDampen) + alignmentPenalty * 0.5)
  return Math.max(0, score)
}


export function computeRegionStructure(
  regions: IntfXYCutResult[],
  pageWidth: number,
  debug = false
): IntfXYCutResult[] {

  for (const r of regions) {
    if (!r.features || !r.signals) {
      throw new Error("Structure scoring requires features + signals")
    }
    r.structure = computeStructureScores(r, pageWidth, debug)
  }

  return regions
}

function detectCaptions(
  region: IntfXYCutResult,
  debug = false
): IntfTextBlock[] {
  const f = region.features!
  const s = region.signals!
  const blocks = region.blocks

  // Only consider blocks with small font and short text
  const smallFontThreshold = f.avgFontSize * 0.9 // smaller than avg
  const maxWords = 12

  const potentialCaptions = blocks.filter(b => {
    const wordCount = b.text.trim().split(/\s+/).length
    return b.fontSize <= smallFontThreshold && wordCount <= maxWords
  })


  // Filter by vertical proximity to region edges
  const regionTop = region.bbox.y
  const regionBottom = region.bbox.y + region.bbox.h
  const proximityThreshold = Math.max(10, f.avgBlockArea ** 0.5)

  const captions = potentialCaptions.filter(b => {
    const topDist = Math.abs(b.bbox.y - regionTop)
    const bottomDist = Math.abs(b.bbox.y + b.bbox.h - regionBottom)
    return topDist <= proximityThreshold || bottomDist <= proximityThreshold
  })


  // attach caption confidence (stored for downstream use)
  for (const c of captions) {
    let confidence = 0.4
    if (c.isBold) confidence += 0.2
    if (/^(figure|table|fig\.|chart)/i.test(c.text.trim())) confidence += 0.3
    if (Math.abs((c.bbox.x + c.bbox.w / 2) - (region.bbox.x + region.bbox.w / 2)) < region.bbox.w * 0.1) {
      confidence += 0.1
    }
    ;c.captionConfidence = Math.min(1, confidence)
  }

  if (debug) console.log(
    `[REGION][CAPTIONS] blocks=${blocks.length} detected=${captions.length}`,
    captions.map(c => `"${c.text.slice(0, 20)}"`)
  )


  return captions
}
// ─────────────────────────────── Column detection ──────────────────────────────
function clusterColumns(blocks: IntfTextBlock[], tolerance: number = 15): { minX: number, maxX: number }[] {
  if (!blocks.length) return []

  const sortedX = blocks.map(b => b.bbox.x).sort((a, b) => a - b)
  const clusters: number[][] = []

  for (const x of sortedX) {
    const last = clusters[clusters.length - 1]!
    if (!last || Math.abs(last[last.length - 1]! - x) > tolerance) {
      clusters.push([x])
    } else {
      last.push(x)
    }
  }

  // Return column boundaries
  return clusters.map(c => ({
    minX: Math.min(...c),
    maxX: Math.max(...c)
  }))
}

// ─────────────────────────────── Column-aware scatter ──────────────────────────
function computeScatterScore(
  region: IntfXYCutResult,
  gridScore: number,
  flowScore: number,
  pageWidth: number
): number {
  const blocks = region.blocks
  const f = region.features!
  const s = region.signals!

  if (!blocks.length) return 0

  // 1️⃣ Detect columns
  const colBounds = clusterColumns(blocks, pageWidth * 0.05) // 5% of page width tolerance

  if (!colBounds.length) return 0

  let scatterSum = 0
  let totalCount = 0

  for (const col of colBounds) {
    const colBlocks = blocks.filter(b => (b.bbox.x + b.bbox.w / 2) >= col.minX && (b.bbox.x + b.bbox.w / 2) <= col.maxX)
    if (!colBlocks.length) continue

    const xCenters = colBlocks.map(b => b.bbox.x + b.bbox.w / 2)
    const avgX = xCenters.reduce((a, b) => a + b, 0) / xCenters.length

    for (const b of colBlocks) {
      const relativeOffset = Math.abs((b.bbox.x + b.bbox.w / 2) - avgX) / (col.maxX - col.minX)
      scatterSum += Math.min(1, relativeOffset)
    }
    totalCount += colBlocks.length
  }

  const blockScatter = totalCount > 0 ? scatterSum / totalCount : 0

  // 2️⃣ Combine with grid/flow
  let score = 0
  score += blockScatter * 0.5
  score += (1 - gridScore) * 0.25
  score += (1 - flowScore) * 0.25

  return Math.min(1, score)
}

// ─────────────────────────────── Optional: wide-line protection ───────────────
function computeMaxColumnWidth(blocks: IntfTextBlock[]): number {
  const colBounds = clusterColumns(blocks, 15)
  if (!colBounds.length) return 0
  return Math.max(...colBounds.map(c => c.maxX - c.minX))
}

// Usage in computeStructureScores:
function computeStructureScores(
  region: IntfXYCutResult,
  pageWidth: number,
  debug = false
): IntfXYRegionStructureScores {

  const gridScore = computeGridScore(region)
  const flowScore = computeFlowScore(region)
  const scatterScore = computeScatterScore(region, gridScore, flowScore, pageWidth)

  const scores = { flowScore, gridScore, scatterScore }

  if (debug) console.log(
    `[REGION][STRUCTURE] blocks=${region.blocks.length}`,
    {
      flow: +flowScore.toFixed(2),
      grid: +gridScore.toFixed(2),
      scatter: +scatterScore.toFixed(2),
      maxColWidth: computeMaxColumnWidth(region.blocks).toFixed(1)
    }
  )

  return scores
}


function classifyRegions(
  regions: IntfXYCutResult[],
  pageWidth: number,
  debug = false
): IntfXYCutResult[] {

  const SCATTER_ILLUSTRATION_THRESHOLD = 0.85
  const FLOW_TEXT_THRESHOLD = 0.6

  for (const r of regions) {
    const f = r.features!
    const s = r.signals!
    const struct = r.structure!
    const captions = r.captions || []

    let kind: TypXYRegionKind = "mixed"
    const reasons: string[] = []

    // Compute fullWidthRatio per column instead of whole page
    const maxColWidth = parseFloat(computeMaxColumnWidth(r.blocks).toFixed(1)) || 0
    const fullWidthRatio = r.bbox.w > 0 ? maxColWidth / r.bbox.w : 0

    // ───────── Table / table-candidate scoring ─────────
    const tableScore =
      struct.gridScore * 0.6 +
      (1 - struct.flowScore) * 0.25 +
      (s.manySmallBlocks ? 0.15 : 0)

    if (tableScore >= 0.75 && fullWidthRatio > 0.7) {
      kind = "table"
      reasons.push(`tableScore=${tableScore.toFixed(2)}`)
    } else if (tableScore >= 0.45) {
      kind = "table-candidate"
      reasons.push(`tableScore=${tableScore.toFixed(2)}`)
    }

    // Image heuristic
    else if (s.visualDominant && !s.hasText && s.singleLargeBlock) {
      kind = "image"
      reasons.push(`visualDominant && singleLargeBlock`)
    }

    else if (
      s.visualDominant &&
      struct.scatterScore >= SCATTER_ILLUSTRATION_THRESHOLD
    ) {
      kind = "illustration"
      reasons.push(`visual scatter=${struct.scatterScore.toFixed(2)}`)
    }

    // Text heuristic
    else if (struct.flowScore >= FLOW_TEXT_THRESHOLD && s.textDominant) {
      kind = "text"
      reasons.push(`flowScore=${struct.flowScore.toFixed(2)} textDominant`)
    }

    // Fallback: textDominant but only if region is very flow-like or low scatter
    else if (
      s.textDominant &&
      !s.visualDominant &&
      struct.flowScore >= 0.4 &&
      struct.scatterScore <= 0.5
    ) {
      kind = "text"
      reasons.push(`textDominant fallback`)
    }

    r.kind = kind
    r.tableScore = tableScore

    // expose confidence for downstream merging logic
    r.kindConfidence = Math.max(
      tableScore,
      struct.flowScore,
      struct.scatterScore
    )

    if (debug) console.log(
      `[REGION][CLASSIFY] blocks=${r.blocks.length} kind=${kind}`,
      { reasons, captions: captions.map(c => `"${c.text.slice(0, 20)}"`) }
    )
  }

  // --- Post-merge sanity check ---
  for (const r of regions) {
    if (r.kind === "mixed") {
      // Check if every block contains some text
      const allText = r.blocks.every(b => (b.glyphs?.length ?? 0) > 0 && (b.text?.trim().length ?? 0) > 0)
      if (allText) {
        r.kind = "text"
        if (debug) console.log(`[REGION][POST-MERGE] corrected mixed → text`)
      }
    }
  }

  return regions
}

export function attachCaptions(
  regions: IntfXYCutResult[],
  debug = false
): IntfXYCutResult[] {

  for (const r of regions) {
    if (!r.features || !r.signals) {
      throw new Error("Caption detection requires features + signals")
    }
    r.captions = detectCaptions(r, debug)
  }

  return regions
}

function summarizeRegions(regions: IntfXYCutResult[]) {
  // Sort by top-left → top-right → bottom
  const sorted = [...regions].sort((a, b) => {
    const ay = a.bbox.y
    const by = b.bbox.y
    if (Math.abs(ay - by) > 1) return ay - by
    const ax = a.bbox.x
    const bx = b.bbox.x
    return ax - bx
  })

  console.log(`\n[REGION SUMMARY] total=${sorted.length}`)
  sorted.forEach((r, i) => {
    const { x, y, w, h } = r.bbox
    console.log(
      `[${i}] x:${x.toFixed(1)}, y:${y.toFixed(1)}, w:${w.toFixed(1)}, h:${h.toFixed(1)}, type:${r.kind}`
    )
  })
}

export default function classifyXYRegions(
  xyRegions: IntfXYCutResult[],
  pageInfo: IntfPageInfo,
  geometry: IntfPageGeometry,
  debug?: boolean
): IntfXYCutResult[] {
  const regionsStep0 = computeRegionFeatures(xyRegions, debug)
  const regionsStep1 = computeRegionSignals(regionsStep0, debug)
  const regionsStep2 = computeRegionStructure(regionsStep1, pageInfo.width, debug)
  const regionsStep3 = attachCaptions(regionsStep2, debug)
  const regionsFinal = classifyRegions(regionsStep3, pageInfo.width, debug)

  if (debug) summarizeRegions(regionsFinal)
  return regionsFinal;
}
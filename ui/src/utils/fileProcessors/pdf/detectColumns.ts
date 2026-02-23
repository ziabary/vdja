import type { IntfTextBlock, IntfXYCutResult } from "./interfaces";

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function variance(xs: number[]) {
  const m = mean(xs)
  return mean(xs.map(x => (x - m) ** 2))
}

function mad(xs: number[]) {
  const m = mean(xs)
  return mean(xs.map(x => Math.abs(x - m)))
}

export interface IntfDetectedColumn {
  blocks: IntfTextBlock[]
  minX: number
  maxX: number
}

export function detectColumns(
  region: IntfXYCutResult,
  pageWidth: number
): IntfDetectedColumn[] {

  // Guard rails
  if (region.kind !== "text") return []

  const blocks = region.blocks
  if (blocks.length < 4) return [{ blocks, minX: region.bbox.x, maxX: region.bbox.x + region.bbox.w }]

  // Use glyph-aware block geometry
  const xs = blocks.map(b => b.bbox.x)
  const widths = blocks.map(b => b.bbox.w)

  // 1️⃣ Cluster by X start
  const tolerance = pageWidth * 0.04
  const clusters: IntfDetectedColumn[] = []

  for (const b of blocks.sort((a, b) => a.bbox.x - b.bbox.x)) {
    let placed = false
    for (const c of clusters) {
      if (Math.abs(b.bbox.x - c.minX) <= tolerance) {
        c.blocks.push(b)
        c.minX = Math.min(c.minX, b.bbox.x)
        c.maxX = Math.max(c.maxX, b.bbox.x + b.bbox.w)
        placed = true
        break
      }
    }
    if (!placed) {
      clusters.push({
        blocks: [b],
        minX: b.bbox.x,
        maxX: b.bbox.x + b.bbox.w
      })
    }
  }

  if (clusters.length === 1) {
    return clusters
  }

  // 2️⃣ Column uniformity checks
  const colWidths = clusters.map(c => c.maxX - c.minX)
  const widthVar = variance(colWidths) / (mean(colWidths) + 1)

  const gaps: number[] = []
  for (let i = 1; i < clusters.length; i++) {
    gaps.push(clusters[i]!.minX - clusters[i - 1]!.maxX)
  }

  const gapMad = gaps.length ? mad(gaps) / (mean(gaps) + 1) : 0

  const fontFamilies = new Set<string>()
  for (const b of blocks) {
    if (b.fontFamily) fontFamilies.add(b.fontFamily)
  }

  // Reject unstable columns
  if (
    widthVar > 0.15 ||
    gapMad > 0.25 ||
    fontFamilies.size > 3
  ) {
    return [{
      blocks,
      minX: region.bbox.x,
      maxX: region.bbox.x + region.bbox.w
    }]
  }

  return clusters
}

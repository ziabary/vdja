import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';


export type IntfPDFRawPage = pdfjs.PDFPageProxy
export type IntfPDFTextContent = pdfjs.TextContent
export type IntfPDFOperatorList = pdfjs.OperatorList
export type IntfPDFRender = pdfjs.RenderTask
export type IntfPDFViewPort = pdfjs.PageViewport
export type IntfPDFRaw = pdfjs.PDFDocumentProxy

export interface IntfPDFDoc {
  pdfRaw: IntfPDFRaw;
  pageCount: number;
  title: string | undefined;
}

export interface IntfPageInfo {
  pageNumber: number,
  width: number
  height: number
  rawPage: IntfPDFRawPage,
  textContent?: IntfPDFTextContent
  operatorList?: IntfPDFOperatorList
  viewport: IntfPDFViewPort
  fonts: Record<string, string>,
  fontDetails: unknown[],  // can extend later with ascent/bold flags if needed
  warning: string | undefined,
};

export enum enuOrientation {
 horizontal= "horizontal",
 vertical = "vertical",
 other= "other"
}
export interface IntfLineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  orientation: enuOrientation;
}
export interface IntfImagePrimitive {
  bbox: IntfBlockBox;
}
export interface IntfPageGeometry {
  textPrimitives: IntfGlyph[];
  imagePrimitives: IntfImagePrimitive[];
  vectorSegments: IntfLineSegment[];
  vectorBoxes: IntfBlockBox[];
}

export type TypXYRegionKind =
  | "text"
  | "table"
  | "image"
  | "illustration"
  | "mixed"
  | "table-candidate"


export interface IntfXYRegionFeatures {
  // geometry
  regionArea: number
  blockCount: number
  totalBlockArea: number
  blockCoverageRatio: number
  avgBlockArea: number
  blockAreaVariance: number

  // glyphs
  glyphCount: number
  glyphAreaSum: number
  glyphDensity: number

  avgFontSize: number
  fontSizeVariance: number
  fontFamilyCount: number
  boldRatio: number
  italicRatio: number

  // alignment primitives
  xStarts: number[]
  xEnds: number[]
  yStarts: number[]
  yEnds: number[]
  xCenters: number[]
  yCenters: number[]
}

export interface IntfXYRegionSignals {
  // text / visual dominance
  hasText: boolean
  textDominant: boolean
  visualDominant: boolean

  // structural hints
  manySmallBlocks: boolean
  singleLargeBlock: boolean

  // typography
  highFontVariance: boolean
  multiFontFamilies: boolean
}

export interface IntfXYRegionStructureScores {
  flowScore: number
  gridScore: number
  scatterScore: number
}

export interface IntfXYCutResult {
  blocks: IntfTextBlock[]   // the blocks inside this XY-cut region
  bbox: IntfBlockBox        // bounding box of all blocks in this region
  depth: number             // XY-cut recursion depth (optional, for debugging)
  kind?: TypXYRegionKind;   // computed after XY-cut
  features?: IntfXYRegionFeatures
  signals?: IntfXYRegionSignals
  structure?: IntfXYRegionStructureScores
  captions?: IntfTextBlock[]
  tableScore? : number
  kindConfidence?: number
}

export interface IntfXYCutOptions {
  minGapRatio?: number;
  minBlocksPerSide?: number;
  maxDepth?: number;
  debug?: boolean;
  render?: boolean;

  // new optional thresholds for vetoes
  maxGlyphDensity?: number; // default ~0.02
  maxFontSizeVariance?: number; // default ~2–3 pts
}
export interface IntfBlockBox {
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
  virtualSpace?: boolean
}
export interface IntfTextBlock {
  id: string;
  page: number;
  bbox: IntfBlockBox;
  text: string;          // markdown-ready text with inline styling
  glyphs: IntfGlyph[];   // all glyphs preserved
  type: "unknown" | "title" | "heading" | "numbered" | "bullet" | "table" | "paragraph";
  fontSize: number;
  fontFamily: string;
  isBold: boolean;
  isItalic: boolean;
  isFullWidth?: boolean
  isRTL?: boolean;       // block-level RTL/LTR
  glyphDensity?: number; // glyphs / area
  captionConfidence?: number
  alignment?: "left" | "center" | "right" | "justified" | "unknown"; // estimated alignment
  debugInfo?: {
    glyphCount: number;
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    horizontalGaps: number[];
    glyphTexts: string[];
  } | undefined;
}

export interface IntfColumn {
  blocks: IntfTextBlock[]
  boundary: IntfBlockBox
}

export interface IntfPageStripOptions {
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

export interface IntfMergeOptions {
  maxVerticalGapFactor?: number;     // default ~1.8–2.4 × median line spacing
  minHorizontalOverlap?: number;     // 0.65–0.85 — how much x-ranges should overlap to consider same column
  maxHorizontalDrift?: number;       // max allowed x difference for continuation (px)
  sameColumnXDelta?: number;         // ~8–20 px tolerance for "same starting x"
  debug?: boolean;
}

export interface IntfLineSpacingStats {
  medianGap: number;
  iqr: number;
}

export type TypAxis = "x" | "y";

export interface IntfXYCutOptions {
  minGapRatio?: number;      // relative to page size (default 0.02)
  minBlocksPerSide?: number; // default 2
  maxDepth?: number;         // recursion limit
  debug?: boolean;
  render?: boolean;
}


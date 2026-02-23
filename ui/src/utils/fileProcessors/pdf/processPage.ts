import * as fs from "fs";
import { relativeToRun } from "../../common";
import { determineBlocksDirection } from "./common";
import { DEFAULT_STRIP_OPTIONS } from "./configs";
import extractNativeTextBlocks from "./extractNativeTextBlocks";
import { filterHeaderFooter } from "./filterHeaderFooter";
import getPageInfo from "./getPageInfo";
import type { IntfPageStripOptions, IntfPDFRawPage, IntfTextBlock } from "./interfaces";
import mergePageBlocks from "./mergePageBlocks";
import { ocrMissingBlocks } from "./ocr";
import { renderDebugPNG } from "./renderDebugPNG";
import { runXYCut } from "./xy-cut";
import { page2PNG } from "./page2PNG";
import classifyXYRegions from "./classifyRegions";
import extractPageGeometry from "./extractPageGeometry";

export default async function processPage(
  pageNumber: number,
  pdfRaw: IntfPDFRawPage,
  maxChars?: number,
  stripOptions: IntfPageStripOptions = DEFAULT_STRIP_OPTIONS,
  debug?: boolean
): Promise<{
  markdown: string;
  blocks: IntfTextBlock[];
  reachedLimit: boolean;
}> {
  // eslint-disable-next-line no-console
  const debugLog = debug ? console.log : () => { }

  debugLog(`[Page ${pageNumber}] Processing started`);

  const pageInfo = await getPageInfo(pdfRaw, pageNumber);

  if (!pageInfo.height || pageInfo.height <= 0)
    throw new Error(`[Page ${pageNumber}] Invalid page height: ${pageInfo.height}`);

  const pageGeometry = extractPageGeometry(pageInfo);
  const nativeBlocks = await extractNativeTextBlocks(pageInfo, true);
  debugLog(`[Page ${pageNumber}] native blocks count: ${nativeBlocks.length}`);
  // nativeBlocks.map((b,i)=>console.log(`${i}=>${b.text}`, b.text.split('')))
  // throw new Error()

  // stubs — replace with real implementation when ready
  const ocrBlocks = await ocrMissingBlocks();         // stub → []

  // Combine — you might want to do smarter merging later
  const blocks = [...nativeBlocks, ...ocrBlocks]

  // Sort top-to-bottom once (pdf.js y increases upward → higher y = higher on page)
  const allBlocksSortedByY = [...blocks].sort((a, b) => b.bbox.y - a.bbox.y);

  // ── Header/Footer filtering ─────────────────────────────────────────────
  // For now: no previous/next blocks available → repeating detection is off
  const nextPageBlocks: IntfTextBlock[] = []
  const prevPageBlocks: IntfTextBlock[] = []

  const bodyBlocks = filterHeaderFooter(
    allBlocksSortedByY,
    prevPageBlocks || [],
    nextPageBlocks || [],
    pageInfo.height,
    pageInfo.width,
    stripOptions,
  );
  debugLog(`[Page ${pageNumber}] Before merging: ${bodyBlocks.length} blocks`);

  const bodyX = Math.min(...bodyBlocks.map(b => b.bbox.x));
  const bodyY = Math.min(...bodyBlocks.map(b => b.bbox.y));
  const bodyMaxX = Math.max(...bodyBlocks.map(b => b.bbox.x + b.bbox.w));
  const bodyMaxY = Math.max(...bodyBlocks.map(b => b.bbox.y + b.bbox.h));

  const contentWidth = bodyMaxX - bodyX;
  const contentHeight = bodyMaxY - bodyY;
  const contentBBox = { x: bodyX, y: bodyY, w: contentWidth, h: contentHeight };

  debugLog(`[Page ${pageNumber}] ContentBox: ${JSON.stringify(contentBBox)}`);

  const xyRegions = runXYCut(
    bodyBlocks,
    contentBBox,
    pageGeometry,
    { debug: true, render: true }
  )

  if (debug) {
    const debugDir = relativeToRun("./debug");
    fs.mkdirSync(debugDir, { recursive: true });
    const pagePngPath = relativeToRun(`./debug/page_${pageNumber}.png`);
    await page2PNG(pageInfo, pagePngPath);
    await renderDebugPNG(
      pagePngPath,
      relativeToRun(`./debug/xycut_page_${pageNumber}.png`),
      { x: 0, y: bodyY, w: pageInfo.width, h: pageInfo.height },
      xyRegions,
      { showBlocks: true, showRegions: true, showInnerGlyphs: true }
    );
    fs.rmSync(pagePngPath)
  }
  throw new Error()

  classifyXYRegions(xyRegions, pageInfo, pageGeometry, debug)

  throw new Error()
  const pageDirection = determineBlocksDirection(bodyBlocks);
  const pageParagraphs = mergePageBlocks(pageInfo, xyRegions, pageDirection, {
    debug: true,
    maxVerticalGapFactor: 2.3,
    minHorizontalOverlap: 0.65,
    maxHorizontalDrift: 38,
    sameColumnXDelta: 22,
  });

  console.log({ pageParagraphs })
  throw new Error()

  //const pageMarkdown = blocksToMarkdown(ordered) + `\n\n<!-- PAGE ${pageNumber} -->\n\n`;

  //const reachedLimit = maxChars !== undefined && pageMarkdown.length >= maxChars;

  //console.log(`[Page ${pageNumber}] ${ordered.length} final blocks | direction: ${pageDirection} | chars: ${pageMarkdown.length}`);

  /*return {
    markdown: pageMarkdown,
    blocks: ordered,
    reachedLimit,
  };*/
}
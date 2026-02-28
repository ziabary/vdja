/* eslint-disable no-console */
import { mad, median } from "./common";
import type { IntfGlyph, IntfPageInfo, IntfTextBlock } from "./interfaces";
import * as crypto from "crypto"; 
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

export default async function extractNativeTextBlocks(
  pageInfo: IntfPageInfo,
  debug?: boolean
): Promise<IntfTextBlock[]> {
  const { pageNumber, rawPage, fonts, textContent } = pageInfo;
  if (debug) console.time(`[Native] page ${pageNumber}`);

  const linesByY = new Map<number, IntfGlyph[]>();
  const snapY = (y: number) => Math.round(y / 3) * 3;

  // --------------------------------------------------
  // 1. Collect glyphs per visual line
  // --------------------------------------------------
  const viewport = pageInfo.viewport;

  for (const item of textContent?.items || []) {
    if (!item.str) continue;

//    const [, , , d, e, f] = item.transform;
//    const y = snapY(f);
    // ✅ Apply viewport transform
    const tx = pdfjs.Util.transform(
      viewport.transform,
      item.transform
    );

    const x = tx[4];
    const y = tx[5];
    const height = Math.abs(tx[3]);
    const snappedY = snapY(y);

    const realFont = fonts[item.fontName] || "Unknown";
    const isBold = /bold/i.test(realFont);
    const isItalic = /italic/i.test(realFont);

    if (!linesByY.has(snappedY)) linesByY.set(snappedY, []);
    linesByY.get(snappedY)!.push({
      text: item.str,
      x,
      y,
      w: item.width * viewport.scale, 
      h: height,
      fontName: item.fontName,
      realFontName: realFont,
      isBold,
      isItalic,
    });
  }

  const blocks: IntfTextBlock[] = [];

  // ─────────────────────────────────────────────
  // IMAGE EXTRACTION
  // ─────────────────────────────────────────────
  const opList = pageInfo.operatorList;

  console.log(pdfjs.OPS)
  if (opList) {
    const { fnArray, argsArray } = opList;

    for (let i = 0; i < fnArray.length; i++) {
      const fn = fnArray[i];

      console.log(fn)

      if (
        fn === pdfjs.OPS.paintImageXObject ||
        fn === pdfjs.OPS.paintJpegXObject ||
        fn === pdfjs.OPS.paintInlineImageXObject ||
        fn === pdfjs.OPS.paintFormXObjectBegin
      ) {
        const args = argsArray[i];

        // Transform matrix is last applied transform
        const transform = args?.[args.length - 1];
        if (!transform) continue;

        const tx = pdfjs.Util.transform(
          pageInfo.viewport.transform,
          transform
        );

        const x = tx[4];
        const y = tx[5];
        const w = Math.abs(tx[0]);
        const h = Math.abs(tx[3]);

        blocks.push({
          id: crypto.randomUUID(),
          page: pageNumber,
          bbox: { x, y, w, h },
          text: "",
          glyphs: [],
          type: "unknown",
          fontSize: 0,
          fontFamily: "",
          isBold: false,
          isItalic: false,
        });
      }
    }
  }
  console.log(blocks)
  throw new Error()

  // --------------------------------------------------
  // 2. Process each line (PURE GEOMETRY)
  // --------------------------------------------------
  for (const [y, glyphs] of linesByY.entries()) {
    if (glyphs.length === 0) continue;

    // ----------------------------------------------
    // 2.1 Determine line direction geometrically
    // ----------------------------------------------
    const textStr = glyphs.map(g => g.text).join("");
    const rtlChars = [...textStr].filter(ch =>
      /\p{Script=Arabic}|\p{Script=Hebrew}/u.test(ch)
    );

    // Primary: Unicode majority
    // Fallback: geometric order (tables, code, mixed scripts)
    const isRTL =
      rtlChars.length > textStr.length / 2 ||
      (rtlChars.length === 0 &&
        glyphs.length > 1 &&
        glyphs[0]!.x > glyphs[glyphs.length - 1]!.x);
    // ----------------------------------------------
    // 2.2 Sort glyphs in VISUAL order (once)
    // ----------------------------------------------
    glyphs.sort((a, b) => (isRTL ? b.x - a.x : a.x - b.x));

    // ----------------------------------------------
    // 2.3 Compute virtual spaces using median + MAD
    // ----------------------------------------------

    const horizontalGaps: number[] = [];
    for (let i = 1; i < glyphs.length; i++) {
      const a = glyphs[i - 1]!;
      const b = glyphs[i]!;
      const gap = isRTL ? a.x - (b.x + b.w) : b.x - (a.x + a.w);
      horizontalGaps.push(gap);
    }
    // Use larger gaps to break into separate blocks (cells)
    const dynamicVirtualSpaceThreshold = Math.max(
      3, // minimum px to split
      median(horizontalGaps) + 2 * mad(horizontalGaps)
    );
    // Then split glyphs array into multiple subarrays whenever gap > splitThreshold
    const subBlocks: IntfGlyph[][] = [];
    let current = [glyphs[0]!];
    for (let i = 1; i < glyphs.length; i++) {
      const g = glyphs[i]!;
      const prev = glyphs[i - 1]!;
      const gap = isRTL ? prev.x - (g.x + g.w) : g.x - (prev.x + prev.w);
      if (gap > dynamicVirtualSpaceThreshold) {
        subBlocks.push(current);
        current = [];
      }
      current.push(g);
    }
    if (current.length) subBlocks.push(current);

    // Push each subBlock as its own IntfTextBlock
    for (const sub of subBlocks) {
      const subBBoxXMin = Math.min(...sub.map(g => g.x));
      const subBBoxXMax = Math.max(...sub.map(g => g.x + g.w));
      const subBBoxYMin = Math.min(...sub.map(g => g.y));
      const subBBoxYMax = Math.max(...sub.map(g => g.y + g.h));

      // Determine most common font in the subBlock
      const fontCounts: Record<string, number> = {};
      sub.forEach(g => { fontCounts[g.realFontName] = (fontCounts[g.realFontName] || 0) + 1 });
      const mostCommonFont = Object.entries(fontCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || "";

      const subBlockId = crypto.randomUUID();
      const subBlock: IntfTextBlock = {
        id: subBlockId,
        page: pageNumber,
        bbox: {
          x: subBBoxXMin,
          y: subBBoxYMin,
          w: subBBoxXMax - subBBoxXMin,
          h: subBBoxYMax - subBBoxYMin,
        },
        text: "",
        glyphs: sub,
        type: "unknown",
        fontSize: Math.max(...sub.map(g => g.h)),
        fontFamily: mostCommonFont,
        isBold: sub.some(g => g.isBold),
        isItalic: sub.some(g => g.isItalic),
        isRTL,
        glyphDensity: sub.length / ((subBBoxXMax - subBBoxXMin) * (subBBoxYMax - subBBoxYMin)),
        alignment: "unknown", // deferred, Step 5
        debugInfo: debug
          ? {
              glyphCount: sub.length,
              xMin: subBBoxXMin,
              xMax: subBBoxXMax,
              yMin: subBBoxYMin,
              yMax: subBBoxYMax,
              horizontalGaps,
              glyphTexts: sub.map(g => g.text),
            }
          : undefined,
      };

      if (debug) console.log(`[Native] page ${pageNumber} sub-block ${subBlockId}:`, subBlock.debugInfo);

      blocks.push(subBlock);
    }
  }

  // --------------------------------------------------
  // 3. Top-to-bottom page order
  // --------------------------------------------------
  blocks.sort((a, b) => a.bbox.y - b.bbox.y);

  if (debug) {
    console.timeEnd(`[Native] page ${pageNumber}`);
    console.log(`[Native] page ${pageNumber} → ${blocks.length} blocks`);
  }

  return blocks;
}
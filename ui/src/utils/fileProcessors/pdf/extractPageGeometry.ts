import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

import {
  type IntfPageInfo,
  type IntfGlyph,
  type IntfBlockBox,
  type IntfPDFOperatorList,
  type IntfPageGeometry,
  type IntfImagePrimitive,
  type IntfLineSegment,
  enuOrientation,
} from "./interfaces";

function multiplyMatrix(m1: number[], m2: number[]) {
  return [
    m1[0]! * m2[0]! + m1[2]! * m2[1]!,
    m1[1]! * m2[0]! + m1[3]! * m2[1]!,
    m1[0]! * m2[2]! + m1[2]! * m2[3]!,
    m1[1]! * m2[2]! + m1[3]! * m2[3]!,
    m1[0]! * m2[4]! + m1[2]! * m2[5]! + m1[4]!,
    m1[1]! * m2[4]! + m1[3]! * m2[5]! + m1[5]!,
  ];
}

function applyMatrix(m: number[], x: number, y: number) {
  return {
    x: m[0]! * x + m[2]! * y + m[4]!,
    y: m[1]! * x + m[3]! * y + m[5]!,
  };
}

export default function extractPageGeometry(
  pageInfo: IntfPageInfo
): IntfPageGeometry {
  const operatorList: IntfPDFOperatorList = pageInfo.operatorList!;

  const textPrimitives: IntfGlyph[] = [];
  const imagePrimitives: IntfImagePrimitive[] = [];
  const vectorSegments: IntfLineSegment[] = [];
  const vectorBoxes: IntfBlockBox[] = [];

  // Text primitives (already transformed in extractNativeTextBlocks path)
  for (const item of pageInfo.textContent?.items || []) {
    const tx = pageInfo.viewport.convertToViewportPoint(
      item.transform[4]!,
      item.transform[5]!
    );

    const glyph: IntfGlyph = {
      text: item.str,
      x: tx[0],
      y: tx[1],
      w: item.width,
      h: item.height,
      fontName: item.fontName,
      realFontName: pageInfo.fonts[item.fontName] || item.fontName,
      isBold: false,
      isItalic: false,
    };

    textPrimitives.push(glyph);
  }

  // Vector + Image primitives
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  let currentPath: { x: number; y: number }[] = [];

  const { fnArray, argsArray } = operatorList;

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i]!;

    switch (fn) {
      case pdfjs.OPS.save: // save
        stack.push([...ctm]);
        break;

      case 1: // restore
        ctm = stack.pop() || ctm;
        break;

      case 2: // transform
        ctm = multiplyMatrix(ctm, args);
        break;

      case 19: // moveTo
        currentPath = [];
        {
          const p = applyMatrix(ctm, args[0], args[1]);
          currentPath.push(p);
        }
        break;

      case 20: // lineTo
        {
          const p = applyMatrix(ctm, args[0], args[1]);
          const last = currentPath[currentPath.length - 1];
          if (last) {
            const dx = Math.abs(p.x - last.x);
            const dy = Math.abs(p.y - last.y);

            const orientation =
              dx < 1 ? enuOrientation.vertical :
              dy < 1 ? enuOrientation.horizontal :
              enuOrientation.other;

            vectorSegments.push({
              x1: last.x,
              y1: last.y,
              x2: p.x,
              y2: p.y,
              orientation,
            });
          }
          currentPath.push(p);
        }
        break;

      case 84: // paintImageXObject
        {
          const p = applyMatrix(ctm, 0, 0);
          imagePrimitives.push({
            bbox: { x: p.x, y: p.y, w: 100, h: 100 }, // simplified
          });
        }
        break;

      case 22: // stroke
      case 23: // fill
        if (currentPath.length) {
          const xs = currentPath.map(p => p.x);
          const ys = currentPath.map(p => p.y);
          const box: IntfBlockBox = {
            x: Math.min(...xs),
            y: Math.min(...ys),
            w: Math.max(...xs) - Math.min(...xs),
            h: Math.max(...ys) - Math.min(...ys),
          };
          vectorBoxes.push(box);
        }
        currentPath = [];
        break;
    }
  }

  return {
    textPrimitives,
    imagePrimitives,
    vectorSegments,
    vectorBoxes,
  };
}
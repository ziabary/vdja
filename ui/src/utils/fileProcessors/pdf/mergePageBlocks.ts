import type {  IntfMergeOptions, IntfPageInfo, IntfTextBlock, IntfXYCutResult } from "./interfaces";
import mergeIntoParagraphs from "./mergeIntoParagraphs";
import { detectColumns } from "./detectColumns";

function regionCenterX(r: IntfXYCutResult) {
  return r.bbox.x + r.bbox.w / 2;
}

function sortRegionsVisual(
  regions: IntfXYCutResult[],
  direction: "ltr" | "rtl"
): IntfXYCutResult[] {

  // Step 1: group by columns using X proximity
  const columns: IntfXYCutResult[][] = [];

  for (const r of [...regions].sort((a, b) =>
    regionCenterX(a) - regionCenterX(b)
  )) {
    let placed = false;

    for (const col of columns) {
      const cx = regionCenterX(col[0]!);
      if (Math.abs(regionCenterX(r) - cx) < col[0]!.bbox.w * 0.6) {
        col.push(r);
        placed = true;
        break;
      }
    }

    if (!placed) columns.push([r]);
  }

  // Step 2: sort columns left→right or right→left
  columns.sort((a, b) => {
    const dx = regionCenterX(a[0]!) - regionCenterX(b[0]!);
    return direction === "ltr" ? dx : -dx;
  });

  // Step 3: inside each column, top→bottom
  for (const col of columns) {
    col.sort((a, b) => a.bbox.y - b.bbox.y);
  }

  return columns.flat();
}

export default function mergePageBlocks(
  pageInfo: IntfPageInfo,
  regions: IntfXYCutResult[],
  direction: "rtl" | "ltr" = "rtl",
  userOpts: IntfMergeOptions = {}
): IntfTextBlock[] {

  const orderedRegions = sortRegionsVisual(regions, direction);

  const result: IntfTextBlock[] = [];

  for (const r of orderedRegions) {
    if (r.kind !== "text") {
      result.push(...r.blocks);
      continue;
    }

    const columns = detectColumns(r, pageInfo.width)

    for (const col of columns) {
      const merged = mergeIntoParagraphs(
        [...col.blocks].sort((a, b) => a.bbox.y - b.bbox.y),
        direction,
        userOpts
      )
      result.push(...merged)
    }
  }

  return result;
}

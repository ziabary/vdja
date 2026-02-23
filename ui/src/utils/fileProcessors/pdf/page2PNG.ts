import fs from "fs";
import path from "path";
import { createCanvas } from "canvas";
import type { IntfPageInfo } from "./interfaces";

interface RasterizeOptions {
  scale?: number;      // default 2.0 (good for OCR/debug)
  background?: string; // default white
  debug?: boolean;
}

// ────────────────────────────────────────────────
export async function page2PNG(pdfPage: IntfPageInfo,  outputPath: string,  opts: RasterizeOptions = {}): Promise<void> {
  const {
    scale = 2.0,
    background = "#ffffff",
    debug = false,
  } = opts;

  if (debug) console.log(`[Rasterize] page=${pdfPage.pageNumber} scale=${scale}`);

  const {rawPage, viewport} = pdfPage

  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext("2d");

  // background
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: ctx,
    viewport,
  };

  await rawPage.render(renderContext).promise;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, canvas.toBuffer("image/png"));

  if (debug) console.log(`[Rasterize] saved → ${outputPath}`);
}

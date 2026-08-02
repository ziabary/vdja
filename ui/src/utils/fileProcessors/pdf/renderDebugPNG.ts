import { createCanvas, loadImage } from "canvas";
import * as fs from "fs";
import type { IntfBlockBox, IntfXYCutResult } from "./interfaces";


interface IntfDebugRenderOptions {
  showBlocks?: boolean;
  showRegions?: boolean;
  showInnerGlyphs?: boolean
  alpha?: number;
}

// ────────────────────────────────────────────────
export async function renderDebugPNG(
  pageImagePath: string,           // rasterized PDF page
  outputPath: string,
  pageBBox: IntfBlockBox,
  regions: IntfXYCutResult[],
  opts: IntfDebugRenderOptions = {}
) {
  const {
    showBlocks = false,
    showRegions = true,
    showInnerGlyphs = true,
    alpha = 0.35,
  } = opts;

  const img = await loadImage(pageImagePath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");

  // Compute scaling and offset between pageBBox and PNG
  const scaleX = 1//canvas.width / pageBBox.w;
  const scaleY = 1//canvas.height / pageBBox.h;

  // Optional offset if pageBBox.x/y != 0
  const offsetX = 0//-pageBBox.x * scaleX;
  const offsetY = pageBBox.y * 2.1//-pageBBox.y * scaleY;

  // draw PDF page
  ctx.drawImage(img, 0, 0);

  // ctx.save();
  // ctx.translate(0, pageBBox.h);
  // ctx.scale(1, -1);

  ctx.lineWidth = 2;
  ctx.font = "14px monospace";

  // ── Regions (XY-cut results) ─────────────────────────────
  if (showRegions) {
    regions.forEach((r, idx) => {
      const b = r.bbox;

      const x = b.x * scaleX + offsetX;
      const y = pageBBox.h - (b.y + b.h);

      const w = b.w * scaleX;
      const h = b.h * scaleY;

      ctx.strokeStyle = "rgba(255,0,0,0.9)";
      ctx.fillStyle = `rgba(255,0,0,${alpha})`;

      ctx.strokeRect(x, y, w, h);
      ctx.fillRect(x, y, w, h);

      ctx.fillStyle = "rgba(0,0,0,0.9)";
      ctx.fillText(
        `R${idx} d=${r.depth} (${r.blocks.length})`,
        x + 4,
        y + 16
      );
    });
  }

  // ── Individual blocks (optional) ─────────────────────────
  if (showBlocks || showInnerGlyphs) {
    regions.forEach(r => {
      r.blocks.forEach(b => {
        if (showBlocks) {
          ctx.strokeStyle = "rgba(0,0,255,0.8)";
          ctx.lineWidth = 1;
          const x = b.bbox.x * scaleX + offsetX;
          const y = b.bbox.y * scaleY + offsetY

          const w = b.bbox.w * scaleX;
          const h = b.bbox.h * scaleY;
          ctx.strokeRect(x, y, w, h);
        }
        if (showInnerGlyphs) {
          b.glyphs.forEach(g => {
            ctx.strokeStyle =  "rgba(0, 114, 0, 0.8)";
            ctx.fillStyle = `rgba(114, 5, 141, 0.6)`;

            ctx.lineWidth = 0.5;
            const x = g.x * scaleX + offsetX;
            const y = pageBBox.h - (g.y + g.h); //g.y * scaleY + offsetY

            const w = g.w * scaleX;
            const h = g.h * scaleY;
            ctx.strokeRect(x, y, w, h);
            if(g.virtualSpace)
            ctx.fillRect(x, y, w, h);


            //console.log({x,y,w,h, t:g.text, font: g.realFontName})

          })
        }
      });
    });
  }

  fs.writeFileSync(outputPath, canvas.toBuffer("image/png"));
}

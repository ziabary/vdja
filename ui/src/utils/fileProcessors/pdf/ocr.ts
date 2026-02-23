import type { IntfPDFRawPage, IntfTextBlock } from "./interfaces";

async function rasterizePage(page: IntfPDFRawPage): Promise<{ buffer: Buffer; width: number; height: number }> {
  const viewport = page.rawPage.getViewport({ scale: 1 });
  return { buffer: Buffer.alloc(0), width: viewport.width, height: viewport.height };
}

async function detectLayoutBlocks(): Promise<IntfTextBlock[]> {
  return []; // stub
}

export async function ocrMissingBlocks(): Promise<IntfTextBlock[]> {
  return []; // stub
}

import fs from "fs/promises";
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { IntfPDFDoc } from "./interfaces";
import logger from "../../logger";

// Set the worker (required in Node, prevents worker loading issues)
pdfjs.GlobalWorkerOptions.workerSrc = new URL('./pdf.worker.min.mjs', import.meta.url).href;

export default async function loadPdfDocument(filePath: string, debug?: boolean) : Promise<IntfPDFDoc> {
  // eslint-disable-next-line no-console
  const debugLog = debug ? console.log : ()=>{}

  debugLog(`[PDF] Loading document: ${filePath}`);

  const buffer = await fs.readFile(filePath);  // This is a Buffer

  // Convert Buffer to Uint8Array (simple & efficient)
  const uint8Array = new Uint8Array(buffer);  // ← this is the key line

  const loadingTask = pdfjs.getDocument({
    data: uint8Array,  // Now passes Uint8Array instead of Buffer
    disableFontFace: true,
    useSystemFonts: true,
    // Optional: for better Persian/Arabic/CJK support
    cMapUrl: './cmaps/',  // if you copied the cmaps folder to your project
    cMapPacked: true,
  });

  const pdfRaw = await loadingTask.promise;

  let title: string | undefined;
  try {
    const meta = await pdfRaw.getMetadata();
    title = meta.info?.Title || meta.metadata?.get("dc:title");
  } catch (ex) {
    logger.error(ex);
  }

  debugLog(`[PDF] Loaded – ${pdfRaw.numPages} pages${title ? `, title: ${title}` : ""}`);
  return { pdfRaw, pageCount: pdfRaw.numPages, title };
}

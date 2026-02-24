import { DEFAULT_STRIP_OPTIONS } from "./pdf/configs";
import loadPdfDocument from "./pdf/loadPDF";
import type { IntfFileMeta, IntfTextExtractResult } from "../../interfaces/file";
import processPage from "./pdf/processPage";
import type { IntfTextBlock } from "./pdf/interfaces";


export async function extractFromPDF(
  file: IntfFileMeta,
  fromPage: number,
  toPage: number | undefined,
  maxChars = Infinity,
  options: {
    headerRatio?: number;
    footerRatio?: number;
    autoHeader?: boolean;
  } = {}
): Promise<IntfTextExtractResult> {
  const { pdfRaw, pageCount, title } = await loadPdfDocument(file.path, true);

  const start = (fromPage ?? 0) + 1;
  const end = toPage ? Math.min(toPage + 1, pageCount) : pageCount;

  let text = "";
  let allBlocks: IntfTextBlock[] = [];
  let stripped = false;

  for (let pageNo = start; pageNo <= end; pageNo++) {
    const { markdown, blocks, reachedLimit } = await processPage(
      pageNo,
      pdfRaw,
      maxChars,
      {
        ...DEFAULT_STRIP_OPTIONS,
        headerRatio: options.headerRatio,
        footerRatio: options.footerRatio,
        enableLogging: true,
      },
      true // debug
    );

    text += markdown;
    allBlocks.push(...blocks);

    if (reachedLimit) {
      text = text.slice(0, maxChars! - 6) + " [...]";
      stripped = true;
      break;
    }
  }

  return {
    meta: { pageCount, title },
    stripped,
    text,
  };
}

export async function extractFromPDFInteractive(
  file: IntfFileMeta,
  onPage?: (pageNumber: number, pageText: string, totalPages: number) => Promise<void>,
  options: {
    fromPage?: number;
    toPage?: number;
    headerRatio?: number;
    footerRatio?: number;
    autoHeader?: boolean;
  } = {}
): Promise<void> {
  const { pdfRaw, pageCount, title } = await loadPdfDocument(file.path, true);

  const start = (options.fromPage ?? 0) + 1;
  const end = options.toPage ? Math.min(options.toPage + 1, pageCount) : pageCount;

  for (let p = start; p <= end; p++) {
    const { markdown } = await processPage(
      p,
      pdfRaw,
      undefined,
      {
        ...DEFAULT_STRIP_OPTIONS,
        headerRatio: options.headerRatio,
        footerRatio: options.footerRatio,
        enableLogging: true,
      },
      true // debug
    );

    //@TODO check this
    const cleanText = markdown
      .replace(/<!-- PAGE \d+ -->[\s\S]*$/, "")
      .replace(/---\n\n/g, "\n\n")
      .trim();

    await onPage?.(p, cleanText, pageCount);
  }
}
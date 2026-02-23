/* eslint-disable no-console */
import type { IntfPageInfo, IntfPDFRawPage, IntfPDFViewPort } from "./interfaces";

export default async function getPageInfo(pdfRaw: IntfPDFRawPage, pageNumber: number, debug?: boolean) {
  const page : IntfPDFRawPage = await pdfRaw.getPage(pageNumber);
  const viewport: IntfPDFViewPort = page.getViewport({ scale: 1 });

  const result :IntfPageInfo= {
    pageNumber,
    width: viewport.width,
    height: viewport.height,
    rawPage: page,
    textContent: undefined,
    operatorList: undefined,
    viewport,
    fonts: {} as Record<string, string>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fontDetails: [] as any[],  // can extend later with ascent/bold flags if needed
    warning: undefined as string | undefined,
  };

  try {
    // 1. Discover used font IDs from text layer (cheap & reliable)
    result.textContent = await page.getTextContent();
    const fontIds: Set<string> = new Set(
      result.textContent.items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => item.fontName)
        .filter(Boolean)
    );

    if (fontIds.size === 0) {
      result.warning = 'No text items found on page → no fonts detected';
      return result;
    }

    // 2. getOperator List and force font resolution
    result.operatorList = await page.getOperatorList();

    // 3. Try to resolve real names
    const unresolved: string[] = [];
    for (const id of fontIds) {
      if (page.commonObjs.has(id)) {
        const font = page.commonObjs.get(id);
        let name = font?.name || font?.loadedName || 'Unknown';
        // Clean common subset prefix (AAAAAA+...)
        name = name.replace(/^[A-Z0-9]{6}\+/, '').trim();
        // Optional: remove trailing ,Bold etc. if you want base only
        // name = name.replace(/,.*$/, '').trim();

        result.fonts[id] = name;
      } else {
        unresolved.push(id);
        result.fonts[id] = 'Not Loaded (synthetic)';
      }
    }

    if (unresolved.length > 0) {
      result.warning = `Could not resolve real names for: ${unresolved.join(', ')}. ` +
        `commonObjs may not have populated in Node.js environment.`;
    }

  } catch (err) {
    result.warning = `Font extraction failed: ${(err as Error).message || String(err)}`;
    if (debug) console.error(`Page ${pageNumber} font error:`, err);
  }

  return result;
}

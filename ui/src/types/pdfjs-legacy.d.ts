/* eslint-disable @typescript-eslint/no-explicit-any */
// pdfjs-legacy.d.ts
// Extended minimal declarations for pdfjs-dist/legacy/build/pdf.mjs in Node.js

declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  // ────────────────────────────────────────────────
  // Top-level exports
  // ────────────────────────────────────────────────
  export function getDocument(
    source: string | Uint8Array | ArrayBuffer | object,
    options?: any
  ): PDFDocumentLoadingTask;

  export const GlobalWorkerOptions: {
    workerSrc: string;
    workerPort?: any;
    enableWorkerFetch?: boolean;
    [key: string]: any;
  };

  export const version: string;

  // ────────────────────────────────────────────────
  // Commonly used internal namespaces
  // ────────────────────────────────────────────────
  export const Util: {
    // Very minimal – add more methods as you actually use them
    normalizeRect: (rect: number[]) => number[];
    // ... other utilities like clamp, getFilenameFromUrl, etc.
    [key: string]: any;
  };

  export const OPS: {
    // Main graphics operators (most frequently used)
    readonly dependency: 1;
    readonly setLineWidth: 2;
    readonly setLineCap: 3;
    readonly setLineJoin: 4;
    readonly setMiterLimit: 5;
    readonly setDash: 6;
    readonly setRenderingIntent: 7;
    readonly setFlatness: 8;
    readonly setGState: 9;
    readonly save: 10;
    readonly restore: 11;
    readonly transform: 12;
    readonly moveTo: 13;
    readonly lineTo: 14;
    readonly curveTo: 15;
    readonly curveTo2: 16;
    readonly curveTo3: 17;
    readonly closePath: 18;
    readonly rectangle: 19;
    readonly stroke: 20;
    readonly closeStroke: 21;
    readonly fill: 22;
    readonly eoFill: 23;
    readonly fillStroke: 24;
    readonly eoFillStroke: 25;
    readonly closeFillStroke: 26;
    readonly closeEOFillStroke: 27;
    readonly endPath: 28;
    readonly clip: 29;
    readonly eoClip: 30;
    readonly beginText: 31;
    readonly endText: 32;
    readonly setCharSpacing: 33;
    readonly setWordSpacing: 34;
    readonly setHScale: 35;
    readonly setLeading: 36;
    readonly setFont: 37;
    readonly setTextRise: 38;
    readonly moveText: 39;
    readonly setLeadingMoveText: 40;
    readonly showText: 41;
    readonly moveSetShowText: 42;
    readonly showSpacedText: 43;
    readonly nextLine: 44;
    readonly setTextMatrix: 45;
    readonly setCharWidth: 46;
    readonly setCharWidthAndBounds: 47;
    readonly setStrokeColorSpace: 48;
    readonly setFillColorSpace: 49;
    readonly setStrokeColor: 50;
    readonly setStrokeColorN: 51;
    readonly setFillColor: 52;
    readonly setFillColorN: 53;
    readonly setStrokeGray: 54;
    readonly setFillGray: 55;
    readonly setStrokeRGBColor: 56;
    readonly setFillRGBColor: 57;
    readonly setStrokeCMYKColor: 58;
    readonly setFillCMYKColor: 59;
    readonly shadingFill: 60;
    readonly beginInlineImage: 61;
    readonly beginImageData: 62;
    readonly endInlineImage: 63;
    readonly paintXObject: 64;
    readonly markPoint: 65;
    readonly markPointProps: 66;
    readonly beginMarkedContent: 67;
    readonly beginMarkedContentProps: 68;
    readonly endMarkedContent: 69;
    readonly beginCompat: 70;
    readonly endCompat: 71;
    readonly paintSolidColorImageMask: 72;
    readonly paintImageMaskXObject: 73;
    readonly paintImageXObject: 74;
    readonly paintInlineImageXObject: 75;
    readonly paintImageMask: 76;
    readonly // ... you can add more if you parse operator lists deeply
    [key: string]: number;
  };

  // ────────────────────────────────────────────────
  // Core interfaces (already good – just kept & extended slightly)
  // ────────────────────────────────────────────────
  export interface PDFDocumentLoadingTask {
    promise: Promise<PDFDocumentProxy>;
    destroy(): void;
    onPassword?: (updatePassword: (password: string | null) => void) => void;
    onProgress?: (progressData: { loaded: number; total: number }) => void;
    abort(): void;
  }

  export interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
    getMetadata(): Promise<any>;
    getOutline(): Promise<any[] | null>;
    getAttachments(): Promise<any>;
    getJavaScript(): Promise<any[]>;
    destroy(): Promise<void>;
    // cleanup?(): void;        // sometimes used
    // getDestination(id: string): Promise<any>;
    // ... add more as needed
  }

  export interface PDFPageProxy {
    pageNumber: number;
    pageInfo: any;
    stats: any;
    getViewport(params: { scale: number; rotation?: number; dontFlip?: boolean }): PageViewport;
    getTextContent(params?: { normalizeWhitespace?: boolean; disableCombineTextItems?: boolean }): Promise<TextContent>;
    render(params: any): RenderTask;
    getOperatorList(): Promise<OperatorList>;
    transport: any;
    commonObjs: any;
    objs: any;
    cleanup(): void;
    _destroy(): void;
  }

  export interface PageViewport {
    viewBox: number[];
    scale: number;
    rotation: number;
    transform: number[];
    width: number;
    height: number;
    convertsToViewportPoint(x: number, y: number): [number, number];
    convertToViewportPoint(x: number, y: number): [number, number];
    convertToViewportRectangle(rect: number[]): number[];
    convertToPdfPoint(x: number, y: number): [number, number];
  }

  export interface TextContent {
    items: TextItem[];
    styles: Record<string, any>;
  }

  export interface TextItem {
    str: string;
    dir: string;
    transform: number[];
    width: number;
    height: number;
    fontName: string;
    hasEOL: boolean;
  }

  export interface OperatorList {
    fnArray: number[];              // indices into OPS.*
    argsArray: any[][];             // arguments for each operator
    length: number;
    // sometimes .chunkSize, .read(), etc. – rarely used directly
  }

  export interface RenderTask {
    promise: Promise<void>;
    cancel(): void;
    onRenderProgress?: (progress: number) => void;
    // _internalRenderTask?: any;   // private
  }

  // ────────────────────────────────────────────────
  // Your requested type aliases (Intf prefix)
  // ────────────────────────────────────────────────
  export type IntfPDFRawPage     = PDFPageProxy;
  export type IntfPDFTextContent = TextContent;
  export type IntfPDFOperatorList = OperatorList;
  export type IntfPDFRender      = RenderTask;
  export type IntfPDFViewPort    = PageViewport;
}

// Optional: if you sometimes import from the root module too
declare module 'pdfjs-dist' {
  export * from 'pdfjs-dist/legacy/build/pdf.mjs';
}
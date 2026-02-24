/* eslint-disable @typescript-eslint/no-explicit-any */
// pdfjs-legacy.d.ts
// Minimal working declarations for pdfjs-dist/legacy/build/pdf.js in Node.js

declare module 'pdfjs-dist/legacy/build/pdf.js' {
export function getDocument(
    source: string | Uint8Array | ArrayBuffer | object,
    options?: any
  ): PDFDocumentLoadingTask;

  export interface PDFDocumentLoadingTask {
    promise: Promise<PDFDocumentProxy>;
    destroy(): void;
    onPassword?: (updatePassword: (password: string) => void) => void;
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
    // ... more methods as you use them
  }

  export interface PDFPageProxy {
    pageNumber: number;
    pageInfo: any;
    stats: any;
    getViewport(params: { scale: number; rotation?: number; }): PageViewport;
    getTextContent(params?: any): Promise<TextContent>;
    render(params: any): RenderTask;
    getOperatorList(): Promise<any>;
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
    convertsToViewportRectangle(rect: number[]): number[];
    convertToViewportPoint(x: number, y: number): [number, number];
    // ... etc.
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

  export interface RenderTask {
    promise: Promise<void>;
    cancel(): void;
    onRenderProgress?: (progress: number) => void;
  }

  // Global worker (important for Node.js!)
  export const GlobalWorkerOptions: {
    workerSrc: string;
    workerPort?: any;
    enableWorkerFetch?: boolean;
    // ... more
  };

  // Version & other top-level
  export const version: string;

  // If you use other parts (AnnotationLayer, etc.), add them similarly
}

// Optional: augment the main 'pdfjs-dist' module if you mix legacy/modern
declare module 'pdfjs-dist' {
  // You can re-export or alias if needed
}
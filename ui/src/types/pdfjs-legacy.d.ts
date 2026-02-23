declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  // Basic declaration to let TypeScript/VS Code resolve the ESM legacy build.
  // We re-export types from the package entry if available, and provide a
  // default `any` export to satisfy imports like `import * as pdfjs from '...';`.
  export * from 'pdfjs-dist';
  const pdfjs: any;
  export default pdfjs;
}

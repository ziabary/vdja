import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { normalizePersianText } from "../i18n";
import { createTempDir, removeTempDir } from "../common";
import { type IntfFileMeta, type IntfTextExtractResult } from "../../interfaces/file";

interface IntfPandocBlock {
  t: string;        // block type, e.g., "Para", "Header"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c?: any
}

interface IntfVirtualSection {
  title: string;
  blocks: unknown[];
}

// --- Helper: Strip attributes recursively ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripPandocAttributes(node: any): any {
  if (Array.isArray(node)) {
    // Attribute triple exactly: [string, array, array]
    if (
      node.length === 3 &&
      typeof node[0] === "string" &&
      Array.isArray(node[1]) &&
      Array.isArray(node[2]) &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      node[2].every((x: any) => Array.isArray(x) && x.length === 2)
    ) {
      // This is an attr triple → zero it
      return ["", [], []];
    }

    // Otherwise recurse
    return node.map(stripPandocAttributes);
  }

  if (node && typeof node === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: any = {};
    for (const k in node) {
      out[k] = stripPandocAttributes(node[k]);
    }
    return out;
  }

  return node;
}


// --- Helper: Compute “virtual heading score” ---
function computeStyleScore(block: IntfPandocBlock, avgFontSize: number): number {
  let score = 0;
  if (block.c && Array.isArray(block.c)) {
    for (const run of block.c) {
      const attr = run.attributes ?? {};
      if (attr.bold) score += 1;
      if (attr.fontSize && attr.fontSize > avgFontSize) score += 2;
      if (attr.align === "Center") score += 1;
      if (attr.uppercase || /^[A-Z\s]+$/.test(run.c)) score += 1;
    }
  }
  return score;
}

function computeAverageFontSize(blocks: IntfPandocBlock[]){
  const allFontSizes: number[] = [];
  for (const b of blocks) {
    if (b.c && Array.isArray(b.c)) {
      for (const run of b.c) {
        const fontSize = run.attributes?.fontSize;
        if (fontSize) allFontSizes.push(fontSize);
      }
    }
  }
  return allFontSizes.length
    ? allFontSizes.reduce((a, b) => a + b, 0) / allFontSizes.length
    : 12;
}

function splitToSections(blocks: IntfPandocBlock[], avgFontSize: number) {
  // --- Split blocks into virtual sections ---
  const sections: IntfVirtualSection[] = [];
  let currentSection: IntfVirtualSection = { title: "", blocks: [] };

  for (const b of blocks) {
    const score = computeStyleScore(b, avgFontSize);

    if ((b.t === "Header" && b.c[0] === 1) || score >= 3) {
      // New section detected
      if (currentSection.blocks.length) sections.push(currentSection);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const titleText = b.t === "Header" ? b.c[1].map((r: any) => r.c).join("").trim()
          : b.c.map((r: { c: unknown }) => r.c).join(" ").trim() || "Untitled Section";

      currentSection = { title: titleText, blocks: [] };
    } else {
      currentSection.blocks.push(b);
    }
  }
  if (currentSection.blocks.length) sections.push(currentSection);
  return sections
}

const getPandocHeader = () => ({
  "pandoc-api-version": [1, 23, 1],
  meta: {},
});

async function sectionText(section:IntfVirtualSection, i:number, tmpFolder:string) {
  // --- Strip attributes before passing to Pandoc ---
  const cleanBlocks = stripPandocAttributes(section.blocks as IntfPandocBlock[]);
  const doc = {
    ...getPandocHeader(),
    blocks: cleanBlocks,
  };

  const tmpJson = path.join(tmpFolder, `chunk-${i}.json`);
  await fs.writeFile(tmpJson, JSON.stringify(doc, undefined, 2));

  const tmpMd = path.join(tmpFolder, `chunk-${i}.md`);
  await new Promise<void>((resolve, reject) =>
    execFile(
      "pandoc",
      [tmpJson, "-f", "json", "-t", "markdown", "-o", tmpMd],
      (err) => (err ? reject(err) : resolve())
    )
  );

  const md = await fs.readFile(tmpMd, "utf-8");
  let txt = ""
  if (section.title) txt += `\n\n${normalizePersianText(section.title)}\n\n`;
  txt += normalizePersianText(md.replace(/([^\n])\n([^\n])/g, "$1 $2")) + "\n\n";

  return txt
}

async function getFileSections(file: IntfFileMeta) {
  const ext = path.extname(file.originalname).toLowerCase();
  await fs.rename(file.path, file.path+ext)
  file.path=file.path+ext

  const json = await new Promise<{ blocks: IntfPandocBlock[], meta: { title: string } }>((resolve, reject) =>
    execFile("pandoc", [file.path, "-t", "json"], (err, stdout) =>
      err ? reject(err) : resolve(JSON.parse(stdout))
    )
  );

  const blocks = json.blocks;
  const avgFontSize = computeAverageFontSize(blocks)
  const sections = splitToSections(blocks, avgFontSize)
  return sections
}


export async function extractFromDoc(
  file: IntfFileMeta,
  fromPage = 0,
  toPage: number | undefined = undefined,
  maxChars = Infinity
): Promise<IntfTextExtractResult> {

  const tmpFolder = await createTempDir("doc-extract");
  try {
    const sections = await getFileSections(file)

    // --- Pagination: simple fake pages by sections ---
    const start = fromPage;
    const end = toPage ? Math.min(toPage, sections.length) : sections.length;

    let finalText = "";
    let stripped = false;

    for (let i = start; i < end; i++) {
      if (i >= sections.length) continue;

      finalText += await sectionText(sections[i]!, i, tmpFolder)

      if (finalText.length >= maxChars) {
        finalText = finalText.substring(0, Math.min(finalText.length, maxChars - 6)) + " [...]";
        stripped = true;
        break;
      }
    }

    return {
      meta: { pageCount: sections.length, title: sections.length ? sections[0]!.title: "" },
      stripped,
      text: finalText,
    };
  } finally {
    await removeTempDir(tmpFolder);
  }
}

export async function extractFromDocInteractive(
  file: IntfFileMeta,
  onSection?: (sectionIndex: number, sectionText: string, totalSections: number) => Promise<void>
) {
  const tmpFolder = await createTempDir("doc-extract");
  try {
    const sections = await  getFileSections(file)
    for (let i = 0; i < sections.length; i++) {
      const text = await sectionText(sections[i]!, i, tmpFolder)
      if (onSection) await onSection(i + 1, text, sections.length);
    }

    return sections;
  } finally {
    await removeTempDir(tmpFolder);
  }
}
import * as fs from "fs/promises";
import * as path from "path";
import { extractFromPDFInteractive } from "../utils/fileProcessors/pdf";
import { extractFromPDFInteractive as simpleExtractFromPDFInteractive } from "../utils/fileProcessors/pdf-simple"
import { extractFromDocInteractive } from "../utils/fileProcessors/doc";

import type { IntfChunk, IntfChunkMeta, IntfFileMeta } from "../interfaces/file";
import { exHttpInvalidParams } from "../interfaces/exHttp";
import { sleep } from "../utils/common";
import logger from "../utils/logger";
import configManager from "../utils/configManager";

function splitSentences(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!؟\?])(?:\s+|\n+)/)
    .map(s => s.trim())
    .filter(Boolean);
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 20);
}

function splitSoftParagraphs(text: string): string[] {
  return text
    .split(/(?:\n{2,}|<!--PAGE:\d+-->)/)
    .map(p => p.trim())
    .filter(p => p.length > 30);
}

export function semanticChunker(
  text: string,
  meta: IntfChunkMeta,
  options = {
    maxChars: 900,
    minChars: 50,
    overlap: 150,
  }
): IntfChunk[] {

  text = text.trim();
  if (!text) return [];

  let paragraphs = splitSoftParagraphs(text);
  if (!paragraphs.length) paragraphs = [text];

  const chunks: IntfChunk[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (para.length > options.maxChars * 1.3) {
      // force sentence-level split
      const forced = splitSentences(para);
      paragraphs.splice(
        paragraphs.indexOf(para),
        1,
        ...forced
      );
      continue;
    }
    if ((current + " " + para).length <= options.maxChars) {
      current += (current ? "\n\n" : "") + para;
      continue;
    }

    if (current.length >= options.minChars) {
      chunks.push({ text: current.trim(), meta: { ...meta } });
      current = "";
    }

    if (para.length > options.maxChars) {
      const sentences = splitSentences(para);
      let buf = "";

      for (const s of sentences) {
        if ((buf + " " + s).length <= options.maxChars) {
          buf += " " + s;
        } else {
          if (buf.length >= options.minChars)
            chunks.push({ text: buf.trim(), meta: { ...meta } });
          buf = s;
        }
      }

      if (buf.length >= options.minChars)
        chunks.push({ text: buf.trim(), meta: { ...meta } });

    } else {
      current = para;
    }
  }

  if (current.length >= options.minChars)
    chunks.push({ text: current.trim(), meta: { ...meta } });

  // Overlap (sliding window context)
  if (chunks.length < 2) return chunks;
  for (let i = 1; i < chunks.length; i++) {
    const prevChunk = chunks[i - 1];
    const currentChunk = chunks[i];

    if (!prevChunk || !currentChunk) continue;

    //const overlapText = prevChunk.text.slice(-options.overlap);
    const prevText = prevChunk.text ?? "";
    const lastPara =
      prevText
        .split(/\n{2,}/)
        .filter(Boolean)
        .pop() ?? "";
    const overlapText = lastPara.slice(-options.overlap);

    //currentChunk.text = overlapText + "\n\n" + currentChunk.text;
    currentChunk.text =
      (overlapText + "\n\n" + currentChunk.text)
        .slice(0, options.maxChars);
  }

  return chunks.filter(c => c.text.length > options.minChars);
}

export default async function file2DB(
  file: IntfFileMeta,
  fileKey: string,
  onChunk: (chunks: IntfChunk[]) => Promise<number>,
  onProgress?: (pageOrSection: number, total: number) => void,
) {
  if (typeof onChunk !== "function")
    throw new Error("file2DB requires onChunk callback (vector upsert)");

  const ext = path.extname(file.originalname).toLowerCase();
  let totalChunks = 0
  let totalContent = 0
  let totalPoints = 0

  if (ext === ".pdf") {
    const pdfParser = configManager.active().app.legacyPDFParser ? simpleExtractFromPDFInteractive :extractFromPDFInteractive  
    await pdfParser(file, async (pageNum, pageText, pageCount) => {
      totalContent += pageText.length
      const chunks = semanticChunker(pageText, {
        fileKey,
        page: pageNum,
      });

      totalChunks += chunks.length
      totalPoints += await onChunk(chunks);

      if (onProgress) onProgress(pageNum, pageCount);
      await sleep(1000)
    });
  } else if ([".docx", ".doc", ".odt"].includes(ext)) {
    await extractFromDocInteractive(file, async (sectionNum, sectionText, total) => {
      totalContent += sectionText.length
      const chunks = semanticChunker(sectionText, {
        fileKey,
        section: `Section ${sectionNum}`,
      });
      totalChunks += chunks.length
      totalPoints += await onChunk(chunks);

      if (onProgress) onProgress(sectionNum, total);
      await sleep(300)
    });
  } else if (ext === ".txt" || ext === ".md") {
    const raw = await fs.readFile(file.path, "utf-8");
    totalContent += raw.length

    try {
      const chunks = semanticChunker(raw, {
        fileKey
      });
      totalChunks += chunks.length
      totalPoints += await onChunk(chunks);

      if (onProgress) onProgress(1, 1);
    } catch (ex) {
      logger.error(ex)
    }
  } else {
    throw new exHttpInvalidParams("Unsupported file type for vectorization");
  }
  return { totalChunks, totalContent, totalPoints }
}
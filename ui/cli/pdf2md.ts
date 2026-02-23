#!/usr/bin/env -S npx tsx

import fs from "fs/promises";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { extractFromPDFInteractive } from "../src/utils/fileProcessors/pdf";
import logger from "../src/utils/logger";
// or use the new pure extractPDFToStructuredText if you added it


interface CliArgs {
  input: string;
  output?: string;
  from?: number;
  to?: number;
  header?: number;
  footer?: number;
  autoHeader?: boolean;
}

const argv = yargs(hideBin(process.argv))
  .scriptName("pdf2md")
  .command(
    "$0 <input> [output]",
    "Convert PDF to Markdown",
    y => {
      return y
        .positional("input", {
          type: "string",
          describe: "Input PDF file",
          demandOption: true,
        })
        .positional("output", {
          type: "string",
          describe: "Output markdown file",
        })
        .option("from", {
          type: "number",
          describe: "Start page (1-based)",
        })
        .option("to", {
          type: "number",
          describe: "End page (1-based)",
        })
        .option("header", {
          type: "number",
          describe: "Header cutoff ratio (0–1)",
        })
        .option("footer", {
          type: "number",
          describe: "Footer cutoff ratio (0–1)",
        })
        .option("auto-header", {
          type: "boolean",
          default: true,
          describe: "Auto-detect repeating headers/footers",
        });
    }
  )
  .check(args => {
    if (!args.input.endsWith(".pdf")) {
      throw new Error("Input must be a .pdf file");
    }
    if (args.from && args.from < 1) {
      throw new Error("--from must be >= 1");
    }
    if (args.to && args.to < 1) {
      throw new Error("--to must be >= 1");
    }
    if (args.from && args.to && args.from > args.to) {
      throw new Error("--from cannot be greater than --to");
    }
    if (args.header != null && (args.header < 0 || args.header > 1)) {
      throw new Error("--header must be between 0 and 1");
    }
    if (args.footer != null && (args.footer < 0 || args.footer > 1)) {
      throw new Error("--footer must be between 0 and 1");
    }
    return true;
  })
  .strict()
  .help()
  .demandCommand(1, "")
  .parserConfiguration({ "unknown-options-as-args": false })
  .parseSync();
// ──────────────────────────────────────────────────────
//  Very thin CLI wrapper — reuses your real logic
// ──────────────────────────────────────────────────────
async function convertPdfToMd() {
  const absInput = path.resolve(argv.input);
  const baseName = path.basename(absInput, ".pdf");
  const outFile =
    argv.output ??
    path.join(path.dirname(absInput), `${baseName}.md`);

  console.log(`Converting: ${absInput} → ${outFile}`);

  let fullMd = "";

  await extractFromPDFInteractive(
    {
      path: absInput,
      originalname: path.basename(absInput),
    } as any,
    async (pageNum, pageText) => {
      fullMd += pageText + `\n\n<!-- PAGE: ${pageNum} -->\n\n`;
    }, {
      fromPage: argv.from ? argv.from - 1 : undefined,
      toPage: argv.to ? argv.to - 1 : undefined,
      headerRatio: argv.header,
      footerRatio: argv.footer,
      autoHeader: argv.autoHeader,
    }
  );

  await fs.writeFile(outFile, fullMd.trim());
  console.log("Done.");
}

convertPdfToMd().catch(err => {
  console.error(err);
  process.exit(1);
});

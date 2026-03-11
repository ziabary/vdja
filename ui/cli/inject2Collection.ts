#!/usr/bin/env -S npx tsx

import * as fs from 'fs'
import * as path from 'path'

import db from '../src/db';
import md5 from 'md5';
import atDB from "../src/db/atDB";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { RAHBARI_COLLECTION, RAHBARI_UID } from "../src/routes/rahbari"
import configManager from "../src/utils/configManager";
import { generate } from '../src/services/chatService';
import { enuLLMServices } from "../src/interfaces/config";
import vectorDB from "../src/services/vectorDB";
import { semanticChunker } from '../src/services/file2TxtService';
import { enuFileStatus } from '../src/db/tables/tblFiles';
import { GEN_QUESTIONS_PROMPT_PREFIX, RAG_GLOBAL_INFORMATION } from "../src/services/ragService"

interface IntfInjectOption {
  collection: string,
  uid: number,
  genQuestions: boolean,
  mustIgnore: (article: any) => boolean
}

configManager.init("../.config.json");

const SERVICES: { [key: string]: IntfInjectOption } = {
  [enuLLMServices.RAG]: {
    collection: RAG_GLOBAL_INFORMATION,
    uid: 3,
    genQuestions: false,
    mustIgnore: (article: any) => {
      return !article.content
        || article.content.length < 2
    }
  },

  [enuLLMServices.Rahbari]: {
    collection: RAHBARI_COLLECTION,
    uid: RAHBARI_UID,
    genQuestions: true,
    mustIgnore: (article: any) => {
      const ignoredPath = article.url.includes("/others")
        || article.url.includes("/video")
        || article.url.includes("/audio")
        || article.url.includes("/news")
        || article.url.includes("/sahifeh")

      return ignoredPath //|| !article.url.includes('/audio')
    }
  }
}

interface IntfCliArgs {
  service: string
  path: string
  genq?: boolean;
}

const argv = yargs(hideBin(process.argv))
  .scriptName("inject2Collection")
  .command(
    "$0 <service> <path> [--force] [--genq] [--no-genq]",
    "Inject file to collection or update it",
    y => {
      return y
        .positional("service", {
          type: "string",
          describe: "service name can be: " + Object.keys(SERVICES).join(','),
          demandOption: true,
        })
        .positional("path", {
          type: "string",
          describe: "directory path to lookup",
          demandOption: true,
        })
        .option("genq", {
          type: "boolean",
          default: false,
          describe: "Generate questions",
        })
        .option("no-genq", {
          type: "boolean",
          default: false,
          describe: "Do not generate questions",
        })
        .option("force", {
          type: "boolean",
          default: false,
          describe: "Forcibly update",
        })
    }
  )
  .check(args => {
    if (!Object.keys(SERVICES).includes(args.service as string))
      throw new Error("Invalid service: " + args.service);
    if (!args.path)
      throw new Error("Path is obligatory");
    return true;
  })
  .strict()
  .help()
  .demandCommand(1, "")
  .parserConfiguration({ "unknown-options-as-args": false })
  .parseSync();

export enum enuTextType {
  paragraph = "p",
  caption = "caption",
  cite = "cite",
  h1 = "h1",
  h2 = "h2",
  h3 = "h3",
  h4 = "h4",
  alt = "alt",
  link = "link",
  ilink = "ilink",
  li = "li",
  blockquote = "blockquote"
}

export function textContent(article: any): string {
  let text = ''
  if (article.title) text += `# ${article.aboveTitle ? article.aboveTitle : ''} ${article.title}\n\n`
  if (article.subtitle) text += `> ${article.subtitle}\n\n`
  if (article.summary) text += `> ${article.summary}\n\n`

  for (const item of article.content) {
    switch (item.type as enuTextType) {
      case enuTextType.alt:
      case enuTextType.blockquote:
      case enuTextType.caption:
      case enuTextType.cite:
      case enuTextType.link:
        break;
      case enuTextType.h1: text += `# ${item.text}\n\n`; break;
      case enuTextType.h2: text += `## ${item.text}\n\n`; break;
      case enuTextType.h3: text += `### ${item.text}\n\n`; break;
      case enuTextType.h4: text += `#### ${item.text}\n\n`; break;
      case enuTextType.paragraph: text += `${item.text}\n\n`; break;
      case enuTextType.li: text += `- ${item.text}\n\n`; break;
      case enuTextType.ilink: text += item.ref ? `[${item.text}](${item.ref}) ` : `${item.text}\n\n`; break;
    }
  }

  return text
}

export async function startInsert(
  service: enuLLMServices,
  filesPath: string,
  options: IntfInjectOption,
) {
  await db.init();

  await vectorDB().initCollection(options.collection)

  const dates = fs.readdirSync(filesPath);
  let chunkCount = 0
  let sampleFileKey = ''

  for (const dir of dates) {
    const datePath = path.join(filesPath, dir);
    const files = fs.readdirSync(datePath);

    for (const file of files) {
      const filePath = path.join(datePath, file);
      const content = fs.readFileSync(filePath, 'utf-8')
      const fileSize = fs.statSync(filePath).size

      try {
        let url = ''
        let text = ""
        let title = ""
        let time = 0

        if (filePath.endsWith('.json')) {
          const article = JSON.parse(content)

          text = textContent(article)
          if (options.mustIgnore(article)) {
            console.log(`${filePath} [${decodeURIComponent(article.url)}] ===> Skipped (${text.length})`)
            continue
          }

          url = decodeURIComponent(article.url)
          time = new Date(article.date).getTime() || 0
          title = article.title || file
        } else {
          text = content
          url = file
          time = new Date().getTime()
          title = content.substring(0, content.indexOf("\n")).replace(/^#+ /, "")
        }
        title = title.substring(0, 100) + (title.length > 100 ? "...": "")

        if (text.length < 1000) {
          console.log(`${filePath} [${url}] ===> Skipped (${text.length})`)
          continue
        }

        const fileKey = md5(text)

        const res = await atDB.files.get(service, options.uid, fileKey)
        if (res) {
          if (argv.force) {
            const deletedChunks = await vectorDB().deleteFileChunks(options.collection, fileKey)
            const delRes = await atDB.files.delete(service, res, true)
            console.log(`${filePath} [${url}] ===> REMOVED. chunks: ${deletedChunks}, ${delRes}`)
          } else {
            console.log(`${filePath} [${url}] ===> Was stored"`)
            sampleFileKey = fileKey
            continue
          }
        }

        const chunks = semanticChunker(text, { fileKey, time, title }, {
          maxChars: 900,
          minChars: 300,
          overlap: 150,
        })

        if (chunks.length) {
          await atDB.files.add(service, options.uid, fileKey, url, fileSize, chunkCount, enuFileStatus.active)
          chunkCount += await vectorDB().addFileText(options.collection, fileKey, url, chunks)
          console.log(`${filePath} [${url}]: chunks: ${chunks.length} ==> ${chunkCount}`)
          sampleFileKey = fileKey
        }
      } catch (e) {
        console.log(e)
      }
    }
  }

  if ((options.genQuestions && !argv["no-genq"]) || argv["genq"]) {
    for (let i = 0; i < 10; i++) {
      console.log(`===========> Generating Questions (${i}/10)`)
      const randomChunks = await vectorDB().getRandomChunks(
        options.collection,
        null,
        10
      );

      let partOfChunks = ""
      for (const chunk of randomChunks) {
        if (partOfChunks.length + chunk.length > 3000) continue
        partOfChunks += "\n\n...\n\n" + chunk
      }

      const generatedText = await generate(
        "تولید سوال",
        service,
        `بر اساس محتوای ارایه‌شده ۵ سوال کوتاه حداکثر ۱۰ کلمه‌ای طرح کن. 
- سوالات حتما **به صورت متن ساده** و **بدون علایم markdown** و  **بدون پرانتز**، **بدون ستاره** و **بدون سایر علایم** تولید شوند 
- حتما در ابتدای هر سوال شماره سوال رو به صورت 1. و 2. بذار`,
        GEN_QUESTIONS_PROMPT_PREFIX + partOfChunks,
        500,
        0.7
      );
      if (!generatedText) {
        i--
        continue
      }

      for (const line of generatedText.split("\n")) {
        const matches = line.match(/\d\.(.*)/);
        if (matches && matches.length > 1) {
          const q = matches[1]?.replace(/[\*#]/g, "")?.trim();
          if (q)
            await atDB.sampleQuestions.add(service, options.uid, sampleFileKey, q)
        }
      }
    }
  }

  console.log("===============> FINISHED <================")
  process.exit()
}

startInsert(
  argv.service as enuLLMServices,
  argv.path as string,
  SERVICES[argv.service as enuLLMServices],
);

#!/usr/bin/env -S npx tsx
import https from 'https';
import * as cheerio from 'cheerio';
import * as fs from 'fs'
import * as path from 'path'

import vectorDB from "../src/services/vectorDB";
import { RAHBARI_COLLECTION, RAHBARI_UID } from "../src/routes/rahbari"
import { GEN_QUESTIONS_PROMPT_PREFIX, GEN_QUESTIONS_SYSTEM_PROMPT } from "../src/services/ragService"
import { generate } from '../src/services/chatService';
import configManager from "../src/utils/configManager";
import atDB from "../src/db/atDB";
import md5 from 'md5';
import db from '../src/db';
import { enuLLMServices } from '../src/interfaces/config';
import { semanticChunker } from '../src/services/file2TxtService';
import { enuFileStatus } from '../src/db/tables/tblFiles';

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

function mustIgnore(article: any) {
  const ignoredPath = article.url.includes("/others")
    || article.url.includes("/video")
    || article.url.includes("/audio")
    || article.url.includes("/news")
    || article.url.includes("/sahifeh")

  return ignoredPath //|| !article.url.includes('/audio')
}

function textContent(article: any): string {
  let text = ''
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
      case enuTextType.ilink: text += `[${item.text}](${item.ref}) `; break;
    }
  }

  return text
}

async function start(filesPath: string) {
  configManager.init("../.config.json");
  db.init();
  await vectorDB().initCollection(RAHBARI_COLLECTION)

  const removed = await vectorDB().deleteFileChunks(RAHBARI_COLLECTION, enuLLMServices.Rahbari)
  console.log("Total Removed: ", removed)

  const dates = fs.readdirSync(filesPath);
  let chunkCount = 0
  let url = ''
  let sampleFileKey = ''

  for (const dir of dates) {
    const datePath = path.join(filesPath, dir);
    const files = fs.readdirSync(datePath);

    for (const file of files) {
      const filePath = path.join(datePath, file);
      const content = fs.readFileSync(filePath, 'utf-8')
      const fileSize = fs.statSync(filePath).size

      try {
        let text = ""
        let section: string | undefined = undefined

        if (filePath.endsWith('.json')) {
          const article = JSON.parse(content)

          text = textContent(article)
          if (mustIgnore(article)) {
            console.log(`${filePath} [${article.url}] ===> Skipped (${text.length})`)
            continue
          }

          url = article.url
        } else {
          text = content
          url = file
        }
        if (text.length < 1000) {
          console.log(`${filePath} [${url}] ===> Skipped (${text.length})`)
          continue
        }

        const fileKey = md5(text)

        const res = await atDB.files.get(enuLLMServices.Rahbari, RAHBARI_UID, fileKey)
        if (res) {
          console.log(`${filePath} [${url}] ===> Was stored"`)
          sampleFileKey = fileKey
          continue
        }

        const chunks = semanticChunker(text, { fileKey }, {
          maxChars: 900,
          minChars: 300,
          overlap: 150,
        })

        if (chunks.length) {
          chunkCount += await vectorDB().addFileText(RAHBARI_COLLECTION, fileKey, url, chunks)
          console.log(`${filePath} [${url}]: chunks: ${chunks.length} ==> ${chunkCount}`)
          await atDB.files.add(enuLLMServices.Rahbari, RAHBARI_UID, fileKey, url, fileSize, chunkCount, enuFileStatus.active)
          sampleFileKey = fileKey
        }
      } catch (e) {
        console.log(e)
      }
    }
  }


  for (let i = 0; i < 10; i++) {
    console.log(`===========> Generating Questions (${i}/10)`)
    const randomChunks = await vectorDB().getRandomChunks(
      RAHBARI_COLLECTION,
      null,
      10
    );

    let partOfChunks = ""
    let fileKey = ''
    for (const chunk of randomChunks) {
      if (partOfChunks.length + chunk.length > 3000) continue
      partOfChunks += "\n\n...\n\n" + chunk
    }

    const generatedText = await generate(
      "تولید سوال",
      enuLLMServices.Rahbari,
      `بر اساس محتوای ارایه‌شده ۵ سوال کوتاه حداکثر ۱۰ کلمه‌ای طرح کن. 
      - سوالات حتما **به صورت متن ساده** و **بدون علایم markdown** و  **بدون پرانتز**، **بدون ستاره** و **بدون سایر علایم** تولید شوند 
      - سوالات از نگاه رهبری شهید (آیت‌الله خامنه‌ای) طرح شوند
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
          await atDB.sampleQuestions.add(enuLLMServices.Rahbari, RAHBARI_UID, sampleFileKey, q)
      }
    }
  }

  console.log("===============> FINISHED <================")
  process.exit() 
}

if (process.argv.length < 3) {
  console.log("no path defined")
  process.exit()
}

start(process.argv[2]!);

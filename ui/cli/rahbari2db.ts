#!/usr/bin/env -S npx tsx
import https from 'https';
import * as cheerio from 'cheerio';
import * as fs from 'fs'
import * as path from 'path'

import vectorDB from "../src/services/vectorDB";
import { RAHBARI_COLLECTION, RAHBARI_QUESTIONS_UID } from "../src/routes/rahbari"
import { GEN_QUESTIONS_PROMPT_PREFIX, GEN_QUESTIONS_SYSTEM_PROMPT } from "../src/services/ragService"
import { generate } from '../src/services/chatService';
import configManager from "../src/utils/configManager";
import atDB from "../src/db/atDB";
import md5 from 'md5';
import db from '../src/db';
import { enuLLMServices } from '../src/interfaces/config';
import { semanticChunker } from '../src/services/file2TxtService';

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
  const fileKey = "khamenei.ir"

  for (const dir of dates) {
    const datePath = path.join(filesPath, dir);
    const files = fs.readdirSync(datePath);

    for (const file of files) {
      const filePath = path.join(datePath, file);
      const content = fs.readFileSync(filePath, 'utf-8')

      try {
        let text = ""
        let section = undefined
        if (filePath.endsWith('.json')) {
          const article = JSON.parse(content)

          if (mustIgnore(article)) continue
          text = textContent(article)
          section = article.url
        } else {
          text = content
          section = file
        }
        if (text.length < 1000) continue

        const chunks = semanticChunker(text, {
          fileKey,
          section
        });

        chunkCount += await vectorDB().addFileText(RAHBARI_COLLECTION, fileKey, fileKey, chunks)
        console.log(`${filePath}: chunks: ${chunks.length} ==> ${chunkCount}`)

      } catch (e) {
        console.log(e)
      }
    }
  }

  atDB.files.add(enuLLMServices.Rahbari, RAHBARI_QUESTIONS_UID, enuLLMServices.Rahbari, "rahbari.json", 1, chunkCount)

  for (let i = 0; i < 10; i++) {
    const randomChunks = await vectorDB().getRandomChunks(
      RAHBARI_COLLECTION,
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
      enuLLMServices.Rahbari,
      GEN_QUESTIONS_SYSTEM_PROMPT,
      GEN_QUESTIONS_PROMPT_PREFIX + partOfChunks,
      500,
      0.7
    );
    if (!generatedText) {
      i--
      continue
    }

    return
    for (const line of generatedText.split("\n")) {
      const matches = line.match(/\d\.(.*)/);
      if (matches && matches.length > 1) {
        const q = matches[1]?.replace(/[\*#]/g, "")?.trim();
        if (q)
          await atDB.sampleQuestions.add(enuLLMServices.Rahbari, RAHBARI_QUESTIONS_UID, enuLLMServices.Rahbari, q)
      }
    }
  }
}

if (process.argv.length < 3) {
  console.log("no path defined")
  process.exit()
}

start(process.argv[2]!);

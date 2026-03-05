#!/usr/bin/env -S npx tsx
import https from 'https';
import * as cheerio from 'cheerio';

import vectorDB from "../src/services/vectorDB";
import configManager from "../src/utils/configManager";
import atDB from "../src/db/atDB";
import md5 from 'md5';
import db from '../src/db';

const agent = new https.Agent({ rejectUnauthorized: false });

function fetchWithHttps(url: string, maxRedirects = 10) {
  return new Promise((resolve, reject) => {
    function doRequest(currentUrl: string, cookies: string | undefined, redirectCount: number) {
      if (redirectCount > maxRedirects) {
        return reject(new Error('Too many redirects'));
      }

      const currentUrlObj = new URL(currentUrl);
      const options = {
        host: currentUrlObj.hostname,
        port: currentUrlObj.port || 443,
        path: currentUrlObj.pathname + currentUrlObj.search,
        method: 'GET',
        agent, // Use the custom agent
        cookies
      };

      const req = https.get(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
            const location = res.headers.location;
            const cookiesHeader = res.headers['set-cookie'];
            const cookies: string[] = []
            if (cookiesHeader) {
              for (const cookie of cookiesHeader)
                cookies.push(
                  cookie.split(',')
                    .map(cookie => cookie.split(';')[0].trim()) // Only take the name=value part
                    .join('; ')
                )
            }
            if (location) {
              // Resolve relative URL
              const newUrl = new URL(location, currentUrl).href;
              doRequest(newUrl, cookies.join("; "), redirectCount + 1);
            } else {
              reject(new Error('Redirect without location header'));
            }
          } else {
            // Not a redirect, return the result
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: data,
            });
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });
    }

    doRequest(url, undefined, 0);
  });
}

let totalAdded = 0
async function addFeedToDB(url: string, onFetchURL: ((link: string) => Promise<string[]>) | undefined = undefined) {
  console.log(`Trying ${url} on ${new Date().toLocaleString("fa-IR")}`);
  const res = await fetchWithHttps(url).then((r: any) => r.data)
  //console.log(res)
  //const res = await fetch(url).then((r) => r.text());
  const xml = res.replace(/\r?\n[ \t]*/g, "");
  const matched = xml.match(/<item>(.*?)<\/item>/g);

  if (!matched) return;
  let addedCount = 0
  for (const match of matched) {
    const link = match.match(/<link>(.*?)<\/link>/)[1];
    const linkID = md5(link)

    const res = await atDB.news.exists(linkID)
    //const res = false
    if (!res) {
      try {
        const title = match.match(/<title>(.*?)<\/title>/);
        const desc = match.match(/<description>(.*?)<\/description>/);
        const time = match.match(/<pubDate>(.*?)<\/pubDate>/);
        const timeFa = new Date(time[1]).toLocaleString("fa-IR");
        if (!desc || desc.length < 1) continue;

        console.log("Fetching: ", link)
        const fullContent = onFetchURL ? await onFetchURL(link) : []

        let text = `عنوان: ${title[1]}
لینک: ${link}
تاریخ: ${timeFa}`
        if (fullContent.length)
          text += `  
شرح: ${fullContent.join('\n\n')}`;
        else text += `شرح: ${desc[1]}`

        text = text.trim()

     //   console.log({ text })
        await vectorDB().addFileText(configManager.active().specialCollections.news, linkID, link, { text, meta: { time, fileKey: linkID } })
        await atDB.news.add(link, linkID)
        totalAdded++
        addedCount++
      } catch (e) {
        console.error(e)
      }
    } 
  }

  console.log(`===> ${addedCount} news added`)
  console.log("==================================================");
}

async function addOnlineRSS(selector: string, rssPath: string) {
  await addFeedToDB(rssPath, async (url) => {
    const html = await fetchWithHttps(url).then((r: any) => r.data)
    const $ = cheerio.load(html);
    let paragraphs: string[] = []
    $(selector).each((_, e) => {
      paragraphs.push($(e).text())
    })
    return paragraphs
  })
}

async function start() {
  configManager.init("../.config.json");
  db.init();
  await vectorDB().initCollection(configManager.active().specialCollections.news)

  await addOnlineRSS(".article_content #main_ck_editor p", "https://www.khabarfoori.com/fa/feeds/?p=ZGF0ZVJhbmdlJTVCc3RhcnQlNUQ9LTQzMjAw")

  const khabarFoori = ".article_content #main_ck_editor p"
  await addOnlineRSS(khabarFoori, "https://www.khabarfoori.com/fa/feeds/?p=ZGF0ZVJhbmdlJTVCc3RhcnQlNUQ9LTQzMjAw")
  await addOnlineRSS(khabarFoori, "https://www.khabarfoori.com/fa/feeds/?p=ZGF0ZVJhbmdlJTVCc3RhcnQlNUQ9LTYwNDgwMCZwb3NpdGlvbkZyb250PTI%2C")
  await addOnlineRSS(khabarFoori, "https://www.khabarfoori.com/fa/feeds/?p=ZGF0ZVJhbmdlJTVCc3RhcnQlNUQ9LTYwNDgwMCZwb3NpdGlvbkZyb250PTM%2C")
  await addOnlineRSS(khabarFoori, "https://www.khabarfoori.com/fa/feeds/?p=ZGF0ZVJhbmdlJTVCc3RhcnQlNUQ9LTIxNjAwJm9yZGVyPWhpdHM%2C")
  await addOnlineRSS(khabarFoori, "https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz01OSZkYXRlUmFuZ2UlNUJzdGFydCU1RD0tNjA0ODAwJnBvc2l0aW9uRnJvbnQ9NA%2C%2C")
  await addOnlineRSS(khabarFoori, "https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz0xNDUmZGF0ZVJhbmdlJTVCc3RhcnQlNUQ9LTYwNDgwMCZwb3NpdGlvbkZyb250PTQ%2C")
  await addOnlineRSS(khabarFoori, "https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz02OSZkYXRlUmFuZ2UlNUJzdGFydCU1RD0tNjA0ODAwJnBvc2l0aW9uRnJvbnQ9NA%2C%2C")
  await addOnlineRSS(khabarFoori, "https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz0xNzMmZGF0ZVJhbmdlJTVCc3RhcnQlNUQ9LTYwNDgwMCZwb3NpdGlvbkZyb250PTQ%2C")
  await addOnlineRSS(khabarFoori, "https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz05JmRhdGVSYW5nZSU1QnN0YXJ0JTVEPS02MDQ4MDAmcG9zaXRpb25Gcm9udD00")
  await addOnlineRSS(khabarFoori, "https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz0zOSZkYXRlUmFuZ2UlNUJzdGFydCU1RD0tNjA0ODAwJnBvc2l0aW9uRnJvbnQ9NA%2C%2C")
  await addOnlineRSS(khabarFoori, "https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz0zMiZkYXRlUmFuZ2UlNUJzdGFydCU1RD0tNzc3NjAwMCZwb3NpdGlvbkNhdGVnb3J5PTI%2C")
  await addOnlineRSS(khabarFoori, "https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz0yMiZkYXRlUmFuZ2UlNUJzdGFydCU1RD0tNzc3NjAwMCZwb3NpdGlvbkNhdGVnb3J5PTI%2C")
  await addOnlineRSS(khabarFoori, "https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz04OCZkYXRlUmFuZ2UlNUJzdGFydCU1RD0tNzc3NjAwMCZwb3NpdGlvbkNhdGVnb3J5PTI%2C")
  await addOnlineRSS(khabarFoori, "https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz04NyZkYXRlUmFuZ2UlNUJzdGFydCU1RD0tNzc3NjAwMCZwb3NpdGlvbkNhdGVnb3J5PTI%2C")
  await addOnlineRSS(khabarFoori, "https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz0xNzEmZGF0ZVJhbmdlJTVCc3RhcnQlNUQ9LTc3NzYwMDAmcG9zaXRpb25DYXRlZ29yeT0y")
  await addOnlineRSS(khabarFoori, "https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz05NCZkYXRlUmFuZ2UlNUJzdGFydCU1RD0tNzc3NjAwMCZwb3NpdGlvbkNhdGVnb3J5PTI%2C")

  const tasnim = "article .story p"
  await addOnlineRSS(tasnim, "https://www.tasnimnews.ir/fa/rss/feed/0/0/8/1/TopStories")
  await addOnlineRSS(tasnim, "https://www.tasnimnews.ir/fa/rss/feed/8/0/7/0")
  await addOnlineRSS(tasnim, "https://www.tasnimnews.ir/fa/rss/feed/3/0/7/0")
  await addOnlineRSS(tasnim, "https://www.tasnimnews.ir/fa/rss/feed/1486/0/7/0")
  await addOnlineRSS(tasnim, "https://www.tasnimnews.ir/fa/rss/feed/7/0/7/0")
  await addOnlineRSS(tasnim, "https://www.tasnimnews.ir/fa/rss/feed/2/0/7/0")
  await addOnlineRSS(tasnim, "https://www.tasnimnews.ir/fa/rss/feed/6/0/7/0")

  const khabarOnline = "article .item-body p"
  await addOnlineRSS(khabarOnline, "https://images.khabaronline.ir/rss/tp/1");
  await addOnlineRSS(khabarOnline, "https://images.khabaronline.ir/rss/tp/2");
  await addOnlineRSS(khabarOnline, "https://images.khabaronline.ir/rss/tp/3");
  await addOnlineRSS(khabarOnline, "https://images.khabaronline.ir/rss/tp/4");
  await addOnlineRSS(khabarOnline, "https://images.khabaronline.ir/rss/tp/5");
  await addOnlineRSS(khabarOnline, "https://images.khabaronline.ir/rss/tp/6");
  await addOnlineRSS(khabarOnline, "https://images.khabaronline.ir/rss/tp/7");
  await addOnlineRSS(khabarOnline, "https://images.khabaronline.ir/rss/tp/8");
  await addOnlineRSS(khabarOnline, "https://images.khabaronline.ir/rss/tp/9");
  await addOnlineRSS(khabarOnline, "https://images.khabaronline.ir/rss/tp/10");

  const snn = "main .body"
  await addOnlineRSS(snn, "https://snn.ir/fa/rss/allnews");


  await addFeedToDB("https://isna.ir/rss");
  await addFeedToDB("https://www.irna.ir/rss");
  await addFeedToDB("https://www.irna.ir/rss/tp/1000");
  await addFeedToDB("https://www.irna.ir/rss/tp/1001");
  await addFeedToDB("https://www.irna.ir/rss/tp/1002");
  await addFeedToDB("https://www.irna.ir/rss/tp/1003");
  await addFeedToDB("https://www.irna.ir/rss/tp/1004");
  await addFeedToDB("https://www.irna.ir/rss/tp/1005");
  await addFeedToDB("https://www.irna.ir/rss/tp/1006");
  await addFeedToDB("https://www.irna.ir/rss/tp/1007");
  await addFeedToDB("https://www.irna.ir/rss/tp/1008");
  await addFeedToDB("https://www.irna.ir/rss/tp/1009");
  await addFeedToDB("https://www.irna.ir/rss/tp/1010");
  await addFeedToDB("https://www.irna.ir/rss/tp/1011");
  await addFeedToDB("https://www.irna.ir/rss/tp/1012");
  await addFeedToDB("https://www.irna.ir/rss/tp/1013");
  await addFeedToDB("https://www.irna.ir/rss/tp/1014");
  await addFeedToDB("https://www.irna.ir/rss/tp/1015");
  await addFeedToDB("https://www.irna.ir/rss/tp/1016");
  await addFeedToDB("https://www.irna.ir/rss/tp/1017");
  await addFeedToDB("https://www.irna.ir/rss/tp/1018");
  await addFeedToDB("https://www.irna.ir/rss/tp/1019");
  await addFeedToDB("https://www.irna.ir/rss/tp/1020");
  await addFeedToDB("https://www.irna.ir/rss/tp/1021");
  await addFeedToDB("https://www.irna.ir/rss/tp/1022");
  await addFeedToDB("https://www.irna.ir/rss/tp/1023");
  await addFeedToDB("https://www.irna.ir/rss/tp/1024");
  await addFeedToDB("https://www.irna.ir/rss/tp/1025");
  await addFeedToDB("https://www.irna.ir/rss/tp/1026");
  await addFeedToDB("https://www.irna.ir/rss/tp/1027");
  await addFeedToDB("https://www.irna.ir/rss/tp/1028");
  await addFeedToDB("https://www.irna.ir/rss/tp/1029");
  await addFeedToDB("https://www.irna.ir/rss/tp/1030");
  await addFeedToDB("https://www.irna.ir/rss/tp/1031");
  await addFeedToDB("https://www.irna.ir/rss/tp/1032");
  await addFeedToDB("https://www.irna.ir/rss/tp/1033");
  await addFeedToDB("https://www.irna.ir/rss/tp/1034");
  await addFeedToDB("https://www.irna.ir/rss/tp/1035");
  await addFeedToDB("https://www.irna.ir/rss/tp/1036");
  await addFeedToDB("https://www.irna.ir/rss/tp/1037");
  await addFeedToDB("https://www.irna.ir/rss/tp/1038");
  await addFeedToDB("https://www.irna.ir/rss/tp/1039");
  await addFeedToDB("https://www.irna.ir/rss/tp/1003502")
  await addFeedToDB("https://www.irna.ir/rss/tp/1003079")
  await addFeedToDB("https://www.irna.ir/rss/tp/20")
  await addFeedToDB("https://www.irna.ir/rss/tp/26")
  await addFeedToDB("https://www.irna.ir/rss/tp/23")
  await addFeedToDB("https://www.irna.ir/rss/tp/1003422")
  await addFeedToDB("https://www.irna.ir/rss/tp/1003423")
  await addFeedToDB("https://www.isna.ir/rss-homepage");
  await addFeedToDB("https://www.isna.ir/rss/pl/647");
  await addFeedToDB("https://www.isna.ir/rss/pl/269");
  await addFeedToDB("https://www.isna.ir/rss/pl/794");
  await addFeedToDB("https://www.isna.ir/rss/pl/922");
  await addFeedToDB("https://www.isna.ir/rss/pl/641");
  await addFeedToDB("https://www.isna.ir/rss/pl/614");
  await addFeedToDB("https://www.isna.ir/rss/pl/681");
  await addFeedToDB("https://www.isna.ir/rss/pl/260");
  await addFeedToDB("https://www.isna.ir/rss/pl/615");
  await addFeedToDB("https://www.isna.ir/rss/pl/848");
  await addFeedToDB("https://www.isna.ir/rss/pl/2");
  await addFeedToDB("https://www.isna.ir/rss/tp/5");
  await addFeedToDB("https://www.isna.ir/rss/tp/44");
  await addFeedToDB("https://www.isna.ir/rss/tp/38");
  await addFeedToDB("https://www.isna.ir/rss/tp/41");
  await addFeedToDB("https://www.isna.ir/rss/tp/303");
  await addFeedToDB("https://www.isna.ir/rss/tp/535");
  await addFeedToDB("https://www.isna.ir/rss/tp/390");
  await addFeedToDB("https://www.isna.ir/rss/tp/392");
  await addFeedToDB("https://www.isna.ir/rss/tp/536");
  await addFeedToDB("https://www.isna.ir/rss/tp/551");
  await addFeedToDB("https://www.isna.ir/rss/tp/14");
  await addFeedToDB("https://www.isna.ir/rss/tp/240");
  await addFeedToDB("https://www.isna.ir/rss/tp/152");
  await addFeedToDB("https://www.isna.ir/rss/tp/155");
  await addFeedToDB("https://www.isna.ir/rss/tp/158");
  await addFeedToDB("https://www.isna.ir/rss/tp/407");
  await addFeedToDB("https://www.isna.ir/rss/tp/164");
  await addFeedToDB("https://www.isna.ir/rss/tp/20");
  await addFeedToDB("https://www.isna.ir/rss/tp/167");
  await addFeedToDB("https://www.isna.ir/rss/tp/113");
  await addFeedToDB("https://www.isna.ir/rss/tp/95");
  await addFeedToDB("https://www.isna.ir/rss/tp/98");
  await addFeedToDB("https://www.isna.ir/rss/tp/101");
  await addFeedToDB("https://www.isna.ir/rss/tp/110");
  await addFeedToDB("https://www.isna.ir/rss/tp/298");
  await addFeedToDB("https://www.isna.ir/rss/tp/31");
  await addFeedToDB("https://www.isna.ir/rss/tp/34");
  await addFeedToDB("https://www.isna.ir/rss/tp/68");
  await addFeedToDB("https://www.isna.ir/rss/tp/74");
  await addFeedToDB("https://www.isna.ir/rss/tp/77");
  await addFeedToDB("https://www.isna.ir/rss/tp/80");
  await addFeedToDB("https://www.isna.ir/rss/tp/92");
  await addFeedToDB("https://www.isna.ir/rss/tp/9");
  await addFeedToDB("https://www.isna.ir/rss/tp/47");
  await addFeedToDB("https://www.isna.ir/rss/tp/50");
  await addFeedToDB("https://www.isna.ir/rss/tp/53");
  await addFeedToDB("https://www.isna.ir/rss/tp/59");
  await addFeedToDB("https://www.isna.ir/rss/tp/62");
  await addFeedToDB("https://www.isna.ir/rss/tp/65");
  await addFeedToDB("https://www.isna.ir/rss/tp/550");
  await addFeedToDB("https://www.isna.ir/rss/tp/17");
  await addFeedToDB("https://www.isna.ir/rss/tp/521");
  await addFeedToDB("https://www.isna.ir/rss/tp/161");
  await addFeedToDB("https://www.isna.ir/rss/tp/143");
  await addFeedToDB("https://www.isna.ir/rss/tp/140");
  await addFeedToDB("https://www.isna.ir/rss/tp/522");
  await addFeedToDB("https://www.isna.ir/rss/tp/146");
  await addFeedToDB("https://www.isna.ir/rss/tp/149");
  await addFeedToDB("https://www.isna.ir/rss/tp/170");
  await addFeedToDB("https://www.isna.ir/rss/tp/24");
  await addFeedToDB("https://www.isna.ir/rss/tp/119");
  await addFeedToDB("https://www.isna.ir/rss/tp/122");
  await addFeedToDB("https://www.isna.ir/rss/tp/125");
  await addFeedToDB("https://www.isna.ir/rss/tp/137");
  await addFeedToDB("https://www.isna.ir/rss/tp/128");
  await addFeedToDB("https://www.isna.ir/rss/tp/131");
  await addFeedToDB("https://www.isna.ir/rss/tp/134");
  await addFeedToDB("https://www.isna.ir/rss/tp/512");
  await addFeedToDB("https://www.isna.ir/rss/tp/553");
  await addFeedToDB("https://www.isna.ir/rss/tp/30");
  await addFeedToDB("https://www.isna.ir/rss/tp/260");
  await addFeedToDB("https://www.isna.ir/rss/tp/219");
  await addFeedToDB("https://www.isna.ir/rss/tp/212");
  await addFeedToDB("https://www.isna.ir/rss/tp/221");
  await addFeedToDB("https://www.isna.ir/rss/tp/258");
  await addFeedToDB("https://www.isna.ir/rss/tp/223");
  await addFeedToDB("https://www.isna.ir/rss/tp/225");
  await addFeedToDB("https://www.isna.ir/rss/tp/262");
  await addFeedToDB("https://www.isna.ir/rss/tp/264");
  await addFeedToDB("https://www.isna.ir/rss/tp/227");
  await addFeedToDB("https://www.isna.ir/rss/tp/296");
  await addFeedToDB("https://www.isna.ir/rss/tp/266");
  await addFeedToDB("https://www.isna.ir/rss/tp/307");
  await addFeedToDB("https://www.isna.ir/rss/tp/268");
  await addFeedToDB("https://www.isna.ir/rss/tp/274");
  await addFeedToDB("https://www.isna.ir/rss/tp/276");
  await addFeedToDB("https://www.isna.ir/rss/tp/231");
  await addFeedToDB("https://www.isna.ir/rss/tp/270");
  await addFeedToDB("https://www.isna.ir/rss/tp/272");
  await addFeedToDB("https://www.isna.ir/rss/tp/229");
  await addFeedToDB("https://www.isna.ir/rss/tp/278");
  await addFeedToDB("https://www.isna.ir/rss/tp/305");
  await addFeedToDB("https://www.isna.ir/rss/tp/280");
  await addFeedToDB("https://www.isna.ir/rss/tp/233");
  await addFeedToDB("https://www.isna.ir/rss/tp/282");
  await addFeedToDB("https://www.isna.ir/rss/tp/284");
  await addFeedToDB("https://www.isna.ir/rss/tp/288");
  await addFeedToDB("https://www.isna.ir/rss/tp/286");
  await addFeedToDB("https://www.isna.ir/rss/tp/290");
  await addFeedToDB("https://www.isna.ir/rss/tp/292");
  await addFeedToDB("https://www.isna.ir/rss/tp/294");
  /**/

  console.log("FINISHED! total news added: ", totalAdded);
}
start();

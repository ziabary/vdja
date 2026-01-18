require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const { initCollection, upsertChunks } = require("../services/qdrant");
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

process.env.SQLITE_UTF8 = "1";
const Database = require("better-sqlite3");
const db = new Database("db/news.db", { timeout: 5000 });
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");
db.pragma('encoding = "UTF-8"');
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("cache_size = -64000"); // 64MB cache
db.pragma("temp_store = MEMORY");

db.exec(`
CREATE TABLE IF NOT EXISTS news (
    link TEXT PRIMARY KEY,
    file_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const NEWS_USER = process.env.NEWS_USER || "";

if (!NEWS_USER) throw "Now NEWS_USER defined";

function fetchWithHttps(url, maxRedirects = 10) {
  return new Promise((resolve, reject) => {
    function doRequest(currentUrl, redirectCount) {
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
      };

      const req = https.get(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            const location = res.headers.location;
            if (location) {
              // Resolve relative URL
              const newUrl = new URL(location, currentUrl).href;
              // Follow the redirect
              doRequest(newUrl, redirectCount + 1);
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

    doRequest(url, 0);
  });
}

let totalAdded = 0
async function addFeedToDB(url) {
  console.log("==================================================");
  console.log(`Trying ${url} on ${new Date().toLocaleString("fa-IR")}`);
  const res = await fetchWithHttps(url).then(r=>r.data)
  //console.log(res)
  //const res = await fetch(url).then((r) => r.text());
  const xml = res.replace(/\r?\n[ \t]*/g, "");
  const matched = xml.match(/<item>(.*?)<\/item>/g);
  const tobeAdded = [];

  if (!matched) return;
  for (const match of matched) {
    const link = match.match(/<link>(.*?)<\/link>/)[1];

    const res = db
      .prepare(`SELECT 1 FROM news WHERE news.link='${link}'`)
      .get();
    if (!res) {
      const title = match.match(/<title>(.*?)<\/title>/);
      const desc = match.match(/<description>(.*?)<\/description>/);
      const time = match.match(/<pubDate>(.*?)<\/pubDate>/);
      const timeFa = new Date(time[1]).toLocaleString("fa-IR");
      if (!desc || desc.length < 1) continue;

      const text = `عنوان: ${title[1]}
لینک: ${link}
تاریخ: ${timeFa}
شرح: ${desc[1]}`;

      if (tobeAdded.some((v) => v.link == link)) continue;
      let chunkTimeSeconds = undefined
      if(time.length) {
        const chunkTime = new Date(time[1]);
        chunkTimeSeconds = Math.floor(chunkTime.getTime() / 1000);
      }
      tobeAdded.push({ link, time: chunkTimeSeconds, text });
    }
  }
  if (tobeAdded.length) {
    const fileId = uuidv4();
    await upsertChunks(NEWS_USER, fileId, fileId, tobeAdded);
    tobeAdded.forEach((item) =>
      db
        .prepare("INSERT INTO news (link, file_id) VALUES (?,?)")
        .run(item.link, fileId)
    );
  }
  totalAdded += tobeAdded.length
  console.log(`===> ${tobeAdded.length} news added`)
  console.log("==================================================");
}

// deleteAllByUser(NEWS_USER).then((deleted)=>{
//     console.log({deleted})

async function start() {
  await initCollection(NEWS_USER);
  await addFeedToDB("https://www.khabarfoori.com/fa/feeds/?p=ZGF0ZVJhbmdlJTVCc3RhcnQlNUQ9LTQzMjAw")
  await addFeedToDB("https://www.khabarfoori.com/fa/feeds/?p=ZGF0ZVJhbmdlJTVCc3RhcnQlNUQ9LTYwNDgwMCZwb3NpdGlvbkZyb250PTI%2C")
  await addFeedToDB("https://www.khabarfoori.com/fa/feeds/?p=ZGF0ZVJhbmdlJTVCc3RhcnQlNUQ9LTYwNDgwMCZwb3NpdGlvbkZyb250PTM%2C")
  await addFeedToDB("https://www.khabarfoori.com/fa/feeds/?p=ZGF0ZVJhbmdlJTVCc3RhcnQlNUQ9LTIxNjAwJm9yZGVyPWhpdHM%2C")
  await addFeedToDB("https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz01OSZkYXRlUmFuZ2UlNUJzdGFydCU1RD0tNjA0ODAwJnBvc2l0aW9uRnJvbnQ9NA%2C%2C")
  await addFeedToDB("https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz0xNDUmZGF0ZVJhbmdlJTVCc3RhcnQlNUQ9LTYwNDgwMCZwb3NpdGlvbkZyb250PTQ%2C")
  await addFeedToDB("https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz02OSZkYXRlUmFuZ2UlNUJzdGFydCU1RD0tNjA0ODAwJnBvc2l0aW9uRnJvbnQ9NA%2C%2C")
  await addFeedToDB("https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz0xNzMmZGF0ZVJhbmdlJTVCc3RhcnQlNUQ9LTYwNDgwMCZwb3NpdGlvbkZyb250PTQ%2C")
  await addFeedToDB("https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz05JmRhdGVSYW5nZSU1QnN0YXJ0JTVEPS02MDQ4MDAmcG9zaXRpb25Gcm9udD00")
  await addFeedToDB("https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz0zOSZkYXRlUmFuZ2UlNUJzdGFydCU1RD0tNjA0ODAwJnBvc2l0aW9uRnJvbnQ9NA%2C%2C")
  await addFeedToDB("https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz0zMiZkYXRlUmFuZ2UlNUJzdGFydCU1RD0tNzc3NjAwMCZwb3NpdGlvbkNhdGVnb3J5PTI%2C")
  await addFeedToDB("https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz0yMiZkYXRlUmFuZ2UlNUJzdGFydCU1RD0tNzc3NjAwMCZwb3NpdGlvbkNhdGVnb3J5PTI%2C")
  await addFeedToDB("https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz04OCZkYXRlUmFuZ2UlNUJzdGFydCU1RD0tNzc3NjAwMCZwb3NpdGlvbkNhdGVnb3J5PTI%2C")
  await addFeedToDB("https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz04NyZkYXRlUmFuZ2UlNUJzdGFydCU1RD0tNzc3NjAwMCZwb3NpdGlvbkNhdGVnb3J5PTI%2C")
  await addFeedToDB("https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz0xNzEmZGF0ZVJhbmdlJTVCc3RhcnQlNUQ9LTc3NzYwMDAmcG9zaXRpb25DYXRlZ29yeT0y")
  await addFeedToDB("https://www.khabarfoori.com/fa/feeds/?p=Y2F0ZWdvcmllcz05NCZkYXRlUmFuZ2UlNUJzdGFydCU1RD0tNzc3NjAwMCZwb3NpdGlvbkNhdGVnb3J5PTI%2C")
  await addFeedToDB("https://www.tasnimnews.ir/fa/rss/feed/0/0/8/1/TopStories")
  await addFeedToDB("https://www.tasnimnews.ir/fa/rss/feed/8/0/7/0")
  await addFeedToDB("https://www.tasnimnews.ir/fa/rss/feed/3/0/7/0")
  await addFeedToDB("https://www.tasnimnews.ir/fa/rss/feed/1486/0/7/0")
  await addFeedToDB("https://www.tasnimnews.ir/fa/rss/feed/7/0/7/0")
  await addFeedToDB("https://www.tasnimnews.ir/fa/rss/feed/2/0/7/0")
  await addFeedToDB("https://www.tasnimnews.ir/fa/rss/feed/6/0/7/0")
  
  await addFeedToDB("https://images.khabaronline.ir/rss/tp/1");
  await addFeedToDB("https://images.khabaronline.ir/rss/tp/2");
  await addFeedToDB("https://images.khabaronline.ir/rss/tp/3");
  await addFeedToDB("https://images.khabaronline.ir/rss/tp/4");
  await addFeedToDB("https://images.khabaronline.ir/rss/tp/5");
  await addFeedToDB("https://images.khabaronline.ir/rss/tp/6");
  await addFeedToDB("https://images.khabaronline.ir/rss/tp/7");
  await addFeedToDB("https://images.khabaronline.ir/rss/tp/8");
  await addFeedToDB("https://images.khabaronline.ir/rss/tp/9");
  await addFeedToDB("https://images.khabaronline.ir/rss/tp/10");
  
  await addFeedToDB("https://isna.ir/rss");
  await addFeedToDB("https://www.irna.ir/rss");
  await addFeedToDB("https://snn.ir/fa/rss/allnews");
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

  console.log("FINISHED! total news added: ", totalAdded);
}
start();

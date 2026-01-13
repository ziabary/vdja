require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const {
  upsertChunks,
  deleteAllByUser
} = require("../services/qdrant");

process.env.SQLITE_UTF8 = '1';
const Database = require('better-sqlite3');
const db = new Database('db/news.db', { timeout: 5000 });
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('encoding = "UTF-8"');
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000'); // 64MB cache
db.pragma('temp_store = MEMORY');

db.exec(`
CREATE TABLE IF NOT EXISTS news (
    link TEXT PRIMARY KEY,
    file_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)

const NEWS_USER = process.env.NEWS_USER || "";

if(!NEWS_USER)
    throw "Now NEWS_USER defined"

async function addFeedToDB(url) {
    console.log("==================================================")
    console.log(`Trying ${url} on ${new Date().toLocaleString("fa-IR")}`)
    console.log("==================================================")
    const res = await fetch(url).then(r=>r.text())
    const xml=res.replace(/\r?\n[ \t]*/g,'')
    const matched = xml.match(/<item>(.*?)<\/item>/g)
    const tobeAdded = []
    console.log(matched)
    if(!matched) return
    for (const match of matched) {
        const link = match.match(/<link>(.*?)<\/link>/)[1]

        const res = db.prepare(`SELECT 1 FROM news WHERE news.link='${link}'`).get()
        if(!res) {

            const title = match.match(/<title>(.*?)<\/title>/)
            const desc = match.match(/<description>(.*?)<\/description>/)
            const time = match.match(/<pubDate>(.*?)<\/pubDate>/)
            const timeFa = new Date(time[1]).toLocaleString("fa-IR")
            if(!desc || desc.length < 1)
                continue
            
            const text = `عنوان: ${title[1]}
لینک: ${link}
تاریخ: ${timeFa}
شرح: ${desc[1]}`

            if(tobeAdded.some(v=>v.link == link)) continue
            tobeAdded.push({link, time: time.length ? time[1] : undefined, text})
        }
    }
    if(tobeAdded.length) {
        const fileId = uuidv4()
        await upsertChunks(
                NEWS_USER,
                fileId,
                fileId,
                tobeAdded
        );
        tobeAdded.forEach(item=>db.prepare("INSERT INTO news (link, file_id) VALUES (?,?)").run(item.link, fileId))
    }
}

// deleteAllByUser(NEWS_USER).then((deleted)=>{
//     console.log({deleted})

addFeedToDB('https://isna.ir/rss')
.then(()=>addFeedToDB('https://www.isna.ir/rss-homepage'))
.then(()=>addFeedToDB('https://www.isna.ir/rss-homepage'))
.then(()=>addFeedToDB('https://www.isna.ir/rss-homepage'))
.then(()=>addFeedToDB('https://www.isna.ir/rss-homepage'))
.then(()=>addFeedToDB('https://www.isna.ir/rss-homepage'))
.then(()=>addFeedToDB('https://www.isna.ir/rss-homepage'))
.then(()=>addFeedToDB('https://www.isna.ir/rss-homepage'))
.then(()=>addFeedToDB('https://www.isna.ir/rss-homepage'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/pl/647'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/pl/269'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/pl/794'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/pl/922'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/pl/641'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/pl/614'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/pl/681'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/pl/260'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/pl/615'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/pl/848'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/pl/2'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/5'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/44'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/38'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/41'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/303'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/535'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/390'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/392'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/536'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/551'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/14'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/240'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/152'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/155'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/158'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/407'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/164'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/20'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/167'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/113'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/95'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/98'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/101'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/110'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/298'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/31'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/34'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/68'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/74'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/77'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/80'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/92'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/9'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/47'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/50'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/53'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/59'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/62'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/65'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/550'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/17'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/521'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/161'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/143'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/140'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/522'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/146'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/149'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/170'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/24'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/119'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/122'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/125'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/137'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/128'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/131'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/134'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/512'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/553'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/30'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/260'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/219'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/212'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/221'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/258'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/223'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/225'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/262'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/264'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/227'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/296'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/266'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/307'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/268'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/274'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/276'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/231'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/270'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/272'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/229'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/278'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/305'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/280'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/233'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/282'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/284'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/288'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/286'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/290'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/292'))
.then(()=>addFeedToDB('https://www.isna.ir/rss/tp/294'))
.then(()=>addFeedToDB('https://snn.ir/fa/rss/allnews'))
.then(()=>addFeedToDB('https://snn.ir/fa/rss/allnews'))
.then(()=>addFeedToDB('https://snn.ir/fa/rss/allnews'))
.then(()=>console.log("FINISHED!"))

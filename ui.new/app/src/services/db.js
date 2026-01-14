process.env.SQLITE_UTF8 = '1';

// const getConfigs = require('./config');
// const mysql2 = require('mysql2');
// const mssql = require('mssql');
// const betterSqlite3 = require('better-sqlite3');

// function getDB() {
//   switch (getConfigs().dbType) {
//     case 'sqlite':
//       return new betterSqlite3(getConfigs().sqlite.path, { timeout: sqlite.timeout });
//     case 'mysql':
//       return mysql2.createConnection(getConfigs().mysql);
//     case 'mssql':
//       return mssql.connect(getConfigs().mssql);
//     default:
//       throw new Error('Unsupported database type');
//   }
// }

// module.exports = { getDB };

const betterSqlite3 = require('better-sqlite3');

function initDB(path, tables){
  const db = new betterSqlite3(path, { timeout: 5000 });
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('encoding = "UTF-8"');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000'); // 64MB cache
  db.pragma('temp_store = MEMORY');
  db.exec(tables)
  db.pragma('auto_vacuum = FULL');
  return db
}

const db = initDB('db/vdja.db', `
CREATE TABLE IF NOT EXISTS users (
    user_key TEXT PRIMARY KEY,
    total_storage INTEGER DEFAULT 0,
    file_count INTEGER DEFAULT 0,
    total_chats INTEGER DEFAULT 0,
    total_files_uploaded INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME DEFAULT CURRENT_TIMESTAMP 
  );


  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_key TEXT NOT NULL,
    file_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    chunk_count INTEGER NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chats (
    chat_id TEXT PRIMARY KEY,
    user_key TEXT NOT NULL,
    title TEXT DEFAULT 'چت جدید',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tblSampleQuestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_key TEXT NOT NULL,
    file_id TEXT NOT NULL,
    question TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_chats_user ON chats(user_key);
  CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
  CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_key);
  CREATE INDEX IF NOT EXISTS idx_tblSampleQuestions_user ON tblSampleQuestions(user_key);
  CREATE INDEX IF NOT EXISTS idx_tblSampleQuestions_file_id ON tblSampleQuestions(file_id);
`
);

db.getChat = (user_key, chat_id) => db
    .prepare("SELECT * FROM chats WHERE chat_id = ? AND user_key = ?")
    .get(chat_id, user_key);

db.getUserChats = (user_key) => db
    .prepare("SELECT * FROM chats WHERE user_key = ? ORDER BY last_message_at DESC LIMIT 100")
    .all(user_key);

db.addNewChat = (user_key, new_chat_id, title) => db
    .prepare(`INSERT INTO chats (user_key, chat_id, title, last_message_at)
              VALUES (?, ?, ?, CURRENT_TIMESTAMP)`)
    .run(user_key, new_chat_id, title);

db.updateChatTiming = (user_key, chat_id) => db
    .transaction (()=>{
      db.prepare(
        "UPDATE users SET total_chats = total_chats + 1, last_login_at = CURRENT_TIMESTAMP WHERE user_key = ?"
      ).run(user_key);
      db.prepare(
        "UPDATE chats SET last_message_at = CURRENT_TIMESTAMP WHERE user_key = ? AND chat_id = ?"
      ).run(user_key, chat_id);
    })()

db.updateChatTitle = (user_key, chat_id, new_title) => db
    .prepare("UPDATE chats SET title = ? WHERE chat_id = ? AND user_key = ?")
    .run(new_title, chat_id, user_key);

db.deleteChat = (user_key, chat_id) => db
  .prepare("DELETE FROM chats WHERE user_key = ? AND chat_id = ?")
  .run(user_key, chat_id);

db.deleteAllChats = (user_key) => db
  .prepare("DELETE FROM chats WHERE user_key = ?")
  .run(user_key);

db.getMessages = (chat_id, maxItems = 50) => db
    .prepare(`SELECT * FROM (
        SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT ${maxItems}
        ) A
        ORDER BY created_at ASC `)
    .all(chat_id);

db.addSampleQuestion = (user_id, file_id, question) => db
  .prepare("INSERT INTO tblSampleQuestions (user_key, file_id, question) VALUES(?,?,?)")
  .run(user_id, file_id, question)

db.getUser = (user_key) => db.prepare("SELECT * FROM users WHERE user_key = ?").get(user_key);
db.addUser = (user_key) => {
  db.prepare("INSERT INTO users (user_key) VALUES (?)").run(user_key);
  return { user_key, total_chats: 0, total_files_uploaded:0, total_storage: 0, file_count: 0 }
}

db.getFile = (user_key, file_name, file_size)=>db
  .prepare("SELECT * FROM files WHERE user_key = ? AND file_name = ? AND file_size = ?")
  .get(user_key, file_name, file_size);

db.getUserFiles = (user_key)=>db
  .prepare("SELECT * FROM files WHERE user_key = ? ORDER BY uploaded_at DESC LIMIT 100")
  .all(user_key)

db.addUploadedFile = (user_key, file_id, file_ame, file_size, num_chunks)=> {
  const r = db.transaction(()=>{
      db.prepare(`
      INSERT INTO files (user_key, file_id, file_name, file_size, chunk_count)
      VALUES (?, ?, ?, ?, ?)`
    ).run(user_key, file_id, file_ame, file_size, num_chunks);

    db.prepare(`
      UPDATE users SET total_storage = total_storage + ?, file_count = file_count + 1 
      WHERE user_key = ?`
    ).run(file_size, user_key);
  })()
}

db.getQuestions = (user_key, max_questions = 5) => db
    .prepare(`SELECT * FROM tblSampleQuestions WHERE user_key = ? ORDER BY RANDOM() LIMIT ${max_questions}`)
    .all(user_key)

db.deleteFile = (user_key, file_id) => {
  const fileSize = db
      .prepare("SELECT file_size FROM files WHERE user_key = ? AND file_id = ?")
      .get(user_key, file_id)?.size || 0;

  db.prepare("DELETE FROM files WHERE user_key = ? AND file_id = ?")
    .run(user_key, file_id);
  db.prepare("DELETE FROM tblSampleQuestions WHERE user_key = ? AND file_id = ?")
    .run(user_key, file_id);
  db.prepare(`UPDATE users SET file_count = file_count - 1, total_storage = total_storage - ${fileSize} WHERE user_key = ?`)
    .run(user_key);
}

db.deleteAllFiles = (user_key) => {
  db.prepare("DELETE FROM files WHERE user_key = ?").run(user_key);
  db.prepare(`UPDATE users SET total_storage = 0, file_count = 0 WHERE user_key = ?`).run(user_key);
  db.prepare("DELETE FROM tblSampleQuestions WHERE user_key = ?").run(user_key);
}

/************************************************ */
const logDb = initDB('db/log.db', `
    CREATE TABLE IF NOT EXISTS tblLogs (
      logId        INTEGER PRIMARY KEY AUTOINCREMENT,
      logAct       TEXT NOT NULL,
      logExtra     TEXT NOT NULL,
      logLen       INTEGER NOT NULL,
      logText      TEXT NOT NULL,  
      logCreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)

db.log = (action, extra, len, text) => {
    logDb.prepare("INSERT INTO tblLogs (logAct, logExtra, logLen, logText) VALUES (?, ?, ?, ?)")
      .run(action, extra, len, text);
}

db.getLogs = (action) => {
  const logs = logDb.prepare(`SELECT * FROM tblLogs WHERE logAct = ? ORDER BY logCreatedAt DESC LIMIT 100`)
    .all(action);
  const totalCounts = logDb.prepare(`SELECT SUM(logLen) AS total_len, COUNT(1) AS total_count FROM tblLogs WHERE logAct = ?`)
    .get(action);

  return {logs, totalCounts}
}

db.migrateLogs = () =>{
  try{
    let fromID = 0
    while (fromID >= 0) {
      console.log(`Migration from: ${fromID}`)
      db.transaction(() => {
        const logs = db.prepare(`
          SELECT *
          FROM logs
          WHERE id > ?
          ORDER BY id ASC
          LIMIT 1000
        `).all(fromID);

        if(!logs || logs.length ===0) {
          console.log(`Migration Finished at: ${fromID}`)
          fromID = -1
          return
        }

        for (const log of logs) {
          logDb.prepare(`
              INSERT INTO tblLogs (logAct, logExtra, logLen, logText, logCreatedAt) 
              VALUES (?, ?, ?, ?, ?)
          `).run(log.act, log.extra, log.len, log.text, log.created_at)
          fromID = log.id
        }

        db.prepare("DELETE FROM logs WHERE id<=?").run(fromID)
      })()  
    }
  }catch(e){
    console.log(e)
    throw e
  }
}

module.exports = db;
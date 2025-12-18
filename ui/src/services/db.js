process.env.SQLITE_UTF8 = '1';
const Database = require('better-sqlite3');
const db = new Database('db/vdja.db', { timeout: 5000 });

db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('encoding = "UTF-8"');
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000'); // 64MB cache
db.pragma('temp_store = MEMORY');

db.exec(`
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

  CREATE INDEX IF NOT EXISTS idx_chats_user ON chats(user_key);
  CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
  CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_key);`
);

db.pragma('auto_vacuum = FULL');

module.exports = db;
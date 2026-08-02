const Database = require('better-sqlite3');
const db = new Database('users.db');

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000');
db.pragma('temp_store = memory');
db.pragma('foreign_keys = ON');

const schema = `
CREATE TABLE IF NOT EXISTS users (
    user_key TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_storage INTEGER DEFAULT 0,
    file_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_key TEXT NOT NULL,
    file_id TEXT NOT NULL,
    original_name TEXT NOT NULL,
    size INTEGER NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_key, file_id),
    FOREIGN KEY(user_key) REFERENCES users(user_key) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_key TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_key, chat_id),
    FOREIGN KEY(user_key) REFERENCES users(user_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_key);
CREATE INDEX IF NOT EXISTS idx_chats_user ON chats(user_key);

`;

db.exec(schema);
console.log("DB Generated successfully");
db.close();
const Database = require('better-sqlite3');
const db = new Database('users.db', { timeout: 5000 });

db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

module.exports = db;
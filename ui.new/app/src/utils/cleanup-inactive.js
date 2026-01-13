require("dotenv").config();

const Database = require('better-sqlite3');
const db = new Database('db/vdja.db', { timeout: 5000 });
const { deleteAllByUser } = require("./services/qdrant");

const INACTIVE_DAYS = 7; 

async function cleanupInactiveUsers() {
  console.log(`شروع پاکسازی کاربرانی که بیش از ${INACTIVE_DAYS} روز لاگین نکردند...`);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - INACTIVE_DAYS);
  const cutoffISO = cutoffDate.toISOString();

  const inactiveUsers = db
    .prepare(`
      SELECT user_key FROM users 
      WHERE last_login_at < ?
    `)
    .all(cutoffISO);

  if (inactiveUsers.length === 0) {
    console.log("هیچ کاربر غیرفعالی یافت نشد.");
    return;
  }

  console.log(`${inactiveUsers.length} کاربر غیرفعال یافت شد.`);

  let totalDeletedChunks = 0;

  for (const { user_key } of inactiveUsers) {
    try {
      const deletedChunks = await deleteAllByUser(user_key);
      totalDeletedChunks += deletedChunks;

      // حذف همه داده‌های کاربر از SQLite
      db.prepare("DELETE FROM files WHERE user_key = ?").run(user_key);
      db.prepare("DELETE FROM chats WHERE user_key = ?").run(user_key);
      db.prepare("DELETE FROM messages WHERE chat_id IN (SELECT chat_id FROM chats WHERE user_key = ?)").run(user_key);
      db.prepare("DELETE FROM users WHERE user_key = ?").run(user_key);

      console.log(`کاربر ${user_key.slice(0, 8)}... حذف شد (${deletedChunks} چانک)`);
    } catch (err) {
      console.error(`خطا در حذف کاربر ${user_key.slice(0, 8)}...:`, err.message);
    }
  }

  console.log(`پاکسازی کامل شد. مجموع ${totalDeletedChunks} چانک از Qdrant حذف شد.`);
}

cleanupInactiveUsers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("خطا در پاکسازی:", err);
    process.exit(1);
  });
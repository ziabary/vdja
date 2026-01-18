const express = require("express");
const db = require("../services/db");

const router = express.Router();

router.get("/admin/stats", (req, res) => {
  try {
    const users = db
      .prepare(
        `
      SELECT 
        SUBSTR(user_key, 1, 12) || '...' AS short_user_key,
        created_at,
        last_login_at,
        total_chats,
        total_files_uploaded,
        file_count,
        total_storage
      FROM users 
      ORDER BY last_login_at DESC
      LIMIT 100
    `
      )
      .all();

    const totals = db
      .prepare(
        `
      SELECT 
        SUM(total_chats) AS total_chats,
        SUM(total_files_uploaded) AS total_files_uploaded,
        SUM(file_count) AS total_active_files,
        SUM(total_storage) AS total_storage
      FROM users
    `
      )
      .get();

    const totalUsers = db
      .prepare("SELECT COUNT(*) AS count FROM users")
      .get().count;
    res.json({
      users,
      totals: totals || {
        total_chats: 0,
        total_files_uploaded: 0,
        total_active_files: 0,
        total_storage: 0,
      },
      total_users: totalUsers,
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json({ error: "خطا در دریافت آمار" });
  }
});

router.get("/admin/migrate", (req, res) => {
  try{
  db.migrateLogs();
  res.status(200).json({ok: "finished"})
  }catch(e) {
    res.status(500).json({ error: "خطا در انتقال آمار" });
  }
})

router.get("/admin/log-stats", (req, res) => {
  try {
    if(req.query.user != process.env.GLOBAL_USER)
      throw Error("Unauthorized User")
    
    const { logs, totalCounts, activeCounts } = db.getLogs(req.query.action);
    res.json({ logs, totals: totalCounts || { total_len: 0 }, activeCounts });
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json({ error: "خطا در دریافت آمار" });
  }
});

router.get("/admin/get-conv", (req, res) => {
  try {
    if(req.query.user != process.env.GLOBAL_USER)
      throw Error("Unauthorized User")
    
    const msgs = db
      .prepare(`
        SELECT datetime(created_at, '+210 minutes') AS Jdate, * 
          FROM messages
        WHERE chat_id=?
        ORDER BY messages.created_at ASC
        LIMIT 100
      `).all(req.query.id); 

    res.json({ msgs });
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json({ error: "خطا در دریافت آمار" });
  }
});

module.exports = router;

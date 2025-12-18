const express = require("express");
const { v4: uuidv4 } = require("uuid");
const db = require("../services/db");

const router = express.Router();

router.post("/login", (req, res) => {
  try {
    let user_key = req.body.user_key || uuidv4();

    const existingUser = db.prepare("SELECT user_key FROM users WHERE user_key = ?").get(user_key);

    if (!existingUser) {
      db.prepare(`
        INSERT INTO users (user_key, created_at, last_login_at)
        VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(user_key);
      console.log(`کاربر جدید ثبت شد: ${user_key.slice(0, 8)}...`);
    } else {
      db.prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_key = ?")
        .run(user_key);
      console.log(`کاربر وارد شد: ${user_key.slice(0, 8)}...`);
    }

    res.json({ success: true, user_key });
  } catch (err) {
    console.error("خطا در لاگین:", err);
    res.status(500).json({ error: "خطا در ورود" });
  }
});

module.exports = router;
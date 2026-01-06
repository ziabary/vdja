const express = require("express");
const db = require("../services/db");

const router = express.Router();

router.get("/admin/stats", async (req, res) => {
  try {
    const { users, totals, totalUsers } = await db.getAdminStats();
    res.json({
      users,
      totals: totals || {
        total_chats: 0,
        total_files_uploaded: 0,
        total_active_files: 0,
        total_storage: 0,
      },
      total_users: totalUsers
    });
    await db.logAction('admin', 'view_stats');
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json({ error: "خطا در دریافت آمار" });
  }
});

module.exports = router;

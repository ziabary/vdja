const express = require("express");
const { v4: uuidv4 } = require("uuid");
const db = require("../services/db");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    let user_key = req.body.user_key || uuidv4();
    if (req.body.user_key && req.body.user_key.length < 16) {
      return res.status(400).json({ error: "کلید نامعتبر" });
    }
    const existingUser = await db.getUser(user_key);
    if (!existingUser) {
      await db.insertUser(user_key);
      console.log(`New user added: ${user_key.slice(0, 8)}...`);
    } else {
      await db.updateUserLogin(user_key);
      console.log(`User logged in: ${user_key.slice(0, 8)}...`);
    }

    res.json({ success: true, user_key });
  } catch (err) {
    console.error("Error in login:", err);
    res.status(500).json({ error: "خطا در ورود" });
  }
});

module.exports = router;

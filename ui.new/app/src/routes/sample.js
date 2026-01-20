const express = require("express");

module.exports = async () => {
  const router = express.Router();

  router.post("/translate", async (req, res) => {
    res.send("ok");
  });

  return router;
};
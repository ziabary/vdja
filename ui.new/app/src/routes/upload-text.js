const fs = require("fs");
const os = require("os");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const { fileTypeFromBuffer } = require('file-type');
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 200 * 1024 * 1024 },
});
const pdf = require("pdf-parse");
const mammoth = require("mammoth");

// Extract text from file – reliable version with pdf-parse only
router.post("/upload-text", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "فایلی انتخاب نشده" });

  let text = "";
  try {
    const buffer = fs.readFileSync(req.file.path);
    const type = await fileTypeFromBuffer(buffer);

    const allowedTypes = {
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain",
    };
    if (type && allowedTypes[type.ext]) {
      if (type.ext === "pdf") {
        const data = await pdf(buffer, { pagerender: render_page });
        text = data.text.trim();

        function render_page(pageData) {
          let render_options = {
            normalizeWhitespace: true,
            disableCombineTextItems: false,
          };
          return pageData.getTextContent(render_options).then((textContent) => {
            let lastY,
              text = "";
            for (let item of textContent.items) {
              if (lastY === item.transform[5] || !lastY) {
                text += " " + item.str;
              } else {
                text += "\n" + item.str;
              }
              lastY = item.transform[5];
            }
            return text;
          });
        }
      } else if (type.ext === "docx") {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } else if (type.ext === "txt") {
        text = buffer.toString("utf8");
      }
    } else {
      throw new Error("فرمت فایل پشتیبانی نمی‌شود");
    }

    if (!text || text.length < 10) {
      throw new Error("متن استخراج‌شده بسیار کوتاه یا خالی است");
    }
  } catch (err) {
    console.error("Upload text error:", err);
    return res.status(400).json({
      error:
        "خطا در استخراج متن از فایل. این فایل ممکن است اسکن‌شده، تصویرمحور یا دارای فونت‌های خاص باشد که استخراج متن از آن دشوار است. برای PDFهای فارسی، پیشنهاد می‌شود فایل را به صورت متنی (Text-based) ذخیره کنید.",
    });
  } finally {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path); // immediate delete
    }
  }

  res.json({ text });
});

module.exports = router;

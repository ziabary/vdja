// ===================== RAG APIs =====================
app.post("/api/rag/upload", upload.single("file"), async (req, res) => {
  const { user_key } = req.body;
  if (!user_key || user_key.length < 16) return res.status(400).json({ error: "کلید نامعتبر" });

  // چک کردن محدودیت
  const user = db.prepare("SELECT * FROM users WHERE user_key = ?").get(user_key);
  if (!user) {
    db.prepare("INSERT INTO users (user_key) VALUES (?)").run(user_key);
  }

  const file = req.file;
  let text = "";
  try {
    const buffer = fs.readFileSync(file.path);
    if (file.originalname.toLowerCase().endsWith(".pdf")) {
      const data = await pdf(buffer);
      text = data.text;
    } else if (file.originalname.toLowerCase().endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (file.originalname.toLowerCase().endsWith(".txt")) {
      text = buffer.toString("utf-8");
    }

    const chunks = await chunkText(text, 500);
    const fileId = uuidv4();

    const points = [];
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await getEmbedding(chunks[i]);
      if (embedding) {
        points.push({
          id: uuidv4(),
          vector: embedding,
          payload: {
            user_key,
            file_id: fileId,
            file_name: file.originalname,
            chunk_index: i,
            text: chunks[i]
          }
        });
      }
    }

    await qdrant.upsert("rag_collection", { points });

    db.prepare(`
      INSERT INTO files (user_key, file_id, original_name, size)
      VALUES (?, ?, ?, ?)
    `).run(user_key, fileId, file.originalname, file.size);

    db.prepare("UPDATE users SET total_storage = total_storage + ?, file_count = file_count + 1 WHERE user_key = ?")
      .run(file.size, user_key);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "خطا در پردازش فایل" });
  } finally {
    fs.unlinkSync(file.path);
  }
});
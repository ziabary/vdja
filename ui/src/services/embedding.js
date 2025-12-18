// embedding.js - مخصوص فارسی + aya
const EMBEDDING_URL = process.env.EMBEDDING_URL || "http://localhost:8001";

async function getEmbedding(text) {
  text = text.replace(/\n/g, " ").trim();
  if (!text) return null;

  try {
    const res = await fetch(`${EMBEDDING_URL}v1/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "multilingual-e5-large-instruct",
        input: text,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(
        `خطای embedding از vLLM (پورت 8001): ${res.status} → ${errorText}`
      );
      return null;
    }

    const data = await res.json();

    if (!data?.data?.[0]?.embedding || !Array.isArray(data.data[0].embedding)) {
      console.error(
        "ساختار نامعتبر embedding:",
        JSON.stringify(data).slice(0, 300)
      );
      return null;
    }

    return data.data[0].embedding;
  } catch (e) {
    console.error("خطا در embedding:", e.message);
    return null;
  }
}

async function chunkText(text, maxLength = 512) {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim());
  const chunks = [];
  let currentChunk = "";
  for (const sentence of sentences) {
    const potentialChunk = currentChunk
      ? currentChunk + ". " + sentence.trim()
      : sentence.trim();
    if (potentialChunk.length > maxLength && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence.trim();
    } else {
      currentChunk = potentialChunk;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks.filter((c) => c.length > 20);
}

module.exports = { getEmbedding, chunkText };

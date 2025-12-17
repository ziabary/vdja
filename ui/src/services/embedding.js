const { HfInference } = require('@huggingface/inference');
const hf = new HfInference(process.env.HF_TOKEN); // اختیاری، بدون توکن هم کار می‌کنه ولی کندتر

const MODEL = "BAAI/bge-m3";

async function getEmbedding(text) {
  text = text.replace(/\n/g, " ").trim();
  if (text.length === 0) return null;

  const result = await hf.featureExtraction({
    model: MODEL,
    inputs: text
  });

  return Array.from(result);
}

async function chunkText(text, maxLength = 500) {
  const words = text.split(/\s+/);
  const chunks = [];
  let current = [];

  for (const word of words) {
    if ((current.join(" ") + " " + word).length > maxLength) {
      chunks.push(current.join(" "));
      current = [word];
    } else {
      current.push(word);
    }
  }
  if (current.length) chunks.push(current.join(" "));
  return chunks;
}

module.exports = { getEmbedding, chunkText };
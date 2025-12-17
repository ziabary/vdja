const { QdrantClient } = require('@qdrant/js-client-rest');
const { v4: uuidv4 } = require('uuid');
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

const client = new QdrantClient({ url: QDRANT_URL });

async function initCollection() {
  const collectionName = "rag_collection";
  try {
    const collections = await client.getCollections();
    const exists = collections.collections.some(c => c.name === collectionName);

    if (exists) {
      console.log("Qdrant collection was initialized previously");
      return;
    }

    await client.createCollection(collectionName, {
      vectors: { size: 1024, distance: "Cosine" }
    });
    console.log("Qdrant collection built successfully");

  } catch (err) {
    if (err.status === 409 || err.message?.toLowerCase().includes("already exists") || err.message?.includes("Conflict")) {
      console.log("Qdrant collection was initialized previously");
    } else {
      console.error("خطا در راه‌اندازی Qdrant:", err.message || err);
    }
  }
}

async function upsertChunks(userKey, fileId, fileName, chunks) {
  const points = [];
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await getEmbedding(chunks[i]);  
    if (embedding) {
      points.push({
        id: uuidv4(),
        vector: embedding,
        payload: {
          user_key: userKey,
          file_id: fileId,
          file_name: fileName,
          chunk_index: i,
          text: chunks[i]
        }
      });
    }
  }
  await client.upsert('rag_collection', { points });
  return points.length;
}

async function searchChunks(userKey, queryEmbedding, limit = 8) {
  const results = await client.search('rag_collection', {
    vector: queryEmbedding,
    limit,
    filter: {
      must: [
        { key: 'user_key', match: { value: userKey } }
      ]
    }
  });
  return results.map(r => r.payload);
}

async function deleteByFileId(userKey, fileId) {
  const results = await client.scroll('rag_collection', {
    filter: {
      must: [
        { key: 'user_key', match: { value: userKey } },
        { key: 'file_id', match: { value: fileId } }
      ]
    },
    limit: 1000  
  });
  const pointIds = results.points.map(p => p.id);
  if (pointIds.length > 0) {
    await client.delete('rag_collection', { points: pointIds });
  }
  return pointIds.length;
}

async function deleteAllByUser(userKey) {
  const results = await client.scroll('rag_collection', {
    filter: { must: [{ key: 'user_key', match: { value: userKey } }] },
    limit: 10000  
  });
  const pointIds = results.points.map(p => p.id);
  if (pointIds.length > 0) {
    await client.delete('rag_collection', { points: pointIds });
  }
  return pointIds.length;
}

module.exports = {
  initCollection,
  upsertChunks,
  searchChunks,
  deleteByFileId,
  deleteAllByUser
};
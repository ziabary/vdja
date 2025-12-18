const { QdrantClient } = require("@qdrant/js-client-rest");
const { v4: uuidv4 } = require("uuid");
const { getEmbedding } = require("./embedding");

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const client = new QdrantClient({ url: QDRANT_URL });

async function initCollection() {
  const collectionName = "rag_collection";
  try {
    const collections = await client.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === collectionName
    );

    if (exists) {
      console.log("Qdrant collection was initialized previously");
      return;
    }

    await client.createCollection(collectionName, {
      vectors: { size: 1024, distance: "Cosine" },
    });
    console.log("Qdrant collection built successfully");
  } catch (err) {
    if (
      err.status === 409 ||
      err.message?.toLowerCase().includes("already exists") ||
      err.message?.includes("Conflict")
    ) {
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
    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      console.warn(`Embedding خالی برای چانک ${i} کاربر ${userKey} — رد شد`);
      continue;
    }
    points.push({
      id: uuidv4(),
      vector: embedding,
      payload: {
        user_key: userKey,
        file_id: fileId,
        file_name: fileName,
        chunk_index: i,
        text: chunks[i],
      },
    });

    if (points.length > 0) await client.upsert("rag_collection", { points });
  }
  return points.length;
}

async function searchChunks(userKey, queryEmbedding, limit = 8) {
  if (!userKey || !queryEmbedding || queryEmbedding.length === 0) {
    return [];
  }

  try {
    const results = await client.search("rag_collection", {
      vector: queryEmbedding,
      limit: limit,
      params: {
        hnsw_ef: 128,
        exact: false,
      },
      filter: {
        must: [
          {
            key: "user_key",
            match: {
              value: userKey,
            },
          },
        ],
      },
      with_payload: true,
      with_vector: false,
    });

    return results
      .filter((r) => r.payload && r.payload.user_key === userKey)
      .map((r) => r.payload);
  } catch (err) {
    console.error("خطا در جستجوی Qdrant:", err.message);
    if (err.status === 400) {
      console.error("احتمالاً فیلتر اشتباه است. از سینتکس جدید استفاده کنید.");
    }
    return [];
  }
}

async function deleteByFileId(userKey, fileId) {
  const results = await client.scroll("rag_collection", {
    filter: {
      must: [
        { key: "user_key", match: { value: userKey } },
        { key: "file_id", match: { value: fileId } },
      ],
    },
    limit: 1000,
  });
  const pointIds = results.points.map((p) => p.id);
  if (pointIds.length > 0) {
    await client.delete("rag_collection", { points: pointIds });
  }
  return pointIds.length;
}

async function deleteAllByUser(userKey) {
  let deletedCount = 0;
  let offset = null;
  const batchSize = 500; // Increased limit

  do {
    const scrollRes = await client.scroll("rag_collection", {
      limit: batchSize,      offset,
      with_payload: true,
      filter: {
        must: [
          {
            key: "user_key",
            match: { value: userKey },
          },
        ],
      },
    });

    const points = scrollRes.points || [];
    if (points.length === 0) break;

    const ids = points.map((p) => p.id);
    await client.delete("rag_collection", { points: ids });
    deletedCount += ids.length;
    offset = scrollRes.next_page_offset || null;
  } while (offset);

  return deletedCount;
}

module.exports = {
  initCollection,
  upsertChunks,
  searchChunks,
  deleteByFileId,
  deleteAllByUser,
};

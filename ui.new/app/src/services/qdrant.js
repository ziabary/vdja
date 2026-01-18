const { QdrantClient, FieldCondition,  Filter, Range } = require("@qdrant/js-client-rest");
const { v4: uuidv4 } = require("uuid");
const { getEmbedding } = require("./embedding");

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const client = new QdrantClient({ url: QDRANT_URL });
const COLLECTION_PREFIX = "ragdb_";
 
function collectionName(user_key) {return COLLECTION_PREFIX + user_key}
async function colExists(user_key) {return (await client.collectionExists(collectionName(user_key))).exists}

async function initCollection(user_key, high_demand = false) {
  if(await colExists(user_key)) 
    return

  try {
      await client.createCollection(collectionName(user_key), {
          vectors: { size: 1024, distance: "Cosine" },
          hnsw: { m: 24, ef_construction: 200},
          on_disk_payload: true,
      });
    console.log(`VectorDB collection for ${user_key} built successfully`);
  } catch (err) {
      console.error("Error initializing RAG-DB:", err.message || err);
  }
}

async function upsertChunks(user_key, fileId, fileName, chunks) {
  const points = [];
  for (let i = 0; i < chunks.length; i++) {
    let text = ""
    let time = undefined
    if(typeof chunks[i] === "string")
      text = chunks[i]
    else  {
      text = chunks[i].text
      time = chunks[i].time
    }

    const embedding = await getEmbedding(text);
    if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
      if(typeof embedding === "string") {
        console.error({embedding, text, l: text.length})
        continue
      } else {
        console.warn(`Empty embedding for chunk ${i} of user ${user_key} — discarded`);
        continue;
      }
    }

    points.push({
      id: uuidv4(),
      vector: embedding,
      payload: {
        user_key: user_key,
        file_id: fileId,
        file_name: fileName,
        chunk_time: time, 
        chunk_index: i,
        text
      },
    });

    if (points.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);
        try {
          await client.upsert(collectionName(user_key), { points: batch });
        } catch (error) {
          console.error("Upsert failed:", error);
          throw error
        }
      }
    }
  }
  return points.length;
}

async function searchChunks(user_key, embedded_query, limit = 8, mustBeNew = false) {
  if (!user_key || !embedded_query || embedded_query.length === 0 || !await colExists(user_key)) 
    return []

  let filter = undefined
  if(mustBeNew) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoTimestamp = Math.floor(sevenDaysAgo.getTime() / 1000);
    filter = {
        must: [{
            key: "chunk_time",
            range: {
              gt: sevenDaysAgoTimestamp, // "gt" means "greater than"
            },
        }
      ]
    }
  }

  try {
    //@TODO maybe replaced with recommend to positive/negative matching. 
    const results = await client.search(collectionName(user_key), {
      vector: embedded_query,
      limit: limit,
      filter,
      params: {hnsw_ef: 512, exact: false},
      sort: [{ key: "chunk_time", order: "desc" }],
      with_payload: true,
      with_vector: false,
    });


    let filteredChunks =  results
      .filter((r) => r.payload && r.payload.user_key === user_key && r.score > 0.8)
      

    if(process.env.DEBUG_MODE) 
      console.log({
        chunks: filteredChunks.map(r=>({file:r.payload.file_name, chunk_time: r.payload.chunk_time, score: r.score, p: r.payload.text})), 
        filtered: results.length- filteredChunks.length,
        user_key
      })

    

    /*
    const resultsByFile = {};
    for (const result of results) {
      const fileId = result.payload.file_id;
      if (!resultsByFile[fileId]) resultsByFile[fileId] = [];
      resultsByFile[fileId].push(result);
    }
    // Select top 1 result per file
    const finalResults = Object.values(resultsByFile).map(fileResults => 
      fileResults.sort((a, b) => b.score - a.score)[0]
    );
    */

    return filteredChunks.map((r) => r.payload);
  } catch (err) {
    if (err.status === 400) {
      console.error("Maybe the filter is buggy. New syntax needed");
      console.error(err)
    } else 
      console.error("Error searching VectorDB:", err.message);
    return [];
  }
}

async function deleteByFileId(user_key, fileId) {
  if (!await colExists(user_key))
    throw Error("there is no vector collection for: " + user_key)

  let offset = null;
  let removed = 0
  do {
    const { points, next_page_offset } = await client.scroll(collectionName(user_key), {
        limit: 1000, 
        offset: offset,
        with_vector: false,
        with_payload: false,
        filter: {must: [{ key: "file_id", match: { value: fileId } }]},
    });
    const pointIds = points.map((p) => p.id);
    if (pointIds.length > 0) 
      await client.delete(collectionName(user_key), { points: pointIds });
    removed += pointIds.length
    offset = next_page_offset
  } while (offset);
  
  return removed;
}

async function deleteAllByUser(user_key) {
  if (!await colExists(user_key))
    throw Error("There is no vector collection for: " + user_key)
  return await client.deleteCollection(collectionName(user_key))
}

module.exports = {
  initCollection,
  upsertChunks,
  searchChunks,
  deleteByFileId,
  deleteAllByUser
};

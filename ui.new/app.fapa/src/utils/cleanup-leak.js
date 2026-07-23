require("dotenv").config();
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:8002";

const { QdrantClient } = require('@qdrant/js-client-rest');
const client = new QdrantClient({ url: QDRANT_URL });

async function cleanLeakedPoints() {
  console.log("در حال پاکسازی پوینت‌های بدون user_key ...");

  let offset = null;
  let deletedCount = 0;

  do {
    const response = await client.scroll('rag_collection', {
      limit: 500,
      with_payload: true,
      filter: {
        must_not: [
          { key: "user_key", match: { exists: true } }  
        ]
      },
      offset
    });

    const badPoints = response.points.filter(point => 
      !point.payload || 
      !point.payload.user_key || 
      point.payload.user_key === "" ||
      point.payload.user_key === null
    );

    if (badPoints.length > 0) {
      const idsToDelete = badPoints.map(p => p.id);
      await client.delete('rag_collection', { points: idsToDelete });
      deletedCount += idsToDelete.length;
      console.log(`حذف شد: ${idsToDelete.length} پوینت آلوده`);
    }

    offset = response.next_page_offset || null;

  } while (offset);

  console.log(`پاکسازی کامل شد! مجموعاً ${deletedCount} پوینت آلوده حذف شد.`);
}

cleanLeakedPoints().catch(err => {
  console.error("خطا در پاکسازی:", err.message);
  if (err.data) console.error(err.data);
});
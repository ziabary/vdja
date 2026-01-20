require("dotenv").config();
const { QdrantClient } = require("@qdrant/js-client-rest");
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const OLD_COLLECTION_NAME = "rag_collection";
const client = new QdrantClient({ url: QDRANT_URL });

// Retrieve all points from the source collection
const allPoints = [];
let offset = null;

async function migrate() {
    const oldCollection = await client.getCollection(OLD_COLLECTION_NAME);
    console.log({oldCollection})
    do {
        const { points, next_page_offset } = await client.scroll(OLD_COLLECTION_NAME, {
            limit: 10000,  // Adjust based on your data size
            offset: offset,
            with_vector: true,
            with_payload: true
        });
        console.log({l:points.length, next_page_offset})
        // console.log(points)
        // return
        allPoints.push(...points);
        offset = next_page_offset;
    } while (offset);

    // Group points by userToken
    const userTokenToPoints = {};
    for (const point of allPoints) {
        const userToken = point.payload.userToken;
        if (!userTokenToPoints[userToken]) 
            userTokenToPoints[userToken] = [];
        userTokenToPoints[userToken].push(point);
    }

    console.log(`found ${Object.keys(userTokenToPoints).length}`)

    // Create new collections for each userToken
    for (const [userToken, points] of Object.entries(userTokenToPoints)) {
        const newCollectionName = `ragdb_${userToken}`;
        try {
            console.log(`creating collection: ${newCollectionName} with ${points.length} points`)
            await client.createCollection(newCollectionName, {
                vectors: oldCollection.config.params.vectors,
                hnsw: { m: 24, ef_construction: 200},
                on_disk_payload: true,
            });
        } catch (e) {
            // Skip if the collection already exists
            if (e.message === "Conflict")
                console.log(`Collection ${newCollectionName} already exists. Skipping.`);
            else throw e;
        }
    }

    console.log({countCollections:(await client.getCollections()).length})


    // Migrate points to the new collections
    for (const [userToken, points] of Object.entries(userTokenToPoints)) {
        const newCollectionName = `ragdb_${userToken}`;
        const batch = points.map(point => ({
            id: point.id,
            vector: point.vector,
            payload: point.payload,  // Includes userToken, file_id, etc.
        }));

        console.log(`inserting ${batch.length} points for ${newCollectionName}`)

        // Upsert in batches to avoid size limits
        for (let i = 0; i < batch.length; i += 100) {
            const batchChunk = batch.slice(i, i + 100);
            try {
                await client.upsert(newCollectionName, { points: batchChunk });
            } catch (e) {
                console.error(`Error upserting to ${newCollectionName}:`, e);
            }
        }
    }    
    console.log("Migration finished")
}

migrate()


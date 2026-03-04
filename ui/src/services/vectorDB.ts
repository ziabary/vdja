
import { QdrantClient } from "@qdrant/js-client-rest";
import type { Schemas } from "@qdrant/js-client-rest";
import { randomUUID } from "crypto";
import { getEmbedding } from "./embedService";
import logger from "../utils/logger";
import configManager from "../utils/configManager";
import type { IntfChunkPayload } from "../interfaces/llm";
import type { IntfExHttp } from "../interfaces/exHttp";
import type { IntfChunk } from "../interfaces/file";


type FieldCondition = Schemas["FieldCondition"];
type Filter = Schemas["Filter"];
type Range = Schemas["Range"];
type QRecord = Schemas["Record"]

interface QdrantSearchPoint {
  id: string | number;
  score: number;
  payload?: Record<string, unknown> | null;
  vector?: Record<string, number[]> | null;
  // add other fields if you use them (shard_key, etc.)
}

export function trimToTokenLimit(
  text: string,
  maxTokens: number,
  countTokensFn: (text: string) => number
): string {
  if (countTokensFn(text) <= maxTokens) return text;

  // Simple character-based trim heuristic
  // 1 token ≈ 3 characters
  const approxCharLimit = maxTokens * 3;

  let trimmed = text.slice(0, approxCharLimit);

  // Optional: trim to last sentence boundary
  const lastSentenceIdx = Math.max(
    trimmed.lastIndexOf("."),
    trimmed.lastIndexOf("؟"),
    trimmed.lastIndexOf("?"),
    trimmed.lastIndexOf("\n"),
    trimmed.lastIndexOf(";"),
    trimmed.lastIndexOf("؛"),
  );
  if (lastSentenceIdx > 0) trimmed = trimmed.slice(0, lastSentenceIdx + 1);

  return trimmed;
}

export function approximateTokenCount(text: string) {
  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const est = Math.ceil(
    (charCount / 3) +
    (wordCount * 0.5)
  );

  return est + 4;
}

export default function vectorDB() {
  const url = configManager.active().RAGDB.url
  let VDBClient = new QdrantClient({ url });


  async function colExists(collectionKey: string) {
    return (await VDBClient.collectionExists(collectionKey)).exists
  }

  async function initCollection(collectionKey: string, highDemand = false) {
    if (await colExists(collectionKey))
      return

    try {
      await VDBClient.createCollection(collectionKey, {
        vectors: { size: 1024, distance: "Cosine" },
        hnsw_config: {
          m: highDemand ? 64 : 24,
          ef_construct: highDemand ? 512 : 200,
        },
        on_disk_payload: true,
      });
      logger.info(`VectorDB collection for ${collectionKey} built successfully`);
    } catch (ex: unknown) {
      logger.error("Error initializing RAG-DB:", (ex as Error).message || ex);
    }
  }


  async function addFileText(
    collectionKey: string,
    fileKey: string,
    fileName: string,
    chunks: IntfChunk | IntfChunk[],
  ): Promise<number> {
    const points: {
      id: string;
      vector: number[];
      payload: IntfChunkPayload
    }[] = [];

    await initCollection(collectionKey)

    const activeChunks = Array.isArray(chunks) ? chunks : [chunks]

    for (let i = 0; i < activeChunks.length; i++) {
      const chunk = activeChunks[i]!
      let chunkText = chunk.text
      if (!chunkText) continue

      const payload: IntfChunkPayload = {
        text: chunk.text!,
        chunk_index: i,
        chunk_time: chunk.meta?.time,
        col_Key: collectionKey,
        file_id: fileKey,
        file_name: fileName,
      }

      console.log({ approx: approximateTokenCount(chunkText), max: configManager.active().embedding.maxTokens })

      if (approximateTokenCount(chunkText) > configManager.active().embedding.maxTokens)
        chunkText = trimToTokenLimit(chunkText, configManager.active().embedding.maxTokens, approximateTokenCount);

      console.log({ afterTrim: 1, approx: approximateTokenCount(chunkText), max: configManager.active().embedding.maxTokens })

      const embedding = await getEmbedding(chunkText);
      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
        if (typeof embedding === "string") {
          logger.error({ embedding, text: chunkText, l: chunkText.length });
          continue;
        } else {
          logger.warn(`Empty embedding for chunk ${i} of user ${collectionKey} — discarded`);
          continue;
        }
      }

      points.push({
        id: randomUUID(),
        vector: embedding,
        payload
      });
    }

    // Upsert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      try {
        await VDBClient.upsert(collectionKey, { points: batch });
      } catch (ex) {
        logger.error({ Upsert_failed: ex });
        throw new Error("upsert failed");
      }
    }

    return points.length;
  }

  function weightedSort(data: QdrantSearchPoint[], scoreWeight = 0.6, timeWeight = 0.4) {
    const now = Date.now() / 1000;
    const maxChunkTime = Math.max(...data.map(i => (i.payload?.chunk_time ?? 0) as number));
    const maxTime = now - 0;
  
    return data.sort((a, b) => {
      const aTime = (a.payload?.chunk_time ?? 0) as number;
      const bTime = (b.payload?.chunk_time ?? 0) as number;
      const aScore = a.score || 0;
      const bScore = b.score || 0;
  
      const aTimeScore = (now - aTime) / maxTime;
      const bTimeScore = (now - bTime) / maxTime;
  
      const aCombined = (aScore * scoreWeight) + (aTimeScore * timeWeight);
      const bCombined = (bScore * scoreWeight) + (bTimeScore * timeWeight);
  
      return bCombined - aCombined;
    });
  }

  async function findChunks(
    collectionKey: string,
    embeddedQuery: number[] | Float32Array,
    fileIds: string[] | undefined = undefined,
    limit: number = 8,
    newerThanDays: number | undefined = undefined
  ): Promise<IntfChunkPayload[]> {
    // Early return if invalid
    if (!collectionKey
      || !embeddedQuery
      || embeddedQuery.length === 0
      || !(await colExists(collectionKey))
    )
      return [];

    const mustConditions: FieldCondition[] = [];
    if (fileIds && fileIds.length > 0) {
      //@TODO this need dual collection approach as post-filter is not good
      mustConditions.push({
        key: "file_id",
        match: { any: fileIds },
      });
    }
    if (newerThanDays) {
      const daysAgo = Math.floor(new Date().getTime() / 1000) - newerThanDays * 24 * 60 * 60;
      mustConditions.push({
        key: "chunk_time",
        range: { gt: daysAgo } as Range,
      });
    }

    const filter: Filter | undefined = mustConditions.length > 0 ? { must: mustConditions } : undefined;
    const isNews = collectionKey === configManager.active().specialCollections.news

    try {
      const queryBody = {
        query: Array.from(embeddedQuery),
        filter,
        limit: isNews ? 100 : limit * 2,
        order_by: {
          key: "chunk_time",
          direction: "desc"   // newest first
        },
        with_payload: true,
        with_vectors: false,
        // optional: score_threshold: 0.8,
      };
      const response = await fetch(
        `${configManager.active().RAGDB.url}/collections/${collectionKey}/points/query`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(queryBody),
        }
      );

      if (!response.ok) {
        throw new Error(`Query failed: ${response.statusText}`);
      }

      const { result } = await response.json();
      const points = result.points ?? [];

      const filteredChunks = 
        weightedSort(points.filter((r: QdrantSearchPoint) => r.payload?.col_Key === collectionKey && r.score > 0.8))
        .slice(0, limit)
        
      if (configManager.active().log.isDebugging) {
        logger.deepDebug({
          chunks: filteredChunks.map((r: QdrantSearchPoint) => ({
            file: r.payload?.file_name,
            chunk_time: r.payload?.chunk_time,
            score: r.score,
            p: r.payload?.text,
          })),
          filtered: points.length - filteredChunks.length,
          collectionKey,
        });
      }

      return filteredChunks.map((r: QdrantSearchPoint) => r.payload as IntfChunkPayload);
    } catch (ex: unknown) {
      if ((ex as IntfExHttp).status === 400) {
        logger.error("Maybe the filter is buggy. New syntax needed");
        logger.error({ ex });
      } else
        logger.error("Error searching VectorDB:", (ex as Error)?.message || ex);

      return [];
    }
  }

  async function deleteFileChunks(
    collectionKey: string,
    fileId: string
  ): Promise<number> {
    if (!(await colExists(collectionKey)))
      throw new Error(`There is no vector collection for: ${collectionKey}`);

    let offset: string | null = null;
    let removed = 0;

    do {
      const { points, next_page_offset } = await VDBClient.scroll(collectionKey, {
        limit: 1000,
        offset,
        with_vector: false,
        with_payload: false,
        filter: {
          must: [
            {
              key: "file_id",
              match: { value: fileId },
            } as FieldCondition,
          ],
        } as Filter,
      });

      const pointIds: string[] = points.map((p: QRecord) => p.id + "");

      if (pointIds.length > 0) {
        await VDBClient.delete(collectionKey, { points: pointIds });
      }

      removed += pointIds.length;
      offset = next_page_offset != null ? String(next_page_offset) : null;
    } while (offset);

    return removed;
  }

  async function getRandomChunks(
    collectionKey: string,
    fileId: string,
    maxCount: number
  ): Promise<string[]> {
    const chunks: string[] = [];

    let offset: string | null = null;

    do {
      const { points, next_page_offset } = await VDBClient.scroll(collectionKey, {
        limit: 1000, // scroll in batches
        offset,
        with_vector: false,
        with_payload: true, // we need text from payload
        filter: {
          must: [
            {
              key: "file_id",
              match: { value: fileId },
            } as FieldCondition,
          ],
        } as Filter,
      });

      // Extract text from payloads
      points.forEach((p: QRecord) => {
        if (p.payload?.text) chunks.push(p.payload.text + "");
      });

      offset = next_page_offset != null ? String(next_page_offset) : null;
    } while (offset);

    // Shuffle chunks randomly
    for (let i = chunks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const chunkI = chunks[i];
      const chunkJ = chunks[j];

      if (chunkI === undefined || chunkJ === undefined) {
        continue; // or throw an error, or handle it
      }

      [chunks[i], chunks[j]] = [chunkJ, chunkI];
    }

    // Return up to maxCount chunks
    return chunks.slice(0, maxCount);
  }

  return {
    getRandomChunks,
    deleteFileChunks,
    findChunks,
    addFileText,
    initCollection
  }
}
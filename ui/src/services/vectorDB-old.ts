
import { QdrantClient } from "@qdrant/js-client-rest";
import type { Schemas } from "@qdrant/js-client-rest";
import { createHash } from "crypto";
import { getEmbedding } from "./embedService";
import logger from "../utils/logger";
import configManager from "../utils/configManager";
import type { IntfChunkPayload } from "../interfaces/llm";
import type { IntfExHttp } from "../interfaces/exHttp";
import type { IntfChunk } from "../interfaces/file";
import {
  resolveStructuredVersions,
  STRUCTURED_RAG_FORMAT,
  type StructuredChunkPayload,
  type StructuredRagQuery,
} from "./structuredRag";
const RAG_CRAWLED_RSS_NEWS = "RAG_CRAWLED_RSS_NEWS";


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

export interface FindChunksOptions {
  queryText?: string;
  structured?: StructuredRagQuery;
}

type StructuredChunkMeta = NonNullable<IntfChunk["meta"]> & {
  structuredRag?: boolean;
  recordId?: string;
  ragMetadata?: Record<string, unknown>;
};

function stablePointId(seed: string): string {
  const digest = createHash("sha256").update(seed).digest("hex").split("");
  digest[12] = "5";
  digest[16] = ((parseInt(digest[16] || "0", 16) & 0x3) | 0x8).toString(16);
  const hex = digest.join("").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function pointPayloadKey(payload: StructuredChunkPayload): string {
  if (payload.rag_record_id)
    return `record:${payload.file_id}:${payload.rag_record_id}`;
  return `chunk:${payload.file_id}:${payload.chunk_index}:${payload.text}`;
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
  const structuredIndexesReady = new Set<string>();

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


  async function ensureStructuredPayloadIndexes(collectionKey: string) {
    if (structuredIndexesReady.has(collectionKey)) return;

    const indexes: Array<{ field_name: string; field_schema: "keyword" | "integer" | "bool" }> = [
      { field_name: "rag_format", field_schema: "keyword" },
      { field_name: "rag_identity_key", field_schema: "keyword" },
      { field_name: "rag_temporal_key", field_schema: "integer" },
      { field_name: "rag_is_latest", field_schema: "bool" },
      { field_name: "rag_meta.irc", field_schema: "keyword" },
      { field_name: "rag_meta.organization_code", field_schema: "keyword" },
      { field_name: "rag_meta.equipment_index", field_schema: "keyword" },
      { field_name: "rag_meta.service_national_id", field_schema: "keyword" },
      { field_name: "rag_meta.global_service_ids", field_schema: "keyword" },
    ];

    for (const index of indexes) {
      try {
        const response = await fetch(
          `${configManager.active().RAGDB.url}/collections/${collectionKey}/index`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(index),
          },
        );
        if (!response.ok && response.status !== 409)
          logger.warn(`Unable to create payload index ${index.field_name}: ${response.status}`);
      } catch (ex) {
        // Indexes improve speed but are not required for correctness.
        logger.warn({ structuredPayloadIndex: index.field_name, error: (ex as Error).message });
      }
    }

    structuredIndexesReady.add(collectionKey);
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

    const activeChunks = Array.isArray(chunks) ? chunks : [chunks];
    if (activeChunks.some(chunk => (chunk.meta as StructuredChunkMeta | undefined)?.structuredRag))
      await ensureStructuredPayloadIndexes(collectionKey);

    for (let i = 0; i < activeChunks.length; i++) {
      const chunk = activeChunks[i]!;
      const meta = (chunk.meta || {}) as StructuredChunkMeta;
      const title = meta.title;
      const recordId = meta.recordId;
      const ragMetadata = meta.ragMetadata || {};
      let chunkText = [title, chunk.text].filter(Boolean).join("\n");
      if (!chunk.text) continue;

      const payload = {
        text: chunk.text,
        chunk_index: i,
        chunk_time: meta.time,
        title,
        file_id: fileKey,
        file_name: fileName,
        entities: [],
        ...(meta.structuredRag ? {
          rag_format: STRUCTURED_RAG_FORMAT,
          rag_record_id: recordId,
          rag_meta: ragMetadata,
          rag_temporal_key: typeof ragMetadata.temporal_key === "number"
            ? ragMetadata.temporal_key
            : undefined,
          rag_identity_key: typeof ragMetadata.identity_key === "string"
            ? ragMetadata.identity_key
            : undefined,
          rag_is_latest: typeof ragMetadata.is_latest_in_corpus === "boolean"
            ? ragMetadata.is_latest_in_corpus
            : undefined,
        } : {}),
      } as IntfChunkPayload & StructuredChunkPayload;

      if (approximateTokenCount(chunkText) > configManager.active().embedding.maxTokens)
        chunkText = trimToTokenLimit(chunkText, configManager.active().embedding.maxTokens, approximateTokenCount);

      const embedding = await getEmbedding(chunkText, "document");
      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
        logger.warn(`Empty embedding for chunk ${i} of user ${collectionKey} — discarded`);
        continue;
      }

      const pointSeed = recordId
        ? `${fileKey}\0record\0${recordId}`
        : `${fileKey}\0chunk\0${meta.page || ""}\0${meta.section || ""}\0${chunk.text}`;


      points.push({
        id: stablePointId(pointSeed),
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

  function weightedSort(
    data: QdrantSearchPoint[],
    scoreWeight = 1,
    timeWeight = 0,
    titleWeight = 0,
    lengthWeight = 0
  ) {
    const validTimes = data
      .map(item => Number(item.payload?.chunk_time || 0))
      .filter(time => Number.isFinite(time) && time > 0);
    const minTime = validTimes.length ? Math.min(...validTimes) : 0;
    const maxTime = validTimes.length ? Math.max(...validTimes) : 0;
    const maxChunkLength = Math.max(...data.map(i => (i.payload?.text as string)?.length ?? 0), 1);

    const timeScore = (value: unknown) => {
      const time = Number(value || 0);
      if (!timeWeight || !Number.isFinite(time) || time <= 0) return 0;
      if (maxTime === minTime) return 1;
      return (time - minTime) / (maxTime - minTime);
    };
 
    return data.sort((a, b) => {
      const score = (item: QdrantSearchPoint) => {
        const text = (item.payload?.text as string) || "";
        const title = (item.payload?.title as string) || "";
        return (
          ((item.score || 0) * scoreWeight)
          + (timeScore(item.payload?.chunk_time) * timeWeight)
          + ((title || text.startsWith("#") ? 1 : 0) * titleWeight)
          + ((text.length / maxChunkLength) * lengthWeight)
        );
      };

      return score(b) - score(a);
    });
  }

  async function findChunks(
    collectionKey: string,
    embeddedQuery: number[] | Float32Array,
    fileIds: string[] | undefined = undefined,
    limit: number = 8,
    newerThanDays: number | undefined = undefined,
    minSimilarity: number = 0.8,
    options: FindChunksOptions = {},
  ): Promise<IntfChunkPayload[]> {
    // Early return if invalid

    if (!collectionKey
      || !embeddedQuery
      || embeddedQuery.length === 0
      || !(await colExists(collectionKey))
    ) return [];

    const baseMust: FieldCondition[] = [];
    if (fileIds && fileIds.length > 0) {
      baseMust.push({
        key: "file_id",
        match: { any: fileIds },
      });
    }
    if (newerThanDays) {
      const daysAgo = Math.floor(Date.now() / 1000) - newerThanDays * 24 * 60 * 60;
      baseMust.push({
        key: "chunk_time",
        range: { gt: daysAgo } as Range,
      });
    }

    const makeFilter = (conditions: FieldCondition[]): Filter | undefined =>
      conditions.length ? { must: conditions } : undefined;

    const queryPoints = async (
      filter: Filter | undefined,
      candidateLimit: number,
    ): Promise<QdrantSearchPoint[]> => {
      const response = await fetch(
        `${configManager.active().RAGDB.url}/collections/${collectionKey}/points/query`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: Array.from(embeddedQuery),
            filter,
            limit: candidateLimit,
            with_payload: true,
            with_vectors: false,
          }),
        },
      );

      if (!response.ok)
        throw new Error(`Query failed: ${response.status} ${await response.text()}`);

      const { result } = await response.json();
      return result?.points ?? [];
    };
    const isNews = collectionKey === RAG_CRAWLED_RSS_NEWS;

    try {
      const basePoints = await queryPoints(
        makeFilter(baseMust),
        isNews ? 100 : Math.max(limit * 4, 32),
      );

      const merged = new Map<string, QdrantSearchPoint>();
      const exactStructuredIds = new Set<string>();
      for (const point of basePoints) merged.set(String(point.id), point);

      if (options.structured) {
        const structuredMust: FieldCondition[] = [
          ...baseMust,
          { key: "rag_format", match: { value: STRUCTURED_RAG_FORMAT } },
        ];

        for (const [key, value] of Object.entries(options.structured.exactMetadata)) {
          structuredMust.push({
            key: `rag_meta.${key}`,
            match: { value },
          });
        }

        if (options.structured.requestedTemporalKey !== undefined) {
          structuredMust.push({
            key: "rag_temporal_key",
            range: { lte: options.structured.requestedTemporalKey } as Range,
          });
        } else if (options.structured.preferLatest) {
          structuredMust.push({
            key: "rag_is_latest",
            match: { value: true },
          });
        }

        const structuredPoints = await queryPoints(
          makeFilter(structuredMust),
          Math.max(limit * 6, 48),
        );
        const hasExactMetadata = Object.keys(options.structured.exactMetadata).length > 0;
        for (const point of structuredPoints) {
          const id = String(point.id);
          if (hasExactMetadata) exactStructuredIds.add(id);
          const old = merged.get(id);
          if (!old || point.score > old.score) merged.set(id, point);
        }
      }

      let candidates = [...merged.values()]
        .filter(point => point.score >= minSimilarity || exactStructuredIds.has(String(point.id)));

      if (options.structured) {
        const payloads = candidates.map(point => ({
          ...(point.payload as StructuredChunkPayload),
          _score: point.score,
        }));
        const selectedPayloads = resolveStructuredVersions(payloads, options.structured);
        const selectedKeys = new Set(selectedPayloads.map(pointPayloadKey));
        candidates = candidates.filter(point =>
          selectedKeys.has(pointPayloadKey({
            ...(point.payload as StructuredChunkPayload),
            _score: point.score,
          })),
        );
      }

      const filteredChunks = weightedSort(
        candidates,
        isNews ? 0.65 : 1,
        isNews ? 0.35 : 0,
      ).sort((a, b) =>
        Number(exactStructuredIds.has(String(b.id)))
        - Number(exactStructuredIds.has(String(a.id))),
      ).slice(0, limit);

      if (configManager.active().log.isDebugging) {
        logger.deepDebug({
          collectionKey,
          queryText: options.queryText,
          filtered: merged.size - filteredChunks.length,
          chunks: filteredChunks.map(point => ({
            file: point.payload?.file_name,
            chunk_time: point.payload?.chunk_time,
            title: point.payload?.title,
            score: point.score,
            rag_record_id: point.payload?.rag_record_id,
            p: point.payload?.text,        
          })),
        });
      }

      return filteredChunks.map(point => ({
        ...(point.payload as IntfChunkPayload),
        _score: point.score,
      }));
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

      if(configManager.active().log.isDebugging)
        logger.deepDebug({removing: {collectionKey, fileId, len: pointIds.length, next_page_offset}})

      if (pointIds.length > 0) 
        await VDBClient.delete(collectionKey, { points: pointIds });
      

      removed += pointIds.length;
      offset = next_page_offset != null ? String(next_page_offset) : null;
    } while (offset);

    return removed;
  }

  async function getRandomChunks(
    collectionKey: string,
    fileId: string | null,
    maxCount: number
  ): Promise<string[]> {
    const chunks: string[] = [];

    let offset: string | null = null;

    const filter: Filter = fileId ? {
      must: [
        {
          key: "file_id",
          match: { value: fileId },
        } as FieldCondition,
      ],
    } : {}

    do {
      const { points, next_page_offset } = await VDBClient.scroll(collectionKey, {
        limit: 1000, // scroll in batches
        offset,
        with_vector: false,
        with_payload: true, // we need text from payload
        filter,
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
import configManager from "../utils/configManager";
import logger from "../utils/logger";


interface EmbeddingResponse {
  data: {
    embedding: number[];
  }[];
}

export type EmbeddingPurpose = "document" | "query";

const DEFAULT_E5_QUERY_INSTRUCTION =
  "Given a Persian user question, retrieve the passages or structured records that directly answer it. Preserve exact names, identifiers, dates, amounts, percentages, and other factual constraints.";

function prepareEmbeddingInput(
  text: string,
  purpose: EmbeddingPurpose,
  model: string,
): string {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  if (!normalized) return "";

  // multilingual-e5-large-instruct requires an instruction on queries only.
  // Other embedding models keep the old input format.
  const modelName = model.toLowerCase();
  if (
    purpose === "query"
    && modelName.includes("e5")
    && modelName.includes("instruct")
  ) {
    return `Instruct: ${DEFAULT_E5_QUERY_INSTRUCTION}\nQuery: ${normalized}`;
  }

  return normalized.replace(/\n+/g, " ");
}

export async function getEmbedding(
  text: string,
  purpose: EmbeddingPurpose = "document",
): Promise<number[] | null> {
  const embeddingConfig = configManager.active().embedding;
  const model = embeddingConfig.server.model;
  if (!model) {
    logger.error("Embedding model is not configured");
    return null;
  }

  // Some OpenAI-compatible servers expose a short alias as `model` while the
  // actual model family is only visible in modelPath. Use both for safe
  // backward-compatible E5-instruct auto-detection.
  const modelIdentity = `${model} ${embeddingConfig.modelPath || ""}`;
  const input = prepareEmbeddingInput(text, purpose, modelIdentity);
  if (!input) return null;

  try {
    const res = await fetch(
      `${configManager.active().embedding.server.url}/v1/embeddings`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          input,
        }),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      logger.error(`Error embedding: ${res.status} → ${errorText}`);
      try {
        const errJson = JSON.parse(errorText);
        logger.error(errJson.error?.message ?? errorText);
        return null;
      } catch {
        return null;
      }
    }

    const data: EmbeddingResponse = await res.json();

    if (!data?.data?.[0]?.embedding || !Array.isArray(data.data[0].embedding)) {
      logger.error(
        "Invalid embedding structure:",
        JSON.stringify(data).slice(0, 300)
      );
      return null;
    }

    return data.data[0].embedding;
  } catch (e: unknown) {
    logger.error("Error in embedding:", e);
    return null;
  }
}

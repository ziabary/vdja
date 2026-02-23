import configManager from "../utils/configManager";
import logger from "../utils/logger";


interface EmbeddingResponse {
  data: {
    embedding: number[];
  }[];
}

export async function getEmbedding(text: string): Promise<number[] | null> {
  //console.log({text})
  text = text.replace(/\n/g, " ").trim();
  if (!text) return null;

  try {
    const res = await fetch(
      `${configManager.active().embedding.server.url}/v1/embeddings`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: configManager.active().embedding.server.model,
          input: text,
        }),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      logger.error(`Error embedding: ${res.status} → ${errorText}`);
      try {
        const errJson = JSON.parse(errorText);
        return errJson.error?.message ?? null;
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

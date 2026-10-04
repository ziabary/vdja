import configManager from '../utils/configManager';
import { getEmbedding } from './embedService';

/** Retrieve documents, keeping two passages per file instead of a flat chunk limit. */
export async function retrieveSecretariatFiles(query: string, threshold: number, filter?: Record<string, unknown>) {
  const vector = await getEmbedding(query, 'query');
  if (!vector) throw new Error('Secretariat embedding unavailable');
  const response = await fetch(`${configManager.active().RAGDB.url}/collections/SECRETARIAT_LETTERS/points/query/groups`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000),
    body: JSON.stringify({ query: vector, group_by: 'file_id', group_size: 2, limit: 80,
      score_threshold: threshold, with_payload: true, with_vector: false, filter }),
  });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`Secretariat grouped search failed: ${response.status}`);
  const data = await response.json();
  return (data.result?.groups || []).map((group: any) => ({
    file_id: String(group.id), semanticScore: Number(group.hits[0].score),
    text: String(group.hits[0].payload?.text || ''),
  })) as Array<{ file_id: string; semanticScore: number; text: string }>;
}

/** RRF uses positions only; cosine values never compete with lexical weights. */
export function fuseSecretariatRankings(lexical: Array<Record<string, any>>, semantic: Array<Record<string, any>>) {
  const fused = new Map<string, Record<string, any>>();
  for (const [kind, ranking] of [['text', lexical], ['semantic', semantic]] as const) {
    ranking.forEach((item, index) => {
      const previous = fused.get(item.ltrKey);
      fused.set(item.ltrKey, { ...previous, ...item,
        rankScore: (previous?.rankScore || 0) + 1 / (60 + index + 1),
        matchType: previous ? 'hybrid' : kind,
      });
    });
  }
  return [...fused.values()].sort((a, b) => b.rankScore - a.rankScore || a.ltrKey.localeCompare(b.ltrKey));
}

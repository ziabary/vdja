/** Add spacing-independent search payloads without changing stored texts or embeddings. */
import configManager from '../src/utils/configManager';
import { compactSearchText } from '../src/utils/persianSearch';

configManager.init('.config.json');
const collection = `${configManager.active().RAGDB.url}/collections/SECRETARIAT_LETTERS`;

async function main() {
  let offset: unknown;
  let updated = 0;
  let examined = 0;
  do {
    const response = await fetch(`${collection}/points/scroll`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ limit: 100, offset, with_payload: true, with_vector: false }),
    });
    if (response.status === 404) { console.log('Secretariat collection does not exist yet.'); return; }
    if (!response.ok) throw new Error(`Qdrant scroll failed: ${response.status}`);
    const data = await response.json();
    for (const point of data.result?.points || []) {
      examined++;
      const compact = compactSearchText(point.payload?.text);
      if (point.payload?.secretariat_search_compact === compact) continue;
      const update = await fetch(`${collection}/points/payload?wait=true`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ points: [point.id], payload: { secretariat_search_compact: compact } }),
      });
      if (!update.ok) throw new Error(`Qdrant payload update failed: ${update.status}`);
      updated++;
    }
    offset = data.result?.next_page_offset;
  } while (offset != null);
  console.log(`Secretariat search payloads: ${updated} updated, ${examined} examined.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });

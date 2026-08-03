/**
 * Compatibility facade.
 *
 * The production implementation historically lives in vectorDB-old.ts.
 * Keep both import paths working while there is still code importing either
 * ./vectorDB or ./vectorDB-old. Once all call sites are migrated, the file can
 * be renamed without changing its public API.
 */
export {
  approximateTokenCount,
  trimToTokenLimit,
  type FindChunksOptions,
} from "./vectorDB-old";
export { default } from "./vectorDB-old";
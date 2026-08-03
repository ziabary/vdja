import type { IntfChunkPayload } from "../interfaces/llm";

export const STRUCTURED_RAG_FORMAT = "structured-rag-v1";

export interface StructuredRagManifest {
    type: "rag_manifest";
    format: typeof STRUCTURED_RAG_FORMAT;
    version: 1;
    description?: string;
}

export interface StructuredRagRecord {
    id: string;
    title?: string;
    text: string;
    metadata?: Record<string, unknown>;
}

export interface StructuredRagQuery {
    requestedTemporalKey?: number;
    requestedYear?: number;
    preferLatest: boolean;
    exactMetadata: Record<string, string | number | boolean>;
}

export type StructuredChunkPayload = IntfChunkPayload & {
    _score?: number;
    rag_format?: typeof STRUCTURED_RAG_FORMAT;
    rag_record_id?: string;
    rag_meta?: Record<string, unknown>;
    rag_temporal_key?: number;
    rag_identity_key?: string;
    rag_is_latest?: boolean;
};

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function normalizeDigits(value: string): string {
    return value
        .replace(/[۰-۹]/g, digit => String(PERSIAN_DIGITS.indexOf(digit)))
        .replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)));
}

export function jalaliDateKey(value: unknown, yearEnd = false): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
        if (value >= 13000000 && value <= 15991231) return Math.trunc(value);
        if (value >= 1300 && value <= 1599) return Math.trunc(value) * 10000 + (yearEnd ? 1231 : 101);
    }

    if (typeof value !== "string") return undefined;

    const normalized = normalizeDigits(value.trim());
    const fullDate = normalized.match(/^(1[3-5]\d{2})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (fullDate) {
        const year = Number(fullDate[1]);
        const month = Number(fullDate[2]);
        const day = Number(fullDate[3]);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31)
            return year * 10000 + month * 100 + day;
    }

    const yearOnly = normalized.match(/^(1[3-5]\d{2})$/);
    if (yearOnly) return Number(yearOnly[1]) * 10000 + (yearEnd ? 1231 : 101);

    return undefined;
}

export function normalizeStructuredMetadata(
    metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
    const normalized = { ...(metadata || {}) };

    // A year-only effective date means the beginning of that year, while a
    // valid_year represents coverage through the end of the year. Keeping these
    // semantics separate is required for exact mid-year historical queries.
    const explicitTemporalKey = jalaliDateKey(normalized.temporal_key, false);
    const effectiveFromKey =
        jalaliDateKey(normalized.effective_from_key, false) ??
        jalaliDateKey(normalized.effective_from, false);
    const validYearKey = jalaliDateKey(normalized.valid_year, true);
    const documentDateKey =
        jalaliDateKey(normalized.document_date_key, false) ??
        jalaliDateKey(normalized.document_date, false);

    const temporalKey =
        jalaliDateKey(normalized.temporal_sort_key, false) ??
        explicitTemporalKey ??
        effectiveFromKey ??
        validYearKey ??
        documentDateKey;

    if (temporalKey !== undefined) normalized.temporal_key = temporalKey;
    if (effectiveFromKey !== undefined) normalized.effective_from_key = effectiveFromKey;
    if (documentDateKey !== undefined) normalized.document_date_key = documentDateKey;

    return normalized;
}

export function isStructuredRagManifest(value: unknown): value is StructuredRagManifest {
    if (!value || typeof value !== "object") return false;
    const item = value as Partial<StructuredRagManifest>;
    return item.type === "rag_manifest"
        && item.format === STRUCTURED_RAG_FORMAT
        && item.version === 1;
}

export function isStructuredRagRecord(value: unknown): value is StructuredRagRecord {
    if (!value || typeof value !== "object") return false;
    const item = value as Partial<StructuredRagRecord>;
    return typeof item.id === "string"
        && item.id.length > 0
        && typeof item.text === "string"
        && item.text.trim().length > 0
        && (item.title === undefined || typeof item.title === "string")
        && (item.metadata === undefined || (
            typeof item.metadata === "object"
            && item.metadata !== null
            && !Array.isArray(item.metadata)
        ));
}

function extractLabeledNumber(text: string, labels: RegExp): string | undefined {
    const match = text.match(new RegExp(`${labels.source}\\s*[:：-]?\\s*(\\d{3,24})`, labels.flags));
    return match?.[1];
}

export function parseStructuredRagQuery(question: string): StructuredRagQuery {
    const normalized = normalizeDigits(question)
        .replace(/[يى]/g, "ی")
        .replace(/ك/g, "ک");

    const fullDate = normalized.match(/(^|\D)(1[3-5]\d{2})[\/-](\d{1,2})[\/-](\d{1,2})(?!\d)/);
    const requestedTemporalKey = fullDate
        ? Number(fullDate[2]) * 10000 + Number(fullDate[3]) * 100 + Number(fullDate[4])
        : undefined;

    const yearMatch = normalized.match(/(^|\D)(1[3-5]\d{2})(?!\d)/);
    const requestedYear = requestedTemporalKey
        ? Math.floor(requestedTemporalKey / 10000)
        : yearMatch?.[2]
            ? Number(yearMatch[2])
            : undefined;

    const exactMetadata: Record<string, string | number | boolean> = {};
    const labeledIrc = extractLabeledNumber(normalized, /(?:IRC|آی\s*آر\s*سی)/i);
    const standaloneLongCode = normalized.match(/(^|\D)(\d{12,24})(?!\d)/)?.[2];
    const irc = labeledIrc || standaloneLongCode;
    const organizationCode = extractLabeledNumber(normalized, /(?:کد\s*سازمانی)/i);
    const equipmentIndex = extractLabeledNumber(normalized, /(?:ایندکس)/i);
    const nationalServiceId = extractLabeledNumber(normalized, /(?:شناسه\s*ملی(?:\s*خدمت)?)/i);
    const globalServiceId = extractLabeledNumber(normalized, /(?:شناسه\s*گلوبال|کد\s*گلوبال)/i);

    if (irc) exactMetadata.irc = irc;
    if (organizationCode) exactMetadata.organization_code = organizationCode;
    if (equipmentIndex) exactMetadata.equipment_index = equipmentIndex;
    if (nationalServiceId) exactMetadata.service_national_id = nationalServiceId;
    if (globalServiceId) exactMetadata.global_service_ids = globalServiceId;

    return {
        requestedTemporalKey: requestedTemporalKey ?? (requestedYear ? requestedYear * 10000 + 1231 : undefined),
        requestedYear,
        preferLatest: !requestedTemporalKey && !requestedYear,
        exactMetadata,
    };
}

export function isStructuredChunk(
    chunk: IntfChunkPayload | StructuredChunkPayload,
): chunk is StructuredChunkPayload {
    return (chunk as StructuredChunkPayload).rag_format === STRUCTURED_RAG_FORMAT;
}

export function resolveStructuredVersions(
    chunks: StructuredChunkPayload[],
    query: StructuredRagQuery,
): StructuredChunkPayload[] {
    const unstructured = chunks.filter(chunk => !isStructuredChunk(chunk));
    const structured = chunks.filter(isStructuredChunk);
    const bestByIdentity = new Map<string, StructuredChunkPayload>();
    const withoutIdentity: StructuredChunkPayload[] = [];

    for (const chunk of structured) {
        const temporalKey = chunk.rag_temporal_key;
        if (
            query.requestedTemporalKey !== undefined
            && temporalKey !== undefined
            && temporalKey > query.requestedTemporalKey
        ) continue;

        if (query.preferLatest && chunk.rag_is_latest === false) continue;

        const identity = chunk.rag_identity_key;
        if (!identity) {
            withoutIdentity.push(chunk);
            continue;
        }

        const old = bestByIdentity.get(identity);
        if (!old) {
            bestByIdentity.set(identity, chunk);
            continue;
        }

        const oldTemporalKey = old.rag_temporal_key ?? 0;
        const newTemporalKey = temporalKey ?? 0;
        if (newTemporalKey > oldTemporalKey) {
            bestByIdentity.set(identity, chunk);
            continue;
        }

        if (newTemporalKey === oldTemporalKey && (chunk._score ?? 0) > (old._score ?? 0))
            bestByIdentity.set(identity, chunk);
    }

    return [
        ...unstructured,
        ...bestByIdentity.values(),
        ...withoutIdentity,
    ];
}

function formatMetadataValue(value: unknown): string {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return JSON.stringify(value);
}

export function structuredChunkToContext(chunk: IntfChunkPayload): string {
    // StructuredChunkPayload extends IntfChunkPayload, so using the type guard in
    // the negative branch can narrow to `never` under TypeScript. Inspect the
    // discriminator directly and cast only after it matches.
    if (chunk.rag_format !== STRUCTURED_RAG_FORMAT) return chunk.text;

    const structured = chunk as StructuredChunkPayload;
    const metadata = structured.rag_meta || {};
    const preferredKeys = [
        "record_type",
        "identity_key",
        "effective_from",
        "valid_year",
        "document_date",
        "irc",
        "organization_code",
        "equipment_index",
        "service_national_id",
        "global_service_id",
        "global_service_ids",
        "service_description",
        "tariff_field",
        "amount_field",
        "tariff_amount_rial",
        "government_tariff_rial",
        "equipment_currency_subsidy_rial",
        "franchise_percent",
        "franchise_rates_percent",
        "facility_type",
        "sector",
        "contract_status",
        "source_document_title",
        "source_document_id",
        "temporal_granularity",
        "source_file",
        "source_sheet",
        "source_row",
    ];

    const metadataLines = preferredKeys
        .filter(key => metadata[key] !== undefined && metadata[key] !== null)
        .map(key => `- ${key}: ${formatMetadataValue(metadata[key])}`);

    return [
     `### ${structured.title || "رکورد ساخت‌یافته"}`,
      structured.text,
      metadataLines.length ? "#### فراداده قطعی\n" + metadataLines.join("\n") : "",
    ].filter(Boolean).join("\n\n");
}
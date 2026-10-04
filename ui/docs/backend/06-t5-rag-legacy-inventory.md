# T5 legacy RAG inventory

Status: source inventory complete; production export and ownership reconciliation require the customer's explicit mapping. No production MySQL export was applied. This inventory records implementation evidence, not governing architecture.

## Boundaries and disposition

| Source | Existing behavior | Disposition | Target owner |
| --- | --- | --- | --- |
| `src/services/ragService.ts` | Service-specific Express upload/files/chat/messages/opinion/question/title/answer/summary/stop routes | Replace document/RAG routes; retain unrelated legacy business functions pending their own migration | API, Document Core, Knowledge |
| `src/services/ragResourceService.ts` | `auth.privs` quotas; MD5 of filename and size; user/service file metadata; direct vector deletion | LEGACY_AUTH_TO_REPLACE; CANONICAL_DATA_TO_MIGRATE for verified metadata and retained original assets | Authority, Admission, Document Core, File Management |
| `src/db/schema/4_tblFiles.cjs`, `src/db/tables/tblFiles.ts` | `tblFiles`: `filID`, `filOwner_usrID`, `filKey`, `filService`, `filName`, `filSize`, `filChunkCount`, `filUploadedAt`, `filStatus` | Canonical source identity/owner/name/state mapping; chunk counts are derived; MD5 is not byte-integrity proof | Document Core |
| `src/services/ragChatService.ts` | Direct generation/embedding/retrieval; MySQL conversation history; global/news/special contexts; streamed answer; raw reference text | LEGACY_HISTORY_OPTIONAL for history; LEGACY_DIRECT_QDRANT and LEGACY_AUTH_TO_REPLACE for execution | Knowledge, AI Router, business semantic owners |
| `src/services/embedService.ts` | Mutable model/endpoint selection and direct embedding HTTP | DERIVED_DATA_TO_REBUILD; legacy model policy must not define target vector compatibility | AI Router |
| `src/services/vectorDB.ts`, `vectorDB-old.ts` | Qdrant collections keyed by service/auth key, raw chunk/file-name payloads | LEGACY_DIRECT_QDRANT; DERIVED_DATA_TO_REBUILD; never an authoritative source or grant | Knowledge vector adapter |
| `src/services/file2TxtService.ts` | PDF/office/text conversion, paragraph chunking, structured JSONL ingestion | Reprocess retained originals with shared File Processing; imported chunks alone are insufficient provenance | File Processing, Knowledge |
| `src/services/structuredRag.ts` | Structured records and query-specific business metadata | Business optional integration contract; unsupported formats require an explicit adapter, not generic silent conversion | Owning business module |
| `src/services/widgetService.ts` | Widget-specific collections/identities and RAG behavior | Business migration separate; machine accounts need explicit machine Identity mapping | Widget semantic owner, Identity |
| `src/routes/shares.ts`, `src/db/tables/tblSharedFiles.ts`, `tblSharedFilesDownloads.ts` | Legacy shared filesystem/download statistics | Not automatically a RAG grant or managed Asset. Export only specifically approved originals with ownership evidence | File Management, owning resource |
| `public/rag.html`, `public/js/rag.js`, `public/js/llm.js` | Legacy login state, upload progress, file toggles, chat/history and HTML rendering | Target authenticated `/knowledge` replaces document/query flow; unrelated legacy chat UI is outside target delivery | Web/UI Core |

The route inventory includes `/<service>/chats`, `/chat`, `/chat/:chatId/messages`, `/chat/:chatId/title`, message opinion, `/files`, `/file/:fileId`, `/upload`, `/generate-questions`, `/generate-title`, `/generate-answer`, `/generate-summary`, `/update-question`, and `/:reqId/stop`. Upload bytes were processed into vector chunks; the metadata table does not prove original-byte retention. File existence and full SHA-256 must therefore be established separately.

## Mapping and exclusions

Source identity is `(source-system, service, filID)`. `filOwner_usrID` requires an explicit `(service, legacyUserId) → (deploymentId, tenantId, actorId, spaceId)` map. Duplicate mappings, conflicting Space owners/classifications, missing owners, duplicate source identities and Qdrant-only sources fail closed. Legacy privileges, auth keys and per-user collection naming never become target authorization.

Active records require original filename/type/size/hash and an opaque export reference. Removed records are counted as explicit exclusions; restore/retention requires a separate policy decision. Chats/messages/statistics are optional historical migration, not RAG canonical content. Global/news/special data needs its own original provenance and resource owner. No generic user or default tenant fallback is permitted.

## Evidence and limits

`packages/knowledge/src/legacy-migration.ts` and `scripts/t5-legacy-migration-plan.ts` implement bounded planning and approved ingestion through public capabilities. `tests/target/t5-legacy-migration.test.ts` proves ambiguous-owner rejection, stable identities, original-only intake, retry without duplicate Versions, checksum conflict rejection and fresh target indexing. Real customer owner mappings and original-byte inventory have not been supplied. The formal inventory file was produced after initial foundation implementation; this workflow timing deviation does not alter source authority and is recorded in the Activity Report.

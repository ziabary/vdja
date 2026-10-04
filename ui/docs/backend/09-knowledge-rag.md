# Knowledge Spaces and secure RAG implementation

## Canonical and derived state

`packages/knowledge` owns Space metadata, CURRENT/PINNED Document membership, immutable index manifests/chunk boundaries/projections and query orchestration. A Space organizes retrieval and grants no access. PostgreSQL is canonical. The owning Qdrant adapter stores only vectors and scoped opaque references; raw protected text, names, ACL semantics and credentials are absent from payloads.

Profiles bind model/artifact revision/dimensions and deterministic chunking policy. UTF-16 boundaries preserve Unicode surrogate pairs, overlap is bounded, and chunk SHA-256 verifies exact materialization. Generations use deterministic IDs/point identities, bounded batches and a 10,000-chunk hard cap. Partial generations never become queryable. The pending requested-generation status survives failure even before any vector is written.

## Rebuild and processing

Membership changes and Document publication schedule persistent rebuild Jobs atomically. A registered Worker retains the original content-use subject, revalidates it, materializes via File Management and requests semantic embedding tasks through AI Router. It reserves distributed Admission per embedding batch and records actual embedding/upsert work. Upserts are idempotent; PostgreSQL chunk proofs and total counts must match Qdrant before publication.

Final publication revalidates Document authorization/security/version facts and Space state, locks factual snapshots, asserts the Job lease and activates the projection atomically. Security changes leave old projections stale. An embedding artifact/profile change rejects an incompatible old generation until fresh rebuild. Qdrant server replacement/restart is supported by retained canonical original/normalized state.

## Query

Space query authorization and coarse Document Use decisions precede query embedding and Qdrant retrieval. The adapter filters deployment/tenant/space/generation/allowed Document IDs. Hits are untrusted: deterministic point identity, canonical chunk manifest, current/pinned version and fresh Authority decisions are checked before File Management materializes any text. Further checks precede reranking, generation and answer publication.

AI Router selects configured models/endpoints, applies exact Data Governance destination/task/classification policy, validates responses and records Run/Attempt/token evidence. Context budgets retain whole chunks, use a conservative byte/token bound and reject excessive input rather than silently truncate. Structured output is nonstreaming, schema checked, and cannot execute tools or mutate business state.

Backend citation labels/Document/Version/chunk references are derived from authorized sources. Discover controls identity/name disclosure; Read and Quote remain independent. Quote denial uses conservative normalization/overlap checks. UI renders answer/content as escaped text. Actual prompt-injection behavior of a customer model must also be checked using the approved live model configuration.

The query endpoint supports validated SSE delivery. Generation is buffered through schema, quote and final authorization checks before the first text delta; authorized citations and DONE follow. No raw provider fragment is exposed before validation. Browser consumption bounds frames/output, checks event order and terminal state, supports abort and clears incomplete responses on failure or identity change.

## Accounting, reliability and evidence

Immutable Usage records actual query, processing, embedding, retrieval, authorized-chunk, rerank, generation and indexing consumption, including rejected answers. Admission is distributed; Usage is not authorization or financial accounting. Metadata-only semantic Audit, DB mutation triggers, operational status/duration logs and selected durable SIEM exports share scope/request/correlation context.

Evidence: `t5-knowledge-projection.integration.test.ts`, `t5-rag-security.integration.test.ts`, `t5-runtime.integration.test.ts`, `t5-protected-ai.integration.test.ts`, `t5-browser.integration.test.mjs`. These use actual PostgreSQL/Qdrant/Storage/Worker and protocol-compatible provider fixtures. They do not prove customer model artifact provenance, tokenizer behavior, model quality or actual production vLLM service readiness.

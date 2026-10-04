# وضعیت جاری امنیت Document / Knowledge / RAG پس از T5-R1

این سند از `reports/security/t5-completion-gate.json` و نقشهٔ شاهد معیارها تولید می‌شود. تاریخ: 2026-10-04T12:52:33.782Z.

| Gate | نتیجه |
| --- | --- |
| T5 | PARTIAL |
| T5_COMPLETION_SECURITY_GATE | FAIL |
| GENAI_RAG_SECURITY_GATE | FAIL |
| ASVS_L3_RELEASE_GATE | NO |
| معیار با شاهد مستقیم و اجرای جاری | 74/100 |
| معیار NOT_VERIFIED | 23 |
| PASS مشتق از feature flag کلی | 0 |
| مانع T5 با ارزیابی جاری | 61 |
| تغییر غیرمجاز protected | 0 |

آزمون‌های محلی از PostgreSQL، Qdrant، Storage و fixture پروتکل provider استفاده می‌کنند. این‌ها شاهد رفتار مدل واقعی یا زیرساخت مشتری نیستند. نتیجهٔ قدیمی PASS معیارها به وضعیت جاری منتقل نشده است.

## الزامات باز

- ACCEPTANCE_CRITERIA_NOT_VERIFIED
- POST_T5_ALLOW_DENY_AUDIT_COVERAGE_REQUIRED
- ACTUAL_APPROVED_MODEL_CONFIG_REQUIRED

## معیارهای پذیرش

| شماره | معیار | نتیجه | شاهد مستقیم یا علت باز بودن |
| --- | --- | --- | --- |
| 1 | legacy RAG inventory complete; | NOT_VERIFIED | CRITERION_SPECIFIC_EVIDENCE_NOT_RECORDED |
| 2 | canonical data migration mapped; | NOT_VERIFIED | CRITERION_SPECIFIC_EVIDENCE_NOT_RECORDED |
| 3 | Document Core implemented; | PASS | PostgreSQL Document versions and jobs survive retries, concurrency and Worker replacement |
| 4 | Version implemented; | PASS | normalized content is immutable and out-of-order activation cannot replace a newer version |
| 5 | Asset implemented; | PASS | version/asset/job/usage/audit are atomic and resumable partial bytes are never downloadable |
| 6 | Storage abstraction implemented; | PASS | local multipart contract is immutable, resumable, bounded by opaque identity, and hash verified |
| 7 | File Processing integrated; | PASS | office parser cleans its conversion directory and profile after processing |
| 8 | Knowledge Space implemented; | PASS | membership schedules indexing atomically, Router runs protected tasks and real citations can be independently read |
| 9 | Qdrant is derived only; | PASS | real Qdrant restart keeps derived bytes while PostgreSQL remains canonical and scope fails closed |
| 10 | Qdrant is rebuildable; | PASS | fresh Qdrant rebuild, idempotent upsert and authorized filters return only opaque references |
| 11 | index generation/versioning implemented; | PASS | activation requires complete counts and immutable snapshot; concurrent replacement cannot regress |
| 12 | ingestion jobs durable; | PASS | PostgreSQL Document versions and jobs survive retries, concurrency and Worker replacement |
| 13 | ingestion idempotent; | PASS | retry preserves immutable generation/chunk identity and a conflicting profile fails |
| 14 | Authority precedes retrieval; | PASS | Authority before retrieval limits the real vector query; revoked source bytes never reach reranker or LLM |
| 15 | final candidate authorization implemented; | PASS | final candidate validation rejects a malicious derived hit before File Management materializes its Version |
| 16 | unauthorized chunks never reach reranker; | PASS | security revocation after materialization before reranker prevents next provider dispatch |
| 17 | unauthorized chunks never reach LLM; | PASS | security revocation after reranker before generation prevents next provider dispatch |
| 18 | discover/read/download/use/quote/manage are independent; | PASS | read is not use; use does not disclose/download; unknown citations and direct quotation fail closed |
| 19 | citation authorization correct; | PASS | platform disclosure rejects malicious output for citation-manipulation |
| 20 | quote authorization correct; | PASS | platform disclosure rejects malicious output for unauthorized-quote |
| 21 | classification enforced; | PASS | classification, ownership, scope, and missing facts fail closed |
| 22 | tenant isolation enforced; | PASS | one deployment Worker claims interleaved A1 B1 A2 B2 preserving Human subjects and tenant boundaries |
| 23 | ACL deny semantics correct; | PASS | resource ACL explicit deny wins over ordinary grant |
| 24 | ALL cannot bypass hard boundaries; | PASS | root ALL cannot cross tenant boundary |
| 25 | Data Governance egress implemented; | PASS | Governance denial rejects generation before external content leaves its Router |
| 26 | protected external egress denied correctly; | PASS | unapproved fallback receives zero bytes and approved provider failure does not grant egress |
| 27 | embedding uses AI Router; | PASS | embedding, query, reranking and answer preserve semantic tasks/model revision and actual usage |
| 28 | reranking uses approved Router boundary; | NOT_VERIFIED | CRITERION_SPECIFIC_EVIDENCE_NOT_RECORDED |
| 29 | RAG answer uses AI Router; | NOT_VERIFIED | CRITERION_SPECIFIC_EVIDENCE_NOT_RECORDED |
| 30 | no business code chooses model/provider; | PASS | T5 guards reject direct vectors/providers/signed URLs and retain public File Management and Router contracts |
| 31 | context budgeting has no silent truncation; | PASS | malicious metadata and question resource excess cause bounded errors without provider work |
| 32 | prompt-injection tests pass; | PASS | platform disclosure rejects malicious output for direct-English; platform disclosure rejects malicious output for direct-Persian; platform disclosure rejects malicious output for indirect-English; platform disclosure rejects malicious output for indirect-Persian; platform disclosure rejects malicious output for mixed-language; platform disclosure rejects malicious output for Unicode-normalization; platform disclosure rejects malicious output for zero-width; platform disclosure rejects malicious output for bidi; platform disclosure rejects malicious output for fake-system-role; platform disclosure rejects malicious output for ignore-previous; platform disclosure rejects malicious output for secret-exfiltration; platform disclosure rejects malicious output for hidden-source-discovery; platform disclosure rejects malicious output for unauthorized-quote; platform disclosure rejects malicious output for citation-manipulation; platform disclosure rejects malicious output for cross-tenant-bait; platform disclosure rejects malicious output for fake-retrieval-metadata; platform disclosure rejects malicious output for tool-and-URL-execution; platform disclosure rejects malicious output for tenant-change; platform disclosure rejects malicious output for classification-change; platform disclosure rejects malicious output for governance-change; platform disclosure rejects malicious output for conflicting-documents; platform disclosure rejects malicious output for multi-turn-pressure; platform disclosure rejects malicious output for long-context-poisoning |
| 33 | RAG Usage works; | PASS | RAG records actual rejected-generation consumption and denies rewriting Usage facts |
| 34 | RAG Admission works; | PASS | distributed query reservations reject additional API work before provider dispatch |
| 35 | semantic Audit works; | PASS | actual upload/processing/index/query evidence reaches a TLS receiver with matching original Session/request |
| 36 | DB mutation Audit works; | PASS | database mutation evidence omits names, locators and content |
| 37 | SIEM selection/redaction works; | NOT_VERIFIED | CRITERION_SPECIFIC_EVIDENCE_NOT_RECORDED |
| 38 | authenticated RAG UI works; | PASS | built Svelte RAG UI uses real Identity/Session/Authority, managed upload, durable processing, derived retrieval and authorized citations |
| 39 | processing status UI works; | NOT_VERIFIED | CRITERION_SPECIFIC_EVIDENCE_NOT_RECORDED |
| 40 | citations work; | NOT_VERIFIED | CRITERION_SPECIFIC_EVIDENCE_NOT_RECORDED |
| 41 | legacy users map safely; | PASS | legacy mapping fails closed for missing/ambiguous owners, privilege imports, duplicate identity and derived source |
| 42 | ambiguous owners fail migration; | NOT_VERIFIED | CRITERION_SPECIFIC_EVIDENCE_NOT_RECORDED |
| 43 | legacy Qdrant not treated as canonical; | PASS | approved legacy original migrates through canonical Document/File Management and retries without duplicate versions; index rebuild is fresh |
| 44 | fresh Qdrant rebuild test passes; | PASS | fresh derived index rebuild uses retained canonical content and preserves Document/Version/Asset identities |
| 45 | document-version test passes; | PASS | parallel intake has unique sequences and source retry returns one version |
| 46 | embedding-policy change/reindex test passes; | PASS | embedding revision change requires a separate generation and atomically switches only after full reindex |
| 47 | MySQL-off RAG passes; | NOT_VERIFIED | CASE_ASSERTION_NOT_IDENTIFIED_IN_SOURCE |
| 48 | legacy auth-off target RAG passes; | NOT_VERIFIED | CRITERION_SPECIFIC_EVIDENCE_NOT_RECORDED |
| 49 | target architecture guardrails pass; | PASS | T5 guards reject S3 and filesystem bypasses while accepting owning infrastructure |
| 50 | Level 3 RAG security delta has no blocking failure. | FAIL | CANONICAL_GATE_OPEN |
| 51 | shared File Management capability exists; | PASS | File Management enforces real Session/Authority before verified upload commit and cache/range downloads |
| 52 | File Management is logical/in-process by default, not an unnecessary microservice; | NOT_VERIFIED | CRITERION_SPECIFIC_EVIDENCE_NOT_RECORDED |
| 53 | all target managed file operations use File Management; | PASS | anonymous/mismatched tenant fail and all file operations run through the API File Management boundary |
| 54 | direct business-module filesystem access for managed persistent assets is zero; | NOT_VERIFIED | CRITERION_SPECIFIC_EVIDENCE_NOT_RECORDED |
| 55 | direct business-module S3 access is zero; | NOT_VERIFIED | CRITERION_SPECIFIC_EVIDENCE_NOT_RECORDED |
| 56 | Local Storage adapter works; | PASS | local multipart contract is immutable, resumable, bounded by opaque identity, and hash verified |
| 57 | S3-compatible Storage adapter works; | PASS | real S3 multipart parity, process/server restart and ambiguous completion reconcile safely |
| 58 | adapter choice is CJSON-driven; | PASS | managed transfer configuration selects one adapter with external credentials and strict bounds |
| 59 | storage credentials/secrets remain external through secretRef; | NOT_VERIFIED | CRITERION_SPECIFIC_EVIDENCE_NOT_RECORDED |
| 60 | Document Version is distinct from backend object version; | NOT_VERIFIED | CRITERION_SPECIFIC_EVIDENCE_NOT_RECORDED |
| 61 | committed Asset bytes are immutable by identity; | PASS | canonical bytes survive storage server replacement/restart and anonymous access is denied |
| 62 | content-hash verification works; | PASS | invalid signature/hash never creates Asset, Version, or processing Job |
| 63 | upload staging lifecycle exists; | PASS | noncanonical staging streams bounded verified bytes, cleans failure and never exposes partial content |
| 64 | incomplete uploads are not exposed as committed/usable Assets; | PASS | partial upload is invisible and duplicate part is stable across adapter restart |
| 65 | resumable/multipart semantics work as required; | PASS | lost response after actual commit is UNKNOWN, never blindly retried, and full bytes prove outcome |
| 66 | upload cache/staging is bounded and non-canonical; | PASS | private bounded cache is version/tenant aware, rebuildable and verifies full bytes before ranges; noncanonical staging streams bounded verified bytes, cleans failure and never exposes partial content |
| 67 | download cache is version-aware; | NOT_VERIFIED | CRITERION_SPECIFIC_EVIDENCE_NOT_RECORDED |
| 68 | cache never bypasses Authority; | PASS | warm/disposable cache, range and conditional requests cannot skip independent download authorization |
| 69 | cache is disposable/rebuildable; | NOT_VERIFIED | CRITERION_SPECIFIC_EVIDENCE_NOT_RECORDED |
| 70 | cache eviction is bounded; | PASS | private bounded cache is version/tenant aware, rebuildable and verifies full bytes before ranges |
| 71 | stale cache cannot expose superseded/revoked/forbidden content; | PASS | revocation after download authorization and before first byte yields no protected content |
| 72 | Range support is safe; | PASS | range boundaries reject multiple, malformed and unsafe ranges |
| 73 | conditional download works where configured; | PASS | warm/disposable cache, range and conditional requests cannot skip independent download authorization |
| 74 | protected content uses safe cache headers; | NOT_VERIFIED | CRITERION_SPECIFIC_EVIDENCE_NOT_RECORDED |
| 75 | download is independently authorized; | PASS | File Management enforces real Session/Authority before verified upload commit and cache/range downloads |
| 76 | read does not imply download; | PASS | read is not use; use does not disclose/download; unknown citations and direct quotation fail closed |
| 77 | use does not imply discover/download; | NOT_VERIFIED | CRITERION_SPECIFIC_EVIDENCE_NOT_RECORDED |
| 78 | RAG cannot bypass File Management to read Storage; | PASS | T5 guards reject S3 and filesystem bypasses while accepting owning infrastructure |
| 79 | path traversal/archive/symlink tests pass; | PASS | office precheck rejects malicious archives before LibreOffice |
| 80 | MIME/signature/type-consistency tests pass; | PASS | upload media type, extension, signature, and temporary path agree |
| 81 | file size/resource-exhaustion tests pass; | PASS | Authority selects file tiers; Admission enforces distributed actor and hard limits after elevation and revocation |
| 82 | S3 ambiguous-outcome/reconciliation semantics are safe; | PASS | lost response after actual commit is UNKNOWN, never blindly retried, and full bytes prove outcome |
| 83 | File semantic Audit works; | PASS | Usage is immutable/idempotent and file semantic and mutation evidence exclude sensitive metadata |
| 84 | File Usage Accounting works; | NOT_VERIFIED | CRITERION_SPECIFIC_EVIDENCE_NOT_RECORDED |
| 85 | file security events can reach SIEM; | PASS | actual upload/processing/index/query evidence reaches a TLS receiver with matching original Session/request |
| 86 | static File Management architecture guards are green; | PASS | T5 guards reject direct vectors/providers/signed URLs and retain public File Management and Router contracts |
| 87 | post-T5 complete Persian current-state ASVS assessment exists; | NOT_VERIFIED | CRITERION_SPECIFIC_EVIDENCE_NOT_RECORDED |
| 88 | all `verifyDuringT5` controls are re-evaluated with concrete evidence; | NOT_VERIFIED | CRITERION_SPECIFIC_EVIDENCE_NOT_RECORDED |
| 89 | T5-introduced/T5-scope blocking security findings = 0 or approved documented exceptions; | FAIL | CANONICAL_GATE_OPEN |
| 90 | GenAI/RAG security gate passes; | FAIL | CANONICAL_GATE_OPEN |
| 91 | Audit end-to-end verification passes; | PASS | real T5 Audit and TLS SIEM delivery preserve correlation, immutability, redaction and restart semantics |
| 92 | Audit immutability passes; | PASS | ordinary API and Worker cannot rewrite Audit or disable mutation evidence; rollback leaves no event/outbox |
| 93 | Audit sensitive-data leakage scan passes; | PASS | sensitive contents, prompts, answers and locators are absent from exported/canonical evidence |
| 94 | SIEM real T5 event delivery passes; | PASS | actual upload/processing/index/query evidence reaches a TLS receiver with matching original Session/request |
| 95 | SIEM UNKNOWN/retry semantics pass; | PASS | lost acknowledgement retries only with stable receiver idempotency; maxAttempts is bounded |
| 96 | SIEM restart/recovery passes; | PASS | restart recovers an expired claim and stale Worker cannot settle its replacement |
| 97 | SIEM outage does not corrupt/block ordinary RAG when policy says optional/degraded; | PASS | optional SIEM outage leaves real RAG successful and NONE guarantees never blindly repeat UNKNOWN |
| 98 | SIEM redaction passes; | PASS | HUMAN origin, mandatory Audit, SIEM retry, redaction and audit immutability |
| 99 | T5 introduced zero unauthorized modifications to protected governing documents; | PASS | R1 protected governing files match the task-specific baseline with no inherited exceptions |
| 100 | `ASVS_L3_RELEASE_GATE` is recomputed and reported independently; it may remain NO without making T5 PARTIAL when only release-only controls remain open; | NOT_VERIFIED | CRITERION_SPECIFIC_EVIDENCE_NOT_RECORDED |

مجوز انتشار سطح ۳ مشتری: NO.

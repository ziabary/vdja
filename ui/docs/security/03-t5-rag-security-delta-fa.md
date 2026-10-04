# دلتا امنیتی Document / Knowledge / RAG در T5

## gateهای مستقل

- T5_START_GATE: PASS
- RAG_SECURITY_GATE شروع: YES
- T5_COMPLETION_SECURITY_GATE: FAIL
- GENAI_RAG_SECURITY_GATE: FAIL
- ASVS_L3_RELEASE_GATE: NO
- وضعیت T5: PARTIAL
- مانع T5 / verifyDuringT5: 41
- مانع فقط release: 69
- استثنای مصوب: صفر
- تغییر غیرمجاز protected: 0

## پیاده‌سازی و شواهد

Document/Version/Asset canonical در PostgreSQL، File Management in-process، Local/S3-compatible private Storage و Qdrant derived generation پیاده شده‌اند. Subject، Authority و Governance پیش از materialization/reranker/LLM بررسی می‌شوند؛ deny/classification/tenant/operation مستقل‌اند. آزمون‌ها cache revocation، malicious derived hit، quote/citation rejection، context/resource bounds، provider outage، immutable Usage، rollback، audit و TLS SIEM را اجرا می‌کنند. endpointهای AI این بسته protocol fixture هستند و رفتار مدل واقعی را ثابت نمی‌کنند.

| بررسی GenAI/RAG | نتیجه |
| --- | --- |
| authorityBeforeRetrieval | PASS |
| poisonedDerivedHitRejected | PASS |
| finalCandidateBeforeMaterialization | PASS |
| tenantAndEmbeddingIsolation | PASS |
| rerankAndLlmRevocationFences | PASS |
| independentCitationAndQuote | PASS |
| insecureOutputEscaped | PASS |
| egressDenied | PASS |
| contextAndResourceExhaustion | PASS |
| auditAndSiem | PASS |
| actualApprovedModels | NOT_VERIFIED |
| actualModelBrowser | NOT_VERIFIED |

## اسکن واقعی زنجیرهٔ تأمین

اسکن local/offline تصویر API برند A به image ID و source hash آزموده‌شده متصل است؛ همهٔ تصاویر به‌طور مستقل اسکن نشده‌اند. SBOM هر سه برند ثبت شده و lock اجرایی نیز جدا اسکن شده است.

| دامنه | HIGH / CRITICAL | وضعیت |
| --- | --- | --- |
| runtime | 96 | FAIL |
| dependency | 20 | FAIL |
| runtime-dependency | 0 | PASS در دامنهٔ DB scanner |

اسکن تصویری vulnerabilityهای سیستم‌عامل را باز نگه داشته است؛ dependency lock اجرایی پس از اصلاح فاقد یافتهٔ HIGH/CRITICAL است. این وضعیت معادل گواهی امنیت production نیست. یافته‌های root lock شامل dependencyهای legacy/development نیز هستند؛ هیچ یافته‌ای waive نشده است.

## شکاف‌های باز و دامنه

sandbox/antivirus تمام فرمت‌ها، retention/purge/legal hold، credentials کوتاه‌عمر و authentication مقاوم به replay داخلی، TLS/CA/IAM/NTP/log حفاظت‌شدهٔ مشتری و بخش‌هایی از parser/concurrency assurance هنوز بازند. تمامی ۱۰۲ تعهد قبلی و چهار کنترل تازه در دامنهٔ T5 با نتیجهٔ مستقل در گزارش کامل فارسی بازبینی شده‌اند؛ آن‌ها به release-only بازطبقه‌بندی نشده‌اند. تغییر governing sources برای بستن gate انجام نشده است.

جریان UI پاسخ را با SSE delta/citation/DONE منتقل می‌کند. generation تا تکمیل schema، quote و final authorization buffer می‌شود و سپس بخش‌های متن مجاز ارسال می‌شوند؛ raw provider token پیش از بررسی به browser نمی‌رسد. consumer دارای bounds، terminal/order validation، abort و پاک‌سازی پاسخ ناقص است. streaming transport جای آزمون vLLM واقعی را نمی‌گیرد. پیکربندی approved مدل واقعی و mapping/اصل فایل‌های واقعی legacy ارائه نشده‌اند؛ ابزار migration فقط روی fixture اصلی verified و fail-closed برای owner مبهم آزموده شده است. production migration/cutover اجرا نشده و از snapshotها نتیجهٔ تأیید مشتری ساخته نشده است.

## همهٔ ۱۰۰ معیار

PASS ویژگی‌ها به دامنهٔ local acceptance و protocol providers محدود است. PASS criterionهای migration به مدل/ابزار mapping و fixture اصلی اشاره دارد و ادعای اجرای migration دادهٔ واقعی مشتری نیست. بستهٔ feature test green برای COMPLETE کافی نیست؛ معیارهای امنیتی و الزامات E2E واقعی باید بسته شوند.

| شماره | معیار | نتیجه | شاهد |
| --- | --- | --- | --- |
| 1 | legacy RAG inventory complete; | PASS | `docs/backend/06-t5-rag-legacy-inventory.md`<br>`docs/backend/07-t5-rag-data-migration.md`<br>`tests/target/t5-legacy-migration.test.ts` |
| 2 | canonical data migration mapped; | PASS | `docs/backend/06-t5-rag-legacy-inventory.md`<br>`docs/backend/07-t5-rag-data-migration.md`<br>`tests/target/t5-legacy-migration.test.ts` |
| 3 | Document Core implemented; | PASS | `tests/reports/t5-acceptance.json` |
| 4 | Version implemented; | PASS | `tests/reports/t5-acceptance.json` |
| 5 | Asset implemented; | PASS | `tests/reports/t5-acceptance.json` |
| 6 | Storage abstraction implemented; | PASS | `tests/reports/t5-acceptance.json` |
| 7 | File Processing integrated; | PASS | `tests/reports/t5-acceptance.json` |
| 8 | Knowledge Space implemented; | PASS | `tests/reports/t5-acceptance.json` |
| 9 | Qdrant is derived only; | PASS | `tests/reports/t5-acceptance.json` |
| 10 | Qdrant is rebuildable; | PASS | `tests/reports/t5-acceptance.json` |
| 11 | index generation/versioning implemented; | PASS | `tests/reports/t5-acceptance.json` |
| 12 | ingestion jobs durable; | PASS | `tests/reports/t5-acceptance.json` |
| 13 | ingestion idempotent; | PASS | `tests/reports/t5-acceptance.json` |
| 14 | Authority precedes retrieval; | PASS | `tests/reports/t5-acceptance.json` |
| 15 | final candidate authorization implemented; | PASS | `tests/reports/t5-acceptance.json` |
| 16 | unauthorized chunks never reach reranker; | PASS | `tests/reports/t5-acceptance.json` |
| 17 | unauthorized chunks never reach LLM; | PASS | `tests/reports/t5-acceptance.json` |
| 18 | discover/read/download/use/quote/manage are independent; | PASS | `tests/reports/t5-acceptance.json` |
| 19 | citation authorization correct; | PASS | `tests/reports/t5-acceptance.json` |
| 20 | quote authorization correct; | PASS | `tests/reports/t5-acceptance.json` |
| 21 | classification enforced; | PASS | `tests/reports/t5-acceptance.json` |
| 22 | tenant isolation enforced; | PASS | `tests/reports/t5-acceptance.json` |
| 23 | ACL deny semantics correct; | PASS | `tests/reports/t5-acceptance.json` |
| 24 | ALL cannot bypass hard boundaries; | PASS | `tests/reports/t5-acceptance.json` |
| 25 | Data Governance egress implemented; | PASS | `tests/reports/t5-acceptance.json` |
| 26 | protected external egress denied correctly; | PASS | `tests/reports/t5-acceptance.json` |
| 27 | embedding uses AI Router; | PASS | `tests/reports/t5-acceptance.json` |
| 28 | reranking uses approved Router boundary; | PASS | `tests/reports/t5-acceptance.json` |
| 29 | RAG answer uses AI Router; | PASS | `tests/reports/t5-acceptance.json` |
| 30 | no business code chooses model/provider; | PASS | `tests/reports/t5-acceptance.json` |
| 31 | context budgeting has no silent truncation; | PASS | `tests/reports/t5-acceptance.json` |
| 32 | prompt-injection tests pass; | FAIL | `reports/security/t5-completion-gate.json` |
| 33 | RAG Usage works; | PASS | `tests/reports/t5-acceptance.json` |
| 34 | RAG Admission works; | PASS | `tests/reports/t5-acceptance.json` |
| 35 | semantic Audit works; | PASS | `tests/reports/t5-acceptance.json` |
| 36 | DB mutation Audit works; | PASS | `tests/reports/t5-acceptance.json` |
| 37 | SIEM selection/redaction works; | PASS | `tests/reports/t5-acceptance.json` |
| 38 | authenticated RAG UI works; | PASS | `tests/reports/t5-acceptance.json` |
| 39 | processing status UI works; | PASS | `tests/reports/t5-acceptance.json` |
| 40 | citations work; | PASS | `tests/reports/t5-acceptance.json` |
| 41 | legacy users map safely; | PASS | `docs/backend/06-t5-rag-legacy-inventory.md`<br>`docs/backend/07-t5-rag-data-migration.md`<br>`tests/target/t5-legacy-migration.test.ts` |
| 42 | ambiguous owners fail migration; | PASS | `docs/backend/06-t5-rag-legacy-inventory.md`<br>`docs/backend/07-t5-rag-data-migration.md`<br>`tests/target/t5-legacy-migration.test.ts` |
| 43 | legacy Qdrant not treated as canonical; | PASS | `docs/backend/06-t5-rag-legacy-inventory.md`<br>`docs/backend/07-t5-rag-data-migration.md`<br>`tests/target/t5-legacy-migration.test.ts` |
| 44 | fresh Qdrant rebuild test passes; | PASS | `tests/reports/t5-acceptance.json` |
| 45 | document-version test passes; | PASS | `tests/reports/t5-acceptance.json` |
| 46 | embedding-policy change/reindex test passes; | PASS | `tests/reports/t5-acceptance.json` |
| 47 | MySQL-off RAG passes; | PASS | `tests/reports/t5-acceptance.json` |
| 48 | legacy auth-off target RAG passes; | PASS | `tests/reports/t5-acceptance.json` |
| 49 | target architecture guardrails pass; | PASS | `tests/reports/t5-acceptance.json` |
| 50 | Level 3 RAG security delta has no blocking failure. | FAIL | `reports/security/t5-asvs-review.json` |
| 51 | shared File Management capability exists; | PASS | `tests/reports/t5-acceptance.json` |
| 52 | File Management is logical/in-process by default, not an unnecessary microservice; | PASS | `tests/reports/t5-acceptance.json` |
| 53 | all target managed file operations use File Management; | PASS | `tests/reports/t5-acceptance.json` |
| 54 | direct business-module filesystem access for managed persistent assets is zero; | PASS | `tests/reports/t5-acceptance.json` |
| 55 | direct business-module S3 access is zero; | PASS | `tests/reports/t5-acceptance.json` |
| 56 | Local Storage adapter works; | PASS | `tests/reports/t5-acceptance.json` |
| 57 | S3-compatible Storage adapter works; | PASS | `tests/reports/t5-acceptance.json` |
| 58 | adapter choice is CJSON-driven; | PASS | `tests/reports/t5-acceptance.json` |
| 59 | storage credentials/secrets remain external through secretRef; | PASS | `tests/reports/t5-acceptance.json` |
| 60 | Document Version is distinct from backend object version; | PASS | `tests/reports/t5-acceptance.json` |
| 61 | committed Asset bytes are immutable by identity; | PASS | `tests/reports/t5-acceptance.json` |
| 62 | content-hash verification works; | PASS | `tests/reports/t5-acceptance.json` |
| 63 | upload staging lifecycle exists; | PASS | `tests/reports/t5-acceptance.json` |
| 64 | incomplete uploads are not exposed as committed/usable Assets; | PASS | `tests/reports/t5-acceptance.json` |
| 65 | resumable/multipart semantics work as required; | PASS | `tests/reports/t5-acceptance.json` |
| 66 | upload cache/staging is bounded and non-canonical; | PASS | `tests/reports/t5-acceptance.json` |
| 67 | download cache is version-aware; | PASS | `tests/reports/t5-acceptance.json` |
| 68 | cache never bypasses Authority; | PASS | `tests/reports/t5-acceptance.json` |
| 69 | cache is disposable/rebuildable; | PASS | `tests/reports/t5-acceptance.json` |
| 70 | cache eviction is bounded; | PASS | `tests/reports/t5-acceptance.json` |
| 71 | stale cache cannot expose superseded/revoked/forbidden content; | PASS | `tests/reports/t5-acceptance.json` |
| 72 | Range support is safe; | PASS | `tests/reports/t5-acceptance.json` |
| 73 | conditional download works where configured; | PASS | `tests/reports/t5-acceptance.json` |
| 74 | protected content uses safe cache headers; | PASS | `tests/reports/t5-acceptance.json` |
| 75 | download is independently authorized; | PASS | `tests/reports/t5-acceptance.json` |
| 76 | read does not imply download; | PASS | `tests/reports/t5-acceptance.json` |
| 77 | use does not imply discover/download; | PASS | `tests/reports/t5-acceptance.json` |
| 78 | RAG cannot bypass File Management to read Storage; | PASS | `tests/reports/t5-acceptance.json` |
| 79 | path traversal/archive/symlink tests pass; | PASS | `tests/reports/t5-acceptance.json` |
| 80 | MIME/signature/type-consistency tests pass; | PASS | `tests/reports/t5-acceptance.json` |
| 81 | file size/resource-exhaustion tests pass; | PASS | `tests/reports/t5-acceptance.json` |
| 82 | S3 ambiguous-outcome/reconciliation semantics are safe; | PASS | `tests/reports/t5-acceptance.json` |
| 83 | File semantic Audit works; | PASS | `tests/reports/t5-acceptance.json` |
| 84 | File Usage Accounting works; | PASS | `tests/reports/t5-acceptance.json` |
| 85 | file security events can reach SIEM; | PASS | `tests/reports/t5-acceptance.json` |
| 86 | static File Management architecture guards are green; | PASS | `tests/reports/t5-acceptance.json` |
| 87 | post-T5 complete Persian current-state ASVS assessment exists; | PASS | `docs/security/03-t5-asvs-5.0-level3-assessment-fa.md`<br>`reports/security/t5-asvs-review.json` |
| 88 | all `verifyDuringT5` controls are re-evaluated with concrete evidence; | PASS | `docs/security/03-t5-asvs-5.0-level3-assessment-fa.md`<br>`reports/security/t5-asvs-review.json` |
| 89 | T5-introduced/T5-scope blocking security findings = 0 or approved documented exceptions; | FAIL | `reports/security/t5-asvs-review.json` |
| 90 | GenAI/RAG security gate passes; | FAIL | `reports/security/t5-completion-gate.json` |
| 91 | Audit end-to-end verification passes; | PASS | `tests/reports/t5-audit-siem.tap` |
| 92 | Audit immutability passes; | PASS | `tests/reports/t5-audit-siem.tap` |
| 93 | Audit sensitive-data leakage scan passes; | PASS | `tests/reports/t5-audit-siem.tap` |
| 94 | SIEM real T5 event delivery passes; | PASS | `tests/reports/t5-audit-siem.tap` |
| 95 | SIEM UNKNOWN/retry semantics pass; | PASS | `tests/reports/t5-audit-siem.tap` |
| 96 | SIEM restart/recovery passes; | PASS | `tests/reports/t5-audit-siem.tap` |
| 97 | SIEM outage does not corrupt/block ordinary RAG when policy says optional/degraded; | PASS | `tests/reports/t5-audit-siem.tap` |
| 98 | SIEM redaction passes; | PASS | `tests/reports/t5-audit-siem.tap` |
| 99 | T5 introduced zero unauthorized modifications to protected governing documents; | PASS | `reports/security/t5-protected-paths-after.json` |
| 100 | `ASVS_L3_RELEASE_GATE` is recomputed and reported independently; it may remain NO without making T5 PARTIAL when only release-only controls remain open; | PASS | `reports/security/asvs-5.0-l3.json` |

## منابع اصلی

- `reports/security/t5-completion-gate.json`: همهٔ معیارها و تصمیم‌های gate
- `reports/security/asvs-5.0-l3.json`: canonical وضعیت جاری و تاریخ T4
- `docs/security/03-t5-asvs-5.0-level3-assessment-fa.md`: همهٔ ۳۴۵ کنترل
- `docs/verification/02-t5-audit-siem-verification-fa.md`: شاهد و محدودیت Audit/SIEM
- `tests/reports/t5-acceptance.json`: دستور و نتیجهٔ هر suite بدون skip

مجوز customer Level 3 release: NO. آمادگی تأییدشده برای migration ماژول بعدی: NO.

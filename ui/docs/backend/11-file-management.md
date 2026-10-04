# Shared File Management

## Contract and deployment

`packages/file-management` is a logical shared capability composed **in process** in API/Worker. Public operations are initiate/status/uploadPart/complete/download/materialize; Read uses the separate Document Read operation. Public Translator/Summarizer/FAQ temporary extraction also routes through File Management. Storage and filesystem details stay in their owners; business modules and RAG do not bypass this boundary.

## Intake and state machine

Proxy multipart intake durably records an immutable descriptor, distributed reservation and reconciliation/expiry Jobs before remote mutation. States are INITIATED, UPLOADING, UPLOADED, VERIFYING, COMMITTED, FAILED, EXPIRED and UNRESOLVED. Parts bind ordinal/size/SHA-256 before provider dispatch; native multipart listings are observations, and missing provider checksum stays null. Timeouts do not establish failure.

Full actual byte hash and accepted type/signature/archive policy must pass before canonical Asset/Version commit. Uncommitted candidates cannot be used or downloaded. Quarantined/invalid data is not an approved Asset. Transfer descriptors and byte identity cannot be changed on idempotent replay. Worker reconciliation uses fresh subject authorization; ambiguous completion is inspected rather than blindly repeated.

Accepted formats are TXT/Markdown/PDF/DOC/DOCX/ODT with matching media types from shared File Processing. Display filenames are normalized and never select paths. Office archives have expansion/member/path/symlink bounds. Full text intake rejects invalid UTF-8/NUL, including bytes after the signature prefix; Office XML rejects DTD/entities, external relationships, scripts/macros and embedded objects; protected processing rejects stripped/empty extraction. File byte/character/page/time limits come from CJSON. Customer malware/parser sandbox and dependency assurance must be verified for every accepted format.

## Cache, download and quotas

Private cache identity includes deployment/tenant/Asset/Version/hash/representation. It is disposable, bounded by bytes/entries/TTL and verified at hits/fills/ranges. Crash-safe OS locks prevent conflicting fills; staging is private bounded verified scratch, cleaned in finally. Cache provides no authority. Original Download permission is checked before conditional/range/cache handling and again after filling.

Protected downloads use attachment, nosniff, `private, no-store, max-age=0`, Pragma and Vary. A single safe byte range is bounded; invalid/multiple/suffix-zero/overflow ranges are rejected. 304 requires independent Download permission and contributes no downloaded bytes. Actual yielded stream bytes, interruption/completion, reservations and semantic Audit settle together. Destroy before consumption also releases the reservation and records zero bytes exactly once; a bounded idle body deadline closes unused streams.

`fileManagement.limitTiers` optionally supplies `authenticated` and `privileged` actor limits (`maxBytes`, `maxConcurrent`, `maxPendingBytes`, `maxStorageBytes`, `maxAssets`), each bounded by hard upload/tenant limits. Authority selects the tier through the explicit `Knowledge.Files.elevatedLimits` vocabulary (ALL default false); no role/privilege parsing occurs in File Management or UI. Admission owns final distributed capacity checks, and every new reservation records the actor. Historical unknown-owner reservations count conservatively for every actor. Publication rechecks the current size tier after revocation. Missing tiers preserve hard-limit behavior.

Distributed limits cover pending bytes, retained storage bytes/asset count, uploads/downloads/processing concurrency and query/index work. Canonical Usage is immutable and separate from admission or money. Expired upload cleanup requires an explicit registered-machine grant and cannot publish content after Human Session revocation.

## Verification

Focused evidence includes Storage adapter, File Management, transfer persistence, staging/cache/crash/range, runtime, file-security and machine-expiry tests. The T5 static guard rejects direct managed filesystem/S3/provider/Qdrant access in target business/RAG code. Known deployment/security verification gaps are tracked in the Persian T5 security assessment, not silently treated as PASS.

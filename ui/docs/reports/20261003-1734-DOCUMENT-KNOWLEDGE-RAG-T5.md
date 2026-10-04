# Activity Report: DOCUMENT-KNOWLEDGE-RAG-T5

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261003-1734-DOCUMENT-KNOWLEDGE-RAG-T5.md
- Created At: 2026-10-03T14:04:29.304Z
- Status: PARTIAL

## Purpose and Scope

- Execute all 100 integrated T5-final criteria plus the user-authorized root AGENTS protection correction. This report records PARTIAL security completion, not a customer release.
- Only root AGENTS.md was explicitly authorized for protected-source editing. No architecture/prompt/governance/ADR modification was introduced by this task.

## Governing Sources

- AGENTS.md
- docs/architecture/00-manifest.md
- docs/architecture/01-system-architecture.md
- docs/architecture/02-engineering-conventions.md
- docs/architecture/03-persistence-and-database.md
- docs/architecture/04-authorization-model.md
- docs/architecture/05-module-architecture.md
- docs/architecture/06-document-and-rag.md
- docs/architecture/07-ai-router.md
- docs/architecture/08-deployment-architecture.md
- docs/architecture/09-notification-and-ticketing.md
- docs/architecture/10-commercial-architecture.md

## Initial Repository State

- The target T4 Authority/RAG start gate passed with zero start blockers. ASVS release gate remained NO.
- Target documents/storage/jobs packages contained scoped instructions but no implementations.
- The workspace contained substantial uncommitted T4/user changes; the original snapshot is preserved below.

## Pre-existing Workspace Changes

- AGENTS.md
- apps/api/src/composition.ts
- apps/api/src/index.ts
- apps/web/src/hooks.server.ts
- apps/web/src/lib/api/transport.ts
- apps/web/src/lib/auth/client.svelte.ts
- apps/web/src/routes/(public)/login/+page.svelte
- apps/web/src/routes/+layout.server.ts
- apps/web/src/routes/+layout.svelte
- apps/web/src/routes/api/[...path]/+server.ts
- apps/web/tests/public-tools/AuthHarness.svelte
- apps/web/vite.config.ts
- deploy/customer.Dockerfile
- deploy/entrypoint.mjs
- deploy/examples/customer-a/platform.cjson
- deploy/examples/customer-b/platform.cjson
- deploy/examples/customer-c/platform.cjson
- deploy/examples/development/platform.cjson
- docs/architecture/04-authorization-model.md
- docs/architecture/06-document-and-rag.md
- docs/architecture/08-deployment-architecture.md
- docs/backend/04-t4-identity-session-authority.md
- docs/prompts/T5-addendum.md
- docs/prompts/T5.md
- docs/security/01-asvs-5.0-level3-assessment-fa.md
- modules/faq/src/service.ts
- package.json
- packages/audit/src/index.ts
- packages/audit/src/persistence.ts
- packages/audit/src/persistence/security.ts
- packages/authentication/src/index.ts
- packages/authority/src/index.ts
- packages/authority/src/persistence.ts
- packages/configuration/src/index.ts
- packages/file-processing/src/index.ts
- packages/security-telemetry/src/persistence.ts
- packages/security-telemetry/src/worker.ts
- packages/session/src/cookie.ts
- reports/security/asvs-5.0-l3.json
- scripts/customer-release.mjs
- scripts/t4-gate.mjs
- tests/architecture/staticAnalysis.test.ts
- tests/architecture/support/staticAnalysis.ts
- tests/configuration/configuration.test.ts
- tests/target/t4-auth-cookie.test.ts
- tests/target/t4-auth-http.integration.test.ts
- tests/target/t4-auth-service.test.ts
- tests/target/t4-authenticated-public.integration.test.ts
- tests/target/t4-browser.integration.test.mjs
- tests/target/t4-web-auth-proxy.test.ts
- deploy/web-security-headers.mjs
- docs/prompts/T4.3-B.md
- docs/prompts/T4.4-C.md
- docs/prompts/T4.4.md
- docs/prompts/T5-final.md
- docs/reports/20261003-1330-ASVS-T4-APPLICABILITY-EVIDENCE.md
- docs/reports/20261003-1406-T4-SECURITY-IMPLEMENTATION-CLOSURE.md
- docs/reports/20261003-1513-RAG-SECURITY-READINESS-T4.md
- docs/reports/20261003-1621-RAG-SECURITY-GATE-CORRECTION.md
- docs/security/04-t4-asvs-applicability-matrix-fa.md
- docs/security/05-t4-rag-security-readiness-fa.md
- docs/security/06-t5-genai-rag-security-gate.md
- docs/security/07-t4-authority-decision-boundary.md
- packages/authentication/src/password-policy.ts
- packages/authority/src/contracts.ts
- packages/authority/src/persistence.generic.ts
- packages/authority/src/service.ts
- packages/file-processing/src/office-archive.ts
- packages/persistence/src/target-migrations/007-authority-rag-foundation.sql
- packages/security-telemetry/src/csp-report.ts
- reports/security/rag-asvs-classification.json
- reports/security/rag-security-gate.json
- reports/security/t4-target-scope-inventory.json
- reports/security/t5-security-delta-backlog.json
- scripts/classify-rag-asvs.mjs
- scripts/rag-security-gate.mjs
- scripts/rag-security-policy.mjs
- scripts/reassess-t44c-asvs.mjs
- tests/target/t4-csp.test.ts
- tests/target/t4-file-security.test.ts
- tests/target/t4-password-policy.test.ts
- tests/target/t44-authority-live.integration.test.ts
- tests/target/t44-rag-gate-policy.test.mjs
- tests/target/t44-release-policy.test.mjs
- tests/target/t44-static-headers.integration.test.mjs

## Files Added

- apps/api/src/knowledge.ts
- apps/runtime/src/composition.ts
- apps/web/src/lib/api/gateway.server.ts
- apps/web/src/lib/knowledge/Workspace.svelte
- apps/web/src/lib/knowledge/client.ts
- apps/web/src/lib/knowledge/messages.ts
- apps/web/src/routes/(user)/knowledge/+page.server.ts
- apps/web/src/routes/(user)/knowledge/+page.svelte
- docs/backend/06-t5-rag-legacy-inventory.md
- docs/backend/07-t5-rag-data-migration.md
- docs/backend/08-document-core.md
- docs/backend/09-knowledge-rag.md
- docs/backend/10-rag-authorization-flow.md
- docs/backend/11-file-management.md
- docs/backend/12-storage-and-transfer.md
- docs/deployment/03-rag-customer-release.md
- docs/reports/20261003-1734-DOCUMENT-KNOWLEDGE-RAG-T5.md
- docs/security/03-t5-asvs-5.0-level3-assessment-fa.md
- docs/security/03-t5-rag-security-delta-fa.md
- docs/verification/02-t5-audit-siem-verification-fa.md
- packages/admission-control/src/files.ts
- packages/admission-control/src/persistence/files.ts
- packages/admission-control/src/persistence/query.ts
- packages/admission-control/src/query.ts
- packages/ai-router/src/protected.ts
- packages/audit/src/persistence/semantic.ts
- packages/audit/src/semantic.ts
- packages/configuration/src/knowledge.ts
- packages/configuration/src/protected-ai.ts
- packages/contracts/src/execution-subject.ts
- packages/contracts/src/knowledge.ts
- packages/contracts/src/protected-ai.ts
- packages/contracts/src/transaction.ts
- packages/data-governance/package.json
- packages/data-governance/src/index.ts
- packages/documents/package.json
- packages/documents/src/index.ts
- packages/documents/src/persistence.ts
- packages/documents/src/service.ts
- packages/file-management/package.json
- packages/file-management/src/cache.ts
- packages/file-management/src/index.ts
- packages/file-management/src/persistence.ts
- packages/file-management/src/persistence/storage-migration.ts
- packages/file-management/src/private-filesystem.ts
- packages/file-management/src/public-service.ts
- packages/file-management/src/range.ts
- packages/file-management/src/service.ts
- packages/file-management/src/staging.ts
- packages/file-management/src/storage-migration.ts
- packages/file-management/src/temporary.ts
- packages/file-management/src/transfers.ts
- packages/identity/package.json
- packages/identity/src/persistence.ts
- packages/jobs/package.json
- packages/jobs/src/index.ts
- packages/jobs/src/persistence.ts
- packages/jobs/src/worker.ts
- packages/knowledge/package.json
- packages/knowledge/src/adapters/qdrant.ts
- packages/knowledge/src/chunking.ts
- packages/knowledge/src/disclosure.ts
- packages/knowledge/src/index.ts
- packages/knowledge/src/legacy-migration.ts
- packages/knowledge/src/persistence.ts
- packages/knowledge/src/service.ts
- packages/observability/src/process-errors.ts
- packages/persistence/src/target-migrations/009-document-and-durable-jobs.sql
- packages/persistence/src/target-migrations/010-file-transfer-admission-and-evidence.sql
- packages/persistence/src/target-migrations/011-knowledge-vocabulary-and-worker-subjects.sql
- packages/persistence/src/target-migrations/012-knowledge-spaces-and-projections.sql
- packages/persistence/src/target-migrations/013-worker-ai-and-audit-context.sql
- packages/persistence/src/target-migrations/014-ai-execution-subject-evidence.sql
- packages/persistence/src/target-migrations/015-rag-work-consumption.sql
- packages/persistence/src/target-migrations/016-knowledge-requested-index-state.sql
- packages/persistence/src/target-migrations/017-storage-migration-proof.sql
- packages/persistence/src/target-migrations/018-machine-transfer-expiry-vocabulary.sql
- packages/persistence/src/target-migrations/019-explicit-audit-initiator.sql
- packages/persistence/src/target-migrations/020-file-actor-admission.sql
- packages/persistence/src/target-transaction.ts
- packages/session/src/subject.ts
- packages/storage/package.json
- packages/storage/src/adapters/local.ts
- packages/storage/src/adapters/s3.ts
- packages/storage/src/factory.ts
- packages/storage/src/index.ts
- packages/usage/src/files.ts
- packages/usage/src/persistence/files.ts
- packages/usage/src/persistence/rag.ts
- packages/usage/src/rag.ts
- reports/security/t5-asvs-review.json
- reports/security/t5-completion-gate.json
- reports/security/t5-protected-paths-after.json
- reports/security/t5-protected-paths-before.json
- reports/security/t5-supply-chain.json
- scripts/t5-acceptance.mjs
- scripts/t5-audit-siem.mjs
- scripts/t5-completion-gate.mjs
- scripts/t5-legacy-migration-plan.ts
- scripts/t5-live-model-acceptance.ts
- scripts/t5-oci-acceptance.ts
- scripts/t5-protected-paths.mjs
- scripts/t5-security-assessment.mjs
- scripts/t5-supply-chain.mjs
- scripts/t5-target-architecture.ts
- tests/architecture/t5TargetArchitecture.test.ts
- tests/configuration/t5-file-management.test.ts
- tests/reports/auth-http-regression.log
- tests/reports/authority-conformance.log
- tests/reports/authority-live.log
- tests/reports/build-web.log
- tests/reports/oci/acceptance.json
- tests/reports/oci/customer-a-api-build.log
- tests/reports/oci/customer-a-sbom.cdx.json
- tests/reports/oci/customer-a-web-build.log
- tests/reports/oci/customer-a-worker-build.log
- tests/reports/oci/customer-b-api-build.log
- tests/reports/oci/customer-b-sbom.cdx.json
- tests/reports/oci/customer-b-web-build.log
- tests/reports/oci/customer-b-worker-build.log
- tests/reports/oci/customer-c-api-build.log
- tests/reports/oci/customer-c-sbom.cdx.json
- tests/reports/oci/customer-c-web-build.log
- tests/reports/oci/customer-c-worker-build.log
- tests/reports/oci/dependency-vulnerabilities.json
- tests/reports/oci/pre-bundle-fix-customer-a-api-runtime.log
- tests/reports/oci/pre-bundle-fix-customer-a-web-runtime.log
- tests/reports/oci/pre-bundle-fix-customer-a-worker-runtime.log
- tests/reports/oci/runtime-dependency-vulnerabilities.json
- tests/reports/oci/runtime-vulnerabilities.json
- tests/reports/strict-target.log
- tests/reports/strict-web.log
- tests/reports/t5-acceptance.json
- tests/reports/t5-architecture.log
- tests/reports/t5-audit-siem.log
- tests/reports/t5-audit-siem.tap
- tests/reports/t5-browser.log
- tests/reports/t5-foundations.log
- tests/reports/t5-integrations.log
- tests/reports/t5-target-architecture.json
- tests/reports/target-architecture.log
- tests/target/support/t5-browser-session.mjs
- tests/target/support/t5-live-subject.ts
- tests/target/support/t5-provider-fixture.ts
- tests/target/support/t5-qdrant-fixture.ts
- tests/target/support/t5-runtime-fixture.ts
- tests/target/support/t5-s3-fixture.ts
- tests/target/t5-audit-siem.integration.test.ts
- tests/target/t5-browser.integration.test.mjs
- tests/target/t5-chunking.test.ts
- tests/target/t5-document-jobs.integration.test.ts
- tests/target/t5-failure-runtime.integration.test.ts
- tests/target/t5-file-cache.test.ts
- tests/target/t5-file-limits.integration.test.ts
- tests/target/t5-file-management.integration.test.ts
- tests/target/t5-file-staging.test.ts
- tests/target/t5-knowledge-projection.integration.test.ts
- tests/target/t5-legacy-migration.test.ts
- tests/target/t5-machine-expiry.integration.test.ts
- tests/target/t5-process-errors.test.ts
- tests/target/t5-protected-ai.integration.test.ts
- tests/target/t5-rag-security.integration.test.ts
- tests/target/t5-runtime.integration.test.ts
- tests/target/t5-s3-storage.integration.test.ts
- tests/target/t5-storage-contract.test.ts
- tests/target/t5-storage-migration.integration.test.ts
- tests/target/t5-transfer-persistence.integration.test.ts
- tests/target/t5-worker.integration.test.ts

## Files Modified

- AGENTS.md
- apps/api/src/composition.ts
- apps/api/src/index.ts
- apps/web/src/lib/api/client.ts
- apps/web/src/lib/api/transport.ts
- apps/web/src/lib/auth/client.svelte.ts
- apps/web/src/routes/(user)/+layout.svelte
- apps/worker/src/composition.ts
- apps/worker/src/index.ts
- deploy/customer.Dockerfile
- deploy/entrypoint.mjs
- deploy/examples/customer-a/platform.cjson
- deploy/examples/customer-b/platform.cjson
- deploy/examples/customer-c/platform.cjson
- deploy/examples/development/platform.cjson
- deploy/runtime/package-lock.json
- deploy/runtime/package.json
- modules/faq/src/service.ts
- package-lock.json
- package.json
- packages/admission-control/package.json
- packages/admission-control/src/persistence.ts
- packages/ai-router/src/index.ts
- packages/ai-router/src/persistence.ts
- packages/audit/src/index.ts
- packages/audit/src/persistence.ts
- packages/audit/src/persistence/security.ts
- packages/authority/src/index.ts
- packages/authority/src/persistence.generic.ts
- packages/authority/src/service.ts
- packages/configuration/src/index.ts
- packages/contracts/package.json
- packages/contracts/src/index.ts
- packages/file-processing/src/index.ts
- packages/observability/src/index.ts
- packages/persistence/src/target.ts
- packages/security-telemetry/src/persistence.ts
- packages/security-telemetry/src/worker.ts
- packages/session/src/persistence.ts
- packages/usage/package.json
- packages/usage/src/persistence.ts
- reports/security/asvs-5.0-l3.json
- scripts/customer-release.mjs
- scripts/t4-gate.mjs
- scripts/t4-target-architecture.ts
- tests/architecture/staticAnalysis.test.ts
- tests/architecture/support/staticAnalysis.ts
- tests/configuration/configuration.test.ts
- tests/target/runtime.integration.test.ts
- tsconfig.target.json

## Files Deleted

- packages/file-processing/src/service.ts

## Implementation Summary

- Shared in-process composition implements Document/Version/Asset, private Local/S3 Storage, File Management, bounded staging/cache, durable Jobs, File Processing, Knowledge Spaces and protected RAG.
- Canonical PostgreSQL facts, forced scoped RLS, immutable versions/chunks/profiles, database mutation evidence and semantic audit remain authoritative. Qdrant contains rebuildable vectors and opaque references only.
- Authority owns independent discover/read/download/use/quote/manage and privileged file-limit decisions. Fresh subject/authorization checks fence materialization, reranking, LLM execution and publication. Governance gates every protected egress/fallback.
- Persistent intake/idempotency/quota/Usage, native multipart UNKNOWN reconciliation, cache crash recovery, storage migration proof and deterministic legacy migration tooling are implemented. Registered machine expiry records its original initiator without inheriting revoked human authority.
- Shared Worker leases/heartbeat/cancellation fence publication; last-attempt crashed claims settle terminal metadata. Metadata-only operational logging and fatal error drain/exit handlers are implemented.
- Authenticated RTL UI uploads/resumes, shows status, asks via validated SSE and displays backend citations/read views as escaped text. State is cleared on identity changes; no protected tokens/content are persisted in browser storage.
- All three brands and all nine API/Worker/Web OCI images are tested locally. Patched base/runtime upload dependencies, immutable image IDs, real SBOMs and offline local vulnerability scans are recorded.
- Full Persian 345-control ASVS assessment, all 100 acceptance criteria and Audit/SIEM verification are generated from canonical results. Gates remain separate and fail closed.

## Architecture Decisions / Deviations

- File Management remains IN_PROCESS. Canonical managed-file access is confined to its owner/Storage adapters; public-tool temporary extraction now uses its shared owner.
- Existing opaque transaction contracts carry one persistence transaction, with closed-handle fencing. New migrations 009–020 are additive; applied historical migrations were not rewritten.
- Original protected-path hashes are retained; additional scoped AGENTS were checked against HEAD because the initial baseline did not enumerate them. No protected change is hidden by pre-existing workspace edits.
- The formal legacy inventory document was written after foundation implementation had begun, contrary to the requested inventory-first order. This is a workflow deviation; no actual legacy customer migration was performed before verified mapping.
- Protocol-compatible providers and isolated synthetic scopes prove transport/policy/integration behavior, not actual vLLM semantic security, artifact provenance or customer production deployment.
- SSE buffers generation until complete output/quote/final authorization validation, then emits authorized text deltas/citations/DONE. Raw provider tokens are not exposed before validation.
- No mandatory-rule exception was approved. Open sandbox/antivirus/retention/internal-identity and infrastructure requirements are recorded as FAIL or NOT_VERIFIED, not waived or moved to release-only.

## Tests and Verification

- PASS exit 0: npm run check:target; 0 passed, 0 failed, 0 skipped; tests/reports/strict-target.log
- PASS exit 0: npm run check:web; 0 passed, 0 failed, 0 skipped; tests/reports/strict-web.log
- PASS exit 0: npm run test:architecture:target; 2 passed, 0 failed, 0 skipped; tests/reports/target-architecture.log
- PASS exit 0: node --import tsx scripts/t5-target-architecture.ts; 0 passed, 0 failed, 0 skipped; tests/reports/t5-architecture.log
- PASS exit 0: node --import tsx --test --test-concurrency=1 tests/architecture/staticAnalysis.test.ts tests/architecture/t5TargetArchitecture.test.ts tests/configuration/t5-file-management.test.ts tests/target/t5-chunking.test.ts tests/target/t5-storage-contract.test.ts tests/target/t5-file-cache.test.ts tests/target/t5-file-staging.test.ts tests/target/t4-file-security.test.ts tests/target/t5-process-errors.test.ts; 33 passed, 0 failed, 0 skipped; tests/reports/t5-foundations.log
- PASS exit 0: node --import tsx --test --test-concurrency=1 tests/target/t5-document-jobs.integration.test.ts tests/target/t5-transfer-persistence.integration.test.ts tests/target/t5-file-management.integration.test.ts tests/target/t5-s3-storage.integration.test.ts tests/target/t5-knowledge-projection.integration.test.ts tests/target/t5-protected-ai.integration.test.ts tests/target/t5-rag-security.integration.test.ts tests/target/t5-runtime.integration.test.ts tests/target/t5-failure-runtime.integration.test.ts tests/target/t5-worker.integration.test.ts tests/target/t5-machine-expiry.integration.test.ts tests/target/t5-file-limits.integration.test.ts tests/target/t5-legacy-migration.test.ts tests/target/t5-storage-migration.integration.test.ts; 84 passed, 0 failed, 0 skipped; tests/reports/t5-integrations.log
- PASS exit 0: npm run test:conformance:authority; 39 passed, 0 failed, 0 skipped; tests/reports/authority-conformance.log
- PASS exit 0: node --import tsx --test tests/target/t44-authority-live.integration.test.ts; 7 passed, 0 failed, 0 skipped; tests/reports/authority-live.log
- PASS exit 0: node --import tsx --test tests/target/t4-auth-http.integration.test.ts; 1 passed, 0 failed, 0 skipped; tests/reports/auth-http-regression.log
- PASS exit 0: npm run build:web; 0 passed, 0 failed, 0 skipped; tests/reports/build-web.log
- PASS exit 0: node --import tsx --test tests/target/t5-browser.integration.test.mjs; 1 passed, 0 failed, 0 skipped; tests/reports/t5-browser.log
- PASS exit 0: node scripts/t5-audit-siem.mjs; 0 passed, 0 failed, 0 skipped; tests/reports/t5-audit-siem.log
- PASS exit 0: SIEM canonical TAP has 7 passed, 0 failed, 0 skipped (its wrapper prints no Node TAP count); integrated total is 174 passed. Strict Web check: 0 errors and 0 warnings.
- PASS exit 0: security:rag-gate, all 16 checks; RAG_SECURITY_GATE YES, blocksT5Start 0, verifyDuringT5 102.
- PASS exit 0: test:t5:oci, all nine patched customer images; source hash a05545c4d316b7b6ab901202417b09cbe196e163e4cd3b1fcaeced05bf4d82cf; tests/reports/oci/acceptance.json.
- PASS exit 0: security:t5:protected, 67 files checked, unauthorizedCount 0; reports/security/t5-protected-paths-after.json.
- FAIL exit 1, expected: test:security:asvs:l3; 110 applicable requirements remain open; ASVS_L3_RELEASE_GATE NO.
- FAIL exit 1, expected: test:t5:live-models without approved config, ACTUAL_APPROVED_MODEL_CONFIG_REQUIRED; no inference dispatched and no false PASS artifact written.
- FAIL exit 1, expected: node scripts/t5-supply-chain.mjs; real vulnerability scan completed and open findings remain. Summary: reports/security/t5-supply-chain.json.
- FAIL exit 1, expected: security:t5:completion; 96/100 criteria PASS, security/model criteria 32, 50, 89 and 90 FAIL.
- PostgreSQL additive migrations 009–020 applied and actual acceptance exercised Local, S3-compatible, Qdrant, HTTP API/Worker, built browser, TLS SIEM and crash/recovery paths.

## Expected Failures

- Independent customer ASVS gate remains NO; T5 completion and GenAI gate remain FAIL. No release bypass or approval is fabricated.
- Real-model acceptance rejects missing approved configuration; protocol fixtures do not replace real model evidence.
- Local supply-chain scan reports open advisories, including unfixed OS/parser findings and legacy/development root-lock findings. Counts and exact component/version/advisory scope are retained in the scan artifacts.

## Unexpected Failures

- Fixed stream flags/exhaustiveness, cache fill event-loop lifetime, SQL analyzer CTE/ROW handling, transaction fixture cleanup, missing browser tsx loader and child-process NODE_TEST_CONTEXT leakage.
- Fixed a storage outage returning generic 500 to the owner-mapped 503; added actual cold-cache outage and abandoned-download settlement acceptance.
- Fixed first-party OCI imports incorrectly externalized by esbuild and the managed Docker credentials.d readonly-mount placeholder; all final roles boot and drain normally.
- Updated legacy runtime SIEM regression to assert the exact extended source/initiator envelope and anonymous initiator values; assertions remain strict and public metadata only.
- One start-gate run under concurrent build/test load produced ECONNRESET; after the full acceptance completed, all start controls passed. No assertion was weakened.
- Actual scan findings are unresolved security defects. Patched Node/available OS updates/Multer/Express chain and removed unused toolchains; remaining findings are not relabeled as PASS.

## Production Code Changes

- New code is listed above. Files with pre-existing changes are listed under both sections only when this task also changed them; those listings claim only the T5 delta. Unrelated historical architecture/prompt edits and deletions are preserved.
- No commit, external deployment, image publication or customer production migration/cutover was performed.

## Final Repository State

- T5 PARTIAL; T5_START_GATE PASS; RAG_SECURITY_GATE YES.
- T5_COMPLETION_SECURITY_GATE FAIL; GENAI_RAG_SECURITY_GATE FAIL; ASVS_L3_RELEASE_GATE NO.
- Current ASVS: {'total': 345, 'PASS': 134, 'FAIL': 19, 'NOT_VERIFIED': 91, 'NOT_APPLICABLE': 101}; T5 blocking 41; release-only blocking 69; approved exceptions 0.
- Unauthorized protected changes 0; target architecture violations 0. Readiness for next business module NO; customer Level-3 release authorized NO.
- All 11 requested implementation/security/verification documents exist. Actual approved models, real customer owner mapping and production storage cutover remain unverified.
- OCI evidence scope is LOCAL_ACCEPTANCE_CONFIG_AND_PROTOCOL_MODELS. Vulnerability summary is FAIL; each raw scan is bound to the final tested image/source hash.

```text
 M ui/AGENTS.md
 M ui/apps/api/src/composition.ts
 M ui/apps/api/src/index.ts
 M ui/apps/web/src/hooks.server.ts
 M ui/apps/web/src/lib/api/client.ts
 M ui/apps/web/src/lib/api/transport.ts
 M ui/apps/web/src/lib/auth/client.svelte.ts
 M ui/apps/web/src/routes/(public)/login/+page.svelte
 M ui/apps/web/src/routes/(user)/+layout.svelte
 M ui/apps/web/src/routes/+layout.server.ts
 M ui/apps/web/src/routes/+layout.svelte
 M ui/apps/web/src/routes/api/[...path]/+server.ts
 M ui/apps/web/tests/public-tools/AuthHarness.svelte
 M ui/apps/web/vite.config.ts
 M ui/apps/worker/src/composition.ts
 M ui/apps/worker/src/index.ts
 M ui/deploy/customer.Dockerfile
 M ui/deploy/entrypoint.mjs
 M ui/deploy/examples/customer-a/platform.cjson
 M ui/deploy/examples/customer-b/platform.cjson
 M ui/deploy/examples/customer-c/platform.cjson
 M ui/deploy/examples/development/platform.cjson
 M ui/deploy/runtime/package-lock.json
 M ui/deploy/runtime/package.json
 M ui/docs/architecture/04-authorization-model.md
 M ui/docs/architecture/06-document-and-rag.md
 M ui/docs/architecture/08-deployment-architecture.md
 M ui/docs/backend/04-t4-identity-session-authority.md
 D ui/docs/prompts/T5-addendum.md
 D ui/docs/prompts/T5.md
 M ui/docs/security/01-asvs-5.0-level3-assessment-fa.md
 M ui/modules/faq/src/service.ts
 M ui/package-lock.json
 M ui/package.json
 M ui/packages/admission-control/package.json
 M ui/packages/admission-control/src/persistence.ts
 M ui/packages/ai-router/src/index.ts
 M ui/packages/ai-router/src/persistence.ts
 M ui/packages/audit/src/index.ts
 M ui/packages/audit/src/persistence.ts
 M ui/packages/audit/src/persistence/security.ts
 M ui/packages/authentication/src/index.ts
 M ui/packages/authority/src/index.ts
 M ui/packages/authority/src/persistence.ts
 M ui/packages/configuration/src/index.ts
 M ui/packages/contracts/package.json
 M ui/packages/contracts/src/index.ts
 M ui/packages/file-processing/src/index.ts
 D ui/packages/file-processing/src/service.ts
 M ui/packages/observability/src/index.ts
 M ui/packages/persistence/src/target.ts
 M ui/packages/security-telemetry/src/persistence.ts
 M ui/packages/security-telemetry/src/worker.ts
 M ui/packages/session/src/cookie.ts
 M ui/packages/session/src/persistence.ts
 M ui/packages/usage/package.json
 M ui/packages/usage/src/persistence.ts
 M ui/reports/security/asvs-5.0-l3.json
 M ui/scripts/customer-release.mjs
 M ui/scripts/t4-gate.mjs
 M ui/scripts/t4-target-architecture.ts
 M ui/tests/architecture/staticAnalysis.test.ts
 M ui/tests/architecture/support/staticAnalysis.ts
 M ui/tests/configuration/configuration.test.ts
 M ui/tests/target/runtime.integration.test.ts
 M ui/tests/target/t4-auth-cookie.test.ts
 M ui/tests/target/t4-auth-http.integration.test.ts
 M ui/tests/target/t4-auth-service.test.ts
 M ui/tests/target/t4-authenticated-public.integration.test.ts
 M ui/tests/target/t4-browser.integration.test.mjs
 M ui/tests/target/t4-web-auth-proxy.test.ts
 M ui/tsconfig.target.json
?? ui/apps/api/src/knowledge.ts
?? ui/apps/runtime/src/composition.ts
?? ui/apps/web/src/lib/api/gateway.server.ts
?? ui/apps/web/src/lib/knowledge/Workspace.svelte
?? ui/apps/web/src/lib/knowledge/client.ts
?? ui/apps/web/src/lib/knowledge/messages.ts
?? ui/apps/web/src/routes/(user)/knowledge/+page.server.ts
?? ui/apps/web/src/routes/(user)/knowledge/+page.svelte
?? ui/deploy/web-security-headers.mjs
?? ui/docs/backend/06-t5-rag-legacy-inventory.md
?? ui/docs/backend/07-t5-rag-data-migration.md
?? ui/docs/backend/08-document-core.md
?? ui/docs/backend/09-knowledge-rag.md
?? ui/docs/backend/10-rag-authorization-flow.md
?? ui/docs/backend/11-file-management.md
?? ui/docs/backend/12-storage-and-transfer.md
?? ui/docs/deployment/03-rag-customer-release.md
?? ui/docs/prompts/T4.3-B.md
?? ui/docs/prompts/T4.4-C.md
?? ui/docs/prompts/T4.4.md
?? ui/docs/prompts/T5-final.md
?? ui/docs/reports/20261003-1330-ASVS-T4-APPLICABILITY-EVIDENCE.md
?? ui/docs/reports/20261003-1406-T4-SECURITY-IMPLEMENTATION-CLOSURE.md
?? ui/docs/reports/20261003-1513-RAG-SECURITY-READINESS-T4.md
?? ui/docs/reports/20261003-1621-RAG-SECURITY-GATE-CORRECTION.md
?? ui/docs/reports/20261003-1734-DOCUMENT-KNOWLEDGE-RAG-T5.md
?? ui/docs/security/03-t5-asvs-5.0-level3-assessment-fa.md
?? ui/docs/security/03-t5-rag-security-delta-fa.md
?? ui/docs/security/04-t4-asvs-applicability-matrix-fa.md
?? ui/docs/security/05-t4-rag-security-readiness-fa.md
?? ui/docs/security/06-t5-genai-rag-security-gate.md
?? ui/docs/security/07-t4-authority-decision-boundary.md
?? ui/docs/verification/02-t5-audit-siem-verification-fa.md
?? ui/packages/admission-control/src/files.ts
?? ui/packages/admission-control/src/persistence/files.ts
?? ui/packages/admission-control/src/persistence/query.ts
?? ui/packages/admission-control/src/query.ts
?? ui/packages/ai-router/src/protected.ts
?? ui/packages/audit/src/persistence/semantic.ts
?? ui/packages/audit/src/semantic.ts
?? ui/packages/authentication/src/password-policy.ts
?? ui/packages/authority/src/contracts.ts
?? ui/packages/authority/src/persistence.generic.ts
?? ui/packages/authority/src/service.ts
?? ui/packages/configuration/src/knowledge.ts
?? ui/packages/configuration/src/protected-ai.ts
?? ui/packages/contracts/src/execution-subject.ts
?? ui/packages/contracts/src/knowledge.ts
?? ui/packages/contracts/src/protected-ai.ts
?? ui/packages/contracts/src/transaction.ts
?? ui/packages/data-governance/package.json
?? ui/packages/data-governance/src/index.ts
?? ui/packages/documents/package.json
?? ui/packages/documents/src/index.ts
?? ui/packages/documents/src/persistence.ts
?? ui/packages/documents/src/service.ts
?? ui/packages/file-management/package.json
?? ui/packages/file-management/src/cache.ts
?? ui/packages/file-management/src/index.ts
?? ui/packages/file-management/src/persistence.ts
?? ui/packages/file-management/src/persistence/storage-migration.ts
?? ui/packages/file-management/src/private-filesystem.ts
?? ui/packages/file-management/src/public-service.ts
?? ui/packages/file-management/src/range.ts
?? ui/packages/file-management/src/service.ts
?? ui/packages/file-management/src/staging.ts
?? ui/packages/file-management/src/storage-migration.ts
?? ui/packages/file-management/src/temporary.ts
?? ui/packages/file-management/src/transfers.ts
?? ui/packages/file-processing/src/office-archive.ts
?? ui/packages/identity/package.json
?? ui/packages/identity/src/persistence.ts
?? ui/packages/jobs/package.json
?? ui/packages/jobs/src/index.ts
?? ui/packages/jobs/src/persistence.ts
?? ui/packages/jobs/src/worker.ts
?? ui/packages/knowledge/package.json
?? ui/packages/knowledge/src/adapters/qdrant.ts
?? ui/packages/knowledge/src/chunking.ts
?? ui/packages/knowledge/src/disclosure.ts
?? ui/packages/knowledge/src/index.ts
?? ui/packages/knowledge/src/legacy-migration.ts
?? ui/packages/knowledge/src/persistence.ts
?? ui/packages/knowledge/src/service.ts
?? ui/packages/observability/src/process-errors.ts
?? ui/packages/persistence/src/target-migrations/007-authority-rag-foundation.sql
?? ui/packages/persistence/src/target-migrations/009-document-and-durable-jobs.sql
?? ui/packages/persistence/src/target-migrations/010-file-transfer-admission-and-evidence.sql
?? ui/packages/persistence/src/target-migrations/011-knowledge-vocabulary-and-worker-subjects.sql
?? ui/packages/persistence/src/target-migrations/012-knowledge-spaces-and-projections.sql
?? ui/packages/persistence/src/target-migrations/013-worker-ai-and-audit-context.sql
?? ui/packages/persistence/src/target-migrations/014-ai-execution-subject-evidence.sql
?? ui/packages/persistence/src/target-migrations/015-rag-work-consumption.sql
?? ui/packages/persistence/src/target-migrations/016-knowledge-requested-index-state.sql
?? ui/packages/persistence/src/target-migrations/017-storage-migration-proof.sql
?? ui/packages/persistence/src/target-migrations/018-machine-transfer-expiry-vocabulary.sql
?? ui/packages/persistence/src/target-migrations/019-explicit-audit-initiator.sql
?? ui/packages/persistence/src/target-migrations/020-file-actor-admission.sql
?? ui/packages/persistence/src/target-transaction.ts
?? ui/packages/security-telemetry/src/csp-report.ts
?? ui/packages/session/src/subject.ts
?? ui/packages/storage/package.json
?? ui/packages/storage/src/adapters/local.ts
?? ui/packages/storage/src/adapters/s3.ts
?? ui/packages/storage/src/factory.ts
?? ui/packages/storage/src/index.ts
?? ui/packages/usage/src/files.ts
?? ui/packages/usage/src/persistence/files.ts
?? ui/packages/usage/src/persistence/rag.ts
?? ui/packages/usage/src/rag.ts
?? ui/reports/security/rag-asvs-classification.json
?? ui/reports/security/rag-security-gate.json
?? ui/reports/security/t4-target-scope-inventory.json
?? ui/reports/security/t5-asvs-review.json
?? ui/reports/security/t5-completion-gate.json
?? ui/reports/security/t5-protected-paths-after.json
?? ui/reports/security/t5-protected-paths-before.json
?? ui/reports/security/t5-security-delta-backlog.json
?? ui/reports/security/t5-supply-chain.json
?? ui/scripts/classify-rag-asvs.mjs
?? ui/scripts/rag-security-gate.mjs
?? ui/scripts/rag-security-policy.mjs
?? ui/scripts/reassess-t44c-asvs.mjs
?? ui/scripts/t5-acceptance.mjs
?? ui/scripts/t5-audit-siem.mjs
?? ui/scripts/t5-completion-gate.mjs
?? ui/scripts/t5-legacy-migration-plan.ts
?? ui/scripts/t5-live-model-acceptance.ts
?? ui/scripts/t5-oci-acceptance.ts
?? ui/scripts/t5-protected-paths.mjs
?? ui/scripts/t5-security-assessment.mjs
?? ui/scripts/t5-supply-chain.mjs
?? ui/scripts/t5-target-architecture.ts
?? ui/tests/architecture/t5TargetArchitecture.test.ts
?? ui/tests/configuration/t5-file-management.test.ts
?? ui/tests/reports/auth-http-regression.log
?? ui/tests/reports/authority-conformance.log
?? ui/tests/reports/authority-live.log
?? ui/tests/reports/build-web.log
?? ui/tests/reports/oci/acceptance.json
?? ui/tests/reports/oci/customer-a-api-build.log
?? ui/tests/reports/oci/customer-a-sbom.cdx.json
?? ui/tests/reports/oci/customer-a-web-build.log
?? ui/tests/reports/oci/customer-a-worker-build.log
?? ui/tests/reports/oci/customer-b-api-build.log
?? ui/tests/reports/oci/customer-b-sbom.cdx.json
?? ui/tests/reports/oci/customer-b-web-build.log
?? ui/tests/reports/oci/customer-b-worker-build.log
?? ui/tests/reports/oci/customer-c-api-build.log
?? ui/tests/reports/oci/customer-c-sbom.cdx.json
?? ui/tests/reports/oci/customer-c-web-build.log
?? ui/tests/reports/oci/customer-c-worker-build.log
?? ui/tests/reports/oci/dependency-vulnerabilities.json
?? ui/tests/reports/oci/pre-bundle-fix-customer-a-api-runtime.log
?? ui/tests/reports/oci/pre-bundle-fix-customer-a-web-runtime.log
?? ui/tests/reports/oci/pre-bundle-fix-customer-a-worker-runtime.log
?? ui/tests/reports/oci/runtime-dependency-vulnerabilities.json
?? ui/tests/reports/oci/runtime-vulnerabilities.json
?? ui/tests/reports/strict-target.log
?? ui/tests/reports/strict-web.log
?? ui/tests/reports/t5-acceptance.json
?? ui/tests/reports/t5-architecture.log
?? ui/tests/reports/t5-audit-siem.log
?? ui/tests/reports/t5-audit-siem.tap
?? ui/tests/reports/t5-browser.log
?? ui/tests/reports/t5-foundations.log
?? ui/tests/reports/t5-integrations.log
?? ui/tests/reports/t5-target-architecture.json
?? ui/tests/reports/target-architecture.log
?? ui/tests/target/support/t5-browser-session.mjs
?? ui/tests/target/support/t5-live-subject.ts
?? ui/tests/target/support/t5-provider-fixture.ts
?? ui/tests/target/support/t5-qdrant-fixture.ts
?? ui/tests/target/support/t5-runtime-fixture.ts
?? ui/tests/target/support/t5-s3-fixture.ts
?? ui/tests/target/t4-csp.test.ts
?? ui/tests/target/t4-file-security.test.ts
?? ui/tests/target/t4-password-policy.test.ts
?? ui/tests/target/t44-authority-live.integration.test.ts
?? ui/tests/target/t44-rag-gate-policy.test.mjs
?? ui/tests/target/t44-release-policy.test.mjs
?? ui/tests/target/t44-static-headers.integration.test.mjs
?? ui/tests/target/t5-audit-siem.integration.test.ts
?? ui/tests/target/t5-browser.integration.test.mjs
?? ui/tests/target/t5-chunking.test.ts
?? ui/tests/target/t5-document-jobs.integration.test.ts
?? ui/tests/target/t5-failure-runtime.integration.test.ts
?? ui/tests/target/t5-file-cache.test.ts
?? ui/tests/target/t5-file-limits.integration.test.ts
?? ui/tests/target/t5-file-management.integration.test.ts
?? ui/tests/target/t5-file-staging.test.ts
?? ui/tests/target/t5-knowledge-projection.integration.test.ts
?? ui/tests/target/t5-legacy-migration.test.ts
?? ui/tests/target/t5-machine-expiry.integration.test.ts
?? ui/tests/target/t5-process-errors.test.ts
?? ui/tests/target/t5-protected-ai.integration.test.ts
?? ui/tests/target/t5-rag-security.integration.test.ts
?? ui/tests/target/t5-runtime.integration.test.ts
?? ui/tests/target/t5-s3-storage.integration.test.ts
?? ui/tests/target/t5-storage-contract.test.ts
?? ui/tests/target/t5-storage-migration.integration.test.ts
?? ui/tests/target/t5-transfer-persistence.integration.test.ts
?? ui/tests/target/t5-worker.integration.test.ts
```

## Acceptance Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| 1 | PASS | legacy RAG inventory complete;; `docs/backend/06-t5-rag-legacy-inventory.md`, `docs/backend/07-t5-rag-data-migration.md`, `tests/target/t5-legacy-migration.test.ts` |
| 2 | PASS | canonical data migration mapped;; `docs/backend/06-t5-rag-legacy-inventory.md`, `docs/backend/07-t5-rag-data-migration.md`, `tests/target/t5-legacy-migration.test.ts` |
| 3 | PASS | Document Core implemented;; `tests/reports/t5-acceptance.json` |
| 4 | PASS | Version implemented;; `tests/reports/t5-acceptance.json` |
| 5 | PASS | Asset implemented;; `tests/reports/t5-acceptance.json` |
| 6 | PASS | Storage abstraction implemented;; `tests/reports/t5-acceptance.json` |
| 7 | PASS | File Processing integrated;; `tests/reports/t5-acceptance.json` |
| 8 | PASS | Knowledge Space implemented;; `tests/reports/t5-acceptance.json` |
| 9 | PASS | Qdrant is derived only;; `tests/reports/t5-acceptance.json` |
| 10 | PASS | Qdrant is rebuildable;; `tests/reports/t5-acceptance.json` |
| 11 | PASS | index generation/versioning implemented;; `tests/reports/t5-acceptance.json` |
| 12 | PASS | ingestion jobs durable;; `tests/reports/t5-acceptance.json` |
| 13 | PASS | ingestion idempotent;; `tests/reports/t5-acceptance.json` |
| 14 | PASS | Authority precedes retrieval;; `tests/reports/t5-acceptance.json` |
| 15 | PASS | final candidate authorization implemented;; `tests/reports/t5-acceptance.json` |
| 16 | PASS | unauthorized chunks never reach reranker;; `tests/reports/t5-acceptance.json` |
| 17 | PASS | unauthorized chunks never reach LLM;; `tests/reports/t5-acceptance.json` |
| 18 | PASS | discover/read/download/use/quote/manage are independent;; `tests/reports/t5-acceptance.json` |
| 19 | PASS | citation authorization correct;; `tests/reports/t5-acceptance.json` |
| 20 | PASS | quote authorization correct;; `tests/reports/t5-acceptance.json` |
| 21 | PASS | classification enforced;; `tests/reports/t5-acceptance.json` |
| 22 | PASS | tenant isolation enforced;; `tests/reports/t5-acceptance.json` |
| 23 | PASS | ACL deny semantics correct;; `tests/reports/t5-acceptance.json` |
| 24 | PASS | ALL cannot bypass hard boundaries;; `tests/reports/t5-acceptance.json` |
| 25 | PASS | Data Governance egress implemented;; `tests/reports/t5-acceptance.json` |
| 26 | PASS | protected external egress denied correctly;; `tests/reports/t5-acceptance.json` |
| 27 | PASS | embedding uses AI Router;; `tests/reports/t5-acceptance.json` |
| 28 | PASS | reranking uses approved Router boundary;; `tests/reports/t5-acceptance.json` |
| 29 | PASS | RAG answer uses AI Router;; `tests/reports/t5-acceptance.json` |
| 30 | PASS | no business code chooses model/provider;; `tests/reports/t5-acceptance.json` |
| 31 | PASS | context budgeting has no silent truncation;; `tests/reports/t5-acceptance.json` |
| 32 | FAIL | prompt-injection tests pass;; `reports/security/t5-completion-gate.json` |
| 33 | PASS | RAG Usage works;; `tests/reports/t5-acceptance.json` |
| 34 | PASS | RAG Admission works;; `tests/reports/t5-acceptance.json` |
| 35 | PASS | semantic Audit works;; `tests/reports/t5-acceptance.json` |
| 36 | PASS | DB mutation Audit works;; `tests/reports/t5-acceptance.json` |
| 37 | PASS | SIEM selection/redaction works;; `tests/reports/t5-acceptance.json` |
| 38 | PASS | authenticated RAG UI works;; `tests/reports/t5-acceptance.json` |
| 39 | PASS | processing status UI works;; `tests/reports/t5-acceptance.json` |
| 40 | PASS | citations work;; `tests/reports/t5-acceptance.json` |
| 41 | PASS | legacy users map safely;; `docs/backend/06-t5-rag-legacy-inventory.md`, `docs/backend/07-t5-rag-data-migration.md`, `tests/target/t5-legacy-migration.test.ts` |
| 42 | PASS | ambiguous owners fail migration;; `docs/backend/06-t5-rag-legacy-inventory.md`, `docs/backend/07-t5-rag-data-migration.md`, `tests/target/t5-legacy-migration.test.ts` |
| 43 | PASS | legacy Qdrant not treated as canonical;; `docs/backend/06-t5-rag-legacy-inventory.md`, `docs/backend/07-t5-rag-data-migration.md`, `tests/target/t5-legacy-migration.test.ts` |
| 44 | PASS | fresh Qdrant rebuild test passes;; `tests/reports/t5-acceptance.json` |
| 45 | PASS | document-version test passes;; `tests/reports/t5-acceptance.json` |
| 46 | PASS | embedding-policy change/reindex test passes;; `tests/reports/t5-acceptance.json` |
| 47 | PASS | MySQL-off RAG passes;; `tests/reports/t5-acceptance.json` |
| 48 | PASS | legacy auth-off target RAG passes;; `tests/reports/t5-acceptance.json` |
| 49 | PASS | target architecture guardrails pass;; `tests/reports/t5-acceptance.json` |
| 50 | FAIL | Level 3 RAG security delta has no blocking failure.; `reports/security/t5-asvs-review.json` |
| 51 | PASS | shared File Management capability exists;; `tests/reports/t5-acceptance.json` |
| 52 | PASS | File Management is logical/in-process by default, not an unnecessary microservice;; `tests/reports/t5-acceptance.json` |
| 53 | PASS | all target managed file operations use File Management;; `tests/reports/t5-acceptance.json` |
| 54 | PASS | direct business-module filesystem access for managed persistent assets is zero;; `tests/reports/t5-acceptance.json` |
| 55 | PASS | direct business-module S3 access is zero;; `tests/reports/t5-acceptance.json` |
| 56 | PASS | Local Storage adapter works;; `tests/reports/t5-acceptance.json` |
| 57 | PASS | S3-compatible Storage adapter works;; `tests/reports/t5-acceptance.json` |
| 58 | PASS | adapter choice is CJSON-driven;; `tests/reports/t5-acceptance.json` |
| 59 | PASS | storage credentials/secrets remain external through secretRef;; `tests/reports/t5-acceptance.json` |
| 60 | PASS | Document Version is distinct from backend object version;; `tests/reports/t5-acceptance.json` |
| 61 | PASS | committed Asset bytes are immutable by identity;; `tests/reports/t5-acceptance.json` |
| 62 | PASS | content-hash verification works;; `tests/reports/t5-acceptance.json` |
| 63 | PASS | upload staging lifecycle exists;; `tests/reports/t5-acceptance.json` |
| 64 | PASS | incomplete uploads are not exposed as committed/usable Assets;; `tests/reports/t5-acceptance.json` |
| 65 | PASS | resumable/multipart semantics work as required;; `tests/reports/t5-acceptance.json` |
| 66 | PASS | upload cache/staging is bounded and non-canonical;; `tests/reports/t5-acceptance.json` |
| 67 | PASS | download cache is version-aware;; `tests/reports/t5-acceptance.json` |
| 68 | PASS | cache never bypasses Authority;; `tests/reports/t5-acceptance.json` |
| 69 | PASS | cache is disposable/rebuildable;; `tests/reports/t5-acceptance.json` |
| 70 | PASS | cache eviction is bounded;; `tests/reports/t5-acceptance.json` |
| 71 | PASS | stale cache cannot expose superseded/revoked/forbidden content;; `tests/reports/t5-acceptance.json` |
| 72 | PASS | Range support is safe;; `tests/reports/t5-acceptance.json` |
| 73 | PASS | conditional download works where configured;; `tests/reports/t5-acceptance.json` |
| 74 | PASS | protected content uses safe cache headers;; `tests/reports/t5-acceptance.json` |
| 75 | PASS | download is independently authorized;; `tests/reports/t5-acceptance.json` |
| 76 | PASS | read does not imply download;; `tests/reports/t5-acceptance.json` |
| 77 | PASS | use does not imply discover/download;; `tests/reports/t5-acceptance.json` |
| 78 | PASS | RAG cannot bypass File Management to read Storage;; `tests/reports/t5-acceptance.json` |
| 79 | PASS | path traversal/archive/symlink tests pass;; `tests/reports/t5-acceptance.json` |
| 80 | PASS | MIME/signature/type-consistency tests pass;; `tests/reports/t5-acceptance.json` |
| 81 | PASS | file size/resource-exhaustion tests pass;; `tests/reports/t5-acceptance.json` |
| 82 | PASS | S3 ambiguous-outcome/reconciliation semantics are safe;; `tests/reports/t5-acceptance.json` |
| 83 | PASS | File semantic Audit works;; `tests/reports/t5-acceptance.json` |
| 84 | PASS | File Usage Accounting works;; `tests/reports/t5-acceptance.json` |
| 85 | PASS | file security events can reach SIEM;; `tests/reports/t5-acceptance.json` |
| 86 | PASS | static File Management architecture guards are green;; `tests/reports/t5-acceptance.json` |
| 87 | PASS | post-T5 complete Persian current-state ASVS assessment exists;; `docs/security/03-t5-asvs-5.0-level3-assessment-fa.md`, `reports/security/t5-asvs-review.json` |
| 88 | PASS | all `verifyDuringT5` controls are re-evaluated with concrete evidence;; `docs/security/03-t5-asvs-5.0-level3-assessment-fa.md`, `reports/security/t5-asvs-review.json` |
| 89 | FAIL | T5-introduced/T5-scope blocking security findings = 0 or approved documented exceptions;; `reports/security/t5-asvs-review.json` |
| 90 | FAIL | GenAI/RAG security gate passes;; `reports/security/t5-completion-gate.json` |
| 91 | PASS | Audit end-to-end verification passes;; `tests/reports/t5-audit-siem.tap` |
| 92 | PASS | Audit immutability passes;; `tests/reports/t5-audit-siem.tap` |
| 93 | PASS | Audit sensitive-data leakage scan passes;; `tests/reports/t5-audit-siem.tap` |
| 94 | PASS | SIEM real T5 event delivery passes;; `tests/reports/t5-audit-siem.tap` |
| 95 | PASS | SIEM UNKNOWN/retry semantics pass;; `tests/reports/t5-audit-siem.tap` |
| 96 | PASS | SIEM restart/recovery passes;; `tests/reports/t5-audit-siem.tap` |
| 97 | PASS | SIEM outage does not corrupt/block ordinary RAG when policy says optional/degraded;; `tests/reports/t5-audit-siem.tap` |
| 98 | PASS | SIEM redaction passes;; `tests/reports/t5-audit-siem.tap` |
| 99 | PASS | T5 introduced zero unauthorized modifications to protected governing documents;; `reports/security/t5-protected-paths-after.json` |
| 100 | PASS | `ASVS_L3_RELEASE_GATE` is recomputed and reported independently; it may remain NO without making T5 PARTIAL when only release-only controls remain open;; `reports/security/asvs-5.0-l3.json` |

## Open Issues

- Supply the approved actual embedding/reranker/vLLM CJSON, artifact revisions and external secret refs plus matching Data Governance policy to run actual synthetic runtime and browser acceptance. No approval for protected architecture edits is requested implicitly.
- Supply actual original legacy files and approved tenant/owner mapping before any production import. Tooling rejects ambiguity and retains original hashes/IDs, but no customer data migration/cutover has been applied.
- Security implementation/infrastructure defects below remain open. Exact required evidence, canonical ownership and findings are recorded in reports/security/t5-asvs-review.json and the full Persian assessment. No COMPLETE claim is made while they remain.

| Control | Result | Remaining requirement |
| --- | --- | --- |
| v5.0.0-V1.3.3 | NOT_VERIFIED | نام و آرگومان تبدیل ثابت و bounded است؛ ایمنی تمامی ورودی‌های PDF/DOC در parser native اثبات نشده است. |
| v5.0.0-V1.3.12 | NOT_VERIFIED | الگوها ثابت و ورودی‌ها bounded هستند؛ ارزیابی worst-case همهٔ regexها و کتابخانه‌ها ثبت نشده است. |
| v5.0.0-V1.4.1 | NOT_VERIFIED | بخش TS managed است؛ native parser/LibreOffice و وابستگی‌ها به بررسی memory safety و آسیب‌پذیری نیاز دارند. |
| v5.0.0-V1.5.1 | NOT_VERIFIED | OOXML/ODT دارای DTD/entity و external relationship رد می‌شود؛ تنظیم XXE تمامی مسیرهای LibreOffice/DOC اثبات نشده است. |
| v5.0.0-V1.5.3 | NOT_VERIFIED | JSON و UTF-8 strict مشترک‌اند؛ differential parsing فایل باینری و مفسر Office کاملاً آزموده نشده است. |
| v5.0.0-V3.4.3 | NOT_VERIFIED | CSP کد و آزمون پایه موجود است؛ CSP L3 همهٔ پاسخ‌ها از زنجیرهٔ edge مشتری هنوز تأیید نشده است. |
| v5.0.0-V3.4.7 | NOT_VERIFIED | مسیر CSP reporting وجود دارد؛ فعال‌سازی و دریافت report در deployment مشتری اثبات نشده است. |
| v5.0.0-V5.2.2 | NOT_VERIFIED | UTF-8 کامل و ساختار archive کنترل می‌شوند؛ magic PDF/OLE اثبات تخصصی تمام محتوای PDF/DOC نیست. |
| v5.0.0-V5.4.3 | FAIL | با دانلود original Asset کنترل applicable است؛ scanner ضدبدافزار تمام فرمت‌ها و signature update/retry/quarantine provider هنوز وجود ندارد. |
| v5.0.0-V10.1.1 | NOT_VERIFIED | refresh cookie محدود به Auth و access token در حافظه است؛ الگوی BFF با token فقط backend و مرور همهٔ consumerها هنوز تأیید نشده است. |
| v5.0.0-V11.5.1 | NOT_VERIFIED | refresh secret و کلید آزمون CSPRNG هستند؛ بازبینی exhaustive purpose/entropy شناسه‌ها و credentialهای واقعی باقی است. |
| v5.0.0-V11.5.2 | NOT_VERIFIED | از crypto استاندارد استفاده می‌شود؛ رفتار زیر بار سنگین RNG و entropy زیرساخت واقعی آزمایش نشده است. |
| v5.0.0-V11.7.2 | NOT_VERIFIED | Qdrant payload opaque و provider content حداقلی است؛ encryption-at-rest و پس از مصرف در volumes واقعی اثبات نشده است. |
| v5.0.0-V12.3.1 | NOT_VERIFIED | S3/provider/SIEM production TLS validation دارند؛ PostgreSQL، gateway، monitoring و همهٔ اتصال‌های deployment مشتری اثبات نشده‌اند. |
| v5.0.0-V12.3.3 | NOT_VERIFIED | محیط آزمون loopback HTTP دارد؛ TLS همهٔ اتصال‌های داخلی استقرار مشتری نیازمند evidence است. |
| v5.0.0-V12.3.4 | NOT_VERIFIED | CA اختصاصی SIEM در آزمون معتبر بود؛ trust stores و certificate تمام سرویس‌های واقعی ارائه نشده‌اند. |
| v5.0.0-V12.3.5 | FAIL | ثبت Worker machine جای mTLS/replay-resistant authentication همهٔ transportهای داخلی نیست؛ mesh/certificate implementation فعلی وجود ندارد. |
| v5.0.0-V13.1.2 | NOT_VERIFIED | pool/Admission/config concurrency محدودند؛ saturation تمام client connection poolها و محیط مشتری اثبات نشده است. |
| v5.0.0-V13.2.1 | FAIL | secretRef ثابت PG/Qdrant/S3 معیار credential کوتاه‌عمر و account اختصاصی همهٔ سرویس‌ها را اثبات یا پیاده‌سازی نمی‌کند. |
| v5.0.0-V13.2.2 | NOT_VERIFIED | API/Worker در PG least-privilege و RLS آزموده شدند؛ IAM واقعی bucket، Qdrant و secret volume هنوز تأیید نشده‌اند. |
| v5.0.0-V13.2.3 | NOT_VERIFIED | fixture credentials تصادفی هستند؛ non-default بودن credentialهای واقعی مشتری قابل نتیجه‌گیری نیست. |
| v5.0.0-V13.2.5 | NOT_VERIFIED | allowlist برنامه وجود دارد؛ OS/network confinement native parser و gateway allowlist واقعی آزموده نشده است. |
| v5.0.0-V13.2.6 | NOT_VERIFIED | timeout/retry/Admission در focused tests اجرا شده‌اند؛ compliance connection maxima همهٔ transports زیر بار هنوز پوشش کامل ندارد. |
| v5.0.0-V13.3.2 | NOT_VERIFIED | secretRefs و role-specific PG secrets در OCI تعریف شده‌اند؛ mounted files/IAM/rotation واقعی least privilege نیازمند evidence است. |
| v5.0.0-V14.1.1 | NOT_VERIFIED | Document classification و payload categories مشخص‌اند؛ نگاشت کامل مقررات/privacy هر مشتری ارائه نشده است. |
| v5.0.0-V14.1.2 | NOT_VERIFIED | Audit/egress/cache/integrity boundaries مستند است؛ retention، legal hold، encryption و privacy policy کامل مشتری تصویب نشده است. |
| v5.0.0-V14.2.2 | NOT_VERIFIED | cache private و bounded/hash-verified است؛ secure purge و encryption backend/edge مشتری اثبات نشده است. |
| v5.0.0-V14.2.4 | NOT_VERIFIED | Authority و integrity/redaction اجرا شده‌اند؛ تمام الزامات protection level در retention/encryption/privacy واقعی اثبات نشده‌اند. |
| v5.0.0-V14.2.7 | FAIL | خودکارسازی retention/purge/legal hold محتوای canonical و تمام backupها پیاده‌سازی نشده؛ soft delete به‌تنهایی کافی نیست. |
| v5.0.0-V15.1.2 | NOT_VERIFIED | SBOM واقعی هر سه تصویر و اسکن محلی dependency/image موجود است؛ attestation منبع تمام وابستگی‌ها و provenance امضاشدهٔ production هنوز اثبات نشده است. |
| v5.0.0-V15.2.1 | FAIL | اسکن واقعی تصویر و lock وابستگی‌ها آسیب‌پذیری‌های باز دارد؛ Node/OS و upload dependencies اصلاح و toolchain غیرضروری حذف شدند ولی remediation تمام یافته‌ها و SLA مشتری بسته نیست. |
| v5.0.0-V15.2.5 | FAIL | scratch خصوصی و timeout وجود دارد؛ sandbox parser بدون شبکه و با CPU/memory/file isolation مستقل پیاده‌سازی نشده است. |
| v5.0.0-V15.3.7 | NOT_VERIFIED | schema body و header مشخص هستند؛ تست exhaustive duplicate query/header/transport parser pollution هنوز ثبت نشده است. |
| v5.0.0-V15.4.2 | NOT_VERIFIED | job lease و Document snapshot publication fence آزموده شدند؛ atomicity دقیق grant revocation و materialization/provider dispatch در تمام interleavingها اثبات نشده است. |
| v5.0.0-V15.4.4 | NOT_VERIFIED | capacity bounded است؛ starvation/fairness بلندمدت با actorهای متعدد و حجم production آزموده نشده است. |
| v5.0.0-V16.1.1 | NOT_VERIFIED | inventory برنامه/DB/SIEM در گزارش فارسی آمده؛ destination، access و retention همهٔ لایه‌های مشتری مشخص نیست. |
| v5.0.0-V16.2.2 | NOT_VERIFIED | timestampها UTC هستند؛ هم‌زمانی NTP تمام hostها و dependencies مشتری اثبات نشده است. |
| v5.0.0-V16.2.3 | NOT_VERIFIED | برنامه stdout، canonical PG و selected SIEM دارد؛ agentهای log و retention destination واقعی هنوز بررسی نشده‌اند. |
| v5.0.0-V16.4.2 | NOT_VERIFIED | DB audit immutability برای API/Worker موفق است؛ حفاظت stdout، host collector و destination مشتری آزموده نشده است. |
| v5.0.0-V16.4.3 | NOT_VERIFIED | receiver مستقل TLS در fixture موفق است؛ SOC واقعی، ACL/retention و جدایی کامل deployment تأیید نشده است. |
| v5.0.0-V16.5.4 | NOT_VERIFIED | last-resort handler payload را log نمی‌کند و با drain/exit fail-closed برای supervisor جایگزین می‌شود؛ availability و restart policy همهٔ entrypointها در deployment واقعی هنوز اثبات نشده است. |

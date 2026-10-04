# Activity Report: T5-R2-DEV-RAG-DUAL-AUTH

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261004-2024-T5-R2-DEV-RAG-DUAL-AUTH.md
- Created At: 2026-10-04T16:54:07.833Z
- Status: PARTIAL

## Purpose and Scope

- Purpose: T5-R2-DEV-RAG-DUAL-AUTH
- Scope: Local development dual authentication and Knowledge/RAG bring-up; customer release excluded.

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

- T5-R1 and T5-R1.1 working-tree changes already existed; protected-path diff was empty.
- Legacy source confirmed browser MD5, usrKey lookup, unknown-key creation and a separate OIDC path.
- No real protected models or organizational IdP settings were available locally.

## Pre-existing Workspace Changes

These paths existed at task start; prior content is not claimed as T5-R2 work. Overlapping T5-R2 edits are also listed under Files Modified.

- `apps/api/src/index.ts`
- `apps/api/src/knowledge.ts`
- `apps/runtime/src/composition.ts`
- `apps/worker/src/composition.ts`
- `deploy/customer.Dockerfile`
- `docs/backend/13-t5-r1-hardening.md`
- `docs/deployment/04-t5-r1-service-boundaries.md`
- `docs/prompts/T5-R2.md`
- `docs/reports/20261004-1340-T5-R1-INDEPENDENT-HARDENING.md`
- `docs/reports/20261004-1559-T5-R1-1-VERIFICATION-GATE-REPAIR.md`
- `docs/security/00-current-status.md`
- `docs/security/03-t5-asvs-5.0-level3-assessment-fa.md`
- `docs/security/03-t5-rag-security-delta-fa.md`
- `docs/security/06-t5-genai-rag-security-gate.md`
- `docs/security/08-t5-authority-decision-boundary-fa.md`
- `docs/verification/04-t5-r1-1-verification-fa.md`
- `modules/faq/src/service.ts`
- `modules/summarizer/src/service.ts`
- `modules/translator/src/persistence/migrate.ts`
- `modules/translator/src/service.ts`
- `packages/admission-control/src/files.ts`
- `packages/admission-control/src/persistence/files.ts`
- `packages/ai-router/src/index.ts`
- `packages/ai-router/src/protected.ts`
- `packages/authority/src/persistence.generic.ts`
- `packages/authority/src/persistence.ts`
- `packages/authority/src/service.ts`
- `packages/configuration/src/cli.ts`
- `packages/configuration/src/index.ts`
- `packages/contracts/src/protected-ai.ts`
- `packages/data-governance/src/persistence.ts`
- `packages/data-governance/src/retention.ts`
- `packages/documents/src/index.ts`
- `packages/documents/src/persistence.ts`
- `packages/documents/src/service.ts`
- `packages/file-management/src/cache.ts`
- `packages/file-management/src/persistence.ts`
- `packages/file-management/src/private-filesystem.ts`
- `packages/file-management/src/scratch-quota.ts`
- `packages/file-management/src/service.ts`
- `packages/file-management/src/staging.ts`
- `packages/file-management/src/transfers.ts`
- `packages/file-processing/src/index.ts`
- `packages/file-processing/src/malware.ts`
- `packages/file-processing/src/native-parser.mjs`
- `packages/file-processing/src/sandbox.ts`
- `packages/jobs/src/index.ts`
- `packages/jobs/src/persistence.ts`
- `packages/jobs/src/worker.ts`
- `packages/knowledge/src/adapters/qdrant.ts`
- `packages/knowledge/src/index.ts`
- `packages/knowledge/src/persistence.ts`
- `packages/knowledge/src/service.ts`
- `packages/persistence/src/target-migrations/021-deployment-worker-queue.sql`
- `packages/persistence/src/target-migrations/022-authority-materialization-fence.sql`
- `packages/persistence/src/target-migrations/023-governance-retention-lifecycle.sql`
- `packages/persistence/src/target-migrations/024-governed-owner-purge.sql`
- `packages/persistence/src/target-migrations/025-governed-owner-rls-scope.sql`
- `packages/persistence/src/target.ts`
- `packages/storage/src/adapters/local.ts`
- `packages/storage/src/adapters/s3.ts`
- `packages/storage/src/index.ts`
- `reports/security/asvs-5.0-l3.json`
- `reports/security/rag-security-gate.json`
- `reports/security/t5-acceptance-evidence.json`
- `reports/security/t5-asvs-review.json`
- `reports/security/t5-authority-inventory.json`
- `reports/security/t5-completion-gate.json`
- `reports/security/t5-direct-evidence.json`
- `reports/security/t5-live-model-evidence.json`
- `reports/security/t5-preliminary-gates.json`
- `reports/security/t5-protected-paths-after.json`
- `reports/security/t5-r1-1-protected-before.json`
- `reports/security/t5-r1-1-verification.json`
- `reports/security/t5-r1-open-findings.json`
- `reports/security/t5-r1-protected-before.json`
- `reports/security/t5-service-boundary-assessment.json`
- `reports/security/t5-supply-chain.json`
- `scripts/t5-acceptance-evidence.mjs`
- `scripts/t5-asvs-evidence.mjs`
- `scripts/t5-audit-siem.mjs`
- `scripts/t5-authority-inventory.mjs`
- `scripts/t5-completion-gate.mjs`
- `scripts/t5-evidence-gate.mjs`
- `scripts/t5-live-model-acceptance.ts`
- `scripts/t5-preliminary-gates.mjs`
- `scripts/t5-protected-paths.mjs`
- `scripts/t5-protected-policy.mjs`
- `scripts/t5-r1-1-gate.mjs`
- `scripts/t5-r1-acceptance.mjs`
- `scripts/t5-r1-reporter.mjs`
- `scripts/t5-r1-source.mjs`
- `scripts/t5-security-assessment.mjs`
- `scripts/t5-service-boundary-assessment.mjs`
- `scripts/t5-supply-chain.mjs`
- `scripts/t5-supply-policy.mjs`
- `tests/architecture/staticAnalysis.test.ts`
- `tests/architecture/support/staticAnalysis.ts`
- `tests/configuration/t5-file-management.test.ts`
- `tests/reports/oci/acceptance.json`
- `tests/reports/oci/customer-a-api-build.log`
- `tests/reports/oci/customer-a-sbom.cdx.json`
- `tests/reports/oci/customer-a-web-build.log`
- `tests/reports/oci/customer-a-worker-build.log`
- `tests/reports/oci/customer-b-api-build.log`
- `tests/reports/oci/customer-b-sbom.cdx.json`
- `tests/reports/oci/customer-b-web-build.log`
- `tests/reports/oci/customer-b-worker-build.log`
- `tests/reports/oci/customer-c-api-build.log`
- `tests/reports/oci/customer-c-sbom.cdx.json`
- `tests/reports/oci/customer-c-web-build.log`
- `tests/reports/oci/customer-c-worker-build.log`
- `tests/reports/oci/dependency-vulnerabilities.json`
- `tests/reports/oci/runtime-06485210916857e2-vulnerabilities.json`
- `tests/reports/oci/runtime-2a36791ae2433eea-vulnerabilities.json`
- `tests/reports/oci/runtime-3104005ed99153e3-vulnerabilities.json`
- `tests/reports/oci/runtime-a39ccef4089a684b-vulnerabilities.json`
- `tests/reports/oci/runtime-b2e277040912fe02-vulnerabilities.json`
- `tests/reports/oci/runtime-c596bc0f3228e84d-vulnerabilities.json`
- `tests/reports/oci/runtime-dependency-vulnerabilities.json`
- `tests/reports/oci/runtime-f980c0d9a60aafed-vulnerabilities.json`
- `tests/reports/oci/runtime-vulnerabilities.json`
- `tests/reports/t5-audit-siem.tap`
- `tests/reports/t5-r1-execution.json`
- `tests/reports/t5-r1/architecture.log`
- `tests/reports/t5-r1/audit-siem.log`
- `tests/reports/t5-r1/auth-http.log`
- `tests/reports/t5-r1/authority-conformance.log`
- `tests/reports/t5-r1/authority-inventory.log`
- `tests/reports/t5-r1/authority-live.log`
- `tests/reports/t5-r1/browser.log`
- `tests/reports/t5-r1/build-web.log`
- `tests/reports/t5-r1/foundations.log`
- `tests/reports/t5-r1/integrations.log`
- `tests/reports/t5-r1/r1-hardening.log`
- `tests/reports/t5-r1/strict-target.log`
- `tests/reports/t5-r1/strict-web.log`
- `tests/reports/t5-r1/t5-architecture.log`
- `tests/reports/t5-r1/ui.log`
- `tests/target/support/t5-adversarial-corpus.ts`
- `tests/target/support/t5-live-subject.ts`
- `tests/target/support/t5-runtime-fixture.ts`
- `tests/target/t44-authority-live.integration.test.ts`
- `tests/target/t5-authority-post-t5-inventory.test.mjs`
- `tests/target/t5-cache-concurrency.test.ts`
- `tests/target/t5-evidence-selftest.test.mjs`
- `tests/target/t5-file-cache.test.ts`
- `tests/target/t5-file-management.integration.test.ts`
- `tests/target/t5-genai-adversarial.test.ts`
- `tests/target/t5-job-idempotency-security.integration.test.ts`
- `tests/target/t5-malware-policy.test.ts`
- `tests/target/t5-parser-sandbox.test.ts`
- `tests/target/t5-protected-policy.test.mjs`
- `tests/target/t5-rag-security.integration.test.ts`
- `tests/target/t5-retention-purge.integration.test.ts`
- `tests/target/t5-security-race.integration.test.ts`
- `tests/target/t5-supply-policy.test.mjs`
- `tests/target/t5-worker-multitenant.integration.test.ts`
- `tests/target/t5-worker.integration.test.ts`
- `tsconfig.target.json`

## Files Added

- `docs/reports/20261004-2024-T5-R2-DEV-RAG-DUAL-AUTH.md`
- `docs/verification/05-development-rag-dual-auth-fa.md`
- `packages/authentication/src/oidc.ts`
- `packages/authority/src/persistence.onboarding.ts`
- `packages/persistence/src/bootstrap-rag-dev.ts`
- `packages/persistence/src/target-migrations/026-dual-auth-credentials.sql`
- `packages/persistence/src/target-migrations/027-development-legacy-onboarding.sql`
- `scripts/dev-rag-auth-proxy.mjs`
- `scripts/dev-rag-browser.mjs`
- `scripts/dev-rag-cert.py`
- `scripts/dev-rag-prepare.ts`
- `scripts/dev-rag-qdrant.mjs`
- `scripts/dev-rag.mjs`
- `tests/target/t5-r2-browser.smoke.mjs`
- `tests/target/t5-r2-dual-auth.integration.test.ts`
- `tests/target/t5-r2-oidc.test.ts`
- `tests/target/t5-r2-self-provision.integration.test.ts`

## Files Modified

- `apps/api/src/composition.ts`
- `apps/api/src/index.ts`
- `apps/web/src/lib/api/transport.ts`
- `apps/web/src/lib/auth/client.svelte.ts`
- `apps/web/src/routes/(public)/login/+page.server.ts`
- `apps/web/src/routes/(public)/login/+page.svelte`
- `apps/web/src/routes/(user)/knowledge/+page.server.ts`
- `apps/web/src/routes/(user)/knowledge/+page.svelte`
- `apps/web/vite.config.ts`
- `package.json`
- `packages/audit/src/index.ts`
- `packages/authentication/src/index.ts`
- `packages/authentication/src/persistence.ts`
- `packages/authentication/src/service.ts`
- `packages/configuration/src/index.ts`
- `packages/identity/src/persistence.ts`
- `tests/target/t5-browser.integration.test.mjs`

## Files Deleted

- None.

## Implementation Summary

- Added typed OIDC, legacy-key and optional development-password methods converging on canonical Identity, membership, Session and token.
- Added issuer+subject OIDC credential and one-time flow, PKCE S256, state, nonce, exact callback/client validation.
- Added server-side migrated MD5 compatibility, durable throttling and bounded development-only self-provision through Authority.
- Added idempotent development PostgreSQL/Qdrant/Storage/API/Worker/Web/TLS launcher and enabled Knowledge UI with explicit missing-model readiness.
- Updated Persian login and Knowledge views, Chrome smoke, auth integration tests and verification guide.

## Architecture Decisions / Deviations

- Authority remains sole authorization owner; development grants use named Knowledge privileges, not ALL.
- Legacy MySQL is outside target runtime; MD5 is only a server-side compatibility verifier.
- Protected AI and Data Governance remain required for real RAG; missing models yield DEVELOPMENT_RAG_MODEL_CONFIGURATION_REQUIRED and /ready 503.
- OIDC automatic provisioning fails configuration validation; approved issuer+subject import links an existing Identity.
- No governing document or task prompt was edited.

## Tests and Verification

- PASS: check:target, check:web, build:web.
- PASS: auth and Session unit tests, Authority conformance (39), tenant isolation, T5 Worker multitenant, File Management integration (7), RAG security integration (13), existing T5 and T4 browser, target architecture and target UI architecture.
- PASS: test:dev:rag:auth (3) and test:dev:rag:browser (live Chrome raw-key login and Knowledge UI).
- PASS: dev:rag local Web, Auth, PostgreSQL, Worker, Storage and Qdrant readiness; expected /ready 503 for missing models.
- PASS: protected-path diff empty.

## Expected Failures

- Real OIDC login NOT_VERIFIED: IdP settings and credentials absent.
- Real RAG upload/index/query NOT_VERIFIED: DOCUMENT_EMBED, QUERY_EMBED, RERANK and RAG_ANSWER unconfigured. Synthetic fixture tests do not prove model acceptance.
- Customer ASVS Level 3 release NO.

## Unexpected Failures

- First focused test run lacked PostgreSQL access in restricted sandbox. Concurrent browser/auth tests briefly deadlocked shared fixtures. Sequential reruns with database access passed; no unresolved focused failure.

## Production Code Changes

- Authentication persistence/service and API routes support target OIDC and legacy key while reusing canonical Session and Authority. Configuration validation, audit vocabulary and Identity seeding were updated. Customer Knowledge defaults were not enabled.

## Final Repository State

- T5-R2 changes listed above; pre-existing T5-R1/R1.1 changes retained.
- Local legacy-key login and Knowledge UI running. Real models and IdP explicitly unconfigured.
- Protected governing files and task prompts have no introduced modifications.

## Acceptance Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| 1 | PASS | Live Chrome raw-key login establishes target Session and opens /knowledge. |
| 2 | PASS | OIDC protocol and issuer+subject mapping tests; canonical Identity/Session integration. |
| 3 | PASS | Dedicated development stack, Authority grants, Storage and Qdrant readiness. |
| 4 | PASS | Focused regression and architecture checks. |
| 5 | FAIL | Live organizational login lacks external IdP configuration. |
| 6 | FAIL | Live RAG model upload/index/query needs endpoint and governance configuration. |
| 7 | PASS | Protected-path diff empty and no customer release claim. |

## Open Issues

- Supply real IdP configuration and approved issuer+subject mapping, then complete browser OIDC login.
- Supply real embedding, rerank and generation bindings plus Data Governance policy, then test upload, indexing, query, citation and source opening.

---

Generated by scripts/activity-report.ts

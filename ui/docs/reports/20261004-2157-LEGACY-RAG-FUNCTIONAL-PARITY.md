# Activity Report: LEGACY-RAG-FUNCTIONAL-PARITY

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261004-2157-LEGACY-RAG-FUNCTIONAL-PARITY.md
- Created At: 2026-10-04T18:27:48.503Z
- Status: PARTIAL

## Purpose and Scope

- Implement the T5-R3 legacy-looking RAG user workflow on the target Document, File Management, Knowledge, Authority, AI Router and PostgreSQL architecture. Record actual development model readiness without fabricated bindings.

## Governing Sources

- `AGENTS.md` and scoped repository instructions.
- `docs/architecture/00-manifest.md`, `06-document-and-rag.md`, `07-ai-router.md`, plus the applicable architecture set. Protected governing and prompt files were read only.

## Initial Repository State

- The target Knowledge engineering page and dual authentication existed. The legacy RAG page and source files were present. The target had no conversation persistence or `/rag` page.
- The working tree already contained extensive T5-R1/R2 changes. They are listed separately below.

## Pre-existing Workspace Changes

- `apps/api/src/composition.ts`
- `apps/api/src/index.ts`
- `apps/api/src/knowledge.ts`
- `apps/runtime/src/composition.ts`
- `apps/web/src/lib/api/transport.ts`
- `apps/web/src/lib/auth/client.svelte.ts`
- `apps/web/src/routes/(public)/login/+page.server.ts`
- `apps/web/src/routes/(public)/login/+page.svelte`
- `apps/web/src/routes/(user)/knowledge/+page.server.ts`
- `apps/web/src/routes/(user)/knowledge/+page.svelte`
- `apps/web/vite.config.ts`
- `apps/worker/src/composition.ts`
- `deploy/customer.Dockerfile`
- `docs/backend/13-t5-r1-hardening.md`
- `docs/deployment/04-t5-r1-service-boundaries.md`
- `docs/prompts/T5-R2.md`
- `docs/prompts/T5-R3.md`
- `docs/reports/20261004-1340-T5-R1-INDEPENDENT-HARDENING.md`
- `docs/reports/20261004-1559-T5-R1-1-VERIFICATION-GATE-REPAIR.md`
- `docs/reports/20261004-2024-T5-R2-DEV-RAG-DUAL-AUTH.md`
- `docs/reports/20261004-2117-T5-R2-DEV-LOGIN-TRANSLATE-REPAIR.md`
- `docs/security/00-current-status.md`
- `docs/security/03-t5-asvs-5.0-level3-assessment-fa.md`
- `docs/security/03-t5-rag-security-delta-fa.md`
- `docs/security/06-t5-genai-rag-security-gate.md`
- `docs/security/08-t5-authority-decision-boundary-fa.md`
- `docs/verification/04-t5-r1-1-verification-fa.md`
- `docs/verification/05-development-rag-dual-auth-fa.md`
- `modules/faq/src/service.ts`
- `modules/summarizer/src/service.ts`
- `modules/translator/src/persistence/migrate.ts`
- `modules/translator/src/service.ts`
- `package.json`
- `packages/admission-control/src/files.ts`
- `packages/admission-control/src/persistence/files.ts`
- `packages/ai-router/src/index.ts`
- `packages/ai-router/src/protected.ts`
- `packages/audit/src/index.ts`
- `packages/authentication/src/index.ts`
- `packages/authentication/src/oidc.ts`
- `packages/authentication/src/persistence.ts`
- `packages/authentication/src/service.ts`
- `packages/authority/src/persistence.generic.ts`
- `packages/authority/src/persistence.onboarding.ts`
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
- `packages/identity/src/persistence.ts`
- `packages/jobs/src/index.ts`
- `packages/jobs/src/persistence.ts`
- `packages/jobs/src/worker.ts`
- `packages/knowledge/src/adapters/qdrant.ts`
- `packages/knowledge/src/index.ts`
- `packages/knowledge/src/persistence.ts`
- `packages/knowledge/src/service.ts`
- `packages/persistence/src/bootstrap-rag-dev.ts`
- `packages/persistence/src/target-migrations/021-deployment-worker-queue.sql`
- `packages/persistence/src/target-migrations/022-authority-materialization-fence.sql`
- `packages/persistence/src/target-migrations/023-governance-retention-lifecycle.sql`
- `packages/persistence/src/target-migrations/024-governed-owner-purge.sql`
- `packages/persistence/src/target-migrations/025-governed-owner-rls-scope.sql`
- `packages/persistence/src/target-migrations/026-dual-auth-credentials.sql`
- `packages/persistence/src/target-migrations/027-development-legacy-onboarding.sql`
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
- `scripts/dev-rag-auth-proxy.mjs`
- `scripts/dev-rag-browser.mjs`
- `scripts/dev-rag-cert.py`
- `scripts/dev-rag-prepare.ts`
- `scripts/dev-rag-qdrant.mjs`
- `scripts/dev-rag.mjs`
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
- `tests/target/t5-browser.integration.test.mjs`
- `tests/target/t5-cache-concurrency.test.ts`
- `tests/target/t5-evidence-selftest.test.mjs`
- `tests/target/t5-file-cache.test.ts`
- `tests/target/t5-file-management.integration.test.ts`
- `tests/target/t5-genai-adversarial.test.ts`
- `tests/target/t5-job-idempotency-security.integration.test.ts`
- `tests/target/t5-malware-policy.test.ts`
- `tests/target/t5-parser-sandbox.test.ts`
- `tests/target/t5-protected-policy.test.mjs`
- `tests/target/t5-r2-browser.smoke.mjs`
- `tests/target/t5-r2-dual-auth.integration.test.ts`
- `tests/target/t5-r2-oidc.test.ts`
- `tests/target/t5-r2-self-provision.integration.test.ts`
- `tests/target/t5-rag-security.integration.test.ts`
- `tests/target/t5-retention-purge.integration.test.ts`
- `tests/target/t5-security-race.integration.test.ts`
- `tests/target/t5-supply-policy.test.mjs`
- `tests/target/t5-worker-multitenant.integration.test.ts`
- `tests/target/t5-worker.integration.test.ts`
- `tsconfig.target.json`

## Files Added

- `apps/web/src/routes/(user)/rag/+page.server.ts`
- `apps/web/src/routes/(user)/rag/+page.svelte`
- `apps/web/static/brand/targoman-rag.png`
- `docs/reports/20261004-2157-LEGACY-RAG-FUNCTIONAL-PARITY.md`
- `docs/verification/06-legacy-rag-functional-parity-fa.md`
- `packages/knowledge/src/persistence/chat.ts`
- `packages/knowledge/src/personal-chat-contracts.ts`
- `packages/knowledge/src/personal-chat.ts`
- `packages/persistence/src/target-migrations/028-knowledge-personal-chats.sql`
- `tests/target/t5-r3-browser.smoke.mjs`
- `tests/target/t5-r3-chat.integration.test.ts`

## Files Modified

- `apps/api/src/knowledge.ts`
- `apps/runtime/src/composition.ts`
- `apps/web/src/lib/api/transport.ts`
- `apps/web/src/lib/knowledge/client.ts`
- `apps/web/src/lib/styles/main.scss`
- `apps/web/src/routes/(public)/login/+page.server.ts`
- `apps/web/src/routes/(public)/login/+page.svelte`
- `apps/web/src/routes/(user)/+layout.svelte`
- `package.json`
- `packages/knowledge/src/index.ts`
- `packages/knowledge/src/persistence.ts`
- `packages/knowledge/src/service.ts`
- `scripts/dev-rag-prepare.ts`
- `scripts/dev-rag.mjs`
- `tests/target/t5-r2-browser.smoke.mjs`

## Files Deleted

- None.

## Implementation Summary

- Added `/rag` with the dark, RTL chat-first layout, right sidebar, persistent chat controls, document upload/removal, suggestions, safe Markdown, citation links and compact Persian readiness/error states. Ordinary navigation now points to `/rag`; `/knowledge` remains an engineering route.
- Added stable personal RAG Space resolution through Knowledge/Authority. Upload uses target File Management and automatically attaches the resulting Document to that Space, scheduling indexing through existing Knowledge jobs.
- Added minimal PostgreSQL conversation/message persistence with tenant and owner RLS, mutation audit, soft deletion and a first-question title. Previous messages are bounded and supplied as untrusted context for a follow-up answer.
- Restored `/login?back=rag` and development brand parity. The existing organizational method remains discoverable when configured.

## Architecture Decisions / Deviations

- SQL stays in Knowledge persistence. Controllers do not access PostgreSQL, Qdrant or models directly. Document removal retires personal membership and the Document while preserving retention policy.
- The actual local generation model is served at `127.0.0.1:8001` as `targoman`, but it does not provide Embeddings or Rerank. Legacy embedding endpoint `127.0.0.1:8002` is unavailable. Reranking is mandatory in the current Knowledge contract. No protected model binding or broad Data Governance egress policy was invented.
- The full human RAG flow remains unavailable until real compatible embedding and reranking services and explicit protected AI/Data Governance configuration exist.

## Tests and Verification

- `npm run check:web`: PASS, 0 errors/0 warnings.
- `npm run check:target`: PASS.
- `npm run build:web`: PASS.
- `npm run test:architecture:target` and `npm run test:architecture:target-ui`: PASS, 0 findings.
- `npm run test:t5:r3:browser`: PASS for unauthenticated redirect, Legacy Key sign-in, `/rag` return and visible layout; actual model flow not claimed by this mode.
- `npm run test:dev:rag:browser`: PASS for existing Knowledge route when explicitly requested.
- Live `t5-r3-chat.integration.test.ts`: PASS for persistence, actor isolation, membership retirement and reattachment.
- Live `t5-file-management.integration.test.ts`: PASS (6 subtests).
- Live `t5-worker.integration.test.ts`: PASS (6 subtests).
- Live `t5-rag-security.integration.test.ts`: PASS (12 subtests) with test providers. These fixtures do not satisfy the real-model browser gate.
- `T5_R3_REQUIRE_MODEL=1 npm run test:t5:r3:browser`: FAIL at the explicit real model readiness assertion; upload/answer/citation were not exercised.
- `npm run db:target:migrate`: PASS, migration 028 applied once and second run reported `applied:0` with matching checksum.
- `git diff --check` on touched paths: PASS. Protected-path diff at start and end: empty.

## Expected Failures

- Real-model browser flow: FAIL because no compatible live embedding/reranking endpoint or protected AI/Data Governance binding exists. `/ready` reports `DEVELOPMENT_RAG_MODEL_CONFIGURATION_REQUIRED`.
- Organizational OIDC browser flow: CONFIG_REQUIRED in current development configuration.

## Unexpected Failures

- The first chat integration run found an unused PostgreSQL placeholder; corrected and rerun PASS.
- The first target architecture run found an SQL import outside the persistence directory; moved it under owning persistence and rerun PASS.
- The first legacy browser regression assertion expected ordinary navigation to `/knowledge`; updated to expect `/rag` and rerun PASS.
- The first protected RAG fixture run inherited `NODE_TLS_REJECT_UNAUTHORIZED=0`; rerun with normal TLS verification PASS.

## Production Code Changes

- New target Knowledge personal chat service, contracts and persistence; new migration 028 and personal Space workflow.
- New `/rag` route, client methods, authentication return path and development branding.
- No legacy MySQL runtime, direct UI Qdrant calls or direct Knowledge model calls added.

## Final Repository State

- Current working tree paths at report preparation: 208; pre-existing at start: 194. Unrelated pre-existing changes were not attributed to T5-R3.
- Migration 028 is present in the local RAG PostgreSQL database with no pending migration.
- No protected governing or prompt path was changed by this task.

## Acceptance Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| 1 | PASS | `/rag` old-style layout; browser smoke and desktop screenshot inspection |
| 2 | PASS | `/login?back=rag` and Legacy Key; Chrome smoke |
| 3 | PASS | Target-native personal Space and chat persistence; Knowledge service path and live PostgreSQL test |
| 4 | FAIL | Automatic upload/processing/indexing with actual models; missing live embedding/rerank services |
| 5 | FAIL | Answer and citation from actual development models; no complete protected AI bindings |
| 6 | PASS | Target architecture and relevant integration tests; type, build, architecture, File Management, Worker and protected RAG fixture tests |
| 7 | PASS | Focused documentation and protected file preservation; verification note and empty protected-path diff |

## Open Issues

- Supply compatible live `DOCUMENT_EMBED`/`QUERY_EMBED` endpoint(s), a real reranker endpoint, and explicit private `protected` AI Router plus Data Governance configuration. The available `targoman` generation endpoint may then be evaluated and bound to `RAG_ANSWER` if its structured output satisfies the target contract.
- Run the full browser smoke with `T5_R3_REQUIRE_MODEL=1` after those services are ready. Current actual-model status is PARTIAL/FAIL.
- Dynamic per-document question generation, no-document general chat and AI-generated titles are remaining legacy parity differences. Current title is deterministic from the first question.

---

Generated and finalized through the repository Activity Report workflow.

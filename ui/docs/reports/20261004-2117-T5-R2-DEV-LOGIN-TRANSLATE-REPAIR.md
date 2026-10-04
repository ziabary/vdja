# Activity Report: T5-R2-DEV-LOGIN-TRANSLATE-REPAIR

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261004-2117-T5-R2-DEV-LOGIN-TRANSLATE-REPAIR.md
- Created At: 2026-10-04T17:47:06.206Z
- Status: PARTIAL

## Purpose and Scope

- Purpose: Repair local development key-login diagnosis and live vLLM translation setup after user-reported 401 and 502.
- Scope: Focused local startup/configuration, verification and user instructions.

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

- T5-R1/R1.1/R2 workspace changes already existed and were captured by report:start. Protected-path diff was empty.
- User reported a 401 legacy-key login, a 502 translation, and a live vLLM at 127.0.0.1:8001.

## Pre-existing Workspace Changes

These paths were present at task start and are not claimed as new work. Overlapping task edits appear again under Files Modified.

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
- `docs/reports/20261004-1340-T5-R1-INDEPENDENT-HARDENING.md`
- `docs/reports/20261004-1559-T5-R1-1-VERIFICATION-GATE-REPAIR.md`
- `docs/reports/20261004-2024-T5-R2-DEV-RAG-DUAL-AUTH.md`
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

- `docs/reports/20261004-2117-T5-R2-DEV-LOGIN-TRANSLATE-REPAIR.md`

## Files Modified

- `scripts/dev-rag-prepare.ts`
- `scripts/dev-rag.mjs`
- `docs/verification/05-development-rag-dual-auth-fa.md`

## Files Deleted

- None.

## Implementation Summary

- Verified the generated 24-character development key matches the stored credential, its Identity is ACTIVE with an active membership, and an HTTPS Auth request with that key returns 200. The user 401 is consistent with entering a different or mistyped key; no auth code change was needed.
- Found that the development config used the placeholder model `configured-model` while live vLLM serves `targoman`; vLLM rejects the placeholder with 404.
- Development preparation now discovers `/v1/models`, binds the single real served model, accepts explicit `--public-model-id` when needed, and disables the endpoint with a clear status if discovery cannot establish a binding. Startup prints the selected public AI model.
- Updated the Persian verification guide with key and restart instructions.

## Architecture Decisions / Deviations

- Model selection stays in development configuration preparation, not Translator business logic; AI Router remains the model execution owner.
- No legacy MySQL runtime access, Authority interpretation, protected RAG model fallback or governing-document edit was introduced.

## Tests and Verification

- PASS: generated-key credential match and HTTPS Auth login 200 without printing the secret.
- PASS: live vLLM `/v1/models` serves `targoman`; a direct synthetic streaming request through `callOpenAiCompatible` succeeded.
- PASS: updated preparation selected `gpu-a:READY:targoman`; a temporary API on port 3101 returned 200, streamed Persian deltas and a DONE marker for a synthetic translation. The temporary API was stopped.
- PASS: `npm run test:dev:rag:browser` signed in through the running UI with the generated key and opened Knowledge.
- PASS: `npm run check:target`, `npm run test:ai-router`, `npm run test:auth:unit`, and targeted `git diff --check`.
- PASS: final protected-path diff empty.
- FAIL (pre-existing): `npm run test:architecture:ai` reports two ARCH-AI-003 findings in legacy `src/services/vectorDB-old.ts`, which this task did not change.

## Expected Failures

- The user-running API retains its prior startup snapshot until restarted; the temporary API proved the corrected configuration.
- `/ready` remains 503 with `DEVELOPMENT_RAG_MODEL_CONFIGURATION_REQUIRED` until the four protected RAG tasks receive real model configuration. Public translation readiness is independent.

## Unexpected Failures

- None remaining for the focused login or public translation path.

## Production Code Changes

- Development-only preparation and launcher now resolve the real public model ID from the serving endpoint. Authentication production code was unchanged.

## Final Repository State

- Updated ignored local development config binds `gpu-a` to the live `targoman` model; the user process must restart to load it.
- Pre-existing workspace changes remain; protected governing and prompt paths have no introduced modification.

## Acceptance Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| 1 | PASS | Seeded key matched credential and signed in over HTTPS with 200. |
| 2 | PASS | Live vLLM model discovered and bound to public AI configuration. |
| 3 | PASS | Temporary API streamed translated output with HTTP 200. |
| 4 | PASS | Focused checks and tests passed. |
| 5 | FAIL | Existing user-running API still requires restart to load corrected config. |
| 6 | PASS | Protected-path diff empty; customer release and protected RAG not claimed. |

## Open Issues

- Restart `npm run dev:rag` in the user terminal and retry translation in the UI.
- Use the generated development key from `.secrets.t3.local/rag-legacy-key`; historical personal keys need a separately verified migration mapping.
- Configure the four protected RAG tasks and real OIDC settings separately.
- Legacy `src/services/vectorDB-old.ts` has two pre-existing architecture AI findings.

---

Generated by scripts/activity-report.ts

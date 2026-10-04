# Activity Report: LEGACY-RAG-UX-CORRECTIONS

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261004-2248-LEGACY-RAG-UX-CORRECTIONS.md
- Created At: 2026-10-04T19:18:45.020Z
- Status: COMPLETE

## Purpose and Scope

- Correct the development RAG login page against the supplied legacy screenshots and restore development key generation.
- Place the composer near the center of an empty conversation and at the bottom after the first message.

## Governing Sources

- `AGENTS.md`, `apps/web/AGENTS.md`, and the existing architecture instructions for BrandProfile, Authentication, and Knowledge/RAG. No governing or prompt file was changed.

## Initial Repository State

- The working tree already contained 209 changed paths from earlier T5 work. The initial status was captured by `report:start` before this task's edits.
- Protected-path diff was empty at task start.

## Pre-existing Workspace Changes

- The following paths were already changed or untracked at task start. Files also listed under Files Modified below received additional task-scoped edits.

- `apps/api/src/composition.ts`
- `apps/api/src/index.ts`
- `apps/api/src/knowledge.ts`
- `apps/runtime/src/composition.ts`
- `apps/web/src/lib/api/transport.ts`
- `apps/web/src/lib/auth/client.svelte.ts`
- `apps/web/src/lib/knowledge/client.ts`
- `apps/web/src/lib/styles/main.scss`
- `apps/web/src/routes/(public)/login/+page.server.ts`
- `apps/web/src/routes/(public)/login/+page.svelte`
- `apps/web/src/routes/(user)/+layout.svelte`
- `apps/web/src/routes/(user)/knowledge/+page.server.ts`
- `apps/web/src/routes/(user)/knowledge/+page.svelte`
- `apps/web/src/routes/(user)/rag/+page.server.ts`
- `apps/web/src/routes/(user)/rag/+page.svelte`
- `apps/web/static/brand/targoman-rag.png`
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
- `docs/reports/20261004-2157-LEGACY-RAG-FUNCTIONAL-PARITY.md`
- `docs/security/00-current-status.md`
- `docs/security/03-t5-asvs-5.0-level3-assessment-fa.md`
- `docs/security/03-t5-rag-security-delta-fa.md`
- `docs/security/06-t5-genai-rag-security-gate.md`
- `docs/security/08-t5-authority-decision-boundary-fa.md`
- `docs/verification/04-t5-r1-1-verification-fa.md`
- `docs/verification/05-development-rag-dual-auth-fa.md`
- `docs/verification/06-legacy-rag-functional-parity-fa.md`
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
- `packages/knowledge/src/persistence/chat.ts`
- `packages/knowledge/src/personal-chat-contracts.ts`
- `packages/knowledge/src/personal-chat.ts`
- `packages/knowledge/src/service.ts`
- `packages/persistence/src/bootstrap-rag-dev.ts`
- `packages/persistence/src/target-migrations/021-deployment-worker-queue.sql`
- `packages/persistence/src/target-migrations/022-authority-materialization-fence.sql`
- `packages/persistence/src/target-migrations/023-governance-retention-lifecycle.sql`
- `packages/persistence/src/target-migrations/024-governed-owner-purge.sql`
- `packages/persistence/src/target-migrations/025-governed-owner-rls-scope.sql`
- `packages/persistence/src/target-migrations/026-dual-auth-credentials.sql`
- `packages/persistence/src/target-migrations/027-development-legacy-onboarding.sql`
- `packages/persistence/src/target-migrations/028-knowledge-personal-chats.sql`
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
- `tests/target/t5-r3-browser.smoke.mjs`
- `tests/target/t5-r3-chat.integration.test.ts`
- `tests/target/t5-rag-security.integration.test.ts`
- `tests/target/t5-retention-purge.integration.test.ts`
- `tests/target/t5-security-race.integration.test.ts`
- `tests/target/t5-supply-policy.test.mjs`
- `tests/target/t5-worker-multitenant.integration.test.ts`
- `tests/target/t5-worker.integration.test.ts`
- `tsconfig.target.json`

## Files Added

- `apps/web/static/brand/targoman-login.png`
- `docs/reports/20261004-2248-LEGACY-RAG-UX-CORRECTIONS.md`

## Files Modified

- `apps/web/src/lib/server/deployment.ts`
- `apps/web/src/lib/styles/main.scss`
- `apps/web/src/routes/(public)/login/+page.server.ts`
- `apps/web/src/routes/(public)/login/+page.svelte`
- `apps/web/src/routes/(user)/rag/+page.svelte`
- `docs/verification/05-development-rag-dual-auth-fa.md`
- `docs/verification/06-legacy-rag-functional-parity-fa.md`
- `packages/configuration/src/index.ts`
- `scripts/dev-rag-prepare.ts`
- `scripts/dev-rag.mjs`
- `tests/target/t5-r3-browser.smoke.mjs`

## Files Deleted

- None.

## Implementation Summary

- Restyled `/login` using the legacy blue gradient, white card, light-background logo, key field, two actions, divider, organizational login slot, and key guidance. The logo is selected through the active BrandProfile projection.
- Enabled Legacy Key self-provision by default only in the local development launcher; `--no-legacy-self-provision` disables it. Generated keys remain browser-only until explicitly submitted.
- Added empty-conversation layout state for `/rag`; the first optimistic message switches the composer to the normal bottom position. New or emptied chats return to the centered layout.
- Updated the development operator documentation and the browser smoke test for key generation and composer positions.

## Architecture Decisions / Deviations

- BrandProfile accepts optional `logoLight`, validated as a safe `/brand/` asset, while existing profiles retain the previous logo fallback. This avoids naming a customer asset in a generic component.
- Self-provision remains prohibited by configuration validation outside deployment `development` and uses the explicit onboarding tenant and role.
- No governing-source deviation was introduced.

## Tests and Verification

- PASS: `npm run check:web` (0 errors, 0 warnings).
- PASS: `npm run check:target`.
- PASS: `npm run build:web`.
- PASS: configuration loader accepted a temporary development config with `legacyKey.selfProvision=true` and the new `brand.logoLight`.
- PASS: local Vite `/login` returned HTTP 200; headless Chrome visual inspection showed the reference layout; Chrome clicked “تولید کلید جدید” and observed a visible 32-character key.
- PASS: `node --check` for the modified browser smoke test and development launcher.
- NOT RUN: complete RAG browser model flow requires live embedding, rerank, and RAG answer bindings; the position assertions were added to `tests/target/t5-r3-browser.smoke.mjs` for that run.
- PASS: protected-path diff remained empty at task completion.

## Expected Failures

- The live self-provision integration test was skipped without its required database environment. Existing RAG model readiness remains independent of these UI corrections.

## Unexpected Failures

- Temporary local Vite bind was blocked by sandbox EPERM; an approved local bind succeeded on port 5181. A temporary Chrome check initially clicked before Svelte hydration and was rerun after hydration; it passed. Temporary files and server were removed.

## Production Code Changes

- Development configuration, BrandProfile presentation projection, `/login` page and shell styling, and `/rag` composer layout changed. No business authorization or model routing logic changed.

## Final Repository State

- Working tree retains earlier T5 changes. This task added the report and light logo asset and edited only the Files Modified paths above.

```text
 M ui/apps/api/src/composition.ts
 M ui/apps/api/src/index.ts
 M ui/apps/api/src/knowledge.ts
 M ui/apps/runtime/src/composition.ts
 M ui/apps/web/src/lib/api/transport.ts
 M ui/apps/web/src/lib/auth/client.svelte.ts
 M ui/apps/web/src/lib/knowledge/client.ts
 M ui/apps/web/src/lib/server/deployment.ts
 M ui/apps/web/src/lib/styles/main.scss
 M ui/apps/web/src/routes/(public)/login/+page.server.ts
 M ui/apps/web/src/routes/(public)/login/+page.svelte
 M ui/apps/web/src/routes/(user)/+layout.svelte
 M ui/apps/web/src/routes/(user)/knowledge/+page.server.ts
 M ui/apps/web/src/routes/(user)/knowledge/+page.svelte
 M ui/apps/web/vite.config.ts
 M ui/apps/worker/src/composition.ts
 M ui/deploy/customer.Dockerfile
 M ui/docs/reports/20261004-1340-T5-R1-INDEPENDENT-HARDENING.md
 M ui/docs/security/03-t5-asvs-5.0-level3-assessment-fa.md
 M ui/docs/security/03-t5-rag-security-delta-fa.md
 M ui/docs/security/06-t5-genai-rag-security-gate.md
 M ui/modules/faq/src/service.ts
 M ui/modules/summarizer/src/service.ts
 M ui/modules/translator/src/persistence/migrate.ts
 M ui/modules/translator/src/service.ts
 M ui/package.json
 M ui/packages/admission-control/src/files.ts
 M ui/packages/admission-control/src/persistence/files.ts
 M ui/packages/ai-router/src/index.ts
 M ui/packages/ai-router/src/protected.ts
 M ui/packages/audit/src/index.ts
 M ui/packages/authentication/src/index.ts
 M ui/packages/authentication/src/persistence.ts
 M ui/packages/authentication/src/service.ts
 M ui/packages/authority/src/persistence.generic.ts
 M ui/packages/authority/src/persistence.ts
 M ui/packages/authority/src/service.ts
 M ui/packages/configuration/src/cli.ts
 M ui/packages/configuration/src/index.ts
 M ui/packages/contracts/src/protected-ai.ts
 M ui/packages/documents/src/index.ts
 M ui/packages/documents/src/persistence.ts
 M ui/packages/documents/src/service.ts
 M ui/packages/file-management/src/cache.ts
 M ui/packages/file-management/src/persistence.ts
 M ui/packages/file-management/src/private-filesystem.ts
 M ui/packages/file-management/src/service.ts
 M ui/packages/file-management/src/staging.ts
 M ui/packages/file-management/src/transfers.ts
 M ui/packages/file-processing/src/index.ts
 M ui/packages/identity/src/persistence.ts
 M ui/packages/jobs/src/index.ts
 M ui/packages/jobs/src/persistence.ts
 M ui/packages/jobs/src/worker.ts
 M ui/packages/knowledge/src/adapters/qdrant.ts
 M ui/packages/knowledge/src/index.ts
 M ui/packages/knowledge/src/persistence.ts
 M ui/packages/knowledge/src/service.ts
 M ui/packages/persistence/src/target.ts
 M ui/packages/storage/src/adapters/local.ts
 M ui/packages/storage/src/adapters/s3.ts
 M ui/packages/storage/src/index.ts
 M ui/reports/security/asvs-5.0-l3.json
 M ui/reports/security/rag-security-gate.json
 M ui/reports/security/t5-asvs-review.json
 M ui/reports/security/t5-completion-gate.json
 M ui/reports/security/t5-protected-paths-after.json
 M ui/reports/security/t5-supply-chain.json
 M ui/scripts/t5-audit-siem.mjs
 M ui/scripts/t5-completion-gate.mjs
 M ui/scripts/t5-live-model-acceptance.ts
 M ui/scripts/t5-protected-paths.mjs
 M ui/scripts/t5-security-assessment.mjs
 M ui/scripts/t5-supply-chain.mjs
 M ui/tests/architecture/staticAnalysis.test.ts
 M ui/tests/architecture/support/staticAnalysis.ts
 M ui/tests/configuration/t5-file-management.test.ts
 M ui/tests/reports/oci/acceptance.json
 M ui/tests/reports/oci/customer-a-api-build.log
 M ui/tests/reports/oci/customer-a-sbom.cdx.json
 M ui/tests/reports/oci/customer-a-web-build.log
 M ui/tests/reports/oci/customer-a-worker-build.log
 M ui/tests/reports/oci/customer-b-api-build.log
 M ui/tests/reports/oci/customer-b-sbom.cdx.json
 M ui/tests/reports/oci/customer-b-web-build.log
 M ui/tests/reports/oci/customer-b-worker-build.log
 M ui/tests/reports/oci/customer-c-api-build.log
 M ui/tests/reports/oci/customer-c-sbom.cdx.json
 M ui/tests/reports/oci/customer-c-web-build.log
 M ui/tests/reports/oci/customer-c-worker-build.log
 M ui/tests/reports/oci/dependency-vulnerabilities.json
 M ui/tests/reports/oci/runtime-dependency-vulnerabilities.json
 M ui/tests/reports/oci/runtime-vulnerabilities.json
 M ui/tests/reports/t5-audit-siem.tap
 M ui/tests/target/support/t5-live-subject.ts
 M ui/tests/target/support/t5-runtime-fixture.ts
 M ui/tests/target/t44-authority-live.integration.test.ts
 M ui/tests/target/t5-browser.integration.test.mjs
 M ui/tests/target/t5-file-cache.test.ts
 M ui/tests/target/t5-file-management.integration.test.ts
 M ui/tests/target/t5-rag-security.integration.test.ts
 M ui/tests/target/t5-worker.integration.test.ts
 M ui/tsconfig.target.json
?? ui/apps/web/src/routes/(user)/rag/+page.server.ts
?? ui/apps/web/src/routes/(user)/rag/+page.svelte
?? ui/apps/web/static/brand/targoman-login.png
?? ui/apps/web/static/brand/targoman-rag.png
?? ui/docs/backend/13-t5-r1-hardening.md
?? ui/docs/deployment/04-t5-r1-service-boundaries.md
?? ui/docs/prompts/T5-R2.md
?? ui/docs/prompts/T5-R3.md
?? ui/docs/reports/20261004-1559-T5-R1-1-VERIFICATION-GATE-REPAIR.md
?? ui/docs/reports/20261004-2024-T5-R2-DEV-RAG-DUAL-AUTH.md
?? ui/docs/reports/20261004-2117-T5-R2-DEV-LOGIN-TRANSLATE-REPAIR.md
?? ui/docs/reports/20261004-2157-LEGACY-RAG-FUNCTIONAL-PARITY.md
?? ui/docs/reports/20261004-2248-LEGACY-RAG-UX-CORRECTIONS.md
?? ui/docs/security/00-current-status.md
?? ui/docs/security/08-t5-authority-decision-boundary-fa.md
?? ui/docs/verification/04-t5-r1-1-verification-fa.md
?? ui/docs/verification/05-development-rag-dual-auth-fa.md
?? ui/docs/verification/06-legacy-rag-functional-parity-fa.md
?? ui/packages/authentication/src/oidc.ts
?? ui/packages/authority/src/persistence.onboarding.ts
?? ui/packages/data-governance/src/persistence.ts
?? ui/packages/data-governance/src/retention.ts
?? ui/packages/file-management/src/scratch-quota.ts
?? ui/packages/file-processing/src/malware.ts
?? ui/packages/file-processing/src/native-parser.mjs
?? ui/packages/file-processing/src/sandbox.ts
?? ui/packages/knowledge/src/persistence/chat.ts
?? ui/packages/knowledge/src/personal-chat-contracts.ts
?? ui/packages/knowledge/src/personal-chat.ts
?? ui/packages/persistence/src/bootstrap-rag-dev.ts
?? ui/packages/persistence/src/target-migrations/021-deployment-worker-queue.sql
?? ui/packages/persistence/src/target-migrations/022-authority-materialization-fence.sql
?? ui/packages/persistence/src/target-migrations/023-governance-retention-lifecycle.sql
?? ui/packages/persistence/src/target-migrations/024-governed-owner-purge.sql
?? ui/packages/persistence/src/target-migrations/025-governed-owner-rls-scope.sql
?? ui/packages/persistence/src/target-migrations/026-dual-auth-credentials.sql
?? ui/packages/persistence/src/target-migrations/027-development-legacy-onboarding.sql
?? ui/packages/persistence/src/target-migrations/028-knowledge-personal-chats.sql
?? ui/reports/security/t5-acceptance-evidence.json
?? ui/reports/security/t5-authority-inventory.json
?? ui/reports/security/t5-direct-evidence.json
?? ui/reports/security/t5-live-model-evidence.json
?? ui/reports/security/t5-preliminary-gates.json
?? ui/reports/security/t5-r1-1-protected-before.json
?? ui/reports/security/t5-r1-1-verification.json
?? ui/reports/security/t5-r1-open-findings.json
?? ui/reports/security/t5-r1-protected-before.json
?? ui/reports/security/t5-service-boundary-assessment.json
?? ui/scripts/dev-rag-auth-proxy.mjs
?? ui/scripts/dev-rag-browser.mjs
?? ui/scripts/dev-rag-cert.py
?? ui/scripts/dev-rag-prepare.ts
?? ui/scripts/dev-rag-qdrant.mjs
?? ui/scripts/dev-rag.mjs
?? ui/scripts/t5-acceptance-evidence.mjs
?? ui/scripts/t5-asvs-evidence.mjs
?? ui/scripts/t5-authority-inventory.mjs
?? ui/scripts/t5-evidence-gate.mjs
?? ui/scripts/t5-preliminary-gates.mjs
?? ui/scripts/t5-protected-policy.mjs
?? ui/scripts/t5-r1-1-gate.mjs
?? ui/scripts/t5-r1-acceptance.mjs
?? ui/scripts/t5-r1-reporter.mjs
?? ui/scripts/t5-r1-source.mjs
?? ui/scripts/t5-service-boundary-assessment.mjs
?? ui/scripts/t5-supply-policy.mjs
?? ui/tests/reports/oci/runtime-06485210916857e2-vulnerabilities.json
?? ui/tests/reports/oci/runtime-2a36791ae2433eea-vulnerabilities.json
?? ui/tests/reports/oci/runtime-3104005ed99153e3-vulnerabilities.json
?? ui/tests/reports/oci/runtime-a39ccef4089a684b-vulnerabilities.json
?? ui/tests/reports/oci/runtime-b2e277040912fe02-vulnerabilities.json
?? ui/tests/reports/oci/runtime-c596bc0f3228e84d-vulnerabilities.json
?? ui/tests/reports/oci/runtime-f980c0d9a60aafed-vulnerabilities.json
?? ui/tests/reports/t5-r1-execution.json
?? ui/tests/reports/t5-r1/architecture.log
?? ui/tests/reports/t5-r1/audit-siem.log
?? ui/tests/reports/t5-r1/auth-http.log
?? ui/tests/reports/t5-r1/authority-conformance.log
?? ui/tests/reports/t5-r1/authority-inventory.log
?? ui/tests/reports/t5-r1/authority-live.log
?? ui/tests/reports/t5-r1/browser.log
?? ui/tests/reports/t5-r1/build-web.log
?? ui/tests/reports/t5-r1/foundations.log
?? ui/tests/reports/t5-r1/integrations.log
?? ui/tests/reports/t5-r1/r1-hardening.log
?? ui/tests/reports/t5-r1/strict-target.log
?? ui/tests/reports/t5-r1/strict-web.log
?? ui/tests/reports/t5-r1/t5-architecture.log
?? ui/tests/reports/t5-r1/ui.log
?? ui/tests/target/support/t5-adversarial-corpus.ts
?? ui/tests/target/t5-authority-post-t5-inventory.test.mjs
?? ui/tests/target/t5-cache-concurrency.test.ts
?? ui/tests/target/t5-evidence-selftest.test.mjs
?? ui/tests/target/t5-genai-adversarial.test.ts
?? ui/tests/target/t5-job-idempotency-security.integration.test.ts
?? ui/tests/target/t5-malware-policy.test.ts
?? ui/tests/target/t5-parser-sandbox.test.ts
?? ui/tests/target/t5-protected-policy.test.mjs
?? ui/tests/target/t5-r2-browser.smoke.mjs
?? ui/tests/target/t5-r2-dual-auth.integration.test.ts
?? ui/tests/target/t5-r2-oidc.test.ts
?? ui/tests/target/t5-r2-self-provision.integration.test.ts
?? ui/tests/target/t5-r3-browser.smoke.mjs
?? ui/tests/target/t5-r3-chat.integration.test.ts
?? ui/tests/target/t5-retention-purge.integration.test.ts
?? ui/tests/target/t5-security-race.integration.test.ts
?? ui/tests/target/t5-supply-policy.test.mjs
?? ui/tests/target/t5-worker-multitenant.integration.test.ts
```

## Acceptance Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| 1 | PASS | Login layout visually checked in Chrome against the supplied screenshot. |
| 2 | PASS | Development generation control visible and Chrome generated a 32-character key. |
| 3 | PASS | Empty and populated composer states implemented; Web check and build passed; browser smoke assertions added. |
| 4 | PASS | No protected governing or prompt paths changed. |

## Open Issues

- Full browser proof of the composer move after a real first answer remains dependent on configured RAG models. Run `T5_R3_REQUIRE_MODEL=1 npm run test:t5:r3:browser` once those bindings are ready.
- Restart `npm run dev:rag` to regenerate its configuration and expose the generation control in the running process.

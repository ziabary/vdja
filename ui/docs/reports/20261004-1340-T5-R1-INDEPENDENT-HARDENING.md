# Activity Report: T5-R1-INDEPENDENT-HARDENING

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261004-1340-T5-R1-INDEPENDENT-HARDENING.md
- Created At: 2026-10-04T10:10:45.357Z
- Status: PARTIAL

## Purpose and Scope

Complete the T5-R1 independent hardening prompt and reassess current evidence without changing protected governing sources.

## Governing Sources

`AGENTS.md`; `docs/architecture/00-manifest.md` through `10-commercial-architecture.md`; protected task inputs `docs/prompts/T5-R1.MD` and `docs/prompts/T5-final.md`.

## Initial Repository State

The T5-R1 source and test work was already in progress and uncommitted. Completion and ASVS evidence was stale, local PostgreSQL was stopped, and approved actual-model and customer deployment evidence was unavailable. A protected-file baseline was captured.

## Pre-existing Workspace Changes

Inherited R1 edits and untracked files were part of this continuing task; the inventory below accounts for the resulting worktree without claiming sole authorship of each line. Unrelated user files in sibling directories outside `ui` were left untouched.

## Files Added

- `docs/backend/13-t5-r1-hardening.md`
- `docs/deployment/04-t5-r1-service-boundaries.md`
- `docs/security/00-current-status.md`
- `docs/security/08-t5-authority-decision-boundary-fa.md`
- `packages/data-governance/src/persistence.ts`
- `packages/data-governance/src/retention.ts`
- `packages/file-management/src/scratch-quota.ts`
- `packages/file-processing/src/malware.ts`
- `packages/file-processing/src/native-parser.mjs`
- `packages/file-processing/src/sandbox.ts`
- `packages/persistence/src/target-migrations/021-deployment-worker-queue.sql`
- `packages/persistence/src/target-migrations/022-authority-materialization-fence.sql`
- `packages/persistence/src/target-migrations/023-governance-retention-lifecycle.sql`
- `packages/persistence/src/target-migrations/024-governed-owner-purge.sql`
- `packages/persistence/src/target-migrations/025-governed-owner-rls-scope.sql`
- `reports/security/t5-acceptance-evidence.json`
- `reports/security/t5-authority-inventory.json`
- `reports/security/t5-live-model-evidence.json`
- `reports/security/t5-r1-open-findings.json`
- `reports/security/t5-r1-protected-before.json`
- `scripts/t5-acceptance-evidence.mjs`
- `scripts/t5-asvs-evidence.mjs`
- `scripts/t5-authority-inventory.mjs`
- `scripts/t5-evidence-gate.mjs`
- `scripts/t5-protected-policy.mjs`
- `scripts/t5-r1-acceptance.mjs`
- `scripts/t5-r1-reporter.mjs`
- `scripts/t5-r1-source.mjs`
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
- `tests/target/t5-authority-post-t5-inventory.test.mjs`
- `tests/target/t5-cache-concurrency.test.ts`
- `tests/target/t5-evidence-selftest.test.mjs`
- `tests/target/t5-genai-adversarial.test.ts`
- `tests/target/t5-job-idempotency-security.integration.test.ts`
- `tests/target/t5-malware-policy.test.ts`
- `tests/target/t5-parser-sandbox.test.ts`
- `tests/target/t5-protected-policy.test.mjs`
- `tests/target/t5-retention-purge.integration.test.ts`
- `tests/target/t5-security-race.integration.test.ts`
- `tests/target/t5-worker-multitenant.integration.test.ts`

## Files Modified

- `apps/api/src/index.ts`
- `apps/api/src/knowledge.ts`
- `apps/runtime/src/composition.ts`
- `apps/worker/src/composition.ts`
- `deploy/customer.Dockerfile`
- `docs/reports/20261004-1340-T5-R1-INDEPENDENT-HARDENING.md`
- `docs/security/03-t5-asvs-5.0-level3-assessment-fa.md`
- `docs/security/03-t5-rag-security-delta-fa.md`
- `docs/security/06-t5-genai-rag-security-gate.md`
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
- `packages/documents/src/index.ts`
- `packages/documents/src/persistence.ts`
- `packages/documents/src/service.ts`
- `packages/file-management/src/cache.ts`
- `packages/file-management/src/persistence.ts`
- `packages/file-management/src/private-filesystem.ts`
- `packages/file-management/src/service.ts`
- `packages/file-management/src/staging.ts`
- `packages/file-management/src/transfers.ts`
- `packages/file-processing/src/index.ts`
- `packages/jobs/src/index.ts`
- `packages/jobs/src/persistence.ts`
- `packages/jobs/src/worker.ts`
- `packages/knowledge/src/adapters/qdrant.ts`
- `packages/knowledge/src/index.ts`
- `packages/knowledge/src/persistence.ts`
- `packages/knowledge/src/service.ts`
- `packages/persistence/src/target.ts`
- `packages/storage/src/adapters/local.ts`
- `packages/storage/src/adapters/s3.ts`
- `packages/storage/src/index.ts`
- `reports/security/asvs-5.0-l3.json`
- `reports/security/rag-security-gate.json`
- `reports/security/t5-asvs-review.json`
- `reports/security/t5-completion-gate.json`
- `reports/security/t5-protected-paths-after.json`
- `reports/security/t5-supply-chain.json`
- `scripts/t5-audit-siem.mjs`
- `scripts/t5-completion-gate.mjs`
- `scripts/t5-live-model-acceptance.ts`
- `scripts/t5-protected-paths.mjs`
- `scripts/t5-security-assessment.mjs`
- `scripts/t5-supply-chain.mjs`
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
- `tests/reports/oci/runtime-dependency-vulnerabilities.json`
- `tests/reports/oci/runtime-vulnerabilities.json`
- `tests/reports/t5-audit-siem.tap`
- `tests/target/support/t5-live-subject.ts`
- `tests/target/support/t5-runtime-fixture.ts`
- `tests/target/t44-authority-live.integration.test.ts`
- `tests/target/t5-file-cache.test.ts`
- `tests/target/t5-file-management.integration.test.ts`
- `tests/target/t5-rag-security.integration.test.ts`
- `tests/target/t5-worker.integration.test.ts`
- `tsconfig.target.json`

## Files Deleted

- None.

## Implementation Summary

CONFIRMED_DEFECT: deployment Worker claiming was tied to one tenant; identity/idempotency and materialization had race risks. IMPLEMENTED_FIX: deployment-wide claims with per-job human/tenant context, stable idempotency identity, authorization fences and provider checks. VERIFIED: live PostgreSQL two-tenant, retry and deterministic race tests pass.

CONFIRMED_DEFECT: cache/staging, scanner, parser and retention needed stronger fail-closed and concurrency behavior. IMPLEMENTED_FIX: isolated cache fill, bounded staging, clamd-compatible scanner port, parser subprocess sandbox and governed purge/hold. VERIFIED: focused and live local tests pass; deployment evidence remains open.

CONFIRMED_FALSE_POSITIVE_EVIDENCE: broad T5 feature success had produced unsupported acceptance and ASVS PASS claims. IMPLEMENTED_FIX: source/artifact-bound criterion map, negative gate self-tests, conservative ASVS reassessment and independent completion gate. VERIFIED: map integrity passes; 60 direct PASS, 37 NOT_VERIFIED, 3 FAIL.

The ASVS blocker classifier initially missed the version prefix. Its regression is fixed; 61 current blockers are individually classified in `reports/security/t5-r1-open-findings.json`. The historical start-gate backlog remains intact.

## Architecture Decisions / Deviations

No governing architecture or prompt changed. Authority remains the only authorization owner. The inventory found 37 post-T5 production consumer sites and zero production bypasses. Complete ALLOW/DENY Audit/SIEM proof for every consumer remains NOT_VERIFIED.

## Tests and Verification

PASS: final T5-R1 source-bound runner; strict target/web, Authority conformance 39/39, live Authority 7/7, Auth HTTP 1/1, foundations 34/34, integrations 90/90, hardening 70/70, browser 1/1, Audit/SIEM 7/7, architecture/UI/build. Zero skipped cases. PASS: independent RAG start gate with TLS verification enabled; OCI A/B/C API/Worker/Web; protected gate (68 files, zero unauthorized). PASS: evidence-map positive and negative self-tests. FAIL as designed: completion and GenAI gates, customer ASVS release and shipped-runtime supply scan. Actual approved model corpus: 0/0, NOT_VERIFIED.

## Expected Failures

T5 remains PARTIAL: 37 criteria NOT_VERIFIED, 3 FAIL, 61 T5-scope blockers, 69 separate release-only blockers, and full post-T5 Authority audit coverage unproved. Trivy reports 97 HIGH/CRITICAL shipped-runtime findings and zero fixes available in the pinned offline database; none waived. Approved model config, real scanner, customer service authentication/TLS, parser host isolation and backup purge proof are absent.

## Unexpected Failures

None remain in the final suite. The initial RAG gate inherited host `NODE_TLS_REJECT_UNAUTHORIZED=0` and correctly failed SIEM verification; rerun with TLS verification enabled passed.

## Production Code Changes

Worker queue/identity, Authority/materialization fences, AI Router protected dispatch, File Management/cache/staging, scanner/parser, retention/purge, Storage, Document and Knowledge integrations were hardened. See path inventory above.

## Final Repository State

Combined T5-R1 changes remain uncommitted. Protected governing diff and baseline comparison are zero. Local execution, OCI and derived security reports are current for their respective source hashes. T5 remains PARTIAL; customer Level-3 release and next business-module migration are not authorized.

## Acceptance Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| 1 | PASS | Two-tenant Worker, idempotency, race and infrastructure regressions in `tests/reports/t5-r1-execution.json`. |
| 2 | PASS | Criterion-map integrity; 60 direct evidence entries and zero broad-derived PASS. |
| 3 | PASS | Protected-path gate: zero unauthorized changes. |
| 4 | FAIL | Full T5 completion: 37 NOT_VERIFIED and 3 FAIL acceptance criteria. |
| 5 | FAIL | Actual model, T5 security and customer ASVS release gates remain open. |

## Open Issues

REMAINS_NOT_VERIFIED: 37 acceptance criteria, ASVS V15.4.2 full scope, post-T5 Authority Audit/SIEM coverage, actual approved model behavior. RELEASE_ONLY: 69 separate customer ASVS blockers. EXTERNAL_EVIDENCE_REQUIRED: approved model config, scanner/signatures, customer TLS/service identity/rotation, host sandbox, IAM and backup purge. CODE_FIX_REQUIRED: V12.3.5 and V13.2.1 remain open. No approved exceptions.

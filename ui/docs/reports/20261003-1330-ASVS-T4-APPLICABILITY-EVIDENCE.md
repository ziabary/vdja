# Activity Report: ASVS-T4-APPLICABILITY-EVIDENCE

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261003-1330-ASVS-T4-APPLICABILITY-EVIDENCE.md
- Created At: 2026-10-03T10:00:38.692Z
- Status: PARTIAL

## Purpose and Scope

- Reassess every OWASP ASVS 5.0.0 Level 1–3 requirement against the current T4 target, with Persian descriptions, applicability, evidence and a T4.3-B backlog.
- Assessment and minimal verification support only; T4 remains PARTIAL and T5/RAG remains blocked.

## Governing Sources

- `docs/architecture/00-manifest.md` through `docs/architecture/10-commercial-architecture.md`, especially authorization, deployment, document/file and engineering conventions.
- `docs/prompts/T4.3-A.md`, the latest T4/T4.1/T4.2 Activity Reports, backend/security contracts and the official OWASP ASVS 5.0.0 flat JSON identified in the assessment.
- Current target source, tests, customer image/release evidence and shipped runtime lockfile.

## Initial Repository State

- Assessment baseline: 345 controls; 4 PASS, 6 FAIL, 0 N/A, 335 NOT_VERIFIED. Six known FAIL IDs were preserved.
- The T4.2 workspace had prior edits and untracked artifacts at task start. The current report was created with `npm run report:start -- ASVS-T4-APPLICABILITY-EVIDENCE` before this task's repository edits.

## Pre-existing Workspace Changes

- `apps/api/src/index.ts` — existing T4.2 edit; not changed by this task.
- `docs/backend/04-t4-identity-session-authority.md` — existing T4.2 edit, then reconciled further here.
- `docs/security/01-asvs-5.0-level3-assessment-fa.md` — existing T4.2 edit, then rewritten for this review.
- `docs/security/02-t4-threat-model-fa.md` — existing T4.2 edit; not changed here.
- `docs/security/03-t4-refresh-cookie-decision-fa.md` — existing T4.2 edit; not changed here.
- `packages/configuration/src/index.ts` — existing T4.2 edit; not changed here.
- `packages/session/src/cookie.ts` — existing T4.2 edit; not changed here.
- `reports/security/asvs-5.0-l3.json` — existing T4.2 edit, then expanded here.
- `tests/target/t4-auth-cookie.test.ts` — existing T4.2 edit; not changed here.
- `tests/target/t4-auth-http.integration.test.ts` — existing T4.2 edit; not changed here.
- `tests/target/t4-auth-service.test.ts` — existing T4.2 edit; not changed here.
- `docs/prompts/T4.2.md`, `docs/prompts/T4.3-A.md` and `docs/reports/20261003-1251-SECURITY-IDENTITY-AUTHORITY-T4-FINAL.md` — pre-existing untracked inputs/report; not changed here.
- Untracked paths outside `ui/` belong to the surrounding workspace and are outside this report's repository scope.

## Files Added

- `docs/reports/20261003-1330-ASVS-T4-APPLICABILITY-EVIDENCE.md`
- `docs/security/04-t4-asvs-applicability-matrix-fa.md`
- `reports/security/t4-target-scope-inventory.json`

## Files Modified

- `docs/backend/04-t4-identity-session-authority.md`
- `docs/security/01-asvs-5.0-level3-assessment-fa.md`
- `reports/security/asvs-5.0-l3.json`
- `scripts/t4-gate.mjs`

## Files Deleted

- None.

## Implementation Summary

- Reconciled stale Auth/public-tool, browser, Usage, Audit and SIEM statements before classification.
- Reviewed all 345 official requirements and filled all 345 Persian descriptions. The matrix records 63 PASS, 20 FAIL, 100 technically justified N/A and 162 NOT_VERIFIED; all 335 previously unverified controls were reviewed.
- Recorded current routes, SSE, file upload, outbound HTTP, absent protocols, application crypto, runtime packages/base image/SBOM caveat and vulnerability-scan limit in a machine-readable inventory.
- Created a Persian chapter matrix and complete 182-row unresolved backlog grouped by the nine requested gap categories. Twenty FAIL rows are confirmed implementation gaps; 36 open rows require manual/deployment verification. Other NOT_VERIFIED rows require their specified test or review before implementation need can be determined.
- Strengthened the existing ASVS gate's evidence-shape checks for Persian/English text, N/A paths, missing-evidence text and count consistency. The gate remains closed.

## Architecture Decisions / Deviations

- N/A is limited to an absent prerequisite condition in the current target. Future T5 capability is not counted as implementation.
- Four prior cookie PASS decisions and all six prior FAIL decisions were retained. FAQ `originalname` exposure was classified FAIL under V5.4.1; lock provenance and UTC formatting alone were insufficient to claim V15.2.4 or V16.2.2 PASS.
- No target production behavior or governing architecture changed. The ASVS assessment remains PARTIAL; no RAG gate was opened.

## Tests and Verification

- PASS: row-structure inspection found 345 unique IDs, 345 reviewed rows, 345 Persian descriptions, 100/100 N/A reasons, 63/63 PASS evidence entries, valid existing source/test paths and all six known FAIL statuses.
- PASS: `node --check scripts/t4-gate.mjs` and `git diff --check` (exit 0).
- Expected FAIL: `npm run test:security:asvs:l3` (exit 1, `ASVS_L3_GATE_OPEN: 182`), after all new evidence-shape checks passed.
- Runtime lock inspection found 103 package entries, all with integrity and the expected npm registry; release lock/SBOM hashes match the existing 1.0.1 manifest. This does not prove a fresh current-image SBOM or a clean vulnerability scan.

## Expected Failures

- The ASVS Level 3 completion gate correctly reports 182 applicable controls still open: 20 FAIL and 162 NOT_VERIFIED.
- Coordinated Auth-enabled customer Web/API/Worker image, TLS edge, HSM, log clock sync and fresh vulnerability scan remain unqualified.

## Unexpected Failures

- `npm audit --omit=dev --json` could not reach the registry in the restricted environment; the inherited `NODE_TLS_REJECT_UNAUTHORIZED=0` made the initial attempt unsuitable as security evidence.
- A second attempt with TLS verification restored was rejected by automatic approval review because sending runtime dependency metadata to the external npm registry was not authorized. No bypass was used, and no vulnerability-scan result is claimed.

## Production Code Changes

- None. Only assessment, inventory, documentation and ASVS gate validation changed.

## Final Repository State

- Files in this task are listed above. Pre-existing T4.2 changes were not claimed as new implementation. T4 overall remains PARTIAL; `READY_FOR_RAG_SECURITY_GATE = NO`.

## Acceptance Criteria

| Criterion | Result | Evidence |
|---|---|---|
| 1 | PASS | All 345 controls have official English text, Persian description, method, evidence or missing evidence, source paths, result, risk and remediation. |
| 2 | PASS | 100 N/A controls each contain a technical reason; 63 PASS controls each contain concrete evidence and paths. |
| 3 | PASS | Six previously known FAIL statuses remain FAIL; 20 confirmed implementation gaps are in the T4.3-B backlog. |
| 4 | PASS | Target route/protocol, crypto and supply-chain inventories and Persian chapter/gap matrix exist. |
| 5 | PASS | ASVS gate remains closed with 182 unresolved applicable requirements; T4 is PARTIAL and RAG is blocked. |
| 6 | FAIL | A clean online vulnerability scan was unavailable because external dependency-metadata transmission was rejected by automatic approval review; the control remains NOT_VERIFIED. |

## Open Issues

- Resolve 20 confirmed implementation gaps and verify 162 applicable controls, including 36 requiring manual/deployment evidence.
- Produce a fresh current-image SBOM and authorized vulnerability scan; qualify Auth-enabled Web/API/Worker and customer edge settings.
- Re-run ASVS Level 3 gate only after each applicable row has concrete closing evidence.

---

Generated by scripts/activity-report.ts; populated for T4.3-A.

# Activity Report: SECURITY-IDENTITY-AUTHORITY-T4-FINAL

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261003-1251-SECURITY-IDENTITY-AUTHORITY-T4-FINAL.md
- Created At: 2026-10-03T09:21:03.717Z
- Status: PARTIAL

## Purpose and Scope

- Continue T4.2 from the existing T4.1 baseline. T5 was not changed. The final gate remains closed unless every security and release criterion passes.

## Governing Sources

- `AGENTS.md`, `docs/architecture/00-manifest.md` through `10-commercial-architecture.md`, and scoped API/Web/Persistence/Authority instructions.
- `docs/prompts/T4.2.md`, the two latest T4 reports, T4 backend contracts, the three security documents, ASVS JSON, and executable T4 gates.

## Initial Repository State

- ALREADY_VERIFIED: PostgreSQL login/session/refresh, Ed25519 access tokens, production Authority on three public tools, tenant isolation, Human Usage/Audit/SIEM paths, and pure Authority conformance 39/39, as recorded by the preceding T4.1 report.
- ASVS: 4 PASS, 6 FAIL, 0 NOT_APPLICABLE, 335 NOT_VERIFIED. T4 and the RAG security gate were incomplete.
- The refresh parser returned null for duplicate cookies, but logout treated that as a missing cookie and returned success. Auth CORS lacked credentialed preflight behavior.

## Pre-existing Workspace Changes

- `docs/prompts/T4.2.md` was untracked before this task and is not claimed as an output.
- Untracked paths in the parent workspace were present before this task and were not modified here.

## Files Added

- `docs/reports/20261003-1251-SECURITY-IDENTITY-AUTHORITY-T4-FINAL.md`

## Files Modified

- `apps/api/src/index.ts`
- `docs/backend/04-t4-identity-session-authority.md`
- `docs/security/01-asvs-5.0-level3-assessment-fa.md`
- `docs/security/02-t4-threat-model-fa.md`
- `docs/security/03-t4-refresh-cookie-decision-fa.md`
- `packages/configuration/src/index.ts`
- `packages/session/src/cookie.ts`
- `reports/security/asvs-5.0-l3.json`
- `tests/target/t4-auth-cookie.test.ts`
- `tests/target/t4-auth-http.integration.test.ts`
- `tests/target/t4-auth-service.test.ts`

## Files Deleted

- None.

## Implementation Summary

- NEWLY_IMPLEMENTED: typed cookie inspection distinguishes valid, absent, malformed, and ambiguous refresh credentials. Refresh and logout reject ambiguous cookies with HTTP 400 before session mutation.
- NEWLY_IMPLEMENTED: CJSON requires exact allowed origins without path/query/trailing slash. Auth preflight permits only an approved Origin, POST, and declared `content-type`/`accept` headers; credentialed CORS varies by Origin.
- NEWLY_VERIFIED: live PostgreSQL/HTTP tests prove duplicate refresh/logout requests leave the valid session active and cover allowed, foreign, missing, malformed, wrong-method, and disallowed-header preflights.
- REMAINING_BLOCKER: dedicated Auth origin and `__Host-` refresh cookie are absent; this work cannot close V3.3.3 or the complete CSRF gate.

## Architecture Decisions / Deviations

- Authentication and Session still own credential/state semantics; transport rejects cookie ambiguity before calling them. CJSON owns accepted application origins.
- Refresh remains `__Secure-` at `Path=/api/auth` on the current host. It was not widened to `Path=/` without a dedicated Auth host.
- No ASVS status was promoted using these compensating controls.

## Tests and Verification

- PASS: `npm run test:session:unit`, `npm run test:auth:unit`, `npm run test:configuration`, `npm run check:target`, `npm run check:web`, `npm run test:architecture:target-ui`, `npm run test:architecture:target` (0 findings), `npm run test:conformance:authority` (39/39), and `git diff --check`.
- PASS with local PostgreSQL: `T4_PG_CONFIG=deploy/examples/development/platform.cjson T4_SECRETS_DIR=.secrets.t3.local npm run test:auth:live` and the same environment with `npm run test:public-tools:authenticated`.
- FAIL as designed: `npm run test:security:asvs:l3` reports `ASVS_L3_GATE_OPEN: 341`.
- No two-host browser/TLS-edge, complete CSRF, full Authority live matrix, built dual-profile release, MySQL-off dual release, or 345-control assessment was performed in this continuation.

## Expected Failures

- ASVS has six confirmed FAIL controls and 335 NOT_VERIFIED controls. The RAG gate stays NO.

## Unexpected Failures

- The first live Auth invocation was blocked by sandbox loopback `EPERM`; the approved local PostgreSQL run passed without code changes.

## Production Code Changes

- Cookie ambiguity, CJSON origin shape, and Auth CORS/preflight behavior changed. No persistence migration or T5 code changed.

## Final Repository State

- T4.2 = PARTIAL, T4 overall = PARTIAL, `READY_FOR_RAG_SECURITY_GATE = NO`. No customer Auth release is authorized.

## Acceptance Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| 1 | PASS | Duplicate-cookie rejection, exact configured Origin, and credentialed Auth preflight pass unit/live tests. |
| 2 | PASS | Authority conformance remains 39/39; target architecture has 0 findings; authenticated three-tool regression passes. |
| 3 | FAIL | Dedicated Auth origin and `__Host-` refresh cookie are absent; V3.3.3 remains FAIL. |
| 4 | FAIL | Password lifecycle, recovery, WebAuthn, notification, full Authority persistence, dual built releases, and ASVS review remain incomplete. |
| 5 | FAIL | ASVS L3 gate has 341 blockers; T4 cannot be COMPLETE and T5 cannot restart. |

## Open Issues

- Implement and verify dedicated customer-configured Auth host, `__Host-` cookie, host separation, TLS edge, browser/HTTP CSRF matrix, redirects, and customer release behavior.
- Implement and verify password change/screening, secure recovery, phishing-resistant MFA, suspicious-auth notifications, full session operations, and full persisted Authority matrix.
- Review all 345 ASVS rows individually; close applicable FAIL/NOT_VERIFIED controls with exact evidence or justified per-requirement N/A, then build and test both customer profiles including MySQL-off.

## Previous T4 Baseline

- ALREADY_VERIFIED: 39/39 Authority conformance, real Auth and public-tool PostgreSQL tests, tenant A/B/AB isolation, Human Usage/Audit/SIEM subset, access-token and refresh behavior, and 0 target findings. Previous customer evidence covered a built API image, not the required Web/API/Worker dual-profile release.

## New Implementation

- Typed duplicate-cookie rejection at both cookie-authenticated mutations; strict origin configuration and credentialed Auth preflight.

## Dedicated Auth-Origin Architecture

- FAIL: no dedicated deployed Auth host or `__Host-` refresh cookie.

## Password Lifecycle

- FAIL: no authenticated password-change path; local common-password screening lacks operational change/recovery coverage.

## Account Recovery

- FAIL: no single-use recovery flow or notification-provider handoff.

## MFA / WebAuthn

- FAIL: no phishing-resistant ceremony, factor lifecycle, or assured factor recovery.

## Session Lifecycle

- Existing PostgreSQL login, rotation, replay, logout, and bearer invalidation pass; selected/all-session operations and credential-change invalidation remain open.

## Full Authority Persistence Matrix

- FAIL: pure kernel 39/39 and public-tool subset pass, but persisted ACL, classification, clearance, recurring schedule, and full matrix are not verified.

## Tenant Isolation

- Previous live A/B/AB, token tenant, Authority and RLS evidence remains; authenticated three-tool regression passed again.

## Public Tool Authentication

- Anonymous/authenticated Translator, Summarizer, and FAQ plus differentiated limits remain in the prior baseline; authenticated live regression passed.

## Human Usage Accounting

- Existing HUMAN actor/session/tenant accounting passed in the live public-tool regression; no new semantics were added.

## Audit Matrix

- Existing Auth/Authority/public-tool semantic audit subset passed; password/recovery/MFA/session-management events cannot pass until those operations exist.

## SIEM Matrix

- Existing export subset passed; full required security-event, retry, UNKNOWN, and restart matrix remains open.

## Customer Release Evidence

- Prior built API image evidence is insufficient for the required Auth-enabled and Auth-disabled Web/API/Worker release pair. Both final gates FAIL.

## MySQL-Off Evidence

- Prior API-only smoke with MySQL stopped is preserved. The required dual built-release smoke remains FAIL.

## ASVS Summary

| Result | Count |
| --- | ---: |
| PASS | 4 |
| FAIL | 6 |
| NOT_APPLICABLE | 0 |
| NOT_VERIFIED | 335 |

## Remaining Risk

- Confirmed failures: `V3.3.3`, `V6.2.2`, `V6.2.4`, `V6.3.3`, `V6.3.5`, and `V6.4.3`. Another 335 controls lack verified evidence or justified N/A. Auth customer release and RAG use remain blocked.

## RAG Gate

- `T4 = PARTIAL`; `READY_FOR_RAG_SECURITY_GATE = NO`; T5 remains blocked.

---

Generated by scripts/activity-report.ts; expanded with evidence from this continuation.

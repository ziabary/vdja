# Activity Report: SECURITY-IDENTITY-AUTHORITY-T4

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-1917-SECURITY-IDENTITY-AUTHORITY-T4.md
- Created At: 2026-10-02T15:47:00.703Z
- Status: PARTIAL

## Purpose and Scope

- Purpose: SECURITY-IDENTITY-AUTHORITY-T4
- Scope: Address the four T3 review issues, establish T4 identity/session/Authority foundations, and assess the ASVS 5.0.0 Level 3 gate. Result is PARTIAL; no Auth-enabled customer release is claimed.

## Governing Sources

- User request and `docs/prompts/T4.md` as task specification, with repository `AGENTS.md` and scoped package instructions.
- `docs/architecture/00-manifest.md`, `01-system-architecture.md`, `02-engineering-conventions.md`, `03-persistence-and-database.md`, `04-authorization-model.md`, `05-module-architecture.md`, `06-document-and-rag.md`, `07-ai-router.md`, `08-deployment-architecture.md`, `09-notification-and-ticketing.md`, `10-commercial-architecture.md`.
- T2/T3 backend and customer-release documents; T3 report; existing Authority conformance and architecture tests.
- Actual Sepidjoo Auth, bearer, refresh and privilege-evaluation code, recorded in `docs/backend/04-t4-sepidjoo-source-evidence.md` before production changes.
- Official OWASP ASVS 5.0.0 flat JSON, SHA-256 `8201b20eec2908c3380ac600c91c8ba746346fbb808859366abb232027532311`.

## Initial Repository State

- T3 target code and reports were already present. No tracked T4 production files were modified at task start.
- `docs/prompts/T4.md` was an untracked user-provided task document.
- The codebase-memory MCP search was attempted and returned `Transport closed`; fallback source inspection used repository tools.

## Pre-existing Workspace Changes

- `docs/prompts/T4.md` — user-provided T4 specification; not authored by this task.
- `docs/prompts/T5.md` — user-owned file that appeared during this turn; not read or modified for T4.
- `docs/prompts/T5-addendum.md` — user-owned file that appeared during this turn; not read or modified for T4.

## Files Added

- `docs/backend/04-t4-identity-session-authority.md`
- `docs/backend/04-t4-sepidjoo-source-evidence.md`
- `docs/backend/05-t4-authenticated-public-services.md`
- `docs/deployment/02-auth-enabled-customer-release.md`
- `docs/reports/20261002-1917-SECURITY-IDENTITY-AUTHORITY-T4.md`
- `docs/security/01-asvs-5.0-level3-assessment-fa.md`
- `docs/security/02-t4-threat-model-fa.md`
- `docs/verification/01-t3-four-point-verification-fa.md`
- `packages/authentication/package.json`
- `packages/authentication/src/index.ts`
- `packages/authority/package.json`
- `packages/authority/src/index.ts`
- `packages/persistence/src/target-migrations/004-identity-session-authority.sql`
- `packages/session/package.json`
- `packages/session/src/index.ts`
- `packages/session/src/persistence.ts`
- `reports/security/asvs-5.0-l3.json`
- `scripts/t4-gate.mjs`
- `scripts/t4-target-architecture.ts`
- `tests/architecture/t4TargetArchitecture.test.ts`
- `tests/conformance/authority/productionAdapter.ts`
- `tests/reports/t4-target-architecture.json`
- `tests/target/t4-dictionary.integration.test.ts`
- `tests/target/t4-four-point.test.ts`
- `tests/target/t4-password.test.ts`
- `tests/target/t4-session.integration.test.ts`
- `tests/target/t4-session.test.ts`

## Files Modified

- `apps/api/src/index.ts`
- `deploy/customer.Dockerfile`
- `deploy/runtime/package-lock.json`
- `deploy/runtime/package.json`
- `modules/translator/src/persistence.ts`
- `modules/translator/src/persistence/migrate.ts`
- `package-lock.json`
- `package.json`
- `packages/ai-router/src/index.ts`
- `packages/configuration/src/index.ts`
- `packages/contracts/src/index.ts`
- `packages/security-telemetry/src/persistence.ts`
- `packages/security-telemetry/src/worker.ts`
- `tests/target/runtime.integration.test.ts`
- `tsconfig.target.json`

## Files Deleted

- None.

## Implementation Summary

- AI readiness now checks enabled-module task eligibility through health, circuit and capacity. No eligible task endpoint returns NOT_READY; a healthy fallback or SIEM outage produces DEGRADED. `/ready` returns HTTP 503 only for NOT_READY.
- Removed `mysql2` from normal runtime lock and removed dictionary migration bundle from customer images. The existing explicit migration CLI still owns legacy MySQL access. Customer C `1.0.1` Web/API/Worker images were built; SBOM and in-image dependency resolution contain no mysql/mysql2/knex.
- SIEM UNKNOWN is durable by default. Expired CLAIMED work becomes UNKNOWN when the destination has no explicit idempotency or duplicate-tolerance guarantee. Live local PostgreSQL/receiver test showed one accepted body with lost acknowledgement and no second delivery.
- Dictionary production contract is documented, `dicExamples` source mapping corrected, empty phrases rejected, lookup order stabilized. Live PostgreSQL lookup of `خدا` returned the JSON_FILE row with `god`.
- Added global identity, tenant membership, credential, session/refresh and generic Authority tables in target migration 004. Added scrypt password hashing, tenant session creation, atomic refresh rotation and replay revocation. A live PostgreSQL test covers normal and concurrent refresh. These are foundations, not an enabled login product.
- Added pure Authority production kernel and test binding. All 39 existing conformance cases pass. The kernel is not yet invoked by target HTTP requests.
- Produced Persian verification, threat and security reports plus 345-row ASVS machine evidence. All 345 controls remain NOT_VERIFIED until control-specific assessment; the RAG gate is NO. Explicit red scripts prevent missing authenticated/tenant/limit tests from appearing green.

## Architecture Decisions / Deviations

- No Auth-enabled customer profile, route, cookie or browser token flow was exposed while the complete control chain is absent. Existing T3 anonymous behavior remains the only deployed path.
- The ASVS applicability baseline conservatively treats all 345 Level 1–3 requirements as applicable until an individual technical N/A reason is documented. No certification or PASS is inferred from partial unit tests.
- The standard Node scrypt implementation uses the OWASP fallback floor N=2^17, r=8, p=1; deployment-configurable parameters, breach screening and MFA remain open.
- New normal runtime images omit migration-only MySQL dependencies; the root development workspace still retains the migration CLI and its dependency.
- The target architecture gate filters legacy `src/` findings and tests target paths explicitly. The repository-wide legacy guardrail remains unchanged and red for pre-existing violations.
- The draft T4 migration index prefix was corrected before external release. The local development database index and migration checksum were reconciled, then normal migration integrity returned `applied:0`.

## Tests and Verification

| Command / evidence | Result |
| --- | --- |
| `node --import tsx --test tests/target/t4-four-point.test.ts` | PASS 8/8 |
| `npm run test:conformance:authority` | PASS 39/39 |
| `npm run test:auth`; `npm run test:session`; live PostgreSQL `npm run test:session:live` | PASS focused foundation tests, including concurrent refresh and replay |
| `npm run test:security-telemetry` | PASS 8 focused + 7 PostgreSQL integration cases |
| Live PostgreSQL dictionary test for `خدا` | PASS JSON_FILE result includes `god` |
| `npm run db:target:migrate` | PASS 004 applied once; checksum rerun applied 0 |
| Customer C `1.0.1` image build and SBOM/runtime dependency inspection | PASS no mysql/mysql2/knex in three normal images |
| `npm run check:persistence`, `check:target`, `check:web`, `build`, `build:web`, `test:configuration`, `test:ai-router`, `test:ui`, `test:db:conformance`, `test:db:integration` | PASS; UI 107/107; DB conformance/integration all PASS |
| `npm run test:architecture:target`, `test:architecture:target-ui`; `git diff --check` | PASS; 0 target findings |
| `npm run test:security:asvs:l3` | Expected FAIL: 345 requirements not verified |
| `npm run test:tenant-isolation`, `test:public-tools:anonymous`, `test:public-tools:authenticated`, `test:public-tools:limits` | Expected FAIL: T4 live gates are not implemented/verified |
| Repository-wide `npm run test:architecture:authority` and prior persistence checker | Expected FAIL on legacy `src/` findings; no new target finding |

## Expected Failures

- ASVS Level 3 gate: 0/345 controls fully verified, 345 conservative blockers. Persian control-by-control descriptions and manual evidence are incomplete.
- Authenticated public services, tenant isolation, differentiated limits, MFA, access-token flow, cookies/CSRF, full Auth audit/SIEM, user bootstrap and UI are incomplete; their gates remain red.
- T3 four-point verification is not globally PASS because full MySQL-off three-service smoke for newly built images, real idempotent SIEM receiver, and live MySQL `dicExamples` import remain unverified.
- Repository-wide legacy architecture findings outside target paths remain; they were not introduced by this task.

## Unexpected Failures

- Initial live session fixture write lacked mutation audit context; corrected the test fixture to use the canonical transaction wrapper and reran PASS.
- Docker and local PostgreSQL access initially required sandbox escalation; approved read/build/test calls completed.
- No unresolved unexpected test failure remains. Runtime npm audit reported zero advisories, but its environment emitted a TLS-verification-disabled warning, so it is not treated as conclusive supply-chain evidence.

## Production Code Changes

- Target AI Router/readiness, SIEM state machine/persistence, runtime dependency image, dictionary normalization/import, and new Authority/Authentication/Session foundations were modified or added as listed above.
- No login route, token issuance or authenticated public-tool path was enabled.

## Final Repository State

- Tracked T4 source changes and added documentation/evidence are present and unstaged. User-owned T4/T5 prompt files are not claimed as task output.
- Local `targoman_platform_t3` PostgreSQL contains draft migration 004; customer C `1.0.1` images and release manifest are local ignored verification artifacts, not a deployment.
- T4 status is PARTIAL and `READY_FOR_RAG_SECURITY_GATE = NO`.

## Acceptance Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| 1 | PASS | AI readiness fallback/outage/circuit/capacity tests |
| 2 | PASS | Customer C normal image lock, SBOM and package inspection have no MySQL stack |
| 3 | PASS | SIEM UNKNOWN lost-ACK integration and no blind retry |
| 4 | PASS | Dictionary schema contract and live `خدا` JSON_FILE lookup |
| 5 | PASS | Authority production kernel conformance 39/39 |
| 6 | PASS | PostgreSQL session rotation/replay/concurrency foundation tests |
| 7 | FAIL | Complete Auth/Session/access-token/UI/tenant/public-service integration absent |
| 8 | FAIL | ASVS 5.0.0 Level 3 0/345 fully verified; RAG gate NO |
| 9 | FAIL | Required new-image MySQL-off all-service and authenticated end-to-end gates not complete |

## Open Issues

- Complete T4 login, MFA, durable abuse control, bootstrap, access-token key rotation/validation, narrow refresh cookie and CSRF protection, session management, tenant switching and revocation.
- Bind Authority to real API requests and persistence facts, register public-service permissions, centralize authenticated limits, and verify Usage/Audit/SIEM for HUMAN actors.
- Finish control-specific ASVS 5.0.0 Level 3 assessment with Persian descriptions and evidence, then rerun all live and architecture gates before any RAG migration or Auth-enabled release.

---

Generated by scripts/activity-report.ts; expanded during this task.

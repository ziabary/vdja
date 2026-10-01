# Activity Report: GUARDRAIL-PRECISION

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-0312-GUARDRAIL-PRECISION.md
- Created At: 2026-10-01T23:42:09.880Z
- Status: COMPLETE

## Purpose and Scope

T1.1 precision and regression correction only. No production migration or T2 database work.

## Governing Sources

AGENTS.md; docs/architecture/00-manifest.md through 10-commercial-architecture.md; docs/architecture/AGENTS.md; apps/api/AGENTS.md; apps/worker/AGENTS.md; packages/integrations/AGENTS.md; modules/secretariat/AGENTS.md.

## Initial Repository State

The report was opened by `npm run report:start -- GUARDRAIL-PRECISION` before T1.1 edits. T1 had 267 architecture violations and 29 target-not-implemented findings.

## Pre-existing Workspace Changes

These exact files were already changed at task start, except docs/prompts files which appeared concurrently. Some T1 files also received T1.1 changes. Unrelated files were preserved.
- AGENTS.md
- package.json
- tests/architecture/README.md
- tests/architecture/config/targetScope.ts
- tests/architecture/moduleManifestConformance.test.ts
- tests/conformance/authority/authorityBehavior.test.ts
- docs/reports/20261002-0215-ARCHITECTURE-GUARDRAILS.md
- docs/reports/20261002-0248-STATIC-ARCHITECTURE-GUARDRAILS.md
- reports/20261002-0215-ARCHITECTURE-GUARDRAILS.md
- scripts/activity-report.ts
- scripts/architecture-runner.mjs
- scripts/guardrail-runner.mjs
- scripts/static-architecture.ts
- tests/architecture/staticAnalysis.test.ts
- tests/architecture/support/staticAnalysis.ts
- tests/reports/architecture-violations.json
- tsconfig.guardrails.json
- docs/prompts/T1-complimentary.md
- docs/prompts/T1.md
- docs/prompts/U0.md

## Files Added

- docs/reports/20261002-0312-GUARDRAIL-PRECISION.md
- tests/reporting/activityReport.test.ts

## Files Modified

- package.json
- scripts/activity-report.ts
- scripts/architecture-runner.mjs
- scripts/guardrail-runner.mjs
- tests/architecture/README.md
- tests/architecture/staticAnalysis.test.ts
- tests/architecture/support/staticAnalysis.ts
- tests/conformance/authority/authorityBehavior.test.ts
- tests/reports/architecture-violations.json
- tsconfig.guardrails.json

## Files Deleted

- None.

## Implementation Summary

- Corrected SQL context extraction, PostgreSQL source recognition, DB ownership boundaries, transitive exception naming, magic decisions, constants, typed manifests, and route scope.
- Added 14 analyzer self-tests and 5 isolated Activity Report tests. Main architecture and guardrail runners now execute self-tests.
- Added tenant, classification/clearance, and ACL Authority cases (39 cases total).
- Regenerated deterministic JSON: 212 architecture violations, 29 target missing, 0 infrastructure failures.

### Precision Fix Summary

| Issue | Before | After | Regression Test |
|---|---|---|---|
| SQL qualification false positives | Arbitrary TS text and SQL keywords treated as objects | Executable SQL literals only; IF/EXISTS/referential actions recognized | SQL fixture |
| Exception naming | ex* also failed cls* | Exception hierarchy uses ex* alone | Naming fixture |
| External DB connectors | All driver imports treated as Platform DB | Approved source adapters allowed; Platform repository import forbidden | Persistence fixture |
| Composition-root wiring | Factory import flagged | Factory wiring allowed; queries forbidden | Persistence fixture |
| Route collision | Equal relative paths collided globally | Effective route module/surface scoped; canonical IDs global | Manifest fixture |
| Typed manifest | Token anywhere counted as typed | Canonical exported object requires type or satisfies AST | Manifest fixture |
| Report path parser | Top-level path whitelist | Validated any repository-relative file | Reporting fixture |
| Magic decision heuristic | PDF layout kind/type flagged | Stable business/security states targeted | Magic fixture |

### Violation Count Comparison

| Rule | Before Count | After Count | Reason for Change |
|---|---:|---:|---|
| ARCH-DB-001 | 37 | 39 | Direct DB execution remains visible under explicit boundary classifier. |
| ARCH-DB-005 | 3 | 0 | SQL Server setup queries are not target PostgreSQL authoritative SQL. |
| ARCH-DB-006 | 31 | 0 | SQL keywords, arbitrary TS text, SQLite catalog, and vendor SQL no longer misread. |
| ARCH-TS-NAME-001 | 12 | 0 | ex-prefixed exception classes no longer fail normal class rule. |
| ARCH-TS-002 | 16 | 5 | PDF format/layout discriminators excluded; security/business state remains. |
| Architecture total | 267 | 212 | Net precision correction, not a quality score. |
| Target-not-implemented total | 29 | 29 | Target manifests remain absent. |

### Manual Sample Review

| Rule | File | Line | Assessment | Notes |
|---|---|---:|---|---|
| ARCH-DB-001 | src/routes/admin.ts | 4 | TRUE_POSITIVE | Route imports atDB. |
| ARCH-DB-001 | src/routes/auth.ts | 10 | TRUE_POSITIVE | Route imports atDB. |
| ARCH-DB-001 | src/routes/shares.ts | 6 | TRUE_POSITIVE | Route imports atDB. |
| ARCH-DB-001 | src/routes/summarize.ts | 4 | TRUE_POSITIVE | Route imports atDB. |
| ARCH-DB-001 | src/routes/translate.ts | 7 | TRUE_POSITIVE | Route imports atDB. |
| ARCH-TS-NAME-002 | src/db/common.ts | 21 | TRUE_POSITIVE | Intf uppercase prefix. |
| ARCH-TS-NAME-002 | src/db/tables/tblChats.ts | 44 | TRUE_POSITIVE | Intf uppercase prefix. |
| ARCH-TS-NAME-002 | src/db/tables/tblGroup.ts | 14 | TRUE_POSITIVE | Group lacks intf. |
| ARCH-TS-NAME-002 | src/db/tables/tblLog.ts | 35 | TRUE_POSITIVE | Intf uppercase prefix. |
| ARCH-TS-NAME-002 | src/db/tables/tblUser.ts | 69 | TRUE_POSITIVE | Intf uppercase prefix. |
| ARCH-TS-002 | src/services/authService.ts | 54 | TRUE_POSITIVE | Refresh-token security type. |
| ARCH-TS-002 | src/services/chatService.ts | 269 | TRUE_POSITIVE | Stable cancellation state. |
| ARCH-TS-002 | src/services/chatService.ts | 325 | TRUE_POSITIVE | Stable queued state. |
| ARCH-TS-002 | src/services/crmService.ts | 569 | TRUE_POSITIVE | Owner role assignment. |
| ARCH-TS-002 | src/services/crmService.ts | 597 | TRUE_POSITIVE | Owner role assignment. |
| ARCH-AUTH-001 | src/services/crmService.ts | 530 | TRUE_POSITIVE | Role determines canManageTeam. |
| ARCH-AUTH-001 | src/services/ragResourceService.ts | 66 | TRUE_POSITIVE | Application reads privilege quota value. |
| ARCH-AI-003 | src/services/vectorDB-old.ts | 2 | TRUE_POSITIVE | Direct Qdrant client import. |
| ARCH-AI-003 | src/services/vectorDB-old.ts | 3 | TRUE_POSITIVE | Direct Qdrant SDK type import. |
| ARCH-MOD-001 | modules/crm/manifest.ts | — | TRUE_POSITIVE | Five module manifests missing. |
| ARCH-MOD-003 | packages/authority/package.json | — | TRUE_POSITIVE | 24 package manifests missing. |

Prior IF/CASCADE, SQL Server SELECT-star, PDF layout, and ex-class findings: FALSE_POSITIVE_FIXED. No sampled known false positive remains.

### Authority Coverage

| Behavior | State | Evidence |
|---|---|---|
| tenant mismatch + root ALL → DENY | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| LOW clearance + HIGH classification → DENY | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| HIGH clearance + LOW classification + grant → ALLOW | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| ordinary grant + ACL explicit deny → DENY | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| ACL grant without ordinary grant → ALLOW | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| ALL + suspension/termination → DENY | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| ALL + mandatory missing classification → DENY | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| ALL + first-class explicit deny → DENY | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |

All 39 Authority cases execute and remain red because the target adapter is absent; no implementation is faked.

## Architecture Decisions / Deviations

- SQL dialect markers distinguish legacy MySQL/SQL Server setup source from target PostgreSQL, without a file allowlist. Dynamic SQL, computed identifiers, and unrecognized vendor syntax remain static limits.
- External adapter detection requires approved ownership, adapter location, and DB-specific name. Runtime connection target, Data Governance approval, and DB privileges need later contract/integration checks.
- Composition roots may wire repository factories but cannot execute SQL or repository queries.
- Canonical route contribution IDs remain globally unique; effective method/path is scoped by module, surface, and binding.
- No architecture document or production source changed. T2 remains deferred.

## Tests and Verification

| Command | Exit | Interpretation |
|---|---:|---|
| `npm run lint` | 0 | PASS |
| `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.guardrails.json` | 0 | Guardrail infrastructure compiles |
| `npm run test:architecture:self` | 0 | 14 tests pass |
| `npm run test:reporting` | 0 | 5 isolated tests pass |
| `npm run test:architecture` | 1 | Self-tests plus all categories execute; expected red |
| `npm run test:conformance:authority` | 1 | 39 cases; target adapter absent |
| `npm run test:guardrails` | 1 | Architecture and Authority fully execute |
| `git diff --check` | 0 | PASS |
| `npm run report:verify` | 0 | Final strict verification and marker closure |
Determinism: two consecutive analyzer runs produced the same architecture JSON SHA-256: `5f4ff602a071072b7aeb24e3e21f4fb7e325b426d5ca13fb7628490ae6729d63`.

## Expected Failures

The static suite remains red on 212 architecture violations and 29 missing target manifests. Authority conformance is red because no adapter binding exists. All suites execute to completion.

## Unexpected Failures

None remain. Stale self-test assumptions about route scope and access decisions were corrected during this pass.

## Production Code Changes

NO. Only scripts, tests, test documentation/configuration, package scripts, generated diagnostics, and this report changed.

## Final Repository State

Individual Git status paths are below. No T1.1 deletion occurred. Unrelated pre-existing and concurrent paths are listed above.

```text
M ui/AGENTS.md
 M ui/package.json
 M ui/tests/architecture/README.md
 M ui/tests/architecture/config/targetScope.ts
 M ui/tests/architecture/moduleManifestConformance.test.ts
 M ui/tests/conformance/authority/authorityBehavior.test.ts
?? ui/docs/prompts/T1-complimentary.md
?? ui/docs/prompts/T1.md
?? ui/docs/prompts/U0.md
?? ui/docs/reports/20261002-0215-ARCHITECTURE-GUARDRAILS.md
?? ui/docs/reports/20261002-0248-STATIC-ARCHITECTURE-GUARDRAILS.md
?? ui/docs/reports/20261002-0312-GUARDRAIL-PRECISION.md
?? ui/reports/20261002-0215-ARCHITECTURE-GUARDRAILS.md
?? ui/scripts/activity-report.ts
?? ui/scripts/architecture-runner.mjs
?? ui/scripts/guardrail-runner.mjs
?? ui/scripts/static-architecture.ts
?? ui/tests/architecture/staticAnalysis.test.ts
?? ui/tests/architecture/support/staticAnalysis.ts
?? ui/tests/reporting/activityReport.test.ts
?? ui/tests/reports/architecture-violations.json
?? ui/tsconfig.guardrails.json
```

## Acceptance Criteria

| Criterion | Result | Evidence |
|---|---|---|
| 1 | PASS | Activity Report starts before modifications — Report opened before T1.1 modifications. |
| 2 | PASS | No production code is modified — Regression fixture, final run, or review table above. |
| 3 | PASS | ARCH-DB-006 no longer reports SQL keywords as objects — Regression fixture, final run, or review table above. |
| 4 | PASS | Arbitrary TypeScript text is not scanned as SQL — Regression fixture, final run, or review table above. |
| 5 | PASS | Unqualified real SQL objects remain detected — Regression fixture, final run, or review table above. |
| 6 | PASS | SELECT * remains detected — Regression fixture, final run, or review table above. |
| 7 | PASS | COUNT(*) is not falsely detected — Regression fixture, final run, or review table above. |
| 8 | PASS | External database adapters are distinct from Platform persistence — Regression fixture, final run, or review table above. |
| 9 | PASS | DB drivers allowed only in approved external adapters — Regression fixture, final run, or review table above. |
| 10 | PASS | External adapters cannot import Platform persistence — Regression fixture, final run, or review table above. |
| 11 | PASS | Composition-root persistence wiring is allowed — Regression fixture, final run, or review table above. |
| 12 | PASS | Composition-root query execution is forbidden — Regression fixture, final run, or review table above. |
| 13 | PASS | Controller, application, and Worker DB boundaries remain enforced — Regression fixture, final run, or review table above. |
| 14 | PASS | Exception classes use ex* without cls* requirement — Regression fixture, final run, or review table above. |
| 15 | PASS | Transitive exception inheritance is recognized — Regression fixture, final run, or review table above. |
| 16 | PASS | Ordinary classes still require cls* — Regression fixture, final run, or review table above. |
| 17 | PASS | Interface/type/enum lowercase prefixes remain exact — Regression fixture, final run, or review table above. |
| 18 | PASS | Route collision respects module-relative scope — Regression fixture, final run, or review table above. |
| 19 | PASS | Duplicate canonical route contribution IDs are detected — Regression fixture, final run, or review table above. |
| 20 | PASS | Manifest typedness is proven by AST — Regression fixture, final run, or review table above. |
| 21 | PASS | Token-only Module Manifest mention is insufficient — Regression fixture, final run, or review table above. |
| 22 | PASS | Only canonical exported manifest contributes IDs — Regression fixture, final run, or review table above. |
| 23 | PASS | Duplicate module/resource/privilege/task/notification/usage IDs detected — Regression fixture, final run, or review table above. |
| 24 | PASS | Analyzer self-tests run in test:architecture — Regression fixture, final run, or review table above. |
| 25 | PASS | Analyzer self-tests run in test:guardrails — Regression fixture, final run, or review table above. |
| 26 | PASS | Regression fixtures cover corrected false positives — Regression fixture, final run, or review table above. |
| 27 | PASS | Activity Report paths accept arbitrary repository-relative files — Regression fixture, final run, or review table above. |
| 28 | PASS | Reporting tests cover lifecycle and path inventory — Regression fixture, final run, or review table above. |
| 29 | PASS | VERIFIED is rejected as task status — Regression fixture, final run, or review table above. |
| 30 | PASS | Root ALL cannot cross tenant boundary — Named Authority cases in coverage table. |
| 31 | PASS | Classification/clearance deny is encoded — Named Authority cases in coverage table. |
| 32 | PASS | Classification/clearance allow is encoded — Named Authority cases in coverage table. |
| 33 | PASS | ACL deny precedence is encoded — Named Authority cases in coverage table. |
| 34 | PASS | ALL does not bypass suspension or termination — Named Authority cases in coverage table. |
| 35 | PASS | Magic-decision heuristic excludes generic string comparisons — Regression fixture, final run, or review table above. |
| 36 | PASS | Local camelCase const is allowed — Regression fixture, final run, or review table above. |
| 37 | PASS | Naming checks declarations, not external keys — Regression fixture, final run, or review table above. |
| 38 | PASS | Deterministic violation report is regenerated — Regenerated deterministic JSON: 212 architecture, 29 target missing. |
| 39 | PASS | Representative findings manually reviewed and reported — 21 manual sample rows above. |
| 40 | PASS | No legacy allowlist, baseline, or ratchet — Regression fixture, final run, or review table above. |
| 41 | PASS | No skip, todo, or placeholder pass — Regression fixture, final run, or review table above. |
| 42 | PASS | T2 live PostgreSQL checks deferred — Regression fixture, final run, or review table above. |
| 43 | PASS | Guardrail typecheck passes — Regression fixture, final run, or review table above. |
| 44 | PASS | Analyzer self-tests pass — Regression fixture, final run, or review table above. |
| 45 | PASS | All guardrail suites execute fully — Regression fixture, final run, or review table above. |
| 46 | PASS | Target repository remains red where unimplemented — Regression fixture, final run, or review table above. |
| 47 | PASS | git diff --check passes — Regression fixture, final run, or review table above. |
| 48 | PASS | Activity Report finalized — Regression fixture, final run, or review table above. |
| 49 | PASS | report:verify passes — Final report:verify exit 0; marker removed. |
| 50 | PASS | Final response identifies exact report path — Regression fixture, final run, or review table above. |

## Open Issues

- Target Authority adapter and manifests remain absent by design; target compliance remains red.
- T2 NOT STARTED: pg_catalog, actual table/column/FK naming, tenant FKs, soft delete, audit triggers, partial unique indexes, RLS, runtime DB roles, migrations, concurrency, stored-procedure transactions.
- Known false positives remaining among reviewed findings: 0. Dynamic SQL, computed identifiers, runtime connection targets, and outbound contract enforcement beyond static signals remain documented limits.

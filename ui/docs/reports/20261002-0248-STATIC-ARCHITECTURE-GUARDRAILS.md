# Activity Report: STATIC-ARCHITECTURE-GUARDRAILS

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-0248-STATIC-ARCHITECTURE-GUARDRAILS.md
- Created At: 2026-10-01T23:18:46.665Z
- Status: PARTIAL

## Purpose and Scope

T1 static architecture and coding guardrails only; no production architecture or live PostgreSQL migration.

## Governing Sources

AGENTS.md; docs/architecture/00-manifest.md through 10-commercial-architecture.md; docs/architecture/AGENTS.md; scoped app/package/module ownership instructions.

## Initial Repository State

Legacy source and earlier red-first files were present. Initial status used `git status --porcelain=v1 --untracked-files=all`. The report command initially failed on a blocked Git subprocess and a stale VERIFIED marker.

## Pre-existing Workspace Changes

These exact paths were changed before T1. Entries also under Files Modified retain their earlier content and received T1 edits.
- AGENTS.md
- package.json
- tests/architecture/config/targetScope.ts
- tests/architecture/moduleManifestConformance.test.ts
- tests/conformance/authority/authorityBehavior.test.ts
- docs/reports/20261002-0215-ARCHITECTURE-GUARDRAILS.md
- reports/20261002-0215-ARCHITECTURE-GUARDRAILS.md
- scripts/activity-report.ts
- scripts/guardrail-runner.mjs

## Files Added

- docs/reports/20261002-0248-STATIC-ARCHITECTURE-GUARDRAILS.md
- scripts/architecture-runner.mjs
- scripts/static-architecture.ts
- tests/architecture/staticAnalysis.test.ts
- tests/architecture/support/staticAnalysis.ts
- tests/reports/architecture-violations.json
- tsconfig.guardrails.json

## Files Modified

- package.json
- tests/architecture/README.md
- tests/architecture/config/targetScope.ts
- tests/architecture/moduleManifestConformance.test.ts
- tests/conformance/authority/authorityBehavior.test.ts
- scripts/activity-report.ts
- scripts/guardrail-runner.mjs

## Files Deleted

- None.

## Implementation Summary

- Added a reusable TypeScript Compiler API analyzer, ownership classification, AST and high-confidence SQL checks, deterministic sorting, and machine-readable JSON.
- Implemented 42 executable static rules; current findings are 267 architecture violations, 29 target-not-implemented, and 0 infrastructure failures.
- Replaced JSON parsing of typed `manifest.ts` with AST checks and global contribution ID checks.
- Added a test-side Authority adapter contract and 34 behavioral cases; no fake or production implementation.
- Repaired report status, finalization, current marker closure, exact Git inventory, and strict verification.

### Static Rule Results

| Rule ID | Rule title | Enforcement mechanism | Number of current violations | Classification |
|---|---|---|---:|---|
| ARCH-DEP-001 | Platform dependency on module | TypeScript import AST | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-DEP-002 | Private cross-module import | TypeScript import AST | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-DEP-003 | Cross-module persistence import | TypeScript import AST | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-DEP-004 | Domain-specific platform core import | TypeScript import AST | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-DB-001 | Database access ownership | TypeScript AST and manifest | 37 | ARCHITECTURE_VIOLATION |
| ARCH-DB-002 | ORM package dependency | TypeScript AST and manifest | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-DB-003 | Transport direct database access | TypeScript AST and manifest | 11 | ARCHITECTURE_VIOLATION |
| ARCH-DB-004 | Worker direct database access | TypeScript AST and manifest | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-DB-005 | SELECT star | SQL source | 3 | ARCHITECTURE_VIOLATION |
| ARCH-DB-006 | Schema-qualified SQL | SQL source | 31 | ARCHITECTURE_VIOLATION |
| ARCH-DB-NAME-001 | Table name | SQL source high-confidence patterns | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-DB-NAME-002 | Column prefix | SQL source high-confidence patterns | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-DB-NAME-003 | Foreign-key column name | SQL source high-confidence patterns | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-DB-NAME-004 | Object prefix | SQL source high-confidence patterns | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-DB-NAME-005 | Routine parameter prefix | SQL source high-confidence patterns | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-DB-NAME-006 | Procedural local prefix | SQL source high-confidence patterns | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-TS-NAME-001 | Class cls prefix | TypeScript declaration AST | 12 | ARCHITECTURE_VIOLATION |
| ARCH-TS-NAME-002 | Interface intf prefix | TypeScript declaration AST | 70 | ARCHITECTURE_VIOLATION |
| ARCH-TS-NAME-003 | Enum enu prefix | TypeScript declaration AST | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-TS-NAME-004 | Type typ prefix | TypeScript declaration AST | 51 | ARCHITECTURE_VIOLATION |
| ARCH-TS-NAME-005 | Exception ex prefix | TypeScript declaration AST | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-TS-NAME-006 | Function and variable camelCase | TypeScript declaration AST | 7 | ARCHITECTURE_VIOLATION |
| ARCH-TS-NAME-007 | Canonical constant UPPER_SNAKE_CASE | TypeScript declaration AST | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-TS-001 | Explicit any | TypeScript AST | 25 | ARCHITECTURE_VIOLATION |
| ARCH-TS-002 | Magic decision literal | TypeScript AST | 16 | ARCHITECTURE_VIOLATION |
| ARCH-TS-003 | Wildcard export | TypeScript AST | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-TS-004 | Broad anonymous public record | TypeScript AST | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-AUTH-001 | Authority sole evaluator | TypeScript AST | 2 | ARCHITECTURE_VIOLATION |
| ARCH-AUTH-002 | Privilege helper duplication | TypeScript AST | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-AUTH-003 | Resource fact resolver decision leak | TypeScript AST | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-AI-001 | Direct model provider | TypeScript AST high-confidence signals | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-AI-002 | Business model selection | TypeScript AST high-confidence signals | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-AI-003 | Qdrant adapter ownership | TypeScript AST high-confidence signals | 2 | ARCHITECTURE_VIOLATION |
| ARCH-AI-004 | AI output direct database write | TypeScript AST high-confidence signals | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-PROVIDER-001 | Notification provider boundary | TypeScript import AST | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-PROVIDER-002 | Payment provider boundary | TypeScript import AST | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-PROVIDER-003 | Provider SDK type in public contract | TypeScript import AST | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-DOC-001 | Generic document storage in module | TypeScript import AST | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-DOC-002 | Business Qdrant access | TypeScript import AST | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-MOD-001 | Typed module manifest | TypeScript manifest AST | 5 | TARGET_NOT_IMPLEMENTED |
| ARCH-MOD-002 | Unique contribution IDs | TypeScript manifest AST | 0 | ARCHITECTURE_VIOLATION (zero current findings) |
| ARCH-MOD-003 | Platform package manifest | TypeScript manifest AST | 24 | TARGET_NOT_IMPLEMENTED |

### Authority Coverage

| Behavior | State | Evidence |
|---|---|---|
| root ALL | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| internal ALL | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| sibling isolation | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| ALL + explicit deny | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| value lookup | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| allDefault | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| 0000 | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| 1111 | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| 0w10 | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| owner-match w | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| owner-mismatch w | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| missing-owner w | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| org hierarchy | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| explicit child grant | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| absolute validity | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| recurring schedule | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| suspension | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| termination | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| malformed fact | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| determinism | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| input non-mutation | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| privilege versus organization hierarchy | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| parent/child scope | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| Jalali schedule | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |
| invalidation contract | ENCODED | tests/conformance/authority/authorityBehavior.test.ts |

The task-listed 21 behaviors are encoded (21/21), plus four additional distinctions. The absent target binding causes 34 expected `TARGET_AUTHORITY_ADAPTER_NOT_AVAILABLE` failures.

### Static Naming Coverage

| Convention | Rule ID | State |
|---|---|---|
| cls* | ARCH-TS-NAME-001 | ENFORCED |
| intf* | ARCH-TS-NAME-002 | ENFORCED |
| enu* | ARCH-TS-NAME-003 | ENFORCED |
| typ* | ARCH-TS-NAME-004 | ENFORCED |
| ex* | ARCH-TS-NAME-005 | ENFORCED |
| camelCase function/variable | ARCH-TS-NAME-006 | ENFORCED high-confidence |
| UPPER_SNAKE_CASE canonical constants | ARCH-TS-NAME-007 | ENFORCED high-confidence |
| tbl_<module>_<entity> | ARCH-DB-NAME-001 | ENFORCED |
| column table prefix | ARCH-DB-NAME-002 | PARTIAL: registered examples |
| FK double-underscore naming | ARCH-DB-NAME-003 | ENFORCED high-confidence |
| fn_ | ARCH-DB-NAME-004 | ENFORCED parsed target SQL |
| sp_ | ARCH-DB-NAME-004 | ENFORCED parsed target SQL |
| trg_ | ARCH-DB-NAME-004 | ENFORCED parsed target SQL |
| ev_ | ARCH-DB-NAME-004 | ENFORCED parsed target SQL |
| vw_ | ARCH-DB-NAME-004 | ENFORCED parsed target SQL |
| mvw_ | ARCH-DB-NAME-004 | ENFORCED parsed target SQL |
| idx_ | ARCH-DB-NAME-004 | ENFORCED parsed target SQL |
| seq_ | ARCH-DB-NAME-004 | ENFORCED parsed target SQL |
| pk_ | ARCH-DB-NAME-004 | ENFORCED parsed target SQL |
| fk_ | ARCH-DB-NAME-004 | ENFORCED parsed target SQL |
| uq_ | ARCH-DB-NAME-004 | ENFORCED parsed target SQL |
| ck_ | ARCH-DB-NAME-004 | ENFORCED parsed target SQL |
| i_ | ARCH-DB-NAME-005 | ENFORCED parsed signatures |
| o_ | ARCH-DB-NAME-005 | ENFORCED parsed signatures |
| io_ | ARCH-DB-NAME-005 | ENFORCED parsed signatures |
| v_ | ARCH-DB-NAME-006 | PARTIAL: simple DECLARE blocks |
| r_ | ARCH-DB-NAME-006 | PARTIAL: simple DECLARE blocks |
| cur_ | ARCH-DB-NAME-006 | PARTIAL: simple DECLARE blocks |
| c_ | ARCH-DB-NAME-006 | PARTIAL: simple DECLARE blocks |

## Architecture Decisions / Deviations

- AST handles code; conservative patterns handle SQL. Dynamic SQL and legacy MySQL dialect dump syntax are outside target PostgreSQL parsing.
- The architecture provides only example table-prefix mappings, so column-prefix checks cover those plus obvious generic names.
- Magic decisions, broad records, AI output flow, and procedural locals are high-confidence heuristics. Limits are documented in tests/architecture/README.md.
- The report workflow required a minimal repair before this report could start. This unmet historical ordering criterion makes the report PARTIAL.

## Tests and Verification

| Command | Exit | Interpretation |
|---|---:|---|
| `npm run lint` | 0 | PASS |
| `npx tsc --noEmit` | 1 | Broken local .bin/tsc launcher |
| `node node_modules/typescript/bin/tsc --noEmit` | 2 | Legacy source errors |
| `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.guardrails.json` | 0 | Guardrail infrastructure compiles |
| `node --import tsx --test tests/architecture/staticAnalysis.test.ts` | 0 | 8 fixtures pass |
| `npm run test:architecture:dependencies` | 0 | All checks executed |
| `npm run test:architecture:persistence` | 1 | All checks executed |
| `npm run test:architecture:authority` | 1 | All checks executed |
| `npm run test:architecture:ai` | 1 | All checks executed |
| `npm run test:architecture:providers` | 0 | All checks executed |
| `npm run test:architecture:typescript` | 1 | All checks executed |
| `npm run test:architecture:naming` | 1 | All checks executed |
| `npm run test:architecture:manifests` | 1 | All checks executed |
| `npm run test:architecture` | 1 | All static categories executed |
| `npm run test:conformance:authority` | 1 | 34 cases, target adapter absent |
| `npm run test:guardrails` | 1 | Both suites executed |
| `npm run report:finalize -- VERIFIED` | 1 | Invalid status rejected |
| `npm run report:verify before finalization` | 1 | IN_PROGRESS rejected |
| `npm run report:verify` first finalized attempt | 1 | Exposed leading-space truncation in Git porcelain parser; fixed and rerun. |
| `git diff --check` | 0 | PASS |
| `npm run report:verify after finalization` | 0 | Strict final verification and marker closure |

## Expected Failures

Legacy architecture violations, missing target manifests and Authority adapter cause normal red results. All suites run to completion.

## Unexpected Failures

`npx tsc --noEmit` uses a broken local `.bin/tsc` launcher (`Cannot find module ../lib/tsc.js`). Direct compiler invocation works; guardrail-only typecheck is green while legacy source errors remain. The first finalized report verification caught a parser defect: trimming the Git porcelain output removed the first line's status-space. The parser now preserves it.

## Production Code Changes

NO. T1 changed only tests, support, scripts, package scripts, test documentation, diagnostics, and this report.

## Final Repository State

Git status has individual paths. No T1 deletion occurred. Pre-existing paths are identified above.

```text
M ui/AGENTS.md
 M ui/package.json
 M ui/tests/architecture/README.md
 M ui/tests/architecture/config/targetScope.ts
 M ui/tests/architecture/moduleManifestConformance.test.ts
 M ui/tests/conformance/authority/authorityBehavior.test.ts
?? ui/docs/reports/20261002-0215-ARCHITECTURE-GUARDRAILS.md
?? ui/docs/reports/20261002-0248-STATIC-ARCHITECTURE-GUARDRAILS.md
?? ui/reports/20261002-0215-ARCHITECTURE-GUARDRAILS.md
?? ui/scripts/activity-report.ts
?? ui/scripts/architecture-runner.mjs
?? ui/scripts/guardrail-runner.mjs
?? ui/scripts/static-architecture.ts
?? ui/tests/architecture/staticAnalysis.test.ts
?? ui/tests/architecture/support/staticAnalysis.ts
?? ui/tests/reports/architecture-violations.json
?? ui/tsconfig.guardrails.json
```

## Acceptance Criteria

| Criterion | Result | Evidence |
|---|---|---|
| 1 | FAIL | Activity Report created before task modifications. — Minimal repair to broken report workflow preceded report start; guardrail modifications followed report start. |
| 2 | PASS | Report status model uses `IN_PROGRESS/COMPLETE/PARTIAL/BLOCKED`. — See rule, Authority, naming, file, and verification tables above. |
| 3 | PASS | `VERIFIED` is removed as task status. — See rule, Authority, naming, file, and verification tables above. |
| 4 | PASS | Report finalize command exists. — See rule, Authority, naming, file, and verification tables above. |
| 5 | PASS | Successful verification closes current-report state. — See rule, Authority, naming, file, and verification tables above. |
| 6 | PASS | Next task can start a new report. — See rule, Authority, naming, file, and verification tables above. |
| 7 | PASS | Git status uses all untracked files. — See rule, Authority, naming, file, and verification tables above. |
| 8 | PASS | Exact changed files are accounted for. — See rule, Authority, naming, file, and verification tables above. |
| 9 | PASS | Acceptance criteria are fully reported. — See rule, Authority, naming, file, and verification tables above. |
| 10 | PASS | TypeScript AST/static harness is reusable. — See rule, Authority, naming, file, and verification tables above. |
| 11 | PASS | Deterministic violation shape exists. — See rule, Authority, naming, file, and verification tables above. |
| 12 | PASS | Deterministic machine-readable violation report exists. — See rule, Authority, naming, file, and verification tables above. |
| 13 | PASS | Platform→module dependency rule is executable. — See rule, Authority, naming, file, and verification tables above. |
| 14 | PASS | Cross-module private import rule is executable. — See rule, Authority, naming, file, and verification tables above. |
| 15 | PASS | Cross-module persistence rule is executable. — See rule, Authority, naming, file, and verification tables above. |
| 16 | PASS | DB access ownership rule is executable. — See rule, Authority, naming, file, and verification tables above. |
| 17 | PASS | ORM rule is executable. — See rule, Authority, naming, file, and verification tables above. |
| 18 | PASS | Controller direct-DB rule is executable. — See rule, Authority, naming, file, and verification tables above. |
| 19 | PASS | Worker direct-DB rule is executable. — See rule, Authority, naming, file, and verification tables above. |
| 20 | PASS | `SELECT *` rule is executable. — See rule, Authority, naming, file, and verification tables above. |
| 21 | PASS | schema-qualified raw SQL rule is executable or documented as partial with high-confidence enforcement. — High-confidence static enforcement; documented parser/registry limits. |
| 22 | PASS | TS `cls*` naming rule exists. — See rule, Authority, naming, file, and verification tables above. |
| 23 | PASS | TS `intf*` naming rule exists. — See rule, Authority, naming, file, and verification tables above. |
| 24 | PASS | TS `enu*` naming rule exists. — See rule, Authority, naming, file, and verification tables above. |
| 25 | PASS | TS `typ*` naming rule exists. — See rule, Authority, naming, file, and verification tables above. |
| 26 | PASS | TS `ex*` naming rule exists. — See rule, Authority, naming, file, and verification tables above. |
| 27 | PASS | camelCase naming enforcement exists at an appropriate confidence level. — See rule, Authority, naming, file, and verification tables above. |
| 28 | PASS | canonical constant naming enforcement exists at an appropriate confidence level. — See rule, Authority, naming, file, and verification tables above. |
| 29 | PASS | DB table naming static rule exists. — See rule, Authority, naming, file, and verification tables above. |
| 30 | PASS | DB column-prefix static rule exists at an appropriate confidence level. — High-confidence static enforcement; documented parser/registry limits. |
| 31 | PASS | DB FK naming static rule exists. — See rule, Authority, naming, file, and verification tables above. |
| 32 | PASS | DB object-prefix rules exist. — See rule, Authority, naming, file, and verification tables above. |
| 33 | PASS | routine parameter-prefix rule exists. — See rule, Authority, naming, file, and verification tables above. |
| 34 | PASS | procedural-local prefix rule exists where statically reliable. — High-confidence static enforcement; documented parser/registry limits. |
| 35 | PASS | explicit `any` rule exists. — See rule, Authority, naming, file, and verification tables above. |
| 36 | PASS | wildcard export rule exists. — See rule, Authority, naming, file, and verification tables above. |
| 37 | PASS | high-confidence magic-decision rule exists. — See rule, Authority, naming, file, and verification tables above. |
| 38 | PASS | Authority sole-evaluator static rule exists. — See rule, Authority, naming, file, and verification tables above. |
| 39 | PASS | duplicate privilege-helper rule exists. — See rule, Authority, naming, file, and verification tables above. |
| 40 | PASS | Resource Fact Resolver decision-leak rule exists. — See rule, Authority, naming, file, and verification tables above. |
| 41 | PASS | business direct-model rule exists. — See rule, Authority, naming, file, and verification tables above. |
| 42 | PASS | business model/endpoint selection rule exists. — See rule, Authority, naming, file, and verification tables above. |
| 43 | PASS | Qdrant ownership rule exists. — See rule, Authority, naming, file, and verification tables above. |
| 44 | PASS | notification-provider boundary rule exists. — See rule, Authority, naming, file, and verification tables above. |
| 45 | PASS | payment/fiscal-provider boundary rule exists. — See rule, Authority, naming, file, and verification tables above. |
| 46 | PASS | Module Manifest is treated as typed `manifest.ts`, not JSON. — See rule, Authority, naming, file, and verification tables above. |
| 47 | PASS | Module ID uniqueness is checked. — See rule, Authority, naming, file, and verification tables above. |
| 48 | PASS | Resource Type ID uniqueness is checked. — See rule, Authority, naming, file, and verification tables above. |
| 49 | PASS | privilege ID uniqueness is checked. — See rule, Authority, naming, file, and verification tables above. |
| 50 | PASS | AI Task ID uniqueness is checked. — See rule, Authority, naming, file, and verification tables above. |
| 51 | PASS | Notification Type ID uniqueness is checked. — See rule, Authority, naming, file, and verification tables above. |
| 52 | PASS | Usage Meter ID uniqueness is checked. — See rule, Authority, naming, file, and verification tables above. |
| 53 | PASS | route contribution collision checks exist where meaningful. — See rule, Authority, naming, file, and verification tables above. |
| 54 | PASS | missing manifests are `TARGET_NOT_IMPLEMENTED`. — See rule, Authority, naming, file, and verification tables above. |
| 55 | PASS | reusable Authority adapter contract exists. — See rule, Authority, naming, file, and verification tables above. |
| 56 | PASS | root `ALL` behavior is encoded. — See rule, Authority, naming, file, and verification tables above. |
| 57 | PASS | internal-node `ALL` behavior is encoded. — See rule, Authority, naming, file, and verification tables above. |
| 58 | PASS | sibling isolation is encoded. — See rule, Authority, naming, file, and verification tables above. |
| 59 | PASS | `ALL + explicit deny` behavior is encoded. — See rule, Authority, naming, file, and verification tables above. |
| 60 | PASS | privilege value lookup is encoded. — See rule, Authority, naming, file, and verification tables above. |
| 61 | PASS | `allDefault` behavior is encoded. — See rule, Authority, naming, file, and verification tables above. |
| 62 | PASS | canonical CRUD `0000` is encoded. — See rule, Authority, naming, file, and verification tables above. |
| 63 | PASS | canonical CRUD `1111` is encoded. — See rule, Authority, naming, file, and verification tables above. |
| 64 | PASS | canonical CRUD `0w10` is encoded. — See rule, Authority, naming, file, and verification tables above. |
| 65 | PASS | `w + owner match` is encoded. — See rule, Authority, naming, file, and verification tables above. |
| 66 | PASS | `w + owner mismatch` is encoded. — See rule, Authority, naming, file, and verification tables above. |
| 67 | PASS | `w + missing owner` fails closed. — See rule, Authority, naming, file, and verification tables above. |
| 68 | PASS | privilege hierarchy and organization hierarchy are distinguished. — See rule, Authority, naming, file, and verification tables above. |
| 69 | PASS | parent/child scope behavior is encoded. — See rule, Authority, naming, file, and verification tables above. |
| 70 | PASS | explicit child grant behavior is encoded. — See rule, Authority, naming, file, and verification tables above. |
| 71 | PASS | temporal `[start,end)` behavior is encoded. — See rule, Authority, naming, file, and verification tables above. |
| 72 | PASS | recurring timezone-aware Role behavior is encoded. — See rule, Authority, naming, file, and verification tables above. |
| 73 | PASS | suspension behavior is encoded. — See rule, Authority, naming, file, and verification tables above. |
| 74 | PASS | termination behavior is encoded. — See rule, Authority, naming, file, and verification tables above. |
| 75 | PASS | malformed security facts fail closed. — See rule, Authority, naming, file, and verification tables above. |
| 76 | PASS | Authority evaluation determinism is tested. — See rule, Authority, naming, file, and verification tables above. |
| 77 | PASS | Authority input non-mutation is tested. — See rule, Authority, naming, file, and verification tables above. |
| 78 | PASS | no fake Authority production implementation was added. — See rule, Authority, naming, file, and verification tables above. |
| 79 | PASS | no legacy baseline/ratchet was added. — See rule, Authority, naming, file, and verification tables above. |
| 80 | PASS | no `.skip`/`.todo`/unconditional placeholder pass exists. — See rule, Authority, naming, file, and verification tables above. |
| 81 | PASS | all architecture suites execute despite red results. — See rule, Authority, naming, file, and verification tables above. |
| 82 | PASS | `test:guardrails` aggregates failure rather than short-circuiting. — See rule, Authority, naming, file, and verification tables above. |
| 83 | PASS | T2 live-DB rules are explicitly documented as deferred. — See rule, Authority, naming, file, and verification tables above. |
| 84 | PASS | no production migration was performed. — See rule, Authority, naming, file, and verification tables above. |
| 85 | PASS | no unrelated workspace changes were modified. — See rule, Authority, naming, file, and verification tables above. |
| 86 | PASS | test infrastructure compiles/runs correctly. — See rule, Authority, naming, file, and verification tables above. |
| 87 | PASS | `git diff --check` passes. — See rule, Authority, naming, file, and verification tables above. |
| 88 | PASS | Activity Report is finalized and `report:verify` passes. — Finalized PARTIAL; report:verify exit 0 and current marker closed. |
| 89 | PASS | final report contains exact current violation counts. — 267 architecture violations and 29 target-not-implemented findings in JSON. |
| 90 | PASS | final response identifies the exact Activity Report path. — See rule, Authority, naming, file, and verification tables above. |

## Open Issues

- Criterion 1 cannot be satisfied retroactively because the pre-existing report workflow had to be repaired first.
- The complete table-prefix registry and richer SQL/data-flow parsing can expand conservative checks.
- T2 intentionally owns live pg_catalog table/column/FK inspection, tenant FKs, audit triggers, soft-delete columns, partial unique indexes, RLS policies, runtime DB roles, migration-from-empty, upgrade migrations, stored-procedure transactions, and DB concurrency tests. No placeholder passing tests were created.

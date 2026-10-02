# Activity Report: POSTGRES-PERSISTENCE-T2

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-1614-POSTGRES-PERSISTENCE-T2.md
- Created At: 2026-10-02T12:44:01.010Z
- Status: COMPLETE

## Purpose and Scope

Establish the target PostgreSQL persistence foundation beside the existing Express/MySQL public backend. Business modules, Identity, Authority, and RAG are outside T2.

## Governing Sources

AGENTS.md; docs/architecture/00-manifest.md, 01-system-architecture.md, 02-engineering-conventions.md, 03-persistence-and-database.md, 04-authorization-model.md, 05-module-architecture.md, and 08-deployment-architecture.md; docs/architecture/AGENTS.md; scoped API/Worker/package instructions; T1/T1.1 guardrail source and reports.

## Initial Repository State

No tracked changes inside ui at task start. The report workflow captured `(no tracked changes at task start)`. The existing MySQL-backed Express app and Svelte public tools were present.

## Pre-existing Workspace Changes

Untracked parent-workspace paths existed before T2: `TargomanLLM-before-widget-2026-08-02-2033.sql`, `mysql/`, `new-req.md`, `temp/`, `ui.new/`, `ui.old/`, and `ui.server/`. T2 did not modify them.

## Files Added

- docker/postgres-t2-init.sh
- docker/postgres-t2.compose.yml
- docs/backend/01-t2-postgresql-persistence-foundation.md
- docs/reports/20261002-1614-POSTGRES-PERSISTENCE-T2.md
- packages/persistence/AGENTS.md
- packages/persistence/package.json
- packages/persistence/src/index.ts
- packages/persistence/src/migrate.ts
- packages/persistence/src/migrations/001-foundation.sql
- packages/persistence/src/migrations/002-audit-sequence-name.sql
- packages/persistence/src/ready.ts
- scripts/pg-dev.mjs
- tests/db/conformance.ts
- tests/db/fixture.sql
- tests/db/integration.ts
- tsconfig.persistence.json

## Files Modified

- .gitignore
- package.json
- package-lock.json
- tests/reports/architecture-violations.json

## Files Deleted

None.

## Implementation Summary

Added a loopback-only PostgreSQL 16.15 service with persistent volume and generated ignored credentials. Bootstrap provisions separate migration and runtime roles. Added a persistence workspace with bounded Kysely pool, transaction-local context, SQLSTATE classification, readiness, advisory-lock migration runner with SHA-256 checksums, and database audit infrastructure. Added real-PostgreSQL conformance and guarded disposable integration tests. Legacy Express/MySQL routes and schemas were not changed.

## PostgreSQL Environment

| Field | Value |
| --- | --- |
| Version/image | `postgres:16.15-bookworm` |
| Container/service | `vadja-postgres-t2` / `postgres-t2` |
| Host/port | `127.0.0.1:55432` only |
| Database | `targoman_t2` |
| Health | Healthy after start and non-destructive restart |
| Volume | `vadja-t2_postgres_t2_data`, retained on stop |

PostgreSQL 16 is supported through November 2028. Local passwords are only in ignored `.env.pg.local` and container environment; no secret values appear here.

## Role Matrix

| Role | Login | DDL | DML | Audit mutation | Superuser |
| --- | --- | --- | --- | --- | --- |
| `t2_bootstrap` | Yes | Initial database/role administration | Administration only | Can administer | Yes |
| `t2_migration` | Yes | Owns approved schemas and database-local CREATE | Migration-owned objects | Can administer | No |
| `t2_runtime` | Yes | Denied | Granted fixture SELECT/INSERT/UPDATE and metadata SELECT | Denied direct write | No |

Bootstrap was used for initial role/schema provisioning and guarded disposable test database create/drop. A missing database-local CREATE grant was corrected once in the primary development DB and added to the bootstrap script for clean reproduction. Application runtime and migrations use non-superuser roles.

## Schema/Object Inventory

**PRODUCTION_INFRASTRUCTURE:** `platform` and `audit` schemas; `platform.tbl_plt_migration`, `audit.tbl_aud_mutation`, `audit.seq_aud_mutation`, `audit.fn_aud_capture()`, and their named `pk_`/`ck_` constraints. No production business table exists.

**TEST_ONLY_CONFORMANCE:** `t2_fixture` schema; `tbl_t2f_parent` and `tbl_t2f_item`; `seq_t2f_parent` and `seq_t2f_item`; `idx_t2f_item_parent`; `trg_t2f_item_audit`; named PK/FK/UNIQUE/CHECK constraints. They come from `tests/db/fixture.sql`, never production migrations. Integration databases have generated `t2_test_<hex>` names and are dropped only after name validation.

## Migration Verification

- Fresh disposable database: both ordered migrations applied.
- Current database: zero new migrations and retained state.
- Concurrent runners: advisory lock serialized execution; results were two applied and zero applied.
- Checksum integrity: tampered metadata was rejected in a disposable database.
- Failure handling: intentional conflicting test object caused failure and left no success metadata; retry succeeded after removing that object.
- Restart: roles, migrations, fixture data, and conformance remained intact.

## Persistence Boundary

`packages/persistence` owns pool creation, transaction context, classification, readiness, and migrations. Future business SQL remains in its owning module. Application startup has no migration hook. `pg@8.18.0`, `kysely@0.28.8`, and `@types/pg@8.15.5` are pinned and MIT licensed. `npm ci --ignore-scripts` passed. Npm reported 24 repository-wide vulnerabilities (2 low, 7 moderate, 15 high); no unrelated upgrades were attempted.

## Live Conformance

Real PostgreSQL tests passed migration no-op, readiness and failure classification, role matrix, ownership, catalog naming, runtime permissions, transaction commit/rollback, INSERT/UPDATE/SOFT_DELETE audit, constraint SQLSTATEs, serializable conflict, and UTC/positive-offset/DST-zone round-trip. One local timing sample was approximately 2.63 ms connection acquisition, 0.31 ms indexed lookup, and 0.13 ms small transaction; it is not a capacity claim.

`DB_CONFORMANCE_VIOLATION=0`, `DB_TEST_FAILURE=0`, `DB_ENVIRONMENT_FAILURE=0` with T2 PostgreSQL running.

## Legacy Coexistence

- MySQL legacy changed: NO.
- Legacy business data migrated: NO.
- Public tools switched to PostgreSQL: NO.
- Dual writes or synchronization introduced: NO.
- Production backend cutover: NO.

Legacy public-tool live smoke was attempted and returned `ENVIRONMENT_NOT_READY: existing Express API is not reachable`. No Translator, Summarizer, or FAQ live result is claimed.

## Architecture Decisions / Deviations

Only `platform` and `audit` production schemas were created. Audit captures fixture rows in the mutation transaction; semantic business audit remains deferred. Before registering a production domain trigger, its owner must define redaction/exclusion policy for secrets and protected fields. Nested `withTransaction` composition is unsupported by its typed contract; repositories share one outer transaction. No destructive down migration is provided.

## Tests and Verification

- `npm ci --ignore-scripts`: PASS.
- `npm run check:persistence`: PASS, strict TypeScript.
- `npm run test:db:integration`: PASS, fresh/failure/concurrent/no-op/checksum.
- `npm run test:db:conformance`: PASS, live counts 0/0/0.
- `npm run test:architecture:target-ui`: PASS, 0 violations / 0 infrastructure failures.
- `npm run test:architecture`: expected legacy red, 217 architecture violations / 24 target-not-implemented / 0 infrastructure failures; self-test passed. Existing rules were not weakened.
- `npm run check:web`: PASS, zero errors or warnings.
- `npm run test:ui`: PASS, 14 files / 107 tests.
- `npm run build`: PASS, legacy Express build.
- `npm run build:web`: PASS, Svelte Web build.
- `git diff --check`: PASS.
- `npm run test:public-tools:live`: ENVIRONMENT_NOT_READY, existing Express API unreachable.

## Expected Failures

The repository-wide architecture gate remains red for unmigrated legacy and future target components. Public-tool live smoke is unavailable without the pre-existing Express API process.

## Unexpected Failures

None remaining. Initial conformance exposed a missing migration-role CREATE grant; it was fixed and retested. An initial clean install was blocked by sandbox registry networking, then passed with approved access.

## Production Code Changes

Only target persistence infrastructure, its Compose service, migrations, commands, and documentation were added. No legacy production endpoint or MySQL migration was edited.

## Final Repository State

The file inventory above accounts for all T2 changes. PostgreSQL is healthy on loopback. The target foundation is ready for the next separately scoped Identity/Session slice; no such slice was started.

## Acceptance Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| 1 | PASS | Report started before source changes; exact image, loopback service, persistent volume, ignored secrets. |
| 2 | PASS | Fresh/current/concurrent/failure/checksum migration integration passed. |
| 3 | PASS | Runtime and migration roles verified live; runtime schema/audit mutations denied. |
| 4 | PASS | Typed pool/transaction/readiness/error classification and strict TypeScript check passed. |
| 5 | PASS | Live naming, constraint, transaction, audit, time, and restart checks passed. |
| 6 | PASS | Target UI architecture 0/0; builds, UI tests, diff check passed. |
| 7 | NOT_APPLICABLE | Legacy live smoke unavailable: existing Express API not reachable. |
| 8 | PASS | No MySQL change, business migration, dual write, or cutover. |

## Open Issues

Repository-wide legacy architecture findings remain. Each future production table owner must set audit field policy before trigger registration. Identity, Authority, Documents/RAG, and business schema migration remain future work.

---

Generated by scripts/activity-report.ts; finalized content maintained for T2.

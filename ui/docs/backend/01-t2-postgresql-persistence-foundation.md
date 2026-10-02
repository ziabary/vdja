# T2 PostgreSQL persistence foundation

T2 runs beside the existing Express/MySQL public tools. The MySQL schema, business data, and public API remain unchanged. PostgreSQL contains only target infrastructure metadata and a separate test fixture; Identity, Authority, Documents, RAG, and business modules are deferred.

## Local service

The development service uses the exact `postgres:16.15-bookworm` image. PostgreSQL 16 remains supported through November 2028, and 16.15 is the current minor release selected for this environment. The Compose service binds `127.0.0.1:55432` and retains the named `vadja-t2_postgres_t2_data` volume across stop/start. The database is `targoman_t2`. Host connections use SCRAM credentials. `npm run db:pg:start` creates ignored `.env.pg.local` with random development passwords if absent. Never commit that file. The service has a `pg_isready` healthcheck; application readiness additionally verifies authentication, migration checksums, and audit objects.

```bash
npm ci
npm run db:pg:start
npm run db:pg:status
npm run db:pg:migrate
npm run db:pg:ready
npm run test:db:integration
npm run test:db:conformance
npm run db:pg:stop
```

`stop` preserves the volume. None of these commands resets the primary development database. The integration test creates a random `t2_test_<hex>` database and only drops that validated disposable name. It needs the bootstrap role to create and drop that test database. Normal runtime and migrations never use bootstrap.

## Roles and ownership

| Role | Login | DDL | DML | Audit mutation | Superuser |
| --- | --- | --- | --- | --- | --- |
| `t2_bootstrap` | Yes | Initial database and role administration | Administration only | Can administer | Yes, Docker initialization only |
| `t2_migration` | Yes | Database-local schema and owned objects | Migration objects | Can administer | No |
| `t2_runtime` | Yes | No schema administration | Granted fixture DML and metadata SELECT | No direct mutation | No |

The migration role owns `platform` and `audit`. `t2_fixture` is created only by the live test and is test-owned. A later API, Worker, or maintenance role can receive narrower grants without changing schema ownership. Runtime never owns a table. The test-only fixture grants are never part of a production migration.

## Migration and persistence

`packages/persistence` owns pool configuration, typed transaction scope, SQLSTATE classification, readiness, and explicit migrations. Kysely handles bounded runtime pool and transactions; `pg` provides the dedicated session connection required for an advisory migration lock. Pool max, idle timeout, connect timeout, host, port, and database are environment-configurable. Operations can be wrapped with timing/telemetry at this boundary later; bind values are not logged.

The migration command takes a session advisory lock with a 10-second lock timeout, sorts numbered SQL files, executes each migration and its metadata write in one transaction, and checks SHA-256 for every applied file. The metadata table is `platform.tbl_plt_migration`. An unknown or edited applied migration fails. Current schema is a no-op. Failure rolls back the migration transaction. Migration `001` creates metadata and audit; migration `002` gives the generated audit sequence the required `seq_` name. Migrations are forward-only; deployed changes use expand/migrate/contract and recovery planning. Application startup does not run migrations.

`withTransaction` requires explicit actor, correlation, and source values and stores them with transaction-local settings. It passes one typed transaction handle to all participating persistence work. A nested `withTransaction` call is not supported by its type contract; callers compose repository operations inside one outer transaction. Future business repositories belong to their owning module, not this package.

`readiness()` returns `READY`, `DATABASE_UNAVAILABLE`, `AUTHENTICATION_FAILED`, or `SCHEMA_OUTDATED`. It checks the runtime login, migration names/checksums, and audit objects. A network connection alone never means schema readiness.

## Audit and objects

`audit.tbl_aud_mutation` and `audit.fn_aud_capture()` are **PRODUCTION_INFRASTRUCTURE**. The function is `SECURITY DEFINER` with a fixed `pg_catalog` search path and explicitly qualified table reference. It requires transaction-local actor, correlation, and source context. Audit insertion occurs through a table trigger in the same transaction and rolls back with the mutation. Runtime has no direct audit table mutation grant. The audit table has no recursive trigger. This records what changed; semantic business audit explaining why is deferred.

The generic function captures full row JSON for the harmless test fixture. Before attaching it to a production domain table, that table's owner must define field exclusion/redaction policy so secrets and protected payloads are not copied. The test-only `t2_fixture` schema, `tbl_t2f_parent`, `tbl_t2f_item`, index, constraints, and trigger are created from `tests/db/fixture.sql` by the conformance test. They are **TEST_ONLY_CONFORMANCE**, never production migration objects. The fixture demonstrates soft deletion by an `itm_deleted_at` update and automatic `SOFT_DELETE` audit classification.

No domain tables, money columns, Qdrant, Redis, or external job scheduling are introduced. Canonical timestamps use `timestamptz`; Jalali formatting belongs in the UI.

## Verification and safety

`test:db:integration` verifies a disposable fresh install, failed migration rollback, concurrent lock serialization, checksum state, and current no-op. `test:db:conformance` connects to real PostgreSQL and emits deterministic JSON counts for `DB_CONFORMANCE_VIOLATION`, `DB_TEST_FAILURE`, and `DB_ENVIRONMENT_FAILURE`. It verifies role separation, ownership, names, runtime denial, constraints, transaction rollback, trigger audit, and time-zone conversion. PostgreSQL absence is reported as environment failure, not conformance success.

The conformance run also records one local connection acquisition, indexed lookup, and small transaction timing sample in milliseconds. This is a configuration sanity baseline, not a throughput or capacity claim.

No reset command is provided for the primary T2 volume. Any future destructive operation must verify an explicitly named disposable `t2_test_` target first. Keep development secrets outside source and reports.

## Dependency review

`kysely@0.28.8` is the typed query builder, `pg@8.18.0` is the PostgreSQL driver, and `@types/pg@8.15.5` supplies TypeScript declarations. All are pinned exactly and use MIT licenses. The repository-wide npm audit is recorded in the Activity Report; unrelated dependency upgrades are outside T2.

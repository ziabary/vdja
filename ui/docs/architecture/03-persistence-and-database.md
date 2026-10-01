# Targoman AI Platform — Persistence and Database Architecture

**Document:** `docs/architecture/03-persistence-and-database.md`  
**Version:** 0.1  
**Status:** Proposed Architecture  
**Depends on:**

- `00-manifest.md`
- `01-system-architecture.md`
- `02-engineering-conventions.md`

---

# 1. Purpose

This document defines the persistence and relational-data architecture of the **Targoman AI Platform**.

It defines:

- PostgreSQL ownership;
- database schemas;
- persistence boundaries;
- Query Builder usage;
- explicit SQL;
- Views;
- Materialized Views;
- Functions;
- Stored Procedures;
- Triggers;
- scheduled Database Events;
- transactions;
- Row-Level Security;
- database execution context;
- database audit;
- soft deletion;
- naming;
- constraints;
- indexes;
- migrations;
- runtime roles;
- data integrity;
- performance;
- persistence testing.

This document is normative for all platform capabilities and business modules using PostgreSQL.

---

# 2. PostgreSQL Is the Canonical Relational Store

PostgreSQL is the authoritative relational database of the platform.

It owns canonical relational state including:

- human and machine identities;
- tenants;
- organization structures;
- authorization configuration;
- sessions;
- quota / admission state where durable coordination is required;
- reconciliation state;
- AI operational run metadata; 
- business entities;
- document metadata;
- tickets;
- jobs;
- usage records;
- commercial state;
- audit evidence.

Derived systems such as Qdrant are not authoritative replacements for PostgreSQL.

---

# 3. PostgreSQL Distribution Is Platform-Controlled

The platform uses an approved PostgreSQL distribution.

Targoman may provide a versioned OCI image containing:

```text
PostgreSQL
+
Approved Extensions
+
Database Scheduling Extension
+
Platform Initialization
```

The PostgreSQL version and extension versions form part of the supported platform compatibility matrix.

An arbitrary extension must not be introduced into a customer installation without being incorporated into the supported database profile.

---

# 4. Database Extensions Are Explicit Dependencies

Required PostgreSQL extensions must be:

- declared;
- versioned;
- installed through migrations or platform initialization;
- included in compatibility testing.

The application must not silently assume that an extension exists.

---

# 5. Persistence Ownership

Every database object has one canonical owner.

An owner is either:

- a platform capability;
- or a business module.

Examples:

```text
Authority
    owns users, sessions, tenant authority state

Security Telemetry Export
    owns export checkpoints, destination state, and delivery state
    but does not own canonical audit or operational evidence

Admission Control
    owns durable quota, reservation, and concurrency-control state where required

Reconciliation
    owns unresolved external-operation and reconciliation-process state

Data Governance
    owns lifecycle / retention / egress policy state where persisted

AI Router
    owns AI endpoint, routing-policy, and AI Run operational metadata where persisted

Documents
    owns document metadata

Ticketing
    owns ticket state

Secretariat
    owns secretariat-specific business state
```

Other modules must not directly mutate the owner's private database structures.

---

# 6. Database Schema Names Express Ownership

Logical PostgreSQL schemas represent ownership boundaries.

Initial schemas may include:

```text
platform
authority
audit
security_telemetry
usage
admission
reconciliation
governance
ai
jobs

documents
knowledge
notifications
tickets
commercial

crm
widget
secretariat
letter
followup
```

A PostgreSQL schema is an ownership namespace.

It does not imply a separate microservice.

---

# 7. Module Codes Are Stable

Each persistent capability or module receives a stable lowercase module code.

Initial examples include:

```text
plt   platform
aaa   authority
aud   audit
ste   security telemetry export
usg   usage
adm   admission control
rcn   reconciliation
gov   data governance
air   AI router / AI runs
job   jobs

doc   documents
rag   knowledge / RAG
ntf   notifications
tkt   ticketing
com   commercial

crm   CRM
wdg   widget
sec   secretariat
ltr   letter assistant
flw   follow-up
```

Module codes are identifiers, not display names.

Once a module code appears in a released database schema, it must not be reused for another meaning.

---

# 8. Table Naming

Tables use:

```text
tbl_<module>_<entity>
```

Examples:

```text
tbl_aaa_user
tbl_aaa_group
tbl_tkt_ticket
tbl_sec_letter
tbl_com_order
```

Entity names are normally singular.

Table-name pluralization must not encode relationship cardinality.

Cardinality belongs in constraints.

---

# 9. Table Prefix Registry

Every table receives a globally unique lowercase column prefix of three to five letters.

Examples:

```text
tbl_aaa_user       → usr
tbl_aaa_group      → grp
tbl_tkt_ticket     → tkt
tbl_com_voucher    → vch
```

The table prefix must be unique across the product database.

This is required because normal SQL relies on column-prefix uniqueness to avoid unnecessary table qualification.

Once released, a table prefix must not be reassigned to another table.

---

# 10. Column Naming

Every normal table column begins with the owning table prefix.

Format:

```text
<table-prefix>_<semantic-name>
```

Examples:

```text
usr_id
usr_name
usr_email
usr_status

grp_id
grp_name

tkt_id
tkt_subject

vch_id
vch_amount
```

Generic domain-table columns such as:

```text
id
name
type
status
created_at
updated_at
```

are prohibited.

---

# 11. Lifecycle Columns

A normal mutable entity uses prefixed lifecycle columns.

Example:

```text
usr_created_at
usr_updated_at
usr_deleted_at
```

If the entity has a lifecycle state:

```text
usr_status
```

may also exist.

If optimistic concurrency is relevant:

```text
usr_row_version
```

should be present.

---

# 12. Append-Only Tables

Append-only structures normally contain:

```text
<prefix>_created_at
```

but do not require:

```text
<prefix>_updated_at
<prefix>_deleted_at
```

unless the domain explicitly supports those operations.

Examples of likely append-only structures include:

- financial ledger entries;
- database mutation audit;
- immutable business evidence.

---

# 13. Immutable Lookup Structures

Deployment-defined immutable lookup tables may omit lifecycle timestamps where the data is purely structural and migration-owned.

This exception must be intentional.

Mutable configuration tables remain ordinary lifecycle entities.

---

# 14. Foreign-Key Naming

Foreign-key columns explicitly identify:

1. the semantic role in the local table;
2. the referenced table identity.

A double underscore separates the two sides.

Format:

```text
<local-prefix>_<role>__<referenced-prefix>_<column>
```

Example:

```text
vch_owner__usr_id
```

means:

```text
Voucher.owner
    ↓
User.usr_id
```

Other examples:

```text
tkt_requester__usr_id
ltr_owner__usr_id
usr_parent__usr_id
sec_tenant__tnt_id
vch_group__grp_id
```

The double underscore `__` is reserved for relational-reference boundaries.

---

# 15. Foreign Keys Reference Immutable Identity

Foreign keys should normally reference immutable primary or alternate identifiers.

They must not normally reference mutable display values such as:

```text
name
title
label
email
```

unless the referenced value is intentionally defined as stable identity.

---

# 16. Primary-Key Naming

Primary-key columns use:

```text
<prefix>_id
```

Examples:

```text
usr_id
grp_id
doc_id
tkt_id
```

The exact physical identifier type and generator must be consistent with the platform ID strategy defined for the owning domain.

IDs must be immutable after creation.

---

# 17. Constraint Naming

Named constraints use explicit prefixes:

```text
pk_    primary key
fk_    foreign key
uq_    unique constraint
ck_    check constraint
```

Constraint names must describe their semantic target.

Examples:

```text
pk_usr
fk_vch_owner__usr_id
uq_usr_email
ck_tkt_status
```

Generated anonymous constraint names should be avoided for authoritative schema objects.

---

# 18. Index Naming

Indexes use:

```text
idx_
```

Examples:

```text
idx_usr_email
idx_tkt_status
idx_doc_tenant_created
```

An index must exist for a demonstrated:

- lookup;
- filtering;
- ordering;
- joining;
- uniqueness;
- concurrency

requirement.

Indexes are not added merely by convention.

---

# 19. Database Object Prefixes

Database objects use:

```text
fn_     Function
sp_     Stored Procedure
trg_    Trigger
ev_     Scheduled Database Event
vw_     View
mvw_    Materialized View
idx_    Index
seq_    Sequence
pk_     Primary Key
fk_     Foreign Key
uq_     Unique Constraint
ck_     Check Constraint
```

PostgreSQL enum types, where used, use:

```text
enu_
```

---

# 20. Routine Naming

Functions and Stored Procedures should include enough domain context to identify ownership and purpose.

Examples:

```text
fn_aaa_user_resolve
fn_tkt_queue_summary

sp_com_order_confirm
sp_sec_import_batch
```

Names should describe behavior rather than implementation technique.

---

# 21. Routine Parameter Naming

Input parameters begin with:

```text
i_
```

Output parameters begin with:

```text
o_
```

Input/output parameters begin with:

```text
io_
```

Examples:

```text
i_usr_id
i_tenant_id
o_result
io_row_version
```

---

# 22. Procedural Local Naming

Where procedural local names are needed, the preferred conventions are:

```text
v_      local scalar variable
r_      local row / record
cur_    cursor
c_      local constant
```

Example:

```text
v_now
r_order
c_max_attempts
```

These names do not replace column-prefix conventions.

---

# 23. Lowercase Physical Identifiers

Physical PostgreSQL identifiers use lowercase names.

Mixed-case quoted identifiers are prohibited.

Preferred:

```text
tbl_aaa_user
usr_created_at
```

Avoid:

```text
"tblAAAUser"
"usrCreatedAt"
```

This prevents unnecessary quoted SQL and reduces identifier ambiguity.

---

# 24. Schema Qualification

Authoritative raw SQL, database routines, migrations, and security-sensitive database code should explicitly qualify schema ownership.

Preferred:

```sql
FROM authority.tbl_aaa_user
```

rather than relying on an implicit `search_path`.

Critical behavior must not depend on whichever schema happens to occur first in `search_path`.

---

# 25. Column Qualification Is Normally Unnecessary

Because columns carry globally unique owning-table prefixes, normal SQL should not repeat table names for every column.

Preferred:

```sql
SELECT
    usr_name,
    grp_name
FROM authority.tbl_aaa_user
JOIN authority.tbl_aaa_group
    ON usr_group__grp_id = grp_id;
```

Avoid unnecessary qualification:

```sql
SELECT
    tbl_aaa_user.usr_name,
    tbl_aaa_group.grp_name
FROM ...
```

---

# 26. Table Aliases Are Exceptional

Table aliases must not be introduced merely to shorten table names.

They are allowed when structurally necessary.

Primary example:

- self-join;
- multiple occurrences of the same physical table.

Example:

```sql
SELECT
    child.usr_name,
    parent.usr_name
FROM authority.tbl_aaa_user AS child
LEFT JOIN authority.tbl_aaa_user AS parent
    ON child.usr_parent__usr_id = parent.usr_id;
```

Here qualification is required because the same table participates twice.

---

# 27. Column Aliases Represent Virtual Values

Column aliases should normally be used only for:

- computed values;
- aggregate output;
- virtual fields;
- intentionally constructed projection values.

Example:

```sql
SELECT
    COUNT(*) AS total_count
FROM tickets.tbl_tkt_ticket;
```

Column aliases must not be used merely to rename ordinary physical columns.

---

# 28. `SELECT *` Is Prohibited in Authoritative Queries

Persistence code should explicitly list required columns.

Avoid:

```sql
SELECT *
```

Explicit projection:

- documents intent;
- prevents accidental contract expansion;
- reduces unnecessary transport;
- makes schema changes safer.

Controlled administrative/debug queries are outside this rule.

---

# 29. PostgreSQL Rows Do Not Escape Persistence

Raw database row structures remain inside the persistence layer.

Persistence maps rows into:

- domain types;
- application result types;
- repository records.

Application and transport layers must not depend on PostgreSQL column naming.

For example:

```text
usr_created_at
```

may map inside persistence to:

```text
usrCreatedAt
```

or another canonical TypeScript representation.

---

# 30. No ORM

ORM-based authoritative persistence is prohibited.

Approved tools include:

```text
Kysely
Explicit SQL
PostgreSQL Functions
PostgreSQL Stored Procedures
Views
Materialized Views
```

Persistence design must retain explicit visibility of SQL semantics and database behavior.

---

# 31. Kysely Is the Default Query Builder

Kysely is the preferred TypeScript query builder unless an approved replacement provides a stronger fit.

Kysely is used for:

- type-safe simple reads;
- simple controlled writes;
- composition of ordinary predicates;
- explicit transactions;
- parameterized SQL construction.

Kysely must not become an abstraction that hides important database behavior.

---

# 32. Query Builder Does Not Replace SQL Design

The PostgreSQL planner optimizes the final SQL regardless of whether it originated from Kysely or explicit SQL.

The decision between Kysely and database-native objects is based on:

- locality;
- complexity;
- reuse;
- round-trip cost;
- transaction semantics;
- maintainability.

Not on an assumption that the application Query Builder performs database optimization.

---

# 33. Simple Reads

Simple application-specific reads should normally use Kysely through the owning repository.

Examples:

- load record by ID;
- list records using ordinary filters;
- simple pagination;
- basic lookup.

---

# 34. Complex Reads Stay Close to Data

Complex relational work should preferably remain inside PostgreSQL when it can be completed entirely there.

Candidates include:

- recursive organization queries;
- complex permission-support projections;
- reporting;
- aggregation;
- ranking;
- multi-table projections;
- reusable relational calculations.

Use as appropriate:

```text
View
Materialized View
Function
Explicit SQL
```

---

# 35. Views

Views use:

```text
vw_
```

Views are appropriate for reusable relational projections where:

- computation is reasonably inexpensive;
- current underlying data is required;
- persistence consumers share the same projection semantics.

A View is not an excuse to obscure ownership.

Its schema owner must remain clear.

---

# 36. Materialized Views

Materialized Views use:

```text
mvw_
```

They are appropriate for expensive derived projections where delayed freshness is acceptable.

Refresh strategy must be defined.

Possible mechanisms include:

- Database Event;
- explicit refresh procedure;
- application job.

Freshness requirements are part of the Materialized View contract.

---

# 37. Functions

Functions use:

```text
fn_
```

Functions are preferred for:

- reusable computed values;
- complex data-returning operations;
- table-returning query abstractions;
- database-local calculations.

Function volatility must be declared correctly:

```text
IMMUTABLE
STABLE
VOLATILE
```

Misrepresenting function volatility for performance is prohibited.

---

# 38. Stored Procedures

Stored Procedures use:

```text
sp_
```

They are preferred for data-local command operations that:

- span multiple tables;
- require ordered locking;
- perform coordinated database mutations;
- must remain atomic;
- involve substantial data-local processing.

Examples:

```text
sp_com_order_confirm
sp_sec_import_batch
```

---

# 39. Application Authorization Is Not Implemented in Procedures

Stored Procedures and Functions must not independently evaluate application authorization.

Forbidden:

```sql
IF i_role = 'manager' THEN ...
```

or local implementations of:

- privileges;
- roles;
- ACL precedence;
- classification policy;
- ownership authorization.

Authority is the sole authorization-decision engine.

Database routines receive already-authorized operations and enforce database integrity.

---

# 40. Database Security Is Defense in Depth

The database may enforce:

- tenant isolation;
- relational integrity;
- immutable fields;
- valid data ranges;
- local consistency;
- concurrency requirements.

This does not make PostgreSQL a second independent implementation of the Authority policy engine.

---

# 41. Stored Routines Do Not Control Application Transactions

Application-level transaction scope remains explicit.

Stored Functions and Procedures called by application persistence must not independently commit or roll back the caller's application transaction.

Transaction ownership must remain visible.

Database Events executing autonomously operate in their scheduler-managed transaction context.

---

# 42. Security Invoker Is the Default

Stored Functions and Procedures should use caller permissions by default.

`SECURITY DEFINER` is exceptional.

A `SECURITY DEFINER` routine requires:

- explicit justification;
- least-privileged routine owner;
- controlled `search_path`;
- schema-qualified object references;
- security tests.

---

# 43. Dynamic SQL Is Exceptional

Dynamic SQL is allowed only when static SQL cannot reasonably express the operation.

Values must be parameterized.

Identifiers must come from strict allow-lists and use safe identifier formatting.

Never construct dynamic SQL by concatenating untrusted values.

---

# 44. Persistence Layer Is the Only Database Caller

All access to PostgreSQL occurs through the owning persistence implementation.

Forbidden outside persistence:

```text
Kysely query construction
Raw SQL
CALL sp_...
SELECT fn_...
Direct database driver use
```

Controllers, workers, and application services call persistence contracts.

---

# 45. Repository Contracts Hide Persistence Technique

The application does not need to know whether a repository operation uses:

- Kysely;
- SQL;
- Function;
- Stored Procedure;
- View;
- Materialized View.

Example:

```text
Application
    ↓
intfOrderRepository.confirm(...)
    ↓
Persistence
    ↓
sp_com_order_confirm(...)
```

Implementation technique remains a persistence concern.

---

# 46. Explicit Transaction Ownership

Transaction ownership is explicit at application/use-case level.

Repositories taking part in one transaction receive the same transaction handle.

Forbidden:

```text
Repository A opens hidden transaction
Repository B opens separate hidden transaction
```

within one atomic use case.

---

# 47. Isolation Level Is Explicit When Non-Default Behavior Is Required

Ordinary operations may use PostgreSQL's approved default transaction isolation.

Operations requiring stronger guarantees must explicitly request an appropriate level such as:

```text
REPEATABLE READ
SERIALIZABLE
```

The reason must be documented and tested.

---

# 48. Locking Is Intentional

Use locking deliberately.

Possible mechanisms include:

```text
SELECT ... FOR UPDATE
SELECT ... FOR SHARE
Advisory Locks
```

Lock ordering should remain deterministic where several resources are locked.

This reduces deadlock risk.

---

# 49. Concurrency Must Be Tested

Critical concurrent operations require tests for:

- lost update;
- double processing;
- duplicate fulfillment;
- double payment handling;
- conflicting lifecycle transitions;
- lock contention;
- deadlock recovery.

---

# 50. Row Versioning

Concurrency-sensitive mutable entities should use:

```text
<prefix>_row_version
```

where optimistic concurrency is useful.

An update may require:

```text
WHERE entity_row_version = expected_version
```

and increment the version atomically.

A version conflict must produce a stable application conflict result.

---

# 51. Soft Delete Is the Default

Normal business deletion is represented by:

```text
<prefix>_deleted_at
```

The row remains physically present.

Soft-deleted data is historical state.

---

# 52. Re-Creation Does Not Require Physical Deletion

If a logically equivalent entity is created after an older entity was soft-deleted, the new entity should normally receive a new row and identity.

The historical row remains.

Normal creation must not physically erase previous history merely to satisfy a uniqueness constraint.

---

# 53. Partial Unique Constraints Support Soft Delete

Uniqueness applying only to active records should use partial uniqueness.

Conceptually:

```sql
CREATE UNIQUE INDEX ...
ON ...
(...)
WHERE entity_deleted_at IS NULL;
```

Tenant-owned uniqueness normally includes tenant identity where uniqueness is tenant-scoped.

---

# 54. Restoration Is an Explicit Operation

Reactivating a soft-deleted row is not the default implementation of Create.

If a domain supports restore, it must define an explicit Restore use case.

Restore must be:

- authorized;
- audited;
- concurrency-safe;
- tested against active uniqueness.

---

# 55. Physical Purge Is Exceptional

Hard deletion is limited to controlled:

- retention;
- garbage collection;
- legal deletion;
- data lifecycle;
- maintenance

workflows.

Ordinary runtime CRUD must not physically delete business state.

---

# 56. Hard Delete Must Be Auditable

Where physical deletion is permitted, the database mutation audit must capture required evidence before the row disappears.

A physical purge must identify:

- reason;
- policy;
- execution context;
- affected record.

---

# 57. Foreign-Key Delete Behavior

`ON DELETE CASCADE` is not the default.

Preferred behavior for authoritative business entities is normally:

```text
RESTRICT
or
NO ACTION
```

because ordinary deletion is soft deletion.

Cascade may be used for strictly subordinate ephemeral or implementation-detail data when explicitly justified.

---

# 58. Nullability Is Intentional

Columns should be `NOT NULL` unless absence is a meaningful state.

Nullable fields must have defined semantics.

Do not use null merely because data was inconvenient to initialize.

---

# 59. Database Constraints Are Preferred for Relational Integrity

PostgreSQL should enforce data-local invariants through:

- primary keys;
- foreign keys;
- unique constraints;
- check constraints;
- exclusion constraints where appropriate;
- immutable rules.

Application validation does not replace database integrity constraints.

---

# 60. Check Constraints

Check constraints use:

```text
ck_
```

Examples may enforce:

- positive quantities;
- valid numeric ranges;
- local mutually exclusive fields;
- local date ordering.

A Check Constraint must not duplicate complicated Authority or external business orchestration.

---

# 61. Relational-First Data Modeling

Governance-critical and queryable platform facts should normally be relational.

Do not hide core state only inside JSONB.

Examples that should normally be explicit relational state include:

- tenant ownership;
- authorization relationships;
- classification;
- lifecycle state;
- financial state;
- ownership;
- document relationship;
- entitlement.

---

# 62. JSONB Use

JSONB is appropriate for:

- provider payload snapshots;
- flexible metadata;
- external-system payloads;
- extension data;
- low-authority auxiliary attributes.

If a JSONB field becomes central to querying, integrity, authorization, or business decisions, it should be reconsidered as relational data.

---

# 63. Large Binary Data

Large document and file assets should normally be stored through the platform Storage abstraction rather than inside PostgreSQL.

PostgreSQL stores:

- identity;
- metadata;
- ownership;
- checksum;
- location;
- lifecycle.

The asset content resides in approved persistent storage.

---

## 63.1 Data Governance State Is Relational Where Authoritative

Authoritative governance facts should be represented relationally where they participate in decisions.

Examples include:

- retention policy;
- legal hold;
- residency class;
- external-provider eligibility;
- export restriction;
- purge prohibition.

Flexible policy metadata may use JSONB, but policy identity, ownership, lifecycle, and decision-critical relations should remain explicit.

Retention and purge routines must consume approved governance state rather than embedding independent retention policy.

---

## 63.2 AI Run Persistence Stores Metadata, Not Hidden Reasoning

Where AI Runs are persisted, they store operational metadata such as:

- tenant / actor identity;
- AI task;
- endpoint and model identity;
- policy / prompt version;
- start / completion time;
- latency;
- token usage;
- retry / fallback lineage;
- status;
- error class;
- request / correlation ID;
- estimated usage or cost metadata.

Ordinary AI Run persistence must not store:

- credentials;
- Access or Refresh Tokens;
- chain-of-thought;
- hidden reasoning traces;
- raw confidential prompt or response content unless separately approved by Data Governance.

Protected diagnostic content, if enabled, must have separate access and retention policy.

---

## 63.3 Admission State Must Support Distributed Enforcement

Admission and quota state that must remain correct across replicated API or Worker instances must use shared authoritative persistence or another approved distributed coordination mechanism.

Examples include:

- concurrency reservations;
- rate windows;
- quota reservations;
- committed usage checkpoints.

Admission updates must be atomic and concurrency-safe.

Process-local counters are not authoritative distributed quota state.

---

## 63.4 Count Queries Are Optional Work

List retrieval and total-count calculation are separate database operations.

Persistence must not automatically execute `COUNT(*)` for every paginated query.

A count is executed only when explicitly required by the application contract.

For expensive filtered or joined datasets, list retrieval and total-count queries may use different optimized SQL paths.

Cursor-based pagination is preferred for large or frequently changing datasets.

---

# 64. Tenant Ownership

Every tenant-owned table must expose tenant ownership explicitly.

Example:

```text
doc_tenant__tnt_id
tkt_tenant__tnt_id
sec_tenant__tnt_id
```

Tenant ownership must not be inferred indirectly when the row itself is a tenant security boundary.

---

# 65. RLS Provides Tenant Defense in Depth

PostgreSQL Row-Level Security should be used where appropriate to prevent accidental cross-tenant access.

The primary initial responsibility of RLS is tenant isolation.

RLS must not independently reimplement:

- roles;
- privileges;
- ACL evaluation;
- classification/clearance evaluation.

Those belong to Authority.

---

# 66. Database Execution Context

Database operations run with explicit transaction-local execution context.

Context may include:

```text
tenant ID
actor identity ID
actor identity type
session ID
request / correlation ID
module ID
execution source
```

This context is used by:

- audit;
- RLS;
- diagnostics;
- controlled database behavior.

---

# 67. Transaction-Local Context Only

Execution context in pooled database connections must be transaction-local.

Session-scoped pooled context is prohibited.

Preferred lifecycle:

```text
Acquire Connection
    ↓
BEGIN
    ↓
Set Local Execution Context
    ↓
Execute Persistence Work
    ↓
COMMIT / ROLLBACK
    ↓
Release Connection
```

Context must not leak to the next user of the pooled connection.

---

# 68. Missing Security Context Fails Closed

An auditable runtime mutation that requires actor or tenant context must not silently proceed with an empty security context.

Approved non-user contexts include explicit identities such as:

```text
system
worker
migration
maintenance
database-event
```

They must still be recorded.

---

# 69. Authority Decisions Are Not Derived From Database Context

Execution context provides factual identity and tenant data.

Persistence must not infer application permission from that context.

For example:

```text
actor = user-123
```

does not mean:

```text
user-123 may update this row
```

Authorization must already have been obtained from Authority.

---

# 70. Automatic Database Mutation Audit

Auditable mutations generate database-level change evidence automatically.

The preferred mechanism is:

```text
Table Mutation
    ↓
Audit Trigger
    ↓
Append-Only Audit Table
```

Application code is not required to remember to create the basic row-change audit.

---

# 71. Audit Trigger Coverage

Auditable tables must register appropriate audit triggers.

Architecture/schema tests must detect auditable tables that are missing required audit coverage.

Explicitly excluded tables must have documented reasons.

---

# 72. Audit Operations

The mutation-audit model should distinguish operations such as:

```text
INSERT
UPDATE
SOFT_DELETE
DELETE / PURGE
```

A transition from:

```text
deleted_at = NULL
```

to:

```text
deleted_at != NULL
```

should be recognizable as a soft deletion.

---

# 73. Audit Evidence

Database mutation audit should be capable of recording, where appropriate:

- table;
- record identity;
- tenant;
- actor;
- session;
- request/correlation ID;
- execution source;
- module;
- operation;
- timestamp;
- changed fields;
- relevant before state;
- relevant after state.

---

# 74. Audit Must Not Become a Secret Replication System

Audit evidence should remain sufficient for investigation without indiscriminately duplicating sensitive payloads.

Audit policy may:

- exclude large binary fields;
- mask secrets;
- hash selected values;
- store only changed fields;
- reference immutable document versions instead of duplicating full content.

Audit design must consider confidentiality as well as traceability.

---

# 75. Audit Storage Is Append-Oriented

Runtime application roles must not ordinarily:

- update;
- delete;
- rewrite

database audit records.

Audit correction should use additive evidence where possible.

---

# 76. Audit Itself Does Not Recursively Audit

The central database mutation-audit table must not recursively trigger its own generic audit mechanism.

Audit infrastructure requires explicit recursion protection.

---

# 77. Business Audit Remains Separate

Database audit answers:

> What changed in persistence?

Semantic business audit answers:

> Why did it change and through which business action?

Both may be recorded in one use case.

They remain distinct evidence.

---

# 77.1 Security Telemetry Export Is Derived From Canonical Evidence

Security Telemetry Export does not become the authoritative owner of Audit, Business History, or Operational Observability data.

Its persistence may own only export-specific state such as:

- destination configuration references;
- export policy references;
- cursor/checkpoint state;
- delivery attempts;
- terminal delivery status;
- transformation-profile references;
- dead-letter or unresolved export records.

Canonical audit and business evidence remain owned by their original capabilities.

---

# 77.2 Pull Export Uses Controlled Read Models

SOC / SIEM pull access must never expose direct PostgreSQL connectivity.

Persistence may expose optimized read models for the Security Telemetry capability using approved mechanisms such as:

- Views;
- Functions;
- controlled repositories;
- explicit SQL.

Pull read models must support stable cursor/checkpoint semantics and tenant filtering.

Authorization decisions remain the responsibility of Authority before the persistence operation is executed.

The read model itself must not become an independent authorization engine.

---

# 77.3 Push Export State Is Durable

Required outbound SOC / SIEM delivery must have durable persistence before it is considered scheduled.

At minimum, push persistence must support:

- stable canonical event identity;
- destination identity;
- delivery status;
- attempt count;
- retry scheduling;
- checkpoint or acknowledgement state;
- last error classification;
- terminal failed / unresolved state.

Delivery should assume at-least-once execution unless the target protocol provides stronger semantics.

Duplicate prevention or duplicate tolerance must be based on stable event identity rather than process-local memory.

---

## 77.4 Reconciliation State Is Durable

An external operation with uncertain finality must have durable reconciliation state when correctness depends on resolving the outcome.

Persistence should support, as applicable:

- originating operation identity;
- provider / destination identity;
- external correlation identity;
- request fingerprint;
- last known state;
- unresolved reason;
- reconciliation attempts;
- next reconciliation time;
- final resolved state;
- operator intervention state;
- audit correlation.

An unresolved external result must survive process restart.

Reconciliation persistence does not replace the originating module's canonical business state.

---

# 78. Runtime Database Roles

Database access uses least privilege.

At minimum:

```text
Migration Role
Runtime Role
```

should exist.

Preferred higher-assurance separation:

```text
API Runtime Role
Worker Runtime Role
Maintenance Role
Migration Role
```

---

# 79. Runtime Roles Are Not Schema Owners

Runtime roles must not normally have permission to:

- create schemas;
- alter tables;
- drop tables;
- create arbitrary functions;
- replace protected procedures;
- disable audit triggers;
- modify migration history.

---

# 80. Migration Role

The Migration role may perform approved schema changes.

It is used only for:

- installation;
- upgrade;
- controlled migration operations.

Application request handling must never execute with the Migration role.

---

# 81. Maintenance Role

Where needed, a separate Maintenance role performs controlled activities such as:

- retention;
- physical purge;
- partition maintenance;
- database-event administration.

It must remain less privileged than a PostgreSQL superuser wherever possible.

---

# 82. Superuser Is Not an Application Credential

No normal application container may connect to PostgreSQL as superuser.

Superuser credentials are infrastructure/bootstrap concerns only.

---

# 83. Database Events

The approved PostgreSQL distribution provides scheduled database Events through the supported scheduling extension.

Scheduled database objects use:

```text
ev_
```

Examples:

```text
ev_aud_cleanup_operational_logs
ev_job_cleanup_completed
ev_doc_gc_expired_assets
ev_usg_refresh_daily_summary
```

---

# 84. Database Event Scope

Database Events are allowed when the complete operation remains inside PostgreSQL.

Appropriate examples include:

- operational-log cleanup;
- expired temporary-data cleanup;
- garbage collection;
- partition maintenance;
- local aggregation;
- materialized-view refresh.

---

# 85. Database Events Must Not Call Application Infrastructure

Database Events must not invoke:

- LLMs;
- Qdrant;
- SMS;
- email;
- payment providers;
- HTTP APIs;
- object storage;
- external calendars.

Such work belongs to Jobs and Workers.

---

# 86. Database Events Are Idempotent

Periodic database operations should be safe if retried.

Where overlapping execution is possible, events should use a safe single-execution mechanism such as an advisory lock or equivalent database-local guard.

---

# 87. Retention Policy Controls Cleanup

An Event must not decide retention policy implicitly.

Retention policy determines what may be:

- kept;
- archived;
- anonymized;
- purged.

Retention execution must also respect applicable legal hold, residency, export, and unresolved mandatory-export constraints.

The Event executes the approved policy.

---

# 88. Protected Data Requires Explicit Retention

Generic cleanup must not automatically purge:

- security audit;
- database change audit;
- commercial ledger;
- legally significant business records.

Those structures require explicit retention policies.

---

# 89. Database Jobs and Application Jobs Are Different

A Database Event schedules database-local work.

An application Job schedules work executed through Worker.

The two mechanisms must not be mixed merely because both are scheduled.

---

# 90. Migration Ownership

Each persistent platform capability or module owns its migrations.

Examples:

```text
packages/authority/migrations/
modules/secretariat/migrations/
packages/ticketing/migrations/
```

Migration order within an owner is deterministic.

---

# 91. Migration Naming

Recommended migration naming:

```text
<module>_<sequence>_<description>
```

Examples:

```text
aaa_000001_create_identity_core
aaa_000002_create_session_tables

sec_000001_create_secretariat_core
sec_000002_add_source_registry
```

A released migration identifier is immutable.

---

# 92. Migration Registry

The platform maintains migration execution metadata containing at least:

- owner/module;
- migration identifier;
- checksum;
- applied timestamp;
- platform version where useful.

Changing the contents of an already-applied migration should be detected.

---

# 93. Migrations Must Work From Empty State

A clean platform installation must be reproducible using only:

```text
supported database image
+
versioned migrations
+
deployment configuration
```

Manual developer history must not be required.

---

# 94. Previous-State Migration Tests

Migrations must also be tested against representative previous-version schemas and data.

This detects upgrade failures that an empty-database test cannot reveal.

---

# 95. Migrations Are Deterministic

A migration must not depend on:

- arbitrary wall-clock decisions;
- random external data;
- network providers;
- developer-local state.

If data generation is required, its behavior must be deterministic.

---

# 96. Manual Production DDL Is Prohibited

Production changes must not be performed through undocumented ad-hoc schema modification.

Emergency changes require:

1. recorded incident context;
2. corresponding migration or reconciliation artifact;
3. post-change verification.

---

# 97. Forward Fix Is Preferred

Rollback is used only when demonstrably safe.

For high-value or append-only data, corrective migrations should normally move forward rather than destructively reverse history.

Financial corrections are additive.

---

# 98. Expand-Migrate-Contract

Changes requiring compatibility across rolling deployments should use staged migration where appropriate:

```text
Expand
   ↓
Deploy Compatible Code
   ↓
Migrate / Backfill
   ↓
Switch Usage
   ↓
Contract
```

Old and new application replicas must not observe an incompatible schema during normal rolling deployment.

---

## 98.1 PostgreSQL Backup and Recovery

Production PostgreSQL deployments require an explicit backup and recovery profile.

Depending on the deployment class, the profile may include:

- physical or logical backup;
- WAL archiving / Point-in-Time Recovery;
- encrypted backup storage;
- independent or off-site copies;
- retention policy;
- integrity verification;
- RPO;
- RTO.

Backup execution must not rely on application-container filesystem state.

---

## 98.2 Restore Verification Is Mandatory

A successful backup job does not prove recoverability.

Restore procedures must be tested periodically against representative data.

Restore verification should confirm:

- database consistency;
- migration-registry integrity;
- required extensions;
- application compatibility;
- audit continuity;
- recovery to the intended point in time where PITR is used.

For derived stores such as Qdrant, the recovery plan may use backup, rebuild from PostgreSQL, or both, depending on RPO / RTO requirements.

---

# 99. Routine Changes Are Migration-Controlled

Functions, Stored Procedures, Views, Triggers, and Events are source-controlled database objects.

Changes are installed through migrations.

Manual replacement in a running production database is prohibited.

---

# 100. Search Path Must Not Define Meaning

Authoritative SQL must not rely on an uncontrolled PostgreSQL `search_path`.

This is particularly important for:

- Stored Procedures;
- Functions;
- Triggers;
- `SECURITY DEFINER` routines;
- migrations.

Schema ownership should be explicit.

---

# 101. Query Performance Is a Database Concern

Complex query optimization should be performed with PostgreSQL-native tools.

Important queries should be examined using appropriate tools such as:

```text
EXPLAIN
EXPLAIN ANALYZE
BUFFERS
```

using representative data where possible.

---

# 102. Complex Data Work Avoids Unnecessary Round Trips

Avoid architectures such as:

```text
Database
   ↓ huge intermediate result
Application
   ↓ processing
Database
```

when equivalent work can be executed efficiently in one database-local operation.

Data locality is a design consideration.

---

# 103. N+1 Queries Are a Defect When Avoidable

Persistence implementations must avoid uncontrolled N+1 access patterns.

Use:

- joins;
- set-oriented queries;
- bulk operations;
- Functions;
- appropriate prefetching

where the data model allows.

---

# 104. Batch Operations Are Set-Oriented

Bulk operations should prefer set-based SQL over per-row application loops when the complete operation is data-local.

Example preference:

```text
one controlled UPDATE / procedure
```

over:

```text
10,000 HTTP/application/database round trips
```

---

# 105. Indexes Follow Query Patterns

Index strategy should be driven by:

- actual predicates;
- join patterns;
- sort patterns;
- tenant filtering;
- active-record filtering;
- uniqueness.

For tenant-scoped large tables, tenant columns will often participate in indexes, but this is not automatic.

---

# 106. Partial Indexes Are Preferred Where Semantics Are Partial

Examples include:

```text
active records only
unprocessed jobs only
open tickets only
```

when query patterns justify them.

Soft-delete uniqueness is a primary use case.

---

# 107. Materialized Projection Freshness Is Explicit

A Materialized View must document:

- freshness requirement;
- refresh mechanism;
- failure behavior;
- consumer expectations.

A stale Materialized View must not masquerade as authoritative transactional state.

---

# 108. Database-Side Business Decisions Have One Owner

A lifecycle transition may have its canonical data-local implementation in a Stored Procedure.

If so, application code must not independently reproduce the same state-transition logic.

The application may:

- authorize;
- orchestrate;
- call the procedure;
- interpret its typed result.

---

# 109. Database Procedures Return Stable Outcomes

A database routine used by application code should produce deterministic, typed outcomes suitable for mapping to stable application results.

Avoid relying on arbitrary exception text as a business result.

Known conflicts should map to defined result/error codes.

---

# 110. Database Errors Are Not API Errors

Raw PostgreSQL errors do not leave persistence.

Persistence translates expected database outcomes to stable application-domain errors.

Unexpected errors remain internal operational failures.

---

# 111. Secrets Are Not Normal Database Content

Provider secrets, signing keys, and similar operational secrets should normally be managed through approved secret-management mechanisms.

If encrypted secret material must be persisted, its encryption and access contract requires explicit security design.

Plaintext secrets in normal business tables are prohibited.

Machine credentials such as API keys must be stored using an approved non-reversible verifier or encrypted secret mechanism appropriate to the credential type.

Where an API key can be verified by hash, the cleartext key should be shown only at issuance and must not be recoverable from ordinary persistence.

Credential records should support lifecycle metadata such as creation, expiration, revocation, rotation lineage, and last-use information where required.

---

# 112. Audit and Logs Must Not Contain Secrets

Database audit, database logs, and operational logs must not record:

- passwords;
- Refresh Tokens;
- Access Tokens;
- OTPs;
- private keys;
- payment-provider secrets.

Audit configuration must account for sensitive fields.

---

# 113. Persistence Testing Is Mandatory

Database behavior requires direct database testing.

Application mocks do not prove persistence correctness.


Persistence testing should also cover, where applicable:

- machine-identity credential lifecycle;
- distributed quota / reservation concurrency;
- reconciliation durability;
- governance-controlled retention;
- AI Run redaction requirements;
- backup / restore verification.
 
---

# 114. Schema Naming Tests

Tests must verify, where applicable:

- table naming;
- module codes;
- unique table prefixes;
- column prefixes;
- FK double-underscore naming;
- lifecycle columns;
- object prefixes;
- constraint naming.

---

# 115. Audit Coverage Tests

Tests must prove that:

- auditable INSERT is captured;
- auditable UPDATE is captured;
- soft delete is captured;
- physical purge is captured where allowed;
- audit context is recorded;
- audit tables do not recursively audit themselves.

---

# 116. Soft-Delete Tests

Tests must verify:

- ordinary Delete performs soft delete;
- deleted data is excluded from ordinary active reads;
- active uniqueness permits recreation where defined;
- historical rows remain intact;
- unauthorized restore does not occur;
- purge requires controlled privilege.

---

# 117. RLS Tests

Tenant-isolation tests must verify that ordinary runtime persistence cannot unintentionally access another tenant's protected rows.

RLS testing must include:

- SELECT;
- INSERT;
- UPDATE;
- DELETE where applicable.

---

# 118. Routine Tests

Stored Functions and Procedures require direct tests for:

- expected output;
- invalid state;
- atomic rollback;
- concurrency;
- locking;
- null behavior;
- typed result mapping.

---

# 119. Event Tests

Scheduled Database Events require tests of the underlying operation independent of schedule timing.

Where feasible, tests should also verify:

- registration;
- idempotency;
- overlap protection;
- retention policy.

---

# 120. Database-Role Tests

Deployment tests should verify that runtime roles cannot perform prohibited DDL or disable protected audit behavior.

Least privilege is a tested property.

---

# 121. Migration Tests

CI must verify:

```text
empty database
    → latest schema
```

and representative:

```text
previous supported version
    → migrations
    → latest schema
```

Migration failure blocks release.

---

# 122. Architecture Tests

CI should reject:

- PostgreSQL client outside persistence;
- Kysely outside persistence;
- raw SQL outside persistence/migrations;
- ORM dependencies;
- unapproved hard delete;
- missing audit trigger on registered auditable tables;
- invalid naming;
- direct cross-module table access;
- plaintext recoverable API credentials where hashing is required;
- authoritative quota state implemented only in process-local memory;
- retention / purge paths bypassing governance policy.

---

# 123. Query-Plan Verification

Critical performance-sensitive queries should have representative query-plan review.

Where regression risk is high, performance fixtures or benchmark thresholds may be included in CI or release qualification.

Performance tests must avoid unstable micro-benchmark requirements that produce meaningless failures.

---

# 124. Database Documentation Is Generated Where Practical

Schema reference documentation should be derivable from authoritative database definitions where practical.

Useful generated information may include:

- table ownership;
- columns;
- constraints;
- indexes;
- Functions;
- Procedures;
- Views;
- Events;
- migration status.

Generated documentation is not manually edited.

---

# 125. Database Comments

Important database objects should use PostgreSQL comments where they improve discoverability.

Useful comments include:

- ownership;
- unusual invariants;
- retention semantics;
- sensitive-data warnings;
- table-prefix meaning.

Comments do not replace architecture documentation.

---

# 126. Persistence Exceptions Are Explicit

Any exception to this document requires:

- affected rule;
- reason;
- exact scope;
- owner;
- risk;
- compensating controls;
- tests;
- removal condition;
- approval.

An undocumented persistence exception is a defect.

---

# 127. Final Persistence Rule

The persistence architecture follows these principles:

```text
PostgreSQL owns relational truth.

Authority owns authorization decisions.

Persistence owns database interaction.

Complex data-local work stays close to data.

Application services own external orchestration.

Database mutations are auditable by default.

Business deletion preserves history.

Schema changes are migration-controlled.

Runtime access is least-privileged.

Database behavior is tested directly.
```

The default persistence question is:

> **Who owns this data, which database object enforces its local integrity, which persistence contract exposes it, which audit evidence records its mutation, and which test proves the behavior?**
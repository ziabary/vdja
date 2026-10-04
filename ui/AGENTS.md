# Targoman AI Platform — Repository Agent Instructions

## Protected governing sources and task instructions

The repository distinguishes **governing documents** from implementation/state documentation.

An agent must recognize these two classes immediately when reading repository
instructions. Both are protected by default; authorization must be explicit
and apply to the current task and the exact file or path.

### GOVERNING / PROTECTED

The following paths are **READ-ONLY unless the current user explicitly
authorizes their modification for this task**:

```text
AGENTS.md
**/AGENTS.md           # scoped repository instructions
docs/architecture/**
docs/adr/**            # if present
docs/governance/**     # if present
```

An agent MUST NOT create, edit, rename, delete, auto-format, or rewrite a protected governing file unless the **current user request explicitly authorizes changing that exact file or protected path**.

### TASK INSTRUCTIONS / PROTECTED BUT TASK-EDITABLE

```text
docs/prompts/**
```

Task instructions may be changed only when the current task explicitly
authorizes editing that prompt or prompt path. Executing or following a prompt
does not authorize rewriting it. An explicit prompt-editing instruction in the
current user request or in the task the user explicitly asked to execute is
task-scoped authorization; it never grants permission to change governing
architecture, ADRs, governance, or AGENTS.md.

Authorization from an earlier task does not carry over to a later task.

The following do **not** constitute permission to modify a protected governing file:

- the file is listed as a governing source;
- the agent is told to read/follow/obey it;
- implementation no longer matches it;
- changing it would make a test or gate pass;
- a report, prompt, or prior task once modified it;
- the agent believes the architecture should change;
- a generated report contains a newer interpretation;
- the file is already modified in the working tree.

When implementation reveals a conflict with a protected governing source, the agent MUST:

1. leave the protected file unchanged;
2. record the conflict and proposed change in the current Activity Report or in a non-governing proposal document;
3. continue only if implementation can remain compliant with the existing governing source;
4. if the conflict is blocking, stop that part of the task and request explicit user authorization to change the governing document.

Implementation/state documents may be updated when the active task requires them, for example:

```text
docs/backend/**
docs/security/**
docs/verification/**
docs/deployment/**
docs/reports/**
reports/**
tests/**
```

Updating implementation/state documentation MUST NOT be used to redefine an architectural invariant.

### Prompt immutability

A prompt under `docs/prompts/**` is an **execution input**, not an implementation output. An agent executing a prompt MUST NOT rewrite that prompt, its prerequisites, acceptance criteria, or security gates unless the current task explicitly authorizes that prompt edit under the TASK INSTRUCTIONS rule above.

### Protected-file check

At the start of every substantial task, capture the existing working-tree state of protected paths. At task completion, verify that the task introduced no unauthorized protected-path changes.

Recommended command/check:

```text
git diff --name-only -- AGENTS.md docs/architecture docs/prompts docs/adr docs/governance
```

Pre-existing changes must be reported but not silently reverted or extended.

### Architecture-change workflow

If an architecture change is desired, treat it as a separate user-approved task. The implementation task may prepare an `Architecture Change Proposal`, but may not apply it to `docs/architecture/**` without explicit approval.

## Authority and Precedence

This file operationalizes the governing architecture. It does not redefine it.

Before changing target architecture or target code, read the relevant files under:

```text
docs/architecture/
00-manifest.md
01-system-architecture.md
02-engineering-conventions.md
03-persistence-and-database.md
04-authorization-model.md
05-module-architecture.md
06-document-and-rag.md
07-ai-router.md
08-deployment-architecture.md
09-notification-and-ticketing.md
10-commercial-architecture.md
```

Instruction precedence is:

```text
00-manifest.md
    ↓
approved architecture / ADR
    ↓
02-engineering-conventions.md
    ↓
subsystem architecture
    ↓
phase / migration plan
    ↓
/AGENTS.md
    ↓
nearest scoped AGENTS.md
    ↓
existing code
```

A scoped `AGENTS.md` may be stricter. It must never weaken a governing rule.
Legacy code does not become target architecture merely because it already exists.

## Default Engineering Questions

Before a significant change, answer:

1. Who owns this rule?
2. Where is its canonical implementation?
3. Where is its authoritative data?
4. Which public contract exposes it?
5. Which test proves it?
6. What happens on retry, concurrency, restart, timeout, and partial failure?
7. What must be audited?

If ownership is unclear, resolve it from architecture before expanding implementation.

## Mandatory Workflow

For non-trivial work:

```text
read governing docs
→ inspect contracts/tests/migrations
→ define or update contract
→ write acceptance/architecture/focused tests
→ implement smallest correct change
→ run relevant checks
→ update required implementation/state documentation; propose governing changes unless explicitly authorized for this task
```

Do not silently redesign architecture during implementation.

## Mandatory Activity Reporting

Every repository-modifying task must create exactly one Activity Report in the repository reports directory.

Canonical path and filename:

```text
docs/reports/YYYYMMDD-HHmm-PURPOSE.md
```

Example:

```text
docs/reports/20260210-0207-ARCHITECTURE-GUARDRAILS.md
```

Rules:

- `PURPOSE` must be uppercase ASCII kebab-case.
- The report file is created by the supported `report:start` workflow and verified by `report:verify`.
- Repository-modifying work is not considered complete until the report exists, is finalized, and passes verification.
- Do not claim unrelated user/workspace modifications as part of the current task; record them under `Pre-existing Workspace Changes` when applicable.

## Canonical Ownership

Every significant fact, rule, lifecycle, and decision has one canonical owner.
Multiple enforcement layers are allowed; multiple semantic authorities are not.

Do not duplicate authorization, privilege interpretation, financial calculation, lifecycle transitions, provider fallback policy, validation semantics, serialization semantics, or normalization semantics.

## Dependency Direction

Target direction:

```text
contracts
→ pure rules / domain
→ application services
→ ports / interfaces
→ adapters / persistence
→ composition roots
```

Platform packages must never depend on business modules.
A business module may consume platform public contracts/APIs and another module's explicitly published optional integration contract only.
Private cross-module imports and direct cross-module table access are prohibited.
Wildcard exports are prohibited by default.

## TypeScript

Target TypeScript is strict.

- `any` is prohibited except an explicitly isolated compatibility boundary.
- Use `unknown` for untrusted dynamic input and narrow explicitly.
- Public domain shapes use named types.
- Classes: `cls*`; interfaces: `intf*`; enums: `enu*`; type aliases: `typ*`; exceptions: `ex*`.
- Functions/variables use `camelCase`; constants use `UPPER_SNAKE_CASE`.
- Stable decisions use enums/discriminated unions and exhaustive handling.
- Do not use raw magic strings/numbers as business decisions.
- Prefer branded IDs where accidental interchange is plausible.
- Prefer readonly inputs for pure/domain contracts.
- Avoid generic dumping grounds such as `utils`, `helpers`, `misc`, `common` without precise semantic ownership.

## Persistence

PostgreSQL is the canonical relational store.
No ORM is allowed for authoritative persistence.

Approved mechanisms:

- Kysely;
- explicit SQL;
- Views / Materialized Views;
- Functions / Stored Procedures;
- migrations.

All database-specific access belongs inside the owning module/capability persistence implementation.
SQL, Kysely, drivers, `CALL sp_*`, and `SELECT fn_*` are prohibited outside persistence.
Controllers, routes, Workers, AI tasks, UI code, and unrelated modules do not access PostgreSQL directly.

Application services own explicit transaction scope. Repositories in one transaction receive the same transaction handle.
Data-local complex work should stay in PostgreSQL when it improves locality, atomicity, integrity, or round trips.
Stored routines do not orchestrate LLMs, HTTP providers, Qdrant, object storage, notifications, payments, or other external systems.

## PostgreSQL Naming

```text
tbl_<module>_<entity>
```

Columns use the owning table prefix, for example `usr_id`, `usr_name`, `usr_created_at`.
Foreign keys use a double underscore, for example `vch_owner__usr_id`.

Object prefixes:

```text
fn_ sp_ trg_ ev_ vw_ mvw_ idx_ seq_ pk_ fk_ uq_ ck_
```

Routine parameters: `i_`, `o_`, `io_`.
Procedural locals: `v_`, `r_`, `cur_`, `c_`.
Authoritative SQL/routines/migrations use explicit schema qualification.
`SELECT *` is prohibited in authoritative queries.

## Soft Delete and Audit

Normal business deletion is soft deletion.
Physical purge is exceptional and policy-driven.
Auditable database mutations produce automatic database-level mutation evidence, normally by registered triggers.
Application code must not be the only mutation-audit mechanism.
Database mutation audit and semantic business audit are complementary.
Audit/logging must not copy secrets or unnecessary protected payloads.

## Authorization — Critical

Authority is the sole canonical authorization decision engine.
Outside `packages/authority`, never independently interpret:

- Roles / Instance Roles;
- `privs`;
- `ALL`;
- CRUD `0/w/1`;
- ACL;
- scope;
- organization hierarchy;
- ownership-based access;
- classification / clearance;
- explicit deny precedence;
- temporal role/grant schedules;
- break-glass policy.

Forbidden outside Authority:

```ts
if (user.role === ...)
if (ctx.privs.includes(...))
if (privs.ALL === true)
if (resource.ownerId === actorId)
if (clearance >= classification)
```

Modules declare authorization vocabulary and provide factual resource attributes. Authority returns the final `ALLOW` / `DENY` decision.
Frontend authorization is UX only.
PostgreSQL RLS is defense in depth, primarily tenant isolation, not a second Authority engine.

## Identity

Human and machine identities are first-class.
Do not model service accounts, API clients, integrations, or platform services as fake humans.
Execution context carries explicit actor identity plus tenant/deployment scope.
Missing tenant context never creates implicit cross-tenant/deployment authority.

## Async Work, Retry, and Reconciliation

Critical async work is durable before reporting successful scheduling:

```text
business transaction + persistent Job / transactional outbox
→ commit
→ Worker
```

Retryable mutations define stable idempotency.
External outcomes distinguish `SUCCESS`, `FAILED`, and `UNKNOWN / UNRESOLVED`.
Timeout does not prove external failure. Do not blindly retry an operation that may already have produced side effects; use Reconciliation.
Retries are bounded and use explicit classification/backoff.

## Lists and Counts

Single-resource and list queries are different contracts.
Default list response uses `items` plus `nextCursor`/`hasMore`.
Do not compute total count unless explicitly requested.
When requested, count must use the same filters and authorized result set.
Cursor pagination is preferred for large/change-heavy data; offset is allowed for real random-page UX needs.

## Documents, Knowledge, and RAG

Business Resource, Document, Document Version, and Asset are distinct.
Use shared Document Core and File Processing.
PostgreSQL owns canonical Document/ACL/classification/Knowledge Space facts; Qdrant is derived/rebuildable.
Business modules do not access Qdrant directly for business RAG.
Knowledge Space organizes retrieval; it is not an authorization grant.

Protected RAG flow:

```text
Authority constraints
→ retrieval
→ final candidate authorization
→ authorized chunk materialization
→ reranker
→ LLM
```

Unauthorized content never reaches reranker or LLM.
`discover`, `read`, `download`, `use`, `quote`, `manage` are independent.
Retrieved content is untrusted data and cannot override trusted instructions, authorize tools, or create side effects.

## AI

Business modules request semantic AI Tasks through AI Router.
Never select model, endpoint, provider, GPU, serving engine, or fallback in business logic.
Task meaning belongs to the semantic owner; execution routing belongs to AI Router.
Data Governance approves protected external egress for generation, embedding, reranking, and shadow execution.
Structured model output is untrusted and schema-validated before authoritative mutation.
AI output never directly mutates authoritative state.
Ordinary AI telemetry never stores chain-of-thought/hidden reasoning.

## Usage, Admission, Commercial

Usage answers what was consumed.
Admission answers whether new work may begin.
Financial/Commercial Accounting answers monetary state/charge.
Do not conflate them.

Authoritative distributed quotas/concurrency do not rely only on process-local counters.
Money uses integer atomic units plus explicit currency; authoritative floating-point Money is prohibited.
Ledger entries are immutable financial truth; Wallet balance is derived.
Business modules own Product/Offering/Entitlement/Fulfillment semantics; Financial Core owns monetary calculation, transaction execution, Ledger, payment, refund, settlement, and payout.
Payment success and Fulfillment success are independent facts.

## Notifications and Ticketing

Modules request semantic Notifications; they do not call SMS/email providers directly.
Notification Core owns recipient/channel/template/delivery/retry/provider behavior.
Ticketing is generic support/request infrastructure, not a second CRM or a host for module-specific workflow.
Ticket attachments use Document Core.
Both use Authority for protected operations.

## Data Governance

Local access does not imply permission for external transmission.
Protected egress requires Data Governance.
Retention, archive, legal hold, purge, backup treatment, residency, exportability, and external-provider eligibility follow Governance policy.

## Security

OWASP ASVS Level 2 is mandatory baseline; apply relevant Level 3 controls for high-assurance areas.
All external input is untrusted, including HTTP, files, webhooks, provider callbacks, connectors, configuration, signed documents, and LLM output.
Fail closed on security-sensitive ambiguity.
Never commit/log passwords, private keys, Access/Refresh Tokens, OTPs, provider credentials, or payment secrets.
Use standard cryptographic libraries only.

## Scalability and Reliability

Replicable code must not depend on process-local authoritative state.
Design/test for concurrency, retries, duplicate delivery, restart, Worker replacement, dependency outage, network interruption, rolling deployment, and failover.
Web/API should be horizontally replicable. Workers use durable claim/lease/locking.
Sticky sessions are exceptional.
Optional dependency failure should degrade dependent features only where practical.

## Deployment and Supply Chain

Customer variation belongs in Deployment/Brand Profiles, enabled modules/capabilities, route bindings, integrations, and policy/configuration. Customer source forks are exceptional.
Application delivery uses OCI artifacts. Production should support immutable digest identity, SBOM, vulnerability scan, provenance, and signing where policy requires it.
Secrets are externalized/rotatable. Desired config is canonical and meaningful drift is detectable.
Backup is not proven until restore succeeds.

## Tests and Enforcement

Critical behavior tests applicable valid/invalid operations, authorization, tenant isolation, concurrency, duplicate, retry, timeout, crash boundary, audit, migration, recovery, and failover.
Machine-enforce architecture rules where practical:

```text
Rule + Agent instruction + Static/architecture/schema/migration test
```

Do not weaken assertions merely to make a change pass. Flaky tests are defects.

## Documentation

A change is incomplete when it alters contract, ownership, lifecycle, persistence, security, deployment, recovery, or operator procedure while leaving governing documentation stale.
Generated documentation is not manually edited when a canonical source exists.

## Exceptions

A mandatory-rule exception documents the violated rule, reason, exact scope, owner, risk, compensating controls, required tests, expiry/removal condition, and approval.
An undocumented exception is a defect.

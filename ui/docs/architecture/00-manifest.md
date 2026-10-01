# Targoman AI Platform Manifest

**Document:** `docs/architecture/00-manifest.md`  
**Version:** 0.4  
**Status:** Proposed Architectural Baseline

---

# 1. Purpose

The **Targoman AI Platform** is a modular enterprise platform for building, delivering, operating, and commercially offering AI-enabled applications and services.

It is developed and maintained by Targoman, but it is not a single application and its runtime identity is not required to carry the Targoman brand.

The platform must support delivery:

- as a complete integrated suite;
- as a selected collection of modules;
- as a single business module with only its required platform capabilities;
- as a private enterprise installation;
- as a Targoman-hosted service;
- under the Targoman brand;
- under a customer brand;
- or as a fully white-labeled deployment.

Initial business modules include:

- CRM;
- Chat Builder / Widget;
- Smart Secretariat;
- Letter Assistant;
- Follow-up.

The architecture must also allow future modules without fundamental redesign of the shared platform.

The primary architectural principle is:

> **Build generic capabilities once in the Platform Core; keep domain-specific behavior inside independent business modules.**

---

# 2. One Product, Multiple Delivery Forms

The platform must remain one maintainable product codebase.

Customer differences must normally be expressed through:

- deployment profiles;
- brand profiles;
- enabled modules;
- tenant configuration;
- route bindings;
- feature policies;
- integration adapters;
- security policies;
- commercial configuration;
- infrastructure configuration.

Customer-specific source forks are exceptional and must not be required for ordinary deployments.

---

# 3. Product Ownership and Runtime Branding Are Separate

The product belongs to Targoman.

Runtime branding is configurable.

No business module may depend on Targoman-specific:

- logos;
- product names;
- domains;
- colors;
- support information;
- email identity;
- report branding;
- notification branding.

Branding is a shared platform capability.

A Brand Profile may define:

- product name;
- organization name;
- logo variants;
- favicon;
- visual tokens;
- typography;
- login identity;
- email identity;
- notification identity;
- support contacts;
- footer content;
- legal text;
- generated-document branding.

Branding should preferably be replaceable at deployment time without rebuilding application logic.

---

# 4. Modularity Is a First-Class Requirement

Every capability belongs primarily to one of two categories.

## Platform Capability

A reusable domain-independent capability.

Examples include:

- Identity;
- Authentication;
- Authorization;
- Session Management;
- Tenant Management;
- Organization Management;
- Audit;
- Security Telemetry Export;
- Quota and Admission Control;
- Reconciliation;
- Data Governance;
- Usage Accounting;
- Commercial Accounting;
- Documents;
- File Processing;
- Knowledge Management;
- RAG;
- AI Routing;
- Calendar;
- Jobs;
- Notifications;
- Ticketing;
- Integrations;
- Storage;
- Branding;
- Admin Shell;
- User Dashboard Shell.

## Business Module

A domain-specific application.

Examples include:

- CRM;
- Chat Builder / Widget;
- Smart Secretariat;
- Letter Assistant;
- Follow-up.

A business module owns:

- its domain model;
- its business semantics;
- its domain-specific database structures;
- its application services;
- its domain-specific UI;
- its AI tasks;
- its integrations;
- its optional commercial offerings.

---

# 5. Shared Core Must Not Become a Business Monolith

A capability belongs in the shared platform only when it is:

1. domain-independent;
2. reusable across multiple modules or deployment scenarios;
3. meaningful outside a particular business workflow.

> **Shared infrastructure is desirable. Shared business semantics are not.**

The Platform Core must not silently accumulate module-specific rules.

---

# 6. Modules Are Independently Deliverable

A valid installation may contain:

```text
Platform Core
+
Smart Secretariat
```

without:

```text
CRM
Widget
Letter Assistant
Follow-up
```

Another installation may contain:

```text
Platform Core
+
Widget
+
Follow-up
```

Each business module must explicitly declare:

- required platform capabilities;
- optional platform capabilities;
- optional module integrations;
- database contributions;
- backend routes;
- frontend routes;
- jobs;
- permissions;
- administration contributions;
- dashboard contributions;
- AI tasks;
- external adapters;
- commercial offerings.

---

# 7. Module Integration Is Optional and Contract-Based

Modules may cooperate without becoming structurally dependent.

Examples:

- Follow-up may consume Secretariat letters but must also accept standalone input;
- Letter Assistant may integrate with a Secretariat but must operate without it;
- CRM may create Follow-up work without owning Follow-up;
- Widget may escalate conversations into Ticketing without owning Ticketing.

Cross-module communication must use explicit:

- contracts;
- stable resource references;
- events;
- hooks;
- adapters.

Direct access to another module's private implementation or tables is prohibited.

---

# 8. Installed, Enabled, and Authorized Are Different

These states are distinct:

```text
Installed
Enabled for Tenant
Authorized for User
```

A module is visible or executable only when all applicable conditions are satisfied.

The platform must not expose an inactive module merely because its code exists in a build.

---

# 9. Runtime Plugin Loading Is Not Required

Module architecture does not imply arbitrary loading of third-party executable code at runtime.

Official modules may be selected during build or deployment.

Tenant-level enablement remains configurable at runtime.

Dynamic plugin installation may be considered later only if a concrete requirement justifies it.

---

# 10. Entry Experience Is Deployment-Defined

A deployment may expose the platform through:

## Path-Based Modules

```text
https://ai.customer.example/
https://ai.customer.example/secretariat
https://ai.customer.example/crm
```

## Module Subdomains

```text
https://secretariat.customer.example/
https://crm.customer.example/
```

## Dedicated Domains

```text
https://customer-secretariat.example/
```

Modules must not assume a fixed external URL.

---

# 11. Platform-First and Module-First Experiences Are Both Supported

A deployment may use:

```text
Platform Landing
    ↓
Module Cards
    ↓
Login
    ↓
Module
```

or:

```text
Login
  ↓
User Dashboard
  ↓
Module Cards
```

or:

```text
Module Landing
    ↓
Login
    ↓
Module
```

or:

```text
Module Domain
    ↓
Login
    ↓
Module
```

The selected experience is deployment configuration.

---

# 12. User Dashboard Is a Platform Surface

The platform may provide a common authenticated User Dashboard.

Depending on enabled capabilities, it may contain:

- module launch cards;
- personal usage;
- service limits;
- notifications;
- tickets;
- active entitlements;
- packages;
- balances;
- orders;
- invoices;
- sessions;
- profile settings.

The dashboard is **service-first**, not storefront-first.

In single-module deployments it may be reduced, embedded into the module, or omitted.

---

# 13. Admin Backoffice Is a Separate Platform Surface

Administrative capabilities are exposed through a common module-aware Admin Shell.

Modules and capabilities may contribute:

- menus;
- pages;
- settings;
- dashboards;
- reports;
- operational controls;
- monitoring;
- privileges.

Admin is not a Boolean property.

Administrative actions are permission-based and scope-aware.

---

# 14. Multi-Tenancy Is Native

The platform is multi-tenant by design.

A deployment may host:

```text
one tenant
```

or:

```text
multiple independent tenants
```

A single-tenant deployment is a special case of the same architecture.

Tenant-owned data must always carry explicit tenant context.

---

# 15. Deployment and Tenant Are Different Concepts

A Deployment is a running installation of the product.

A Tenant is an organizational security and data boundary inside the deployment.

For example:

```text
Deployment
├── Tenant A
├── Tenant B
└── Tenant C
```

and:

```text
Dedicated Customer Deployment
└── Customer Tenant
```

are both valid.

---

# 16. Identity Is Global; Authorization Context Is Explicitly Scoped

A human user may belong to multiple tenants.

An active authorization session belongs to exactly one tenant.

```text
Identity
   ↓
Authentication
   ↓
Tenant Selection
   ↓
Tenant Session
   ↓
Tenant-Scoped Access Token
```

Privileges from multiple tenants must never be merged into a single active access token.

A valid global authentication session may allow tenant switching without repeating the full login process.

Machine identities may use non-session authentication mechanisms.

Every resulting authorization context must still have explicit tenant or deployment scope.

Deployment-scoped or cross-tenant machine authority requires an explicit privileged contract and must never arise implicitly from missing tenant context.

---

## 16.1 Human and Machine Identities Are First-Class

Platform identity is not limited to human users.

Authority must support distinct identity classes such as:

- human users;
- service accounts;
- API clients;
- platform services;
- integration identities.

Machine identities must not be represented as fake human users.

Each identity class must have explicit credential, lifecycle, revocation, scope, audit, and tenant semantics.

External identity systems may participate through federation and provisioning mechanisms such as OIDC, SAML, LDAP / Active Directory, and SCIM where required.

External identity providers may establish or provision identity facts, but they do not replace the platform Authority capability as the canonical owner of authorization decisions.

---

# 17. Authentication and Authorization Are Separate

Authentication answers:

> Who is the caller?

Authorization answers:

> What may this identity do, in this tenant, within this scope, on this resource?

Business modules must not implement independent authentication systems.

---

# 18. Authorization Is Multi-Layered

Authorization combines:

```text
Scoped RBAC
+
ABAC
+
Resource ACL
+
Application / Instance Roles
```

Roles exist because they are understandable to administrators and business users.

Roles are not the ultimate authorization primitive.

Roles resolve into explicit permissions and scoped grants.

---

# 18.1 Authorization Has One Canonical Owner

The Authority capability is the sole canonical owner of authorization evaluation.

Business modules may declare:

- resources;
- operations;
- permissions;
- application roles;
- instance roles;
- ownership attributes;
- classification attributes;
- organizational relationships;
- other factual resource attributes required for authorization.

Business modules must not independently decide whether access is allowed or denied.

They must not implement:

- role evaluation;
- privilege evaluation;
- ACL evaluation;
- scope evaluation;
- clearance/classification policy;
- grant/deny precedence;
- ownership-based access rules;
- tenant authorization rules.

All authorization decisions must be delegated to the shared Authority capability.

A module may provide factual evidence required for a decision.

For example:

```text
Document Module
    → owner = user-123
    → organization = legal
    → classification = confidential

Authority
    → evaluates policy
    → ALLOW / DENY
```

The module provides facts.

Authority provides the decision.

Authorization rules must not be duplicated in controllers, modules, frontend code, workers, database procedures, or integration adapters.

---

## 18.2 Emergency / Break-Glass Access Is Explicit

Emergency administrative access must never be implemented as an undocumented universal administrator bypass.

Where a deployment requires break-glass access, it must be:

- explicitly requested;
- strongly authenticated;
- limited in scope;
- limited in duration;
- reason-coded;
- fully audited;
- automatically revoked or expired;
- subject to additional approval or dual control where policy requires it.

Break-glass access remains an Authority decision and must not bypass tenant, audit, or resource-accountability mechanisms.

---

# 19. Privilege Digestion Is Tenant-Scoped

Effective privileges may derive from:

- tenant membership;
- organization membership;
- groups;
- application roles;
- instance roles;
- explicit grants;
- explicit denials;
- policies.

The resulting privilege digest may be carried in the access token.

Privilege digestion occurs only for the active tenant.

---

# 20. Security Classification Is Tenant-Defined

Tenants may define security-classification levels and policies.

Possible defaults include:

- Public;
- Internal;
- Restricted;
- Confidential;
- Highly Confidential.

Classification alone does not create access.

Authorization may combine:

```text
classification
+
clearance
+
scope
+
ACL
+
policy
```

---

# 21. Document Access Is Not a Single Permission

At minimum, the system must be able to distinguish:

```text
discover
read
download
use
quote
manage
```

A user may be allowed to obtain an AI-derived answer from a document while being forbidden from:

- discovering the document;
- opening the document;
- downloading the document;
- receiving direct quotations from it.

This is an explicit and supported security model.

---

# 22. Authorization Must Precede Retrieval

For RAG and other knowledge workflows:

```text
Authorization
      ↓
Authorized Retrieval
      ↓
LLM
```

is valid.

This is forbidden:

```text
Retrieve Unauthorized Data
      ↓
LLM
      ↓
Filter Answer
```

The model may only receive information authorized for the requested operation.

---

# 23. Access Tokens Are Short-Lived

The platform uses:

- short-lived Access Tokens;
- longer-lived Refresh Tokens.

Token lifetimes are configurable within deployment-defined security bounds.

Access Tokens are:

- tenant-bound;
- session-bound;
- short-lived;
- suitable for in-memory client storage.

Refresh Tokens are:

- managed as session credentials;
- securely stored;
- represented server-side by cryptographic hashes;
- rotated;
- replay-aware.

---

# 24. Sessions Are First-Class Entities

Sessions must be independently identifiable and revocable.

Session information may include:

- user;
- tenant;
- creation;
- expiry;
- last activity;
- revocation;
- client information;
- IP information where appropriate;
- refresh-token family;
- authorization version.

---

# 25. AAA+A Is the Accountability Baseline

The platform uses:

```text
Authentication
Authorization
Usage Accounting
+
Audit
```

Usage Accounting records service and infrastructure consumption.

Commercial Accounting records financial truth.

These are separate systems.

---

## 25.1 Usage Accounting and Admission Control Are Different

Usage Accounting answers:

> What was consumed?

Quota and Admission Control answer:

> May this new operation begin or consume more resources?

The platform must support policy-driven limits and backpressure for resources such as:

- request rate;
- concurrent operations;
- AI requests and tokens;
- storage;
- uploads;
- API usage;
- module-specific capacity.

Admission policy may be scoped by deployment, tenant, user, service account, module, instance, or commercial entitlement.

Limits must be enforceable consistently in horizontally scaled deployments and must not depend solely on process-local counters.

---

# 26. Audit, Business History, and Operational Logs Are Different

The architecture separates:

## Security / Authority Audit

Examples:

- login;
- role changes;
- privilege changes;
- access attempts;
- denied access;
- ACL changes.

## Business History

Examples:

- letter transitions;
- task transitions;
- draft revisions;
- ticket transitions;
- fulfillment state.

## Operational Observability

Examples:

- errors;
- latency;
- worker failures;
- vLLM metrics;
- database metrics.

These must not collapse into one generic logging mechanism.

## SOC / SIEM Integration

Security Telemetry Export is a shared optional Platform Capability for integrating the platform with customer SOC / SIEM systems.

It supports two controlled delivery models:

- read-only pull APIs with filtering, cursor/checkpoint-based consumption, and Authority-enforced access;
- outbound push adapters with filtering, redaction, transformation, durable delivery state, retry, and checkpointing.

Security telemetry export must preserve the distinction between:

- security/audit events;
- operational telemetry;
- business history.

Customer-specific formats and transport protocols belong behind export adapters.

External SOC / SIEM systems never receive direct database access and never receive write access to platform state.

Loss or unavailability of an external SOC / SIEM destination must not erase canonical platform evidence.

---

# 27. OWASP ASVS Is the Security Baseline

The platform targets:

> **OWASP ASVS Level 2 as the mandatory baseline.**

Applicable Level 3 controls are required for high-assurance areas and deployments, including where appropriate:

- authentication;
- authorization;
- privileged administration;
- highly confidential information;
- commercial and payment capabilities;
- secret management.

Security requirements apply throughout:

```text
Architecture
Development
Code Review
Testing
CI/CD
Deployment
Operations
```

Security is not a final-stage penetration-testing concern.

---

# 28. All External Input Is Untrusted

Untrusted input includes more than browser input.

The following must be validated before becoming trusted state:

- HTTP input;
- webhook input;
- provider callbacks;
- connector data;
- files;
- environment configuration;
- deployment configuration;
- external API responses;
- payment responses;
- LLM output.

Client-side validation is usability support, not authoritative validation.

---

# 29. PostgreSQL Is the Primary Relational Database

PostgreSQL is the canonical relational database.

Relevant platform capabilities include:

- transactional consistency;
- Row-Level Security;
- recursive queries;
- JSONB;
- advanced indexes;
- functions;
- stored procedures;
- triggers;
- views;
- materialized views;
- row locking;
- advisory locking;
- extensibility.

Application authorization remains authoritative.

Database controls provide defense in depth.

---

# 30. The Platform Uses an Approved PostgreSQL Distribution

The platform may use a Targoman-maintained PostgreSQL container image containing approved extensions.

This includes the scheduling extension required to provide database-level scheduled events.

The exact PostgreSQL and extension versions are deployment-controlled and tested as a supported platform combination.

---

# 31. No ORM Is Allowed for Authoritative Persistence

ORM-managed persistence is prohibited.

Approved mechanisms include:

- explicit SQL;
- Kysely or another approved typed query builder;
- PostgreSQL Views;
- Materialized Views;
- PostgreSQL Functions;
- PostgreSQL Stored Procedures;
- migrations.

The application must retain explicit control over:

- queries;
- transactions;
- indexes;
- constraints;
- locking;
- procedures;
- database behavior.

---

# 32. Database-Centric Logic Should Stay in the Database

If an operation:

- is fundamentally data-centric;
- can be completed entirely inside PostgreSQL;
- does not require interaction with external systems;
- does not require application-level orchestration;

it should preferably execute inside PostgreSQL rather than transferring intermediate data into the application.

Appropriate mechanisms include:

```text
SQL
View
Materialized View
Function
Stored Procedure
```

This principle applies to complex reads as well as writes.

---

# 33. Complex Reads May Be Implemented as Database Functions or Views

The platform should avoid:

```text
SELECT large intermediate data
        ↓
Application
        ↓
filter
        ↓
transform
        ↓
aggregate
```

when PostgreSQL can perform the complete operation more efficiently.

Complex relational queries, recursive queries, reporting projections, aggregation, and data-local transformations may be implemented in:

- SQL Functions;
- Views;
- Materialized Views.

---

# 34. Complex Atomic Writes May Be Implemented as Stored Procedures

Stored Procedures or Functions are preferred where a write:

- spans several tables;
- requires ordered locking;
- must remain atomic;
- involves database-local consistency;
- requires concurrency-safe mutation;
- performs data-intensive calculations;
- requires coordinated database audit evidence.

Application services must not duplicate the same mutation logic.

---

# 35. Database Logic Must Not Become External Workflow Logic

Database procedures, functions, events, and triggers must not orchestrate:

- LLM inference;
- SMS providers;
- email providers;
- webhooks;
- external APIs;
- Qdrant;
- object storage;
- payment-provider interaction.

External workflow belongs to application services and workers.

The database may atomically produce durable state or an outbox event for later processing.

---

# 36. SQL Exists Only Inside the Owning Persistence Layer

SQL, Kysely expressions, calls to Views, Functions, Procedures, and database-specific operations are prohibited outside the persistence boundary owned by the relevant module or platform capability.

Forbidden locations include:

- controllers;
- route handlers;
- UI;
- domain kernels;
- generic application services;
- AI tasks;
- unrelated modules.

The required flow is:

```text
Application Service
      ↓
Repository Contract
      ↓
Persistence Implementation
      ↓
SQL / Kysely / View / Function / Procedure
      ↓
PostgreSQL
```

---

# 37. External Requests Never Access Persistence Directly

No UI, external API consumer, webhook caller, or other external actor may directly access persistence.

The normal HTTP flow is:

```text
External Request
      ↓
Controller / Route Boundary
      ↓
Schema Validation
      ↓
Authentication
      ↓
Authorization
      ↓
Application Service
      ↓
Persistence Layer
      ↓
Database
```

Controllers must remain thin.

They must not:

- contain SQL;
- directly mutate tables;
- implement business transitions;
- implement financial rules;
- call database procedures directly.

Workers do not require HTTP controllers, but must still use:

```text
Worker
  ↓
Application Service
  ↓
Persistence Layer
```

---

# 38. SQL Injection Protection Is Mandatory at Every Persistence Boundary

Security must not rely merely on the existence of a controller.

Persistence mechanisms must use:

- parameterized queries;
- parameterized procedure/function calls;
- strict identifier allow-lists;
- typed inputs;
- input validation;
- least-privilege DB roles;
- safe dynamic SQL practices.

String concatenation using untrusted data to construct SQL is prohibited.

This rule applies equally inside PostgreSQL procedures and functions.

---

# 39. Database Mutations Are Automatically Audited

Auditable database mutations must automatically generate change evidence at the database level.

Audit generation must not depend exclusively on application code.

The preferred mechanism is database triggers writing to an append-oriented change-audit structure.

Audit context should include where applicable:

- tenant;
- actor;
- session;
- request;
- module;
- table;
- record identity;
- operation;
- timestamp;
- before state;
- after state.

Application and worker transactions must provide execution context to PostgreSQL using transaction-local context.

---

# 40. Database Audit and Semantic Audit Are Complementary

Database mutation audit answers:

> What row changed?

Application or domain audit may answer:

> Why did the business action occur?

Both may exist for the same operation.

Database-level evidence does not replace higher-level domain audit.

---

# 41. Business Deletes Are Soft Deletes

Normal deletion of business data is logical.

Mutable deletable entities contain a prefixed deletion timestamp.

Physical deletion is reserved for explicit:

- retention;
- purge;
- garbage collection;
- legal deletion;
- maintenance

processes.

Creating a new logically equivalent active entity must not require destruction of historical soft-deleted data.

Active-record uniqueness should use appropriate partial uniqueness constraints.

---

# 42. Table Lifecycle Columns Follow Stable Conventions

A normal mutable business entity contains prefixed lifecycle columns such as:

```text
usr_created_at
usr_updated_at
usr_deleted_at
```

A lifecycle-driven entity may additionally contain:

```text
usr_status
```

A mutable concurrency-sensitive entity should contain a version field such as:

```text
usr_row_version
```

Append-only entities normally contain only the lifecycle fields relevant to append-only semantics.

Immutable deployment-defined lookup structures may omit lifecycle columns where justified.

---

# 43. Database Object Naming Is Deterministic

Table names follow the convention:

```text
tbl_<module>_<entity>
```

Examples:

```text
tbl_aaa_user
tbl_aaa_group
tbl_ltr_voucher
```

Table entity names are normally singular.

Cardinality is expressed by schema constraints, not by pluralization of table names.

---

# 44. Every Column Carries Its Owning Table Prefix

Columns are prefixed using a stable three-to-five-letter lowercase table abbreviation.

Examples:

```text
usr_id
usr_name
usr_status
usr_created_at

grp_id
grp_name

vch_id
vch_amount
vch_created_at
```

Generic ambiguous column names such as:

```text
id
name
status
created_at
updated_at
```

are prohibited in normal domain tables.

---

# 45. Foreign-Key Column Names Explicitly Show Both Sides

Foreign-key fields use a double underscore to separate:

```text
local semantic role
__
referenced identity
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
vch_group__grp_id
```

The `__` separator is reserved for relational-reference boundaries.

Foreign keys should normally reference immutable identifiers rather than mutable human-readable names.

---

# 46. Query Style Exploits Column Prefix Uniqueness

Because column names include their owning-table prefixes, ordinary multi-table queries should not repeat table names for every selected or joined column.

Preferred:

```sql
SELECT
    usr_name,
    grp_name
FROM tbl_aaa_user
JOIN tbl_aaa_group
    ON usr_group__grp_id = grp_id;
```

Avoid unnecessary qualification such as:

```sql
SELECT
    tbl_aaa_user.usr_name,
    tbl_aaa_group.grp_name
...
```

Table aliases are not introduced merely for shortening names.

Column aliases are normally reserved for:

- computed values;
- virtual/projection fields;
- intentionally transformed output contracts.

Table qualification or table aliases are permitted only when structurally required, such as a self-join or multiple occurrences of the same table where ambiguity cannot otherwise be avoided.

---

# 47. Database Object Prefixes Are Standardized

Database objects use stable prefixes.

```text
fn_     Function
sp_     Stored Procedure
trg_    Trigger
ev_     Scheduled Database Event
vw_     View
mvw_    Materialized View
idx_    Index
seq_    Sequence
pk_     Primary Key Constraint
fk_     Foreign Key Constraint
uq_     Unique Constraint
ck_     Check Constraint
```

Additional object classes may be added only through engineering conventions.

---

# 48. Function and Procedure Parameters Are Directional

Function and procedure parameters use explicit directional prefixes.

```text
i_     Input
o_     Output
io_    Input / Output
```

Local procedural variables follow separate documented conventions.

---

# 49. Database Events Are an Approved Persistence Capability

The platform's approved PostgreSQL distribution supports scheduled database events.

Database events are preferred for periodic work that:

- remains entirely inside PostgreSQL;
- does not require application logic;
- does not require external services.

Examples include:

- operational-log cleanup;
- garbage collection;
- retention;
- expired-row cleanup;
- partition maintenance;
- materialized-view refresh;
- database-local aggregation.

---

# 50. Database Events Must Respect Retention Policy

Not all data may be automatically purged.

Operational logs may have ordinary retention.

Sensitive structures such as:

- security audit;
- database change audit;
- financial ledger;
- legally relevant records

require explicit retention or archival policies.

A generic cleanup event must never silently remove protected records.

---

# 51. Runtime and Migration Database Roles Are Separate

At minimum the platform distinguishes:

```text
Migration Role
Runtime Role
```

The migration role may receive schema-changing privileges.

Runtime roles must not normally be able to:

- ALTER schemas;
- DROP tables;
- disable audit triggers;
- replace protected procedures;
- modify migration history.

More sensitive deployments may further separate:

```text
API Runtime Role
Worker Runtime Role
Migration Role
Maintenance Role
```

---

# 52. Database Migrations Are Mandatory

Every persistent platform capability and module must provide deterministic versioned migrations.

Migrations must support:

- installation from empty state;
- ordered upgrades;
- repeatable testing;
- module-aware installation;
- representative prior-state testing.

Manual undocumented production schema changes are prohibited.

---

# 53. One Canonical Owner

Every significant fact or rule must have exactly one canonical owner.

Examples include:

- privilege digestion;
- ticket state;
- financial ledger;
- entitlement;
- document classification;
- letter state;
- follow-up state.

Other components may maintain:

- projections;
- caches;
- indexes;
- derived views;
- snapshots;
- signed evidence.

They must not redefine the authoritative fact.

---

# 54. One Canonical Implementation

Important rules should have one authoritative implementation path whenever practical.

Avoid duplicated:

- validation;
- authorization decisions;
- financial calculations;
- lifecycle transitions;
- serialization rules;
- normalization;
- error mapping.

A rule may have multiple enforcement layers without multiple sources of semantic truth.

---

# 55. Contracts Come Before Implementations

Cross-module and platform contracts should define first:

- types;
- enums;
- commands;
- results;
- errors;
- ports;
- invariants;
- schemas;
- test fixtures.

Implementation follows the contract.

---

# 56. Strict Types Are Preferred Over Runtime Guessing

The platform favors compile-time detection.

Target TypeScript code runs in strict mode.

Rules include:

- `any` prohibited except explicitly isolated compatibility boundaries;
- `unknown` used for untrusted values;
- public domain shapes use named types;
- stable decisions use enums or discriminated unions;
- switches over stable enums are exhaustive;
- important IDs may use branded types.

---

# 57. Magic Decision Values Are Prohibited

Business decisions must not depend on undocumented:

- strings;
- numeric codes;
- Boolean conventions.

Forbidden examples:

```text
status === "A"
type === 3
mode === "normal"
```

Use canonical enums, types, reference entities, or named constants.

Serialized values may be strings or numbers.

Application decisions must use their canonical typed representation.

---

# 58. Naming Conventions Apply Across the Codebase

Engineering naming is deterministic and automated where practical.

TypeScript conventions include standard prefixes for architectural types, for example:

```text
cls     class
intf    interface
enu     enum
typ     type alias
ex      exception
```

Exact casing and language-specific conventions are defined in the Engineering Conventions document and enforced automatically where practical.

---

# 59. Validation Has One Canonical Definition Where Practical

Validation should not independently drift between:

```text
Frontend
Backend
Database
```

The preferred model is:

```text
Canonical Contract / Schema
        ↓
Generated or Shared Validator
        ↓
Backend Enforcement
        ↓
Frontend Usability Validation
        ↓
Database Integrity Constraint
```

Database constraints remain authoritative for relational integrity.

---

# 60. Commands and Events Are Different Concepts

A command asks for an action.

An event describes a completed fact.

Example:

```text
Command:
ApproveLetter

Event:
LetterApproved
```

The two must not be used interchangeably.

---

# 61. Durable Asynchronous Work Must Be Recorded Before It Is Considered Scheduled

Important asynchronous activity must have durable state.

The preferred initial pattern is:

```text
Business Transaction
       ↓
Persistent Job / Transactional Outbox
       ↓
Commit
       ↓
Worker
```

A request must not report successful scheduling if the required background action exists only in process memory.

---

# 62. Workers Handle Application and External Work

Workers execute operations involving:

- LLM inference;
- embeddings;
- Qdrant indexing;
- notifications;
- SMS;
- email;
- webhooks;
- external APIs;
- file processing;
- commercial fulfillment;
- external calendar integrations.

Database-local scheduled work remains eligible for database events.

---

# 63. Idempotency Is Required for Retryable Mutations

Any mutation that may be retried must define stable idempotency semantics.

Relevant areas include:

- payment callbacks;
- notification delivery;
- external task creation;
- document indexing;
- Secretariat import;
- commercial fulfillment;
- webhook processing.

Retries must not silently duplicate authoritative effects.

---

# 64. Fail Closed Is the Security Default

Ambiguity in:

- authorization;
- tenant context;
- ownership;
- signature validation;
- classification;
- provider finality;
- migration provenance

must produce denial, error, or explicit unresolved state.

The system must not guess its way through security-critical ambiguity.

---

## 64.1 Unknown External Outcomes Require Reconciliation

External operations may end in an indeterminate state because of timeout, network interruption, provider failure, or process crash.

The platform must distinguish:

```text
SUCCESS
FAILED
UNKNOWN / UNRESOLVED
```

An unknown external outcome must not be converted into success or failure by assumption and must not trigger blind retry when duplicate side effects are possible.

Capabilities interacting with external systems must support explicit reconciliation when required to determine final state.

Reconciliation process state is durable and auditable. Canonical business truth remains owned by the originating capability, while the shared Reconciliation capability may own unresolved-operation and resolution-process state.

---

# 65. Notifications Are a Shared Optional Capability

Notifications are not owned by Follow-up, Ticketing, CRM, or another module.

Modules emit semantic notification requests or events.

Possible channels include:

- in-app;
- email;
- SMS;
- webhook;
- future messaging adapters.

Provider details remain behind adapters.

---

# 66. Ticketing Is a Shared Optional Capability

Ticketing provides generic support/request primitives reusable by multiple modules.

Possible producers include:

- Widget escalation;
- CRM support;
- user support;
- Secretariat processing issues;
- commercial issues.

Ticketing must remain domain-neutral and must not become a second CRM.

Ticket attachments use Document Core.

Ticket notifications use Notification Core.

---

# 67. Commercial Capability Is Optional

Targoman or a customer may sell services or products to end users.

Commercial functionality may include:

- packages;
- subscriptions;
- credits;
- AI token credits;
- quotas;
- seats;
- API access;
- digital products;
- other module-defined offerings.

Internal enterprise deployments must not be forced to enable commerce.

---

# 68. Commercial Accounting and Usage Accounting Are Separate

Usage Accounting records consumption.

Commercial Accounting records financial state.

For example:

```text
Usage:
50,000 output tokens consumed
```

and:

```text
Commercial:
120,000 IRR charged
```

are different facts.

One may derive from the other, but they must remain independently auditable.

---

# 69. Financial Balances Are Ledger-Based

Wallet or credit balances must derive from immutable financial entries.

Preferred:

```text
Ledger Entries
     ↓
Derived Balance
```

Not:

```text
Direct Balance Mutation
```

Authoritative money values must use integer atomic units plus explicit currency.

Floating-point Money is prohibited.

---

# 70. Commercial Core Owns Transactions, Not Service Meaning

Commercial Core may own:

- basket;
- checkout;
- order;
- payment;
- wallet;
- ledger;
- invoice;
- refund;
- settlement.

Business modules own:

- Product;
- Offering;
- Entitlement;
- Inventory;
- Fulfillment;
- Activation.

Purchasing an offering and fulfilling the purchased service are distinct states.

---

# 71. Document Is a Shared Platform Concept

A business entity, Document, and file asset are different concepts.

Example:

```text
Letter
├── Body Document
├── Attachment Document
└── Attachment Document
```

Document Core owns:

- version;
- asset;
- metadata;
- relation;
- ACL;
- processing state;
- provenance.

Modules own business semantics.

---

# 72. File Processing Is Shared

Supported initial content extraction includes:

- plain text;
- DOCX;
- ODT
- Markdown
- text-based PDF.

Modules must not duplicate file readers.

OCR is a future extension to the common pipeline and is not part of the initial implementation scope.

---

# 73. Knowledge Space Is the Primary Knowledge Boundary

RAG is organized around Knowledge Spaces rather than user-owned collections.

Knowledge Spaces may represent:

- a tenant;
- organization unit;
- user;
- session;
- widget;
- project;
- secretariat;
- other module context.

Knowledge Space controls:

- organization;
- indexing;
- retrieval policy;
- lifecycle;
- access.

---

# 74. PostgreSQL Is Source of Truth; Qdrant Is Derived

PostgreSQL owns canonical:

- Document identity;
- ACL;
- classification;
- Knowledge Space;
- business metadata.

Qdrant is a rebuildable semantic-search index.

Loss of Qdrant must not mean loss of authoritative business data.

---

## 74.1 Data Governance and Egress Are Explicit

The platform must support policy-driven governance for data lifecycle and external data movement.

Governance policy may define:

- retention;
- archive;
- purge;
- legal hold;
- backup treatment;
- exportability;
- external-provider eligibility;
- data residency;
- data minimization requirements.

A resource being authorized for local use does not automatically mean it may be sent to an external provider.

AI routing, integrations, exports, and connectors must respect applicable data-egress policy before transmitting protected data outside the approved trust boundary.

---

# 75. AI Is a Shared Platform Capability

Business modules request semantic tasks.

For example:

```text
rag.answer
secretariat.metadata.extract
letter.draft
followup.actions.extract
ticket.summarize
```

Modules must not directly select model endpoints.

---

# 76. AI Routing Is Task-Based

The AI Router determines execution based on task policy.

Policy may consider:

- primary model;
- fallback models;
- context capacity;
- structured output;
- privacy;
- timeout;
- latency;
- hardware;
- reasoning level;
- capability requirements.

---

## 76.1 AI Execution Is Operationally Accountable

AI execution must produce structured operational evidence sufficient for diagnostics, accounting, capacity planning, routing evaluation, and incident investigation.

An AI execution record may include:

- task;
- selected model and endpoint;
- prompt / policy version;
- timing and latency;
- input and output token counts;
- retry and fallback lineage;
- status;
- error class;
- request / correlation identity;
- estimated resource or commercial cost where applicable.

Operational AI evidence must not indiscriminately persist raw confidential prompts, responses, secrets, chain-of-thought, or hidden reasoning traces.

---

# 77. Aya-Expanse-8B Is the Initial Baseline

The initial default model stack is:

```text
Aya-Expanse-8B
vLLM
RTX 4090
```

Most normal workloads should be designed and evaluated against this baseline.

Larger models should be used only when evaluation demonstrates a meaningful need.

H200 NVL is available as a higher compute tier.

---

# 78. Model Choice Is an Implementation Detail

Changing:

```text
Aya / RTX4090
```

to:

```text
larger model / H200 NVL
```

for an AI task must not require changing business-module logic.

---

# 79. Structured AI Output Must Be Validated

Machine-actionable AI tasks require explicit structured contracts.

Examples:

- metadata extraction;
- classification;
- deadline extraction;
- action extraction.

LLM output is untrusted input.

It must be validated before changing authoritative state.

---

# 80. Calendar Is a Shared Platform Capability

The platform provides common Jalali-aware calendar capabilities.

Possible features include:

- date;
- date-time;
- range;
- day;
- week;
- month;
- agenda;
- meetings;
- tasks.

Persistent time uses standard timezone-aware timestamps.

Jalali representation belongs primarily to presentation and interaction.

---

# 81. External Systems Are Accessed Through Adapters

Business modules must not directly hard-code providers.

External integrations may include:

- SMS;
- email;
- payment;
- Taskulu;
- Mizito;
- external calendars;
- Secretariat systems;
- storage;
- identity providers;
- SOC / SIEM platforms.

The module depends on a contract.

The adapter depends on the provider.

---

# 82. Smart Secretariat Ingestion Is Read-Only

Secretariat ingestion may use:

- REST;
- PostgreSQL;
- MySQL;
- SQL Server;
- bulk tables;
- files;
- manual entry.

Inbound Secretariat connectors are read-only.

Outbound registration or dispatch requires a separate outbound contract.

---

# 83. Frontend and Backend Are Separate

Frontend:

```text
SvelteKit
TypeScript
```

Backend:

```text
Express
TypeScript
```

Frontend is a client of backend APIs.

Business truth, security decisions, persistence, and financial authority remain server-side.

---

# 84. OCI Containers Are the Standard Delivery Artifact

The product is normally delivered as OCI-compatible container images.

Supported operational environments include:

```text
Docker
Podman
Kubernetes
```

The application must not depend on one specific container runtime.

---

## 84.1 Software Supply-Chain Security Is Required

Build and delivery artifacts must be traceable and verifiable.

The platform delivery process must support, where applicable:

- pinned and reviewed dependencies;
- versioned base images;
- reproducible or traceable builds;
- image digests;
- Software Bills of Materials (SBOM);
- vulnerability scanning;
- artifact provenance;
- image or artifact signing;
- approved dependency and base-image policies.

A customer must be able to identify which platform version and artifact set is installed.

---

# Scalability, Availability, and Reliability Are Architectural Requirements

The platform must be designed for horizontal scalability, high availability, fault isolation, and reliable recovery.

These properties are architectural requirements rather than deployment-specific enhancements.

The architecture must allow critical runtime components to scale independently where required, including:

- Web;
- API;
- Workers;
- AI endpoints;
- vector-search infrastructure;
- persistent data infrastructure.

A single-process or single-node deployment may be valid for small installations, but application design must not introduce assumptions that prevent later horizontal scaling or redundant deployment.

High availability must be supported through appropriate deployment topologies, health and readiness signaling, stateless application processes where practical, redundant runtime instances, controlled failover, and durable persistent state.

Reliability requires predictable behavior under:

- retries;
- duplicate requests;
- partial failures;
- dependency outages;
- process crashes;
- network interruption;
- rolling upgrades;
- concurrent execution.

Critical operations must be recoverable and, where retry is possible, idempotent.

Subsystem failure should be isolated wherever practical so that failure of one optional or external capability does not unnecessarily make unrelated platform functionality unavailable.

Scalability, availability, and reliability requirements must be verified through testing rather than assumed from architecture alone.

---

## Backup, Restore, and Disaster Recovery Are Reliability Requirements

Authoritative persistent state must have explicit backup and recovery architecture.

Deployment profiles may define:

- backup scope and frequency;
- retention;
- off-site or independent backup requirements;
- point-in-time recovery where applicable;
- Recovery Point Objective (RPO);
- Recovery Time Objective (RTO);
- disaster-recovery topology.

A backup is not considered operationally reliable merely because it was created.

Restore and recovery procedures must be tested periodically against representative data and deployment conditions.

---

# 85. Runtime Responsibilities Are Logically Separated

Typical runtime responsibilities include:

```text
Web
API
Worker
PostgreSQL
Qdrant
Model Serving
Ingress / Reverse Proxy
```

Physical consolidation is acceptable for small installations.

Logical ownership must remain separate.

---

# 86. Deployment Complexity Scales With Customer Needs

A small deployment may use:

```text
Docker Compose
+
PostgreSQL
+
Qdrant
+
API
+
Web
+
Worker
+
RTX 4090 / vLLM
```

A large deployment may use:

```text
Kubernetes
+
Replicated APIs
+
Multiple Workers
+
Dedicated PostgreSQL
+
Dedicated Qdrant
+
Multiple Model Endpoints
+
H200-class Compute
```

Both use the same product architecture.

---

# 87. Configuration Is Externalized

Customer-specific operational configuration must not be embedded in application images.

Configuration includes:

- modules;
- branding;
- routing;
- databases;
- AI endpoints;
- integrations;
- commercial identity;
- security bounds;
- secrets.

Secrets must never be embedded in frontend builds.

---

## 87.1 Configuration Drift Must Be Detectable

Deployment configuration represents desired state.

The platform and deployment tooling should be able to detect meaningful divergence between approved desired configuration and effective runtime configuration.

Manual production changes that create untracked configuration drift are prohibited except through documented emergency procedures.

Detected drift must be observable and, where security-relevant, auditable.

---

# 88. Persistent State Is External to Ephemeral Application Containers

Container replacement must not destroy:

- PostgreSQL data;
- Qdrant data;
- document originals;
- uploaded assets;
- audit;
- commercial ledger;
- persistent configuration.

---

# 89. Upgradeability Is a Product Requirement

Customer deployments must remain upgradeable without private long-lived product forks.

Upgrade mechanisms must account for:

- database migrations;
- module migrations;
- configuration versions;
- container versions;
- branding;
- integrations;
- commercial state.

---

# 90. Existing Proven Components Should Be Reused

Existing code is an asset, not an obligation.

Proven components and patterns may be adapted from existing Targoman systems, including:

- file processing;
- PDF handling;
- RAG;
- Jalali calendars;
- AI routing;
- vLLM integration;
- security;
- audit;
- accounting;
- scheduling.

Code should not be rewritten merely for architectural purity.

---

# 91. Legacy Removal Is Incremental

Existing code should not be deleted wholesale.

A legacy component may be removed when:

1. its replacement exists;
2. required behavior has been verified;
3. active consumers have migrated;
4. reusable functionality has been extracted.

---

# 92. Engineering Rules Are Machine-Enforced Where Practical

Rules that can be verified automatically should not rely solely on human code review.

Automated checks should detect violations such as:

- SQL outside persistence;
- ORM introduction;
- forbidden cross-module imports;
- platform-to-business dependency inversion;
- magic state strings;
- missing database audit triggers;
- invalid migrations;
- missing tenant isolation;
- unauthorized runtime DB privileges;
- missing authorization;
- naming violations.

---

# 93. Testing Begins Before Implementation

The preferred implementation sequence is:

```text
Contract
    ↓
Acceptance / Architecture Test
    ↓
Unit / Repository Test
    ↓
Implementation
    ↓
Refactor
    ↓
Acceptance Gate
```

Critical operations require testing for applicable cases including:

- valid operation;
- invalid operation;
- authorization;
- concurrency;
- duplicate;
- retry;
- crash boundary;
- audit;
- migration;
- recovery.

Flaky tests are defects.

---

# 94. AGENTS.md Files Execute the Standards; They Do Not Define Them

Canonical architectural and engineering rules belong in governing documentation.

Repository and directory-level `AGENTS.md` files translate those rules into immediate implementation instructions.

An `AGENTS.md` file may be stricter within its scope.

It must not silently weaken or redefine governing standards.

---

# 95. Exceptions Are Explicit

An exception to a mandatory engineering rule requires:

- the rule being violated;
- reason;
- scope;
- owner;
- risk;
- tests;
- expiry or removal condition;
- approval.

An undocumented exception is a defect.

---

# 96. Architecture Must Follow the Manifest

This Manifest defines architectural invariants.

It intentionally does not define all details of:

- table schemas;
- API payloads;
- exact module manifests;
- exact workflow states;
- detailed ticket state machines;
- exact commercial flows;
- all permission names;
- specific high-tier models;
- provider implementations;
- Kubernetes manifests.

Those belong in lower-level architecture and engineering documents.

If a legitimate requirement conflicts with this Manifest, the Manifest must be explicitly amended.

It must not be silently bypassed.

---

# 97. Governing Documentation

The expected core documentation set is:

```text
docs/architecture/
├── 00-manifest.md
├── 01-system-architecture.md
├── 02-engineering-conventions.md
├── 03-persistence-and-database.md
├── 04-authorization-model.md
├── 05-module-architecture.md
├── 06-document-and-rag.md
├── 07-ai-router.md
├── 08-deployment-architecture.md
├── 09-notification-and-ticketing.md
└── 10-commercial-architecture.md
```

Additional module-specific architecture documents may follow.

---

# Final Principle

The Targoman AI Platform must support a continuum from:

```text
one private internal module
running primarily on one RTX 4090
with no commerce,
no public platform dashboard,
and a simple Docker/Podman deployment
```

to:

```text
a customer-branded or Targoman-hosted,
multi-tenant,
multi-module,
commercial enterprise AI platform
with confidential data,
complex authorization,
shared notification and ticketing,
auditable database behavior,
multiple AI models,
multiple compute tiers,
and Kubernetes-scale deployment
```

without fundamental rewrites of existing business modules.

The platform therefore prioritizes:

- one maintainable product;
- modularity;
- independent module delivery;
- explicit ownership;
- canonical contracts;
- strict typing;
- controlled persistence;
- database-enforced integrity;
- auditable mutations;
- least privilege;
- tenant isolation;
- confidentiality;
- security telemetry interoperability;
- human and machine identity;
- quota and admission control;
- reconciliation;
- data governance and controlled egress;
- backup and disaster recovery;
- software supply-chain integrity;
- configuration-drift detection;
- optional commerce;
- white-label delivery;
- operational simplicity;
- data locality;
- model replaceability;
- infrastructure replaceability;
- container portability;
- upgradeability;
- automated architectural enforcement.

The default engineering question is:

> **Who owns this rule, where is its canonical implementation, where is its authoritative data, and which test proves that the rule is enforced?**
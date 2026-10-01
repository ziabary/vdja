# Targoman AI Platform — Engineering Conventions

**Document:** `docs/architecture/02-engineering-conventions.md`  
**Version:** 0.1  
**Status:** Proposed Engineering Standard  
**Depends on:**

- `00-manifest.md`
- `01-system-architecture.md`

---

# 1. Purpose

This document defines workspace-wide engineering conventions for the **Targoman AI Platform**.

Its purpose is to preserve:

- architectural consistency;
- compile-time safety;
- explicit ownership;
- security;
- testability;
- auditability;
- deterministic behavior;
- modularity;
- maintainability;
- upgradeability.

This document is normative.

Existing code does not override this standard merely because it already exists.

Legacy code may temporarily violate target conventions only while explicitly classified as legacy and covered by an approved migration plan.

---

# 2. Authority and Precedence

When engineering instructions conflict, use the following precedence:

```text
00-manifest.md
    ↓
Approved Architecture / ADR
    ↓
02-engineering-conventions.md
    ↓
Subsystem Architecture
    ↓
Phase / Migration Plan
    ↓
Repository AGENTS.md
    ↓
Directory AGENTS.md
    ↓
Existing Code
```

A lower-level document may impose stricter rules within its scope.

It must not silently weaken a higher-level rule.

Exceptions require explicit documentation.

---

# 3. Default Engineering Question

For every significant implementation decision, the default questions are:

> **Who owns this rule?**

> **Where is its canonical implementation?**

> **Where is its authoritative data?**

> **Which contract exposes it?**

> **Which test proves it?**

If these questions do not have clear answers, the design is incomplete.

---

# 4. One Canonical Owner

Every significant fact, rule, lifecycle, or authority decision must have one canonical owner.

Examples include:

- privilege digestion;
- tenant membership;
- Document classification;
- Ticket lifecycle;
- Letter lifecycle;
- Follow-up lifecycle;
- financial ledger state;
- entitlement;
- offering semantics;
- notification-delivery state.

Other packages may maintain:

- projections;
- caches;
- search indexes;
- reports;
- snapshots;
- signed evidence;
- compatibility views.

They must not redefine authoritative truth.

---

# 5. One Canonical Implementation

A significant rule should have one canonical implementation whenever practical.

Avoid independently implementing the same rule in:

```text
Frontend
API
Worker
Database Procedure
Trigger
Integration Adapter
```

Multiple enforcement layers are allowed.

Multiple semantic authorities are not.

For example:

- an application service may decide a transition is permitted;
- PostgreSQL may enforce the resulting invariant;
- an audit trigger may record the change.

The trigger must not independently invent a different transition policy.

> Authorization evaluation is a canonical Authority implementation and must never be reimplemented locally by a business module.

---

# 6. Contracts Before Implementation

Cross-package, cross-module, and externally consumed behavior must start from a contract.

Define first, as applicable:

- commands;
- results;
- enums;
- value types;
- schemas;
- stable errors;
- ports/interfaces;
- events;
- invariants;
- version information;
- test fixtures.

Then implement:

- application services;
- persistence;
- provider adapters;
- frontend clients.

Implementation must not become the de facto contract merely because documentation was omitted.

---

# 7. Explicit Over Implicit

Important behavior must be visible in:

- types;
- contracts;
- application services;
- transaction boundaries;
- authorization calls;
- database constraints;
- events;
- reason codes;
- audit records.

Avoid:

- framework magic;
- ambient mutable state;
- implicit tenant context;
- implicit transactions;
- implicit authorization;
- implicit string conventions;
- hidden provider fallback.

---

# 8. Compile-Time Safety Before Runtime Discovery

Prefer defects to be discovered by:

- TypeScript compilation;
- schema validation;
- exhaustive enums;
- architecture tests;
- generated-client compilation;
- migration tests;
- contract tests;
- static dependency checks;

rather than through production runtime behavior.

Runtime validation remains mandatory for untrusted data.

Compile-time safety and runtime validation solve different problems.

---

# 9. Pure Rules, Controlled Effects

Deterministic rules should be implemented as pure logic whenever practical.

Effects belong behind explicit boundaries.

Examples of effects include:

- PostgreSQL;
- Qdrant;
- filesystem;
- object storage;
- HTTP;
- email;
- SMS;
- payment providers;
- LLM inference;
- clocks;
- random IDs;
- external calendars.

A pure rule must not secretly obtain those dependencies.

Time, randomness, IDs, policies, and environment-dependent values should be passed explicitly where deterministic behavior matters.

---

# 10. No Hidden Authority

The following must not silently acquire domain authority:

- UI components;
- provider responses;
- repositories;
- triggers;
- migrations;
- adapters;
- generated code;
- caches;
- search indexes;
- LLM output.

A component may enforce, transport, persist, or project a rule.

That does not make it the owner of the rule.

---

# 11. TypeScript Is Strict by Default

All target TypeScript code must use strict compiler behavior.

Enable where technically compatible:

```text
strict
noImplicitOverride
noFallthroughCasesInSwitch
noUncheckedIndexedAccess
exactOptionalPropertyTypes
useUnknownInCatchVariables
```

Temporary exceptions require:

- reason;
- scope;
- owner;
- removal condition.

---

# 12. `any` Is Prohibited

`any` is prohibited in target application and domain code.

Use:

```ts
unknown
```

at untrusted or dynamically typed boundaries and narrow explicitly.

An `any` compatibility boundary is acceptable only when:

- required by an external library;
- locally isolated;
- immediately validated or converted;
- documented;
- covered by tests.

---

# 13. Public Types Must Be Named

Public functions, commands, results, events, repositories, and interfaces must use named types where the structure has domain meaning.

Avoid:

```ts
function execute(input: {
  id: string;
  status: string;
}): {
  ok: boolean;
};
```

Prefer:

```ts
function execute(
  input: typExecuteTicketCommand
): typExecuteTicketResult;
```

Anonymous internal structures are acceptable when they carry no reusable semantic meaning.

---

# 14. TypeScript Naming Conventions

The following prefixes are standard:

| Concept | Prefix | Example |
|---|---|---|
| Class | `cls` | `clsAuthorizationService` |
| Interface | `intf` | `intfTicketRepository` |
| Enum | `enu` | `enuTicketStatus` |
| Type alias | `typ` | `typUserId` |
| Exception class | `ex` | `exPermissionDenied` |

Functions and variables use:

```text
camelCase
```

Examples:

```ts
resolveTenant()
buildPrivilegeDigest()
ticketStatus
activeSession
```

Constants use:

```text
UPPER_SNAKE_CASE
```

Example:

```ts
MAX_UPLOAD_SIZE
DEFAULT_ACCESS_TOKEN_TTL
```

---

# 15. Class Naming

Classes always begin with `cls`.

Examples:

```ts
clsAiRouter
clsAuthorizationService
clsSecretariatApplication
clsPostgresTicketRepository
```

Avoid suffix-only ambiguity such as:

```text
Manager
Handler
Processor
Helper
Utils
```

unless the complete name precisely describes responsibility.

Bad:

```ts
clsUserManager
```

Better:

```ts
clsUserSessionService
clsUserProvisioningService
```

---

# 16. Interface Naming

Interfaces begin with:

```text
intf
```

Examples:

```ts
intfDocumentRepository
intfNotificationProvider
intfAiEndpoint
intfStorageAdapter
```

Interfaces should describe contracts, not implementation classes.

Bad:

```ts
intfPostgresRepository
```

unless the interface genuinely describes PostgreSQL-specific behavior.

Prefer:

```ts
intfTicketRepository
```

with an implementation such as:

```ts
clsPostgresTicketRepository
```

---

# 17. Enum First for Stable Decision Domains

Stable decision domains should normally use enums.

Examples:

- status;
- type;
- classification category;
- operation;
- channel;
- provider state;
- module state;
- event type;
- ticket priority.

Example:

```ts
enum enuTicketStatus {
  OPEN = 'open',
  PENDING = 'pending',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}
```

Forbidden:

```ts
if (ticket.status === 'open') {
}
```

Required:

```ts
if (ticket.status === enuTicketStatus.OPEN) {
}
```

Serialized enum values may be strings.

Application decisions must use the typed enum.

---

# 18. Not Everything Is a Database ENUM

The preference for enums in code does not imply that every controlled concept becomes a PostgreSQL ENUM.

Use PostgreSQL ENUM only for stable platform-level values that are not expected to be tenant-configurable.

Configurable concepts should normally be represented through authoritative tables or other controlled reference structures.

For example:

```text
Ticket internal execution state
→ possible enum

Tenant-defined security classification
→ reference/configuration entity
```

---

# 19. Magic Decision Values Are Prohibited

Decision logic must not depend on raw undocumented values.

Forbidden:

```ts
if (status === 'A')
if (type === 3)
if (mode === 'normal')
```

Use:

- enums;
- named constants;
- branded types;
- canonical configuration entities.

The same rule applies to SQL and stored procedures.

---

# 20. Boolean Semantics Must Be Truly Binary

Do not compress multi-state concepts into Boolean columns or variables.

Bad:

```text
isActive
```

if false may mean:

- disabled;
- suspended;
- deleted;
- pending;
- expired.

Use an explicit state enum or reference type when more than two semantic states exist.

---

# 21. Exhaustive Decisions Are Mandatory

Switches over stable enums or discriminated unions must be exhaustive.

Example:

```ts
switch (status) {
  case enuTicketStatus.OPEN:
    break;

  case enuTicketStatus.PENDING:
    break;

  case enuTicketStatus.RESOLVED:
    break;

  case enuTicketStatus.CLOSED:
    break;

  default:
    assertNever(status);
}
```

Adding a new state should cause compilation or tests to identify incomplete consumers.

---

# 22. Branded IDs Are Preferred Where Confusion Is Possible

Different IDs that share the same primitive representation should use branded types when accidental interchange is plausible.

Example:

```ts
type typUserId =
  string & { readonly __brand: 'UserId' };

type typTenantId =
  string & { readonly __brand: 'TenantId' };

type typDocumentId =
  string & { readonly __brand: 'DocumentId' };
```

A `typTenantId` must not be accepted where `typUserId` is expected merely because both are strings.

---

# 23. `null` and `undefined`

Use:

```text
undefined
```

for omitted optional application values.

Use:

```text
null
```

only where absence is an explicit persisted or external contract value.

Do not use them interchangeably.

Public contracts must document nullable fields explicitly.

---

# 24. Immutability Is Preferred

Inputs to pure kernels, domain rules, and public contracts should preferably be readonly.

Functions should not mutate caller-owned structures unexpectedly.

State changes should be explicit.

---

# 25. Time Rules

Persist absolute timestamps using standard timezone-aware database types.

Business presentation may use Jalali representation.

Absolute timestamps must not be stored as formatted Jalali strings.

Code handling expiry or deadlines must define boundary semantics explicitly.

Example:

```text
expires_at <= now
```

must have a documented interpretation.

Elapsed-time measurement should use monotonic clocks where applicable.

---

# 26. Money Rules

Authoritative money must never use floating-point arithmetic.

Money consists of:

```text
integer atomic amount
+
explicit currency
```

This applies to:

- price;
- tax;
- discount;
- payment;
- refund;
- wallet;
- ledger;
- settlement.

Frontend formatting is not authoritative financial arithmetic.

---

# 27. Required Dependency Direction

The preferred dependency direction is:

```text
Contracts
    ↓
Pure Rules / Domain
    ↓
Application Services
    ↓
Ports / Interfaces
    ↓
Adapters / Persistence
    ↓
Composition Root
```

Higher-level business meaning must not depend on low-level infrastructure implementations.

---

# 28. Contracts Layer

Contracts may contain:

- enums;
- types;
- commands;
- results;
- schemas;
- events;
- stable errors;
- version information.

Contracts must not contain:

- database access;
- Express routes;
- provider SDK calls;
- Svelte components;
- runtime secrets;
- application orchestration.

---

# 29. Domain and Pure Rules

Domain or pure-rule code may contain:

- validation rules;
- canonicalization;
- calculations;
- state decisions;
- Authority-internal privilege and authorization evaluation kernels; 
- financial calculations;
- posting plans.

Privilege and authorization evaluation kernels may exist only inside the Authority capability.

Pure domain code must not import:

- PostgreSQL drivers;
- Kysely;
- Express;
- SvelteKit;
- Qdrant SDK;
- HTTP clients;
- filesystem;
- provider SDKs;
- runtime secrets.

---

# 30. Application Services

Application services own use-case orchestration.

They may:

- enforce operation ordering;
- call authorization;
- call domain rules;
- call repositories;
- call platform services;
- establish transaction boundaries;
- create events;
- coordinate idempotency;
- coordinate recovery.

They must not:

- contain SQL;
- expose raw database rows;
- call provider-specific SDKs directly;
- implement UI behavior.

---

# 31. Ports and Adapters

A port is defined by the component that requires the capability.

Adapters implement that port.

Example:

```text
Follow-up Application
      ↓
intfCalendarAdapter
      ↓
clsMizitoCalendarAdapter
```

Do not design a port as a thin copy of a provider SDK.

---

# 32. Composition Roots

Composition roots wire:

- application services;
- repositories;
- adapters;
- providers;
- clocks;
- ID generators;
- configuration;
- workers.

Composition roots contain no business rules.

---

# 33. Explicit Public Exports

Packages and modules must expose explicit public APIs.

Wildcard exports are prohibited by default.

Avoid:

```ts
export * from './internal';
```

Consumers must not import arbitrary internal paths of another package.

---

# 34. No Cross-Module Internal Imports

A business module may use:

- Platform contracts;
- Platform public APIs;
- another module's explicitly published optional integration contract.

It must not import:

```text
modules/other-module/internal/*
modules/other-module/persistence/*
modules/other-module/domain/private/*
```

Architecture tests must enforce this rule.

---

# 35. Controllers Are Thin Transport Boundaries

Controllers and route handlers may:

- parse transport input;
- validate request schema;
- establish execution context;
- invoke authentication;
- invoke authorization;
- call one application use case;
- map stable errors to HTTP responses.

Controllers must not:

- contain SQL;
- invoke stored procedures directly;
- query repositories directly for orchestration;
- implement business transitions;
- calculate financial values;
- select providers;
- call LLM endpoints directly.

Controllers may invoke the Authority capability or pass authorization requirements to the application service.

Controllers must not interpret roles, privileges, ACLs, ownership, or classifications themselves.

---

# 36. No Direct Persistence Access From External Requests

The normal flow is:

```text
Client
  ↓
Controller
  ↓
Validation
  ↓
AuthN / AuthZ
  ↓
Application Service
  ↓
Persistence Contract
  ↓
Persistence Implementation
```

No UI or external caller may bypass the application boundary and access persistence directly.

Workers may start at the application-service boundary rather than HTTP, but still obey persistence boundaries.

---
# 37. Protocols Follow the Boundary

The platform does not mandate one communication protocol for every boundary.

Protocol selection must follow the semantics, runtime boundary, performance requirements, and operational characteristics of the interaction.

The default choices are:

```text
Browser / Public API
    → REST

Server-to-client response streaming
    → SSE by default

Long-lived bidirectional realtime communication
    → WebSocket when justified

In-process module-to-module communication
    → Typed application contracts

Durable asynchronous communication
    → Jobs / Transactional Outbox / Events

Independent synchronous service-to-service communication
    → REST or gRPC according to demonstrated requirements
```

### REST

REST is the default protocol for:

- browser-facing APIs;
- public APIs;
- customer integrations;
- conventional request/response application APIs;
- administration APIs.

REST contracts should remain strongly typed and schema-driven.

The use of REST must not imply loosely defined JSON contracts.

---

### SSE

Server-Sent Events are preferred for unidirectional server-to-client streaming where the client initiates a request and receives an incremental response.

Typical examples include:

- streamed LLM responses;
- long-running AI generation progress;
- server-side execution progress.

SSE should be preferred over WebSocket where bidirectional realtime communication is not required.

---

### WebSocket

WebSocket may be used when the interaction genuinely requires long-lived bidirectional communication.

Examples may include:

- realtime operator communication;
- live collaborative workflows;
- interactive bidirectional sessions.

WebSocket must not be introduced merely because data is streamed.

---

### In-Process Communication

Logical module separation does not imply a network boundary.

Modules running inside the same application process communicate through typed application contracts and interfaces.

They must not communicate through REST or gRPC merely to simulate service separation.

```text
Contract boundary is mandatory.
Network boundary is optional.
```

---

### Asynchronous Communication

Commands or facts that do not require an immediate synchronous result should use durable asynchronous mechanisms such as:

- PostgreSQL-backed jobs;
- transactional outbox;
- internal events;
- workers.

gRPC or REST must not replace durable event or job semantics.

For example:

```text
document.indexed
ticket.created
payment.confirmed
notification.requested
```

are normally asynchronous facts or work triggers, not synchronous RPC calls.

---

### gRPC

gRPC is an approved protocol for independent internal services when its characteristics provide a material advantage.

gRPC should be considered when one or more of the following apply:

- high-frequency internal service calls;
- latency-sensitive synchronous communication;
- efficient binary transport is materially valuable;
- strongly generated cross-language contracts are required;
- client or server streaming is required;
- bidirectional streaming is required;
- a capability has become an independently scaled runtime service.

The introduction of gRPC requires a real service boundary.

It must not be introduced simply because two logical modules are architecturally separate.

Business modules inside the same runtime should continue to use direct typed contracts.

---

### External Provider Protocols

External adapters may use the protocol required by the provider, including:

- REST;
- SOAP;
- gRPC;
- WebSocket;
- webhook;
- database connectivity;
- file exchange.

Provider protocol details remain behind adapter boundaries.

Business modules must not depend directly on provider-specific protocols.

---

### Protocol Independence

Business and domain logic must remain independent from transport selection.

Changing a service boundary from:

```text
REST
```

to:

```text
gRPC
```

must not require rewriting the business domain.

Transport adapters translate between external protocol contracts and internal application contracts.

---

### New Protocols

Introducing a new general-purpose application protocol requires an explicit architectural justification.

Protocol introduction must identify:

- the boundary;
- the problem being solved;
- why existing approved protocols are insufficient;
- operational impact;
- security implications;
- observability requirements;
- compatibility and migration strategy.

GraphQL, for example, is not currently a default platform protocol and requires an approved architectural decision before adoption.

---

# 38. API Contracts Are Versioned

Externally consumed contracts require explicit compatibility rules.

Breaking changes require:

- version transition;
- migration strategy;
- deprecation period where applicable.

Do not silently change the meaning of a previously published field.

---

# 39. Schemas Are Canonical Where Practical

A contract schema should preferably be defined once and used to derive or generate:

- TypeScript types;
- validators;
- OpenAPI;
- clients;
- fixtures;
- documentation.

Manual duplication of the same contract across several layers is discouraged.

A canonical contract may produce transport-specific artifacts such as OpenAPI schemas for REST, Protobuf definitions or generated stubs for gRPC, validators, TypeScript types, clients, fixtures, and documentation.

---

# 40. Transport Contracts Must Be Generated or Canonically Derived

OpenAPI should be generated from canonical API contracts where practical.

Manually maintained Swagger that can drift from implementation is prohibited for target code.

Generated files must identify their source and must not be manually edited.

REST/OpenAPI and gRPC/Protobuf artifacts must have an explicit canonical source. Generated artifacts must not be manually edited. Transport contracts must not independently drift from the internal application contract.

``` text
REST → OpenAPI
gRPC → Protobuf / generated stubs
```

---

# 41. Input Validation

All untrusted boundaries require validation.

Examples:

- HTTP requests;
- query parameters;
- headers;
- files;
- webhooks;
- payment callbacks;
- external API responses;
- connector data;
- configuration;
- environment variables;
- signed documents;
- LLM output.

Validation must happen before untrusted data becomes authoritative state.

---

# 42. Client Validation Is Not Authoritative

Frontend validation exists for:

- usability;
- immediate feedback;
- input guidance.

It does not replace server validation.

A malicious or outdated client must not be able to bypass business or security invariants.

---

# 43. Normalization Must Be Explicit

Normalization may change meaning.

Therefore normalization must be:

- deliberate;
- documented;
- deterministic;
- tested.

Do not silently normalize identifiers, security-sensitive values, or document content when the change could alter semantic meaning.

---

# 44. Stable Error Codes

Machine behavior must depend on stable error codes, not human-readable text.

Examples:

```text
VALIDATION_ERROR
AUTHENTICATION_REQUIRED
PERMISSION_DENIED
RESOURCE_NOT_FOUND
CONFLICT
IDEMPOTENCY_CONFLICT
INVALID_STATE_TRANSITION
RATE_LIMITED
QUOTA_EXCEEDED
CAPACITY_EXHAUSTED
CONCURRENCY_LIMIT
PROVIDER_RESULT_UNKNOWN
RECONCILIATION_REQUIRED
```

Human-readable messages may change or be localized.

Stable codes must retain defined meaning.

---

# 45. Do Not Leak Internal Errors

External responses must not expose:

- stack traces;
- SQL;
- database names;
- provider credentials;
- secrets;
- filesystem paths;
- internal infrastructure details.

Operational logs may contain safe internal diagnostics subject to logging rules.

---

# 46. Idempotency for Retryable Mutations

A retryable mutation must define stable idempotency behavior.

Where applicable:

```text
same idempotency key
+
same request fingerprint
→ same logical result
```

but:

```text
same idempotency key
+
different request
→ explicit conflict
```

Critical areas include:

- payments;
- webhooks;
- external provisioning;
- notifications;
- imports;
- indexing;
- fulfillment.

---

## 46.1 Unknown Outcomes Require Reconciliation

A timeout or transport failure does not prove that an external side effect failed.

External operations must explicitly distinguish:

```text
SUCCESS
FAILED
UNKNOWN / UNRESOLVED
```

When duplicate side effects are possible, an unknown result must not be blindly retried.

The owning application capability must use the shared Reconciliation contract to:

- query provider state where possible;
- correlate the external operation to the original request;
- preserve unresolved state durably;
- support bounded automated retry only when safe;
- support operator review where automation cannot establish finality;
- record final resolution and audit evidence.

---

# 47. Commands and Events Are Distinct

Commands request an action.

Events report a completed fact.

Good:

```text
ApproveLetter
→ LetterApproved
```

Bad:

```text
LetterApproved
```

used as both request and result.

Events must use past-tense semantics where practical.

---

# 48. Events Are Facts

An event must describe something that has already happened.

Do not emit:

```text
PaymentSucceeded
```

before financial state has durably reached the successful state.

Critical events should be committed durably with the originating transaction when appropriate.

---

# 49. Durable Background Work

Important background work must have durable state before the originating operation is considered successfully scheduled.

Preferred model:

```text
Business Transaction
      ↓
Persistent Job / Outbox
      ↓
Commit
      ↓
Worker
```

In-memory asynchronous callbacks are not adequate for critical business work.

---

# 50. Worker Rules

Workers require:

- stable job identity;
- tenant context;
- bounded retries;
- backoff;
- idempotent execution;
- terminal states;
- recoverable failure;
- observability.

Workers must not retry indefinitely.

Unknown outcomes must not be silently converted into failures or successes.

---

## 50.1 Admission Control Precedes Expensive Work

Rate, quota, concurrency, and capacity limits must be evaluated before starting expensive or externally visible work where applicable.

Typical controlled work includes:

- AI inference;
- large uploads;
- document processing;
- bulk imports;
- external API calls;
- high-cost searches;
- commercial consumption.

Admission decisions must use the shared Admission Control capability.

Business modules must not implement independent quota semantics.

Authoritative distributed limits must not rely solely on process-local counters.

Overload protection should fail predictably using stable errors such as rate-limited, quota-exceeded, capacity-exhausted, or concurrency-conflict outcomes.

---

# 51. Provider Calls Are Not Repository Work

Repositories own persistence.

Provider adapters own external-provider interaction.

A repository must not send:

- SMS;
- email;
- payment requests;
- LLM requests;
- HTTP webhooks.

Similarly, a provider adapter must not directly mutate unrelated domain tables.

Provider adapters must define, where applicable:

- timeout;
- retry classification;
- bounded retry;
- backoff;
- circuit-breaker behavior;
- idempotency support;
- unknown-outcome semantics;
- observability.

Fallback to another provider is allowed only when the owning policy explicitly permits it and when the fallback does not violate security, privacy, residency, or data-egress constraints.

---

# 51.1 SOC / SIEM Integration Uses the Shared Security Telemetry Capability

Business modules, controllers, repositories, and ordinary application services must not send telemetry directly to a customer SOC / SIEM.

They emit or persist canonical platform evidence through the owning Audit, Observability, or business-history capability.

Security Telemetry Export is responsible for:

- export filtering;
- field redaction;
- customer-specific transformation;
- pull exposure;
- push delivery;
- checkpointing;
- retry and delivery state.

Pull integrations are read-only and must pass through the normal API, validation, authentication, and Authority boundaries.

Push integrations must use durable delivery state before the export is considered scheduled.

Customer-specific SOC / SIEM formats and protocols exist only in export adapters.

Security telemetry must not contain secrets, access tokens, refresh tokens, OTPs, private keys, provider credentials, or unnecessary sensitive payloads.

Exporter failure must not erase canonical evidence.

---

# 52. Database Access Exists Only in Persistence Implementations

All SQL, Kysely expressions, Views, Functions, Stored Procedures, and database-specific calls belong in the owning persistence implementation.

Forbidden outside persistence:

```text
SQL
db.raw()
Kysely query expressions
CALL sp_...
SELECT fn_...
```

This includes controllers and ordinary application services.

Detailed database conventions are defined in:

```text
03-persistence-and-database.md
```

## 52.1 List and Single-Resource Queries Are Distinct

Single-resource operations and list operations must use distinct application and API contracts.

A single-resource query returns one identified resource and must not inherit pagination or list semantics.

List operations must not calculate a total record count unless the caller explicitly requests it.

The default list response should return the requested page or cursor window only.

Where total count is requested, the contract must make the additional cost explicit.

Preferred list semantics are:

```text
items
nextCursor / hasMore
optional total
```

A total count must never be computed merely because a list endpoint exists.

---

# 53. Transactions Are Explicit

Transaction ownership must be visible.

Repositories participating in the same business transaction receive the same explicit transaction context/handle.

A repository must not silently create an independent transaction inside an existing use case.

Hidden transactions are prohibited.

---

# 54. Database and Application Decisions Must Not Duplicate Each Other

The database may:

- enforce integrity;
- perform data-local atomic work;
- lock;
- validate constraints;
- write audit evidence.

The application may:

- authorize;
- orchestrate;
- choose external workflows;
- coordinate services.

The same semantic decision must not be independently reimplemented in both locations.

---

# 55. No ORM

ORM-based authoritative persistence is prohibited.

Approved patterns include:

- Kysely;
- explicit SQL;
- database Views;
- Functions;
- Stored Procedures;
- controlled repositories.

Detailed persistence rules are defined separately.

---

# 56. Database Naming Is Enforced

Database naming conventions defined in `03-persistence-and-database.md` are mandatory.

Examples include:

```text
tbl_<module>_<entity>

usr_name
usr_created_at

vch_owner__usr_id

fn_*
sp_*
trg_*
ev_*
vw_*
mvw_*
```

Architecture tests or schema tests must detect violations where practical.

---

# 57. Database Audit Is Mandatory for Auditable Mutations

Auditable database mutations must generate database-level change evidence automatically.

Application code must not be the only mechanism capable of producing mutation audit.

Audit generation itself is a persistence concern.

Semantic business audit may additionally be produced at application level.

---

# 58. Soft Delete Is the Default

Business entities use soft deletion by default.

Application code must not perform physical deletion of normal business records unless using an explicitly approved:

- purge;
- retention;
- legal deletion;
- garbage collection;
- maintenance

operation.

---

# 59. Database Procedures Are Valid Canonical Implementations

A complex data-local operation may have its canonical implementation in a database Function or Stored Procedure.

Application code must call it through the owning persistence contract.

The existence of a stored procedure does not permit business code to bypass application-service or authorization boundaries.

---

# 60. No Magic SQL States

SQL, Functions, and Stored Procedures follow the same typed-state philosophy as application code.

Avoid semantic logic such as:

```sql
IF i_status = 'A' THEN
```

where `'A'` is undocumented.

Use canonical controlled values and documented database types/reference entities.

---

# 61. Security Is a Development Requirement

OWASP ASVS Level 2 is the platform baseline.

Applicable Level 3 controls are required in high-assurance areas or deployments.

Security requirements apply to:

- architecture;
- coding;
- review;
- tests;
- CI;
- deployment;
- operations.

---

# 62. Fail Closed

Security-sensitive ambiguity must fail closed.

Examples:

- missing tenant;
- unknown privilege;
- missing ownership evidence;
- invalid token audience;
- unresolved classification;
- invalid signature;
- ambiguous provider result.

Do not infer permissive defaults.

---

# 63. Secret Handling

Never commit or log:

- passwords;
- production credentials;
- private keys;
- access tokens;
- refresh tokens;
- OTPs;
- payment secrets;
- provider secrets.

Configuration references a secret.

It does not embed the secret in source.

Secrets must have explicit lifecycle where applicable, including:

- creation;
- storage;
- distribution;
- rotation;
- revocation;
- expiration;
- incident replacement.

Long-lived shared credentials should be avoided when shorter-lived or workload-specific credentials are practical.

---

# 64. Cryptography

Use approved standard cryptographic libraries.

Custom cryptographic primitives are prohibited.

Security-sensitive signed structures must explicitly define:

- issuer;
- algorithm;
- key identifier;
- version;
- issued time;
- expiry where applicable.

---

## 64.1 Software Supply-Chain Controls

Production artifacts must be traceable to approved source and build inputs.

Engineering and CI/CD should enforce, where applicable:

- dependency lockfiles;
- pinned or explicitly versioned dependencies;
- approved base images;
- immutable image digests for production promotion;
- SBOM generation;
- vulnerability scanning;
- license / dependency policy checks;
- artifact signing and provenance;
- verification before deployment.

Unreviewed dependency additions and floating production image references are prohibited unless explicitly approved.

---

# 65. Authorization Is Centrally Evaluated

Authorization is backend-enforced and centrally evaluated by the Authority capability.

No other package or module may independently implement authorization logic.

Forbidden patterns include:

```typescript
if (userRole === enuRole.ADMIN)
if (privs.documentRead)
if (resource.ownerId === userId)
if (clearance >= classification)
```

outside the Authority implementation.

Business modules may:

- declare resources;
- declare operations;
- declare roles and permission mappings;
- provide resource attributes;
- provide ownership and organizational facts.

They must pass those facts to Authority and consume the resulting decision.

Frontend authorization checks exist only to improve user experience.

They never replace an Authority decision.

---

## 65.1 Human and Machine Identities Use Authority

Service accounts, API clients, platform services, and integration identities are first-class identities.

Do not create fake human users to represent machine callers.

Machine credentials must have explicit:

- owner;
- scope;
- tenant applicability;
- expiration where applicable;
- revocation;
- audit identity.

All authorization decisions for machine identities still use Authority.

---

## 65.2 Federation Does Not Own Authorization

OIDC, SAML, LDAP / Active Directory, SCIM, or another enterprise identity integration may authenticate or provision identity facts.

Provider claims or directory groups must not be interpreted directly by business modules as application authorization.

External attributes are normalized by the Authority / identity boundary before use.

---

## 65.3 Break-Glass Access Is a Dedicated Flow

Emergency access must not be implemented as:

```text
isSuperAdmin = true
```

or an undocumented bypass.

Break-glass access requires explicit request, reason, bounded scope, bounded lifetime, strong authentication, full audit, and any required approval.

Code paths must make emergency authorization distinguishable from ordinary authorization.

---

# 66. Tenant Context Is Explicit

Tenant context must not be guessed from ambient global state.

Requests, jobs, and background operations carry explicit tenant context.

Cross-tenant operations require explicit privileged contracts.

---

# 67. AI Output Is Untrusted

LLM output is never authoritative solely because it was produced by an approved model.

Machine-actionable AI output must be:

- structurally validated;
- semantically checked where required;
- authorization-safe;
- bounded by the requesting use case.

AI must not directly mutate authoritative state without an explicit validated application path.

---

# 68. Business Modules Never Call Models Directly

Business code calls semantic AI tasks through the AI Router.

Forbidden:

```ts
callModel('aya-expanse-8b');
```

Required style:

```ts
aiService.execute(
  enuAiTask.LETTER_DRAFT,
  input
);
```

Model and infrastructure selection remain outside business logic.

---

## 68.1 Data Egress Requires Governance Approval

Authorization to access data locally does not automatically authorize transmission to an external provider.

Before sending protected data to:

- external AI providers;
- webhooks;
- customer systems;
- external search providers;
- third-party integrations;

the application must obtain the applicable Data Governance / Egress decision.

Adapters must receive already-approved payloads and must not expand the data scope themselves.

Data minimization is required: send only fields necessary for the intended operation.

---

## 68.2 AI Runs Produce Safe Operational Evidence

Material AI execution must produce structured AI Run telemetry through the AI platform capability.

Operational records should capture identifiers and measurements such as:

- task;
- model / endpoint;
- policy / prompt version;
- latency;
- token usage;
- retry / fallback lineage;
- status;
- error class;
- request / correlation ID;
- estimated cost where applicable.

Do not persist raw confidential prompt/response content, credentials, chain-of-thought, or hidden reasoning traces as ordinary AI telemetry.

Any protected diagnostic capture requires explicit governance and retention policy.

---

# 69. Frontend Conventions

Frontend code uses:

```text
SvelteKit
TypeScript
```

Route components should primarily:

- obtain route data;
- invoke application clients;
- compose UI surfaces.

Large business decisions must not live inside Svelte components.

---

# 70. UI State Is Not Business Authority

Frontend stores may hold:

- presentation state;
- loaded data;
- UI preferences;
- transient form state.

They must not become authoritative sources for:

- privilege;
- classification;
- entitlement;
- wallet balance;
- commercial state;
- ticket state;
- document access.

---

# 71. Design Tokens Over Hard-Coded Theme Values

Brandable visual properties should be represented through shared design tokens or CSS variables.

Business modules must not hard-code customer branding.

Branding belongs to the platform branding system.

---

# 72. RTL and LTR Must Be Deliberately Supported

UI components that may render Persian or other RTL content must be tested in RTL.

Layout must not assume LTR.

Mixed-direction fields such as:

- email;
- URLs;
- technical identifiers;

must use explicit direction where appropriate.

---

# 73. Jalali Inputs Use Shared Calendar Components

Business modules must not implement independent Jalali conversion or date pickers.

Use the platform Calendar capability.

Persistent timestamps remain standard timezone-aware timestamps.

---

# 74. Accessibility Is Required

New interactive UI must consider:

- semantic HTML;
- keyboard navigation;
- focus management;
- labels;
- disabled states;
- error association;
- reduced motion where relevant.

Accessibility is part of component correctness.

---

# 75. File Naming

TypeScript source filenames should follow the primary exported responsibility.

Examples:

```text
clsAuthorizationService.ts
intfTicketRepository.ts
enuTicketStatus.ts
typTenantId.ts
```

Files containing application functions rather than a primary type use descriptive `camelCase` names.

Avoid generic names such as:

```text
utils.ts
helpers.ts
common.ts
misc.ts
manager.ts
service.ts
```

unless scope makes the meaning unambiguous.

---

# 76. One Significant Responsibility per File

Prefer one major public:

- class;
- interface;
- enum;
- type family;

per file.

Small private supporting types may remain colocated when they exist solely to support the main construct.

Avoid large files containing unrelated architectural responsibilities.

---

# 77. No Wildcard Utility Buckets

Do not create generic architectural dumping grounds such as:

```text
utils/
common/
misc/
sharedHelpers/
```

Shared code must have semantic ownership.

Prefer:

```text
date/
validation/
authorization/
serialization/
```

over generic helper collections.

---

# 78. Comments Explain Why

Comments should explain:

- invariant;
- security reason;
- unusual tradeoff;
- compatibility constraint;
- recovery requirement;
- non-obvious database behavior.

Do not comment obvious syntax.

Bad:

```ts
// increment count
count++;
```

Good:

```ts
// Increment only after durable outbox creation so retry
// cannot produce an observable count without an event.
```

---

# 79. TODO Rules

Critical TODOs require:

- scope;
- owner or tracking reference;
- reason;
- removal condition.

Do not leave indefinite TODOs in security-, financial-, migration-, or data-integrity-sensitive code.

---

# 80. Testing Begins Before Implementation

Preferred sequence:

```text
Contract
   ↓
Acceptance / Architecture Test
   ↓
Focused Unit / Repository Test
   ↓
Implementation
   ↓
Refactor
   ↓
Acceptance Gate
```

Tests are part of design.

---

# 81. Test Categories

Use applicable categories including:

- unit;
- property;
- contract;
- repository;
- database;
- migration;
- architecture;
- authorization;
- integration;
- end-to-end;
- characterization;
- differential;
- concurrency;
- retry;
- fault-injection;
- recovery.

Not every feature needs every category.

Critical features require the relevant failure-mode tests.

---

# 82. Critical Transition Testing

Important state transitions should test:

- valid transition;
- invalid transition;
- permission failure;
- duplicate request;
- retry;
- concurrent request;
- crash boundary;
- database rollback;
- audit generation;
- recovery.

Happy-path-only transition testing is insufficient.

---

# 83. Database Tests Are Required

Persistence tests must verify applicable rules such as:

- constraints;
- uniqueness;
- partial uniqueness;
- soft delete;
- RLS;
- Stored Procedures;
- Functions;
- audit triggers;
- events;
- migration behavior;
- transaction rollback.

Database behavior must not be assumed from application tests alone.

---

# 84. Migration Tests Are Required

Migrations must be tested:

1. from an empty database;
2. against representative previous-version state.

A migration that works only on a developer's current database is invalid.

Silent row loss is prohibited.

---

# 85. Architecture Tests Are Required

CI should automatically reject prohibited dependency patterns.

Examples:

```text
SQL outside persistence
ORM dependency added
Platform package imports business module
Module imports another module's private code
Controller imports database client
UI imports persistence code
Business module imports vLLM client
```

---

# 86. Naming Rules Should Be Machine-Enforced

Automate naming checks where practical.

Examples:

- class prefix;
- interface prefix;
- enum prefix;
- database object prefixes;
- migration naming;
- module identifiers;
- public export structure.

Naming consistency must not rely solely on code review.

---

# 87. Magic-String Tests

Static checks should detect raw decision strings where practical.

Examples to prevent:

```ts
status === 'open'
role === 'admin'
module === 'secretariat'
```

Prefer enums, canonical identifiers, or explicit typed constants.

Not every literal string is a magic decision value.

Human-readable content and external protocol values may legitimately be strings.

---

# 88. Audit Conformance Tests

Critical mutations must verify that expected audit evidence is generated.

A test should be able to prove that a mutation cannot bypass required database audit merely because application audit code is omitted.

---

# 89. Security Tests

Security tests should cover applicable risks including:

- broken authorization;
- tenant isolation;
- SQL injection;
- malformed input;
- unsafe uploads;
- session misuse;
- token replay;
- privilege escalation;
- unauthorized document retrieval;
- unsafe external callbacks;
- unauthorized SOC / SIEM pull access;
- security-telemetry redaction failures;
- duplicate or replayed SOC / SIEM push delivery;
- service-account privilege escalation;
- invalid federation claims;
- break-glass misuse;
- data-egress policy bypass;
- quota / concurrency bypass;
- supply-chain policy violations where testable.

Security requirements should map to relevant ASVS controls.

---

# 90. Deterministic Tests

Tests should control:

- clock;
- randomness;
- generated IDs;
- provider responses;
- network;
- database state.

Flaky tests are defects.

Retrying a flaky test until green is not remediation.

---

# 91. Coverage Is Supporting Evidence

Coverage percentage is useful but is not acceptance by itself.

A highly covered implementation may still lack:

- concurrency tests;
- authorization tests;
- transition tests;
- migration tests;
- audit tests.

Correct behavioral coverage matters more than a single numeric threshold.

---

# 92. AGENTS.md Is an Execution Layer

Canonical rules live in architecture and engineering documents.

`AGENTS.md` files provide immediate implementation instructions for AI agents and contributors.

Root example:

```text
/AGENTS.md
```

Scoped examples:

```text
/packages/authority/AGENTS.md
/modules/secretariat/AGENTS.md
/apps/web/AGENTS.md
```

A scoped AGENTS file may add stricter requirements.

It may not weaken governing standards.

---

# 93. Agent Rules Must Be Testable Where Practical

Do not rely only on instructions such as:

> Never place SQL outside persistence.

Also provide an architecture test that fails when SQL appears outside allowed locations.

Preferred pattern:

```text
Rule
+
Agent Instruction
+
Static / Architecture Test
```

This reduces dependence on human or agent memory.

---

## 93.1 Desired State and Configuration Drift

Production configuration should have a canonical desired-state source.

Manual changes that are not reflected back into that source create configuration drift.

Deployment tooling should detect meaningful drift where practical.

Security-relevant drift must be observable and should be auditable.

Emergency manual changes must be reconciled back into desired state after the incident.

---

# 94. Documentation Is Part of Completion

A change is incomplete when it alters:

- contract;
- ownership;
- lifecycle;
- deployment;
- database behavior;
- recovery;
- security;
- operator procedure

while leaving governing documentation stale.

Generated documentation should not be manually edited when a canonical source exists.

---

# 95. Prohibited Patterns

The following are prohibited unless an approved exception exists:

- `any` in target domain/public code;
- ORM-managed authoritative persistence;
- SQL outside persistence;
- hidden transactions;
- direct cross-module table access;
- module access to another module's private source;
- UI-only authorization;
- business orchestration in controllers;
- provider calls from repositories;
- direct model selection by business modules;
- magic decision strings;
- floating-point Money;
- arbitrary hard deletes;
- manual production schema changes;
- secrets in source;
- secrets in logs;
- secrets or unnecessary sensitive payloads in security-telemetry export;
- direct module-to-SOC / SIEM integration bypassing Security Telemetry Export;
- direct SOC / SIEM database access;
- non-durable push delivery for required security telemetry;
- unvalidated LLM output mutating state;
- semantic business workflows hidden in triggers;
- duplicated canonical decision logic;
- manually drifting OpenAPI;
- undocumented architectural exceptions;
- unbounded retries;
- silent migration data loss;
- customer-specific source forks as normal deployment strategy;
- fake human users representing machine identities;
- business-module interpretation of federation claims as authorization;
- undocumented superadmin / break-glass bypasses;
- process-local authoritative quota counters in replicated deployments;
- blind retry of externally unresolved side effects;
- external data egress without governance evaluation;
- ordinary AI telemetry containing chain-of-thought or secrets;
- floating or unverifiable production artifacts where immutable identity is required;
- untracked production configuration drift.

---

# 96. Explicit Exceptions

A mandatory-rule exception must document:

- violated rule;
- reason;
- exact scope;
- owner;
- risk;
- compensating controls;
- required tests;
- expiration or removal condition;
- approval.

An undocumented exception is a defect.

---

# 97. Acceptance Criteria for New Code

New target code is acceptable only when applicable conditions are satisfied:

- ownership is clear;
- dependency direction is correct;
- public contracts are explicit;
- types are strict;
- naming conforms;
- no forbidden raw decision values exist;
- authorization is backend enforced;
- persistence boundary is respected;
- transactions are explicit;
- audit requirements are satisfied;
- errors are stable;
- required tests exist;
- documentation remains consistent.

---

# 98. Legacy Code

Legacy code may temporarily violate these conventions during migration.

New code must not copy a legacy pattern solely because it already exists.

When touching legacy code:

- avoid increasing the violation;
- prefer bounded improvement;
- do not perform unrelated large refactors unless part of the active migration plan.

---

# 99. Enforcement Tooling

The platform should progressively implement automated enforcement using mechanisms such as:

```text
TypeScript compiler
ESLint
Custom ESLint rules
Dependency / architecture tests
AST-based checks
Database schema tests
Migration tests
Contract tests
CI gates
```

A convention that can be safely automated should eventually become automated.

---

# Scalability and Reliability Must Be Testable

Code intended to run in replicated environments must not depend on process-local state for authoritative behavior.

Critical components must be tested, where applicable, for:

- concurrent execution;
- duplicate delivery;
- retry;
- restart;
- worker replacement;
- dependency timeout;
- partial dependency failure;
- stale instance replacement;
- rolling deployment;
- failover and recovery.

Load testing, soak testing, concurrency testing, fault-injection testing, and recovery testing are required where the risk or expected deployment scale justifies them.

A component is not considered scalable or reliable merely because it can be deployed with multiple replicas.

Backup reliability must be verified through restore testing.

Deployment reliability should include configuration-drift detection where desired-state configuration exists.

Recovery-sensitive integrations must test unknown-outcome and reconciliation paths, not only retry behavior.

---

# 100. Final Engineering Principle

The platform prefers:

```text
explicit over implicit
typed over stringly-typed
contracts over conventions
canonical ownership over duplication
database integrity over optimistic assumptions
tests over memory
automation over review-only discipline
```

The standard engineering question remains:

> **Who owns this rule, where is its canonical implementation, where is its authoritative data, and which test proves it?**
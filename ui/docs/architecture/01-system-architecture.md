# Targoman AI Platform — System Architecture

**Document:** `docs/architecture/01-system-architecture.md`  
**Version:** 0.2  
**Status:** Proposed Architecture  
**Depends on:**

- `00-manifest.md`

---

# 1. Purpose

This document defines the system architecture of the **Targoman AI Platform**.

It translates the Platform Manifest into concrete architectural boundaries for:

- source-code organization;
- runtime processes;
- platform capabilities;
- business modules;
- frontend composition;
- backend composition;
- persistence ownership;
- multi-tenancy;
- module enablement;
- routing;
- branding;
- documents and RAG;
- AI routing;
- workers and database scheduling;
- notifications;
- ticketing;
- commercial capabilities;
- deployment;
- containerization;
- configuration;
- observability;
- upgradeability.

Detailed database rules, SQL naming, Stored Procedures, Functions, Triggers, Events, migrations, and persistence implementation are defined in:

```text
03-persistence-and-database.md
```

---

# 2. Architectural Style

The platform uses a:

> **Modular Platform Architecture with Modular-Monolith Applications and Explicit Runtime Boundaries**

Logical separation is mandatory.

Network separation is optional.

The default rule is:

```text
Contract boundary is mandatory.
Network boundary is introduced only when justified.
```

The architecture must therefore allow the same capability to run:

- in-process;
- as a separate worker;
- as an independently scaled service;

without changing its business semantics.

---

# 3. High-Level System Model

The logical system is composed of:

```text
                       ┌─────────────────────┐
                       │     User / Admin    │
                       │      Browser        │
                       └──────────┬──────────┘
                                  │
                             HTTPS / TLS
                                  │
                    ┌─────────────▼─────────────┐
                    │     Ingress / Gateway     │
                    │ Domain / Subdomain / Path │
                    └─────────────┬─────────────┘
                                  │
                ┌─────────────────┴─────────────────┐
                │                                   │
        ┌───────▼────────┐                  ┌───────▼────────┐
        │   Web Runtime  │                  │    API Runtime │
        │ SvelteKit / TS │                  │ Express / TS   │
        └────────────────┘                  └───────┬────────┘
                                                    │
                                      Application / Platform
                                                    │
        ┌──────────────────┬────────────────────────┼──────────────────┐
        │                  │                        │                  │
  PostgreSQL           Qdrant                 AI Router           Storage
        │                  │                        │                  │
        │                  │                        │                  │
        │                  │                   vLLM / Models           │
        │                  │                                           │
        └──────────────────┴──────────────┬────────────────────────────┘
                                          │
                                   ┌──────▼───────┐
                                   │    Worker    │
                                   │ TypeScript   │
                                   └──────────────┘
```

PostgreSQL is the primary source of authoritative relational state.

Qdrant is a derived semantic index.

Model servers are execution infrastructure.

---

# 4. Primary Architectural Layers

The platform is divided into five major layers:

```text
Presentation
    ↓
Transport
    ↓
Application
    ↓
Domain / Platform Contracts
    ↓
Infrastructure / Persistence / Providers
```

These are dependency boundaries, not necessarily separate processes.

---

# 5. Presentation Layer

Presentation includes:

- public landing surfaces;
- module landing pages;
- User Dashboard;
- Admin Backoffice;
- business-module UI;
- reusable UI components.

The standard implementation is:

```text
SvelteKit
TypeScript
```

Presentation is not authoritative for:

- authorization;
- business lifecycle;
- commercial state;
- persistence;
- document access;
- financial decisions.

---

# 6. Transport Layer

Transport accepts external communication and converts it into application requests.

Possible transport boundaries include:

- REST controllers;
- SSE endpoints;
- WebSocket handlers;
- future gRPC handlers;
- webhook handlers.

Transport handlers remain thin.

They perform:

```text
Parsing
Validation
Authentication Context
Authorization Context
Application Invocation
Response Mapping
```

They do not own business rules.

---

# 7. Application Layer

Application services represent platform and business use cases.

Examples:

```text
CreateTicket
RegisterDocument
SearchSecretariat
GenerateLetterDraft
CreateFollowup
AssignWidgetOperator
CompleteCommercialOrder
```

Application services:

- orchestrate operations;
- establish transaction boundaries;
- invoke authorization;
- invoke domain rules;
- invoke persistence contracts;
- invoke external ports;
- emit durable events or jobs.

---

# 8. Domain and Platform Contracts

Contracts define stable semantic boundaries.

They include:

- commands;
- results;
- enums;
- domain types;
- application ports;
- repository contracts;
- errors;
- events;
- validation schemas.

Contracts must remain independent of:

- PostgreSQL;
- Express;
- SvelteKit;
- Qdrant;
- vLLM;
- external provider SDKs.

---

# 9. Infrastructure Layer

Infrastructure implements contracts for:

- PostgreSQL;
- Qdrant;
- filesystem;
- S3-compatible storage;
- SMS;
- email;
- payment providers;
- external secretariats;
- calendars;
- Taskulu;
- Mizito;
- model servers.

Business modules depend on contracts.

They must not depend directly on infrastructure libraries.

---

# 10. Target Repository Structure

The target repository should converge toward:

```text
/
├── apps/
│   ├── web/
│   ├── api/
│   └── worker/
│
├── packages/
│   ├── contracts/
│   ├── platform/
│   ├── authority/
│   ├── audit/
│   ├── security-telemetry/
│   ├── usage/
│   ├── admission-control/
│   ├── reconciliation/
│   ├── data-governance/
│   ├── commercial/
│   ├── documents/
│   ├── file-processing/
│   ├── knowledge/
│   ├── ai-router/
│   ├── calendar-core/
│   ├── calendar-svelte/
│   ├── jobs/
│   ├── notifications/
│   ├── ticketing/
│   ├── storage/
│   ├── integrations/
│   ├── branding/
│   ├── ui-core/
│   └── observability/
│
├── modules/
│   ├── crm/
│   ├── widget/
│   ├── secretariat/
│   ├── letter-assistant/
│   └── followup/
│
├── deploy/
│   ├── compose/
│   ├── podman/
│   ├── kubernetes/
│   └── profiles/
│
├── docs/
│   ├── architecture/
│   ├── phases/
│   └── reports/
│
└── legacy/
```

The exact directory names may evolve.

The ownership boundaries must not.

---

# 11. Runtime Applications

The initial runtime applications are:

```text
apps/web
apps/api
apps/worker
```

They are composition roots.

They assemble installed platform packages and modules.

They contain minimal domain logic.

---

# 12. Web Runtime

The Web runtime is responsible for:

- serving the frontend application;
- module UI composition;
- User Dashboard;
- Admin Shell;
- public landing pages where enabled;
- loading runtime branding;
- loading public deployment configuration.

The Web runtime must not contain secrets or authoritative business state.

---

# 13. API Runtime

The API runtime is responsible for synchronous application access.

It provides:

- authentication APIs;
- user APIs;
- admin APIs;
- module APIs;
- upload APIs;
- AI request APIs;
- streaming endpoints;
- integration callbacks;
- webhook boundaries.

The API runtime must be horizontally replicable where practical.

---

# 14. Worker Runtime

The Worker runtime performs asynchronous application work.

Examples:

- file parsing;
- embeddings;
- Qdrant indexing;
- bulk AI tasks;
- notifications;
- email delivery;
- SMS delivery;
- external hooks;
- integrations;
- commercial fulfillment;
- Follow-up reminders;
- Secretariat synchronization;
- background cleanup requiring application logic.

Multiple workers may safely process the same durable queue.

---

# 15. Database-Scheduled Work

Not every scheduled operation belongs in Worker.

Data-local scheduled operations may run inside PostgreSQL using approved database Events.

Examples:

- log retention;
- database garbage collection;
- expired-row cleanup;
- partition maintenance;
- materialized-view refresh;
- database-local aggregation.

The decision boundary is:

```text
Entirely Database-Local
    → Database Event

Requires Application / External System
    → Job + Worker
```

---

# 16. Platform Capabilities

Initial shared capabilities are:

```text
Identity
Authentication
Authorization
Sessions
Tenant Management
Organization Management
Audit
Security Telemetry Export
Quota / Admission Control
Reconciliation
Data Governance
Usage Accounting
Commercial Accounting
Documents
File Processing
Knowledge / RAG
AI Router
Calendar
Jobs
Notifications
Ticketing
Storage
Integrations
Branding
Admin Shell
User Dashboard
Observability
```

Capabilities may be foundational or optional.

---

# 17. Business Modules

Initial business modules are:

```text
CRM
Widget / Chat Builder
Smart Secretariat
Letter Assistant
Follow-up
```

Each module has domain ownership.

Business modules must remain independently installable.

---

# 18. Standard Module Structure

A module should normally contain:

```text
modules/<module>/
├── contracts/
├── domain/
├── application/
├── persistence/
├── api/
├── web/
├── jobs/
├── integrations/
├── migrations/
├── tests/
└── manifest.ts
```

Not every module must require every directory.

The boundaries remain conceptually equivalent.

---

# 19. Module Manifest

Each module exposes a machine-readable manifest.

Conceptually:

```ts
interface intfModuleManifest {
  id: string;
  version: string;

  requires: readonly string[];
  optionalCapabilities?: readonly string[];

  permissions?: readonly unknown[];
  roles?: readonly unknown[];

  backend?: unknown;
  frontend?: unknown;
  admin?: unknown;
  userDashboard?: unknown;

  jobs?: readonly unknown[];
  aiTasks?: readonly unknown[];

  persistence?: unknown;
  integrations?: readonly unknown[];
  commercial?: unknown;
}
```

The final strongly typed definition is specified in the Module Architecture document.

---

# 20. Module Installation States

Three distinct states exist:

```text
Installed
Tenant Enabled
User Authorized
```

A module route or UI contribution is available only if all relevant conditions are satisfied.

---

# 21. Universal and Slim Product Builds

The build system supports at least two composition styles.

## Universal Build

Contains all official product modules.

Suitable for:

- hosted service;
- multi-tenant deployments;
- installations expected to enable modules later.

## Slim Build

Contains only selected modules and required capabilities.

Suitable for:

- dedicated customer installations;
- reduced attack surface;
- smaller images;
- narrowly scoped deployments.

Both use the same source code and module contracts.

---

# 22. Business-Module Dependencies

Hard dependency from one business module to another is discouraged.

Preferred:

```text
Follow-up
    ↓
Stable Resource Reference
    ↓
Secretariat Letter
```

Not:

```text
Follow-up persistence
    ↓
Direct secretariat table query
```

Optional integration may use a published public module contract.

---

# 23. Stable Cross-Module Resource References

Cross-module references use stable typed resource identity.

Conceptually:

```text
resource_type = "secretariat.letter"
resource_id   = "..."
```

Examples:

```text
ticket → secretariat.letter
followup → crm.customer
notification → ticket
```

The referencing module does not need access to the referenced module's tables.

---

# 24. Internal Events

Modules and platform capabilities may publish internal events.

Examples:

```text
document.created
document.indexed
ticket.created
ticket.assigned
letter.approved
followup.due
payment.confirmed
entitlement.changed
```

Events describe completed facts.

---

# 25. Transactional Outbox

Critical asynchronous events should use a transactional-outbox pattern.

```text
Business Transaction
       ↓
Authoritative Database Changes
       +
Outbox Record
       ↓
Commit
       ↓
Worker / Consumer
```

This prevents business success without durable async work.

---

# 26. Communication Protocol Selection

Protocols follow the runtime boundary.

Default rules are:

```text
Browser / Public API
    → REST

Server-to-client streaming
    → SSE

Bidirectional realtime
    → WebSocket when justified

In-process module communication
    → Typed application contracts

Durable asynchronous work
    → Jobs / Outbox / Events

Independent synchronous services
    → REST or gRPC according to need
```

A network boundary is never introduced merely because two logical modules are separate.

---

# 27. gRPC Service Boundaries

gRPC is approved for real independent internal service boundaries where it provides measurable benefit.

Typical reasons include:

- high call frequency;
- low-latency requirements;
- binary efficiency;
- generated cross-language clients;
- server/client streaming;
- independent horizontal scaling.

gRPC must not replace direct in-process contracts or durable events.

---

# 28. API Contract Generation

Transport contracts should derive from canonical contracts where practical.

Possible generated artifacts include:

```text
REST
  → OpenAPI

gRPC
  → Protobuf / generated stubs

Frontend
  → TypeScript client

Validation
  → generated/shared validators
```

Transport representations must not become independent sources of domain truth.

---

# 29. Frontend Shell Architecture

The frontend contains three major surface types:

```text
Public Shell
User Shell
Admin Shell
```

Each is module-aware and deployment-aware.

---

# 30. Public Shell

Optional public surfaces may contain:

- branded landing page;
- product introduction;
- module cards;
- module-specific landing pages;
- login entry.

A private enterprise deployment may omit all public surfaces.

---

# 31. User Shell

The authenticated User Shell may contain:

```text
Dashboard
My Services
Notifications
Tickets
Usage
Packages / Credits
Orders
Invoices
Sessions
Profile
```

Only enabled capabilities appear.

A single-module deployment may enter the module directly.

---

# 32. Admin Shell

The Admin Shell is dynamically composed from active capabilities and modules.

Contributions may include:

- menu entries;
- dashboard cards;
- settings;
- monitoring;
- operational pages;
- policy configuration;
- module administration.

There is no single universal Admin Boolean.

---

# 33. Instance-Level Administration

A user may administer a specific application instance without being platform administrator.

Example:

```text
Widget #27

IT Department:
    create/delete/assign owner

Business Unit Manager:
    manage this widget
    manage operators
    manage documents
    view usage
```

Instance administration uses scoped permissions.

---

# 34. Physical Routing Is Deployment Configuration

Modules have logical identities independent of URLs.

Example logical identity:

```text
secretariat
```

Possible physical routes:

```text
https://ai.customer.ir/secretariat
```

or:

```text
https://secretariat.customer.ir/
```

or:

```text
https://secretariat-product.ir/
```

Business code must not hard-code these locations.

---

# 35. Route Binding

Deployment routing maps:

```text
Host
+
Base Path
+
Module
+
Optional Tenant
+
Entry Mode
```

Conceptually:

```ts
interface intfRouteBinding {
  host: string;
  basePath: string;

  moduleId?: string;
  tenantId?: string;

  entryMode:
    | 'platform'
    | 'module'
    | 'login'
    | 'publicLanding';
}
```

Absolute URLs are produced by a routing service.

---

# 36. Deployment Profile

A Deployment Profile describes the installation.

It may define:

- installed modules;
- enabled platform capabilities;
- route bindings;
- branding;
- storage;
- PostgreSQL endpoint;
- Qdrant endpoint;
- AI endpoints;
- security bounds;
- commercial mode;
- integrations;
- SOC / SIEM export configuration.

Example:

```yaml
profile: customer-secretariat

modules:
  - secretariat
  - followup

capabilities:
  notifications: true
  ticketing: true
  commercial: false
  securityTelemetry: true
  admissionControl: true
  reconciliation: true
  dataGovernance: true

routes:
  - host: secretariat.customer.ir
    module: secretariat
    entry: module

brand: customer-a
```

Secrets must be referenced externally.

---

# 37. Configuration Hierarchy

Configuration follows:

```text
Platform Default
      ↓
Build Profile
      ↓
Deployment Profile
      ↓
Tenant Configuration
      ↓
Module / Instance Configuration
      ↓
User Preference
```

Not every configuration key is overridable at every level.

Security limits define hard upper or lower boundaries where applicable.

---

# 38. Branding Architecture

Branding is represented by a Brand Profile.

Internal first-party packages use `@targoman/*`; this code namespace does not select the UI brand. Customer/deployment names, including FAPA, are not package/module IDs or generic source-code identity. The active Brand Profile alone supplies display names, logos, favicon, support/legal identity and visual tokens at runtime. A FAPA profile may render FAPA assets; another deployment renders its own profile without a source fork.

Possible fields include:

```text
Product Identity
Organization Identity
Logo Assets
Favicon
Colors
Typography
Support Information
Email Identity
Notification Identity
Generated Document Identity
Legal Information
```

Visual configuration should use shared design tokens and CSS variables where possible.

---

# 39. Multi-Tenant Model

A deployment may contain one or several tenants.

Every tenant-owned record must have explicit tenant ownership.

Tenant boundaries are enforced by:

```text
Application Authorization
+
Persistence Rules
+
PostgreSQL RLS where appropriate
```

---

# 40. Global Identity

Platform identity is global within one deployment.

A human user may belong to:

```text
Tenant A
Tenant B
Tenant C
```

Membership and authority remain tenant-specific.

---

## 40.1 Human and Machine Identity Model

The Authority subsystem supports multiple identity classes:

```text
Identity
├── Human User
├── Service Account
├── API Client
├── Platform Service
└── Integration Identity
```

Machine identities are first-class identities and must not be represented as fake users.

Each identity has explicit:

- credential type;
- tenant / deployment scope;
- lifecycle;
- revocation state;
- audit identity;
- allowed authentication mechanism.

Service accounts and API clients use Authority for authorization exactly as human identities do.

---

## 40.2 Enterprise Identity Federation and Provisioning

Enterprise deployments may integrate with external identity systems through adapters such as:

```text
OIDC
SAML
LDAP / Active Directory
SCIM
```

Federation establishes authentication or identity facts.

Provisioning may create, update, suspend, or map platform identities and memberships.

Neither federation nor provisioning replaces Authority authorization.

External identity attributes are normalized into canonical platform identity facts before they participate in authorization.

---

# 41. Tenant-Bound Interactive Sessions

Each interactive human authorization session belongs to one active tenant.

Machine identities may authenticate without an interactive session.

Their resulting authorization context must nevertheless carry explicit tenant or deployment scope.

The standard flow is:

```text
Authentication
    ↓
Tenant Selection
    ↓
Tenant-Bound Session
    ↓
Tenant-Scoped Privilege Digest
    ↓
Access Token
```

Switching tenant creates a new authorization context.

---

# 42. Session Architecture

Sessions are persistent entities.

They support:

- session ID;
- user;
- tenant;
- token family;
- created time;
- expiry;
- last activity;
- revocation;
- client metadata;
- authorization version.

Refresh Tokens are session credentials, not user properties.

---

# 43. Access Token Architecture

Access Tokens are:

- short-lived;
- tenant-bound;
- session-bound;
- privilege-aware.

Token lifetime is configurable within deployment security bounds.

Privilege digestion is performed for the active tenant only.

---

# 44. Authority Is the Only Authorization Decision Engine

The Authority capability is the single platform component responsible for producing authorization decisions.

Business modules define the vocabulary required for authorization, including:

- resource types;
- available operations;
- permission definitions;
- role templates;
- resource attributes;
- ownership facts;
- organizational relationships relevant to the resource.

They do not evaluate those rules themselves.

The required flow is:

```text
Application / Module
        ↓
Authorization Request
        ↓
Authority
        ├── Tenant Context
        ├── Privilege Digest
        ├── Scoped RBAC
        ├── ABAC
        ├── Resource ACL
        ├── Classification / Clearance
        ├── Grants / Denials
        └── Resource Facts
        ↓
ALLOW / DENY + Reason
```

A module may provide factual resource information through an explicit resolver or contract:

```text
Resource Facts
    owner = usr_123
    orgUnit = org_legal
    classification = confidential
```

but the module must not convert those facts into an access decision.

Forbidden:

```typescript
if (user.role === 'manager') { ... }

if (ctx.privs.includes('document.read')) { ... }

if (document.ownerId === user.id) { allow(); }

if (user.clearance >= document.classification) { ... }
```

Required:

```typescript
const decision = await authorizationService.authorize({
    operation: enuDocumentOperation.READ,
    resource,
    context,
});
```

The resulting decision is authoritative for that operation.

---

## 44.1 Break-Glass Authorization

Emergency access is an explicit Authority use case.

A break-glass request must define:

- actor;
- reason;
- requested scope;
- target tenant / resource scope;
- start and expiry;
- required authentication strength;
- required approvals where policy demands dual control.

Authority issues a bounded emergency authorization decision.

Break-glass actions produce high-priority audit evidence and must remain distinguishable from ordinary authorization.

No module may implement an independent emergency-admin bypass.

---

# 45. PostgreSQL as Relational Source of Truth

PostgreSQL stores authoritative relational platform and module state.

Primary responsibilities include:

- identity state;
- tenant state;
- permissions;
- business state;
- documents metadata;
- ticket state;
- commercial state;
- jobs;
- audit;
- module state.

Detailed data design belongs in `03-persistence-and-database.md`.

---

# 46. Database Namespace Ownership

Logical schemas should reflect ownership.

Example:

```text
platform.*
authority.*
audit.*
security_telemetry.*
usage.*
admission.*
reconciliation.*
governance.*
ai.*
jobs.*

documents.*
knowledge.*
notifications.*
tickets.*
commercial.*

crm.*
widget.*
secretariat.*
letter.*
followup.*
```

One schema does not imply one runtime service.

It indicates ownership.

---

# 47. Persistence Boundary

Every platform capability and business module owns its persistence implementation.

No SQL exists outside persistence code.

Required application path:

```text
Application Service
      ↓
Repository Contract
      ↓
Persistence Implementation
      ↓
Kysely / SQL / View / Function / Procedure
      ↓
PostgreSQL
```

---

# 48. Data-Centric Logic

Data-local operations may execute inside PostgreSQL.

Approved mechanisms include:

- explicit SQL;
- Views;
- Materialized Views;
- Functions;
- Stored Procedures.

Application code should not retrieve large intermediate datasets only to perform transformations PostgreSQL can perform efficiently.

---

# 49. Business Workflow vs. Database Logic

The database may own:

- relational integrity;
- atomic multi-table operations;
- locking;
- data-local computation;
- aggregation;
- local lifecycle enforcement;
- automatic audit evidence.

Application services own:

- external orchestration;
- AI calls;
- provider interaction;
- notification workflows;
- user-interaction sequences.

---

# 50. Automatic Database Audit

Auditable database mutations generate automatic database-level change evidence.

This applies even if application-level semantic audit is absent.

Application executions provide transaction-local context such as:

```text
tenant
user
session
request
module
```

The audit trigger captures the mutation using this context.

---

# 51. Soft-Delete Architecture

Business records are normally soft-deleted.

Re-creation of an equivalent active record is enabled through active-record uniqueness rules rather than destructive removal of historical records.

Physical purge is explicit and policy-driven.

---

# 52. Database Scheduler

The supported Targoman PostgreSQL image includes the approved extension required for scheduled database Events.

Database Events may perform database-local periodic work.

They must not invoke external business infrastructure.

---

# 53. Database Roles

At minimum:

```text
Migration Role
Runtime Role
```

should be separated.

Sensitive deployments may further define:

```text
API Runtime Role
Worker Runtime Role
Maintenance Role
Migration Role
```

Runtime roles must not normally have schema-altering privileges.

---

# 54. Database Migration Model

Migration execution is module-aware.

Startup or upgrade executes:

```text
Platform Migrations
+
Installed Capability Migrations
+
Installed Module Migrations
```

Migrations may run through:

- a dedicated migration command;
- one-shot OCI container;
- Kubernetes Job.

Application replicas must not race to mutate schema independently.

---

# 55. Document Core

Document is a shared platform concept.

The logical model is:

```text
Business Resource
      ↓
Document
      ↓
Document Version
      ↓
Document Asset
```

Examples:

```text
Letter
├── Body Document
└── Attachment Documents
```

---

# 56. File Processing

The shared file-processing pipeline handles initial formats:

```text
Plain Text
DOCX
ODT
Markdown
Text PDF
```

Flow:

```text
Asset
   ↓
File Type Detection
   ↓
Processor
   ↓
Normalized Content
   ↓
Metadata
```

OCR is a future extension point.

---

# 57. Storage Abstraction

File storage is accessed through a platform Storage contract.

Initial implementations may include:

```text
Mounted Persistent Volume
S3-Compatible Storage
```

Modules must not construct physical file paths directly.

---

# 58. Knowledge Spaces

RAG content is organized through Knowledge Spaces.

A Knowledge Space may belong to:

- tenant;
- organizational unit;
- user;
- project;
- session;
- widget;
- secretariat;
- other business context.

It defines logical:

- ownership;
- indexing;
- retrieval;
- lifecycle;
- policy.

---

# 59. Qdrant Is a Derived Index

Qdrant stores:

- vectors;
- retrieval payload;
- searchable derived metadata.

PostgreSQL remains authoritative for:

- document identity;
- Knowledge Space;
- ACL;
- classification;
- business ownership.

Qdrant must be rebuildable.

---

## 59.1 Data Governance and Egress Policy

Data Governance is a shared platform capability that resolves policies affecting data lifecycle and movement.

Policy inputs may include:

- tenant;
- resource type;
- classification;
- residency requirements;
- retention policy;
- destination class;
- external-provider eligibility;
- legal hold;
- backup / archive policy.

Before protected data leaves the approved trust boundary, the caller must obtain a Data Governance decision.

Typical consumers include:

```text
AI Router
External Integrations
Security Telemetry Export
Document Export
Backup / Archive
```

Authorization answers whether an actor may perform an operation.

Data Governance additionally answers whether the data itself may be moved, retained, exported, or sent to a given destination.

---

# 60. RAG Authorization Flow

RAG retrieval follows:

```text
User Question
      ↓
Authorization Context
      ↓
Requested Operation
      ↓
Knowledge Policy
      ↓
Authorized Retrieval Filter
      ↓
Qdrant Search
      ↓
Rerank
      ↓
LLM
```

`discover`, `use`, and `quote` may produce different retrieval visibility.

---

# 61. AI Router

AI is accessed through a shared Router.

Business modules request semantic tasks.

Examples:

```text
rag.answer
letter.draft
secretariat.metadata.extract
followup.action.extract
ticket.summarize
```

The module does not select the model.

---

# 62. AI Task Registry

Every AI task has a policy.

Possible policy fields:

```text
task ID
model tier
primary candidates
fallback candidates
context requirement
structured-output requirement
privacy class
latency class
timeout
maximum output
reasoning policy
hardware preference
```

---

## 62.1 AI Operational Run Record

Every material AI execution produces a structured operational record.

Conceptually, an AI Run may record:

```text
task
tenant / actor context
model
endpoint
prompt / policy version
start / end time
latency
input tokens
output tokens
retry count
fallback lineage
status
error class
request / correlation ID
estimated cost / resource class
```

The AI Run is used for:

- diagnostics;
- usage accounting;
- quota enforcement;
- capacity planning;
- routing evaluation;
- incident analysis.

Raw confidential prompts, responses, secrets, chain-of-thought, or hidden reasoning traces are not stored in the operational record unless an explicit data-governance policy permits a separate protected diagnostic capture.

---

# 63. Model Endpoint Registry

Model endpoints are registered independently.

An endpoint may describe:

```text
provider
model
context window
maximum output
streaming capability
structured-output support
privacy class
hardware
health
```

Initial baseline:

```text
Aya-Expanse-8B
vLLM
RTX 4090
```

---

# 64. High-Tier AI

Higher-tier endpoints may run on H200 NVL.

Examples of potential high-tier tasks include:

- complex legal letter generation;
- difficult multi-document synthesis;
- long-context analysis;
- tasks shown by evaluation to exceed baseline model quality.

Routing to higher tiers must be task-driven, not hardware-driven.

---

# 65. Interactive AI

Interactive AI may execute synchronously through API + Router.

Examples:

- chat;
- RAG answer;
- letter drafting.

Streaming responses normally use SSE.

---

# 66. Background AI

Bulk or deferred AI tasks run through Worker.

Examples:

- metadata extraction;
- document classification;
- large imports;
- bulk summaries;
- Follow-up extraction.

The AI Router contract is identical.

---

# 67. Calendar Architecture

Calendar is shared.

Logical split:

```text
calendar-core
calendar-svelte
```

Calendar Core owns:

- Jalali/Gregorian conversion;
- date math;
- range math;
- scheduling utilities;
- timezone behavior.

UI owns:

- date picker;
- range picker;
- month view;
- week view;
- agenda;
- meeting UI.

---

# 68. Notifications

Notifications are shared and optional.

Modules request semantic notifications.

Examples:

```text
followup.reminder
ticket.assigned
letter.received
payment.confirmed
```

The Notification subsystem owns delivery.

---

# 69. Notification Channels

Initial or future channels may include:

```text
In-App
Email
SMS
Webhook
Messaging Adapter
```

Provider-specific logic is isolated in adapters.

---

# 70. Notification Flow

Recommended flow:

```text
Domain Event / Application Request
        ↓
Notification Policy
        ↓
Recipient Resolution
        ↓
Template
        ↓
Channel Selection
        ↓
Durable Job
        ↓
Provider Adapter
        ↓
Delivery Result
```

---

# 71. Ticketing

Ticketing is a shared optional capability.

Possible sources:

```text
User Support
Widget Escalation
CRM Support
Secretariat Processing Problem
Commercial Issue
```

Ticketing remains domain-neutral.

---

# 72. Ticket Domain Boundary

Ticketing may own generic concepts including:

- Ticket;
- Messages;
- Status;
- Priority;
- Assignment;
- Requester;
- Participants;
- Tags;
- Category;
- SLA metadata;
- Linked Resources;
- Attachments;
- History.

Attachments use Document Core.

---

# 73. Commercial Capability

Commercial functionality is optional.

It may support:

- orders;
- payments;
- wallet;
- ledger;
- invoices;
- refunds;
- credits;
- checkout.

It does not own service-specific meaning.

---

# 74. Module Offerings

Business modules define offerings.

Examples:

```text
Widget → AI token package
RAG → storage package
Future Module → subscription
```

Commercial Core processes transactions.

The module performs fulfillment.

---

# 75. Commercial Fulfillment

Flow:

```text
Offering
   ↓
Order
   ↓
Payment Confirmation
   ↓
Fulfillment Event
   ↓
Owning Module
   ↓
Entitlement / Activation
```

Payment truth and service truth remain separate.

---

# 76. Usage Accounting

Usage may measure:

- LLM tokens;
- API calls;
- storage;
- GPU time;
- document processing;
- module-specific units.

Usage Accounting is not financial accounting.

---

## 76.1 Quota and Admission Control

Admission Control decides whether a new operation may begin.

Policy may be scoped by:

```text
Deployment
Tenant
User
Service Account
API Client
Module
Module Instance
Commercial Entitlement
```

Controlled dimensions may include:

- requests per interval;
- concurrent operations;
- AI input / output tokens;
- daily / monthly consumption;
- storage;
- uploads;
- external-provider usage;
- module-specific units.

Admission Control uses authoritative Usage, Commercial Entitlement, and policy information but owns the final admission decision.

In horizontally scaled deployments, authoritative limits must use shared or durable state where correctness requires it.

Process-local counters may be used only as non-authoritative optimization.

Admission Control also provides backpressure to protect shared infrastructure from overload.

---

# 77. Financial Accounting

Financial truth is ledger-based.

Commercial balances are derived from ledger entries.

Money is represented using integer atomic units plus currency.

---

# 78. Integration Architecture

External integrations are adapters.

Examples:

```text
SMS
Email
Payment Gateway
Taskulu
Mizito
External Calendar
Secretariat
Object Storage
Identity Provider
SOC / SIEM
```

Modules use integration contracts rather than provider SDKs directly.

---

# 79. Inbound vs. Outbound Integration

Inbound:

```text
External System
    ↓
Platform
```

Examples:

- Secretariat sync;
- webhook;
- bulk import;
- provider callback.

Outbound:

```text
Platform
    ↓
External System
```

Examples:

- SMS;
- calendar creation;
- email;
- external task;
- external letter registration.

The two directions use separate contracts.

---

## 79.1 Reconciliation Architecture

External integrations may produce uncertain outcomes.

A provider operation may therefore enter:

```text
SUCCESS
FAILED
UNKNOWN / UNRESOLVED
```

When the outcome is unknown, the owning capability must not blindly retry an operation that may already have produced an external side effect.

The shared Reconciliation capability provides reusable primitives for:

- unresolved-operation tracking;
- provider-status requery;
- correlation to original requests;
- reconciliation jobs;
- operator review;
- final resolution;
- audit evidence.

Examples include:

```text
payment status
external calendar creation
Taskulu task creation
letter registration
commercial fulfillment
```

Canonical business truth remains owned by the originating capability. Reconciliation owns the process of resolving uncertainty, not the underlying business meaning.

---

# 80. Secretariat Ingestion

Secretariat sources are read-only.

Supported source patterns may include:

- REST;
- PostgreSQL;
- MySQL;
- SQL Server;
- bulk table;
- bulk files;
- manual import.

External data is normalized into the canonical Secretariat model.

---

# 81. Audit Architecture

Audit is append-oriented.

Typical audit dimensions include:

```text
tenant
actor
session
action
resource
result
reason
request
timestamp
```

Database mutation audit and semantic business audit are separate but complementary.

---

# 82. Operational Observability

Observability includes:

- structured logs;
- metrics;
- health;
- correlation IDs;
- job metrics;
- AI latency;
- AI failures;
- database metrics;
- Qdrant metrics;
- provider failures.

Operational logs are not authoritative business state.

---

# 82.1 Security Telemetry Export / SOC-SIEM Integration

Security Telemetry Export is a shared optional platform capability that exposes selected security, audit, and operational telemetry to external SOC / SIEM systems.

It consumes canonical evidence owned by Audit, Observability, and other approved event owners. It does not become a second source of truth for those events.

Two integration modes are supported.

## Pull Mode

An external SOC / SIEM may consume telemetry through a read-only platform API.

The pull API:

- is exposed through the normal API boundary;
- requires authentication and Authority authorization;
- supports tenant-aware filtering;
- supports time-range and event-class filters;
- uses cursor/checkpoint-based pagination;
- never exposes direct database connectivity;
- never provides mutation operations.

## Push Mode

The platform may send selected telemetry to a customer-provided SOC / SIEM destination.

The push pipeline is:

```text
Canonical Audit / Security / Operational Event

        ↓
Export Policy
        ↓
Filter / Redaction
        ↓
Transformation Profile
        ↓
Durable Export State / Job
        ↓
SOC / SIEM Adapter
        ↓
Delivery Result / Checkpoint
```

Push delivery must support:

- stable event identity;
- durable retry state;
- bounded retry and backoff;
- idempotent or duplicate-tolerant delivery semantics;
- terminal failed / unresolved states;
- observable backlog and delivery health.

Customer-specific event formats, protocols, and field mappings belong behind export adapters.

Failure of an external SOC / SIEM destination must not destroy canonical telemetry or corrupt the originating business transaction.

---

# 83. Correlation Context

Every inbound request receives a correlation/request identifier.

That identifier propagates into:

- application service;
- persistence context;
- audit;
- outbox;
- jobs;
- provider calls where appropriate.

This enables end-to-end traceability.

---

# 84. Execution Context

Execution carries explicit context.

Conceptually:

```ts
interface intfExecutionContext {
  deploymentId: string;
  tenantId: string;

  userId?: string;
  actorIdentityId?: string;
  actorIdentityType?: string;
  sessionId?: string;
  initiatingIdentityId?: string;

  requestId: string;
  authorizationContext: unknown;
}
```

Background work reconstructs an appropriate execution context.

---

# 85. Authorization Enforcement Points

Authorization must exist at all relevant boundaries, including:

```text
API operation
Administrative command
Document operation
Knowledge retrieval
Download
Ticket access
Commercial operation
External integration
Module-instance administration
```

Frontend checks improve UX only.

---

# 86. Security Baseline

The platform baseline is:

```text
OWASP ASVS Level 2
```

High-assurance capabilities and deployments apply appropriate Level 3 controls.

Security architecture includes:

- input validation;
- least privilege;
- tenant isolation;
- session security;
- secret management;
- transport security;
- audit;
- secure persistence;
- secure upload handling.

---

# 87. No Direct Browser-to-Database Access

All browser requests pass through application transport and application services.

Forbidden:

```text
Browser
   ↓
Database
```

Required:

```text
Browser
   ↓
API Boundary
   ↓
Application
   ↓
Persistence
   ↓
Database
```

---

# Scalability and High Availability Architecture

The platform is designed so stateless runtime responsibilities can be replicated horizontally.

Typical horizontally scalable components include:

```text
Web
API
Workers
AI Router / Gateway
Model-serving endpoints
```

State required for correctness must not exist only in process memory.

Shared authoritative or durable state belongs in approved persistent infrastructure such as:

```text
PostgreSQL
Object Storage
Qdrant
Durable Job State
```

Application instances must tolerate replacement without loss of authoritative state.

No single application replica may assume exclusive ownership of:

- user sessions;
- scheduled jobs;
- module state;
- authorization state;
- retry state;
- durable events.

Worker concurrency must use safe claim/lease/locking semantics.

API instances should remain horizontally replicable without sticky sessions unless a specifically documented protocol requires them.

High-availability deployment profiles may use multiple instances of critical runtime components and redundant infrastructure appropriate to the customer's required availability level.

The architecture must support health checks, readiness checks, graceful shutdown, rolling replacement, controlled failover, and dependency-aware degradation.

---

# Reliability and Fault Recovery

Reliability means preserving defined system behavior under partial failure, retry, concurrency, restart, and dependency loss.

Critical operations must explicitly define:

- transaction boundary;
- idempotency behavior;
- retry policy;
- timeout policy;
- failure state;
- recovery path;
- audit evidence.

The system must distinguish:

```text
SUCCESS
FAILED
UNKNOWN / UNRESOLVED
```

where external side effects may have uncertain outcomes.

Unknown external outcomes must not be guessed into success or failure.

A subsystem failure should degrade only the functionality that depends on that subsystem where technically practical.

External and capacity-sensitive dependencies should use appropriate resilience controls such as:

- timeout;
- bounded retry;
- exponential backoff;
- circuit breaker;
- concurrency limit;
- admission control;
- bulkhead / failure isolation;
- explicit fallback where semantically safe.

Fallback must never silently change security, privacy, residency, or data-egress policy.

---

## Backup, Restore, and Disaster Recovery

Authoritative persistent state requires an explicit recovery architecture.

A deployment recovery profile may define:

- backup scope;
- backup frequency;
- retention;
- off-site / independent copies;
- PostgreSQL point-in-time recovery;
- object-storage protection;
- Qdrant rebuild or backup strategy;
- Recovery Point Objective (RPO);
- Recovery Time Objective (RTO);
- disaster-recovery topology.

Backup creation alone is insufficient.

Restore procedures and disaster-recovery paths must be tested periodically.

A recovery exercise must verify restored data integrity, application compatibility, required secrets/configuration recovery, and the ability to resume service.

---

# 88. Reverse Proxy / Gateway

The deployment edge may use:

- HAProxy;
- Nginx;
- Traefik;
- Kubernetes Gateway/Ingress;
- another approved gateway.

Responsibilities include:

- TLS;
- host routing;
- path routing;
- forwarding headers;
- request limits;
- streaming support;
- optional edge rate limits.

---

# 89. OCI Delivery Model

The product is delivered as OCI-compatible images.

Typical application images:

```text
targoman-platform-web
targoman-platform-api
targoman-platform-worker
```

Infrastructure may include:

```text
targoman-postgres
qdrant
vllm
reverse proxy
```


Application and infrastructure artifacts participate in a controlled software supply chain.

Release artifacts should support:

- versioned immutable tags;
- content digests;
- SBOM generation;
- vulnerability scanning;
- dependency and base-image provenance;
- artifact signing where deployment policy requires it;
- release provenance linking source revision to delivered images.

Production deployment should be able to pin immutable artifact identities rather than relying solely on mutable tags.

---

# 90. Targoman PostgreSQL Image

The supported PostgreSQL image may include approved extensions required by the platform, including database scheduling.

The image version identifies:

```text
PostgreSQL version
Approved extensions
Extension versions
Platform compatibility
```

Database extension drift must be controlled.

---

# 91. External Infrastructure Is Supported

PostgreSQL, Qdrant, storage, and model serving may be:

- shipped with the deployment;
- external customer infrastructure;
- shared infrastructure;
- separate dedicated hosts.

Application configuration defines endpoints.

---

# 92. Small Deployment

A small installation may run:

```text
Reverse Proxy
Web
API
Worker
PostgreSQL
Qdrant
vLLM / RTX4090
```

on one or a small number of servers.

Kubernetes is not required.

---

# 93. Enterprise Deployment

A large deployment may use:

```text
Ingress
   ↓
Web Replicas
API Replicas
Worker Replicas

Dedicated PostgreSQL
Dedicated Qdrant
Object Storage
Multiple AI Endpoints
RTX4090 Pool
H200 NVL Tier
```

The application architecture remains unchanged.

---

# 94. Kubernetes Compatibility

The platform must support:

- readiness probes;
- health probes;
- rolling replacement;
- replicated stateless API;
- replicated workers;
- externalized secrets;
- persistent storage;
- one-shot migration jobs.

Kubernetes remains optional.

---

# 95. Persistent State

Persistent state must survive application-container replacement.

Examples:

- PostgreSQL;
- Qdrant;
- documents;
- uploaded assets;
- generated retained assets;
- audit;
- commercial ledger;
- persistent deployment configuration.

---

# 96. Runtime Configuration

Customer-specific configuration is externalized.

Examples:

- modules;
- branding;
- routes;
- database endpoints;
- AI endpoints;
- integrations;
- commercial operator;
- security bounds;
- admission-control policies;
- data-governance / egress policies;
- SOC / SIEM export configuration;
- availability / recovery profile;

Secrets are not part of normal application configuration files unless stored through an approved secure mechanism.

---

## 96.1 Configuration Drift Detection

Deployment Profile and approved infrastructure configuration define desired state.

Deployment tooling should be able to compare desired state with effective runtime state for relevant configuration such as:

- module enablement;
- image versions / digests;
- routes;
- security settings;
- integration endpoints;
- model endpoints;
- database extensions;
- infrastructure topology.

Meaningful drift must be observable.

Security-relevant or service-impacting drift should generate operator-visible evidence and, where appropriate, audit or alert events.

Manual emergency changes require later reconciliation back into the canonical desired-state configuration.

---

# 97. Upgrade Flow

A typical upgrade flow is:

```text
New Version Available
      ↓
Validate Deployment Profile
      ↓
Backup / Safety Gate
      ↓
Run Migrations
      ↓
Deploy New Application Images
      ↓
Health / Compatibility Check
      ↓
Enable Traffic
```

Exact production procedure is defined in deployment documentation.

---

# 98. Failure Isolation

Subsystem failure should degrade predictably.

## Qdrant Failure

Authoritative document metadata survives.

Semantic retrieval may become unavailable.

## Model Server Failure

Non-AI functionality continues where possible.

AI Router may use approved fallback.

## Notification Provider Failure

Business transaction remains valid.

Notification remains retryable.

 ---

## SOC / SIEM Destination Failure

Canonical security and audit evidence remains available.

Pending push export remains durable and retryable.

Unavailability of the external SOC / SIEM must not by itself corrupt or roll back the originating business transaction unless an explicitly approved high-assurance deployment policy requires stronger behavior.

## Commercial Disabled

Internal platform use remains unaffected.

## Ticketing Disabled

Modules operate without ticket features unless deployment policy explicitly requires them.

---

# 99. Idempotent Recovery

Critical external and asynchronous operations are designed for at-least-once execution.

Recovery-sensitive examples:

- payment callbacks;
- notification delivery;
- document indexing;
- Secretariat import;
- external calendar creation;
- commercial fulfillment.

Idempotency semantics belong to the owning capability.

---

# 100. Architecture Enforcement

Architecture rules should be tested in CI.

Examples:

- modules cannot import private code from other modules;
- platform packages cannot depend on business modules;
- SQL cannot exist outside persistence;
- controllers cannot access database clients;
- business modules cannot import model-server clients;
- UI cannot import persistence packages;
- forbidden dependencies fail builds.

---

# 101. Initial Architecture Implementation Order

Recommended sequence:

```text
1. Repository / workspace foundation
2. Web + API + Worker skeleton
3. Platform Registry / Module Manifest
4. PostgreSQL foundation
5. Authority / Tenant / Session / Machine Identity
6. Quota / Admission Control foundation
7. Admin Shell + User Shell
8. Document + File Processing
9. Data Governance / Egress foundation
10. Knowledge / RAG
11. AI Router + AI Run telemetry
12. Job / Worker / Reconciliation infrastructure
13. Notifications
14. Ticketing
15. Backup / Restore / DR foundation
16. Smart Secretariat
17. Letter Assistant
18. Follow-up
19. Widget consolidation
20. CRM consolidation
21. Optional Commercial implementation
```

Commercial architecture remains present from the beginning even if full implementation is deferred.

---

# 102. Governing Architecture Documents

The intended documentation sequence is:

```text
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

Module-specific architecture documents follow.

---

# 103. System Architecture Summary

The platform is built around these core ideas:

```text
One product
Multiple deployment forms
Independent business modules
Shared platform capabilities
Explicit contracts
Tenant-bound authority
Human and machine identities
Quota / admission control
Controlled persistence
PostgreSQL as relational truth
Qdrant as derived semantic index
Task-based AI routing
Data-local logic in PostgreSQL
Application orchestration outside PostgreSQL
Durable background work
Reconciliation of uncertain external outcomes
Data governance and controlled egress
Backup / restore / disaster recovery
Supply-chain verifiability
Configuration-drift detection
Optional commerce
Shared notification and ticketing
Configurable branding
Configurable routing
OCI-native delivery
```

The architectural objective is that a capability can grow from:

```text
in-process module
```

to:

```text
independently scaled service
```

without redefining its domain contract.

The final system rule is:

> **Business semantics belong to their canonical owner.  
> Shared capabilities belong to the platform.  
> Data-local logic belongs close to the data.  
> External orchestration belongs to the application layer.  
> Deployment choices belong to configuration.**

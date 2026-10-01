# Targoman AI Platform — Module Architecture

**Document:** `docs/architecture/05-module-architecture.md`  
**Version:** 0.1  
**Status:** Proposed Architecture  
**Depends on:**

- `00-manifest.md`
- `01-system-architecture.md`
- `02-engineering-conventions.md`
- `03-persistence-and-database.md`
- `04-authorization-model.md`

---

# 1. Purpose

This document defines the architecture of business modules and modular platform composition in the **Targoman AI Platform**.

It specifies:

- module identity;
- module ownership;
- packaging;
- installation;
- tenant enablement;
- optional module instances;
- module manifests;
- capability dependencies;
- public contracts;
- cross-module communication;
- routes;
- frontend contributions;
- Admin contributions;
- User Dashboard contributions;
- persistence;
- migrations;
- authorization vocabulary;
- Resource Fact Resolvers;
- events;
- Jobs;
- integrations;
- Documents;
- AI tasks;
- Notifications;
- Ticketing;
- Usage;
- Admission Control;
- Commercial offerings;
- Data Governance;
- Observability;
- lifecycle;
- upgrades;
- disablement;
- uninstallation;
- testing.

The central rule is:

> **A module owns its business semantics but consumes shared platform capabilities through explicit contracts.**

---

# 2. Business Modules Are Domain Owners

A business module represents one coherent business capability.

Initial modules include:

```text
CRM
Widget / Chat Builder
Smart Secretariat
Letter Assistant
Follow-up
```

A module owns:

- business terminology;
- domain entities;
- lifecycle rules;
- application use cases;
- domain-specific persistence;
- domain-specific UI;
- domain events;
- AI task definitions;
- domain-specific integrations;
- domain-specific Usage semantics;
- optional Commercial offerings.

---

# 3. Platform Capabilities Are Not Business Modules

Shared capabilities include:

```text
Authority
Audit
Security Telemetry
Documents
File Processing
Knowledge / RAG
AI Router
Jobs
Notifications
Ticketing
Storage
Calendar
Usage Accounting
Admission Control
Reconciliation
Data Governance
Commercial
Branding
Observability
```

A business module consumes these capabilities.

It must not reproduce them internally.

---

# 4. Shared Core Must Remain Domain-Neutral

A business rule must not move into Platform Core merely because more than one module currently uses similar code.

Before promotion to Platform Core, a capability must be independently meaningful outside one business workflow.

Preferred:

```text
Document storage
→ Platform

Letter approval policy
→ Letter Assistant
```

Not:

```text
Letter approval policy
→ generic Platform workflow engine
```

without a demonstrated reusable requirement.

---

# 5. Module Boundaries Are Semantic Boundaries

Module separation does not imply separate:

- repository;
- process;
- container;
- database;
- network service.

The mandatory boundary is:

```text
Public Contract
```

The network boundary is optional.

---

# 6. Module Identity Is Stable

Every module has an immutable canonical identifier.

Examples:

```text
crm
widget
secretariat
letter-assistant
followup
```

A released module ID must never be reused for another meaning.

Display names may change.

Module IDs do not.

---

# 7. Package Presence Is Not Installation

A module may physically exist in a Universal Build without being installed or active.

These concepts are different:

```text
Packaged
Installed
Tenant Enabled
Identity Authorized
```

`Packaged` is a delivery/build property.

The three runtime states remain:

```text
Installed
Tenant Enabled
Authorized
```

---

# 8. Installed Means Operationally Registered

A module is Installed when:

- compatible module code exists;
- its manifest is accepted;
- required platform capabilities are available;
- required migrations are applied;
- its module version is registered;
- mandatory startup validation succeeds.

Installation does not enable the module for any tenant.

---

# 9. Tenant Enabled Is Separate

A module may be installed but disabled for a tenant.

Example:

```text
Installed:
    Secretariat
    CRM
    Widget

Tenant A:
    Secretariat = Enabled
    CRM = Disabled
    Widget = Enabled
```

Tenant enablement is authoritative runtime state.

---

# 10. Authorization Is Separate From Enablement

An enabled module does not imply access.

The complete operation gate is conceptually:

```text
Module Installed
    +
Tenant Enabled
    +
Instance Available where applicable
    +
Authority ALLOW
    +
Other applicable policy gates
```

---

# 11. Disabled Modules Must Not Leak Functionality

When a module is disabled for a tenant:

- ordinary frontend routes are unavailable;
- ordinary API operations are unavailable;
- new interactive work cannot start;
- Authority must not authorize ordinary module operations;
- scheduled module behavior follows explicit disablement policy.

Module code being present in the application image must not expose the disabled capability.

---

# 12. Modules May Have Instances

Some modules represent one tenant-wide service.

Others represent multiple independent configured applications.

Examples:

```text
CRM
    → normally tenant-wide

Follow-up
    → normally tenant-wide

Widget
    → multiple Widget Instances
```

Module Instance is therefore an optional architectural concept.

---

# 13. Module Instance Models Are Explicit

A module declares one instance model.

Conceptually:

```ts
enum enuModuleInstanceModel {
  NONE = 'none',
  SINGLETON_PER_TENANT = 'singleton-per-tenant',
  MULTIPLE_PER_TENANT = 'multiple-per-tenant',
}
```

`NONE` means the module does not expose an independently administered instance concept.

---

# 14. Module Instance Is Not Tenant

A module instance exists inside a tenant.

Example:

```text
Tenant A
├── Widget #1
├── Widget #2
└── Widget #3
```

The instances do not become tenants.

---

# 15. Instance Administration Is Scoped

Authority may assign roles or grants to one Module Instance.

Example:

```text
Widget #27
    Business Unit A
        → beneficiary administrator
```

That authority does not apply to Widget #28.

---

# 16. Every Module Has a Manifest

Each module publishes a machine-readable manifest.

Canonical location:

```text
modules/<module>/manifest.ts
```

The manifest describes what the module contributes to the platform.

---

# 17. Manifest Is Declarative

The Manifest declares capability metadata.

It must not itself become a composition root or hidden runtime workflow.

Prefer:

```text
IDs
Schemas
Descriptors
Contracts
Metadata
Registration declarations
```

Avoid embedding:

```text
database connections
provider clients
network calls
runtime secrets
mutable global state
```

inside the Manifest.

---

# 18. Module Manifest Is Strictly Typed

Conceptually:

```ts
interface intfModuleManifest {
  id: typModuleId;
  version: typModuleVersion;

  compatibility:
    intfModulePlatformCompatibility;

  instanceModel:
    enuModuleInstanceModel;

  capabilities:
    intfModuleCapabilityDependencies;

  authorization?:
    intfModuleAuthorizationContribution;

  backend?:
    intfModuleBackendContribution;

  frontend?:
    intfModuleFrontendContribution;

  persistence?:
    intfModulePersistenceContribution;

  jobs?:
    readonly intfModuleJobContribution[];

  events?:
    readonly intfModuleEventContribution[];

  integrations?:
    readonly intfModuleIntegrationContribution[];

  documents?:
    intfModuleDocumentContribution;

  ai?:
    intfModuleAiContribution;

  notifications?:
    intfModuleNotificationContribution;

  ticketing?:
    intfModuleTicketContribution;

  usage?:
    intfModuleUsageContribution;

  admission?:
    intfModuleAdmissionContribution;

  commercial?:
    intfModuleCommercialContribution;

  governance?:
    intfModuleGovernanceContribution;

  observability?:
    intfModuleObservabilityContribution;
}
```

The final contract must avoid `unknown` where stable semantic types can be defined.

---

# 19. Manifest Has a Versioned Schema

The platform validates Module Manifests against a canonical schema.

A Manifest that cannot be validated must not install.

Manifest format evolution requires explicit compatibility handling.

---

# 20. Installed Module Metadata Is Recorded

The Platform Registry should record sufficient installation evidence such as:

```text
Module ID
Module Version
Manifest Version
Manifest Digest
Installed Time
Migration State
Compatibility State
```

This supports:

- diagnostics;
- upgrade planning;
- drift detection;
- reproducible deployments.

---

# 21. Module Compatibility Is Explicit

A module declares supported platform compatibility.

Conceptually:

```text
Module Version
    requires
Platform Contract Range
```

The platform must reject known-incompatible combinations rather than discover incompatibility during live traffic.

---

# 22. Capability Dependencies Are Declarative

A module explicitly declares:

```text
Required Platform Capabilities
Optional Platform Capabilities
```

Example:

```text
Smart Secretariat

Required:
    Authority
    Documents
    File Processing
    Knowledge
    AI Router

Optional:
    Notifications
    Ticketing
    Commercial
```

---

# 23. Required Capability Must Exist

A module cannot be Installed or Enabled when a mandatory capability is unavailable.

Failure is explicit.

The module must not silently switch to a local replacement implementation.

---

# 24. Optional Capability Must Actually Be Optional

If a module declares:

```text
Ticketing = optional
```

then absence of Ticketing must not make ordinary module operation fail.

The feature using Ticketing may disappear or degrade deliberately.

The module itself remains valid.

---

# 25. Business-to-Business Module Dependency Is Exceptional

A hard dependency such as:

```text
Follow-up
    requires
Secretariat
```

is discouraged.

Prefer:

```text
Follow-up
    works independently
    +
optional Secretariat integration
```

A hard dependency between business modules requires explicit architecture justification.

---

# 26. Cross-Module Communication Uses Public Contracts

A module may communicate with another module only through:

- published application contracts;
- stable resource references;
- events;
- approved integration adapters.

It must not use another module's:

- private domain code;
- persistence;
- private application services;
- internal configuration;
- internal filesystem paths.

---

# 27. Direct Cross-Module SQL Is Prohibited

Forbidden:

```text
Follow-up Persistence
        ↓
SELECT ...
FROM secretariat.tbl_sec_letter
```

Required:

```text
Follow-up
    ↓
Secretariat Public Contract
```

or:

```text
Stable Resource Reference
```

or:

```text
Published Event
```

---

# 28. Platform Packages Never Depend on Business Modules

Dependency direction is:

```text
Platform
    ↑
Business Module
```

Never:

```text
Platform
    ↓
Specific Business Module
```

A generic platform capability cannot import CRM, Widget, Secretariat, Letter Assistant, or Follow-up internals.

---

# 29. Stable Resource References Connect Domains

Cross-module resource linkage uses typed references.

Conceptually:

```ts
interface intfResourceRef {
  ownerModuleId: typModuleId;
  resourceType: typResourceTypeId;
  resourceId: string;
}
```

Example:

```text
Follow-up Task
    linked to
secretariat.letter / 3192
```

---

# 30. Resource References Do Not Grant Access

Possessing a Resource Reference does not prove authorization.

The consuming application still requests an Authority decision before accessing protected resource information.

---

# 31. Cross-Module References Do Not Require Foreign Keys

Business-module-to-business-module physical foreign keys are discouraged by default because they create installation and lifecycle coupling.

Stable logical references are preferred.

---

# 32. Foundational Platform References May Use Foreign Keys

A module may reference foundational platform entities through approved relational contracts where the architecture requires strong integrity.

Examples may include:

```text
Tenant
Identity
Document
```

This does not permit cross-owner mutation.

---

# 33. Module Public APIs Are Explicit

Each module exposes only intentionally public contracts.

Consumers must not import:

```text
modules/<module>/domain/private/*
modules/<module>/persistence/*
modules/<module>/internal/*
```

Explicit public exports are required.

---

# 34. Wildcard Module Exports Are Prohibited

Avoid:

```ts
export * from './domain';
```

Module boundaries must remain reviewable.

Expose the smallest meaningful public surface.

---

# 35. Module Contracts Are Provider-Neutral

A module public contract describes domain meaning.

It must not expose implementation details such as:

```text
PostgreSQL rows
Kysely objects
Express Request
Svelte component state
Provider SDK types
vLLM request bodies
```

---

# 36. Backend Routes Are Contributions

A module may contribute API routes through an explicit backend registration contract.

The module declares logical route identity.

It does not own its final public hostname.

---

# 37. Modules Must Not Hard-Code Public URLs

Forbidden:

```text
https://customer.example.com/secretariat
```

inside module business logic.

Public locations are resolved through Platform Routing.

---

# 38. Module Routes Are Relative to Deployment Binding

A module may expose logical route fragments such as:

```text
/
letters
search
settings
```

The deployment may bind them under:

```text
/secretariat
```

or:

```text
secretariat.customer.example
```

or another configured route.

---

# 39. Transport Remains Thin

Module controllers obey the common transport rules:

```text
Parse
Validate
Authenticate
Authorize
Invoke Application Service
Map Response
```

Controllers must not contain business rules or persistence logic.

---

# 40. Module APIs Are Versioned When Externally Consumed

Internal implementation routes may evolve with the platform.

Externally supported module APIs require:

- explicit compatibility;
- canonical schema;
- versioning;
- deprecation policy;
- generated contract documentation where practical.

---

# 41. Frontend Contributions Are Declarative

A module may contribute:

- authenticated routes;
- public routes;
- navigation;
- User Dashboard cards;
- Admin menus;
- Admin pages;
- settings surfaces.

The Platform Shell composes active contributions.

---

# 42. Frontend Contribution Requires Enablement

A frontend contribution is visible only when applicable conditions such as these hold:

```text
Module Installed
Tenant Enabled
Route Available
User Capability View
```

UI hiding is not backend authorization.

---

# 43. Module UI Does Not Own Authorization Semantics

Forbidden:

```ts
if (user.role === 'secretariat-admin') {
  showSettings = true;
}
```

Preferred:

```text
Backend / Authority Capability View
    ↓
UI Presentation
```

Actual API execution is independently authorized.

---

# 44. Admin Contributions Are Module-Aware

Modules may contribute:

```text
Admin Menu
Settings
Operational Dashboard
Reports
Connector Management
Instance Administration
```

The shared Admin Shell remains the composition surface.

---

# 45. No Empty Admin Placeholders

If a module or optional capability is not active, the Admin Shell should not expose meaningless empty sections.

Navigation derives from installed and enabled contributions.

---

# 46. User Dashboard Contributions Are Optional

A module may expose:

- launch card;
- personal status;
- recent activity;
- personal Usage;
- pending task count;
- entitlement summary.

Single-module deployments may bypass the shared dashboard.

---

# 47. Module Configuration Is Typed

Every configurable module exposes a configuration schema.

Configuration is validated before becoming effective.

Configuration must not be an arbitrary unvalidated JSON bag.

---

# 48. Module Configuration Uses the Platform Hierarchy

Module configuration may inherit from:

```text
Platform Default
    ↓
Build / Deployment Profile
    ↓
Tenant Configuration
    ↓
Module Configuration
    ↓
Instance Configuration
    ↓
User Preference
```

Not every setting is overridable at every level.

---

# 49. Security Bounds Cannot Be Relaxed Locally

A module or tenant configuration must not exceed hard security boundaries established by deployment or platform policy.

Example:

```text
Deployment:
external AI forbidden for Confidential data

Module:
external AI enabled
```

must still result in:

```text
DENY EXTERNAL EGRESS
```

---

# 50. Secrets Are References

Module configuration may refer to secret identities.

It must not normally embed secret values.

Example:

```text
secretRef = customer-secretariat-api
```

not:

```text
password = ...
```

inside ordinary configuration.

---

# 51. Module Persistence Has One Owner

A module owns its domain persistence.

Example:

```text
secretariat.*
letter.*
followup.*
```

Other modules cannot mutate it directly.

---

# 52. Module Persistence Is Private by Default

Tables, Views, Procedures, and Functions are implementation details unless an explicit cross-capability database contract has been approved.

A table is not a public API.

---

# 53. Each Persistent Module Owns Its Migrations

Canonical location:

```text
modules/<module>/migrations/
```

Migrations belong to the module release.

---

# 54. Module Installation Applies Required Migrations

Installation flow conceptually includes:

```text
Validate Manifest
    ↓
Validate Dependencies
    ↓
Validate Platform Compatibility
    ↓
Apply Module Migrations
    ↓
Register Module Version
    ↓
Register Contributions
    ↓
Installed
```

---

# 55. Module Migrations Must Be Independently Testable

A module migration suite must work:

```text
Empty Module State
    → Current Version
```

and:

```text
Supported Previous Module Version
    → Current Version
```

---

# 56. Module Migration Must Not Require Another Business Module's Tables

A module migration must not depend on an optional business module's private schema.

Cross-module data migration requires an explicit integration migration strategy.

---

# 57. Module Disablement Is Not Data Deletion

Disabling a module for a tenant:

```text
does not
```

delete its business data.

Data remains available for:

- re-enablement;
- retention;
- audit;
- migration;
- controlled export;
- legal obligations.

---

# 58. Module Uninstallation Is Not Data Purge

Removing module executable capability from a deployment must not automatically:

- drop its schema;
- delete Documents;
- delete Audit;
- erase historical Resource References.

Physical cleanup is an independent controlled lifecycle operation.

---

# 59. Purge Is Explicit

Module data purge requires:

- explicit request;
- Authority approval;
- Data Governance evaluation;
- retention/legal-hold checks;
- audit;
- defined cross-resource behavior.

It is never an implicit side effect of Disable or Uninstall.

---

# 60. Reinstallation Must Be Safe Where Supported

Where product policy supports module reinstallation, retained compatible data should be reusable after migrations and compatibility validation.

No module may assume that install always means an empty schema.

---

# 61. Module Authorization Vocabulary Is Declarative

A module may register with Authority:

- Resource Types;
- Privilege Paths;
- operations;
- value-bearing privilege schemas;
- CRUD privilege schemas;
- Role Templates;
- Instance Role Templates;
- Resource Fact schemas.

It does not register authorization algorithms.

---

# 62. Privilege Registration Includes Hierarchy

Example:

```text
secretariat
├── letter
│   ├── read
│   ├── download
│   ├── use
│   └── manage
└── connector
    └── manage
```

Authority owns the semantics of hierarchical `ALL`.

The module only registers the vocabulary.

---

# 63. Value-Bearing Privileges Declare Their Schema

If a module introduces:

```text
widget.maxInstances
```

it must declare:

- value type;
- validation;
- semantic meaning;
- `ALL` default if applicable.

Authority owns lookup semantics.

---

# 64. Modules Must Not Interpret `ALL`

Forbidden inside a business module:

```ts
if (privs.ALL === true) {
  allow();
}
```

or:

```ts
if (privs.secretariat.ALL) {
  allow();
}
```

Only Authority interprets `ALL`.

---

# 65. Modules Must Not Interpret CRUD Privileges

A module may register a CRUD privilege path.

It must not interpret:

```text
0
w
1
```

itself.

For `w`, the module provides ownership facts.

Authority produces the decision.

---

# 66. Role Templates Are Contributions, Not Assignments

A module may define templates such as:

```text
SecretariatOperator
SecretariatManager
WidgetBeneficiaryAdmin
```

A template is not itself a user assignment.

Authority owns Role entities and assignments.

---

# 67. Role Templates Are Versioned

Changing a Role Template may alter authority.

Therefore template evolution must be explicit.

A module upgrade must not silently broaden effective privileges of existing identities merely because a new permission was added to a template.

---

# 68. Role Expansion Requires Explicit Policy

If a new module version introduces:

```text
secretariat.archive.manage
```

existing `SecretariatManager` assignments must not automatically receive it unless the Role is explicitly defined as system-managed and that upgrade behavior is approved.

Otherwise the administrator must explicitly migrate or approve the role change.

---

# 69. Resource Fact Resolver Is a Module Contract

A module owning protected resources exposes factual information required by Authority.

Conceptually:

```text
Authority
    ↓
Resource Fact Resolver
    ↓
Owning Module
```

---

# 70. Resource Fact Resolver Does Not Authorize

A resolver may report:

```text
tenant
owner
organization
classification
state
instance
```

It must never return:

```text
allowed = true
```

as its own policy conclusion.

---

# 71. Resource Fact Resolution Is Minimal

Authority should receive only facts required for the decision.

Authorization must not require loading full protected business content when metadata is sufficient.

---

# 72. Resource Fact Resolution Should Support Batching

Where resource sets require bounded authorization enrichment, the module should provide efficient batch fact resolution where appropriate.

Avoid:

```text
100 resources
    →
100 independent database round trips
```

when a set-oriented resolution is possible.

---

# 73. List Authorization Uses Semantic Constraints

Authority may produce semantic authorization constraints.

The owning module's persistence translates them to its query representation.

Flow:

```text
Authority
    ↓
Semantic Constraint
    ↓
Module Persistence
    ↓
SQL Predicate / Join
```

The module does not reinterpret policy.

---

# 74. Module Persistence Must Apply Constraints Before Materialization

Forbidden:

```text
Load all rows
    ↓
Application authorization filtering
```

Required:

```text
Authority constraint
    ↓
Authorized database query
    ↓
Authorized rows only
```

---

# 75. Module Events Describe Completed Facts

A module may publish events such as:

```text
secretariat.letter.imported
letter.draft.approved
followup.task.completed
widget.instance.created
```

Events use completed-fact semantics.

---

# 76. Event Ownership Belongs to Producer

The producing module owns:

- event meaning;
- schema;
- compatibility;
- publication point.

Consumers do not redefine the event.

---

# 77. Critical Events Use Durable Publication

Where event loss would violate correctness:

```text
Business Mutation
    +
Outbox Record
    ↓
Commit
```

must occur atomically or through another approved equivalent.

---

# 78. Event Consumer Failure Does Not Rewrite Producer Truth

If:

```text
LetterApproved
```

has been durably committed, a failing consumer does not make the Letter unapproved.

Consumer recovery is independent.

---

# 79. Module Events Are Versioned Contracts

Externally or cross-module consumed event schemas require compatibility rules.

Changing event meaning without version/migration is prohibited.

---

# 80. Optional Integration Uses Events Where Appropriate

Example:

```text
Secretariat
    emits
LetterReceived
        ↓
Follow-up integration
    optionally creates task
```

Secretariat does not require Follow-up to exist.

---

# 81. Modules May Define Job Types

A module may register Worker Job types.

Each Job type defines:

- owner;
- payload schema;
- tenant context;
- stable identity;
- retry policy;
- timeout;
- idempotency;
- terminal states;
- observability.

---

# 82. Job Ownership Is Explicit

Example:

```text
secretariat.sync-source
    → Secretariat

followup.send-reminder
    → Follow-up

letter.render-pdf
    → Letter Assistant
```

The shared Jobs capability owns execution infrastructure.

The module owns Job semantics.

---

# 83. Module Disablement Defines Job Behavior

Every durable Job type must define disablement behavior.

Possible policies include:

```text
FINISH_ALREADY_COMMITTED
PAUSE_WHILE_DISABLED
CANCEL_IF_NOT_STARTED
REQUIRE_OPERATOR_DECISION
```

The policy must be explicit.

---

# 84. Jobs Do Not Assume Authority Persists Forever

A Job must declare whether:

```text
authorization at scheduling time
```

is sufficient or whether:

```text
authorization at execution time
```

must be re-evaluated.

This is especially important after:

- user termination;
- role revocation;
- tenant disablement;
- classification change.

---

# 85. Integration Ports Are Module-Owned When Semantics Are Domain-Specific

Example:

```text
Secretariat
    ↓
intfSecretariatSourceAdapter
```

may be module-owned because Secretariat source semantics are business-specific.

---

# 86. Reusable Provider Capabilities Belong to Platform

Examples:

```text
Email
SMS
Storage
Calendar
Payment Infrastructure
```

should normally use shared platform contracts.

Modules must not create independent email/SMS/storage implementations.

---

# 87. Provider Details Stay in Adapters

Business application logic must not know:

```text
Mizito HTTP payload
Taskulu endpoint
SQL Server driver
SMS vendor SDK
```

Those belong behind adapters.

---

# 88. Inbound and Outbound Integrations Are Separate

Example:

```text
Secretariat Source Import
```

and:

```text
Secretariat Outbound Registration
```

are different integration contracts.

Read-only ingestion must not accidentally gain write capability.

---

# 89. Integration Configuration Is Scoped

Integration configuration may exist at:

```text
Deployment
Tenant
Module
Module Instance
```

depending on the provider and security model.

Secrets remain externally managed.

---

# 90. Integration Failure Semantics Are Explicit

Each integration defines:

- timeout;
- retryability;
- idempotency;
- circuit-breaker behavior;
- unknown-result semantics;
- reconciliation support;
- health behavior.

---

# 91. Unknown Integration Outcomes Use Reconciliation

If an external side effect may already have occurred:

```text
timeout
```

does not mean:

```text
FAILED
```

The owning module uses shared Reconciliation primitives.

---

# 92. Modules Use Document Core

A module must not implement separate generic document/file ownership when Document Core is appropriate.

Example:

```text
Secretariat Letter
    ↓
Document
    ↓
Document Version
    ↓
Asset
```

---

# 93. Business Entity and Document Remain Separate

A Secretariat Letter is not a file.

A Letter may reference:

- Body Document;
- Attachment Documents;
- rendered Document versions.

Business lifecycle remains in the business module.

Document lifecycle remains in Document Core.

---

# 94. Modules Declare Document Relationship Types

A module may declare semantic relations such as:

```text
secretariat.letter.body
secretariat.letter.attachment
letter-assistant.draft
ticket.attachment
```

Document Core stores the relationship.

The business module defines its meaning.

---

# 95. File Processing Is Never Reimplemented

Modules use shared File Processing.

A module requiring a new content format contributes to the shared processor architecture rather than implementing a private duplicate parser.

---

# 96. Knowledge Use Is Explicit

A module may define Knowledge Spaces or Knowledge relationships required for its domain.

Example:

```text
Secretariat Knowledge Space
Widget Knowledge Space
```

The module does not create arbitrary Qdrant collections directly.

---

# 97. Modules Never Access Qdrant Directly for Business RAG

RAG behavior uses Knowledge/RAG contracts.

Authorization and indexing policy remain centralized through shared capabilities.

---

# 98. AI Tasks Are Module Contributions

A module may register semantic AI tasks.

Examples:

```text
secretariat.metadata.extract
letter.draft
followup.action.extract
crm.case.summarize
```

Task identity is stable.

---

# 99. AI Task Contract Is Typed

Each AI task defines:

- input schema;
- output schema;
- semantic purpose;
- structured-output requirement;
- data requirements;
- applicable confidentiality constraints;
- execution class where needed.

---

# 100. Modules Do Not Select Models

Forbidden:

```text
Letter Assistant
    → Aya-Expanse-8B directly
```

Required:

```text
Letter Assistant
    ↓
letter.draft
    ↓
AI Router
```

---

# 101. Model Tier Is Router Policy

The module may declare task requirements.

It must not hard-code:

- model;
- GPU;
- endpoint;
- provider.

Routing policy selects those.

---

# 102. AI Task Must Obey Data Governance

Before protected module data is sent to an external AI endpoint:

```text
Authority
+
Data Governance
+
AI Router Policy
```

must allow the operation.

Local authorization alone does not authorize external egress.

---

# 103. AI Run Telemetry Is Shared

Modules do not create incompatible AI usage logs.

AI Router creates canonical AI Run evidence.

Module identity and task identity are recorded as dimensions.

---

# 104. Notifications Are Semantic Requests

A module requests:

```text
followup.reminder
ticket.assigned
secretariat.letter.received
```

It does not directly invoke an SMS vendor.

---

# 105. Notification Templates May Be Module-Owned

A module may contribute semantic templates and default content.

Notification Core owns:

- delivery;
- recipient routing;
- channel;
- provider;
- retry;
- status.

---

# 106. Ticket Creation Uses Ticketing Core

A module requiring human support/escalation creates a Ticket through Ticketing.

It does not create a private generic support-ticket subsystem.

---

# 107. Ticket Links Use Resource References

A Ticket can reference:

```text
Secretariat Letter
Widget Conversation
CRM Case
Commercial Transaction
```

through stable resource references.

Ticketing does not query private module tables.

---

# 108. Usage Units Are Module-Defined Where Necessary

A module may define domain-specific Usage meters.

Examples:

```text
documents_processed
letters_generated
widget_conversations
followup_notifications
```

Usage Accounting owns measurement persistence and aggregation semantics.

---

# 109. Usage Meter Definitions Are Versioned

Changing the meaning of:

```text
one billable conversation
```

is a contract change.

Usage meter semantics must not silently drift across releases.

---

# 110. Admission Dimensions May Be Module-Specific

A module may define admission dimensions such as:

```text
maximum widgets
maximum active connectors
maximum daily generated letters
```

Admission Control owns final evaluation.

The module provides the vocabulary and consumption facts.

---

# 111. Module Must Not Implement Independent Quota Logic

Forbidden:

```ts
if (tenant.widgets.length >= 10) {
  deny();
}
```

as a parallel policy engine when the limit is governed through Admission Control.

Use the shared admission contract.

---

# 112. Commercial Offerings Belong to the Module

A module may expose offerings such as:

```text
Widget token package
Document storage package
Secretariat connector package
```

The module owns service meaning.

Commercial Core owns transaction mechanics.

---

# 113. Module Works Without Commerce When Commerce Is Optional

If Commercial is disabled:

```text
internal enterprise usage
```

must remain possible when module policy permits it.

Commercial availability must not leak into core business semantics.

---

# 114. Fulfillment Is Module-Owned

After a Commercial transaction succeeds:

```text
Commercial
    ↓
Fulfillment Request/Event
    ↓
Owning Module
    ↓
Entitlement / Activation
```

The module owns fulfillment meaning.

---

# 115. Fulfillment Must Be Idempotent

Commercial retry must not create:

- duplicate entitlement;
- duplicate instance;
- duplicate credits;
- duplicate activation.

Unknown provider or module fulfillment states use Reconciliation.

---

# 116. Data Governance Contributions Are Declarative

A module may declare domain data categories or default governance metadata.

Examples:

```text
Letter Body
Attachment
Customer PII
Widget Conversation
CRM Case
```

Data Governance owns policy evaluation.

---

# 117. Module Does Not Decide External Egress Alone

A module may identify:

```text
this payload contains Confidential Letter content
```

It must not decide independently:

```text
sending it to external AI is allowed
```

Data Governance owns that decision.

---

# 118. Retention Policy Is Not Hard-Coded in Module Jobs

A module may define retention categories and domain requirements.

Actual retention execution consumes Data Governance policy.

Avoid:

```text
DELETE WHERE age > 30 days
```

with an undocumented hard-coded business rule.

---

# 119. Module Observability Is Structured

Modules emit structured operational telemetry through common conventions.

At minimum, relevant telemetry should support dimensions such as:

```text
module
tenant
instance
operation
request
job
result
latency
error class
```

---

# 120. Module Logs Are Not Business History

Operational log:

```text
connector request timed out
```

Business fact:

```text
Letter imported
```

Security event:

```text
Unauthorized connector configuration attempt
```

These remain distinct.

---

# 121. Security-Relevant Events Feed Security Telemetry

Modules emit security-significant evidence through canonical Audit/Security mechanisms.

They do not call customer SOC systems directly.

---

# 122. Module Health Is Explicit

A module may report:

```text
READY
DEGRADED
NOT_READY
```

based on required dependencies.

Optional dependency failure should normally produce:

```text
DEGRADED
```

rather than making unrelated module functionality unavailable.

---

# 123. Health Must Distinguish Required and Optional Dependencies

Example:

```text
Secretariat:

PostgreSQL unavailable
    → NOT_READY

Optional Ticketing unavailable
    → DEGRADED

Optional SMS unavailable
    → DEGRADED
```

Exact semantics belong to the module's dependency contract.

---

# 124. Module Lifecycle Is Explicit

Conceptual lifecycle:

```text
Packaged
    ↓
Installed
    ↓
Tenant Enabled
    ↓
Operational
    ↓
Tenant Disabled
    ↓
Optional Re-enabled
```

Uninstallation is a deployment operation, not ordinary business lifecycle.

---

# 125. Enablement Is an Application Operation

Tenant module enablement:

- is authorized;
- is audited;
- validates required dependencies;
- validates required configuration;
- may initialize tenant-specific defaults.

It must not rely on UI-only toggles.

---

# 126. Enablement Does Not Automatically Grant Roles

When a module is enabled for a tenant:

```text
Role Templates
```

may become available for administration.

Users do not automatically receive those Roles unless explicit policy defines a bootstrap assignment.

---

# 127. Bootstrap Authority Is Explicit

If a product requires first-administrator creation when a module is enabled, that behavior must be an explicit installation/enablement policy.

It must not be hidden inside UI initialization.

---

# 128. Disablement Is Audited

Tenant disablement records:

- actor;
- tenant;
- module;
- reason where required;
- timestamp;
- affected instances;
- job policy outcome.

---

# 129. Disablement Does Not Revoke Unrelated Authority

Disabling Widget does not revoke CRM authority.

Capability changes remain scoped to their canonical domain.

---

# 130. Re-Enable Must Revalidate Configuration

A previously disabled module may have stale:

- integration credentials;
- routing configuration;
- dependency compatibility;
- policy configuration.

Re-enable must validate current requirements.

---

# 131. Module Upgrade Is Versioned

Upgrade may affect:

- migrations;
- contracts;
- privileges;
- Role Templates;
- jobs;
- events;
- configuration schema;
- AI task contracts;
- Usage meters.

Upgrade behavior must therefore be explicit.

---

# 132. Upgrade Must Not Silently Expand Authority

Module upgrade must not silently cause:

```text
existing user
    →
new dangerous privilege
```

without an approved Authority migration policy.

Privilege catalog and Role Template changes require security review.

---

# 133. Upgrade Must Preserve External Contracts

Breaking external APIs, events, or integration contracts require:

- version transition;
- migration;
- compatibility window where applicable.

---

# 134. Configuration Migration Is Explicit

When configuration schema changes, the module provides a deterministic migration or validation path.

Runtime code must not guess how legacy configuration should be interpreted.

---

# 135. Module Uninstall Requires Preconditions

Before removing module executable support, deployment tooling should verify applicable conditions such as:

- no tenant remains enabled;
- no required active module instance remains;
- no unsafe in-flight migration exists;
- durable Jobs have a defined disposition;
- integration shutdown is defined;
- retained data has a supported lifecycle.

---

# 136. Uninstall Does Not Break Resource History

Historical references such as:

```text
Ticket
    → secretariat.letter/123
```

may survive module removal.

Generic platform components must tolerate an unavailable linked-resource owner.

---

# 137. Missing Optional Module Is a Defined State

Cross-module integrations must handle:

```text
MODULE_NOT_INSTALLED
MODULE_DISABLED
RESOURCE_OWNER_UNAVAILABLE
```

without treating these conditions as infrastructure corruption.

---

# 138. Module-Specific Errors Are Stable

A module may define stable errors inside its namespace.

Examples:

```text
SECRETARIAT_SOURCE_UNAVAILABLE
LETTER_TEMPLATE_INVALID
FOLLOWUP_ALREADY_COMPLETED
```

Human messages are separate and localizable.

---

# 139. Error Namespace Does Not Leak Implementation

Avoid:

```text
POSTGRES_FOREIGN_KEY_23503
```

as a module API error.

Persistence errors are translated into domain/application errors.

---

# 140. Module Tests Begin With Contracts

Preferred order:

```text
Manifest / Contract
    ↓
Architecture Test
    ↓
Domain / Repository Test
    ↓
Implementation
    ↓
Integration Test
```

---

# 141. Manifest Conformance Tests Are Mandatory

Tests verify:

- valid Module ID;
- valid Manifest version;
- compatible platform version;
- dependency declarations;
- authorization declarations;
- route declarations;
- migration ownership;
- absence of duplicate contribution IDs.

---

# 142. Dependency Tests Are Mandatory

Tests must verify:

- missing required capability prevents activation;
- missing optional capability does not break base module operation;
- forbidden business-module dependency is detected;
- platform-to-business import is rejected.

---

# 143. Module Isolation Tests Are Mandatory

Architecture tests must reject:

- private cross-module imports;
- direct cross-module SQL;
- direct access to another module's persistence;
- provider SDK use outside approved adapter;
- direct AI model access;
- local authorization evaluation.

---

# 144. Authorization Contribution Tests Are Mandatory

Tests must verify that:

- registered Resource Types are unique;
- Privilege Paths are valid;
- value-bearing privileges define schemas;
- `ALL` semantics are not implemented locally;
- CRUD semantics are not implemented locally;
- Resource Fact Resolvers expose facts only;
- Role Template changes cannot silently broaden authority.

---

# 145. Route Tests Are Mandatory

Tests must verify that modules:

- work under configured base paths;
- do not assume one hostname;
- generate external links through Routing;
- survive path/subdomain deployment changes.

---

# 146. Frontend Composition Tests Are Mandatory

Tests should verify:

- disabled modules disappear;
- unavailable optional features disappear gracefully;
- Admin contributions follow capability state;
- capability views affect presentation only;
- RTL/LTR behavior works where applicable.

---

# 147. Migration Tests Are Mandatory

Each persistent module must test:

```text
empty state → latest
```

and:

```text
supported previous state → latest
```

Module migrations must not depend on unrelated optional business schemas.

---

# 148. Enable/Disable Lifecycle Tests Are Mandatory

Tests must cover:

- enable;
- already-enabled;
- dependency missing;
- invalid configuration;
- disable;
- re-enable;
- disabled route access;
- durable job disposition;
- data preservation.

---

# 149. Event Tests Are Mandatory

Cross-module/public events require:

- schema validation;
- version compatibility;
- durable publication where required;
- duplicate consumption behavior;
- producer independence from consumer availability.

---

# 150. Job Tests Are Mandatory

Module Job tests cover:

- claim;
- duplicate claim;
- retry;
- idempotency;
- timeout;
- terminal failure;
- module disablement;
- identity termination where relevant;
- Worker restart.

---

# 151. Integration Tests Include Failure and Unknown State

Provider integration tests should include:

- success;
- timeout;
- 4xx;
- 5xx;
- rate limit;
- malformed response;
- duplicate callback;
- uncertain side effect;
- reconciliation;
- credential revocation.

---

# 152. AI Task Tests Use the Router Boundary

Module AI tests must not require hard-coded production model endpoints.

Tests should validate:

- task contract;
- structured output validation;
- authorization input;
- Data Governance behavior;
- fallback-safe semantics;
- error handling.

---

# 153. Optional Commercial Tests Are Required Where Applicable

A commercial-capable module should test both:

```text
Commercial Enabled
```

and:

```text
Commercial Disabled
```

where the product supports both configurations.

---

# 154. Module Absence Must Be Tested

A Universal Build with a module disabled and a Slim Build without that module should not break unrelated capabilities.

This is a core modularity test.

---

# 155. Module Documentation Is Part of Completion

A module should document at least:

```text
Purpose
Domain ownership
Dependencies
Resource types
Privileges
Role templates
Routes
Configuration
Persistence
Jobs
Events
Integrations
AI tasks
Usage
Commercial contribution
Data governance
Operational requirements
```

---

# 156. Machine-Readable Manifest Is Canonical for Composition

Narrative documentation explains semantics.

The Manifest drives machine composition.

Generated module catalogs should derive from Manifest data where practical.

---

# 157. AGENTS.md Enforces Module-Specific Rules

A module may include:

```text
modules/<module>/AGENTS.md
```

It translates architecture into immediate implementation rules.

It may add stricter domain-specific requirements.

It must not weaken platform architecture.

---

# 158. Legacy Modules Migrate Incrementally

Existing FAPA code may temporarily violate target module boundaries.

Migration should:

- identify canonical owner;
- isolate reusable capabilities;
- introduce public contracts;
- move persistence into ownership boundary;
- eliminate direct provider/model calls;
- eliminate cross-module table access;
- retain behavior through characterization tests.

---

# 159. Legacy Is Not the Target Contract

Existing route names, table layouts, file paths, or internal service shapes must not automatically become new platform contracts merely because they already exist.

Target architecture governs new code.

---

# 160. Final Module Rule

The module architecture follows these rules:

```text
A module owns one business domain.

Platform capabilities remain reusable and domain-neutral.

Code presence is not installation.

Installation is not tenant enablement.

Tenant enablement is not authorization.

Module Instance is optional and explicitly declared.

Every module has one typed declarative Manifest.

Required and optional dependencies are different.

Optional capability means genuinely optional.

Cross-module access uses public contracts.

Private source and private tables never cross module boundaries.

Business-module hard dependencies are exceptional.

Routes are logical; physical URLs belong to deployment.

Persistence is module-owned.

Migrations are module-owned.

Disablement never means data deletion.

Uninstallation never implies purge.

Authorization vocabulary may be declared by modules.

Authorization semantics remain entirely in Authority.

Modules never interpret ALL.

Modules never interpret CRUD 0/w/1.

Resource Fact Resolvers provide facts, never decisions.

Role Templates may be contributed; Authority owns Role assignments.

Module upgrades must not silently broaden authority.

Events describe completed facts.

Critical events are durable.

Jobs have explicit ownership, retry, idempotency, and disablement policy.

Provider behavior stays behind adapters.

Unknown external results use Reconciliation.

Documents use Document Core.

RAG uses shared Knowledge infrastructure.

AI calls use semantic Router tasks.

Modules never select models directly.

Notifications use Notification Core.

Generic support uses Ticketing Core.

Usage is measured centrally.

Admission decisions are centralized.

Commercial transactions and module fulfillment remain separate.

Data egress obeys Data Governance.

Observability is structured and shared.

Module architecture is enforced through tests.
```

The default module-design question is:

> **What business meaning does this module uniquely own, which shared capabilities does it consume, what contracts does it expose, what contributions does it register, and can it be installed, enabled, disabled, upgraded, or absent without violating another module's ownership?**
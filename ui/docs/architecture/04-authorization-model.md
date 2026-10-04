# Targoman AI Platform — Authorization Model

**Document:** `docs/architecture/04-authorization-model.md`  
**Version:** 0.1  
**Status:** Proposed Architecture  
**Depends on:**

- `00-manifest.md`
- `01-system-architecture.md`
- `02-engineering-conventions.md`
- `03-persistence-and-database.md`

---

# 1. Purpose

This document defines the identity and authorization architecture of the **Targoman AI Platform**.

It specifies:

- identity classes;
- human and machine identities;
- tenant membership;
- authentication context;
- interactive sessions;
- federation and provisioning;
- hierarchical privilege trees;
- `ALL` wildcard semantics;
- typed privilege values;
- canonical authorization helper functions;
- owner-aware CRUD privilege semantics;
- permissions;
- roles;
- groups;
- organizational scopes;
- temporal and scheduled role assignments;
- Scoped RBAC;
- ABAC;
- Resource ACL;
- instance roles;
- privilege digestion;
- resource facts;
- authorization requests;
- authorization decisions;
- list and retrieval authorization;
- classification and clearance;
- ownership;
- explicit grants and denials;
- delegation;
- break-glass access;
- authorization caching and invalidation;
- suspension, termination, and offboarding;
- audit;
- database/RLS interaction;
- frontend behavior;
- testing and enforcement.

The central invariant is:

> **Authority is the sole canonical owner and evaluator of authorization semantics.**

---

# 2. Authority Is the Only Authorization Decision Engine

No business module, controller, Worker, frontend component, database routine, integration adapter, or provider adapter may independently decide whether an identity is authorized.

The valid flow is:

```text
Caller / Application
        ↓
Authorization Request
        ↓
Authority
        ↓
Authorization Decision
```

Business modules may define authorization vocabulary and provide factual information.

They must not implement authorization policy.

---

# 3. Modules Define Vocabulary; Authority Defines Meaning

A business module may declare:

- resource types;
- operations;
- permission identifiers;
- role templates;
- instance-role templates;
- factual resource attributes;
- ownership relationships;
- organization relationships relevant to its resources.

For example, Secretariat may declare:

```text
secretariat.letter.discover
secretariat.letter.read
secretariat.letter.download
secretariat.letter.use
secretariat.letter.quote
secretariat.letter.manage
```

Secretariat must not decide who receives those permissions.

Authority owns:

- assignment;
- inheritance;
- privilege digestion;
- scope evaluation;
- ACL evaluation;
- deny precedence;
- classification/clearance policy;
- ownership policy;
- final decision.

---

# 4. Authorization Is Default-Deny

Absence of an applicable grant means denial.

Authority must never infer permission from:

- missing configuration;
- unknown role;
- unknown scope;
- missing resource facts;
- unresolved classification;
- incomplete identity context.

Security-sensitive uncertainty fails closed.

---

# 5. Authentication and Authorization Are Separate

Authentication establishes:

> Which identity is presenting this credential?

Authorization determines:

> What may that identity do in this context?

An authenticated identity may still have no authority to perform an operation.

---

# 6. Canonical Identity

Authority uses a common canonical Identity concept.

Conceptually:

```text
Identity
├── Human User
├── Service Account
├── API Client
├── Platform Service
└── Integration Identity
```

Authorization assignments target canonical identities or canonical subject groups rather than application-specific user representations.

---

# 7. Identity IDs Are Stable

Every identity has an immutable canonical identity ID.

Conceptually:

```ts
type typIdentityId =
  string & { readonly __brand: 'IdentityId' };
```

Human-user IDs and service-account IDs may exist as subtype-specific identities but do not replace the canonical authorization identity.

---

# 8. Human Users

A Human User represents an interactive person.

A user may:

- belong to multiple tenants;
- belong to organizational units;
- belong to groups;
- hold roles;
- receive explicit grants or denials;
- create tenant-bound interactive sessions.

---

# 9. Machine Identities

Machine identities are first-class identities.

Examples:

```text
Service Account
API Client
Platform Service
Integration Identity
```

They must not be represented by fake human-user records.

Machine identity lifecycle includes:

- creation;
- owner;
- tenant or deployment scope;
- credential issuance;
- expiration where applicable;
- rotation;
- suspension;
- revocation;
- deletion/retirement;
- audit.

---

# 10. Machine Authentication Does Not Require Human Sessions

A machine identity may authenticate through mechanisms such as:

- API key;
- OAuth-style client credential;
- signed token;
- mTLS identity;
- another approved machine credential.

A machine authorization context may therefore have no interactive `sessionId`.

This does not weaken authorization.

Every machine request still carries an explicit Authority context.

---

# 11. Identity Scope Is Explicit

An identity may be:

```text
Tenant-scoped
Deployment-scoped
```

Tenant scope is the default for ordinary application identities.

Deployment-scoped identities are reserved for explicitly defined platform operations.

Missing tenant context must never silently create deployment-wide authority.

---

# 12. Cross-Tenant Authority Is Exceptional

Cross-tenant operations require an explicit Authority contract.

Examples may include:

- platform administration;
- infrastructure maintenance;
- controlled migration;
- approved support operations.

Cross-tenant authority must never result merely from:

```text
tenantId = undefined
```

---

# 13. Tenant Membership Is an Authorization Fact

Membership connects an identity to a tenant.

Membership may carry factual attributes such as:

- status;
- organization-unit membership;
- tenant-specific clearance;
- tenant-specific identity metadata.

Membership itself does not automatically grant all tenant permissions.

---

# 14. Identity Federation

Enterprise authentication may use:

```text
OIDC
SAML
LDAP / Active Directory
```

External identity providers establish authentication or identity facts.

They do not become application authorization engines.

---

# 15. External Claims Are Normalized

Business modules must never implement:

```ts
if (oidc.groups.includes('Managers')) { ... }
```

or:

```ts
if (samlRole === 'admin') { ... }
```

External claims first pass through the identity/Authority mapping boundary.

The normalized platform identity then participates in ordinary Authority evaluation.

---

# 16. SCIM and Provisioning

Provisioning integrations such as SCIM may:

- create identities;
- update profiles;
- suspend identities;
- synchronize groups;
- synchronize organizational membership.

Provisioning changes factual identity state.

It does not independently decide application permissions.

---

# 17. Interactive Session Model

An interactive human authorization session belongs to exactly one active tenant.

Flow:

```text
Human Identity
      ↓
Authentication
      ↓
Tenant Selection
      ↓
Tenant-Bound Session
      ↓
Privilege Digest
      ↓
Short-Lived Access Token
```

---

# 18. Tenant Switching Creates New Authorization Context

Switching tenant does not merge tenant privileges.

Instead:

```text
Current Global Authentication
        ↓
Select Tenant B
        ↓
Resolve Tenant-B Membership
        ↓
Build Tenant-B Privilege Digest
        ↓
Issue Tenant-B Authorization Context
```

Privileges from Tenant A must not remain active in Tenant B.

---

# 19. Access Tokens Are Authorization Caches, Not Authority

A token may carry a privilege digest.

The token is not the canonical owner of authorization semantics.

Conceptually it may carry:

```text
identity
tenant
session
privilege digest
authorization version
issued time
expiry
```

Authority remains responsible for interpreting the digest together with current resource and policy facts.

---

# 20. Resource-Level Decisions Must Not Use JWT Privileges Directly

Forbidden outside Authority:

```ts
if (token.privs.includes(
  enuPermission.DOCUMENT_READ
)) {
  allow();
}
```

Required:

```ts
const decision =
  await authorizationService.authorize(request);
```

The token is one Authority input.

It is never the business module's decision engine.

---

# 21. Permissions Are Explicit Operations

Permissions identify an allowed operation over a resource domain.

Preferred form:

```text
<domain>.<resource>.<operation>
```

Examples:

```text
document.asset.download
ticket.ticket.manage
widget.instance.manage
secretariat.letter.read
secretariat.letter.use
```

Permission identifiers are stable machine contracts.

---

# 22. Permission IDs Are Namespaced

Modules and platform capabilities must register permission identifiers through explicit manifests/contracts.

Permission namespaces prevent accidental collision.

Released permission identifiers must not silently change meaning.

---

## 22.1 Privileges Form a Hierarchical Tree

The canonical privilege representation supports hierarchical paths.

For example:

```text
secretariat
secretariat.letter
secretariat.letter.read
secretariat.letter.download

widget
widget.instance
widget.instance.manage
```

Privilege paths are canonical identifiers registered in the Authority privilege catalog.

Runtime code must not invent arbitrary privilege paths.

The privilege tree may contain:

- Boolean grants;
- structured privilege decisions;
- typed values;
- the reserved `ALL` node.

---

## 22.2 `ALL` Is a Reserved Hierarchical Wildcard

`ALL` has special Authority semantics.

At the root:

```json
{
  "ALL": true
}
```

grants every registered privilege path within the current authorization scope.

At an internal node:

```json
{
  "secretariat": {
    "ALL": true
  }
}
```

grants descendant privileges such as:

```text
secretariat.letter.read
secretariat.letter.download
secretariat.connector.manage
```

but does not grant:

```text
crm.customer.read
widget.instance.manage
```

Therefore `ALL` is ancestor-aware.

An `ALL` value affects its own subtree only.

---

## 22.3 `ALL` Is Powerful but Not Boundary-Free

`ALL` is a privilege wildcard.

It does not bypass:

- identity disablement;
- identity termination;
- tenant boundaries;
- deployment boundaries;
- module enablement;
- assignment validity or schedule;
- first-class explicit denial;
- required authentication strength;
- non-overridable security policy;
- Data Governance / egress policy.

In particular:

```text
Tenant A + ALL
```

does not imply:

```text
Tenant B access
```

and:

```text
secretariat.ALL
```

does not imply:

```text
commercial.ALL
```

Applicable first-class explicit denial is evaluated before wildcard grants.

---

## 22.4 Privileges May Carry Values

Not every privilege is Boolean.

A privilege leaf may carry a typed value.

Examples:

```json
{
  "session": {
    "maxActive": 5
  },
  "ticketing": {
    "review": {
      "groups": ["legal", "finance"]
    }
  },
  "ai": {
    "maxDailyTokens": 500000
  }
}
```

Supported privilege-value shapes may include:

- Boolean;
- integer;
- decimal-safe numeric representation where appropriate;
- string;
- enum value;
- list;
- explicitly defined structured value.

Every value-bearing privilege path must have a registered schema and semantic type.

Arbitrary untyped JSON values are not accepted merely because the privilege tree is represented using JSON.

---

## 22.5 Boolean Privilege and Privilege Value Are Different Operations

These questions are different:

```text
Does the subject have this privilege?
```

and:

```text
What value is configured for this privilege?
```

Authority therefore provides distinct kernel operations.

Conceptually:

```ts
hasPriv(privs, path): boolean

getPrivValue<T>(
  privs,
  path,
  allDefault?
): T | undefined
```

`hasPriv` must not treat arbitrary non-empty values as Boolean permission.

`getPrivValue` returns the registered/raw typed value without implicit coercion.

Missing value returns:

```text
undefined
```

unless the typed privilege contract defines another explicit semantic result.

---

## 22.6 Value Lookup Under `ALL`

Value-bearing privileges require an explicit semantic result when their path is covered by `ALL`.

The canonical low-level lookup follows Sepidjoo-compatible behavior:

```ts
getPrivValue(
  privs,
  path,
  allDefault
)
```

When an applicable root or ancestor `ALL === true` covers the requested path, the lookup returns:

```text
allDefault
```

rather than inventing a value.

Example:

```ts
getPrivValue(
  privs,
  'session.maxActive',
  null
)
```

may use:

```text
null = unlimited
```

when covered by `ALL`, if that exact meaning is declared by the typed privilege contract.

Another privilege may define:

```text
ALL default = 1000000
```

or:

```text
ALL default = all registered groups
```

The meaning of `ALL` for a value-bearing privilege must therefore be explicitly defined by that privilege's catalog entry or typed helper.

It must never be guessed.

---

## 22.7 Canonical Authorization Helpers

The Authority capability owns one canonical implementation of privilege-tree interpretation.

Internal Authority helpers include, as applicable:

```text
hasPriv
getPrivValue
getUserPrivValue
evaluateCRUD
isAdmin
resolvePrivilege
digestPrivileges
```

Application-facing Authority contracts include:

```text
authorize
authorizeBatch
buildQueryConstraint
```

The low-level helpers:

- understand hierarchical `ALL`;
- validate privilege paths;
- validate privilege-value schemas;
- implement CRUD semantics;
- fail closed on malformed privilege values.

Business modules must not implement local equivalents of these functions.

Business modules normally consume:

```text
authorize(...)
```

rather than directly traversing `privs`.

---

## 22.8 `isAdmin` Is Derived, Not a Parallel Authority System

An `isAdmin` helper may exist for Authority-internal or presentation-oriented use.

It must resolve through canonical privilege semantics.

It must not introduce logic such as:

```ts
identityId === 1
```

or:

```ts
roleName === 'admin'
```

as a separate authorization mechanism.

Root `ALL` may satisfy administrator privilege semantics where policy defines it.

Actual protected operations must still pass through Authority.

---

## 22.9 Owner-Aware CRUD Uses `0`, `w`, and `1`

Where a resource domain uses CRUD-style privilege evaluation, the canonical privilege value is:

```text
[01w]{4}
```

in:

```text
C / R / U / D
```

order.

Each position has three possible meanings:

```text
0
    denied

w
    allowed only when the applicable ownership condition is satisfied

1
    allowed regardless of ownership, subject to all other Authority constraints
```

Example:

```text
0w10
```

means:

```text
Create → denied
Read   → own resources only
Update → allowed
Delete → denied
```

The owning business module supplies ownership facts.

Authority evaluates `w`.

The business module must not evaluate ownership permission itself.

Missing ownership evidence for a `w` decision fails closed.

---

## 22.10 `ALL` and CRUD

An applicable `ALL` wildcard satisfies CRUD capability as:

```text
1111
```

within the covered privilege subtree and authorization scope.

This does not bypass:

- explicit denial;
- tenant boundaries;
- resource classification;
- authentication-strength requirements;
- schedule constraints;
- hard security policy.

Legacy numeric CRUD masks in the range:

```text
0..15
```

may be accepted only by an explicit compatibility adapter during migration.

Canonical target representation is:

```text
[01w]{4}
```

Numeric CRUD masks must not remain the new authoritative format.

---

# 23. Resource Types Are Explicit

Authorization operates over explicit resource types.

Examples:

```text
document
document.asset
ticket
widget.instance
secretariat.letter
letter.draft
followup.task
commercial.order
```

A resource type has one canonical owner.

---

# 24. Resource References Are Stable

Authorization resources use stable identity.

Conceptually:

```ts
interface intfAuthorizationResourceRef {
  resourceType: enuResourceType;
  resourceId: string;
}
```

Cross-module authorization must not depend on direct table access.

---

# 25. Authorization Request

A single-resource authorization request conceptually contains:

```ts
interface intfAuthorizationRequest {
  tenantId: typTenantId;
  actorIdentityId: typIdentityId;

  operation: enuPermissionOperation;

  resource:
    intfAuthorizationResourceRef;

  context:
    intfAuthorizationContext;
}
```

The concrete contract must use named strict types.

---

# 26. Authorization Context

Authorization context may include:

```text
deployment
tenant
actor identity
identity type
session
authentication strength
authorization version
request / correlation ID
delegation context
break-glass context
```

Context is explicit.

Ambient global authorization context is prohibited.

---

# 27. Authorization Decision

Authority returns an explicit decision.

Conceptually:

```ts
interface intfAuthorizationDecision {
  decision: enuAuthorizationDecision;
  reason: enuAuthorizationReason;

  policyVersion: number;
  evaluatedAt: string;
}
```

Where:

```ts
enum enuAuthorizationDecision {
  ALLOW = 'allow',
  DENY = 'deny',
}
```

---

# 28. Decision Reasons Are Stable

Internal Authority decisions should use stable reason codes.

Examples:

```text
ALLOW_EXPLICIT_GRANT
ALLOW_ROLE_GRANT
ALLOW_ACL
ALLOW_OWNER_POLICY
ALLOW_BREAK_GLASS

DENY_NO_GRANT
DENY_EXPLICIT
DENY_TENANT_MISMATCH
DENY_MODULE_DISABLED
DENY_SCOPE
DENY_ACL
DENY_CLASSIFICATION
DENY_AUTH_STRENGTH
DENY_RESOURCE_FACTS_UNAVAILABLE
DENY_IDENTITY_DISABLED
DENY_SESSION_INVALID
```

External API responses need not expose sensitive internal reason detail.

---

# 29. Authorization Uses Multiple Inputs

The final decision may combine:

```text
Identity
+
Tenant Membership
+
Groups
+
Role Assignments
+
Explicit Grants / Denials
+
Scope
+
Resource ACL
+
Resource Facts
+
Classification / Clearance
+
ABAC Policy
+
Authentication Strength
+
Break-Glass Policy
```

No single input automatically grants authority.

---

# 30. Scoped RBAC Is the Administrative Foundation

Roles provide understandable administrative grouping.

Examples:

```text
TenantAdmin
DepartmentManager
SecretariatOperator
WidgetBeneficiaryAdmin
TicketOperator
```

A role is a template or collection of permissions.

It is not a hard-coded application branch.

---

# 31. Modules May Define Role Templates

A module may publish a role template such as:

```text
WidgetBeneficiaryAdmin
    → widget.instance.read
    → widget.analytics.read
    → widget.documents.manage
    → widget.operators.manage
```

Authority owns:

- assignment;
- scope;
- expiration;
- grant/deny combination;
- evaluation.

---

# 32. Role Names Are Never Authorization Logic

Forbidden:

```ts
if (user.role === enuRole.TENANT_ADMIN) {
  ...
}
```

outside Authority.

Even if an application knows a role exists for display or administration, it must request a decision from Authority.

---

# 33. Role Assignment Is Scoped

A role assignment applies within an explicit scope.

Possible scopes include:

```text
Deployment
Tenant
Organization Unit
Organization Subtree
Module
Application Instance
Resource
```

The same identity may hold the same role in different scopes.

---

## 33.1 Role Assignment May Be Temporally Bounded

A role assignment may define absolute validity.

Conceptually:

```text
validFrom
validUntil
```

Examples:

```text
Role becomes active on 2026-10-01.
Role expires on 2026-12-31.
```

An expired role contributes no effective privileges.

Role expiry is evaluated by Authority.

Business modules must not implement role-expiry checks.

---

## 33.2 Role Assignment May Use a Recurring Schedule

A role assignment may be active only during recurring time windows.

Examples include:

```text
Every day except Friday
08:00 → 16:00
```

or:

```text
Selected weekdays
05:00 → 10:00
```

or an explicitly defined odd/even civil-date rule.

A recurring schedule must define:

- timezone;
- calendar when calendar-sensitive rules are used;
- included weekdays or calendar predicates;
- local start time;
- local end time;
- optional effective-from date;
- optional effective-until date;
- optional exclusion dates;
- optional explicit exception dates.

---

## 33.3 Schedule Semantics Are Explicit

Time windows use explicit boundary semantics.

The default interval is:

```text
[start, end)
```

meaning:

```text
start is inclusive
end is exclusive
```

Recurring schedules use an explicit IANA timezone.

Example:

```text
Asia/Tehran
```

If a rule depends on a Jalali date property, such as an odd/even day-of-month rule, it must explicitly declare:

```text
calendar = JALALI
```

Calendar conversion uses the shared Calendar capability.

Authority evaluation operates on an explicit current instant.

Wall-clock time must never be obtained implicitly inside the pure authorization kernel.

---

## 33.4 Timed Roles Must Remain Correct With JWT Privilege Digests

A timed role must not be flattened into an unconditional privilege that remains valid for the full Access Token lifetime.

One of the following safe models must be used:

```text
Temporal condition remains in the privilege digest
and Authority evaluates it for every decision
```

or:

```text
Access Token expiry is bounded by the next authority-transition time
```

or another explicitly approved mechanism with equivalent semantics.

For example, a support role valid until:

```text
16:00
```

must not remain usable until:

```text
16:14
```

merely because a 15-minute Access Token was issued at 15:59.

Likewise, activation of a scheduled role must not depend on undefined token-refresh behavior.

---

## 33.5 Temporal Constraints May Apply Beyond Roles

Where required, the same temporal model may constrain:

- direct grants;
- explicit denials;
- group memberships;
- delegation;
- instance-role assignments;
- break-glass authority.

Authority remains the sole evaluator of these temporal constraints.

---

# 34. Scope Is a First-Class Concept

Scope expresses where a grant or role applies.

Conceptually:

```text
Tenant A

Organization: Finance
    └── descendants

Widget Instance #27

Secretariat Letter #123
```

Scope semantics belong to Authority.

---

# 35. Organization Hierarchy May Produce Inherited Scope

An organizational hierarchy may allow a manager to inherit authority over descendant units where tenant policy permits.

Example:

```text
Head Office
├── Finance
│   ├── Treasury
│   └── Accounting
└── Legal
```

A Finance manager may receive a Finance-subtree grant.

The business module must not implement descendant evaluation itself.

---

## 35.1 Hierarchical Scope Is Monotonic by Default

Organizational hierarchy has monotonic scope semantics by default.

For equivalent inherited authority:

```text
child scope ⊆ parent scope
```

and the authority inherited solely through hierarchy at a lower node must be:

```text
less than or equal to
```

the corresponding authority available from its parent hierarchy.

Moving downward in the hierarchy must never implicitly create broader authority.

Example:

```text
Organization
└── Finance
    └── Treasury
```

If the same Manager role is assigned at:

```text
Organization
```

its possible resource scope may cover the whole organizational subtree.

The same role assigned at:

```text
Finance
```

is limited to Finance and its descendants.

The same role assigned at:

```text
Treasury
```

is narrower again.

---

## 35.2 Lower Hierarchy May Gain Additional Authority Only Explicitly

A lower organizational level may have additional authority only through an explicit assignment.

Examples include:

- an additional Role assigned at that organizational node;
- an Instance Role;
- an explicit grant to a specific identity;
- an explicit grant to a group;
- a resource ACL grant.

Therefore:

```text
inherited lower-level authority
    ≤
inherited parent authority
```

unless:

```text
an explicit additional assignment exists
```

The additional assignment must be independently:

- visible;
- scoped;
- auditable;
- revocable;
- subject to normal deny and policy rules.

---

## 35.3 Hierarchy Does Not Imply Reverse Access

Authority flowing over a parent subtree does not imply that a child identity gains authority over its parent.

For example:

```text
Finance manager
```

does not automatically receive:

```text
Head Office administration
```

because Finance is a descendant of Head Office.

Scope inheritance follows the declared authorization direction only.

---

## 35.4 Privilege Hierarchy and Organization Hierarchy Are Different

Two independent hierarchies exist:

```text
Privilege tree hierarchy
    → path inheritance / ALL

Organization hierarchy
    → resource scope containment
```

They must not be conflated.

For example:

```text
secretariat.ALL
```

describes privilege-path coverage.

While:

```text
Finance subtree
```

describes resource scope.

The effective result combines both dimensions through Authority.

---

# 36. Hierarchical Grant Does Not Override Explicit Restrictions

Organizational inheritance is a possible grant source.

It does not override:

- explicit deny;
- resource ACL restriction;
- classification requirements;
- hard tenant policy;
- Data Governance restrictions.

---

# 37. Groups Are Authorization Subjects

Authority may support groups as assignment targets.

A group may receive:

- roles;
- grants;
- denials;
- scope.

Identity membership in a group contributes to privilege digestion.

---

# 38. Group Membership Is Factual State

Groups do not become independent authorization engines.

Authority owns the semantics of how group membership contributes to effective authority.

External-directory groups must be normalized before use.

---

# 39. Explicit Grants

Authority may assign an explicit permission grant directly to:

- an identity;
- a group;
- another supported canonical subject.

The grant has explicit scope.

It may also have validity bounds.

---

# 40. Explicit Denials

Authority supports explicit denial.

Denial is useful for exceptions such as:

```text
Department Manager
    normally reads department documents

BUT

Document #901
    explicitly denied
```

---

# 41. Explicit Deny Normally Wins

Unless an explicit higher-order Authority policy such as approved break-glass defines otherwise:

> **Applicable explicit deny takes precedence over ordinary grants.**

This prevents broad inherited authority from defeating intentional resource restrictions.

---

# 42. Default Grant Precedence

The ordinary evaluation model is:

```text
Hard Boundary Failure
      → DENY

Applicable Explicit Deny
      → DENY

No Applicable Grant
      → DENY

Applicable Grant
      ↓
Mandatory ABAC / Classification / ACL Constraints
      ↓
ALLOW or DENY
```

A positive grant does not bypass mandatory constraints.

---

# 43. ABAC Adds Contextual Constraints

Attribute-Based Access Control may use factual attributes from:

```text
Identity
Membership
Resource
Organization
Environment
Authentication Context
```

Examples:

```text
resource classification
resource organization
resource owner
identity clearance
authentication strength
tenant policy
resource state
```

---

# 44. ABAC Policy Belongs to Authority

A business module may expose:

```text
classification = confidential
owner = identity-17
organization = legal
```

It must not execute:

```ts
if (
  user.clearance >=
  resource.classification
) {
  allow();
}
```

Authority converts facts into decisions.

---

# 45. Resource Facts

Authority may require factual information from the resource owner.

A module provides facts through an explicit Resource Facts Resolver.

Conceptually:

```ts
interface intfAuthorizationResourceFacts {
  resourceType: enuResourceType;
  resourceId: string;

  tenantId: typTenantId;

  ownerIdentityId?: typIdentityId;
  organizationUnitId?: typOrganizationUnitId;
  classificationId?: typClassificationId;

  attributes:
    Readonly<Record<string, unknown>>;
}
```

The exact contract must remain strongly typed where domain attributes are known.

---

# 46. Resource Facts Are Not Decisions

A resolver answers:

> What is true about this resource?

It does not answer:

> May this identity access this resource?

This distinction is mandatory.

---

# 47. Missing Required Resource Facts Fail Closed

If Authority requires an attribute to make a security-sensitive decision and that fact cannot be resolved, the operation is denied or explicitly unresolved.

It must not receive a permissive default.

---

# 48. Ownership Is an Attribute, Not an Automatic Grant

This is invalid as universal platform logic:

```text
owner == caller
→ allow
```

Ownership grants authority only when an Authority policy explicitly defines an owner-based permission rule.

---

# 49. Security Classification Is a Constraint, Not a Grant

Classification alone does not grant access.

For example:

```text
clearance >= classification
```

is insufficient by itself.

The identity must also have an applicable operation grant.

---

# 50. Classification Is Tenant-Configurable

Tenants may define classification models.

Default examples may include:

```text
Public
Internal
Restricted
Confidential
Highly Confidential
```

Authority operates on canonical classification entities and policy, not hard-coded string ordering.

---

# 51. Clearance Is Tenant-Specific

An identity may have different clearance in different tenants.

Clearance must therefore be resolved within active tenant context.

Global human identity does not imply global clearance.

---

# 52. Resource ACL Is Resource-Specific Authority Data

Resource ACL supports exceptional resource-level access.

An ACL may contain:

- explicit grants;
- explicit denials;
- subject references;
- operation sets;
- validity bounds.

ACL evaluation belongs exclusively to Authority.

---

# 53. ACL Does Not Replace RBAC

ACL complements broad role/scope authority.

Typical model:

```text
Scoped RBAC
    → broad capability

ACL
    → resource-specific exception
```

Both participate in one Authority decision.

---

# 54. ACL Cannot Bypass Hard Security Policy

An ACL grant does not automatically override:

- tenant boundary;
- disabled identity;
- classification policy;
- required authentication strength;
- non-overridable security policy.

---

# 55. Application and Instance Roles

Some roles apply to a specific application instance.

Example:

```text
Widget #27
    beneficiary admin = Identity A
```

The assignment applies only to:

```text
widget.instance = 27
```

It does not create platform-wide admin authority.

---

# 56. Module Enabled State Is Not Authorization

The following are separate:

```text
Module Installed
Tenant Enabled
Identity Authorized
```

A module being enabled for the tenant does not grant a user permission.

Likewise, authorization cannot activate a module that is not enabled.

---

# 57. Entitlement Is Not Authorization

Commercial or contractual entitlement answers:

> Is this service available to this customer or identity?

Authorization answers:

> May this identity perform this operation?

These concerns may both gate an operation but remain separate canonical decisions.

---

# 58. Admission Control Is Not Authorization

Admission Control answers questions such as:

```text
Has quota been exhausted?
Is concurrency available?
Is capacity available?
```

Authority answers access-control questions.

A caller may be:

```text
AUTHORIZED
but
QUOTA_EXCEEDED
```

These outcomes must not be conflated.

---

# 59. Data Governance Is Not Authorization

Authority may allow:

```text
document.read
```

while Data Governance denies:

```text
send document to external AI provider
```

Local access authority does not imply data-egress authority.


This includes grants derived from:

- Role;
- Group;
- organizational inheritance;
- root `ALL`;
- internal-node `ALL`;
- direct privilege grants.

`ALL` is therefore not a mechanism for defeating a deliberate first-class denial.

---

# 60. Privilege Digestion

Privilege digestion computes tenant-scoped effective authorization material from relatively stable inputs.

Possible inputs include:

- tenant membership;
- organization membership;
- groups;
- role assignments;
- instance-role assignments;
- explicit grants;
- explicit denials;
- scope relationships;
- hierarchical privilege trees;
- root and internal-node `ALL`;
- typed privilege values;
- temporal role/grant conditions;
- applicable policies.


The digest must use the canonical privilege catalog and canonical Authority helper semantics.

Malformed privilege paths or values must be rejected rather than silently normalized into authority.

---

# 61. Privilege Digest Is an Optimization

The digest may be carried in a short-lived Access Token.

It is designed to reduce repeated resolution of stable membership and role relationships.

It does not include all dynamic resource decisions.

Where temporal assignments are included, the digest must preserve enough information to enforce their active windows correctly.

The digest must not turn a scheduled role into an unconditional grant.

---

# 62. Resource ACL and Dynamic Facts Are Normally Evaluated at Decision Time

A token must not be treated as a complete snapshot of:

- every resource ACL;
- every resource owner;
- every classification;
- every resource state.

Those facts may change independently of token issuance.

---

# 63. Authorization Versioning

Authority should maintain a version or equivalent invalidation identity for privilege material.

Changes such as:

- membership change;
- role assignment;
- group membership;
- grant/deny change;
- identity suspension;
- identity termination;
- role validity or schedule change;
- hierarchy change affecting scope;
- security-policy change

may invalidate previously digested authority.

---

# 64. Stale Authorization Must Have a Bounded Lifetime

Short-lived Access Tokens place a hard bound on stale privilege material.

Sensitive deployments may additionally require more aggressive invalidation mechanisms.

Possible mechanisms include:

- session authorization version;
- tenant/identity authorization version;
- cache invalidation event;
- sensitive-operation fresh evaluation.

The exact mechanism must preserve horizontal scalability.

---

# 65. Cached Authorization Is Never the Canonical Owner

Authority may cache:

- privilege digests;
- organization trees;
- policy definitions;
- normalized memberships;
- bounded decisions.

Cache failure or eviction must not change semantics.

---

# 66. Unsafe Stale Allow Is Prohibited

Caching must be designed so stale positive authorization cannot persist beyond the approved security window.

High-risk operations may require fresher policy state than ordinary reads.

---

# 67. Single-Resource Authorization

Single-resource operations use a normal Authority decision.

Example:

```text
READ Document #123
        ↓
resolve facts
        ↓
Authority
        ↓
ALLOW / DENY
```

---

# 68. List Authorization Must Not Become N+1 Authorization

List operations must not normally perform:

```text
fetch 10,000 rows
    ↓
call Authority 10,000 times
    ↓
discard unauthorized rows
```

This is inefficient and may expose unauthorized data beyond the authorized retrieval boundary.

---

# 69. Authority Produces Retrieval Constraints

For collection/list/search operations, Authority may produce a typed semantic constraint set.

Conceptually:

```ts
interface intfAuthorizationQueryConstraint {
  tenantId: typTenantId;
  operation: enuPermissionOperation;

  allowedScopes: readonly typScopeId[];
  allowedResourceIds?: readonly string[];
  deniedResourceIds?: readonly string[];

  policyVersion: number;
}
```

The final contract may include other typed constraints.

---

# 70. Authority Does Not Generate SQL

Authority owns authorization semantics.

Persistence owns SQL.

Therefore:

```text
Authority
    → semantic authorization constraints

Persistence
    → SQL representation of those constraints
```

Authority must not return arbitrary SQL fragments.

---

# 71. Persistence Must Not Reinterpret Constraints

Persistence may translate Authority constraints into:

- SQL predicates;
- joins;
- parameter sets;
- RLS-compatible context.

It must not independently decide whether a constraint should apply.

---

# 72. Authorized Filtering Happens Before Result Materialization

For list/search operations:

```text
Authorization Context
        ↓
Authority Constraints
        ↓
Persistence Query
        ↓
Authorized Rows
```

Unauthorized rows must not be loaded into ordinary application results and filtered afterward.

---

# 73. RAG Uses the Same Principle

RAG authorization follows:

```text
Question
    ↓
Requested Operation
    ↓
Authority
    ↓
Authorized Knowledge Constraint
    ↓
Qdrant Retrieval
    ↓
LLM
```

The model must not receive unauthorized chunks and rely on answer filtering afterward.

---

# 74. `discover`, `read`, `download`, `use`, `quote`, and `manage` Are Independent

Document-like resources may distinguish at least:

```text
discover
read
download
use
quote
manage
```

Example:

```text
discover = false
read     = false
download = false
use      = true
quote    = false
```

is a valid authorization state.

---

# 75. `use` Does Not Imply Disclosure

When `use` is allowed but `read` is denied, AI or another controlled computation may consume the information without exposing the underlying resource.

The downstream system must respect `quote` and disclosure constraints.

---

# 76. Batch Authorization

Authority may support batch authorization for bounded sets of already-known resource references.

Batch authorization is useful for:

- action buttons;
- dashboard cards;
- bounded result enrichment;
- administrative tools.

Batch authorization does not replace pre-retrieval constraints for large collections.

---

# 77. Delegation Is Explicit

When one identity acts on behalf of another, both identities must remain visible.

Conceptually:

```text
Actor Identity
    → performs request

Initiating / Delegated Identity
    → business origin
```

The platform must never overwrite the actual actor identity with the represented identity.

---

# 78. Worker Execution Preserves Origin

Background work may execute under a Platform Service identity.

It should also preserve, where applicable:

- initiating identity;
- tenant;
- original request;
- originating session;
- authorization snapshot/version.

Audit must distinguish execution identity from business initiator.

---

# 79. Impersonation Is Not Ordinary Delegation

Interactive impersonation, if ever supported, requires a dedicated Authority capability.

It must be:

- explicit;
- time-bounded;
- scope-bounded;
- visible to the operator;
- fully audited;
- distinguishable from the represented user.

It must not be implemented by rewriting session identity.

---

# 80. Break-Glass Access

Break-glass exists for exceptional emergency operations.

It is not a permanent administrator role.

A break-glass request contains:

- actor;
- reason;
- target scope;
- requested permissions;
- start;
- expiry;
- authentication evidence;
- required approvals.

---

# 81. Break-Glass Requires Stronger Evidence

Deployment policy may require:

- MFA;
- hardware-backed authentication;
- dual approval;
- restricted network origin;
- incident/ticket reference.

Authority validates these conditions.

---

# 82. Break-Glass Is Time-Bounded

Emergency authority must expire automatically.

It must not depend on an administrator remembering to revoke it.

---

# 83. Break-Glass Does Not Erase Denial History

The decision must record that authority came from a break-glass policy.

Sensitive break-glass actions should produce high-priority security audit events.

---

# 84. Some Policies May Be Non-Overridable

Deployment policy may define hard controls that break-glass cannot override.

Examples may include:

- prohibited cross-tenant data access;
- cryptographic trust requirements;
- legally required restrictions.

Such policy must be explicit.

---

# 85. Authentication Strength May Be an ABAC Input

Authority may require stronger authentication for sensitive operations.

Example:

```text
ordinary read
    → normal authenticated session

break-glass / critical admin
    → recent strong authentication
```

Authentication strength is factual input.

Authority owns the decision.

---

# 86. Authorization Audit

Authority records security-relevant authorization evidence.

Events may include:

- denied access;
- privilege assignment;
- privilege removal;
- group membership affecting authority;
- role assignment;
- ACL change;
- policy change;
- identity suspension;
- machine credential change;
- break-glass request;
- break-glass approval;
- break-glass use.

---

# 87. Not Every Successful Read Requires Permanent High-Volume Audit

Audit policy may distinguish between:

- security-significant successful actions;
- ordinary high-volume reads;
- denied actions;
- administrative mutations.

Audit volume must be intentional.

Security requirements determine what must be retained.

---

# 88. Authorization Audit Must Identify Actor and Context

Where applicable, audit includes:

```text
actor identity
identity type
tenant
session
initiating identity
operation
resource
scope
decision
reason
policy version
request / correlation ID
break-glass context
timestamp
```

---

# 89. Authority Configuration Changes Are Audited

Changes to:

- permissions;
- roles;
- assignments;
- groups;
- grants;
- denials;
- ACL;
- classification policy;
- clearance;
- federation mapping;
- break-glass policy

must be auditable.

---

# 90. PostgreSQL RLS Is Defense in Depth

RLS is not the primary Authority engine.

Its initial primary responsibility is tenant isolation and other simple database-local security invariants.

RLS must not independently recreate:

- role evaluation;
- permission digestion;
- ACL precedence;
- classification logic.

---

# 91. Authority Runs Before Persistence

Normal protected mutation flow is:

```text
Request
    ↓
Authentication
    ↓
Authority
    ↓
Application Service
    ↓
Persistence
    ↓
PostgreSQL
```

Database constraints and RLS remain additional enforcement layers.

---

# 92. Stored Procedures Do Not Authorize Users

A business Stored Procedure may enforce data integrity.

It must not receive:

```text
role = manager
```

and independently decide access.

The application must already have obtained the Authority decision.

---

# 93. Database Execution Context Carries Identity Facts

Persistence context may carry:

```text
tenant
actor identity
identity type
session
initiating identity
request
module
execution source
```

This supports:

- RLS;
- audit;
- diagnostics.

It does not constitute authorization by itself.

---

# 94. Frontend Authorization Is UX Only

The frontend may request a presentation-oriented capability view.

Examples:

```text
canCreateTicket
canManageWidget
canDownloadDocument
```

This may be used to:

- hide buttons;
- disable controls;
- reduce navigation clutter.

It is not authoritative.

---

# 95. Frontend Must Not Interpret Roles

Avoid:

```ts
if (currentUser.role === 'admin') {
  showButton = true;
}
```

Prefer a capability view obtained from the backend/Authority contract.

The backend must still authorize the actual operation.

---

# 96. Resource Existence May Be Confidential

An authorization failure must not always reveal that a resource exists.

API mapping may intentionally return a generic not-found or denied response according to security policy.

Internal Authority reason codes remain available for audit and diagnostics.

---

# 97. Permission Administration Uses Authority APIs

Administrative UIs interact with Authority through explicit application/API contracts.

They must not manipulate privilege tables directly.

The Admin Shell may expose:

- role management;
- group management;
- memberships;
- grants;
- denials;
- ACL management;
- machine identities;
- federation configuration;
- break-glass controls.

---

# 98. Module Permission Registration Is Declarative

Modules register authorization vocabulary through their module manifests or another canonical registration contract.

A module installation may contribute:

- resource types;
- permission IDs;
- role templates;
- instance-role templates;
- fact schemas.

Authority validates registration.

---

# 99. Removing a Permission Is a Migration

A released permission identifier must not disappear silently.

Removal or replacement requires:

- compatibility analysis;
- assignment migration;
- token/digest invalidation;
- administrative migration where applicable.

---

# 100. Authority Is an In-Process Contract by Default

In the initial modular-monolith architecture, Authority is normally called through a typed in-process contract.

Do not introduce REST or gRPC between a business module and Authority merely to simulate service separation.

---

# 101. Authority May Become an Independent Service Later

If scale or topology later requires an independent Authority runtime, the semantic contract remains unchanged.

A network transport such as gRPC may then implement the boundary.

Business modules must not change their authorization semantics.

---

# 102. Authority Availability Is Security-Critical

If Authority cannot make a required authorization decision, protected operations fail closed.

Availability architecture must therefore treat Authority as a critical platform capability.

Caching may improve availability but must not introduce unsafe stale authorization.

---

# 103. Decision Evaluation Must Be Deterministic

Given the same:

- identity facts;
- tenant facts;
- resource facts;
- policy version;
- authorization context;

Authority should produce the same authorization decision.

Time-sensitive policy must receive time explicitly.

This includes:

- role expiry;
- recurring role schedules;
- temporary grants;
- delegation expiry;
- break-glass expiry.

---

# 104. Pure Authorization Kernel

Core evaluation should be implemented as a pure deterministic kernel where practical.

Effects such as:

- persistence;
- resource-fact loading;
- federation lookup;
- clock;
- audit writing

remain outside the pure evaluation kernel.

---

# 105. Evaluation Order Is Explicit

The default conceptual evaluation order is:

```text
1. Validate Identity
2. Validate Credential / Session Context
3. Validate Tenant Boundary
4. Validate Module / Resource Availability
5. Validate Assignment Time / Schedule
6. Resolve Privilege Digest
7. Resolve Hierarchical `ALL` / privilege values
8. Resolve Required Resource Facts
9. Resolve Applicable Organizational Scope
10. Apply Explicit Denials
11. Establish Applicable Grants
12. Evaluate CRUD / owner-aware `w` where applicable
13. Evaluate ACL
14. Evaluate ABAC / Classification Constraints
15. Evaluate Authentication Strength
16. Evaluate Approved Break-Glass Policy if present
17. Produce Decision + Reason
```

Implementation may optimize this order without changing semantics.

---

# 106. Short-Circuiting Is Allowed Only When Semantically Safe

Authority may stop evaluation early when a decisive result is known.

Examples:

```text
identity disabled
→ immediate DENY

tenant mismatch
→ immediate DENY

explicit non-overridable deny
→ immediate DENY
```

Optimization must not alter decision meaning or audit requirements.

---

# 107. Resource Fact Fetching Should Be Minimal

Authority should request only factual data required for the requested operation.

Do not load full resource content merely to authorize access.

Example:

```text
document ID
tenant
owner
org
classification
ACL reference
```

may be sufficient without loading the document body.

---

# 108. Sensitive Resource Facts Are Not Leaked

Authorization callers receive a decision.

They do not automatically receive all resource facts used internally.

Authority and resolvers must avoid turning authorization into a side channel.

---

# 109. Authorization and Data Retrieval Share Correlation

Authorization decisions should carry request/correlation identity through protected retrieval and downstream audit.

This enables end-to-end investigation.

---

# 110. Machine Credential Storage

API keys and similar machine credentials must follow the persistence rules defined in `03-persistence-and-database.md`.

Where verification can use a non-reversible hash, cleartext secret material must not remain recoverable.

---

# 111. API Keys Have Stable Public Identity and Secret Material

A practical API key may conceptually contain:

```text
public key identifier
+
secret material
```

The public identifier locates the credential record.

The secret proves possession.

Logs may contain the non-secret public identifier when policy allows.

They must never contain the secret.

---

# 112. Machine Credentials Are Rotatable

Credential rotation should allow controlled overlap when required.

Rotation must support:

- new credential issuance;
- bounded overlap;
- old credential revocation;
- audit lineage.

---

# 113. Identity Suspension Invalidates Authority

A suspended or disabled identity cannot obtain new authorization decisions.

Applicable sessions or machine credentials must be revoked or rendered ineffective according to the credential model.

---

## 113.1 Identity Lifecycle Distinguishes Suspension and Termination

At minimum, human identity lifecycle must distinguish:

```text
ACTIVE
SUSPENDED
TERMINATED
```

Suspension is potentially reversible.

Termination represents organizational offboarding and requires access shutdown.

Neither operation physically deletes historical identity or audit evidence.

---

## 113.2 Termination Must Cut Access Immediately

Terminating a human user must not rely only on ordinary Access Token expiry.

The termination transaction or workflow must cause:

1. identity state to become non-active;
2. authorization/revocation version to advance;
3. all interactive sessions to be revoked;
4. all Refresh Token families to be revoked;
5. delegated and impersonation contexts to be invalidated;
6. active break-glass authority for that identity to be cancelled;
7. Authority caches and privilege digests to be invalidated;
8. a durable high-priority security/audit event to be generated.

An Access Token issued before termination must no longer be sufficient to obtain an `ALLOW` decision after the termination becomes authoritative.

---

## 113.3 Token Revocation Must Be Horizontally Consistent

Access shutdown must work across replicated API and Authority instances.

The platform may use:

- identity authorization version;
- revocation epoch;
- session version;
- distributed invalidation;
- bounded shared revocation cache;
- another approved equivalent mechanism.

The mechanism must guarantee the configured maximum revocation propagation window.

For terminated identities, that window should be as close to immediate as the deployment reliability architecture supports.

Normal token signature validity does not override revocation state.

---

## 113.4 Offboarding Ends Assignments Without Destroying History

Termination must end or deactivate applicable:

- tenant memberships;
- Role assignments;
- Group memberships;
- direct grants;
- delegated authority;
- instance-role assignments.

Historical assignment records should be preserved through:

```text
endedAt
revokedAt
status
```

or equivalent lifecycle evidence.

Offboarding must not erase historical authorization evidence.

---

## 113.5 Resource Ownership Survives User Termination

Termination does not delete resources owned or created by the user.

Resources such as:

- Documents;
- Letters;
- Tickets;
- Follow-ups;
- Widgets;
- business records;

remain canonical business data.

The owning module defines whether ownership:

- remains attributed historically to the terminated identity;
- is reassigned to another identity;
- is reassigned to an organizational owner;
- requires an explicit operator workflow.

Authority does not silently rewrite resource ownership during termination.

---

## 113.6 Machine Credentials Associated With a Departing User Require Policy

Machine identities are independent identities and are not automatically deleted merely because their human owner leaves.

However, offboarding policy must identify machine identities for which the terminated user is:

- credential owner;
- sole operator;
- approver;
- responsible administrator.

Such credentials must be:

- reassigned;
- rotated;
- suspended;
- or revoked

according to policy.

This prevents orphaned service credentials.

---

## 113.7 Background Work Requires Explicit Offboarding Semantics

Background work initiated before termination may fall into two categories.

### Already-authorized durable business action

The operation was validly committed before termination.

It may continue if the owning workflow defines that commitment as authoritative.

### Deferred operation requiring authority at execution time

The Worker must re-authorize before execution.

If the initiating identity is terminated:

```text
DENY / CANCEL / REQUIRE OPERATOR RESOLUTION
```

according to the owning workflow.

Worker code must not assume that authority valid at job creation remains valid forever.

---

# 114. Group and Role Changes Invalidate Effective Authority

Privilege-affecting mutations must update authorization version/invalidation state.

This includes:

- group changes;
- membership changes;
- role assignment changes;
- role expiry changes;
- recurring schedule changes; 
- grant/deny changes;
- clearance changes.

---

# 115. Tenant Disablement Is a Hard Boundary

If a tenant is disabled or unavailable by policy, tenant-bound application authority fails closed.

Module-specific availability may additionally apply.

---

# 116. Authorization Tests Are Mandatory

Authority requires focused tests for:

- direct grants;
- role grants;
- group grants;
- explicit denial;
- default deny;
- tenant mismatch;
- organization scope;
- descendant scope;
- resource ACL;
- ownership policy;
- classification;
- clearance;
- machine identity;
- disabled identity;
- stale authorization version;
- federation mapping;
- break-glass;
- root `ALL`;
- internal-node `ALL`;
- `ALL` sibling isolation;
- value-bearing privileges;
- `getPrivValue` with and without `ALL`;
- CRUD `0/w/1` decisions;
- owner-aware CRUD with missing ownership;
- role expiry;
- recurring role schedules;
- schedule timezone and boundary semantics;
- hierarchical-scope monotonicity;
- explicit lower-level hierarchy exceptions;
- suspension;
- termination and immediate revocation;
- offboarding of sessions and assignments.  

---

# 117. Precedence Tests Are Mandatory

Tests must prove combinations such as:

```text
broad role grant
+
resource deny
→ DENY
```

and:

```text
clearance sufficient
+
no operation grant
→ DENY
```

and:

```text
operation grant
+
classification failure
→ DENY
```

and:

```text
root ALL
+
explicit deny
→ DENY
```

and:

```text
secretariat.ALL
→ secretariat.letter.read = ALLOW
→ crm.customer.read = NOT GRANTED
```

and:

```text
CRUD = 0w10
+
owner = actor
→ READ = ALLOW
```

while:

```text
CRUD = 0w10
+
owner != actor
→ READ = DENY
```

---

# 118. Tenant Isolation Tests Are Mandatory

Tests must verify that an identity authorized in Tenant A cannot reuse the same authorization context to access Tenant B.

This includes:

- human sessions;
- machine credentials;
- list queries;
- direct resource reads;
- RAG retrieval.

---

# 119. List Authorization Tests Are Mandatory

Tests must prove that:

- unauthorized rows are excluded before materialization;
- pagination does not leak unauthorized record counts;
- optional totals count only authorized results;
- cursor behavior remains correct after authorization filtering.

---

# 120. RAG Authorization Tests Are Mandatory

Tests must verify:

- unauthorized documents are absent from retrieval candidates;
- `use` without `read` works where policy permits;
- `quote=false` prevents quotation behavior;
- classification restrictions apply before retrieval;
- tenant isolation survives Qdrant filtering.

---

# 121. Machine Identity Tests Are Mandatory

Tests must cover:

- credential issuance;
- valid authentication;
- revoked credential;
- expired credential;
- tenant scope;
- deployment scope;
- rotation;
- privilege reduction;
- audit identity.

---

## 121.1 Privilege Helper Conformance Tests Are Mandatory

The canonical Authority kernel requires a reusable conformance suite covering:

- exact Boolean privilege;
- missing privilege;
- malformed privilege value;
- root `ALL`;
- internal-node `ALL`;
- sibling isolation;
- nested privilege values;
- raw value retrieval;
- `ALL` default value;
- typed value validation;
- CRUD C/R/U/D positions;
- `0`, `w`, and `1`;
- deterministic evaluation;
- caller-input non-mutation.

Any future replacement of the Authority kernel must pass the same conformance suite.

---

# 122. Federation Tests Are Mandatory

Tests must verify:

- trusted issuer;
- audience;
- signature;
- claim normalization;
- unknown mapping;
- suspended external identity;
- group mapping;
- tenant mapping.

Raw external group names must not become application permission checks.

---

# 123. Break-Glass Tests Are Mandatory

Tests must cover:

- missing reason;
- insufficient authentication strength;
- missing approval;
- scope violation;
- expiry;
- successful bounded access;
- audit generation;
- non-overridable policy.

---

## 123.1 Temporal Role Tests Are Mandatory

Tests must control the clock and verify:

- before `validFrom`;
- exactly at `validFrom`;
- inside validity;
- exactly at `validUntil`;
- after expiry;
- recurring active window;
- recurring inactive window;
- end-exclusive boundary;
- timezone conversion;
- Jalali calendar rule where used;
- exclusion date;
- explicit exception date;
- authorization behavior across a schedule transition without unsafe stale JWT privileges.

---

## 123.2 Hierarchy Tests Are Mandatory

Tests must verify:

- parent-scoped assignment covers configured descendants;
- child scope does not expand to parent;
- lower-level inherited authority is less than or equal to parent authority;
- explicit additional Role may add lower-level authority;
- explicit identity grant may add lower-level authority;
- explicit denial still wins;
- hierarchy changes invalidate affected authorization state.

---

## 123.3 Termination Tests Are Mandatory

Tests must verify:

- ACTIVE identity can authorize normally;
- SUSPENDED identity fails authorization;
- TERMINATED identity fails authorization;
- existing Refresh Tokens are revoked;
- existing sessions are revoked;
- pre-termination Access Tokens cannot continue authorizing solely because their signature is valid;
- replicated Authority instances observe revocation within the defined propagation bound;
- Role and Group assignments are ended without history loss;
- resource ownership is not silently deleted;
- queued jobs follow their declared reauthorization policy;
- offboarding audit evidence is generated.

---

# 124. Architecture Tests Must Prevent Local Authorization Engines

CI should reject detectable patterns such as:

```text
direct role comparisons outside Authority
direct privilege interpretation outside Authority
ACL evaluation outside Authority
classification-vs-clearance evaluation outside Authority
authorization SQL in business modules
direct traversal of `privs` outside approved Authority code
local implementation of `ALL`
local implementation of CRUD `0/w/1`
local role-schedule evaluation
local organizational-hierarchy authorization evaluation
```

Static rules may use:

- import restrictions;
- AST checks;
- package boundaries;
- forbidden identifier access;
- architecture tests.

---

# 125. Authority Internals Are Private

Business modules may import:

```text
Authority public contracts
Authority client/service interface
Authorization enums/types intended for public use
```

They must not import:

```text
Authority evaluation kernels
Authority repositories
Authority persistence
Authority policy internals
```

---

# 126. Public Authority Contract Is Stable

Business modules depend on the public semantic contract.

The implementation may later change from:

```text
in-process
```

to:

```text
independent service
```

without changing module authorization semantics.

---

# 127. Final Authorization Rule

The platform authorization model follows these rules:

```text
Identity is explicit.

Tenant context is explicit.

Machine identities are first-class.

Authority is the only authorization decision engine.

Modules declare vocabulary and provide facts.

Modules never evaluate access policy.

Privilege paths are hierarchical.

ALL is an ancestor-aware wildcard inside its scope.

ALL never crosses tenant or hard security boundaries.

Privilege leaves may carry typed values.

Value lookup under ALL uses an explicitly declared ALL default.

Privilege interpretation has one canonical helper implementation.

Owner-aware CRUD uses canonical 0/w/1 semantics.

Roles provide understandable administration.

Permissions are the explicit operation vocabulary.

Scope limits where grants apply.

Role assignments may expire.

Role assignments may have recurring schedules.

Timed authority is evaluated against explicit time and timezone.

Lower hierarchical scope is never broader by implicit inheritance.

Additional lower-level authority must be explicitly assigned.

ACL handles resource-specific exceptions.

ABAC applies contextual constraints.

Classification does not grant authority.

Ownership does not grant authority unless policy says so.

Explicit deny normally wins.

Missing facts fail closed.

List filtering is authorized before retrieval.

RAG filtering is authorized before retrieval.

JWT privileges are optimization, not authority.

RLS is defense in depth, not a second policy engine.

Break-glass is explicit, bounded, and audited.

Delegation preserves the actual actor.

Suspension stops authorization.

Termination immediately revokes effective authority.

Offboarding preserves historical identity and authorization evidence.

Authorization behavior is deterministic and testable.
```

The default authorization question is:

> **Which identity is acting, in which tenant and scope, on which resource, for which operation, which facts and policies apply, and which single Authority decision proves that access is permitted?**

## T4 production decision boundary

`clsAuthorityService` is the production entry point for generic protected
resource decisions. Authority persistence resolves registered permissions,
identity and role grants, ACL, clearance, organization ancestry, schedules, and
authorization version from one repeatable-read snapshot. The pure decision
kernel evaluates these facts. The service commits a semantic Audit event and
durable SIEM export record before returning ALLOW or DENY; an Audit write
failure rejects the operation and prevents protected materialization.

Callers provide only factual resource identifiers, tenant, owner,
classification, and organization. They must use the service's authorized
materialization or field projection path for protected content. A worker acting
on behalf of a human retains the original human actor, tenant, session when
applicable, request, and correlation context. A service identity cannot replace
the human's permissions. Direct use of the pure kernel is reserved for
Authority internals and conformance tests.

The current target production call-site inventory is
`docs/security/07-t4-authority-decision-boundary.md`. Every production
consumer must cross this audited service boundary; `ARCH-AUTH-004` rejects
direct pure-evaluator imports/calls outside Authority and tests. New T5
consumers require ALLOW and DENY Audit evidence and fail-closed tests before
the T5 completion security gate can pass.

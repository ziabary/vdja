# Targoman AI Platform — Notification and Ticketing Architecture

**Document:** `docs/architecture/09-notification-and-ticketing.md`  
**Version:** 0.1  
**Status:** Proposed Architecture  
**Depends on:**

- `00-manifest.md`
- `01-system-architecture.md`
- `02-engineering-conventions.md`
- `03-persistence-and-database.md`
- `04-authorization-model.md`
- `05-module-architecture.md`
- `06-document-and-rag.md`
- `07-ai-router.md`
- `08-deployment-architecture.md`

---

# 1. Purpose

This document defines the architecture of the shared **Notification** and **Ticketing** capabilities of the **Targoman AI Platform**.

It specifies:

- semantic Notification Requests;
- notification types;
- recipients;
- channels;
- templates;
- localization;
- tenant branding;
- notification preferences;
- mandatory notifications;
- scheduling;
- quiet hours;
- delivery;
- retries;
- deduplication;
- provider callbacks;
- unknown delivery outcomes;
- delivery status;
- in-app notification state;
- Ticket;
- Conversation;
- Message;
- Requester;
- Participant;
- Watcher;
- Queue;
- Assignment;
- Status;
- Priority;
- Category;
- SLA;
- attachments;
- Linked Resources;
- escalation;
- authorization;
- audit;
- observability;
- scaling;
- retention;
- testing.

The two primary rules are:

> **The originating module owns why a notification exists; Notification Core owns how it is delivered.**

and:

> **Ticketing owns a generic support/request case lifecycle; it must not become a second CRM or absorb business-specific workflows.**

---

# 2. Notification and Ticketing Are Separate Capabilities

Notification and Ticketing may interact closely, but they have independent ownership.

```text
Ticketing
    → Ticket lifecycle
    → Assignment
    → Conversation
    → SLA

Notifications
    → Recipient delivery
    → Channel selection
    → Template rendering
    → Provider interaction
```

Ticketing may request Notifications.

Notification does not own Ticket state.

---

# 3. Both Capabilities Are Optional

A deployment may enable:

```text
Notifications only
```

or:

```text
Ticketing only
```

or:

```text
Notifications + Ticketing
```

or neither.

Modules declaring either capability optional must continue to operate without it according to their Module Manifest.

---

# 4. Modules Do Not Implement Private Generic Notification Systems

Forbidden examples include:

```text
Follow-up SMS subsystem
CRM email subsystem
Widget notification subsystem
Secretariat in-app notification table
```

when the behavior is generic notification delivery.

Modules issue semantic Notification Requests through Notification Core.

---

# 5. Modules Do Not Implement Private Generic Ticket Systems

A module requiring generic support/escalation must use Ticketing Core.

For example:

```text
Widget escalation
CRM support request
Secretariat processing issue
Commercial support issue
User platform support
```

may all create Tickets.

---

# 6. Ticketing Must Not Become a CRM

Ticketing may know:

```text
Requester
Participants
Messages
Status
Assignment
Priority
Category
SLA
Linked Resources
```

It must not absorb generic:

```text
Customer lifecycle
Sales pipeline
Opportunity
Account management
Contract lifecycle
Lead scoring
Marketing activity
```

Those belong to CRM or another business module.

---

# 7. Ticketing Must Not Absorb Module-Specific Workflow

A Secretariat Letter approval problem may be represented by a Ticket.

The Ticket must not become the authoritative Letter workflow.

Likewise:

```text
Ticket RESOLVED
```

does not automatically mean:

```text
Secretariat problem resolved
Commercial dispute settled
CRM case closed
```

unless the owning module explicitly performs such transition.

---

# 8. Notification Semantics Originate Outside Notification Core

Example:

```text
Follow-up
    determines:
    "Task X is due"

Notification Core
    determines:
    recipient
    channel
    template
    delivery
```

Notification Core must not calculate whether Follow-up is actually due.

---

# 9. Notification Type Is a Stable Semantic Identifier

Examples:

```text
followup.reminder
ticket.created
ticket.assigned
ticket.message.received
ticket.sla.warning
ticket.sla.breached
secretariat.letter.received
letter.approved
payment.confirmed
security.session.revoked
```

A released Notification Type must not silently change meaning.

---

# 10. Notification Type Is Namespaced

Preferred format:

```text
<owner>.<semantic-event>
```

The owner may be:

- business module;
- platform capability.

---

# 11. Notification Type Is Not a Channel

This is semantic:

```text
ticket.assigned
```

These are channels:

```text
IN_APP
EMAIL
SMS
WEBHOOK
MESSAGING
```

The originating module must not normally request:

```text
send SMS
```

when the actual requirement is:

```text
notify ticket assignee
```

---

# 12. Notification Request Is the Application Contract

Conceptually:

```ts
interface intfNotificationRequest {
  notificationType:
    typNotificationTypeId;

  tenantId:
    typTenantId;

  recipientSpec:
    typNotificationRecipientSpec;

  semanticData:
    Readonly<Record<string, unknown>>;

  source?:
    intfResourceRef;

  correlationId:
    typCorrelationId;

  idempotencyKey?:
    typIdempotencyKey;
}
```

The final contract must replace generic structures with typed Notification-Type schemas where practical.

---

# 13. Notification Request Is Not Rendered Content

Preferred:

```text
Notification Type
+
Semantic Data
```

not:

```text
"send this already-formatted Persian SMS"
```

for ordinary platform behavior.

Rendering belongs to Notification Core.

---

# 14. Pre-Rendered Content Is Exceptional

Some integrations may genuinely provide externally mandated text.

Such use must explicitly declare:

```text
contentMode = PRE_RENDERED
```

and still pass:

- validation;
- channel limits;
- Data Governance;
- recipient resolution.

---

# 15. Notification Request Can Be Triggered by Application Request

Example:

```text
User clicks "Send reminder"
    ↓
Application Service
    ↓
Notification Request
```

---

# 16. Notification Request Can Be Triggered by Domain Event

Example:

```text
TicketAssigned
    ↓
Notification Policy
    ↓
ticket.assigned
```

Events describe completed facts.

Notification handling must not delay or redefine the completed source fact.

---

# 17. Critical Notification Scheduling Is Durable

If notification loss would violate required platform behavior:

```text
Business Transaction
    +
Notification Intent / Outbox
    ↓
Commit
    ↓
Worker
```

is required.

In-memory post-response callbacks are insufficient.

---

# 18. Notification Failure Does Not Normally Roll Back Business Truth

Example:

```text
Ticket assigned successfully
SMS provider failed
```

means:

```text
Ticket remains assigned
Notification remains retryable
```

unless an exceptional use case explicitly defines delivery as part of business completion.

---

# 19. Recipient Specification Is Semantic

Recipient may be expressed as:

```text
Identity
Requester
Ticket Assignee
Ticket Watchers
Organization Unit
Explicit External Address
Module-specific resolver
```

The caller should not reproduce generic recipient lookup logic.

---

# 20. Recipient Resolution Is Explicit

Flow:

```text
Notification Request
      ↓
Recipient Resolver
      ↓
Canonical Recipient(s)
      ↓
Preference / Policy
      ↓
Channel Delivery
```

---

# 21. Recipient Identity Uses Authority

For authenticated platform recipients:

```text
typIdentityId
```

is the canonical identity reference.

Notification Core does not create a parallel user model.

---

# 22. External Recipients Are Distinct

Some notifications may legitimately target:

```text
email address
mobile number
external webhook endpoint
```

without a Platform Identity.

Such recipients require explicit validated contracts.

They must not be represented as fake users.

---

# 23. Recipient Resolution Does Not Grant Access

Sending a user a notification about a resource does not automatically authorize access to that resource.

For example:

```text
"Ticket updated"
```

may contain a link.

Opening the Ticket still requires Authority authorization.

---

# 24. Notification Content Must Not Leak Unauthorized Resource Data

Before rendering protected business content into a Notification, the producing workflow must ensure that the recipient may receive that disclosure.

Notification Core is not a bypass around Authority.

---

# 25. Channel Is Selected by Policy

Possible channels include:

```text
IN_APP
EMAIL
SMS
WEBHOOK
MESSAGING
```

Future channels may be added through adapters.

---

# 26. Channel Availability Is Deployment-Dependent

A Deployment may support:

```text
IN_APP + EMAIL
```

while another supports:

```text
IN_APP + SMS + WEBHOOK
```

Module code must not assume every channel exists.

---

# 27. Channel Selection Uses Ordered Policy

Conceptually:

```text
Notification Type
+
Mandatory Channel Policy
+
Recipient Preferences
+
Tenant Policy
+
Deployment Availability
+
Data Governance
    ↓
Selected Channels
```

---

# 28. User Preference Cannot Disable Mandatory Security Notification

Some notification types may be:

```text
OPTIONAL
MANDATORY
SECURITY_CRITICAL
```

A user may opt out of an optional marketing-like notification.

A user cannot disable required:

```text
security credential changed
break-glass access used
critical account security event
```

when platform policy requires delivery.

---

# 29. Mandatory Does Not Mean Every Channel

A mandatory notification policy may require:

```text
at least IN_APP
```

or:

```text
EMAIL + IN_APP
```

according to Notification Type policy.

Mandatory behavior is explicitly configured.

---

# 30. Preference Is Channel-Specific

A recipient may configure:

```text
ticket updates:
    IN_APP = yes
    EMAIL  = yes
    SMS    = no
```

where the Notification Type permits preference.

---

# 31. Preference Scope Is Explicit

Preferences may be defined at:

```text
User
Notification Type
Notification Category
Channel
Module
```

The override hierarchy must be deterministic.

---

# 32. Tenant Policy May Bound Preferences

A Tenant may require:

```text
critical support escalation
    → email mandatory
```

even when a user normally disables ticket email.

Lower-level preference cannot weaken mandatory higher-level policy.

---

# 33. Quiet Hours Are Supported

Optional notification types may respect recipient quiet hours.

Example:

```text
22:00 → 07:00
```

in the user's configured timezone.

---

# 34. Quiet Hours Are Not Security Authority

A security-critical notification may bypass quiet hours according to policy.

This behavior must be explicit.

---

# 35. Quiet-Hour Timezone Is Explicit

Never infer recurring schedules from server-local time.

Quiet-hour configuration includes an explicit timezone.

---

# 36. Deferred Quiet-Hour Notifications Remain Durable

If delivery is postponed until quiet hours end:

```text
Notification
    ↓
scheduled durable delivery
```

must survive restart.

---

# 37. Notification Templates Are Shared Rendering Contracts

A Template may define:

```text
subject
title
body
short text
action label
```

as required by the channel.

---

# 38. Templates Are Notification-Type-Specific

Example:

```text
ticket.assigned
    ├── in-app template
    ├── email template
    └── SMS template
```

One generic template is not required to serve every channel.

---

# 39. Templates Are Localized

A Template may have variants for:

```text
fa-IR
en-US
...
```

Locale fallback behavior is explicit.

---

# 40. Persian and RTL Are First-Class

Persian notification rendering must correctly support:

- RTL;
- Persian text;
- mixed-direction identifiers;
- URLs;
- dates;
- numbers according to presentation policy.

---

# 41. Persistent Time Remains Standard

Notification scheduling stores absolute timezone-aware timestamps.

Jalali or localized representations belong to rendering/presentation.

---

# 42. Template Variables Are Schema-Validated

Example:

```text
ticket.assigned

required variables:
    ticketNumber
    ticketSubject
    assigneeDisplayName
```

Missing required variables fail rendering.

---

# 43. Template Does Not Execute Arbitrary Code

Template rendering is controlled.

Templates must not permit arbitrary:

- JavaScript;
- shell execution;
- SQL;
- filesystem access;
- external HTTP requests.

---

# 44. Template Content Is Versioned

A rendered Notification should record enough information to identify:

```text
Notification Type
Template ID
Template Version
Locale
Brand Profile
```

used for the delivery.

---

# 45. Rendered Content Snapshot Is Recommended

For externally delivered notifications, storing a protected rendered-content snapshot or checksum may be appropriate for audit/retry.

Retry must not unexpectedly render a completely different message because a template changed after the original Notification was created.

---

# 46. Tenant Branding Applies at Rendering Time

Notification rendering may use:

```text
product name
organization name
logo
support identity
email identity
footer
```

from Brand Profile.

Modules must not hard-code Targoman branding.

---

# 47. Notification Content Is Data-Governed

Channel choice must consider confidentiality.

For example:

```text
Highly Confidential Letter
```

may permit:

```text
SMS:
    "You have a new protected message."
```

but prohibit:

```text
SMS:
    full letter subject/body
```

---

# 48. Channel Payload Is Minimized

External channels should receive only information required for the notification.

Notification authorization does not imply permission to replicate full business data to a third-party provider.

---

# 49. Links Are Preferable to Sensitive Payloads Where Appropriate

A message may say:

```text
"A new letter requires your attention."
```

with an authenticated platform link rather than embedding confidential content.

Opening the target still requires Authority.

---

# 50. Notification Has Canonical Identity

Every persisted Notification has stable identity.

One logical Notification may produce several channel Deliveries.

```text
Notification
├── IN_APP Delivery
├── EMAIL Delivery
└── SMS Delivery
```

---

# 51. Notification and Delivery Are Different Entities

Notification represents:

> Something should be communicated to a recipient.

Delivery represents:

> One attempt/channel path for communicating it.

This distinction is mandatory.

---

# 52. Delivery Has Explicit Lifecycle

Possible delivery states include:

```text
PENDING
SCHEDULED
SENDING
SENT
DELIVERED
FAILED
UNKNOWN
CANCELLED
```

Exact channel-specific mappings are defined by Notification Core.

---

# 53. `SENT` and `DELIVERED` Are Different

`SENT` may mean:

> Provider accepted the request.

`DELIVERED` may mean:

> Provider reported delivery to destination.

Not every channel/provider can prove `DELIVERED`.

---

# 54. Delivery Success Does Not Mean User Read It

For:

```text
EMAIL
SMS
```

there is normally no authoritative platform concept of:

```text
user read message
```

unless the provider supplies an approved meaning.

---

# 55. In-App Availability and Read State Are Separate

An in-app Notification may track:

```text
availableAt
seenAt
readAt
dismissedAt
```

where product requirements need them.

These states do not apply automatically to external channels.

---

# 56. In-App Notification Is Durable

An in-app Notification is persistent product state, not merely a transient browser toast.

UI toast behavior may be ephemeral.

The Notification itself is durable according to retention policy.

---

# 57. Notification Read State Is Per Recipient

Where one logical event targets several identities, read state must not be shared incorrectly among them.

---

# 58. Provider Attempt Is Recorded

A Delivery may contain several Attempts.

```text
Email Delivery
├── Attempt 1 → timeout
└── Attempt 2 → provider accepted
```

---

# 59. Provider Attempt Is Operational Evidence

Attempt data may include:

```text
provider
attempt number
start/end
provider message ID
result
error class
request correlation
```

Sensitive provider payloads must not be logged indiscriminately.

---

# 60. Delivery Is At-Least-Once by Default

External notification execution should assume at-least-once processing unless a provider contract proves stronger semantics.

Therefore adapters and delivery state must tolerate retry.

---

# 61. Stable Delivery Identity Supports Idempotency

Where provider APIs support idempotency, use stable logical delivery identity.

Where they do not, platform deduplication still limits duplicate sends where possible.

---

# 62. Notification Deduplication Is Semantic

Two identical text bodies are not necessarily duplicate Notifications.

Deduplication should rely on semantic identity such as:

```text
Notification Type
Recipient
Source Resource
Logical Event
Deduplication Key
```

---

# 63. Deduplication Window Is Explicit

Some notification types may define a deduplication window.

Example:

```text
"Ticket still overdue"
    once per hour
```

This must not suppress genuinely distinct business events.

---

# 64. Caller May Supply Idempotency Key

For explicit retryable Notification Requests, the caller may supply stable idempotency identity.

Same key + same semantic request:

```text
same logical Notification
```

Same key + conflicting request:

```text
IDEMPOTENCY_CONFLICT
```

---

# 65. Retry Is Bounded

Delivery retries require:

- retry classification;
- maximum attempts;
- backoff;
- terminal failure state.

No Notification retries forever.

---

# 66. Retryability Is Provider-Specific but Canonically Mapped

Examples:

```text
temporary provider 500
    → retryable

invalid recipient address
    → terminal

provider rate limit
    → retryable with backoff

authentication failure
    → configuration failure
```

Provider error strings do not become platform error semantics.

---

# 67. Circuit Breakers Protect Failed Notification Providers

Repeated provider failure may open a circuit.

This prevents notification Workers from flooding an unavailable dependency.

---

# 68. Provider Failure Does Not Lose Notification Intent

Canonical Notification/Delivery state remains durable even when an external provider is unavailable.

---

# 69. Unknown Delivery Outcome Uses Reconciliation

Example:

```text
SMS request sent
network connection lost
provider response unknown
```

The platform must not blindly assume:

```text
FAILED
```

and resend if duplicate user-visible delivery is significant.

Where provider capabilities allow it:

```text
provider message status lookup
```

is used through Reconciliation.

---

# 70. Duplicate Delivery May Still Be Possible

Some providers do not provide idempotency or status reconciliation.

The platform must document channel/provider guarantees honestly.

At-least-once infrastructure does not imply exactly-once human communication.

---

# 71. Provider Callbacks Are Untrusted

Delivery receipts and inbound provider callbacks require:

- authentication/signature validation;
- schema validation;
- replay protection where applicable;
- provider identity validation.

---

# 72. Provider Callback Must Correlate to Known Delivery

An unknown provider message ID must not mutate arbitrary Delivery state.

---

# 73. Late Callback Is Supported

A provider may report:

```text
DELIVERED
```

after the platform previously considered the Delivery:

```text
SENT
```

or even temporarily:

```text
UNKNOWN
```

State-transition rules must define valid late updates.

---

# 74. Terminal Failure Remains Inspectable

Failed Deliveries remain available for:

- operator diagnosis;
- retry where approved;
- audit;
- support.

They must not disappear silently.

---

# 75. Manual Retry Is Explicit

An administrator may retry a failed Delivery through an authorized application use case.

Manual retry is:

- audited;
- idempotency-aware;
- visible in attempt history.

---

# 76. Notification Provider Configuration Is Scoped

Provider configuration may exist at:

```text
Deployment
Tenant
Channel
```

where supported.

The effective hierarchy must be explicit.

---

# 77. Customer Provider Overrides Are Allowed Where Configured

Example:

```text
Deployment:
    default SMS provider

Tenant A:
    own SMS gateway
```

may be supported through adapter configuration.

Modules remain unaware of the physical provider.

---

# 78. Notification Provider Secrets Use Secret References

No SMTP password, SMS token, webhook secret, or private key belongs in ordinary Notification configuration.

---

# 79. Outbound Webhook Is a Notification Channel Only When Semantically Appropriate

A generic webhook notification may deliver semantic event information to an external subscriber.

Cross-system business integrations requiring request/response domain semantics should use the Integration architecture instead.

Notification Webhook must not become a generic hidden integration bus.

---

# 80. Webhook Delivery Is Signed Where Required

Webhook channels should support appropriate:

- signature;
- timestamp;
- delivery ID;
- replay protection.

The exact protocol belongs to the adapter contract.

---

# 81. Webhook Destination Is Controlled

A user must not be able to turn notification Webhooks into arbitrary SSRF destinations.

Endpoints require:

- validation;
- policy;
- authorization;
- network restrictions where appropriate.

---

# 82. Notification Scheduling Uses Jobs

Future scheduled delivery requiring application/provider interaction uses durable Jobs/Workers.

Database Events do not directly send notifications.

---

# 83. Database Event May Produce Notification Intent

A database-local SLA/retention computation may produce durable state/outbox work.

External delivery still executes through the application Worker.

---

# 84. Notification Cancellation Is Explicit

A scheduled Notification may be cancellable before delivery where semantics permit it.

Already sent external messages cannot be "unsent" merely by changing platform state.

---

# 85. Cancellation Is Not Deletion

Cancellation preserves history.

Normal Notification lifecycle uses status, not hard deletion.

---

# 86. Notification Retention Is Policy-Driven

Retention may differ for:

- in-app notifications;
- rendered payload snapshots;
- Delivery attempts;
- security notifications;
- provider callback evidence.

---

# 87. Notification Core Is Horizontally Scalable

No Worker process exclusively owns a Delivery indefinitely.

Delivery Jobs use shared durable state, claims, retries, and recovery.

---

# 88. Channel Workers May Scale Independently

Large deployments may separate:

```text
Email Workers
SMS Workers
Webhook Workers
```

without changing semantic Notification contracts.

---

# 89. Channel Failure Isolated From Other Channels

SMS outage should not necessarily block:

```text
IN_APP
EMAIL
```

where Notification Type policy permits independent delivery.

---

# 90. Notification Success Policy May Require One or Several Channels

Examples:

```text
best-effort optional notification
    → any selected channel

mandatory security alert
    → required email + in-app
```

Success criteria belong to Notification Type policy.

---

# 91. Ticket Is a Generic Request/Support Case

A Ticket represents a bounded case requiring communication, assignment, tracking, or resolution.

Examples:

```text
User support request
Widget escalation
Secretariat processing issue
CRM support issue
Commercial support case
```

---

# 92. Ticket Has Canonical Identity

Each Ticket has stable platform identity.

A human-readable Ticket number may exist separately.

---

# 93. Ticket Number Is Not Primary Identity

Example:

```text
TCK-1405-001284
```

may be presentation/business reference.

Internal immutable identity remains canonical.

---

# 94. Ticket Is Tenant-Bound

Every normal Ticket belongs to one Tenant.

Cross-tenant Tickets are not supported by default.

---

# 95. Ticket Source Is Explicit

A Ticket records its source.

Possible source types include:

```text
USER_SUPPORT
WIDGET_ESCALATION
CRM
SECRETARIAT
COMMERCIAL
ADMIN
API
```

Exact values may be extensible through typed registration.

---

# 96. Ticket Source Does Not Own Ticket Lifecycle

Widget may create a Ticket.

Ticketing owns the Ticket lifecycle afterward.

Widget may retain a Linked Resource reference.

---

# 97. Ticket Requester Is Explicit

Requester represents who requested help/action.

It may normally reference:

```text
Platform Identity
```

and may support an explicit external requester extension where a product requirement needs it.

---

# 98. Requester Is Not Always the Creator

Example:

```text
operator creates Ticket
on behalf of customer
```

Therefore distinguish:

```text
createdBy
requester
```

where necessary.

---

# 99. Ticket Conversation Is First-Class

A Ticket normally has one primary Conversation.

Conversation contains ordered Messages.

---

# 100. Message Is Immutable Business History After Publication

A published Message should not be silently rewritten.

Correction may use:

- explicit edit history;
- replacement;
- additive Message

according to product policy.

---

# 101. Message Sender Is Explicit

Message records actual sender identity/context.

Delegated/impersonated scenarios preserve the actual actor according to Authority rules.

---

# 102. Message Visibility Is Explicit

Ticketing may distinguish:

```text
REQUESTER_VISIBLE
INTERNAL_NOTE
```

or equivalent visibility classes.

Internal notes must not leak to requester-facing APIs.

---

# 103. Visibility Is Not Frontend-Only

Backend query and Authority policies must enforce Message visibility.

Hiding an internal note in UI is not sufficient.

---

# 104. Private Note Still Requires Authorization

Creating or reading an internal note requires explicit Ticketing permissions.

---

# 105. Ticket Participants Are Explicit

Participants may represent identities involved in the Conversation.

Participation may support:

- visibility;
- notification;
- collaboration

according to Authority policy.

---

# 106. Participant Membership Does Not Automatically Grant Every Ticket Operation

Being a participant does not imply:

```text
assign
close
change priority
manage SLA
```

Authority decides operations separately.

---

# 107. Watcher Is Primarily a Subscription Fact

A Watcher requests or receives updates about a Ticket.

Watcher status does not automatically imply broad resource authority.

---

# 108. Watching Requires Access

Ordinary users cannot subscribe themselves to Tickets they are not authorized to discover/read.

---

# 109. Watcher Removal Does Not Rewrite Ticket History

Watcher lifecycle is separate relational state.

---

# 110. Ticket Queue Is a Ticketing Concept

Ticketing may define operational Queues such as:

```text
General Support
Finance Support
Technical Support
Secretariat Support
```

Queue is not the same thing as:

```text
Authority Group
Organization Unit
Role
```

---

# 111. Queue Membership and Authority Are Separate

A Queue may reference an organizational/team configuration.

But assignment to a Queue does not independently grant access.

Authority consumes relevant facts and policy.

---

# 112. Ticket Assignment May Target Queue and Identity

A Ticket may have:

```text
currentQueue
currentAssigneeIdentity
```

where applicable.

One or both may be present according to lifecycle rules.

---

# 113. Assignment Is a Ticket Fact, Not Authorization Logic

Ticketing reports:

```text
assignee = Identity X
queue = Technical Support
```

Authority determines what access follows from those facts.

---

# 114. Self-Assignment Is Explicit

A Ticketing policy may permit an authorized Queue member to claim an unassigned Ticket.

That behavior belongs to Ticketing application logic.

Authority first decides whether the operation may be attempted.

---

# 115. Reassignment Is Audited

Changing:

- Queue;
- Assignee

creates business-history evidence.

---

# 116. Assignment History Is Preserved

Current Assignment may be mutable state.

Historical assignment transitions are append-oriented evidence.

---

# 117. Ticket Status Is Generic

A default lifecycle may use values such as:

```text
OPEN
IN_PROGRESS
WAITING
RESOLVED
CLOSED
```

Exact status model must remain generic and controlled.

---

# 118. Ticket Status Must Not Encode Module Workflow

Avoid Ticket statuses such as:

```text
LETTER_WAITING_FOR_SIGNATURE
PAYMENT_REFUND_APPROVED
CRM_LEAD_CONVERTED
```

Those belong to owning business modules.

---

# 119. Tenant-Configurable Display Does Not Mean Arbitrary Lifecycle

Tenants may customize:

- display labels;
- localized names;
- selected workflow options

where supported.

Canonical Ticket state semantics remain controlled.

---

# 120. Ticket Lifecycle Is Explicit

Conceptual state transitions may include:

```text
OPEN
  ↓
IN_PROGRESS
  ↓
WAITING
  ↓
RESOLVED
  ↓
CLOSED
```

Reopen may be allowed by explicit transition policy.

---

# 121. Invalid Ticket Transition Fails Explicitly

Example:

```text
CLOSED
    → arbitrary IN_PROGRESS
```

must not occur unless lifecycle policy permits reopening.

---

# 122. Resolution and Closure Are Different

A Ticket may be:

```text
RESOLVED
```

when an answer/fix has been supplied.

It may become:

```text
CLOSED
```

later according to requester/operator or automatic policy.

---

# 123. Ticket Priority Is Generic

Possible canonical values may include:

```text
LOW
NORMAL
HIGH
URGENT
```

Priority is not an authorization level.

---

# 124. Priority Does Not Automatically Override Queue or SLA Policy

Priority may influence:

- SLA target;
- ordering;
- escalation.

Exact mapping is tenant/Ticketing policy.

---

# 125. Category Is Generic Classification

A Ticket may have a Category.

Categories may be tenant-configurable.

Examples:

```text
Technical
Billing
Access
Secretariat
General
```

Category is not a replacement for source Module.

---

# 126. Tags Are Non-Authoritative Classification Aids

Tags may support:

- search;
- operations;
- reporting.

Core security decisions should not depend on arbitrary free-form tags.

---

# 127. Linked Resource Connects Ticket to Business Context

A Ticket may link to:

```text
secretariat.letter / 1822
widget.conversation / 908
crm.case / 341
commercial.transaction / 77
```

using stable Resource References.

---

# 128. Ticketing Must Not Query Linked Module Tables Directly

To obtain protected information about a linked resource:

```text
Ticketing
    ↓
Public Module Contract / Resource Resolver
```

not direct SQL.

---

# 129. Linked Resource Is Not Ownership Transfer

Linking:

```text
Ticket → Secretariat Letter
```

does not move Letter ownership to Ticketing.

Secretariat remains authoritative.

---

# 130. Linked Resource May Become Unavailable

Ticket history must remain valid even when:

- source module disabled;
- source resource archived;
- module uninstalled.

UI should represent an unavailable linked resource gracefully.

---

# 131. Ticket Attachments Use Document Core

Ticketing does not implement a private file store.

Flow:

```text
Ticket / Message
    ↓
Document Relation
    ↓
Document
    ↓
Document Version
    ↓
Asset
```

---

# 132. Attachment Access Is Independently Authorized

Ticket visibility does not automatically imply:

```text
download attachment
```

unless Authority policy explicitly grants it.

Document operations remain independent.

---

# 133. Attachment Upload Uses Shared File Processing Rules

Ticket attachments inherit:

- file-size limits;
- type detection;
- malware/quarantine policy;
- storage abstraction;
- Document provenance.

---

# 134. Ticket Message May Reference Several Documents

Attachment relation is typed.

The Ticket message body itself remains Ticketing business content unless product requirements model it as a Document.

---

# 135. SLA Is a Ticketing Capability

Ticket SLA may track service commitments such as:

```text
first response target
resolution target
```

Ticketing owns SLA state and calculation semantics.

---

# 136. SLA Policy Is Separate From Ticket State

Ticket status is not itself SLA.

Example:

```text
IN_PROGRESS
```

may be:

```text
within SLA
warning
breached
```

depending on timing.

---

# 137. SLA Policy May Depend on Ticket Facts

Inputs may include:

```text
Tenant
Category
Priority
Queue
Source
```

according to tenant policy.

---

# 138. SLA Uses Absolute Time Internally

Deadlines are stored as timezone-aware absolute instants.

Human display may use:

- Jalali;
- Gregorian;
- local timezone.

---

# 139. Business-Hour SLA Uses Shared Calendar Capability

If SLA counts only:

```text
Saturday–Wednesday
08:00–16:00
```

or another business schedule, calculation uses shared Calendar scheduling primitives.

Ticketing must not implement an independent Jalali/calendar engine.

---

# 140. SLA Calendar Is Explicit

A business-hours policy defines:

- timezone;
- working weekdays;
- working hours;
- holidays;
- exceptions.

---

# 141. SLA Pause Conditions Are Explicit

Possible pause conditions may include:

```text
waiting for requester
approved external dependency
```

if Ticketing policy supports them.

Pause must not happen implicitly based only on arbitrary Message text.

---

# 142. SLA State Is Auditable

Important SLA events include:

```text
target assigned
warning threshold reached
breach occurred
pause
resume
policy changed
```

---

# 143. SLA Warning and Breach May Request Notifications

Flow:

```text
Ticketing SLA
    ↓
ticket.sla.warning
    ↓
Notification Core
```

Ticketing owns:

```text
breach happened
```

Notification owns:

```text
how recipients are informed
```

---

# 144. Notification Failure Does Not Erase SLA Breach

If notification delivery fails, the Ticket remains breached.

Delivery remains independently retryable.

---

# 145. SLA Evaluation May Use Database-Local Scheduling

If SLA threshold detection can be completed entirely inside PostgreSQL, an approved Database Event may update SLA-local state or create durable outbox intent.

External notifications remain Worker work.

---

# 146. SLA Evaluation May Use Worker

Where SLA calculation requires application/calendar/integration logic, durable Jobs/Workers are appropriate.

The chosen mechanism follows the standard DB Event vs Worker boundary.

---

# 147. Escalation Is Explicit

Ticketing may support escalation policies such as:

```text
SLA warning
    → notify assignee

SLA breach
    → notify Queue manager

Repeated breach
    → reassign or create escalation state
```

Exact behavior is policy.

---

# 148. Escalation Does Not Automatically Grant Authority

Being an escalation recipient does not independently grant Ticket access.

Authority policy must support required visibility.

---

# 149. Ticket Creation Can Be Manual

An authorized user may create a Ticket directly through User Dashboard or module UI.

---

# 150. Ticket Creation Can Be Programmatic

Modules may create Tickets through public Ticketing application contracts.

Example:

```text
Widget
    ↓
Escalate Conversation
    ↓
Create Ticket
```

---

# 151. Ticket Creation Is Idempotent Where Retryable

A retryable module escalation supplies stable idempotency identity.

Repeated request must not create uncontrolled duplicate Tickets.

---

# 152. Source Resource May Define Deduplication Context

Example:

```text
Widget Conversation #123
+
Escalation Type
```

may be used by the owning integration policy to prevent duplicate open escalation Tickets.

This must be explicit.

---

# 153. Duplicate Detection Is Not Generic Text Similarity

Two Tickets with equal subject text may represent different cases.

Ticketing must not silently merge them based only on text similarity.

---

# 154. AI May Assist Ticket Creation

AI may support Tasks such as:

```text
ticket.summarize
ticket.category.suggest
ticket.priority.suggest
ticket.reply.draft
```

through AI Router.

---

# 155. AI Suggestion Is Not Ticket Authority

AI may suggest:

```text
priority = HIGH
```

The owning application policy decides whether that suggestion:

- is presented to operator;
- can be auto-applied;
- requires validation.

---

# 156. AI Must Not Close Tickets Directly

Required:

```text
AI suggestion
    ↓
validated application workflow
    ↓
Authority
    ↓
Ticket transition
```

Never:

```text
LLM
    ↓
Ticket CLOSED
```

---

# 157. AI Summaries Are Derived

A Ticket summary may be cached as derived AI output.

Conversation Messages remain authoritative history.

---

# 158. Ticket Search Is Authorization-Aware

List/search queries must apply Authority constraints before returning Ticket metadata.

Unauthorized Tickets must not be fetched then filtered casually in application code.

---

# 159. Ticket Counts Are Authorization-Aware

If a user may access 20 out of 1000 Tickets:

```text
total
```

when requested must represent the authorized set.

It must not leak:

```text
1000
```

---

# 160. Ticket List Does Not Count by Default

Default:

```text
items
nextCursor / hasMore
```

No `COUNT(*)` unless explicitly requested.

---

# 161. Ticket Single-Resource and List Contracts Are Separate

Examples:

```text
GET /tickets/{id}
```

and:

```text
GET /tickets?...
```

must not share one overloaded persistence contract.

---

# 162. Ticket Resource Facts Are Supplied to Authority

Ticketing may provide:

```text
tenant
requester
assignee
queue
participants
source
priority
status
```

where required for authorization.

Ticketing does not decide access itself.

---

# 163. Requester Ownership Is Not Universal Authorization

Forbidden:

```ts
if (ticket.requesterId === actorId)
  allow();
```

outside Authority.

Ticketing supplies requester facts.

Authority interprets applicable policy.

---

# 164. Ticket Assignment Is Not Universal Authorization

Likewise:

```ts
if (ticket.assigneeId === actorId)
  allow();
```

is prohibited outside Authority.

---

# 165. Ticket Authorization Operations Are Explicit

Possible operations include:

```text
ticket.discover
ticket.read
ticket.create
ticket.reply
ticket.internal-note
ticket.assign
ticket.change-status
ticket.change-priority
ticket.manage-participants
ticket.manage-watchers
ticket.manage-sla
ticket.manage
```

The final catalog is registered through Ticketing's module/capability manifest.

---

# 166. Ticket Role Templates May Be Provided

Ticketing may contribute Role Templates such as:

```text
TicketRequester
TicketOperator
TicketSupervisor
TicketAdministrator
```

Authority owns actual Role assignment and evaluation.

---

# 167. Queue Assignment Does Not Create Hidden Role Logic

Queue-specific rights are expressed through Authority vocabulary/facts.

Ticketing must not implement:

```ts
if (queue.memberIds.includes(userId))
  allow();
```

as its own authorization system.

---

# 168. Ticket Status Changes Are Application Operations

State transition flow:

```text
Request
    ↓
Authority
    ↓
Ticketing Application
    ↓
Lifecycle Rule
    ↓
Persistence
    ↓
Audit / Event
```

---

# 169. Ticket Persistence Is Ticketing-Owned

Ticketing owns persistence for:

- Ticket;
- Conversation;
- Message;
- Queue;
- Assignment;
- Participant;
- Watcher;
- Category;
- SLA state;
- Ticket History;
- Linked Resource references.

---

# 170. Ticketing Does Not Own Attachment Bytes

Document Core owns Attachment Document/Asset persistence.

Ticketing stores the relation.

---

# 171. Notification Persistence Is Notification-Owned

Notifications owns persistence for:

- Notification;
- Recipient state;
- Delivery;
- Delivery Attempt;
- in-app read state;
- template metadata where persisted;
- preference;
- channel/provider configuration references.

---

# 172. Notification Provider Secrets Are Not Notification Business Rows

Secret values remain in approved Secret infrastructure.

Notification persistence stores references only.

---

# 173. Ticket History Is Append-Oriented

Important Ticket transitions produce history such as:

```text
created
assigned
reassigned
priority changed
status changed
participant added
SLA breached
closed
reopened
```

---

# 174. Message History Is Separate From Mutation Audit

Ticket business history answers:

> What happened in the Ticket?

Database mutation audit answers:

> Which rows changed?

Both may exist.

---

# 175. Notification History Is Separate From Provider Logs

Canonical Delivery state belongs to Notification persistence.

Provider diagnostic logs are operational telemetry.

---

# 176. Ticket Deletion Is Normally Soft

Ordinary Ticket removal uses soft deletion/archive semantics.

Historical support evidence is not physically destroyed through ordinary CRUD.

---

# 177. Message Physical Deletion Is Exceptional

Ticket Messages may contain significant business history.

Physical purge requires:

- Data Governance;
- retention;
- legal policy;
- audit.

---

# 178. Notification Purge Is Policy-Controlled

Expired in-app notifications and delivery telemetry may have configurable retention.

Security-significant notification evidence may require longer retention.

---

# 179. Ticket Attachments Follow Document Retention

Deleting or purging a Ticket does not automatically bypass Document legal-hold/reference policy.

---

# 180. Notification Audit Includes Administrative Changes

Relevant events include:

```text
template changed
mandatory policy changed
provider changed
preference changed
manual retry
delivery cancelled
```

according to audit policy.

---

# 181. Ticket Administrative Changes Are Audited

Relevant events include:

```text
Queue changed
Category changed
SLA policy changed
Role Template changed
```

---

# 182. Security-Significant Ticket Events Feed Security Telemetry

Examples:

```text
unauthorized Ticket read
unauthorized internal-note access
bulk Ticket export attempt
administrative permission change
```

Ticketing emits canonical security evidence.

It does not call SOC directly.

---

# 183. Notification Security Events Feed Security Telemetry

Examples:

```text
webhook signature failure
provider credential misuse
mandatory security delivery failure
unauthorized template administration
```

---

# 184. Ticket Events May Produce Notifications

Examples:

```text
TicketCreated
TicketAssigned
TicketMessageAdded
TicketStatusChanged
TicketSlaWarning
TicketSlaBreached
```

Notification policy maps these facts to semantic Notification Types.

---

# 185. Notification Delivery Does Not Emit Duplicate Business Facts

Sending:

```text
ticket.assigned email
```

must not emit another:

```text
TicketAssigned
```

business event.

Notification event lineage remains distinct.

---

# 186. Ticketing May Integrate With Follow-up

If product requirements need a separate actionable Follow-up Task from a Ticket:

```text
Ticket
    ↓ optional integration
Follow-up
```

uses public module contracts/events.

Ticketing does not duplicate Follow-up domain semantics.

---

# 187. Ticketing May Integrate With CRM

A CRM customer/account may be linked through Resource Reference.

Ticketing does not copy CRM customer lifecycle into Ticket state.

---

# 188. Ticketing May Integrate With Widget

Widget escalation may carry:

```text
Widget Instance
Conversation Reference
Requester
Summary
```

into Ticket creation.

The original Widget Conversation remains Widget-owned.

---

# 189. Ticketing May Integrate With Secretariat

A Secretariat processing issue may link:

```text
secretariat.letter
```

without Ticketing accessing Secretariat tables.

---

# 190. Ticketing May Integrate With Commercial

A support Ticket may link:

```text
Commercial Transaction
Invoice
Payment
Offering
```

using public Resource References/contracts.

Ticketing must not modify financial state directly.

---

# 191. Notification Core May Be Used Without Ticketing

Examples:

```text
Follow-up reminder
Letter approval notification
Security event
Payment confirmation
```

do not require Ticket creation.

---

# 192. Ticketing May Operate With Notifications Disabled

Ticket lifecycle remains valid.

Users may need to discover updates through Ticket UI.

No hidden dependency on Notification Core is allowed if Notification is declared optional.

---

# 193. Notification Health Is Channel-Specific

Health may expose:

```text
IN_APP = healthy
EMAIL  = degraded
SMS    = unavailable
WEBHOOK = healthy
```

A single provider failure need not mark all Notifications unavailable.

---

# 194. Ticketing Health Depends Primarily on Core Persistence

Ticketing may remain ready when optional Notification delivery is down.

Health state may be:

```text
DEGRADED
```

rather than unavailable.

---

# 195. Delivery Backlog Is Observable

Operational metrics include:

```text
pending deliveries
oldest delivery age
retry count
failed deliveries
unknown deliveries
provider latency
provider error rate
```

---

# 196. Ticket Operational Metrics Are Observable

Metrics may include:

```text
open Tickets
unassigned Tickets
Queue backlog
Ticket age
first-response time
resolution time
SLA warning count
SLA breach count
```

Metrics must respect privacy and cardinality constraints.

---

# 197. Metrics Are Not Business Truth

Dashboards may use derived aggregates.

Ticket relational state remains authoritative.

---

# 198. Queue Backlog May Drive Operational Alerting

Examples:

```text
unassigned urgent Ticket > threshold
oldest Queue Ticket > threshold
SLA breach rate > threshold
```

Alerting policy is operational.

---

# 199. Notification Backpressure Is Required

Provider outage must not create unlimited memory queues.

Durable delivery backlog remains bounded operationally through:

- retry scheduling;
- circuit breakers;
- alerts;
- optional load shedding for noncritical notifications.

---

# 200. Mandatory Notifications Have Priority

Notification scheduling may assign delivery classes such as:

```text
SECURITY_CRITICAL
HIGH
NORMAL
BULK
```

Priority affects scheduling.

It does not bypass provider/security policy.

---

# 201. Bulk Notifications Are Isolated

Bulk or campaign-like notifications should not starve:

```text
security notifications
ticket assignment notifications
critical Follow-up reminders
```

where deployment policy requires priority isolation.

---

# 202. Ticket Concurrency Is Controlled

Concurrent operators may attempt to:

- claim;
- reassign;
- resolve;
- update priority.

Critical transitions require locking or optimistic concurrency protection.

---

# 203. Ticket Assignment Prevents Lost Updates

Example:

```text
Operator A claims Ticket
Operator B claims same Ticket
```

must produce one deterministic authoritative result.

---

# 204. Ticket Message Submission Is Idempotent Where Retryable

Browser/network retry must not create duplicate identical Message entries when the request uses the same idempotency key.

---

# 205. Notification Provider Callback Is Idempotent

Repeated delivery-receipt callbacks must not create conflicting history or repeated terminal transitions.

---

# 206. Ticket SLA Jobs Are Idempotent

Repeated SLA evaluation must not produce uncontrolled duplicate:

```text
warning
breach
escalation
```

events.

---

# 207. Notification APIs Distinguish Single and List Operations

Examples:

```text
GET /notifications/{id}
```

and:

```text
GET /notifications
```

use separate contracts.

List does not calculate total by default.

---

# 208. Ticket APIs Distinguish Single and List Operations

The same shared query convention applies.

---

# 209. Cursor Pagination Is Preferred for High-Volume Notification Lists

In-app Notification streams commonly use:

```text
cursor
limit
```

instead of expensive absolute-page counting.

---

# 210. Ticket Search May Support Offset Only Where UX Requires It

Administrative Ticket lists may support offset/page-number navigation if the user experience requires random page access.

Cursor remains preferred for large/change-heavy datasets.

---

# 211. Totals Are Explicitly Requested

A Dashboard may need:

```text
Open Tickets = 37
```

Such count is an explicit query requirement.

Ordinary list API must not always compute it.

---

# 212. Ticket Search Supports Structured Filters

Possible filters include:

```text
status
priority
Queue
Assignee
Requester
Category
Source
date range
SLA state
Linked Resource
```

Filters are schema-validated.

---

# 213. Free-Text Ticket Search Is Authorization-Aware

If Ticket content is indexed for search, only authorized Ticket content may be returned.

Future semantic Ticket search must follow Document/RAG authorization principles where protected content is involved.

---

# 214. Notification Search Does Not Expose Hidden Resource Metadata

A Notification may reference a protected source.

The list renderer must not disclose source title/details beyond the recipient's permitted Notification content.

---

# 215. Ticket Export Is a Separate Operation

Bulk export may require stronger authorization than ordinary Ticket list/read.

Example:

```text
ticket.export
```

should be explicit where export is supported.

---

# 216. Notification Export Is Also Explicit

Administrative notification-delivery export may contain personal contact information.

It requires dedicated Authority and Data Governance treatment.

---

# 217. Ticketing Supports API Integrations Through Public Contracts

External support integrations, if later required, use controlled API/adapter contracts.

They do not receive direct Ticket database access.

---

# 218. Email-to-Ticket Is an Optional Adapter

A future inbound email integration may create:

- new Ticket;
- Ticket Message

through the Ticketing application boundary.

It must validate:

- sender mapping;
- reply correlation;
- attachment handling;
- spoofing risk;
- tenant routing.

---

# 219. Inbound Email Does Not Authorize by Sender String Alone

An email address matching a user profile is not automatically sufficient proof of Platform Identity.

The adapter's trust/authentication policy must be explicit.

---

# 220. External Ticket Provider Sync Is Optional

A customer may integrate with:

```text
ServiceNow
Jira Service Management
other support platform
```

through explicit adapters where required.

---

# 221. External Ticket Sync Requires Ownership Decision

The deployment must define which system owns:

```text
Ticket truth
```

Bidirectional synchronization without canonical ownership is prohibited.

---

# 222. Mirror Integration Is Not Dual Authority

If an external system mirrors platform Tickets, one side must remain canonical for each synchronized fact.

Conflict resolution must be explicit.

---

# 223. Notification Provider Swap Does Not Affect Modules

Changing:

```text
SMS Provider A
→ SMS Provider B
```

must not require Follow-up, CRM, Ticketing, or Secretariat changes.

---

# 224. Template Provider Is Not Semantic Owner

Even if external email-template infrastructure is used, canonical Notification Type and variable contract remain platform-owned.

---

# 225. Ticket Provider Adapter Does Not Become Ticketing Authority

An external Ticketing adapter cannot define internal lifecycle merely because its API has different statuses.

Mapping belongs to the adapter/integration contract.

---

# 226. Notification Testing Begins With Semantic Contracts

Preferred sequence:

```text
Notification Type Contract
      ↓
Rendering / Policy Tests
      ↓
Provider Adapter Tests
      ↓
Worker / Delivery Tests
      ↓
End-to-End Tests
```

---

# 227. Notification Type Tests Are Mandatory

Tests verify:

- unique Notification Type;
- valid semantic-data schema;
- required channels;
- optional channels;
- mandatory classification;
- localization configuration;
- Data Governance behavior.

---

# 228. Template Tests Are Mandatory

Tests cover:

- valid rendering;
- missing variable;
- wrong variable type;
- locale;
- fallback locale;
- RTL;
- brand profile;
- escaping/injection safety.

---

# 229. Preference Tests Are Mandatory

Tests cover:

- optional notification opt-out;
- channel opt-out;
- mandatory notification;
- tenant override;
- quiet hours;
- security-critical bypass where defined.

---

# 230. Notification Idempotency Tests Are Mandatory

Tests cover:

```text
same key + same request
→ same logical Notification

same key + different request
→ conflict
```

---

# 231. Delivery Retry Tests Are Mandatory

Tests cover:

- temporary provider failure;
- permanent failure;
- retry count;
- backoff;
- terminal state;
- circuit breaker.

---

# 232. Unknown Delivery Tests Are Mandatory

Tests simulate:

```text
provider may have accepted
response lost
```

and verify reconciliation/duplicate-safe behavior.

---

# 233. Provider Callback Tests Are Mandatory

Tests cover:

- valid callback;
- invalid signature;
- duplicate callback;
- unknown Delivery ID;
- late delivery;
- malformed payload.

---

# 234. Notification Data-Leak Tests Are Mandatory

Tests verify sensitive business content is not sent through disallowed channels.

---

# 235. Ticket Lifecycle Tests Are Mandatory

Tests cover:

- create;
- valid transition;
- invalid transition;
- resolve;
- close;
- reopen where allowed;
- concurrency conflict.

---

# 236. Ticket Assignment Tests Are Mandatory

Tests cover:

- Queue assignment;
- Identity assignment;
- claim;
- double claim;
- reassignment;
- assignment history;
- permission denial.

---

# 237. Ticket Authorization Tests Are Mandatory

Tests cover:

- requester;
- assignee;
- Queue context;
- participant;
- watcher;
- administrator;
- unauthorized identity;
- cross-tenant identity.

Facts alone must not bypass Authority.

---

# 238. Internal-Note Tests Are Mandatory

Tests prove requester-facing APIs cannot expose internal notes.

---

# 239. Attachment Tests Are Mandatory

Tests cover:

- upload;
- Document relation;
- read;
- download;
- unauthorized attachment;
- deleted Ticket;
- retention.

---

# 240. Linked-Resource Tests Are Mandatory

Tests cover:

- valid link;
- unauthorized linked resource;
- source module disabled;
- source module absent;
- missing resource;
- preserved Ticket history.

---

# 241. SLA Tests Are Mandatory

Tests control time and verify:

- SLA calculation;
- business hours;
- timezone;
- holiday;
- warning;
- breach;
- pause;
- resume;
- idempotent repeated evaluation.

---

# 242. Jalali Presentation Tests Apply Where Used

Business-hour scheduling uses canonical calendar/time primitives.

UI display must be tested in Jalali/RTL where Persian configuration requires it.

---

# 243. Ticket Notification Integration Tests Are Mandatory

Tests verify:

```text
TicketAssigned
    → one logical ticket.assigned Notification
```

without duplicate business transition.

---

# 244. Notification-Disabled Ticketing Tests Are Mandatory

Ticketing must remain functional when Notification capability is disabled where it is declared optional.

---

# 245. Ticketing-Disabled Module Tests Are Mandatory

Modules declaring Ticketing optional must remain functional without Ticketing.

Escalation features may be unavailable explicitly.

---

# 246. Worker Crash Tests Are Mandatory

Notification delivery must recover from Worker termination.

SLA/escalation Jobs must also recover without duplicate transitions.

---

# 247. Provider Outage Tests Are Mandatory

Tests verify:

- Ticket business state remains valid;
- Notification backlog remains durable;
- health becomes degraded;
- alerts occur;
- recovery drains backlog.

---

# 248. Load Tests Are Required Where Volume Justifies It

Relevant workloads include:

```text
large in-app notification streams
mass Ticket updates
high Message concurrency
large Queue searches
provider backlog
```

---

# 249. Architecture Tests Prevent Direct Provider Use

CI should reject detectable:

```text
module imports SMS SDK
module imports SMTP provider SDK
module sends notification webhook directly
Ticketing directly calls SMS provider
```

outside Notification adapters.

---

# 250. Architecture Tests Prevent Private Ticket Systems

Where generic support functionality is intended, architecture review should reject duplicate generic Ticket implementations inside modules.

---

# 251. Architecture Tests Prevent Ticketing Becoming CRM

Dependency and schema reviews should detect inappropriate CRM-domain ownership creeping into Ticketing.

---

# 252. Architecture Tests Prevent Local Authorization

Ticketing and Notifications must not:

- compare Roles;
- traverse `privs`;
- evaluate ACL;
- decide hierarchy;
- implement `ALL`;
- implement ownership access.

Authority remains canonical.

---

# 253. Notification Public Contracts Are Stable

Business modules consume:

```text
Notification Request
Notification Type registration
selected query/admin contracts
```

They do not import:

```text
provider adapter internals
Delivery repository
template renderer internals
retry scheduler internals
```

---

# 254. Ticketing Public Contracts Are Stable

Modules consume:

```text
Create Ticket
Link Resource
Add authorized Message where appropriate
Ticket events
```

They do not import Ticketing persistence internals.

---

# 255. Final Notification Rule

Notification architecture follows these rules:

```text
Modules own why a notification exists.

Notification Core owns how it is delivered.

Notification Type is semantic and channel-independent.

Notification Request is typed.

Recipients are explicit.

Recipient resolution does not grant resource access.

Preferences cannot weaken mandatory security policy.

Quiet hours are timezone-aware.

Templates are typed, localized, versioned, and brand-aware.

Sensitive content is minimized by channel.

Notification and Delivery are different entities.

One Notification may have several channel Deliveries.

Delivery Attempts are explicit.

Retries are bounded.

Delivery is at-least-once by default.

Deduplication uses semantic identity.

UNKNOWN provider outcomes use Reconciliation.

Provider callbacks are validated and idempotent.

In-app read state is distinct from external delivery state.

Provider failure never erases canonical Notification intent.

Channels may fail independently.

Notification workloads are durable, scalable, observable, and policy-driven.
```

---

# 256. Final Ticketing Rule

Ticketing architecture follows these rules:

```text
Ticketing is generic support/request infrastructure.

Ticketing is not CRM.

Ticketing does not absorb module-specific workflows.

Ticket is tenant-bound.

Requester and creator are distinct when necessary.

Conversation and Messages are first-class.

Internal notes are backend-protected.

Participant and Watcher are distinct.

Watcher is not automatically an authorization grant.

Queue is a Ticketing concept, not an Authority Group.

Assignment is a resource fact, not authorization.

Ticket status is generic.

Priority is not security level.

Category is not source ownership.

Linked Resources preserve external module ownership.

Ticketing never queries private module tables.

Attachments use Document Core.

Attachment access remains independently authorized.

SLA belongs to Ticketing.

SLA uses explicit time, timezone, and shared Calendar primitives.

SLA events may request Notifications.

Notification failure does not erase Ticket/SLA truth.

AI may assist but never mutate Ticket state directly.

List/search authorization occurs before materialization.

Counts are optional and count only authorized results.

Lifecycle transitions are concurrency-safe and audited.

Ticket history is preserved.

Ticketing remains functional without optional Notifications.

Modules remain functional without optional Ticketing.

Ticketing behavior is scalable, recoverable, observable, and testable.
```

The default design question is:

> **Which domain owns the event or support case, what semantic Notification or Ticket action is being requested, who is the recipient/requester/assignee, what Authority decision applies, what state must be durable before external delivery, and what remains true if a provider, Worker, linked module, or notification channel fails?**
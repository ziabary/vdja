# Targoman AI Platform — Deployment Architecture

**Document:** `docs/architecture/08-deployment-architecture.md`  
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

---

# 1. Purpose

This document defines deployment, runtime, availability, recovery, delivery, and operational architecture for the **Targoman AI Platform**.

It specifies:

- Deployment Profiles;
- deployment classes;
- environment isolation;
- OCI delivery;
- Docker / Podman / Kubernetes deployment;
- runtime topology;
- Ingress / Gateway;
- networking;
- TLS;
- service discovery;
- stateless application scaling;
- Worker scaling;
- PostgreSQL deployment;
- Qdrant deployment;
- Object Storage;
- AI / GPU infrastructure;
- high availability;
- fault isolation;
- health and readiness;
- graceful shutdown;
- Admission Control and backpressure;
- configuration;
- secrets;
- configuration drift;
- software supply-chain security;
- observability;
- SOC / SIEM connectivity;
- backup;
- restore;
- disaster recovery;
- RPO / RTO;
- upgrade;
- rollback;
- operational runbooks;
- deployment testing.

The central rule is:

> **Deployment complexity may vary from one small server to a redundant enterprise topology without changing business-module architecture or semantic contracts.**

---

# 2. Deployment Is Not Tenant

A Deployment is one running installation of the product.

A Tenant is a logical organizational and security boundary within that Deployment.

Valid topologies include:

```text
Deployment
└── Tenant A
```

and:

```text
Deployment
├── Tenant A
├── Tenant B
└── Tenant C
```

Tenant count must not define physical deployment architecture.

---

# 3. Deployment Is Not Environment

Environment and Deployment are different concepts.

Examples:

```text
Development Deployment

Test Deployment

Staging Deployment

Production Deployment
```

Each environment should have an independently identifiable deployment configuration.

---

# 4. One Product Supports Multiple Deployment Classes

The architecture supports a continuum such as:

```text
Single / Small Deployment
        ↓
Redundant Deployment
        ↓
High-Availability Enterprise Deployment
```

These are topology choices.

They do not create separate product architectures.

---

# 5. Small Deployment Is Valid

A small deployment may intentionally contain infrastructure single points of failure.

For example:

```text
┌──────────────────────────────┐
│        One Server            │
│                              │
│ Reverse Proxy                │
│ Web                          │
│ API                          │
│ Worker                       │
│ PostgreSQL                   │
│ Qdrant                       │
│ vLLM                         │
│ RTX 4090                     │
└──────────────────────────────┘
```

This is valid when accepted by the Deployment Profile.

Application design must nevertheless remain horizontally scalable.

---

# 6. Small Deployment Must Not Create Architectural Lock-In

Single-node deployment must not result in application assumptions such as:

```text
local in-memory session truth

one Worker permanently owns a Job

local disk path hard-coded in a module

one API process owns authorization state

one model server name embedded in business logic
```

These patterns are prohibited even when the initial installation is small.

---

# 7. Redundant Deployment

A more resilient deployment may use:

```text
              Load Balancer
                    │
        ┌───────────┴───────────┐
        │                       │
      Web 1                   Web 2

        ┌───────────┴───────────┐
        │                       │
      API 1                   API 2

             Worker Pool

         PostgreSQL HA

       Qdrant / Object Store

        AI Endpoint Pool
```

---

# 8. Enterprise Deployment

A high-availability deployment may separate major infrastructure responsibilities:

```text
Internet / Enterprise Network
            │
       Gateway / WAF
            │
    ┌───────┴────────┐
    │                │
 Web Replicas    API Replicas
                     │
       ┌─────────────┼─────────────┐
       │             │             │
 PostgreSQL HA    Qdrant       Object Storage
       │             │             │
       └─────────────┼─────────────┘
                     │
                 Workers
                     │
                AI Router
                     │
       ┌─────────────┴─────────────┐
       │                           │
 RTX4090 Endpoint Pool         H200 Tier
```

Exact infrastructure depends on customer requirements.

---

# 9. Deployment Profile Is Canonical Desired State

A Deployment Profile describes the intended installation.

It may define:

- product version;
- installed modules;
- enabled platform capabilities;
- route bindings;
- branding;
- infrastructure endpoints;
- storage;
- AI topology;
- network policy;
- security bounds;
- integrations;
- SOC / SIEM;
- backup policy;
- availability objectives;
- recovery objectives.

---

# 10. Deployment Profile Is Versioned

Production configuration must identify a version or immutable revision.

Operational staff must be able to answer:

> Which desired deployment configuration is currently intended to be running?

---

# 11. Deployment Profile Is Validated Before Application

Deployment tooling must validate configuration before changing production state.

Validation should detect:

- unknown module;
- incompatible module;
- missing required capability;
- invalid route;
- missing infrastructure dependency;
- invalid AI endpoint;
- unsupported PostgreSQL version;
- unsupported extension version;
- invalid recovery policy;
- missing required Secret reference.

---

# 12. Deployment Profile Does Not Contain Secret Values

The Profile references:

```text
secretRef
```

rather than embedding production secret values.

---

# 13. Deployment Profile May Define Operational Objectives

A production profile may specify:

```text
Availability SLO
RPO
RTO
Maximum acceptable failover time
Maximum authorization-revocation propagation
Backup retention
Restore-testing frequency
```

Exact values depend on deployment/customer requirements.

The architecture does not impose one global numerical SLO.

---

# 14. Criticality Is Deployment-Specific

The same capability may have different operational criticality in different installations.

Example:

```text
Secretariat-only customer
    → AI / RAG may be business-critical

CRM installation
    → AI summarization may be degradable
```

Therefore required/degraded dependency behavior is defined explicitly.

---

# 15. Runtime Responsibilities Remain Logical

Primary runtime responsibilities include:

```text
Web
API
Worker
PostgreSQL
Qdrant
Object Storage
AI Router
Model Serving
Ingress / Gateway
Observability
```

Several may run on one machine.

Their ownership remains distinct.

---

# 16. OCI Is the Standard Application Artifact

Application delivery uses OCI-compatible container images.

Typical images include:

```text
targoman-platform-web
targoman-platform-api
targoman-platform-worker
targoman-postgres
```

AI serving infrastructure may use separately versioned approved images.

---

# 17. Container Runtime Is Replaceable

Supported deployment environments include:

```text
Docker
Podman
Kubernetes
```

Application behavior must not depend on Docker-specific semantics.

---

# 18. Kubernetes Is Optional

Kubernetes is appropriate where its operational benefits justify it.

It is not required for small/private deployments.

The architecture must remain deployable through:

```text
Docker Compose
Podman
```

or equivalent simple orchestration.

---

# 19. Application Images Are Immutable

Production application containers should be treated as immutable.

Runtime modification of application binaries or source inside containers is prohibited as a normal deployment practice.

Changes require a new versioned artifact.

---

# 20. Container Filesystem Is Ephemeral

Application correctness must not depend on persistent writable container filesystem state.

Persistent data belongs in approved persistent infrastructure.

---

# 21. Containers Run Least-Privileged

Where practical:

- run as non-root;
- avoid privileged containers;
- drop unnecessary capabilities;
- restrict writable paths;
- restrict mounted host paths;
- use read-only root filesystem where compatible.

Exceptions require documented operational justification.

---

# 22. Resource Limits Are Explicit

Production containers should have intentional resource requests/limits or equivalent operational bounds where the orchestrator supports them.

Unbounded memory or process growth must not be assumed safe.

---

# 23. Image Identity Uses Digest Where Required

Production deployment should be capable of pinning:

```text
registry/image@sha256:...
```

or equivalent immutable artifact identity.

Mutable tags alone are insufficient evidence of exactly what is running.

---

# 24. Release Artifact Set Is Identifiable

A platform release should identify the compatible set of:

```text
Web image
API image
Worker image
PostgreSQL image/profile
Database migrations
Module versions
Configuration schema version
```

and applicable AI infrastructure compatibility.

---

# 25. Software Supply Chain Is Controlled

The release pipeline should conceptually follow:

```text
Source Revision
    ↓
Dependency Resolution
    ↓
Build
    ↓
Tests
    ↓
SBOM
    ↓
Vulnerability / Policy Scan
    ↓
Artifact Provenance
    ↓
Signing
    ↓
Registry
    ↓
Deployment Verification
```

---

# 26. Dependencies Are Reproducible

Builds use controlled:

- lockfiles;
- package versions;
- base-image versions;
- build tooling versions.

Floating dependencies in production builds are prohibited unless explicitly approved.

---

# 27. SBOM Is a Release Artifact

Production releases should generate a Software Bill of Materials where practical.

SBOM should identify relevant:

- operating-system packages;
- application dependencies;
- image components.

---

# 28. Vulnerability Scanning Is a Release Gate

Images and dependencies should be scanned before production promotion.

A known vulnerability may be accepted only through an explicit risk/exception process.

---

# 29. Artifact Provenance Is Preserved

Operators should be able to correlate a running image to:

```text
source revision
build
release
digest
SBOM
signature/provenance
```

---

# 30. Artifact Verification May Be Required Before Deployment

Higher-assurance environments may require verification of:

- image signature;
- expected digest;
- approved registry;
- release provenance.

Unsigned/unapproved artifacts may be rejected.

---

# 31. Customer Registry Is Supported

Enterprise customers may mirror or host approved images in their own OCI registry.

Artifact identity and provenance must survive mirroring.

---

# 32. Air-Gapped Deployment Is Supported

A Deployment Profile may prohibit internet access.

An air-gapped installation may use a controlled artifact bundle containing:

- OCI images;
- migrations;
- configuration schemas;
- model artifacts;
- checksums;
- signatures;
- SBOMs.

Business modules must not assume internet access.

---

# 33. External Provider Dependencies Are Optional by Policy

An air-gapped or sensitive deployment may configure:

```text
externalAI = disabled
externalStorage = disabled
externalNotifications = disabled
```

where relevant.

Absence of an optional provider must not break unrelated platform functionality.

---

# 34. Environment Isolation Is Mandatory

Production, staging, and development must not accidentally share authoritative state.

They should normally use separate:

- databases;
- object-storage namespaces;
- Qdrant state;
- credentials;
- provider keys;
- routing;
- audit contexts.

---

# 35. Production Secrets Must Not Be Reused in Development

Development environments must not require production credentials.

Production secrets must not be copied into ordinary developer configuration.

---

# 36. Production Data Must Not Be Copied Casually to Lower Environments

If production-derived data is required for testing, it must follow explicit:

- authorization;
- Data Governance;
- masking/anonymization;
- retention;
- audit

requirements.

---

# 37. Network Architecture Uses Explicit Trust Boundaries

A typical enterprise deployment may contain logical zones such as:

```text
Public / Edge
Application
Data
AI
Management
External Integration
```

These are security boundaries, not necessarily physical networks.

---

# 38. Public Exposure Is Minimized

Normally public/external network access is limited to approved entrypoints such as:

```text
Gateway / Reverse Proxy
Public API where enabled
Webhook endpoints where required
```

PostgreSQL, Qdrant, internal model endpoints, and Worker control surfaces must not be publicly exposed.

---

# 39. Database Network Access Is Restricted

PostgreSQL accepts connections only from approved runtime/maintenance paths.

Typical consumers:

```text
API
Worker
Migration Job
Approved Maintenance
```

Direct user/client access is prohibited.

---

# 40. Qdrant Network Access Is Restricted

Qdrant is internal infrastructure.

Business modules and browsers do not connect directly.

Only approved Knowledge/RAG infrastructure may use its provider interface.

---

# 41. AI Model Endpoints Are Internal by Default

Local model-serving endpoints should normally be reachable only by approved AI Router runtime paths.

Business modules and browsers must not directly access model servers.

---

# 42. Object Storage Is Private by Default

Document storage buckets/volumes must not be globally public.

Content delivery uses controlled access such as:

- application streaming;
- short-lived signed URL;
- another approved controlled mechanism.

---

# 43. Egress Is Policy-Controlled

Network egress may be restricted by deployment policy.

Relevant destinations may include:

```text
external AI
SMS
email
payment
customer APIs
SOC / SIEM
external calendars
identity providers
```

A module must not open arbitrary external destinations.

---

# 44. Data Governance and Network Egress Complement Each Other

Application Data Governance remains the semantic decision layer.

Network restrictions provide defense in depth.

Network allow-listing does not replace Data Governance.

---

# 45. TLS Is Required Across Untrusted Networks

External application traffic uses TLS.

Higher-assurance deployments may require internal TLS or mTLS between infrastructure zones.

---

# 46. Internal mTLS Is Deployment Policy

mTLS may be required for:

- independently deployed services;
- customer-controlled infrastructure;
- sensitive internal boundaries;
- SOC/SIEM connections;
- management APIs.

It is not required merely because two modules are logically separate in the same process.

---

# 47. Certificates Have Lifecycle

Production TLS certificates require:

- issuance;
- renewal;
- expiry monitoring;
- rotation;
- revocation/replacement.

Certificate expiry must be observable before outage.

---

# 48. Time Synchronization Is Operationally Important

Hosts and containers should use reliable time synchronization.

Correct time is security-sensitive for:

- token expiry;
- scheduled Roles;
- audit timestamps;
- TLS certificates;
- signed data;
- retries;
- Jobs;
- RPO/recovery analysis.

---

# 49. Large Clock Skew Is an Operational Failure

Deployment monitoring should detect material clock drift where infrastructure permits.

Authority must not compensate for uncontrolled clock errors by weakening expiry semantics.

---

# 50. Gateway Is the Primary External Entry Boundary

The edge may use:

```text
HAProxy
Nginx
Traefik
Kubernetes Gateway / Ingress
Customer Enterprise Gateway
```

The application does not depend on one specific implementation.

---

# 51. Gateway Responsibilities Are Explicit

Gateway responsibilities may include:

- TLS termination;
- hostname routing;
- path routing;
- request-size bounds;
- trusted forwarding headers;
- connection limits;
- optional edge rate limiting;
- streaming support;
- security headers;
- optional WAF integration.

---

# 52. Gateway Does Not Own Application Authorization

Edge authentication or filtering may provide additional protection.

Authority remains the owner of application authorization.

---

# 53. Forwarded Client Identity Is Trusted Only From Approved Proxies

Headers such as:

```text
X-Forwarded-For
Forwarded
```

must not be trusted from arbitrary clients.

The API trusts forwarding information only through configured trusted-proxy boundaries.

---

# 54. Request IDs Enter at the Edge or API Boundary

Every external request receives a stable request/correlation identifier.

If an approved upstream gateway supplies one, the platform may validate and propagate it.

Otherwise the platform generates one.

---

# 55. Host and Route Mapping Are Deployment Configuration

The same module may be exposed as:

```text
ai.customer.example/secretariat
```

or:

```text
secretariat.customer.example
```

without business-code changes.

---

# 56. White-Label Domain and TLS Are Deployment Concerns

Customer:

- domain;
- certificate;
- brand;
- public route;
- support identity

belong to Deployment/Brand Profiles.

No module hard-codes Targoman public identity.

Deployment and Brand Profiles select runtime visual identity independently of the `@targoman/*` code/package namespace. FAPA is a deployment-specific brand only: its name and assets may be shown when the active Brand Profile selects them. Customer names do not become canonical package names, module IDs, or generic UI defaults.

---

# 57. API Is Stateless Where Practical

Replicated API instances must not require sticky sessions for ordinary authenticated HTTP traffic.

Authoritative session state resides in shared persistent state.

---

# 58. Web Runtime Is Stateless Where Practical

Frontend runtime replicas must not retain authoritative user/business state in local process memory.

---

# 59. Sticky Sessions Are Exceptional

Sticky routing may be used only when a concrete transport/runtime requirement justifies it.

It must not become a workaround for incorrectly process-local application state.

---

# 60. SSE Does Not Require General Sticky Sessions

An active SSE stream naturally remains connected to one API instance for its lifetime.

Subsequent requests must remain free to reach another replica.

---

# 61. WebSocket State Requires Explicit Design

Where WebSocket is used, connection-local transient state may exist.

Authoritative business/session state must remain outside the individual socket process.

Reconnect semantics must be defined.

---

# 62. Graceful Shutdown Is Mandatory

Application runtimes must support graceful termination.

A normal shutdown sequence conceptually is:

```text
Receive Termination
    ↓
Stop Accepting New Work
    ↓
Become Not Ready
    ↓
Drain Active Work
    ↓
Release Resources
    ↓
Exit
```

---

# 63. API Shutdown Drains Active Requests

Existing bounded requests may complete within an approved grace period.

New traffic is removed through readiness before termination.

---

# 64. Streaming Shutdown Is Explicit

A draining API should avoid accepting new long-lived streams.

Active streams may:

- finish within grace period;
- terminate with an explicit interrupted state

according to protocol limits.

---

# 65. Worker Shutdown Stops New Claims

A Worker entering shutdown:

```text
stop claiming new Jobs
    ↓
finish or safely release active claims
    ↓
exit
```

It must not abandon invisible permanent ownership of a Job.

---

# 66. AI Endpoint Draining Is Supported

Model endpoints may enter:

```text
DRAINING
```

so the Router stops assigning new executions before maintenance or replacement.

---

# 67. Health Signals Have Different Meanings

Deployment should distinguish where applicable:

```text
Startup
Liveness
Readiness
Health / Dependency Status
```

They are not interchangeable.

---

# 68. Startup Indicates Initialization Completion

Startup checks may allow extra time for:

- application initialization;
- model loading;
- cache initialization;
- migration compatibility check.

---

# 69. Liveness Answers Whether the Process Is Functioning

Liveness should normally detect a stuck/broken runtime process.

It should not fail merely because one temporary external dependency is unavailable.

Otherwise a dependency outage may trigger restart storms.

---

# 70. Readiness Answers Whether New Traffic Should Arrive

Readiness may depend on mandatory dependencies required to serve the runtime's primary function.

If a critical dependency is unavailable, the replica becomes not ready.

---

# 71. Optional Dependency Failure Produces Degradation

Example:

```text
API + PostgreSQL healthy
Optional SMS provider unavailable
```

should not normally make the API unready.

Operational health may report:

```text
DEGRADED
```

---

# 72. Dependency Criticality Is Explicit

Each runtime declares which dependencies affect:

```text
readiness
degraded status
feature-specific availability
```

This avoids arbitrary health behavior.

---

# 73. Health Endpoints Expose No Sensitive Detail Publicly

Public health may return minimal status.

Detailed dependency diagnostics should be restricted to approved operational access.

---

# 74. API Replicas Scale Horizontally

Scaling API replicas must not require business-module changes.

Common scale inputs may include:

- request rate;
- latency;
- concurrent requests;
- CPU;
- memory.

No one metric is universally sufficient.

---

# 75. Web Replicas Scale Horizontally

Web delivery may scale independently from API.

Static delivery may additionally use customer/CDN infrastructure where policy permits.

---

# 76. Worker Replicas Scale Independently

Worker scaling may respond to:

- queue depth;
- Job age;
- Job type;
- processing time;
- CPU;
- memory;
- external provider capacity.

---

# 77. Worker Scale Does Not Break Job Correctness

More Worker replicas must not create:

- duplicate authoritative transitions;
- duplicate external side effects;
- uncontrolled lock contention.

Claim/idempotency architecture remains authoritative.

---

# 78. Different Worker Pools May Be Used

Large deployments may separate workloads such as:

```text
general Workers

document-processing Workers

AI/background Workers

integration Workers
```

while preserving the same Job contracts.

---

# 79. Worker Pool Separation Is Operational

Splitting a Worker pool must not change Job semantics.

It is deployment configuration.

---

# 80. Admission Control Protects Infrastructure

Horizontal scale is not a substitute for bounded load.

Admission Control may protect:

- API;
- Workers;
- AI endpoints;
- storage;
- expensive search;
- bulk operations.

---

# 81. Backpressure Is Required

When downstream capacity is exhausted:

```text
queue safely
reject predictably
or use approved fallback
```

is preferable to unlimited in-memory accumulation.

---

# 82. Queues Are Bounded Operationally

Durable work may accumulate during outages, but operational policy must define:

- maximum age;
- retry schedule;
- terminal state;
- alert thresholds;
- operator remediation.

---

# 83. Priority Does Not Override Security or Capacity Hard Limits

A high-priority Job may receive preferential scheduling.

It cannot bypass:

- tenant isolation;
- Data Governance;
- hard quotas;
- unavailable mandatory dependencies.

---

# 84. Load Shedding Is Allowed

During severe overload, deployment policy may reject lower-priority or optional work to preserve critical operations.

Load shedding must produce explicit observable outcomes.

---

# 85. PostgreSQL Is the Primary Relational Availability Dependency

Loss of PostgreSQL normally prevents authoritative mutations and many protected reads.

Production availability planning must treat PostgreSQL accordingly.

---

# 86. Small PostgreSQL Deployment May Be Single-Instance

A small profile may intentionally use one PostgreSQL instance.

This is not considered HA.

The accepted risk must be visible in the Deployment Profile.

---

# 87. HA PostgreSQL Uses Redundant Topology

An HA deployment may use:

```text
Primary
+
Standby Replica(s)
+
Failover Mechanism
```

or an equivalent managed/customer platform.

The application must not depend on a particular HA product.

---

# 88. PostgreSQL Replication Is Not Backup

Replication protects availability against some failures.

It also replicates:

```text
accidental delete
corrupt mutation
bad migration
```

Therefore replication never replaces backup/PITR.

---

# 89. PostgreSQL Failover Must Preserve One Authoritative Writer

HA topology must prevent uncontrolled concurrent primaries.

Split-brain risk must be addressed by the selected infrastructure.

---

# 90. Application Uses a Stable PostgreSQL Endpoint

Application configuration should normally reference a stable service endpoint rather than one physical database node.

Failover should not require business-module configuration changes.

---

# 91. Database Connection Pools Are Bounded

Every API/Worker replica must not create an unlimited number of PostgreSQL connections.

Connection budgets consider:

```text
API replicas
Worker replicas
maintenance
migration
monitoring
```

---

# 92. Connection Pooling Infrastructure May Be Added

A deployment may use a pooler such as an approved PostgreSQL connection-pooling solution when scale requires it.

Application transaction semantics must remain correct.

---

# 93. Transaction-Local Context Must Survive Pooling Semantics

Any pooling mode must preserve the transaction-local execution-context assumptions defined in Persistence Architecture.

Session-scoped actor/tenant state remains prohibited.

---

# 94. Read Replicas Are Optional

PostgreSQL read replicas may be used for suitable read workloads.

They are not automatically used for all queries.

---

# 95. Consistency Requirement Determines Replica Eligibility

Operations requiring immediate authoritative consistency must use an appropriate authoritative read path.

Stale replica reads must not be used for:

- authorization-critical facts;
- just-completed critical mutations;
- financial truth;
- security revocation

unless the architecture explicitly proves them safe.

---

# 96. Database Schema Migration Runs Once

Application replicas must never race to apply migrations.

Migration executes through a controlled operation such as:

```text
dedicated command
one-shot OCI container
Kubernetes Job
approved deployment pipeline step
```

---

# 97. Migration Uses Dedicated Database Role

Normal API/Worker credentials do not have schema-migration privileges.

Migration uses its explicit database role.

---

# 98. PostgreSQL Version Is Controlled

Production uses a supported PostgreSQL version.

Arbitrary customer upgrades outside the compatibility matrix are unsupported until validated.

---

# 99. PostgreSQL Extensions Are Version-Controlled

The Targoman PostgreSQL profile includes approved extensions.

Deployment preflight verifies required versions.

Extension drift must be detectable.

---

# 100. Database Scheduling Extension Is Part of Supported Profile

Database Events depend on the approved scheduling extension.

Deployments using customer-managed PostgreSQL must provide a compatible approved equivalent where database Events are required.

---

# 101. PostgreSQL Backups Are Explicit

Backup policy may include:

- base/physical backup;
- logical backup where useful;
- WAL archiving;
- PITR;
- encrypted backup storage;
- off-site or independent copies.

Exact method follows the deployment class.

---

# 102. PostgreSQL PITR Is Preferred for Critical Deployments

Where RPO requires it, WAL-based Point-in-Time Recovery should be available.

The Profile defines retention sufficient to meet the configured RPO/recovery window.

---

# 103. Backup Storage Is Independent Enough to Survive Failure

A backup stored only on the same failed disk/host is not a meaningful disaster-recovery copy.

Deployment policy defines required independence.

---

# 104. Backups Are Encrypted Where Required

Protected backup data must receive appropriate:

- encryption;
- access control;
- retention;
- deletion.

Backup does not weaken Data Governance.

---

# 105. Restore Is Periodically Tested

Backup success is not proof of recoverability.

A restore drill verifies that data can actually be restored into a functioning compatible environment.

---

# 106. Restore Verification Includes Application Compatibility

A restore drill should verify:

- PostgreSQL consistency;
- migration registry;
- extension compatibility;
- application startup;
- Authority data;
- Audit continuity;
- representative business data.

---

# 107. Qdrant Is a Derived Availability Dependency

Qdrant affects semantic retrieval.

It does not own authoritative business truth.

---

# 108. Small Qdrant Deployment May Be Single-Node

A small profile may run one Qdrant instance.

Its loss temporarily disables semantic retrieval until restore/rebuild.

---

# 109. Enterprise Qdrant May Be Redundant

Where semantic-search RTO requires it, Qdrant may use:

- replication;
- clustered deployment;
- snapshots;
- redundant nodes.

The exact topology is deployment-specific.

---

# 110. Qdrant Recovery May Use Rebuild

Canonical recovery source is:

```text
PostgreSQL Metadata
+
Retained Document/Processing Artifacts
+
Index Profiles
```

Qdrant can be reconstructed.

---

# 111. Qdrant Snapshot Is an RTO Optimization

Snapshot/backup may accelerate recovery.

It does not turn Qdrant into authoritative truth.

---

# 112. Restore Must Validate Security Projection Freshness

Recovered Qdrant security metadata may be older than current Authority state.

Final candidate Authority checks continue to protect retrieval.

Stale derived security state must fail closed where necessary.

---

# 113. Index Generation Supports Blue/Green Rebuild

Large index changes may use:

```text
Active Generation A
        │
Build Generation B
        │
Validate
        │
Switch Active → B
        │
Retire A
```

This reduces reindex downtime.

---

# 114. Object Storage Is Authoritative for Retained Asset Bytes

Document metadata remains in PostgreSQL.

Retained content bytes may reside in:

```text
S3-compatible storage
persistent mounted storage
```

through Storage Core.

---

# 115. Small Deployments May Use Persistent Mounted Storage

A mounted persistent volume is valid when the accepted availability/recovery profile permits it.

The volume must survive application-container replacement.

---

# 116. Enterprise Storage May Use Redundant Object Storage

Higher availability profiles may use customer-managed or hosted redundant S3-compatible storage.

The application remains storage-provider independent.

---

# 117. Storage Versioning Is Policy-Driven

Object-store versioning may provide additional recovery protection.

It must not conflict with:

- legal deletion;
- retention;
- purge;
- Data Governance.

---

# 118. Provider Lifecycle Rules Must Not Override Governance

An object-store lifecycle rule such as:

```text
delete after 30 days
```

must not independently delete protected assets when Platform retention says otherwise.

---

# 119. Storage Integrity Uses Checksums

Document Assets should retain cryptographic checksums.

Restore/retrieval paths may verify integrity where required.

---

# 120. Storage Credentials Are Scoped

Application credentials should receive only required bucket/container/object permissions.

Public write access is prohibited.

---

# 121. AI Infrastructure Scales Independently

Model serving may run on:

```text
same host
dedicated GPU host
multiple GPU hosts
Kubernetes GPU nodes
customer-managed inference cluster
external provider
```

without changing module contracts.

---

# 122. Baseline GPU Topology May Use RTX4090

Normal deployments may use one or multiple RTX4090 endpoints for baseline tasks.

Example:

```text
AI Router
├── Aya Endpoint / RTX4090 #1
├── Aya Endpoint / RTX4090 #2
└── Aya Endpoint / RTX4090 #3
```

---

# 123. High Tier May Use H200 NVL

A Deployment may configure an H200-class endpoint tier for approved Tasks.

The presence of H200 does not make it the default execution path.

---

# 124. GPU Hardware Is Deployment Configuration

Modules do not know:

```text
RTX4090
H200
RTX6000
```

They request semantic Tasks.

AI Router selects eligible infrastructure.

---

# 125. Model Weights Are Versioned Artifacts

Local model deployments should identify:

- model;
- revision;
- quantization;
- checksum/provenance;
- compatible serving-engine version.

Using an uncontrolled mutable model directory is prohibited for production.

---

# 126. Model Artifacts May Be Distributed Separately From App Images

Large model weights need not be embedded inside application OCI images.

They may be delivered through an approved model-artifact mechanism.

The endpoint still identifies the exact model revision.

---

# 127. GPU Driver Compatibility Is Controlled

Supported combinations may include:

```text
GPU
Driver
CUDA
Serving Engine
Model Artifact
```

They form an infrastructure compatibility profile.

Arbitrary upgrades require validation.

---

# 128. Endpoint Warm-Up Is Expected

Model servers may take significant time to:

- load weights;
- allocate VRAM;
- initialize kernels;
- compile/cache execution paths.

Startup/readiness semantics must account for this.

---

# 129. Model Endpoint Is Not Ready Until It Can Accept Work

Process existence does not imply readiness.

Router must not send normal traffic before endpoint readiness.

---

# 130. AI Endpoint OOM Is an Operational Failure Class

GPU memory exhaustion should produce controlled health/capacity behavior.

It must not cause business modules to bypass Router policy.

---

# 131. AI Capacity Is Bounded

Endpoint capacity may consider:

- active sequences;
- queue;
- context size;
- token throughput;
- memory;
- serving-engine constraints.

Admission/Router policy protects the endpoint.

---

# 132. AI Failure Degrades AI Features Only Where Possible

If every AI endpoint fails:

```text
Document direct read
Ticket listing
CRM management
```

should remain available where their own dependencies are healthy.

---

# 133. Multiple AI Endpoints Provide Availability

A Task may have several compliant physical endpoints.

Router can fail over according to `07-ai-router.md`.

HA does not justify unsafe provider fallback.

---

# 134. External AI Availability Is Not Required for Local Deployments

A Deployment may operate fully with local AI endpoints.

Business modules must not assume a public AI provider exists.

---

# 135. Secrets Are a Separate Operational Capability

Secret material includes:

```text
database passwords
API credentials
JWT signing secrets
provider secrets
TLS private keys
object-storage credentials
machine credentials
```

Secrets do not belong in source or ordinary Deployment Profiles.

---

# 136. Secret Providers Are Replaceable

Secrets may be supplied through approved mechanisms such as:

```text
orchestrator-managed secret
mounted protected secret file
environment injection
external secret manager
customer enterprise secret infrastructure
```

Application code consumes a secret contract/reference.

---

# 137. Environment Variables Are Not Automatically Safe

Environment-variable delivery may be acceptable.

However:

- secret values must not be logged;
- diagnostic dumps must not expose them;
- frontend bundles must not contain them.

---

# 138. Frontend Receives No Server Secret

SvelteKit/browser code may receive only explicitly public runtime configuration.

No provider/database/signing secret enters the browser build.

---

# 139. Secrets Are Rotatable

Secret-dependent components must support controlled rotation where applicable.

Examples:

```text
DB credentials
provider API keys
signing keys
TLS certificates
```

---

# 140. Rotation Should Avoid Unnecessary Outage

Where infrastructure allows, rotation may use overlap:

```text
Old + New valid
    ↓
Deploy/Reload New
    ↓
Verify
    ↓
Revoke Old
```

---

# 141. Secret Rotation Is Auditable

Administrative changes to production secret references/versions should produce appropriate operational/security evidence without logging secret values.

---

# 142. Secret Recovery Is Part of Disaster Recovery

Disaster recovery must account for restoring access to required Secret material.

This does not mean copying plaintext secrets into ordinary backup archives.

The selected Secret infrastructure requires its own recovery strategy.

---

# 143. Signing Keys Require Explicit Recovery/Rotation Policy

Loss of signing keys may invalidate:

- sessions;
- signed tokens;
- signed contracts.

Deployment design must define expected recovery behavior.

---

# 144. Configuration Is Externalized

Application image content must not change merely because:

- customer name;
- domain;
- enabled module;
- DB host;
- model endpoint;
- integration

changes.

---

# 145. Configuration Is Validated at Startup

Invalid mandatory configuration should prevent readiness.

The runtime must not silently substitute dangerous defaults.

---

# 146. Configuration Keys Have Scope

A configuration key may be:

```text
build-time
deployment-time
tenant-time
module-time
instance-time
user preference
```

A key must not be overridable at inappropriate scopes.

---

# 147. Security Bounds Are Non-Overridable Downward

For example:

```text
Deployment:
External AI for Confidential data = forbidden

Tenant:
External AI = enabled
```

must still result in:

```text
forbidden
```

---

# 148. Dynamic and Restart-Required Configuration Are Different

Configuration should declare whether a change is:

```text
Dynamic
Requires Runtime Restart
Requires Endpoint Drain
Requires Migration
```

Operators should not guess.

---

# 149. Effective Configuration Is Inspectable Safely

Operators should be able to inspect effective non-secret configuration.

Secret values remain redacted.

---

# 150. Desired State Is Canonical

Deployment configuration source represents the approved desired state.

Manual production changes do not become canonical merely because they exist.

---

# 151. Configuration Drift Is Detectable

Deployment tooling should compare relevant effective state against desired state.

Examples:

```text
running image digest
module version
module enablement
route binding
DB extension version
AI endpoint definition
security setting
integration endpoint
```

---

# 152. Drift Severity Is Classified

Possible classes may include:

```text
INFORMATIONAL
OPERATIONAL
SECURITY_RELEVANT
REQUIRES_RECONCILIATION
```

Exact classification belongs to deployment tooling.

---

# 153. Security-Relevant Drift Is Auditable

Examples:

```text
unexpected external AI endpoint
unexpected module enabled
security limit weakened
unapproved image digest
unexpected public route
```

should create appropriate operator/security evidence.

---

# 154. Emergency Changes Must Be Reconciled

A production emergency may require manual change.

The process must record:

- incident;
- actor;
- change;
- reason;
- time.

After the incident, desired state must be updated or the emergency change reverted.

---

# 155. Observability Is a Deployment Requirement

Production operation requires sufficient visibility into:

```text
Web
API
Workers
PostgreSQL
Qdrant
Storage
AI endpoints
Jobs
Integrations
```

---

# 156. Observability Includes Multiple Evidence Classes

Operational observability may include:

```text
structured logs
metrics
health
traces where enabled
correlation IDs
alerts
```

This remains separate from business and security audit.

---

# 157. Distributed Tracing Is Optional but Supported

A deployment may enable distributed tracing to follow:

```text
Request
→ API
→ Application
→ Worker
→ Provider
```

Trace context must not contain sensitive business payloads.

---

# 158. Trace Sampling Is Policy-Controlled

Large deployments may sample operational traces.

Security/business audit requirements are independent from trace sampling.

---

# 159. Metrics Are Aggregatable

Metrics should support operational dimensions such as:

```text
deployment
runtime
module
tenant where safe
endpoint
job type
result
```

High-cardinality sensitive identifiers should not become uncontrolled labels.

---

# 160. Logs Are Structured

Operational logs should use structured fields.

Free-form logs alone are insufficient for major runtime operations.

---

# 161. Logs Never Contain Secrets

This includes:

- Access Tokens;
- Refresh Tokens;
- API keys;
- passwords;
- OTPs;
- private keys;
- provider credentials.

---

# 162. Full Confidential Payload Logging Is Prohibited by Default

Document content, prompts, letter bodies, and confidential user input must not be casually emitted to operational logs.

---

# 163. Log Retention Is Explicit

Operational logs may have shorter retention than:

- security audit;
- business history;
- financial records.

Retention follows Data Governance and deployment policy.

---

# 164. SOC / SIEM Integration Is Supported

Deployment may configure Security Telemetry Export in:

```text
Pull
Push
or both
```

modes.

---

# 165. SOC Pull Is Read-Only

SOC/SIEM consumers receive no database connectivity and no mutation interface.

Access is authenticated, Authority-controlled, filtered, and cursor-based.

---

# 166. SOC Push Is Durable

Required outbound security telemetry uses durable delivery state.

SOC outage must not erase canonical security evidence.

---

# 167. SOC Connectivity May Use Enterprise Network Controls

Deployment policy may require:

- mTLS;
- IP allow-list;
- private network;
- customer proxy;
- certificate pinning where justified.

Customer-specific protocol remains behind the Security Telemetry adapter.

---

# 168. Alerting Is Separate From Logging

Important conditions should produce operator-visible alerts rather than relying on someone reading logs.

Examples:

```text
PostgreSQL failover
backup failure
restore verification failure
Qdrant backlog
Worker dead-letter growth
AI endpoint unavailable
certificate expiry
security telemetry backlog
storage capacity threshold
configuration drift
```

---

# 169. Alerts Have Ownership

An alert should identify:

- component;
- severity;
- condition;
- relevant runbook;
- current state.

Repeated noise without actionable meaning should be avoided.

---

# 170. SLO Indicators Are Measured

Where SLOs are defined, deployment monitoring must measure corresponding indicators.

Possible indicators include:

- request availability;
- latency;
- error rate;
- Worker completion;
- AI availability;
- recovery time.

---

# 171. Availability SLO Does Not Mean Every Feature Is Always Available

A degraded optional subsystem may coexist with a healthy primary service.

Deployment SLOs should define what constitutes service availability.

---

# 172. Failure Domains Are Identified Explicitly

Examples:

```text
host
VM
physical server
rack
availability zone
network
storage system
database primary
GPU node
external provider
```

HA topology should avoid placing all redundant replicas in one avoidable failure domain.

---

# 173. Two Replicas on One Failed Host Are Not Host-Level HA

Replica count alone is insufficient.

Topology must consider actual shared failure domains.

---

# 174. Stateful Infrastructure HA Is Separate From App HA

Having:

```text
3 API replicas
```

does not provide complete high availability if:

```text
PostgreSQL = one unprotected node
```

Availability must be evaluated end-to-end.

---

# 175. Critical Paths Are Documented

A deployment should identify critical request paths.

Example:

```text
User
→ Gateway
→ API
→ PostgreSQL
```

for ordinary business requests.

For RAG:

```text
User
→ Gateway
→ API
→ PostgreSQL/Authority
→ Qdrant
→ AI Endpoint
```

Each additional dependency changes availability behavior.

---

# 176. Failure Isolation Is Deliberate

Subsystem failure should affect only dependent features where practical.

Example:

```text
SMS provider down
    → notification degraded
    → CRM remains usable

Qdrant down
    → semantic retrieval unavailable
    → Document direct access remains

H200 down
    → high-tier Tasks degraded
    → baseline 4090 Tasks remain where eligible
```

---

# 177. External Provider Failure Does Not Corrupt Business State

Failures of:

- email;
- SMS;
- calendar;
- external Secretariat;
- SOC;
- external AI

must follow durable retry/reconciliation semantics where required.

---

# 178. Circuit Breakers Reduce Cascading Failure

External/provider adapters may use circuit breakers.

Repeated failed calls must not consume all API/Worker capacity.

---

# 179. Bulkheads Protect Independent Workloads

Higher-scale deployments may isolate capacity for:

```text
interactive API
background jobs
AI generation
bulk imports
```

to prevent one workload from exhausting unrelated capacity.

---

# 180. Dependency Timeouts Are Bounded

Every network dependency must have intentional timeout behavior.

Infinite waits are prohibited.

---

# 181. Retry Budgets Are Bounded

Retry counts and deadlines must be controlled.

A dependency outage must not create uncontrolled retry amplification.

---

# 182. Retry Storm Prevention Is Required

Backoff, circuit breakers, Job scheduling, and Admission Control should cooperate to avoid synchronized retry storms.

---

# 183. Disaster Recovery Is Different From High Availability

High Availability aims to reduce interruption during component failure.

Disaster Recovery restores service after larger failure or corruption.

Both are required concepts.

---

# 184. RPO Defines Acceptable Data Loss Window

Deployment Profile may define Recovery Point Objective separately for data classes.

For example, authoritative relational data may require a stronger RPO than rebuildable semantic indexes.

Exact values are customer/deployment decisions.

---

# 185. RTO Defines Recovery-Time Objective

RTO may differ by capability.

For example:

```text
PostgreSQL business service
    → high priority recovery

Qdrant semantic index
    → may recover later when direct business functions can operate without it
```

---

# 186. Recovery Priority Follows Authority of Data

Typical recovery priority is:

```text
1. Deployment / infrastructure prerequisites
2. Secret and trust prerequisites
3. PostgreSQL authoritative state
4. Authoritative Document Asset storage
5. Application runtimes
6. Durable Job / Outbox processing
7. Derived Qdrant state
8. Optional integrations / caches
```

Exact order depends on deployment requirements.

---

# 187. Derived State May Be Rebuilt After Service Returns

The system need not delay all service recovery until:

```text
Qdrant fully rebuilt
```

when non-RAG business functionality can safely operate earlier.

---

# 188. Disaster Types Include Logical Corruption

DR planning must include more than hardware loss.

Possible scenarios:

```text
host failure
storage loss
database corruption
accidental deletion
bad deployment
bad migration
credential loss
data-center outage
ransomware/security incident
```

---

# 189. Restore Point Must Avoid Reintroducing Known Corruption

PITR selection may require choosing a point before:

- destructive mutation;
- faulty migration;
- compromise.

Operators must understand the incident timeline.

---

# 190. Restore Creates Reconciliation Obligations

After restoring authoritative state to an earlier time, external systems may contain effects newer than the restored database.

Examples:

```text
payment completed externally
email sent
external task created
letter registered
```

These require reconciliation.

---

# 191. Durable External Side Effects Are Reconciled After Restore

Recovery runbooks must identify integration domains that require post-restore reconciliation.

Blind replay may create duplicate side effects.

---

# 192. Job Queues Require Post-Restore Review

Restored Jobs/Outbox rows may represent work that already executed before the disaster.

Idempotency and reconciliation are mandatory during replay.

---

# 193. Backup Does Not Include Ephemeral Container State

Recovery must not depend on:

- container writable layer;
- local process memory;
- temporary files not registered as required artifacts.

---

# 194. Backup Inventory Is Explicit

Recovery documentation should identify backup/rebuild strategy for:

```text
PostgreSQL
Object Storage
Qdrant
Configuration
Secret infrastructure
Audit
Model/config artifacts
```

---

# 195. Backup Monitoring Is Required

Backup jobs require observable:

```text
last success
last failure
age
size
retention status
```

Silent backup failure is unacceptable.

---

# 196. Restore Drills Are Scheduled

Production/high-assurance profiles define periodic restore verification.

A backup strategy without tested restore is incomplete.

---

# 197. DR Runbooks Are Versioned

Runbooks must match current:

- architecture;
- database version;
- storage topology;
- deployment tooling.

A stale runbook is an operational defect.

---

# 198. Recovery Exercises Produce Reports

A recovery drill should record:

```text
scenario
starting state
steps
actual RPO
actual RTO
problems
corrective actions
```

---

# 199. Upgrade Is a Controlled Deployment Operation

Production upgrade conceptually follows:

```text
Select Release
    ↓
Verify Artifacts
    ↓
Validate Profile
    ↓
Compatibility Preflight
    ↓
Backup / Recovery Safety Gate
    ↓
Apply Expansion Migrations
    ↓
Deploy Compatible Runtime
    ↓
Migrate / Backfill
    ↓
Switch Traffic / Behavior
    ↓
Contract Old Schema When Safe
    ↓
Post-Deploy Verification
```

---

# 200. Upgrade Uses Expand-Migrate-Contract Where Needed

Rolling deployments must avoid a period in which old and new application replicas require mutually incompatible schemas.

---

# 201. Migration and Application Deployment Are Coordinated

Migration compatibility identifies:

```text
old application compatible?
new application compatible?
rollback possible?
forward fix required?
```

before production deployment.

---

# 202. Backup Safety Gate Precedes Risky Migration

Before an irreversible/high-risk migration:

- backup state must be current enough;
- restore mechanism must be viable;
- rollback/forward-fix plan must be known.

---

# 203. Database Rollback Is Not Assumed Safe

For high-value or append-only data, destructive rollback may be unsafe.

Forward-fix migration is preferred where required.

---

# 204. Application Rollback Requires Schema Compatibility

Rolling back to a previous application version is valid only if the current schema/configuration remains compatible.

Deployment tooling must not assume "redeploy old image" is always safe.

---

# 205. Release Rollback and Business Data Rollback Are Different

Reverting application binaries does not mean reverting customer data.

These operations require separate decisions.

---

# 206. Configuration Changes Participate in Upgrade

A release may require:

- new configuration;
- configuration migration;
- deprecated settings;
- changed secrets.

These requirements are versioned and validated.

---

# 207. Module Upgrades Are Part of Platform Upgrade

Installed module versions and migrations participate in compatibility validation.

Optional absent modules do not block deployment unless their retained data requires a migration contract.

---

# 208. AI Model Rollout Is Separately Controllable

Changing application release does not require immediately changing production models.

AI model/policy rollout may use separate:

```text
evaluation
canary
drain
promotion
rollback
```

procedures.

---

# 209. Model Rollback Does Not Require Business Rollback

Because Tasks are semantic, a model endpoint may be reverted independently where contract compatibility remains valid.

---

# 210. Zero-Downtime Is a Profile Objective, Not a Universal Claim

Small deployments may accept maintenance windows.

HA profiles may require rolling upgrade or controlled failover.

The architecture supports both.

---

# 211. Rolling Deployment Requires Readiness

New replicas receive traffic only after:

- startup;
- compatibility;
- dependency checks;
- readiness.

---

# 212. Old Replica Drains Before Termination

Traffic is removed before process shutdown.

This prevents unnecessary request failure during normal deployment.

---

# 213. Worker Version Compatibility Is Considered

During rolling upgrades, old and new Workers may coexist temporarily.

Job payload and persistence contracts must remain compatible during that window or deployment must coordinate a Worker drain.

---

# 214. Job Payloads Are Versioned Where Needed

Durable Jobs may survive a deployment.

Their payload cannot assume that exactly one application build will ever consume them.

---

# 215. Outbox Events Are Version-Compatible

Events committed before an upgrade may be consumed afterward.

Consumer compatibility must account for this.

---

# 216. Upgrade Failure Is Explicit

Deployment tooling must stop and surface failure when a safety gate fails.

It must not continue blindly after:

- migration error;
- incompatible config;
- failed readiness;
- failed compatibility check.

---

# 217. Post-Deployment Verification Is Mandatory

Verification should cover representative:

```text
authentication
authorization
database access
Job processing
Document access
Qdrant health
AI Task
critical integration
```

according to deployment capability.

---

# 218. Deployment Acceptance Uses Synthetic Tests

Where appropriate, production-safe synthetic checks verify critical flows without modifying real customer data.

---

# 219. Operational Ownership Is Explicit

For each deployed dependency, the Deployment Profile or operating agreement should identify its operator.

Examples:

```text
Targoman-managed
Customer-managed
Shared responsibility
External provider-managed
```

---

# 220. Customer-Managed Infrastructure Has Compatibility Requirements

When a customer provides:

- PostgreSQL;
- Qdrant;
- Object Storage;
- Gateway;
- GPU infrastructure;

the platform defines supported versions/capabilities.

Customer ownership does not remove compatibility requirements.

---

# 221. Responsibility Boundary Is Documented

For customer-managed components, documentation should answer:

```text
Who patches it?
Who backs it up?
Who monitors it?
Who restores it?
Who owns certificates?
Who rotates credentials?
Who responds to failure?
```

Ambiguous operational ownership is a reliability risk.

---

# 222. External Managed Services Need the Same Semantic Guarantees

A managed PostgreSQL/Qdrant/Object Store is acceptable only if required platform semantics remain available.

Managed status does not automatically make a component compatible.

---

# 223. Infrastructure Admin Access Is Separate From Application Authority

Operating-system, Kubernetes, database-superuser, or cloud-console authority is not an application Role.

Infrastructure privileges require separate operational governance.

---

# 224. Infrastructure Break-Glass Is Audited

Emergency infrastructure access should be:

- exceptional;
- bounded;
- strongly authenticated;
- logged;
- reviewed.

It must not be used as an ordinary application administration path.

---

# 225. Application Operators Do Not Receive Infrastructure Secrets

A Tenant Admin or module administrator does not automatically receive:

- DB password;
- object-store key;
- Kubernetes credential;
- GPU-host SSH access.

Application and infrastructure authority remain separate.

---

# 226. Capacity Planning Is Continuous

Production capacity planning considers:

```text
active users
request rate
concurrency
database load
Job backlog
document volume
vector count
storage growth
AI tokens
GPU utilization
```

---

# 227. Scale Thresholds Are Evidence-Based

Resource scaling should be based on observed performance and SLO needs rather than arbitrary replica counts.

---

# 228. Autoscaling Is Optional

A deployment may autoscale:

- Web;
- API;
- Workers;
- selected inference pools

where infrastructure supports it.

Autoscaling is not required for every installation.

---

# 229. Autoscaling Does Not Replace Admission Control

Scale-up has delay and finite capacity.

Admission Control still protects the platform during sudden demand or saturated maximum capacity.

---

# 230. Worker Autoscaling Should Consider Queue Age

Queue depth alone may be misleading.

Useful signals include:

```text
oldest Job age
arrival rate
processing rate
queue depth
job class
```

---

# 231. AI Autoscaling Uses AI-Specific Metrics

CPU alone is insufficient for GPU/model serving.

Useful signals may include:

```text
active sequences
queue depth
GPU memory
GPU utilization
TTFT
token throughput
```

---

# 232. Scale-In Is Graceful

Reducing replicas must:

- drain requests;
- release Job claims safely;
- drain AI executions where applicable.

Abrupt scale-in must not corrupt work.

---

# 233. Database Scaling Is Conservative

PostgreSQL vertical scaling, indexing, partitioning, query optimization, pooling, and replicas should be considered before introducing premature distributed-database complexity.

---

# 234. Application Architecture Must Not Prevent Future Database Evolution

Although PostgreSQL is initially one authoritative relational system, ownership boundaries and explicit tenant IDs should keep future scaling options open.

---

# 235. No Premature Tenant Sharding Requirement

The initial architecture does not require one database per Tenant or automatic tenant sharding.

Such topology requires a demonstrated scale/security need.

---

# 236. Dedicated Tenant Deployment Remains Supported

A customer requiring physical isolation may receive a dedicated Deployment containing one Tenant without changing application semantics.

---

# 237. Data Residency May Affect Topology

Deployment and Data Governance may require specific:

- region;
- data center;
- storage location;
- AI endpoint locality.

These constraints become deployment/routing policy.

---

# 238. Backups Must Respect Residency

Backup copies must not silently leave the permitted data region.

---

# 239. SOC Export Must Respect Residency and Redaction

Security telemetry sent to an external SOC may contain sensitive operational information.

Data Governance and export policy apply.

---

# 240. Monitoring Backends Are Not Exempt From Data Governance

Logs/traces/metrics exported to external monitoring infrastructure must obey:

- redaction;
- classification;
- residency;
- retention.

---

# 241. Production Access Is Observable

Administrative production access should create appropriate audit/operational evidence.

This includes:

- deployment;
- configuration change;
- migration;
- secret rotation;
- emergency operation.

---

# 242. Operational Commands Are Idempotent Where Practical

Deployment scripts and IaC should converge safely when rerun.

A partially completed deployment should be recoverable without manual mystery state.

---

# 243. Infrastructure-as-Code Is Preferred

Repeatable deployments should use version-controlled declarative or scripted infrastructure definitions where practical.

Manual undocumented infrastructure setup is discouraged.

---

# 244. Risky IaC Operations Have Plan/Dry-Run

Destructive changes should expose a visible plan before execution where tooling supports it.

---

# 245. Postconditions Are Verified

A deployment command is not successful merely because its process exited zero.

Important operations verify resulting state.

---

# 246. Production Deployment Produces a Report

Useful deployment evidence may include:

```text
release version
artifact digests
migration versions
module versions
configuration revision
deployment start/end
operator/automation identity
health verification
exceptions
```

---

# 247. Runbooks Are Part of Production Readiness

Critical operational scenarios require runbooks.

Examples:

```text
PostgreSQL failover
database restore
Qdrant rebuild
object-storage recovery
AI endpoint replacement
certificate rotation
secret rotation
stuck Job recovery
SOC backlog
configuration drift
```

---

# 248. Runbooks Prefer Verifiable Procedures

A runbook should specify:

- preconditions;
- steps;
- safety gates;
- expected state;
- postconditions;
- rollback/recovery path.

---

# 249. Runbook Automation Is Preferred Where Safe

Frequently repeated, deterministic operational procedures should become tested automation instead of relying indefinitely on operator memory.

---

# 250. Deployment Tests Are Required

Deployment architecture requires automated tests where practical for:

- image startup;
- configuration validation;
- missing Secret;
- readiness;
- graceful shutdown;
- migration Job;
- module composition;
- route binding.

---

# 251. Container Tests Are Required

Tests should verify:

- expected user;
- required filesystem permissions;
- no unintended persistent state;
- health endpoints;
- startup behavior;
- version reporting.

---

# 252. Compose / Podman Deployment Is Tested

Small-deployment support is not merely documentation.

Release qualification should prove that the supported simple deployment profile starts and operates correctly.

---

# 253. Kubernetes Deployment Is Tested Where Supported

Kubernetes qualification should test:

- probes;
- replica replacement;
- rolling update;
- persistent volumes;
- Secrets;
- migration Job;
- Worker drain.

---

# 254. HA Tests Are Required for HA Profiles

Where HA is sold/declared, tests must verify actual failover behavior.

Replica count alone is insufficient.

---

# 255. API Replica Failure Test

Tests should prove that loss of one API replica does not destroy:

- sessions;
- Jobs;
- authorization state;
- business state.

Remaining replicas continue serving traffic where capacity permits.

---

# 256. Worker Failure Test

A Worker process may terminate during active work.

The Job must:

```text
complete durably
or
become reclaimable/recoverable
```

according to its semantics.

---

# 257. PostgreSQL Failover Test

HA deployment qualification should verify:

- primary failure;
- standby promotion;
- application reconnection;
- no split-brain;
- expected RTO;
- consistency.

---

# 258. Qdrant Failure Test

Tests verify that:

- authoritative Documents remain intact;
- semantic retrieval degrades explicitly;
- restore/rebuild succeeds;
- service resumes.

---

# 259. Object Storage Failure Test

Tests should verify controlled behavior when Asset storage becomes unavailable.

Metadata must not falsely report inaccessible Assets as successfully delivered.

---

# 260. AI Endpoint Failure Test

Tests should verify:

- health change;
- Router exclusion;
- allowed fallback;
- forbidden fallback;
- recovery.

---

# 261. Gateway Failure Test

HA edge deployments should verify failover or redundant gateway behavior where applicable.

---

# 262. Network Partition Tests Are Valuable

High-assurance deployments should test selected partition scenarios such as:

```text
API ↔ PostgreSQL loss
Worker ↔ provider loss
Router ↔ model endpoint loss
API ↔ Qdrant loss
```

The platform must fail predictably.

---

# 263. Fault Injection Tests Are Required for Critical Profiles

Production qualification may simulate:

- process termination;
- host failure;
- dependency timeout;
- disk full;
- provider outage;
- connection exhaustion;
- certificate failure.

Exact suite depends on deployment risk.

---

# 264. Load Tests Are Required

Performance qualification should use representative:

- request mix;
- data volume;
- tenant mix;
- AI workload;
- concurrent users.

Synthetic microbenchmarks alone are insufficient.

---

# 265. Soak Tests Are Required Where Reliability Warrants It

Long-running tests should detect:

- memory leaks;
- connection leaks;
- queue growth;
- log growth;
- degraded GPU performance;
- slow resource exhaustion.

---

# 266. Backup Tests Are Required

Tests verify:

- backup execution;
- retention;
- encryption where required;
- failure alerting;
- recoverability.

---

# 267. Restore Tests Are Mandatory

A successful restore test must bring a representative environment to usable application state.

Checking that a backup file exists is insufficient.

---

# 268. PITR Tests Are Required Where PITR Is Claimed

Tests should recover to a chosen point and verify expected included/excluded transactions.

---

# 269. Upgrade Tests Are Required

Release qualification includes:

```text
previous supported release
    ↓
upgrade
    ↓
current release
```

with representative data.

---

# 270. Rolling Compatibility Tests Are Required Where Rolling Upgrade Is Claimed

Old and new API/Worker versions may temporarily coexist.

Tests must verify compatibility during the supported transition window.

---

# 271. Rollback Tests Are Required Where Rollback Is Claimed

A rollback procedure must be actually executable under the documented schema/configuration conditions.

---

# 272. Drift Detection Is Tested

Deployment tests should detect at least representative unauthorized changes such as:

- wrong image digest;
- changed endpoint;
- missing extension;
- unexpected module enablement.

---

# 273. Supply-Chain Verification Is Tested

Where signing/provenance enforcement is enabled, deployment should reject an unapproved or incorrectly signed artifact.

---

# 274. Secret Rotation Is Tested

Critical production credentials should have tested rotation procedures.

A rotation plan that has never been exercised is an operational risk.

---

# 275. Certificate Renewal Is Tested Where Automated

Automated certificate management should be verified before expiry becomes an incident.

---

# 276. Recovery-Time Evidence Is Measured

DR tests record actual restoration time.

RTO compliance is demonstrated, not assumed.

---

# 277. Recovery-Point Evidence Is Measured

Restore tests determine the actual recoverable point.

RPO claims should be supported by observed backup/WAL behavior.

---

# 278. Alert Tests Are Required

Important alerts should be triggerable in test/staging or through safe synthetic mechanisms.

An alert definition that has never been observed is not sufficient evidence.

---

# 279. SOC Delivery Tests Are Required Where Enabled

Tests cover:

- authorized pull;
- unauthorized pull;
- push success;
- destination outage;
- retry;
- duplicate delivery;
- redaction;
- backlog recovery.

---

# 280. Security Tests Include Deployment Boundaries

Relevant tests include:

- DB inaccessible externally;
- Qdrant inaccessible externally;
- model endpoint inaccessible to browser;
- Secrets not in frontend;
- least-privilege DB role;
- disallowed egress;
- unsigned artifact rejection where enabled.

---

# 281. Deployment Documentation Is Versioned

Deployment instructions must match a supported Platform release.

Generic stale wiki instructions are not sufficient production documentation.

---

# 282. Generated Configuration Reference Is Preferred

Where practical, documentation for:

- Profile schema;
- configuration fields;
- environment variables;
- required Secrets

should derive from canonical configuration schemas.

---

# 283. Unsupported Configuration Is Rejected

The platform must not silently accept unknown critical configuration and ignore it.

Typos in security/deployment configuration should fail validation where practical.

---

# 284. Runtime Version Endpoint Is Available to Operators

An approved operational endpoint or command should identify:

```text
Platform version
Build/revision
Module versions
Configuration revision
```

without exposing Secrets.

---

# 285. Infrastructure Compatibility Is Inspectable

Operators should be able to determine relevant:

```text
PostgreSQL version/extensions
Qdrant version
AI endpoint/serving versions
```

for diagnostics and support.

---

# 286. Support Bundles Are Sanitized

If the platform generates diagnostic/support bundles, they must exclude or redact:

- Secrets;
- tokens;
- confidential Document content;
- raw protected prompts

unless an explicit secure diagnostic workflow authorizes inclusion.

---

# 287. Customer-Specific Deployment Does Not Require Source Fork

Customer-specific:

- domain;
- route;
- brand;
- module set;
- AI endpoints;
- integrations;
- network;
- SLO;
- backup;
- SOC

belong to Deployment Profiles and adapters.

---

# 288. Customer-Specific Infrastructure Adapter Is Explicit

Where a customer requires proprietary:

- Secret manager;
- SOC;
- Object Storage;
- IdP;
- Gateway

support, integration occurs through the corresponding Platform adapter rather than business-module forks.

---

# 289. Deployment Is Reproducible

Given:

```text
approved artifact set
+
versioned Deployment Profile
+
required Secret references
+
supported external infrastructure
```

the installation should be reproducible without undocumented manual history.

---

# 290. Final Deployment Rule

The deployment architecture follows these rules:

```text
Deployment is not Tenant.

Deployment is not Environment.

One product supports small and enterprise topology.

Kubernetes is optional.

OCI is the standard delivery artifact.

Application images are immutable.

Persistent truth never lives only in ephemeral containers.

Web and API are horizontally replicable.

Workers use durable shared Job state.

Ordinary HTTP does not require sticky sessions.

Graceful shutdown and draining are mandatory.

Health, readiness, and liveness have different meanings.

Optional dependency failure causes degradation, not unnecessary total outage.

PostgreSQL owns relational truth.

PostgreSQL replication does not replace backup.

HA PostgreSQL has one authoritative writer.

Migrations run through a controlled single migration path.

Qdrant is derived and rebuildable.

Qdrant backup is an RTO optimization.

Object Storage is private and policy-controlled.

AI/GPU infrastructure scales independently.

RTX4090 remains a valid baseline execution tier.

H200 is a policy-selected high tier, not a deployment assumption.

Model artifacts and infrastructure versions are controlled.

Secrets are externalized and rotatable.

Configuration represents desired state.

Configuration drift is detectable.

Software artifacts have digest/provenance/SBOM controls.

Public exposure is minimized.

Network egress is controlled.

TLS protects untrusted transport.

Observability is structured.

SOC/SIEM export is controlled and durable.

HA and DR are different concerns.

RPO and RTO belong to Deployment Profiles.

Backup success is not proof of restore capability.

Restore testing is mandatory.

Derived state may recover after authoritative service returns.

Post-restore external effects require reconciliation.

Upgrade uses compatibility-aware staged migration.

Rollback is not assumed safe.

Model rollout can occur independently from application rollout.

Failure domains matter more than replica count.

Admission Control and backpressure remain required even when autoscaling exists.

Operational ownership is explicit.

Customer-managed infrastructure still obeys compatibility contracts.

Production operations are auditable.

Runbooks are part of readiness.

HA, restore, upgrade, failover, load, and fault behavior are tested.

Customer customization normally requires configuration, not source forks.
```

The default deployment question is:

> **What must remain available, what state is authoritative, which failures can this topology tolerate, how is overload bounded, how is every critical state backed up and restored, what exact artifact/configuration is running, and which test proves the claimed availability and recovery behavior?**

# T3 ADDENDUM — Production AI Router and CJSON Configuration Capability

This addendum is mandatory for T3.

Where this addendum conflicts with the earlier T3 prompt, this addendum takes precedence.

Two additional T3 completion requirements are now explicit:

1. the production AI Router must be fully implemented and used by every AI request;
2. the platform configuration capability must be implemented as a first-class, typed, comprehensive CJSON-based subsystem.

T3 is NOT complete if Translator, Summarizer, or FAQ still select or call a vLLM/model endpoint directly.

T3 is NOT complete if normal platform configuration is spread across environment variables.

---

# A. Study the Proven Sepidjoo Configuration Implementation First

Before implementing target configuration:

1. locate the actual Sepidjoo repository available to this development environment;
2. locate its configuration subsystem;
3. inspect the actual source, not documentation summaries or memory;
4. identify:
   - configuration loader;
   - CJSON parser;
   - typed access pattern;
   - configuration hierarchy;
   - defaults;
   - module configuration;
   - validation;
   - reload behavior;
   - error behavior;
   - secret handling;
   - path resolution;
   - test coverage;
   - configuration examples;
   - any deployment-specific behavior.

Create a source-evidence table:

```text
Sepidjoo source path
Behavior
Target decision
Reuse type:
  DIRECT_PATTERN
  ADAPT
  REFERENCE_ONLY
  REJECT
Reason
```

Do not modify the Sepidjoo repository.

Do not reconstruct the Sepidjoo configuration subsystem from memory.

The target architecture remains authoritative where Sepidjoo assumptions conflict with it.

---

# B. Configuration Is a First-Class Platform Capability

Implement one canonical shared configuration capability.

Preferred conceptual target:

```text
packages/configuration
```

or the architecture-consistent equivalent if an already-approved package name exists.

Do not scatter configuration parsing across:

```text
apps/api
apps/web
apps/worker
packages/ai-router
modules/*
```

Those consumers receive typed configuration projections from the Configuration capability.

---

# C. CJSON Is the Primary Configuration Format

Normal application and customer configuration MUST use CJSON / JSON-with-comments.

Example intent:

```cjson
{
  // Customer deployment identity
  "deployment": {
    "id": "customer-a-prod",
    "tenant": "customer-a"
  },

  // Runtime-selectable public modules
  "modules": {
    "translator": {
      "enabled": true
    },

    "summarizer": {
      "enabled": true
    },

    "faq": {
      "enabled": false
    }
  }
}
```

Comments are an intentional operator feature.

While CJSON is a preferred format over JSON, the configuration subsystem is allowed to accept equivalent JSON-only/YAML files.

Do not require operators to encode ordinary configuration through ENV variables.

---

# D. Environment Variables Are NOT the General Configuration System

The project intentionally avoids ENV-driven application configuration.

Environment variables are allowed only when genuinely necessary for:

- Docker/Compose bootstrap;
- container/runtime bootstrapping;
- infrastructure-required conventions;
- locating the main configuration file where a CLI argument or conventional mount path cannot reasonably be used;
- emergency secret injection where a file/secret provider is unavailable.

Environment variables must NOT become an arbitrary override layer for normal configuration.

Forbidden target pattern:

```text
APP_NAME
AI_URL
AI_MODEL
MODULE_TRANSLATOR_ENABLED
MODULE_FAQ_ENABLED
BRAND_COLOR
SIEM_URL
TRANSLATE_LIMIT
SUMMARIZE_LIMIT
...
```

Normal values belong in CJSON.

---

# E. Prefer Mounted CJSON

Production/container deployments should preferably mount configuration at a stable location such as conceptually:

```text
/etc/targoman/platform.cjson
```

The actual path must be architecture/documentation controlled.

Configuration location may be selected by:

1. explicit command-line argument;
2. deployment/runtime mount convention;
3. narrowly scoped bootstrap ENV only if necessary.

Do not require rebuilding the image to change configuration.

---

# F. Secrets Are Not Plain CJSON Values

CJSON contains configuration and secret REFERENCES.

It should not normally contain actual passwords, tokens or private keys.

Conceptual example:

```cjson
{
  "postgres": {
    "host": "postgres",
    "port": 5432,
    "database": "targoman_platform",
    "role": "targoman_api",

    "password": {
      "secretRef": "file:/run/secrets/postgres_api_password"
    }
  }
}
```

Supported secret providers in T3 should include at least a mounted file provider.

Design the contract so future providers can include:

```text
Docker Secret
Kubernetes Secret
Vault / enterprise secret manager
```

without changing consumers.

Never return secret values through generic config inspection/logging.

---

# G. No Generic ENV Overlay

Do not implement:

```text
CJSON
  ↓
overwrite anything matching process.env
```

This creates invisible configuration drift.

Only explicitly registered bootstrap/secret integration may read ENV.

Configuration precedence must be deterministic and documented.

---

# H. Configuration Hierarchy

The Configuration capability must implement the approved hierarchy:

```text
Platform Defaults
      ↓
Build/Profile Defaults where genuinely required
      ↓
Deployment Profile
      ↓
Tenant Configuration
      ↓
Module / Instance Configuration
      ↓
User Preference
```

T3 currently needs primarily:

```text
Platform Defaults
Deployment
Tenant
Module
```

because there is no authenticated user preference layer yet.

Do not invent fake users to satisfy the hierarchy.

---

# I. Override Policy Is Explicit

Every configuration area must define which lower layer may override it.

Security bounds must not be weakened by a lower layer.

Example:

```text
platform security maximum upload size
        ↓
deployment may choose <= maximum
        ↓
module may choose <= deployment maximum
```

A module must not raise itself beyond a platform/deployment security limit.

---

# J. Typed Configuration

Consumers must never work against:

```ts
Record<string, unknown>
```

or arbitrary object traversal.

Expose strict named TypeScript configuration types such as conceptually:

```text
intfPlatformConfiguration
intfDeploymentConfiguration
intfBrandConfiguration
intfAiRouterConfiguration
intfAiEndpointConfiguration
intfAdmissionConfiguration
intfSiemConfiguration
```

Follow project naming conventions exactly.

No `any`.

Unknown input is validated before becoming a trusted config snapshot.

---

# K. Configuration Schema Validation

Every CJSON file must be validated.

Validation must detect:

- unknown keys where they likely indicate a typo;
- missing required keys;
- invalid enum values;
- invalid URLs;
- invalid numeric ranges;
- duplicate IDs;
- invalid module references;
- AI policy referencing nonexistent endpoints;
- secret field containing forbidden inline material;
- invalid route bindings;
- contradictory limits;
- invalid branding paths;
- invalid SIEM destinations;
- invalid deployment/tenant identity.

Fail fast with useful path-aware errors.

Example:

```text
ai.endpoints.gpu-a.timeoutMs:
expected positive integer, got -1
```

Never print secret contents.

---

# L. Configuration Versioning

Configuration must carry an explicit schema/version identity.

For example conceptually:

```cjson
{
  "configVersion": 1
}
```

The loader must reject unsupported future versions.

Do not silently reinterpret incompatible configuration.

Document the configuration upgrade policy.

---

# M. Immutable Validated Snapshot

Consumers operate on an immutable validated configuration snapshot.

They do not repeatedly parse CJSON or read files themselves.

Conceptual flow:

```text
CJSON Files
   ↓
Parser
   ↓
Validation
   ↓
Hierarchy / Merge
   ↓
Security-Bound Enforcement
   ↓
Secret References
   ↓
Immutable Configuration Snapshot
   ↓
Typed Consumer Projections
```

---

# N. Reload Semantics

Classify configuration keys explicitly as:

```text
STARTUP_ONLY
RELOADABLE
```

Examples that are normally startup-sensitive:

```text
database endpoint
database roles
listener ports
fundamental deployment identity
```

Potentially reloadable settings may include, where safe:

```text
branding
AI endpoint enablement/weights
routing preference
anonymous quotas
SIEM export policy
some module presentation settings
```

Do not assume every setting can safely hot-reload.

---

# O. Atomic Reload

If reload is implemented:

1. detect/request reload;
2. parse complete candidate configuration;
3. validate complete candidate configuration;
4. resolve secret references;
5. build immutable candidate snapshot;
6. only then atomically replace the active snapshot.

Invalid reload:

```text
new config invalid
→ keep previous good snapshot
→ emit safe operational error
→ emit configuration-change audit evidence
```

Never leave consumers with a partially updated configuration.

---

# P. Configuration Change Accountability

Configuration changes affecting security/runtime behavior must be observable.

Record safe configuration change metadata such as:

```text
configuration version
old snapshot fingerprint
new snapshot fingerprint
source
reload timestamp
result
```

Do NOT persist:

```text
secret values
private keys
passwords
tokens
```

Manual drift outside the canonical desired-state configuration is a defect.

---

# Q. Config Fingerprint

Produce a deterministic safe fingerprint of effective non-secret configuration.

Use it for:

- readiness;
- debugging;
- audit correlation;
- deployment drift checks.

Secret values must not affect logged/plaintext fingerprint material in a way that exposes them.

---

# R. Customer Configuration Must Be Comprehensive

T3 customer deployment CJSON must be able to configure at least:

```text
deployment identity
tenant identity
enabled modules
public route bindings
brand profile
PostgreSQL connection metadata
AI Router endpoints
AI task policies
anonymous Admission policy
Usage dimensions/configuration
Audit policy
Operational logging policy
SIEM push
file-processing limits
HTTP/security bounds
worker settings
retention references
```

Do not introduce separate unrelated configuration systems for these areas.

---

# S. BrandProfile Comes From Configuration

Branding must be represented in CJSON or referenced from it.

Example conceptually:

```cjson
{
  "brand": {
    "displayName": "Customer AI",
    "shortName": "Customer",
    "logo": "/brand/logo.svg",
    "favicon": "/brand/favicon.ico",

    "tokens": {
      "primary": "#..."
    },

    "support": {
      "url": "https://..."
    }
  }
}
```

Branding is runtime/deployment identity, not source package identity.

---

# T. Module Enablement Comes From Configuration

Example:

```cjson
{
  "modules": {
    "translator": { "enabled": true },
    "summarizer": { "enabled": false },
    "faq": { "enabled": true }
  }
}
```

The same configuration controls:

- navigation contribution;
- public route availability;
- API availability;
- Admission policy registration;
- AI task registration;
- readiness expectations.

Do not maintain five separate enablement flags.

---

# U. AI Router Is Mandatory T3 Production Infrastructure

Implement the actual:

```text
packages/ai-router
```

as a canonical shared platform capability.

At the end of T3:

```text
Translator
Summarizer
FAQ
```

must make **zero direct vLLM/model/provider calls**.

Required flow:

```text
Module Application Service
        ↓
Semantic AI Request
        ↓
Admission Control
        ↓
AI Router
        ↓
Routing Policy
        ↓
Selected AI Endpoint
        ↓
Provider Adapter
        ↓
vLLM / compatible serving runtime
```

---

# V. Business Modules Must Not Know Model or Endpoint

Translator asks for:

```text
TRANSLATE
```

Summarizer asks for:

```text
SUMMARIZE
```

FAQ asks for:

```text
GENERATE_FAQ
```

They must not contain:

```text
model name
base URL
GPU identifier
vLLM hostname
provider-specific retry logic
endpoint priority
endpoint weight
```

Those belong to AI Router configuration/policy.

---

# W. Model != Endpoint != Provider

Preserve these as different concepts:

```text
Model
Endpoint
Provider / Serving Adapter
```

Example:

```text
Model:
  targoman-aya-8b

Endpoint:
  gpu-node-a

Provider:
  OPENAI_COMPATIBLE
```

One model may be exposed by multiple endpoints.

One endpoint may serve different deployment-selected models over time.

Routing must not collapse these concepts into one string.

---

# X. AI Endpoint CJSON Configuration

AI endpoints must be configured through CJSON.

Conceptual example:

```cjson
{
  "ai": {
    "endpoints": {
      "gpu-a": {
        "enabled": true,
        "provider": "OPENAI_COMPATIBLE",
        "baseUrl": "http://10.0.0.11:8000",
        "model": "targoman",
        "capabilities": [
          "TRANSLATE",
          "SUMMARIZE",
          "GENERATE_FAQ"
        ],
        "priority": 100,
        "weight": 10,
        "timeouts": {
          "connectMs": 1000,
          "firstTokenMs": 5000,
          "totalMs": 120000
        },
        "capacity": {
          "maxConcurrent": 20
        }
      },

      "gpu-b": {
        // Second vLLM endpoint
        "enabled": true,
        "provider": "OPENAI_COMPATIBLE",
        "baseUrl": "http://10.0.0.12:8000",
        "model": "targoman",
        "capabilities": [
          "TRANSLATE",
          "SUMMARIZE"
        ],
        "priority": 90,
        "weight": 5
      }
    }
  }
}
```

This is conceptual only; use final typed schema established by implementation.

---

# Y. Task Routing Policy Is CJSON

Routing policy must also be configuration-driven.

Conceptually:

```cjson
{
  "ai": {
    "tasks": {
      "TRANSLATE": {
        "requiredCapabilities": ["TRANSLATE"],
        "preferredEndpoints": ["gpu-a", "gpu-b"]
      },

      "SUMMARIZE": {
        "requiredCapabilities": ["SUMMARIZE"]
      },

      "GENERATE_FAQ": {
        "requiredCapabilities": ["GENERATE_FAQ"]
      }
    }
  }
}
```

Business modules do not choose endpoints.

---

# Z. Hard Constraints Before Preferences

Router decision order must enforce hard constraints before preferences.

At minimum consider:

```text
endpoint enabled
required task capability
model/context compatibility
request/token limits
deployment policy
endpoint health
endpoint circuit state
admission/capacity availability
data-governance/egress constraints where applicable
```

Only after eligible endpoints are established may preferences such as:

```text
priority
weight
cost tier
latency preference
```

be applied.

Never preference-route to an ineligible endpoint.

---

# AA. Deterministic Routing Decision Model

Router must expose/test a deterministic decision function where given the same:

```text
task
constraints
endpoint health snapshot
capacity snapshot
configuration snapshot
```

the eligible ordering/decision is explainable.

Do not hide routing semantics inside arbitrary conditionals.

Use enums/discriminated unions.

---

# AB. Routing Reasons

Every routing decision must produce safe structured reason metadata.

Example:

```text
selected endpoint: gpu-b

gpu-a:
  excluded = CIRCUIT_OPEN

gpu-b:
  eligible
  selected = highest effective priority

gpu-c:
  excluded = CAPABILITY_MISMATCH
```

Do not expose sensitive endpoint internals to public clients.

Use the metadata for Audit/Observability/AI Run persistence.

---

# AC. Endpoint Health

AI Router owns endpoint health state.

Support:

```text
UNKNOWN
HEALTHY
DEGRADED
UNHEALTHY
```

Health checking must be bounded.

Do not send a health request for every user request.

Health state should be shared appropriately across replicated processes where
correctness requires it, or be explicitly classified as advisory local state.

---

# AD. Circuit Breaker

Implement endpoint-level circuit behavior for repeated provider failures.

States conceptually:

```text
CLOSED
OPEN
HALF_OPEN
```

Requirements:

- bounded failure threshold;
- open duration;
- controlled probe;
- no unbounded retry storm;
- observable state change.

Circuit state must not be business-module logic.

---

# AE. Capacity

Router must respect configured endpoint capacity.

Admission Control protects platform/module policy.

AI Router protects/selects provider endpoint capacity.

Keep these responsibilities distinct.

Do not implement global customer quota inside AI Router.

---

# AF. Endpoint Selection

Support at least:

- deterministic priority ordering;
- weighted distribution among equivalent eligible endpoints where configured.

Do not require weighting when only one endpoint exists.

Avoid non-reproducible random behavior in tests by injecting/controlling selector state.

---

# AG. Multiple vLLM Endpoints

Product architecture must support multiple configured vLLM endpoints.

T3 tests must prove:

```text
Endpoint A healthy
Endpoint B healthy
→ routing policy distributes/selects correctly

Endpoint A unavailable
→ Endpoint B selected

Endpoint A circuit open
→ Endpoint B selected

task unsupported by B
→ B excluded

no eligible endpoint
→ stable NO_ELIGIBLE_ENDPOINT result
```

---

# AH. Real Live vLLM Gate

The final Translator/Summarizer/FAQ live acceptance must go through AI Router to
the real configured vLLM endpoint.

Do not directly call `127.0.0.1:8001` from a module test and call that router
acceptance.

The path must be:

```text
public module
→ AI Router
→ configured endpoint
→ vLLM
```

---

# AI. Multi-Endpoint Router Tests

Only one physical vLLM may be available in this development environment.

That does not excuse missing multi-endpoint behavior.

Use deterministic local OpenAI-compatible test endpoints/adapters to prove:

- selection;
- failure;
- timeout;
- stream interruption;
- retry;
- circuit breaker;
- failover;
- capability mismatch;
- weighted/priority policy.

But final functional product smoke must still use a real configured vLLM.

---

# AJ. Streaming Commitment Rule

For streaming generation:

fallback to another endpoint is allowed only before externally visible response
commitment unless a stronger resumable protocol explicitly supports otherwise.

Once user-visible tokens have been emitted:

```text
do not silently restart generation on another model/endpoint
```

If the active provider fails:

```text
INTERRUPTED
```

or other stable terminal semantics must be used.

---

# AK. Retry Policy

Retries are bounded and classified.

Do not retry:

- validation failures;
- unsupported task;
- permanent provider errors;
- requests already visibly committed when replay is unsafe.

Retry may be appropriate for classified transient connection/provider failures
before commitment.

---

# AL. Cancellation

Client cancellation must propagate:

```text
Web
→ API
→ Application Service
→ AI Router
→ selected provider attempt
```

AI Router tracks which endpoint owns the active attempt.

A browser abort alone is not proof the provider stopped.

Preserve the existing explicit cancellation semantics established by U2.

---

# AM. AI Run

AI Router owns or integrates with the canonical AI Run lifecycle.

AI Run records:

```text
runId
requestId
correlationId
deployment
tenant
actorKind
actorId?
module
semanticTask
selectedEndpoint
selectedModel
provider
configurationVersion/fingerprint
routing decision metadata
attempts
start/end
TTFT where available
duration
input tokens
output tokens
terminal status
error class
cancel state
```

Do not record hidden reasoning.

Do not persist raw content by default.

---

# AN. Attempt Model

One semantic AI Run may contain multiple attempts before visible commitment.

Example:

```text
AI Run
├── Attempt 1 → gpu-a → transient failure before output
└── Attempt 2 → gpu-b → success
```

Persist/observe attempt lineage.

Usage must not double-count failed pre-commit attempts as successful module usage,
while provider-consumption accounting may separately record real consumed
provider resources where measurable.

Define this distinction explicitly.

---

# AO. Router + Usage

Usage Accounting consumes actual Router execution facts.

Modules must not estimate provider tokens independently when authoritative router
facts exist.

Router reports:

```text
input tokens
output tokens
endpoint
model
attempts
timing
```

Usage owns authoritative consumption records.

---

# AP. Router + Admission Control

Required order:

```text
Request
↓
Module validation
↓
Admission Control
↓
AI Router
↓
Provider
```

Router capacity eligibility may participate in admission/capacity checks through
an explicit contract.

Do not duplicate customer quota logic in Router.

---

# AQ. Router + Audit

Audit records safe semantic evidence such as:

```text
AI operation requested
AI route selected
AI operation completed
AI operation failed/interrupted/cancelled
```

Do not record raw prompt/document/result content.

---

# AR. Router + Observability

Structured metrics/logs should expose safe operational fields:

```text
task
endpoint ID
model ID
attempt count
TTFT
duration
token counts
provider error class
circuit transition
routing result
```

No credentials or raw confidential payload.

---

# AS. Router + SIEM

Only selected security/operational events flow into Security Telemetry.

Business modules and AI Router do not send directly to SIEM.

Flow:

```text
AI Router / Audit / Observability
      ↓
Canonical Evidence
      ↓
Security Telemetry
      ↓
SIEM Adapter
```

---

# AT. Router Configuration Reload

If AI endpoint/policy configuration is reloadable:

- parse and validate complete candidate;
- verify endpoint/task references;
- atomically publish router policy snapshot;
- in-flight AI Runs retain the snapshot/version they started with;
- new runs use the new snapshot.

Never mutate routing rules halfway through one run.

---

# AU. Removed Endpoint During Reload

If a reload disables/removes an endpoint:

- no new run is assigned to it;
- in-flight execution is not arbitrarily killed unless explicit shutdown policy requires it;
- cancellation still reaches the owning attempt;
- state is observable.

---

# AV. Config Snapshot on Requests

Execution should carry or reference the effective immutable configuration snapshot/version.

This allows:

```text
request
→ audit
→ AI run
→ usage
→ SIEM
```

to identify which desired-state configuration governed the action.

---

# AW. Configuration Readiness

Readiness must fail when required configuration is invalid.

Examples:

```text
enabled Translator but no eligible TRANSLATE endpoint
enabled FAQ but missing GENERATE_FAQ policy
invalid PostgreSQL config
enabled SIEM required-by-policy but malformed destination
unknown module ID
duplicate endpoint ID
invalid secret reference
```

Optional SIEM destination being temporarily unreachable should normally cause
DEGRADED runtime health, not invalid configuration.

---

# AX. Configuration CLI

Provide operator tooling such as conceptually:

```text
npm run config:validate -- --config /path/platform.cjson
npm run config:print-effective -- --config /path/platform.cjson
npm run config:fingerprint -- --config /path/platform.cjson
```

`print-effective` MUST redact all secret values/references appropriately.

Prefer one clear CLI rather than several independent parsers.

---

# AY. Example Customer CJSON

Commit safe example configurations for:

```text
translator-only
translator-summarizer
all-three
```

At least one uses a synthetic customer brand.

Examples must contain no real credentials.

---

# AZ. Compose Uses CJSON

Docker Compose should mount the same CJSON used outside Compose.

Example conceptually:

```text
./deploy/customer-a/platform.cjson
    → /etc/targoman/platform.cjson:ro
```

Do not duplicate app configuration into a large Compose `environment:` block.

Compose environment use remains acceptable for:

- PostgreSQL container bootstrap;
- Docker-required secret wiring;
- minimal process bootstrap.

---

# BA. Customer Deployment Must Be Config-Only

T3 final proof:

Take the same built images and create:

Deployment A:
- Translator only
- Brand A
- AI Router endpoint/policy A

Deployment B:
- Translator + Summarizer
- Brand B
- different router endpoint priority/weights
- different anonymous limits

Deployment C:
- all three
- SIEM enabled

No source changes.
No rebuild.
No module code edits.

Only CJSON / secret refs / mounted brand assets differ.

---

# BB. Static Guardrails — Configuration

Add high-confidence rules preventing:

- ordinary direct `process.env` access outside Configuration/bootstrap boundaries;
- CJSON parsing outside Configuration capability;
- hard-coded AI endpoint URLs in modules;
- hard-coded model names in modules;
- customer brand literals in generic source;
- direct secret reads in business modules.

Allow explicit infrastructure/bootstrap exceptions only.

Every detector needs positive and negative fixtures.

---

# BC. Static Guardrails — AI Router

Add rules preventing migrated modules from:

```text
importing vLLM/OpenAI provider client
calling configured AI base URLs directly
selecting model strings
selecting endpoint IDs
implementing endpoint fallback
```

All target AI execution goes through AI Router public contracts.

---

# BD. Configuration Tests

Test:

- comments in CJSON;
- valid parse;
- syntax failure;
- schema failure;
- unknown key;
- invalid override;
- security-bound weakening;
- secretRef resolution;
- secret redaction;
- deterministic hierarchy;
- deterministic fingerprint;
- startup-only change classification;
- safe reload;
- failed reload preserving old snapshot;
- concurrent readers during reload;
- module enablement;
- branding;
- AI endpoint/task validation.

---

# BE. Router Tests

Test:

- semantic task mapping;
- endpoint capability;
- health exclusion;
- circuit breaker;
- priority;
- weighted selection;
- timeout classification;
- bounded retry;
- failover before stream commitment;
- no failover after visible commitment;
- cancellation;
- no eligible endpoint;
- configuration reload;
- in-flight snapshot stability;
- usage facts;
- audit facts;
- observability facts.

---

# BF. T3 Acceptance Criteria Additions

T3 cannot be COMPLETE unless all are true:

1. canonical CJSON Configuration capability exists;
2. actual Sepidjoo configuration source was inspected and reuse decisions documented;
3. ordinary application configuration does not depend on ENV variables;
4. ENV use is limited to documented bootstrap/Compose/secret exceptions;
5. deployment settings come from validated CJSON;
6. config is typed;
7. config schema/version is explicit;
8. invalid config fails closed;
9. hierarchy/override rules are deterministic;
10. lower layers cannot weaken security bounds;
11. secrets are references, not ordinary plaintext config;
12. secret values are redacted from logs/tooling;
13. immutable effective config snapshot exists;
14. configuration fingerprint exists;
15. customer branding is configuration-driven;
16. module enablement is configuration-driven;
17. Admission policies are configuration-driven;
18. SIEM configuration is configuration-driven;
19. AI endpoint definitions are configuration-driven;
20. AI task routing policies are configuration-driven;
21. customer deployment requires no image rebuild;
22. `packages/ai-router` is implemented;
23. Translator makes zero direct model/provider calls;
24. Summarizer makes zero direct model/provider calls;
25. FAQ makes zero direct model/provider calls;
26. semantic tasks go through AI Router;
27. model and endpoint are separate concepts;
28. multiple endpoints are supported;
29. endpoint capability constraints work;
30. unhealthy endpoints are excluded;
31. circuit breaker works;
32. capacity constraints participate correctly;
33. priority routing works;
34. weighted routing works where configured;
35. transient pre-commit failover works;
36. post-visible-output silent failover is prohibited;
37. cancellation reaches selected provider attempt;
38. AI Run/attempt lineage is persisted/observable;
39. router facts feed Usage;
40. router events feed Audit/Observability;
41. router does not send directly to SIEM;
42. real Translator live test goes through Router;
43. real Summarizer live test goes through Router;
44. real FAQ live test goes through Router;
45. final product with MySQL stopped still uses Router successfully;
46. same images boot with at least three different CJSON deployment profiles;
47. non-Targoman branded profile works without source change;
48. target static architecture gate reports no new Router/Configuration violations.

---

# BG. Final Report Additions

Add sections:

## Sepidjoo Configuration Reference

```text
source path
observed behavior
reuse decision
target path
```

## Configuration Architecture

```text
source files
hierarchy
validation
secret providers
reload semantics
snapshot/fingerprint
```

## ENV Usage Inventory

List every target production `process.env` read.

For each:

```text
file
variable
reason
classification:
  BOOTSTRAP_REQUIRED
  COMPOSE_INFRASTRUCTURE
  SECRET_INJECTION_EXCEPTION
  VIOLATION
```

Final ordinary-configuration violations must be zero.

## AI Router Endpoint Matrix

```text
endpoint
provider
model
tasks
health
priority/weight
capacity
```

No secret URL credentials.

## AI Routing Evidence

```text
task
eligible endpoints
excluded endpoints/reasons
selected endpoint
attempts
terminal result
```

## Live Router Evidence

For Translator, Summarizer and FAQ show:

```text
module
→ semantic task
→ router run
→ selected endpoint
→ real provider
→ terminal result
```

## Customer Configuration Matrix

```text
profile
brand
enabled modules
router policy
anonymous policy
SIEM mode
result
```

---

# BH. Final Expected State

```text
Customer platform.cjson
        ↓
Configuration Capability
        ↓
Validated Immutable Desired State
        ├── BrandProfile
        ├── Module Enablement
        ├── Route Bindings
        ├── Admission Policy
        ├── PostgreSQL Configuration
        ├── AI Router Endpoints/Policies
        ├── SIEM Configuration
        └── Security Bounds

Public Request
        ↓
Execution Context (ANONYMOUS)
        ↓
Admission Control
        ↓
Module Application Service
        ↓
Semantic AI Task
        ↓
AI Router
        ↓
Endpoint Eligibility
        ↓
Routing Policy
        ↓
Selected vLLM Endpoint
        ↓
Provider Adapter
        ↓
Streaming Result

And in parallel:

AI Run
Usage
Audit
Observability
Security Telemetry
SIEM Push
```

No public module knows:

```text
which GPU
which vLLM host
which model URL
which customer brand
which SIEM vendor
```

Those are configuration/platform responsibilities.

---

# BI. Additional Final Response Fields

The T3 final response must additionally include:

```text
Configuration capability:
PASS / FAIL

Primary configuration format:
CJSON

Ordinary ENV-driven application configuration:
<count>

Sepidjoo configuration implementation inspected:
YES / NO

AI Router:
PASS / FAIL

Direct module-to-vLLM calls:
<count>

Configured AI endpoints tested:
<count>

Multi-endpoint routing tests:
PASS / FAIL

Pre-commit failover:
PASS / FAIL

Post-commit failover protection:
PASS / FAIL

Router cancellation:
PASS / FAIL

Configuration-only customer redeployment:
PASS / FAIL

Ready for customer anonymous deployment:
YES / NO
```
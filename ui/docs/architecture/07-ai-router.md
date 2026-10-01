# Targoman AI Platform — AI Router Architecture

**Document:** `docs/architecture/07-ai-router.md`  
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

---

# 1. Purpose

This document defines the AI execution and routing architecture of the **Targoman AI Platform**.

It specifies:

- semantic AI tasks;
- Task Registry;
- Task Contracts;
- routing policies;
- Model Registry;
- Endpoint Registry;
- model tiers;
- model and endpoint capabilities;
- local and external providers;
- Data Governance and egress;
- context limits;
- prompt/instruction composition;
- structured output;
- streaming;
- retries;
- fallback;
- endpoint health;
- circuit breakers;
- concurrency;
- Admission Control;
- Usage Accounting;
- AI Run evidence;
- evaluation;
- model promotion;
- canary/shadow execution;
- agent/tool boundaries;
- reliability;
- scaling;
- security;
- testing.

The central rule is:

> **Business modules request semantic AI tasks. They never select models, providers, endpoints, GPUs, serving engines, or fallback behavior directly.**

---

# 2. Ownership Model

AI responsibilities are separated as follows:

```text
Business Module
    → owns task meaning

AI Task Contract
    → owns typed input/output semantics

AI Router
    → owns execution policy and routing

Data Governance
    → owns external-data-movement decision

Admission Control
    → owns capacity/quota admission decision

AI Endpoint Adapter
    → owns provider/serving-engine protocol

Model Server / Provider
    → performs inference

Usage Accounting
    → records consumption

Commercial
    → optionally prices consumption
```

No component should silently acquire another component's authority.

---

# 3. AI Router Is a Shared Platform Capability

Business modules use one shared AI execution boundary.

Examples:

```text
secretariat.metadata.extract
letter.draft
followup.action.extract
ticket.summarize
rag.answer
```

The Router supports all official modules without embedding their business semantics.

---

# 4. AI Router Is Not a Business Workflow Engine

The Router does not own:

- Letter approval;
- Secretariat lifecycle;
- CRM decisions;
- Follow-up lifecycle;
- Ticket state;
- document authorization;
- payment or commercial decisions.

It executes AI Tasks requested by application workflows.

---

# 5. AI Router Is Not the RAG Retrieval Engine

For a RAG workflow:

```text
Knowledge / RAG
    → owns retrieval orchestration

Authority
    → owns access decision

AI Router
    → owns model execution
```

A typical flow is:

```text
Question
    ↓
Knowledge / RAG
    ↓
Authorized Retrieval
    ↓
Context Assembly
    ↓
AI Router: rag.answer
    ↓
Model
```

The Router does not independently retrieve protected Documents.

---

# 6. AI Task Is the Primary Semantic Unit

A module requests an AI Task instead of a Model.

Preferred:

```ts
aiRouter.execute(
  enuAiTask.LETTER_DRAFT,
  input
);
```

Forbidden:

```ts
callModel(
  'aya-expanse-8b',
  input
);
```

---

# 7. Task IDs Are Stable and Namespaced

Preferred naming:

```text
<owner>.<purpose>
```

Examples:

```text
rag.answer
letter.draft
secretariat.metadata.extract
followup.action.extract
ticket.summarize
crm.case.summarize
```

A released Task ID must not silently change meaning.

---

# 8. Task Contract and Task Policy Are Different

A Task Contract defines:

> What does this AI operation mean?

A Task Policy defines:

> How may this Task be executed?

This distinction is mandatory.

---

# 9. Task Contract Is Owned by the Semantic Owner

For:

```text
letter.draft
```

Letter Assistant owns:

- task meaning;
- input contract;
- output contract;
- semantic instructions;
- validation requirements.

AI Router does not redefine what constitutes a valid letter draft.

---

# 10. Router Owns Execution Policy

AI Router owns decisions such as:

```text
Which model tier?
Which endpoint?
Local or external?
Which fallback?
How much context?
What timeout?
How many retries?
What concurrency class?
What routing preference?
```

Modules do not own these decisions.

---

# 11. Task Definition Is Typed

Conceptually:

```ts
interface intfAiTaskDefinition<
  TInput,
  TOutput
> {
  id: typAiTaskId;
  version: typAiTaskVersion;

  inputSchema:
    typSchema<TInput>;

  outputSchema?:
    typSchema<TOutput>;

  executionKind:
    enuAiExecutionKind;

  requiredCapabilities:
    readonly enuAiCapability[];

  instructionProfile:
    typAiInstructionProfileId;

  structuredOutput:
    boolean;
}
```

The final implementation must use canonical named types.

---

# 12. Task Contracts Are Versioned

A breaking change to:

- input;
- output;
- semantic behavior;
- structured schema

requires explicit version compatibility.

Changing model infrastructure does not require changing the Task Contract.

---

# 13. Task Registry Is Canonical

The Router maintains a canonical Task Registry containing all installed AI Tasks.

A Task may be registered only by:

- a platform capability;
- an installed business module.

Unknown Task IDs fail explicitly.

---

# 14. Module Disablement Affects Task Availability

A Task contributed by a disabled module must not remain ordinarily executable merely because it remains in the Universal Build.

Task availability respects:

```text
Module Installed
Tenant Enabled
Authority
Data Governance
Admission Control
```

where applicable.

---

# 15. Task Execution Kinds Are Explicit

Possible execution kinds include:

```text
TEXT_GENERATION
STRUCTURED_GENERATION
CLASSIFICATION
EXTRACTION
EMBEDDING
RERANKING
VISION
TOOL_ASSISTED
```

Not all kinds need initial implementation.

---

# 16. Model, Endpoint, and Provider Are Different Concepts

These must not be conflated.

```text
Model
    → logical/model artifact identity

Endpoint
    → runnable serving location

Provider
    → infrastructure/provider family
```

For example:

```text
Model:
    Aya-Expanse-8B

Endpoint:
    aya-main-4090-01

Provider / Engine:
    local-vllm
```

---

# 17. Hardware Is an Endpoint Property

A Model is not:

```text
RTX4090
```

or:

```text
H200
```

Hardware belongs to Endpoint metadata.

The same model may run on different hardware.

---

# 18. Serving Engine Is an Endpoint Property

Examples:

```text
vLLM
SGLang
llama.cpp
Ollama
External Provider API
```

Business modules must not depend on the serving engine.

---

# 19. Model Registry

The Model Registry describes available logical/model artifacts.

A Model Descriptor may include:

```text
model ID
model family
artifact revision
capabilities
context support
structured-output capability
languages
license
quantization compatibility
evaluation profile
```

---

# 20. Production Model Revisions Are Pinned

Production execution should identify an immutable or sufficiently specific model revision.

Avoid relying on:

```text
model = latest
```

where provider/model behavior may change without controlled rollout.

---

# 21. Endpoint Registry

The Endpoint Registry describes executable targets.

Conceptually:

```ts
interface intfAiEndpointDescriptor {
  id: typAiEndpointId;

  modelId: typAiModelId;
  providerId: typAiProviderId;

  capabilities:
    readonly enuAiCapability[];

  contextWindow: number;
  maximumOutput: number;

  privacyProfile:
    typAiPrivacyProfileId;

  region?:
    string;

  hardware?:
    typAiHardwareProfile;

  servingEngine:
    enuAiServingEngine;

  healthState:
    enuAiEndpointHealth;

  secretRef?:
    typSecretRef;
}
```

---

# 22. Endpoint Capability Is Explicit

Capabilities may include:

```text
TEXT_GENERATION
STREAMING
STRUCTURED_OUTPUT
TOOL_CALLING
EMBEDDING
RERANKING
VISION
LONG_CONTEXT
```

Router must not infer capability solely from model name.

---

# 23. Endpoint Health Is Runtime State

Possible health states include:

```text
AVAILABLE
DEGRADED
DRAINING
UNHEALTHY
DISABLED
```

Health is not a permanent model property.

---

# 24. Disabled Endpoint Is Never Selected

Operator-disabled endpoints are removed from ordinary routing immediately enough to meet operational requirements.

A disabled endpoint must not remain in the candidate set because of stale local configuration.

---

# 25. Draining Supports Graceful Maintenance

A `DRAINING` endpoint:

- receives no new ordinary work;
- may finish accepted executions;
- becomes unavailable after active work drains.

This supports controlled restart and upgrade.

---

# 26. Endpoint Configuration Contains No Raw Secret

Credentials are referenced:

```text
secretRef
```

not embedded in ordinary endpoint configuration.

---

# 27. Model Tiers Express Policy, Not Hardware

Possible logical tiers may include:

```text
BASELINE
HIGH
SPECIALIZED
EXTERNAL
```

A tier does not mean:

```text
4090
H200
```

Hardware mapping is deployment configuration.

---

# 28. Baseline Execution

The initial baseline for ordinary generative Tasks is:

```text
Aya-Expanse-8B
+
vLLM
+
RTX 4090
```

The architecture should assume that a significant proportion of normal enterprise tasks can execute efficiently on this baseline.

---

# 29. High-Tier Execution

Higher-capability execution may use:

```text
larger / specialized model
+
H200 NVL or equivalent infrastructure
```

where evaluation demonstrates a meaningful need.

---

# 30. High Tier Is Not the Default

The platform must not route to expensive/high-tier infrastructure merely because it exists.

Higher tiers require an execution-policy reason.

---

# 31. Model Size Is Not a Quality Policy

The Router must not encode:

```text
larger model
    → always better
```

Task-specific evaluation determines suitability.

---

# 32. Specialized Models May Outrank General Models

A specialized smaller model may be preferred for:

```text
embedding
reranking
translation
classification
extraction
```

when evaluation proves it better suited.

---

# 33. Routing Uses Hard Constraints Before Preferences

Routing occurs conceptually in two phases.

First:

```text
Hard Constraints
```

then:

```text
Preference / Optimization
```

---

# 34. Hard Routing Constraints

Hard constraints may include:

```text
required capability
context capacity
structured output support
privacy
data residency
external-egress permission
model eligibility
endpoint enablement
endpoint health
tenant restrictions
```

A candidate failing a hard constraint is removed.

---

# 35. Preferences Apply Only to Eligible Candidates

Among valid candidates, Router may optimize for:

```text
quality
latency
cost
warmness
load
capacity
locality
task preference
```

Preference must never override a security constraint.

---

# 36. Routing Decision Is Explainable

An AI Run should retain routing evidence such as:

```text
candidate set
selected endpoint
selected model
selected tier
routing reason
fallback reason
policy version
```

This supports diagnosis and evaluation.

---

# 37. Routing Semantics Are Deterministic

Given the same:

- Task;
- Task Policy;
- security/governance inputs;
- endpoint eligibility;
- capacity snapshot;

the candidate set must be semantically deterministic.

Load balancing within an equivalent eligible set may vary.

---

# 38. Routing Policy Is Versioned

Changes to routing policy are controlled configuration changes.

AI Runs record the policy version used.

This enables before/after comparison.

---

# 39. Routing Policy Hierarchy

AI policy may derive from:

```text
Platform Security Bounds
    ↓
Deployment AI Policy
    ↓
Tenant AI Policy
    ↓
Task Policy
    ↓
Module / Instance Policy where permitted
```

Lower levels cannot weaken higher-level security or governance bounds.

---

# 40. User Preference Is Not Routing Authority

A user may request preferences such as:

```text
concise
detailed
fast
```

where the Task supports them.

A user cannot request:

```text
send confidential data to external model
ignore quota
force H200
bypass safety
```

unless an explicit authorized administrative contract allows such configuration.

---

# 41. Data Governance Runs Before External Egress

Before protected input is sent outside the approved trust boundary:

```text
AI Router
    ↓
Data Governance
    ↓
ALLOW / DENY / constrained destination
```

must occur.

---

# 42. Authorization and Data Governance Are Different

Authority may say:

```text
Identity may use Document
```

while Data Governance says:

```text
Document must remain local
```

Router must satisfy both.

---

# 43. Local Failure Does Not Permit Unsafe External Fallback

Forbidden:

```text
Local Model Failed
    ↓
Send Confidential Prompt to External API
```

unless Data Governance and Task Policy explicitly allow that destination.

---

# 44. External Provider Eligibility Is Explicit

Endpoint metadata should contain data-handling properties required by policy, such as:

```text
local / external
region
trust profile
retention profile
training-use policy
contractual privacy profile
```

Router must not assume an external provider is acceptable merely because it exposes an API.

---

# 45. External Provider Claims Are Configuration Facts

Claims such as:

```text
zero retention
no training
specific region
```

must come from approved deployment/provider configuration.

They must not be inferred from provider branding.

---

# 46. Air-Gapped Deployment Is Supported

The Router must support deployments where:

```text
External AI Providers = Disabled
```

All eligible Tasks must then route only to approved local endpoints or fail explicitly if no compliant endpoint exists.

---

# 47. Input Classification Propagates Into Routing

Task execution may carry:

```text
tenant
classification
data-governance policy
requested Task
```

Router uses these facts when building the candidate set.

---

# 48. Generated Output Inherits Protection by Default

AI-generated output derived from protected input should normally inherit at least the applicable protection level of its protected source context until an explicit policy reclassifies it.

Generation must not accidentally downgrade confidentiality.

---

# 49. Prompt Composition Has Explicit Ownership

Prompt/instruction composition consists of distinct layers.

Conceptually:

```text
Platform Safety / Execution Instructions
        ↓
Task Semantic Instructions
        ↓
Trusted Task Metadata
        ↓
Authorized Context
        ↓
User Input
```

Each layer has a canonical owner.

---

# 50. Task Owner Owns Semantic Instructions

For:

```text
letter.draft
```

Letter Assistant owns instructions defining:

- expected letter behavior;
- semantic output;
- business terminology.

AI Router does not invent Letter Assistant semantics.

---

# 51. Router Owns Execution Instructions

Router may add trusted execution requirements such as:

```text
structured output schema
output limits
tool-call constraints
format enforcement
provider compatibility wrappers
```

These must not redefine domain meaning.

---

# 52. Platform Safety Instructions Cannot Be Overridden by Modules

A module's Task instructions must not weaken:

- Authority;
- Data Governance;
- tool boundaries;
- output validation;
- secret handling;
- platform security rules.

---

# 53. Prompt and Instruction Profiles Are Versioned

AI Run records relevant:

```text
Task version
Instruction profile version
Routing policy version
```

This makes behavioral regression traceable.

---

# 54. Prompt Templates Are Not Hidden Mutable Production State

Production semantic instructions must come from controlled, versioned configuration or source.

Ad-hoc prompt changes directly in production are prohibited unless governed through a versioned configuration workflow.

---

# 55. User Input Is Untrusted

User input cannot override trusted execution instructions.

The model may receive:

```text
User says: "ignore the schema"
```

without the Router relaxing the schema.

---

# 56. Retrieved Content Is Untrusted

RAG context remains source data.

It cannot:

- change Router policy;
- choose an endpoint;
- change system instructions;
- grant Tool access;
- authorize external egress.

---

# 57. Context Window Is a Hard Constraint

Router must verify that execution fits an eligible endpoint's context capacity.

It must not rely on provider-side silent truncation.

---

# 58. Silent Context Truncation Is Prohibited

If input exceeds the permitted context, Task Policy must explicitly define behavior such as:

```text
REJECT
REDUCE_RETRIEVAL
SUMMARIZE_FIRST
SAFE_TRUNCATE_DEFINED_SECTION
```

Router must not arbitrarily cut important input.

---

# 59. Context Budget Is Task-Aware

A Task may define budgets for:

```text
system instructions
task instructions
retrieved context
user input
maximum output
```

Context management must preserve mandatory instructions.

---

# 60. Token Estimation May Precede Execution

Router may estimate:

```text
input tokens
expected output tokens
```

for:

- endpoint eligibility;
- Admission Control;
- Usage forecast;
- context validation.

Actual provider/model usage replaces estimates where available.

---

# 61. Maximum Output Is Explicit

Every execution has a bounded maximum output.

The final value may be constrained by:

```text
Task
Endpoint
Deployment
Tenant
Admission Policy
```

The most restrictive applicable safe bound wins.

---

# 62. Generation Parameters Are Policy

Parameters such as:

```text
temperature
top_p
seed
maximum output
reasoning level
stop conditions
```

belong to Task/Router policy.

Business modules should not scatter provider-specific generation parameters throughout application code.

---

# 63. Deterministic Tasks Prefer Stable Settings

Tasks such as:

```text
classification
metadata extraction
structured extraction
```

should prefer settings optimized for consistency where the underlying model supports them.

---

# 64. Creative Tasks May Use Different Policies

A Task such as:

```text
letter.draft
```

may legitimately use a different generation profile than:

```text
secretariat.metadata.extract
```

There is no global generation configuration for all Tasks.

---

# 65. Structured Output Is a First-Class Requirement

Machine-actionable Tasks require an explicit output schema.

Examples:

```text
metadata extraction
classification
deadline extraction
action extraction
tool arguments
```

---

# 66. Model Output Is Untrusted

Even when the endpoint claims native structured output support:

```text
Model Output
    ↓
Schema Validation
    ↓
Semantic Validation
    ↓
Application Use
```

is required.

---

# 67. Native Structured Output Is Preferred Where Reliable

If an endpoint supports schema-constrained generation reliably, Router may use it.

The result is still validated independently.

---

# 68. JSON-Looking Text Is Not Structured Output

A response containing:

```text
{ ... }
```

does not become trusted merely because it resembles JSON.

It must parse and validate against the canonical schema.

---

# 69. Structured Output Repair Is Bounded

Task Policy may allow a bounded repair attempt.

For example:

```text
Initial Output
    ↓ invalid schema
Repair Attempt
    ↓
Validate
```

Repair loops must be bounded.

---

# 70. Repair Does Not Relax the Schema

Router must never "repair" invalid model output by silently deleting or inventing security-significant values just to pass validation.

---

# 71. Failed Structured Output Is an Explicit Failure

After bounded attempts are exhausted:

```text
STRUCTURED_OUTPUT_INVALID
```

or equivalent stable error is returned.

The application must not consume partially valid data as authoritative state.

---

# 72. Free-Text Output Also Has Bounds

Non-structured output still obeys:

- maximum output;
- Task instructions;
- Data Governance;
- disclosure policy;
- content handling rules.

---

# 73. Streaming Is an Execution Mode

Interactive generation may stream through SSE.

Streaming is not a separate Task meaning.

---

# 74. Stream Commitment Is Explicit

Before the first externally visible content is emitted, Router may safely fail over when Task Policy allows it.

After response content has been committed to the caller, Router must not silently restart with another model and produce a mixed execution.

---

# 75. Post-Commit Streaming Failure Is Visible

If a stream fails after output emission begins:

```text
partial result
+
explicit terminal error/status
```

is preferable to pretending the response completed successfully.

---

# 76. Machine-Actionable Structured Output Is Normally Validated Before Commit

For Tasks whose result may mutate authoritative state, unvalidated structured output should not be streamed directly into the mutation path.

The complete validated result is required first.

---

# 77. Cancellation Propagates Downstream

Where supported:

```text
Client Cancellation
    ↓
API
    ↓
Router
    ↓
Endpoint Adapter
```

should cancel unnecessary inference work.

Cancellation behavior must remain safe under retry/fallback semantics.

---

# 78. Interactive and Background AI Are Different Work Classes

Interactive examples:

```text
chat
RAG answer
letter drafting
```

Background examples:

```text
bulk extraction
classification
large import processing
batch summaries
embedding
```

Both use the same semantic Router contracts.

---

# 79. Background AI Uses Durable Jobs

Background execution follows:

```text
Application
    ↓
Durable Job
    ↓
Worker
    ↓
AI Router
```

Business success must not depend on an in-memory callback completing later.

---

# 80. Interactive Request Does Not Become Durable Automatically

Interactive generation may be synchronous/streamed.

Durability is added only where the business use case requires it.

---

# 81. Admission Control Runs Before Expensive Inference

Before starting inference, Router invokes applicable Admission Control.

Admission may consider:

```text
tenant quota
identity quota
commercial entitlement
estimated tokens
concurrency
endpoint capacity
Task limits
```

---

# 82. Authorization Does Not Imply Capacity

A request may be:

```text
AUTHORIZED
```

but still receive:

```text
QUOTA_EXCEEDED
CAPACITY_EXHAUSTED
CONCURRENCY_LIMIT
```

These are different decisions.

---

# 83. Distributed Capacity State Is Shared

In replicated Router/API/Worker environments, authoritative concurrency or quota state must not exist only in one process.

---

# 84. Endpoint Concurrency Is Explicit

Each Endpoint may expose capacity such as:

```text
maximum concurrent sequences
maximum queued work
token throughput budget
memory-sensitive concurrency
```

Exact capacity mechanism depends on serving infrastructure.

---

# 85. Router Applies Backpressure

When all eligible endpoints are saturated, Router must not create an uncontrolled in-memory backlog.

Policy may:

```text
queue through durable background path
reject with capacity error
use eligible fallback
```

according to Task class.

---

# 86. Interactive and Batch Work May Have Separate Capacity Pools

A large background import must not necessarily starve interactive user requests.

Capacity policy may reserve or weight resources by:

```text
interactive
normal background
bulk
maintenance
```

---

# 87. Tenant Fairness May Be Enforced

One tenant's workload should not be able to consume all shared model-serving capacity where deployment policy requires fairness.

Admission Control and Router scheduling may cooperate to enforce this.

---

# 88. Endpoint Selection Considers Current Capacity

An otherwise eligible endpoint may be temporarily avoided because of:

- saturation;
- queue depth;
- health;
- draining state.

This is an operational decision, not a Task semantic change.

---

# 89. Timeouts Are Bounded

Every execution must have an end-to-end deadline.

Additional provider/endpoint timeouts may exist beneath it.

No AI call waits indefinitely.

---

# 90. Deadline Is Propagated

Nested operations should respect the remaining execution deadline.

A fallback should not receive a fresh unlimited timeout after the original deadline is nearly exhausted.

---

# 91. Retry Classification Is Explicit

Errors may be classified conceptually as:

```text
RETRYABLE
NON_RETRYABLE
CAPACITY
POLICY_DENIED
INVALID_INPUT
INVALID_OUTPUT
UNKNOWN
```

Provider error strings do not directly define application behavior.

---

# 92. Retry Is Bounded

Router retries are limited by:

```text
attempt count
deadline
Task Policy
error classification
```

No infinite inference retry is allowed.

---

# 93. Retry Uses Backoff Where Appropriate

Repeated endpoint failure uses controlled backoff.

The Router must avoid retry storms during provider or model-server outages.

---

# 94. Same-Endpoint Retry and Fallback Are Different

```text
Retry
    → same logical execution target

Fallback
    → different eligible candidate
```

Policies for the two are separate.

---

# 95. Fallback Is Declared Per Task Policy

Possible fallback chain:

```text
Preferred Baseline Model
    ↓
Alternate Baseline Endpoint
    ↓
Approved High Tier
```

or another explicit chain.

There is no universal fallback sequence.

---

# 96. Fallback Must Preserve Contract

A fallback endpoint must satisfy the same required:

- Task capabilities;
- output schema;
- context requirement;
- privacy constraints;
- egress constraints.

A model that cannot honor the Task Contract is not a valid fallback.

---

# 97. Fallback Must Preserve Security

A fallback may never weaken:

```text
classification
residency
external-provider restriction
tool permissions
output validation
```

for availability.

Security-sensitive ambiguity fails closed.

---

# 98. Fallback May Change Quality or Latency Tier

Policy may allow:

```text
baseline → high tier
```

or:

```text
high tier → baseline
```

if the Task's evaluation and degradation policy permits it.

The resulting AI Run records the fallback.

---

# 99. Fallback After Stream Commit Is Restricted

Once externally visible streaming output has begun, automatic fallback that restarts generation is prohibited by default.

A Task requiring continuation behavior must define it explicitly.

---

# 100. Circuit Breaker Is Endpoint-Aware

Repeated transient endpoint failures may open a circuit.

Conceptual states:

```text
CLOSED
OPEN
HALF_OPEN
```

Endpoint selection excludes an open circuit.

---

# 101. Circuit Breaker Is Not Health Truth

Circuit-breaker state reflects recent execution behavior.

Endpoint health may use additional active/passive health signals.

Both are routing inputs.

---

# 102. Circuit Breakers Are Shared Enough for HA

In multi-replica deployments, circuit behavior should avoid each Router replica independently flooding the same failed dependency.

Exact coordination may be centralized or eventually consistent according to risk.

---

# 103. Health Checks Are Bounded

Health checking must not itself overload model infrastructure.

Checks should be:

- lightweight;
- rate-limited;
- timeout-bound.

---

# 104. Health Does Not Require Full Production Generation

A health probe need not execute an expensive representative Task unless a deeper periodic readiness check explicitly requires it.

---

# 105. Provider Adapter Owns Protocol Translation

Adapters translate the Router contract into provider/engine protocol.

Examples:

```text
vLLM OpenAI-Compatible Adapter
SGLang Adapter
llama.cpp Adapter
External OpenAI-Compatible Adapter
Provider-Specific Adapter
```

---

# 106. OpenAI-Compatible Protocol Is Not the Domain Contract

vLLM may expose an OpenAI-compatible HTTP API.

Business and Router semantic contracts must not become dependent on OpenAI request/response types.

Provider protocol remains an adapter detail.

---

# 107. Provider-Specific Features Stay Behind Adapters

Examples include:

```text
guided decoding
prefix caching
provider reasoning controls
provider response IDs
batch API
special tool-call syntax
```

Router may expose canonical capabilities without leaking provider-specific types into modules.

---

# 108. Provider Responses Are Untrusted

Adapters validate provider responses before converting them into canonical Router results.

Malformed provider output is an execution failure.

---

# 109. Provider Error Mapping Is Stable

External provider error messages do not leave the adapter as application contracts.

They map to stable AI execution error classes.

---

# 110. Embeddings Use the Same Router Principles

Embedding is a semantic AI capability.

Business modules do not select embedding models.

Knowledge/File infrastructure requests an embedding Task/Profile.

---

# 111. Embedding Data Egress Is Governed

External embedding APIs receive source content.

Therefore external embedding requires Data Governance approval.

---

# 112. Embedding Profiles Are Versioned

An embedding profile identifies sufficient information for index compatibility, such as:

```text
logical model
artifact revision
dimension
normalization behavior
policy version
```

Changing profile may require reindexing.

---

# 113. Reranking Uses the Same Security Boundary

Reranking receives protected content.

Only authorized candidates may be passed to a reranker.

External reranking is subject to Data Governance.

---

# 114. Reranker Selection Is Router Policy

Knowledge/RAG does not hard-code a reranker provider/model.

It requests the semantic capability through shared AI policy.

---

# 115. Multimodal Capability Is Extensible

Future Tasks may require:

```text
VISION
AUDIO
DOCUMENT_NATIVE
```

The Task/Endpoint capability model must allow these additions without redesigning business modules.

---

# 116. Tool Calling Does Not Grant Tool Authority

A model may produce:

```text
Tool Call Requested
```

That is model output.

It is not authorization.

---

# 117. AI Router Does Not Execute Business Tools Directly

Tool execution belongs to an explicit application/agent execution boundary.

Conceptually:

```text
Model
    ↓
Proposed Tool Call
    ↓
Validate Schema
    ↓
Application / Agent Runtime
    ↓
Authority
    ↓
Tool Execution
```

---

# 118. Every Tool Invocation Is Independently Authorized

A model's previous authorization to read a Document does not authorize it to:

```text
send email
create ticket
modify CRM
register letter
delete resource
```

Each operation requires its own application path and Authority decision.

---

# 119. Tool Arguments Are Untrusted Model Output

Tool-call arguments must be:

- schema-validated;
- semantically validated;
- authorized;
- bounded.

The model cannot invent trusted identifiers or privileged scope.

---

# 120. Retrieved Prompt Injection Cannot Trigger Tools

Instructions found inside:

- Documents;
- web pages;
- external provider responses;
- user-uploaded files

cannot directly authorize or trigger external side effects.

---

# 121. Tool Result Is Also Untrusted External Input

Returned Tool/provider data is validated before reuse by the model or authoritative application state.

---

# 122. AI Run Is the Canonical Execution Record

Every material AI execution receives a stable AI Run identity.

An AI Run represents:

```text
one semantic Task execution
```

not merely one HTTP call to a model server.

---

# 123. AI Run Contains Attempts

A Run may contain multiple Attempts.

Example:

```text
AI Run
├── Attempt 1 → Endpoint A → timeout
└── Attempt 2 → Endpoint B → success
```

This preserves retry/fallback lineage.

---

# 124. AI Run Fields

An AI Run may record:

```text
Run ID
Task ID / Version
Tenant
Actor / Initiator
Request / Correlation ID

Routing Policy Version
Instruction Profile Version

Classification / Governance Profile
Execution Class

Start / End
Final Status

Selected Model
Selected Endpoint
Selected Tier

Input Token Estimate
Actual Input Tokens
Output Tokens

TTFT
Generation Duration
Total Latency

Retry Count
Fallback Lineage

Error Class
Usage Dimensions
Estimated Infrastructure / Commercial Cost
```

---

# 125. Model Artifact Identity Is Recorded

Where available, AI Run should record exact:

```text
model artifact/revision
quantization
serving configuration version
```

needed for operational diagnosis.

---

# 126. Hardware May Be Recorded as Operational Metadata

AI Run may record:

```text
RTX4090
H200 NVL
other endpoint hardware
```

for performance analysis.

Hardware does not become Task semantics.

---

# 127. AI Run Does Not Store Chain-of-Thought

Ordinary AI Run telemetry must not store:

- chain-of-thought;
- hidden reasoning;
- private reasoning traces.

This is prohibited as ordinary diagnostic telemetry.

---

# 128. Raw Prompt/Response Retention Is Off by Default for Protected Work

AI Run stores metadata by default.

Raw prompts or responses require a separate explicitly approved diagnostic/content-retention policy.

---

# 129. Diagnostic Capture Is Separately Governed

If a deployment enables protected AI diagnostic capture, it must define:

```text
who may access it
what may be captured
retention
redaction
classification
storage location
audit
```

---

# 130. Secrets Must Never Enter AI Telemetry

AI logs and Runs must not persist:

- API keys;
- Access Tokens;
- Refresh Tokens;
- passwords;
- provider secrets;
- private keys.

---

# 131. Input/Output Hashes May Support Correlation

Where useful and safe, AI Run may store hashes of canonicalized input/output for:

- duplicate diagnosis;
- reproducibility;
- incident correlation.

Hashes must not be treated as anonymization of low-entropy sensitive data.

---

# 132. Usage Accounting Is Separate From AI Run

AI Run is execution evidence.

Usage Accounting owns canonical service-consumption accounting.

AI Run supplies measured dimensions to Usage.

---

# 133. Failed Attempts May Still Consume Usage

Provider/model attempts that fail after consuming compute/tokens may still produce Usage.

Usage is based on actual consumption, not merely successful business outcomes.

---

# 134. Commercial Accounting Is Separate

Router does not calculate final user charges.

Flow may be:

```text
AI Run
    ↓
Usage
    ↓
Commercial Rating
    ↓
Ledger
```

when Commercial is enabled.

---

# 135. Cost Is a Routing Input Only Through Policy

Router may use estimated infrastructure/provider cost as one preference.

It must not sacrifice:

- required quality;
- security;
- Data Governance;
- Task compatibility

solely to minimize cost.

---

# 136. Response Caching Is Not Default Authority

AI response caching is optional.

It is especially sensitive for:

- RAG;
- protected prompts;
- personalized context;
- authorization-sensitive output.

---

# 137. Shared Protected Response Cache Is Unsafe by Default

A cached result cannot be reused across identities merely because the user text is equal.

Cache equivalence may depend on:

```text
tenant
authorization
Data Governance
Task version
instruction version
source versions
model policy
```

---

# 138. Provider Prompt Caching Is an Infrastructure Detail

Provider/vLLM prefix caching may be used when safe.

It does not change Task semantics or access rules.

---

# 139. Cached Data Must Obey Retention Policy

Prompt/cache contents may contain protected data.

Caching must therefore obey the same governance and storage constraints as other derived data.

---

# 140. AI Evaluation Is Task-Specific

The Router must not use one universal leaderboard to select models.

Each Task or Task family requires relevant evaluation.

---

# 141. Evaluation Measures Quality and Operations

Relevant measures may include:

```text
task correctness
Persian quality
structured-output validity
hallucination/error rate
instruction adherence

TTFT
TPOT
total latency
throughput
concurrency
failure rate
context capacity

VRAM / hardware requirement
provider cost
```

Not every Task needs every metric.

---

# 142. Baseline Model Is the Control

Aya-Expanse-8B on the baseline serving stack is the initial comparison point for ordinary generative Tasks.

A more expensive tier must demonstrate meaningful benefit for the Task.

---

# 143. Promotion Requires Evidence

A Task is promoted to a higher tier only when evaluation establishes a reason such as:

```text
quality threshold not met
context insufficient
structured output unreliable
complex reasoning materially better
```

---

# 144. Hardware Upgrade Is Not a Quality Argument

Moving from:

```text
RTX4090
```

to:

```text
H200 NVL
```

may improve:

- capacity;
- latency;
- model eligibility.

It does not by itself prove better task quality.

---

# 145. Evaluation Datasets Are Versioned

Task evaluation datasets and scoring logic should have stable versions.

Without this, model comparisons are not reproducible.

---

# 146. Evaluation Data Is Governed

Confidential production data must not automatically become evaluation data.

Use of production samples requires appropriate Data Governance and privacy policy.

---

# 147. Evaluation Prevents Regression

Changing:

- model;
- quantization;
- prompt;
- Router policy;
- inference engine

may require regression evaluation for affected Tasks.

---

# 148. Quantization Is an Endpoint/Artifact Property

Quantization such as:

```text
FP16
BF16
FP8
INT8
4-bit
```

does not belong in business-module logic.

It is part of model/endpoint artifact configuration and evaluation.

---

# 149. Quantization Changes Require Evaluation Where Material

A smaller quantization may improve deployability but reduce Task quality.

Promotion requires relevant regression evidence.

---

# 150. Canary Deployment Is Supported

New models or endpoint versions may receive a bounded percentage of eligible traffic after passing required evaluation.

Canary policy records which executions used the candidate.

---

# 151. Canary Does Not Weaken Governance

Canary endpoints must satisfy the same:

- privacy;
- egress;
- residency;
- security;
- capability

requirements as the stable endpoint.

---

# 152. Shadow Evaluation Is More Restricted

Shadow execution duplicates real input to another endpoint without affecting the user-visible result.

Because it creates additional data processing, it requires explicit Data Governance approval.

---

# 153. Protected Traffic Is Not Shadowed by Default

Confidential prompts must not be duplicated to an experimental endpoint merely for model evaluation.

Synthetic or approved evaluation datasets are preferred.

---

# 154. Model Rollout Is Reversible

A model/policy rollout should permit reverting routing to the previous approved model profile without business-module changes.

---

# 155. Model Retirement Is Controlled

Before removing a Model/Endpoint, operators should verify:

- no active Task requires it exclusively;
- fallback exists where required;
- evaluation coverage exists;
- active Runs/jobs have a disposition.

---

# 156. Endpoint Failure Isolated From Non-AI Platform Functions

Model infrastructure outage should not make unrelated capabilities unavailable.

For example:

```text
Ticket listing
Document download
CRM CRUD
```

may remain operational when AI endpoints fail.

---

# 157. AI Router Failure Is Explicit

When no compliant execution path is available:

```text
AI_UNAVAILABLE
NO_ELIGIBLE_ENDPOINT
CAPACITY_EXHAUSTED
DATA_EGRESS_DENIED
```

or equivalent stable results are returned.

The Router must not improvise an unsafe path.

---

# 158. No Eligible Endpoint Is Different From Provider Failure

These conditions differ:

```text
No endpoint satisfies policy
```

versus:

```text
Eligible endpoint exists but is temporarily unhealthy
```

Error and retry behavior should distinguish them.

---

# 159. Unknown Inference Outcome Is Usually Recoverable by Re-execution

Pure inference normally has no external business side effect.

A lost response may therefore be retried according to Task Policy.

However:

- additional Usage may occur;
- generation may differ;
- streaming may already have committed output.

These facts must be recorded.

---

# 160. Tool-Assisted AI Uses Reconciliation for Side Effects

Once a workflow includes external Tool side effects, ordinary inference retry semantics are insufficient.

Unknown Tool outcomes use the shared Reconciliation architecture.

---

# 161. AI Execution Status Is Explicit

Useful Run states may include:

```text
PENDING
ADMITTED
ROUTING
RUNNING
STREAMING
SUCCEEDED
FAILED
CANCELLED
TIMED_OUT
```

Attempt-level state may additionally record provider-specific execution phases.

---

# 162. Terminal State Is Unambiguous

A Run must have one final terminal outcome.

Retry Attempts do not create several conflicting final Run states.

---

# 163. Cancellation Is Not Failure

User cancellation should be distinguishable from:

```text
provider error
timeout
validation failure
```

for Usage, diagnostics, and UX.

---

# 164. Observability Uses Structured Metrics

Useful AI metrics include:

```text
Run count
success/failure
TTFT
TPOT
tokens/sec
input tokens
output tokens
context utilization
queue time
routing latency
fallback rate
retry rate
structured-output failure
endpoint saturation
circuit state
```

---

# 165. Metrics Use Safe Labels

Never use:

- prompt text;
- Document content;
- user query;
- secret values

as metric labels.

---

# 166. AI Run and Operational Metrics Complement Each Other

Metrics answer:

> What is happening overall?

AI Runs answer:

> What happened to this execution?

They are separate observability forms.

---

# 167. Security-Significant AI Events Are Auditable

Examples may include:

```text
external egress denied
unauthorized Task attempt
protected diagnostic capture enabled
routing policy changed
external provider enabled
high-risk Tool call denied
```

Security Telemetry may export these events to SOC/SIEM.

---

# 168. Routine Model Errors Are Not All Security Events

A normal timeout or malformed structured output is operational telemetry unless security policy says otherwise.

Security logging must remain meaningful rather than becoming every application log.

---

# 169. Router Configuration Changes Are Audited

Administrative changes to:

- Task Policy;
- Model Registry;
- Endpoint Registry;
- privacy profile;
- external provider enablement;
- fallback chain;
- high-tier eligibility

are auditable.

---

# 170. Router Administration Uses Authority

There is no implicit:

```text
AI Admin = true
```

Administrator operations use explicit Authority permissions and scopes.

---

# 171. Tenant AI Policy Is Bounded

Tenant administrators may configure allowed AI behavior where deployment policy permits.

They cannot:

- enable forbidden external providers;
- exceed hard security limits;
- bypass Data Governance;
- access another tenant's endpoints or secrets.

---

# 172. Tenant-Dedicated Endpoints Are Supported

An Endpoint may be:

```text
shared
tenant-dedicated
deployment-dedicated
```

Router eligibility enforces this scope.

---

# 173. Endpoint Scope Is Not Inferred From Naming

A hostname containing a customer name is not a security boundary.

Endpoint tenant/deployment scope is explicit metadata.

---

# 174. Customer-Owned AI Infrastructure Is Supported

A customer may provide:

```text
vLLM endpoint
external provider credentials
GPU server
specialized model endpoint
```

through approved Endpoint/Adapter configuration.

Business modules remain unchanged.

---

# 175. Routing Supports Multiple Physical Topologies

The same semantic Router may operate over:

```text
single RTX4090
multiple local 4090 endpoints
H200 tier
customer GPU cluster
external provider
hybrid topology
```

without changing Task Contracts.

---

# 176. Router Must Be Horizontally Scalable

Router state required for correctness must not exist only in one process.

Replicated API/Router instances must share or derive consistent:

- endpoint configuration;
- Task Policies;
- Admission state where authoritative;
- security/governance state.

---

# 177. Router Replica Loss Must Be Safe

Losing one Router/API process must not lose:

- AI Run authoritative metadata;
- background Job;
- Usage evidence;
- routing configuration.

Interactive in-flight streams may terminate but must do so explicitly.

---

# 178. Model Server Restart Is Expected

Serving endpoint replacement/restart must be treated as normal operational behavior.

Router performs:

```text
health change
drain
fallback where permitted
recovery
```

without requiring module changes.

---

# 179. Model Warm-Up Is Operational State

Some endpoints may require warm-up.

Router may use:

```text
WARMING
```

or equivalent readiness state.

A not-yet-ready endpoint does not receive normal traffic.

---

# 180. Cold-Start Preference Is Not a Security Decision

Warm endpoint preference may improve latency.

It cannot override privacy or capability constraints.

---

# 181. Background AI May Queue During Temporary Capacity Loss

For retryable background Tasks, Worker/Job policy may retain work durably until compliant capacity becomes available.

Interactive Tasks may instead return a capacity/unavailable result.

---

# 182. Queueing Has Bounds

Background AI queues must have:

- maximum retry;
- backoff;
- terminal state;
- age/expiry policy where appropriate.

Work must not remain indefinitely invisible.

---

# 183. Priority Classes Are Explicit

Where priority scheduling exists, classes are canonical values.

Avoid arbitrary numeric priority scattered across modules.

---

# 184. High Priority Does Not Bypass Quota or Security

Priority affects scheduling among eligible work.

It does not create authority or override Data Governance.

---

# 185. AI Router Does Not Own User Conversation State

Conversation history belongs to the calling capability or appropriate shared conversation domain.

Router receives the prepared Task input.

---

# 186. Router Does Not Own Document Context

Document selection, Authority filtering, and citation provenance belong to Knowledge/RAG.

Router consumes authorized context.

---

# 187. Router Does Not Persist Business Output Automatically

A successful `letter.draft` result is not automatically stored as a Letter Draft.

The calling application explicitly validates and persists it through its own use case.

---

# 188. AI Output Cannot Directly Mutate Authoritative State

Required flow:

```text
AI Result
    ↓
Validate
    ↓
Application Rule
    ↓
Authority where applicable
    ↓
Persistence
```

Never:

```text
LLM
    ↓
Database
```

---

# 189. AI Task Errors Are Stable

Useful canonical errors may include:

```text
AI_TASK_NOT_AVAILABLE
AI_INPUT_INVALID
AI_OUTPUT_INVALID
NO_ELIGIBLE_ENDPOINT
AI_CAPACITY_EXHAUSTED
AI_TIMEOUT
AI_PROVIDER_UNAVAILABLE
AI_EXECUTION_FAILED
AI_EGRESS_DENIED
AI_CONTEXT_LIMIT_EXCEEDED
AI_CANCELLED
```

Provider-specific details remain internal.

---

# 190. Task Owner May Define Domain Errors After Validation

For example, Letter Assistant may convert a validated AI result into:

```text
LETTER_DRAFT_INSUFFICIENT_INFORMATION
```

if that is a business-semantic result.

AI Router does not define domain-specific errors.

---

# 191. AI Router Tests Begin With Contracts

Preferred order:

```text
Task Contract
    ↓
Routing/Evaluation Test
    ↓
Adapter Contract Test
    ↓
Implementation
    ↓
Load/Fault Test
```

---

# 192. Task Registration Tests Are Mandatory

Tests verify:

- unique Task ID;
- valid Task version;
- valid input schema;
- valid output schema;
- registered capabilities;
- valid Instruction Profile;
- owning module availability.

---

# 193. Routing Constraint Tests Are Mandatory

Tests cover combinations such as:

```text
Task needs structured output
Endpoint lacks structured output
→ endpoint excluded
```

and:

```text
Confidential input
External endpoint forbidden
→ endpoint excluded
```

and:

```text
Context too large
→ endpoint excluded
```

---

# 194. Fallback Tests Are Mandatory

Tests cover:

- primary success;
- primary timeout;
- alternate endpoint;
- high-tier fallback;
- no compliant fallback;
- security-restricted fallback;
- stream already committed.

---

# 195. Retry Tests Are Mandatory

Tests verify:

- retryable error;
- non-retryable error;
- retry limit;
- deadline exhaustion;
- backoff;
- no infinite retry.

---

# 196. Circuit-Breaker Tests Are Mandatory

Tests cover:

- closed;
- failure threshold;
- open;
- exclusion from routing;
- half-open probe;
- recovery.

---

# 197. Structured Output Tests Are Mandatory

Tests include:

- valid output;
- malformed JSON;
- wrong type;
- missing field;
- unexpected field where prohibited;
- bounded repair;
- repair exhaustion;
- no authoritative mutation after invalid output.

---

# 198. Context-Limit Tests Are Mandatory

Tests verify:

- under limit;
- exact boundary;
- above limit;
- no silent truncation;
- configured reduction strategy.

---

# 199. Data-Egress Tests Are Mandatory

Tests must prove:

- local-only data stays local;
- permitted external data may use eligible external endpoints;
- fallback cannot bypass egress denial;
- embedding and reranking obey the same rule;
- shadow traffic obeys governance.

---

# 200. Admission Tests Are Mandatory

Tests cover:

- quota available;
- quota exhausted;
- concurrency available;
- concurrency exhausted;
- multi-replica correctness;
- partial/failed attempt Usage.

---

# 201. Streaming Tests Are Mandatory

Tests cover:

- normal stream;
- cancellation;
- endpoint failure before first token;
- fallback before commitment;
- failure after commitment;
- explicit terminal status.

---

# 202. Provider Adapter Contract Tests Are Mandatory

Every adapter must test:

- request mapping;
- response mapping;
- timeout;
- malformed response;
- authentication failure;
- provider rate limit;
- cancellation where supported;
- usage extraction;
- error classification.

---

# 203. AI Run Tests Are Mandatory

Tests verify:

- stable Run ID;
- Attempt lineage;
- routing metadata;
- retry/fallback;
- token accounting;
- final status;
- correlation;
- no secret leakage;
- no chain-of-thought retention.

---

# 204. Evaluation Regression Tests Are Required

Promotion of a new Task policy/model should verify applicable quality and performance acceptance criteria.

A faster model that violates Task quality requirements is not an acceptable promotion.

---

# 205. Baseline-vs-High-Tier Evaluation Is Explicit

For Tasks proposed for H200/high-tier execution, tests should demonstrate the actual benefit over the baseline.

The decision must be evidence-driven.

---

# 206. Load Tests Are Required Where Scale Justifies Them

Relevant tests may include:

- concurrent interactive requests;
- background batch;
- mixed interactive/batch load;
- multiple Router replicas;
- several endpoints;
- capacity saturation;
- queue/backpressure behavior.

---

# 207. Soak Tests Are Required for Long-Running AI Infrastructure

Where production scale warrants it, soak tests should detect:

- memory leak;
- queue growth;
- endpoint degradation;
- latency drift;
- retry storms;
- resource exhaustion.

---

# 208. Fault Injection Is Required for Critical AI Paths

Fault scenarios may include:

```text
model server crash
network interruption
endpoint saturation
provider 429
provider 500
invalid structured output
Router replica restart
Worker restart
Data Governance denial
Admission backend failure
```

Security-sensitive uncertainty fails closed.

---

# 209. Architecture Tests Prevent Direct Model Access

CI should reject detectable patterns such as:

```text
business module importing vLLM client
business module importing provider SDK
hard-coded model endpoint in module
direct model name selection in business logic
Qdrant/RAG bypass into model
local fallback implementation
```

---

# 210. Architecture Tests Protect Task Ownership

Tests should ensure:

```text
Task semantic contract
    → owned by declaring module/platform capability

Routing policy
    → owned by AI Router
```

Neither side may absorb the other's semantics.

---

# 211. Model Strings Are Not Business Decisions

Business code may contain model names only in:

- fixtures;
- explicitly infrastructure-facing configuration;
- migration/compatibility code;
- test evidence.

They must not control business behavior.

---

# 212. Router Internals Are Private

Business modules may consume:

```text
AI Task contracts
AI Router public execution interface
stable AI errors/results
```

They must not import:

```text
Endpoint selection engine
Provider adapters
Model Registry persistence
Circuit-breaker internals
Routing policy internals
```

---

# 213. Provider Adapters Are Replaceable

Switching:

```text
vLLM
```

to:

```text
SGLang
```

or another compatible serving layer must not require business-module changes.

---

# 214. Model Replacement Is Replaceable by Design

Switching:

```text
Aya-Expanse-8B
```

to another validated model for the same Task must not alter the module contract.

---

# 215. Infrastructure Replacement Does Not Redefine Semantics

Changing:

```text
RTX4090
→ H200
```

or:

```text
local endpoint
→ approved customer endpoint
```

must not redefine Task meaning.

---

# 216. Final AI Router Rule

The architecture follows these rules:

```text
Modules request semantic Tasks.

Modules never select models directly.

Task meaning belongs to the semantic owner.

Routing belongs to AI Router.

Model, Endpoint, Provider, Serving Engine, and Hardware are different concepts.

Production model revisions are controlled.

Hard constraints are evaluated before optimization preferences.

Security and Data Governance always outrank fallback, latency, and cost.

Local failure never justifies unsafe external egress.

Aya-Expanse-8B / vLLM / RTX4090 is the initial baseline.

High-tier execution requires Task-specific evidence.

Model size is not a quality policy.

Structured output is always validated.

Model output is untrusted.

Context is never silently truncated.

Generation parameters are Task/Router policy.

Streaming has an explicit commitment boundary.

Retry is bounded.

Fallback is explicit and policy-controlled.

Circuit breakers and health protect failed dependencies.

Admission Control runs before expensive work.

Horizontal replicas do not depend on process-local authoritative limits.

Interactive and background workloads may have different capacity classes.

AI Run records execution and fallback lineage.

AI Run never stores chain-of-thought.

Protected prompt/response capture is opt-in and governed.

Usage Accounting owns consumption truth.

Commercial Accounting owns financial truth.

External embeddings and rerankers are data egress.

RAG authorization occurs before Router execution.

Tool requests are model output, not authority.

Every Tool operation is independently validated and authorized.

Evaluation is Task-specific.

Model promotion and high-tier routing are evidence-driven.

Canary and shadow execution never weaken governance.

AI infrastructure may scale or change without rewriting business modules.

Router behavior is observable, recoverable, scalable, and testable.
```

The default AI-routing question is:

> **Which semantic Task is being requested, what hard capability and governance constraints apply, which eligible endpoint best satisfies the approved policy, what bounded fallback is safe, and which AI Run evidence proves exactly how the execution occurred?**
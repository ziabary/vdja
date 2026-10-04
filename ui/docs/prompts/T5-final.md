# T5 — Document Core, Knowledge Spaces and Secure RAG Migration
# PostgreSQL Canonical State, Qdrant Derived Index,
# Authority-First Retrieval and AI-Router-Based RAG

ASSUMPTION:

`T5_START_GATE` is `YES` when `RAG_SECURITY_GATE` is `YES` in
`reports/security/rag-security-gate.json`, verified by
`npm run security:rag-gate`. Read the gate evidence and the mandatory sources
below before changing code. Identity, Session, Authority, and Audit foundations
must be present. T4 may remain PARTIAL while customer-release ASVS controls
are open.

This prompt already includes the complete mandatory Shared File Management, Local/S3
storage, secure transfer/cache, Audit/SIEM, and post-T5 security requirements.
There is no separate T5 addendum and this file is the single execution contract for T5.

The following are already operational and green:

- RAG security foundation gate;
- Identity;
- Authentication;
- persistent tenant-bound Session;
- Access/Refresh token lifecycle;
- refresh rotation/replay detection;
- Authority;
- all Authority conformance tests;
- tenant isolation;
- Usage;
- Admission Control;
- Audit;
- Observability;
- SIEM;
- CJSON Configuration;
- AI Router;
- anonymous and authenticated Translator/Summarizer/FAQ.

If the T5 start gate or any required foundation assumption is false, STOP and
report BLOCKED. `T5_COMPLETION_SECURITY_GATE` requires the T5 ASVS delta,
GenAI/RAG security gate, File Management security tests, Audit/SIEM verification,
and no newly introduced blocking security finding. `ASVS_L3_RELEASE_GATE`
remains a separate customer-release requirement after T5 reassessment.

Do not implement RAG on top of incomplete Authority/Session security.


====================================================================
0. GOVERNING DOCUMENT PROTECTION
====================================================================

The following are GOVERNING INPUTS and are READ-ONLY during T5 unless the
CURRENT user request explicitly authorizes changing the exact file/path:

- `AGENTS.md`;
- `docs/architecture/**`;
- `docs/prompts/**` including this prompt;
- any ADR/governance/frozen specification explicitly marked protected by
  repository instructions.

Reading, citing, testing against, or discovering an inconsistency in a governing
source is NOT permission to edit it.

Do NOT modify a protected governing document merely to:

- make implementation match current code;
- make a gate pass;
- record task status or test evidence;
- resolve an implementation/documentation mismatch;
- weaken or reinterpret an invariant;
- update a prerequisite discovered during this task.

If implementation reveals a necessary architecture change:

1. do not edit the governing document;
2. record the proposed change and rationale in the Activity Report and/or an
   explicitly non-governing proposal document;
3. continue only if the existing architecture still permits safe implementation;
4. if the change is blocking, STOP and request explicit user authorization.

Implementation/state documentation such as `docs/backend/**`,
`docs/security/**`, `docs/verification/**`, `docs/deployment/**` and task
Activity Reports may be updated only where this prompt explicitly requires it.
They must describe implementation truth without rewriting architecture to make
that truth appear compliant.

Before implementation, capture the working-tree state of protected paths.
Before finalizing, prove T5 introduced zero unauthorized modifications to
protected paths.

====================================================================
1. PRIMARY OBJECTIVE
====================================================================

Migrate the legacy RAG/document functionality into the target architecture.

At the end of T5:

- PostgreSQL is canonical for documents and knowledge metadata;
- Qdrant is derived and rebuildable;
- file storage is behind Storage abstraction;
- file parsing uses shared File Processing;
- Knowledge Spaces are canonical logical knowledge boundaries;
- Authority decides every protected operation;
- unauthorized content never reaches reranker or LLM;
- embeddings, reranking and answer generation use approved shared AI execution
  boundaries / AI Router;
- RAG usage is accounted;
- RAG Admission Control is active;
- semantic Audit is complete;
- RAG security events can reach SIEM;
- authenticated Svelte RAG UI works;
- legacy MySQL/RAG persistence is no longer required for the migrated RAG path;
- legacy direct-Qdrant business access is removed from target runtime.

====================================================================
2. GOVERNING SOURCES
====================================================================

Read:

AGENTS.md

docs/architecture/00-manifest.md
docs/architecture/01-system-architecture.md
docs/architecture/02-engineering-conventions.md
docs/architecture/03-persistence-and-database.md
docs/architecture/04-authorization-model.md
docs/architecture/05-module-architecture.md
docs/architecture/06-document-and-rag.md
docs/architecture/07-ai-router.md
docs/architecture/08-deployment-architecture.md

docs/security/05-t4-rag-security-readiness-fa.md
docs/security/06-t5-genai-rag-security-gate.md
reports/security/rag-security-gate.json
reports/security/t5-security-delta-backlog.json

Consume every applicable open control in the T5 security-delta backlog as a
T5 acceptance requirement. The GenAI/RAG gate is evaluated during and after
T5 for prompt injection, retrieval poisoning, cross-tenant retrieval,
vector/embedding isolation, authorization before materialization, sensitive
disclosure, insecure output, external egress, context contamination, and
resource/token exhaustion.

all T2/T3/T4 implementation docs and Activity Reports

current File Processing implementation
current Storage-related code
current AI Router
current Authority
current Usage/Admission/Audit/Observability/SIEM packages

Inspect actual legacy RAG source.

Do not design from memory.

====================================================================
3. START REPORT FIRST
====================================================================

npm run report:start -- DOCUMENT-KNOWLEDGE-RAG-T5

====================================================================
4. LEGACY RAG INVENTORY BEFORE IMPLEMENTATION
====================================================================

Find every legacy component related to:

- RAG routes;
- RAG services;
- resource service;
- document tables;
- upload tables;
- file metadata;
- user/document ownership;
- permission/quota reads;
- Qdrant client;
- collections;
- payload schemas;
- chunking;
- embeddings;
- reranker;
- prompts;
- chat/RAG answer;
- citations;
- file storage;
- temporary files;
- background processing;
- legacy UI;
- MySQL state;
- configuration.

Create:

docs/backend/06-t5-rag-legacy-inventory.md

Classify every dependency:

CANONICAL_DATA_TO_MIGRATE
DERIVED_DATA_TO_REBUILD
LEGACY_HISTORY_OPTIONAL
LEGACY_AUTH_TO_REPLACE
LEGACY_DIRECT_QDRANT
UNUSED

Do not copy legacy architecture blindly.

====================================================================
5. RAG IS A PLATFORM CAPABILITY
====================================================================

Do not create a generic business-module RAG silo if the governing architecture
defines RAG/Knowledge as platform capabilities.

Canonical ownership should converge to:

packages/documents
packages/file-processing
packages/storage
packages/knowledge
packages/data-governance

plus existing:

packages/authority
packages/ai-router
packages/usage
packages/admission-control
packages/audit
packages/observability

Use exact architecture-approved naming.

====================================================================
6. DOCUMENT CORE
====================================================================

Implement the canonical model:

Business Resource
      ↓
Document
      ↓
Document Version
      ↓
Document Asset

These are distinct entities.

Document Core owns at least:

- identity;
- versions;
- assets;
- metadata;
- provenance;
- processing state;
- classification;
- ACL relations;
- lifecycle;
- business-resource relation.

Do not make "uploaded file" synonymous with Document.

====================================================================
7. DOCUMENT VERSIONING
====================================================================

Document content changes create versions.

Do not silently overwrite authoritative old content.

A version should have stable identity and provenance.

Index state must refer to a specific version.

RAG answer/citation should be traceable to the exact version used.

====================================================================
8. DOCUMENT ASSET
====================================================================

Asset represents stored binary/source material.

Store at minimum appropriate safe metadata:

asset ID
document version ID
storage locator
MIME/type
size
cryptographic content hash
creation/provenance
processing state

Do not use user-supplied filename as physical storage path.

====================================================================
9. STORAGE ABSTRACTION
====================================================================

Implement/use the shared Storage contract.

Initial supported adapter(s) may include:

- mounted persistent volume;
- S3-compatible storage where already required.

Documents/Knowledge modules must never construct physical file paths directly.

Storage location is deployment configuration.

Secrets use secretRef.

====================================================================
10. FILE PROCESSING
====================================================================

Reuse/extend the shared File Processing capability.

Before deciding supported formats:

- inspect actual current File Processing implementation;
- reconcile it with governing docs;
- document any inconsistency.

Do not claim support merely because an architecture document lists a format.

For each enabled format:

- validate extension;
- validate MIME/signature where practical;
- enforce size limits;
- parser timeout/bounds;
- safe temporary-file handling;
- cleanup;
- parser-version metadata.

OCR remains deferred unless separately approved.

====================================================================
11. CANONICAL NORMALIZED CONTENT
====================================================================

Do not make Qdrant payload the only copy of processed text.

Store or durably derive enough canonical information to rebuild the semantic
index.

A deterministic rebuild should know:

- source Document Version;
- processor version;
- normalized-content identity/hash;
- chunker version;
- chunk policy;
- embedding policy/model version.

Avoid relying on an old Qdrant collection as canonical truth.

====================================================================
12. KNOWLEDGE SPACE
====================================================================

Knowledge Space is the primary logical RAG boundary.

A Knowledge Space may represent:

- tenant;
- organization unit;
- user;
- project;
- session;
- widget;
- another business context.

It owns/defines:

- document membership;
- indexing policy;
- retrieval policy;
- lifecycle;
- relevant ownership/policy facts.

Knowledge Space is NOT itself an authorization grant.

====================================================================
13. KNOWLEDGE SPACE AUTHORIZATION
====================================================================

Authority remains the only authorization decision engine.

Knowledge package provides facts.

Authority decides.

Do not implement:

if (space.ownerId === user.id) allow
if (role === manager) allow

inside Knowledge.

====================================================================
14. DOCUMENT OPERATIONS ARE INDEPENDENT
====================================================================

At minimum support independent Authority operations:

discover
read
download
use
quote
manage

Do not collapse these into `document.read`.

Examples:

A user may have `use` without `discover`.

That user may receive an AI-derived answer while not being allowed to:

- list the document;
- open it;
- download it;
- see its title/source identity;
- receive direct quotation.

====================================================================
15. CITATION SEMANTICS
====================================================================

Citation visibility requires `discover`.

Direct quoted citation requires:

discover
+
quote

If user has `use` but no `discover`:

RAG may use authorized content internally
but must not reveal hidden document identity.

If user lacks `quote`:

do not emit direct quotation.

Test these combinations explicitly.

====================================================================
16. AUTHORIZATION MUST PRECEDE RETRIEVAL
====================================================================

Required secure flow:

Question
   ↓
Execution Context
   ↓
Authority
   ↓
Knowledge Policy
   ↓
Authorized Retrieval Constraints
   ↓
Qdrant Search
   ↓
Final Candidate Authority Check
   ↓
Authorized Chunk Materialization
   ↓
Reranker
   ↓
Context Builder
   ↓
AI Router
   ↓
LLM

Forbidden:

Qdrant search across unauthorized content
→ materialize chunks
→ rerank
→ LLM
→ hide forbidden citations afterward

Unauthorized content must NEVER reach:

reranker
context builder
LLM

====================================================================
17. COARSE + FINAL AUTHORIZATION
====================================================================

For performance, Authority may provide coarse retrieval constraints suitable for
Qdrant filtering.

But a final candidate authorization check remains required before chunk content
is materialized or sent to reranker.

Do not trust Qdrant filter as the sole final authorization engine.

====================================================================
18. QDRANT IS DERIVED
====================================================================

PostgreSQL owns canonical:

- Document;
- Document Version;
- Asset metadata;
- Knowledge Space;
- ACL;
- classification;
- business ownership;
- indexing state;
- provenance.

Qdrant contains only:

- vector;
- derived retrieval payload;
- identifiers needed for search/filter;
- rebuildable metadata.

Qdrant loss must not destroy canonical state.

====================================================================
19. QDRANT OWNERSHIP
====================================================================

Only the Knowledge/RAG infrastructure boundary may use the Qdrant SDK/client.

Business modules must not import Qdrant directly.

Add architecture guardrails.

====================================================================
20. INDEX VERSIONING
====================================================================

Every vector/chunk index record must identify at least:

tenant
knowledge space
document
document version
chunk identity
embedding model/policy version
index generation/version

Prevent stale old document versions from silently appearing in retrieval.

====================================================================
21. SAFE REINDEX / BLUE-GREEN
====================================================================

Support safe rebuild into a new collection/index generation.

Conceptually:

canonical PostgreSQL/storage
        ↓
new Qdrant generation
        ↓
verification
        ↓
atomic alias/switch
        ↓
old generation retained briefly for rollback
        ↓
policy-driven cleanup

Do not destroy the active index before rebuild succeeds.

====================================================================
22. INGESTION IS DURABLE
====================================================================

Document processing is not a fragile in-memory callback.

Required flow:

Document/Version/Asset persistence
+
durable Job/outbox
→ commit
→ Worker
→ parse
→ normalize
→ chunk
→ embed
→ Qdrant
→ indexing-state update

Critical work must survive restart.

====================================================================
23. JOB IDEMPOTENCY
====================================================================

Indexing jobs must have stable identities.

Reprocessing the same version must not create uncontrolled duplicate chunks.

Define idempotency using:

document version
processing/index policy version
index generation

====================================================================
24. FAILURE STATES
====================================================================

Indexing lifecycle must distinguish meaningful states, e.g.:

PENDING
PROCESSING
READY
FAILED
STALE
REINDEX_REQUIRED

Do not report READY after only upload succeeds.

====================================================================
25. QDRANT FAILURE
====================================================================

If Qdrant is unavailable:

- document metadata remains valid;
- uploaded assets remain valid;
- PostgreSQL truth remains intact;
- retrieval becomes unavailable/degraded;
- indexing remains retryable;
- no canonical information is lost.

====================================================================
26. EMBEDDING THROUGH APPROVED AI BOUNDARY
====================================================================

Business/Knowledge logic must not directly select an embedding endpoint/model.

Extend AI Router semantic task support as needed for:

DOCUMENT_EMBED
QUERY_EMBED
RERANK
RAG_ANSWER

or architecture-consistent semantic task names.

Model/endpoint/provider selection remains AI Router-owned.

====================================================================
27. EMBEDDING MODEL IDENTITY
====================================================================

Persist enough metadata to know which embedding policy/model produced an index.

Changing embedding model/policy must make affected index generation stale /
rebuild-required.

Do not mix incompatible vector spaces in one logical generation.

====================================================================
28. RERANKER
====================================================================

Reranker is invoked only after candidate authorization.

No unauthorized content may be sent to reranker.

Reranker endpoint/model is Router/configuration-owned.

Do not hard-code it in Knowledge.

====================================================================
29. DATA GOVERNANCE / EGRESS
====================================================================

Implement/complete the Data Governance capability required by RAG.

Authorization answers:

"may this actor access/use this data?"

Data Governance answers additionally:

"may this data leave this trust boundary for this destination?"

Before sending protected text to:

external embedding endpoint
external reranker
external generation endpoint

obtain the applicable Data Governance decision.

Local authorization alone does not authorize external egress.

====================================================================
30. DATA GOVERNANCE INPUTS
====================================================================

Policy may consider:

tenant
resource
classification
residency
destination class
provider
retention
legal hold
external-provider eligibility
data minimization

Fail closed on security-sensitive ambiguity.

====================================================================
31. LOCAL ENDPOINTS
====================================================================

A deployment may classify an on-prem/private vLLM/embedding/reranking endpoint
differently from an external provider.

That classification belongs to CJSON/Data Governance policy.

Knowledge must not infer it from hostname/IP.

====================================================================
32. RETRIEVED CONTENT IS UNTRUSTED
====================================================================

Retrieved documents may contain prompt injection.

Treat them as untrusted data.

Retrieved text must not:

- override system instructions;
- alter Authority decisions;
- authorize tools;
- change tenant;
- request secrets;
- create side effects.

Use clear trusted/untrusted context boundaries.

Add prompt-injection regression tests.

====================================================================
33. CONTEXT BUILDING
====================================================================

Context construction must be explicit and budget-aware.

Inputs:

authorized chunks
reranker scores
task policy
model context window
reserved output budget
system/prompt overhead

No silent context truncation.

If required context cannot fit:

- reduce candidates according to documented policy;
- use a larger eligible Router tier;
- or return a stable limit/error outcome.

====================================================================
34. AI ROUTER
====================================================================

Final RAG answer generation goes through existing AI Router.

Knowledge requests semantic:

RAG_ANSWER

It never selects:

vLLM hostname
model
GPU
provider
fallback

AI Router owns execution.

====================================================================
35. RAG AI RUN
====================================================================

RAG answer produces normal AI Run telemetry.

Record safe metadata such as:

actor
tenant
knowledge space
task
endpoint/model
input/output token counts
latency
retrieval count
authorized candidate count
reranked count
configuration/policy version
terminal status

Do not store raw confidential context/prompts by default.

====================================================================
36. USAGE
====================================================================

Usage Accounting must include applicable dimensions:

upload bytes
documents processed
embedding tokens/items
query count
retrieval work
rerank work
generation input/output tokens

Associate usage with authenticated identity/tenant/module/capability.

Do not implement financial billing.

====================================================================
37. ADMISSION CONTROL
====================================================================

Before expensive RAG work enforce configurable policy for:

upload size
document count
storage
processing concurrency
embedding work
query rate
concurrent RAG requests
context/token budget
generation output budget

Authority may provide identity-specific policy values.

Admission remains final quota/capacity decision owner.

====================================================================
38. DOCUMENT LIMITS
====================================================================

Use T4 identity-aware limit architecture.

Do not implement role checks directly inside Documents/Knowledge.

Test:

anonymous if RAG public mode is explicitly supported;
authenticated default;
privileged higher limit;
platform hard maximum.

If T5 product scope requires login-only RAG, anonymous requests must receive a
stable authentication-required outcome.

====================================================================
39. AUDIT
====================================================================

Semantic audit must cover at least:

document.created
document.version.created
document.upload.failed
document.processing.started/completed/failed
document.downloaded
knowledge_space.created/changed
knowledge.document.added/removed
rag.query.requested/completed/failed/denied
rag.citation.revealed
rag.quote.revealed
document.acl.changed
document.classification.changed

Do not copy full document content to audit.

====================================================================
40. SIEM
====================================================================

Selected security-sensitive RAG events must be SIEM-eligible, especially:

cross-tenant attempts
authorization denials
ACL/classification changes
malicious/blocked upload
governance egress denial
repeated forbidden document access
index integrity/rebuild failures where security relevant

Do not send raw document text to SIEM.

====================================================================
41. DOCUMENT MUTATION AUDIT
====================================================================

Attach DB mutation audit according to field allowlist/redaction policy.

Do not blindly full-row capture:

document text
parsed content
secret storage locators
protected metadata

Document the audit policy per production table.

====================================================================
42. STORAGE SECURITY
====================================================================

Test:

path traversal
malicious filenames
duplicate filenames
oversized files
unsupported MIME
extension/MIME mismatch
truncated files
parser exceptions
temporary cleanup
symlink behavior where filesystem adapter allows it
cross-tenant asset access

Physical storage keys must not be user-controlled paths.

====================================================================
43. DOWNLOAD AUTHORIZATION
====================================================================

Download requires independent Authority operation.

A valid object/storage URL must not itself grant access.

Prefer authenticated API-mediated or short-lived controlled download mechanism
consistent with Storage architecture.

Do not expose permanent predictable filesystem paths.

====================================================================
44. LEGACY DATA MIGRATION
====================================================================

Create:

docs/backend/07-t5-rag-data-migration.md

Inventory and migrate canonical legacy data only.

Potential canonical source:

legacy MySQL metadata
original file assets
resource ownership
existing document names/metadata
existing user ownership mappings

Do NOT treat legacy Qdrant vectors as authoritative canonical data.

====================================================================
45. USER/TENANT MAPPING
====================================================================

Legacy RAG ownership must map to T4 canonical identities/tenants.

Unknown or ambiguous legacy owner:

FAIL CLOSED
→ migration exception report
→ operator decision

Do not assign ambiguous documents to a generic user.

====================================================================
46. LEGACY QDRANT
====================================================================

Legacy Qdrant may be used for comparison/validation only.

Preferred migration:

canonical source files/metadata
→ new Document Core
→ new processing
→ new chunks
→ new embedding
→ target Qdrant generation

Do not bulk-copy insecure/legacy payloads and inherit old authorization
assumptions.

====================================================================
47. MIGRATION VALIDATION
====================================================================

Compare:

legacy canonical document count
target document count
versions
assets
hashes
ownership mappings
Knowledge Space mapping
processing status
index-ready count

Report:

missing
extra
ambiguous
failed
excluded
reindexed

====================================================================
48. MIGRATION IS REPEATABLE
====================================================================

Migration tooling must support:

dry run
idempotent rerun
stable source identity
resume
safe failure
no legacy writes
no dual-write dependency after cutover

====================================================================
49. UI MIGRATION
====================================================================

Build authenticated Svelte surfaces for:

Knowledge Spaces
document list
upload
processing status
version information
document metadata
access/permission presentation
RAG question/answer
citations
errors
reindex/processing state where user is authorized

Reuse UI Core.

Do not clone legacy HTML/JS blindly.

====================================================================
50. FRONTEND AUTHORIZATION
====================================================================

Frontend may hide/disable operations for UX.

Backend Authority remains authoritative.

Never trust:

hidden button
route visibility
client-side permission store

as security enforcement.

====================================================================
51. CITATION UI
====================================================================

Citation UI must honor Authority result.

`use` without `discover`:
do not show hidden document identity.

No `quote`:
do not render direct quotation.

Authorized citation should identify exact:

document
version
chunk/source position where applicable

without leaking forbidden metadata.

====================================================================
52. RAG ANSWER STREAMING
====================================================================

Use established target streaming infrastructure.

Preserve:

bounded streaming
cancellation
safe terminal state
AI Router post-commit fallback rule

After visible output commitment, do not silently restart on another model.

====================================================================
53. SECURITY TEST — UNAUTHORIZED CONTENT NEVER REACHES AI
====================================================================

Instrument tests to prove:

unauthorized document
→ not materialized
→ not sent to reranker
→ not included in generation context

This is a mandatory gate.

Do not merely assert final answer does not quote it.

====================================================================
54. AUTHORIZATION MATRIX TEST
====================================================================

Test combinations of:

discover
read
download
use
quote
manage

including explicit deny.

Test:

owner
non-owner
role grant
identity grant
ACL grant
ACL deny
classification mismatch
tenant mismatch
suspended user
expired grant
scheduled grant

====================================================================
55. CROSS-TENANT TEST
====================================================================

Tenant A documents must never appear in:

Tenant B list
Tenant B search
Tenant B retrieval
Tenant B citation
Tenant B download
Tenant B Qdrant result materialization

Even with crafted IDs/filter payloads.

====================================================================
56. CLASSIFICATION TEST
====================================================================

Create lower/higher classified documents.

Verify:

insufficient clearance → DENY

ALL does not bypass classification hard boundary.

Missing mandatory classification fact → fail closed.

====================================================================
57. KNOWLEDGE SPACE IS NOT AUTH
====================================================================

Test that membership in/access to a Knowledge Space does not automatically grant
forbidden Document operation when Authority says DENY.

Knowledge Space narrows organization/retrieval.

Authority grants access.

====================================================================
58. QDRANT REBUILD TEST
====================================================================

Mandatory:

1. ingest canonical documents;
2. verify RAG works;
3. destroy a disposable target Qdrant collection/generation;
4. rebuild only from PostgreSQL + Storage canonical state;
5. verify index counts;
6. verify query behavior;
7. verify authorization;
8. verify citations.

Never perform destructive test against ambiguous production collection.

====================================================================
59. DOCUMENT VERSION TEST
====================================================================

Create Version 1
index
query

Create Version 2
reindex

Verify active policy does not accidentally retrieve stale Version 1 unless
explicit historical retrieval is intended.

Citations must point to correct version.

====================================================================
60. EMBEDDING CHANGE TEST
====================================================================

Change embedding policy/model in a test deployment.

Expected:

existing generation marked stale/rebuild-required
new generation built
switch only after validation

Do not silently mix vectors from incompatible embedding models.

====================================================================
61. DATA GOVERNANCE TEST
====================================================================

Create policy where:

Document may be locally used
but external provider egress is forbidden.

Expected:

Authority ALLOW local use
Data Governance DENY external egress
AI Router/provider call NOT MADE

Test local-approved provider policy separately.

====================================================================
62. PROMPT INJECTION TESTS
====================================================================

Include documents containing malicious text such as instructions to:

ignore system policy
reveal secrets
change permissions
call tools
include another tenant
override citations

Expected:

content treated as data
Authority unchanged
no unauthorized tool/action
no secret disclosure

====================================================================
63. ACCOUNTING TESTS
====================================================================

Verify RAG Usage records:

one logical request
→ one request settlement

Provider retries/fallback attempts:
→ correct provider/resource facts
→ no duplicate logical usage

Upload/index/query/generation dimensions remain distinct.

====================================================================
64. ADMISSION TESTS
====================================================================

Test:

oversized upload
too many documents
storage quota
indexing concurrency
query rate
RAG concurrency
token/context limit
output limit

Denied work must not invoke expensive downstream processing.

====================================================================
65. AUDIT TESTS
====================================================================

Verify:

semantic audit
DB mutation audit
SIEM selection
redaction

No raw document content should appear in ordinary audit/log/SIEM output.

====================================================================
66. PERFORMANCE / QUERY SAFETY
====================================================================

Capture non-claim baseline for:

authorized retrieval
Qdrant search
final authorization filtering
rerank
first-token time
end-to-end latency

Do not introduce per-chunk N+1 database queries if avoidable.

Optimize authorization batching without weakening semantics.

====================================================================
67. QDRANT PAYLOAD MINIMIZATION
====================================================================

Do not copy unnecessary confidential text/metadata into Qdrant payload.

Store only retrieval-required derived payload.

Canonical/protected facts remain PostgreSQL/Storage-owned.

====================================================================
68. NO RAW QUERY COUNT BY DEFAULT
====================================================================

Lists use cursor-based pagination where appropriate.

Do not run COUNT(*) automatically for all document/space lists.

Use explicit List+Count contract only when UI actually needs total.

====================================================================
69. CUSTOMER CONFIGURATION
====================================================================

CJSON controls:

RAG/Knowledge capability enabled
Qdrant endpoint
Storage adapter
file limits
chunk policy
embedding policy
rerank policy
RAG answer policy
Admission limits
Data Governance rules/references
retention references

Ordinary settings do not become ENV variables.

====================================================================
70. CUSTOMER IMAGE
====================================================================

Extend customer-specific image/release pipeline so a deployment can include:

existing public tools
+
authenticated RAG capability

without a source fork.

Branding remains customer-specific.

Secrets remain external.

====================================================================
71. NO LEGACY MYSQL REQUIREMENT
====================================================================

After RAG cutover, target RAG runtime must not require MySQL.

Migration tooling may have a separate legacy read-only connector artifact.

Normal target API/Worker images do not depend on MySQL.

====================================================================
72. NO LEGACY AUTH
====================================================================

Target RAG must not call legacy:

getAuthInfo
legacy session
legacy privilege object
legacy user/group tables

All authenticated context comes from T4 Identity/Session/Authority.

====================================================================
73. NO DIRECT QDRANT OUTSIDE OWNER
====================================================================

Static architecture rule:

only approved Knowledge/Qdrant infrastructure path may import Qdrant SDK/client.

Legacy violations outside target may remain recorded.

No new target violation.

====================================================================
74. NO DIRECT MODEL ACCESS
====================================================================

Documents/Knowledge/RAG must not call:

vLLM
embedding server
reranker
OpenAI-compatible endpoint

directly.

All semantic AI tasks go through AI Router.

====================================================================
75. SHARED FILE MANAGEMENT, STORAGE, TRANSFER AND CACHE
====================================================================

The following requirements are part of T5 itself. They are not a separate
addendum and are mandatory for T5 completion.

A. FILE MANAGEMENT IS A SHARED PLATFORM CAPABILITY
====================================================================

Introduce one shared logical File Management capability.

Conceptually:

packages/file-management

Exact path may follow the architecture-approved naming if a canonical equivalent
already exists.

This is a logical/in-process platform capability.

It is NOT required to be:

- a microservice;
- a separately deployed HTTP service;
- a separate container;
- a separate network boundary.

API, Worker and business modules may compose the same shared capability
in-process.

The architectural objective is:

Every target file operation
        ↓
File Management
        ↓
Authority / Document Core / Storage / File Processing

No business module should independently implement:

- upload security;
- download security;
- storage path generation;
- S3 access;
- file version handling;
- transfer caching;
- temporary upload handling;
- checksum validation;
- download headers;
- presigned URL generation;
- resumable transfer semantics.

====================================================================
B. OWNERSHIP MUST REMAIN CLEAN
====================================================================

Do NOT turn File Management into a generic god-package.

Canonical responsibilities remain distinct.

Document Core owns:

- Document identity;
- Document Version;
- Asset metadata;
- provenance;
- canonical version relations;
- classification;
- ACL/resource facts;
- processing state.

Authority owns:

- authorization decisions;
- discover/read/download/use/quote/manage evaluation;
- scope/ACL/classification/ownership policy.

Storage owns:

- physical byte persistence;
- local filesystem adapter;
- S3-compatible adapter;
- object I/O;
- storage-specific metadata.

File Processing owns:

- type detection;
- parsing;
- normalized content;
- processor-specific logic.

File Management owns the common file-operation boundary and orchestration:

- secure upload initiation;
- secure upload completion;
- secure download;
- file transfer lifecycle;
- version-aware asset selection;
- storage adapter orchestration;
- upload/download cache orchestration;
- checksum/integrity enforcement;
- range/conditional-download behavior;
- temporary staging;
- transfer cleanup;
- safe filenames/content disposition;
- transfer observability;
- transfer Usage/Audit hooks.

It consumes Authority decisions.

It does NOT independently evaluate roles/privileges.

====================================================================
C. REQUIRED LOGICAL FLOW
====================================================================

Upload:

HTTP/API
   ↓
Execution Context
   ↓
File Management
   ↓
Authority
   ↓
Admission Control
   ↓
Upload Policy / Validation
   ↓
Secure Staging
   ↓
Integrity / Type Verification
   ↓
Storage Adapter
   ↓
Document Core Version/Asset Commit
   ↓
Audit + Usage
   ↓
Durable Processing Job

Download:

HTTP/API
   ↓
Execution Context
   ↓
File Management
   ↓
Authority(download)
   ↓
Resolve exact Document Version / Asset
   ↓
Storage / Authorized Cache
   ↓
Safe Response / Controlled Signed Transfer
   ↓
Audit + Usage

No route or module may bypass this flow.

====================================================================
D. ALL APPLICATIONS USE FILE MANAGEMENT
====================================================================

Target capabilities/modules that need files must use the shared File Management
contract.

Examples include current/future:

- RAG / Documents;
- Translator file input;
- Summarizer file input;
- FAQ file input;
- CRM;
- Secretariat;
- Letter Assistant;
- Widget;
- Ticketing;
- future modules.

T5 should migrate the currently implemented public file upload/extraction path
onto the shared capability where doing so is compatible with existing contracts.

Do not leave two canonical file systems:

"public tools file flow"
and
"RAG file flow".

There is one shared file-management architecture.

====================================================================
E. NO DIRECT FILESYSTEM OR S3 ACCESS
====================================================================

Outside approved Storage/File Management infrastructure, target code must not:

- import S3 SDK;
- instantiate S3 clients;
- call fs read/write for managed persistent assets;
- construct physical storage paths;
- build object keys from user input;
- generate presigned URLs;
- copy/delete managed files directly.

Temporary parser internals may use approved isolated File Processing facilities,
but those paths must remain bounded and not become canonical storage.

Add architecture guardrails.

====================================================================
F. STORAGE ADAPTER CONTRACT
====================================================================

File Management must support at least:

1. LOCAL
2. S3_COMPATIBLE

through one typed storage contract.

A module must not care which adapter is active.

Conceptually:

File Management
   ↓
intfStoragePort
   ├── clsLocalStorageAdapter
   └── clsS3StorageAdapter

Follow project TypeScript naming conventions.

Storage selection comes from CJSON.

====================================================================
G. LOCAL STORAGE
====================================================================

Local storage must support:

- configured storage root;
- canonical opaque object keys;
- tenant-safe namespace strategy;
- atomic finalization where practical;
- fsync/durability policy where required;
- checksum verification;
- safe rename/move;
- no path traversal;
- no user-controlled physical path;
- no filename-based canonical identity.

Original user filename is metadata only.

====================================================================
H. S3-COMPATIBLE STORAGE
====================================================================

Support S3-compatible storage.

Configuration may include non-secret values such as:

- endpoint;
- region;
- bucket;
- path-style/virtual-host style;
- TLS policy;
- multipart thresholds;
- transfer concurrency;
- cache behavior.

Credentials are secret references.

Support customer-managed services such as:

- AWS S3;
- MinIO;
- Arvan-compatible S3;
- other S3-compatible implementations

without application-module changes.

Do not hard-code one vendor.

====================================================================
I. S3 SECURITY
====================================================================

S3 credentials:

- never reach browser;
- never appear in CJSON plaintext;
- never appear in logs;
- never appear in Audit/SIEM;
- use secretRef.

Use least-privilege bucket/object permissions.

Do not require bucket-public access.

====================================================================
J. DIRECT CLIENT TRANSFER
====================================================================

If direct browser-to-S3 transfer is supported, it must be controlled by File
Management.

Required:

Authority
→ Admission
→ File Management
→ short-lived scoped transfer authorization

Only then may a presigned operation be issued.

Presigned transfer MUST be:

- short-lived;
- method-specific;
- object-specific;
- size/policy constrained where protocol permits;
- tenant/resource scoped;
- non-reusable beyond intended semantics;
- audited.

Possession of an arbitrary storage URL does not grant authorization.

A permanent public object URL is not an authorization mechanism.

====================================================================
K. PROXY TRANSFER REMAINS SUPPORTED
====================================================================

File Management must also support API-mediated upload/download.

Deployments may choose:

PROXY
DIRECT_SIGNED
HYBRID

through CJSON where appropriate.

Modules do not choose the transport mode.

====================================================================
L. FILE VERSIONING
====================================================================

Version semantics must be explicit.

Do not conflate:

Document Version
with
storage-object backend versioning.

Canonical application version is Document Version.

A new authoritative file content revision creates/attaches the appropriate new
Document Version / Asset according to Document Core rules.

Storage backend version IDs, if available, are infrastructure metadata only.

They do not replace Document Version identity.

====================================================================
M. IMMUTABLE ASSET IDENTITY
====================================================================

Once an Asset represents a committed immutable version payload, its bytes must
not silently mutate in place.

Prefer:

new content
→ new Asset
→ new Document Version relationship

Store cryptographic content hash.

A changed object with the same canonical Asset identity is an integrity failure
unless an explicitly defined mutable temporary/staging state is involved.

====================================================================
N. CONTENT HASH
====================================================================

Use a standard cryptographic content digest for committed assets.

Use it for:

- integrity verification;
- cache identity;
- duplicate detection where policy allows;
- migration verification;
- corruption detection.

Do not treat hash equality alone as authorization.

Do not expose protected hash metadata unnecessarily.

====================================================================
O. DEDUPLICATION
====================================================================

Physical deduplication may be supported.

But deduplication must not collapse security/domain identity.

Two Documents may reference physically identical bytes while retaining:

- distinct Document identity;
- distinct ACL;
- distinct classification;
- distinct lifecycle;
- distinct provenance.

Never infer shared authorization because content hash matches.

====================================================================
P. UPLOAD STAGING
====================================================================

Uploads first enter an explicit temporary/staging lifecycle.

Conceptually:

INITIATED
UPLOADING
UPLOADED
VERIFYING
COMMITTED
FAILED
EXPIRED

Do not expose incomplete upload as a committed Asset.

Staging must be:

- bounded by size;
- tenant/request associated;
- automatically expirable;
- safely cleaned;
- invisible to normal document retrieval.

====================================================================
Q. RESUMABLE / MULTIPART UPLOAD
====================================================================

Design File Management so large uploads can use resumable/multipart transfer.

For T5 implement the necessary baseline for the selected adapters.

The shared contract must support:

upload session ID
part/chunk identity
expected total size
received ranges/parts
expiry
final integrity check
commit/finalization

Do not rely on process-local upload state for correctness.

Durable state belongs in PostgreSQL where required.

====================================================================
R. UPLOAD CACHE / STAGING CACHE
====================================================================

"Upload cache" means controlled transfer/staging acceleration.

It must not become an alternate canonical file store.

Potential uses:

- received chunk staging;
- resumable-part cache;
- verified temporary object reuse;
- local write-back buffer before S3 commit.

Required invariants:

- authoritative commit is explicit;
- temporary cache expiration is explicit;
- cache loss before commit does not falsely report success;
- cache state cannot bypass upload limits;
- cache path/key cannot be user-controlled.

====================================================================
S. DOWNLOAD CACHE
====================================================================

Implement a version-aware download/read cache abstraction.

Cache key must include sufficient immutable identity such as:

tenant/storage scope
asset identity
document version identity where relevant
content hash / asset generation
transform/representation identity where relevant

Do NOT key only by user filename or document title.

Cache must never turn one user's authorized read into another user's access.

====================================================================
T. AUTHORIZATION AND CACHE
====================================================================

Authorization occurs BEFORE serving a protected cached object.

Forbidden:

cache hit
→ return bytes
→ skip Authority

Required:

request
→ Authority
→ exact authorized Asset/Version
→ cache lookup
→ bytes

Do not cache authorization decisions inside the byte cache.

====================================================================
U. CACHE CONTENT SECURITY
====================================================================

Protected cache content must have controlled filesystem/storage permissions.

Cache location must not be publicly browsable.

Cache entries must not expose:

- tenant names where avoidable;
- raw user-controlled filenames;
- secrets;
- predictable public paths.

====================================================================
V. CACHE INVALIDATION
====================================================================

Use immutable/version-aware invalidation.

If a new Document Version is created:

old immutable Asset cache may remain until retention/eviction policy,
but active-version resolution must not incorrectly point to it.

If an Asset is quarantined/revoked/deleted by policy:

new download operations must stop serving it immediately even if bytes remain
in cache.

Authorization/lifecycle state always overrides cache presence.

====================================================================
W. CACHE EVICTION
====================================================================

CJSON defines cache policy.

Possible controls:

- enabled;
- maximum bytes;
- maximum entries;
- TTL;
- LRU or approved eviction strategy;
- local directory;
- per-tenant bounds where applicable.

Do not use unbounded disk cache.

Eviction is not canonical deletion.

====================================================================
X. HTTP DOWNLOAD CACHING
====================================================================

Support safe HTTP caching semantics where applicable:

- ETag based on immutable representation identity/content hash;
- Last-Modified where meaningful;
- If-None-Match;
- If-Modified-Since where appropriate;
- Range requests;
- Content-Length;
- safe Content-Type;
- safe Content-Disposition.

Security-sensitive/private downloads must use correct Cache-Control.

Do not accidentally mark protected content as publicly cacheable.

====================================================================
Y. BROWSER / PROXY CACHE POLICY
====================================================================

Different resources may require:

no-store
private
private with bounded revalidation
immutable for truly public immutable assets

The policy is derived from resource/security context.

Do not let business modules manually write arbitrary Cache-Control headers for
managed files.

====================================================================
Z. RANGE REQUESTS
====================================================================

File Management owns safe Range support.

Test:

- valid range;
- suffix range;
- invalid range;
- out-of-bounds range;
- multi-range if supported or explicit rejection;
- authorization before partial response.

Do not load very large files fully into memory solely to serve a range.

====================================================================
AA. STREAMING
====================================================================

Uploads/downloads should stream where practical.

Avoid:

read entire file into RAM
→ then send/store

for large managed assets.

Use bounded backpressure-aware streams.

Test client disconnect/cancellation.

====================================================================
AB. FILE LIMITS
====================================================================

File limits must compose with T4 Admission/Authority policy.

Relevant limits may include:

- maximum single upload size;
- maximum total storage;
- concurrent upload count;
- upload rate;
- download rate where required;
- maximum file count;
- parser-specific maximum;
- archive/extraction bounds.

File Management receives effective policy.

It does not interpret user roles itself.

====================================================================
AC. FILE TYPE SECURITY
====================================================================

Never trust filename extension alone.

Use layered checks:

- extension;
- declared MIME;
- signature/magic where practical;
- parser validation.

Detect suspicious mismatch.

Policy decides:

REJECT
QUARANTINE
ACCEPT_AS_UNTRUSTED

where applicable.

====================================================================
AD. ARCHIVE / DECOMPRESSION BOUNDS
====================================================================

Where archive-like formats are processed, protect against decompression bombs.

Bound:

- expanded bytes;
- file count;
- nesting;
- processing time.

Do not recursively unpack arbitrary content without explicit policy.

====================================================================
AE. MALWARE / CONTENT SCANNING EXTENSION
====================================================================

Define a scanning/quarantine extension point.

T5 does not have to implement a full commercial antivirus product unless already
required, but architecture must support:

Upload
→ Validation
→ optional Scanner
→ Clean / Suspect / Rejected
→ Commit/Quarantine

A quarantined asset cannot enter RAG indexing or normal download.

====================================================================
AF. PROCESSING ONLY AFTER COMMIT/APPROVAL
====================================================================

RAG File Processing starts only for an appropriately committed/approved Asset.

Do not parse/index an incomplete staging upload.

If scanning/quarantine is enabled, only approved state enters processing.

====================================================================
AG. FILE OPERATION AUTHORITY VOCABULARY
====================================================================

All managed operations use Authority.

At minimum distinguish:

discover
read
download
use
quote
manage

File-management-specific operations may additionally include:

upload
create_version
replace
delete / retire

if the governing authorization vocabulary requires them.

File Management invokes Authority.

It does not evaluate roles or ACL itself.

====================================================================
AH. DOWNLOAD IS NOT READ
====================================================================

Do not assume `read` implies `download`.

A user may:

read extracted/document content

but lack:

download original asset

Test this explicitly.

====================================================================
AI. USE IS NOT DOWNLOAD
====================================================================

A user may have:

use

for RAG

without:

discover
read
download
quote

In that case File Management may supply authorized content internally to the
RAG pipeline only through the approved `use` operation.

It must not expose the underlying file to the user.

====================================================================
AJ. INTERNAL CONTENT MATERIALIZATION
====================================================================

RAG internal materialization must use File Management/Document Core contracts.

Do not bypass file authorization by directly reading the physical object from
Storage inside Knowledge/RAG.

Required:

Knowledge
→ authorized candidate
→ File/Document operation
→ authorized content materialization

====================================================================
AK. STORAGE LOCATION MUST NOT GRANT ACCESS
====================================================================

Knowing:

bucket
object key
local path
asset ID
S3 version ID
cache key

does not grant access.

Every externally accessible operation requires the proper Authority decision.

====================================================================
AL. FILE AUDIT
====================================================================

Semantic Audit must cover at minimum:

file.upload.initiated
file.upload.completed
file.upload.failed
file.upload.expired
file.asset.committed
file.version.created
file.download.requested
file.download.completed
file.download.denied
file.quarantined where applicable
file.deleted_or_retired
file.cache.integrity_failure
file.storage.failure

Do not record file contents.

====================================================================
AM. FILE USAGE ACCOUNTING
====================================================================

Usage may record:

upload bytes
download bytes
storage bytes
file count
processing bytes
cache hit/miss operational metrics where appropriate

Do not turn operational cache metrics into financial accounting.

Identity/tenant/session correlation comes from Execution Context.

====================================================================
AN. FILE OBSERVABILITY
====================================================================

Safe metrics/logs may include:

adapter
operation
duration
bytes
cache hit/miss
range/full
status
safe error class
request/correlation ID

Do not log:

raw document content
secret object credentials
signed URL secret query values
protected full paths
raw presigned tokens

====================================================================
AO. SIEM FILE SECURITY EVENTS
====================================================================

Security-relevant file events may be SIEM eligible, for example:

cross-tenant file attempt
download authorization denial
repeated forbidden access
path traversal attempt
MIME/signature mismatch
malware/quarantine event
integrity/hash failure
abnormal upload abuse
storage-policy violation

Do not export document contents.

====================================================================
AP. STORAGE FAILURE SEMANTICS
====================================================================

Distinguish:

SUCCESS
FAILED
UNKNOWN / UNRESOLVED

where remote S3 operation outcome is ambiguous.

Do not blindly retry a possibly committed external write.

Use stable object/upload identity and reconciliation where necessary.

====================================================================
AQ. S3 MULTIPART FAILURE
====================================================================

Test:

- create multipart;
- upload parts;
- failure before complete;
- retry;
- duplicate part;
- complete;
- abort;
- process restart;
- stale multipart cleanup.

Do not leak orphaned multipart uploads indefinitely.

====================================================================
AR. LOCAL/S3 PARITY
====================================================================

The same File Management contract must pass against:

LOCAL adapter
S3-compatible adapter

Business/application tests must not depend on adapter-specific behavior unless
the contract explicitly exposes it.

Use a deterministic local S3-compatible test service where appropriate.

====================================================================
AS. STORAGE MIGRATION
====================================================================

Design for controlled migration:

LOCAL
→ S3

or:

S3 A
→ S3 B

without changing Document/Asset identity.

Migration must:

copy
verify hash
record destination
switch canonical location safely
retain rollback information as policy permits

Do not require business-module changes.

Full storage migration tooling may be bounded to T5 needs, but the model must not
block it.

====================================================================
AT. CACHE REBUILDABILITY
====================================================================

File cache must be disposable.

Deleting cache must not delete canonical Assets.

Mandatory test:

populate cache
delete cache safely
download again
repopulate from canonical Storage
verify identical content hash

====================================================================
AU. FILE MANAGEMENT IS NOT A SERVICE
====================================================================

Do not add unnecessary network boundaries.

Required default shape:

apps/api
   → File Management package

apps/worker
   → File Management package

Knowledge/Documents/other modules
   → File Management contract

Storage adapters remain implementation details.

A future independently scaled service is possible only if operational evidence
later justifies it.

Do not design T5 around a file-management microservice.

====================================================================
AV. FILE MANAGEMENT CONFIGURATION
====================================================================

Use canonical CJSON.

Example domains:

fileManagement: {
  storage: ...,
  uploads: ...,
  downloads: ...,
  cache: ...,
  security: ...,
  staging: ...
}

Do not create dozens of ENV variables.

Secrets remain secretRef.

Validate all configuration before startup/reload.

====================================================================
AW. CUSTOMER STORAGE PROFILE
====================================================================

Customer release must support choosing:

LOCAL
or
S3_COMPATIBLE

without rebuilding application source.

Customer-specific image may package the customer's non-secret CJSON according
to the established release model.

Storage credentials remain external.

====================================================================
AX. FILE MANAGEMENT READINESS
====================================================================

Readiness should distinguish:

Storage healthy
Cache healthy/degraded
Staging writable
required secrets resolved

For S3:

required bucket/storage unavailable
→ NOT_READY for file-dependent enabled capabilities

Cache unavailable but canonical Storage healthy:
→ normally DEGRADED, if safe direct operation remains possible

Do not report READY when canonical storage cannot satisfy enabled file
operations.

====================================================================
AY. STATIC ARCHITECTURE GUARDRAILS
====================================================================

Add high-confidence rules for target code:

direct S3 SDK outside approved Storage adapter = violation
persistent fs access outside Storage/File Management = violation
physical path construction in business modules = violation
presigned URL generation outside File Management = violation
managed download response outside approved boundary = violation
file authorization evaluation outside Authority = violation
RAG direct Storage read bypassing File Management = violation
module-owned cache for managed assets = violation

Add positive/negative self-tests.

====================================================================
AZ. FILE MANAGEMENT TEST MATRIX
====================================================================

At minimum automate:

1. local upload success;
2. local download success;
3. S3 upload success;
4. S3 download success;
5. identical contract behavior;
6. oversized upload rejected before expensive work;
7. invalid MIME/signature;
8. malicious filename/path traversal;
9. version 1 / version 2;
10. old-version explicit access;
11. active-version resolution;
12. content hash verification;
13. corrupt stored object detection;
14. upload interruption;
15. resumable upload;
16. duplicate upload completion/idempotency;
17. unauthorized download;
18. read without download;
19. use without discover/download;
20. tenant mismatch;
21. classification denial;
22. cached authorized download;
23. cached unauthorized request denied;
24. cache eviction;
25. complete cache loss + rebuild;
26. stale version cache safety;
27. range request;
28. conditional GET/ETag;
29. private Cache-Control;
30. client disconnect;
31. API restart during transfer lifecycle;
32. Worker restart during processing;
33. S3 timeout ambiguous outcome;
34. cleanup of staging;
35. audit generation;
36. Usage accounting;
37. SIEM selection/redaction.

====================================================================

====================================================================
76. POST-T5 SECURITY DELTA AND CURRENT ASVS REASSESSMENT
====================================================================

T5 must reassess security after implementing the new Document/RAG/File
Management surface.

Create/update:

`docs/security/03-t5-rag-security-delta-fa.md`

and create:

`docs/security/03-t5-asvs-5.0-level3-assessment-fa.md`

Both security reports MUST be Persian.

Use the same authoritative OWASP ASVS 5.0 Level 3 baseline established by T4.

The complete current-state ASVS assessment must be refreshed across the product,
including the new T5 surface. However, T5 completion and customer Level-3
release are separate gates.

Classify every previously open `verifyDuringT5` control and every control whose
applicability/evidence changed because of T5.

T5 may be COMPLETE when:

- no new T5-introduced blocking security finding remains;
- no unresolved control that is mandatory for `T5_COMPLETION_SECURITY_GATE`
  remains blocking;
- the GenAI/RAG security gate passes;
- File Management security tests pass;
- Audit/SIEM verification passes.

Pre-existing release-only controls such as customer-edge TLS/HSTS/HSM or
hardware-assurance evidence MAY keep:

`ASVS_L3_RELEASE_GATE = NO`

without making T5 itself PARTIAL, provided they are not T5-scope blockers and
are reported honestly.

Do not mark deferred release controls PASS merely to complete T5.
Do not claim external ASVS certification.

BB. ASVS FILE-SPECIFIC VERIFICATION
====================================================================

Explicitly evaluate applicable controls for:

- authentication;
- session management;
- access control;
- validation;
- encoding;
- stored data protection;
- file handling;
- upload security;
- download security;
- API security;
- secure configuration;
- logging;
- external service communication;
- secrets;
- cryptography;
- SSRF;
- path traversal;
- injection;
- resource exhaustion;
- cache exposure;
- tenant isolation;
- S3 permissions;
- signed URLs;
- dependency/supply-chain security.

Every requirement remains:

PASS
FAIL
NOT_VERIFIED
NOT_APPLICABLE

NOT_APPLICABLE needs technical justification.

Do not claim external certification.

====================================================================
BC. ASVS SECURITY TESTS MUST BE REAL
====================================================================

Run actual tests where technically possible.

Examples:

- crafted path traversal;
- malformed upload;
- MIME spoofing;
- oversized upload;
- authorization bypass attempts;
- cross-tenant asset ID;
- tampered signed transfer;
- expired signed transfer;
- cache replay attempt;
- malicious Range header;
- SSRF-like S3 endpoint/config abuse;
- malicious CJSON storage endpoint;
- secret leakage scan;
- dependency/image scan.

Document automated versus manual verification accurately.

====================================================================
BD. AUDIT END-TO-END REVERIFICATION
====================================================================

T5 must reverify all Audit layers, not only add RAG events.

Verify:

Database Mutation Audit
+
Semantic Audit
+
AI Run evidence
+
File events
+
RAG security events

Create an audit verification matrix:

action
expected semantic event
expected DB mutation evidence
actor/session/tenant
request/correlation
sensitive-field exclusion
result

Test both:

successful operation
failed/denied operation

====================================================================
BE. AUDIT CORRELATION
====================================================================

For one complete RAG request prove end-to-end correlation across:

HTTP request
Session
Authority decision
File access
Knowledge retrieval
Qdrant query
Rerank
AI Router run
Usage
Semantic Audit
Operational log
SIEM export

Use request/correlation identities.

Do not expose raw protected content in the report.

====================================================================
BF. AUDIT IMMUTABILITY
====================================================================

Reverify:

normal API role cannot update/delete canonical audit;
normal Worker role cannot rewrite semantic audit;
DB mutation audit cannot be disabled by runtime;
audit rollback behavior remains correct.

Add live PostgreSQL tests.

====================================================================
BG. AUDIT REDACTION
====================================================================

Scan Audit evidence for accidental inclusion of:

document body
chunk content
prompt
LLM response
password
cookie
access token
refresh token
S3 credential
presigned URL secret query
storage secret
raw confidential filename/path where prohibited

Any leakage is a blocking T5 defect.

====================================================================
BH. SIEM END-TO-END REVERIFICATION
====================================================================

Do not merely unit-test the exporter.

Use the actual T5 canonical evidence.

At minimum send selected events representing:

login/security event
Authority denial
file download denial
cross-tenant document attempt
RAG query event
Data Governance egress denial
file-integrity/security event

through:

Canonical Evidence
→ Security Telemetry
→ durable export state
→ Worker
→ test SIEM receiver

Verify receipt.

====================================================================
BI. SIEM DELIVERY TESTS
====================================================================

Reverify:

success
503 retry
permanent 4xx
timeout before known acceptance
timeout after possible acceptance
UNKNOWN / UNRESOLVED
idempotent destination retry
non-idempotent destination no-blind-retry
Worker restart
API restart
destination outage
backlog recovery
duplicate event identity
redaction
checkpoint/ack state

Canonical Audit must survive all destination failures.

====================================================================
BJ. SIEM CONTENT REDACTION
====================================================================

Verify exported SIEM envelopes do NOT contain:

raw document text
RAG chunks
raw model prompt
model response
password
session credential
JWT
refresh token
S3 secret
presigned URL credential
database secret

Only safe identifiers/metadata may be exported according to policy.

====================================================================
BK. SIEM FAILURE MUST NOT BREAK RAG
====================================================================

With SIEM receiver unavailable:

upload
index
query
authorized RAG answer

must continue if deployment policy classifies SIEM as optional/degraded.

Export backlog remains durable.

Health should report appropriate DEGRADED state.

====================================================================

====================================================================
76A. T5 SECURITY / AUDIT / SIEM COMPLETION GATE
====================================================================

T5 cannot be COMPLETE unless:

- all controls marked `verifyDuringT5` have been re-evaluated with evidence;
- T5-introduced/T5-scope blocking findings = 0, or an explicitly approved
  documented exception exists according to governing rules;
- `GENAI_RAG_SECURITY_GATE = PASS`;
- File Management security tests = PASS;
- Audit end-to-end verification = PASS;
- Audit immutability = PASS;
- Audit redaction = PASS;
- SIEM real-event delivery = PASS;
- SIEM retry/UNKNOWN behavior = PASS;
- SIEM restart/recovery = PASS;
- SIEM destination outage isolation = PASS.

After this evaluation, recompute and report `ASVS_L3_RELEASE_GATE` independently.
It may remain `NO` because of release-only controls without preventing T5 from
being COMPLETE.

====================================================================
76. REQUIRED END-TO-END TEST
====================================================================

Real target stack:

Svelte Web
API
Worker
PostgreSQL
Qdrant
Storage
AI Router
embedding endpoint
reranker if configured
generation vLLM

Flow:

login
→ select tenant
→ create Knowledge Space
→ upload document
→ processing/indexing
→ ask question
→ authorized retrieval
→ rerank
→ AI Router
→ streamed answer
→ authorized citation
→ Usage
→ Audit
→ SIEM-selected evidence

All must pass.

====================================================================
77. FAILURE END-TO-END TEST
====================================================================

Also prove:

Qdrant down
Storage down
embedding endpoint down
reranker down
generation endpoint down
revoked session
Authority deny
Data Governance deny
quota exhausted
malicious file
malicious retrieved prompt

Each must fail/degrade predictably.

====================================================================
78. STATIC ARCHITECTURE GATES
====================================================================

Target T5 paths must have:

SQL outside persistence = 0
Qdrant access outside Knowledge owner = 0
authorization evaluation outside Authority = 0
direct model/provider calls outside AI Router = 0
direct file path construction outside Storage = 0
module-local quota decision = 0
raw protected RAG content logging = 0
ordinary ENV config violations = 0
legacy auth dependency = 0
legacy MySQL runtime dependency = 0

====================================================================
79. REQUIRED DOCUMENTATION
====================================================================

Create/update at least:

`docs/backend/06-t5-rag-legacy-inventory.md`
`docs/backend/07-t5-rag-data-migration.md`
`docs/backend/08-document-core.md`
`docs/backend/09-knowledge-rag.md`
`docs/backend/10-rag-authorization-flow.md`
`docs/backend/11-file-management.md`
`docs/backend/12-storage-and-transfer.md`
`docs/deployment/03-rag-customer-release.md`
`docs/security/03-t5-rag-security-delta-fa.md`
`docs/security/03-t5-asvs-5.0-level3-assessment-fa.md`
`docs/verification/02-t5-audit-siem-verification-fa.md`

The File Management document must define:

- ownership;
- contracts;
- version semantics;
- upload lifecycle;
- download lifecycle;
- cache semantics;
- local adapter;
- S3 adapter;
- security boundary;
- Authority integration;
- Admission integration;
- Usage/Audit integration;
- failure/reconciliation;
- configuration;
- readiness;
- operations.

The ASVS and Audit/SIEM verification reports MUST be Persian.

Do NOT modify protected governing architecture/prompt documents merely to record
T5 evidence. If a governing change is necessary, report it as a proposed change
and request explicit authorization.

====================================================================
80. T5 ACCEPTANCE CRITERIA
====================================================================

T5 is COMPLETE only when ALL core RAG and File Management criteria below are true.

Core RAG criteria:

1. legacy RAG inventory complete;
2. canonical data migration mapped;
3. Document Core implemented;
4. Version implemented;
5. Asset implemented;
6. Storage abstraction implemented;
7. File Processing integrated;
8. Knowledge Space implemented;
9. Qdrant is derived only;
10. Qdrant is rebuildable;
11. index generation/versioning implemented;
12. ingestion jobs durable;
13. ingestion idempotent;
14. Authority precedes retrieval;
15. final candidate authorization implemented;
16. unauthorized chunks never reach reranker;
17. unauthorized chunks never reach LLM;
18. discover/read/download/use/quote/manage are independent;
19. citation authorization correct;
20. quote authorization correct;
21. classification enforced;
22. tenant isolation enforced;
23. ACL deny semantics correct;
24. ALL cannot bypass hard boundaries;
25. Data Governance egress implemented;
26. protected external egress denied correctly;
27. embedding uses AI Router;
28. reranking uses approved Router boundary;
29. RAG answer uses AI Router;
30. no business code chooses model/provider;
31. context budgeting has no silent truncation;
32. prompt-injection tests pass;
33. RAG Usage works;
34. RAG Admission works;
35. semantic Audit works;
36. DB mutation Audit works;
37. SIEM selection/redaction works;
38. authenticated RAG UI works;
39. processing status UI works;
40. citations work;
41. legacy users map safely;
42. ambiguous owners fail migration;
43. legacy Qdrant not treated as canonical;
44. fresh Qdrant rebuild test passes;
45. document-version test passes;
46. embedding-policy change/reindex test passes;
47. MySQL-off RAG passes;
48. legacy auth-off target RAG passes;
49. target architecture guardrails pass;
50. Level 3 RAG security delta has no blocking failure.

File Management and security completion criteria:

51. shared File Management capability exists;
52. File Management is logical/in-process by default, not an unnecessary microservice;
53. all target managed file operations use File Management;
54. direct business-module filesystem access for managed persistent assets is zero;
55. direct business-module S3 access is zero;
56. Local Storage adapter works;
57. S3-compatible Storage adapter works;
58. adapter choice is CJSON-driven;
59. storage credentials/secrets remain external through secretRef;
60. Document Version is distinct from backend object version;
61. committed Asset bytes are immutable by identity;
62. content-hash verification works;
63. upload staging lifecycle exists;
64. incomplete uploads are not exposed as committed/usable Assets;
65. resumable/multipart semantics work as required;
66. upload cache/staging is bounded and non-canonical;
67. download cache is version-aware;
68. cache never bypasses Authority;
69. cache is disposable/rebuildable;
70. cache eviction is bounded;
71. stale cache cannot expose superseded/revoked/forbidden content;
72. Range support is safe;
73. conditional download works where configured;
74. protected content uses safe cache headers;
75. download is independently authorized;
76. read does not imply download;
77. use does not imply discover/download;
78. RAG cannot bypass File Management to read Storage;
79. path traversal/archive/symlink tests pass;
80. MIME/signature/type-consistency tests pass;
81. file size/resource-exhaustion tests pass;
82. S3 ambiguous-outcome/reconciliation semantics are safe;
83. File semantic Audit works;
84. File Usage Accounting works;
85. file security events can reach SIEM;
86. static File Management architecture guards are green;
87. post-T5 complete Persian current-state ASVS assessment exists;
88. all `verifyDuringT5` controls are re-evaluated with concrete evidence;
89. T5-introduced/T5-scope blocking security findings = 0 or approved documented exceptions;
90. GenAI/RAG security gate passes;
91. Audit end-to-end verification passes;
92. Audit immutability passes;
93. Audit sensitive-data leakage scan passes;
94. SIEM real T5 event delivery passes;
95. SIEM UNKNOWN/retry semantics pass;
96. SIEM restart/recovery passes;
97. SIEM outage does not corrupt/block ordinary RAG when policy says optional/degraded;
98. SIEM redaction passes;
99. T5 introduced zero unauthorized modifications to protected governing documents;
100. `ASVS_L3_RELEASE_GATE` is recomputed and reported independently; it may remain NO without making T5 PARTIAL when only release-only controls remain open;

====================================================================
81. FINAL RESPONSE
====================================================================

Return:

Activity Report:
<path>

T5:
COMPLETE / PARTIAL / BLOCKED

T5_START_GATE:
PASS / FAIL

T5_COMPLETION_SECURITY_GATE:
PASS / FAIL

RAG_SECURITY_GATE:
YES / NO

GENAI_RAG_SECURITY_GATE:
PASS / FAIL

ASVS_L3_RELEASE_GATE:
YES / NO

Legacy RAG inventory:
PASS / FAIL

Document Core:
PASS / FAIL

Knowledge Spaces:
PASS / FAIL

File Management:
PASS / FAIL

File Management deployment form:
IN_PROCESS / SERVICE

Expected:
IN_PROCESS

Direct managed-file access outside File Management:
<count>

Storage:
PASS / FAIL

Local storage adapter:
PASS / FAIL

S3-compatible storage adapter:
PASS / FAIL

Upload staging/resume:
PASS / FAIL

Version integrity:
PASS / FAIL

Download cache:
PASS / FAIL

Cache authorization:
PASS / FAIL

Cache rebuild:
PASS / FAIL

File Processing:
PASS / FAIL

Path traversal/file-security tests:
PASS / FAIL

Legacy data migration:
PASS / FAIL

Qdrant derived-only:
PASS / FAIL

Qdrant rebuild:
PASS / FAIL

Authority-before-retrieval:
PASS / FAIL

Unauthorized content reaches reranker:
YES / NO

Unauthorized content reaches LLM:
YES / NO

Document operation matrix:
PASS / FAIL

Tenant isolation:
PASS / FAIL

Classification:
PASS / FAIL

Data Governance egress:
PASS / FAIL

Embedding via AI Router:
PASS / FAIL

Rerank via AI Router:
PASS / FAIL

RAG answer via AI Router:
PASS / FAIL

Usage:
PASS / FAIL

Admission:
PASS / FAIL

Audit:
PASS / FAIL

Audit end-to-end:
PASS / FAIL

Audit immutability:
PASS / FAIL

Audit sensitive-data leakage:
PASS / FAIL

SIEM:
PASS / FAIL

SIEM real-event delivery:
PASS / FAIL

SIEM UNKNOWN/retry semantics:
PASS / FAIL

SIEM restart recovery:
PASS / FAIL

SIEM redaction:
PASS / FAIL

Authenticated RAG UI:
PASS / FAIL

MySQL required by target RAG:
YES / NO

Legacy Auth required:
YES / NO

Target architecture violations:
<count>

Unauthorized protected-governing-document changes:
<count>

ASVS current Level 3 posture:
PASS <count> / FAIL <count> / NOT_VERIFIED <count> / N/A <count>

T5/verifyDuringT5 blocking findings:
<count>

Release-only ASVS blocking findings:
<count>

Persian T5 ASVS report:
<path>

Persian Audit/SIEM verification report:
<path>

Ready for next business-module migration:
YES / NO

Customer Level-3 release authorized:
YES / NO

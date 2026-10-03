# T5 ADDENDUM — Shared File Management Capability,
# Secure Transfer/Caching, Local + S3 Storage,
# Final ASVS Level 3 Review and Audit/SIEM Verification

This addendum is mandatory.

Where it conflicts with the earlier T5 prompt, this addendum takes precedence.

T5 is NOT complete unless a shared File Management capability exists and all
target application file operations use it.

T5 is also NOT complete unless:

- the final OWASP ASVS Level 3 assessment is updated after RAG/File Management;
- Audit behavior is reverified end-to-end;
- SIEM delivery is reverified end-to-end.

====================================================================
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
BA. T5 FINAL OWASP ASVS LEVEL 3 ASSESSMENT
====================================================================

T5 must perform a NEW post-implementation security assessment.

Do not merely reference the T4 report.

Reassess the complete product including the new attack surface:

- File Management;
- Storage;
- local filesystem;
- S3;
- presigned transfers;
- upload/download;
- caching;
- Document Core;
- Knowledge/RAG;
- Qdrant;
- File Processing;
- Authority;
- Session/Auth;
- AI Router;
- Data Governance;
- Worker;
- SIEM;
- customer configuration.

Use the same authoritative ASVS version/baseline established by T4.

Target:

OWASP ASVS 5.0 Level 3

Create:

docs/security/03-t5-asvs-5.0-level3-assessment-fa.md

The report MUST be Persian.

Do not merely produce a "delta" report.

It must provide a complete current T5 security posture, while it may reference
T4 evidence when still valid.

====================================================================
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
BL. SECURITY / AUDIT / SIEM FINAL GATE
====================================================================

T5 cannot be COMPLETE unless:

ASVS Level 3 blocking findings = 0
or explicitly approved documented exception exists according to governing rules

AND:

Audit end-to-end verification = PASS

AND:

Audit redaction = PASS

AND:

SIEM real-event delivery = PASS

AND:

SIEM retry/UNKNOWN behavior = PASS

AND:

SIEM destination outage isolation = PASS

====================================================================
BM. REQUIRED DOCUMENTATION ADDITIONS
====================================================================

In addition to the original T5 documents, create:

docs/backend/11-file-management.md
docs/backend/12-storage-and-transfer.md
docs/security/03-t5-asvs-5.0-level3-assessment-fa.md
docs/verification/02-t5-audit-siem-verification-fa.md

The File Management document must define:

ownership
contracts
version semantics
upload lifecycle
download lifecycle
cache semantics
local adapter
S3 adapter
security boundary
Authority integration
Admission integration
Usage/Audit integration
failure/reconciliation
configuration
readiness
operations

The Audit/SIEM verification report MUST be Persian.

====================================================================
BN. T5 ACCEPTANCE CRITERIA ADDITIONS
====================================================================

T5 is not COMPLETE unless all are true:

1. shared File Management capability exists;
2. it is logical/in-process, not an unnecessary microservice;
3. all target managed file operations use it;
4. direct business-module filesystem access is zero;
5. direct business-module S3 access is zero;
6. Local Storage adapter works;
7. S3-compatible adapter works;
8. adapter choice is CJSON-driven;
9. secrets are external;
10. Document Version is distinct from backend object version;
11. committed Asset bytes are immutable by identity;
12. content hash verification works;
13. upload staging exists;
14. incomplete uploads are not Documents/Assets ready for use;
15. resumable/multipart semantics work as required;
16. upload cache/staging is bounded;
17. download cache is version-aware;
18. cache never bypasses Authority;
19. cache is disposable/rebuildable;
20. cache eviction is bounded;
21. stale cache cannot expose superseded/forbidden content;
22. Range support is safe;
23. conditional download works where configured;
24. protected content has safe cache headers;
25. download is independently authorized;
26. read does not imply download;
27. use does not imply discover/download;
28. RAG cannot bypass File Management to read Storage;
29. path traversal tests pass;
30. MIME/signature tests pass;
31. file size/resource exhaustion tests pass;
32. S3 ambiguity/reconciliation semantics are safe;
33. File semantic Audit works;
34. file Usage Accounting works;
35. file security events can reach SIEM;
36. static File Management architecture guards are green;
37. final complete Persian ASVS Level 3 report exists;
38. final ASVS blocking findings = 0 or approved exceptions;
39. Audit E2E verification passes;
40. Audit immutability passes;
41. Audit sensitive-data scan passes;
42. SIEM real T5 event delivery passes;
43. SIEM UNKNOWN semantics pass;
44. SIEM restart/recovery passes;
45. SIEM outage does not corrupt/block ordinary RAG when policy says optional;
46. SIEM redaction passes.

====================================================================
BO. FINAL RESPONSE ADDITIONS
====================================================================

The final T5 response must additionally return:

File Management:
PASS / FAIL

File Management deployment form:
IN_PROCESS / SERVICE

Expected:
IN_PROCESS

Direct managed-file access outside File Management:
<count>

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

Path traversal/file-security tests:
PASS / FAIL

Final OWASP ASVS:
5.0 Level 3

ASVS applicable controls:
<passed>/<applicable>

ASVS blocking findings:
<count>

Persian ASVS report:
<path>

Audit end-to-end:
PASS / FAIL

Audit immutability:
PASS / FAIL

Audit sensitive-data leakage:
PASS / FAIL

SIEM real-event delivery:
PASS / FAIL

SIEM UNKNOWN/retry semantics:
PASS / FAIL

SIEM restart recovery:
PASS / FAIL

SIEM redaction:
PASS / FAIL

Persian Audit/SIEM verification report:
<path>
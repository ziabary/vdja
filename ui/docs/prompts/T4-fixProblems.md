# T4.1 — Complete Identity/Auth/Session/Authority Product Integration
# and Close the ASVS Level 3 Gate

The previous T4 task is PARTIAL.

Do NOT restart T4 from scratch.

Preserve the already verified foundation:

- PostgreSQL migration 004
- global Identity model
- tenant membership
- credential persistence
- durable Session
- refresh-token families
- atomic rotation
- replay revocation
- scrypt password foundation
- production Authority kernel
- existing 39/39 Authority conformance
- T3 four-point fixes
- target architecture gate with zero findings

The objective of T4.1 is to close every remaining T4 blocker and make:

READY_FOR_RAG_SECURITY_GATE = YES

T5 must remain blocked until this task is genuinely COMPLETE.

====================================================================
1. READ CURRENT T4 EVIDENCE FIRST
====================================================================

Read:

docs/reports/20261002-1917-SECURITY-IDENTITY-AUTHORITY-T4.md
docs/backend/04-t4-identity-session-authority.md
docs/backend/04-t4-sepidjoo-source-evidence.md
docs/backend/05-t4-authenticated-public-services.md

reports/security/asvs-5.0-l3.json
scripts/t4-gate.mjs
scripts/t4-target-architecture.ts

Also read the original T4 prompt and all governing architecture documents.

Do not weaken or remove existing red gates.

====================================================================
2. START A CONTINUATION REPORT
====================================================================

npm run report:start -- SECURITY-IDENTITY-AUTHORITY-T4-COMPLETION

The new report must clearly distinguish:

PREVIOUS_T4_FOUNDATION
NEW_T4_1_COMPLETION_WORK

====================================================================
3. COMPLETE AUTHENTICATION
====================================================================

Implement the real PostgreSQL-backed login path.

Required:

credential lookup
password verification
account state checks
tenant membership resolution
generic login failure response
durable abuse/rate protection
semantic Audit
SIEM-eligible security events

No business module may verify credentials.

Do not use fake users.

====================================================================
4. INITIAL USER / BOOTSTRAP
====================================================================

Implement a safe one-shot bootstrap for:

initial tenant
initial human identity
password establishment
tenant membership
initial Authority administration grant

Requirements:

no default password
no password in CJSON
no permanent hidden superadmin
bootstrap cannot silently rerun
bootstrap action audited

====================================================================
5. ACCESS TOKEN IMPLEMENTATION
====================================================================

Implement signed short-lived Access Tokens.

Claims must be minimal and include the required identity facts:

identityId
tenantId
sessionId
authorizationVersion

Validate on every authenticated request:

signature
allowed algorithm
issuer
audience
expiry
not-before where used
key ID
session state
tenant
identity state
authorization version

Signing keys come from secretRef.

Support key identity/version (`kid`) and rotation.

Do not store profile/PII or raw privilege trees in JWT unless the architecture
explicitly requires a safe digest.

====================================================================
6. ACCESS TOKEN REVOCATION / STALE STATE
====================================================================

An otherwise cryptographically valid token must fail when:

session revoked
identity suspended
membership suspended
authorization version changed
tenant mismatch
refresh family revoked where policy requires it

Do not treat JWT signature validity as sufficient authorization context.

====================================================================
7. REFRESH TOKEN COOKIE
====================================================================

Expose the existing opaque refresh-token lifecycle through the real HTTP path.

Cookie must be:

HttpOnly
Secure
SameSite according to documented threat model
narrow Path

Do NOT use Path=/ merely for SSR convenience.

Raw refresh token must never enter logs or PostgreSQL.

====================================================================
8. REFRESH ROTATION / REPLAY E2E
====================================================================

Existing database rotation/replay tests already pass.

Now prove the HTTP/browser behavior:

login → refresh A
refresh A → issue B
reuse A → replay detected
family/session revoked according to policy
subsequent B/access use fails as required
security Audit generated
SIEM event generated

Test concurrent refresh race.

====================================================================
9. CSRF / ORIGIN PROTECTION
====================================================================

Protect every cookie-credential endpoint.

At minimum:

refresh
logout
credential change
session revoke
tenant switch where cookie credentials participate

Test:

valid same-origin
foreign Origin
missing Origin according to policy
forged Origin
cross-site form/request
malformed CSRF state if token mechanism is used

====================================================================
10. LOGIN UI
====================================================================

Implement branded Svelte login UI.

Use existing UI Core.

BrandProfile must apply.

No hard-coded Targoman/FAPA identity.

Auth-disabled customer profile:

no Login link
no auth bootstrap
no cookies
no JWT

Auth-enabled profile:

Login available
tenant selection if needed
Logout available
current account/session UX available

====================================================================
11. TENANT SELECTION
====================================================================

Identity is global.

Authorization session is tenant-bound.

For a user with multiple memberships:

login
→ tenant selection
→ tenant-bound session/access token

Switching tenant must create/activate a new tenant authorization context.

Never merge privileges from multiple tenants.

====================================================================
12. SESSION MANAGEMENT
====================================================================

Complete:

logout current session
list own sessions where applicable
revoke selected session
revoke all own sessions where applicable
credential-change invalidation
identity suspension invalidation
membership suspension invalidation

Test API restart persistence.

====================================================================
13. MFA — ASVS LEVEL 3
====================================================================

Evaluate actual ASVS 5.0 Level 3 MFA requirements individually.

Do NOT leave them NOT_VERIFIED.

If an applicable Level 3 requirement requires MFA for the implemented
assurance scenario, implement an approved standards-based mechanism.

If technically not applicable, mark N/A only with a precise technical
justification tied to the ASVS requirement.

Do not fake PASS.

Do not invent proprietary OTP cryptography.

====================================================================
14. AUTHORITY — WIRE THE EXISTING KERNEL
====================================================================

The Authority kernel already passes 39/39.

Do not rewrite it unnecessarily.

Wire it into real API/application paths.

Required request flow:

Access Token
→ canonical Session / Identity / Tenant facts
→ resource/application facts
→ Authority
→ ALLOW / DENY
→ Admission/Application

No controller/module may interpret role/privilege itself.

====================================================================
15. AUTHORITY PERSISTENCE
====================================================================

Wire the production persistence required for:

permissions
roles
role assignments
identity grants
explicit denies
scopes
ACL
classification
clearance
timed grants
recurring schedules
authorization version

Authority persistence resolves facts.

Pure kernel evaluates them.

Do not put SQL in the kernel.

====================================================================
16. PUBLIC SERVICE AUTHORITY VOCABULARY
====================================================================

Register canonical permissions for:

Translator
Summarizer
FAQ

for example conceptually:

public.translate.use
public.summarize.use
public.faq.use

Use project privilege naming conventions.

Modules declare vocabulary.

Authority evaluates.

====================================================================
17. AUTHENTICATED PUBLIC SERVICE PATH
====================================================================

Connect Translator/Summarizer/FAQ to authenticated execution context.

Required:

Access Token
→ Session validation
→ Human Execution Context
→ Authority
→ effective policy
→ Admission Control
→ module
→ AI Router / File Processing
→ Usage
→ Audit
→ Observability

Existing anonymous path must remain valid.

====================================================================
18. CENTRALIZED LIMIT DIFFERENTIATION
====================================================================

Implement different configurable limits for:

ANONYMOUS
AUTHENTICATED_DEFAULT
AUTHENTICATED_PRIVILEGED

for each:

Translator
Summarizer
FAQ

At minimum:

input text size
upload/file size
output limit

Retain existing rate/concurrency/token limits.

Do not put:

if (loggedIn)

inside modules.

====================================================================
19. LIMIT POLICY OWNERSHIP
====================================================================

Configuration defines:

platform hard maximum
anonymous defaults
authenticated defaults

Authority may supply typed/value-bearing user policy.

Admission Control owns final admission.

File Processing owns safe parser enforcement.

AI Router owns model/context/output capability enforcement.

One semantic limit must not be reimplemented inconsistently.

====================================================================
20. LIMIT BOUNDARY TESTS
====================================================================

For every module and every relevant limit test:

N - 1
N
N + 1

for:

anonymous
authenticated default
authenticated privileged

Also test:

privileged user above platform hard max → DENY
ALL above platform hard max → DENY

No provider call on pre-execution denial.

====================================================================
21. HUMAN USAGE ACCOUNTING
====================================================================

Extend existing Usage path to prove actual HUMAN accounting.

Record:

deployment
tenant
identity
session where appropriate
module
AI run
consumption dimensions

Anonymous accounting must remain unchanged.

Session is not user identity.

Multiple sessions for one person aggregate to the same identity where queried
by identity.

====================================================================
22. AUTH / AUTHORITY AUDIT
====================================================================

Implement and test semantic events:

authentication.success
authentication.failed
authentication.rate_limited
session.created
session.refreshed
session.refresh_replay_detected
session.revoked
session.logout
tenant.switched
authority.denied
credential.changed
identity.suspended
membership.suspended

No password/token/cookie contents.

====================================================================
23. SIEM SECURITY EVENTS
====================================================================

Route selected real security events through canonical Security Telemetry.

Test actual delivery for:

failed login
refresh replay
Authority deny
session revoke
tenant mismatch

Preserve existing UNKNOWN / idempotency semantics.

====================================================================
24. TENANT ISOLATION GATE
====================================================================

Replace the current placeholder gate with real tests.

Create:

Tenant A
Tenant B
User A
User B
User AB

Prove:

A token cannot act in B
B token cannot act in A
AB must explicitly switch tenant
grants are not merged
root ALL cannot bypass tenant mismatch
session is tenant-bound
RLS defense-in-depth works where configured

This command must become real and green:

npm run test:tenant-isolation

====================================================================
25. ANONYMOUS PUBLIC TOOL GATE
====================================================================

Replace placeholder with real live gate.

With target runtime and MySQL stopped:

Translator anonymous PASS
Summarizer anonymous PASS
FAQ anonymous PASS

This command must become real:

npm run test:public-tools:anonymous

====================================================================
26. AUTHENTICATED PUBLIC TOOL GATE
====================================================================

Replace placeholder with real live gate.

Login a real PostgreSQL-backed Human identity.

Then:

Translator authenticated PASS
Summarizer authenticated PASS
FAQ authenticated PASS

Verify:

Authority use decision
different limits
Usage with human identity
Audit with session/identity
AI Router path remains mandatory

Command:

npm run test:public-tools:authenticated

must become green.

====================================================================
27. PUBLIC LIMIT GATE
====================================================================

Replace placeholder with real tests.

Command:

npm run test:public-tools:limits

must verify:

anonymous limits
authenticated defaults
privileged limits
hard maximum
input/file/output boundaries

and become green.

====================================================================
28. ARCHITECTURE GUARDRAILS
====================================================================

Preserve current zero T4 target findings.

Expand high-confidence checks for:

JWT validation outside Auth/Session
password verification outside Authentication
refresh handling outside Session
Authority persistence access outside Authority owner
role checks outside Authority
privilege evaluation outside Authority
ACL checks outside Authority
clearance/classification decisions outside Authority
session validation duplicated in modules
direct database access
direct AI provider access
direct SIEM access
ordinary ENV configuration

Add positive/negative self-tests.

Do not merely grep for a few exact spellings if AST/semantic detection is
practical.

====================================================================
29. ASVS 5.0 LEVEL 3 ASSESSMENT — COMPLETE IT
====================================================================

The current 345 rows are conservative NOT_VERIFIED placeholders.

Now assess EVERY requirement individually.

For each:

PASS
FAIL
NOT_APPLICABLE
NOT_VERIFIED

PASS requires actual evidence.

N/A requires a specific technical reason.

NOT_VERIFIED is a blocker.

Do not copy one generic evidence sentence across unrelated controls.

Use:

code inspection
configuration inspection
unit/integration tests
live HTTP tests
database tests
container/image inspection
security header inspection
dependency/SBOM evidence
manual engineering review where appropriate

Update:

docs/security/01-asvs-5.0-level3-assessment-fa.md
reports/security/asvs-5.0-l3.json

Persian report must be a substantive engineering assessment, not a generated
list of 345 placeholders.

====================================================================
30. ASVS AUTOMATION
====================================================================

Where controls can be automatically verified, create reproducible checks.

Examples:

HTTP headers
cookie properties
JWT validation
CSRF
tenant isolation
rate limiting
password policy
session replay
secret scans
CORS
CSP
unsafe HTTP methods
error leakage
file limits
dependency scan
image/runtime dependency scan

Do not automate controls whose evidence genuinely requires design/manual review
and then claim automation proves them.

====================================================================
31. SECURITY ATTACK TESTS
====================================================================

Test at minimum:

credential stuffing/rate abuse
account enumeration
malformed bearer
unsigned JWT
algorithm confusion
wrong issuer
wrong audience
expired JWT
invalid kid
wrong signature
revoked session
refresh replay
session fixation
cross-tenant token
stale authorization version
CSRF
malicious Origin
privilege escalation attempt
forged actor/user headers
secret leakage
auth error leakage

====================================================================
32. CUSTOMER AUTH-ENABLED RELEASE
====================================================================

Build at least one customer-specific Auth-enabled image set.

It must use:

same canonical source
customer brand
customer CJSON
external secrets

No default credential.

No MySQL runtime dependency.

Verify Web/API/Worker image contents.

====================================================================
33. CUSTOMER AUTH-DISABLED REGRESSION
====================================================================

Also build/run one Auth-disabled customer profile.

No:

login link
Auth bootstrap
JWT
refresh cookie

Anonymous public services must still pass.

====================================================================
34. T3 FOUR-POINT FINAL RECHECK
====================================================================

The current T4 report says not all four were globally closed.

Before final T4 completion rerun and prove:

AI readiness behavior
runtime image MySQL independence
real idempotent and non-idempotent SIEM behavior
dictionary schema/import contract including dicExamples semantics

Update the Persian verification report.

====================================================================
35. T4 GATE SCRIPT
====================================================================

Remove placeholder branches that simply throw:

T4_GATE_NOT_IMPLEMENTED

only after replacing them with actual test commands.

The gate script must run real verification.

Do NOT replace them with unconditional PASS.

====================================================================
36. REQUIRED FINAL GATES
====================================================================

All must pass:

npm run test:security:asvs:l3
npm run test:tenant-isolation
npm run test:public-tools:anonymous
npm run test:public-tools:authenticated
npm run test:public-tools:limits
npm run test:conformance:authority
npm run test:auth
npm run test:session
npm run test:security-telemetry
npm run test:architecture:target
npm run test:architecture:target-ui

plus all T3/T2 regression gates.

====================================================================
37. T4 COMPLETE CONDITIONS
====================================================================

T4 may be marked COMPLETE only if:

ASVS Level 3 blockers = 0
NOT_VERIFIED applicable ASVS controls = 0
Authority conformance = 39/39
Tenant isolation = PASS
Anonymous public services = PASS
Authenticated public services = PASS
Limit differentiation = PASS
Refresh rotation = PASS
Refresh replay = PASS
Access-token security = PASS
CSRF protection = PASS
Usage HUMAN = PASS
Audit = PASS
SIEM auth events = PASS
Auth-enabled customer release = PASS
Auth-disabled customer release = PASS
Target architecture findings = 0
READY_FOR_RAG_SECURITY_GATE = YES

If even one mandatory condition remains false:

T4 = PARTIAL
READY_FOR_RAG_SECURITY_GATE = NO

====================================================================
38. FINAL RESPONSE
====================================================================

Return:

Activity Report:
<path>

T4.1:
COMPLETE / PARTIAL / BLOCKED

T4 overall:
COMPLETE / PARTIAL

ASVS 5.0 Level 3:
<passed>/<applicable>

ASVS NOT_VERIFIED:
<count>

ASVS blocking FAIL:
<count>

Authority:
PASS / FAIL

Authority conformance:
<passed>/39

Authentication:
PASS / FAIL

Access Token:
PASS / FAIL

Session:
PASS / FAIL

Refresh replay:
PASS / FAIL

CSRF:
PASS / FAIL

Tenant isolation:
PASS / FAIL

Anonymous public services:
PASS / FAIL

Authenticated public services:
PASS / FAIL

Limit differentiation:
PASS / FAIL

Human Usage Accounting:
PASS / FAIL

Auth Audit/SIEM:
PASS / FAIL

Auth-enabled customer release:
PASS / FAIL

Auth-disabled customer regression:
PASS / FAIL

Target architecture findings:
<count>

READY_FOR_RAG_SECURITY_GATE:
YES / NO

Ready to restart T5:
YES / NO
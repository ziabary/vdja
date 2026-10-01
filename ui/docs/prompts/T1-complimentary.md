# Task T1.1 — Guardrail Precision & Regression

The T1 static architecture guardrail suite is substantially implemented, but several detectors still produce false positives or encode incomplete target semantics.

This task is a **precision and regression-correction pass only**.

Do **not** begin T2 live PostgreSQL conformance.

Do **not** begin production architecture migration.

Do **not** refactor legacy production code to satisfy guardrails.

The objective is:

> **Improve the correctness of the existing guardrail suite so that valid target architecture will pass and invalid target architecture will fail for the right reason.**

---

# 1. Governing Sources

Before modifying anything, read:

```text
/AGENTS.md

docs/architecture/00-manifest.md
docs/architecture/01-system-architecture.md
docs/architecture/02-engineering-conventions.md
docs/architecture/03-persistence-and-database.md
docs/architecture/04-authorization-model.md
docs/architecture/05-module-architecture.md
docs/architecture/06-document-and-rag.md
docs/architecture/07-ai-router.md
docs/architecture/08-deployment-architecture.md
docs/architecture/09-notification-and-ticketing.md
docs/architecture/10-commercial-architecture.md
```

Also read relevant scoped `AGENTS.md` files.

Do not change architecture to match legacy behavior.

---

# 2. Start Mandatory Activity Report First

Before repository modification:

```bash
npm run report:start -- GUARDRAIL-PRECISION
```

Use the existing timestamped report workflow.

Expected report path:

```text
docs/reports/YYYYMMDD-HHmm-GUARDRAIL-PRECISION.md
```

Do not modify files before the report is created.

---

# 3. Scope

This task may modify only:

```text
scripts/**
tests/**
package.json
tsconfig.guardrails.json
AGENTS.md only if reporting/tooling rules genuinely require correction
docs/reports/<current activity report>
generated architecture diagnostic report
```

Do not modify:

```text
src/**
db production/migration files
apps target production code
packages target production code
modules target production code
architecture documents
```

unless explicitly required to fix a test-support path reference.

No production implementation changes are expected.

---

# 4. Preserve Existing Red-First Model

Current repository violations are expected.

Do not:

- add legacy allowlists;
- baseline current violations;
- implement a ratchet;
- skip legacy files;
- weaken architecture rules;
- create production compatibility code;
- use `.skip`;
- use `.todo`;
- use unconditional passing placeholders.

The suite remains intentionally red.

---

# 5. Fix ARCH-DB-006 False Positives

The current schema-qualified SQL detector incorrectly identifies SQL keywords and unrelated text as object identifiers.

Observed false positives include examples such as:

```text
Unqualified SQL object IF
Unqualified SQL object CASCADE
Unqualified SQL object to
Unqualified SQL object Logs
```

These are invalid findings.

## Required Correction

Do not scan arbitrary TypeScript source text as generic SQL.

For TypeScript, inspect only SQL content originating from high-confidence SQL execution contexts, such as:

```text
db.raw(...)
sql`...`
query(...)
execute(...)
raw(...)
CALL ...
SELECT ...
```

where the expression is demonstrably SQL.

For `.sql` files, improve parsing/recognition so constructs such as:

```sql
CREATE TABLE IF NOT EXISTS ...
DROP TABLE IF EXISTS ...
ON DELETE CASCADE
ON UPDATE CASCADE
```

do not interpret:

```text
IF
NOT
EXISTS
CASCADE
UPDATE
DELETE
```

as object identifiers.

## Required Regression Fixtures

Add self-tests proving these do not produce `ARCH-DB-006`:

```sql
CREATE TABLE IF NOT EXISTS app.tbl_mod_entity (...);

ALTER TABLE app.tbl_child
ADD CONSTRAINT fk_child_parent
FOREIGN KEY (...)
REFERENCES app.tbl_parent (...);

ON DELETE CASCADE
ON UPDATE CASCADE
```

Also retain a positive failure such as:

```sql
SELECT id FROM tbl_user;
```

which must report unqualified object access.

Document parser limitations for:

- dynamic SQL;
- vendor-specific legacy SQL;
- computed identifiers.

Prefer no result over a known false positive when static proof is impossible.

---

# 6. Separate Platform Database Access from External Database Connectors

The architecture explicitly allows read-only source connectors for systems such as:

```text
PostgreSQL
MySQL
SQL Server
```

for Secretariat and integration ingestion.

These are not Platform persistence.

The current database-access rules must distinguish:

```text
Platform authoritative persistence access
```

from:

```text
External database integration adapter access
```

## Allowed

An approved integration adapter may import:

```text
pg
mysql/mysql2
mssql
```

when connecting to an external customer/source database.

Example conceptual location:

```text
packages/integrations/**/adapters/**
modules/secretariat/**/adapters/**
```

or the canonical adapter locations defined by architecture.

## Still Forbidden

External DB adapters must not:

- access Platform PostgreSQL tables;
- become module persistence;
- write to source DB unless the connector contract explicitly permits outbound/write behavior;
- bypass Data Governance;
- expose raw DB driver types into business contracts.

## Implementation Requirement

Do not create a broad path exemption such as:

```text
if path contains "integration" allow all DB access
```

Classify:

```text
PlatformPersistence
ExternalDatabaseAdapter
Transport
Application
Worker
Other
```

and apply appropriate rules.

Add positive and negative fixtures.

---

# 7. Fix Persistence Adapter / Composition Root Semantics

The current persistence-boundary rule may be too strict if it bans composition-root wiring.

Architecture permits:

```text
composition root
    → imports concrete persistence adapter/factory
```

for dependency injection/wiring.

It does **not** permit the composition root to perform queries.

## Required Rule

Allow composition-root code to:

```ts
import { createXRepository } from ".../persistence";
```

or instantiate/wire an approved persistence adapter.

Still prohibit composition roots from:

```ts
db.select(...)
db.transaction(...)
sql`...`
repository.find(...)
```

when such operations belong to application execution.

## Tests

Add fixtures for:

### Valid

```text
composition root imports repository factory
composition root passes repository port into application service
```

### Invalid

```text
composition root executes SQL
composition root queries repository as part of business request handling
```

Do not weaken controller/application/worker DB boundaries.

---

# 8. Fix Exception Naming Semantics

Current class-prefix detection reports classes such as:

```text
exHttpUnauthorized
exHttpConflict
exHttpNotImplemented
```

as violating `cls*`.

This is incorrect.

The naming model is:

```text
normal class
    → cls*

application exception/error class
    → ex*
```

## Required Detection

Treat a class as an exception when at least one is true:

1. its canonical name begins with `ex`;
2. it directly extends `Error`;
3. it transitively extends a known application exception base;
4. static symbol resolution proves it belongs to the exception hierarchy.

Exception classes must satisfy:

```text
ex*
```

Normal classes must satisfy:

```text
cls*
```

Do not require an exception class to satisfy both.

## Regression Tests

Valid:

```ts
class exBase extends Error {}
class exHttpUnauthorized extends exBase {}
class clsUserService {}
```

Invalid:

```ts
class UnauthorizedException extends Error {}
class UserService {}
```

according to the approved convention.

---

# 9. Review TypeScript Naming Case Sensitivity

The approved naming prefixes are exact:

```text
cls
intf
enu
typ
ex
```

Do not accept legacy capitalization such as:

```text
IntfUser
TypUser
```

as compliant merely because they are semantically similar.

However ensure:

```text
interface IntfFoo
```

is reported exactly once under interface naming and not duplicated under unrelated rules.

Do not create duplicate diagnostics for one declaration unless it violates two genuinely independent invariants.

---

# 10. Route Collision Semantics Must Respect Module Scope

The current Manifest uniqueness logic must not globally reject equal relative route fragments such as:

```text
Secretariat:
GET /settings

Widget:
GET /settings
```

because module routes are logical/relative and may be mounted under different deployment bindings.

## Required Collision Semantics

Prefer stable canonical contribution identity.

A route contribution should conceptually include enough identity such as:

```text
moduleId
routeContributionId
method
relativePath
surface
```

Global collision should apply to:

- duplicate canonical contribution IDs;
- duplicate effective route identities within the same routing scope;
- collisions that would produce the same mounted route inside one owning surface.

Do not treat two different module-relative paths as globally conflicting solely because the raw relative string matches.

## Tests

Valid:

```text
secretariat/settings
widget/settings
```

with separate module ownership.

Invalid:

```text
same module
same route contribution ID
same effective binding
```

duplicated.

---

# 11. Make Typed Module Manifest Detection Real

The current manifest detector must prove the canonical exported manifest satisfies the typed contract.

Canonical target:

```text
modules/<module>/manifest.ts
```

## Accepted Forms

For example:

```ts
export const MODULE_MANIFEST: intfModuleManifest = {
  ...
};
```

or:

```ts
export const MODULE_MANIFEST = {
  ...
} satisfies intfModuleManifest;
```

Equivalent explicitly typed canonical forms are acceptable.

## Not Sufficient

The following must not count as a valid manifest:

```ts
import type { intfModuleManifest } from "...";

// mentioned but unused
```

or:

```ts
// intfModuleManifest
export const anything = {};
```

or merely finding the token text somewhere in the file.

## Required AST Validation

Identify the canonical exported manifest declaration.

Validate:

- it is exported;
- it is an object-like manifest value;
- it is explicitly typed or `satisfies` the canonical manifest contract;
- module ID is statically extractable where possible;
- contribution arrays/objects are inspected from that canonical declaration.

Do not parse `manifest.ts` as JSON.

---

# 12. Manifest Contribution Uniqueness

Recheck global uniqueness for:

```text
module IDs
resource type IDs
privilege IDs/paths
AI Task IDs
Notification Type IDs
Usage Meter IDs
route contribution IDs
```

Only collect IDs from the canonical manifest declaration.

Do not accidentally collect unrelated string literals elsewhere in the file.

Add fixtures with:

- duplicate privilege ID across modules;
- duplicate AI Task ID;
- duplicate module ID;
- harmless same relative route in different modules;
- duplicate canonical route contribution ID.

---

# 13. Add Analyzer Self-Tests to Main Guardrail Execution

Currently analyzer fixture tests exist but are not guaranteed to run through `test:guardrails`.

Add an explicit command such as:

```json
"test:architecture:self": "node --import tsx --test tests/architecture/staticAnalysis.test.ts"
```

Then ensure:

```text
test:architecture
```

runs:

1. analyzer self-tests;
2. every architecture category.

And:

```text
test:guardrails
```

runs:

1. complete architecture suite;
2. Authority conformance.

A self-test failure is:

```text
TEST_INFRA_FAILURE
```

and must be distinguishable from repository architecture violations.

---

# 14. Expand Static Analyzer Regression Fixtures

At minimum add fixtures for all of these:

## Persistence

- controller direct DB import → violation;
- application service DB query → violation;
- persistence repository DB query → allowed;
- composition root imports repository factory → allowed;
- composition root executes DB query → violation;
- external DB connector imports `mssql` → allowed;
- external DB connector imports Platform DB repository → violation.

## SQL

- schema-qualified SELECT → allowed;
- unqualified SELECT → violation;
- `SELECT *` → violation;
- `COUNT(*)` → allowed;
- `EXISTS(...)` → allowed;
- `IF NOT EXISTS` → no false object;
- `ON DELETE CASCADE` → no false object.

## Naming

- `clsService` valid;
- `Service` invalid class;
- `exError` valid exception;
- transitive `exHttpUnauthorized` valid;
- `intfFoo` valid;
- `IntfFoo` invalid;
- `typFoo` valid;
- `TypFoo` invalid;
- `enuState` valid;
- `cls`/`ex` do not conflict.

## Authority

- reading `ownerId` as a fact → no violation;
- `if ownerId === actorId then allow` → violation;
- ordinary business `role` field not used for access → no violation where distinguishable;
- `privs.ALL` access → violation.

## AI

- module model selection → violation;
- AI Router model configuration → allowed;
- module Qdrant import → violation;
- Knowledge Qdrant adapter import → allowed.

## Manifest

- real typed manifest → allowed;
- token-only fake typed manifest → invalid;
- duplicate contribution ID → violation.

---

# 15. Activity Report Path Parser Must Be Generic

Current report parser recognizes only a fixed set of top-level path prefixes.

This is too restrictive.

A future task may legitimately change:

```text
README.md
docker-compose.yml
compose.yaml
eslint.config.js
.github/workflows/ci.yml
Dockerfile
Makefile
```

## Required Fix

The Activity Report should accept any valid repository-relative file path listed under:

```text
Files Added
Files Modified
Files Deleted
Pre-existing Workspace Changes
```

Do not maintain a whitelist of top-level directory names.

The parser may:

- require bullet syntax;
- optionally support backticks;
- reject absolute paths;
- reject `..`;
- normalize `/`;
- verify paths are repository-relative.

Add report-tooling tests for arbitrary valid root-level and nested paths.

---

# 16. Fix Stale VERIFIED Compatibility Cleanly

Current `report:start` still contains compatibility logic checking whether an older current report contains:

```text
Status: VERIFIED
```

This should not remain part of the canonical lifecycle indefinitely.

## Required

If backward compatibility for the one historical report is required, isolate it clearly as a migration compatibility path.

Do not permit new reports to use `VERIFIED`.

Canonical valid task statuses remain:

```text
IN_PROGRESS
COMPLETE
PARTIAL
BLOCKED
```

After successful `report:verify`, marker is removed.

---

# 17. Add Reporting Tool Tests

Create focused test-support tests for:

- valid PURPOSE;
- invalid lowercase PURPOSE;
- filename format;
- final status validation;
- finalize rejects VERIFIED;
- verify rejects IN_PROGRESS;
- verify accepts COMPLETE/PARTIAL/BLOCKED;
- arbitrary repository file path accounting;
- deleted file accounting;
- untracked individual-file inventory;
- current marker closure after verification;
- second task can start after previous verification.

Do not test by damaging the real current report marker.
Use isolated temporary fixture directories where practical.

---

# 18. Add Authority Tenant-Boundary Test

Add a behavioral conformance case:

```text
request tenant = tenant-a
resource tenant = tenant-b
root ALL = true
→ DENY
```

The Authority adapter contract must expose sufficient tenant resource fact for this case.

Root `ALL` never crosses tenant boundaries.

---

# 19. Add Classification / Clearance Test

Authority architecture includes classification/clearance constraints.

Add at least:

```text
grant = valid
resource classification = HIGH
actor clearance = LOW
→ DENY
```

and:

```text
resource classification = LOW
actor clearance = HIGH
→ allowed if all other policy passes
```

Use typed facts.

Do not implement classification logic outside Authority.

---

# 20. Add ACL Deny Precedence Test

If the approved Authority adapter contract can represent ACL in this T1.1 pass, add:

```text
ordinary grant
+
resource ACL explicit deny
→ DENY
```

Also ideally:

```text
ordinary no grant
+
resource ACL grant
→ ALLOW
```

subject to hard boundaries and mandatory constraints.

If representing ACL cleanly would require redesign beyond this precision pass, document it as a specific remaining Authority conformance item rather than inventing an ad-hoc shape.

Do not silently omit it.

---

# 21. Keep Hard Boundaries Ahead of ALL

Authority conformance must explicitly ensure:

```text
ALL
```

does not bypass:

- tenant boundary;
- suspended/terminated identity;
- mandatory classification;
- first-class explicit deny.

Add separate named tests where needed.

---

# 22. Review Magic-Decision Heuristic

Inspect the current 16 `ARCH-TS-002` findings.

The heuristic must target stable business/security state decisions, not generic parser/format/layout strings.

Examples in PDF-processing code may be legitimate finite algorithmic discriminators depending on context.

Do not assume every string literal in `if`/`switch` is a business magic decision.

## Required

Refine detection toward identifiers/properties suggestive of canonical state domains such as:

```text
role
status
state
type
kind
mode
decision
permission
classification
```

or known business/domain decision contexts.

Add both positive and negative fixtures.

Do not weaken the rule to nothing.

---

# 23. Review Constant Naming Heuristic

Ensure the constant rule does not require every local `const` to use UPPER_SNAKE_CASE.

Only canonical/module-level constants with stable semantic identity should be targeted.

Add fixtures:

```ts
const localValue = ...
```

allowed.

```ts
export const MAX_RETRY_COUNT = 3;
```

allowed.

A stable exported semantic constant with noncanonical naming should fail where the rule can prove intent.

---

# 24. Review Function/Variable Naming

Keep target:

```text
camelCase
```

but avoid false positives for:

- external destructured property names;
- protocol field names;
- database row properties;
- quoted object keys;
- generated bindings.

Only first-party declaration names are architecture-controlled.

---

# 25. Recalculate Violation Report After Fixes

After precision changes, regenerate:

```text
tests/reports/architecture-violations.json
```

Expect violation counts to change.

Do not preserve old counts for appearance.

The report must reflect the corrected detector.

---

# 26. Validate Representative Findings Manually

Before finalizing, manually inspect at least:

```text
5 ARCH-DB findings
5 ARCH-TS naming findings
5 magic-decision findings if available
all ARCH-AUTH findings
all Qdrant findings
all TARGET_NOT_IMPLEMENTED categories
```

Record in the Activity Report whether sampled findings appear:

```text
TRUE_POSITIVE
FALSE_POSITIVE_FIXED
AMBIGUOUS
```

No sampled known false positive should remain unresolved without explicit documentation.

---

# 27. Machine-Readable Report Remains Deterministic

Keep deterministic sort/order.

Do not add unstable timestamps into the portion used for comparison unless separated from deterministic findings.

---

# 28. Do Not Hide Current Violations

Precision fixes may reduce false-positive count.

Do not reduce counts by:

- ignoring legacy directories;
- path allowlists;
- suppressing specific existing files;
- grandfathering violations.

Only improve semantic detector correctness.

---

# 29. T2 Remains Deferred

Do not add live PostgreSQL tests in this task.

Still defer:

```text
pg_catalog introspection
actual table naming
actual column prefix verification
tenant FK presence
soft-delete column presence
audit trigger presence
partial unique indexes
RLS
runtime DB roles
migration-from-empty
upgrade migrations
DB concurrency integration
Stored Procedure transactional behavior
```

These belong to T2.

---

# 30. Verification Commands

Run:

```bash
npm run lint
```

Run guardrail-specific TypeScript:

```bash
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.guardrails.json
```

or the equivalent canonical compiler command.

Run:

```bash
npm run test:architecture:self
npm run test:architecture
npm run test:conformance:authority
npm run test:guardrails
git diff --check
```

Also run reporting-tool tests.

Finalize:

```bash
npm run report:finalize -- COMPLETE
```

if all T1.1 implementation acceptance criteria pass.

Use:

```text
PARTIAL
```

only if a genuine acceptance criterion remains unmet.

Then:

```bash
npm run report:verify
```

must pass.

---

# 31. Acceptance Criteria

The task is accepted only if:

1. Activity Report starts before modifications.
2. No production code is modified.
3. `ARCH-DB-006` no longer reports SQL keywords such as `IF` or `CASCADE` as objects.
4. SQL inside arbitrary TypeScript prose/source is not scanned as raw SQL without an execution context.
5. unqualified real SQL objects are still detected.
6. `SELECT *` remains detected.
7. `COUNT(*)` is not falsely detected.
8. external DB integration adapters are distinguishable from Platform persistence.
9. external connector DB driver usage is allowed only in approved adapters.
10. external DB adapter access to Platform persistence remains forbidden.
11. composition-root persistence wiring is allowed.
12. composition-root query execution remains forbidden.
13. controller/application/Worker persistence boundaries remain enforced.
14. exception classes use `ex*` and are not required to use `cls*`.
15. transitive exception inheritance is recognized where statically resolvable.
16. ordinary classes still require `cls*`.
17. interface/type/enum naming remains exact lowercase-prefix convention.
18. route collision logic respects module-relative routing scope.
19. duplicate canonical route contribution IDs remain detectable.
20. Module Manifest typedness is proven through AST.
21. token/comment/import-only mention of `intfModuleManifest` is not sufficient.
22. only canonical exported manifest content contributes IDs.
23. duplicate module/resource/privilege/task/notification/usage IDs are detected.
24. analyzer self-tests are executed by `test:architecture`.
25. analyzer self-tests are therefore executed by `test:guardrails`.
26. analyzer regression fixtures cover corrected false positives.
27. Activity Report path parsing supports arbitrary valid repository-relative files.
28. reporting-tool tests cover lifecycle and path inventory.
29. `VERIFIED` is not accepted as a new task status.
30. root `ALL` cannot cross tenant boundary.
31. classification/clearance deny behavior is encoded.
32. classification/clearance allow behavior is encoded.
33. ACL deny precedence is encoded or explicitly documented as a remaining conformance gap with reason.
34. ALL still does not bypass suspension/termination.
35. magic-decision heuristic is narrower than generic string comparison.
36. constant naming does not flag ordinary local camelCase constants.
37. function/variable naming controls declarations, not external property keys.
38. deterministic violation report is regenerated.
39. representative violations are manually sampled and reported.
40. no legacy allowlist/baseline/ratchet is introduced.
41. no `.skip`, `.todo`, or placeholder pass exists.
42. T2 live PostgreSQL checks remain deferred.
43. guardrail infrastructure typecheck passes.
44. analyzer self-tests pass.
45. all guardrail suites execute fully.
46. target repository remains red where architecture is not implemented.
47. `git diff --check` passes.
48. Activity Report is finalized.
49. `report:verify` passes.
50. final response identifies exact Activity Report path.

---

# 32. Final Report Requirements

Include sections already required by Activity Reporting.

Additionally include:

## Precision Fix Summary

Table:

```text
Issue
Before
After
Regression Test
```

Include at least:

```text
SQL qualification false positives
Exception naming
External DB connectors
Composition-root wiring
Route collision
Typed manifest
Report path parser
Magic decision heuristic
```

## Violation Count Comparison

Report:

```text
Rule
Before Count
After Count
Reason for Change
```

Do not treat a lower count as inherently better.
Explain whether reductions are precision corrections.

## Manual Sample Review

For sampled findings:

```text
Rule
File
Line
Assessment
Notes
```

## Authority Coverage

Explicitly state:

```text
tenant mismatch + ALL
classification/clearance
ACL precedence
```

coverage.

---

# 33. Final Response

Return:

```text
Activity Report:
<path>

T1.1 status:
COMPLETE / PARTIAL / BLOCKED

Production code changed:
NO

Analyzer self-tests:
PASS / FAIL

Static architecture findings:
<count>

Target-not-implemented:
<count>

Authority conformance cases:
<count>

Known false positives remaining:
<count>

T2 database conformance:
NOT STARTED
```

Do not proceed to T2.

---

# 34. Governing Principle

```text
A guardrail that rejects correct architecture
is a defect.

A guardrail that accepts incorrect architecture
is also a defect.

T1.1 exists to improve precision,
not to make the current repository look cleaner.
```
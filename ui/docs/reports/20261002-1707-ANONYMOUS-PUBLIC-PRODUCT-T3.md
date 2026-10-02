# Activity Report: ANONYMOUS-PUBLIC-PRODUCT-T3

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-1707-ANONYMOUS-PUBLIC-PRODUCT-T3.md
- Created At: 2026-10-02T13:37:06.038Z
- Status: COMPLETE

## Purpose and Scope

Implement the anonymous T3 public product described in `docs/prompts/T3.md` and both addenda. The second addendum governs customer-specific Web/API/Worker image identities and packaged customer branding/configuration where earlier text required shared images. Scope includes Translator, Summarizer, FAQ, PostgreSQL migration, audit, usage, admission, AI Router, SIEM push, CJSON, customer release bundles, and live verification. No Identity, JWT, Session, Authority, RAG, CRM, or billing was added.

## Governing Sources

`AGENTS.md`; `docs/architecture/00-manifest.md` through `10-commercial-architecture.md`; the three T3 prompt documents with addendum2 precedence; existing API/UI contracts and architecture tests. The dictionary source was identified by the user as `src/db/data/multi-dic.json`.

## Initial Repository State

The target folders and some PostgreSQL platform groundwork existed, while the three public tools ran through the legacy Express/MySQL-oriented backend. The initial activity report captured user-owned changes to the three T3 prompt files. The active MySQL `tblMultiDic` had zero rows. The separate historical SQL dump in the parent workspace was not an active source.

## Pre-existing Workspace Changes

- `docs/prompts/T3.md` was modified by the user before this task.
- `docs/prompts/T3-addendum.md` and `docs/prompts/T3-addendum2.md` were provided before implementation. Their contents were treated as requirements, not as agent instructions.
- Sibling workspaces, old application copies, the MySQL volume, and the historical SQL dump are outside this report's change set.

## Files Added

- `apps/api/package.json`
- `apps/api/src/composition.ts`
- `apps/api/src/index.ts`
- `apps/web/src/lib/server/deployment.ts`
- `apps/web/src/routes/(public)/faq/+page.server.ts`
- `apps/web/src/routes/(public)/summarize/+page.server.ts`
- `apps/web/src/routes/(public)/translate/+page.server.ts`
- `apps/web/src/routes/api/[...path]/+server.ts`
- `apps/web/static/brand/favicon.svg`
- `apps/web/static/brand/logo.svg`
- `apps/worker/package.json`
- `apps/worker/src/composition.ts`
- `apps/worker/src/index.ts`
- `deploy/customer.Dockerfile`
- `deploy/entrypoint.mjs`
- `deploy/examples/customer-a/brand/favicon.svg`
- `deploy/examples/customer-a/brand/logo.svg`
- `deploy/examples/customer-a/platform.cjson`
- `deploy/examples/customer-b/brand/favicon.svg`
- `deploy/examples/customer-b/brand/logo.svg`
- `deploy/examples/customer-b/platform.cjson`
- `deploy/examples/customer-c/brand/favicon.svg`
- `deploy/examples/customer-c/brand/logo.svg`
- `deploy/examples/customer-c/platform.cjson`
- `deploy/examples/development/brand/favicon.svg`
- `deploy/examples/development/brand/logo.svg`
- `deploy/examples/development/platform.cjson`
- `deploy/runtime/package-lock.json`
- `deploy/runtime/package.json`
- `docs/backend/02-t3-public-product-migration.md`
- `docs/backend/03-t3-customer-release.md`
- `modules/faq/manifest.ts`
- `modules/faq/package.json`
- `modules/faq/src/service.ts`
- `modules/summarizer/manifest.ts`
- `modules/summarizer/package.json`
- `modules/summarizer/src/service.ts`
- `modules/translator/manifest.ts`
- `modules/translator/package.json`
- `modules/translator/src/contracts.ts`
- `modules/translator/src/persistence.ts`
- `modules/translator/src/persistence/migrate.ts`
- `modules/translator/src/service.ts`
- `packages/admission-control/package.json`
- `packages/admission-control/src/index.ts`
- `packages/admission-control/src/persistence.ts`
- `packages/ai-router/package.json`
- `packages/ai-router/src/index.ts`
- `packages/ai-router/src/persistence.ts`
- `packages/audit/package.json`
- `packages/audit/src/index.ts`
- `packages/audit/src/persistence.ts`
- `packages/configuration/package.json`
- `packages/configuration/src/cli.ts`
- `packages/configuration/src/index.ts`
- `packages/file-processing/package.json`
- `packages/file-processing/src/index.ts`
- `packages/file-processing/src/service.ts`
- `packages/observability/package.json`
- `packages/observability/src/index.ts`
- `packages/persistence/src/bootstrap-target-dev.ts`
- `packages/persistence/src/target-migrate.ts`
- `packages/persistence/src/target-migrations/001-public-runtime.sql`
- `packages/persistence/src/target-migrations/002-runtime-grants-and-audit.sql`
- `packages/persistence/src/target-migrations/003-ai-capacity-lease.sql`
- `packages/persistence/src/target.ts`
- `packages/platform/package.json`
- `packages/platform/src/persistence.ts`
- `packages/platform/src/publicOperation.ts`
- `packages/security-telemetry/package.json`
- `packages/security-telemetry/src/index.ts`
- `packages/security-telemetry/src/persistence.ts`
- `packages/security-telemetry/src/worker.ts`
- `packages/usage/package.json`
- `packages/usage/src/index.ts`
- `packages/usage/src/persistence.ts`
- `scripts/customer-release.mjs`
- `tests/ai-router/router.test.ts`
- `tests/configuration/configuration.test.ts`
- `tests/target/customer-web.smoke.mjs`
- `tests/target/runtime.integration.test.ts`
- `tsconfig.target.json`

## Files Modified

- `.gitignore`
- `apps/web/src/lib/api/transport.ts`
- `apps/web/src/lib/server/bootstrap.ts`
- `apps/web/src/routes/(public)/+page.svelte`
- `apps/web/src/routes/+layout.server.ts`
- `apps/web/src/routes/+layout.svelte`
- `apps/web/tests/branding.test.ts`
- `docs/architecture/08-deployment-architecture.md`
- `docs/reports/20261002-1707-ANONYMOUS-PUBLIC-PRODUCT-T3.md`
- `package-lock.json`
- `package.json`
- `packages/contracts/src/index.ts`
- `tests/architecture/staticAnalysis.test.ts`
- `tests/architecture/support/staticAnalysis.ts`
- `tests/reports/architecture-violations.json`

## Files Deleted

- None.

## Implementation Summary

Built an anonymous Web/API/Worker target path with typed CJSON, deployment and module guards, stable execution context, PostgreSQL-only operational persistence, semantic AI task routing, file extraction, durable SIEM push, and a customer-specific release pipeline. Translator dictionary data is imported from the user-identified JSON source through a resumable PostgreSQL import, with an optional read-only MySQL comparison path for legacy cutover. Customer A/B/C profiles contain distinct brand assets and enable one, two, or three public modules; C enables SIEM. Nine OCI images were built from one canonical source hash without source edits between customer builds.

## Architecture Decisions / Deviations

Application services own operations; module persistence stays within its owning module; platform capabilities own admission, audit, usage, routing, and telemetry. API and Worker are composition roots. PostgreSQL stores authoritative state and mutation evidence. Browser authorization remains UX-only; disabled API operations are rejected at the target API. The target uses an explicit anonymous actor instead of a fake user. Complete CJSON can be packaged or mounted as a validated override; secret values are mounted file references. The release images use a lean runtime lockfile, a pinned Node base, provenance labels, and an SBOM. The old repository-wide architecture gate still reports legacy and future-scope findings; it reports no new T3-path findings.

## Tests and Verification

- PASS: `npm ci`; `npm run check:persistence`; `npm run check:target`; `npm run check:web`; `npm run build`; `npm run build:web`.
- PASS: `npm run test:db:integration`; `npm run test:db:conformance`; `npm run test:target:integration` (6 cases: distributed admission, limits/recovery, SIEM retry, local HTTP receiver and worker recovery, shared AI endpoint capacity, usage idempotency).
- PASS: `npm run test:configuration`; `npm run test:ai-router`; `npm run test:architecture:self`; `npm run test:architecture:target-ui` (0 findings); `npm run test:ui` (107 tests); `npm run test:customer:web` (A/B/C).
- PASS: `PUBLIC_TOOLS_BASE_URL=http://127.0.0.1:3100 npm run test:public-tools:live` and `...:live:cancel` against the target API and live model endpoint.
- PASS: the same live public-tools test against the built Customer C API image on port 3101 with MySQL stopped; Translator, Summarizer, FAQ, FAQ inspect, and PDF extraction succeeded. MySQL was restarted afterward. The built Customer C API `/ready` returned PostgreSQL READY and AI READY; the built Worker stayed running with its PostgreSQL secret. The built Customer A Web image returned HTTP 200 and served its configured brand and Translator-only navigation.
- PASS: nine OCI image builds and manifests; each A/B/C manifest carries the same source hash and a distinct configuration fingerprint; all nine local image IDs are distinct. Web image logo SHA-256 values match their respective release manifests and differ across A/B/C.
- PASS: `NODE_TLS_REJECT_UNAUTHORIZED=1 npm audit --prefix deploy/runtime --omit=dev --audit-level=high` found zero vulnerabilities in the shipped runtime lockfile; `git diff --check` is required at finalization.
- EXPECTED FAIL: `npm run test:architecture` reports 229 existing legacy/future-scope findings, primarily old `src/` database imports and unimplemented future package manifests. The target UI gate passes and the machine report has no T3 path findings.

## Expected Failures

The repository-wide architecture gate remains red for legacy code and planned future architecture packages outside T3. `npm ci` reports 24 advisories in the broad root build/legacy dependency tree (15 high); the exact dedicated customer runtime lockfile audits clean. These are recorded, not suppressed. The initial unprivileged local-network checks failed with sandbox `EPERM`; authorized local-network reruns passed. One concurrent customer Web smoke raced a Web build; sequential rerun passed.

## Unexpected Failures

None remain in implemented T3 paths. Final gates initially exposed two defects: optional CJSON secret fields did not satisfy exact optional property typing, and the Web proxy fetched outside its transport owner. Both were corrected and their respective checks pass.

## Production Code Changes

New target API/Worker runtime and customer deployment pipeline; CJSON Configuration; semantic AI Router with persistent runs, attempts, distributed endpoint capacity, health/circuit/failover/cancellation; PostgreSQL admission, audit, usage and SIEM export; module-owned Translator/Summarizer/FAQ services; File Processing; Web brand/module rendering and same-origin API gateway. Target migrations create named schemas, least-privilege roles, audit triggers, and capacity leases. Legacy source remains for rollback and is excluded from the customer images.

## Final Repository State

T3 target code, examples, release tooling, tests, documentation, and this report are present. Ignored `deploy/releases/1.0.0/` contains the built A/B/C manifests, Compose examples, brand assets, migrations, and bundled dictionary; local Docker has nine image tags. The new `targoman_platform_t3` PostgreSQL database contains three applied target migrations and 72,906 JSON dictionary entries. Temporary smoke containers and the target API process were stopped; the original MySQL container was restored.

## Product Runtime

Web serves configured brand and enabled navigation, proxies `/api` to the target API, and requires no login. API validates requests and owns public HTTP; Worker claims durable SIEM exports. PostgreSQL stores reference and operational state. AI Router calls configured OpenAI-compatible vLLM endpoints. Customer images require external PostgreSQL, model endpoint, and mounted secrets; the example Compose network and SOC/model values must be replaced for a real customer.

## Enabled Modules

| Profile | Translator | Summarizer | FAQ | SIEM |
| --- | --- | --- | --- | --- |
| A | yes | no | no | no |
| B | yes | yes | no | no |
| C | yes | yes | yes | yes |

## MySQL Dependency Inventory

| Dependency | Source | Classification | Migrated | Target owner | Remaining need |
| --- | --- | --- | --- | --- | --- |
| Dictionary | User-provided JSON, active `tblMultiDic` (0 rows) | Required reference data | 72,906 JSON entries | Translator persistence | None at runtime |
| `tblLogs` | Legacy public routes | Legacy history/old operational state | New requests only | Audit/Observability | None at runtime |
| `tblPerUserStats`, fake user, auth tables | Legacy routes | Legacy identity/history | No fake user copied | Usage/anonymous context | None at runtime |
| Legacy model and file settings | `.config.json`, `getAuthInfo` | Configuration | Replaced by CJSON | Configuration/Admission/File Processing | None at runtime |
| Historical SQL dump | Parent workspace | Unverified historical source | Excluded | Cutover review | Recheck only if customer declares it authoritative |

## Data Migration Evidence

| Dataset | Source count | Target count | Fingerprint/check | Rerun result |
| --- | ---: | ---: | --- | --- |
| `src/db/data/multi-dic.json` | 72,907 total; 72,906 nonempty phrase keys | 72,906 | SHA-256 `2265e763c52d568aa120028b4d4bf6f0765d6fd8033595e3ed30b090c00b59d5`; 0 missing/extra/mismatch/duplicate | Idempotent apply and dry-run comparisons passed |
| Active MySQL `tblMultiDic` | 0 | 0 MySQL-source rows | Read-only source inventory | No MySQL writes |

One empty-key JSON entry cannot be looked up and is recorded, not silently invented as a phrase. The JSON-only fresh-install mode never connects to MySQL. Old chats, accounts, and unrelated data were not copied.

## PostgreSQL Object Inventory

| Owner | Migration | Key objects | Mutation audit |
| --- | --- | --- | --- |
| Platform/Translator | `001-public-runtime.sql` | configuration-independent reference/runtime schemas, Translator dictionary, AI runs/attempts, admission, usage, semantic audit, telemetry | `002` registered triggers |
| Runtime grants/audit | `002-runtime-grants-and-audit.sql` | least-privilege API/Worker grants and mutation evidence | DB-level trigger evidence with allowlisted fields |
| AI Router | `003-ai-capacity-lease.sql` | distributed endpoint leases | Registered mutation evidence |

## Anonymous Execution Context

Safe example: `{ actorKind: 'ANONYMOUS', actorId: null, deploymentId: 'customer-c', tenantId: 'customer-c', moduleId: 'translator', requestId: '<uuid>', correlationId: '<uuid>', configFingerprint: '<sha256>' }`. No fake user ID or raw content is included.

## Audit Matrix

| Module/action/result | Semantic event | DB evidence |
| --- | --- | --- |
| Translator/Summarizer/FAQ started/completed/failed/denied | Named `public.<module>.<result>` event with correlation and anonymous actor | Triggered mutation evidence for run, usage, admission and export rows |
| SIEM delivery/retry | Delivery status keyed by event ID | Export state mutations audited |

Raw prompts, uploaded document text, provider credentials, and secret values are excluded by default.

## Usage Matrix

| Module | Dimensions | Example result |
| --- | --- | --- |
| Translator | deployment/tenant/anonymous actor, run, input/output tokens | Dictionary or model operation settled once |
| Summarizer | same plus module/task | Stream result settled once |
| FAQ | same plus module/task | Generated batch settled once |

The duplicate-run integration case records one usage row despite duplicate settlement.

## Admission Matrix

| Policy | Test | Result |
| --- | --- | --- |
| Per-module input/upload bounds | Oversize input and invalid file | PASS: rejected before provider call |
| Rate/concurrency/daily quota/token budget | Two PostgreSQL pools and conflicting reservations | PASS: deterministic denial |
| Reservation expiry/release | Expired and released reservations | PASS: capacity recovered |
| AI endpoint capacity | Two Router instances | PASS: shared PostgreSQL lease denies excess work |

## Observability

Structured request/provider logs carry timestamp, severity, component, request/correlation IDs, deployment, tenant, module, actor kind, status, duration, safe error class and Router endpoint/model/attempt metadata. The tests and live inspection verified safe client errors and no raw content or secret fields. Operational logs are not authoritative business evidence.

## SIEM Export

Canonical semantic audit rows are filtered by configured event names. Export rows are committed with events, claimed by Worker, transformed to a fixed redacted envelope, and delivered by the HTTPS JSON adapter with `Idempotency-Key` equal to the audit event ID. Delivery status, attempt count, next attempt and acknowledgment are durable in PostgreSQL. A local HTTP test receiver (test-only URL) returned 503 then 200; a new Worker storage instance delivered the retry with the same identity/body. Destination outage does not change public AI success. No unauthenticated pull API was added.

## Branding Matrix

| Profile | Brand | Modules | Verification |
| --- | --- | --- | --- |
| A | Aster AI | Translator | Web SSR/route/image smoke PASS |
| B | Boreal AI | Translator, Summarizer | Web SSR/route/logo hash PASS |
| C | Cedar AI | Translator, Summarizer, FAQ | Web SSR/route/logo hash PASS |

All logos are distinct inside built Web images. Disabled links and routes are absent or rejected, and no Login link is presented.

## Security Review

| Control | Evidence | Result |
| --- | --- | --- |
| Request, file, route and size validation | Live invalid-input/file tests, scoped proxy route checks, type/config tests | PASS |
| Provider bounds and failure isolation | Router tests for retries, failover, post-commit rule, cancellation, timeouts | PASS |
| Secret separation | Image CJSON contains only `file:/run/secrets/...` refs; individual secret mounts; no secret values in manifest | PASS |
| Database least privilege and audit | Fresh migrations, conformance role matrix, target integration | PASS |
| Runtime dependency scan | Dedicated runtime lockfile audit: 0 findings | PASS |
| Repository-wide legacy debt | Root install advisories and architecture findings remain | RECORDED |

## MySQL-Off Evidence

With `docker-mysql-1` stopped, the built `targoman/customer-c-api:1.0.0` image served the live public-tools smoke on port 3101. Translator, Summarizer, FAQ, FAQ inspect, and PDF extraction all passed through the target API and live model. PostgreSQL and AI readiness were READY. MySQL was restarted after the check.

## Sepidjoo Configuration Reference

| Source | Observed behavior | Reuse decision | Target |
| --- | --- | --- | --- |
| `workspace/shared/utils/configManagerFactory.ts` | Quote-aware CJSON comments, defaults merge, load errors | Adapt parser/error model; validate full candidate instead of arbitrary merge | `packages/configuration` |
| `workspace/shared/interfaces/config.ts` | Shared config shapes | Adapt to typed runtime-validated CJSON | `packages/configuration` |
| `workspace/api/src/utils/configManager.ts` | App defaults and ENV examples | Reference only; no copied credentials or ordinary ENV overlay | Customer CJSON examples |

## Configuration Architecture

`packages/configuration/src/index.ts` parses comments, rejects unknown keys, validates the complete schema and cross-field bounds, resolves file-secret references separately, exposes an immutable snapshot/fingerprint, and atomically swaps only a valid reload candidate. Deployment/database/HTTP identity is startup-only. `cli.ts` supports validate, effective redacted print, and fingerprint. Profiles live under `deploy/examples/` and are packaged into the customer releases.

## ENV Usage Inventory

Target production reads: `TARGOMAN_CONFIG_PATH` (Web bootstrap path, BOOTSTRAP_REQUIRED); `TARGOMAN_ROLE` (image role, COMPOSE_INFRASTRUCTURE); `HOST`/`PORT` (Node Web listener, COMPOSE_INFRASTRUCTURE); `NODE_ENV` (runtime mode, COMPOSE_INFRASTRUCTURE); `TARGOMAN_CUSTOMER_NETWORK` and `TARGOMAN_RELEASE_SECRETS_DIR` (Compose interpolation, COMPOSE_INFRASTRUCTURE). Database passwords and provider credentials are file-secret references, not ordinary ENV values. Ordinary configuration ENV overlays: 0.

## AI Router Endpoint Matrix

| Endpoint | Provider/model | Tasks | Health | Preference/capacity |
| --- | --- | --- | --- | --- |
| Development/Customer C primary | OpenAI-compatible vLLM / configured model | translate, summarize, FAQ | Live `/v1/models` and request success | Priority/weight and max concurrent from CJSON; distributed lease |
| Additional configured endpoints in tests | OpenAI-compatible test adapters | Task-specific | Healthy/unhealthy/circuit cases | Hard eligibility, deterministic priority/weight, bounded attempts |

No endpoint credentials are embedded in URLs or image labels.

## AI Routing Evidence

Router tests cover eligible/excluded endpoints, reasons, deterministic selection, weighted selection, unhealthy exclusion, capacity exclusion, pre-commit failover, and refusal to silently replay after visible output. Attempts and terminal outcomes persist. Business modules submit only semantic tasks.

## Live Router Evidence

| Module | Semantic task | Router run | Endpoint/provider | Terminal |
| --- | --- | --- | --- | --- |
| Translator | TRANSLATE | Persisted run/attempt | Configured primary / live vLLM | Succeeded |
| Summarizer | SUMMARIZE | Persisted run/attempt | Configured primary / live vLLM | Stream succeeded; cancel passed |
| FAQ | FAQ_GENERATE | Persisted run/attempt | Configured primary / live vLLM | Batch and done succeeded |

## Customer Configuration Matrix

| Profile | Brand | Modules | Router/admission | SIEM | Result |
| --- | --- | --- | --- | --- | --- |
| A | Aster AI | Translator | CJSON policy | Off | Separate 3 images; Web image live PASS |
| B | Boreal AI | Translator, Summarizer | CJSON policy | Off | Separate 3 images; SSR/routes PASS |
| C | Cedar AI | All three | CJSON policy | Push on | Separate 3 images; API/Worker image and MySQL-off live PASS |

## Acceptance Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| 1 | PASS | PostgreSQL-only Translator, Summarizer and FAQ; MySQL-off built-image live test. |
| 2 | PASS | Required dictionary JSON migration: 72,906/72,906, exact fingerprint and idempotent rerun. |
| 3 | PASS | Anonymous context, semantic audit, DB mutation audit, usage, admission and observability. |
| 4 | PASS | Durable SIEM push, filtering/redaction, local receiver retry/restart, no pull API. |
| 5 | PASS | Typed CJSON, secret references, CLI, snapshot/fingerprint/reload; Sepidjoo inspected. |
| 6 | PASS | Semantic AI Router, multi-endpoint policy tests, live vLLM, streaming and cancellation. |
| 7 | PASS | A/B/C customer-specific Web/API/Worker images from one source hash; distinct built Web brands. |
| 8 | PASS | Web/module/route gates, 107 UI tests, target UI architecture guard. |
| 9 | PASS | Target PostgreSQL fresh migrations, role conformance, audit, and 0 runtime-lock audit findings. |
| 10 | PASS | Release runbook, rollback, provenance manifests, SBOM, customer image smoke. |

## Open Issues

Real customer promotion still needs customer-specific PostgreSQL/model/SIEM endpoints and secret files, external image registry digests/signing/scanning, and a backup restore exercise in that environment. The sample Compose files intentionally use placeholders and an operator-provisioned private network. The broad legacy root dependency and architecture findings remain outside the T3 customer images. These are deployment inputs and pre-existing modernization work, not hidden T3 test failures.

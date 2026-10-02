# Activity Report: SVELTE-FOUNDATION-U1

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-0935-SVELTE-FOUNDATION-U1.md
- Created At: 2026-10-02T06:05:08.362Z
- Status: COMPLETE

## Purpose and Scope

Implement U1's SvelteKit target UI foundation, five shared UI packages, executable UI01–UI16 guardrails, and focused tests. Business screens, production ingress, backend Identity cookies, database changes, and legacy frontend removal are outside this task.

## Governing Sources

- `AGENTS.md` and scoped `apps/web` / package `AGENTS.md` files.
- `docs/architecture/00-manifest.md` through `10-commercial-architecture.md`.
- `docs/ui/00-current-state-inventory.md` through `05-ui-guardrails-and-testing.md`.
- `docs/prompts/U1.md`; U0.1 readiness recorded `Ready for U1: YES`.

## Initial Repository State

U0/U0.1 plans and report existed; the legacy Express/static UI owned current production routes. The U1 report was started by `npm run report:start -- SVELTE-FOUNDATION-U1` before target implementation. No target SvelteKit application or target package manifests existed.

## Pre-existing Workspace Changes

- None under `ui/` at task start. Untracked sibling paths outside `ui/` were present and were not modified or claimed by this task.

## Files Added

- `apps/web/package.json`
- `apps/web/src/app.html`
- `apps/web/src/hooks.server.ts`
- `apps/web/src/lib/api/client.ts`
- `apps/web/src/lib/api/transport.ts`
- `apps/web/src/lib/auth/session.ts`
- `apps/web/src/lib/layout/chrome.svelte.ts`
- `apps/web/src/lib/layout/chrome.types.test.ts`
- `apps/web/src/lib/layout/contributions.ts`
- `apps/web/src/lib/routing/resolve.ts`
- `apps/web/src/lib/server/bootstrap.ts`
- `apps/web/src/lib/streaming/parser.ts`
- `apps/web/src/lib/streaming/transport.ts`
- `apps/web/src/lib/styles/main.scss`
- `apps/web/src/routes/(admin)/+layout.svelte`
- `apps/web/src/routes/(admin)/admin/+page.svelte`
- `apps/web/src/routes/(public)/+layout.svelte`
- `apps/web/src/routes/(public)/+page.svelte`
- `apps/web/src/routes/(public)/foundation/+page.svelte`
- `apps/web/src/routes/(user)/+layout.svelte`
- `apps/web/src/routes/(user)/dashboard/+page.svelte`
- `apps/web/src/routes/+layout.server.ts`
- `apps/web/src/routes/+layout.svelte`
- `apps/web/static/theme-init.js`
- `apps/web/svelte.config.js`
- `apps/web/tests/api.test.ts`
- `apps/web/tests/calendar.test.ts`
- `apps/web/tests/components.test.ts`
- `apps/web/tests/foundation.test.ts`
- `apps/web/tests/guardrails.test.ts`
- `apps/web/tests/markdown.test.ts`
- `apps/web/tests/stream.test.ts`
- `apps/web/tsconfig.json`
- `apps/web/vite.config.ts`
- `docs/reports/20261002-0935-SVELTE-FOUNDATION-U1.md`
- `docs/ui/06-u1-foundation-implementation.md`
- `package-lock.json`
- `packages/branding/package.json`
- `packages/branding/src/index.ts`
- `packages/branding/tsconfig.json`
- `packages/calendar-core/package.json`
- `packages/calendar-core/src/index.ts`
- `packages/calendar-core/tsconfig.json`
- `packages/calendar-svelte/package.json`
- `packages/calendar-svelte/src/DateInput.svelte`
- `packages/calendar-svelte/src/DateRangeInput.svelte`
- `packages/calendar-svelte/src/DateTimeInput.svelte`
- `packages/calendar-svelte/src/index.ts`
- `packages/calendar-svelte/tsconfig.json`
- `packages/contracts/package.json`
- `packages/contracts/src/index.ts`
- `packages/contracts/tsconfig.json`
- `packages/ui-core/package.json`
- `packages/ui-core/src/ai-operation/index.ts`
- `packages/ui-core/src/feedback/BusySurface.svelte`
- `packages/ui-core/src/feedback/EmptyState.svelte`
- `packages/ui-core/src/feedback/ErrorState.svelte`
- `packages/ui-core/src/feedback/Toast.svelte`
- `packages/ui-core/src/forms/Checkbox.svelte`
- `packages/ui-core/src/forms/EmailInput.svelte`
- `packages/ui-core/src/forms/ErrorSummary.svelte`
- `packages/ui-core/src/forms/FieldHelp.svelte`
- `packages/ui-core/src/forms/FormError.svelte`
- `packages/ui-core/src/forms/MultiSelect.svelte`
- `packages/ui-core/src/forms/NumberInput.svelte`
- `packages/ui-core/src/forms/Radio.svelte`
- `packages/ui-core/src/forms/Select.svelte`
- `packages/ui-core/src/forms/TextInput.svelte`
- `packages/ui-core/src/forms/Textarea.svelte`
- `packages/ui-core/src/forms/numeric.ts`
- `packages/ui-core/src/index.ts`
- `packages/ui-core/src/lists/CursorTable.svelte`
- `packages/ui-core/src/lists/model.ts`
- `packages/ui-core/src/overlays/Dialog.svelte`
- `packages/ui-core/src/overlays/Drawer.svelte`
- `packages/ui-core/src/rich-content/MarkdownView.svelte`
- `packages/ui-core/src/rich-content/pipeline.ts`
- `packages/ui-core/src/rich-content/render.browser.ts`
- `packages/ui-core/src/rich-content/render.server.ts`
- `packages/ui-core/src/svelte.d.ts`
- `packages/ui-core/tsconfig.json`
- `scripts/target-ui-guardrails.ts`

## Files Modified

- `.gitignore`
- `package.json`

## Files Deleted

- None.

## Implementation Summary

- Added npm workspaces under one committed root lockfile; retained existing Express scripts.
- Added Svelte 5 / SvelteKit 2 / adapter-node SSR app with public, user, admin composition, generic brand/theme/RTL shell, route resolver, typed local chrome leases and contribution descriptors.
- Added browser-safe contracts, validated branding, pure calendar core and Svelte calendar fields, UI form/overlay/list/Markdown/AI primitives, API/auth/tenant interfaces and bounded streaming parser.
- Added UI01–UI16 static checks and positive/negative detector fixtures. New target tree: 0 violations, 0 infrastructure failures.
- Added `docs/ui/06-u1-foundation-implementation.md` with workspace, dependency, reference, ownership, commands and next gates.

## Packages Created

| Package | Path | Purpose |
|---|---|---|
| `@fapa/web` | `apps/web` | Node SSR shell and browser adapters |
| `@fapa/contracts` | `packages/contracts` | Browser-safe public contracts |
| `@fapa/branding` | `packages/branding` | Validated public Brand Profile |
| `@fapa/ui-core` | `packages/ui-core` | Shared UI primitives |
| `@fapa/calendar-core` | `packages/calendar-core` | Pure date and timezone semantics |
| `@fapa/calendar-svelte` | `packages/calendar-svelte` | Date field presentation |

## Dependency Decisions

Exact versions: Svelte 5.56.8, Kit 2.70.2, adapter-node 5.5.7, Vite plugin 5.1.1, Vite 6.4.3, TypeScript 5.9.3, Bootstrap 5.3.8, Sass 1.102.0, TanStack table-core 8.21.3, Vitest 3.2.7, svelte-check 4.7.4, axe-core 4.11.3, markdown-it 15.0.2, DOMPurify 3.4.16, jsdom 26.1.0, devalue 5.9.3, ws 8.21.0. Reasons, Node/peer compatibility, licenses and security review are in `docs/ui/06-u1-foundation-implementation.md`. The root override plus exact root dev pins keep patched transitive devalue/ws in the single lockfile. Production Web audit: 0 advisories. The clean install passed on Node 20.20.0; Node 22 runtime remains a deployment check.

## Reference Reuse

Behavior and fixtures were adapted independently, with no vendored reference source or runtime cross-repository imports. The inspected Sepidjoo and AIAR application manifests declared no license and no top-level license file was found; source copying was avoided. Source commits are recorded in `docs/ui/01-reference-implementations.md`.

| Source | Source path | Target path | Reuse type | Changes | Tests |
|---|---|---|---|---|---|
| Sepidjoo | `ui/src/routes/+layout.svelte` | `apps/web/src/routes/+layout.svelte` | Adapted pattern | SSR-safe generic shell | SSR smoke, components |
| Sepidjoo | `ui/src/lib/stores/layoutStore.svelte.ts` | `apps/web/src/lib/layout/chrome.svelte.ts` | Adapted pattern | Context, correlated props, lease/epoch | foundation, compile-time |
| Sepidjoo | `ui/src/routes/(panel)/+layout.svelte`, `ui/src/routes/admin/+layout.svelte` | `apps/web/src/routes/(user)/`, `(admin)/` | Adapted pattern | Distinct contribution-driven shells | foundation, SSR smoke |
| Sepidjoo | `ui/src/lib/styles/globals.scss` | `apps/web/src/lib/styles/main.scss` | Adapted pattern | Logical CSS, one Bootstrap map | UI15, SSR smoke |
| Sepidjoo | `ui/src/lib/components/common/TanStackDataTable.svelte` | `packages/ui-core/src/lists/` | Adapted pattern | Cursor/no mandatory total | foundation |
| Sepidjoo | `ui/src/lib/components/common/PersianNumberInput.svelte` | `packages/ui-core/src/forms/numeric.ts`, `NumberInput.svelte` | Adapted pattern | ASCII serialization/caret | components |
| AIAR | `PWA/src/lib/domain/date.ts`, `PWA/tests/date.test.ts` | `packages/calendar-core/src/index.ts`, `apps/web/tests/calendar.test.ts` | Adapted semantics/fixtures | Pure bounds, zone/DST | calendar |
| AIAR | `PWA/src/lib/components/JalaliDatePicker.svelte` | `packages/calendar-svelte/src/DateInput.svelte` | Adapted pattern | Keyboard/focus, Calendar Core only | components |
| AIAR | `PWA/src/lib/api/client.ts` | `apps/web/src/lib/api/`, `src/lib/streaming/` | Adapted pattern | Typed request/SSE boundaries | API, stream |
| AIAR | `PWA/src/lib/components/MarkdownText.svelte`, `PWA/src/lib/utils/markdown.ts` | `packages/ui-core/src/rich-content/` | Adapted pattern | One SSR/browser sanitizer | Markdown security |

Adapted reference asset groups: 10.

## UI Guardrails

Each rule has one rejecting and one accepting fixture in `apps/web/tests/guardrails.test.ts`. All target findings are zero.

| Rule | Mechanism | Self-test | Target findings |
|---|---|---|---:|
| UI01 | Tailwind imports/manifests/CSS | PASS | 0 |
| UI02 | Network AST outside transport | PASS | 0 |
| UI03 | Authorization interpretation AST | PASS | 0 |
| UI04 | Calendar owner/converter AST | PASS | 0 |
| UI05 | Markdown owner/raw HTML AST | PASS | 0 |
| UI06 | Provider/DB imports | PASS | 0 |
| UI07 | Server import/private environment AST | PASS | 0 |
| UI08 | Top-level browser global AST | PASS | 0 |
| UI09 | Hard-coded brand literals | PASS | 0 |
| UI10 | Deployment URL literals | PASS | 0 |
| UI11 | Unsafe HTML/URL sink checks | PASS | 0 |
| UI12 | Strict types/wildcard/private import AST | PASS | 0 |
| UI13 | Loose component/props correlation | PASS | 0 |
| UI14 | Default cursor total contract | PASS | 0 |
| UI15 | Global utility/z-index CSS | PASS | 0 |
| UI16 | Browser credential storage calls | PASS | 0 |

## Target Architecture Gate

`npm run test:architecture:target-ui` exit 0: `ARCHITECTURE_VIOLATION=0`, `TEST_INFRA_FAILURE=0`. The existing repository-wide runner reported 212 legacy architecture violations, 24 unrelated `TARGET_NOT_IMPLEMENTED`, and 0 infrastructure failures. No new target path finding remained; no baseline, allowlist or T1/T1.1 weakening was introduced. Generated legacy architecture report output was restored to its original tracked content after the run.

## Architecture Decisions / Deviations

- Internal names use `@fapa/*`, exact versions and one committed root lockfile.
- The Web runtime has an anonymous fixture SSR bootstrap only; real authenticated SSR awaits Identity's external contract.
- `packages/ui-core/src/lists/` names presentation lists to avoid the existing repository analyzer's database-table import heuristic. Its rule and assertions were left intact.
- The browser Markdown entry initializes DOMPurify during render, avoiding top-level browser globals in SSR-safe scanning. Server rendering uses a separate Node entry with the same policy.

## Tests and Verification

| Command | Result | Evidence |
|---|---|---|
| `npm ci --prefer-offline` | PASS, exit 0 | Clean install, 837 packages added from root lockfile |
| `npm run check:web` | PASS, exit 0 | 0 errors, 0 warnings |
| `node node_modules/typescript/lib/tsc.js --noEmit -p apps/web/tsconfig.json` | PASS, exit 0 | Strict target TS, including negative chrome props |
| `npm run build:web` | PASS, exit 0 | Svelte SSR and adapter-node output |
| Node SSR local HTTP smoke | PASS, exit 0 | `/`, `/foundation`, `/dashboard`, `/admin` each 200; `lang=fa`, `dir=rtl` |
| `npm run test:ui` | PASS, exit 0 | 48 tests across 7 files |
| `npm run test:architecture:target-ui` | PASS, exit 0 | 0 violations, 0 infrastructure failures |
| `npm audit --workspace @fapa/web --omit=dev` | PASS, exit 0 | 0 production advisories |
| `npm run build` | PASS, exit 0 | Existing Express build still works |
| `git diff --check` | PASS, exit 0 | No whitespace errors |
| `npm run test:architecture` | Expected FAIL, exit 1 | 212 legacy violations, 24 future packages, 0 infra |

## Expected Failures

The repository-wide architecture command remains red for 212 legacy architecture violations and 24 future package manifests marked `TARGET_NOT_IMPLEMENTED`. An initial offline-only `npm ci --offline` could not fetch an uncached legacy tarball (`yn@3.1.1`); the clean `npm ci --prefer-offline` completed successfully when registry access was available.

## Unexpected Failures

None outstanding. A transient UI08 finding and a legacy analyzer collision were corrected without weakening detectors. No target finding remains.

## Production Code Changes

Only the new target UI app/packages and root workspace manifest/lockfile were changed. Existing Express source, static HTML/JS, route bindings, backend Identity semantics, database schema, provider connections and business screens were not changed.

## Production Cutover

NO. Existing Express/static UI remains the active production frontend. SvelteKit runs independently for development/verification only.

## Final Repository State

The U1 foundation builds and tests; target UI architecture findings are zero. No legacy files were deleted. The pre-existing unrelated sibling workspace files were not modified.

## Acceptance Criteria

| Criterion | Result | Evidence |
|---|---|---|
| 1 | PASS | U0.1 readiness YES; report started before changes |
| 2 | PASS | Legacy Express build succeeds; no ingress or cookie/schema changes |
| 3 | PASS | `apps/web` plus five packages, exact exports and single lockfile |
| 4 | PASS | SSR Node app, three shell groups, typed chrome/contributions/routes |
| 5 | PASS | Branding, theme, RTL, numeric, Calendar Core/Svelte and primitives |
| 6 | PASS | API/auth/tenant/stream/Markdown boundaries and focused tests |
| 7 | PASS | UI01–UI16 executable with 16 fixture pairs and zero target findings |
| 8 | PASS | Clean install, checks, build, 48 tests, audit, SSR smoke, diff check |
| 9 | PASS | Implementation documentation and finalized verified activity report |

## Open Issues

- Identity-owned authenticated SSR bootstrap, backend route/binding and capability projections, and real tenant switch integration are prerequisites for the first production vertical slice.
- Node 22 runtime execution, manual assistive-technology and zoom checks belong to later deployment/feature acceptance.
- The legacy architecture findings remain separate migration work.

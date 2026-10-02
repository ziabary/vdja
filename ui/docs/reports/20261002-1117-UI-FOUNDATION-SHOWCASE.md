# Activity Report: UI-FOUNDATION-SHOWCASE

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-1117-UI-FOUNDATION-SHOWCASE.md
- Created At: 2026-10-02T07:47:02.624Z
- Status: PARTIAL

## Purpose and Scope

Implement U1.2 Persian foundation localization, a human-reviewable development showcase, and one-command development without migrating business screens or changing production ingress, Identity, or database semantics.

## Governing Sources

- Root and scoped AGENTS.md files for Web, UI Core, Calendar Core, Calendar Svelte, and Branding.
- docs/architecture/00-manifest.md, 01-system-architecture.md, 02-engineering-conventions.md, 04-authorization-model.md, 05-module-architecture.md, and 08-deployment-architecture.md.
- docs/ui/00 through 06, U1.1 completed Activity Report, and U1.2 task prompt.

## Initial Repository State

U1/U1.1 target foundation files and unrelated workspace work were already uncommitted. The report was started before U1.2 source modification. The initial status capture had 135 paths. The previous Web dev process from U1.1 was still listening on 5173; it was identified and stopped before U1.2 smoke verification.

## Pre-existing Workspace Changes

The following final paths predate U1.2 and were not changed for this task. The U1/U1.1 versions of files listed under Files Modified also predated U1.2; only their U1.2 edits are claimed here.

- `.gitignore`
- `apps/web/AGENTS.md`
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
- `apps/web/src/routes/(public)/+layout.svelte`
- `apps/web/static/fonts/fontawesome/v6.2.0/all.css`
- `apps/web/static/fonts/fontawesome/v6.2.0/sharp-solid.css`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-brands-400.ttf`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-brands-400.woff2`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-duotone-900.ttf`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-duotone-900.woff2`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-light-300.ttf`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-light-300.woff2`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-regular-400.ttf`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-regular-400.woff2`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-sharp-solid-900.ttf`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-sharp-solid-900.woff2`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-solid-900.ttf`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-solid-900.woff2`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-thin-100.ttf`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-thin-100.woff2`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-v4compatibility.ttf`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-v4compatibility.woff2`
- `apps/web/static/fonts/iransansx/fontiran.css`
- `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-Black.woff`
- `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-Bold.woff`
- `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-DemiBold.woff`
- `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-ExtraBold.woff`
- `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-Light.woff`
- `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-Medium.woff`
- `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-Regular.woff`
- `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-Thin.woff`
- `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-UltraLight.woff`
- `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-Black.woff2`
- `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-Bold.woff2`
- `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-DemiBold.woff2`
- `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-ExtraBold.woff2`
- `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-Light.woff2`
- `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-Medium.woff2`
- `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-Regular.woff2`
- `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-Thin.woff2`
- `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-UltraLight.woff2`
- `apps/web/static/theme-init.js`
- `apps/web/tests/api.test.ts`
- `apps/web/tests/assets.test.ts`
- `apps/web/tests/branding.test.ts`
- `apps/web/tests/calendar.test.ts`
- `apps/web/tests/components.test.ts`
- `apps/web/tests/foundation.test.ts`
- `apps/web/tests/markdown.test.ts`
- `apps/web/tests/namespace.test.ts`
- `apps/web/tests/stream.test.ts`
- `apps/web/tsconfig.json`
- `docs/architecture/00-manifest.md`
- `docs/architecture/01-system-architecture.md`
- `docs/architecture/02-engineering-conventions.md`
- `docs/architecture/08-deployment-architecture.md`
- `docs/prompts/U1.1.md`
- `docs/prompts/U1.2.md`
- `docs/reports/20261002-0935-SVELTE-FOUNDATION-U1.md`
- `docs/reports/20261002-1022-UI-FOUNDATION-CORRECTION.md`
- `docs/ui/03-target-ui-architecture.md`
- `packages/branding/AGENTS.md`
- `packages/branding/package.json`
- `packages/branding/src/index.ts`
- `packages/branding/tsconfig.json`
- `packages/calendar-core/package.json`
- `packages/calendar-core/src/index.ts`
- `packages/calendar-core/tsconfig.json`
- `packages/calendar-svelte/src/index.ts`
- `packages/calendar-svelte/tsconfig.json`
- `packages/contracts/package.json`
- `packages/contracts/src/index.ts`
- `packages/contracts/tsconfig.json`
- `packages/ui-core/AGENTS.md`
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
- `packages/ui-core/src/forms/NumberInput.svelte`
- `packages/ui-core/src/forms/Radio.svelte`
- `packages/ui-core/src/forms/Select.svelte`
- `packages/ui-core/src/forms/TextInput.svelte`
- `packages/ui-core/src/forms/Textarea.svelte`
- `packages/ui-core/src/forms/numeric.ts`
- `packages/ui-core/src/overlays/Drawer.svelte`
- `packages/ui-core/src/rich-content/MarkdownView.svelte`
- `packages/ui-core/src/rich-content/pipeline.ts`
- `packages/ui-core/src/rich-content/render.browser.ts`
- `packages/ui-core/src/rich-content/render.server.ts`
- `packages/ui-core/src/svelte.d.ts`
- `packages/ui-core/tsconfig.json`

## Files Added

- `apps/web/src/lib/server/showcase.ts`
- `apps/web/src/routes/(public)/foundation/+page.server.ts`
- `apps/web/tests/OverlayFixture.svelte`
- `apps/web/tests/u12-foundation.test.ts`
- `docs/reports/20261002-1117-UI-FOUNDATION-SHOWCASE.md`
- `docs/ui/07-u1.2-showcase-and-development.md`
- `packages/calendar-svelte/src/keyboard.ts`
- `packages/ui-core/src/i18n/index.ts`

## Files Modified

- `apps/web/src/routes/(admin)/+layout.svelte`
- `apps/web/src/routes/(admin)/admin/+page.svelte`
- `apps/web/src/routes/(public)/+page.svelte`
- `apps/web/src/routes/(public)/foundation/+page.svelte`
- `apps/web/src/routes/(user)/+layout.svelte`
- `apps/web/src/routes/(user)/dashboard/+page.svelte`
- `apps/web/src/routes/+layout.server.ts`
- `apps/web/src/routes/+layout.svelte`
- `apps/web/tests/guardrails.test.ts`
- `apps/web/vite.config.ts`
- `docs/ui/05-ui-guardrails-and-testing.md`
- `docs/ui/06-u1-foundation-implementation.md`
- `package-lock.json`
- `package.json`
- `packages/calendar-svelte/package.json`
- `packages/calendar-svelte/src/DateInput.svelte`
- `packages/calendar-svelte/src/DateRangeInput.svelte`
- `packages/calendar-svelte/src/DateTimeInput.svelte`
- `packages/ui-core/src/forms/MultiSelect.svelte`
- `packages/ui-core/src/index.ts`
- `packages/ui-core/src/lists/CursorTable.svelte`
- `packages/ui-core/src/lists/model.ts`
- `packages/ui-core/src/overlays/Dialog.svelte`
- `scripts/target-ui-guardrails.ts`

## Files Deleted

- None.

## Implementation Summary

- Added one typed `fa`/`en` UI presentation dictionary and request-local Svelte locale context. Persian/RTL is the default. Shell, shared table, MultiSelect, Dialog, and Calendar Svelte use it; BrandProfile and calendar arithmetic retain their canonical owners.
- Built 13 interactive `/foundation` sections with existing shared components, local synthetic Persian fixtures, canonical value examples, status simulator, and visible human review checklist. A server load guard returns 404 in production.
- Corrected calendar semantic arrow direction, Home/End row offset, month paging, arrow navigation, localized labels, and focus restoration tests.
- Made root `npm run dev` start Web directly, preserved `dev:web`, `dev:api`, `sdev`, and `lint:watch`, configured Web host `0.0.0.0:5173`, and added a development-only loopback `/api` proxy.
- Added UI23/UI24 static guardrails with positive/negative fixtures and the U1.2 documentation page.

## Showcase Coverage

Brand/shell; typography; Persian numbers; direction/hidden utilities; FontAwesome; all eight shared form primitives; Jalali date/date-time/range; cursor table including loading/empty/actions; Markdown; feedback; Dialog/Drawer; all nine AI operation states; visual review checklist. The showcase has no business API or AI provider dependency.

## Localization

The `ui-locale` cookie is read by both SSR hook and layout load. HTTP smoke proved `fa` renders `<html lang="fa" dir="rtl">` with Persian shell text and `en` renders `<html lang="en" dir="ltr">` with English shell text. Shared built-in labels are typed. `fa-num` is presentation-only; input and serialized values remain canonical. Browser hydration was not visually inspected by a human.

## Development Commands

- `npm run dev`: PASS; Web ready on 5173, `/` and `/foundation` HTTP 200, stopped cleanly.
- `npm run dev:web`: PASS; Web ready on 5173, four routes and required font files HTTP 200, stopped cleanly.
- `npm run dev:api`: FAIL for application readiness; the legacy watch process started but could not connect to its configured local database. It was stopped. Its existing debug startup output included sensitive configuration; no values are copied into this report.
- Web-only root default is the explicit U1.2 safety fallback. `dev:api` remains available when its existing backend dependencies are provisioned. `/api` proxy defaults to loopback port 3000 and rejects non-loopback origins; no production routing changed.

## Calendar Corrections

RTL previous/right and next/left; LTR previous/left and next/right. Home/End use rendered `jalaliMonthGrid().offset` and clamp to available days in a partial row. Tests cover three distinct real month offsets, both directions, labels, Home/End, Escape and trigger focus restoration. PageUp/PageDown and direction-aware arrows are implemented.

## Human Review

Human visual review: PENDING. Automated HTML, font, direction, route, and component tests do not establish visual acceptance. The checklist and procedure are in docs/ui/07-u1.2-showcase-and-development.md.

## Architecture Decisions / Deviations

- UI Core owns the minimal shared presentation locale boundary so Web and Calendar Svelte consume the same request-local context; it does not own business or authorization semantics.
- Root `dev` starts Web only because the existing API fails without its local database and emits sensitive startup configuration. This uses U1.2's documented exception for unsafe combined startup. No backend configuration or Identity semantics were modified.
- Vite proxies logical `/api` only in development to a configurable loopback HTTP origin; SSE remains passthrough. Production ingress is unchanged.

## Tests and Verification

| Check | Result | Evidence |
|---|---|---|
| Node 22/npm 11 `npm ci` | PASS | 781 installed packages from lockfile; repo audit reported 23 legacy/dependency advisories |
| `npm run check:web` | PASS | 0 errors, 0 warnings |
| `npm run test:ui` | PASS | 72 tests in 11 files, including U1.2 locale, calendar, overlays, AI state and guardrails |
| `npm run test:architecture:target-ui` | PASS | ARCHITECTURE_VIOLATION=0, TEST_INFRA_FAILURE=0 |
| `npm run build:web` | PASS | Kit 3 SSR/client and adapter-node output |
| Dev HTTP smoke | PASS | `/`, `/foundation`, `/dashboard`, `/admin` returned 200; 13 headings present; fa/en HTML roots verified |
| Font HTTP smoke | PASS | IRANSansX CSS/Regular WOFF2 and FontAwesome CSS/Solid WOFF2 returned 200 |
| Built production HTTP smoke | PASS | `/` 200, `/foundation` 404 |
| `npm run dev` and `dev:web` startup/shutdown | PASS | Web ready on 5173; no temporary listeners remain |
| `npm run dev:api` application readiness | FAIL | Existing database unavailable; watch process stopped |
| `git diff --check` | PASS | No whitespace errors |

Automated foundation verification: PASS for target UI. Full-stack API readiness: FAIL due to the external local database.

## Expected Failures

The legacy API needs its configured local database and cannot become ready in this workspace. Its startup logging of sensitive configuration is a pre-existing backend issue outside U1.2's authorized backend scope. The clean install reported 23 repository dependency advisories; backend dependency modernization remains separate.

## Unexpected Failures

None outstanding in the target Web/UI changes. The first local Web bind failed because a U1.1 Vite process was still running; after stopping that process, both Web commands passed.

## Production Code Changes

Only target Web/shared UI presentation and development tooling changed. Production Express/static route ownership, backend database, Identity semantics, CRM/Widget/Follow-up/Secretariat screens, and production ingress were not modified. `/foundation` is 404 in a normal production build.

## Final Repository State

Target UI checks are green, Web dev and production smoke checks passed, and all temporary listeners are stopped. The local API remains unavailable until its existing database is provisioned. Final status paths are accounted for in Files Added, Files Modified, and Pre-existing Workspace Changes.

## Acceptance Criteria

| Criterion | Result | Evidence |
|---|---|---|
| 1 | PASS | Persian default, typed fa/en context, SSR fa/en root and shell strings |
| 2 | PASS | 13-section interactive development showcase and production 404 |
| 3 | PASS | Calendar direction and offset navigation tests |
| 4 | PASS | Root one-command Web dev and standalone Web dev start/stop |
| 5 | FAIL | Optional legacy API cannot reach readiness without its database |
| 6 | PASS | 72 UI tests; Web check/build; target architecture gate 0/0; font and route smoke |
| 7 | PASS | U1.2 docs, UI23/UI24 guardrails and focused fixtures |
| 8 | NOT_APPLICABLE | Human visual approval remains pending |

## Open Issues

- Provision the legacy API's existing local database/services and review its startup logging before using `dev:api` for business slices. No credentials or database changes were made here.
- Human visual acceptance remains pending.

---

Generated by scripts/activity-report.ts; updated for U1.2 implementation.

# Activity Report: CALENDAR-OVERLAY-REFINEMENT

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-1147-CALENDAR-OVERLAY-REFINEMENT.md
- Created At: 2026-10-02T08:17:10.948Z
- Status: COMPLETE

## Purpose and Scope

- Refine the U1.2 Jalali date picker, direct date range selection, and Dialog/Drawer viewport behavior in the target UI foundation.
- External Aiar and Goft-shonud files were read as visual and interaction references only.

## Governing Sources

- `AGENTS.md`; scoped `apps/web/AGENTS.md` and `packages/ui-core/AGENTS.md`.
- `docs/architecture/00-manifest.md`, `01-system-architecture.md`, `02-engineering-conventions.md`, and `08-deployment-architecture.md`.
- `docs/ui/03-target-ui-architecture.md`, `05-ui-guardrails-and-testing.md`, and `07-u1.2-showcase-and-development.md`.

## Initial Repository State

- The U1/U1.1/U1.2 foundation was already present as uncommitted workspace work at task start.
- Initial scoped git status had 143 paths. They are listed below and are not claimed as new work in this task.

## Pre-existing Workspace Changes

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
- `apps/web/src/lib/server/showcase.ts`
- `apps/web/src/lib/streaming/parser.ts`
- `apps/web/src/lib/streaming/transport.ts`
- `apps/web/src/lib/styles/main.scss`
- `apps/web/src/routes/(admin)/+layout.svelte`
- `apps/web/src/routes/(admin)/admin/+page.svelte`
- `apps/web/src/routes/(public)/+layout.svelte`
- `apps/web/src/routes/(public)/+page.svelte`
- `apps/web/src/routes/(public)/foundation/+page.server.ts`
- `apps/web/src/routes/(public)/foundation/+page.svelte`
- `apps/web/src/routes/(user)/+layout.svelte`
- `apps/web/src/routes/(user)/dashboard/+page.svelte`
- `apps/web/src/routes/+layout.server.ts`
- `apps/web/src/routes/+layout.svelte`
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
- `apps/web/tests/OverlayFixture.svelte`
- `apps/web/tests/api.test.ts`
- `apps/web/tests/assets.test.ts`
- `apps/web/tests/branding.test.ts`
- `apps/web/tests/calendar.test.ts`
- `apps/web/tests/components.test.ts`
- `apps/web/tests/foundation.test.ts`
- `apps/web/tests/guardrails.test.ts`
- `apps/web/tests/markdown.test.ts`
- `apps/web/tests/namespace.test.ts`
- `apps/web/tests/stream.test.ts`
- `apps/web/tests/u12-foundation.test.ts`
- `apps/web/tsconfig.json`
- `apps/web/vite.config.ts`
- `docs/architecture/00-manifest.md`
- `docs/architecture/01-system-architecture.md`
- `docs/architecture/02-engineering-conventions.md`
- `docs/architecture/08-deployment-architecture.md`
- `docs/prompts/U1.1.md`
- `docs/prompts/U1.2.md`
- `docs/reports/20261002-0935-SVELTE-FOUNDATION-U1.md`
- `docs/reports/20261002-1022-UI-FOUNDATION-CORRECTION.md`
- `docs/reports/20261002-1117-UI-FOUNDATION-SHOWCASE.md`
- `docs/ui/03-target-ui-architecture.md`
- `docs/ui/05-ui-guardrails-and-testing.md`
- `docs/ui/06-u1-foundation-implementation.md`
- `docs/ui/07-u1.2-showcase-and-development.md`
- `package-lock.json`
- `package.json`
- `packages/branding/AGENTS.md`
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
- `packages/calendar-svelte/src/keyboard.ts`
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
- `packages/ui-core/src/forms/MultiSelect.svelte`
- `packages/ui-core/src/forms/NumberInput.svelte`
- `packages/ui-core/src/forms/Radio.svelte`
- `packages/ui-core/src/forms/Select.svelte`
- `packages/ui-core/src/forms/TextInput.svelte`
- `packages/ui-core/src/forms/Textarea.svelte`
- `packages/ui-core/src/forms/numeric.ts`
- `packages/ui-core/src/i18n/index.ts`
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

## Files Added

- `apps/web/tests/u13-calendar-overlay.test.ts`
- `docs/reports/20261002-1147-CALENDAR-OVERLAY-REFINEMENT.md`
- `packages/calendar-svelte/src/CalendarMonth.svelte`
- `packages/calendar-svelte/src/picker.css`
- `packages/calendar-svelte/src/picker.ts`
- `packages/calendar-svelte/src/position.ts`
- `packages/ui-core/src/overlays/scrollLock.ts`

## Files Modified

- `docs/ui/07-u1.2-showcase-and-development.md`
- `packages/calendar-svelte/src/DateInput.svelte`
- `packages/calendar-svelte/src/DateRangeInput.svelte`
- `packages/ui-core/src/i18n/index.ts`
- `packages/ui-core/src/overlays/Dialog.svelte`
- `packages/ui-core/src/overlays/Drawer.svelte`

## Files Deleted

- None.

## Implementation Summary

- Replaced square date cells with a shared themed Jalali month component inspired by the Aiar reference, retaining Calendar Core as the only calendar arithmetic owner.
- Replaced separate range inputs with one direct selection panel: first click starts, hover previews, second click completes; reverse selection is normalized and adjacent months are shown on desktop.
- Constrained date popovers to viewport bounds and prevented focus from scrolling the page.
- Rebuilt Dialog and Drawer as viewport-bound native modal surfaces with internal content scrolling, focus restoration, and reference-counted background scroll lock.
- Updated the foundation behavior documentation and focused tests.

## Architecture Decisions / Deviations

- Presentation and interaction remain in `calendar-svelte`; conversions remain in `calendar-core`. Canonical values remain Gregorian ISO dates.
- Popover placement uses viewport coordinates and clamps both axes. A two-month range becomes one visible month below the existing Bootstrap medium breakpoint.
- The Aiar and Goft-shonud implementations were used as references; no external files or legacy backend dependencies were changed.

## Tests and Verification

- `npm run test:ui`: PASS, 76 tests across 12 files, exit 0.
- `npm run test:architecture:target-ui`: PASS, 0 violations and 0 infrastructure failures, exit 0.
- `npm run check:web`: PASS, 0 errors and 0 warnings, exit 0.
- `npm run build:web`: PASS with Vite 8.3.2 and adapter-node, exit 0.
- Headless Chrome on a fresh isolated dev server: desktop 1440×900 and mobile 390×680 popovers fixed and inside viewport; Dialog centered; Drawer fills viewport side; background overflow hidden while open; focus inside. A stale already-running dev server on port 5173 served old compiled code, so browser validation used a fresh server on port 5175.

## Expected Failures

- None.

## Unexpected Failures

- None remaining. The initial mobile browser check exposed an offscreen-trigger placement edge case, which was fixed and rechecked.

## Production Code Changes

- Calendar Svelte presentation and range interaction; UI Core overlay behavior and localized labels. No backend, persistence, or external service changes.

## Final Repository State

- Scoped git status has 150 paths. 143 paths predated this task; 7 added paths belong to this task. Existing U1.2 files listed in Files Modified were refined in this task.
- The existing dev server on port 5173 needs restart to load new component source; a fresh dev server rendered correctly.

## Acceptance Criteria

| Criterion | Result | Evidence |
|---|---|---|
| 1 | PASS | Themed Jalali month in both date and range fields; desktop/mobile browser screenshots reviewed. |
| 2 | PASS | One range popover supports start/end and hover preview; focused tests pass. |
| 3 | PASS | Date popovers remain within desktop/mobile viewport coordinates. |
| 4 | PASS | Dialog and Drawer remain in viewport, lock background scroll, and restore focus. |
| 5 | PASS | UI tests, architecture guardrail, Svelte check, and build exit 0. |

## Open Issues

- Human visual approval of the U1.2 showcase remains pending as in the governing U1.2 documentation.

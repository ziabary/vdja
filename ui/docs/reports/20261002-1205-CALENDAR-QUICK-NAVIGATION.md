# Activity Report: CALENDAR-QUICK-NAVIGATION

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-1205-CALENDAR-QUICK-NAVIGATION.md
- Created At: 2026-10-02T08:35:13.036Z
- Status: COMPLETE

## Purpose and Scope

- Add direct Jalali month and year navigation to the shared date and range calendar headers.
- Preserve canonical date values, range drafts, keyboard usability, localization, date bounds, and viewport placement.

## Governing Sources

- `AGENTS.md`, `apps/web/AGENTS.md`, `packages/calendar-core/AGENTS.md`, and `packages/calendar-svelte/AGENTS.md`.
- `docs/architecture/00-manifest.md`, `01-system-architecture.md`, `02-engineering-conventions.md`, and `08-deployment-architecture.md`.
- `docs/ui/03-target-ui-architecture.md`, `05-ui-guardrails-and-testing.md`, and `07-u1.2-showcase-and-development.md`.

## Initial Repository State

- Initial scoped git status had 150 paths from prior U1/U1.1/U1.2 and calendar-overlay tasks. They are not claimed as new work here.

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
- `apps/web/tests/u13-calendar-overlay.test.ts`
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
- `docs/reports/20261002-1147-CALENDAR-OVERLAY-REFINEMENT.md`
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
- `packages/calendar-svelte/src/CalendarMonth.svelte`
- `packages/calendar-svelte/src/DateInput.svelte`
- `packages/calendar-svelte/src/DateRangeInput.svelte`
- `packages/calendar-svelte/src/DateTimeInput.svelte`
- `packages/calendar-svelte/src/index.ts`
- `packages/calendar-svelte/src/keyboard.ts`
- `packages/calendar-svelte/src/picker.css`
- `packages/calendar-svelte/src/picker.ts`
- `packages/calendar-svelte/src/position.ts`
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
- `packages/ui-core/src/overlays/scrollLock.ts`
- `packages/ui-core/src/rich-content/MarkdownView.svelte`
- `packages/ui-core/src/rich-content/pipeline.ts`
- `packages/ui-core/src/rich-content/render.browser.ts`
- `packages/ui-core/src/rich-content/render.server.ts`
- `packages/ui-core/src/svelte.d.ts`
- `packages/ui-core/tsconfig.json`
- `scripts/target-ui-guardrails.ts`

## Files Added

- `docs/reports/20261002-1205-CALENDAR-QUICK-NAVIGATION.md`

## Files Modified

- `apps/web/tests/u13-calendar-overlay.test.ts`
- `docs/ui/07-u1.2-showcase-and-development.md`
- `packages/calendar-svelte/src/CalendarMonth.svelte`
- `packages/calendar-svelte/src/DateInput.svelte`
- `packages/calendar-svelte/src/DateRangeInput.svelte`
- `packages/calendar-svelte/src/picker.ts`
- `packages/ui-core/src/i18n/index.ts`

## Files Deleted

- None.

## Implementation Summary

- The calendar header now has separately clickable month and year controls. The month view offers twelve choices; the year view offers twelve-year pages plus direct entry of a Jalali year using Persian, Arabic, or Latin digits.
- Calendar Svelte uses Calendar Core for supported-year and month-end conversion. Month/year options outside `min`/`max` are disabled; invalid exact-year entry is announced without changing the view.
- Direct navigation is shared by single-date, date-time through DateInput, and two-month range fields. Range navigation retains an unfinished start date and keeps the selected second month in the second column.
- The picker calls its positioning owner when its content changes so expanded selectors remain in the viewport. Focus moves to relevant controls and back to the day grid without page scrolling.
- Added focused component tests and updated the U1.2 behavior documentation.

## Architecture Decisions / Deviations

- Calendar Core remains the sole owner of Jalali conversion and supported-year bounds. Calendar Svelte owns only view state and interaction.
- The public `onChange` contracts remain canonical Gregorian ISO date strings; this is a presentation and navigation change.
- No legacy/backend or external reference files were changed.

## Tests and Verification

- Red-first focused test: two quick-navigation scenarios failed before implementation, exit 1 as expected.
- `npm run test:ui`: PASS, 79 tests across 12 files, exit 0.
- `npm run test:architecture:target-ui`: PASS, 0 violations and 0 infrastructure failures, exit 0.
- `npm run check:web`: PASS, 0 errors and 0 warnings, exit 0.
- `npm run build:web`: PASS with Vite 8.3.2 and adapter-node, exit 0.
- Fresh local headless Chrome at 390×680: year selector 12 options and input, bounds top 162.7/bottom 536.2; month selector 12 options, bounds top 362/bottom 671.9. Both remain inside viewport; screenshots reviewed.

## Expected Failures

- The initial focused tests failed because direct month/year controls did not exist yet; they passed after implementation.

## Unexpected Failures

- None remaining.

## Production Code Changes

- Shared calendar navigation presentation and UI locale labels only. No backend, persistence, or external service changes.

## Final Repository State

- Scoped git status has 151 paths. 150 predated this task; the only new path is this Activity Report. Existing calendar and documentation paths listed above were refined in this task.

## Acceptance Criteria

| Criterion | Result | Evidence |
|---|---|---|
| 1 | PASS | Month and year are separate clickable calendar header controls. |
| 2 | PASS | Twelve-month picker and twelve-year pages with exact-year input work in single-date and range fields. |
| 3 | PASS | Draft range, supported years, min/max bounds, and invalid input behavior have focused tests. |
| 4 | PASS | Mobile browser checks keep both selector views within the viewport. |
| 5 | PASS | UI tests, target UI guardrail, Svelte check, and build exit 0. |

## Open Issues

- Human visual approval of the broader U1.2 showcase remains pending under its existing review process.

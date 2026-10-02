# Activity Report: CALENDAR-TRIGGER-ICON-ALIGNMENT

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-1225-CALENDAR-TRIGGER-ICON-ALIGNMENT.md
- Created At: 2026-10-02T08:55:29.692Z
- Status: COMPLETE

## Purpose and Scope

- Correct the calendar icon alignment reported in the RTL date field screenshot.
- Keep date text at the inline start and the decorative icon at the opposite edge in both RTL and LTR.

## Governing Sources

- `AGENTS.md`, `packages/calendar-svelte/AGENTS.md`, and `apps/web/AGENTS.md`.
- `docs/architecture/00-manifest.md`, `01-system-architecture.md`, `02-engineering-conventions.md`, and `08-deployment-architecture.md`.
- `docs/ui/03-target-ui-architecture.md` and `05-ui-guardrails-and-testing.md`.

## Initial Repository State

- Initial scoped git status had 154 paths from previous UI foundation tasks. They are pre-existing and not claimed as work here.

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
- `docs/reports/20261002-1205-CALENDAR-QUICK-NAVIGATION.md`
- `docs/reports/20261002-1213-CALENDAR-SELECTOR-DISMISSAL.md`
- `docs/reports/20261002-1220-CALENDAR-YEAR-PICKER-POLISH.md`
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
- `packages/calendar-svelte/src/dismiss.ts`
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

- `docs/reports/20261002-1225-CALENDAR-TRIGGER-ICON-ALIGNMENT.md`

## Files Modified

- `packages/calendar-svelte/src/picker.css`

## Files Deleted

- None.

## Implementation Summary

- Strengthened the shared calendar trigger selector against general `.form-control` cascade rules and explicitly kept a single flex row.
- Applied logical `margin-inline-start:auto` to the icon so it is at the opposite edge in either direction, while long date/range text truncates without moving it.
- Both DateInput and DateRangeInput use the shared trigger class; no calendar semantics changed.

## Architecture Decisions / Deviations

- This is a shared Calendar Svelte CSS fix. No calendar arithmetic, public value contract, or governing UI behavior changed.
- A fresh preview already had correct geometry; a competing stylesheet or stale development CSS is an inference from the supplied screenshot, not a directly observed cause in the user's running page. The stronger selector makes the intended layout explicit.

## Tests and Verification

- Headless Chrome on a fresh preview: Persian RTL date text at the right edge and icon at the left edge; English LTR text at the left edge and icon at the right edge. Computed button display remained flex in both modes.
- `npm run test:ui`: PASS, 80 tests across 12 files, exit 0.
- `npm run check:web`: PASS, 0 errors and 0 warnings, exit 0.
- `npm run test:architecture:target-ui`: PASS, 0 violations and 0 infrastructure failures, exit 0.
- `npm run build:web`: PASS with Vite 8.3.2 and adapter-node, exit 0.

## Expected Failures

- None.

## Unexpected Failures

- None remaining in the fresh preview.

## Production Code Changes

- Shared calendar trigger CSS only. No backend, persistence, or external service changes.

## Final Repository State

- Scoped git status has 155 paths. 154 paths predated this task; the only new path is this Activity Report.

## Acceptance Criteria

| Criterion | Result | Evidence |
|---|---|---|
| 1 | PASS | RTL text and icon occupy opposite edges in browser geometry. |
| 2 | PASS | LTR text and icon occupy opposite edges in browser geometry. |
| 3 | PASS | UI tests, Svelte check, architecture guardrail, and build exit 0. |

## Open Issues

- If the user's already-running dev server continues serving old CSS, it must be restarted to load this change.

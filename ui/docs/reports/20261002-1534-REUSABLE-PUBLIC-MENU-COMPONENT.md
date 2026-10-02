# Activity Report: REUSABLE-PUBLIC-MENU-COMPONENT

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-1534-REUSABLE-PUBLIC-MENU-COMPONENT.md
- Created At: 2026-10-02T12:04:45.076Z
- Status: COMPLETE

## Purpose and Scope

Confirm that numeric input and public navigation use reusable UI primitives. Move generic menu presentation and dismissal from Web layout to UI Core while retaining route-specific public links in Web composition.

## Governing Sources

AGENTS.md, apps/web/AGENTS.md, packages/ui-core/AGENTS.md, architecture 00-manifest/02-engineering-conventions, docs/ui/03-target-ui-architecture.md and 08-public-tools-migration.md; UI Core public exports and Web shell tests.

## Initial Repository State

Shared NumberInput and numeric draft parser already lived in packages/ui-core and were used by Summarizer, FAQ range, and the foundation showcase. The Other services menu behavior and styling lived directly in apps/web root layout and shared stylesheet. Initial uncommitted workspace paths were captured by report:start.

## Pre-existing Workspace Changes

The following paths were already modified or untracked before this task and were not edited by it. Files Modified also had pre-existing changes that this task preserved.

- `.gitignore`
- `apps/web/src/lib/api/client.ts`
- `apps/web/src/lib/api/transport.ts`
- `apps/web/src/lib/server/bootstrap.ts`
- `apps/web/src/lib/streaming/parser.ts`
- `apps/web/src/lib/streaming/transport.ts`
- `apps/web/src/routes/(public)/+layout.svelte`
- `apps/web/src/routes/(public)/+page.svelte`
- `apps/web/src/routes/+layout.server.ts`
- `apps/web/tests/u13-calendar-overlay.test.ts`
- `docker/bootstrap.mysql.sql`
- `docker/docker-compose.yml`
- `docs/ui/07-u1.2-showcase-and-development.md`
- `package.json`
- `packages/calendar-svelte/src/CalendarMonth.svelte`
- `packages/calendar-svelte/src/DateInput.svelte`
- `packages/calendar-svelte/src/picker.css`
- `packages/ui-core/src/forms/NumberInput.svelte`
- `packages/ui-core/src/forms/Textarea.svelte`
- `packages/ui-core/src/forms/numeric.ts`
- `apps/web/src/lib/api/publicTools.ts`
- `apps/web/src/lib/public-tools/TextTool.svelte`
- `apps/web/src/lib/public-tools/messages.ts`
- `apps/web/src/routes/(public)/faq.html/+page.server.ts`
- `apps/web/src/routes/(public)/faq/+page.svelte`
- `apps/web/src/routes/(public)/summarize.html/+page.server.ts`
- `apps/web/src/routes/(public)/summarize/+page.svelte`
- `apps/web/src/routes/(public)/translate.html/+page.server.ts`
- `apps/web/src/routes/(public)/translate/+page.svelte`
- `apps/web/static/brand/targoman-logo-dark.png`
- `apps/web/static/brand/targoman-logo-light.png`
- `apps/web/tests/public-tools/components.test.ts`
- `apps/web/tests/public-tools/contracts.test.ts`
- `docs/prompts/U2.1.md`
- `docs/prompts/U2.md`
- `docs/reports/20261002-1240-CALENDAR-EMPTY-TODAY-SHORTCUT.md`
- `docs/reports/20261002-1246-PUBLIC-AI-TOOLS-U2.md`
- `docs/reports/20261002-1343-PUBLIC-AI-TOOLS-LIVE-PARITY.md`
- `docs/reports/20261002-1438-PUBLIC-AI-TOOLS-LIVE-PARITY-CONTINUATION.md`
- `docs/reports/20261002-1513-PUBLIC-TOOLS-MENU-STREAM-REPAIR.md`
- `docs/reports/20261002-1521-PUBLIC-SERVICES-MENU-SELECTION.md`
- `docs/reports/20261002-1524-SHARED-NUMERIC-INPUT-VALIDATION.md`
- `docs/reports/20261002-1529-IRANSANSX-UI-FONT-REPAIR.md`
- `docs/ui/visual-baselines/u2/legacy-live-summarizer.png`
- `docs/ui/visual-baselines/u2/legacy-live-translator.png`
- `docs/ui/visual-baselines/u2/live/u21-legacy-faq.png`
- `docs/ui/visual-baselines/u2/live/u21-legacy-summarizer.png`
- `docs/ui/visual-baselines/u2/live/u21-legacy-translator.png`
- `docs/ui/visual-baselines/u2/live/u21-target-faq-dark-live.png`
- `docs/ui/visual-baselines/u2/live/u21-target-faq-en-live.png`
- `docs/ui/visual-baselines/u2/live/u21-target-faq-error-live.png`
- `docs/ui/visual-baselines/u2/live/u21-target-faq-loading-live.png`
- `docs/ui/visual-baselines/u2/live/u21-target-faq-mobile-live.png`
- `docs/ui/visual-baselines/u2/live/u21-target-faq.png`
- `docs/ui/visual-baselines/u2/live/u21-target-summarizer-dark-live.png`
- `docs/ui/visual-baselines/u2/live/u21-target-summarizer-en-live.png`
- `docs/ui/visual-baselines/u2/live/u21-target-summarizer-error-live.png`
- `docs/ui/visual-baselines/u2/live/u21-target-summarizer-loading-live.png`
- `docs/ui/visual-baselines/u2/live/u21-target-summarizer-mobile-live.png`
- `docs/ui/visual-baselines/u2/live/u21-target-summarizer.png`
- `docs/ui/visual-baselines/u2/live/u21-target-translator-dark-live.png`
- `docs/ui/visual-baselines/u2/live/u21-target-translator-en-live.png`
- `docs/ui/visual-baselines/u2/live/u21-target-translator-error-live.png`
- `docs/ui/visual-baselines/u2/live/u21-target-translator-loading-live.png`
- `docs/ui/visual-baselines/u2/live/u21-target-translator-mobile-live.png`
- `docs/ui/visual-baselines/u2/live/u21-target-translator.png`
- `docs/ui/visual-baselines/u2/u2-faq-en-dark.png`
- `docs/ui/visual-baselines/u2/u2-faq-error.png`
- `docs/ui/visual-baselines/u2/u2-faq-fa-mobile.png`
- `docs/ui/visual-baselines/u2/u2-faq-loading.png`
- `docs/ui/visual-baselines/u2/u2-faq-success.png`
- `docs/ui/visual-baselines/u2/u2-review-faq-dark.png`
- `docs/ui/visual-baselines/u2/u2-review-faq-light.png`
- `docs/ui/visual-baselines/u2/u2-review-summarize-dark.png`
- `docs/ui/visual-baselines/u2/u2-review-summarize-light.png`
- `docs/ui/visual-baselines/u2/u2-review-translate-dark.png`
- `docs/ui/visual-baselines/u2/u2-review-translate-light.png`
- `docs/ui/visual-baselines/u2/u2-summarize-error.png`
- `docs/ui/visual-baselines/u2/u2-summarize-loading.png`
- `docs/ui/visual-baselines/u2/u2-summarize-success.png`
- `docs/ui/visual-baselines/u2/u2-summarizer-fa-dark.png`
- `docs/ui/visual-baselines/u2/u2-translate-error.png`
- `docs/ui/visual-baselines/u2/u2-translate-loading.png`
- `docs/ui/visual-baselines/u2/u2-translate-success.png`
- `docs/ui/visual-baselines/u2/u2-translator-en-mobile.png`
- `docs/ui/visual-baselines/u2/u2-translator-fa-light.png`
- `scripts/public-tools-cancel-live.mjs`
- `scripts/public-tools-legacy-seed.mjs`
- `scripts/public-tools-live-smoke.mjs`
- `scripts/public-tools-pdf-worker.mjs`
- `scripts/public-tools-runtime-check.mjs`

## Files Added

- `packages/ui-core/src/navigation/DropdownMenu.svelte`
- `apps/web/tests/MenuFixture.svelte`
- `docs/reports/20261002-1534-REUSABLE-PUBLIC-MENU-COMPONENT.md`

## Files Modified

- `packages/ui-core/src/index.ts`
- `apps/web/src/routes/+layout.svelte`
- `apps/web/src/lib/styles/main.scss`
- `apps/web/tests/components.test.ts`
- `docs/ui/03-target-ui-architecture.md`
- `docs/ui/08-public-tools-migration.md`

## Files Deleted

None.

## Implementation Summary

- Added UI Core DropdownMenu with caller-supplied trigger/content snippets and optional trigger classes. Native details/summary provides the semantic control. The component owns panel styling, outside click, Escape/focus restore, link/button activation and select-change dismissal.
- Web layout now composes the same public routes and locale selector inside that reusable menu; route knowledge remains in Web. Removed the Web-only menu handlers and styles.
- Added a route-free test fixture and component test that exercises generic dismissal behavior. Updated UI architecture and U2 migration documentation.

## Architecture Decisions / Deviations

UI Core owns only generic interaction and design mechanics. Public route labels, URLs and locale action stay in Web shell. NumberInput and numeric normalization remain shared UI Core exports; no Summarizer-only numeric component was introduced. No backend or route ownership changed.

## Tests and Verification

- PASS: red-first generic menu test failed before export/implementation and passed afterward.
- PASS: UI Core fixture test covers outside click, Escape with focus restoration, link selection, explicit button selection and select change.
- PASS: Chrome on active Web port 5173: navigating from Translator to Summarizer closes menu; selecting current Summarizer closes menu.
- PASS: check:web 0 errors/warnings, test:ui 14 files/100 tests, build:web, target UI architecture 0 violations/0 infrastructure failures, git diff --check.

## Expected Failures

Red-first component test failed before DropdownMenu existed, as intended.

## Unexpected Failures

None.

## Production Code Changes

A reusable menu was added to UI Core and composed in Web shell. The shared NumberInput required no change in this task.

## Final Repository State

The public Web menu uses the UI Core primitive and still works on the active development server. The pre-existing U2 visual-approval and production cutover gates remain pending.

## Acceptance Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| 1 | PASS | Numeric input is a shared UI Core component used in Summarizer, FAQ and showcase |
| 2 | PASS | Menu behavior and styles are exported as reusable UI Core DropdownMenu |
| 3 | PASS | Public route content remains Web-owned; browser navigation behavior preserved |
| 4 | PASS | Generic interaction fixture and 100 UI tests passed |
| 5 | PASS | Web check/build, architecture, diff and report verification passed |

## Open Issues

Human visual approval for U2 and production cutover remain separate pending work.

---

Generated by scripts/activity-report.ts

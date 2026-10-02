# Activity Report: SHARED-FILE-DROP-INPUT

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-1541-SHARED-FILE-DROP-INPUT.md
- Created At: 2026-10-02T12:11:40.048Z
- Status: COMPLETE

## Purpose and Scope

Give Translator and Summarizer a visible file drop affordance directly over their text inputs, using one reusable UI Core file picker/drop component shared with FAQ. Preserve each tool's existing extraction and inspection contract.

## Governing Sources

AGENTS.md, apps/web/AGENTS.md, packages/ui-core/AGENTS.md, docs/architecture/00-manifest.md and 02-engineering-conventions.md, docs/ui/03-target-ui-architecture.md and 08-public-tools-migration.md; current public tool components, API adapter and component tests.

## Initial Repository State

Translator and Summarizer shared TextTool with a traditional hidden native file input inside a button. FAQ had a custom drop button and a separate hidden file input. U2/U2.1 and later UI work were uncommitted at task start; the exact initial status is captured below.

## Pre-existing Workspace Changes

All paths listed below were present in the initial status before this task. Some are also listed under Files Modified because this task extended their existing uncommitted changes. Other workspace changes were preserved.

- `.gitignore`
- `apps/web/src/lib/api/client.ts`
- `apps/web/src/lib/api/transport.ts`
- `apps/web/src/lib/server/bootstrap.ts`
- `apps/web/src/lib/streaming/parser.ts`
- `apps/web/src/lib/streaming/transport.ts`
- `apps/web/src/lib/styles/main.scss`
- `apps/web/src/routes/(public)/+layout.svelte`
- `apps/web/src/routes/(public)/+page.svelte`
- `apps/web/src/routes/+layout.server.ts`
- `apps/web/src/routes/+layout.svelte`
- `apps/web/tests/components.test.ts`
- `apps/web/tests/u13-calendar-overlay.test.ts`
- `docker/bootstrap.mysql.sql`
- `docker/docker-compose.yml`
- `docs/ui/03-target-ui-architecture.md`
- `docs/ui/07-u1.2-showcase-and-development.md`
- `package.json`
- `packages/calendar-svelte/src/CalendarMonth.svelte`
- `packages/calendar-svelte/src/DateInput.svelte`
- `packages/calendar-svelte/src/picker.css`
- `packages/ui-core/src/forms/NumberInput.svelte`
- `packages/ui-core/src/forms/Textarea.svelte`
- `packages/ui-core/src/forms/numeric.ts`
- `packages/ui-core/src/index.ts`
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
- `apps/web/tests/MenuFixture.svelte`
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
- `docs/reports/20261002-1534-REUSABLE-PUBLIC-MENU-COMPONENT.md`
- `docs/ui/08-public-tools-migration.md`
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
- `packages/ui-core/src/navigation/DropdownMenu.svelte`
- `scripts/public-tools-cancel-live.mjs`
- `scripts/public-tools-legacy-seed.mjs`
- `scripts/public-tools-live-smoke.mjs`
- `scripts/public-tools-pdf-worker.mjs`
- `scripts/public-tools-runtime-check.mjs`

## Files Added

- `packages/ui-core/src/forms/FileDropInput.svelte`
- `docs/reports/20261002-1541-SHARED-FILE-DROP-INPUT.md`

## Files Modified

- `packages/ui-core/src/index.ts`
- `apps/web/src/lib/public-tools/TextTool.svelte`
- `apps/web/src/lib/public-tools/messages.ts`
- `apps/web/src/routes/(public)/faq/+page.svelte`
- `apps/web/tests/public-tools/components.test.ts`
- `docs/ui/03-target-ui-architecture.md`
- `docs/ui/08-public-tools-migration.md`

## Files Deleted

None.

## Implementation Summary

- Added generic `FileDropInput` in UI Core, with panel and text-field variants, a keyboard-accessible chooser, drag feedback, disabled behavior, accepted-type hint and caller-owned file callback.
- Wrapped the Translator and Summarizer text areas so dropping a file anywhere over the text field follows their existing extraction path; added localized drop guidance and supported formats.
- Replaced FAQ's custom drop handlers and picker with the same shared component while retaining FAQ inspection behavior. Removed obsolete page-local drop styles.
- Updated UI architecture and U2 migration documentation to identify the shared owner.

## Architecture Decisions / Deviations

UI Core owns only generic file selection, drag interaction and presentation. Web tool pages retain extension checks, text limits, file extraction/FAQ inspection, errors and API contract ownership. No backend, schema, legacy frontend or production ingress was changed. The component has no upload/network behavior of its own.

## Tests and Verification

- PASS: `check:web` reported 0 errors and 0 warnings.
- PASS: focused public-tools component tests: 8/8, covering TXT drop on both text fields, invalid drop, PDF drop through `/api/file2Text?maxChars=3000`, FAQ drop/inspect and existing behaviors.
- PASS: full `test:ui`: 14 files, 105 tests.
- PASS: `build:web`, `test:architecture:target-ui` (0 violations, 0 infrastructure failures), `git diff --check`.
- PASS: headless Chrome on local Web port 5174: actual browser `File` drag events populated Translator and Summarizer text fields; all three pages rendered a chooser; desktop screenshots inspected locally under `/tmp/vadja-drop-{translate,summarize,faq}.png`.

## Expected Failures

None.

## Unexpected Failures

Port 5173 was occupied, so the browser check used port 5174. The first headless browser check raced client hydration; a rerun passed for all three routes. An initial test mock signature caused a TypeScript tuple diagnostic and was corrected. No remaining failing verification.

## Production Code Changes

UI Core gained one shared file input/drop presentation component. The three public tools now compose it. Existing backend file endpoint paths, payloads and file limits are unchanged.

## Final Repository State

- Initial git-status capture recorded below.

```text
 M ui/.gitignore
 M ui/apps/web/src/lib/api/client.ts
 M ui/apps/web/src/lib/api/transport.ts
 M ui/apps/web/src/lib/server/bootstrap.ts
 M ui/apps/web/src/lib/streaming/parser.ts
 M ui/apps/web/src/lib/streaming/transport.ts
 M ui/apps/web/src/lib/styles/main.scss
 M ui/apps/web/src/routes/(public)/+layout.svelte
 M ui/apps/web/src/routes/(public)/+page.svelte
 M ui/apps/web/src/routes/+layout.server.ts
 M ui/apps/web/src/routes/+layout.svelte
 M ui/apps/web/tests/components.test.ts
 M ui/apps/web/tests/u13-calendar-overlay.test.ts
 M ui/docker/bootstrap.mysql.sql
 M ui/docker/docker-compose.yml
 M ui/docs/ui/03-target-ui-architecture.md
 M ui/docs/ui/07-u1.2-showcase-and-development.md
 M ui/package.json
 M ui/packages/calendar-svelte/src/CalendarMonth.svelte
 M ui/packages/calendar-svelte/src/DateInput.svelte
 M ui/packages/calendar-svelte/src/picker.css
 M ui/packages/ui-core/src/forms/NumberInput.svelte
 M ui/packages/ui-core/src/forms/Textarea.svelte
 M ui/packages/ui-core/src/forms/numeric.ts
 M ui/packages/ui-core/src/index.ts
?? ui/apps/web/src/lib/api/publicTools.ts
?? ui/apps/web/src/lib/public-tools/TextTool.svelte
?? ui/apps/web/src/lib/public-tools/messages.ts
?? ui/apps/web/src/routes/(public)/faq.html/+page.server.ts
?? ui/apps/web/src/routes/(public)/faq/+page.svelte
?? ui/apps/web/src/routes/(public)/summarize.html/+page.server.ts
?? ui/apps/web/src/routes/(public)/summarize/+page.svelte
?? ui/apps/web/src/routes/(public)/translate.html/+page.server.ts
?? ui/apps/web/src/routes/(public)/translate/+page.svelte
?? ui/apps/web/static/brand/targoman-logo-dark.png
?? ui/apps/web/static/brand/targoman-logo-light.png
?? ui/apps/web/tests/MenuFixture.svelte
?? ui/apps/web/tests/public-tools/components.test.ts
?? ui/apps/web/tests/public-tools/contracts.test.ts
?? ui/docs/prompts/U2.1.md
?? ui/docs/prompts/U2.md
?? ui/docs/reports/20261002-1240-CALENDAR-EMPTY-TODAY-SHORTCUT.md
?? ui/docs/reports/20261002-1246-PUBLIC-AI-TOOLS-U2.md
?? ui/docs/reports/20261002-1343-PUBLIC-AI-TOOLS-LIVE-PARITY.md
?? ui/docs/reports/20261002-1438-PUBLIC-AI-TOOLS-LIVE-PARITY-CONTINUATION.md
?? ui/docs/reports/20261002-1513-PUBLIC-TOOLS-MENU-STREAM-REPAIR.md
?? ui/docs/reports/20261002-1521-PUBLIC-SERVICES-MENU-SELECTION.md
?? ui/docs/reports/20261002-1524-SHARED-NUMERIC-INPUT-VALIDATION.md
?? ui/docs/reports/20261002-1529-IRANSANSX-UI-FONT-REPAIR.md
?? ui/docs/reports/20261002-1534-REUSABLE-PUBLIC-MENU-COMPONENT.md
?? ui/docs/ui/08-public-tools-migration.md
?? ui/docs/ui/visual-baselines/u2/legacy-live-summarizer.png
?? ui/docs/ui/visual-baselines/u2/legacy-live-translator.png
?? ui/docs/ui/visual-baselines/u2/live/u21-legacy-faq.png
?? ui/docs/ui/visual-baselines/u2/live/u21-legacy-summarizer.png
?? ui/docs/ui/visual-baselines/u2/live/u21-legacy-translator.png
?? ui/docs/ui/visual-baselines/u2/live/u21-target-faq-dark-live.png
?? ui/docs/ui/visual-baselines/u2/live/u21-target-faq-en-live.png
?? ui/docs/ui/visual-baselines/u2/live/u21-target-faq-error-live.png
?? ui/docs/ui/visual-baselines/u2/live/u21-target-faq-loading-live.png
?? ui/docs/ui/visual-baselines/u2/live/u21-target-faq-mobile-live.png
?? ui/docs/ui/visual-baselines/u2/live/u21-target-faq.png
?? ui/docs/ui/visual-baselines/u2/live/u21-target-summarizer-dark-live.png
?? ui/docs/ui/visual-baselines/u2/live/u21-target-summarizer-en-live.png
?? ui/docs/ui/visual-baselines/u2/live/u21-target-summarizer-error-live.png
?? ui/docs/ui/visual-baselines/u2/live/u21-target-summarizer-loading-live.png
?? ui/docs/ui/visual-baselines/u2/live/u21-target-summarizer-mobile-live.png
?? ui/docs/ui/visual-baselines/u2/live/u21-target-summarizer.png
?? ui/docs/ui/visual-baselines/u2/live/u21-target-translator-dark-live.png
?? ui/docs/ui/visual-baselines/u2/live/u21-target-translator-en-live.png
?? ui/docs/ui/visual-baselines/u2/live/u21-target-translator-error-live.png
?? ui/docs/ui/visual-baselines/u2/live/u21-target-translator-loading-live.png
?? ui/docs/ui/visual-baselines/u2/live/u21-target-translator-mobile-live.png
?? ui/docs/ui/visual-baselines/u2/live/u21-target-translator.png
?? ui/docs/ui/visual-baselines/u2/u2-faq-en-dark.png
?? ui/docs/ui/visual-baselines/u2/u2-faq-error.png
?? ui/docs/ui/visual-baselines/u2/u2-faq-fa-mobile.png
?? ui/docs/ui/visual-baselines/u2/u2-faq-loading.png
?? ui/docs/ui/visual-baselines/u2/u2-faq-success.png
?? ui/docs/ui/visual-baselines/u2/u2-review-faq-dark.png
?? ui/docs/ui/visual-baselines/u2/u2-review-faq-light.png
?? ui/docs/ui/visual-baselines/u2/u2-review-summarize-dark.png
?? ui/docs/ui/visual-baselines/u2/u2-review-summarize-light.png
?? ui/docs/ui/visual-baselines/u2/u2-review-translate-dark.png
?? ui/docs/ui/visual-baselines/u2/u2-review-translate-light.png
?? ui/docs/ui/visual-baselines/u2/u2-summarize-error.png
?? ui/docs/ui/visual-baselines/u2/u2-summarize-loading.png
?? ui/docs/ui/visual-baselines/u2/u2-summarize-success.png
?? ui/docs/ui/visual-baselines/u2/u2-summarizer-fa-dark.png
?? ui/docs/ui/visual-baselines/u2/u2-translate-error.png
?? ui/docs/ui/visual-baselines/u2/u2-translate-loading.png
?? ui/docs/ui/visual-baselines/u2/u2-translate-success.png
?? ui/docs/ui/visual-baselines/u2/u2-translator-en-mobile.png
?? ui/docs/ui/visual-baselines/u2/u2-translator-fa-light.png
?? ui/packages/ui-core/src/navigation/DropdownMenu.svelte
?? ui/scripts/public-tools-cancel-live.mjs
?? ui/scripts/public-tools-legacy-seed.mjs
?? ui/scripts/public-tools-live-smoke.mjs
?? ui/scripts/public-tools-pdf-worker.mjs
?? ui/scripts/public-tools-runtime-check.mjs
```

## Acceptance Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| 1 | PASS | Translator and Summarizer accept a file dropped on the text field; focused tests and Chrome check. |
| 2 | PASS | File chooser remains available and FAQ uses the same generic component; FAQ chooser/drop tests. |
| 3 | PASS | Existing PDF extraction endpoint and FAQ inspect flow remain in use; focused tests. |
| 4 | PASS | Type check, full UI suite, production build and target UI guardrails pass. |
| 5 | PASS | Activity Report finalized and verified by repository workflow. |

## Open Issues

Human visual acceptance for the broader U2 migration remains pending; this change does not authorize route cutover or legacy frontend removal.

---

Generated by scripts/activity-report.ts

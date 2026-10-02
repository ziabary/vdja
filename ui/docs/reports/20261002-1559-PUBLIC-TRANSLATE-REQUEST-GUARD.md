# Activity Report: PUBLIC-TRANSLATE-REQUEST-GUARD

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-1559-PUBLIC-TRANSLATE-REQUEST-GUARD.md
- Created At: 2026-10-02T12:29:45.916Z
- Status: COMPLETE

## Purpose and Scope

Stop repeated automatic Translator API requests after a failure, restore the available local Express API for the active Web proxy, and remove the unwanted compact file button from an editing text field.

## Governing Sources

AGENTS.md, apps/web/AGENTS.md, packages/ui-core/AGENTS.md, docs/architecture/00-manifest.md and 02-engineering-conventions.md, docs/ui/03-target-ui-architecture.md and 08-public-tools-migration.md; frozen public-tools API contracts and current UI tests.

## Initial Repository State

Web development server responded on port 5173 and proxied `/api` to port 3000. Express was not listening on port 3000, so Translator calls failed while MySQL (19 migrations) and the configured model service were ready. Translator scheduled an automatic submit after each two-second typing pause without suppressing subsequent automatic requests after a failure. The field variant also displayed a compact file button inside typed text. Initial uncommitted status is captured below.

## Pre-existing Workspace Changes

The following paths were already modified or untracked before this task. Files Modified were extended in place; other changes were preserved.

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
- `docs/reports/20261002-1541-SHARED-FILE-DROP-INPUT.md`
- `docs/reports/20261002-1550-VISIBLE-TEXT-FILE-DROP.md`
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
- `packages/ui-core/src/forms/FileDropInput.svelte`
- `packages/ui-core/src/navigation/DropdownMenu.svelte`
- `scripts/public-tools-cancel-live.mjs`
- `scripts/public-tools-legacy-seed.mjs`
- `scripts/public-tools-live-smoke.mjs`
- `scripts/public-tools-pdf-worker.mjs`
- `scripts/public-tools-runtime-check.mjs`

## Files Added

- `docs/reports/20261002-1559-PUBLIC-TRANSLATE-REQUEST-GUARD.md`

## Files Modified

- `packages/ui-core/src/forms/FileDropInput.svelte`
- `apps/web/src/lib/public-tools/TextTool.svelte`
- `apps/web/tests/public-tools/components.test.ts`
- `docs/ui/08-public-tools-migration.md`

## Files Deleted

None.

## Implementation Summary

- Removed the compact file button shown inside the text field after focus; the centered empty-state file card remains and file drop works over the full editor.
- Translator now pauses automatic two-second submissions after a failed request until a successful explicit retry/manual request or reset. A consumed `q` query is removed before its initial request to avoid repeating a failed query on refresh. Network TypeErrors use the localized connection message.
- Started existing Express with `dev:api` using the user-provided MySQL and vLLM services. No new database/container, backend model-selection change or API contract change.

## Architecture Decisions / Deviations

UI Core continues to own only generic file-input presentation; Web tool composition owns Translator request initiation. Express remains frozen. Automatic submit is retained for parity during healthy operation but bounded after failure; explicit user retry remains available.

## Tests and Verification

- PASS: `dev:public-tools:runtime:check`: 19 existing MySQL migrations and configured translate/summarize model present; `/v1/models` HTTP 200.
- PASS: existing Express started and listened on port 3000. A direct `POST /api/translate` returned HTTP 200 with `[DONE:]`; the same request through Web port 5173 proxy returned HTTP 200 with `[DONE:]`. The initial issue reproduced as port 3000 unavailable before startup.
- PASS: focused public-tools tests 10/10, including offline network error, suppression across later edits, explicit retry recovery and removal of the compact button.
- PASS: full `test:ui`: 14 files, 107 tests; `check:web` 0 errors/warnings; `build:web`; `test:architecture:target-ui` 0 violations/0 infrastructure failures; `git diff --check`.
- PASS: headless Chrome on active Web port 5173 in dark mode: Translator and Summarizer center card hover works; clicking textarea removes card and leaves no in-field button; TXT drop still fills the editor.

## Expected Failures

None.

## Unexpected Failures

The first focused run exposed test expectations for the removed button and an async flush gap in the new retry test; both test defects were corrected. Final focused and full suites passed.

## Production Code Changes

Web Translator gained a bounded automatic-submit policy and clearer offline error. UI Core removed the compact file button while preserving the centered chooser and drop interaction. No backend source changed.

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
?? ui/docs/reports/20261002-1541-SHARED-FILE-DROP-INPUT.md
?? ui/docs/reports/20261002-1550-VISIBLE-TEXT-FILE-DROP.md
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
?? ui/packages/ui-core/src/forms/FileDropInput.svelte
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
| 1 | PASS | Existing API readiness restored on port 3000; direct and proxy translation both returned HTTP 200 with a terminal marker. |
| 2 | PASS | Failed automatic translation pauses later automatic calls until explicit successful action or reset; focused component test. |
| 3 | PASS | Extra file button disappears during text entry; browser and component checks. |
| 4 | PASS | Center chooser and drag/drop remain functional; browser and component checks. |
| 5 | PASS | Full UI tests, Web check/build and architecture gate pass. |
| 6 | PASS | Activity Report finalized and verified. |

## Open Issues

The running Express process is a local development session; it must be started again after a development-environment restart using `npm run dev:api`. Broader U2 human visual acceptance and route cutover remain separate gates.

---

Generated by scripts/activity-report.ts

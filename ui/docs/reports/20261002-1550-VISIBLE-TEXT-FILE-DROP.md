# Activity Report: VISIBLE-TEXT-FILE-DROP

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-1550-VISIBLE-TEXT-FILE-DROP.md
- Created At: 2026-10-02T12:20:47.260Z
- Status: COMPLETE

## Purpose and Scope

Make the Translator and Summarizer combined text/file input visually clear, following the reviewer's FAQ drop-card reference and precise click/focus behavior.

## Governing Sources

AGENTS.md, apps/web/AGENTS.md, packages/ui-core/AGENTS.md, docs/architecture/00-manifest.md and 02-engineering-conventions.md, docs/ui/03-target-ui-architecture.md and 08-public-tools-migration.md; existing shared FileDropInput and public-tool tests.

## Initial Repository State

The previous task added working file drop over Translator and Summarizer text fields through UI Core FileDropInput. Its field variant showed only guidance and a traditional button below the textarea, which was visually unclear. The initial uncommitted status is captured below.

## Pre-existing Workspace Changes

The following paths were already modified or untracked before this task; paths also named under Files Modified were extended in place. Other workspace changes were preserved.

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

- `docs/reports/20261002-1550-VISIBLE-TEXT-FILE-DROP.md`

## Files Modified

- `packages/ui-core/src/forms/FileDropInput.svelte`
- `apps/web/src/lib/public-tools/TextTool.svelte`
- `apps/web/tests/public-tools/components.test.ts`
- `docs/ui/08-public-tools-migration.md`

## Files Deleted

None.

## Implementation Summary

- Field variant now places a centered dashed file card with cloud icon inside an empty, unfocused textarea. The card opens the file chooser by click or keyboard activation and has explicit hover/focus styling.
- Focusing the rest of the textarea hides the card and restores the normal editing background. A compact file chooser remains inside the editor during entry, and file drop continues to work over the whole field.
- FAQ continues to use the shared panel variant. Added focused interaction coverage and documented the text-field behavior.

## Architecture Decisions / Deviations

The generic UI Core component owns presentation and interaction state only. TextTool supplies whether source text exists and retains validation/extraction; FAQ remains a separate composition of the same component. No backend, route, API contract, schema or legacy frontend changed.

## Tests and Verification

- PASS: `check:web` reported 0 errors and 0 warnings.
- PASS: focused public-tools component suite: 9/9; central card opens chooser, textarea focus removes card, compact chooser persists, existing drop and FAQ flows pass.
- PASS: full `test:ui`: 14 files, 106 tests.
- PASS: `build:web`, `test:architecture:target-ui` (0 violations, 0 infrastructure failures), `git diff --check`.
- PASS: headless Chrome at local Web port 5174 in dark mode on both Translator and Summarizer: centered card visible, hover border changed from `rgb(73, 80, 87)` to `rgb(13, 110, 253)`, focusing textarea hid card and showed compact chooser, dropping TXT inserted `Browser dropped text`. Initial-state screenshots inspected locally at `/tmp/vadja-center-{translate,summarize}.png`.

## Expected Failures

None.

## Unexpected Failures

First browser script toggled the persisted theme twice and misclassified Summarizer as a UI failure. The script was corrected to set dark mode only when needed, and both routes passed. No remaining failing verification.

## Production Code Changes

The shared file input field variant now has a centered chooser and editing state, with persistent compact file choice after text focus. No service or backend code changed.

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
| 1 | PASS | Empty Translator and Summarizer editors show a central dashed file card in the text area; dark Chrome screenshots. |
| 2 | PASS | Central card opens native file picker and has hover/focus styling; component test and browser computed hover border. |
| 3 | PASS | Clicking the rest of the textarea hides the card, enables text entry and keeps a compact file chooser; component and Chrome checks. |
| 4 | PASS | File drop remains active across the editor; TXT drop browser check and focused tests. |
| 5 | PASS | Full UI suite, Web build, type check and target UI architecture gate pass. |
| 6 | PASS | Activity Report finalized and verified by repository workflow. |

## Open Issues

Human visual acceptance for the broader U2 migration remains pending; this UI change does not authorize route cutover or legacy frontend removal.

---

Generated by scripts/activity-report.ts

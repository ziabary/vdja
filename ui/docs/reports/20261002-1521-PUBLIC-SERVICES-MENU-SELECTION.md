# Activity Report: PUBLIC-SERVICES-MENU-SELECTION

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-1521-PUBLIC-SERVICES-MENU-SELECTION.md
- Created At: 2026-10-02T11:51:12.863Z
- Status: COMPLETE

## Purpose and Scope

Close the public Other services menu when any service link is selected, including a link to the current page. Preserve navigation and keyboard behavior.

## Governing Sources

- AGENTS.md
- docs/architecture/00-manifest.md
- docs/architecture/01-system-architecture.md
- docs/architecture/02-engineering-conventions.md
- docs/architecture/03-persistence-and-database.md
- docs/architecture/04-authorization-model.md
- docs/architecture/05-module-architecture.md
- docs/architecture/06-document-and-rag.md
- docs/architecture/07-ai-router.md
- docs/architecture/08-deployment-architecture.md
- docs/architecture/09-notification-and-ticketing.md
- docs/architecture/10-commercial-architecture.md

## Initial Repository State

The Svelte development server was already running on port 5173. The previous U2 work and other workspace changes were uncommitted; report:start captured them before this edit.

## Pre-existing Workspace Changes

The paths below were already modified or untracked and were not edited for this task. The layout file was also pre-existing and is listed under Files Modified because this task edited it.

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
- `apps/web/tests/u13-calendar-overlay.test.ts`
- `docker/bootstrap.mysql.sql`
- `docker/docker-compose.yml`
- `docs/ui/07-u1.2-showcase-and-development.md`
- `package.json`
- `packages/calendar-svelte/src/DateInput.svelte`
- `packages/calendar-svelte/src/picker.css`
- `packages/ui-core/src/forms/Textarea.svelte`
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
- `scripts/public-tools-cancel-live.mjs`
- `scripts/public-tools-legacy-seed.mjs`
- `scripts/public-tools-live-smoke.mjs`
- `scripts/public-tools-pdf-worker.mjs`
- `scripts/public-tools-runtime-check.mjs`

## Files Added

- `docs/reports/20261002-1521-PUBLIC-SERVICES-MENU-SELECTION.md`

## Files Modified

- `apps/web/src/routes/+layout.svelte`

## Files Deleted

None.

## Implementation Summary

- Added one local close function for the public services details menu.
- Each service navigation link closes the menu on activation, including same-page activation. Language selection closes it before reload. Escape uses the same close function and retains focus restoration.

## Architecture Decisions / Deviations

Presentation behavior stays in the Svelte layout. No public API, routing ownership, backend, or persistence behavior changed.

## Tests and Verification

- PASS: headless Chrome on the active 5173 server opened the menu, selected Summarizer, navigated successfully, and confirmed the menu closed. Selecting Summarizer again on the current page also closed it.
- PASS: `check:web` exited 0 with 0 errors and 0 warnings.
- PASS: `git diff --check` exited 0.

## Expected Failures

None.

## Unexpected Failures

An initial temporary browser-check script had an invalid selector string; correcting that test script allowed the check to pass. Application code was unaffected.

## Production Code Changes

The public Svelte layout now closes the services menu when links or locale are selected.

## Final Repository State

The active Svelte development server on port 5173 responds. The service menu closes after selecting a link; no production route cutover or legacy file deletion occurred.

## Acceptance Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| 1 | PASS | Selecting a different service navigates and closes menu in Chrome |
| 2 | PASS | Selecting the current service closes menu in Chrome |
| 3 | PASS | Svelte check 0 errors/warnings; git diff check passed |
| 4 | PASS | Required Activity Report finalized and verified |

## Open Issues

U2 human visual acceptance and production cutover remain outside this focused task.

---

Generated by scripts/activity-report.ts

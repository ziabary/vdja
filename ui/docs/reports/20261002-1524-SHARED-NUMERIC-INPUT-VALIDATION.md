# Activity Report: SHARED-NUMERIC-INPUT-VALIDATION

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-1524-SHARED-NUMERIC-INPUT-VALIDATION.md
- Created At: 2026-10-02T11:54:32.408Z
- Status: COMPLETE

## Purpose and Scope

Reject letters in shared numeric input, including Summarizer maximum words, while accepting Latin, Persian, and Arabic digits and converting them to canonical ASCII. Apply the same entry behavior to the numeric Jalali year field.

## Governing Sources

AGENTS.md; apps/web/AGENTS.md; packages/ui-core/AGENTS.md; packages/calendar-svelte/AGENTS.md; architecture 00-manifest and 02-engineering-conventions; docs/ui/03-target-ui-architecture.md and 07-u1.2-showcase-and-development.md; existing numeric parser, fields, public tools, and tests.

## Initial Repository State

The active Web development server was on port 5173. U1/U2 work and earlier reports were uncommitted. The shared NumberInput used type=text and inputmode=numeric, normalized Persian/Arabic digits but let letters and out-of-scale decimals remain during editing; the form rejected some of them only on submission. The calendar exact-year field likewise accepted letters until submit.

## Pre-existing Workspace Changes

All paths below were present in the initial status and were not edited for this task. Files Modified may also have pre-existing uncommitted changes, which this task preserved.

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
- `docker/bootstrap.mysql.sql`
- `docker/docker-compose.yml`
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
- `docs/reports/20261002-1521-PUBLIC-SERVICES-MENU-SELECTION.md`
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

- `docs/reports/20261002-1524-SHARED-NUMERIC-INPUT-VALIDATION.md`

## Files Modified

- `packages/ui-core/src/forms/numeric.ts`
- `packages/ui-core/src/index.ts`
- `packages/ui-core/src/forms/NumberInput.svelte`
- `packages/calendar-svelte/src/CalendarMonth.svelte`
- `apps/web/tests/components.test.ts`
- `apps/web/tests/u13-calendar-overlay.test.ts`
- `docs/ui/03-target-ui-architecture.md`
- `docs/ui/07-u1.2-showcase-and-development.md`

## Files Deleted

None.

## Implementation Summary

- Added one UI Core numeric draft normalizer: Latin/Persian/Arabic digits become ASCII; integer/decimal mode, sign and scale define valid edits. Invalid whole edits are rejected rather than stripping arbitrary characters.
- Updated NumberInput to restore the previous accepted value and caret on invalid edits, keep composition input pending until composition ends, and expose normalized display/callback values.
- Used the same draft normalizer for the Jalali year field, with its existing four-digit limit and Calendar Core year validation.
- Updated the target form and showcase documentation.

## Architecture Decisions / Deviations

UI Core owns generic numeric entry. Calendar Svelte reuses it for presentation while Calendar Core retains date normalization, year bounds and date math. Form submit still validates business-specific ranges and the backend remains final authority. No backend contract or source changed.

## Tests and Verification

- PASS: red-first NumberInput tests failed for letters and excess decimal precision before repair; year-field test failed before repair.
- PASS: focused component and calendar tests after repair, 19 tests in 2 files.
- PASS: headless Chrome on active /summarize: Persian ۲۵۰→250, rejected 25x0 retained 250, Arabic ٢٨٠→280, Latin 300 retained 300.
- PASS: check:web 0 errors/warnings, test:ui 14 files/99 tests, build:web, target UI architecture 0 violations/0 infrastructure failures, git diff --check.

## Expected Failures

Red-first focused tests failed before the implementation as intended.

## Unexpected Failures

None.

## Production Code Changes

Shared NumberInput validation and calendar numeric year entry changed. Public API and backend source were untouched.

## Final Repository State

The active Web server on port 5173 serves the repaired fields. All relevant checks pass; pre-existing U2 route ownership and visual-approval status are unchanged.

## Acceptance Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| 1 | PASS | Maximum words rejects letters; Chrome on /summarize |
| 2 | PASS | Latin/Persian/Arabic digits normalize to ASCII; browser and component tests |
| 3 | PASS | Decimal scale, selection and IME behavior covered by component tests |
| 4 | PASS | Calendar year rejects letters and converts digits; calendar test |
| 5 | PASS | Web check/build, 99 UI tests, architecture, diff and report verification |

## Open Issues

Production U2 cutover and human visual acceptance remain separate pending work.

---

Generated by scripts/activity-report.ts

# Activity Report: IRANSANSX-UI-FONT-REPAIR

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-1529-IRANSANSX-UI-FONT-REPAIR.md
- Created At: 2026-10-02T11:59:43.782Z
- Status: COMPLETE

## Purpose and Scope

Make public-tool information banners and labels visually consistent with the shared IRANSansX UI typography, and verify the font actually rendered rather than relying only on CSS declarations.

## Governing Sources

AGENTS.md, apps/web/AGENTS.md, architecture 00-manifest and 02-engineering-conventions, docs/ui/03-target-ui-architecture.md and docs/ui/08-public-tools-migration.md; shared Web stylesheet and public tool components.

## Initial Repository State

Web development server on port 5173 was active. Initial uncommitted U1/U2 work was captured by report:start. Browser rendered-font inspection showed custom IRANSansX already loaded for the Summarizer banner and labels, but banner text was 0.86rem versus 1rem body/labels; supporting file hint and character count were 0.9rem and 0.8rem. The visual scale caused the perceived font mismatch.

## Pre-existing Workspace Changes

All paths below were in the initial status and were not edited for this task. Files Modified also existed before this task and their earlier content was preserved.

- `.gitignore`
- `apps/web/src/lib/api/client.ts`
- `apps/web/src/lib/api/transport.ts`
- `apps/web/src/lib/server/bootstrap.ts`
- `apps/web/src/lib/streaming/parser.ts`
- `apps/web/src/lib/streaming/transport.ts`
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
- `apps/web/src/lib/public-tools/messages.ts`
- `apps/web/src/routes/(public)/faq.html/+page.server.ts`
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

- `docs/reports/20261002-1529-IRANSANSX-UI-FONT-REPAIR.md`

## Files Modified

- `apps/web/src/lib/styles/main.scss`
- `apps/web/src/lib/public-tools/TextTool.svelte`
- `apps/web/src/routes/(public)/faq/+page.svelte`
- `docs/ui/08-public-tools-migration.md`

## Files Deleted

None.

## Implementation Summary

- Explicitly included labels, legends, summaries and asides in the central IRANSansX stylesheet while keeping FontAwesome icon rules intact.
- Aligned Translator/Summarizer and FAQ information banners with 1rem body and field-label text. Brought the file hint to 1rem and the small character counter to 0.875rem.
- Updated the public-tools migration note with the actual typography boundary and browser verification.

## Architecture Decisions / Deviations

The shared Web stylesheet remains the central font-family owner. Component styles specify only their banner typography and retain inherited theme colors. FontAwesome remains the functional icon font. No font assets were copied or edited, and no backend or route behavior changed.

## Tests and Verification

- PASS: Chrome rendered-font inspection before/after on active /summarize and /faq: banner and labels use actual custom IRANSansX glyphs, not fallback; after repair banners and labels are 16px, file hint 16px, counter 14px. Icons use FontAwesome Pro Solid.
- PASS: check:web 0 errors/0 warnings; test:ui 14 files/99 tests; build:web completed.
- PASS: git diff --check.

## Expected Failures

None.

## Unexpected Failures

None.

## Production Code Changes

Target Web typography CSS and the two public-tool banner styles changed. Font assets, Express backend and route ownership were untouched.

## Final Repository State

Active Web development server on port 5173 serves the revised typography. Human visual approval for U2 remains pending; no production cutover or legacy deletion occurred.

## Acceptance Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| 1 | PASS | Public banners and field labels render actual custom IRANSansX in Chrome |
| 2 | PASS | Banner and labels use 16px body size; support text remains readable |
| 3 | PASS | FontAwesome icons retain their own loaded font |
| 4 | PASS | Web check/build, 99 UI tests, diff and report verification |

## Open Issues

U2 human visual acceptance and route cutover remain separate pending work.

---

Generated by scripts/activity-report.ts

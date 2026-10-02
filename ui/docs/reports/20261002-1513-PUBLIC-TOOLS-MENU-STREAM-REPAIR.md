# Activity Report: PUBLIC-TOOLS-MENU-STREAM-REPAIR

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-1513-PUBLIC-TOOLS-MENU-STREAM-REPAIR.md
- Created At: 2026-10-02T11:43:28.478Z
- Status: COMPLETE

## Purpose and Scope

Repair outside-click dismissal and progressive translation in Svelte public tools; restore local Express readiness and verify the active Web /api proxy. No backend/route cutover.

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

Web dev port 5173 was already active; Express port 3000 was stopped. The supplied MySQL and vLLM passed the existing runtime check (19 migrations, served model). report:start captured all pre-existing uncommitted U1/U2 paths.

## Pre-existing Workspace Changes

All listed paths were in initial status and were not edited for this repair. The five task files in Files Modified were also pre-existing and received edits.

- `.gitignore`
- `apps/web/src/lib/api/client.ts`
- `apps/web/src/lib/api/transport.ts`
- `apps/web/src/lib/server/bootstrap.ts`
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
- `docs/prompts/U2.1.md`
- `docs/prompts/U2.md`
- `docs/reports/20261002-1240-CALENDAR-EMPTY-TODAY-SHORTCUT.md`
- `docs/reports/20261002-1246-PUBLIC-AI-TOOLS-U2.md`
- `docs/reports/20261002-1343-PUBLIC-AI-TOOLS-LIVE-PARITY.md`
- `docs/reports/20261002-1438-PUBLIC-AI-TOOLS-LIVE-PARITY-CONTINUATION.md`
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

- `docs/reports/20261002-1513-PUBLIC-TOOLS-MENU-STREAM-REPAIR.md`

## Files Modified

- `apps/web/src/lib/streaming/parser.ts`
- `apps/web/src/lib/api/publicTools.ts`
- `apps/web/src/routes/+layout.svelte`
- `apps/web/tests/public-tools/contracts.test.ts`
- `docs/ui/08-public-tools-migration.md`

## Files Deleted

None.

## Implementation Summary

- Restarted Express against existing supplied services, left it active for Web port 5173.
- The frozen backend emits complete data lines without blank SSE separators until terminal. A red-first test reproduced the delayed rendering. The legacy text adapter now opts into dispatch per complete data line; normal SSE framing for FAQ and canonical streams remains.
- Closed the Other services menu on outside click and Escape, restoring summary focus on Escape.
- Updated the U2 migration contract with observed stream framing.

## Architecture Decisions / Deviations

Only the Translator/Summarizer legacy adapter opts into the unusual line framing. Backend contracts/source, database schema, model selection, ingress ownership, and legacy files are untouched. U2 human visual acceptance remains pending.

## Tests and Verification

- PASS: red-first progressive-delta test failed before the fix and passed afterward.
- PASS: check:web (0 errors/warnings), test:ui (14 files, 97 tests), build:web, target UI architecture (0 violations), git diff --check.
- PASS: headless Chrome on temporary port 5181 and active port 5173: outside click and Escape close menu; focus returns; partial translation visible while aria-busy=true; completed result nonempty (338 characters on 5173).
- PASS: live public-tools smoke through Web 5173 /api: Translator, Summarizer, FAQ generation, PDF extraction, inspect, validation, model health.
- PASS: final Express and Svelte HTTP 200 readiness checks.

## Expected Failures

The red-first streaming test failed before implementation as expected.

## Unexpected Failures

Initial sandboxed server starts had local socket EPERM; authorized local starts succeeded. This was an execution sandbox restriction.

## Production Code Changes

Only target Svelte shell, SSE parser, and public-tool adapter changed. Frozen backend source was untouched.

## Final Repository State

Existing Web port 5173 and restarted Express port 3000 respond. All three tools pass live smoke via /api. Temporary Web port 5181 was stopped. Production ingress and legacy files remain unchanged.

## Acceptance Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| 1 | PASS | Other services closes on outside click and Escape; Chrome on 5173, focus restored |
| 2 | PASS | Translation shows partial output before terminal; red-first test and Chrome while aria-busy=true |
| 3 | PASS | API and all three public tools respond; Express/Web HTTP 200 and proxy live smoke |
| 4 | PASS | Backend and route freeze maintained; no backend, migration, ingress or legacy-file edit |
| 5 | PASS | Web check/build, 97 tests, architecture and report verification |

## Open Issues

U2 human visual acceptance remains pending; no production cutover or legacy deletion.

---

Generated by scripts/activity-report.ts

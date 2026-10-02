# Activity Report: PUBLIC-AI-TOOLS-LIVE-PARITY-CONTINUATION

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-1438-PUBLIC-AI-TOOLS-LIVE-PARITY-CONTINUATION.md
- Created At: 2026-10-02T11:08:19.640Z
- Status: PARTIAL

## Purpose and Scope

Continue U2.1 with the user-provided existing MySQL and vLLM services. Prove direct API, Svelte proxy and equivalent-input legacy-versus-Svelte live parity for Translator, Summarizer and FAQ. Keep backend code and contracts frozen. Cutover and legacy deletion require both live parity and explicit human visual approval.

## Governing Sources

`AGENTS.md`, `apps/web/AGENTS.md`, `docs/architecture/AGENTS.md`, `docs/prompts/U2.1.md`, architecture 00–10 (especially 01–05, 07–08), UI migration documents 00 and 03–08, and the earlier U2/U2.1 reports. Existing Express routes/services, migration files, target API adapter, tests and ignored local configuration were re-inspected.

## Initial Repository State

The preceding U2.1 report was finalized PARTIAL and verified. Its development MySQL helper files, U2 candidate UI, calendar changes, prior reports and screenshot assets were uncommitted. The user had separately prepared an existing MySQL service and vLLM service. `docker/bootstrap.mysql.sql` and `docker/docker-compose.yml` were already modified by the user; their contents were not changed here. A local `docker/mysql/data/` bind mount containing private database files existed and is now ignored to prevent accidental staging. No new MySQL container was created or used by this continuation.

## Pre-existing Workspace Changes

These final-status paths were present before the continuation and were not edited by it. The U2 candidate files listed under Files Modified were also present before this turn but received continuation edits.

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
- `apps/web/tests/u13-calendar-overlay.test.ts`
- `docker/bootstrap.mysql.sql`
- `docker/docker-compose.yml`
- `docs/ui/07-u1.2-showcase-and-development.md`
- `packages/calendar-svelte/src/DateInput.svelte`
- `packages/calendar-svelte/src/picker.css`
- `packages/ui-core/src/forms/Textarea.svelte`
- `apps/web/src/lib/public-tools/messages.ts`
- `apps/web/src/routes/(public)/faq.html/+page.server.ts`
- `apps/web/src/routes/(public)/faq/+page.svelte`
- `apps/web/src/routes/(public)/summarize.html/+page.server.ts`
- `apps/web/src/routes/(public)/summarize/+page.svelte`
- `apps/web/src/routes/(public)/translate.html/+page.server.ts`
- `apps/web/src/routes/(public)/translate/+page.svelte`
- `apps/web/static/brand/targoman-logo-dark.png`
- `apps/web/static/brand/targoman-logo-light.png`
- `docs/prompts/U2.1.md`
- `docs/prompts/U2.md`
- `docs/reports/20261002-1240-CALENDAR-EMPTY-TODAY-SHORTCUT.md`
- `docs/reports/20261002-1246-PUBLIC-AI-TOOLS-U2.md`
- `docs/reports/20261002-1343-PUBLIC-AI-TOOLS-LIVE-PARITY.md`
- `docs/ui/visual-baselines/u2/legacy-live-summarizer.png`
- `docs/ui/visual-baselines/u2/legacy-live-translator.png`
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

## Files Added

- `scripts/public-tools-runtime-check.mjs`
- `scripts/public-tools-pdf-worker.mjs`
- `scripts/public-tools-legacy-seed.mjs`
- `scripts/public-tools-cancel-live.mjs`
- `docs/reports/20261002-1438-PUBLIC-AI-TOOLS-LIVE-PARITY-CONTINUATION.md`
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

## Files Modified

- `.gitignore`
- `package.json`
- `apps/web/src/lib/api/publicTools.ts`
- `apps/web/src/lib/public-tools/TextTool.svelte`
- `apps/web/tests/public-tools/components.test.ts`
- `apps/web/tests/public-tools/contracts.test.ts`
- `docs/ui/08-public-tools-migration.md`
- `scripts/public-tools-live-smoke.mjs`

## Files Deleted

None from tracked source. Two untracked helpers created during the earlier partial U2.1 run, `docker/compose.public-tools.dev.yml` and `scripts/public-tools-dev-db.mjs`, were removed because this continuation uses the user-provided MySQL service exclusively.

## Existing Runtime Environment

| Component | Existing requirement | Provisioned how | Health check | Result |
| --- | --- | --- | --- | --- |
| MySQL | User-provided loopback service, legacy `TargomanLLM` schema, `mysql_native_password` | Existing service and ignored local `.config.json` | Version 8.4.5; 19/19 migration ledger entries; API DB request | READY |
| Anonymous legacy user | ID 1 from unchanged migration `3_tblUser.cjs` | Explicit guarded restoration of that single row in the empty user table | FK no longer fails after model output | READY |
| vLLM | Existing OpenAI-compatible endpoint and configured model | Existing service and ignored local `.config.json` | `/v1/models` 200 serving `targoman`; `/health` 200; `/v1/responses/` 200 SSE | READY |
| PDF worker | Installed `pdfjs-dist` worker at the frozen loader's runtime path | Explicit package-asset copy; path ignored | Valid synthetic PDF extraction at 2000 and 3000 limits | READY |
| Express | Existing API on port 3000 | Existing `dev:api` | Direct validation, extraction and all three generations | READY |
| Svelte Web | Existing Vite `/api` proxy | Existing `dev:web` on local test port | Same live smoke and cancel through proxy | READY |
| Embedding/Qdrant | Not needed by these three public requests | Not started | Source dependency inspection | NOT_REQUIRED |

The ignored local configuration was updated only to point at the supplied services and served model. This continuation did not copy its credentials into task-owned files, this report or screenshots. No schema definition or migration file was changed. The existing 19 migrations were inspected and verified as applied; they were not rerun on the provided database.

## Live Parity Matrix

| Tool | Legacy live | Svelte live | Wire contract | Streaming | Error | Cancel | File | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Translator | PASS | PASS | Same POST JSON fields; `auto` to `fa`; 32-character ID | Deltas, reference and done handled | Invalid direct request 400; safe target error | Supported stop path; shared live cancel contract verified with Summarizer | PDF browser extraction PASS on both | Nonempty result; clipboard PASS on both |
| Summarizer | PASS | PASS | Same POST JSON fields; `max_words=200`, `force_persian=true`, 32-character ID | Deltas and done PASS | Empty direct request 400; safe target error | Direct and proxy active stop `OK`, then `CANCELLED` and `DONE`; late-stop browser race resolved | PDF browser extraction PASS on both | Nonempty Markdown; Markdown/plain clipboard PASS on both |
| FAQ | PASS | PASS | Same inspect and generation multipart fields/defaults | Named meta, batch and done PASS | Unsupported file 400; safe target error | NOT_APPLICABLE, no legacy FAQ stop endpoint | TXT generation and PDF browser inspect PASS on both | 10 items on both; clipboard, Markdown download and 10-item JSON download PASS |

No generated prose was compared byte-for-byte because vLLM output is nondeterministic. The same safe input and options, request protocol, terminal behavior and result shape were compared. Six success screenshots and 15 target state screenshots are listed under Files Added.

## Backend Freeze

- Modified backend paths under `src`, `db`, `apps/api`, `packages/ai-router`: **NONE**.
- `git diff --exit-code -- src db apps/api packages/ai-router`: exit 0.
- Backend route paths, request/response/SSE contracts, prompts, model-selection source, persistence schema and migrations: unchanged.
- PDF worker was provisioned as an ignored package runtime asset; no PDF loader source change was necessary.

## Cutover Evidence

LIVE PARITY = PASS for all three tools. HUMAN VISUAL ACCEPTANCE = PENDING at report time. Production ingress still belongs to Express; no route cutover occurred. The reversible route ownership and rollback plan remains in `docs/ui/08-public-tools-migration.md`. Svelte `.html` compatibility alias for Translator returned 308 preserving `?q=hello`.

## Legacy Deletion

`public/translate.html`, `public/summarize.html`, `public/faq.html`, `public/js/faq.js`, `public/css/faq.css`: RETAINED. Shared legacy assets and all backend handlers: RETAINED. Deletion gate is pending explicit human visual approval and later post-cutover smoke.

## Implementation Summary

- Probed the supplied vLLM `/v1/models`, `/health` and the exact `/v1/responses/` request shape before changing ignored local configuration; the served model ID is `targoman`.
- Confirmed existing MySQL schema and all 19 migrations; restored only missing migration-defined anonymous development row 1 after confirming an empty user table. No new container, migration rerun or schema change.
- Provisioned the matching `pdfjs-dist` worker at the frozen loader path using a repeatable script; ignored the runtime asset and the pre-existing MySQL bind mount.
- Replaced the earlier unused isolated-MySQL helper with read-only existing-runtime checks, explicit guarded seed and PDF worker commands.
- Fixed the target legacy SSE adapter to consume consecutive `data:` lines in one SSE frame. Tightened stop acknowledgement to `OK`/`PENDING` and removed a stale error when generation wins a stop race. Added focused contract/component tests.
- Ran direct and proxy live integration and cancellation commands. Drove all six browser pages against the same backend; checked wire fields/defaults, PDF uploads, successful output, clipboard and FAQ downloads. Captured live success, loading, error, dark, mobile and English review states.

## Architecture Decisions / Deviations

The database, model and PDF provisioning are legacy development/runtime work only. The single anonymous row mirrors an existing migration and has a guarded explicit command. No target PostgreSQL/T2 persistence, provider substitution, AI Router implementation or backend behavior change was introduced. The shared standards-based SSE parser remains unchanged; the nonstandard legacy line treatment is isolated in the public-tool adapter.

## Tests and Verification

- PASS: `dev:public-tools:runtime:check` reports 19 migrations and the served configured model; `dev:public-tools:pdf-worker` reports matching runtime asset.
- PASS: `test:public-tools:live` against direct Express and through Svelte `/api`: invalid 400 cases, FAQ inspect, PDF extraction at 2000/3000, model health, nonempty Translator/Summarizer terminal results, FAQ batch/done/items.
- PASS: `test:public-tools:live:cancel` direct and through proxy: active stop HTTP 200 status `OK`, SSE `CANCELLED` then `DONE`.
- PASS: Chrome legacy-versus-Svelte equivalent inputs: Translator and Summarizer JSON field/default equality, FAQ multipart field/default equality, nonempty results, 10 FAQ items, PDF file chooser flows, clipboard actions and FAQ Markdown/JSON downloads.
- PASS: Target live browser matrix for all three tools: Persian RTL desktop light/dark/mobile, English LTR desktop, live loading/success/error captures, no horizontal overflow, IRANSansX form controls and buttons.
- PASS: `check:web` (0 errors/warnings), `test:ui` (14 files, 96 tests), `test:architecture:target-ui` (`ARCHITECTURE_VIOLATION=0`, `TEST_INFRA_FAILURE=0`), `build:web`, `build`, `git diff --check`, backend freeze diff exit 0. Added scripts pass `node --check`.
- PASS: Svelte Translator `.html` alias returned 308 with its query parameter preserved.

## Expected Failures

None in the live parity or repository checks. Explicit human visual acceptance remains pending, so production cutover and legacy deletion are deliberately not run.

## Unexpected Failures

The existing schema had an empty `tblUser` despite the user migration being recorded, causing an FK error after generated deltas. The legacy PDF loader's worker asset was missing. The backend's nonstandard SSE grouping exposed a target compatibility bug, and a fast browser stop exposed a target stale-error race. Each issue was reproduced, corrected within allowed development/runtime or target UI scope, and retested. No backend source fix was required.

## Production Code Changes

Target Web adapter and `TextTool.svelte` only; their changes preserve the frozen backend contract. Backend production code changes: 0. All database and worker changes were explicit local development/runtime provisioning, not schema or migration source edits.

## Final Repository State

Task-owned files and pre-existing workspace paths are listed above. The provided MySQL and vLLM services were neither created nor stopped by this task. Local API/Web test processes were stopped after the checks, and their private temporary logs and configuration backup were removed. Summary: Existing API READY when started; Database READY; LLM READY; Translator/Summarizer/FAQ live parity PASS; Human visual approval PENDING; Production cutover NOT_DONE; Legacy removal NOT_DONE; Backend source changes 0; Target UI violations 0; Target architecture infrastructure failures 0.

## Acceptance Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| 1 | PASS | Continuation report started before edits; supplied endpoint/model and database verified. |
| 2 | PASS | Existing MySQL only; 19 migrations recorded; no schema change or new container. |
| 3 | PASS | Existing model ID served; exact Responses endpoint produced SSE. |
| 4 | PASS | Missing worker corrected as ignored package runtime asset; PDF browser and API flows pass. |
| 5 | PASS | Direct and proxy generation, error, file and cancellation checks pass. |
| 6 | PASS | All three equivalent-input browser wire and result parity comparisons pass. |
| 7 | PASS | Live target locale/theme/mobile/loading/success/error matrix captured. |
| 8 | PASS | Target check, 96 UI tests, architecture guardrail and both builds pass. |
| 9 | PASS | Backend source and public contract unchanged; secrets excluded. |
| 10 | NOT_APPLICABLE | Production cutover and legacy deletion await explicit human visual approval. |

## Open Issues

Human review of the current live captures is pending. After explicit approval, perform the reversible three-route cutover, production-like live smoke, and only then remove the exclusively owned legacy frontend files. If the reviewer requests changes, fix the cited visual issues and recapture evidence before seeking approval again.

---

Generated by scripts/activity-report.ts

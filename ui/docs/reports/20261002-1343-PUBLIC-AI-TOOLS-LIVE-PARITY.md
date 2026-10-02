# Activity Report: PUBLIC-AI-TOOLS-LIVE-PARITY

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-1343-PUBLIC-AI-TOOLS-LIVE-PARITY.md
- Created At: 2026-10-02T10:13:56.594Z
- Status: PARTIAL

## Purpose and Scope

U2.1: bring up the frozen Express runtime, prove three public tools live, and cut over only after live parity and explicit human visual approval. Result: PARTIAL; the last two gates remain open.

## Governing Sources

`AGENTS.md`; scoped `apps/web/AGENTS.md` and `docs/architecture/AGENTS.md`; `docs/prompts/U2.1.md`; architecture 00–10 with 01–05, 07–08 governing this work; UI migration docs 00, 03–08; previous U2 report. Current Express source, target adapter, tests and ignored local configuration were re-inspected.

## Initial Repository State

The U2 candidate and unrelated calendar work were already uncommitted. Express was down, the configured MySQL service was absent, and the configured generation host did not resolve locally. Live parity, cutover and visual approval were already pending.

## Pre-existing Workspace Changes

These paths existed before U2.1 and were not changed by this task. The pre-existing U2 adapter, contracts test and migration doc were edited for U2.1 and appear under Files Modified.

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
- `docs/ui/07-u1.2-showcase-and-development.md`
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

- `docker/compose.public-tools.dev.yml`
- `scripts/public-tools-dev-db.mjs`
- `scripts/public-tools-live-smoke.mjs`
- `docs/reports/20261002-1343-PUBLIC-AI-TOOLS-LIVE-PARITY.md`

## Files Modified

- `package.json`
- `apps/web/src/lib/api/publicTools.ts`
- `apps/web/tests/public-tools/contracts.test.ts`
- `docs/ui/08-public-tools-migration.md`

## Files Deleted

None.

## Existing Runtime Environment

| Component | Existing requirement | Provisioned how | Health check | Result |
| --- | --- | --- | --- | --- |
| Express | Existing API on port 3000, DB initialization before listen | Existing `dev:api` | GET plus real validation requests | Process READY; full API BLOCKED |
| MySQL | Legacy schema and reference dictionary | Isolated loopback Compose; 19 unchanged migrations | Connection and `tblChats` | READY, no customer data |
| File parser | Existing PDF.js worker and temp files | Existing backend dependencies | TXT inspect, valid synthetic PDF | TXT PASS; PDF HTTP 500 |
| Generation model | Existing configured LLM endpoint/model | No substitution | Model health probe | BLOCKED, host unreachable |
| Embedding/Qdrant | Not used for these three tools | Not started | Source inspection | NOT_REQUIRED |
| Web proxy | Logical `/api` to Express | Existing Vite config | JSON 400; multipart inspect 200 | PASS |

## Live Parity Matrix

| Tool | Legacy live | Svelte live | Wire contract | Streaming | Error | Cancel | File | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Translator | BLOCKED | BLOCKED | Source/adapter checked; 32-char ID fixed | BLOCKED | Invalid JSON 400 | BLOCKED | PDF 500 | BLOCKED |
| Summarizer | BLOCKED | BLOCKED | Source/adapter checked; 32-char ID fixed | BLOCKED | Empty input 400 | BLOCKED | PDF 500 | BLOCKED |
| FAQ | BLOCKED | BLOCKED | Multipart inspect checked; generation unproven | BLOCKED | Unsupported file 400 | NOT_APPLICABLE | TXT inspect PASS | BLOCKED |

No successful generation, SSE terminal, stop acknowledgement, equivalent-input comparison or live success capture is claimed.

## Backend Freeze

Modified backend paths under `src`, `db`, `apps/api`, `packages/ai-router`: **NONE**. `git diff --exit-code -- src db apps/api packages/ai-router` returned 0. Existing routes, schema, migrations, prompts, model selection and provider behavior are unchanged. The PDF worker defect was reproduced but not fixed in U2.1.

## Cutover Evidence

NOT DONE: live parity and human visual acceptance are missing. Express remains the public route owner. The Svelte candidate and rollback plan are in `docs/ui/08-public-tools-migration.md`; ingress was not changed.

## Legacy Deletion

`public/translate.html`, `public/summarize.html`, `public/faq.html`, `public/js/faq.js`, `public/css/faq.css`: RETAINED. Shared assets and backend handlers: RETAINED.

## Implementation Summary

Added an isolated MySQL Compose service with explicit non-destructive start, health, migration and stop commands. Original 19 migrations run in numeric order through `mysql2`; migration refuses an existing schema. Added a live smoke using the actual target API client and safe synthetic input. It checks real validation, multipart, PDF extraction, model health and generation; it cannot claim PASS without the configured model. Corrected target request IDs to unique 32-character hexadecimal values required by the frozen `chatService` and added a focused test. Documented startup and blockers.

## Architecture Decisions / Deviations

Legacy MySQL remains solely a parity environment. No target T2/PostgreSQL or AI Router work was introduced. No fake model was used for live evidence. Database shutdown retains its volume; startup never runs migrations implicitly. Production routes stay with Express until both final gates pass.

## Tests and Verification

- PASS: `check:web` (0 errors/warnings), `test:ui` (14 files, 93 tests), `test:architecture:target-ui` (0 violations, 0 infrastructure failures), `build:web`, `build`, `git diff --check`, backend freeze diff (exit 0).
- PASS: MySQL schema health after 19 migrations, real Express GET 200, direct Translator/Summarizer invalid requests 400, FAQ TXT inspect 200 and invalid file 400.
- PASS: Svelte route SSR 200, proxy JSON validation 400 and proxy multipart FAQ inspect 200.
- PASS: synthetic PDF fixture independently parsed as one page by `pdfinfo`.
- EXPECTED FAIL: `test:public-tools:live` exits nonzero: PDF extraction HTTP 500 for both 2000/3000 limits; configured model health reports `ENVIRONMENT_NOT_READY`.

## Expected Failures

Configured generation endpoint is unavailable. Live generation/parity, cancellation and live visual evidence are BLOCKED. Explicit human approval for the revised three tool designs is PENDING; cutover and deletion are NOT DONE.

## Unexpected Failures

The frozen legacy PDF loader references a missing `pdf.worker.min.mjs` beside its source. A valid synthetic PDF returns HTTP 500. A separately authorized backend-fix task is required.

## Production Code Changes

Target Svelte API adapter: request ID compatibility correction. Backend production code: 0 files. Backend public contract: unchanged.

## Final Repository State

Task changes and pre-existing paths are listed above. Local test processes were stopped; the isolated MySQL volume remains. Summary: Existing API BLOCKED for full tool readiness; Database READY; LLM BLOCKED; Translator/Summarizer/FAQ live parity BLOCKED; human visual approval PENDING; production cutover NOT_DONE; legacy frontend removal NOT_DONE; backend source changes 0; target UI violations 0; target architecture infrastructure failures 0.

## Acceptance Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| 1 | PASS | Report created before edits; runtime dependencies identified. |
| 2 | PASS | Isolated MySQL migrated with original files; no unneeded service or customer data. |
| 3 | PASS | Backend source/contract frozen; diff exit 0; no secret values recorded. |
| 4 | PASS | Real API validation, FAQ inspect and Web proxy requests checked. |
| 5 | FAIL | Configured generation endpoint unreachable; live generation unproven. |
| 6 | FAIL | Existing PDF extraction returns HTTP 500 due missing worker asset. |
| 7 | FAIL | Three-tool live parity, stream/cancel and live browser matrix unproven. |
| 8 | PASS | Target checks, 93 tests, guardrails and both builds green. |
| 9 | NOT_APPLICABLE | Cutover and deletion gated by live parity and human approval. |

## Open Issues

Make the existing configured model reachable, then rerun live smoke and legacy-versus-Svelte browser review. Resolve the legacy PDF worker packaging defect in a separately authorized backend-fix task. Obtain explicit human visual approval after live captures before route cutover and exclusive legacy frontend retirement.

---

Generated by scripts/activity-report.ts

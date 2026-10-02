# Activity Report: PUBLIC-AI-TOOLS-U2

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-1246-PUBLIC-AI-TOOLS-U2.md
- Created At: 2026-10-02T09:16:15.188Z
- Status: PARTIAL

## Purpose and Scope

- Migrate the three anonymous legacy public AI tool frontends to candidate SvelteKit routes while freezing Express, API contracts, DB, auth and provider behavior. Characterize source/contract first, implement, test, and preserve cutover/deletion gates.

## Governing Sources

- AGENTS.md and apps/web/AGENTS.md, packages/ui-core/AGENTS.md, docs/architecture/AGENTS.md.
- docs/architecture/00-manifest.md, 01-system-architecture.md, 02-engineering-conventions.md, 04-authorization-model.md, 05-module-architecture.md, 07-ai-router.md, 08-deployment-architecture.md.
- docs/ui/00-current-state-inventory.md through 07-u1.2-showcase-and-development.md; U2 attached task; exact legacy HTML/JS and backend route source.

## Initial Repository State

- `report:start` created this report before any U2 source/document modification.
- Express/static HTML owned production `/translate`, `/summarize`, `/faq`. Target Web had no business tool routes. Existing frontend foundation, API client, SSE parser, Markdown renderer and operation state machine were present.
- The U2-owned backend diff was empty at start.

## Pre-existing Workspace Changes

- `apps/web/tests/u13-calendar-overlay.test.ts` — previous calendar task.
- `docs/ui/07-u1.2-showcase-and-development.md` — previous calendar task.
- `packages/calendar-svelte/src/DateInput.svelte` — previous calendar task.
- `packages/calendar-svelte/src/picker.css` — previous calendar task.
- `docs/reports/20261002-1240-CALENDAR-EMPTY-TODAY-SHORTCUT.md` — previous task report.
- `docs/prompts/U2.md` — unrelated concurrent workspace addition, not created or edited for this work.

The parent git worktree also had untracked sibling files/directories outside this `ui` workspace. They were not touched or claimed.

## Files Added

- `apps/web/src/lib/api/publicTools.ts`
- `apps/web/src/lib/public-tools/TextTool.svelte`
- `apps/web/src/lib/public-tools/messages.ts`
- `apps/web/static/brand/targoman-logo-light.png`
- `apps/web/static/brand/targoman-logo-dark.png`
- `apps/web/src/routes/(public)/faq.html/+page.server.ts`
- `apps/web/src/routes/(public)/faq/+page.svelte`
- `apps/web/src/routes/(public)/summarize.html/+page.server.ts`
- `apps/web/src/routes/(public)/summarize/+page.svelte`
- `apps/web/src/routes/(public)/translate.html/+page.server.ts`
- `apps/web/src/routes/(public)/translate/+page.svelte`
- `apps/web/tests/public-tools/components.test.ts`
- `apps/web/tests/public-tools/contracts.test.ts`
- `docs/ui/08-public-tools-migration.md`
- `docs/ui/visual-baselines/u2/u2-faq-en-dark.png`
- `docs/ui/visual-baselines/u2/u2-faq-error.png`
- `docs/ui/visual-baselines/u2/u2-faq-fa-mobile.png`
- `docs/ui/visual-baselines/u2/u2-faq-loading.png`
- `docs/ui/visual-baselines/u2/u2-faq-success.png`
- `docs/ui/visual-baselines/u2/u2-summarize-error.png`
- `docs/ui/visual-baselines/u2/u2-summarize-loading.png`
- `docs/ui/visual-baselines/u2/u2-summarize-success.png`
- `docs/ui/visual-baselines/u2/u2-summarizer-fa-dark.png`
- `docs/ui/visual-baselines/u2/u2-translate-error.png`
- `docs/ui/visual-baselines/u2/u2-translate-loading.png`
- `docs/ui/visual-baselines/u2/u2-translate-success.png`
- `docs/ui/visual-baselines/u2/u2-translator-en-mobile.png`
- `docs/ui/visual-baselines/u2/u2-translator-fa-light.png`
- `docs/ui/visual-baselines/u2/legacy-live-translator.png`
- `docs/ui/visual-baselines/u2/legacy-live-summarizer.png`
- `docs/ui/visual-baselines/u2/u2-review-translate-light.png`
- `docs/ui/visual-baselines/u2/u2-review-translate-dark.png`
- `docs/ui/visual-baselines/u2/u2-review-summarize-light.png`
- `docs/ui/visual-baselines/u2/u2-review-summarize-dark.png`
- `docs/ui/visual-baselines/u2/u2-review-faq-light.png`
- `docs/ui/visual-baselines/u2/u2-review-faq-dark.png`
- `docs/reports/20261002-1246-PUBLIC-AI-TOOLS-U2.md`

## Files Modified

- `apps/web/src/lib/api/client.ts`
- `apps/web/src/lib/api/transport.ts`
- `apps/web/src/lib/streaming/parser.ts`
- `apps/web/src/lib/streaming/transport.ts`
- `apps/web/src/lib/server/bootstrap.ts`
- `apps/web/src/lib/styles/main.scss`
- `apps/web/src/routes/+layout.server.ts`
- `apps/web/src/routes/+layout.svelte`
- `apps/web/src/routes/(public)/+layout.svelte`
- `apps/web/src/routes/(public)/+page.svelte`
- `packages/ui-core/src/forms/Textarea.svelte`

## Files Deleted

None. All legacy frontend files remain because all-three cutover gates have not passed.

## Implementation Summary

- Characterized exact legacy routes, aliases, scripts, CSS, endpoint fields, dictionary/stream frames, file paths, validation, copy/download and dependencies. Wrote the source map, API matrix and parity matrix in `docs/ui/08-public-tools-migration.md` before target tool UI code.
- Added Persian/English public navigation and candidate Svelte routes. Translator and Summarizer share form/result behavior; FAQ has its distinct inspect, batch, accordion and download flow. Existing UI Core forms, MarkdownView and AI operation state machine are reused.
- Added explicit adapters for legacy JSON/dictionary, SSE markers, FAQ named events and multipart uploads. The shared SSE parser now owns UTF-8 framing for canonical and legacy streams. Backend wire fields and logical `/api` origin are preserved.
- Added `.html` compatibility redirects retaining query strings. Production ingress remains Express; this is a candidate Web implementation, not production cutover.
- After the reviewer supplied the original site's visual reference, revised the three pages around its compact header, shared Translator/Summarizer card, FAQ cards, and cyan notices. The public Targoman BrandProfile supplies the logo/colors without embedding brand identity in tool components. The requested blue login link, outlined service menu and light/dark gear button are functional; the legacy `/login` route remains an ingress dependency. All buttons and inputs inherit IRANSansX.

## Tool Migration Summary

| Tool | Legacy route | New candidate route | Backend endpoint | Parity | Cutover | Legacy removed |
| --- | --- | --- | --- | --- | --- | --- |
| Translator | `/translate`, `/translate.html`, `?q` | Same, Svelte candidate | `/api/translate`, stop, file2Text | Fixture/component/browser PASS; live PENDING | NO | NO |
| Summarizer | `/summarize`, `/summarize.html` | Same, Svelte candidate | `/api/summarize`, stop, file2Text | Fixture/component/browser PASS; live PENDING | NO | NO |
| FAQ Generator | `/faq`, `/faq.html` | Same, Svelte candidate | `/api/faq/inspect`, `/api/faq` | Fixture/component/browser PASS; live PENDING | NO | NO |

## Backend Freeze Evidence

- `git diff --exit-code -- src db apps/api packages/ai-router`: exit 0, empty.
- Backend production files changed: NONE. Express route contracts, DB schema/migrations, auth/session, provider calls and AI routing were not edited.
- `npm run build` (legacy Express): exit 0.

## API Contract Matrix

| Tool | Request | Success shape | Error/terminal |
| --- | --- | --- | --- |
| Translator | JSON `text`, `source_lang`, `target_lang`, `request_id`; multipart `file` for binary extraction | Dictionary JSON or SSE `delta`, `[REF]`, `[DONE:id]` | HTTP error, `[ERROR]`, `[CANCELLED:id]` + done; stop POST |
| Summarizer | JSON `text`, `max_words`, `force_persian`, `request_id`; multipart extraction | SSE `delta`, `[REF]`, `[DONE:id]` | HTTP error, `[ERROR]`, `[CANCELLED:id]` + done; stop POST |
| FAQ Generator | Multipart inspect `file`; generation `file`, `count`, `answer_words`, `tone`, `language`, `scope`, `from`, `to`, `focus`, `prior_questions` | Inspect JSON; named SSE `meta`, `batch`, `done` | HTTP error or named SSE `error`; incomplete EOF is interrupted |

## Legacy Deletion Matrix

| Legacy file | Used only by migrated tools? | Deleted? | Reason |
| --- | --- | --- | --- |
| `public/translate.html` | YES | NO | All-three cutover/live/human gates pending. |
| `public/summarize.html` | YES | NO | Same gate. |
| `public/faq.html`, `public/js/faq.js`, `public/css/faq.css` | YES | NO | Same gate. |
| `public/js/llm.js`, `common.js`, `auth.js`, `app-nav.js`, shared CSS/fonts/vendor assets | NO | NO | Still consumed by other legacy surfaces. |
| `src/routes/translate.ts`, `summarize.ts`, `faq.ts`, `file2Text.ts` | Backend | NO | Frozen backend contract. |

## Architecture Decisions / Deviations

- Public tools remain anonymous and use no frontend authorization logic. Runtime identity stays BrandProfile driven. The Targoman-hosted public route selects its own profile and live legacy logo variants; foundation/admin routes retain the neutral profile.
- A native file input is used because UI Core has no file-upload primitive; labeled shared form controls own all other supported inputs.
- Legacy summarizer's over-limit `const` reassignment is not copied; target slices the same 3000-character UI maximum. Legacy FAQ's acceptance of EOF without `done` is tightened to an interrupted state. Unsafe backend error text is not exposed. Backend behavior is untouched.
- Browser-local stop acknowledgement is not treated as proof that backend generation ended; the stream terminal remains authoritative.
- Route rollback: restore the three public ingress bindings to Express and redeploy/revert the Web artifact. Retained legacy files keep that path available. No ingress binding was changed for U2.

## Tests and Verification

| Command/check | Result |
| --- | --- |
| `npm run check:web` (Node 22) | exit 0, 0 errors/warnings |
| `npm run test:ui` (Node 22) | exit 0, 14 files / 92 tests passed |
| `npm run test:architecture:target-ui` (Node 22) | exit 0, `ARCHITECTURE_VIOLATION=0`, `TEST_INFRA_FAILURE=0` |
| `npm run build:web` (Node 22) | exit 0, adapter-node build produced |
| `npm run build` (legacy Node 20) | exit 0 |
| `git diff --check` | exit 0 |
| `git diff --exit-code -- src db apps/api packages/ai-router` | exit 0, no backend diff |
| Production Node adapter route curl | `/translate`, `/summarize`, `/faq`: 200; `.html`: 308; invalid and `/foundation`: 404; fonts/FontAwesome: 200 |
| Chrome synthetic fixtures | Revised 6 desktop light/dark review captures, 5 locale/theme/viewport captures, each tool loading/success/error captures; browser result DOM, theme toggle, service menu, login `back` query passed |
| Computed form fonts | Body, buttons, inputs, selects, textareas use IRANSansX in all three tools, light and dark |
| Local live Express API on `127.0.0.1:3000` | `ENVIRONMENT_BLOCKED`: connection refused, no successful live tool call |

## Test Matrix

| Tool | Component | API contract | SSR/alias | Browser synthetic | Live backend | Human visual |
| --- | --- | --- | --- | --- | --- | --- |
| Translator | PASS | PASS | PASS | PASS | ENVIRONMENT_BLOCKED | PENDING |
| Summarizer | PASS (shared text component) | PASS | PASS | PASS | ENVIRONMENT_BLOCKED | PENDING |
| FAQ Generator | PASS | PASS | PASS | PASS | ENVIRONMENT_BLOCKED | PENDING |

## Human Review

- Translator: PENDING renewed review. See `docs/ui/visual-baselines/u2/u2-review-translate-{light,dark}.png` and `u2-translate-*`.
- Summarizer: PENDING renewed review. See `u2-review-summarize-{light,dark}.png` and `u2-summarize-*`.
- FAQ Generator: PENDING renewed review. See `u2-review-faq-{light,dark}.png` and `u2-faq-*`.
- The reviewer identified the original site and supplied a dark Translator screenshot, then preferred the original compact header buttons and asked for consistent input/button fonts. The revised captures implement those points. Automated screenshots remain evidence, not human acceptance; no per-tool visual pass is claimed.

## Expected Failures

- Live backend smoke and legacy-versus-target live equivalence cannot pass while the existing API/DB/LLM environment is unavailable. The local API port 3000 refused a connection; no backend source was modified or service success invented.
- Production route cutover and exclusive legacy deletion are intentionally not performed until all per-tool gates, including human visual acceptance and live backend parity, pass.

## Unexpected Failures

- None in final automated verification. Initial sandbox-only loopback binding/connect attempts returned EPERM/connection refused; approved loopback preview tests then passed. This was a test-environment boundary, not a product failure.

## Production Code Changes

- Web-only target UI, frontend transport and parser changes listed above. Backend production code: NONE.

## Final Repository State

- Candidate Svelte pages and tests are reviewable in the Web tree. Express continues to serve production public routes. Legacy HTML/JS/CSS copies remain for rollback. The U2 backend diff is empty. Pre-existing calendar changes and unrelated `docs/prompts/U2.md` remain unclaimed.

## Acceptance Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| 1 | PASS | Report created before U2 implementation; legacy source map and parity matrix written first. |
| 2 | PASS | Exact legacy routes, endpoint fields, file support, stream framing and shared assets documented. |
| 3 | PASS | Three anonymous Svelte candidate pages, localized navigation, shared controls/client/state/Markdown implemented. |
| 4 | PASS | Component, contract, architecture, check, Web and Express builds pass; no backend diff. |
| 5 | PASS | SSR, aliases, query preservation, navigation, refresh, 404, assets, mobile/theme/locale synthetic browser smoke. |
| 6 | FAIL | No successful live existing-backend smoke or live legacy/target comparison; API environment unavailable. |
| 7 | FAIL | Original-site visual changes and header/font corrections made; revised captures await per-tool human acceptance. |
| 8 | FAIL | Production route cutover and exclusive legacy deletion correctly deferred by U2 gates. |
| 9 | PASS | Rollback and legacy ownership map documented; shared legacy files preserved. |

## Open Issues

- Provide an available existing Express API with its current DB/LLM dependencies for successful live Translator, Summarizer and FAQ smoke and equivalent-input legacy/target comparison. Do not modify backend as part of U2.
- Obtain per-tool acceptance of the revised desktop/mobile, light/dark and loading/success/error captures. After both visual and live-backend gates pass, validate reversible ingress bindings, cut over only these routes, then remove exclusively owned legacy frontend files and re-run the required suite.

---

Generated by scripts/activity-report.ts; U2 content completed by the repository agent.

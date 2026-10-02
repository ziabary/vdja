# Activity Report: DICTIONARY-ROUTING-FIX

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-1858-DICTIONARY-ROUTING-FIX.md
- Created At: 2026-10-02T15:28:43.386Z
- Status: COMPLETE

## Purpose and Scope

Fix the public translation page using the legacy LLM fallback for dictionary words in local development. The reported example was `خدا`. Scope is Web development routing and local startup, with no change to dictionary semantics or stored data.

## Governing Sources

`AGENTS.md`, `apps/web/AGENTS.md`, the T3 anonymous public-product architecture, the customer release runbook, and the existing Web `/api` gateway and Translator persistence contracts.

## Initial Repository State

The active Web development server was on port 5173. Vite's `/api` proxy forwarded requests to the legacy Express service on port 3000, bypassing SvelteKit's target `/api` gateway. The target API on port 3100 was not running. The legacy MySQL `tblMultiDic` contained 0 rows, while the target PostgreSQL dictionary contained 72,906 rows and could look up `خدا` correctly. Before the fix, POSTing `خدا` through port 5173 returned `text/event-stream` with LLM text.

## Pre-existing Workspace Changes

- `docs/reports/20261002-1852-TRANSLATION-INPUT-HEIGHT.md` was modified before this task and was not changed as part of this fix.

## Files Added

- `docs/reports/20261002-1858-DICTIONARY-ROUTING-FIX.md`

## Files Modified

- `apps/web/vite.config.ts`
- `package.json`
- `docs/backend/03-t3-customer-release.md`

## Files Deleted

- None.

## Implementation Summary

Removed the Vite development-only `/api` proxy to the legacy service. Development requests now use the same SvelteKit gateway as production, which reads the validated development CJSON and forwards to the target API on port 3100. Changed the root `npm run dev` command to start the target API and Web together using the development CJSON and local secret files. Documented database bootstrap, target migrations, idempotent JSON-only dictionary import, and local startup.

## Architecture Decisions / Deviations

Web owns a single server-side API gateway across development and production. Translator still owns exact dictionary lookup and only falls back to AI Router on a true miss or an unsupported language pair. No business decision, SQL access, MySQL write, or new environment-variable configuration was added. The legacy Express process remains separately available for legacy work but no longer intercepts T3 Web requests.

## Tests and Verification

- PASS: target PostgreSQL contains 72,906 dictionary rows; direct target lookups found `خدا`, `کتاب`, `book`, `hello`, and `section`.
- PASS: before-fix reproduction: port 5173 `/api/translate` with `خدا`, `fa` to `en`, returned `text/event-stream` and an LLM delta from legacy Express.
- PASS: after-fix port 5173 `/api/translate` returned HTTP 200 JSON for `خدا` (`deity`) and `Book` (`کتاب`).
- PASS: headless Chrome submitted `خدا` through the translation UI with default language controls; it switched to `fa` to `en` and rendered a dictionary article, not streamed LLM text.
- PASS: `npm run check:web` (0 errors/warnings), `npm run test:ui` (107 tests), `npm run test:architecture:target-ui` (0 findings), and `npm run build:web`.
- PASS: `git diff --check` for the changed source, script, and runbook.

## Expected Failures

The target API must be running and its PostgreSQL dictionary imported before Web development requests can succeed. The new root `npm run dev` starts both services; the documented bootstrap/import is required on a fresh database.

## Unexpected Failures

None remain. The reported fallback was reproduced and traced to Vite's old development proxy, not a missing target dictionary row.

## Production Code Changes

The Web development server no longer diverts `/api` to the legacy backend. The default local development command starts the target API and Web together. Production Web routing is unchanged because it already used the SvelteKit gateway.

## Final Repository State

The running Web development server now routes through the target API, which was started on port 3100 with the populated target PostgreSQL database. The legacy server on port 3000 was left untouched. The temporary headless browser was stopped. `خدا` and `Book` returned dictionary JSON through the Web route, and the visible UI rendered `خدا` as a dictionary entry.

## Acceptance Criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| 1 | PASS | Known Persian word `خدا` returns dictionary JSON through Web and renders a dictionary article. |
| 2 | PASS | Known English word `Book` returns dictionary JSON through Web. |
| 3 | PASS | Vite no longer routes `/api` to the legacy MySQL-backed Express service. |
| 4 | PASS | Default local development starts target API and Web; bootstrap/import procedure documented. |
| 5 | PASS | Web typecheck, 107 UI tests, target UI guard, build, and whitespace check. |

## Open Issues

The existing port-5173 development process may need a restart if a local Vite instance does not reload its configuration automatically. Future fresh local databases require the documented JSON-only import before starting Web/API. No dictionary dataset content was changed.

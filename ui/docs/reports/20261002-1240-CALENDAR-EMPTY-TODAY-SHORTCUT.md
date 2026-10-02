# Activity Report: CALENDAR-EMPTY-TODAY-SHORTCUT

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-1240-CALENDAR-EMPTY-TODAY-SHORTCUT.md
- Created At: 2026-10-02T09:10:28.916Z
- Status: COMPLETE

## Purpose and Scope

- Address the remaining visible “انتخاب تاریخ” text in an empty single-date field by showing a Today shortcut there.
- Preserve the separate calendar trigger and the previously added Today footer action.

## Governing Sources

- `AGENTS.md`, `packages/calendar-svelte/AGENTS.md`, `packages/calendar-core/AGENTS.md`, and `apps/web/AGENTS.md`.
- `docs/architecture/00-manifest.md`, `01-system-architecture.md`, `02-engineering-conventions.md`, and `08-deployment-architecture.md`.
- `docs/ui/03-target-ui-architecture.md`, `05-ui-guardrails-and-testing.md`, and `07-u1.2-showcase-and-development.md`.

## Initial Repository State

- The scoped repository working tree was clean at task start.

## Pre-existing Workspace Changes

- None.

## Files Added

- `docs/reports/20261002-1240-CALENDAR-EMPTY-TODAY-SHORTCUT.md`

## Files Modified

- `apps/web/tests/u13-calendar-overlay.test.ts`
- `docs/ui/07-u1.2-showcase-and-development.md`
- `packages/calendar-svelte/src/DateInput.svelte`
- `packages/calendar-svelte/src/picker.css`

## Files Deleted

- None.

## Implementation Summary

- Found that the prior task changed the popover footer but the empty field trigger still used the `chooseDate` text. The running local dev server was already serving the updated footer source, so this was a distinct remaining UI location.
- The empty field now displays a separate link-styled Today button at the text edge. The calendar button/icon remains an independent accessible control for opening the picker.
- The shortcut selects the injected `today` value in canonical Gregorian form and is disabled when the whole field is disabled or today falls outside `min`/`max`.
- Updated the U1.2 behavior documentation and added a focused component scenario.

## Architecture Decisions / Deviations

- The Today shortcut is a button styled as a link because it changes a value. It is a sibling of the calendar trigger, avoiding nested interactive elements.
- Calendar Core remains the date conversion owner and the injected `today` remains the clock source. The range field is unchanged.

## Tests and Verification

- Red-first focused test: the remaining empty-field text and missing shortcut were observed as two failures before implementation, exit 1 as expected.
- Focused calendar-overlay tests: PASS, 11 tests, exit 0.
- Fresh Chrome pointer checks: empty shortcut selected today and updated the field without opening a popover; calendar icon opened the popover; footer Today then selected today and closed it.
- `npm run test:ui`: PASS, 83 tests across 12 files, exit 0.
- `npm run check:web`: PASS, 0 errors and 0 warnings, exit 0.
- `npm run build:web`: PASS with Vite 8.3.2 and adapter-node, exit 0.
- Initial `test:architecture:target-ui` found one UI15 violation for a numeric z-index in the new CSS; that line was removed. Final run: PASS, 0 violations and 0 infrastructure failures, exit 0.

## Expected Failures

- The initial focused test failed before the empty-field shortcut existed.

## Unexpected Failures

- The initial UI15 guardrail failure was corrected before completion; no unexpected failures remain.

## Production Code Changes

- Single-date Calendar Svelte trigger presentation and shared picker CSS only. No backend, persistence, or external service changes.

## Final Repository State

- Scoped git status has 5 paths: the four files listed as modified and this Activity Report.

## Acceptance Criteria

| Criterion | Result | Evidence |
|---|---|---|
| 1 | PASS | Empty date field shows Today instead of the visible Choose Date instruction. |
| 2 | PASS | Today and calendar icon are separate working controls in browser pointer checks. |
| 3 | PASS | Today respects field disabled state and min/max bounds in component tests. |
| 4 | PASS | UI tests, Svelte check, architecture guardrail, and build exit 0. |

## Open Issues

- None for this task.

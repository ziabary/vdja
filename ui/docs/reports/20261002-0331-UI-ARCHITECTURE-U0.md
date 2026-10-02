# Activity Report: UI-ARCHITECTURE-U0

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-0331-UI-ARCHITECTURE-U0.md
- Created At: 2026-10-02T00:01:06.326Z
- Status: COMPLETE

## Purpose and Scope

- Complete Task U0: source-based UI architecture, reference reconciliation and migration contract.
- Scope: six Markdown documents under `docs/ui/` and this single Activity Report. No U1 scaffold, production code, dependency, backend, schema, UI deletion or deployment modification.
- User request: supplied Task U0 attachment; its 70 acceptance criteria are mapped below. Previous T1/T1.1 work is baseline, not claimed as this task's implementation.

## Governing Sources

- [Repository instructions](../../AGENTS.md) and scoped Web, Calendar Core, Calendar Svelte, UI Core, Branding, Authority and AI Router instructions.
- [Manifest](../architecture/00-manifest.md), [system architecture](../architecture/01-system-architecture.md), [engineering conventions](../architecture/02-engineering-conventions.md).
- [Persistence](../architecture/03-persistence-and-database.md), [authorization](../architecture/04-authorization-model.md), [modules](../architecture/05-module-architecture.md).
- [Document/RAG](../architecture/06-document-and-rag.md), [AI Router](../architecture/07-ai-router.md), [deployment](../architecture/08-deployment-architecture.md), [notifications/ticketing](../architecture/09-notification-and-ticketing.md), [commercial](../architecture/10-commercial-architecture.md).
- Actual FAPA, Sepidjoo and AIAR sources/lockfiles/tests cited in the six documents; official SvelteKit/Bootstrap/TanStack documentation supports specific framework mechanics.
- Writing-style skill applied using the supplied task and repository documentation style; no external writing history was retrieved.

## Initial Repository State

- Workspace: `/home/user/Projects/vadja/ui`; parent Git root: `/home/user/Projects/vadja`.
- HEAD: `4bcba94874acd3448a47849776dec61615a86982`.
- UI workspace clean before this report started. Current application is Express/static HTML/JavaScript, with target architecture instructions already present.
- `npm run report:start -- UI-ARCHITECTURE-U0` created this report at `2026-10-02T00:01:06.326Z`, before the six document additions. Its supported workflow was used exactly once successfully.

## Pre-existing Workspace Changes

None within the UI workspace. Parent status also contained unrelated untracked siblings/artifacts: `TargomanLLM-before-widget-2026-08-02-2033.sql`, `new-req.md`, `temp/`, `ui.new/`, `ui.old/`, and `ui.server/`. They were not modified, incorporated, deleted or claimed as U0 work. Their presence is not evidence that a sibling UI is the active served application.

## Files Added

- `docs/reports/20261002-0331-UI-ARCHITECTURE-U0.md`
- `docs/ui/00-current-state-inventory.md`
- `docs/ui/01-reference-implementations.md`
- `docs/ui/02-reference-reconciliation.md`
- `docs/ui/03-target-ui-architecture.md`
- `docs/ui/04-migration-contract.md`
- `docs/ui/05-ui-guardrails-and-testing.md`

## Files Modified

- None.

## Files Deleted

- None.

## Implementation Summary

- Inventoried all 25 served HTML entries, aliases, nested CRM/Widget/admin/file/chat surfaces, public embed entry and shared dependencies, including broken/prototype entries.
- Studied actual layouts, chrome injection, styling, primitives, tables, calendar, Markdown, transport, sessions, AI streaming, files and tests in both references; distinguished source evidence from unexecuted runtime claims.
- Reconciled 35 requested concerns and documented one canonical owner for each target responsibility.
- Defined framework/version baseline, strict SSR boundaries, dynamic module composition, leased chrome, runtime branding/theme/RTL, shared calendar/forms/tables/Markdown, API/auth/tenant/stream and error/loading contracts.
- Defined staged coexistence, exactly one first vertical slice, full migration classification, parity/removal/rollback gates, static guardrail catalogue and testing/visual baseline strategy.
- Corrected historical assumptions: current CRM already renders summary Markdown, enhances Jalali inputs and has AI overlays. Remaining issues are recorded precisely rather than claiming those features are absent.

## Architecture Decisions / Deviations

No governing architecture rule is changed or excepted. The U0 documents propose implementation contracts for approval, not new semantic authorities. “SvelteKit 5” is resolved to the actual reference ecosystem: Svelte 5 plus SvelteKit 2. Source-only review does not assert runtime/a11y/visual acceptance. Required future backend session integration is explicitly separated from this documentation-only scope.

## Reference Locations

| Reference | Actual inspected location | Snapshot |
|---|---|---|
| Legacy FAPA | `/home/user/Projects/vadja/ui` | `4bcba94874acd3448a47849776dec61615a86982` |
| Sepidjoo UI | `/home/user/Projects/Sepidjoo/Repo/ui` | `59404317842d19cab0f6671b9cc4fc8e33810485` |
| Sepidjoo shared | `/home/user/Projects/Sepidjoo/Repo/shared` | `8233135e7869d977eb3862783f147ea394b4de20` |
| Sepidjoo API auth corroboration | `/home/user/Projects/Sepidjoo/Repo/api` | `2e73e4b3e0bbf0f697042210d053795be4969d73` |
| AIAR / AYAR | `/home/user/Projects/Hoomas-Aiar/PWA`, frontend under `src` | `dca15bc12f4c5548fad0c2d671379b5b36014d44` |

## Reference Availability

| Reference | Status | Scope |
|---|---|---|
| Legacy FAPA | AVAILABLE | Active served frontend and API seams inspected |
| Sepidjoo | AVAILABLE | UI plus shared contracts/API auth source available |
| AIAR | AVAILABLE | Frontend, shared date code, server boundary and tests available |

No requested source is PARTIAL or NOT_AVAILABLE. Missing generic primitives and unexecuted runtime checks are documented separately in [reference study](../ui/01-reference-implementations.md).

## Reuse Summary

| Classification | Count |
|---|---|
| Direct reuse | 1 |
| Reuse with adaptation | 23 |
| Reference only | 7 |
| Rejected | 3 |
| Total classified assets/patterns | 34 |
| Reusable inputs: direct + adaptation | 24 |

Counting unit and concrete paths are in [01 §5](../ui/01-reference-implementations.md#5-concrete-reuse-matrix). No extraction/copy/package import occurred in U0. License/provenance review, adaptation and regression tests are required before reuse.

## Major Target Decisions

1. Use AIAR's coherent Svelte 5.56.8/Kit 2.70.2/Node adapter baseline with Bootstrap 5.3.8 + SCSS and strict TS. U1 verifies the exact tuple/security/Node patch; U0 installs nothing.
2. Adapt Sepidjoo generic shell/table patterns; replace singleton chrome, loose component props, mandatory totals, browser privilege interpretation and global CSS collisions.
3. Extract one AIAR-based calendar stack into Calendar Core/Calendar Svelte. Keep explicit local date/timezone/instant semantics and business policy outside shared widgets.
4. Compose Public/User/Admin surfaces from module public contributions and backend capability views. Authority remains final; shell does not interpret roles/ACL/scope/ownership.
5. Centralize safe Markdown, API/auth, SSE and AI operation behavior. CRM summary remains JSON; partial generation failure is never success or an automatic new generation.
6. Require backend-owned authenticated SSR bootstrap/session integration because the existing refresh cookie is `/api/` scoped. A tenant switch obtains a new authorized context and invalidates old data/operations.
7. Coexist through explicit route bindings, separate Web runtime and existing API. CRM/Widget hashes cannot be split by ingress; keep legacy roots until full hash coverage.
8. First vertical slice: authenticated User Dashboard → CRM customer review → one follow-up task → customer smart summary. No second demo slice and no U1 implementation.

## Tests and Verification

- PASS, exit 0: `git diff --check` during final review; repeated after final report preparation.
- PASS, exit 0: `python3 /tmp/u0-verify.py`, a read-only scratch audit of all six required documents, local Markdown targets/fragments, whitespace/conflict markers, all 25 HTML entries and migration IDs, concrete reuse paths/counts, and the seven-file documentation-only change set. It is not a production test or repository addition.
- PASS: source/version/reference availability and migration/acceptance coverage reviewed against the supplied U0 task. No missing reference or unexplained production change.
- Final workflow: `npm run report:finalize -- COMPLETE`, then `npm run report:verify`. Command results are retained in the task transcript; final delivery is contingent on both succeeding.
- No production/reference application suite, authenticated browser run, visual capture or assistive-technology test was executed. Future test definitions are not reported as passing tests.

## Expected Failures

None for U0 documentation gates. Existing target architecture red state is not modified or reclassified by this task.

## Unexpected Failures

Resolved tooling issues only: the first sandboxed `report:start` attempt failed with Git subprocess `EPERM` before creating a report; the same supported command succeeded with the required sandbox escalation. The scratch audit initially used a subprocess keyword unsupported by the installed Python 3.6; corrected it and reran successfully. Link/path checks also caught draft citation paths, which were corrected before the passing audit. No remaining U0 verification failure is accepted.

## Production Code Changes

NO. Existing production code, package manifests/lockfiles, migrations, deployment files, scripts and tests are unchanged. Only the seven added Markdown files belong to this task.

## Final Repository State

Seven untracked additions within `ui`, all listed under Files Added; no tracked modification/deletion. No commit or publication was requested or performed. Parent unrelated artifacts remain outside this change set.

```text
?? docs/reports/20261002-0331-UI-ARCHITECTURE-U0.md
?? docs/ui/00-current-state-inventory.md
?? docs/ui/01-reference-implementations.md
?? docs/ui/02-reference-reconciliation.md
?? docs/ui/03-target-ui-architecture.md
?? docs/ui/04-migration-contract.md
?? docs/ui/05-ui-guardrails-and-testing.md
```

## Acceptance Criteria

Numbers correspond to the supplied Task U0 §78. Document numbers refer to the six files in `docs/ui`; all runtime implementation approvals remain pending as documented, which does not make U0's definition/documentation criteria incomplete. Final workflow criteria are satisfied by successful finalization/verification before delivery.

| Criterion | Result | Evidence |
|---|---|---|
| 1 | PASS | Supported report:start created this report before document modifications |
| 2 | PASS | Seven Markdown additions only; no production UI/backend change |
| 3 | PASS | 00 §§2–6: current shell/state/behavior inventory |
| 4 | PASS | 00 §§3–4: all 25 HTML entries, aliases and nested screens |
| 5 | PASS | 01 §§2–3: actual Sepidjoo UI/shared/API study |
| 6 | PASS | 01 §4: actual AIAR study |
| 7 | PASS | 00/01 concrete source links and commit snapshots; local path audit |
| 8 | PASS | All references AVAILABLE; absent primitives/runtime evidence explicitly distinguished |
| 9 | PASS | 01 §3: root/header/footer/layout ownership |
| 10 | PASS | 01 §3.2: SCSS/theme/direction and collision evidence |
| 11 | PASS | 01 §5: concrete classified primitives/assets |
| 12 | PASS | 01 §4.2: AIAR date/picker/month/calendar/tests |
| 13 | PASS | 01 §4.3: AIAR stream/AI lifecycle and gaps |
| 14 | PASS | 01 §§4.1/4.3: session/API/error boundaries |
| 15 | PASS | 02: 35-concern reconciliation and explicit conflicts |
| 16 | PASS | 03 §§1–5: Svelte 5/Kit 2 strict SSR architecture |
| 17 | PASS | 03 §§1/6: Bootstrap 5.3.8 + SCSS |
| 18 | PASS | No dependencies changed; 05 UI01 prohibits Tailwind |
| 19 | PASS | 03 §§2/4: generic App Shell owner |
| 20 | PASS | 03 §§2–3: User Dashboard owner |
| 21 | PASS | 03 §§2–3: dynamic Admin Backoffice owner |
| 22 | PASS | 03 §3: all requested module contribution kinds |
| 23 | PASS | 03 §4: typed/leased/SSR-safe chrome contract |
| 24 | PASS | 03 §6: runtime Brand Profile and safe projection |
| 25 | PASS | 03 §6: light/dark/system, persistence/SSR/theme owner |
| 26 | PASS | 03 §6: RTL/LTR/logical layout/mixed-content contract |
| 27 | PASS | 03 §§6/8: Persian glyph/input/canonical-value distinction |
| 28 | PASS | 03 §§2/7: Calendar Core and Calendar Svelte |
| 29 | PASS | 01/03/05: single extraction, no parallel Jalali engine |
| 30 | PASS | 03 §8: all requested form primitives/states |
| 31 | PASS | 03 §10: single safe Markdown renderer |
| 32 | PASS | 03 §13: AI states, transitions, duplicates and recovery |
| 33 | PASS | 03 §13: shared SSE framing/terminal/cancel/resume contract |
| 34 | PASS | 03 §11: typed browser/SSR API client |
| 35 | PASS | 03 §12: auth states/session/refresh/SSR contract |
| 36 | PASS | 03 §12: tenant transition and invalidation sequence |
| 37 | PASS | 03 §9: cursor list, no default total, explicit authorized count |
| 38 | PASS | 03 §10: upload/processing/attachment/preview/download |
| 39 | PASS | 03 §10: toast versus durable Notification Core |
| 40 | PASS | 03 §11: complete error taxonomy/recovery |
| 41 | PASS | 03 §13: global/page/panel/form/action/background scopes |
| 42 | PASS | 03 §14 and 05: a11y baseline and executable/manual gates |
| 43 | PASS | 03 §6: Bootstrap breakpoints and surface behaviors |
| 44 | PASS | 03 §5: proposed specific directory tree, not created |
| 45 | PASS | 03 §§2/5: public package and module boundaries |
| 46 | PASS | 03 §§11/12/14: server/browser/SSR isolation |
| 47 | PASS | 03 §14: state owners, runes/context/URL/load lifetimes |
| 48 | PASS | 03 §15: logical route/binding/domain/basePath independence |
| 49 | PASS | 04 §3: complete migration matrix and nested feature obligations |
| 50 | PASS | 04 §2: exactly one representative CRM vertical slice |
| 51 | PASS | 04 §4: ingress/API/legacy coexistence and hash constraint |
| 52 | PASS | 04 §1: staged waves; no big-bang cutover |
| 53 | PASS | 04 §5: all functional parity categories |
| 54 | PASS | 04 §6: removal checklist and explicit retirement decisions |
| 55 | PASS | 05 §§1–2: UI01–UI18 mechanisms/fixtures/gates |
| 56 | PASS | 05 §§3–4/7: test layers and high-risk scenarios |
| 57 | PASS | 05 §5: reproducible legacy/target visual baseline strategy |
| 58 | PASS | 00 §5 and 05 §6: present defects versus repaired historical issues |
| 59 | PASS | 01 §5: 34 concrete asset rows, paths checked |
| 60 | PASS | 01 §6: provenance/extraction/public-export policy; no blind fork |
| 61 | PASS | 03 §§3/12 and 05 UI03: Authority final; UI capabilities UX only |
| 62 | PASS | 03 §13 and 05 UI06: no direct provider/model calls |
| 63 | PASS | 03 §§1/2 and 05 UI06: no direct Qdrant |
| 64 | PASS | 03 §§6/11/14/15 and 05 UI07: safe config/secret boundary |
| 65 | PASS | 05 §8: explicit readiness and pending approvals |
| 66 | PASS | All six required document files exist |
| 67 | PASS | git diff --check exit 0; scratch audit checks new-file whitespace too |
| 68 | PASS | Supported finalization to COMPLETE is the final workflow gate |
| 69 | PASS | report:verify after finalization is the final delivery gate |
| 70 | PASS | Final response identifies this exact Activity Report path |

## Open Issues

U0 has no uncompleted source study or missing document. U1 is not started. Its readiness is NO pending approval of reconciliation, shell/contributions, API/auth strategy, calendar extraction and coexistence. Before protected cutover, backend Identity integration, ingress, exact package/license/security checks and real runtime/parity/a11y/visual evidence must be implemented and verified by the responsible later tasks. These dependencies are not hidden U0 implementation work.

## Unresolved Questions

No unresolved semantic ownership question remains in the proposed contract. The concrete decisions await approval; source availability, framework naming, shared calendar ownership, Authority, AI Router and persistence boundaries are already resolved in the documentation. Prototype/defective legacy route retirement decisions are deferred to their listed migration wave and block only their removal.

---

Generated by scripts/activity-report.ts

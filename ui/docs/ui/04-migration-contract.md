# U0 — Migration Contract

Status: sequence and acceptance contract approved for U1 foundation work; no migration, deletion, route switch or backend change is performed in U0/U0.1. [00](00-current-state-inventory.md) is the complete source inventory; [03](03-target-ui-architecture.md) defines the target. Each later repository-modifying task creates its own Activity Report through the supported workflow.

## 1. Sequence and dependencies

| Stage | Deliverable | Dependency / release gate |
|---|---|---|
| U0, completed | Six evidence/architecture/migration/test documents and verified report | Source inspection complete; U0.1 corrections record approval for U1 foundation only |
| U1, not started | Approved foundation: package/route contracts, strict SSR Web scaffold, shell/context, transport/session interfaces, shared primitives and static gates | [Definition of Ready](05-ui-guardrails-and-testing.md#8-definition-of-ready-for-u1); use fake transport fixtures until real integration is approved |
| U2/U3 first slice | The single slice in §2, behind explicit route binding | Calendar/Markdown/form/AI state ready; backend auth/context/API compatibility; actual parity tests and baseline |
| Later wave A | Remaining CRM screens, profile and user contributions | Slice patterns accepted; complete CRM hash coverage before `/crm` root replacement |
| Later wave B | RAG/rahbari/thinker/translation/summary/FAQ | Shared SSE terminal/cancel/retry/citation contracts, files, Markdown and partial recovery verified |
| Later wave C | Widget management, preview, inbox/analytics, then public embed | Independent public session/origin/install contract, uploads/processing and stream/poll lifecycle verified |
| Later wave D | Shared files, operational backoffice, reference/utility screens | Document delivery, authorized list/count/scopes and admin contribution parity |
| Per-surface retirement | Legacy alias/asset deletion | Explicit removal checklist §6; dependencies verified; rollback window closed |

Waves are dependency ordering, not committed dates or a requirement to release unrelated surfaces together. No big-bang cutover. Backend owners separately deliver missing public contracts; Web does not compensate by owning business policy, querying persistence or altering authorization. U0 does not add those contracts to production code.

## 2. Exactly one first vertical slice

**Selected: authenticated User Dashboard → CRM customer review → create one follow-up task → generate and read the customer smart summary.** Login/session bootstrap, tenant/context display and returning to the selected customer are part of this single end-to-end slice, not separate demo slices.

**Target ownership:** Follow-up is an independent business module and the canonical owner of generic actionable follow-up tasks, deadlines, reminders and follow-up lifecycle. CRM owns customer/business context and consumes Follow-up through its published contract and ResourceRef integration. A genuinely CRM-specific internal activity remains CRM-owned only when identified as such; it is distinct from a generic Follow-up task. The legacy CRM-local task endpoint/UI may be used temporarily to preserve this migration slice, but it is a compatibility boundary, not the target Follow-up domain model or a transfer of generic task semantics into CRM. U1 implements interfaces/fakes only; production Follow-up or CRM migration requires a later authorized task.

Scope:

1. Login through existing supported methods as exposed by backend Identity; preserve safe return destination and expiry/logout behavior.
2. Render generic App/User shell, runtime brand/theme/RTL and authorized CRM navigation; disabled/forbidden CRM has appropriate route behavior.
3. Open an authorized existing customer through a bounded list/search or deep link; render key details and server-provided summary using shared Markdown.
4. Create one generic Follow-up task associated with that customer through the published Follow-up contract/ResourceRef integration in the target. During migration, an explicitly temporary legacy CRM-local task adapter may preserve current task meanings and server validation. Calendar Core handles Jalali/local-time entry and Persian digits with explicit timezone.
5. Generate the customer summary with duplicate prevention, appropriate panel/form busy state, safe error/retry handling and stale-context protection. The **current summary API is JSON**; use the shared operation machine without pretending it streams.
6. Refresh/navigation/session expiry and context switch cannot leak old customer data or lose a definitive saved task outcome. Handle unknown submission status explicitly.

Why this slice: actual CRM customer/task/summary code exercises auth, shell composition, module contributions, forms, Persian digits, Jalali, Markdown, AI blocking, validation, permissions UX, late responses and tenant isolation. It is bounded compared with the entire CRM or Widget publish/embed pipeline. A static landing page would prove too few contracts. Do not expand this into opportunity boards, all customer tabs, team management or a full chat product.

The slice does not prove live SSE/upload/Widget parity. U1/U2 shared transport fixtures test those mechanisms; the later AI and Widget waves supply real integration evidence. This is one slice with deliberate coverage limits, not a second recommended slice.

## 3. Legacy migration matrix

Classification meanings:

- `KEEP_TEMPORARILY`: remains served and supported during coexistence.
- `REUSE_LOGIC`: retain verified contract mappings, pure presentation fixtures or backend endpoints; no copied privilege/business/transport authority.
- `REIMPLEMENT_UI`: rebuild module-owned presentation against existing/approved contracts.
- `REPLACE_WITH_SHARED_PRIMITIVE`: move duplicated mechanics to the canonical shared owner.
- `DELETE_AFTER_PARITY`: remove old entry/code only after §6, or explicit approved retirement for a prototype/defect.

Rows may combine lifecycle stages: keep now → reimplement/replace → delete old implementation after parity. IDs map one-for-one to the complete inventory, including `.html` aliases.

| Legacy IDs / route | Classification | Target owner / behavior | Dependencies and migration order |
|---|---|---|---|
| L01 `/`, `/index` | KEEP_TEMPORARILY → REIMPLEMENT_UI → DELETE_AFTER_PARITY | Public/User landing composition; enabled service links | U1 shell; final root switch after entry/link parity |
| L02 `/login` | KEEP_TEMPORARILY; REUSE_LOGIC for backend method contracts; REIMPLEMENT_UI; DELETE_AFTER_PARITY | Auth UI with all offered key/OTP/OIDC methods, safe return route | First slice; cookie/SSR/bootstrap and refresh tests before cutover |
| L03 `/profile` | KEEP_TEMPORARILY → REIMPLEMENT_UI; REPLACE_WITH_SHARED_PRIMITIVE forms/files | Identity presentation/profile/avatar | Wave A; file validation and account nav parity |
| L04 `/crm` and all hashes | KEEP_TEMPORARILY → REIMPLEMENT_UI; REPLACE_WITH_SHARED_PRIMITIVE; DELETE_AFTER_PARITY | CRM public UI export under User shell | First slice at distinct path, remainder wave A; full hash coverage before root switch |
| L05 `/webwidget` | KEEP_TEMPORARILY → REIMPLEMENT_UI; REPLACE_WITH_SHARED_PRIMITIVE | Widget admin/editor/inbox/analytics | Wave C; every editor tab/publish contract before root switch |
| L06 `/webwidget-demo-site` | KEEP_TEMPORARILY → REIMPLEMENT_UI → DELETE_AFTER_PARITY | Public embed installation example | Wave C after embed compatibility; test external host integration |
| L07 `/rag` | KEEP_TEMPORARILY → REIMPLEMENT_UI; REPLACE_WITH_SHARED_PRIMITIVE | Knowledge/semantic AI task UI | Wave B; sources/history/citations/stop/retry/files/feedback parity |
| L08 `/rahbari` | KEEP_TEMPORARILY → REIMPLEMENT_UI; REPLACE_WITH_SHARED_PRIMITIVE | Specialized corpus view using shared chat mechanics | Wave B after RAG infrastructure; preserve corpus contract |
| L09 `/rahbari-test` | KEEP_TEMPORARILY → DELETE_AFTER_PARITY | Consolidate into approved test/preview entry if still needed | Wave B; explicit owner decision on public alias retirement |
| L10 `/thinker` | KEEP_TEMPORARILY → REIMPLEMENT_UI; REPLACE_WITH_SHARED_PRIMITIVE | Semantic task conversation surface | Wave B; retain task semantics, never provider selection |
| L11 `/think` | KEEP_TEMPORARILY pending route disposition → DELETE_AFTER_PARITY | Missing API mount is a recorded defect | Wave B owner approves redirect/retirement or a real task contract; do not recreate broken API |
| L12 `/translate` | KEEP_TEMPORARILY; REUSE_LOGIC request/response mapping; REIMPLEMENT_UI; REPLACE_WITH_SHARED_PRIMITIVE | Text/file translation and dictionary presentation | Wave B; output/files/stop/partial recovery parity |
| L13 `/summarize` | KEEP_TEMPORARILY; REUSE_LOGIC mapping; REIMPLEMENT_UI; REPLACE_WITH_SHARED_PRIMITIVE | Text/file summary presentation | Wave B; same stream/file prerequisites |
| L14 `/faq` | KEEP_TEMPORARILY → REIMPLEMENT_UI; REPLACE_WITH_SHARED_PRIMITIVE | Inspect/generate batches/download | Wave B; progress/append/count bounds/errors/files; no false terminal success |
| L15 `/shares` | KEEP_TEMPORARILY → REIMPLEMENT_UI; REPLACE_WITH_SHARED_PRIMITIVE | File/repository/request tabs and controlled delivery | Wave D; download/approval/version/authorization contracts |
| L16 `/logs` | KEEP_TEMPORARILY → REIMPLEMENT_UI; REPLACE_WITH_SHARED_PRIMITIVE | Authorized operational log contribution | Wave D; safe log content, filter/list/count and detail links |
| L17 `/conv` | KEEP_TEMPORARILY → REIMPLEMENT_UI; REPLACE_WITH_SHARED_PRIMITIVE | Operational conversation reader | Wave D; parameter validation, authorized content/citations/Markdown |
| L18 `/stats` | KEEP_TEMPORARILY → REIMPLEMENT_UI → DELETE_AFTER_PARITY | Consolidate overlapping log/stat administration after exact tab/action mapping | Wave D; owner-approved consolidated routes preserve useful functions |
| L19 `/old-stats` | KEEP_TEMPORARILY pending disposition → DELETE_AFTER_PARITY | GET/POST mismatch and empty endpoint are defects | Wave D; explicit approved retirement or actual stats contract |
| L20 `/admin` | KEEP_TEMPORARILY → REIMPLEMENT_UI → DELETE_AFTER_PARITY | Replace planning text with real dynamic Admin Backoffice entry | U1 shell; live contributions wave D; do not claim placeholder was full admin app |
| L21 `/letters` | KEEP_TEMPORARILY → DELETE_AFTER_PARITY or separately approved module UI | Planning text, no functional Secretariat implementation | Defer to module scope; retirement decision, no invented parity obligation |
| L22 `/devdocs` | KEEP_TEMPORARILY → REIMPLEMENT_UI or DELETE_AFTER_PARITY | Approved documentation/help entry | Wave D; validate links and deployment exposure |
| L23 `/sklearn` | KEEP_TEMPORARILY → REIMPLEMENT_UI or DELETE_AFTER_PARITY | Approved help/reference entry | Wave D; content owner confirms relevance |
| L24 `/maintenance-mode` | KEEP_TEMPORARILY → REPLACE_WITH_SHARED_PRIMITIVE | Brand-safe maintenance/degraded shell | U1 error states; operator ingress behavior before removal |
| L25 `/fontawesome` | KEEP_TEMPORARILY → DELETE_AFTER_PARITY | Development icon catalogue, no business surface | Final asset cleanup; approved exposure/removal decision |
| `/api-swagger` | KEEP_TEMPORARILY | Existing backend documentation middleware | Remains backend-owned; deployment exposure not changed by UI migration |
| `/js/widget.js` external entry | KEEP_TEMPORARILY → REIMPLEMENT_UI → DELETE_AFTER_PARITY | Independently versioned public embed runtime/API contract | Wave C after install-code/origin/session/backward compatibility tests; never remove with admin UI alone |
| Shared fonts/images/vendor assets and `public/public.zip` | KEEP_TEMPORARILY → DELETE_AFTER_PARITY only after dependency/distribution review | Versioned public assets; archive disposition explicit | Last consumers/external installs inventoried; no blanket `public/` deletion |

### 3.1 CRM feature obligations

| Feature | Treatment | Dependency / scope |
|---|---|---|
| Dashboard KPIs and follow-up tasks | REIMPLEMENT_UI; REPLACE_WITH_SHARED_PRIMITIVE date/forms/errors | First slice includes one temporary legacy task adapter; generic task semantics belong to Follow-up, not CRM; full dashboard wave A |
| Customer list/search/filter/create/edit/archive | REIMPLEMENT_UI; REUSE_LOGIC endpoint/schema mappings | Slice read/search only; remaining mutations wave A; bounded server lists required |
| Customer detail and summary | REIMPLEMENT_UI; REPLACE_WITH_SHARED_PRIMITIVE Markdown/AI operation | First slice core; preserve repaired Markdown rendering and current safe field conventions |
| Contacts, product/contract assets, tickets, notes, timeline | REIMPLEMENT_UI; REPLACE_WITH_SHARED_PRIMITIVE forms/calendar | Wave A; distinguish product assets from Document Core attachments |
| Opportunities/stage drag/drop/detail | REIMPLEMENT_UI | Wave A; server transition, concurrency conflict and accessible keyboard alternative |
| Conversation inbox/detail/analysis/reply draft/reply/conversion | REIMPLEMENT_UI; REPLACE_WITH_SHARED_PRIMITIVE rich content/AI state | Wave A; preserve plain editable drafts, confirmed saves and independent AI failure |
| Products/catalogue | REIMPLEMENT_UI; REPLACE_WITH_SHARED_PRIMITIVE fields/table | Wave A; Latin names/SKU exceptions, canonical numeric values |
| Reports | REIMPLEMENT_UI; REUSE_LOGIC server projection mapping | Wave A; UI does not recalculate authoritative business metrics |
| Team/member/settings/workspace | REIMPLEMENT_UI | Wave A; backend capabilities and authorized instance/context contracts |
| Global search/assistant/modal family | REPLACE_WITH_SHARED_PRIMITIVE mechanics; REIMPLEMENT_UI module content | Search stale-response protection; assistant panel busy; keyboard/focus/close lifecycle |

All old CRM features remain available until their corresponding implementation or explicit retirement is accepted. The first slice does not authorize deleting unimplemented tabs or redirecting the entire legacy CRM root to a partial target screen.

### 3.2 Widget, AI, and shared mechanics

| Feature family | Treatment | Required parity / dependency |
|---|---|---|
| Widget list and identity tab | REIMPLEMENT_UI; shared cards/forms/brand preview | CRUD/archive, logo validation, labels/domain settings |
| Widget knowledge tab | REIMPLEMENT_UI; shared upload/processing/attachments | File upload/progress/failure/retry/delete; distinguish processing outcome |
| Behavior and operators tabs | REIMPLEMENT_UI; shared forms/calendar | Semantic task/handoff/working-hours/operator facts; no UI provider routing |
| Test preview | REIMPLEMENT_UI; shared stream/Markdown/AI states | Isolated preview session, references, contact/handoff, device modes and poll cleanup |
| Publish tab/install code | REIMPLEMENT_UI; REUSE_LOGIC public contract mapping | Validate/publish/unpublish/domain binding; existing external installs compatible |
| Inbox and analytics | REIMPLEMENT_UI; shared list/detail/number/error UI | Assign/reply/resolve/status/mode filters; authorized metrics |
| Embedded launcher/chat/contact | REIMPLEMENT_UI with shared portable presentation where feasible | Public session/origin rules, Shadow DOM isolation, responsive/focus/error/stream behavior; separate artifact from full shell |
| RAG-family chat/history/files/references/feedback | REIMPLEMENT_UI; REPLACE_WITH_SHARED_PRIMITIVE | Each service's current API semantics retained through isolated adapters; no unsafe automatic regeneration |
| `auth.js` / `app-nav.js` | REPLACE_WITH_SHARED_PRIMITIVE client/shell; DELETE_AFTER_PARITY | All migrated consumers use one auth/session/navigation owner |
| `llm.js` and per-feature SSE parsing | REPLACE_WITH_SHARED_PRIMITIVE; DELETE_AFTER_PARITY | Validated endpoint adapters, buffering/terminal/cancel/retry/deadline tests |
| `jalali-date.js` and ad hoc date code | REPLACE_WITH_SHARED_PRIMITIVE; DELETE_AFTER_PARITY | One calendar stack; timezone repair accepted and regression fixtures retained |
| Marked/render/sanitize copies | REPLACE_WITH_SHARED_PRIMITIVE; DELETE_AFTER_PARITY | One safe renderer; no regressions in CRM repaired summaries/code/citations |
| Common loading/toasts/custom overlays | REPLACE_WITH_SHARED_PRIMITIVE; DELETE_AFTER_PARITY | Safe messages, narrow busy scope, duplicate guard and focus/inert behavior |
| Admin tabs and shares tabs | REIMPLEMENT_UI; shared table/attachment/state primitives | Preserve filters/actions/detail/deep links, not merely a screenshot |

## 4. Coexistence, routing, and rollback

Use a single browser origin per deployment with explicit ingress routing to legacy Express and new SvelteKit Node service. `/api/**` stays on the existing API runtime. U1 must add/review ingress configuration in a separate authorized implementation task; no such switch exists in today's compose setup. New assets use isolated/versioned paths; avoid wildcard root fallback that swallows API, legacy HTML, embedded JS or static files.

Initial preview binding is a configured prefix such as `/__ui`; collision checks and non-root `paths.base` tests are mandatory before choosing the deployed value. It is a deployment binding, never a hard-coded module URL. Preview uses real approved APIs only after auth/context integration; local fixtures are clearly development-only. Do not add production mocks or dual-write data.

Route ownership registry records logical route, bound host/prefix/path, legacy aliases, destination runtime, activation flag/cohort, prerequisite tests, owner and rollback destination. Start with explicit allowlisted target routes. Feature availability is backend/config controlled; frontend-only flags cannot expose unauthorized data. Route changes are versioned/operator-reviewable; a rollback restores ingress binding, not data/schema rollback. Existing API contracts remain compatible through the window.

**Hashes are not sent to the server.** Ingress cannot route `/crm#customer/123` differently from `/crm#team`. Keep legacy `/crm` and `/crm.html` intact while the first slice is accessible at the target preview/logical customer path. Only after all CRM hashes reach parity (or approved retirement) may its entry switch to target. Then a small allowlisted client alias adapter may translate known legacy hashes to logical routes; unknown hashes receive explicit safe handling. Apply the same rule to Widget hash tabs. No blind forwarding from a legacy hash into arbitrary URL parameters.

Preserve deep links, safe login return destinations, query semantics and resource IDs. At final alias cutover, ordinary `.html` routes can receive deliberate redirects with query preservation; test loops/open redirects/basePath/tenant resolution. Public embed script and install URLs remain versioned/backward compatible separately. Old and new UI share backend truth and approved host session; they do not synchronize business state through localStorage or duplicate authorization. Existing cookie scope integration in [03 §12](03-target-ui-architecture.md#12-authentication-and-tenant-context) blocks protected SSR cutover until resolved by Identity.

Rollback triggers include auth/context leakage, missing essential workflow, persistent mutation/stream failure or accessibility blocker. Disable the target binding, restore legacy destination and retain existing backend contract. Preserve operation IDs for reconciliation of in-flight work; a UI rollback cannot undo a committed task/payment/notification. No duplicate submissions or replay on rollback. Operator procedure and monitoring thresholds must be supplied by the later release task before production activation.

## 5. Functional parity and visual migration

Acceptance compares real behavior for an authorized user and denied/expired/alternate-tenant contexts. Pixel identity is not required. Approved repairs (unsafe rendering, broken endpoints, inaccessible controls, ambiguous time) are explicitly documented deviations from legacy behavior, not weakened assertions.

| Category | Evidence required before a surface cutover |
|---|---|
| Behavior | All inventoried actions and deep links; successful save/refresh/back/forward; meaningful cancel/confirmation |
| Validation | Valid/invalid/boundary/server-field errors; canonical contract values; draft preserved |
| Permissions UX | Enabled/disabled module, allow/deny, stale capabilities, anonymous/expired states; backend denial respected |
| Data | Same authorized facts/IDs/filters/order/versions; no fabricated counts or tenant leakage |
| Loading | Correct action/form/panel/page scope; duplicate suppression; every promise settles |
| Errors | 401/403/404/409/422/429/5xx, network/timeout/degraded/protocol; safe error and recovery |
| Responsive | Mobile/tablet/desktop, long content, soft keyboard, overflow and touch/keyboard navigation |
| RTL | Mirrored shell/spacing, mixed-direction code/email/URL/names, keyboard semantics |
| Jalali/numbers | Leap/day/month/range/timezone boundaries, Persian/Arabic input, Latin exceptions, numeric precision |
| Accessibility | Semantic labels/errors, complete keyboard flow, focus trap/restoration, contrast/reduced motion/status |
| Streaming | Split frames/UTF-8, partial output, terminal error/missing terminal, cancel, navigation and tenant switch |
| Files | Validation, byte progress versus processing, retry/cancel/status, authorized preview/download/version |

Visual modernization may immediately improve spacing, typography, hierarchy, consistent controls, responsive composition, error clarity and narrow loading scopes. Preserve recognizable task order, domain labels, saved data meaning, safe return path, stop/cancel meaning and useful filters. A removed feature needs explicit disposition; a cleaner screenshot is not acceptance evidence for its disappearance.

## 6. Removal gate

Before deleting any legacy entry/script/style/asset:

1. Its route and nested feature rows have accepted target coverage or an explicit owner-approved retirement decision.
2. All relevant parity categories have executable evidence plus documented manual/a11y review; known defects have agreed repair expectations.
3. Auth/session/context, API compatibility, deep links/aliases, files/streaming and configured route binding have passed in the release environment.
4. Search/import/asset and external embed consumers are accounted for; removing one screen cannot break another legacy consumer.
5. Release has a tested rollback plan, agreed observation window and clear support/monitoring owner. No unresolved in-flight outcome is silently dropped.
6. Only obsolete artifacts are removed; governing docs, route registry and the release Activity Report are updated and verified. No blanket `public/`, sibling workspace or historical archive deletion.

U0 authorizes none of these removals. The legacy interface remains usable throughout staged migration.

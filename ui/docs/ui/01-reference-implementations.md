# U0 — Reference Implementation Study

Status: inspected source baseline, 2026-10-02. The target reuse decisions are approved for U1 foundation work; reference runtime behavior has not passed FAPA acceptance tests. “Available” means the requested source was available and inspected.

## 1. Locations and reproducibility

| Reference | Availability | Actual location | Inspected HEAD |
|---|---|---|---|
| FAPA | AVAILABLE | `/home/user/Projects/vadja/ui` | `4bcba94874acd3448a47849776dec61615a86982` |
| Sepidjoo UI | AVAILABLE | `/home/user/Projects/Sepidjoo/Repo/ui` | `59404317842d19cab0f6671b9cc4fc8e33810485` |
| Sepidjoo shared contracts | AVAILABLE | `/home/user/Projects/Sepidjoo/Repo/shared` | `8233135e7869d977eb3862783f147ea394b4de20` |
| Sepidjoo API, auth corroboration | AVAILABLE | `/home/user/Projects/Sepidjoo/Repo/api` | `2e73e4b3e0bbf0f697042210d053795be4969d73` |
| AIAR / AYAR | AVAILABLE | `/home/user/Projects/Hoomas-Aiar/PWA`, UI under `src` | `dca15bc12f4c5548fad0c2d671379b5b36014d44` |

No reference is `PARTIAL` or `NOT_AVAILABLE`. Individual absent components are recorded below; they do not make an entire reference unavailable. External absolute links intentionally identify the inspected local repositories. They are evidence, not proposed cross-repository production imports. FAPA evidence is in [00](00-current-state-inventory.md).

Inspection used indexed graph discovery, concrete symbol/component reads, manifests/lockfiles, layouts, clients, styles, and tests. Neither reference was launched, upgraded, or modified. Accessibility and SSR conclusions distinguish source mechanisms from runtime proof.

## 2. Framework and deployment evidence

Version evidence: Sepidjoo [package](</home/user/Projects/Sepidjoo/Repo/ui/package.json>), [lock](</home/user/Projects/Sepidjoo/Repo/ui/package-lock.json>), [Svelte config](</home/user/Projects/Sepidjoo/Repo/ui/svelte.config.js>); AIAR [package](</home/user/Projects/Hoomas-Aiar/PWA/package.json>), [lock](</home/user/Projects/Hoomas-Aiar/PWA/package-lock.json>), [Svelte config](</home/user/Projects/Hoomas-Aiar/PWA/svelte.config.js>).

| Dependency | Sepidjoo declared → locked | AIAR declared → locked |
|---|---|---|
| Svelte | `^5.51.0` → `5.55.1` | `^5.19.0` → `5.56.8` |
| SvelteKit | `^2.55.0` → `2.55.0` | `^2.20.0` → `2.70.2` |
| Vite plugin Svelte | `^6.2.4` → `6.2.4` | `^5.0.0` → `5.1.1` |
| Vite | `^7.3.1` → `7.3.1` | `^6.0.0` → `6.4.3` |
| TypeScript | `^5.9.3` → `5.9.3` | `^5.7.0` → `5.9.3` |
| Sass | `^1.98.0` → `1.98.0` | `^1.83.0` → `1.102.0` |
| Adapter | static `^3.0.10` | Node `^5.5.7` → `5.5.7` |
| Table | `@tanstack/table-core` `8.21.3` | Domain-specific lists/cards |
| Bootstrap | Vendored `static/vendor/bootstrap-5.3.8-dist` | No Bootstrap dependency; custom SCSS |
| Markdown | DOMPurify `3.3.3` used by selected rich UI | markdown-it `15.0.0`, KaTeX integration |

The references mean **Svelte 5 + SvelteKit 2**, not a package named SvelteKit 5. Sepidjoo uses static adapter with `fallback: 'index.html'`; root `+layout.ts` and `+layout.server.ts` are absent, and inspected route code has no explicit `ssr = false`. This is evidence of static delivery, not a claim that Svelte SSR is disabled. `[tenant]/+page.server.ts` returns the route parameter; it does not bootstrap an authenticated tenant. AIAR uses adapter-node and server loads; it is the stronger deployment starting point for request-time SSR, subject to removing its server business/persistence coupling.

## 3. Sepidjoo shell, routing, and lifecycle

| Concern | Actual source and behavior | FAPA consequence |
|---|---|---|
| Generic shell | [root layout](</home/user/Projects/Sepidjoo/Repo/ui/src/routes/+layout.svelte>) imports global SCSS and composes Header, Footer, mobile header rows, feedback, update notice, and commerce dialogs | Reuse layout composition pattern; extract business dialogs from generic shell |
| Header/footer | [Header](</home/user/Projects/Sepidjoo/Repo/ui/src/lib/components/layout/header/Header.svelte>), [Footer](</home/user/Projects/Sepidjoo/Repo/ui/src/lib/components/layout/footer/Footer.svelte>) own global rendering; header offers mobile menu/actions; footer has modes, injected content/rows and brand links | Shared chrome stays in App Shell; brand links become configuration; wallet/cart/native bridge belong to optional contributions |
| User/admin | [(panel) layout](</home/user/Projects/Sepidjoo/Repo/ui/src/routes/(panel)/+layout.svelte>) has responsive user sidebar and loading context; [admin layout](</home/user/Projects/Sepidjoo/Repo/ui/src/routes/admin/+layout.svelte>) has grouped static navigation, mobile toggle, collapse and privilege checks | Separate shells are useful; static business nav and client privilege interpretation are replaced |
| Theme/lang/dir | Root sets locale Persian, document language/direction, theme class and `data-bs-theme`; [app.html](</home/user/Projects/Sepidjoo/Repo/ui/src/app.html>) reads localStorage/system preference before mount | SSR must receive an explicit safe preference; avoid module-global/request-shared mutable preference |
| Navigation | Root uses `beforeNavigate`/`afterNavigate`, a navigation token and minimum 400ms loading delay; header closes transient menus | Keep cleanup and pending indicator; omit artificial delay designed to mimic SSR |
| Measurements | Root binds header/footer heights, tracks viewport/scroll and removes listeners | Request-local shell context, CSS first; resize observation only in browser |
| Auth/data loads | Client stores/services load protected data; `[tenant]` load is only a parameter adapter | Add canonical authenticated SSR bootstrap; route parameter is not authority |

### 3.1 Actual page-to-shell API

[layoutStore.svelte.ts](</home/user/Projects/Sepidjoo/Repo/ui/src/lib/stores/layoutStore.svelte.ts>) exports one module-level `layoutStore` (`ClsLayoutChrome`). Actual methods include `injectToHeader`, `clearHeaderInjection`, `setHeaderExtraRows`, `clearHeaderExtraRows`, footer equivalents, configuration and reset methods. The historical name `addHeaderRows` was not found. Injection entries are either snippets or components; `Component<any>` plus loose prop records loses component/props correlation. [RenderInjection](</home/user/Projects/Sepidjoo/Repo/ui/src/lib/components/common/RenderInjection.svelte>) renders the chosen kind. [HeaderScrollableRows](</home/user/Projects/Sepidjoo/Repo/ui/src/lib/components/layout/header/HeaderScrollableRows.svelte>) relocates extra rows on small screens.

[HomeHero](</home/user/Projects/Sepidjoo/Repo/ui/src/lib/components/search/layout/HomeHero.svelte>) configures chrome and clears injected content/rows in effect cleanup. [ResultsPage](</home/user/Projects/Sepidjoo/Repo/ui/src/lib/components/search/layout/ResultsPage.svelte>) injects SearchSurface with page callbacks and SearchTabs as an additional row, then clears them on cleanup. This demonstrates useful page-owned interaction inside shell-owned placement. Cleanup is not an ownership lease: an old page can clear a newer contribution; component props can retain callbacks; HomeHero's assigned logo handler is not reset by the same cleanup. A process-global mutable store is unsuitable for authenticated SSR.

Decision: **REUSE_WITH_ADAPTATION**. Preserve slots and page ownership, replace global state with per-layout context, a correlated typed registry and navigation/tenant leases. SSR-visible metadata must be available to the parent before rendering; child mount effects cannot supply initial SSR header content. Exact target contract is [03 §4](03-target-ui-architecture.md#4-shell-and-page-chrome).

### 3.2 Styles, theme, and collisions

Source hierarchy is [globals.scss](</home/user/Projects/Sepidjoo/Repo/ui/src/lib/styles/globals.scss>): active breakpoint/generic/theme/Bootstrap override/layout/scrollbar/date-picker/SvelteKit layers. Several feature imports are commented out; they are not active global layers. Component styles and search `spg-*` classes provide better scoping examples.

Concrete defects/risks from inspected source:

- `_generic.scss` globally makes `.invisible` and `.hidden` `display:none !important`; `.invisible` conflicts with Bootstrap visibility semantics. Its `.flex-row` adds global alignment behavior; physical `.left`/`.right` floats do not mirror automatically.
- Bootstrap overrides apply global paragraph justification, direct-body-child minimum heights and large modal z-index values. These selectors can change unrelated features and overlays.
- Global Persian `ss02` font-feature styling reaches all RTL descendants; Latin identifiers need explicit opt-out.
- `_breakpoints.scss` has custom thresholds, misleading comments and CSS variable assignments (`--mobilexs` from mobile, `--ultrawide` from desktop). JS comparisons also require boundary normalization. Do not transplant these as another breakpoint authority.
- Root `syncBootstrapDirection` looks for `bootstrap-css`, but the inspected `app.html` Bootstrap link lacks that ID. Its intended direction switch cannot find that element.
- Footer's extra-row condition references `isCopyrightOnly` without invoking it, unlike the main footer condition. Test visibility behavior during extraction; do not copy the typo.

Reuse token-to-Bootstrap mapping and component scoping; replace generic override pollution with the layer contract in [03 §6](03-target-ui-architecture.md#6-brand-theme-direction-and-responsive-design). These are source findings, not claims from visual regression runs.

### 3.3 Forms, tables, feedback, accessibility

`src/lib/components/common` contains concrete number/multiselect/table/feedback/loading components; it does **not** contain a complete standalone TextInput/EmailInput/Checkbox/Radio/FormError family. Auth/admin screens use native Bootstrap form markup. Generic empty/error states are mostly inline in pages/tables, not a complete shared state kit.

[TanStackDataTable](</home/user/Projects/Sepidjoo/Repo/ui/src/lib/components/common/TanStackDataTable.svelte>) wraps `@tanstack/table-core` with remote filters/sorting/pagination, selection, visibility and stored preferences. Its response requires `{ rows, total, page, limit }`; page count depends on total, and pervasive `any` plus transport/picker responsibilities need separation. [SmartDataTable](</home/user/Projects/Sepidjoo/Repo/ui/src/lib/components/common/SmartDataTable.svelte>) is a second custom table engine, not a reason to preserve two target engines. Default target: thin Bootstrap-rendered TanStack core table, manual cursor pagination without count; explicit authorized count only when requested. No AG Grid requirement was found.

`PersianNumberInput` supports labels, hints, error and min/max but strips non-digits then converts to Number; it is not a safe signed/decimal/Money parser. `TagMultiSelect` wraps svelte-select but also contains domain/port validation and file import concerns. Extract presentation only. `UiFeedbackHost` has polite live toasts and pointer pause, but its conditional Bootstrap modal markup does not itself prove focus trapping/restoration. `LoadingDots` needs an accessible status and reduced motion. `LoadingMarquee` uses a browser DOMPurify path but a script-removal regex fallback on the server before raw HTML rendering; reject that fallback.

Header/mobile controls show labels and expanded state, and user/admin layouts have responsive menus. `PendingPurchaseDrawer` has outside-click behavior; a complete keyboard trap/Escape contract was not found there. Its local removal callback is not evidence of server cancellation. Existing `phase7-4-ux.test.ts` and journey-named Vitest files include logic-expression assertions; names alone do not establish rendered DOM, keyboard or browser coverage.

### 3.4 API and auth

[apiClient.ts](</home/user/Projects/Sepidjoo/Repo/ui/src/lib/services/apiClient.ts>) centralizes credentials, JSON/error handling and a shared refresh promise; a second 401 is bounded by `allowRefreshRetry: false`. The promise settles on failure, unlike FAPA's unresolved subscriber risk. Its pending-request cache hashes all request options; do not copy blanket mutation deduplication. Access token is in the client auth store. [shared auth](</home/user/Projects/Sepidjoo/Repo/shared/utils/auth.ts>) implements `hasPriv`/`hasCRUD` including `ALL`, and the admin layout consumes those semantics: **DO_NOT_REUSE** outside FAPA Authority.

[API auth.ts](</home/user/Projects/Sepidjoo/Repo/api/src/routes/auth.ts>) corroborates HttpOnly refresh cookie, hashed session lookup and rotation; readable session hint is a hint, not a credential. These backend details explain the frontend protocol; U0 does not import or redesign its identity implementation. Whole shared-package import is not approved merely because some contracts are browser-safe.

## 4. AIAR implementation

### 4.1 Layout, routes, styles, and session

[root layout](</home/user/Projects/Hoomas-Aiar/PWA/src/routes/+layout.svelte>) imports app SCSS/Font Awesome and brand metadata. [AppLayout](</home/user/Projects/Hoomas-Aiar/PWA/src/lib/components/AppLayout.svelte>) composes Topbar, Sidebar, BottomNav, mobile journey header and AI credit dialog. It hydrates app data on mount, redirects 401 to login with return path, and presents reload on initialization failure. It is a business application wrapper, not a module-neutral root shell. App/server layouts and [hooks.server.ts](</home/user/Projects/Hoomas-Aiar/PWA/src/hooks.server.ts>) use repository/session/runtime storage; FAPA Web cannot adopt this database/domain service ownership.

AIAR has custom SCSS tokens/mixins, responsive app shell around 980px and calendar rules around 900px; it does not supply the Bootstrap baseline. Theme and route tests are useful references, not authority for a second theme owner.

[server/services/http.ts](</home/user/Projects/Hoomas-Aiar/PWA/src/lib/server/services/http.ts>) manages an opaque session cookie with HttpOnly, same-site and deployment secure settings. UI APIs cover OTP, session, workspace and logout. There is no matching short access-token + rotating refresh-token client abstraction to transplant. Workspace/role selection is not FAPA's one-active-tenant, newly authorized context transition. [stores/app.ts](</home/user/Projects/Hoomas-Aiar/PWA/src/lib/stores/app.ts>) contains module-level application state; replace with request/layout-local state for SSR.

### 4.2 Jalali/calendar: primary extraction source

| Asset | Source evidence | Reuse boundary and limitations |
|---|---|---|
| Date conversion/formatting | [domain/date.ts](</home/user/Projects/Hoomas-Aiar/PWA/src/lib/domain/date.ts>): Intl Persian formatting, Persian/Arabic digit normalization, Gregorian search for Jalali date, leap/month validation | Extract deterministic conversion/fixtures once into calendar-core; separate display digit formatting; supported Jalali range 1200–1600 must be explicit and tested |
| Time semantics | Same file appends `+03:30` to some local inputs, uses Tehran and synthesizes noon for date-only input; `jalaliDateTimeToIso` returns timezone-free `YYYY-MM-DDTHH:mm` | Replace implicit zone/fixed-offset assumptions; date-only is not an instant; retain no misleading “ISO instant” API |
| Date picker | [JalaliDatePicker](</home/user/Projects/Hoomas-Aiar/PWA/src/lib/components/JalaliDatePicker.svelte>): Gregorian date-only value, min/max, month shift, outside click, Escape, initial/return focus, directional arrows | Adapt into calendar-svelte; add full grid/roving focus, Home/End/PageUp/Down, disabled/read-only/error and locale/direction contract; inject clock instead of implicit `new Date()` |
| Date-time fields | [JalaliDateTimeInput](</home/user/Projects/Hoomas-Aiar/PWA/src/lib/components/JalaliDateTimeInput.svelte>): day/month/year/hour/minute selects, labels/fieldset/required and year bounds | Adapt zone-aware wall-time input; no local fallback year or fixed offset as authoritative instant |
| Month grid | [market/JalaliMonthGrid](</home/user/Projects/Hoomas-Aiar/PWA/src/lib/components/market/JalaliMonthGrid.svelte>): day selection/min-date/pressed state; imports market CalendarEvent and Tehran day helpers | Extract generic day grid; leave task/meeting mapping in business module, extend keyboard semantics |
| Calendar views | [MarketCalendar](</home/user/Projects/Hoomas-Aiar/PWA/src/lib/components/market/MarketCalendar.svelte>): month/week/quarter/agenda, owner filters, task/meeting callbacks; [domain/market/calendar.ts](</home/user/Projects/Hoomas-Aiar/PWA/src/lib/domain/market/calendar.ts>) ranges/days/event mapping | View composition is reference only; pure ranges may move to core, business events/manager policy may not |
| Tests | [date.test.ts](</home/user/Projects/Hoomas-Aiar/PWA/tests/date.test.ts>): leap/non-leap Esfand and conversion examples | Reuse valid fixtures; update tests for the approved explicit timezone contract instead of preserving zone-free instant behavior |

Do not ship parallel AIAR, Sepidjoo third-party picker and legacy FAPA conversion engines. Calendar Core owns semantics, Calendar Svelte owns widgets, module owners supply event facts/business calendars.

### 4.3 Transport, stream, AI, and Markdown

[api/client.ts](</home/user/Projects/Hoomas-Aiar/PWA/src/lib/api/client.ts>) defines typed transport and `ApiClientError` with status/code/message/fields. Credentials are same-origin. A 40-second timeout applies to selected endpoint prefixes, not all operations. Responses are largely cast, so runtime schemas and safe error mapping remain required. Global transport/mock initialization must not carry SSR identity. Adopt one typed client with injected per-request dependencies, correlation, abort and consistent deadline policy.

Its POST event-stream implementation preserves a decoder buffer, normalizes line endings and joins data lines. It handles `delta`, `status`, `done`, `error`; malformed JSON yields a protocol error, and EOF without done yields interruption. These are stronger foundations than legacy per-chunk parsing. Missing target features include bounded frames, terminal exclusivity, uniform deadlines, deterministic reader disposal, validated resume/deduplication and navigation/tenant isolation. Do not claim automatic reconnect is implemented.

[chat page](</home/user/Projects/Hoomas-Aiar/PWA/src/routes/app/chat/+page.svelte>) uses a busy guard, AbortController, client message ID, partial draft, error recovery and final cleanup. Stop calls backend cancellation then aborts; navigation `onDestroy` handles audio, not the full active stream lifetime. Drafts can reach sessionStorage; protected content needs an explicit retention policy instead. [chat-failures E2E](</home/user/Projects/Hoomas-Aiar/PWA/tests/e2e/personas/chat-failures.spec.ts>) covers interrupted output and composer recovery, including avoiding provider labels. Use those scenarios, not route-specific code, as shared operation acceptance evidence.

[MarkdownText](</home/user/Projects/Hoomas-Aiar/PWA/src/lib/components/MarkdownText.svelte>) delegates to [utils/markdown.ts](</home/user/Projects/Hoomas-Aiar/PWA/src/lib/utils/markdown.ts>): markdown-it with raw HTML disabled, link handling, disabled images and KaTeX. Code/pre are LTR; prose direction/spacing is styled. It has Persian typography normalization and trailing unmatched-bold cleanup; do not copy ad hoc output rewriting into authoritative content. Table styling and uniform SSR/browser sanitization remain target work. [markdown.test.ts](</home/user/Projects/Hoomas-Aiar/PWA/tests/markdown.test.ts>) provides useful unsafe-link/HTML/math/code-preservation cases. No hidden reasoning is rendered or retained by the target.

### 4.4 Files and attachments

[FileUploader](</home/user/Projects/Hoomas-Aiar/PWA/src/lib/components/FileUploader.svelte>) provides click/drop input, multiple-file selection, a busy guard, alert text, previews and delete-versus-unlink labels. It directly calls `appApi.uploadAsset`, serially uploads up to eight files and reports results after the loop. It does not expose byte progress or processing states; a later file failing can leave earlier successful uploads unreported to `onAdd`. Adapt the presentation with an injected upload contract, per-file outcomes, progress/cancel/status reconciliation and logical responsive styles.

[MarketAttachments](</home/user/Projects/Hoomas-Aiar/PWA/src/lib/components/market/MarketAttachments.svelte>) demonstrates FormData upload IDs, task/contact association, authorized API download to a temporary object URL, error/notice states, confirmation and deletion-review UI. It mixes market-specific policy (including a deletion time window) with presentation. Use it as reference for attachment interactions; do not extract its lifecycle/temporal permission rules into generic UI. Backend capability/action projections remain final, and FAPA Document Core supplies the resource/version/processing model.

## 5. Concrete reuse matrix

Counting unit: one explicitly scoped asset/pattern row. “Direct” means the listed source asset can be consumed unchanged. Adapted sources require one canonical package, provenance and tests; reference-only rows are evidence for design. Asset IDs support the reconciliation and migration documents.

| ID | Source asset / concrete path | Classification | Target owner | Required change / reason |
|---|---|---|---|---|
| R01 | Sepidjoo `static/vendor/bootstrap-5.3.8-dist` | REFERENCE_ONLY | ui-core styling | Reuse Bootstrap 5.3.8 as a maintained dependency/baseline; do not copy or fork Sepidjoo's vendored distribution |
| R02 | Sepidjoo `src/routes/+layout.svelte` | REUSE_WITH_ADAPTATION | App Shell | Extract generic composition, remove commerce/native coupling, SSR bootstrap |
| R03 | Sepidjoo `src/lib/stores/layoutStore.svelte.ts`, `common/RenderInjection.svelte` | REUSE_WITH_ADAPTATION | App Shell chrome | Context instance, correlated props, ownership lease, SSR descriptors |
| R04 | Sepidjoo `src/lib/components/layout/header/Header.svelte`, `footer/Footer.svelte` | REUSE_WITH_ADAPTATION | App Shell | Generic slots, runtime brand, keyboard behavior, cleanup/condition fixes |
| R05 | Sepidjoo `src/routes/(panel)/+layout.svelte`, `admin/+layout.svelte` | REUSE_WITH_ADAPTATION | User/Admin shells | Keep responsive composition; declarative modules/backend capabilities |
| R06 | Sepidjoo `src/lib/styles/globals.scss` and Bootstrap token overrides | REUSE_WITH_ADAPTATION | ui-core + branding | Scoped layers, one breakpoint map, correct direction/theme bindings |
| R07 | Sepidjoo `src/lib/components/common/TanStackDataTable.svelte` | REUSE_WITH_ADAPTATION | ui-core DataTable | Split transport; strict types; cursor/default no total; a11y |
| R08 | Sepidjoo `src/lib/components/common/SmartDataTable.svelte` | REFERENCE_ONLY | ui-core design evidence | Avoid maintaining a second table engine |
| R09 | Sepidjoo `src/lib/components/common/PersianNumberInput.svelte` | REUSE_WITH_ADAPTATION | ui-core numeric presentation | Preserve caret/digit UX; separate integer/decimal/Money contracts |
| R10 | Sepidjoo `src/lib/components/common/TagMultiSelect.svelte` | REUSE_WITH_ADAPTATION | ui-core MultiSelect | Remove host/file/domain semantics; strict accessible options |
| R11 | Sepidjoo `src/lib/components/common/UiFeedbackHost.svelte` | REUSE_WITH_ADAPTATION | ui-core feedback | Trap/restore focus, keyboard pause, safe text, scoped state |
| R12 | Sepidjoo `src/lib/components/common/LoadingDots.svelte` | REUSE_WITH_ADAPTATION | ui-core loading | Accessible status, reduced motion, scope |
| R13 | Sepidjoo `src/lib/components/common/LoadingMarquee.svelte` server HTML fallback | DO_NOT_REUSE | None | Regex script removal is not safe sanitization |
| R14 | Sepidjoo `src/lib/components/search/common/SearchSurface.svelte` | REUSE_WITH_ADAPTATION | ui-core search presentation | Strip vertical/business/debug behavior; retain typed interaction |
| R15 | Sepidjoo `src/lib/components/layout/header/PendingPurchaseDrawer.svelte` | REFERENCE_ONLY | ui-core drawer design | Business-specific; local dismissal does not cancel a purchase |
| R16 | Sepidjoo `src/lib/services/apiClient.ts` refresh coordination | REUSE_WITH_ADAPTATION | Auth/API clients | Retain settling single-flight, bounded replay; remove blanket mutation dedup |
| R17 | Sepidjoo shared `utils/auth.ts`, admin `hasPriv`/`hasCRUD` usage | DO_NOT_REUSE | Authority owns semantics | Never transplant browser privilege interpretation |
| R18 | Sepidjoo `src/tests/phase7-4-ux.test.ts` | REFERENCE_ONLY | Web tests | Scenario inspiration; add rendered DOM and browser assertions |
| R19 | AIAR `src/lib/domain/date.ts` | REUSE_WITH_ADAPTATION | calendar-core | One extraction; explicit zone, deterministic clock/ranges |
| R20 | AIAR `src/lib/components/JalaliDatePicker.svelte` | REUSE_WITH_ADAPTATION | calendar-svelte | Complete keyboard/field states; use calendar-core only |
| R21 | AIAR `src/lib/components/JalaliDateTimeInput.svelte` | REUSE_WITH_ADAPTATION | calendar-svelte | Explicit timezone/DST/error model |
| R22 | AIAR `src/lib/components/market/JalaliMonthGrid.svelte` | REUSE_WITH_ADAPTATION | calendar-svelte | Extract neutral day grid; remove market imports |
| R23 | AIAR `src/lib/components/market/MarketCalendar.svelte` | REFERENCE_ONLY | Module UI | Keep task/meeting/workflow/owner policy outside shared calendar |
| R24 | AIAR `tests/date.test.ts` | REUSE_WITH_ADAPTATION | Calendar tests | Preserve conversion fixtures; add zone/range/roundtrip cases |
| R25 | AIAR `src/lib/api/client.ts` stream transport | REUSE_WITH_ADAPTATION | Streaming client | Validate/bound protocol, terminal/abort/deadline cleanup |
| R26 | AIAR `src/lib/api/client.ts` request/errors | REUSE_WITH_ADAPTATION | API client | Request-local injection, schemas, refresh/correlation/deadlines |
| R27 | AIAR `src/routes/app/chat/+page.svelte` operation flow | REUSE_WITH_ADAPTATION | Shared AI UX + module adapter | Extract state transitions, epoch ownership, privacy-safe draft recovery |
| R28 | AIAR `src/lib/components/MarkdownText.svelte`, `src/lib/utils/markdown.ts` | REUSE_WITH_ADAPTATION | ui-core rich content | One safe SSR/browser renderer, tables; no text-repair regex |
| R29 | AIAR `tests/markdown.test.ts`, `tests/e2e/personas/chat-failures.spec.ts` | REUSE_WITH_ADAPTATION | UI/stream tests | Port scenarios against FAPA public contracts and source provenance |
| R30 | AIAR `src/lib/components/AppLayout.svelte` | REFERENCE_ONLY | Shell study | Business hydration/credits and fixed application routes are not generic shell |
| R31 | AIAR `src/lib/server/services/http.ts` session/workspace model | REFERENCE_ONLY | Auth integration study | Opaque session evidence; do not create second identity engine |
| R32 | AIAR `src/hooks.server.ts`, application repository imports in server loads | DO_NOT_REUSE | None in Web | Violates Web-to-API and persistence ownership boundaries |
| R33 | AIAR `src/lib/components/FileUploader.svelte` | REUSE_WITH_ADAPTATION | ui-core file presentation | Inject API; per-file partial outcomes, progress/processing/cancel and shared breakpoints |
| R34 | AIAR `src/lib/components/market/MarketAttachments.svelte` | REFERENCE_ONLY | Document/module UI interaction evidence | Keep market deletion/review rules outside shared UI; use backend actions |

Totals: **34 classified assets/patterns**: direct **0**, adaptation **23**, reference only **8**, rejected **3**. Reusable source implementation inputs = direct + adaptation = **23**; R01 separately identifies the maintained Bootstrap dependency/baseline. Counts describe decisions, not completed extractions.

## 6. Reuse delivery policy

U1 records original source path, commit, applicable license/notice and extraction changes. Prefer an existing maintained package/public export; otherwise perform a deliberate extraction into the single FAPA owner, preserving regression fixtures. No runtime relative imports into another repository, copied application stores, duplicated calendar/Markdown engine or whole `shared` dependency. If upstreaming is practical, track it explicitly; U0 does not assert shared release infrastructure already exists. A rejected subpattern within an adapted component remains rejected.

Open verification work: extraction license review, exact clean-install/build/tool peer checks, authenticated visual baselines, assistive-technology tests and backend compatibility probes. These are implementation gates, not missing source references or unresolved semantic owners.

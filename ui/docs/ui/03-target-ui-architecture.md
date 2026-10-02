# U0 — Target UI Architecture

Status: implementation contract **approved for U1 foundation implementation**; no U1 scaffold is created by U0/U0.1. This document operationalizes [system architecture](../architecture/01-system-architecture.md), [engineering conventions](../architecture/02-engineering-conventions.md), [module architecture](../architecture/05-module-architecture.md), and the scoped [Web](../../apps/web/AGENTS.md), [UI Core](../../packages/ui-core/AGENTS.md), [Calendar Core](../../packages/calendar-core/AGENTS.md), [Calendar Svelte](../../packages/calendar-svelte/AGENTS.md), and [Branding](../../packages/branding/AGENTS.md) instructions. Higher-precedence documents retain semantic authority. Evidence and alternatives are in [01](01-reference-implementations.md) and [02](02-reference-reconciliation.md). Approval does not authorize production route cutover, legacy UI removal, Identity cookie changes, CRM or Follow-up production implementation, backend schema changes, ingress switch or production deployment.

## 1. Framework and runtime

Use **Svelte 5 with SvelteKit 2**, strict TypeScript, Node SSR adapter, Bootstrap 5 and SCSS. The task's “SvelteKit 5” is interpreted according to actual reference packages: Svelte major 5; both reference Kit versions are major 2. No Tailwind, Redux-like global framework, generic form engine or AG Grid is justified.

Initial exact implementation baseline: Svelte **5.56.8**, Kit **2.70.2**, adapter-node **5.5.7**, vite-plugin-svelte **5.1.1**, Vite **6.4.3**, TypeScript **5.9.3**, Sass **1.102.0**, Bootstrap **5.3.8**, and TanStack table-core **8.21.3**. This combines AIAR's coherent SSR toolchain with the same Bootstrap already used in FAPA/Sepidjoo and Sepidjoo's table core. It is a reproducible reference baseline, not a claim that these are the newest or security-approved releases. No dependency changes occur in U0.

Installed reference package metadata supports this candidate: Kit 2.70.2 accepts Svelte 5, plugin 5 and Vite 6; plugin 5.1.1 accepts Vite 6 and Svelte 5; adapter-node 5.5.7 accepts Kit 2.4+. Node 22 satisfies their engine ranges. Existing FAPA uses Node 22 Alpine; U1 must pin an approved maintained Node 22 patch/image digest and verify a clean install, lockfile, engine/peer resolution, Svelte check, SSR build and dependency scan. Sepidjoo's Vite 7/plugin 6 require newer minimum Node patch levels and add an unnecessary toolchain change to this starting point. If security/compatibility gates require replacement versions, record the exact reviewed tuple before implementation; do not silently upgrade unrelated packages.

Serve pages through a separate Web Node runtime and existing API through ingress. [SvelteKit's Node adapter](https://svelte.dev/docs/kit/adapter-node) is the deployment basis; adapter configuration and proxy headers must be verified for the pinned version and trusted ingress. Web is a presentation/composition root, including its server code: no repositories, PostgreSQL, Kysely, business transitions, provider SDKs or Qdrant access.

## 2. Canonical ownership

| Responsibility | Canonical presentation owner | Inputs / public output | Explicit boundary |
|---|---|---|---|
| App Shell | `apps/web` root layout/context | Safe bootstrap → brand, theme, lang/dir, header/footer, navigation, global errors/loading, chrome slots | No business policy or module-private imports |
| Public Shell | `apps/web` public layout | Deployment entry, public routes, login | Public rendering does not confer protected access |
| User Dashboard | `apps/web` user layout/dashboard composition | Session, tenant, enabled contributions, safe summaries | Normal user workspace; module owns card/query meaning |
| Admin Backoffice | `apps/web` admin layout/composition | Authorized administration contributions, module instances and backend-projected organization/subtree scope | Distinct from User Dashboard; no local role/ACL/scope interpretation |
| Module UI | `modules/<module>/web` public contribution export | Typed route components, forms, domain presentations and module API contracts | Business policy remains in module backend; no private cross-module access |
| Shared UI Core | `packages/ui-core` | Forms, feedback, dialog/drawer, list/table, Markdown, AI operation presentation primitives | Does not import business modules, backend adapters or application auth |
| Calendar Core | `packages/calendar-core` | Pure time/calendar/range/recurrence primitives | No Svelte, DOM, network, business workflows or implicit clock |
| Calendar Svelte | `packages/calendar-svelte` | Calendar Core + typed props → accessible widgets | Sole date/calendar UI; no independent conversion |
| Branding | `packages/branding` | Validated Brand Profile schema, token/public projection contracts | Backend owns profile facts; Web applies safe values |
| Contracts | `packages/contracts` public browser-safe exports | DTOs, IDs, schemas, errors, route/contribution/stream contracts | No secrets, drivers, platform implementation or provider clients |
| API Client | `apps/web/src/lib/api` | Injected transport/context → validated responses and safe errors | Only frontend network entry; endpoint adapters do not duplicate transport policy |
| Auth Client | `apps/web/src/lib/auth` | Backend session/bootstrap/refresh/logout/switch contracts → UX state | No privilege interpretation or credential persistence in browser storage |
| Streaming Client | `apps/web/src/lib/streaming` | API transport + validated events → operation stream | Owns framing/deadlines/cleanup; AI Router owns execution/fallback |
| Notification presentation | Web notification adapter + ui-core surfaces | Notification Core APIs → inbox/unread/read UX | Transient toasts have separate local state |

Naming follows `cls*`, `intf*`, `enu*`, `typ*`, `ex*`; functions/variables camelCase, constants UPPER_SNAKE_CASE. Public shapes are named, readonly where appropriate, and use branded IDs when interchange is risky. Boundary input is `unknown` until validated. Do not import reference `Component<any>` patterns or wildcard exports.

## 3. Modules, User Dashboard, and Admin Backoffice

Extend the canonical module manifest's frontend contribution contract; do not create another module activation registry. Backend composition projects **installed**, **deployment/tenant-enabled**, and **authorized-for-current-context** as distinct facts. The shell consumes that projection; it does not calculate scope or permission intersections itself. Empty disabled sections are absent; a stale URL still receives backend authorization on every read/mutation.

Each `intfModuleUiContribution` has stable contribution/module IDs, contract version, surface kind, logical route ID, typed parameter schema, localization label key, icon key, ordering/group metadata, optional capability-view key, and optional instance/context requirements. Surface kinds cover navigation, route, admin section, user-dashboard card, settings panel, module-instance panel, badge/count and optional action. Actions carry a registered command ID; no arbitrary script, HTML, external module import or source-string callback arrives from a server manifest.

Code components are statically linked through an explicit public module UI export in the Web composition root. Serializable descriptors and schemas belong in contracts; Svelte components and callbacks do not. Compiled route adapters map to installed code; runtime enablement/capability views determine availability. Installing new executable module code can require an artifact release; changing enabled modules/brand/bindings within installed code does not require a source fork.

User Dashboard renders an ordered set of authorized module cards, personal tasks/recent items, safe status, tenant selector and links. Admin Backoffice renders platform administration and active module admin contributions, module-instance management, and an organization/subtree selector whose valid options/context come from backend Authority. Selecting scope requests a new scoped view; UI does not infer inherited authority. Badges are optional summaries from owner APIs, cached by context; do not compute counts or trigger full-list/count requests for every sidebar item. Errors in an optional contribution degrade that contribution, with safe retry.

## 4. Shell and page chrome

Root layout alone owns header/footer position, dimensions, responsive behavior, global navigation, theme, brand, language/direction, session/tenant bootstrap, global status and page chrome placement. User/Admin nested layouts choose composition. Module pages own their content and interactions, never root DOM mutation.

Adapt Sepidjoo's injection mechanism into a `clsLayoutChrome` instance created per root layout through Svelte context. Slots: primary header content, bounded additional header rows, page title/breadcrumbs, page toolbar, and optional footer content. Root account/tenant/safety controls cannot be replaced by a module. Default maximum rows and collapse behavior are shell configuration; overflow uses a keyboard-accessible menu or scroll region.

Use two related contracts:

- **SSR descriptor:** serializable route-owned title/breadcrumb/action descriptors, supplied by route metadata/load before parent shell rendering. Server-visible data cannot depend on a child `onMount`/effect writing upward. Prefer `page.data`/parent load composition or route registry lookup supported by the pinned Kit version.
- **Client binding:** a discriminated `typChromeContribution` keyed to a closed `intfChromePropsMap`; each registered component key is correlated with its exact props. Component/snippet callbacks stay within the live component tree. Avoid unrestricted `Component<any>`, unvalidated records or server-provided executable references. A compile-time negative test proves wrong props cannot register.

`acquireChrome` returns a lease with route instance, navigation generation, tenant epoch and owner ID. Updating/releasing requires the same lease; release is idempotent and cannot clear a newer owner's content. Committed navigation replaces route-scoped chrome; cancelled navigation retains the current valid contribution. Abandoned loads never publish. Component destruction, logout, tenant switch and module disablement dispose listeners/callbacks and invalidate leases. Reusable layouts may retain their own separately scoped chrome. Theme/brand/session are not reset by page cleanup.

SSR isolation test: concurrently render users/tenants A and B with different titles/actions; neither response contains the other's data. Navigation test: A → B while A cleanup/response runs late; only B contribution remains. Hydration test: initial server and browser chrome agree, including empty/default slots. [SvelteKit state guidance](https://svelte.dev/docs/kit/state-management) supports request-local context instead of shared server variables.

## 5. Proposed directories and boundaries

These are planned paths, not directories created by U0. Existing scoped instructions remain applicable.

```text
apps/web/
  src/
    app.html
    hooks.server.ts                 # trusted binding/session bootstrap plumbing
    lib/
      api/                          # request factory, errors, browser/SSR adapters
      auth/                         # session UX, refresh/switch coordination
      layout/                       # App/Public/User/Admin shells and chrome context
      routing/                      # logical route resolver and binding adapters
      moduleRegistry/               # composition of explicit module public exports
      notifications/                # Notification Core API adapter
      streaming/                    # framing, protocol adapters, stream lifecycle
      server/                       # request-local backend bootstrap/private config
      styles/                       # imports/composition of shared SCSS layers
    routes/
      +layout.server.ts             # safe request-specific bootstrap
      +layout.svelte                # one root provider/App Shell
      (public)/                     # landing/login/public adapters
      (user)/                       # dashboard and enabled module route adapters
      (admin)/admin/                # backoffice contribution adapters
  tests/                            # SSR, routes, E2E/parity contracts
packages/
  contracts/src/ui/                 # framework-free published DTO/schema contracts
  branding/src/                     # profile contracts and safe token projection
  calendar-core/src/                # conversion, time, ranges, recurrence
  calendar-svelte/src/              # date/date-time/range/month widgets
  ui-core/src/
    forms/ feedback/ overlays/ tables/ richContent/ aiOperation/ styles/
modules/<module>/web/               # module-owned UI and explicit public export
```

No additional generic `utils`, `helpers`, `misc` or `common` package. Generic form/calendar/Markdown mechanics live in one package each, not duplicated under Web convenience wrappers. Web-specific dependency injection/adapters may bind those packages to app services. Business modules receive the public UI client context/interface through composition and use their published endpoint contracts; they do not import `apps/web` internals. Pure AI UI state transitions belong to ui-core; transport orchestration stays in Web and is injected. Server-only code is unreachable from browser-safe exports, as enforced by the [Kit server-only boundary](https://svelte.dev/docs/kit/server-only-modules).

## 6. Brand, theme, direction, and responsive design

### Runtime Brand Profile

Backend profile facts → validated browser-safe projection → branding token resolver → shell/components. Fields include display/short name, light/dark logo and alt text, favicon, semantic colors, typography/fallbacks, login illustration/identity, legal/footer links, support identity and notification/document visual identity where applicable. Notification/document generation keeps its own server rendering contract using the same approved identity. Public logos/URLs must be approved safe asset references; no arbitrary HTML, JavaScript, CSS, filesystem path or secret configuration. Customer override values are allowlisted and contrast-tested. Ordinary profile updates refresh versioned runtime configuration; no source rebuild or module-specific customer name.

### Theme and SCSS

Shell owns `light | dark | system` preference and resolved theme. Persist a non-sensitive host-scoped preference cookie usable by SSR; localStorage may hold a migration hint, never a second authority. Explicit light/dark renders correctly on server. For system mode, use a small CSP-compatible early script to set only the theme attribute from media preference before paint; initial Svelte state reads that resolved value and does not undo it. Server markup must not branch on an unknowable system preference. Subscribe/unsubscribe to media changes only in system mode. Theme changes synchronize other tabs without broadcasting session data.

SCSS order: Bootstrap foundations → owned semantic tokens/Bootstrap variable mapping → shared component styles → module-namespaced/scoped styles. Branding supplies values, ui-core owns token names/defaults, shell applies profile/theme. Components inherit; no private theme stores. Apply root `data-bs-theme` consistently with [Bootstrap color modes](https://getbootstrap.com/docs/5.3/customize/color-modes/). Avoid global overrides of utility names, element-wide justification, arbitrary z-index escalation or wildcard font changes. Central overlay layers establish dropdown/drawer/dialog/toast order.

### Language, direction, and numbers

SSR bootstrap sets `lang` and `dir` from supported locale preference; UI language is distinct from document content language. Use logical margin/padding/border/inset/text alignment. Provide one reviewed Bootstrap LTR/RTL asset selection keyed by direction, including its SSR link identity; load exactly the intended direction before render. Directional arrows mirror when semantic (back/next); logos, media controls and code do not automatically mirror. Tables preserve column meaning and keyboard navigation, not a blind array reversal.

Persian-facing text uses approved Persian font tokens with licensed local assets and safe fallback fonts. `fa-num` is a shared opt-in display/input style, not a value converter. Normalize Persian and Arabic numeric input through the named field parser while preserving caret/selection/composition. APIs receive canonical ASCII integers/decimal strings/IDs according to their schema. Email, URLs, codes, SKU, genuinely Latin product names, code/pre and model identifiers are deliberate LTR/Latin islands with `bdi`/explicit direction as appropriate. English model labels, if an approved read-only product surface exposes them, never become provider selection in business UI. Do not transform stored prose, identifiers, pasted code or numeric precision to achieve glyph styling.

### Responsive contract

One breakpoint map: Bootstrap xs `<576`, sm `576`, md `768`, lg `992`, xl `1200`, xxl `1400` CSS pixels; use its SCSS tokens and the same exported boundaries where JS observation is necessary. These values follow [Bootstrap's breakpoint contract](https://getbootstrap.com/docs/5.3/layout/breakpoints/). Layout behavior:

| Surface | Mobile `<768` | Tablet `768–991` | Desktop `>=992` |
|---|---|---|---|
| Navigation/sidebar | Menu button, accessible offcanvas, safe-area spacing | Compact top nav; dismissible drawer | Persistent/collapsible sidebar, full labels |
| Header contributions | Primary row + bounded scrollable/overflow actions | Compact toolbar/second row | Full toolbar and configured extra rows |
| Tables | Essential columns/cards where semantics allow; named horizontal scroll region | Priority columns + scroll | Full configured columns; no hidden required actions |
| Forms | One column; keyboard-safe submit/footer | Up to two related groups | Bounded line lengths; multi-column only for meaningful groups |
| Dialog/drawer | Near-full viewport, independently scrollable body, sticky controls | Bounded modal or side drawer | Sized modal/drawer; background inert |
| AI/chat | Single pane, sticky composer, keyboard/stream scroll management | Toggle source/history panels | Optional history/content/detail panes |

No feature-specific 900/980/1280px breakpoint systems. Test 320px/reflow and zoom in addition to representative screenshots; content must remain usable with long Persian labels and LTR identifiers.

## 7. Calendar and time contract

Extract AIAR's proven conversion cases and picker interactions into the existing canonical package boundaries; do not copy market business types or keep Sepidjoo/FAPA conversion engines alongside it in target code.

| Value | Named contract semantics | Presentation / validation |
|---|---|---|
| Absolute timestamp | `typInstant`: validated timezone-aware ISO timestamp, normalized UTC at API boundary | Display with explicit IANA timezone and selected calendar; never formatted Jalali as authoritative time |
| Local Gregorian date | `intfLocalDate` with calendar discriminant and year/month/day, or its canonical Gregorian date-only serialization | No implicit midnight/noon or browser zone conversion |
| Local Jalali date | Same local-date union with Jalali discriminant | Convert through calendar-core with explicit supported bounds; reject invalid Esfand/day |
| Wall-clock date-time | Named local date + time + `typTimeZoneId` | Resolve to instant with explicit DST ambiguity/nonexistent-time policy; show ambiguity/error rather than guessing |
| Timezone | Validated IANA identifier from context/config | `Asia/Tehran` may be a deployment default; never hard-code `+03:30` for all historical/future times |
| Date range | Two local dates in the same declared calendar; UI endpoints inclusive | Validate ordering/bounds; API owner defines any conversion to half-open instant interval |
| Instant range | `[start, end)` instants | No off-by-one “23:59:59” construction |
| Recurrence | Rule, local anchor, timezone, bounded expansion horizon and exception dates | Core expands deterministically; backend scheduling owns durable execution/idempotency |
| Business calendar | Versioned week pattern/holiday/exception inputs | Domain/configuration owner supplies facts; core performs arithmetic, no module policy inference |

Clock is injected for today/defaults/tests. Formatting is a named calendar presentation API with locale/digit options; generic number glyph formatting remains in ui-core. DateInput, DateTimeInput and DateRangeInput use calendar-svelte only. Supported conversion range must be a documented contract; start with tested AIAR 1200–1600 Jalali coverage, reject unsupported values, and expand only with conformance evidence. Tests cover leap boundaries, roundtrips, month/year edges, UTC/day crossings, DST zones, explicit disambiguation, digit normalization and deterministic SSR. Legacy browser-local date-time behavior is a known defect to correct, not parity to preserve.

## 8. Forms and overlays

Use small field primitives; module pages compose forms and bind canonical schemas. Each field has stable ID/name, label, value/onChange, described help/error, required, disabled, readOnly where meaningful, busy state and appropriate autocomplete/inputmode. Hidden/disabled controls do not authorize or exempt server validation. Preserve user input on server errors, focus an error summary then allow field navigation; map stable field paths from 422 responses. Client validation assists entry using public canonical schemas; backend owns final semantics.

| Primitive | Required behavior |
|---|---|
| TextInput | Safe text, locale/direction, max-length from contract, IME/autofill support |
| NumberInput | Named integer/decimal mode, allowed sign/scale/range; Persian/Arabic input; no blanket digit stripping or unsafe Number conversion |
| EmailInput | LTR value, email autocomplete, server validation; no Persian glyph rewrite |
| Select | Native accessible select by default; explicit null/empty option and stable typed keys |
| MultiSelect | Keyboard select/remove/search, announced selection count, remote options via injected client; no built-in domain/file importer |
| Checkbox / Radio | Actual input semantics, group fieldset/legend, associated labels |
| Textarea | Plain editable source/draft; preserves newlines; no Markdown rendering inside editor |
| DateInput / DateTimeInput / DateRangeInput | calendar-svelte components using §7; keyboard/label/disabled/error contract |
| FileInput | Accessible pick/drop, type/size guidance, cancel/progress, server scan/validation final |
| FormError | Form-level summary and safe field linking; does not reveal raw provider/backend errors |
| FieldHelp | Described text; instructions persist alongside validation errors |

Money inputs use integer atomic units plus explicit currency at the authoritative boundary, preserving values beyond JS safe integer via contract serialization. Financial Core owns rounding/calculation; the UI parser cannot invent exchange/discount/charge semantics.

Dialog/drawer primitives own focus trap, initial focus, restoration to a still-connected trigger, Escape policy, labelled title/description, backdrop semantics, scroll locking and nested overlay stack. Prefer a focused Svelte wrapper using Bootstrap styles with one lifecycle owner; do not attach Bootstrap imperative and Svelte controllers to the same element. Closing a business confirmation is not successful cancellation of an operation. Destructive actions name the effect and await backend result; unconfirmed/unknown outcomes remain visible.

## 9. Lists and tables

Use TanStack core as a headless row/column/selection model, rendered with Bootstrap table primitives. ui-core owns typed column/row presentation and controls; a module endpoint adapter owns query/result mapping. API client owns transport. No mandatory total, built-in direct fetch, module permissions or Jalali engine in the table component.

Default `intfCursorPage<TRow>` returns readonly `items`, `nextCursor` (nullable), `hasMore`; request contains bounded limit, optional opaque cursor, allowed filter/sort schema. Explicit count is a separate request/opt-in response variant over the **same filters and authorized result set**. Count can be pending/unavailable independently; never display page length as total. Show “more” or loaded item count accurately; no invented last-page button. TanStack supports manual server pagination; its [pagination guidance](https://tanstack.com/table/v8/docs/guide/pagination) informs the adapter, not backend query policy.

Sort/filter changes reset cursor, selection policy and in-flight request generation; URL encodes allowlisted non-sensitive filters/sort, not protected search text unless approved. Stable row IDs distinguish selected loaded rows; cross-page “all matches” requires an explicit backend selection/snapshot contract. Bulk actions send IDs or approved selection token and reauthorize each operation, reporting partial success. No optimistic hidden removal of failed rows. Empty first result differs from filtered-empty, denied, failed and loading. Keep prior results during background refresh with an accessible stale/loading indicator. Offset mode is allowed only for a documented random-page need with stable ordering and a matching backend contract.

## 10. Markdown, files, and notifications

One `MarkdownView` in ui-core wraps a shared renderer based on AIAR's markdown-it 15 foundation. Raw HTML is disabled by default. A reviewed allowlist sanitizer runs identically in SSR/browser after plugins, including any math plugin output; no regex fallback. U1 must pin the sanitizer and compatible server DOM implementation after license/security/SSR review (Sepidjoo DOMPurify 3.3.3 is evidence, not permission to copy its fallback). Fail closed if the server sanitization path is unavailable. Only this boundary may render sanitized HTML; a private validated type prevents arbitrary callers manufacturing “safe HTML”.

Allow safe links with scheme validation and appropriate rel attributes; protected attachment links go through controlled resource APIs. Images are off unless a declared safe asset policy enables them. Code/pre stay escaped and LTR, preserve whitespace, and allow horizontal scrolling; tables get semantic headers and responsive overflow. Prose follows content direction. CRM summaries, read-only conversation text, chat and AI output share this renderer. Editable drafts stay plain text. Accumulate validated Markdown deltas and render throttled full source safely, including incomplete fences/links/math; final content uses the same renderer. Do not repair output with ad hoc regex, execute tool instructions from text, or send unauthorized retrieved content to models.

Shared upload UI distinguishes selecting → validating → uploading bytes → uploaded → scanning/processing → ready, plus failed/cancelled/unresolved. File-size/type checks assist users; server policy is final. Document Core owns Resource/Document/Version/Asset facts, processing lifecycle, audit and retention. API returns opaque resource identifiers, safe filenames/media types, capabilities, processing state and controlled preview/download actions. Never reveal storage paths/buckets/provider credentials. Upload retry needs a stable upload/session key and backend support; timeout can require status reconciliation. Poll/subscription cleanup follows page/context epoch. Attachment lists retain version identity and separate read/download/use/quote availability; CRM product-contract “assets” remain their domain type.

Toasts are transient feedback with safe text, limited queue, polite live region and pause on pointer/focus; critical errors persist inline. In-app notifications are durable Notification Core records with server-owned unread/read state and pagination. Business notifications are requested by modules through Notification Core; UI never calls email/SMS providers or treats a toast as durable delivery. Shell composes a badge/inbox adapter, not notification routing/retry policy.

## 11. API client and error architecture

Create `intfUiApiClient` with typed named request/response schemas, stable errors and injected base/binding, context, fetch transport, clock/deadline and abort signal. Browser and SSR instantiate the same contract through different credential adapters. Modules call published endpoint adapters; direct `fetch`, XHR, EventSource or WebSocket outside the approved transport boundary is forbidden. Upload progress may use an XHR transport internally; SSE uses authenticated fetch internally. Unknown external data is parsed and schema-validated, not simply cast to `T`.

Browser sends memory access token or approved credential mode, active context version, request/correlation ID and mutation idempotency key where specified. SSR receives only this request's backend session context; explicit allowlisted forwarding prevents credential/header leakage to other origins. Same-origin `/api` is the default; deployment mapping may supply a validated internal backend origin server-side. Private internal origins/secrets never enter browser data. GET cache/dedup keys include session/tenant/context version and query; never deduplicate arbitrary POSTs by content hash. Cache private responses only under explicit policy.

All calls have caller cancellation and operation-specific bounded timeout; every waiter settles. At most one coordinated refresh per browser session epoch, then at most one replay after a pre-execution 401. Mutations replay only under the endpoint's explicit rejection-before-execution/idempotency contract; an uncertain outcome is reconciled, not retried because a token changed. No automatic retry of 403 or of partially committed AI generation. Correlation IDs appear in safe error details/copy support action; raw bodies, stack traces, credentials, prompts and provider errors do not.

| Category / signal | User-facing behavior | Retry/recovery |
|---|---|---|
| Validation / 422 | Field errors + form summary; retain input | Edit and resubmit |
| Authentication / 401 | Coordinated refresh; expired state/login with safe return route if refresh fails | Bounded replay under stated contract |
| Authorization / 403 | Access denied, refresh available context if stale | No refresh loop; choose allowed route/contact administrator |
| Not found / 404 | Safe unavailable/not-found screen | Navigate back; never disclose hidden resource existence |
| Conflict / 409 | Explain stale version/duplicate/domain conflict using stable code | Reload/compare; explicit user retry with current version |
| Rate limit/quota / 429 | Explain restriction and approved retry time/next action | Respect Retry-After; do not infer money balance or retry endlessly |
| Capacity | Temporary capacity message, keep draft | Server-recommended bounded retry/status check |
| Network | Offline/disconnected surface; safe draft preservation in memory | Reads may retry; mutations may be unresolved |
| Timeout | Deadline message; operation status if known | Timeout does not prove backend failure; reconcile side effects |
| Server / 5xx | Safe failure + correlation ID | Bounded safe retry; do not expose backend text |
| Dependency degraded | Optional feature unavailable; retain rest of shell | Retry only dependent feature; status can recover independently |
| Unknown/protocol | Safe generic failure; structured telemetry | Fail closed for security-sensitive data; no fabricated success |

Error codes, not localized strings or raw status alone, discriminate quota/capacity/dependency subtypes. Safe error projection is centralized; module adapters may map their named domain errors to helpful field/action text.

## 12. Authentication and tenant context

Typed session UX states: `ANONYMOUS`, `AUTHENTICATING`, `AUTHENTICATED`, `REFRESHING`, `EXPIRED`, `LOGGED_OUT`. Startup is unresolved until backend bootstrap completes; do not briefly render privileged menu/data. Failure settles pending requests and exposes a recoverable state. Identity includes human/machine actor kind as provided by contracts; UI does not model service identities as fake humans.

Backend owns credentials, rotation, revocation, authorized tenant/scope and capability views. Browser access token is memory-only; no localStorage/sessionStorage/URL token. HttpOnly secure cookie remains backend-issued. Use safe same-origin logical return destinations validated against route bindings; reject open redirect and cross-tenant stale return data. Logout clears context, caches, drafts under policy, notifications and streams, then invalidates backend session. Cross-tab messages carry invalidation/version signals only, not credentials/protected state.

**Required SSR integration:** current FAPA refresh cookie has `Path=/api/`, which is unavailable on ordinary page requests. Do not widen that refresh-token cookie to `Path=/` merely to enable SSR. Web owns the need for authenticated page bootstrap; Identity owns credential semantics, refresh-token scope and the public bootstrap contract. Before protected SSR cutover, Identity must design, approve and implement an appropriate mechanism, such as a separate opaque host-scoped SSR/session-bootstrap credential or an Identity-owned session introspection/bootstrap contract. Any SSR credential must not expose refresh-token material. Identity specifies Secure, HttpOnly where applicable, SameSite, Origin/CSRF, rotation and revocation behavior, including OIDC/API interactions. Prefer Identity-owned session bootstrap/introspection over refresh/rotation on every parallel page load. It returns only a safe session/tenant/capability view for browser-visible load data and a request-limited backend access context held in server locals; no token or credential is serialized into page data. Browser obtains/refreshes its short-lived access context through the canonical auth endpoint. Any Set-Cookie forwarding is explicit and allowlisted. Authenticated responses are private/non-cacheable across users. U1 may implement interfaces and fakes only; U0/U1 authorizes no production cookie change or Web-created authentication authority.

Separate host/domain deployments require host-local session establishment through the approved identity redirect protocol; do not share raw tokens through route/query parameters or assume cookies span arbitrary domains. Missing tenant context never becomes cross-tenant authority.

Tenant switch sequence:

1. Display current tenant and backend-provided switchable contexts, without deriving membership/roles from token claims.
2. If a dirty form or pending mutation exists, offer save/discard/stay or await/reconcile the operation; a local abort cannot prove a mutation was cancelled. Stop new submissions during the transition.
3. Request backend context switch. Until confirmed, retain the old active context; a failed switch does not relabel old data as the new tenant.
4. On success install the newly authorized session/context version, increment tenant epoch, abort/dispose old reads/streams, clear tenant caches/selections/chrome/drafts as policy requires, and ignore all late old-epoch results.
5. Reload route data, capabilities, enabled modules, instance/scope choices and notification state. Resolve current logical route in the new binding; if unavailable, go to its User Dashboard with safe explanation.
6. Invalidate other tabs so they rebootstrap before protected work. Do not reuse old query results or simply change a header/local tenant ID.

Authority remains final for every request. Capability views hide/disable UX only; UI cannot interpret roles, `privs`, `ALL`, CRUD, ACL, ownership, classification/clearance, deny precedence, temporal grants or organization inheritance. Pending operations carry their original context; no operation silently changes tenant on retry.

## 13. AI operation, SSE, and blocking

One generic typed operation model supports JSON and streaming task APIs. Module adapters provide semantic task/request and result schema. AI Router owns model/provider/fallback; UI never selects endpoint/model/GPU or calls a provider. Protected egress and retrieved content remain backend Governance/Authority responsibilities. Structured model output is untrusted; backend validates authoritative mutation, and UI displays proposals/results rather than executing text instructions.

| State | Meaning / transitions | UX |
|---|---|---|
| IDLE | No operation; submit creates operation ID/context epoch | Input/actions available |
| SUBMITTING | Request admitted/pending; JSON may go directly to COMPLETING, stream to STREAMING | Synchronous duplicate-submit lock, localized status, cancel if supported |
| STREAMING | Valid deltas/status, partial content | Render safe partial output, keep user scroll choice, accessible throttled status |
| COMPLETING | Terminal success received; validate/reconcile final DTO/refresh dependent view | Prevent premature duplicate action; retain partial display until final data valid |
| SUCCEEDED | Valid final result confirmed | Unlock, announce completion, display durable result if supplied |
| FAILED | Definitive rejection/protocol failure without uncertain side effect | Unlock, retain useful draft/partial with failure marker; classified retry |
| CANCELLED | Backend cancellation acknowledged, or local-only operation known not submitted | Unlock; label partial cancelled; never claim backend cancellation from abort alone |
| INTERRUPTED | Stream lost after partial output/without terminal; outcome unresolved | Mark incomplete, offer status reconciliation; no silent fallback/restart |
| UNRESOLVED | Submission/stop timed out with possible server effect | Unlock safe navigation, prevent conflicting duplicate; query status/reconcile |

Cancel-requested is an explicit substate/flag, not immediate CANCELLED. One operation ID, request ID, idempotency key (where supported), route generation and tenant epoch bind all updates. Late results cannot overwrite newer drafts/pages/tenants. A mutex/transition guard is acquired synchronously, not only through button disabled markup. `finally` disposes transport/listeners and clears busy scope for every failure path; unresolved business status remains visible after local controls recover.

Navigation prompts only when dirty/pending work requires a decision; abandoned reads abort. For generation, user may stay, request supported cancellation, or leave with a durable job/status link if backend supports that contract. Otherwise dispose the client and clearly preserve an unresolved outcome, not a fictitious cancellation. Never persist protected drafts in browser storage without explicit retention approval. Retry reuses/creates idempotency identity according to backend semantics and distinguishes resend from resume. No automatic provider fallback/restart after committed output; partial content remains marked incomplete on terminal failure.

### SSE protocol and lifecycle

One streaming client uses the API credential/error adapter and authenticated fetch (supports POST/body/headers); no token in EventSource URLs. Validate status/content type before parsing. Incremental TextDecoder retains split UTF-8, partial lines and frames; support CRLF/LF, multi-line data, event/id fields and comment heartbeats. Bounded frame, buffered text and output sizes plus total/idle deadlines come from reviewed transport policy. A heartbeat does not permit unbounded lifetime.

Canonical discriminated event envelope: operation/request ID, optional monotonic sequence/resume ID and one of `STATUS`, `DELTA`, `REFERENCES`, `DONE`, `ERROR`, `CANCELLED`, validated against task contract. Task-specific reference/result payloads remain typed; they cannot contain unauthorized material. Legacy custom `[DONE:]`/FAQ/Widget protocols map through isolated endpoint adapters until backend contracts migrate; do not claim wire compatibility by renaming events.

Exactly one terminal event is required. Duplicate/conflicting terminal events, malformed JSON/schema, oversized frame or data after terminal produce a protocol error and telemetry without leaking content. EOF without terminal is interruption, even if some text exists. A terminal ERROR after DELTA preserves partial output as failed/incomplete. Reader cancel/release, decoder flush, timers and abort listeners settle in all exits. Cancellation sends the explicit backend cancel request with bounded deadline and independently aborts local reading; cancellation timeout is unresolved. Navigation/tenant/module cleanup invalidates operation ownership before transport cleanup.

Default reconnect is **off for generation**. Resume only when the backend exposes a durable operation ID, replay window, ordered event IDs and authorized read/resume contract; deduplicate events and never repeat the initial side-effecting POST. Otherwise offer status/history reconciliation and explicit new generation according to semantics. Safe transport logs include IDs/state/duration, not protected prompts/output, credentials or hidden reasoning.

### Blocking scopes

| Scope | Use | Required behavior |
|---|---|---|
| Application/global | Initial protected bootstrap or committed tenant/session transition | Clear reason, recovery; no stale tenant UI; keep accessible status |
| Page | Initial page data or a workflow affecting all page inputs | Preserve shell navigation unless a real pending decision requires prompt |
| Panel | Customer summary/chat/preview affecting one panel | Other panels remain usable; local cancel/error |
| Form | Submit/generate that consumes or rewrites that form | Disable conflicting controls, keep cancel and readable content |
| Action | Independent button mutation | Disable same action synchronously; prevent keyboard/second-click duplicates |
| Background | Polling/processing/status refresh | Non-blocking status; bounded work, stale indicator and cleanup |

Use `aria-busy`, meaningful status and actual disabled/inert semantics where appropriate; a visual overlay alone is insufficient. Avoid arbitrary loading delays and shared booleans that one request clears while another remains pending.

## 14. Accessibility, SSR, and state ownership

Target WCAG 2.2 AA behavior: semantic landmarks/headings, skip link, labelled controls, described field errors, visible focus, keyboard-complete menus/tables/calendars, dialog/offcanvas focus trap/restoration, sufficient contrast, zoom/reflow and reduced motion. Stream announcements summarize progress at a humane cadence rather than reading every token. Do not force scroll while a user reads previous content. Reuse reference aria/focus mechanisms only with rendered tests. Automated scans complement manual keyboard/screen-reader verification; source labels alone are not conformance.

| Function/state | Boundary and canonical holder | Lifetime/reset |
|---|---|---|
| Session/tenant | Backend facts; SSR locals → safe load view → root context runes | Request/session epoch; refresh/switch/logout invalidate |
| Brand | Backend profile; branding projection → load/context | Deployment/profile version; safe SSR serialization |
| Theme/lang/dir | Shell preference/context + safe cookie | User preference, no protected global singleton |
| Layout chrome | Context instance + leased route descriptors/bindings | Request/layout + navigation/tenant leases |
| Module navigation | Backend availability/capability projection + declarative registry | Rebuild on context/activation change |
| Notifications | Server durable records; root adapter local page cache | Tenant/session-scoped; logout/switch clear |
| Toasts | Root context feedback queue | Short-lived; navigation policy explicit |
| Local page state | Component runes/context | Route instance; form reset/teardown |
| Shareable filters | Validated URL parameters | Navigation; no sensitive values without policy |
| Server-loaded data | Kit load data, private cache policy | Request/context version; invalidation by operation |
| AI/stream state | Per-operation controller + pure ui-core machine | Operation/route/tenant epoch; terminal/disposal |

SSR-safe: pure contracts, Calendar Core, renderer with safe server sanitizer, brand/token resolution, semantic component markup, client factory with injected transport. Server-only: internal backend origin/credentials, cookies, trusted host/binding resolution, backend bootstrap and private config. Browser-only: storage migration, viewport/ResizeObserver, media query subscriptions, file/drop/clipboard APIs, stream interaction, any future rich editor. Browser-only objects are created on mount/inside guarded functions and disposed; no `window/document/localStorage` at SSR-safe module top level. No request/user data in module-global runes/stores/promises. Universal loads must use safe DTOs; do not return tokens or server error objects.

## 15. Routing and deployment independence

Modules publish logical route IDs with parameter schemas, not production URLs. `resolveUiRoute` consumes validated deployment bindings: host/domain, base path, module, optional instance, tenant resolution, entry mode and locale. Supports path-mounted modules, subdomain/domain entry and module-first deployments using the same module components. Generated links and return routes use that resolver; raw request Host is accepted only through trusted ingress/allowlisted binding resolution. Client route data does not establish backend tenant authority.

SvelteKit route groups provide layout composition, not runtime arbitrary route discovery. U1 creates tested route adapters plus a binding resolver: a configured artifact base path handles deployment-wide prefix, and trusted host/logical binding maps supported module entries to their compiled route adapters. Use only APIs confirmed for the pinned Kit version. Truly new executable route code is installed through an artifact, not a runtime manifest string. Test `/`, a non-root prefix, subdomain/domain entry, module-first landing, disabled module deep link and mismatched tenant binding.

Existing `/api`, public embedding asset URLs and legacy `.html`/hash links follow the [coexistence contract](04-migration-contract.md#4-coexistence-routing-and-rollback). Shell/module source never hard-codes production domains or assumes `/crm` is the universal route base. Browser-safe config is a strict public DTO: brand assets/tokens, resolved public route bindings, locale/calendar preferences, enabled contribution descriptors and safe feature/capability views. Server secrets, private API addresses, database/provider credentials and protected payloads are excluded by schema and bundle/SSR tests.

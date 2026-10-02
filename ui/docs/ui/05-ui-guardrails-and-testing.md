# U0 — UI Guardrails and Testing Contract

Status: U0 guardrail contract with UI01–UI16, U1.1 UI19–UI22, and U1.2 UI23–UI24 installed in `scripts/target-ui-guardrails.ts`. UI17–UI18 remain feature/cutover gates. Existing T1/T1.1 architecture gates remain mandatory and are not weakened to accommodate UI work. Sources: [governing conventions](../architecture/02-engineering-conventions.md), [Web instructions](../../apps/web/AGENTS.md), [target contract](03-target-ui-architecture.md), [migration contract](04-migration-contract.md), and inspected [reference tests](01-reference-implementations.md).

## 1. Enforcement scope and timing

These rules, ownership decisions and the [readiness checklist](#8-definition-of-ready-for-u1) are approved for U1 foundation work. The first U1 scaffold change must install the **foundation** checks below before target feature code can merge. U0/U0.1 does not add scripts/dependencies outside its allowed scope. **Before cutover** checks can mature alongside the relevant feature but must block its activation. “Later” means optional sophistication only, never deferring authorization, secrets or isolation controls.

Target scope: `apps/web`, browser-visible `packages/contracts`/branding/ui-core/calendar exports, and `modules/*/web` public contributions, including `.svelte` scripts/templates/styles and transitive imports. Legacy code remains separately identified during coexistence; it is not a blanket exception for new target code. A necessary compatibility adapter has exact path/rule/owner/risk/compensating test/expiry/approval, and may not import prohibited policy into the target. No generic `any` allowance or unrestricted whole-directory suppression.

Use TypeScript compiler/import resolution, Svelte compiler AST, package dependency/export graphs, CSS/SCSS AST and explicit contract schemas where appropriate. Regex can detect suspect strings but cannot prove effective authorization, SSR import safety or safe HTML. Follow T1/T1.1's positive/negative fixture discipline; test aliases, dynamic/re-export edges, type-only runtime distinctions and scope, with actionable diagnostics containing rule ID, path and location. Do not make a rule green by ignoring supported source forms.

## 2. Static guardrail catalogue

| ID | Rule and canonical owner | Mechanism / meaningful fixture | Gate |
|---|---|---|---|
| UI01 | No Tailwind dependency/config/directives; Bootstrap + SCSS baseline | Dependency/import/style AST; reject direct/transitive target Tailwind entry, allow Bootstrap tokens | Foundation |
| UI02 | All frontend network access through API/transport boundary | Resolve fetch/XHR/EventSource/WebSocket usage/imports, including Svelte handlers; approve exact transport files, reject component wrapper/alias bypass | Foundation |
| UI03 | No frontend authorization interpretation | AST/import rules for role/privs/ALL/CRUD/ACL/owner/clearance decision code; reject shared auth helper transplant; allow displaying a role label/backend capability UX | Foundation; backend remains decisive |
| UI04 | One calendar semantic owner | Dependency rules prohibit module-local conversion/picker engines and third-party alternate engines; allow calendar-svelte → calendar-core and module supplied event facts | Foundation |
| UI05 | One Markdown/sanitization owner | Parser/sanitizer imports only in ui-core rich content; Svelte raw HTML only in the reviewed renderer; reject raw HTML in a module, allow validated renderer API | Foundation |
| UI06 | No direct AI/model/provider/Qdrant/database access in Web or browser graph | Resolve prohibited imports, drivers/SDKs/endpoints incl. server routes; positive semantic task API fixture | Foundation |
| UI07 | No server secrets/config in client graph or serialized SSR data | Server-only import/export checks, safe public schema; bundle/SSR canary scan, private error serialization fixture | Foundation checks; build verification before cutover |
| UI08 | SSR-safe modules have no top-level browser globals/shared user state | Svelte/TS import checks plus concurrent SSR test; browser lifecycle access allowed, request-sensitive module-global store/promise rejected | Foundation |
| UI09 | Brand identity only through profile | Detect configured brand literals/assets in target modules, allow deliberate test fixtures and brand defaults in owner | Foundation |
| UI10 | Logical routes and deployment URLs | Reject hard-coded production domains/module absolute mount assumptions; require route resolver/public binding schema; test non-root/domain deployment | Foundation |
| UI11 | No unsafe HTML or unsafe URL interpolation | AST sinks, safe URL/text helpers, sanitizer contract fixtures; reject regex sanitizer fallback and raw toast message HTML | Foundation |
| UI12 | Strict types and public boundaries | `svelte-check`, strict tsc, existing naming/import/export checks; reject any/unchecked unknown/Component<any>/private cross-module imports | Foundation |
| UI13 | Declarative module/chrome contribution contract | Schema and compile-time tests for known component keys/props, duplicate IDs, missing routes, reserved slot replacement | Foundation |
| UI14 | List contract has no mandatory default total | Type/contract fixtures accept items/cursor metadata without total; explicit count variant; reject hidden auto-count in adapter tests | Foundation |
| UI15 | Controlled style layers and breakpoints | Stylelint/SCSS rules plus resolved token tests; flag global utility redefinition, physical layout rules without justified LTR island, arbitrary breakpoint/z-index systems | Foundation; rendered collision tests before cutover |
| UI16 | No browser storage credentials/protected drafts by default | AST sinks + application browser test; reject token persistence/sessionStorage prompt copies, allow non-sensitive theme hints | Foundation |
| UI17 | Abort/terminal/context ownership for async work | Contract and component tests; static rules identify missing operation adapters but do not claim to prove lifecycle from syntax | Before each async feature cutover |
| UI18 | Public assets/config are safe and versioned | Build manifest/export schema and runtime config tests; no paths/credentials/scripts injected by Brand Profile; embed asset compatibility test | Before cutover |
| UI19 | Internal target packages use `@targoman/*` | Validate target package names, dependencies and imports; reject `@fapa/*` or customer-scoped packages, allow approved internal imports | U1.1 foundation |
| UI20 | Generic visual branding comes from Brand Profile | Detect FAPA visual literals and package-name-derived display names in generic Web/UI components; allow `brand.displayName` and explicit owner fixtures | U1.1 foundation |
| UI21 | FontAwesome is the functional icon source | Reject competing icon package imports/dependencies and emoji-only interactive icons; allow FontAwesome classes and textual content emoji | U1.1 foundation |
| UI22 | Required legacy font/icon assets stay present | Check static IRANSansX/FontAwesome files; focused tests validate byte provenance and every local CSS font URL | U1.1 foundation |
| UI23 | Framework-owned labels use the typed locale boundary | Reject a narrow set of hard-coded English shell/shared-control labels; content fixtures remain outside this rule | U1.2 foundation |
| UI24 | Foundation showcase is development-only | Require a server load guard using `import.meta.env.DEV`; production HTTP smoke must return 404 | U1.2 foundation |

Rules UI03/UI07 cannot fully establish security by static pattern matching. They are defense layers paired with backend contract, SSR and browser isolation tests. Exceptions follow repository policy; each rule has a semantic owner and one canonical implementation. No broad rule that forbids harmless role labels or code samples merely containing an authorization word.

## 3. Test layers and likely tools

No test packages are installed in U0. Select/pin tool versions with the framework tuple in U1. AIAR's Vitest 3.2.7 and Playwright 1.62.1 lockfile are concrete candidate evidence, not an automatic compatibility/security guarantee. Svelte Testing Library, user-event, axe integration and stylelint are proposed additions requiring peer/license review. Prefer tools already compatible with the locked stack rather than upgrading application packages to satisfy a test runner.

| Layer | Likely tool / owner | Required proof |
|---|---|---|
| Pure unit | Vitest; calendar-core/ui-core/contracts | Calendar conversion/ranges/recurrence, digit precision, AI state transitions, error/schema parsing; properties and boundaries, not implementation mirrors |
| Component | Vitest + Svelte Testing Library/user-event | Actual controls, labels/errors, focus/keyboard, disabled duplicate prevention, modal restoration, Markdown DOM safety, table no-total behavior |
| API/auth contract | Vitest with injected transport/clock and backend contract fixtures | Request headers/base/context, response schemas, statuses, bounded refresh/replay, timeout/abort/unknown outcome |
| Streaming contract | Chunk-controlled fake ReadableStream + fake clock | Frame/UTF-8 splits, multiline/CRLF, malformed/oversized events, terminal exclusivity, EOF, deadlines/cancel/reader disposal |
| SSR/render | Actual adapter build/server + request harness | Concurrent session/tenant isolation, secret-free load data, hydration, theme/lang/dir, browser-global import safety |
| Route integration | Kit app server + Playwright or request tests | Logical binding/basePath/domain, deep links, disabled modules, scoped admin, safe redirects, old/new routing |
| Accessibility | Testing Library/axe + Playwright + manual keyboard/screen reader | Dialog/menu/calendar/table/stream usability, focus, errors, contrast, reduced motion, zoom/reflow |
| Visual regression | Playwright screenshots for chosen stable components/routes | Light/dark, RTL/LTR, responsive layout, long content and overlay collisions |
| E2E | Playwright against isolated backend test tenant | First slice and later real file/stream/Widget flows, persistent outcome, tenant isolation and recovery |
| Legacy parity | Per-surface inventory-linked scenarios and baseline artifacts | All migration categories and route/action parity; approved defects repaired |

No test merely repeats an `if` expression from a component and calls it a journey. Prefer observable public contracts and rendered interactions. Test-only mocks are injected; production builds must not select a global mock transport based on an ambiguous runtime variable.

## 4. High-risk acceptance scenarios

### Session, SSR, routes, and shell

- N concurrent 401 reads cause one refresh and each request resolves or rejects; refresh rejection settles all; a second 401 expires the session without recursion. Unsafe mutation replay is rejected; 403 never refreshes.
- Simultaneous SSR requests for different tenants/actors/brands produce isolated data/chrome. No token/private origin/secret appears in HTML, serialized data, source maps or browser chunks.
- Identity-owned SSR bootstrap integration is verified in an actual browser under its approved Secure/SameSite/Origin/CSRF and OIDC settings. Page SSR, API calls, refresh, logout and deep-link return work without exposing credentials or widening the existing refresh-token cookie for convenience.
- A tenant switch during a list request, form submission and AI stream cannot display or mutate the new tenant using old context. Failed switch leaves old context intact; successful switch resets routes/caches/capabilities and invalidates other tabs safely.
- A → B navigation followed by A's late response/cleanup cannot clear B chrome/data; cancelled navigation retains current chrome. Hydration matches SSR descriptor output.
- Installed-but-disabled module, unauthorized contribution and unavailable instance have distinct safe behavior. Replacing a capability view cannot bypass backend denial.
- Root, non-root prefix, host/domain binding and module-first entry resolve the same logical module route. Legacy `.html` and hash aliases work through explicit adapters; open redirects and untrusted Host bindings are rejected.

### Calendar, forms, lists, and content

- AIAR conversion fixtures survive extraction; Jalali leap Esfand, Gregorian/Jalali roundtrip, date-only values and supported range boundaries are deterministic. Test historical/current timezone offsets plus DST gap/overlap in a configured zone; no browser-timezone dependence.
- Persian and Arabic input digits preserve caret/composition and serialize canonical values. Negative/decimal/large integer fields follow schema; email/SKU/Latin product names/code are not rewritten.
- Dialog and date-grid keyboard flows include Escape, correct arrows/roving tab, Home/End/PageUp/Down and restored focus. Server 422 field errors preserve entries and are announced.
- Cursor list renders without total, filters reset cursor, explicit count uses identical authorized filters, stale results cannot replace newer search; selection and bulk partial failures have correct IDs/status.
- Unsafe HTML, event handlers, javascript URLs, malformed links, plugin output and mixed RTL/code are tested in SSR and browser. Partial Markdown chunks never enable unsafe content. Summary/thread components reuse the same renderer; editable drafts remain text.

### AI, files, and failure recovery

- Every allowed AI state transition is tested; illegal duplicate submission is rejected synchronously. JSON CRM summary follows submit/complete/result without fabricated deltas.
- SSE tests split every delimiter and multi-byte character, join data lines, handle heartbeats, reject malformed/oversized/schema-invalid data, and require exactly one terminal event. EOF and ERROR after partial output remain incomplete/failure.
- Abort before send, during headers/body, after terminal, cancellation acknowledgment, cancellation timeout and navigation teardown all dispose readers/timers/listeners and release local busy state. Backend outcome may remain UNRESOLVED.
- A stream interruption never restarts a generation POST automatically. Resume requires a tested backend operation/replay contract; repeated event IDs do not duplicate text. Late old-operation/tenant events are ignored.
- Busy overlays prevent keyboard as well as pointer duplicates within the intended scope; other safe panels and navigation remain usable. An exception in rendering/network handling cannot leave the page permanently blocked.
- Upload progress reaching 100% does not mark processing ready. Validate/reject unsafe type/size server-side; retry/status reconciliation does not duplicate files; download/preview uses authorized resource references without storage paths.
- Toast is transient; Notification Core unread/read state survives navigation/restart and is tenant-scoped. Provider outage affects only relevant features. Safe telemetry includes IDs/classification, never credentials, protected content or hidden reasoning.

## 5. Visual and behavioral baseline strategy

Capture legacy evidence **before the corresponding surface is changed**, using an isolated authorized test tenant and deterministic synthetic fixtures. U0 captures no screenshots and makes no visual pass claim. Baseline manifest records route/hash, source commit, fixture version, viewport, browser version, locale/direction, theme, expected action and any known defect.

Representative viewports: mobile 360×800 and 390×844, tablet 768×1024, desktop 1440×900; add 320px/reflow and breakpoint-edge checks where useful. Cover Persian RTL and English/mixed LTR, light/dark, long labels/code, and increased text size. Disable nondeterministic motion/clock/IDs only for capture; separately test reduced-motion and actual progress behavior. Never capture real credentials/customer messages into artifacts.

For the first slice, capture login, dashboard, customer detail/summary, task form with Jalali popup, validation error, loading, empty/forbidden, failed summary and successful result. Later waves add stream partial/error/stop, file upload/processing/failure, Widget editor/inbox/public embed and operational tables. Include focus/keyboard scripts or short behavioral recordings where screenshots cannot prove interaction.

Legacy screenshots are comparison references, not golden pixels for a redesigned target. Establish target component/route goldens after approved visual review. Use bounded tolerances and mask genuinely nondeterministic fields only; do not mask errors, missing content or layout shifts. Review diffs with parity assertions rather than blindly updating snapshots. Gate shared chrome, forms/overlays, calendar, table and Markdown layouts; use targeted visual checks elsewhere to avoid brittle screenshot coverage of every business state.

## 6. Known defects and regression disposition

| Source issue | Correct target expectation | Evidence location |
|---|---|---|
| Historical raw CRM Markdown | Current source already renders summaries/thread; retain it and centralize safe renderer | [00 §5](00-current-state-inventory.md#5-behavior-inventory-and-present-defects) |
| Historical missing Persian/Jalali inputs | Current CRM enhancer/`fa-num` largely fixes this; preserve exceptions and correct timezone ambiguity | 00 §5; calendar/forms tests |
| Incomplete AI blocking | CRM/FAQ overlays already exist; test actual duplicate/keyboard/stale-response control with narrow scope | 00 §5; AI scenarios above |
| Legacy chunk parsing/EOF | Buffered, bounded parser and explicit terminal state | 00 §5; stream contract tests |
| Refresh subscriber hang/recursive retry | Settling single-flight with bounded retry | 00 §5; concurrent 401 contract tests |
| Sepidjoo global chrome/loose props | Request-local context, correlated registry and owner lease | [01 §3.1](01-reference-implementations.md#31-actual-page-to-shell-api) |
| Sepidjoo global CSS/direction/footer defects | Scoped tokens, working direction link and footer row conditions | 01 §3.2; rendered style/chrome tests |
| Required table total | Cursor first with explicit authorized count | 01 §3.3; list fixtures |
| AIAR fixed offset/zone-free time | Explicit wall time/timezone/instant distinction | 01 §4.2; calendar conformance |
| AIAR chat teardown/storage | Full operation disposal/epoch ownership; protected draft policy | 01 §4.3; navigation/tenant tests |
| Unsafe rich HTML fallbacks | One safe renderer in SSR/browser; no regex sanitizer | 01 §3.3/4.3; adversarial content fixtures |
| Broken/placeholder legacy entries | Explicit repair/retirement decision, no fictional implemented parity | [04 matrix](04-migration-contract.md#3-legacy-migration-matrix) |

## 7. Verification and release gates

U0 verification is limited to the authorized documentation change: required files, reference/link validity, inventory/acceptance coverage, production-change check, `git diff --check`, finalized Activity Report and `npm run report:verify`. No application test result is invented from documentation inspection.

For U1 and later implementation, the relevant change gate is: existing architecture/strict type checks + new UI static checks + focused unit/component/contract tests + build/SSR where affected. Add route/E2E/a11y/parity and selected visual evidence for surface activation. Before cutover, prove the real backend integration and rollback procedure. Do not run or expand unrelated suites merely to collect green counts; do not weaken existing red architecture assertions or broaden exceptions. A documentation-only U0 has no reason to rewrite production tests, regenerate runtime artifacts or claim reference application tests passed.

## 8. Definition of Ready for U1

| Criterion | U0 outcome / evidence | Start status |
|---|---|---|
| Current UI inventory complete | 25 HTML entries plus nested CRM/Widget/admin/file/chat/embedded surfaces, [00](00-current-state-inventory.md) | DONE |
| Sepidjoo inspected | Actual UI/shared/API locations, source citations, versions and limitations, [01](01-reference-implementations.md) | DONE |
| AIAR inspected | Actual shell/calendar/transport/auth/Markdown/tests, 01 | DONE |
| Reference reconciliation approved | Comparison and resolved target choices, [02](02-reference-reconciliation.md) | APPROVED FOR U1 |
| Target shell/contribution contract approved | [03 §§2–5](03-target-ui-architecture.md#2-canonical-ownership) | APPROVED FOR U1 |
| API/auth strategy approved | 03 §§11–12; Identity owns SSR bootstrap design and refresh-cookie scope; U1 interfaces/fakes only | APPROVED FOR U1 |
| Calendar reuse decision approved | One extraction into calendar-core/calendar-svelte, 03 §7 | APPROVED FOR U1 |
| Coexistence/cutover model approved | [04 §4](04-migration-contract.md#4-coexistence-routing-and-rollback), including hash limitation; activation remains gated | APPROVED FOR U1 |
| Exactly one vertical slice selected | 04 §2: authenticated customer review/follow-up task/summary | DONE |
| UI static guardrails defined | §2 rule IDs/fixtures/timing; initial U1 scaffold must enforce foundation gates | DONE |
| No unresolved ownership conflict | Owners in 03/04; generic Follow-up remains Follow-up-owned; no reference privilege/persistence/parallel calendar adoption | DONE |
| Reproducible toolchain and extraction plan | Reference versions/provenance in 01/03; clean install/scan/license checks planned for U1 | DEFINED; implementation verification pending |

**Ready for U1: YES.** U0.1 records the user's approval of the corrected U0 architecture for U1 foundation implementation only. U1 may build interfaces/fakes and foundation checks; production route cutover, legacy UI removal, Identity cookie changes, CRM migration, Follow-up production implementation, backend schema changes, ingress switch and production deployment remain outside this approval.

Before U2/U3 protected cutover, separately require implemented Identity SSR/context support, backend schema/route compatibility, ingress bindings, real parity/a11y evidence and rollback readiness. These implementation dependencies do not require expanding U0 into backend work and do not prevent reviewing the U1 foundation now.

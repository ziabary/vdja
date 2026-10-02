# U0 — Current UI Inventory

Status: U0 evidence baseline, 2026-10-02. This document describes inspected source, not a claim that every screen works in a running deployment. Target decisions are in [03](03-target-ui-architecture.md); migration gates are in [04](04-migration-contract.md).

## 1. Scope and evidence

The active FAPA workspace is `/home/user/Projects/vadja/ui`, at repository commit `4bcba94874acd3448a47849776dec61615a86982`. It was clean within this workspace before the U0 report started. Sibling `ui.old`, `ui.new`, and `ui.server` trees are outside this application's serving configuration and are not a second current implementation. They must not be silently included in migration or deleted.

[src/index.ts](../../src/index.ts) serves `public/` directly, then resolves extensionless requests to `public/<path>.html`. It mounts application APIs at `/api` and Swagger UI at `/api-swagger`. Thus `/crm` and `/crm.html`, for example, expose the same source. All **25 HTML files** under `public/` are accounted for below, including prototypes, utilities, and admin pages. A file being served does not establish authorization to its API.

[package.json](../../package.json) builds an Express/TypeScript backend; frontend commands minify HTML/CSS and obfuscate JavaScript. There is no current Svelte application in `apps/web`; [its AGENTS file](../../apps/web/AGENTS.md) describes a target boundary. Current UI uses HTML, imperative JavaScript, Bootstrap **5.3.8** ([CSS](../../public/css/bootstrap.rtl.min.css), [JS](../../public/js/vendors/bootstrap.bundle.min.js)), IranSansX, Font Awesome, Marked **15.0.12** ([vendor header](../../public/js/vendors/marked.min.js)), and MathJax on several AI screens. CRM and Widget add independent component-like render functions and styles.

Inventory method: graph discovery, source inspection of all public HTML entries and their first-party scripts, API mounting/route inspection, and styling/deployment inspection. Source evidence can establish intended behavior and defects such as a method mismatch; it does not establish visual quality, actual permission enforcement, or runtime accessibility. U0 does not capture authenticated screenshots or run external reference applications.

## 2. Shell and state ownership today

| Responsibility | Current implementation | Consequence for migration |
|---|---|---|
| Root/layout/header/footer | Repeated markup in [index](../../public/index.html), [rag](../../public/rag.html), [translate](../../public/translate.html), and other HTML files | No single layout lifecycle; replace repeated chrome with one App Shell |
| Account/services navigation | [app-nav.js](../../public/js/app-nav.js) injects account/services DOM, fetches profile, decodes token fallback, listens for auth changes | Preserve recognizable entry/return flows; replace injection and duplicate auth access |
| CRM shell | [crm.html](../../public/crm.html), [crm.js](../../public/js/crm.js), [crm.css](../../public/css/crm.css) own sidebar, header, search, modal, AI drawer, busy overlay | Module owns business surface; shared shell owns global account/theme/navigation |
| Widget shell | [webwidget.html](../../public/webwidget.html), [widget.js](../../public/js/widget.js) own list, wizard, inbox, analytics, embedded runtime | Separate administration from public embedding and preview |
| Theme | [common.js](../../public/js/common.js) uses `tgmn-dark-mode`, root `data-bs-theme`, direct DOM; CSS variables plus page styles | Preserve light/dark; one target preference owner |
| Direction/language | Most HTML is Persian RTL; [common.js](../../public/js/common.js) guesses output direction from text; `.ltr`/`.fa-num` in [style.css](../../public/css/style.css) | Language is mostly fixed Persian, not a complete localization system; mixed content needs explicit direction |
| Responsive | Bootstrap grid plus 640px rules in [style.css](../../public/css/style.css), CRM 1280/992/720/480px rules in [crm.css](../../public/css/crm.css), Widget custom mobile panel CSS | Consolidate breakpoint definitions; retain useful mobile workflows |
| Global loading | `#loading` toggled by [auth.apiFetch](../../public/js/auth.js), additional page-specific overlays | Concurrent calls can clear shared loading early; rejected network fetch lacks common `finally` |
| Page state | Globals/closures, DOM contents, hash routes, localStorage preferences; [rag.js](../../public/js/rag.js) retains chat/history/active request state | Scope target state by route, session, tenant, and operation |
| Auth | [auth.js](../../public/js/auth.js) stores access token in localStorage, refreshes through cookie, constructs `/login?back=...&service=...` | Target uses in-memory access tokens and backend capability views |
| Workspace | [crm.api.js](../../public/js/crm.api.js) sends `x-crm-workspace`, persists `fapco-crm-workspace`, retries bootstrap without an invalid workspace | CRM workspace is a module instance selection; it is not proof of tenant isolation or tenant switching |

## 3. Complete entry map

Authentication column describes **current UI bootstrap**, not server authorization. `Optional` means `setupAuth(..., false)`; protected actions can still return 401/403. `Required` means the page asks for a token, not that it securely enforces access. Admin APIs additionally check legacy admin privilege in [admin.ts](../../src/routes/admin.ts). Target replaces that interpretation with Authority in a separate backend task.

Dependency notation: **S** streaming; **F** files/documents; **D** dates; **M** Markdown/rich content. `—` means no feature dependency found in that entry. Complexity: L = small surface, M = several states/contracts, H = substantial workflows or async integration. All paths also retain their `.html` form until explicit alias cutover.

| ID | Route / entry | Screen and current owner → target presentation owner | UI auth | Implementation / API dependency | S | F | D | M | Legacy JS / complexity |
|---|---|---|---|---|---|---|---|---|---|
| L01 | `/`, `/index`, `/index.html` | Service landing; legacy platform → Public/User shell | Optional `/` | [index.html](../../public/index.html); auth/profile via nav | — | — | — | — | common/auth/app-nav; L |
| L02 | `/login` | Key, Bale OTP, OIDC login; Identity | Optional selected service | [login.html](../../public/login.html); `/api/auth/{methods,loginByKey,sendBaleOTP,verifyOTP,refresh,oidc/login}` | — | — | OTP expiry | — | common/auth/MD5/inline; H |
| L03 | `/profile` | Account and avatar; Identity presentation | Optional `rag`, API required | [profile.html](../../public/profile.html), [profile.js](../../public/js/profile.js); GET/PUT `/api/auth/profile` | — | Avatar | — | — | common/auth/app-nav; M |
| L04 | `/crm` | CRM workspace, hash screens below; CRM | Required `rag` | [crm.html](../../public/crm.html), [crm.api.js](../../public/js/crm.api.js); `/api/crm/*` | JSON AI | Contract metadata, no binary uploader | Jalali | Summary/thread/assistant | crm/crm.api/jalali-date/marked; H |
| L05 | `/webwidget` | Widget management, wizard/inbox/analytics; Widget | Optional `rag`, management APIs required | [webwidget.html](../../public/webwidget.html), [widget.js](../../public/js/widget.js); `/api/widget/*` | Preview | Logo/knowledge files | Working hours, history dates | Chat | common/auth/app-nav/widget/marked; H |
| L06 | `/webwidget-demo-site` | Host-site install demonstration; Widget | Optional `rag`; public widget session separately | [demo](../../public/webwidget-demo-site.html), widget runtime; public config/session/messages | Yes | References | — | Chat | widget.js embed; M |
| L07 | `/rag` | Chat over data; legacy RAG utility → Knowledge/AI utility presentation | Optional, login prompted for work | [rag.html](../../public/rag.html), [rag.js](../../public/js/rag.js); `/api/rag/*` | Yes | Upload/manage sources | History display | Answers/citations/math | common/auth/app-nav/llm/rag/marked/MathJax; H |
| L08 | `/rahbari` | Specialized corpus chat; legacy rahbari utility | Optional, login prompted for work | [rahbari.html](../../public/rahbari.html); `/api/rahbari/*` through rag.js | Yes | Corpus references; no upload UI | History | Answers/citations/math | common/auth/llm/rag; M |
| L09 | `/rahbari-test` | Test variant of same corpus | Same as L08 | [rahbari-test.html](../../public/rahbari-test.html); same `rahbari` service | Yes | Corpus references | History | Yes | Same shared scripts; M |
| L10 | `/thinker` | Deep chat; legacy thinker utility | Optional, login prompted for work | [thinker.html](../../public/thinker.html), [thinker route](../../src/routes/thinker.ts); `/api/thinker/*` | Yes | No upload configured | History | Yes | common/auth/llm/rag; M |
| L11 | `/think` | Older thinking chat entry | Optional, login prompted for work | [think.html](../../public/think.html) requests `/api/think/*`; no corresponding mount in [index.ts](../../src/index.ts) | Intended | — | History | Yes | common/auth/llm/rag; M, broken route candidate |
| L12 | `/translate` | Text/file translation, dictionary output; legacy translation utility | Optional `translate` | [translate.html](../../public/translate.html); POST `/api/translate`, stop, `/api/file2Text` | Yes | Input document → extracted text | — | Translation/dictionary/math | common/auth/app-nav/llm/inline; H |
| L13 | `/summarize` | Text/file summary; legacy summary utility | Optional `summarize` | [summarize.html](../../public/summarize.html); POST `/api/summarize`, stop, `/api/file2Text` | Yes | Input document → text | — | Output/math | common/auth/app-nav/llm/inline; M |
| L14 | `/faq` | Document inspection and FAQ generation; legacy FAQ utility | Optional `faq` | [faq.html](../../public/faq.html), [faq.js](../../public/js/faq.js); `/api/faq/inspect`, `/api/faq` | Progress stream | Upload/output download | — | Generated output, not shared Markdown component | common/auth/app-nav/faq; M |
| L15 | `/shares` | File tree, repository tab, download requests; legacy shared files → Documents/integration presentation | Optional `shares` | [shares.html](../../public/shares.html); `/api/shares/list`, `requests/{list,add,set-status}`, `req-download/:key`, `download?token=...` | — | Controlled download + requests | Request history | — | common/auth/app-nav/inline; H |
| L16 | `/logs` | Admin log listing and conversation links; platform operations | Required `logs` | [logs.html](../../public/logs.html); GET `/api/admin/logs?action=...` | — | — | Log times | Content renderer present | common/auth/marked/MathJax/inline; M |
| L17 | `/conv?service=...&id=...` | Admin conversation inspection; platform operations | Required `conv` | [conv.html](../../public/conv.html); GET `/api/admin/conversation` | Stored output | Citations in content | Message times | Marked/MathJax | common/auth/inline; M |
| L18 | `/stats` | Dataset/log administration tabs; platform operations | Optional `logs`, admin API required | [stats.html](../../public/stats.html); GET `/api/admin/logs` | — | — | Log times | — | common/auth/inline; M |
| L19 | `/old-stats` | Old usage table | Optional `translate` | [old-stats.html](../../public/old-stats.html) GET `/api/admin/stats`; [server](../../src/routes/stats.ts) only declares an empty POST | — | — | Usage periods | Marked loaded | common/auth/inline; M, broken API candidate |
| L20 | `/admin` | Plain Persian planning text, not an implemented admin application | None | [admin.html](../../public/admin.html); no API | — | — | — | — | No script; L |
| L21 | `/letters` | Plain Persian Secretariat/letter search proposal, not a screen | None | [letters.html](../../public/letters.html); no API | — | — | — | — | No script; L |
| L22 | `/devdocs` | Developer guide/link surface | Optional `devdocs` | [devdocs.html](../../public/devdocs.html); no dedicated business API | — | — | — | Static rich content | common/auth/inline; L |
| L23 | `/sklearn` | Scikit guide surface | Optional `sklearn` | [sklearn.html](../../public/sklearn.html); no dedicated business API | — | — | — | Static content | common/auth/app-nav; L |
| L24 | `/maintenance-mode` | Static maintenance message | None | [maintenance-mode.html](../../public/maintenance-mode.html) | — | — | — | — | Bootstrap only; L |
| L25 | `/fontawesome` | Icon catalogue/debug asset | None | [fontawesome.html](../../public/fontawesome.html) | — | — | — | Static markup | No first-party script; L |

Additional served surfaces: `/api-swagger` is Swagger middleware, not another public HTML file. `/js/widget.js` is also an externally embedded executable entry, independently of L05/L06. [public/public.zip](../../public/public.zip) is a downloadable static archive, not a route implementation; inventory inclusion does not approve its contents for future distribution. Auth OIDC callback is a backend redirect flow, not a frontend screen. Static fonts/images/CSS/JS are shared resource URLs that cutover must preserve.

## 4. Nested screens and feature map

CRM routing is hash-based in [parseRoute/renderRoute](../../public/js/crm.js). All CRM rows inherit L04 auth, workspace header, Jalali helpers, common/auth/Bootstrap, and the same backend boundary. The current APIs return named arrays, not a canonical cursor contract.

| Hash / sub-surface | Behavior and API dependencies under `/api/crm` | Special dependencies | Complexity |
|---|---|---|---|
| `#dashboard` or empty hash | KPIs; task create/edit/archive/toggle; `/dashboard`, `/tasks`, bootstrap customer/member options | Jalali due timestamp, numeric presentation | M |
| `#customers` | Search, health/tier filters, create/edit/archive; `/customers` | Forms, local/filter query state | M |
| `#customer/:id` | Customer details, contacts, owned products/contracts, tickets, activity, notes; `/customers/:id`, `/contacts`, `/assets`, `/tickets`, `/notes`, `/summary` subpaths | Jalali contract dates, Markdown summary/timeline, AI JSON response | H |
| `#opportunities` | Pipeline board, drag stage change, create/edit/detail/archive; `/opportunities` | Date, numeric value, server mutation | H |
| `#conversations` and `#conversations/:id` | Inbox, reader, create/analyze, state/assignee, draft reply, save reply, convert to opportunity; `/conversations`, `/analyze`, `/reply-draft`, `/replies` | Markdown thread, AI JSON; editable draft deliberately stays text | H |
| `#products` | Product catalogue, type filter, create/edit/archive; `/products` | Latin product names/codes, numeric forms | M |
| `#reports` | KPI/report projections; `/reports` | Persian values, date display | M |
| `#team` | Members, role assignment UI, workspace settings; `/team`, `/workspace` | Backend `permissions` UX; no target role interpretation | H |
| Search dropdown (no separate route) | Debounced global search, open customer/conversation; `/search?q=...` | Stale request protection needed | M |
| Assistant drawer (no separate route) | Contextual prompt, answer and resource links; `/assistant` | Markdown, JSON AI, appropriate blocking | M |
| Modal family (no separate route) | Customer/product/contact/contract/ticket/note/opportunity/task/conversation/reply/member/workspace forms | HTML validity + custom numeric/date extraction | H collectively |

Widget routing is in [route/renderEditorTab](../../public/js/widget.js). All management rows inherit L05 authentication/API checks and common/auth/widget scripts.

| Hash / sub-surface | Behavior and API dependencies under `/api/widget` | Special dependencies | Complexity |
|---|---|---|---|
| `#widgets` or empty | List/create/archive widget; collection and `/:id` | Cards, search/filter, empty/loading | M |
| `#editor/:id/identity` | Appearance, logo, destination domain, labels; GET/PUT `/:id` | Logo data URL upload, brand preview | M |
| `#editor/:id/knowledge` | File upload/progress, processing list, delete/retry; `/:id/files` | Binary uploads and derived knowledge state | H |
| `#editor/:id/behavior` | Semantic prompt/behavior settings, fallback/human handoff, working hours; PUT `/:id` | Schedule UI; target Router owns execution routing | H |
| `#editor/:id/operators` | Operator add/enable/remove; `/:id/operators` | Identity/capability presentation | M |
| `#editor/:id/test` | Preview session/chat/contact, device preview, operator polling; `/:id/preview/*` | SSE/Markdown/references; public and preview data must stay distinct | H |
| `#editor/:id/publish` | Validate/publish/unpublish/install code; `/:id/{validate,publish,unpublish,install-code}` | Domain binding and embedded script compatibility | H |
| `#inbox` | Widget/mode/status filters, assign/reply/resolve; `/conversations`, `/:id/conversations/:session/*` | Thread Markdown, polling, responsive reader | H |
| `#analytics` | Widget analytics filter; `/analytics?widgetId=...` | Persian numbers/charts | M |
| Embedded launcher/panel/contact | `/public/:id/{config,sessions}` and session messages/contact | Independent public session, streaming, Shadow DOM/runtime styling | H |

Admin sub-screens in **both** L16 and L18: `#rhbri`, `#rag`, `#law`, `#tr`, `#sum` Bootstrap tab panes; active tab selects the `action` query. L17 is their detail reader. These are not a dynamic module-aware backoffice. L15 separately has `#files`, `#repo`, `#requests` tab panes. RAG-family pages have chat list/new chat/history, optional files/source list, summary/title/question generation, feedback, stop, deletion/clear confirmations and mobile sidebar within the same entry; they are not undiscovered path routes.

## 5. Behavior inventory and present defects

| Concern | Verified behavior / source | Preserve or correct |
|---|---|---|
| Forms and validation | CRM `readForm` normalizes Persian/Arabic digits, custom min/max and Jalali validation; [profile.js](../../public/js/profile.js) validates avatar; HTML `required` remains common | Preserve field meanings and errors; derive validators from canonical contracts; check step/decimal precision explicitly |
| Persian inputs / `fa-num` | CRM `applyCrmInputConventions` adds `fa-num`; email/username/code/URL/SKU and product names can stay Latin; [crm.js](../../public/js/crm.js) | Historical missing behavior is substantially repaired here; test exception fields and caret/clipboard behavior |
| Jalali | [jalali-date.js](../../public/js/jalali-date.js) enhances native date/date-time inputs before CRM modal interaction; dates sent as Gregorian, date-time parsed with browser local timezone then `toISOString()` | Do not regress to native Gregorian fields; replace module-local conversion, make timezone explicit |
| Lists/pagination | CRM loads arrays/bootstrap; Widget lists/filtering; admin table/filter logic inline; no consistent cursor/total API | Preserve filters and meaningful order; bounded list contracts before large-data cutover |
| Modal/drawer | Bootstrap confirm in [common.js](../../public/js/common.js); CRM custom hidden backdrops/body overflow and assistant drawer; Widget custom panels | Focus trap, restoration, keyboard Escape and nested overlay behavior are not proven by backdrop presence |
| Upload | [llm.js](../../public/js/llm.js) uses XHR upload progress + text extraction progress; [widget.js](../../public/js/widget.js) uploads knowledge files/retries processing; [faq.js](../../public/js/faq.js) inspect/generate | Distinguish bytes uploaded from document processing complete |
| Download/attachment | [shares.html](../../public/shares.html) requests download token; Widget renders source references; CRM “assets” are product/contract metadata | Do not misclassify CRM asset rows as Document Core binaries; preserve controlled delivery |
| Markdown | CRM summary, activity and thread call `renderAssistantMarkdown`; Widget has another sanitizer/Marked renderer; legacy RAG/LLM directly assign `marked.parse` output | Historical raw summary display is repaired in current CRM; duplication and unsafe rendering boundaries remain |
| AI blocking | CRM `withAiBlock` covers summary/analyze/reply/assistant; [crm.css](../../public/css/crm.css) defines fixed overlay. FAQ has a busy overlay. RAG disables composer and offers stop | “No blocking anywhere” is false. Broad visual overlays do not prove keyboard exclusion or duplicate-submit prevention |
| Streaming | [llm.js](../../public/js/llm.js) splits each network chunk into lines without retaining partial event data; handles custom `[DONE:]`, `[ERROR]:`, `[CANCELLED:]`; Widget has its own parser | Split JSON events can be lost; normal EOF without terminal event does not reliably settle callbacks; replace parsers |
| Retry | RAG has bounded special disconnect retries and retry UI; shared auth recursively retries on 401 | Auth comment “retry once” has no recursion bound; retry AI only with explicit safe semantics |
| Refresh failure | [auth.js](../../public/js/auth.js) clears refresh subscribers in `finally`, but resolves them only on success | Concurrent waiters can remain pending on failure; target single-flight promise must settle all callers |
| Session expiry/redirect | Existing return route/service, refresh cookie and login methods in [login.html](../../public/login.html), [auth route](../../src/routes/auth.ts) | Keep deep links safely; replace localStorage token and unsafe return destinations with validated route references |
| Permissions/admin nav | CRM uses backend `permissions` booleans; admin backend uses `privs.isAdmin`; nav/token fallback decodes JWT | UI remains UX only; replace privilege interpretation, not backend rules in U0 |
| Toast/error/empty/loading | [common.js](../../public/js/common.js) creates toast HTML; CRM has empty/reload/toast states; Widget has empty/loading panels | Escape messages; persistent errors need inline recovery; no ordinary toast is a durable notification |
| Mobile/accessibility | Bootstrap grids, CRM mobile sidebar/reader and Widget full-screen-ish panel exist; some controls have labels | Actual keyboard/screen-reader and breakpoints must be captured/tested before parity approval |
| Broken/unfinished entries | `/think` service mount absent; old stats GET has only empty POST implementation; `/admin` and `/letters` are plain planning text | Record as defects/placeholders, not missing target functionality to reproduce |
| Legacy duplication | Two log/admin views, two stats generations, two rahbari variants, duplicate Marked asset paths and renderers | Remove only after documented parity or explicit retirement decision |

## 6. Migration complexity and backend seams

Highest risk: Widget editor/public embed/inbox (independent sessions, origin policy, files, polling, stream); RAG chat (history/citations, files, retry/stop); CRM whole workspace (many coupled modal and summary flows). Medium, bounded first slice: customer detail → one follow-up task → smart summary. Login is small visually but high risk in session semantics.

The current CRM summary is **JSON request/response**, not SSE: [crm.api.js](../../public/js/crm.api.js) calls POST `/customers/:id/summary`, and [crm route](../../src/routes/crm.ts) returns the customer DTO. U0 must not invent streaming for it. Shared SSE infrastructure is exercised by RAG/translation/Widget and by contract fixtures before those routes migrate.

Current deployment [Dockerfile](../../Dockerfile) packages Express and `public/` together on port 3000; [compose](../../docker/docker-compose.yml) exposes the UI/API container directly. No ingress implementation exists under `deploy/` beyond instructions. A second Web runtime plus explicit ingress route ownership is therefore planned infrastructure, not an already available cutover switch.

Current refresh cookie in [auth.ts](../../src/routes/auth.ts) has `/api/` scope. A request for `/crm` cannot supply that cookie to SSR. The target's authenticated SSR bootstrap requires a separately designed Identity-owned mechanism described in [03](03-target-ui-architecture.md), before protected route cutover; this does not approve widening the refresh-cookie scope. U0/U0.1 changes no backend behavior.

Evidence gaps are bounded: runtime screenshots, assistive-technology behavior, production deployment topology and live API compatibility remain future acceptance work. No requested source implementation is unavailable; there is no `REFERENCE_NOT_AVAILABLE` source gap.

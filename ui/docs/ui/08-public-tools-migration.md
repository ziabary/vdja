# U2 public AI tools migration

Status: target Svelte candidates implemented after the source characterization and parity contract on 2026-10-02. Backend behavior and production route ownership remain frozen. Production cutover and legacy deletion are pending. The combined human visual review requested closer parity with the current original site. Revised screenshots await another human review.

## Legacy source map

Express serves `public/*.html` directly and resolves extensionless paths to those files in `src/index.ts:89-98`. The canonical links on `public/index.html` are `/translate`, `/summarize`, and `/faq`; `/translate.html`, `/summarize.html`, and `/faq.html` are working static aliases. Translator additionally reads `?q=<encoded text>`, starts translation on load, and replaces history after a result. No hash-dependent behavior was found.

| Tool | Route and source | Backend calls | Legacy behavior and dependencies |
| --- | --- | --- | --- |
| Translator | `/translate`, `/translate.html`; `public/translate.html` inline script/style; shared `public/css/style.css`, `public/css/app-nav.css`, `public/js/{common,auth,app-nav,llm}.js` | `POST /api/translate`, `POST /api/translate/:reqId/stop`, `POST /api/file2Text?maxChars=2000` for non-text files | Source defaults to `auto`, target to `fa`; 19 selectable language codes plus source auto-detect; source/target equality is corrected by the select handlers. Text auto-submits 2 seconds after typing; Persian RTL auto-detection switches to `fa→en`. Input is trimmed and limited to 2000 characters. Text/Markdown files are read locally; PDF/DOC/DOCX/ODT go through file2Text. Output is either a dictionary JSON record or SSE Markdown; copy is available after completion. Shared `llm.js` handles stream, stop, retry, upload, Markdown/MathJax and error UI. Uses optional auth bootstrap, not a login gate. |
| Summarizer | `/summarize`, `/summarize.html`; `public/summarize.html` inline script/style and same shared assets | `POST /api/summarize`, `POST /api/summarize/:reqId/stop`, `POST /api/file2Text?maxChars=3000` for non-text files | Input text/file; maximum summary words defaults to 200, numeric min 50/max 1000; force Persian checked by default. Input is trimmed, limited to 3000 characters by UI intent. SSE Markdown result; copy Markdown or copy rendered plain text. Shared `llm.js` stop/retry/upload. A legacy `const text` reassignment when over limit throws before submission; recorded defect, not a backend contract. |
| FAQ Generator | `/faq`, `/faq.html`; `public/faq.html`, `public/js/faq.js`, `public/css/faq.css`, shared CSS/nav/auth | `POST /api/faq/inspect`, `POST /api/faq` | File required (PDF/DOC/DOCX/ODT/TXT/MD), drag/drop or file chooser. Inspect gives page count before generation. Defaults: 10 items, 100 answer words, formal tone, source language, whole document. Optional range (`from/to`) or focus (max 500 chars). Streamed batches progressively render escaped question/answer accordions, then up to 100 via “10 more”. Copy Markdown; download Markdown or JSON. Current script does not require a `done` frame before treating nonempty EOF as success; target must treat that as interrupted. |

All three pages load IRANSansX, FontAwesome, Bootstrap RTL and a legacy static logo/footer. The target renders the active BrandProfile and uses its own shell. The Targoman-hosted public route projection selects a Targoman BrandProfile; other foundation routes retain the neutral profile. Shared legacy `common.js`, `auth.js`, `app-nav.js`, `llm.js`, `style.css`, fonts and vendor assets have other consumers and cannot be deleted for U2.

## Visual reference and correction

The reviewer identified the original public site as the design reference and supplied a dark Translator screenshot. The live [`/translate`](https://llm.targoman.ir/translate) and [`/summarize`](https://llm.targoman.ir/summarize) pages were sampled on 2026-10-02; captures are `visual-baselines/u2/legacy-live-translator.png` and `legacy-live-summarizer.png`. The public `/faq` path returned 404 during this sample, so the repository's `public/faq.html` and `public/css/faq.css` remain its visual reference. The live logo variants came from that site's public `/img/logo-light.png` and `/img/logo-dark.png` and are exposed only through the selected public BrandProfile.

The candidate now uses the reference's centered header title, right brand, compact left controls, shared two-column Translator/Summarizer card, single input/output panels, and cyan information panel. Summarizer settings follow the input in one column; FAQ keeps its two-card layout and gains the reference information panel. The reviewer also preferred the original header buttons, so the candidate uses an outlined “Other services” menu, blue existing `/login` link with `back` and `service` parameters, and a gear button for light/dark. The generic `@targoman/ui-core` DropdownMenu owns menu presentation and dismissal; the Web layout supplies public links and locale content. Language choice remains inside the service menu. The login route remains owned by the legacy ingress. The shared stylesheet applies IRANSansX to body text, controls, labels, legends, menus, and banners while FontAwesome retains its icon font. Public information banners and field labels use the 1rem body text size; supporting counters remain smaller. Chrome's rendered-font inspection confirmed the actual custom IRANSansX files on both Summarizer and FAQ, not just the CSS family name.

## Frozen API contract

| Tool/call | Request | Success | Errors and dependencies |
| --- | --- | --- | --- |
| Translator | JSON `POST /api/translate` with `text`, `source_lang`, `target_lang`, `request_id`; same-origin optional legacy auth credentials | `200` dictionary JSON (`phrase`, `translations`, optional `pronunciations`, `synonyms`, `antonyms`, `relWords`, `relExp`) **or** `text/event-stream` with `data: {"delta":"...","cid":...}`, `data: [REF]:...`, `data: [DONE:<id>]`; stop is `POST /api/translate/<id>/stop` returning `{status}` | Blank/equal languages return 400. Dictionary lookup, logging/stats require DB; generation uses configured LLM. No explicit browser timeout in legacy. Stop acknowledgement is distinct from browser abort. |
| Summarizer | JSON `POST /api/summarize` with `text`, numeric `max_words`, boolean `force_persian`, `request_id` | `text/event-stream` with the same delta/ref/done/cancel framing; stop path `/api/summarize/<id>/stop` returns `{status}` | Empty text is invalid. DB logging/stats and configured LLM required. The UI's 3000 character limit differs from backend fallback 2000/configured max; preserve UI serialization and record the mismatch. |
| Shared extraction | Multipart `POST /api/file2Text?maxChars=2000` (translator) or `3000` (summarizer), one `file` field | JSON object containing `text` and extraction metadata/`stripped`; text/MD files bypass this endpoint in legacy | Requires temporary filesystem, parser/converter, and current auth/service policy. UI does not invent a new upload contract. |
| FAQ inspect | Multipart `POST /api/faq/inspect` with one `file` | JSON `{fileName,pageCount,sourceChars}` | Missing/unsupported/empty/over-2M-character file errors. Uses temp filesystem and PDF/document extraction. |
| FAQ generation | Multipart `POST /api/faq` with `file`, `count`, `answer_words`, `tone`, `language`, `scope`, `from`, `to`, `focus`, `prior_questions` (JSON array string) | `200 text/event-stream`: named `meta` `{fileName,sourceChars,selectedChars,pageCount,count,batches}`, `batch` `{index,total,produced,items:[{question,answer,section?}]}`, terminal `done` `{produced}` | Named terminal `error` `{message}` after headers; otherwise HTTP error. File extraction, temp filesystem and configured FAQ LLM required. Backend caps total to 100. |

The legacy AI stream can emit `[ERROR]: ...` or `[CANCELLED:<id>]` and then `[DONE:<id>]`. During generation it writes each `data:` line without an intervening blank line. The target text adapter dispatches each complete data line immediately so partial translation and summary text appears while generation is active; FAQ retains standard named SSE frame handling. The compatibility adapter must map terminal sequences to one target outcome, preserve partial output as incomplete on error, and treat EOF without a terminal marker as interruption. Backend responses may expose internal messages; the target displays safe localized categories only. No generation request is replayed automatically.

## Parity matrix before implementation

The automated column names the required observable check; the manual column is a review condition, not a claimed approval.

| Behavior | Translator legacy → target | Summarizer legacy → target | FAQ legacy → target | Automated test | Manual review |
| --- | --- | --- | --- | --- | --- |
| Initial fields/defaults | auto/fa, empty text → same | empty text, 200, Persian checked → same | empty file, 100 words/formal/source/all → same | rendered controls/defaults | desktop fa/en |
| Validation/submit | trim, source/target constraints, 2000 cap → same wire values | trim, 3000 cap, word count → same wire values | inspected file, range/focus constraints, 10 per batch → same | payload/invalid tests | keyboard and messages |
| Double submit/loading | stop button while active → synchronous lock and state | same | inspect then stream; disable repeat → same | pending request fixture | loading light/dark/mobile |
| Cancel/retry/reset | stop endpoint and explicit retry; no separate reset | same | no cancel endpoint; new generation/more | state/stop tests | controls and focus |
| Success/error/interruption | dictionary or Markdown; safe error and partial state | Markdown; safe error and partial state | progressive escaped accordion; safe error and partial state | fixture/stream tests | output/error visual |
| Copy/download | copy result | copy Markdown/plain | copy Markdown, download MD/JSON | clipboard/blob tests | copy feedback |
| File | local text/MD, extraction for binary docs | same | multipart inspect and generation | multipart fixture | drop/chooser progress |
| Direction/digits | auto content direction, LTR technical island, Persian count | auto content direction, Persian count | locale direction, Persian count | dir/numeric tests | fa RTL/en LTR |
| Mobile/theme/a11y | responsive form; labeled controls/focus | same | responsive cards/accordion | route/a11y smoke | mobile/light/dark/zoom |

## Cutover and rollback plan

Target candidate paths are the same extensionless URLs; explicit `.html` compatibility aliases must preserve the query string. Old owner is Express `public/*.html` via static/extensionless middleware. New owner will be SvelteKit only after each tool passes component, API, architecture, check, build, browser, parity and **human visual** gates. Production ingress must send these three public paths to Web while `/api` remains Express. Rollback is to restore those three ingress bindings to Express and redeploy/revert the frontend artifact; retain the legacy files until all three gates and rollback validation pass. No route switch or legacy deletion is authorized by automated checks alone.

## Legacy deletion ownership map

| File | Exclusive to migrated tools? | Deletion condition |
| --- | --- | --- |
| `public/translate.html`, `public/summarize.html`, `public/faq.html`, `public/js/faq.js`, `public/css/faq.css` | Yes, subject to reference scan | Delete together only after all three gates and reversible route cutover. |
| `public/js/llm.js`, `common.js`, `auth.js`, `app-nav.js`, `public/css/style.css`, fonts, vendors | No | Retain; referenced by other legacy surfaces. |
| `src/routes/translate.ts`, `summarize.ts`, `faq.ts`, `file2Text.ts` and service/database code | Backend | Frozen and retained. |

## Target implementation and compatibility adapters

`apps/web/src/routes/(public)/{translate,summarize,faq}` hold the candidate pages. The Public Shell and home page link all three. Literal `.html` aliases issue 308 redirects to the Svelte canonical route and retain search parameters, including translator `?q`. No production ingress binding changed: Express still owns real public traffic.

`apps/web/src/lib/public-tools/TextTool.svelte` shares the text-tool form, result card, file choice, operation state, safe errors and copy behavior; FAQ retains its distinct file/inspect/batch/accordion flow. `messages.ts` is the typed Persian/English localization boundary for these tools and the public navigation. Forms use `@targoman/ui-core` primitives. The shared `FileDropInput` owns file chooser and drag/drop behavior: Translator and Summarizer accept files across the text input area, while FAQ uses its standalone file panel. The composing tools retain format validation, extraction/inspection, limits and errors; dropped files and chosen files follow the same existing API flow. The shared `MarkdownView` renders text generation; dictionary and FAQ output use Svelte text nodes, not raw HTML. The shared AI operation machine owns submit/stream/terminal/failed/interrupted states. The frozen API adapter is `apps/web/src/lib/api/publicTools.ts`; only the existing Web transport boundary performs network calls. `consumeSseFrames` centralizes UTF-8/SSE framing; adapters map legacy AI markers and FAQ named events. Multipart uploads preserve backend field names. No frontend authorization logic or provider calls were added.

In the text-field variant, an empty unfocused editor shows a centered dashed file card inside the textarea. The card opens the native chooser on click or keyboard activation and has a visible hover/focus state. Focusing the rest of the textarea hides the card and restores the normal editing surface without an extra button inside the typed text. File drop stays active over the entire editor in either state.

Translator retains the legacy two-second automatic submit for ordinary entry, but pauses further automatic submits after any failed request. An explicit retry or manual submission can recover; a successful request or reset enables automatic submit again. The consumed `q` query is removed before its initial request so a refresh cannot repeat a failed query indefinitely. This bounds request churn during an API outage without changing the backend contract.

The UI adapts legacy defects at its boundary: overlong summarizer text is sliced rather than hitting the legacy `const` reassignment exception; EOF without terminal is shown as interrupted; unsafe raw backend error text is reduced to a safe localized category. These changes do not alter backend requests or backend behavior. Source reinspection for U2.1 found that `chatService.ts` accepts a `request_id` only when it has exactly 32 characters. The target now removes UUID hyphens, producing a unique 32-character hexadecimal ID for generation and stop. The earlier U2 claim that a hyphenated UUID was accepted was incorrect.

## U2.1 live environment and reproducible checks

The existing Express app serves port 3000 and uses its ignored local `.config.json`. For this development run, the user-provided MySQL service is on loopback port 33036 with the `TargomanLLM` schema created by `docker/bootstrap.mysql.sql`; its migration ledger contains all 19 unchanged repository migrations. The user-provided vLLM service is on loopback port 8001. Its `/v1/models` response serves model ID `targoman`, `/health` returns 200, and a safe request to the exact `/v1/responses/` endpoint used by `chatService.ts` begins a valid SSE stream. No additional MySQL container, model, provider, embedding service or Qdrant service is needed. Local credentials remain only in ignored configuration and are omitted here.

The schema initially lacked the anonymous user row with ID 1 defined by unchanged migration `3_tblUser.cjs`, although the migration ledger marked it applied. That made generation fail on a per-user stats foreign key after model deltas had begun. The explicit `dev:public-tools:seed-anonymous` command restored only that migration-defined row after verifying the configured local schema, the recorded migration, anonymous group 1 and an empty user table. It refuses other states. It is development data, not a schema change or a replacement migration.

The existing PDF loader expects `src/utils/fileProcessors/pdf/pdf.worker.min.mjs`. `dev:public-tools:pdf-worker` copies the worker from the installed matching `pdfjs-dist` package to that ignored runtime location and refuses a different existing copy. This is package asset provisioning; no backend source was edited. Valid synthetic PDF extraction now returns 200 at both 2000 and 3000 character limits, including through the Web proxy and browser file inputs.

Use Node 22.17+ for Web and live checks. Configure only the ignored `.config.json` to point at the existing services and the served model ID; keep credentials out of the repository. The current local configuration already has those values. The runbook never starts, resets or stops the user-provided database or model service.

```bash
npm run dev:public-tools:pdf-worker
# Only if the existing development schema lacks migration-defined anonymous user 1:
npm run dev:public-tools:seed-anonymous
npm run dev:public-tools:runtime:check
npm run dev:api
# In another terminal:
npm run dev:web
# Direct Express integration:
npm run test:public-tools:live
npm run test:public-tools:live:cancel
# Through the Svelte /api development proxy (replace 5173 if Vite selects another port):
PUBLIC_TOOLS_BASE_URL=http://127.0.0.1:5173 npm run test:public-tools:live
PUBLIC_TOOLS_BASE_URL=http://127.0.0.1:5173 npm run test:public-tools:live:cancel
```

Stop only the API and Web development processes when finished. `dev:public-tools:runtime:check` reads the existing MySQL migration ledger and anonymous row, then confirms that the configured model ID is present in `/v1/models`; it never mutates the services. Ordinary Web development still requires only `npm run dev`.

The direct and proxy live smoke passed Translator, Summarizer and FAQ generation using the actual target API client. Translator and Summarizer returned nonempty SSE results with terminal markers; FAQ emitted named `meta`, `batch` and `done` events with valid items. Invalid JSON inputs returned 400, unsupported FAQ files returned 400, TXT FAQ inspect passed, and valid PDF extraction passed. The separate cancellation smoke passed directly and through the proxy: an active Summarizer stop returned `OK`, followed by `CANCELLED` and `DONE`. The target compatibility adapter now handles the frozen backend's consecutive `data:` lines within one SSE frame. A late browser stop reply no longer leaves an error beside a successful result.

## Live legacy-versus-Svelte evidence

Both browser versions used the same Express backend and semantically equivalent synthetic inputs. Chrome observed these requests and outputs:

| Tool | Legacy and Svelte request shape | Live result and actions |
| --- | --- | --- |
| Translator | `POST /api/translate`, JSON fields `text`, `source_lang=auto`, `target_lang=fa`, 32-character `request_id` | Both rendered a nonempty translation; both copied the result to the browser clipboard. |
| Summarizer | `POST /api/summarize`, JSON fields `text`, `max_words=200`, `force_persian=true`, 32-character `request_id` | Both rendered nonempty Markdown; Markdown and plain-text copy actions placed nonempty text on the clipboard. |
| FAQ | Multipart `POST /api/faq/inspect` with `file`, then `POST /api/faq` with `file`, `count=10`, `answer_words=100`, `tone=formal`, `language=source`, `scope=all`, `from=1`, `to=1`, `focus` empty and `prior_questions=[]` | Both rendered 10 items; Copy placed nonempty Markdown on the clipboard; Markdown and JSON downloads succeeded, with 10 JSON items. |

Legacy and Svelte browser file choosers both extracted a valid synthetic PDF for Translator and Summarizer via `file2Text` and both inspected it for FAQ. Text/Markdown files remain local in the text tools; FAQ TXT inspection and generation passed. No generated prose was compared byte-for-byte because the model is nondeterministic.

Live browser captures are in [`visual-baselines/u2/live/`](visual-baselines/u2/live/): `u21-{legacy,target}-{translator,summarizer,faq}.png` are comparable desktop success states. `u21-target-{translator,summarizer,faq}-{loading,dark,mobile,en,error}-live.png` cover the target state matrix. The live browser checks found Persian RTL desktop and mobile, English LTR desktop, dark theme, no horizontal overflow, and IRANSansX on inputs and buttons. The error captures use safe client-side file validation; direct API validation and dependency requests were exercised separately. These are review evidence, not human acceptance.

## Test and review matrix

| Gate | Translator | Summarizer | FAQ |
| --- | --- | --- | --- |
| Component and contract fixtures | PASS | PASS | PASS |
| Target architecture, Svelte check, tests, builds | PASS | PASS | PASS |
| Direct existing API generation | PASS | PASS | PASS |
| Svelte `/api` proxy generation | PASS | PASS | PASS |
| Equivalent-input legacy and Svelte live browser comparison | PASS | PASS | PASS |
| PDF/browser file flow | PASS | PASS | PASS inspect; TXT generation PASS |
| Copy/download | Copy PASS | Markdown/plain copy PASS | Copy, Markdown and JSON download PASS |
| Human visual acceptance | PENDING | PENDING | PENDING |
| Production route cutover | NOT DONE | NOT DONE | NOT DONE |
| Legacy frontend removal | RETAINED | RETAINED | RETAINED |

The earlier fixture-only screenshots in [`visual-baselines/u2/`](visual-baselines/u2/) remain historical U2 evidence. Production ingress still routes the three public paths to Express. The candidate Svelte routes and `.html` aliases have not been cut over, and exclusively owned legacy frontend files have not been deleted. The final visual gate requires explicit approval of the current live captures.

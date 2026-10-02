# U1 SvelteKit foundation implementation

U1.2 adds the Persian localization baseline, development-only component showcase, and root development command. See [U1.2 showcase and development](07-u1.2-showcase-and-development.md) for the current review workflow; this page retains the U1/U1.1 implementation record.

Status: foundation implemented on 2026-10-02 and corrected by U1.1 before business migration. This document describes the current target UI tree; the U1 Activity Report remains historical. The Express/static UI still owns production routes.

## Workspace and package ownership

The root npm workspace uses one committed `package-lock.json`, with `npm ci` as the reproducible install command. The internal namespace is `@targoman/*`; each package declares exact workspace dependencies and explicit public exports. There are no nested lockfiles.

| Path | Owner |
|---|---|
| `apps/web` | SvelteKit SSR, shell composition, route resolution, API/auth/stream adapters |
| `packages/contracts` | Browser-safe bootstrap, route, contribution, API, stream and cursor contracts |
| `packages/branding` | Validated public Brand Profile projection and semantic tokens |
| `packages/ui-core` | Shared forms, overlays, feedback, cursor table, Markdown and AI state |
| `packages/calendar-core` | Pure date, Jalali, timezone and recurrence semantics |
| `packages/calendar-svelte` | Accessible date and range presentation over Calendar Core |

## Dependency decisions

Versions are exact in manifests and lockfile. U1.1 moved the target frontend to the [SvelteKit 3 migration baseline](https://svelte.dev/docs/kit/migrating-to-sveltekit-3) using isolated Node 22.23.3 for install/check/test/build. `apps/web` requires Node 22.17+; the legacy Express app and root TypeScript 5.9.3 remain separately usable on Node 20.20.0. The root Vite 8 pin aligns the hoisted Vitest peer with the target workspace. TypeScript 7 is intentionally excluded from Svelte tooling.

| Package | Version | Reason / compatibility | License |
|---|---:|---|---|
| `svelte` | 5.57.1 | Kit 3 minimum, Svelte 5 runtime | MIT |
| `@sveltejs/kit` | 3.0.0 | Node SSR, Node ≥22.17, TS 6 / Vite 8 peers | MIT |
| `@sveltejs/adapter-node` | 6.0.0 | Kit 3 standalone Node output | MIT |
| `@sveltejs/vite-plugin-svelte` | 7.3.1 | Vite 8 / Svelte 5 peer | MIT |
| `vite` | 8.3.2 | Kit 3 minimum ≥8.0.12, Rolldown bundler | MIT |
| `typescript` | 6.0.3 | Kit 3 minimum; target workspaces only | Apache-2.0 |
| `bootstrap` | 5.3.8 | Maintained RTL/LTR color-mode CSS dependency | MIT |
| `sass` | 1.102.0 | SCSS compiler; Node ≥20.19 | MIT |
| `@tanstack/table-core` | 8.21.3 | Headless table model, cursor contract remains ours | MIT |
| `vitest` | 5.0.3 | Node ≥22.12, Vite 8 peer | MIT |
| `svelte-check` | 4.7.6 | Svelte 5 / TS 6 diagnostics | MIT |
| `axe-core` | 4.11.3 | Basic automated accessibility checks | MPL-2.0 |
| `markdown-it` | 15.0.2 | HTML disabled; Markdown parser | MIT |
| `dompurify` | 3.4.16 | Reviewed sanitizer policy, both render targets | MPL-2.0 OR Apache-2.0 |
| `jsdom` | 26.1.0 | Server DOM for the same DOMPurify policy; Node ≥18 | MIT |
| `devalue` / `ws` | 5.9.3 / 8.21.0 | Transitive security pins through root overrides and lockfile | MIT / MIT |

The Web production dependency audit is a U1.1 verification gate. The root legacy dependency audit is separate. SvelteKit 3 config lives in `apps/web/vite.config.ts`; `svelte.config.js` was removed. `#lib` uses package imports, `$app/paths` uses `asset`/`resolve`, and TypeScript extends `$app/tsconfig`.

## Shell and browser contracts

`apps/web` has `(public)`, `(user)`, and `(admin)` layout groups. The root layout owns brand, language, direction, Bootstrap color mode, navigation, skip link, global status, responsive shell and footer. Admin entries come from typed contribution descriptors and an enabled/visible projection. Route groups are composition, while the route resolver represents logical ID, module, optional instance, surface, host, tenant and base path; it does not change ingress ownership.

Chrome is a layout-local Svelte context instance. A serializable SSR descriptor supplies the initial title/breadcrumb/actions. Client contributions correlate component keys to props; leases carry owner, route instance, navigation generation, tenant epoch and nonce. Release is idempotent and an old lease cannot erase newer chrome. Compile-time negative tests reject mismatched props.

The root loader uses a safe anonymous fixture bootstrap until Identity publishes the real SSR contract. Auth and tenant code models presentation states, tenant epochs and backend-authorized switches; it stores no tokens and does not evaluate privileges. The API client owns typed HTTP outcomes; only request-local transport adapters call `fetch`. Streaming uses authenticated fetch, bounded SSE parsing, one terminal event and explicit interruption on unfinished EOF. Automatic regeneration/reconnect is absent.

The shell resolves light, dark and system presentation centrally. Explicit SSR theme renders without a client-only flash. Language/direction are explicit; Bootstrap's maintained RTL/LTR CSS is selected by the shell, with logical CSS and LTR islands for identifiers. Persian digit display and input normalization keep serialized numeric values ASCII. No Tailwind or copied Bootstrap distribution is used.

The internal package namespace is `@targoman/*`. Runtime display name, logo, favicon, support/legal identity and tokens come from the active BrandProfile; FAPA is only a possible deployment profile, never a generic default or package name. The current anonymous fixture profile displays a neutral “Workspace” label until Identity/BrandProfile integration is available.

`apps/web/src/lib/styles/main.scss` owns the compatibility utilities: `.fa-num` applies the legacy IRANSansX `ss02` glyph feature without changing numeric values; `.ltr` and `.rtl` provide local direction/alignment overrides; `.hidden` preserves `display:none !important` while the HTML `hidden` attribute stays supported. No module defines these classes. IRANSansX is the Persian default for shell, forms, tables, navigation and rich content. Email defaults to `.ltr`; numeric and Jalali date presentation can use `.fa-num`. Functional icons use the locally copied FontAwesome Pro 6.2.0 CSS/webfonts, while BrandProfile logos remain separate.

## Shared primitives

Calendar Core uses deterministic `Intl` calculations for Gregorian/Jalali conversion, 1200–1600 Jalali bounds, date-only values, IANA zone gap/overlap resolution and bounded recurrence. It has no DOM, Svelte or implicit current clock. Calendar Svelte imports this owner for date, date-time and range fields and keyboard month navigation.

UI Core exports labeled inputs, selects, multiselect, checkbox/radio, textarea, errors/help, dialog/drawer, busy/empty/error/toast, cursor table, AI operation state machine and a single Markdown renderer. Default cursor pages contain `items`, `nextCursor`, `hasMore`; count is a separate explicit variant. Markdown disables raw HTML before sanitization and uses the same DOMPurify options in browser and Node SSR. Only `MarkdownView` renders sanitized HTML. Component and security tests cover the implemented baseline; manual assistive-technology and zoom review remains for feature acceptance.

## Reference reuse and provenance

The sources below were inspected at the commits recorded in [U0 reference study](01-reference-implementations.md). These are adaptations of behavior or fixtures, independently implemented in the target owner; no runtime imports or vendored source copies were made. Both reference application manifests have no declared license and no top-level license file was found, so copying their source is not assumed permissible. Package licenses are listed above.

| Source and exact path | Target path | Adaptation and tests |
|---|---|---|
| Sepidjoo `ui/src/routes/+layout.svelte` | `apps/web/src/routes/+layout.svelte` | Generic request-local shell; SSR route smoke and component checks |
| Sepidjoo `ui/src/lib/stores/layoutStore.svelte.ts` | `apps/web/src/lib/layout/chrome.svelte.ts` | Typed leases and SSR descriptor; lease and compile-time negative tests |
| Sepidjoo `ui/src/routes/(panel)/+layout.svelte`, `ui/src/routes/admin/+layout.svelte` | `apps/web/src/routes/(user)/+layout.svelte`, `(admin)/+layout.svelte` | Separate composition, contribution-driven admin; contribution tests |
| Sepidjoo `ui/src/lib/styles/globals.scss` | `apps/web/src/lib/styles/main.scss` | Semantic tokens, maintained Bootstrap modes and logical CSS; static checks |
| Sepidjoo `ui/src/lib/components/common/TanStackDataTable.svelte` | `packages/ui-core/src/lists/` | Thin cursor model, no mandatory total; table model tests |
| Sepidjoo `ui/src/lib/components/common/PersianNumberInput.svelte` | `packages/ui-core/src/forms/numeric.ts`, `NumberInput.svelte` | Canonical ASCII digits and caret preservation; numeric tests |
| AIAR `PWA/src/lib/domain/date.ts`, `PWA/tests/date.test.ts` | `packages/calendar-core/src/index.ts`, `apps/web/tests/calendar.test.ts` | Pure bounded conversion, zone/DST/roundtrip fixtures |
| AIAR `PWA/src/lib/components/JalaliDatePicker.svelte` | `packages/calendar-svelte/src/DateInput.svelte` | Neutral picker with keyboard and focus behavior; component tests |
| AIAR `PWA/src/lib/api/client.ts` | `apps/web/src/lib/api/`, `src/lib/streaming/` | Typed fake transport and bounded SSE; API/stream tests |
| AIAR `PWA/src/lib/components/MarkdownText.svelte`, `PWA/src/lib/utils/markdown.ts` | `packages/ui-core/src/rich-content/` | One SSR/browser sanitizer boundary; unsafe-link/HTML tests |

This counts **10 adapted reference asset groups**. Reference business policy, local authorization, persistence and provider access were excluded.

## Guardrails and verification

`npm run test:architecture:target-ui` scans the six target paths and returns `ARCHITECTURE_VIOLATION=0`, `TEST_INFRA_FAILURE=0`. `apps/web/tests/guardrails.test.ts` contains one positive/negative self-test pair for each detector.

| Rules | Mechanism |
|---|---|
| UI01–UI04 | Tailwind/import/network/authorization/calendar AST and manifest checks |
| UI05–UI08 | Markdown owner, provider imports, server imports/private environment, top-level browser globals |
| UI09–UI12 | Brand literals, deployment URLs, unsafe sinks, strict types and private imports |
| UI13–UI16 | Correlated contributions, cursor without total, SCSS conventions, browser storage |
| UI19–UI22 | `@targoman` namespace, BrandProfile visual identity, FontAwesome icon source, required local font/icon assets |

Run the root `npm ci` and target `npm run check:web`, `npm run build:web`, `npm run test:ui`, and `npm run test:architecture:target-ui` with Node 22.17+. Run `npm run build` under the legacy Node 20 runtime to verify coexistence. `npm run test:architecture` still reports legacy violations and future `TARGET_NOT_IMPLEMENTED` packages without a baseline or suppression.

## Next gates

The first business slice requires the Identity-owned authenticated SSR bootstrap, backend route/binding contract, real capability projections, tenant switch integration and feature-specific accessibility/route tests. The migrated font headers identify IRANSansX as proprietary and FontAwesome as Pro; no separate license grant file was found in the legacy font tree, so deployment entitlement must be confirmed before external distribution. Production ingress and existing `/`, `/crm` and `/webwidget` remain with Express until an explicit later cutover.

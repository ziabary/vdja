# Activity Report: UI-FOUNDATION-CORRECTION

- Report Path: /home/user/Projects/vadja/ui/docs/reports/20261002-1022-UI-FOUNDATION-CORRECTION.md
- Created At: 2026-10-02T06:52:05.504Z
- Status: COMPLETE

## Purpose and Scope

Correct the U1 target UI foundation per `docs/prompts/U1.1.md` and the user's explicit frontend toolchain modernization: rename internal packages, separate runtime branding, migrate existing fonts/icons and shared utilities, add guardrails/tests, and move the new Web app to Node 22/SvelteKit 3/Vite 8/TypeScript 6. No business screen, production ingress, backend Identity/schema or legacy dependency migration.

## Governing Sources

- Root `AGENTS.md` plus scoped Web, Branding, UI Core, Calendar, Contracts and Architecture instructions.
- `docs/architecture/00-manifest.md`, `01-system-architecture.md`, `02-engineering-conventions.md`, `05-module-architecture.md`, `08-deployment-architecture.md` and dependent subsystem guidance.
- `docs/ui/00` through `06`, actual `public/css/style.css`, IRANSansX and FontAwesome asset trees.
- Official Kit 3 migration: https://svelte.dev/docs/kit/migrating-to-sveltekit-3 ; Vite 8: https://vite.dev/guide/migration.html ; Vitest 5: https://vitest.dev/guide/migration/ . Exact npm engine/peer metadata was checked before pinning.

## Initial Repository State

The completed U1 foundation was present in the workspace but still untracked/modified relative to the parent Git repository. It used `@fapa/*`, Kit 2/Vite 6/TS 5, a generic system font, and lacked the requested local utility/icon asset contract. The U1 Activity Report was already finalized and was not edited. The user supplied `U1.1.md` before this report was started; its modernization amendment was made afterward. Legacy Express routes remained active.

## Pre-existing Workspace Changes

These paths were already changed or untracked when U1.1 began and were not modified as part of this correction:

- `.gitignore`
- `apps/web/src/app.html`
- `apps/web/src/lib/api/transport.ts`
- `apps/web/src/lib/layout/chrome.svelte.ts`
- `apps/web/src/lib/layout/chrome.types.test.ts`
- `apps/web/src/routes/(admin)/+layout.svelte`
- `apps/web/src/routes/(admin)/admin/+page.svelte`
- `apps/web/src/routes/(public)/+layout.svelte`
- `apps/web/src/routes/(user)/dashboard/+page.svelte`
- `apps/web/static/theme-init.js`
- `apps/web/tests/api.test.ts`
- `apps/web/tests/markdown.test.ts`
- `apps/web/tests/stream.test.ts`
- `docs/reports/20261002-0935-SVELTE-FOUNDATION-U1.md`
- `packages/branding/tsconfig.json`
- `packages/calendar-core/src/index.ts`
- `packages/calendar-core/tsconfig.json`
- `packages/calendar-svelte/src/index.ts`
- `packages/calendar-svelte/tsconfig.json`
- `packages/contracts/src/index.ts`
- `packages/contracts/tsconfig.json`
- `packages/ui-core/src/ai-operation/index.ts`
- `packages/ui-core/src/feedback/BusySurface.svelte`
- `packages/ui-core/src/feedback/EmptyState.svelte`
- `packages/ui-core/src/feedback/ErrorState.svelte`
- `packages/ui-core/src/feedback/Toast.svelte`
- `packages/ui-core/src/forms/Checkbox.svelte`
- `packages/ui-core/src/forms/ErrorSummary.svelte`
- `packages/ui-core/src/forms/FieldHelp.svelte`
- `packages/ui-core/src/forms/FormError.svelte`
- `packages/ui-core/src/forms/Radio.svelte`
- `packages/ui-core/src/forms/numeric.ts`
- `packages/ui-core/src/index.ts`
- `packages/ui-core/src/overlays/Dialog.svelte`
- `packages/ui-core/src/overlays/Drawer.svelte`
- `packages/ui-core/src/rich-content/pipeline.ts`
- `packages/ui-core/src/rich-content/render.browser.ts`
- `packages/ui-core/src/rich-content/render.server.ts`
- `packages/ui-core/src/svelte.d.ts`
- `packages/ui-core/tsconfig.json`

## Files Added

- `apps/web/static/fonts/fontawesome/v6.2.0/all.css`
- `apps/web/static/fonts/fontawesome/v6.2.0/sharp-solid.css`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-brands-400.ttf`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-brands-400.woff2`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-duotone-900.ttf`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-duotone-900.woff2`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-light-300.ttf`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-light-300.woff2`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-regular-400.ttf`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-regular-400.woff2`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-sharp-solid-900.ttf`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-sharp-solid-900.woff2`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-solid-900.ttf`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-solid-900.woff2`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-thin-100.ttf`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-thin-100.woff2`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-v4compatibility.ttf`
- `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-v4compatibility.woff2`
- `apps/web/static/fonts/iransansx/fontiran.css`
- `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-Black.woff`
- `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-Bold.woff`
- `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-DemiBold.woff`
- `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-ExtraBold.woff`
- `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-Light.woff`
- `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-Medium.woff`
- `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-Regular.woff`
- `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-Thin.woff`
- `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-UltraLight.woff`
- `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-Black.woff2`
- `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-Bold.woff2`
- `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-DemiBold.woff2`
- `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-ExtraBold.woff2`
- `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-Light.woff2`
- `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-Medium.woff2`
- `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-Regular.woff2`
- `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-Thin.woff2`
- `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-UltraLight.woff2`
- `apps/web/tests/assets.test.ts`
- `apps/web/tests/branding.test.ts`
- `apps/web/tests/namespace.test.ts`
- `docs/reports/20261002-1022-UI-FOUNDATION-CORRECTION.md`

## Files Modified

- `apps/web/AGENTS.md`
- `apps/web/package.json`
- `apps/web/src/hooks.server.ts`
- `apps/web/src/lib/api/client.ts`
- `apps/web/src/lib/auth/session.ts`
- `apps/web/src/lib/layout/contributions.ts`
- `apps/web/src/lib/routing/resolve.ts`
- `apps/web/src/lib/server/bootstrap.ts`
- `apps/web/src/lib/streaming/parser.ts`
- `apps/web/src/lib/streaming/transport.ts`
- `apps/web/src/lib/styles/main.scss`
- `apps/web/src/routes/(public)/+page.svelte`
- `apps/web/src/routes/(public)/foundation/+page.svelte`
- `apps/web/src/routes/(user)/+layout.svelte`
- `apps/web/src/routes/+layout.server.ts`
- `apps/web/src/routes/+layout.svelte`
- `apps/web/tests/calendar.test.ts`
- `apps/web/tests/components.test.ts`
- `apps/web/tests/foundation.test.ts`
- `apps/web/tests/guardrails.test.ts`
- `apps/web/tsconfig.json`
- `apps/web/vite.config.ts`
- `docs/architecture/00-manifest.md`
- `docs/architecture/01-system-architecture.md`
- `docs/architecture/02-engineering-conventions.md`
- `docs/architecture/08-deployment-architecture.md`
- `docs/prompts/U1.1.md`
- `docs/ui/03-target-ui-architecture.md`
- `docs/ui/05-ui-guardrails-and-testing.md`
- `docs/ui/06-u1-foundation-implementation.md`
- `package-lock.json`
- `package.json`
- `packages/branding/AGENTS.md`
- `packages/branding/package.json`
- `packages/branding/src/index.ts`
- `packages/calendar-core/package.json`
- `packages/calendar-svelte/package.json`
- `packages/calendar-svelte/src/DateInput.svelte`
- `packages/calendar-svelte/src/DateRangeInput.svelte`
- `packages/calendar-svelte/src/DateTimeInput.svelte`
- `packages/contracts/package.json`
- `packages/ui-core/AGENTS.md`
- `packages/ui-core/package.json`
- `packages/ui-core/src/forms/EmailInput.svelte`
- `packages/ui-core/src/forms/MultiSelect.svelte`
- `packages/ui-core/src/forms/NumberInput.svelte`
- `packages/ui-core/src/forms/Select.svelte`
- `packages/ui-core/src/forms/TextInput.svelte`
- `packages/ui-core/src/forms/Textarea.svelte`
- `packages/ui-core/src/lists/CursorTable.svelte`
- `packages/ui-core/src/lists/model.ts`
- `packages/ui-core/src/rich-content/MarkdownView.svelte`
- `scripts/target-ui-guardrails.ts`

## Files Deleted

- `apps/web/svelte.config.js` (U1 untracked Kit 2 configuration, removed for Kit 3)

## Implementation Summary

- Renamed all six target workspace packages and imports to `@targoman/*`; updated scripts, lockfile, tests and documentation without an `@fapa` compatibility alias.
- Upgraded only target UI tooling to Svelte 5.57.1, Kit 3.0.0, adapter-node 6.0.0, plugin 7.3.1, Vite 8.3.2, Vitest 5.0.3 and TypeScript 6.0.3. Target Web declares Node >=22.17 <23. Root TypeScript remains 5.9.3 for legacy Express; root Vite 8 pin aligns Vitest's hoisted peer.
- Migrated Kit config to `vite.config.ts`, `$lib` to `#lib`, old `$app/paths` base to `asset`/`resolve`, Hook type to `@sveltejs/kit/hooks`, and TS config to `$app/tsconfig`.
- Migrated exact existing IRANSansX and FontAwesome Pro assets into Web static tree. Added central `.fa-num`, `.ltr`, `.rtl`, `.hidden` styles, Persian default font and FontAwesome functional date navigation icons.
- Added direction options to shared forms and calendar fields; generic NumberInput uses opt-in `faNum` so Latin numeric fields are not changed for appearance.
- Added UI19 namespace, UI20 brand, UI21 icon and UI22 static-asset target rules with positive/negative fixtures, byte/CSS-reference asset tests, namespace/brand tests and component utility tests.
- Updated governing architecture, target UI contracts, implementation documentation, scoped AGENTS and the U1.1 prompt amendment. The historical U1 report remains untouched.

## Namespace Migration

| Old package | New package | Imports changed |
|---|---|---|
| `@fapa/web` | `@targoman/web` | root workspace scripts and lockfile |
| `@fapa/contracts` | `@targoman/contracts` | Web/shared package source imports and lockfile |
| `@fapa/branding` | `@targoman/branding` | Web/tests/lockfile |
| `@fapa/ui-core` | `@targoman/ui-core` | Web/tests/lockfile |
| `@fapa/calendar-core` | `@targoman/calendar-core` | Web/Calendar Svelte/tests/lockfile |
| `@fapa/calendar-svelte` | `@targoman/calendar-svelte` | Web/tests/lockfile |

Search of target production source/manifests and root lockfile for `@fapa/`: **0**. One intentional negative guardrail fixture retains the old spelling under `apps/web/tests/guardrails.test.ts`.

## Toolchain Modernization

| Component | Pinned version | Runtime/peer evidence |
|---|---:|---|
| Node runtime for Web | 22.23.3 verified; >=22.17 declared | Kit 3 minimum 22.17 |
| Svelte | 5.57.1 | Kit 3 peer >=5.57.1 |
| SvelteKit | 3.0.0 | Node 22.17+, TS 6, Vite >=8.0.12 |
| adapter-node | 6.0.0 | Kit 3 peer |
| vite-plugin-svelte | 7.3.1 | Vite 8/Svelte 5 peer |
| Vite | 8.3.2 | Kit 3 peer; root hoist aligned for Vitest |
| Vitest | 5.0.3 | Node >=22.12 and Vite 8 peer |
| TypeScript target | 6.0.3 | Kit 3 peer, no TS 7 |
| TypeScript legacy root | 5.9.3 | Express build coexistence |

The isolated verification binary was `/tmp/u11-node22/node_modules/node/bin/node`; no Node 22 runtime or backend dependency was installed into the repository. The root npm 11 clean install succeeded; the legacy Node 20/npm 10 Express build still succeeded. Production Web npm audit: zero advisories.

## Brand Separation

The active validated BrandProfile projection owns display/short name, logo, favicon, support/legal URL and primary token. The shell renders those fields from `data.bootstrap.brand`; generic UI does not derive them from package metadata. The current anonymous fixture uses neutral “Workspace.” Tests prove distinct explicit BrandProfile fixtures; a FAPA profile selects FAPA values, another profile selects its own values. Hard-coded FAPA generic runtime branding: **0**. Customer/deployment names are not internal package/module IDs.

## Static Asset Migration

The legacy CSS source is `public/css/style.css`: `.fa-num` sets IRANSansX `ss02`, `.ltr` and `.rtl` set direction/alignment, and `.hidden` sets `display:none !important`. Legacy HTML refers to `fonts/fontawesome/active/all.css`, but that `active` path is absent in this checkout; the actual present FontAwesome source is `public/fonts/fontawesome/v6.2.0/all.css` plus its webfonts. The table records every migrated file; each SHA-256 value matches the source and target bytes. The unrelated duplicate `fa-light-300.ttf.1` was not copied.

| Legacy source path | Target path | SHA-256 (both) | Usage |
|---|---|---|---|
| `public/fonts/IranSansX/fontiran.css` | `apps/web/static/fonts/iransansx/fontiran.css` | `7343ba43c0025a8028a5ea333fab9ba5dc10359e5252023eb419b3872e6bb6e4` | CSS |
| `public/fonts/IranSansX/fonts/woff/IRANSansX-Black.woff` | `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-Black.woff` | `39d222d836676019feb8c7472998f8d81222d3fc2323504b339621e33af3d814` | webfont |
| `public/fonts/IranSansX/fonts/woff/IRANSansX-Bold.woff` | `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-Bold.woff` | `1c4d25325667d62aec374fc2cc7cb73d695bcb74034cd8031df33e8821e37559` | webfont |
| `public/fonts/IranSansX/fonts/woff/IRANSansX-DemiBold.woff` | `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-DemiBold.woff` | `d67a200c866fd984b5c16fc201fe2cefb23934d8c9fc54aa8b1cd345a5ffdaca` | webfont |
| `public/fonts/IranSansX/fonts/woff/IRANSansX-ExtraBold.woff` | `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-ExtraBold.woff` | `8b310a60ae6282df956b73296d07a7095a8aa024d1c0ac0f68b06ba0542de4d6` | webfont |
| `public/fonts/IranSansX/fonts/woff/IRANSansX-Light.woff` | `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-Light.woff` | `1c70072afdfbf6dfd0b9d70c5862199d50b034c991b12bfa6fb9742bfda830e0` | webfont |
| `public/fonts/IranSansX/fonts/woff/IRANSansX-Medium.woff` | `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-Medium.woff` | `999a767d1f294d5e4872f771fc2d3513179f48a0b610cd7af4af03e60887426a` | webfont |
| `public/fonts/IranSansX/fonts/woff/IRANSansX-Regular.woff` | `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-Regular.woff` | `0412a67e04eb673c1ce8909e846bec2ed6c59186338ecf22133e693276490094` | webfont |
| `public/fonts/IranSansX/fonts/woff/IRANSansX-Thin.woff` | `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-Thin.woff` | `19df08d15303b12fbaa81894d1b9835311cd2726ecef2a328d8ba05cb021c0ba` | webfont |
| `public/fonts/IranSansX/fonts/woff/IRANSansX-UltraLight.woff` | `apps/web/static/fonts/iransansx/fonts/woff/IRANSansX-UltraLight.woff` | `53c0a1a043d9a71329943d206e1d95d455df132da0ce903301a11eea7f8380dd` | webfont |
| `public/fonts/IranSansX/fonts/woff2/IRANSansX-Black.woff2` | `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-Black.woff2` | `5c0fe3fc51320e81f21b7f7807661723d433538e402c74ff634a610efc631f19` | webfont |
| `public/fonts/IranSansX/fonts/woff2/IRANSansX-Bold.woff2` | `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-Bold.woff2` | `8589758429cf42a6007e92a57308885d5f5ff71cf45d4f4e0e065ec16e371434` | webfont |
| `public/fonts/IranSansX/fonts/woff2/IRANSansX-DemiBold.woff2` | `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-DemiBold.woff2` | `ca8ad411b0869c6691529759116dcb04de553c32817db00326eefed034c257dd` | webfont |
| `public/fonts/IranSansX/fonts/woff2/IRANSansX-ExtraBold.woff2` | `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-ExtraBold.woff2` | `a2aaedc1707ab6bd79ce32edee75b945c1c8e09fbec1a676237cdb6121eca297` | webfont |
| `public/fonts/IranSansX/fonts/woff2/IRANSansX-Light.woff2` | `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-Light.woff2` | `cee8400ffc51d9e52ef9bc18f2f40af929392462ba38d78af62308770d980ff2` | webfont |
| `public/fonts/IranSansX/fonts/woff2/IRANSansX-Medium.woff2` | `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-Medium.woff2` | `de352397bbf27d2158172ae8a13f7893eb61d29b11033023a5226814c18cb86f` | webfont |
| `public/fonts/IranSansX/fonts/woff2/IRANSansX-Regular.woff2` | `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-Regular.woff2` | `815cea82762b1eada5cce5374de932f4993a99fc466c944f500d4b484fbbb00e` | webfont |
| `public/fonts/IranSansX/fonts/woff2/IRANSansX-Thin.woff2` | `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-Thin.woff2` | `cd870166f1f115c0e8579581e6a69eacea34aa2ce31d478ab2f5fec03cf78729` | webfont |
| `public/fonts/IranSansX/fonts/woff2/IRANSansX-UltraLight.woff2` | `apps/web/static/fonts/iransansx/fonts/woff2/IRANSansX-UltraLight.woff2` | `fb954915cb253ab4f24d8fd14a742c55f6837216016bddbfdcf9e918d9004df1` | webfont |
| `public/fonts/fontawesome/v6.2.0/all.css` | `apps/web/static/fonts/fontawesome/v6.2.0/all.css` | `eba4950b2f30c624c7f174c71a2df2be09bb9f16198faf660374f7cd6ab30984` | CSS |
| `public/fonts/fontawesome/v6.2.0/sharp-solid.css` | `apps/web/static/fonts/fontawesome/v6.2.0/sharp-solid.css` | `94c2c7a82441cd548fd1e3c423af51a4456ef12d50eb84310e5923ee4e1c2df3` | CSS |
| `public/fonts/fontawesome/v6.2.0/webfonts/fa-brands-400.ttf` | `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-brands-400.ttf` | `b0d7eebb73e595053f2a2e7d6a50d8c3f9fd7bb19e34e29fa8a5362ac0cc1086` | webfont |
| `public/fonts/fontawesome/v6.2.0/webfonts/fa-brands-400.woff2` | `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-brands-400.woff2` | `cb0b7d24404b10cb5cbdc891ab5789ac7d00d2e241c26db64422d5437bc383b7` | webfont |
| `public/fonts/fontawesome/v6.2.0/webfonts/fa-duotone-900.ttf` | `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-duotone-900.ttf` | `89e285ab0faa66e724f896e819cac45accd6bad397871411403a899926461edd` | webfont |
| `public/fonts/fontawesome/v6.2.0/webfonts/fa-duotone-900.woff2` | `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-duotone-900.woff2` | `06323e048f41aef56c7753ecbb5a7a3c91113ea1a2514905c30e049cfcf06be3` | webfont |
| `public/fonts/fontawesome/v6.2.0/webfonts/fa-light-300.ttf` | `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-light-300.ttf` | `657f35441591c1d6eb0794fae51984d2e55eea02e2126d874ace0043b28e653d` | webfont |
| `public/fonts/fontawesome/v6.2.0/webfonts/fa-light-300.woff2` | `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-light-300.woff2` | `f450dd903b7e6e62eb9c722c2f475142ca1b2dbfff601f1c4f7611ccfc1e1d04` | webfont |
| `public/fonts/fontawesome/v6.2.0/webfonts/fa-regular-400.ttf` | `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-regular-400.ttf` | `67181d56a16e644ebf9644be2cd018cf4014f0a87cad1a0a2040ecec1ed6a4b6` | webfont |
| `public/fonts/fontawesome/v6.2.0/webfonts/fa-regular-400.woff2` | `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-regular-400.woff2` | `096a382650b21de3c73d99257b3c58e36f916f2dbbe2a1c6c29d62cb40005821` | webfont |
| `public/fonts/fontawesome/v6.2.0/webfonts/fa-sharp-solid-900.ttf` | `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-sharp-solid-900.ttf` | `af23da7e210ea54b40732aa956fbb2cb5e906ee90b819bd50cc6beab5fab4d64` | webfont |
| `public/fonts/fontawesome/v6.2.0/webfonts/fa-sharp-solid-900.woff2` | `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-sharp-solid-900.woff2` | `703dd0a4e05a9f64926f8b4e341dacdc3bfc1dc1bebe2d406e2399aa16fddb32` | webfont |
| `public/fonts/fontawesome/v6.2.0/webfonts/fa-solid-900.ttf` | `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-solid-900.ttf` | `447c5feb270e07b0e91d0ac8b8eb749569bbd9fbcd614548ffc07bff3cc097df` | webfont |
| `public/fonts/fontawesome/v6.2.0/webfonts/fa-solid-900.woff2` | `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-solid-900.woff2` | `c5d9c49183cdd250b5282ddf8e8e9272b26fb15348ac8aea037ec45dfbdc53aa` | webfont |
| `public/fonts/fontawesome/v6.2.0/webfonts/fa-thin-100.ttf` | `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-thin-100.ttf` | `98efa6938c077fa83732400c39af8e44cf7ac5fdc3ec33918bd0a0b7095b6152` | webfont |
| `public/fonts/fontawesome/v6.2.0/webfonts/fa-thin-100.woff2` | `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-thin-100.woff2` | `b13e8c34a5770ac000ba3fdb593fc57a10106584e0195e1d9672bfb38e492e65` | webfont |
| `public/fonts/fontawesome/v6.2.0/webfonts/fa-v4compatibility.ttf` | `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-v4compatibility.ttf` | `074d3757b884e345ddafb6e6609ed630dce5042aa74fea3357f0c21db06d3440` | webfont |
| `public/fonts/fontawesome/v6.2.0/webfonts/fa-v4compatibility.woff2` | `apps/web/static/fonts/fontawesome/v6.2.0/webfonts/fa-v4compatibility.woff2` | `8eeacff9ffbee160740f72df12fc1b92e693a5b8c2062ff051696503592d7247` | webfont |

IRANSansX `fontiran.css` identifies version 2.4 and proprietary/commercial terms with an unfilled project-license placeholder. FontAwesome CSS identifies Font Awesome Pro 6.2.0. No separate grant file was found in these asset trees. Existing files were copied byte-for-byte, with comments retained and no Internet replacements; external distribution entitlement remains an operator check.

## Shared Utility Contract

Canonical owner: `apps/web/src/lib/styles/main.scss`. Shared components consume these classes; no module-local definitions were added.

| Class | Owner | Semantics | Primary use |
|---|---|---|---|
| `.fa-num` | Web shared stylesheet | IRANSansX `ss02` presentation only | Opt-in Persian counts, dates, labels; values stay ASCII/canonical |
| `.ltr` | Web shared stylesheet | Local LTR plus left alignment/isolation | Email, URLs, code and Latin identifiers |
| `.rtl` | Web shared stylesheet | Local RTL plus right alignment/isolation | Persian local field/container overrides |
| `.hidden` | Web shared stylesheet | `display:none !important`; HTML `hidden` supported | Explicit compatibility hiding, never authorization |

## Icon System

Functional icon source: **FontAwesome Pro 6.2.0** from the existing repository. Date picker navigation now uses labeled buttons with decorative FontAwesome icons. Brand logos remain BrandProfile assets. Competing icon packages in target manifests: **0**; UI21 rejects their imports/dependencies and emoji-only interactive icons.

## UI Guardrails

UI01–UI16 remain active. U1.1 added UI19 (package namespace), UI20 (generic brand separation), UI21 (icon system) and UI22 (required static assets). UI15 now permits only the four canonical utility definitions in the shared stylesheet and rejects duplicates elsewhere. Guardrail self-tests contain rejecting and accepting fixtures; asset tests verify exact bytes, CSS URL resolution and non-empty required files. No source directory was excluded or grandfathered to make the gate pass.

## Target Gate

`npm run test:architecture:target-ui`: `ARCHITECTURE_VIOLATION=0`, `TEST_INFRA_FAILURE=0`. Repository-wide architecture runner remains red with 212 legacy violations, 24 unrelated `TARGET_NOT_IMPLEMENTED` packages and 0 infrastructure failures. No new target finding appears; its generated legacy report was restored to the original tracked content after the run.

## Architecture Decisions / Deviations

- Internal identity is `@targoman/*`; runtime visual identity is BrandProfile. FAPA is one possible deployment profile only.
- Target Web requires Node 22; root TypeScript 5.9.3 and legacy backend dependencies stay unchanged for Express coexistence. TypeScript 7 was not adopted.
- FontAwesome Pro and IRANSansX are reused from the existing repository without replacing their builds. Their original copyright/proprietary headers are preserved.
- The approved compatibility utility quartet is a deliberate exception to the general ban on redefining Bootstrap utility semantics; definitions have one owner and UI15 rejects duplicates.

## Tests and Verification

| Command/check | Result | Evidence |
|---|---|---|
| Node 22.23.3/npm 11 `npm ci` | PASS, exit 0 | 781 packages from single lockfile |
| Node 22 `npm run check:web` | PASS, exit 0 | 0 errors, 0 warnings |
| Node 22 TypeScript 6 `tsc --noEmit -p apps/web/tsconfig.json` | PASS, exit 0 | Strict types and chrome negative assertions |
| Node 22 `npm run test:ui` | PASS, exit 0 | 60 tests across 10 files |
| Node 22 `npm run build:web` | PASS, exit 0 | Kit 3 SSR and adapter-node 6 output |
| Local Node 22 HTTP smoke | PASS, exit 0 | Four routes 200; IRANSansX CSS and 18 refs, FA CSS and 30 refs, sharp CSS and 2 refs all 200 |
| `npm run test:architecture:target-ui` | PASS, exit 0 | 0 violations, 0 infrastructure failures |
| Web production `npm audit --workspace @targoman/web --omit=dev` | PASS, exit 0 | 0 advisories |
| Node 20 `npm run build` | PASS, exit 0 | Existing Express tsup/DTS build |
| `git diff --check` | PASS, exit 0 | No whitespace errors |
| `npm run test:architecture` | Expected FAIL, exit 1 | 212 legacy violations, 24 future packages, 0 infra |

## Expected Failures

The existing repository-wide architecture runner remains red for legacy code and future target packages. A first Kit 3 install attempt with npm 10 failed in Arborist peer resolution; isolated Node 22/npm 11 resolved the requested tuple. A first build spawned a Node 20 child and failed at `Promise.withResolvers`; setting Node 22 on child PATH resolved it. Neither failure remains in the verified commands.

## Unexpected Failures

None outstanding. The finalized target check, tests and build are green.

## Production Code Changes

Only new target Web/shared UI code and workspace package tooling were changed. Legacy Express source/static UI, backend Identity cookie semantics, database schema/migrations, CRM/Widget screens and production ingress bindings were not changed.

## Production Cutover

NO. Existing Express/static routes remain production owners. The new Kit 3 application runs independently for development/test.

## Final Repository State

Target UI package namespace is `@targoman/*`; runtime brand is BrandProfile; IRANSansX/FontAwesome assets and compatibility utilities are present. The target architecture gate reports zero violations and zero infrastructure failures. U1 historical report and unrelated sibling workspace files were not changed.

## Acceptance Criteria

| Criterion | Result | Evidence |
|---|---|---|
| 1 | PASS | Report started before changes; scope confined to U1.1 foundation |
| 2 | PASS | Six packages/imports/lockfile renamed; no old production scope or alias |
| 3 | PASS | Governing docs and AGENTS separate package identity from BrandProfile |
| 4 | PASS | Generic shell uses BrandProfile values; FAPA hard-coded runtime count 0 |
| 5 | PASS | 37 exact local font/icon files, source/target SHA-256 table and URL smoke |
| 6 | PASS | IRANSansX default; four canonical utility classes and component direction tests |
| 7 | PASS | FontAwesome functional icons; no competing package; UI19–UI22 fixtures |
| 8 | PASS | Kit 3/Node 22/Vite 8/Vitest 5/TS 6 pin, clean install, check/build/tests |
| 9 | PASS | Target gate 0/0; legacy Express build passes; no ingress/backend cutover |
| 10 | PASS | Documentation, report finalization and report verification complete |

## Open Issues

- Real BrandProfile/Identity SSR bootstrap and business feature integration remain later work.
- External distribution entitlement for the existing proprietary IRANSansX and FontAwesome Pro assets must be confirmed by the deployment owner; the repository asset tree contains no completed license grant document.
- Legacy architecture findings and backend dependency modernization remain separate tasks.

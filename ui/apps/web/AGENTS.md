# Web Runtime Agent Instructions

Inherit `/AGENTS.md`.

Presentation/composition root; never business authority.

## Required

- Use SvelteKit + strict TypeScript.
- Use Node 22.17+, SvelteKit 3, Vite 8 and TypeScript 6 for the target Web runtime; do not adopt TypeScript 7 until Svelte tooling supports it.
- Use `@targoman/*` for first-party packages. Render visual identity from the active BrandProfile, never a customer name or package metadata.
- Use the shared IRANSansX Persian font, FontAwesome functional icons, and canonical `fa-num`/`ltr`/`rtl`/`hidden` utilities.
- Compose Public/User/Admin shells and module UI contributions.
- Use canonical/generated API contracts where practical.
- Support RTL/LTR and shared Calendar UI.
- Treat frontend authorization/capability views as UX only.

## Forbidden

- SQL/Kysely/database access.
- Business lifecycle rules in route/components.
- Direct Role/privs/ALL/ACL/ownership/classification interpretation.
- Direct model/Qdrant/provider calls.
- Server secrets in browser-visible bundles.
- Independent Jalali conversion/date-picker logic.
- Module-local duplicates of the four shared compatibility utilities or a competing functional icon system.

## Tests

- Accessibility/keyboard/focus.
- RTL/LTR.
- Module enabled/disabled composition.
- Route-base/domain independence.
- No secret leakage.

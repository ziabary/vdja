# Web Runtime Agent Instructions

Inherit `/AGENTS.md`.

Presentation/composition root; never business authority.

## Required

- Use SvelteKit + strict TypeScript.
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

## Tests

- Accessibility/keyboard/focus.
- RTL/LTR.
- Module enabled/disabled composition.
- Route-base/domain independence.
- No secret leakage.

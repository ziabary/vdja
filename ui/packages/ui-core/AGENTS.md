# UI Core Agent Instructions

Inherit `/AGENTS.md`.

Reusable presentation mechanics only.

## Required

- Accessible semantic components, keyboard/focus, RTL/LTR, design tokens, brandability, clear loading/error/disabled states.
- Use `@targoman/*` for internal packages and BrandProfile values for visual identity. The Web shared stylesheet owns IRANSansX and `fa-num`/`ltr`/`rtl`/`hidden`; shared controls use these classes without redefining them. Functional icons use FontAwesome.

## Forbidden

- Business decisions.
- Authorization authority.
- Persistence/provider access.
- Customer/module hidden coupling.
- Competing functional icon libraries and module-local compatibility utility definitions.

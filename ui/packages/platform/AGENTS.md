# Platform Registry / Composition Agent Instructions

Inherit `/AGENTS.md`.

Owns generic platform composition and registry behavior.

## Required

- Register/validate manifests, compatibility, dependencies, contributions.
- Distinguish Packaged, Installed, Tenant Enabled, Authorized.
- Keep customer variation configuration-driven.

## Forbidden

- Importing private business-module implementation.
- Module-specific business semantics in Platform Core.
- Treating code presence as enablement.
- UI-only module enablement.
- Implicit purge on disable/uninstall.

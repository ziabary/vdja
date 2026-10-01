# Reconciliation Agent Instructions

Inherit `/AGENTS.md`.

Resolves UNKNOWN external outcomes without owning originating business meaning.

## Required

- Persist origin/provider/correlation/fingerprint/state/attempts/operator/final resolution.
- Use provider status/evidence before retrying uncertain side effects.

## Forbidden

- Timeout-to-failure guessing.
- Blind duplicate side-effect retry.
- Replacing originating domain truth.

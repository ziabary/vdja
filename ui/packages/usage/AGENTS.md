# Usage Accounting Agent Instructions

Inherit `/AGENTS.md`.

Records consumption facts; not authorization, admission, or money.

## Required

- Stable/versioned meter semantics.
- Idempotent usage ingestion.
- Explicit dimensions as applicable.
- Record actual consumption even for failed attempts when it occurred.

## Forbidden

- Financial calculation.
- Treating Usage as entitlement.
- Treating Usage as admission decision.
- Silent meter semantic drift.

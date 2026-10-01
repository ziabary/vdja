# AI Router Agent Instructions

Inherit `/AGENTS.md`.

Owns execution/routing policy, not business Task meaning.

## Required

- Execute semantic Task IDs.
- Maintain Task/Model/Endpoint registries.
- Distinguish Model/Endpoint/Provider/Serving Engine/Hardware.
- Hard constraints before preferences.
- Data Governance before external generation/embedding/reranking/shadow.
- Admission before expensive inference.
- Bound context/output/timeouts/retries/fallback.
- Validate structured output.
- Record AI Run attempt/fallback lineage.
- Keep health/circuit/capacity observable.
- Use approved baseline first; high tier requires Task-specific evaluation evidence.

## Forbidden

- Business semantics in Router.
- Unsafe external fallback.
- Silent context truncation.
- Direct authoritative mutation from model output.
- Ordinary chain-of-thought retention.
- Treating tool request as authorization.

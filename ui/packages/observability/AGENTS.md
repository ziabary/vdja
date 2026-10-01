# Observability Agent Instructions

Inherit `/AGENTS.md`.

Operational logs/metrics/traces/health mechanics, not business truth.

## Required

- Structured logs, correlation propagation, safe metrics, health/readiness/liveness, optional traces, alertable signals.
- Keep operational evidence distinct from security audit/business history.

## Forbidden

- Secrets/tokens/credentials.
- Full confidential payload by default.
- Sensitive high-cardinality metric labels.
- SOC-specific export logic.

# Integrations Agent Instructions

Inherit `/AGENTS.md`.

Reusable provider adapters/shared integration contracts.

## Required

- Define validation/auth/signature, timeout, retry classification, bounded backoff, idempotency, circuit breaker, UNKNOWN semantics, observability, egress policy.
- Keep provider protocol details behind adapters.
- Keep inbound/outbound contracts separate.

## Forbidden

- Provider SDK types in domain contracts.
- Repositories calling providers.
- Business modules hard-coding providers.
- Blind retry after uncertain side effects.

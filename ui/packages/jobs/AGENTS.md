# Jobs Agent Instructions

Inherit `/AGENTS.md`.

Owns durable background-work infrastructure, not module Job semantics.

## Required

- Stable Job identity and versioned payload where needed.
- Durable scheduling, safe multi-Worker claim/lease/locking, bounded retry/backoff, idempotency, terminal states, backlog observability.
- Use DB events only for work entirely inside PostgreSQL.

## Forbidden

- In-memory-only critical work.
- Generic Job infrastructure absorbing module business policy.
- REST/gRPC replacing durable async semantics.

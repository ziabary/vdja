# Worker Runtime Agent Instructions

Inherit `/AGENTS.md`.

Executes durable asynchronous application work.

## Required

- Start from durable Job/outbox state.
- Reconstruct explicit tenant/actor/initiator context.
- Invoke application services, not persistence directly.
- Use stable identity, safe claim/lease, bounded retry/backoff, terminal states, idempotency, observability.
- Preserve UNKNOWN outcomes for Reconciliation.
- Stop new claims and safely drain/release work on shutdown.

## Forbidden

- Direct SQL/Kysely outside persistence.
- In-memory-only critical queues.
- Infinite retry.
- Assuming scheduled-time authority remains valid when execution-time authorization is required.
- Bypassing adapters/AI Router.

## Tests

- Duplicate claim.
- Crash/restart/reclaim.
- Retry/idempotency.
- UNKNOWN external result.
- Module disablement and relevant user termination.

# API Runtime Agent Instructions

Inherit `/AGENTS.md`.

Synchronous composition root and thin transport boundary.

## Required

- Parse/validate input, build execution context, authenticate, invoke Authority, call application use case, map stable errors.
- Propagate correlation ID.
- Remain horizontally replicable with bounded timeouts and graceful shutdown.

## Forbidden

- SQL/Kysely/drivers in controllers.
- Direct repository orchestration from routes.
- Business/financial decisions in transport.
- Provider/vLLM/Qdrant calls from controllers.
- Local authorization interpretation.
- Ambient tenant context.
- Raw internal/provider/database errors to clients.

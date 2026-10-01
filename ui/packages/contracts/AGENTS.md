# Contracts Package Agent Instructions

Inherit `/AGENTS.md`.

Portable canonical contracts only.

## Required

- Named types/enums/branded IDs/schemas/commands/results/errors/events/version metadata.
- Keep transport/provider/persistence implementation details out.

## Forbidden

- PostgreSQL/Kysely.
- Express/Svelte runtime logic.
- Provider SDK execution.
- Filesystem/network effects.
- Secrets.
- Application orchestration.

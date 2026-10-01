# Admission Control Agent Instructions

Inherit `/AGENTS.md`.

Decides whether bounded new work may begin.

## Required

- Evaluate before expensive work where applicable.
- Use shared/durable state for cross-replica correctness.
- Use atomic reservations/concurrency updates.
- Return stable quota/rate/capacity/concurrency outcomes.
- Provide backpressure.

## Forbidden

- Process-local authoritative distributed quotas.
- Reimplementing Authorization.
- Reimplementing charging.

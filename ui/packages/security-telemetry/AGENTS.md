# Security Telemetry Export Agent Instructions

Inherit `/AGENTS.md`.

Exports canonical evidence; never becomes a second source of truth.

## Required

- Own export policy refs, destination refs, redaction/transformation, cursors/checkpoints, push delivery/attempt/dead-letter state.
- Pull is read-only, Authority-controlled, tenant-filtered, cursor-based.
- Push is durable, stable-ID, bounded-retry, duplicate-tolerant, observable.
- Keep canonical evidence intact on destination outage.

## Forbidden

- Direct SOC database access.
- Write path from SOC into platform state.
- Secrets/unnecessary sensitive payloads.
- Customer-specific formats outside adapters.

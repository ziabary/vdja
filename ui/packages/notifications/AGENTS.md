# Notification Core Agent Instructions

Inherit `/AGENTS.md`.

Owns how a semantic notification is delivered, not why it exists.

## Required

- Typed semantic Notification Types/data.
- Recipient/channel policy, localization/RTL, branding, preferences/mandatory policy, quiet hours, durable Notification/Delivery/Attempt, bounded retry/circuit, dedup/idempotency, UNKNOWN reconciliation, validated callbacks.
- Keep Notification separate from Delivery.
- Minimize sensitive channel payload.

## Forbidden

- Direct module provider delivery.
- Preference disabling mandatory security notices.
- Secrets in template/logs.
- Arbitrary unvalidated webhook destinations.

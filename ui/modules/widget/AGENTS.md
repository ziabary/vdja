# Widget / Chat Builder Module Agent Instructions

Inherit `/AGENTS.md`.

Owns Widget instances, chat-builder semantics, conversation behavior, configuration, and UI.

## Required

- Support multiple tenant-scoped instances.
- Register resource/permission/Role-template vocabulary with Authority.
- Use facts resolver for instance/org ownership.
- Use Documents/Knowledge for knowledge, AI Router for AI, Ticketing for optional escalation, Notifications for delivery.
- Keep beneficiary administration scoped to the specific instance.

## Forbidden

- Local role/ownership checks.
- Direct Qdrant/vLLM access.
- Beneficiary arbitrary instance creation merely from manage-one-instance authority.
- Private generic ticket/notification systems.

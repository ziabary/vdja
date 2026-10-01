# Smart Secretariat Module Agent Instructions

Inherit `/AGENTS.md`.

Owns Secretariat business state, source mappings, letter semantics, sync, UI.

## Required

- Inbound connectors are read-only.
- Outbound registration/dispatch uses separate explicit contract.
- Use Document Core for body/attachments and File Processing.
- Use Knowledge/RAG and AI Router; never Qdrant/model directly.
- Authority decides document operations.
- Use stable source ID/revision/checksum for idempotent sync and new Versions on change.
- Source disappearance never implies hard delete.

## Forbidden

- Local access checks.
- Direct model calls.
- Writeback from read-only ingestion path.
- Cross-module private table access.

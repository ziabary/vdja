# Letter Assistant Module Agent Instructions

Inherit `/AGENTS.md`.

Owns template/example/draft/edit/version/approval semantics for AI-assisted letters.

## Required

- Separate Letter lifecycle from Document versions/assets.
- Use Document Core for retained bodies/renderings/attachments as appropriate.
- Use AI Router semantic Tasks.
- Validate AI output before authoritative draft state.
- Preserve human edits/versions/approvals/provenance.
- Use Authority and explicit outbound Secretariat adapters.
- Use Notifications for generic delivery.

## Forbidden

- Direct model selection.
- Treating generated text as approved/signed/sent.
- Local authorization.
- Direct Secretariat table mutation.

# Document Core Agent Instructions

Inherit `/AGENTS.md`.

Owns generic Document/Version/Asset/provenance behavior; business modules retain domain meaning.

## Required

- Keep Business Resource, Document, Version, Asset distinct.
- Content changes create Versions; finalized Versions immutable.
- Explicit current-version activation.
- Preserve provenance.
- Use Storage abstraction.
- Provide resource facts to Authority, never access decisions.
- Preserve discover/read/download/use/quote/manage distinction.
- Soft-delete by default; Governance controls purge.

## Forbidden

- Local authorization evaluation.
- Physical storage path construction in callers.
- Treating relation as access grant.

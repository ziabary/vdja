# Storage Agent Instructions

Inherit `/AGENTS.md`.

Provider-neutral persistent asset access.

## Required

- Support approved persistent volume/S3-compatible backends.
- Use stable storage refs; callers never construct physical paths.
- Private by default.
- Short-lived controlled signed URLs only after applicable Authority decision.
- Preserve integrity metadata.
- Externalize credentials.
- Obey Governance retention/lifecycle.

## Forbidden

- Public bucket as authorization.
- Provider-specific key layout leaking into modules.
- Lifecycle rules overriding legal hold/retention.

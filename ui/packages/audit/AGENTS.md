# Audit Agent Instructions

Inherit `/AGENTS.md`.

Owns shared audit mechanics/security evidence where defined.

## Required

- Keep database mutation audit, semantic business history, security audit, and operational logs distinct.
- Append-oriented protected evidence.
- Record tenant/actor/session/initiator/request/resource/action/result/reason/time as applicable.
- Redact sensitive fields.

## Forbidden

- Generic payload dumping.
- Secrets/tokens/OTP/private keys/provider credentials.
- Runtime rewrite/delete of protected audit.
- Business/authorization policy in triggers.

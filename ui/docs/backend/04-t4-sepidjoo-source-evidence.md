# T4 Sepidjoo source evidence and reuse matrix

Inspected on 2026-10-02 before T4 implementation. The governing Targoman architecture takes precedence over this reference.

| Concern | Actual Sepidjoo source | Evidence | T4 decision |
| --- | --- | --- | --- |
| Access token | `/home/user/Projects/Sepidjoo/Repo/api/src/services/auth/authService.ts` | `createAccessTokenWithClaims` signs a JWT containing profile fields and `privs`, with a shared secret. | Do not copy claim shape or token validation. Use minimal tenant/session/version claims and explicit issuer, audience, expiry and algorithm checks. |
| Refresh token | Same file, `createRefreshToken` and `verifyRefreshToken` | Refresh JWT carries `key`, `sid`, `jti`; verification allowlists HS256. | Reuse only the need for a session ID and token identifier. T4 requires opaque, hashed, rotating refresh credentials bound to PostgreSQL session state. |
| Bearer parsing | `api/src/Authority/Identity/bearer.ts` | `resolveStrictBearerToken` distinguishes absent, malformed, empty and short tokens. | Reuse strict parsing as a design pattern; do not import legacy code or accept claims without session validation. |
| Token hash | `api/src/Authority/Identity/tokenHash.ts` | SHA-256 over opaque token bytes. | A standard cryptographic hash is suitable for high-entropy random refresh tokens; use constant-time comparison where equality is checked outside SQL. |
| Refresh/session route | `api/src/routes/auth.ts`, `/auth/refresh`, `sendJWT` | Refresh accepts body or cookie token; creates and stores a new refresh credential; broad cookie route is used. | Do not reuse route contract or cookie path. T4 refresh cookie must be HttpOnly, Secure and narrow Path; concurrent rotation and replay need an atomic persisted lifecycle. |
| Authorization | `api/src/Authority/Access/privilegeEvaluation.ts` | Calls shared `isAdmin`/`hasPriv` over an auth payload. | Do not copy. Target Authority is the sole decision owner and must evaluate tenant, deny, scope, ACL, classification, time and invalidation from authoritative facts. |

No Sepidjoo source is modified by T4.

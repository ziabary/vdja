# T5-R1 implementation state

## Durable Worker and Job identity

A normal Worker authenticates as a registered deployment Platform Service. Job persistence claims pending work by deployment across tenant IDs, while each Job retains its tenant, original actor, Session, authorization version, request/correlation IDs, and configuration fingerprint. The Worker executes protected content work using that Job subject. File expiry uses an explicitly registered machine permission in the Job tenant; it does not inherit Human content permissions.

The unique scheduling key is deployment + tenant + Job kind + idempotency key. On reuse, the persisted payload, payload version, max attempts, and security-relevant Job subject must match exactly. The subject comparison includes actor kind/ID, tenant, deployment, authorization version, module, initiator and configuration fingerprint. Kind and payload carry operation/resource identity. Request ID, correlation ID and source are tracing metadata and are excluded. A different security identity returns `JOB_IDEMPOTENCY_CONFLICT`; an earlier Job is never silently reused for it. The availability time is a scheduling hint, not authority identity.

The PostgreSQL test `t5-worker-multitenant.integration.test.ts` uses one deployment and one Worker for interleaved Jobs from two tenants. It asserts claimability, retained Human subject, cross-tenant denial, and isolated revocation. `t5-job-idempotency-security.integration.test.ts` checks security identity conflict and trace-only reuse.

## Protected read linearization

Document materialization takes a short PostgreSQL transaction with shared global/tenant Authority locks and a Document snapshot lock. Security mutation triggers take conflicting locks. A mutation committed before materialization is observed and denied; a concurrent writer waits for the authorized immutable snapshot transaction to finish. No PostgreSQL transaction spans an external provider call.

Knowledge query revalidates canonical Document/Space facts after vector hits, before normalized materialization, before reranking, before generation and before publication. AI Router invokes the supplied security fence immediately before provider dispatch; a fence denial stops fallback and records `SECURITY_FENCE_DENIED`. The deterministic tests cover revocation after coarse authorization, after a vector hit, after final candidate decision, after materialization, after reranking, and after generation. File Management separately checks revocation before the first download byte.

These checks do not prove every possible concurrent commit between the last security check and network transmission. ASVS V15.4.2 remains `NOT_VERIFIED` pending a stronger dispatch linearization model and complete interleaving evidence.

## File processing and temporary storage

Cache fill is serialized by immutable cache key; unrelated keys proceed concurrently. Staging uses independent item keys and a shared bounded reservation. A cache hit verifies the complete file hash before yielding even a small Range. This is intentional because the replica-private filesystem is mutable and a later corruption must not be returned from a previously verified fill. The cost is O(file size) hashing on each hit, including Range hits; performance measurement and a proven immutable-cache alternative remain open.

File Processing owns the malware scanner port and a clamd-compatible Unix socket adapter. Required scanning fails closed for suspect, infected, unavailable, or error outcomes. The Linux parser adapter runs native extraction with a separate unprivileged process, private scratch, bounded time/output and namespace isolation. Customer scanner availability/signature freshness and host sandbox primitives require deployment evidence.

Data Governance owns retired, eligible, held, requested, purging, and purged states. Legal hold blocks physical purge. A durable purge Job removes applicable canonical bytes, normalized/chunk metadata, vector projections, cache and staging state through their owners while preserving Audit. Customer backup deletion/expiry remains a deployment obligation; software tests cannot prove it.

## Evidence limits

`reports/security/t5-acceptance-evidence.json` records only criteria with a specific executed case bound to the current source hash. Its `NOT_VERIFIED` entries are deliberate. Protocol provider fixtures do not establish actual approved model behavior. `reports/security/t5-r1-open-findings.json` retains every current T5-scope blocker with a closure class; the original `t5-security-delta-backlog.json` remains the T5 start-gate input.

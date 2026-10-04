# Storage and transfer operations

## Adapters and canonical identity

Storage is selected by CJSON: private LOCAL or S3_COMPATIBLE. The standard AWS SDK is isolated in the Storage adapter. Credentials use external secretRef; the runtime does not log credential values. Keys are generated opaque scope hashes/UUIDs, never user paths. Original bytes are immutable at an Asset identity. Native backend object version is distinct from Document Version.

Local objects use private directories/files, no-follow opening, durable writes and verified hashes. S3 uses private bucket/policy readiness checks, native multipart, bounded timeouts, disabled SDK blind retries and conditional completion. Anonymous/public access is forbidden. Strict TLS is required outside permitted development loopback. A customer's S3 implementation must support and pass the tested checksum/conditional/private-access semantics.

## Ambiguous transfer outcomes

Persist intent before begin/part/complete. Lost ACK is UNKNOWN/UNRESOLVED, not proof of failure. Reconciliation discovers upload identity and inspects actual object bytes. A checksum-less ListParts observation never becomes a persisted checksum proof. Asset publication requires full hash/size/type verification. Abort and expiry do not erase evidence of possible completed objects; such objects require authorized reconciliation.

## Backend migration without identity change

`clsStorageMigration`, with the owning PostgreSQL journal, copies approved Asset bytes to the **same opaque key** at a destination binding. Document/Version/Asset IDs and logical storage profile remain unchanged. Approval must bind exact destination and immutable Asset facts through canonical Authority/Governance. The service is an operator/application capability and is not exposed as an unauthenticated HTTP endpoint.

States NEW/COPYING/COMPLETING/UNKNOWN/VERIFIED and distributed leases persist before native operations. An uncertain initiation/completion is reconciled; no blind completion replay is performed. Full source and destination byte hashes are checked. A crash on completion without visible proof remains UNKNOWN. Retrying VERIFIED rechecks destination bytes. Source objects are retained for rollback; this tool does not purge them or rewrite CJSON automatically.

For cutover, freeze canonical writes or run an approved delta capture, enumerate every retained Asset through its owner, obtain VERIFIED proof for the exact destination configuration fingerprint, and compare source/destination inventory and checksum totals. Only then atomically rebind the logical profile in approved deployment CJSON, restart/roll both API and Worker consistently and verify protected download/processing/rebuild. Retain old backend and proofs for the Governance rollback/retention period. A partial migration cannot authorize rebinding. Production destination approval and complete customer inventory remain required.

## Tested scope

The native S3 integration fixture is pinned S3Proxy 4.1.1 with private generated credentials. It proves standard SDK multipart behavior, restart, anonymous denial and real lost-ACK reconciliation. It does not establish Amazon S3/MinIO/customer-provider parity. `t5-storage-migration.integration.test.ts` proves actual Local → S3 → Local hash equality and stable canonical IDs on PostgreSQL.

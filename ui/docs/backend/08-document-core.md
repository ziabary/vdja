# Document Core implementation

## Ownership and contracts

`packages/documents` owns Document, immutable Document Version, immutable Asset descriptors, normalized processing provenance and active-version publication. A business-resource reference is optional and distinct. Storage object/backend version is not a Document Version. Public contracts live in `src/index.ts`; the application service is `clsDocumentService`. PostgreSQL access stays in the owning persistence adapter.

Documents are tenant/deployment scoped, classified, owned resources with security versions and ACTIVE/RETIRED lifecycle. Versions have stable IDs and monotonically increasing sequences, PENDING/PROCESSING/READY/FAILED processing state, processor identity and normalized SHA-256. Assets separately identify original bytes, opaque Storage key/profile, size/hash/type/display name and approval lifecycle. Asset descriptors and normalized provenance cannot be overwritten by runtime roles.

## Lifecycle and transactions

File Management verifies actual bytes/type before committing Asset + Version + processing Job + Usage + semantic Audit in one application transaction. Retries bind a stable source identity and compare the complete immutable descriptor. The Worker marks PROCESSING through its claim fence, parses via File Management/shared File Processing, and publishes normalized text and READY state through the same durable lease fence. A late older Version cannot supersede a newer active sequence.

Terminal failures and last-attempt crash recovery persist FAILED metadata with the Job transaction, without reading protected content. READY processing cannot be regressed by terminal failure metadata. Publication uses Document snapshot locks to prevent concurrent security/version mutation while a Knowledge projection becomes active. A stale subject, version, classification, membership or lease fails closed.

## Authorization and APIs

Authority independently decides discover/read/download/use/quote/manage. Discover controls list/version/operation projection; it grants no byte access. Read returns approved normalized text; Download streams the original Asset through File Management. Use materializes approved normalized chunks for protected AI. Quote controls verbatim disclosure independently. Manage controls creation/version intake/retirement. Lists use bounded cursor windows and no default total count.

The thin `/api/knowledge/documents` API exposes creation/list, versions, operation hints, normalized content, original download and soft retirement. No browser PostgreSQL/Qdrant/Storage access exists. Names and content are not copied into ordinary Audit/SIEM payloads.

## Verification and recovery

Migrations 009–019 are additive and immutable once applied. Relevant evidence: `t5-document-jobs.integration.test.ts`, `t5-file-management.integration.test.ts`, `t5-runtime.integration.test.ts`, `t5-worker.integration.test.ts`. Tests cover concurrency/idempotency, rollback, revocation, tenant boundaries, immutable normalized data, publication order, lease replacement and terminal recovery. Backups must include PostgreSQL plus canonical private Storage; reconstruct Qdrant after restore. Production restore/retention/legal-hold/purge evidence is still a deployment obligation.

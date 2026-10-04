# T5 RAG customer deployment and release

## Independent gates

T5 start, T5 completion security and customer ASVS Level 3 release are independent. The start gate is PASS. Local acceptance fixtures are not customer approval. Customer release remains unauthorized until all applicable release controls close. `scripts/customer-release.mjs` retains its fail-closed ASVS check; no bypass is added for T5 images.

## Required configuration and secrets

Enable Auth before File Management/Knowledge. Configure a tenant-bound registered Worker Identity and explicit expiry grant where automatic cleanup is needed. Provide private LOCAL canonical volume shared by all relevant replicas or a private S3-compatible backend with external access/secret refs. Staging/cache remain replica-private scratch with bounded size/TTL and secure modes. Do not mount canonical Storage as Web static content.

Knowledge config binds chunking/index profile, authenticated Qdrant endpoint and bounds, question/candidate/context/output limits and distributed Admission. Protected AI config registers exact embedding/reranking/generation model IDs/artifact revisions/kinds/dimensions/limits and task-compatible endpoints. Document/query embedding policies must be compatible. Data Governance explicitly approves exact endpoint/origin/task/classification/residency/no-retention/no-training constraints. Private placement alone is not approval.

Auth signing keys, PostgreSQL role credentials, Qdrant API key, provider credentials and SIEM credentials stay in external secret refs. Every customer/brand shares the same source; CJSON/module bindings/brand assets provide variation. Example customer configs keep RAG disabled until real identities, endpoints and destination policy are supplied.

## Readiness and runtime isolation

API checks PostgreSQL, existing task providers, private Storage/staging/cache, Qdrant and protected model discovery; an unavailable optional RAG capability produces DEGRADED without disabling independent public tools. A required base task/database failure produces NOT_READY/503. Protected `/v1/models` discovery verifies configured model IDs; it cannot establish artifact provenance, tokenizer compatibility or semantic model quality.

Worker claims are durable and scoped, heartbeat their lease and abort on replacement/shutdown. Publication remains fenced. Last-attempt abandoned claims settle terminal metadata atomically. Machine expiry can clean expired uncommitted staging under explicit Authority grant after Human Session revocation; it cannot read/publish content. API shutdown closes idle requests, bounds active connection drain and closes shared resources; Worker aborts running job execution and closes resources after its loop. Last-resort exceptions/rejections log only a safe class, drain and exit for supervisor replacement. Availability and restart policy still require deployment verification.

## OCI and supply chain

`deploy/customer.Dockerfile` bundles target API/Worker/migration and Web; runtime dependencies exclude MySQL/Knex and legacy auth/RAG. LibreOffice, CA certificates, tini and util-linux are explicit. Run with a nonroot user, readonly root filesystem, private scratch and controlled egress. Persist PostgreSQL/canonical Storage independently of containers. Qdrant is disposable but backup/restore must preserve complete canonical state and approved model policy.

T5 acceptance images are local test artifacts, not signed customer releases. Verify final digest/SBOM/vulnerability/provenance/signing policy, private volumes, TLS/role scopes, configuration drift, restore and retained-object lifecycle. Never authorize release merely because builds or focused tests pass.

The runtime pins Node 22.23.3 by immutable digest, applies available stable Debian updates and removes unused global npm/Corepack tooling after dependency installation. Multer and compatible Express dependencies are patched. `scripts/t5-supply-chain.mjs` scans the local image and explicit root/shipped-runtime locks with a pinned scanner, offline dependency resolution and telemetry disabled; only the public vulnerability database is fetched. `reports/security/t5-supply-chain.json` binds findings to the tested image ID and source hash. Open findings are not waived, and a scanner exit of zero only proves that a scan completed. SBOMs and nine actual role/brand checks live under `tests/reports/oci/`.

Run actual model acceptance with `npm run test:t5:live-models -- --approved-model-config /path/to/approved.cjson` after supplying exact registered models, artifact revisions, endpoints, external secret refs and Data Governance policy. This uses synthetic LOW content in an isolated test tenant through API/Worker/Storage/Qdrant and the built browser. Metadata evidence is written only after both runtime and browser acceptance pass; missing configuration fails closed. This does not approve customer deployment or attest remote model artifacts.

## Verification commands

```bash
npm run check:target
npm run check:web
npm run test:architecture:target
node --import tsx scripts/t5-target-architecture.ts
# Live acceptance requires the explicitly configured local PostgreSQL/secrets and fixtures.
# NODE_TLS_REJECT_UNAUTHORIZED must not be 0.
```

Consult the Activity Report and machine-readable security evidence for executed commands/results. No live customer vLLM, real owner mapping or production Storage cutover has been approved by the supplied test fixtures.

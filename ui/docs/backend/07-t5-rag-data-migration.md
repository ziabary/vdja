# T5 canonical data migration

## Inputs and planning

Export metadata read-only from the legacy owning persistence layer. Keep the export and original assets private. Supply two JSON arrays, with no privileges, passwords, tokens, Qdrant chunks or vectors:

```json
[{"service":"rag","fileId":"42","legacyUserId":"7","filename":"source.txt","bytes":5,"sha256":"<64 lowercase hex characters>","mediaType":"text/plain","sourceKind":"ORIGINAL_ASSET","sourceRef":"export:42","state":"Active"}]
```

```json
[{"service":"rag","legacyUserId":"7","deploymentId":"approved-deployment","tenantId":"approved-tenant","actorId":"registered-identity","spaceId":"<UUID>","spaceTitle":"Approved knowledge","classification":"LOW"}]
```

```bash
node --import tsx scripts/t5-legacy-migration-plan.ts \
  --source-system approved-export-identity \
  --records /private/records.json --owners /private/owners.json \
  --out /private/plan.json
```

The planner accepts at most 10,000 records/mappings, rejects symlink inputs and inputs larger than 16 MiB, creates a new mode-0600 output exclusively, and prints only digest/count/status. Planning makes no database or provider mutation. Exact keys and classification are validated; output names never become physical paths.

## Approval and application

`clsLegacyRagMigration` binds approval to the full canonical manifest digest, source system and destination/owner facts. Its `contextFor` port must obtain a real verified initiating subject for the mapped actor and scope. It must not synthesize a HUMAN session or reuse an unrelated user's credentials. `openOriginal` resolves only approved opaque export references and returns bounded streams. A missing approval or mismatched context fails before byte intake.

The executor revalidates the plan, creates deterministic Documents through Document Core, resumes File Management multipart intake, verifies original size/hash, commits exactly one Version for the stable source identity, creates the approved Space and sets CURRENT membership. Ordinary processing and index Jobs are durable. Derived legacy vectors are discarded. Same source identity with changed immutable descriptors conflicts rather than overwriting bytes. Removed source records remain reported exclusions.

## Reconciliation and cutover

Compare every source identity to target Document/owner/scope/title, Version, Asset byte count/SHA-256 and Space membership. Reconcile processing READY and current-version activation, then index READY under the approved embedding profile. Report missing/extra/ambiguous/failed/excluded/reindexed identities separately. Do not compare legacy chunk counts to canonical document counts. Store the private exact manifest, approval evidence and reconciliation result; semantic Audit contains only safe IDs and status.

Run ingestion again to prove identical Version/Asset counts. Build Qdrant from an empty derived store, verify authorized queries and independent read/download/quote behavior, then stop legacy RAG writers and switch routes under an approved deployment change. Retain the original export and source backend according to Governance retention/hold policy. No automatic production cutover is implemented or authorized by the test fixtures.

## Current evidence

The actual PostgreSQL/File Management/Worker/Qdrant test in `t5-legacy-migration.test.ts` passes retry and fresh index reconstruction. The real customer export, identity map and reconciliation counts remain unverified; no production migration success is claimed.

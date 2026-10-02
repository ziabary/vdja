# T3 customer release and operations

The T3 public product is built from one canonical repository revision. A release
creates separate `customer-a`, `customer-b`, and `customer-c` Web, API and Worker
OCI image identities. The customer Web image contains its own logo and favicon.
All three images contain the selected customer's validated non-secret
`platform.cjson`; secrets are mounted separately under `/run/secrets`.

## Configuration source evidence

The Sepidjoo repository at `/home/user/Projects/Sepidjoo` was inspected before
the target Configuration capability was implemented. No Sepidjoo file was changed.

| Sepidjoo source path | Observed behavior | Target decision | Reuse type | Reason |
| --- | --- | --- | --- | --- |
| `workspace/shared/utils/configManagerFactory.ts` | Reads files, removes CJSON comments with quote awareness, parses JSON, merges defaults, and throws on load error. | Keep quote-aware comment parsing and explicit errors; validate the complete typed candidate before publishing a frozen snapshot. | ADAPT | Arbitrary deep merging and a generic cast can hide missing or unknown security settings. |
| `workspace/shared/interfaces/config.ts` | Provides shared readonly config shapes, including database and secret-bearing fields. | Expose a shared typed platform configuration and strict runtime validation. | ADAPT | Interfaces alone do not validate untrusted files; secret values must be references. |
| `workspace/api/src/utils/configManager.ts` | Defines application defaults and some environment-selected values alongside inline example credentials. | Keep only safe development profiles, with CJSON as the canonical configuration and file secret references. | REFERENCE_ONLY | Normal settings must not become environment overrides or image-baked credentials. |

The implementation lives in `packages/configuration`. It accepts JSON with
comments, rejects unknown keys, validates cross-field AI/module capability and
bounds, resolves `file:/run/secrets/<name>` separately, returns immutable
snapshots, redacts secret-reference identities in effective output, and reloads
only complete valid candidates. Deployment/database/HTTP identity is startup
only. Use `npm run config:validate -- --config <path>`,
`npm run config:print-effective -- --config <path>`, and
`npm run config:fingerprint -- --config <path>`.

## Local public-product development

The Vite development server uses the same SvelteKit `/api` gateway as the
production Web image. It does not proxy public requests to the legacy Express
service on port 3000. The development CJSON points the gateway at the target
API on port 3100. Prepare the PostgreSQL database and import the dictionary
before starting the public product:

```sh
npm run db:pg:start
npm run db:target:dev:bootstrap -- --database targoman_platform_t3
npm run db:target:migrate -- --config deploy/examples/development/platform.cjson --secrets-dir .secrets.t3.local
npm run migrate:public-tools:mysql-to-pg -- --json-only --config deploy/examples/development/platform.cjson --secrets-dir .secrets.t3.local
npm run dev
```

`npm run dev` starts the target API and Web together. The JSON-only import is
idempotent and does not connect to MySQL. With the default language controls,
`خدا` must return a JSON dictionary result for Persian to English; an SSE
translation stream for this known word means the request reached the wrong
backend or the target dictionary has not been imported.

## Build and inspect

`npm run release:customers -- --dry-run` validates the A/B/C profiles and
generates a planned release bundle under ignored `deploy/releases/<version>/`.
`npm run release:customers` builds nine OCI images without changing source
between customer builds. `--customer customer-a` builds one customer. The
script checks a canonical source hash before each customer, includes the exact
five-dependency runtime lockfile and a CycloneDX dependency SBOM, and writes a manifest with
source commit, source hash, build time, configuration schema/fingerprint,
brand-asset hashes, image tags/local IDs, PostgreSQL reference and migrations.
The separate root lockfile identifies build dependencies. The customer runtime
installs only Express, Multer, PostgreSQL, PDF.js, and the optional legacy
dictionary-import connector plus their locked transitive dependencies.
The base Node image is pinned by digest. The customer release directory also
contains its CJSON, brand files, target migrations and a Compose example.
It also contains the SHA-256-identified JSON dictionary source. The release
image carries bundled migration commands and the SQL files under
`/app/dist/target-migrations`. For a new installation with no MySQL, run
`node dist/target-migrate.js` using the migration role, then
`node dist/import-dictionary.js --json-only --json-source /data/multi-dic.json`
with the release data file mounted read-only. The `--json-only` path does not
read a legacy config or connect to MySQL. For legacy cutover, omit
`--json-only` and provide a read-only MySQL source through the separate
legacy migration configuration. Check counts and hashes before ingress switch.

Image names follow `targoman/customer-a-web:<version>`,
`targoman/customer-a-api:<version>`, and
`targoman/customer-a-worker:<version>`; B/C use their own names. A enables
Translator, B enables Translator and Summarizer, and C enables all three and
SIEM. The API is the only public data-plane backend; Web proxies `/api` on the
server side. Browser code receives only the public brand/module projection.

The Compose examples assume an operator-provisioned private network containing
PostgreSQL as `postgres` and an approved AI endpoint as `model-server`. The
example CJSON values for model and SOC URL are placeholders; replace the
complete CJSON and validate it before a real customer deployment. Set the
bootstrap paths `TARGOMAN_CUSTOMER_NETWORK` and
`TARGOMAN_RELEASE_SECRETS_DIR` when using the generated Compose file. The
external secret directory must contain `pg-api` and `pg-worker` with access
restricted to the operator. Database provisioning, roles and migrations are
performed before API/Worker startup with a separate migration credential. The
target runtime never needs MySQL credentials.

Check `/health` for process liveness, `/ready` for PostgreSQL and required AI
endpoint readiness, and `/version` for release/config fingerprint. Compare the
reported fingerprint with the release manifest to detect drift. The Web uses
`TARGOMAN_CONFIG_PATH` only as a bootstrap location for a complete CJSON
runtime override. An invalid override fails startup. If an AI endpoint is
unavailable, readiness is degraded. SIEM delivery is durable and does not block
public requests; inspect Worker logs and the export table for retry/UNKNOWN or
terminal FAILED states. A timeout has an unknown external outcome and retries
use the stable audit event ID as the idempotency key.

Before promotion, run the target typecheck, configuration/Router/UI tests,
PostgreSQL integration tests, live public-tools smoke against the target API,
image smoke checks, dependency/image vulnerability scan, and a backup restore
check appropriate to the customer's environment. Record any accepted scan
findings and final image digests in the deployment approval. Rollback switches
ingress to the prior image set; it does not undo audit or usage evidence.

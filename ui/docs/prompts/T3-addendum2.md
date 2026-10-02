# T3 DEPLOYMENT MODEL CORRECTION — Customer-Specific Images

This section supersedes any earlier T3 requirement stating that all
customers should normally run exactly the same Web/API/Worker image.

The required delivery model is customer-specific release images.

Each customer deployment MUST have its own explicitly identified image set,
even when one or more images are byte-identical to the canonical Targoman
build and differ only by repository/tag.

Example:

customer-a-web:<platform-version>
customer-a-api:<platform-version>
customer-a-worker:<platform-version>

customer-b-web:<platform-version>
customer-b-api:<platform-version>
customer-b-worker:<platform-version>

Customer-specific images MUST be reproducibly derived from the same canonical
Targoman source/version.

Customer-specific source forks are NOT the normal delivery model.

---

## Web Images

The Web image is expected to be genuinely customer-specific.

It MAY and normally SHOULD package:

- customer logo;
- dark/light logo variants;
- favicon;
- other approved brand assets;
- customer public branding defaults;
- the customer deployment CJSON or a safe Web projection derived from it.

Branding must still be consumed through BrandProfile/configuration contracts.

Components must not hard-code customer names or FAPA/Targoman identity.

---

## API and Worker Images

API and Worker images must also receive customer-specific image identities.

They MAY be:

1. customer-specific derived images containing that customer's non-secret
   platform.cjson; or

2. byte-identical canonical images retagged under the customer release
   namespace when no image-content difference is required.

Both are valid.

The deployment artifact and SBOM/provenance must identify the customer release.

---

## Customer CJSON

The preferred customer release contains a validated CJSON configuration file
inside the customer image, for example:

/etc/targoman/platform.cjson

CJSON remains the canonical application configuration format.

The customer release pipeline may bake:

- deployment identity;
- tenant identity;
- enabled modules;
- branding;
- route bindings;
- AI Router endpoint definitions;
- AI routing policies;
- anonymous Admission policies;
- Usage configuration;
- Audit configuration;
- Observability configuration;
- SIEM policy/configuration;
- file-processing limits;
- security bounds;
- retention references;

into the customer image.

Normal application settings must not be converted into large ENV-variable sets.

---

## Optional Runtime Override

A deployment MAY optionally mount a replacement CJSON file for operational
reasons.

If runtime override is supported:

- the complete candidate configuration is validated;
- invalid configuration fails closed;
- configuration fingerprint/drift is observable;
- partial ENV overrides are not allowed;
- secrets remain separate.

The canonical customer release configuration must still be retained as a
versioned artifact.

---

## Secrets

Secrets MUST NOT be baked into customer images.

CJSON contains secret references only.

Supported T3 baseline:

file:/run/secrets/<name>

Future secret providers may be added behind the Configuration capability.

---

## Customer Release Bundle

A customer release should conceptually be:

Customer Release
├── customer-web image
├── customer-api image
├── customer-worker image
├── PostgreSQL image/reference
├── platform.cjson
├── brand assets
├── migration artifacts
├── SBOM/provenance
└── deployment/compose files

Secrets remain external.

---

## Image Provenance

Every customer image must retain traceability to:

- canonical Targoman source commit;
- platform version;
- customer release identifier;
- configuration schema version;
- configuration fingerprint;
- build timestamp;
- dependency lockfile;
- SBOM where supported.

A customer-specific tag without a source fork is valid.

---

## Image Naming

Do not use FAPA as the generic internal platform/package namespace.

Image naming may include the customer/deployment identifier.

Examples:

registry.example/targoman/customer-a-web:3.0.0
registry.example/targoman/customer-a-api:3.0.0
registry.example/targoman/customer-a-worker:3.0.0

or another deployment-approved naming convention.

---

## T3 Acceptance Criteria Correction

Replace any acceptance criterion requiring:

"same application images for different customers"

with:

"the same canonical source/version can reproducibly produce separate
customer-specific release images without customer-specific source forks."

T3 must demonstrate at least:

Customer A:
- its own Web/API/Worker image identities;
- Translator only;
- Brand A.

Customer B:
- its own Web/API/Worker image identities;
- Translator + Summarizer;
- Brand B.

Customer C:
- its own Web/API/Worker image identities;
- Translator + Summarizer + FAQ;
- Brand C;
- SIEM enabled.

At least the Web images must contain different customer branding assets.

API/Worker images may have different digests or may be identical content with
customer-specific tags, depending on their packaged configuration.

No source-code edits are permitted between those customer release builds.

---

## Final Principle

Customer isolation exists at the release/deployment level as well as at runtime.

Canonical source is shared.

Customer releases are separate.

Customer images are explicit artifacts.

Branding/configuration may be packaged into those images.

Secrets remain external.
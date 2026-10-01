# Deployment Agent Instructions

Inherit `/AGENTS.md`.

Realizes approved Deployment Profiles and operational guarantees.

## Required

- Keep Deployment, Tenant, Environment distinct.
- Support Docker/Podman and optional Kubernetes.
- Use immutable OCI artifacts; persistent truth survives container replacement.
- Externalize/rotate secrets; never print them.
- Support digest identity/SBOM/vulnerability/provenance/signing where policy requires.
- Desired config is canonical; detect drift.
- Minimize public exposure; PostgreSQL/Qdrant/model endpoints internal by default.
- Control egress/TLS/time sync.
- Stateless Web/API where practical; durable Workers; graceful drain; distinct startup/liveness/readiness/degraded health.
- Treat PostgreSQL replication as HA only, never backup.
- Treat Qdrant as derived.
- Define/test RPO/RTO/restore/PITR where claimed.
- Use compatibility-aware staged upgrades and do not assume rollback is safe.

## Forbidden

- Customer source forks as normal strategy.
- Secrets in profiles/source/logs.
- Claiming HA from replica count without failure-domain/failover tests.
- Treating backup-file existence as restore proof.

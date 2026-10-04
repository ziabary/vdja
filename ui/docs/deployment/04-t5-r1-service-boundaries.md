# T5-R1 service-boundary evidence

This is the current implementation inventory for ASVS V12.3.5 and V13.2.1. It records the identity and transport contract at each T5 network boundary. Customer runtime settings must be checked separately.

| Boundary | Transport and current identity | Credential, replay and lifetime | TLS and trust anchor | Remaining evidence |
| --- | --- | --- | --- | --- |
| API → PostgreSQL | PostgreSQL client; distinct `targoman_api` role | External `pg-api` secret reference; static until operator rotation; PostgreSQL authentication is challenge based | Optional configured CA/server name, strict verification when configured | Customer must prove TLS is enabled, CA, role grants and rotation |
| Worker → PostgreSQL | PostgreSQL client; distinct `targoman_worker` role | External `pg-worker` secret reference; static until operator rotation | Same PostgreSQL TLS contract | Customer must prove TLS, CA, role grants and rotation |
| API/Worker → Qdrant | Qdrant HTTPS/HTTP adapter; scoped API key | External secret reference; static until operator rotation; bearer key can be replayed if intercepted | Endpoint and TLS trust are deployment configured | Customer must prove private routing, TLS/CA, key scope, expiry and rotation |
| API/Worker → S3-compatible Storage | AWS SDK signed requests, private bucket | External access/secret refs; SigV4 request signing, static key lifetime until rotation | Configured endpoint uses transport TLS; certificate trust is host/deployment policy | Customer must prove IAM scope, TLS/CA and rotation |
| AI Router → approved providers | Exact configured OpenAI-compatible endpoints | Optional external bearer secret; static until rotation; no arbitrary URL or redirect | HTTPS certificate validation is mandatory for protected external egress | Customer must prove provider identity, credential scope/lifetime and current model provenance |
| Security Telemetry → SIEM | TLS JSON push when enabled | Configured destination credential/CA; durable idempotency key and retry state | Dedicated CA may be supplied; TLS fixture delivery passed | Customer must prove actual SOC receiver ACL, CA, credential rotation and retention |

The Worker’s Platform Service identity authenticates queue infrastructure and machine-only operations. It does not substitute for a Human’s Document authority. Queue claim by deployment and content use in the Job tenant are separately enforced.

V12.3.5 and V13.2.1 remain `FAIL` in the current assessment: static shared-service credentials and optional internal TLS configuration do not yet establish short-lived, replay-resistant authentication for every actual service boundary. A service mesh is not assumed. The smallest deployment-compatible credential/transport design requires customer topology and identity-provider facts before it can be selected safely.

# T4.4-C Authority decision boundary and call-site inventory

Scope: current target production source under `apps`, `modules`, and `packages`.
This inventory concerns Authority authorization decisions, not unrelated
business validation or the future T5 Document/RAG consumers.

| Call site | Classification | Evidence |
| --- | --- | --- |
| `apps/api/src/index.ts` authenticated public-tool context | `CANONICAL_AUTHORITY_SERVICE` | Calls `runtime.authority.authorizePublicTool`; the composed `clsAuthorityService` records `authority.decision` before returning. |
| `packages/authority/src/service.ts` generic object, field, and public-tool methods | `CANONICAL_AUTHORITY_SERVICE` | `authorize`, `authorizeFields`, `materializeAuthorized`, `materializeFields`, and `authorizePublicTool` await mandatory decision evidence. |
| `packages/authority/src/service.ts` pure `evaluateAuthority` calls | `PURE_KERNEL_INTERNAL` | The service resolves persisted facts, evaluates the kernel, and records each final ALLOW or DENY. |
| `packages/authority/src/persistence.ts` public-tool pure `evaluateAuthority` calls | `PURE_KERNEL_INTERNAL` | This Authority-owned port returns a raw result only to the service, which records it before returning to its production consumer. |
| `tests/conformance/authority` and `tests/authority` pure-kernel calls | `TEST_ONLY` | Pure rule conformance and unit fixtures. |

Production `BYPASS` count: **0** in the current target source inventory.
`ARCH-AUTH-004` rejects a pure evaluator import or direct call in production
outside Authority. Its positive and negative analyzer tests are in
`tests/architecture/staticAnalysis.test.ts`; both target architecture suites
run the rule. Future production consumers must use the service boundary.

The live PostgreSQL Authority matrix checks generic object ALLOW/DENY, field
ALLOW/DENY, ACL DENY, classification DENY, current public-tool ALLOW, and
mandatory Audit failure on each of those paths. A failing Audit port rejects
the decision and prevents protected materialization. The authenticated public
API test verifies `authority.decision` ALLOW and DENY delivery through SIEM
with HUMAN actor, tenant, session, request/correlation IDs, path, and
authorization version, without protected payload. The live matrix also checks
SIEM retry and database Audit immutability. Enabled SIEM configurations must
subscribe to `authority.decision`.

This establishes ASVS V16.3.2 for the current target production Authority
consumers. T5 must inventory its new consumers and repeat the decision and
Audit tests. It does not establish full customer ASVS Level 3 release readiness.

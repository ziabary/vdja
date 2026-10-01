# Authority Agent Instructions

Inherit `/AGENTS.md`.

The only package allowed to interpret authorization semantics.

## Required

- Own Roles/Instance Roles, privilege digestion, hierarchy, root/node ALL, typed privilege values, CRUD 0/w/1, scope, org hierarchy, ACL, classification/clearance, deny precedence, temporal schedules, break-glass, invalidation, final ALLOW/DENY.
- Keep ALL ancestor-aware inside its subtree/scope; explicit deny and hard boundaries still apply.
- For value lookup under ALL use the registered typed allDefault; never invent a value.
- Evaluate CRUD w using resource ownership facts from the owning module.
- Receive time explicitly for temporal policy.
- Ensure inherited child scope is not broader than parent solely by hierarchy.
- On suspension deny; on termination invalidate sessions/refresh families/digests/caches/delegation/break-glass within the configured bound.
- Keep pure deterministic evaluation kernel where practical.
- Return semantic list constraints, never SQL/Qdrant filters.

## Forbidden

- Leaking evaluation internals as public API.
- Using identity ID/role name as hidden superadmin logic.
- Implicit wall-clock inside pure kernel.

## Tests

- Root/internal ALL and sibling isolation.
- Value allDefault.
- CRUD 0/w/1.
- Deny precedence.
- Hierarchy/scope.
- Role expiry/schedules.
- ACL/classification/ownership.
- Federation/break-glass.
- Suspension/termination.
- List/RAG constraints.

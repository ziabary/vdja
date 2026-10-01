# Knowledge / RAG Agent Instructions

Inherit `/AGENTS.md`.

Owns Knowledge Spaces, memberships, index profiles/projections, Qdrant boundary, secure retrieval, context assembly.

## Required

- Treat Knowledge Space as organization/index boundary, never authorization.
- Keep PostgreSQL authoritative and Qdrant derived/rebuildable.
- Use deterministic point identities and versioned profiles.
- Run Authority constraints before retrieval and final Authority validation before protected chunk materialization.
- Never send unauthorized chunks to reranker/LLM.
- Respect discover/read/download/use/quote/manage independently.
- Fail closed on stale/uncertain security projection.
- Support rebuild from retained canonical/processing state.

## Forbidden

- Business module direct Qdrant access.
- One-collection-per-user as architectural assumption.
- Retrieved prompt injection as trusted instructions.
- Hidden-source leaks in citations/counts/errors.

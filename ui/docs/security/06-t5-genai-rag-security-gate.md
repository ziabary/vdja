# T5 GenAI and RAG security gate contract

This contract becomes active during T5. It does not establish implementation
evidence or authorize customer release. T5 must record `ASVS_DELTA` and
`GENAI_RAG_SECURITY_GATE` after implementing Document Core, File Management,
Storage/S3, Qdrant, embeddings, reranking, retrieval, citations, and Data
Governance.

The T5 gate must test prompt injection, retrieval poisoning, cross-tenant
retrieval, vector and embedding isolation, authorization before chunk
materialization, sensitive information disclosure, insecure output handling,
external egress approval, context contamination, and resource and token
exhaustion. Every protected retrieval candidate must receive a final Authority
decision before its content reaches reranking or generation. Failures and
reconciliation behavior require semantic Audit and SIEM evidence.

The final ASVS Level 3 assessment remains open until this added surface is
implemented and verified. The pre-T5 `RAG_SECURITY_GATE` only controls the
start of T5 development.

The completion gate reports platform enforcement and approved-model behavior
separately. Platform assertions cover Authority, tenant and classification,
no unauthorized reranker/generator content, citation/quote limits, external
egress, bounded context and escaped browser output even when provider output
is malicious. Protocol fixtures can prove these boundaries but cannot prove
the semantic behavior or provenance of a customer-selected model.

Approved-model acceptance requires the configured real embedding, reranking
when enabled, and generation endpoints, plus API, Worker, Storage, Qdrant and
built-browser execution on isolated synthetic LOW data. If approved current
model configuration is unavailable, the result is
`ACTUAL_APPROVED_MODEL_CONFIG_REQUIRED` and `GENAI_RAG_SECURITY_GATE`
remains closed. A protocol fixture must never be promoted to actual-model
evidence.

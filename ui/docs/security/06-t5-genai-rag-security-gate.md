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

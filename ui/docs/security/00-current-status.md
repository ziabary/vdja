# Security evidence status index

This index identifies the authoritative current T5 result and earlier snapshots. It does not change the facts recorded in historical reports.

| Document or artifact | Status | Use |
| --- | --- | --- |
| `reports/security/t5-r1-1-verification.json` and `docs/verification/04-t5-r1-1-verification-fa.md` | CURRENT after T5-R1.1 | Verification repair task outcome, separate from T5 product completion |
| `reports/security/t5-completion-gate.json` | CURRENT after the T5-R1.1 gate rerun | T5 completion, independent GenAI and customer-release gates, 100 criterion outcomes |
| `reports/security/t5-acceptance-evidence.json` | CURRENT after the T5-R1.1 evidence run | Per-criterion direct, derived, static, model and deployment evidence with source and contract hashes |
| `reports/security/t5-direct-evidence.json` and `reports/security/t5-preliminary-gates.json` | CURRENT intermediate evidence | Source-bound direct cases and noncircular GenAI/security gate inputs |
| `reports/security/asvs-5.0-l3.json` and `docs/security/03-t5-asvs-5.0-level3-assessment-fa.md` | CURRENT after reassessment | Current 345-control ASVS matrix and T5 subset |
| `reports/security/t5-asvs-review.json` and `reports/security/t5-r1-open-findings.json` | CURRENT after reassessment | T5 controls, direct evidence and open blocker classes |
| `reports/security/t5-service-boundary-assessment.json` | CURRENT after T5-R1.1 | Platform capability and customer deployment status for V12.3.5 and V13.2.1 |
| `reports/security/t5-supply-chain.json` | CURRENT after T5-R1.1 | All nine OCI image identities, exact rootfs scan groups and remaining findings |
| `reports/security/t5-security-delta-backlog.json` | HISTORICAL T5 start classification | Original verify-during-T5 obligations consumed by the independent RAG start gate |
| `docs/security/03-t5-rag-security-delta-fa.md` | CURRENT after the T5-R1 gate rerun | Generated Persian gate summary |
| `docs/security/06-t5-genai-rag-security-gate.md` | CURRENT policy; runtime result is in the completion gate | Distinguishes platform enforcement from actual model acceptance |
| `docs/security/08-t5-authority-decision-boundary-fa.md` and `reports/security/t5-authority-inventory.json` | CURRENT inventory | Post-T5 consumer and bypass inventory; all-branch Audit/SIEM proof remains open |
| `docs/security/07-t4-authority-decision-boundary.md` | HISTORICAL | T4 consumer boundary, before T5 consumers |
| `docs/security/01-asvs-5.0-level3-assessment-fa.md` | HISTORICAL | T4 assessment snapshot |
| `docs/security/02-t4-threat-model-fa.md` | HISTORICAL | T4 threat model; still useful for T4 scope |
| `docs/security/03-t4-refresh-cookie-decision-fa.md` | HISTORICAL | T4 cookie decision at its recorded time |
| `docs/security/04-t4-asvs-applicability-matrix-fa.md` | HISTORICAL | T4 applicability snapshot |
| `docs/security/05-t4-rag-security-readiness-fa.md` | SUPERSEDED for current RAG start readiness | Earlier `RAG_SECURITY_GATE=NO` was corrected in the later start-gate artifact |
| `reports/security/rag-security-gate.json` | CURRENT for the T5 start gate only | Starting permission; it does not imply T5 completion |

Do not transfer a historical T4 `PASS` to a new T5 consumer without specific evidence. A `PASS` from a protocol fixture does not establish actual-model or customer-deployment readiness.

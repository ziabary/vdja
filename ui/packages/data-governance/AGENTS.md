# Data Governance Agent Instructions

Inherit `/AGENTS.md`.

Owns lifecycle and external-data-movement policy.

## Required

- Govern retention/archive/purge/legal hold/backup/export/residency/external-provider eligibility/minimization.
- Require governance before protected external AI, webhook, customer-system, monitoring/SOC, or provider egress.
- Make retention/purge jobs consume approved policy.

## Forbidden

- Assuming local Authority ALLOW implies external egress.
- Hard-coded retention in generic cleanup.

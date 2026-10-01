# CRM Module Agent Instructions

Inherit `/AGENTS.md`.

Owns CRM-specific domain semantics, lifecycle, persistence, UI, Tasks, and integrations.

## Required

- Use Authority, Documents, Knowledge/RAG, AI Router, Notifications, Ticketing, Follow-up integration, Usage/Admission/Commercial public contracts.
- Keep CRM resource facts separate from access decisions.

## Forbidden

- Legacy/local `crmRole` authorization in target code.
- Direct privs/Role/ALL evaluation.
- Private generic ticket/notification/document systems.
- Direct model/Qdrant/provider access.
- Cross-module private table access.

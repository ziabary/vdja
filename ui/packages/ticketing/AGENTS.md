# Ticketing Agent Instructions

Inherit `/AGENTS.md`.

Generic support/request infrastructure; not CRM or module workflow host.

## Required

- Own Ticket/Conversation/Message/requester/creator/participants/watchers/Queue/assignment/generic status/priority/category/SLA/history/linked refs.
- Use Document Core for attachments.
- Treat requester/assignee/queue/participant/watcher as facts, not automatic access.
- Protect internal notes server-side.
- Never query linked module private tables.
- Use shared Calendar for SLA.
- Concurrency-safe/audited transitions.
- AI may assist only.
- Authorize list/search before materialization.

## Forbidden

- CRM Customer/Opportunity/Sales semantics.
- Module-specific lifecycle statuses.
- Local authorization.

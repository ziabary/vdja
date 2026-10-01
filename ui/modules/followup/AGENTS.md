# Follow-up Module Agent Instructions

Inherit `/AGENTS.md`.

Owns follow-up tasks, deadlines, reminders, lifecycle.

## Required

- Accept standalone input and optional stable linked-resource refs.
- Use AI Router for action/deadline extraction and validate output.
- Use Calendar Core for Jalali/Gregorian/timezone/schedules.
- Use durable Jobs for future work.
- Use Notifications for delivery.
- Use adapters for external task/calendar systems.
- Use Reconciliation for uncertain external task creation.

## Forbidden

- Hard dependency on Secretariat/CRM.
- Private calendar engine.
- Direct SMS/email/provider calls.
- Local authorization.

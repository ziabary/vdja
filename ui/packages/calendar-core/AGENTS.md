# Calendar Core Agent Instructions

Inherit `/AGENTS.md`.

Owns reusable calendar/time semantics.

## Required

- Jalali/Gregorian conversion.
- Date/range arithmetic and recurring schedule primitives.
- Explicit timezone/calendar boundaries.
- Business calendar/holiday primitives where configured.
- Pure deterministic calculations where practical.
- Persist absolute timezone-aware timestamps.

## Forbidden

- Formatted Jalali strings as authoritative absolute time.
- Subsystem-specific duplicated calendar engines.

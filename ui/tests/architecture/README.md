# Architecture guardrail tests

These checks encode the target architecture as executable rules before production implementation work begins. They are intentionally red-first: the current repository still contains legacy code and incomplete module/package manifests, so expected failures are a feature rather than a bug.

The suite is designed to:

- define the intended target scope (`apps`, `packages`, `modules`)
- require stable rule metadata (`ARCH-*` identifiers)
- assert the presence of required package and module manifests
- document that authority, persistence, AI routing, and document ownership remain platform concerns, not module concerns
- provide a reusable conformance harness for future implementation work

These tests intentionally fail against the current repo state and should be used as a forcing function for any future architecture work.

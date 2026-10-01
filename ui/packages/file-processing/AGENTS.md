# File Processing Agent Instructions

Inherit `/AGENTS.md`.

Shared generic parsing/extraction.

## Required

- Support approved text/Markdown/DOCX/ODT/text-PDF processors.
- Validate type beyond extension.
- Treat file/content as untrusted.
- Never execute macros/scripts/active content.
- Bound size/pages/archive expansion/nesting/time/memory/text.
- Record processor/profile version and explicit states.
- Preserve structure/provenance metadata.
- Use durable Workers for non-trivial processing.

## Forbidden

- Module-local duplicate generic file readers.
- Silent empty success on malformed/unsupported content.
- Business/provider orchestration inside parser.

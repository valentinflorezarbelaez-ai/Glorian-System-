# Architecture Decision Records

This directory contains the Architecture Decision Records (ADRs) for the EOS System,
following the [MADR](https://adr.github.io/madr/) (Markdown Architectural Decision
Records) format.

## Index

| ID | Title | Status |
|---|---|---|
| [ADR-0001](./0001-zero-external-runtime-dependencies.md) | Zero External Runtime Dependencies | Accepted |
| [ADR-0002](./0002-native-typescript-type-stripping.md) | Native Node.js TypeScript Type Stripping (no tsc compile step) | Accepted |
| [ADR-0003](./0003-mcp-tool-handler-registry.md) | MCP Tool Handler Registry Pattern (decompose god-file) | Accepted |
| [ADR-0004](./0004-hexagonal-layer-zero-architecture.md) | Hexagonal (Clean) Architecture with Layer-0 Domain Purity | Accepted |
| [ADR-0005](./0005-configurable-fleet-paths-via-env.md) | Fleet Project Paths Resolved from Environment Variables | Accepted |
| [ADR-0006](./0006-typed-error-codes.md) | Typed Error Classes with Machine-Readable Codes | Accepted |

## Format

Each ADR follows the MADR template:

- **Title** — short noun phrase
- **Status** — `Proposed` | `Accepted` | `Deprecated` | `Superseded by ADR-XXXX`
- **Date** — ISO 8601 (`YYYY-MM-DD`)
- **Deciders** — who made the decision
- **Context** — what problem drove this decision
- **Decision** — what was decided and how it works
- **Consequences** — positive outcomes, negative trade-offs
- **Rejected Alternatives** — what was considered and why it was not chosen

## Superseding an ADR

To supersede an existing ADR, update its `Status` field to
`Superseded by ADR-XXXX` and create the new ADR referencing the superseded one
in its Context section.

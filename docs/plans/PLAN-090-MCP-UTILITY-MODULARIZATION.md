# PLAN-090 / ADR-155: MCP Utility Modularization

## Decision
Introduce a dispatch registry and domain handler facades; keep `EosMcpServer` as thin JSON-RPC shell + confinement + session auto-record.

## Alternatives Rejected
1. **Delete 160 tools immediately** — breaks fleet scripts and full-profile consumers; fails Law III without migration evidence.
2. **Rewrite MCP server in another language** — out of scope; violates Layer-0 purity goals for this change.
3. **Keep growing the god-file** — increases mechanical ego and agent error rate.

## Phases
1. Registry + utility doctrine + >=8 core handlers extracted (this change).
2. Extract remaining core handlers; shrink god-file further.
3. Extract full-profile domain bundles (fleet, spotify, sandbox, frontier).
4. Optional later: retire CEREMONIAL tools from `full` after provenance audit.

## Invariants
- 0 runtime npm dependencies
- core <= 30
- Golden parity for migrated tools

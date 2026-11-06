# PLAN-048: Real-Time Visual Telemetry & Topological Control Dashboard

## Architecture Decision Record: ADR-061
- **Title**: Layer-0 Native HTTP Telemetry Dashboard & REST Observability
- **Status**: ACCEPTED
- **Context**: EOS requires real-time stakeholder visibility into subagent topologies, token savings, ledger blocks, and health telemetry without external frameworks (Express/Fastify) or heavy node_modules.
- **Decision**:
  1. Implement `EosTelemetryDashboard` in `src/core/eosTelemetryDashboard.ts` utilizing Node's built-in `node:http`, `node:fs`, and `node:crypto`.
  2. Provide REST endpoints (`GET /api/telemetry`, `GET /api/ledger`, `GET /api/topology`).
  3. Deliver an accessible, high-performance, single-file HTML5/CSS/JS control panel at `GET /` with interactive SVG diagrams.
  4. Ensure graceful startup, shutdown, and error handling with custom port binding (default 4321).
  5. Scribe telemetry snapshot attestations into the durable SQLite WAL ledger.
- **Consequences**:
  - Zero external runtime npm dependencies preserved.
  - Ultra-low latency, sub-millisecond responses on localhost.

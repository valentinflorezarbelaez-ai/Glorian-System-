# INTAKE-048: Real-Time Visual Telemetry & Topological Control Dashboard

## 1. Context & Business Intent
To provide stakeholders, engineers, and autonomous subagents with complete situational awareness, EOS requires a real-time visual control dashboard. The dashboard must be served by a native Layer-0 HTTP server (`node:http`, zero external dependencies) on a configurable local port (e.g. 4321), providing live telemetry snapshots, an interactive SVG subagent topology DAG, a token efficiency odometer, a live SQLite WAL ledger explorer with FTS5 search, and REST API endpoints (`/api/telemetry`, `/api/ledger`, `/api/topology`).

## 2. Invariants & Constraints
- **Layer-0 Purity**: Zero external runtime npm dependencies (`node:http`, `node:fs`, `node:crypto`).
- **Single-File Accessible UI**: Semantic HTML5 markup, WCAG 2.1 AA accessible contrast, zero CDN dependencies.
- **REST Endpoints**: JSON responses with exact Content-Type headers and CORS headers for local debugging.
- **Fail-Safe Port Binding**: Graceful fallback or reporting if port is in use.

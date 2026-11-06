# PLAN-047: Hermetic MicroVM & Isolated Hypervisor Sandbox Engine

## Architecture Decision Record: ADR-060
- **Title**: Multi-Tiered MicroVM, gVisor & Ephemeral Sandbox Confinement
- **Status**: ACCEPTED
- **Context**: Autonomous agents require isolated execution capabilities to evaluate untested code, run stress benchmarks, or execute compiler tasks without risking the developer's workstation or leaking host credentials.
- **Decision**:
  1. Implement `EosMicroVmSandbox` in `src/core/eosMicroVmSandbox.ts` utilizing Node's built-in `node:child_process`, `node:fs`, `node:crypto`, and `node:vm`.
  2. Implement runtime auto-detection: checks for Docker daemon (and gVisor `runsc` runtime), Firecracker CLI, or falls back to ephemeral `node:vm` isolated context.
  3. Enforce default constraints: `--network none` (zero outbound traffic), 512 MB memory ceiling, 15-second hard process kill timeout.
  4. Mount host code as read-only and buffer mutations in memory / temporary directories.
  5. Scribe all sandbox execution receipts into the durable SQLite WAL ledger.
- **Consequences**:
  - Eliminates risks of rogue agent loops or malicious code execution on host OS.
  - Zero external runtime npm dependencies preserved.

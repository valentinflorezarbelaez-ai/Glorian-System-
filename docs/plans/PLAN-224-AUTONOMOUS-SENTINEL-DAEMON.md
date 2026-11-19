# PLAN-224: Architectural Plan for Autonomous Continuous Sentinel Daemon 24/7

**Document ID**: `PLAN-224-AUTONOMOUS-SENTINEL-DAEMON`  
**Specification Target**: `SPEC-362` / `CHANGE-224`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `APPROVED`  
**Author**: Valentín Flórez Arbeláez (Principal Architect)  
**Creation Date**: 2026-11-19

---

## 1. Architectural Philosophy & Vision

Level 4/5 Autonomy marks the transition from **reactive conversational agents** to **proactive sovereign software engines**.

`EosAutonomousSentinelDaemon` serves as the vigilant heartbeat of Glorian System, operating continuously in the background without needing human invocation. It links four core systems:

1. `EosBitemporalEventLedger` (`SPEC-357`): verifies that all datom commits form an uncorrupted Merkle DAG.
2. `EosArchitecturalCanvas` (`SPEC-358`): tracks topological blast radius when anomalies emerge.
3. `EosAgentSwarmMicroKernel` (`SPEC-359`): leases remediation tasks to the Raft leader and worker pool.
4. `EosInductiveProofEngine` (`SPEC-360`): certifies that proposed remediation patches inductively satisfy system invariants before staging PRs.

---

## 2. Architecture Decision Record (ADR-224-001)

### Title

**ADR-224-001: Native Background Timer Loop with Pure Layer-0 Isolation vs External OS Daemon Managers (Systemd / PM2)**

### Status

`ACCEPTED`

### Context

To achieve continuous 24/7 operation, the sentinel requires a persistent execution loop. Common practices include deploying external daemon managers like PM2, Docker Compose sidecars, or OS systemd unit services.

However, Glorian System must run hermetically across Windows, macOS, and Linux without requiring global root privileges, external runtime packages, or complex orchestrators.

### Decision

Implement `EosAutonomousSentinelDaemon` as a native Layer-0 Node.js class leveraging unref-capable `setInterval` / `setTimeout` timers with bounded execution timeouts and asynchronous child process invocation.
When executed via CLI (`toolchain:sentinel:start`), the process enters an autonomous daemon state with graceful signal handling (`SIGINT`, `SIGTERM`), unhandled rejection catchers, and continuous telemetry broadcasting to `EosGlorianLiveStudio`.

### Consequences

- **Positive**: 100% portable; zero npm dependencies; instantaneous startup; formal verification via Leslie Lamport TLA+ model.
- **Negative**: OS-level reboots require a launch wrapper or startup script to automatically restart the daemon if desired.

---

## 3. Rejected Alternatives

1. **PM2 Global Daemon Runner**:
   - _Rejected_: Requires `npm install -g pm2`, breaking Layer-0 purity and adding significant supply-chain attack surface.
2. **Cron Job Spawner**:
   - _Rejected_: Spawns heavy cold-start node processes on every tick (60s), creating high CPU/disk thrashing compared to an in-memory resident sentinel daemon.

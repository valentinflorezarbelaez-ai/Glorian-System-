# PLAN-226: Architectural Plan for Fleet Chaos Monkey & Autonomous FDIR Engine

**Document ID**: `PLAN-226-FLEET-CHAOS-FDIR`  
**Specification Target**: `SPEC-364` / `CHANGE-226`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `APPROVED`  
**Author**: Valentín Flórez Arbeláez (Principal Architect)  
**Creation Date**: 2026-11-19

---

## 1. Architectural Philosophy & FDIR Principles

`EosFleetChaosMonkey` translates space-mission and high-availability avionics principles into autonomous software engineering:

1. **Fault Injection**: Systematically introduce non-destructive perturbations into runtime structures.
2. **Failure Detection (FD)**: Senses divergence from nominal telemetry via `EosAutonomousSentinelDaemon` in $< 50\text{ms}$.
3. **Failure Isolation (FI)**: Quarantines affected components in isolated worktrees/sandboxes without polluting the main branch or active fleet.
4. **Failure Recovery (FR)**: Deploys self-healing leases to the Raft swarm microkernel (`SPEC-359`), proving inductive preservation of invariants (`SPEC-360`).
5. **MTTR $< 500\text{ms}$ Certification**: Measures and certifies sub-500ms recovery mathematically.

---

## 2. Architecture Decision Record (ADR-226-001)

### Title

**ADR-226-001: In-Memory Bounded Chaos Injection & Reversible Overlays vs Destructive In-Place Mutators**

### Status

`ACCEPTED`

### Context

Testing real failure scenarios in software systems often risks permanent file corruption, broken Git history, or accidental loss of working copy changes when chaos scripts mutate production files in-place.

### Decision

Implement `EosFleetChaosMonkey` using purely in-memory overlays, temporary hermetic sandboxes, and virtual node topologies.
Every chaos experiment records a pre-injection snapshot with cryptographic hash, executes bounded perturbations, measures detection and recovery latencies, and automatically restores initial state upon test conclusion or emergency timeout.

### Consequences

- **Positive**: 100% safe to run across all 9 production fleet repositories; zero risk of data loss; deterministic and repeatable; formal verification via Leslie Lamport TLA+ model.
- **Negative**: Cannot simulate catastrophic hardware-level disk burns or physical power outages.

---

## 3. Rejected Alternatives

1. **Destructive File Rewriter**:
   - _Rejected_: In-place destructive modifications risk corrupting real repository states if an unexpected process crash occurs mid-experiment.
2. **Kernel-Level eBPF Network Dropper**:
   - _Rejected_: Requires Linux root privileges and kernel headers, violating Layer-0 cross-platform portability on Windows and macOS.

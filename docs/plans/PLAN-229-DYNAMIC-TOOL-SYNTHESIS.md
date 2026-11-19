# PLAN-229: Architectural Plan for Autonomous Dynamic Tool Synthesis & JIT Skill Compiler

**Document ID**: `PLAN-229-DYNAMIC-TOOL-SYNTHESIS`  
**Specification Target**: `SPEC-367` / `CHANGE-229`  
**Component**: `eos-system-control-plane` (`Glorian System`)  
**Status**: `APPROVED`  
**Author**: Valentín Flórez Arbeláez (Principal Architect)  
**Creation Date**: 2026-11-19

---

## 1. Architectural Philosophy & JIT Synthesis Principles

`EosDynamicToolSynthesis` implements self-extensibility for autonomous agent swarms:

1. **JIT Compilation**: Generates typed JavaScript function adapters and schema definitions on-the-fly from incoming protocol specs.
2. **Double-Sandboxing**: Executes synthesized handler code inside isolated JavaScript function contexts or `node:vm` contexts to verify output contracts before exposure.
3. **Atomic Hot-Swapping**: Dispatch tables are backed by copy-on-write `Map` instances, guaranteeing that registrations are atomic and revertible with zero downtime.
4. **Cryptographic Provenance**: Every synthesized tool is stamped with the SHA-256 hash of its source specification and generator template.

---

## 2. Architecture Decision Record (ADR-229-001)

### Title

**ADR-229-001: In-Memory Hot Dispatch Table Injection vs Process Restart with Static Code Generation**

### Status

`ACCEPTED`

### Context

Conventional agent tools are compiled ahead-of-time (AOT) and hardcoded in tool definition files. When an agent discovers a new microservice in production, regenerating static TypeScript files and triggering an application restart disrupts in-flight agent sessions, drops active SSE streams, and invalidates working memory.

### Decision

Implement dynamic in-memory hot-registration via `EosDynamicToolSynthesis`.
The engine compiles incoming OpenAPI / CLI specifications into in-memory function handlers, verifies their execution in sandboxes, and registers them directly into the runtime MCP dispatch dictionary without restarting Node.js processes.

### Consequences

- **Positive**: 0ms downtime; instant availability of newly discovered APIs; preserves active agent conversation states; fully tested before exposure.
- **Negative**: Dynamic tools do not persist across process reboots unless explicitly exported to disk via the export checkpoint API.

---

## 3. Rejected Alternatives

- **Spawning External Python/Bash Subprocesses for Every Tool**: Rejected due to high process startup latency (> 100ms per call) and lack of strict type contract enforcement.
- **Unsandboxed `eval()` Injection**: Rejected as a catastrophic security anti-pattern violating the Law of Absolute Security.

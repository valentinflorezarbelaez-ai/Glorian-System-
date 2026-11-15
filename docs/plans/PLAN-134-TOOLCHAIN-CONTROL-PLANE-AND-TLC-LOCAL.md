# PLAN-134 — Toolchain Control Plane, Local TLC Execution, and Cold-Start Shield Grace

## Metadata

- **Plan ID**: PLAN-134
- **Change Reference**: [CHANGE-134-toolchain-control-plane-and-tlc-local.md](file:///c:/Users/valen/Documents/Glorian-System/openspec/changes/CHANGE-134-toolchain-control-plane-and-tlc-local.md)
- **Spec Reference**: [SPEC-272-TOOLCHAIN-CONTROL-PLANE-AND-TLC-LOCAL.md](file:///c:/Users/valen/Documents/Glorian-System/openspec/specs/SPEC-272-TOOLCHAIN-CONTROL-PLANE-AND-TLC-LOCAL.md)
- **Status**: APPROVED

---

## 1. Architectural Decisions (ADRs)

### ADR-134-001: Safe Non-Shell Child Process Spawning for Toolchain Doctor

- **Context**: Querying CLI tools via shell string interpolation (`sh -c` or `powershell -Command`) is susceptible to shell injection, environment variable tampering, and command hanging.
- **Decision**: Implement `EosToolchainDoctor` in `src/core/eosToolchainDoctor.ts` using `node:child_process` `execFileSync` / `spawnSync` strictly with discrete arguments arrays, bounded timeouts (max 4,000ms per tool), and sanitized `PATH` extraction.
- **Consequences**:
  - Positive: Zero injection vector, 100% deterministic, zero external npm dependencies.
  - Negative: Tool execution requires individual binary probing.

### ADR-134-002: Warmup Grace Counter in Event Loop Saturation Governor

- **Context**: In serverless functions (e.g. Vercel deployment), V8 cold starts involve substantial synchronous file evaluation (JIT compilation, TypeScript/JS bundling), causing initial event loop lag to reach tens of seconds. `EosEventLoopSaturationGovernor` immediately flagged `SHEDDING_ACTIVE`, returning 503 on first requests.
- **Decision**: Introduce a `warmupCyclesRequired` counter (default: 3 samples) in `EosEventLoopSaturationGovernor`. During the initial warmup cycles, lag is measured and recorded, but `SHEDDING_ACTIVE` is suppressed unless the warmup period has elapsed.
- **Consequences**: Eliminates cold-start 503 errors while preserving full backpressure protection once the runtime reaches steady state.

### ADR-134-003: Cryptographically Verified Local tla2tools.jar

- **Context**: Java 21 LTS is now installed on the developer machine, but `scripts/run-tlc.mjs` was deferring execution to CI because `tools/tla2tools.jar` was absent locally.
- **Decision**: Fetch the official release of `tla2tools.jar` v1.8.0 into `tools/tla2tools.jar` (which is already gitignored), verify that its SHA-256 matches `7e53aa636dac8a3cb0533f343115c0548e03fc0ce5edc7739becf58d3d0fb84f`, and enable `LIVE_LOCAL_TLC` execution.
- **Consequences**: Enables developers to run exhaustive formal model checking locally in seconds before committing code.

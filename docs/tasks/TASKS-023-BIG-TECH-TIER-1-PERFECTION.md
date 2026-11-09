# TASKS-023: BIG TECH TIER-1 PERFECTION & PHYSICAL PRODUCTION HARDENING

- **Task Package**: `TASKS-023`
- **Spec**: `SPEC-030-BIG-TECH-TIER-1-PERFECTION`
- **Plan**: `PLAN-023`
- **Status**: `READY_FOR_EXECUTION`

---

## Task DAG & Execution Sequence

```
[TASK-023-1: Binary Durable WAL with fsync & Crash Recovery (eosDurableWal.ts)]
                         |
                         v
[TASK-023-2: WebGPU WGSL Compute Shader & Bridge (eosWebGpuTopology.ts)]
                         |
                         v
[TASK-023-3: Prometheus Text Exporter & /metrics (eosPrometheusExporter.ts)]
                         |
                         v
[TASK-023-4: Hermetic Copy-On-Write Sandbox (eosHermeticSandbox.ts)]
                         |
                         v
[TASK-023-5: Integration in MCP Stream Server, HTTP Bridge & CLI]
                         |
                         v
[TASK-023-6: Comprehensive Test Suite test/eosBigTechTier1Perfection.test.mjs]
                         |
                         v
[TASK-023-7: CI/CD Pipeline Verification & Production Seal (7/7 Stages)]
```

### Task Definitions

1. **TASK-023-1: Binary Durable WAL with `fsync` & Crash Recovery**

   - Write `src/core/eosDurableWal.ts` with binary CRC32 checksums, magic header `EOSW`, frame header parsing, `fsyncSync()`, and torn write truncation.
   - Done criteria: Appending records persists to disk; re-opening file recovers 100% of valid transactions and truncates corrupted tail frames.

2. **TASK-023-2: WebGPU WGSL Compute Shader & Bridge**

   - Author `src/native/eos_topology_shader.wgsl` for parallel GPU compute workgroups.
   - Write `src/core/eosWebGpuTopology.ts` with device discovery, matrix projection, and fallback.
   - Done criteria: Valid WGSL syntax, 0 B/op residual allocations.

3. **TASK-023-3: Prometheus Text Exporter & `/metrics`**

   - Write `src/core/eosPrometheusExporter.ts` formatting gauges, counters, and histograms in Prometheus 0.0.4 text format.
   - Expose `/metrics` on `EosMcpStreamServer` and `scripts/mcp-server-http.mjs`.
   - Done criteria: `GET /metrics` returns 200 OK with `text/plain; version=0.0.4`.

4. **TASK-023-4: Hermetic Copy-On-Write Sandbox**

   - Write `src/core/eosHermeticSandbox.ts` with virtual filesystem overlay, double-blind syntax checking, and safe commit logic.
   - Done criteria: Broken patches rejected with 0 disk writes; clean patches verified before disk commit.

5. **TASK-023-5: Integration in MCP Stream Server, HTTP Bridge & CLI**

   - Add tools `eos_wal_status`, `eos_prometheus_metrics`, and `eos_sandbox_evaluate` to `src/mcp/eosMcpServer.ts`.
   - Add `eos metrics` and `eos wal` commands to `bin/eos.mjs`.
   - Done criteria: CLI and MCP tools operational.

6. **TASK-023-6: Comprehensive Test Suite**

   - Implement `test/eosBigTechTier1Perfection.test.mjs` verifying WAL durability, crash recovery, WebGPU shader, Prometheus output, and hermetic sandbox.
   - Done criteria: All test suites pass with exit code 0.

7. **TASK-023-7: CI/CD Pipeline Verification & Production Seal**
   - Register new test in `scripts/verify-cicd-pipeline.mjs` and `package.json`.
   - Update `IMPLEMENTATION_AUTHORIZATION.md` and `AGENTS.md`.
   - Run `npm test` verifying all 7/7 aduanas pass.

---

_Signed by Principal Architect: Valentín Flórez Arbeláez_

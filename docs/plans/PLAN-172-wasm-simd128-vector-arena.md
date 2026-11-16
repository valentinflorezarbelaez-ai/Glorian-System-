# PLAN-172: Architecture & Technical Plan (`SPEC-310` — WebAssembly SIMD128 Vector Arena)

## 1. Architectural Overview & ADR-172

### ADR-172: W3C WebAssembly Core 2.0 Fixed-Width SIMD (`v128` / `0xfd`) + 16-Byte Aligned Arena + Elastic Fleet Scaling

- **Context**: `SPEC-309` introduced scalar WASM linear-memory execution (`i32` loops), while real production workloads across HNSW vector similarity, CRDT vector joins, and zero-copy telemetry framing benefit from 128-bit single-instruction multiple-data parallelism (`v128`). Meanwhile, fleet growth governance required decoupling capacity modeling from the hardcoded 9-project equality check without breaking existing fail-closed registry invariants.
- **Decision**:
  1. Author canonical Zig `@Vector(4, i32)` (`simd_kernel.zig`, compiled with `-mcpu=generic+simd128`) and `#![no_std]` Rust (`simd_kernel.rs`) source kernels alongside a zero-dependency W3C WebAssembly SIMD128 bytecode module (`v128.load`, `v128.store`, `i32x4.max_s`, `i32x4.mul`, `v128.xor`, `i32x4.extract_lane`).
  2. Enforce 16-byte arena offset alignment (`(offset + 15) & ~15`) for aligned SIMD memory transfers without intermediate V8 heap array copies.
  3. Preserve `EosUniversalFleetSyncCore.EXPECTED_PROJECT_COUNT = 9` for strict local registry sealing while adding `evaluateElasticFleetCapacity(projectCount, minProjects, maxProjects)` supporting `[9..1,000]` projects.
- **Rejected Alternatives**:
  - **Native N-API C++ / SIMD addons (`node-gyp`)**: Rejected because it breaks Law V (Zero Runtime External Dependencies) and fails across heterogeneous CI/Vercel Serverless runners.
  - **Relaxing `EXPECTED_PROJECT_COUNT = 9` implicitly**: Rejected because `BDD-1144`..`BDD-1148` depend on exact registry quorum verification; an explicit elastic planning API avoids breaking existing fail-closed guarantees.
  - **Unaligned scalar JS fallbacks only**: Rejected because V8 WebAssembly SIMD128 natively executes hardware vector lanes across Node 22/23/24 without native addon dependencies.

## 2. Module Boundaries & File Plan

1. `templates/polyglot-wasm/simd_kernel.zig` & `simd_kernel.rs` (canonical polyglot SIMD128 sources).
2. `src/core/eosWasmSimd128VectorArena.types.ts` (immutable strict TypeScript interfaces, ~75 lines).
3. `src/core/eosWasmSimd128VectorArena.ts` (Layer-0 core engine `< 500` lines, clean/hexagonal purity).
4. `src/core/eosUniversalFleetSyncCore.ts` (active consumer wiring for elastic fleet capacity).
5. `src/core/index.ts` (compact `SPEC-261..267` export blocks + export `SPEC-310`).
6. `bin/commands/cliWasmSimd128Arena.mjs`, `bin/commands/cliToolchainRouter.mjs`, `bin/commands/cliHelpCatalog.mjs`, `docs/DEVELOPER_GUIDE.md` (`475 -> 479` CLI parity, `return true` clean exit).
7. `test/eosWasmSimd128VectorArena.test.mjs` (`BDD-1635..1640`) & `docs/evidence/WASM_SIMD128_ARENA_RECEIPT.json`.

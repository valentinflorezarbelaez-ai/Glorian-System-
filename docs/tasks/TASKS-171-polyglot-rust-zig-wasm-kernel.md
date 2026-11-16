# TASKS-171: Polyglot Rust & Zig Native WASM Kernel Engine Implementation DAG

## Stage 1: Specification & Formal Authorizations

- [x] Task 1.1: Record intake context in `docs/intake/eos-system/INTAKE-171-POLYGLOT-RUST-ZIG-WASM-KERNEL.md`.
- [x] Task 1.2: Author change proposal in `openspec/changes/CHANGE-171-polyglot-rust-zig-wasm-kernel.md`.
- [x] Task 1.3: Author specification in `openspec/specs/SPEC-309-polyglot-rust-zig-wasm-kernel.md`.
- [x] Task 1.4: Author ADR in `docs/plans/PLAN-171-polyglot-rust-zig-wasm-kernel.md`.
- [x] Task 1.5: Record Level 3 authorization in `IMPLEMENTATION_AUTHORIZATION.md`.

## Stage 2: Cross-Platform CI Matrix Hardening

- [x] Task 2.1: Add pure Layer-0 FTS5 fallback in `src/core/eosNativeSqliteStore.ts` for Node 23.
- [x] Task 2.2: Add pure Layer-0 Helm lint/template fallback in `src/core/eosHelmReleaseGovernor.ts` for Windows CI runners.

## Stage 3: Polyglot Sources & Core Engine Implementation

- [x] Task 3.1: Create `templates/polyglot-wasm/kernel.rs` (`#![no_std]`) and `templates/polyglot-wasm/kernel.zig` (`wasm32-freestanding`).
- [x] Task 3.2: Implement contracts in `src/core/eosPolyglotRustZigWasmKernel.types.ts`.
- [x] Task 3.3: Implement `EosPolyglotRustZigWasmKernelCore` in `src/core/eosPolyglotRustZigWasmKernel.ts`.
- [x] Task 3.4: Wire `executeRustVectorJoinWasm` into `src/core/eosCrdtStateReplicator.ts`.
- [x] Task 3.5: Export contracts in `src/core/index.ts` respecting $\le 800$ lines / $\ge 12$ headroom.

## Stage 4: Toolchain CLI & Routing Parity

- [x] Task 4.1: Create `bin/commands/cliPolyglotRustZigWasm.mjs`.
- [x] Task 4.2: Wire `toolchain:rustzig:` in `bin/commands/cliToolchainRouter.mjs`.
- [x] Task 4.3: Register 4 commands in `bin/commands/cliHelpCatalog.mjs` and `docs/DEVELOPER_GUIDE.md` (`471 -> 475`).

## Stage 5: Test Suite, Verification & Release Sealing

- [x] Task 5.1: Author `test/eosPolyglotRustZigWasmKernel.test.mjs` (`BDD-1629`..`BDD-1634`).
- [x] Task 5.2: Emit receipt `docs/evidence/POLYGLOT_RUST_ZIG_WASM_RECEIPT.json`.
- [x] Task 5.3: Run tests, `typecheck`, `hygiene:audit`, `tip-refresh --seal-pin`, commit, and push to `origin/main`.

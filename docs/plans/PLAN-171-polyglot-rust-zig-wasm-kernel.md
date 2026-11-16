# PLAN-171: Architecture Decision Record (ADR-171) — Polyglot Rust & Zig Native WebAssembly Linear-Memory Kernel Engine

## 1. Architectural Context

High-assurance distributed control planes such as Cloudflare Workers and Figma offload critical tight-loop vector joins, hash functions, and lock-free ring-buffer checks into WebAssembly modules authored in Rust and Zig, keeping data inside contiguous linear memory pages (`WebAssembly.Memory`) free from JavaScript garbage-collection pauses.

## 2. Decision: Canonical `#![no_std]` Rust + Freestanding Zig + Dual-Mode W3C WASM Execution

1. **Canonical Systems Sources (`templates/polyglot-wasm/`)**:
   - Maintain real, clean `#![no_std]` Rust (`kernel.rs`) and `wasm32-freestanding` Zig (`kernel.zig`) kernels in source control.
2. **Hermetic Zero-Dependency Runtime Compatibility (Law V)**:
   - Even when target toolchains lack `wasm32-unknown-unknown` stdlib targets offline or on minimal CI containers, `EosPolyglotRustZigWasmKernelCore` leverages `EosWasmBytecodeSynthesizerCore` (`SPEC-306`) and Node.js native V8 `WebAssembly.Module` / `WebAssembly.Instance` / `WebAssembly.Memory` APIs so execution runs hermetically in pure Layer-0 with **zero** third-party npm packages.
   - When native `rustc --target wasm32-unknown-unknown` or `zig build-exe -target wasm32-freestanding` succeeds cleanly inside a bounded temp directory, its `.wasm` artifact and SHA-256 digest are verified and reported transparently (`compilerUsed: "RUSTC_WASM32" | "ZIG_WASM32" | "HERMETIC_W3C_SYNTHESIZER"`).
3. **Active Control-Plane Consumer**:
   - Replace the standalone `ArrayBuffer` loop inside `EosCrdtStateReplicatorCore.mergeLinearMemoryVectors` (`SPEC-308`) with a direct call to `EosPolyglotRustZigWasmKernelCore.executeRustVectorJoinWasm`, ensuring real operational consumption per Constitution rules (`verify-module-consumers.mjs`).

## 3. Rejected Alternatives

- **Alternative A: Commit opaque precompiled binary `.wasm` blobs without source or deterministic synthesizer**:
  - _Rejected_: Violates reproducibility and supply-chain transparency (`SPEC-299`/`SPEC-306`).
- **Alternative B: Add npm native-addon build tools (`wasm-pack`, `napi-rs`)**:
  - _Rejected_: Violates Constitutional Commandment V (Zero third-party runtime dependencies).

# PLAN-189: Universal Reverse Engineering Anything (REA) Engine

**Reference**: `SPEC-327` / `CHANGE-189`  
**System**: Glorian System Control Plane (`eos-system`)  
**Status**: APPROVED  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## 1. Architectural Overview

The **Universal Reverse Engineering Anything (REA) Engine** (`EosReverseEngineeringCore`) establishes an in-memory, deterministic analysis pipeline capable of ingesting arbitrary application artifacts and deriving structural models without executing untrusted code or depending on third-party binary toolchains:

```
Raw Target (File / Buffer)
          |
          v
[Magic Byte Scanner & Format Identification]
          |
          +---> [Electron .asar Parser] -----> Virtual Filesystem Tree
          |
          +---> [Minified JS Decomposer] ---> Module DAG & Identifier Frequencies
          |
          +---> [Binary Section Extractor] -> Symbol Table (Imports/Exports)
          |
          +---> [Shannon Entropy Engine] ---> High-Entropy Packed Section Heatmap
          |
          v
[Linear Instruction Stream / Bytecode]
          |
          v
[Basic Block Partitioner & CFG Builder]
          |
          v
Structured Evidence & Signed Audit Receipt (docs/evidence/REVERSE_ENGINEERING_RECEIPT.json)
```

---

## 2. Architectural Decision Records (ADRs)

### ADR-189-001: Pure In-Memory Chromium Pickle Parser for Electron ASAR

- **Context**: Electron applications package resources inside an `.asar` archive, which uses Chromium's Pickle format (a 16-byte header with pickle size, string size, and header JSON length, followed by utf-8 JSON directory tree). Standard unpackers invoke external npm packages (`@electron/asar`) which violates our zero runtime dependency invariant.
- **Decision**: Implement a native, zero-dependency Pickle binary header unpacker in pure Layer-0 TypeScript that reads header uint32 lengths, parses the directory JSON metadata, and slices file buffers directly using byte offsets.
- **Consequences**: Enables instantaneous, memory-safe unpacking of Electron `.asar` files with zero external npm dependencies.

### ADR-189-002: Sliding-Window Shannon Entropy Profiling

- **Context**: Packed, obfuscated, or encrypted payloads (e.g., malware droppers, protected game binaries, encrypted modules) must be identified prior to static analysis.
- **Decision**: Calculate Shannon entropy $H = -\sum_{i=0}^{255} p_i \log_2(p_i)$ over non-overlapping or sliding 256-byte windows. Segments with $H \ge 7.2\text{ bits/byte}$ (approaching the theoretical maximum of $8.0$) are flagged as `PACKED_OR_ENCRYPTED`.
- **Consequences**: Fast, robust detection of obfuscated regions without running dynamic emulation.

### ADR-189-003: Deterministic Basic Block Delimitation for CFG Synthesis

- **Context**: Decompiled assembly or bytecode instructions must be converted into Control-Flow Graphs (CFG) for agent reasoning.
- **Decision**: Define a basic block as a maximal sequence of instructions with one entry point and one exit point. Split blocks on:
  1. Any control transfer instruction (`JMP`, `JZ`, `JNZ`, `CALL`, `RET`).
  2. Any instruction targeted by a jump (jump destination / label).
- **Consequences**: Produces clean, canonical basic block DAGs suitable for static analysis and vulnerability identification.

---

## 3. Formal Verification Strategy (TLA+ Model 71)

- **Spec**: `docs/formal/ReverseEngineeringEngine.tla` & `ReverseEngineeringEngine.cfg`.
- **Invariants**:
  - `TypeOK`: Phase integrity (`INIT`, `FORMAT_IDENTIFIED`, `UNPACKED`, `ENTROPY_ANALYZED`, `CFG_BUILT`, `DONE`).
  - `ConservationOfBlocks`: Total instructions in all basic blocks equals input instruction count.
  - `AcyclicCFGSafety`: Control-flow edges connect strictly valid block identifiers.
  - `ZeroHostContamination`: No external process or filesystem mutation outside the virtual workspace.

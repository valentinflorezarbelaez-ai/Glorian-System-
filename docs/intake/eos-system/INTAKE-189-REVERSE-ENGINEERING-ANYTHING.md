# INTAKE-189: Universal Reverse Engineering Anything (REA) Engine

**Intake Reference**: `INTAKE-189`  
**Target Specification**: `SPEC-327`  
**Change Reference**: `CHANGE-189`  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17  
**System**: Glorian System Control Plane (`eos-system`)  
**Status**: APPROVED (LEVEL 3)

---

## 1. Context & Business Drivers

The user requested the formal integration of the **Reverse Engineer Anything (REA)** paradigm (inspired by `morluto/rea`) into the Glorian System sovereign control plane:

> _"https://github.com/morluto/rea añade este proyecto a glorian para hacerle ingenieria inversa a cualquier cosa a cualquiera y sigamos con la siguiente spec si pero recuerda lo de rea reverse enginering anything"_

Existing reverse engineering workflows are typically fragmented across disparate binary tools (Ghidra, IDA, JADX, Hopper), JavaScript/Electron unpackers (`asar`, AST deobfuscators), and custom inspection scripts. Glorian System requires a **sovereign, Layer-0 pure TypeScript engine** capable of ingesting arbitrary software artifacts—Electron archives, minified JavaScript bundles, WebAssembly modules, and native binaries—and extracting structured call graphs, symbol tables, control-flow graphs (CFG), and cryptographic evidence receipts without external toolchain dependencies or cloud leaks.

---

## 2. Key Capabilities & Invariants

1. **Multi-Target Ingestion & Unpacking**:
   - Extraction and traversal of Electron `.asar` archives (header JSON parsing, file offset slicing).
   - AST-level analysis and deobfuscation of minified JS/Web bundles (identifier normalization, module boundary detection).
   - Binary header inspection for PE/COFF, ELF, and W3C WebAssembly binaries.

2. **Control-Flow Graph (CFG) & Call Graph Recovery**:
   - Basic block identification and edge classification (fallthrough, conditional branch, call, return).
   - Transitive caller/callee resolution and cyclomatic complexity scoring.

3. **Symbol Table & Entropy Profiling**:
   - Symbol extraction (exported functions, imported libraries, global variables).
   - Shannon entropy profiling per binary section to detect encrypted or packed payloads ($H > 7.2\text{ bits/byte}$).

4. **Structured Evidence & Zero Hallucination**:
   - Structured JSON receipts containing verifiable evidence, limitations, and unknown regions.
   - Deterministic SHA-256 seal emitted to `docs/evidence/REVERSE_ENGINEERING_RECEIPT.json`.

5. **Formal Verification & CLI Toolchain**:
   - TLA+ Model 71 (`ReverseEngineeringEngine.tla`) verifying call graph bounded recursion and extraction invariants.
   - 5 new CLI commands under `toolchain:rea:` registered with 100% catalog parity (`558 -> 563`).

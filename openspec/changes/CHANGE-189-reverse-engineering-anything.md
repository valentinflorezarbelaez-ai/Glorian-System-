# CHANGE-189: Universal Reverse Engineering Anything (REA) Engine

**Change Reference**: `CHANGE-189`  
**Specification Reference**: `SPEC-327`  
**Scope**: `src/core/`, `bin/commands/`, `test/`, `docs/formal/`  
**Status**: PROPOSED  
**Author**: Valentin Florez Arbelaez  
**Date**: 2026-11-17

---

## 1. Intent & Purpose

This change introduces the sovereign **Universal Reverse Engineering Anything (REA) Engine** (`EosReverseEngineeringCore`), bringing enterprise-grade reverse-engineering orchestration to the Glorian System. Inspired by `morluto/rea`, it enables AI coding agents and human engineers to perform automated static inspection, format identification, archive extraction, AST deobfuscation, section entropy profiling, and Control-Flow Graph (CFG) recovery across web, managed, and native targets.

---

## 2. Delta Specification

### Added Capabilities:

- `src/core/eosReverseEngineeringEngine.types.ts`: Type definitions for target formats (`ASAR`, `JS_BUNDLE`, `WASM`, `PE_COFF`, `ELF`), recovered symbols, control-flow blocks, section entropy profiles, and audit receipts.
- `src/core/eosReverseEngineeringEngine.ts`: Core class `EosReverseEngineeringCore` implementing:
  - `detectTargetFormat(buffer)`: Magic byte inspection and structural heuristics.
  - `unpackAsar(buffer)`: Electron `.asar` header parser and file tree extractor.
  - `analyzeJsBundle(sourceCode)`: Minified JavaScript analysis, AST tokenization, module boundary discovery, and identifier frequency mapping.
  - `extractSymbols(buffer, format)`: Section header parsing and export/import symbol table recovery.
  - `computeSectionEntropy(buffer)`: Section-by-section Shannon entropy calculation ($H$) detecting packers and crypters.
  - `recoverControlFlowGraph(instructions)`: Disassembly instruction stream ingestion and basic block DAG synthesis.
  - `audit(syntheticPayloads)`: Full invariant verification emitting signed SHA-256 receipt.
- `docs/formal/ReverseEngineeringEngine.tla` & `.cfg`: Formal TLA+ Model 71 verified with Leslie Lamport's TLC.
- `bin/commands/cliReverseEngineeringEngine.mjs`: 5 new CLI commands under `toolchain:rea:`.
- `test/eosReverseEngineeringEngine.test.mjs`: BDD test suite covering scenarios `BDD-1737`..`BDD-1742`.
- Documentation in `docs/DEVELOPER_GUIDE.md` and registry parity in `cliHelpCatalog.mjs` (558 $\to$ 563 commands).

---

## 3. Impact Assessment

- **Direct Impact**: Equips Glorian with native reverse engineering intelligence without requiring external binary tools or network calls.
- **Breaking Changes**: None. Zero runtime dependencies.
- **Verification Gate**: 100% formal TLA+ model checked with TLC, 100% BDD tests passing, 100% CLI hygiene governed.

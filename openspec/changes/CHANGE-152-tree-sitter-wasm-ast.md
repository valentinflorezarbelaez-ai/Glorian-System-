# CHANGE-152: High-Speed AST Code Graph with Tree-sitter WebAssembly Engine

- **Change ID**: `CHANGE-152`
- **Spec ID**: `SPEC-290`
- **Domain**: Cloud Native Static Analysis / AST Code Graph (Phase 1.4)
- **Status**: `PROPOSED`
- **Lead Architect**: `user:valentin-florez-arbelaez`
- **Date**: 2026-11-15

---

## 1. Intent & Scope

Author and integrate `src/core/eosTreeSitterWasmEngine.ts` to provide ultra-fast polyglot AST parsing, incremental symbol diffing, and transitive blast radius calculation across TypeScript, JavaScript, Go, Rust, and Python codebases under Law V.

---

## 2. Deliverables

1. **Specification**: `openspec/specs/SPEC-290-TREE-SITTER-WASM-AST.md`
2. **Architecture Plan**: `docs/plans/PLAN-152-TREE-SITTER-WASM-AST.md`
3. **Task Checklist**: `docs/tasks/TASKS-152-TREE-SITTER-WASM-AST.md`
4. **Core Module**: `src/core/eosTreeSitterWasmEngine.ts`
5. **CLI Subcommands**:
   - `toolchain:ast:parse`: Parse source file into structured AST nodes.
   - `toolchain:ast:diff`: Incremental AST diff comparing symbol mutations.
   - `toolchain:ast:audit`: Full repository code graph inspection and receipt emission.
6. **BDD Test Suite**: `test/eosTreeSitterWasmEngine.test.mjs` validating BDD-1515..1520.
7. **Evidence Artifact**: `docs/evidence/AST_TREE_SITTER_RECEIPT.json`

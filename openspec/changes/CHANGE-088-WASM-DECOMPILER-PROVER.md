# CHANGE-088: Layer-0 WebAssembly Bytecode Decompiler & Formal Prover (SPEC-203)

- **Change ID**: `CHANGE-088`
- **Spec**: `SPEC-203`
- **Date**: 2026-11-10
- **Author**: Valentín Flórez Arbeláez
- **Status**: APPROVED

---

## Proposed Changes

1. **New Core Engine**:
   - `src/core/eosWasmBytecodeDecompilerProver.ts`:
     - Class `EosWasmBytecodeDecompilerProver`:
       - `parseModule(buffer: Uint8Array | Buffer): ParsedWasmModule`
       - `decompileToWat(moduleOrBuffer: ParsedWasmModule | Uint8Array | Buffer): string`
       - `proveModuleSafety(moduleOrBuffer: ParsedWasmModule | Uint8Array | Buffer): WasmFormalProofReport`
       - `disassembleFunction(code: Uint8Array): WasmInstruction[]`
       - `decodeLeb128Unsigned(bytes: Uint8Array, offset: number): { value: number; bytesRead: number }`
       - `decodeLeb128Signed(bytes: Uint8Array, offset: number): { value: number; bytesRead: number }`
2. **Package Exports**:
   - Add `"./wasm-prover": "./src/core/eosWasmBytecodeDecompilerProver.ts"` in `package.json`.
   - Export in `src/core/index.ts`.
3. **CLI Commands**:
   - `glorian wasm:decompile [file|preset] [--wat] [--json]`
   - `glorian wasm:prove [file|preset] [--json]`
   - Aliases: `glorian wasm:disasm`.
4. **MCP Actions**:
   - `action: "wasm_decompile"`
   - `action: "wasm_prove"`
5. **Testing**:
   - `test/eosWasmBytecodeDecompilerProver.test.mjs` (BDD-1034..BDD-1038).
   - Integration in `test/eosEnterpriseFacade.test.mjs` (step #15).

# PLAN-088: Layer-0 WebAssembly Bytecode Decompiler & Formal Prover (SPEC-203)

## Architectural Approach

1. **LEB128 & Stream Decoder**:
   - `decodeLeb128Unsigned(buffer, offset)`: decodes variable-length `u32` (7 bits per byte, MSB continuation).
   - `decodeLeb128Signed(buffer, offset)`: decodes variable-length `i32`/`i64` with sign bit extension.

2. **Section Parser Subsystem**:
   - Section ID mapping:
     - 0: Custom, 1: Type, 2: Import, 3: Function, 4: Table, 5: Memory, 6: Global, 7: Export, 8: Start, 9: Element, 10: Code, 11: Data.
   - Extracts function types `(params -> results)`, function-to-type signatures, export names, and raw function bodies.

3. **Disassembler Subsystem**:
   - Instruction decoders:
     - `0x00` (`unreachable`), `0x01` (`nop`), `0x02` (`block`), `0x03` (`loop`), `0x04` (`if`), `0x0B` (`end`), `0x0C` (`br`), `0x0D` (`br_if`), `0x0F` (`return`)
     - `0x10` (`call`), `0x20` (`local.get`), `0x21` (`local.set`), `0x22` (`local.tee`), `0x23` (`global.get`), `0x24` (`global.set`)
     - `0x28` (`i32.load`), `0x36` (`i32.store`)
     - `0x41` (`i32.const`), `0x42` (`i64.const`), `0x43` (`f32.const`), `0x44` (`f64.const`)
     - `0x45` (`i32.eqz`), `0x6A` (`i32.add`), `0x6B` (`i32.sub`), `0x6C` (`i32.mul`), `0x6D` (`i32.div_s`), `0x6E` (`i32.div_u`)

4. **WAT Printer Subsystem**:
   - Converts parsed module, types, exports, and instructions into standard indented S-expression text:
     ```wat
     (module
       (func $func_0 (export "add") (param i32 i32) (result i32)
         local.get 0
         local.get 1
         i32.add
       )
     )
     ```

5. **Formal Verification Subsystem**:
   - Stack Simulation: computes $\Delta\text{stack}$ per instruction. Asserts $\text{currentDepth} - \text{popCount} \ge 0$.
   - Control-Flow Integrity: checks block nesting depth and ensures branch label index $\le \text{currentNestingLevel}$.
   - Memory Bounds: verifies memory accesses are guarded and within configured memory limits.
   - Purity Classification: pure if no `i32.store`, no `call` to imports, no global mutation.

6. **Integrations**:
   - Export `"./wasm-prover"` in `package.json`, re-export in `src/core/index.ts`.
   - CLI commands `wasm:decompile` and `wasm:prove` in `bin/commands/cliPlatform.mjs` & help in `bin/commands/cliKernel.mjs`.
   - MCP actions `wasm_decompile` and `wasm_prove` in `src/mcp/tools/eosMcpPhase7VerificationHandlers.ts`.
   - Test suite `test/eosWasmBytecodeDecompilerProver.test.mjs` (BDD-1034..BDD-1038).
   - Step 15 in `test/eosEnterpriseFacade.test.mjs`.

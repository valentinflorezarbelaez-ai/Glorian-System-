# PLAN-209: Autonomous Dynamic WebAssembly JIT Compiler & Zero-Dependency Binary Synthesizer (`SPEC-347`)

- **Change ID**: `CHANGE-209`
- **Spec ID**: `SPEC-347`
- **Status**: `PLAN_APPROVED`
- **Architect**: Valentín Flórez Arbeláez (Principal Architect & System Owner)

---

## 1. Architectural Strategy & ADRs

### ADR-209-001: Pure Layer-0 Direct Binary WASM Encoding vs External Native Compilers

- **Context**: Autonomous agents require native execution speed for mathematical kernels, vector similarity, and checksums. Standard approaches rely on LLVM, Clang, Rustc, or Emscripten, which introduce heavy external dependencies, large binary footprint (>100MB), and slow disk compilation phases.
- **Decision**: Synthesize WebAssembly binary bytecode directly into memory (`Uint8Array`) using pure TypeScript primitives. Directly encode standard WASM sections (Type, Function, Export, Memory, Code) and variable-length integer encoding (LEB128).
- **Alternatives Rejected**:
  - `wabt` / `binaryen` npm packages: Rejected due to Layer-0 zero external dependency mandate (`dependencies: {}`).
  - Native Rust / C FFI: Rejected due to platform-specific compilation hurdles and non-sovereignty across edge/browser/container runtimes.
- **Consequences**: Instantaneous in-memory compilation (< 1ms), 100% portable across Node.js/V8/Edge/Browser, zero external dependencies.

### ADR-209-002: Stack-Safe AST Bytecode Generator with WebAssembly.validate() Barrier

- **Context**: Malformed bytecode can crash or destabilize the runtime environment.
- **Decision**: Every synthesized instruction stream must maintain a formal stack delta tracker ($S \ge 0$). Before instantiation, the raw buffer is verified with native `WebAssembly.validate(buffer)`. If validation fails, execution aborts fail-closed with `WASM_JIT_VALIDATION_FAILED`.
- **Consequences**: Eliminates bytecode crashes and guarantees type/stack safety.

---

## 2. Component Design & Interfaces

- `src/core/eosAutonomousWasmJit.types.ts`:
  - `WasmValType`: `0x7f` (`i32`), `0x7e` (`i64`), `0x7d` (`f32`), `0x7c` (`f64`)
  - `WasmSectionId`: `1` (Type), `3` (Function), `5` (Memory), `7` (Export), `10` (Code)
  - `FunctionSignature`: `params: WasmValType[]`, `results: WasmValType[]`
  - `SynthesizedFunction`: `name: string`, `signature: FunctionSignature`, `locals: WasmValType[]`, `body: Uint8Array`
  - `WasmKernelModule`: `buffer: Uint8Array`, `instance: WebAssembly.Instance`, `exports: Record<string, Function>`
  - `ArithmeticNode`: `type: 'CONST' | 'PARAM' | 'ADD' | 'SUB' | 'MUL' | 'DIV' | 'XOR'`, `value?: number`, `paramIndex?: number`, `left?: ArithmeticNode`, `right?: ArithmeticNode`
  - `WasmJitBenchmarkResult`: `kernelName: string`, `operations: number`, `elapsedMs: number`, `opsPerSecond: number`
  - `WasmJitAuditReceipt`: `spec: string`, `timestamp: string`, `validModuleEmitted: boolean`, `kernelsVerified: boolean`, `benchmarkOpsPerSec: number`, `allPassed: boolean`, `sha256: string`

- `src/core/eosAutonomousWasmJit.ts`:
  - `encodeUnsignedLeb128(value: number): number[]`
  - `encodeSignedLeb128(value: number): number[]`
  - `emitWasmModule(functions: SynthesizedFunction[], memoryPages?: number): Uint8Array`
  - `compileSimpleMath(a: number, b: number): WasmKernelModule`
  - `compileVectorDotProduct(): WasmKernelModule`
  - `compileFastCrc32(): WasmKernelModule`
  - `compileExpressionAST(ast: ArithmeticNode, paramCount: number): WasmKernelModule`
  - `benchmarkKernel(fn: Function, iterations?: number): WasmJitBenchmarkResult`
  - `auditAutonomousWasmJit(root?: string): WasmJitAuditReceipt`

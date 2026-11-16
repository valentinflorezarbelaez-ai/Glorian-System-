# PLAN-168: Architecture Decision Record (ADR-168) — Pure WebAssembly Binary Synthesis & Linear Memory Isolation Engine

## 1. Architectural Context

Glorian System requires executing verified computational routines (cryptographic field operations, neural vector similarities, integrity checksums) with absolute memory isolation and sub-microsecond predictability. While V8 JIT provides high average throughput, it suffers from dynamic deoptimization deopt-loops and garbage collector pause cycles. Standard WebAssembly workflows require an external toolchain (`rustc`, `clang`, `wat2wasm`), which contradicts Glorian's sovereign Law V (Zero external dependencies).

## 2. Decision: Direct Runtime WASM Binary Encoding

We implement a zero-dependency byte emitter in pure TypeScript:

1. **Binary Encoding Pipeline**:
   - `EosWasmBytecodeSynthesizerCore` provides low-level primitive encoders:
     - `writeUleb128(val)`
     - `writeSleb128(val)`
     - `writeSection(sectionId, payload)`
     - `writeTypeSection(types)`
     - `writeFunctionSection(typeIndices)`
     - `writeMemorySection(minPages, maxPages)`
     - `writeExportSection(exports)`
     - `writeCodeSection(bodies)`
2. **Opcode Matrix Support**:
   - Control Flow: `unreachable (0x00)`, `nop (0x01)`, `block (0x02)`, `loop (0x03)`, `if (0x04)`, `else (0x05)`, `end (0x0B)`, `br (0x0C)`, `br_if (0x0D)`, `return (0x0F)`, `call (0x10)`.
   - Variables: `local.get (0x20)`, `local.set (0x21)`, `local.tee (0x22)`, `global.get (0x23)`, `global.set (0x24)`.
   - Memory: `i32.load (0x28)`, `i32.store (0x36)`, `memory.size (0x3F)`, `memory.grow (0x40)`.
   - Constants & Numeric: `i32.const (0x41)`, `i64.const (0x42)`, `i32.eqz (0x45)`, `i32.eq (0x46)`, `i32.ne (0x47)`, `i32.lt_s (0x48)`, `i32.lt_u (0x49)`, `i32.gt_s (0x4A)`, `i32.gt_u (0x4B)`, `i32.le_s (0x4C)`, `i32.le_u (0x4D)`, `i32.ge_s (0x4E)`, `i32.ge_u (0x4F)`, `i32.add (0x6A)`, `i32.sub (0x6B)`, `i32.mul (0x6C)`, `i32.div_s (0x6D)`, `i32.div_u (0x6E)`, `i32.rem_s (0x6F)`, `i32.rem_u (0x70)`, `i32.and (0x71)`, `i32.or (0x72)`, `i32.xor (0x73)`, `i32.shl (0x74)`, `i32.shr_s (0x75)`, `i32.shr_u (0x76)`.
3. **Built-in Synthetic Kernel Generators**:
   - `buildAddKernel()`: Minimal binary module exporting `add(a: i32, b: i32): i32`.
   - `buildFactorialKernel()`: Iterative loop module computing $N!$ with `loop`, `local.get`, `i32.mul`, `br_if`.
   - `buildLinearVectorDotProductKernel()`: Memory-backed module reading vectors from `WebAssembly.Memory` and computing $\sum A[i] \times B[i]$.
   - `buildModularExpKernel()`: Fast binary modular exponentiation $(b^e \pmod m)$.

## 3. Rejected Alternatives

- **Alternative A: Shell out to `wat2wasm` or `emcc`**:
  - _Rejected_: Violates Law V. Requires installed host tools, platform-specific binaries, breaks hermetic CI/CD.
- **Alternative B: Use `@webassemblyjs/wasm-parser` or `binaryen` npm package**:
  - _Rejected_: Violates zero third-party dependencies rule in `package.json`.
- **Alternative C: Keep all algorithms in pure JavaScript**:
  - _Rejected_: Subject to JIT bailout, unconstrained heap memory mutations, lack of hardware trap isolation for pointer violations.

## 4. Consequences & Guarantees

- Pure TypeScript implementation with zero external dependencies.
- Hardware-enforced execution safety with memory bounds checking.
- Line limit strictly enforced ($\le 800$ lines, headroom $\ge 12$).

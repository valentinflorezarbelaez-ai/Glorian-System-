/**
 * Glorian System — Autonomous Dynamic WebAssembly JIT Compiler Types
 * Governed by SPEC-347 / CHANGE-209
 *
 * Invariant: Pure Layer-0 types with zero external dependencies.
 */

export const WASM_TYPE_I32 = 0x7f;
export const WASM_TYPE_I64 = 0x7e;
export const WASM_TYPE_F32 = 0x7d;
export const WASM_TYPE_F64 = 0x7c;

export type WasmValType = typeof WASM_TYPE_I32 | typeof WASM_TYPE_I64 | typeof WASM_TYPE_F32 | typeof WASM_TYPE_F64;

export const WASM_SECTION_TYPE = 1;
export const WASM_SECTION_FUNCTION = 3;
export const WASM_SECTION_MEMORY = 5;
export const WASM_SECTION_EXPORT = 7;
export const WASM_SECTION_CODE = 10;

export type WasmSectionId =
  | typeof WASM_SECTION_TYPE
  | typeof WASM_SECTION_FUNCTION
  | typeof WASM_SECTION_MEMORY
  | typeof WASM_SECTION_EXPORT
  | typeof WASM_SECTION_CODE;

export interface FunctionSignature {
  params: WasmValType[];
  results: WasmValType[];
}

export interface SynthesizedFunction {
  name: string;
  signature: FunctionSignature;
  locals?: WasmValType[];
  body: Uint8Array | number[];
}

export interface WasmKernelModule {
  buffer: Uint8Array;
  instance: WebAssembly.Instance;
  exports: Record<string, any>;
}

export type ArithmeticOp = "ADD" | "SUB" | "MUL" | "DIV" | "XOR";

export interface ArithmeticNode {
  type: "CONST" | "PARAM" | "BINARY_OP";
  value?: number;
  paramIndex?: number;
  op?: ArithmeticOp;
  left?: ArithmeticNode;
  right?: ArithmeticNode;
}

export interface WasmJitBenchmarkResult {
  kernelName: string;
  operations: number;
  elapsedMs: number;
  opsPerSecond: number;
}

export interface WasmJitAuditReceipt {
  spec: string;
  timestamp: string;
  validModuleEmitted: boolean;
  kernelsVerified: boolean;
  benchmarkOpsPerSec: number;
  allPassed: boolean;
  sha256: string;
}

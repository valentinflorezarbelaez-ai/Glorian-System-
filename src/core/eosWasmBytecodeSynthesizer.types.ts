/**
 * GLORIAN SYSTEM — WEB ASSEMBLY BYTECODE SYNTHESIZER TYPES & PRIMITIVES
 *
 * Formal contracts, standard section IDs, opcode enumerations, and LEB128 codecs
 * for deterministic pure binary WebAssembly module synthesis and execution.
 *
 * Governed by SPEC-306 (FR-306-01..FR-306-06, BDD-1611..BDD-1616).
 * Strict Law V: Zero third-party runtime dependencies.
 */

import { assertPrecondition } from "./eosKernelPrimitives.ts";

export type WasmSynthValueType = "i32" | "i64" | "f32" | "f64";

export interface WasmSynthFunctionSignature {
  readonly params: readonly WasmSynthValueType[];
  readonly returns: readonly WasmSynthValueType[];
}

export interface WasmExportDefinition {
  readonly name: string;
  readonly kind: "func" | "memory" | "global" | "table";
  readonly index: number;
}

export interface WasmMemoryDefinition {
  readonly minPages: number;
  readonly maxPages?: number;
}

export interface WasmSynthesizedModule {
  readonly bytecode: Uint8Array;
  readonly sha256: string;
  readonly totalBytes: number;
  readonly exportedNames: readonly string[];
  readonly memoryDeclared: boolean;
}

export interface WasmExecutionResult<T = unknown> {
  readonly status: "SUCCESS" | "RUNTIME_TRAP" | "VALIDATION_FAILED";
  readonly returnedValue?: T;
  readonly executionTimeNs: bigint;
  readonly executionTimeUs: number;
  readonly trapMessage?: string;
}

export interface WasmBenchmarkStats {
  readonly operationsCount: number;
  readonly wasmTotalNs: bigint;
  readonly wasmAvgNsPerOp: number;
  readonly jsTotalNs: bigint;
  readonly jsAvgNsPerOp: number;
  readonly speedupRatio: number;
}

export interface WasmSynthesizerAuditReceipt {
  readonly receiptType: "EOS_WASM_SYNTHESIZER_AUDIT";
  readonly timestampIso: string;
  readonly specRef: "SPEC-306";
  readonly validWasmMagicVerified: boolean;
  readonly leb128FidelityVerified: boolean;
  readonly arithmeticKernelVerified: boolean;
  readonly loopFactorialKernelVerified: boolean;
  readonly linearMemoryTrapCaught: boolean;
  readonly vectorDotProductVerified: boolean;
  readonly benchmarkSpeedupRatio: number;
  readonly modulesEvaluated: number;
  readonly sha256Signature: string;
}

/**
 * Standard W3C WebAssembly section identifier constants.
 */
export const WASM_SECTION = Object.freeze({
  CUSTOM: 0,
  TYPE: 1,
  IMPORT: 2,
  FUNCTION: 3,
  TABLE: 4,
  MEMORY: 5,
  GLOBAL: 6,
  EXPORT: 7,
  START: 8,
  ELEMENT: 9,
  CODE: 10,
  DATA: 11,
} as const);

/**
 * Common WebAssembly binary opcode constants.
 */
export const WASM_OP = Object.freeze({
  UNREACHABLE: 0x00,
  NOP: 0x01,
  BLOCK: 0x02,
  LOOP: 0x03,
  IF: 0x04,
  ELSE: 0x05,
  END: 0x0b,
  BR: 0x0c,
  BR_IF: 0x0d,
  RETURN: 0x0f,
  CALL: 0x10,
  LOCAL_GET: 0x20,
  LOCAL_SET: 0x21,
  LOCAL_TEE: 0x22,
  I32_LOAD: 0x28,
  I32_LOAD8_U: 0x2d,
  I32_STORE: 0x36,
  I32_STORE8: 0x3a,
  MEMORY_SIZE: 0x3f,
  MEMORY_GROW: 0x40,
  I32_CONST: 0x41,
  I64_CONST: 0x42,
  I32_EQZ: 0x45,
  I32_EQ: 0x46,
  I32_NE: 0x47,
  I32_LT_S: 0x48,
  I32_LT_U: 0x49,
  I32_GT_S: 0x4a,
  I32_GT_U: 0x4b,
  I32_LE_S: 0x4c,
  I32_LE_U: 0x4d,
  I32_GE_S: 0x4e,
  I32_GE_U: 0x4f,
  I32_ADD: 0x6a,
  I32_SUB: 0x6b,
  I32_MUL: 0x6c,
  I32_DIV_S: 0x6d,
  I32_DIV_U: 0x6e,
  I32_REM_S: 0x6f,
  I32_REM_U: 0x70,
  I32_AND: 0x71,
  I32_OR: 0x72,
  I32_XOR: 0x73,
  I32_SHL: 0x74,
  I32_SHR_S: 0x75,
  I32_SHR_U: 0x76,
} as const);

export const WASM_TYPE_BYTE: Readonly<Record<WasmSynthValueType, number>> = Object.freeze({
  i32: 0x7f,
  i64: 0x7e,
  f32: 0x7d,
  f64: 0x7c,
});

/**
 * Encodes an unsigned integer as variable-length LEB128 bytes.
 */
export function encodeUleb128(value: number): number[] {
  assertPrecondition(value >= 0, "ULEB128 requires non-negative integer");
  const bytes: number[] = [];
  let v = Math.floor(value);
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v !== 0) {
      byte |= 0x80;
    }
    bytes.push(byte);
  } while (v !== 0);
  return bytes;
}

/**
 * Decodes an unsigned LEB128 byte stream at the specified offset.
 */
export function decodeUleb128(bytes: Uint8Array | number[], offset = 0): { value: number; bytesRead: number } {
  let result = 0;
  let shift = 0;
  let currentOffset = offset;
  while (currentOffset < bytes.length) {
    const byte = bytes[currentOffset++];
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return { value: result, bytesRead: currentOffset - offset };
}

/**
 * Encodes a signed integer as variable-length LEB128 bytes.
 */
export function encodeSleb128(value: number): number[] {
  const bytes: number[] = [];
  let v = Math.floor(value);
  let more = true;
  while (more) {
    let byte = v & 0x7f;
    v >>= 7;
    const signBit = (byte & 0x40) !== 0;
    if ((v === 0 && !signBit) || (v === -1 && signBit)) {
      more = false;
    } else {
      byte |= 0x80;
    }
    bytes.push(byte);
  }
  return bytes;
}

/**
 * Decodes a signed LEB128 byte stream at the specified offset.
 */
export function decodeSleb128(bytes: Uint8Array | number[], offset = 0): { value: number; bytesRead: number } {
  let result = 0;
  let shift = 0;
  let currentOffset = offset;
  let byte = 0;
  while (currentOffset < bytes.length) {
    byte = bytes[currentOffset++];
    result |= (byte & 0x7f) << shift;
    shift += 7;
    if ((byte & 0x80) === 0) break;
  }
  if (shift < 32 && (byte & 0x40) !== 0) {
    result |= ~0 << shift;
  }
  return { value: result, bytesRead: currentOffset - offset };
}

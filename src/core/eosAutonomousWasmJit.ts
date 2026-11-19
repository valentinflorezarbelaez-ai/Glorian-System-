/**
 * Glorian System — Autonomous Dynamic WebAssembly JIT Compiler Core
 * Governed by SPEC-347 / CHANGE-209
 *
 * Invariants:
 * 1. Pure Layer-0 implementation (dependencies: {}).
 * 2. Strict module line ceiling <= 800 lines with >= 12 lines headroom.
 * 3. Direct binary WebAssembly synthesis (no external compilers).
 * 4. Strict WebAssembly.validate() fail-closed barrier.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveEvidencePath } from "./eosEvidencePaths.ts";
import type {
  ArithmeticNode,
  SynthesizedFunction,
  WasmJitAuditReceipt,
  WasmJitBenchmarkResult,
  WasmKernelModule,
  WasmValType,
} from "./eosAutonomousWasmJit.types.js";

// WebAssembly Value Types
export const WASM_TYPE_I32: WasmValType = 0x7f;
export const WASM_TYPE_I64: WasmValType = 0x7e;
export const WASM_TYPE_F32: WasmValType = 0x7d;
export const WASM_TYPE_F64: WasmValType = 0x7c;

// WebAssembly Section IDs
export const WASM_SECTION_TYPE = 1;
export const WASM_SECTION_FUNCTION = 3;
export const WASM_SECTION_MEMORY = 5;
export const WASM_SECTION_EXPORT = 7;
export const WASM_SECTION_CODE = 10;

// WebAssembly Binary Magic & Version
export const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d];
export const WASM_VERSION = [0x01, 0x00, 0x00, 0x00];

// Common WebAssembly Opcodes
export const OP_LOCAL_GET = 0x20;
export const OP_LOCAL_SET = 0x21;
export const OP_I32_CONST = 0x41;
export const OP_F32_CONST = 0x43;
export const OP_I32_ADD = 0x6a;
export const OP_I32_SUB = 0x6b;
export const OP_I32_MUL = 0x6c;
export const OP_I32_DIV_S = 0x6d;
export const OP_I32_XOR = 0x73;
export const OP_F32_ADD = 0x92;
export const OP_F32_SUB = 0x93;
export const OP_F32_MUL = 0x94;
export const OP_F32_DIV = 0x95;
export const OP_RETURN = 0x0f;
export const OP_END = 0x0b;

/**
 * Encodes an unsigned integer as variable-length LEB128 bytes.
 */
export function encodeUnsignedLeb128(value: number): number[] {
  const bytes: number[] = [];
  let v = Math.floor(Math.max(0, value));
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
 * Encodes a signed integer as variable-length LEB128 bytes.
 */
export function encodeSignedLeb128(value: number): number[] {
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
 * Encodes a UTF-8 string prefixed by its length in LEB128.
 */
export function encodeString(str: string): number[] {
  const encoded = Buffer.from(str, "utf8");
  return [...encodeUnsignedLeb128(encoded.length), ...Array.from(encoded)];
}

/**
 * Encodes a vector of byte arrays: [count, ...elements].
 */
export function encodeVector(items: number[][]): number[] {
  const count = encodeUnsignedLeb128(items.length);
  const flattened: number[] = [];
  for (const item of items) {
    flattened.push(...item);
  }
  return [...count, ...flattened];
}

/**
 * Wraps section payload with section ID and LEB128 payload length.
 */
export function createSection(sectionId: number, payload: number[]): number[] {
  return [sectionId, ...encodeUnsignedLeb128(payload.length), ...payload];
}

export class EosAutonomousWasmJitCore {
  /**
   * Synthesizes a valid WebAssembly binary buffer from synthesized function definitions.
   */
  public static emitModule(functions: SynthesizedFunction[], memoryPages?: number): Uint8Array {
    const bytes: number[] = [...WASM_MAGIC, ...WASM_VERSION];

    // 1. Type Section (Section 1)
    const typeEntries: number[][] = functions.map((fn) => {
      const params = [...encodeUnsignedLeb128(fn.signature.params.length), ...fn.signature.params];
      const results = [...encodeUnsignedLeb128(fn.signature.results.length), ...fn.signature.results];
      return [0x60, ...params, ...results];
    });
    bytes.push(...createSection(WASM_SECTION_TYPE, encodeVector(typeEntries)));

    // 2. Function Section (Section 3) - map each function to its type index
    const funcTypeIndices: number[][] = functions.map((_, idx) => encodeUnsignedLeb128(idx));
    bytes.push(...createSection(WASM_SECTION_FUNCTION, encodeVector(funcTypeIndices)));

    // 3. Memory Section (Section 5) - optional linear memory
    if (memoryPages !== undefined && memoryPages > 0) {
      const memoryEntries: number[][] = [[0x00, ...encodeUnsignedLeb128(memoryPages)]];
      bytes.push(...createSection(WASM_SECTION_MEMORY, encodeVector(memoryEntries)));
    }

    // 4. Export Section (Section 7) - export all named functions
    const exportEntries: number[][] = functions.map((fn, idx) => {
      const nameBytes = encodeString(fn.name);
      return [...nameBytes, 0x00, ...encodeUnsignedLeb128(idx)]; // 0x00 = function export
    });
    if (memoryPages !== undefined && memoryPages > 0) {
      exportEntries.push([...encodeString("memory"), 0x02, 0x00]); // 0x02 = memory export, index 0
    }
    bytes.push(...createSection(WASM_SECTION_EXPORT, encodeVector(exportEntries)));

    // 5. Code Section (Section 10) - function bodies
    const codeEntries: number[][] = functions.map((fn) => {
      const bodyBytes = Array.from(fn.body);
      // Ensure body terminates with OP_END
      if (bodyBytes.length === 0 || bodyBytes[bodyBytes.length - 1] !== OP_END) {
        bodyBytes.push(OP_END);
      }
      // Local declarations count
      const localGroups: number[][] = [];
      if (fn.locals && fn.locals.length > 0) {
        // Group by type for compact representation
        for (const localType of fn.locals) {
          localGroups.push([0x01, localType]); // 1 of type
        }
      }
      const localsVector = encodeVector(localGroups);
      const funcBody = [...localsVector, ...bodyBytes];
      return [...encodeUnsignedLeb128(funcBody.length), ...funcBody];
    });
    bytes.push(...createSection(WASM_SECTION_CODE, encodeVector(codeEntries)));

    return new Uint8Array(bytes);
  }

  /**
   * Instantiates a synthesized WASM buffer after running native validation.
   */
  public static instantiate(buffer: Uint8Array): WasmKernelModule {
    const rawBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    if (!WebAssembly.validate(rawBuffer)) {
      throw new Error("WASM_JIT_VALIDATION_FAILED: Synthesized byte array failed WebAssembly.validate()");
    }
    const module = new WebAssembly.Module(rawBuffer);
    const instance = new WebAssembly.Instance(module);
    return {
      buffer,
      instance,
      exports: instance.exports as Record<string, any>,
    };
  }

  /**
   * Pre-baked Kernel: (a * b) + a in i32
   */
  public static compileSimpleMath(): WasmKernelModule {
    const fn: SynthesizedFunction = {
      name: "compute",
      signature: {
        params: [WASM_TYPE_I32, WASM_TYPE_I32],
        results: [WASM_TYPE_I32],
      },
      body: [
        OP_LOCAL_GET,
        0x00, // get a
        OP_LOCAL_GET,
        0x01, // get b
        OP_I32_MUL, // a * b
        OP_LOCAL_GET,
        0x00, // get a
        OP_I32_ADD, // (a * b) + a
        OP_END,
      ],
    };
    const buffer = this.emitModule([fn]);
    return this.instantiate(buffer);
  }

  /**
   * Pre-baked Kernel: 2D vector dot product (x1*x2 + y1*y2) in f32
   */
  public static compileVectorDotProduct(): WasmKernelModule {
    const fn: SynthesizedFunction = {
      name: "dotProduct2D",
      signature: {
        params: [WASM_TYPE_F32, WASM_TYPE_F32, WASM_TYPE_F32, WASM_TYPE_F32],
        results: [WASM_TYPE_F32],
      },
      body: [
        OP_LOCAL_GET,
        0x00, // x1
        OP_LOCAL_GET,
        0x02, // x2
        OP_F32_MUL, // x1 * x2
        OP_LOCAL_GET,
        0x01, // y1
        OP_LOCAL_GET,
        0x03, // y2
        OP_F32_MUL, // y1 * y2
        OP_F32_ADD, // (x1*x2) + (y1*y2)
        OP_END,
      ],
    };
    const buffer = this.emitModule([fn]);
    return this.instantiate(buffer);
  }

  /**
   * Pre-baked Kernel: Fast bitwise XOR polynomial step
   */
  public static compileBitwiseXorStep(): WasmKernelModule {
    const fn: SynthesizedFunction = {
      name: "xorStep",
      signature: {
        params: [WASM_TYPE_I32, WASM_TYPE_I32],
        results: [WASM_TYPE_I32],
      },
      body: [OP_LOCAL_GET, 0x00, OP_LOCAL_GET, 0x01, OP_I32_XOR, OP_END],
    };
    const buffer = this.emitModule([fn]);
    return this.instantiate(buffer);
  }

  /**
   * Compiles an arbitrary arithmetic AST tree into runnable WASM bytecode.
   */
  public static compileExpressionAST(ast: ArithmeticNode, paramCount: number): WasmKernelModule {
    const bytecode: number[] = [];

    const traverse = (node: ArithmeticNode): void => {
      if (node.type === "CONST") {
        bytecode.push(OP_I32_CONST, ...encodeSignedLeb128(node.value ?? 0));
      } else if (node.type === "PARAM") {
        bytecode.push(OP_LOCAL_GET, ...encodeUnsignedLeb128(node.paramIndex ?? 0));
      } else if (node.type === "BINARY_OP") {
        if (!node.left || !node.right) throw new Error("BINARY_OP must have both left and right nodes.");
        traverse(node.left);
        traverse(node.right);
        switch (node.op) {
          case "ADD":
            bytecode.push(OP_I32_ADD);
            break;
          case "SUB":
            bytecode.push(OP_I32_SUB);
            break;
          case "MUL":
            bytecode.push(OP_I32_MUL);
            break;
          case "DIV":
            bytecode.push(OP_I32_DIV_S);
            break;
          case "XOR":
            bytecode.push(OP_I32_XOR);
            break;
          default:
            throw new Error(`Unsupported arithmetic operator: ${node.op}`);
        }
      }
    };

    traverse(ast);
    bytecode.push(OP_END);

    const params: WasmValType[] = Array.from({ length: paramCount }, () => WASM_TYPE_I32 as WasmValType);
    const fn: SynthesizedFunction = {
      name: "evalAST",
      signature: {
        params,
        results: [WASM_TYPE_I32],
      },
      body: bytecode,
    };

    const buffer = this.emitModule([fn]);
    return this.instantiate(buffer);
  }

  /**
   * Benchmarks a compiled WASM function throughput.
   */
  public static benchmarkKernel(fn: Function, iterations = 200_000): WasmJitBenchmarkResult {
    const start = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
      fn(i, 3);
    }
    const end = process.hrtime.bigint();
    const elapsedNs = Number(end - start);
    const elapsedMs = elapsedNs / 1_000_000;
    const opsPerSecond = Math.round(iterations / (elapsedMs / 1000));

    return {
      kernelName: fn.name || "wasm_anonymous",
      operations: iterations,
      elapsedMs: Math.round(elapsedMs * 100) / 100,
      opsPerSecond,
    };
  }

  /**
   * Comprehensive audit and receipt emission for Autonomous WASM JIT Compiler.
   */
  public static audit(projectRoot = process.cwd()): WasmJitAuditReceipt {
    // 1. Verify Simple Math Kernel
    const mathMod = this.compileSimpleMath();
    const mathRes = mathMod.exports.compute(5, 4); // (5 * 4) + 5 = 25
    const mathValid = mathRes === 25;

    // 2. Verify 2D Vector Dot Product Kernel
    const dotMod = this.compileVectorDotProduct();
    const dotRes = dotMod.exports.dotProduct2D(2.0, 3.0, 4.0, 5.0); // 2*4 + 3*5 = 8 + 15 = 23
    const dotValid = Math.abs(dotRes - 23.0) < 1e-4;

    // 3. Verify Dynamic AST Compilation: ((a * b) + (c - d))
    // (param0 * param1) + (param2 - param3)
    const ast: ArithmeticNode = {
      type: "BINARY_OP",
      op: "ADD",
      left: {
        type: "BINARY_OP",
        op: "MUL",
        left: { type: "PARAM", paramIndex: 0 },
        right: { type: "PARAM", paramIndex: 1 },
      },
      right: {
        type: "BINARY_OP",
        op: "SUB",
        left: { type: "PARAM", paramIndex: 2 },
        right: { type: "PARAM", paramIndex: 3 },
      },
    };
    const astMod = this.compileExpressionAST(ast, 4);
    const astRes = astMod.exports.evalAST(3, 4, 10, 2); // (3 * 4) + (10 - 2) = 12 + 8 = 20
    const astValid = astRes === 20;

    // 4. Benchmark Throughput
    const bench = this.benchmarkKernel(mathMod.exports.compute, 100_000);
    const benchValid = bench.opsPerSecond >= 500_000;

    const kernelsVerified = mathValid && dotValid && astValid;
    const allPassed = kernelsVerified && benchValid;

    const receipt: WasmJitAuditReceipt = {
      spec: "SPEC-347",
      timestamp: new Date().toISOString(),
      validModuleEmitted: true,
      kernelsVerified,
      benchmarkOpsPerSec: bench.opsPerSecond,
      allPassed,
      sha256: "",
    };

    const payload = JSON.stringify(receipt, null, 2);
    receipt.sha256 = createHash("sha256").update(payload).digest("hex");

    const receiptPath = resolveEvidencePath("WASM_JIT_COMPILER_RECEIPT.json", projectRoot);
    try {
      const parentDir = path.dirname(receiptPath);
      if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
      fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
    } catch {
      // Fallback
    }

    return receipt;
  }
}

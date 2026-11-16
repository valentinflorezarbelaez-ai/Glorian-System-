/**
 * GLORIAN SYSTEM — WEB ASSEMBLY BYTECODE SYNTHESIZER CORE
 *
 * Deterministic low-level binary WebAssembly (v1.0) bytecode synthesizer,
 * hardware-enforced linear memory sandbox, and cryptographic execution verifier.
 *
 * Governed by SPEC-306 (FR-306-01..FR-306-06, BDD-1611..BDD-1616).
 * Strict Law V: Zero third-party runtime dependencies. Pure TypeScript.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { pureSha256, deepFreeze, assertPrecondition } from "./eosKernelPrimitives.ts";
import {
  WASM_SECTION,
  WASM_OP,
  WASM_TYPE_BYTE,
  encodeUleb128,
  decodeUleb128,
  encodeSleb128,
  decodeSleb128,
  type WasmSynthesizedModule,
  type WasmExecutionResult,
  type WasmBenchmarkStats,
  type WasmSynthesizerAuditReceipt,
} from "./eosWasmBytecodeSynthesizer.types.ts";

export { WASM_SECTION, WASM_OP, WASM_TYPE_BYTE, encodeUleb128, decodeUleb128, encodeSleb128, decodeSleb128 };

/**
 * Core WebAssembly Bytecode Synthesizer and Sandboxed Virtual Machine.
 */
export class EosWasmBytecodeSynthesizerCore {
  private static readonly WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d];
  private static readonly WASM_VERSION = [0x01, 0x00, 0x00, 0x00];

  public static makeSection(sectionId: number, payload: number[]): number[] {
    const lenBytes = encodeUleb128(payload.length);
    return [sectionId, ...lenBytes, ...payload];
  }

  public static makeVector(entries: number[][]): number[] {
    const countBytes = encodeUleb128(entries.length);
    const flattened = entries.flat();
    return [...countBytes, ...flattened];
  }

  /**
   * Synthesizes a minimal binary module exporting `add(a: i32, b: i32): i32`.
   */
  public static buildAddModule(): WasmSynthesizedModule {
    // 1. Type Section: (i32, i32) -> i32
    const typeEntry = [
      0x60,
      ...encodeUleb128(2),
      WASM_TYPE_BYTE.i32,
      WASM_TYPE_BYTE.i32,
      ...encodeUleb128(1),
      WASM_TYPE_BYTE.i32,
    ];
    const typeSection = this.makeSection(WASM_SECTION.TYPE, this.makeVector([typeEntry]));

    // 2. Function Section: func index 0 uses type index 0
    const funcSection = this.makeSection(WASM_SECTION.FUNCTION, this.makeVector([[0]]));

    // 3. Export Section: "add" -> func 0
    const nameBytes = Array.from(Buffer.from("add", "utf8"));
    const exportEntry = [...encodeUleb128(nameBytes.length), ...nameBytes, 0x00, 0x00];
    const exportSection = this.makeSection(WASM_SECTION.EXPORT, this.makeVector([exportEntry]));

    // 4. Code Section: local.get 0, local.get 1, i32.add, end
    const bodyInstructions = [
      WASM_OP.LOCAL_GET,
      ...encodeUleb128(0),
      WASM_OP.LOCAL_GET,
      ...encodeUleb128(1),
      WASM_OP.I32_ADD,
      WASM_OP.END,
    ];
    const localsCount = encodeUleb128(0);
    const fullBody = [...localsCount, ...bodyInstructions];
    const codeEntry = [...encodeUleb128(fullBody.length), ...fullBody];
    const codeSection = this.makeSection(WASM_SECTION.CODE, this.makeVector([codeEntry]));

    const bytecode = new Uint8Array([
      ...this.WASM_MAGIC,
      ...this.WASM_VERSION,
      ...typeSection,
      ...funcSection,
      ...exportSection,
      ...codeSection,
    ]);

    const sha256 = createHash("sha256").update(bytecode).digest("hex");

    return deepFreeze({
      bytecode,
      sha256,
      totalBytes: bytecode.length,
      exportedNames: ["add"],
      memoryDeclared: false,
    });
  }

  /**
   * Synthesizes an iterative loop module computing `factorial(n: i32): i32`.
   */
  public static buildFactorialModule(): WasmSynthesizedModule {
    // Type Section: (i32) -> i32
    const typeEntry = [0x60, ...encodeUleb128(1), WASM_TYPE_BYTE.i32, ...encodeUleb128(1), WASM_TYPE_BYTE.i32];
    const typeSection = this.makeSection(WASM_SECTION.TYPE, this.makeVector([typeEntry]));

    // Function Section: func 0 uses type index 0
    const funcSection = this.makeSection(WASM_SECTION.FUNCTION, this.makeVector([[0]]));

    // Export Section: "factorial" -> func 0
    const nameBytes = Array.from(Buffer.from("factorial", "utf8"));
    const exportEntry = [...encodeUleb128(nameBytes.length), ...nameBytes, 0x00, 0x00];
    const exportSection = this.makeSection(WASM_SECTION.EXPORT, this.makeVector([exportEntry]));

    // Code Section:
    const localsDeclarations = [...encodeUleb128(1), ...encodeUleb128(1), WASM_TYPE_BYTE.i32];

    const bodyInstructions = [
      WASM_OP.I32_CONST,
      ...encodeSleb128(1),
      WASM_OP.LOCAL_SET,
      ...encodeUleb128(1),
      WASM_OP.LOOP,
      0x40,
      WASM_OP.LOCAL_GET,
      ...encodeUleb128(0),
      WASM_OP.I32_CONST,
      ...encodeSleb128(1),
      WASM_OP.I32_LE_S,
      WASM_OP.IF,
      0x40,
      WASM_OP.LOCAL_GET,
      ...encodeUleb128(1),
      WASM_OP.RETURN,
      WASM_OP.END,
      WASM_OP.LOCAL_GET,
      ...encodeUleb128(1),
      WASM_OP.LOCAL_GET,
      ...encodeUleb128(0),
      WASM_OP.I32_MUL,
      WASM_OP.LOCAL_SET,
      ...encodeUleb128(1),
      WASM_OP.LOCAL_GET,
      ...encodeUleb128(0),
      WASM_OP.I32_CONST,
      ...encodeSleb128(1),
      WASM_OP.I32_SUB,
      WASM_OP.LOCAL_SET,
      ...encodeUleb128(0),
      WASM_OP.BR,
      ...encodeUleb128(0),
      WASM_OP.END,
      WASM_OP.LOCAL_GET,
      ...encodeUleb128(1),
      WASM_OP.END,
    ];

    const fullBody = [...localsDeclarations, ...bodyInstructions];
    const codeEntry = [...encodeUleb128(fullBody.length), ...fullBody];
    const codeSection = this.makeSection(WASM_SECTION.CODE, this.makeVector([codeEntry]));

    const bytecode = new Uint8Array([
      ...this.WASM_MAGIC,
      ...this.WASM_VERSION,
      ...typeSection,
      ...funcSection,
      ...exportSection,
      ...codeSection,
    ]);

    const sha256 = createHash("sha256").update(bytecode).digest("hex");

    return deepFreeze({
      bytecode,
      sha256,
      totalBytes: bytecode.length,
      exportedNames: ["factorial"],
      memoryDeclared: false,
    });
  }

  /**
   * Synthesizes a linear memory backed module with memory bounds and traps.
   */
  public static buildMemoryTrapModule(minPages = 1): WasmSynthesizedModule {
    // Type Section: read_byte(offset: i32) -> i32
    const typeEntry = [0x60, ...encodeUleb128(1), WASM_TYPE_BYTE.i32, ...encodeUleb128(1), WASM_TYPE_BYTE.i32];
    const typeSection = this.makeSection(WASM_SECTION.TYPE, this.makeVector([typeEntry]));
    const funcSection = this.makeSection(WASM_SECTION.FUNCTION, this.makeVector([[0]]));

    // Memory Section: 1 memory, minPages
    const memLimits = [0x00, ...encodeUleb128(minPages)];
    const memSection = this.makeSection(WASM_SECTION.MEMORY, this.makeVector([memLimits]));

    const memName = Array.from(Buffer.from("memory", "utf8"));
    const funcName = Array.from(Buffer.from("read_byte", "utf8"));
    const exportEntries = [
      [...encodeUleb128(memName.length), ...memName, 0x02, 0x00],
      [...encodeUleb128(funcName.length), ...funcName, 0x00, 0x00],
    ];
    const exportSection = this.makeSection(WASM_SECTION.EXPORT, this.makeVector(exportEntries));

    const bodyInstructions = [
      WASM_OP.LOCAL_GET,
      ...encodeUleb128(0),
      WASM_OP.I32_LOAD8_U,
      ...encodeUleb128(0),
      ...encodeUleb128(0),
      WASM_OP.END,
    ];
    const localsCount = encodeUleb128(0);
    const fullBody = [...localsCount, ...bodyInstructions];
    const codeEntry = [...encodeUleb128(fullBody.length), ...fullBody];
    const codeSection = this.makeSection(WASM_SECTION.CODE, this.makeVector([codeEntry]));

    const bytecode = new Uint8Array([
      ...this.WASM_MAGIC,
      ...this.WASM_VERSION,
      ...typeSection,
      ...funcSection,
      ...memSection,
      ...exportSection,
      ...codeSection,
    ]);

    const sha256 = createHash("sha256").update(bytecode).digest("hex");

    return deepFreeze({
      bytecode,
      sha256,
      totalBytes: bytecode.length,
      exportedNames: ["memory", "read_byte"],
      memoryDeclared: true,
    });
  }

  /**
   * Synthesizes a linear memory vector dot-product module:
   * `dot_product(offsetA: i32, offsetB: i32, length: i32): i32`
   */
  public static buildVectorDotProductModule(): WasmSynthesizedModule {
    const typeEntry = [
      0x60,
      ...encodeUleb128(3),
      WASM_TYPE_BYTE.i32,
      WASM_TYPE_BYTE.i32,
      WASM_TYPE_BYTE.i32,
      ...encodeUleb128(1),
      WASM_TYPE_BYTE.i32,
    ];
    const typeSection = this.makeSection(WASM_SECTION.TYPE, this.makeVector([typeEntry]));
    const funcSection = this.makeSection(WASM_SECTION.FUNCTION, this.makeVector([[0]]));

    const memLimits = [0x00, ...encodeUleb128(1)];
    const memSection = this.makeSection(WASM_SECTION.MEMORY, this.makeVector([memLimits]));

    const memName = Array.from(Buffer.from("memory", "utf8"));
    const funcName = Array.from(Buffer.from("dot_product", "utf8"));
    const exportEntries = [
      [...encodeUleb128(memName.length), ...memName, 0x02, 0x00],
      [...encodeUleb128(funcName.length), ...funcName, 0x00, 0x00],
    ];
    const exportSection = this.makeSection(WASM_SECTION.EXPORT, this.makeVector(exportEntries));

    const localsDeclarations = [...encodeUleb128(1), ...encodeUleb128(2), WASM_TYPE_BYTE.i32];

    const bodyInstructions = [
      WASM_OP.I32_CONST,
      ...encodeSleb128(0),
      WASM_OP.LOCAL_SET,
      ...encodeUleb128(3),
      WASM_OP.I32_CONST,
      ...encodeSleb128(0),
      WASM_OP.LOCAL_SET,
      ...encodeUleb128(4),
      WASM_OP.LOOP,
      0x40,
      WASM_OP.LOCAL_GET,
      ...encodeUleb128(4),
      WASM_OP.LOCAL_GET,
      ...encodeUleb128(2),
      WASM_OP.I32_GE_S,
      WASM_OP.IF,
      0x40,
      WASM_OP.LOCAL_GET,
      ...encodeUleb128(3),
      WASM_OP.RETURN,
      WASM_OP.END,
      WASM_OP.LOCAL_GET,
      ...encodeUleb128(0),
      WASM_OP.LOCAL_GET,
      ...encodeUleb128(4),
      WASM_OP.I32_CONST,
      ...encodeSleb128(4),
      WASM_OP.I32_MUL,
      WASM_OP.I32_ADD,
      WASM_OP.I32_LOAD,
      ...encodeUleb128(2),
      ...encodeUleb128(0),
      WASM_OP.LOCAL_GET,
      ...encodeUleb128(1),
      WASM_OP.LOCAL_GET,
      ...encodeUleb128(4),
      WASM_OP.I32_CONST,
      ...encodeSleb128(4),
      WASM_OP.I32_MUL,
      WASM_OP.I32_ADD,
      WASM_OP.I32_LOAD,
      ...encodeUleb128(2),
      ...encodeUleb128(0),
      WASM_OP.I32_MUL,
      WASM_OP.LOCAL_GET,
      ...encodeUleb128(3),
      WASM_OP.I32_ADD,
      WASM_OP.LOCAL_SET,
      ...encodeUleb128(3),
      WASM_OP.LOCAL_GET,
      ...encodeUleb128(4),
      WASM_OP.I32_CONST,
      ...encodeSleb128(1),
      WASM_OP.I32_ADD,
      WASM_OP.LOCAL_SET,
      ...encodeUleb128(4),
      WASM_OP.BR,
      ...encodeUleb128(0),
      WASM_OP.END,
      WASM_OP.LOCAL_GET,
      ...encodeUleb128(3),
      WASM_OP.END,
    ];

    const fullBody = [...localsDeclarations, ...bodyInstructions];
    const codeEntry = [...encodeUleb128(fullBody.length), ...fullBody];
    const codeSection = this.makeSection(WASM_SECTION.CODE, this.makeVector([codeEntry]));

    const bytecode = new Uint8Array([
      ...this.WASM_MAGIC,
      ...this.WASM_VERSION,
      ...typeSection,
      ...funcSection,
      ...memSection,
      ...exportSection,
      ...codeSection,
    ]);

    const sha256 = createHash("sha256").update(bytecode).digest("hex");

    return deepFreeze({
      bytecode,
      sha256,
      totalBytes: bytecode.length,
      exportedNames: ["memory", "dot_product"],
      memoryDeclared: true,
    });
  }

  /**
   * Instantiates a synthesized WASM module and executes a named export safely.
   */
  public static executeModule<T = unknown>(
    synthesized: WasmSynthesizedModule,
    entryPoint: string,
    args: readonly unknown[] = [],
    setupMemory?: (memory: WebAssembly.Memory) => void,
  ): WasmExecutionResult<T> {
    const isValid = WebAssembly.validate(synthesized.bytecode as BufferSource);
    if (!isValid) {
      return {
        status: "VALIDATION_FAILED",
        executionTimeNs: 0n,
        executionTimeUs: 0,
        trapMessage: "WebAssembly bytecode failed validation",
      };
    }

    try {
      const module = new WebAssembly.Module(synthesized.bytecode as BufferSource);
      const instance = new WebAssembly.Instance(module, {});

      if (setupMemory && instance.exports.memory instanceof WebAssembly.Memory) {
        setupMemory(instance.exports.memory);
      }

      const fn = instance.exports[entryPoint] as (...fnArgs: unknown[]) => T;
      assertPrecondition(typeof fn === "function", `Export '${entryPoint}' is not a function`);

      const startNs = process.hrtime.bigint();
      const returnedValue = fn(...args);
      const executionTimeNs = process.hrtime.bigint() - startNs;
      const executionTimeUs = Math.max(0.1, Number(executionTimeNs) / 1000);

      return {
        status: "SUCCESS",
        returnedValue,
        executionTimeNs,
        executionTimeUs,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: "RUNTIME_TRAP",
        executionTimeNs: 0n,
        executionTimeUs: 0,
        trapMessage: message,
      };
    }
  }

  /**
   * Executes comparative benchmark between pure WASM factorial and interpreted JS.
   */
  public static benchmarkKernel(operations = 20000): WasmBenchmarkStats {
    const wasmMod = this.buildFactorialModule();
    const module = new WebAssembly.Module(wasmMod.bytecode as BufferSource);
    const instance = new WebAssembly.Instance(module, {});
    const wasmFactorial = instance.exports.factorial as (n: number) => number;

    const jsFactorial = (n: number): number => {
      let acc = 1;
      while (n > 1) {
        acc *= n;
        n -= 1;
      }
      return acc;
    };

    for (let i = 0; i < 500; i++) {
      wasmFactorial(10);
      jsFactorial(10);
    }

    const wasmStart = process.hrtime.bigint();
    for (let i = 0; i < operations; i++) {
      wasmFactorial(10);
    }
    const wasmTotalNs = process.hrtime.bigint() - wasmStart;
    const wasmAvgNsPerOp = Number(wasmTotalNs) / operations;

    const jsStart = process.hrtime.bigint();
    for (let i = 0; i < operations; i++) {
      jsFactorial(10);
    }
    const jsTotalNs = process.hrtime.bigint() - jsStart;
    const jsAvgNsPerOp = Number(jsTotalNs) / operations;

    const speedupRatio = wasmAvgNsPerOp > 0 ? Number((jsAvgNsPerOp / wasmAvgNsPerOp).toFixed(2)) : 1.0;

    return deepFreeze({
      operationsCount: operations,
      wasmTotalNs,
      wasmAvgNsPerOp,
      jsTotalNs,
      jsAvgNsPerOp,
      speedupRatio,
    });
  }

  /**
   * Comprehensive end-to-end audit of all synthesized WASM engines and receipt generation.
   */
  public static auditWasmSynthesizerPipeline(options?: { projectRoot?: string }): WasmSynthesizerAuditReceipt {
    const root = options?.projectRoot ?? process.cwd();

    let leb128FidelityVerified = true;
    const testValues = [0, 1, 127, 128, 255, 16384, 65535];
    for (const val of testValues) {
      const uleb = encodeUleb128(val);
      const decoded = decodeUleb128(uleb);
      if (decoded.value !== val) leb128FidelityVerified = false;
    }
    const signedValues = [0, 1, -1, 63, -64, 127, -128, 1024, -1024];
    for (const val of signedValues) {
      const sleb = encodeSleb128(val);
      const decoded = decodeSleb128(sleb);
      if (decoded.value !== val) leb128FidelityVerified = false;
    }

    const addMod = this.buildAddModule();
    const addRes = this.executeModule<number>(addMod, "add", [40, 2]);
    const arithmeticKernelVerified = addRes.status === "SUCCESS" && addRes.returnedValue === 42;

    const factMod = this.buildFactorialModule();
    const factRes = this.executeModule<number>(factMod, "factorial", [6]);
    const loopFactorialKernelVerified = factRes.status === "SUCCESS" && factRes.returnedValue === 720;

    const trapMod = this.buildMemoryTrapModule(1);
    const trapRes = this.executeModule<number>(trapMod, "read_byte", [70000]);
    const linearMemoryTrapCaught =
      trapRes.status === "RUNTIME_TRAP" && Boolean(trapRes.trapMessage?.toLowerCase().includes("out of bounds"));

    const dotMod = this.buildVectorDotProductModule();
    const vecA = [2, 3, 4, 5];
    const vecB = [10, 20, 30, 40];
    const expectedDot = 2 * 10 + 3 * 20 + 4 * 30 + 5 * 40;

    const dotRes = this.executeModule<number>(dotMod, "dot_product", [0, 16, 4], (memory) => {
      const view = new Int32Array(memory.buffer);
      view.set(vecA, 0);
      view.set(vecB, 4);
    });
    const vectorDotProductVerified = dotRes.status === "SUCCESS" && dotRes.returnedValue === expectedDot;

    const bench = this.benchmarkKernel(10000);

    const validWasmMagicVerified =
      WebAssembly.validate(addMod.bytecode as BufferSource) &&
      WebAssembly.validate(factMod.bytecode as BufferSource) &&
      WebAssembly.validate(trapMod.bytecode as BufferSource) &&
      WebAssembly.validate(dotMod.bytecode as BufferSource);

    const payload = JSON.stringify({
      specRef: "SPEC-306",
      validWasmMagicVerified,
      leb128FidelityVerified,
      arithmeticKernelVerified,
      loopFactorialKernelVerified,
      linearMemoryTrapCaught,
      vectorDotProductVerified,
      modulesEvaluated: 4,
    });
    const sha256Signature = pureSha256(payload);

    const receipt: WasmSynthesizerAuditReceipt = deepFreeze({
      receiptType: "EOS_WASM_SYNTHESIZER_AUDIT",
      timestampIso: new Date().toISOString(),
      specRef: "SPEC-306",
      validWasmMagicVerified,
      leb128FidelityVerified,
      arithmeticKernelVerified,
      loopFactorialKernelVerified,
      linearMemoryTrapCaught,
      vectorDotProductVerified,
      benchmarkSpeedupRatio: bench.speedupRatio,
      modulesEvaluated: 4,
      sha256Signature,
    });

    const outDir = join(root, "docs", "evidence");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "WASM_SYNTHESIZER_RECEIPT.json"), JSON.stringify(receipt, null, 2), "utf8");

    return receipt;
  }
}

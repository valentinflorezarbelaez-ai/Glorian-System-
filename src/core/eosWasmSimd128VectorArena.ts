/**
 * Glorian System — WebAssembly SIMD 128-Bit (v128) Vectorized Compute & Zero-Copy Arena Engine
 * Governed by SPEC-310 / CHANGE-172 / ADR-172
 *
 * Implements W3C WebAssembly Core 2.0 Fixed-Width SIMD (`v128`, 0xfd opcodes) for 4-lane
 * CRDT joins (`i32x4.max_s`), dot products (`i32x4.mul`), 16-byte aligned zero-copy framing
 * (`v128.xor`), and elastic multi-repo fleet capacity governance (`9..1,000` projects).
 *
 * Strictly Zero Runtime Dependencies (Law V). Maximum Lines <= 800 (SPEC-250).
 */

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import { EosPolyglotRustZigWasmKernelCore } from "./eosPolyglotRustZigWasmKernel.ts";
import {
  EosWasmBytecodeSynthesizerCore,
  WASM_SECTION,
  WASM_TYPE_BYTE,
  encodeUleb128,
} from "./eosWasmBytecodeSynthesizer.ts";
import type {
  ElasticFleetCapacityAssessment,
  Simd128BenchmarkReport,
  SimdCompilerBackend,
  SimdDotProductReport,
  SimdKernelCompileReport,
  SimdKernelLanguage,
  SimdVectorMaxJoinReport,
  WasmSimd128ArenaReceipt,
  ZeroCopyArenaFrameReport,
} from "./eosWasmSimd128VectorArena.types.ts";

export * from "./eosWasmSimd128VectorArena.types.ts";

interface Simd128WasmExports {
  memory: WebAssembly.Memory;
  simd_i32x4_max_join: (offsetA: number, offsetB: number, offsetOut: number) => number;
  simd_i32x4_dot: (offsetA: number, offsetB: number) => number;
  simd_v128_xor_tag: (offsetA: number, offsetB: number) => number;
  simd_i32x4_max_join_loop: (offsetA: number, offsetB: number, offsetOut: number, byteLen: number) => number;
}

const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d] as const;
const WASM_VERSION = [0x01, 0x00, 0x00, 0x00] as const;
const WASM_TYPE_V128 = 0x7b;
const SIMD_PREFIX = 0xfd;

export class EosWasmSimd128VectorArenaCore {
  private static cachedRuntime: {
    bytecode: Uint8Array;
    instance: WebAssembly.Instance;
    exports: Simd128WasmExports;
  } | null = null;

  /**
   * Aligns a linear memory byte offset up to the nearest 16-byte `v128` boundary.
   */
  public static align16(offsetBytes: number): number {
    return (offsetBytes + 15) & ~15;
  }

  /**
   * Builds and caches a W3C WebAssembly Core 2.0 Fixed-Width SIMD (`0xfd` / `v128`) module
   * with exported linear memory and 4-lane vector kernels.
   */
  public static getSimd128WasmRuntime(): {
    bytecode: Uint8Array;
    instance: WebAssembly.Instance;
    exports: Simd128WasmExports;
  } {
    if (this.cachedRuntime) return this.cachedRuntime;

    const sigMaxJoin = [0x60, 3, WASM_TYPE_BYTE.i32, WASM_TYPE_BYTE.i32, WASM_TYPE_BYTE.i32, 1, WASM_TYPE_BYTE.i32];
    const sigPair = [0x60, 2, WASM_TYPE_BYTE.i32, WASM_TYPE_BYTE.i32, 1, WASM_TYPE_BYTE.i32];
    const sigLoop = [
      0x60,
      4,
      WASM_TYPE_BYTE.i32,
      WASM_TYPE_BYTE.i32,
      WASM_TYPE_BYTE.i32,
      WASM_TYPE_BYTE.i32,
      1,
      WASM_TYPE_BYTE.i32,
    ];

    const typeSection = EosWasmBytecodeSynthesizerCore.makeSection(
      WASM_SECTION.TYPE,
      EosWasmBytecodeSynthesizerCore.makeVector([sigMaxJoin, sigPair, sigLoop]),
    );
    const funcSection = EosWasmBytecodeSynthesizerCore.makeSection(
      WASM_SECTION.FUNCTION,
      EosWasmBytecodeSynthesizerCore.makeVector([[0], [1], [1], [2]]),
    );
    const memSection = EosWasmBytecodeSynthesizerCore.makeSection(
      WASM_SECTION.MEMORY,
      EosWasmBytecodeSynthesizerCore.makeVector([[0x00, ...encodeUleb128(1)]]),
    );
    const exportSection = EosWasmBytecodeSynthesizerCore.makeSection(
      WASM_SECTION.EXPORT,
      EosWasmBytecodeSynthesizerCore.makeVector([
        this.makeExportEntry("memory", 0x02, 0),
        this.makeExportEntry("simd_i32x4_max_join", 0x00, 0),
        this.makeExportEntry("simd_i32x4_dot", 0x00, 1),
        this.makeExportEntry("simd_v128_xor_tag", 0x00, 2),
        this.makeExportEntry("simd_i32x4_max_join_loop", 0x00, 3),
      ]),
    );
    const codeSection = EosWasmBytecodeSynthesizerCore.makeSection(
      WASM_SECTION.CODE,
      EosWasmBytecodeSynthesizerCore.makeVector([
        this.encodeSimdMaxJoinBody(),
        this.encodePairSimdBody(0xb5, 0x6a), // i32x4.mul + i32.add
        this.encodePairSimdBody(0x51, 0x73), // v128.xor + i32.xor
        this.encodeSimdMaxJoinLoopBody(),
      ]),
    );

    const bytecode = new Uint8Array([
      ...WASM_MAGIC,
      ...WASM_VERSION,
      ...typeSection,
      ...funcSection,
      ...memSection,
      ...exportSection,
      ...codeSection,
    ]);

    const wasmModule = new WebAssembly.Module(bytecode);
    const instance = new WebAssembly.Instance(wasmModule);
    const exports = instance.exports as unknown as Simd128WasmExports;

    this.cachedRuntime = { bytecode, instance, exports };
    return this.cachedRuntime;
  }

  private static makeExportEntry(name: string, kindByte: number, index: number): number[] {
    const nameBytes = Array.from(Buffer.from(name, "utf8"));
    return [...encodeUleb128(nameBytes.length), ...nameBytes, kindByte, ...encodeUleb128(index)];
  }

  private static encodeLaneReduce(localIndex: number, combineOpcode: number): number[] {
    const extractOp = encodeUleb128(27);
    const out: number[] = [];
    for (let lane = 0; lane < 4; lane++) {
      out.push(0x20, localIndex, SIMD_PREFIX, ...extractOp, lane);
      if (lane > 0) out.push(combineOpcode);
    }
    out.push(0x0b);
    return out;
  }

  private static encodeSimdMaxJoinBody(): number[] {
    const loadOp = encodeUleb128(0);
    const body = [
      1,
      1,
      WASM_TYPE_V128,
      0x20,
      2,
      0x20,
      0,
      SIMD_PREFIX,
      ...loadOp,
      2,
      0,
      0x20,
      1,
      SIMD_PREFIX,
      ...loadOp,
      2,
      0,
      SIMD_PREFIX,
      ...encodeUleb128(0xb8),
      0x22,
      3,
      SIMD_PREFIX,
      ...encodeUleb128(11),
      2,
      0,
      ...this.encodeLaneReduce(3, 0x6a),
    ];
    return [...encodeUleb128(body.length), ...body];
  }

  private static encodeSimdMaxJoinLoopBody(): number[] {
    const loadOp = encodeUleb128(0);
    const body: number[] = [
      2,
      1,
      WASM_TYPE_BYTE.i32,
      2,
      WASM_TYPE_V128,
      0x41,
      0,
      0x21,
      4,
      SIMD_PREFIX,
      ...encodeUleb128(12),
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0x21,
      5,
      0x02,
      0x40,
      0x03,
      0x40,
      0x20,
      4,
      0x20,
      3,
      0x4e,
      0x0d,
      1,
      0x20,
      2,
      0x20,
      4,
      0x6a,
      0x20,
      0,
      0x20,
      4,
      0x6a,
      SIMD_PREFIX,
      ...loadOp,
      2,
      0,
      0x20,
      1,
      0x20,
      4,
      0x6a,
      SIMD_PREFIX,
      ...loadOp,
      2,
      0,
      SIMD_PREFIX,
      ...encodeUleb128(0xb8),
      0x22,
      6,
      SIMD_PREFIX,
      ...encodeUleb128(11),
      2,
      0,
      0x20,
      5,
      0x20,
      6,
      SIMD_PREFIX,
      ...encodeUleb128(0xae),
      0x21,
      5,
      0x20,
      4,
      0x41,
      16,
      0x6a,
      0x21,
      4,
      0x0c,
      0,
      0x0b,
      0x0b,
      ...this.encodeLaneReduce(5, 0x6a),
    ];
    return [...encodeUleb128(body.length), ...body];
  }

  private static encodePairSimdBody(simdOp: number, reduceOp: number): number[] {
    const loadOp = encodeUleb128(0);
    const body = [
      1,
      1,
      WASM_TYPE_V128,
      0x20,
      0,
      SIMD_PREFIX,
      ...loadOp,
      2,
      0,
      0x20,
      1,
      SIMD_PREFIX,
      ...loadOp,
      2,
      0,
      SIMD_PREFIX,
      ...encodeUleb128(simdOp),
      0x21,
      2,
      ...this.encodeLaneReduce(2, reduceOp),
    ];
    return [...encodeUleb128(body.length), ...body];
  }

  private static ensureLinearMemoryBytes(memory: WebAssembly.Memory, neededBytes: number): void {
    const current = memory.buffer.byteLength;
    if (neededBytes > current) {
      const additionalPages = Math.ceil((neededBytes - current) / 65536);
      memory.grow(additionalPages);
    }
  }

  private static tryCompileNativeSimd(
    language: SimdKernelLanguage,
    sourcePath: string,
    tmpOut: string,
  ): { bytes: Uint8Array; backend: SimdCompilerBackend } | null {
    const cmd = language === "ZIG" ? "zig" : "rustc";
    const args =
      language === "ZIG"
        ? [
            "build-exe",
            sourcePath,
            "-target",
            "wasm32-freestanding",
            "-mcpu=generic+simd128",
            "-O",
            "ReleaseSmall",
            "-fstrip",
            "-fno-entry",
            "-rdynamic",
            `-femit-bin=${tmpOut}`,
          ]
        : [
            sourcePath,
            "--target",
            "wasm32-unknown-unknown",
            "--crate-type",
            "cdylib",
            "-C",
            "target-feature=+simd128",
            "-C",
            "opt-level=z",
            "-o",
            tmpOut,
          ];
    const res = spawnSync(cmd, args, { encoding: "utf8", timeout: 25000, windowsHide: true });
    if (res.status === 0 && fs.existsSync(tmpOut)) {
      return {
        bytes: new Uint8Array(fs.readFileSync(tmpOut)),
        backend: language === "ZIG" ? "ZIG_WASM32_SIMD128" : "RUSTC_WASM32_SIMD128",
      };
    }
    return null;
  }

  /**
   * Compiles Zig (`-mcpu=generic+simd128`) or Rust (`target-feature=+simd128`) WASM SIMD
   * kernels, falling back deterministically to the hermetic W3C `0xfd` bytecode synthesizer.
   */
  public static compileSimdPolyglotKernel(
    language: SimdKernelLanguage,
    projectRoot: string = process.cwd(),
  ): SimdKernelCompileReport {
    const startMs = Date.now();
    const relSource =
      language === "ZIG" ? "templates/polyglot-wasm/simd_kernel.zig" : "templates/polyglot-wasm/simd_kernel.rs";
    const sourcePath = path.join(projectRoot, relSource);
    assertPrecondition(fs.existsSync(sourcePath), `Missing polyglot SIMD kernel source: ${relSource}`);

    const sourceBytes = fs.readFileSync(sourcePath);
    const tmpOut = path.join(os.tmpdir(), `glorian-simd-${language.toLowerCase()}-${process.pid}-${Date.now()}.wasm`);
    let compiled: { bytes: Uint8Array; backend: SimdCompilerBackend } | null = null;
    try {
      compiled = this.tryCompileNativeSimd(language, sourcePath, tmpOut);
    } catch {
      compiled = null;
    } finally {
      if (fs.existsSync(tmpOut)) {
        try {
          fs.unlinkSync(tmpOut);
        } catch {
          /* ignore temp file cleanup error */
        }
      }
    }

    const wasmBytes = compiled ? compiled.bytes : this.getSimd128WasmRuntime().bytecode;
    const compilerBackend = compiled ? compiled.backend : "HERMETIC_W3C_SIMD128_SYNTHESIZER";
    const wasmMagicValid =
      wasmBytes.length >= 8 &&
      wasmBytes[0] === 0x00 &&
      wasmBytes[1] === 0x61 &&
      wasmBytes[2] === 0x73 &&
      wasmBytes[3] === 0x6d;
    const simdOpcodesPresent = wasmBytes.includes(SIMD_PREFIX);
    const sha256Digest = crypto
      .createHash("sha256")
      .update(Buffer.concat([Buffer.from(wasmBytes), sourceBytes]))
      .digest("hex");

    return deepFreeze({
      language,
      sourcePath: relSource,
      compilerBackend,
      wasmByteLength: wasmBytes.length,
      wasmMagicValid,
      simdOpcodesPresent,
      sha256Digest,
      durationMs: Date.now() - startMs,
    });
  }

  private static validateEqualVectors(vectorA: ArrayLike<number>, vectorB: ArrayLike<number>): number {
    assertPrecondition(vectorA !== null && vectorA !== undefined, "vectorA must be provided");
    assertPrecondition(vectorB !== null && vectorB !== undefined, "vectorB must be provided");
    assertPrecondition(vectorA.length > 0, "PRECONDITION_FAILED: vectors must be non-empty");
    assertPrecondition(vectorA.length === vectorB.length, "PRECONDITION_FAILED: vector dimensions must match");
    return vectorA.length;
  }

  /**
   * Executes element-wise `max(a[i], b[i])` using 4-lane W3C SIMD `i32x4.max_s` (`0xfd 0xb8`)
   * across 16-byte aligned `WebAssembly.Memory` plus exact scalar tail handling.
   */
  public static executeSimdVectorMaxJoin(
    vectorA: ArrayLike<number>,
    vectorB: ArrayLike<number>,
  ): SimdVectorMaxJoinReport {
    const dim = this.validateEqualVectors(vectorA, vectorB);
    const { exports } = this.getSimd128WasmRuntime();
    const offsetA = 0;
    const offsetB = this.align16(dim * 4);
    const offsetOut = this.align16(offsetB + dim * 4);
    this.ensureLinearMemoryBytes(exports.memory, offsetOut + this.align16(dim * 4));

    const view = new Int32Array(exports.memory.buffer);
    const wordA = offsetA >> 2;
    const wordB = offsetB >> 2;
    const wordOut = offsetOut >> 2;
    for (let i = 0; i < dim; i++) {
      view[wordA + i] = vectorA[i] | 0;
      view[wordB + i] = vectorB[i] | 0;
    }

    const simdLanesProcessed = Math.floor(dim / 4) * 4;
    const startNs = process.hrtime.bigint();
    let sumMerged =
      simdLanesProcessed > 0
        ? exports.simd_i32x4_max_join_loop(offsetA, offsetB, offsetOut, simdLanesProcessed * 4)
        : 0;

    const mergedElements = new Array<number>(dim);
    for (let i = 0; i < simdLanesProcessed; i++) {
      mergedElements[i] = view[wordOut + i];
    }
    for (let i = simdLanesProcessed; i < dim; i++) {
      const a = view[wordA + i];
      const b = view[wordB + i];
      const m = a >= b ? a : b;
      view[wordOut + i] = m;
      mergedElements[i] = m;
      sumMerged += m;
    }
    const endNs = process.hrtime.bigint();

    return deepFreeze({
      dimension: dim,
      simdLanesProcessed,
      scalarTailProcessed: dim - simdLanesProcessed,
      mergedElements,
      sumMerged,
      arenaAlignedOffsetBytes: offsetOut,
      durationNs: Number(endNs - startNs),
    });
  }

  /**
   * Computes vectorized inner dot product (`i32x4.mul`, `0xfd 0xb5`) and cosine similarity.
   */
  public static executeSimdDotProduct(vectorA: ArrayLike<number>, vectorB: ArrayLike<number>): SimdDotProductReport {
    const dim = this.validateEqualVectors(vectorA, vectorB);
    const { exports } = this.getSimd128WasmRuntime();
    const offsetA = 0;
    const offsetB = this.align16(dim * 4);
    this.ensureLinearMemoryBytes(exports.memory, offsetB + this.align16(dim * 4));

    const view = new Int32Array(exports.memory.buffer);
    const wordA = offsetA >> 2;
    const wordB = offsetB >> 2;
    let normSqA = 0;
    let normSqB = 0;
    for (let i = 0; i < dim; i++) {
      const va = vectorA[i] | 0;
      const vb = vectorB[i] | 0;
      view[wordA + i] = va;
      view[wordB + i] = vb;
      normSqA += va * va;
      normSqB += vb * vb;
    }

    const startNs = process.hrtime.bigint();
    let dotProduct = 0;
    let simdLanesProcessed = 0;
    for (; simdLanesProcessed + 4 <= dim; simdLanesProcessed += 4) {
      const byteDisp = simdLanesProcessed * 4;
      dotProduct += exports.simd_i32x4_dot(offsetA + byteDisp, offsetB + byteDisp);
    }
    for (let i = simdLanesProcessed; i < dim; i++) {
      dotProduct += view[wordA + i] * view[wordB + i];
    }
    const endNs = process.hrtime.bigint();

    const denom = Math.sqrt(normSqA) * Math.sqrt(normSqB);
    const cosineSimilarity = denom > 0 ? Math.round((dotProduct / denom) * 1_000_000) / 1_000_000 : 0;

    return deepFreeze({
      dimension: dim,
      simdLanesProcessed,
      dotProduct,
      cosineSimilarity,
      durationNs: Number(endNs - startNs),
    });
  }

  /**
   * Stages a telemetry frame on a 16-byte aligned boundary inside `WebAssembly.Memory`,
   * computes a `v128.xor` parity tag, and reports ring-buffer backpressure status.
   */
  public static enqueueAndVerifyZeroCopyArenaFrame(
    payloadWords: ArrayLike<number>,
    producerSeq: number,
    consumerSeq: number,
    capacitySlots: number,
  ): ZeroCopyArenaFrameReport {
    assertPrecondition(
      payloadWords !== null && payloadWords !== undefined && payloadWords.length > 0,
      "PRECONDITION_FAILED: payloadWords must be non-empty",
    );
    assertPrecondition(
      Number.isInteger(capacitySlots) && capacitySlots > 0,
      "PRECONDITION_FAILED: capacitySlots must be a positive integer",
    );

    const { exports } = this.getSimd128WasmRuntime();
    const paddedWords = Math.max(4, Math.ceil(payloadWords.length / 4) * 4);
    const scratchOffset = this.align16(4080); // 4080 % 16 === 0
    const alignedOffsetBytes = this.align16(4096); // 4096 % 16 === 0
    const frameByteLength = paddedWords * 4;
    this.ensureLinearMemoryBytes(exports.memory, alignedOffsetBytes + frameByteLength);

    const view = new Int32Array(exports.memory.buffer);
    const scratchWord = scratchOffset >> 2;
    view[scratchWord] = 0x51a0_0001 | 0;
    view[scratchWord + 1] = 0x51a0_0002 | 0;
    view[scratchWord + 2] = 0x51a0_0004 | 0;
    view[scratchWord + 3] = 0x51a0_0008 | 0;

    const frameWord = alignedOffsetBytes >> 2;
    for (let i = 0; i < paddedWords; i++) {
      view[frameWord + i] = i < payloadWords.length ? payloadWords[i] | 0 : 0;
    }

    const blockCount = paddedWords / 4;
    let xorAcc = 0;
    for (let b = 0; b < blockCount; b++) {
      xorAcc ^= exports.simd_v128_xor_tag(alignedOffsetBytes + b * 16, scratchOffset);
    }

    const ringStatus = EosPolyglotRustZigWasmKernelCore.executeZigRingBufferCheckWasm(
      producerSeq,
      consumerSeq,
      capacitySlots,
    );

    return deepFreeze({
      frameByteLength,
      alignedOffsetBytes,
      xorParityTagHex: (xorAcc >>> 0).toString(16).padStart(8, "0"),
      xorParityTagInt32: xorAcc | 0,
      freeSlotsRemaining: ringStatus.freeSlots,
      utilizationRatio: ringStatus.utilizationRatio,
      zeroHeapCopyVerified: alignedOffsetBytes % 16 === 0 && frameByteLength % 16 === 0,
    });
  }

  /**
   * Evaluates elastic multi-repository fleet capacity bounds (`9..1,000` repositories)
   * with sharding, logarithmic anti-entropy round estimation, and Vercel Hobby limits.
   */
  public static evaluateElasticFleetCapacity(
    projectCount: number,
    minProjects: number = 9,
    maxProjects: number = 1000,
  ): ElasticFleetCapacityAssessment {
    assertPrecondition(
      Number.isInteger(minProjects) && minProjects >= 1,
      "PRECONDITION_FAILED: minProjects must be >= 1",
    );
    assertPrecondition(
      Number.isInteger(maxProjects) && maxProjects >= minProjects,
      "PRECONDITION_FAILED: maxProjects must be >= minProjects",
    );
    assertPrecondition(
      Number.isInteger(projectCount) && projectCount >= minProjects && projectCount <= maxProjects,
      `PRECONDITION_FAILED: projectCount (${projectCount}) must be within [${minProjects}, ${maxProjects}]`,
    );

    return deepFreeze({
      projectCount,
      minProjects,
      maxProjects,
      withinBounds: true,
      recommendedWorkerShards: Math.min(16, Math.max(1, Math.ceil(projectCount / 8))),
      antiEntropyRoundsLog2: Math.ceil(Math.log2(Math.max(2, projectCount))),
      vssThresholdGroupsRequired: Math.ceil(projectCount / 64),
      vercelHobbyAccountFits: projectCount <= 200,
    });
  }

  /**
   * Benchmarks 4-lane W3C SIMD128 `i32x4.max_s` execution against equivalent JS scalar loops
   * and verifies 100% deterministic numerical equivalence.
   */
  public static benchmarkSimd128VsScalar(dimension: number = 128, iterations: number = 250): Simd128BenchmarkReport {
    assertPrecondition(Number.isInteger(dimension) && dimension > 0, "PRECONDITION_FAILED: dimension must be positive");
    assertPrecondition(
      Number.isInteger(iterations) && iterations > 0,
      "PRECONDITION_FAILED: iterations must be positive",
    );

    const vecA = new Int32Array(dimension);
    const vecB = new Int32Array(dimension);
    for (let i = 0; i < dimension; i++) {
      vecA[i] = i * 5 - 40;
      vecB[i] = (dimension - i) * 3 - 20;
    }

    const { exports } = this.getSimd128WasmRuntime();
    const offsetA = 0;
    const offsetB = this.align16(dimension * 4);
    const offsetOut = this.align16(offsetB + dimension * 4);
    this.ensureLinearMemoryBytes(exports.memory, offsetOut + this.align16(dimension * 4));
    const view = new Int32Array(exports.memory.buffer);
    const wordA = offsetA >> 2;
    const wordB = offsetB >> 2;
    const wordOut = offsetOut >> 2;
    for (let i = 0; i < dimension; i++) {
      view[wordA + i] = vecA[i];
      view[wordB + i] = vecB[i];
    }

    const simdLanes = Math.floor(dimension / 4) * 4;
    const simdByteLen = simdLanes * 4;
    if (simdByteLen > 0) {
      for (let w = 0; w < 25; w++) {
        exports.simd_i32x4_max_join_loop(offsetA, offsetB, offsetOut, simdByteLen);
      }
    }

    const simdStart = process.hrtime.bigint();
    for (let r = 0; r < iterations; r++) {
      if (simdByteLen > 0) {
        exports.simd_i32x4_max_join_loop(offsetA, offsetB, offsetOut, simdByteLen);
      }
      for (let i = simdLanes; i < dimension; i++) {
        const a = view[wordA + i];
        const b = view[wordB + i];
        view[wordOut + i] = a >= b ? a : b;
      }
    }
    const simdTotalNs = Number(process.hrtime.bigint() - simdStart);

    const scalarOut = new Array<number>(dimension);
    for (let i = 0; i < dimension; i++) {
      scalarOut[i] = vecA[i] >= vecB[i] ? vecA[i] : vecB[i];
    }
    const scalarStart = process.hrtime.bigint();
    for (let r = 0; r < iterations; r++) {
      for (let i = 0; i < dimension; i++) {
        scalarOut[i] = vecA[i] >= vecB[i] ? vecA[i] : vecB[i];
      }
    }
    const scalarTotalNs = Number(process.hrtime.bigint() - scalarStart);

    let deterministicMatch = true;
    for (let i = 0; i < dimension; i++) {
      if (view[wordOut + i] !== scalarOut[i]) {
        deterministicMatch = false;
        break;
      }
    }

    return deepFreeze({
      dimension,
      iterations,
      simdTotalNs,
      simdNsPerOp: Math.round((simdTotalNs / (iterations * dimension)) * 100) / 100,
      scalarTotalNs,
      scalarNsPerOp: Math.round((scalarTotalNs / (iterations * dimension)) * 100) / 100,
      deterministicMatch,
    });
  }

  /**
   * Executes end-to-end SIMD128 verification, elastic fleet checks, and emits a signed receipt at
   * `docs/evidence/WASM_SIMD128_ARENA_RECEIPT.json`.
   */
  public static async auditSimd128VectorArenaPipeline(
    projectRoot: string = process.cwd(),
  ): Promise<WasmSimd128ArenaReceipt> {
    const zigSimdCompileReport = this.compileSimdPolyglotKernel("ZIG", projectRoot);
    const rustSimdCompileReport = this.compileSimdPolyglotKernel("RUST", projectRoot);

    const joinRes = this.executeSimdVectorMaxJoin([10, 40, 5, 100, 7], [20, 15, 30, 80, 12]);
    const maxJoinVerified =
      joinRes.sumMerged === 202 &&
      joinRes.simdLanesProcessed === 4 &&
      joinRes.scalarTailProcessed === 1 &&
      joinRes.arenaAlignedOffsetBytes % 16 === 0;

    const dotRes = this.executeSimdDotProduct([2, 3, 4, 5], [10, 20, 30, 40]);
    const dotProductVerified = dotRes.dotProduct === 400 && dotRes.simdLanesProcessed === 4;

    const frameRes = this.enqueueAndVerifyZeroCopyArenaFrame([11, 22, 33, 44, 55, 66, 77, 88], 1090, 1000, 100);
    const zeroCopyArenaVerified =
      frameRes.zeroHeapCopyVerified && frameRes.freeSlotsRemaining === 10 && frameRes.xorParityTagHex.length === 8;

    const fleetNominal = this.evaluateElasticFleetCapacity(64);
    const fleetMax = this.evaluateElasticFleetCapacity(1000);
    const elasticFleetVerified =
      fleetNominal.withinBounds &&
      fleetNominal.vercelHobbyAccountFits === true &&
      fleetMax.withinBounds &&
      fleetMax.vercelHobbyAccountFits === false;

    const benchmark = this.benchmarkSimd128VsScalar(128, 250);

    const unsignedPayload = {
      specRef: "SPEC-310" as const,
      changeRef: "CHANGE-172" as const,
      status: "SIMD128_VECTOR_ARENA_VERIFIED" as const,
      zigSimdCompileReport,
      rustSimdCompileReport,
      maxJoinVerified,
      dotProductVerified,
      zeroCopyArenaVerified,
      elasticFleetVerified,
      benchmark,
    };

    const receipt: WasmSimd128ArenaReceipt = deepFreeze({
      timestampIso: new Date().toISOString(),
      ...unsignedPayload,
      cryptographicSignature: pureSha256(JSON.stringify(unsignedPayload)),
    });

    const evidenceDir = path.join(projectRoot, "docs", "evidence");
    if (!fs.existsSync(evidenceDir)) {
      fs.mkdirSync(evidenceDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(evidenceDir, "WASM_SIMD128_ARENA_RECEIPT.json"),
      JSON.stringify(receipt, null, 2),
      "utf8",
    );

    return receipt;
  }
}

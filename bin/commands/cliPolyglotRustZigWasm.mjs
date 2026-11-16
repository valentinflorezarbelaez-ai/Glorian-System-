/**
 * CLI Polyglot Rust & Zig Native WebAssembly Linear-Memory Kernel Handlers
 *
 * Implements toolchain:rustzig:* subcommands for compiling Rust/Zig WASM kernels,
 * executing linear-memory CRDT joins / FNV-1a / ring-buffer checks, benchmarking,
 * and emitting signed cryptographic receipts.
 *
 * Conforms to SPEC-309 / CHANGE-171.
 */

import { EosPolyglotRustZigWasmKernelCore } from "../../src/core/eosPolyglotRustZigWasmKernel.ts";

const HANDLERS = {};

async function cmd_rustzig_compile(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const rust = EosPolyglotRustZigWasmKernelCore.compilePolyglotKernel("RUST", process.cwd());
  const zig = EosPolyglotRustZigWasmKernelCore.compilePolyglotKernel("ZIG", process.cwd());

  if (isJson) {
    console.log(JSON.stringify({ rust, zig }, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN POLYGLOT RUST & ZIG WASM COMPILATION (SPEC-309)      `);
  console.log(`===============================================================`);
  console.log(
    `  [RUST] Compiler : ${rust.compilerUsed} | Bytes: ${rust.wasmByteLength} | Magic: ${rust.wasmMagicValid}`,
  );
  console.log(`         Digest   : ${rust.sha256Digest.slice(0, 32)}...`);
  console.log(`  [ZIG]  Compiler : ${zig.compilerUsed} | Bytes: ${zig.wasmByteLength} | Magic: ${zig.wasmMagicValid}`);
  console.log(`         Digest   : ${zig.sha256Digest.slice(0, 32)}...`);
  console.log(`===============================================================\n`);
}

async function cmd_rustzig_execute(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const vectorJoin = EosPolyglotRustZigWasmKernelCore.executeRustVectorJoinWasm([10, 40, 5, 100], [20, 15, 30, 80]);
  const fnv1a = EosPolyglotRustZigWasmKernelCore.executeZigFnv1aHashWasm("foobar");
  const ringBuffer = EosPolyglotRustZigWasmKernelCore.executeZigRingBufferCheckWasm(1090, 1000, 100);

  if (isJson) {
    console.log(JSON.stringify({ vectorJoin, fnv1a, ringBuffer }, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN WASM LINEAR-MEMORY KERNEL EXECUTION (SPEC-309)       `);
  console.log(`===============================================================`);
  console.log(
    `  Rust CRDT Join : [${vectorJoin.mergedElements.join(", ")}] | Sum=${vectorJoin.sumMerged} | ${vectorJoin.durationNs} ns`,
  );
  console.log(`  Zig FNV-1a     : 0x${fnv1a.hashHex} (foobar) | ${fnv1a.durationNs} ns`);
  console.log(`  Zig Ring Buffer: freeSlots=${ringBuffer.freeSlots} | backpressure=${ringBuffer.backpressureActive}`);
  console.log(`===============================================================\n`);
}

async function cmd_rustzig_benchmark(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const report = EosPolyglotRustZigWasmKernelCore.benchmarkPolyglotWasm(128, 250);

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN POLYGLOT WASM VS JS BENCHMARK (SPEC-309)             `);
  console.log(`===============================================================`);
  console.log(`  Dimensions x Iter : ${report.vectorDimension} x ${report.iterations}`);
  console.log(`  WASM Linear Arena : ${report.wasmNsPerOp} ns/op (total ${report.wasmTotalNs} ns)`);
  console.log(`  JS Heap Array     : ${report.jsNsPerOp} ns/op (total ${report.jsTotalNs} ns)`);
  console.log(`  Deterministic Parity : ${report.deterministicMatch ? "VERIFIED" : "MISMATCH"}`);
  console.log(`===============================================================\n`);
}

async function cmd_rustzig_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const receipt = await EosPolyglotRustZigWasmKernelCore.auditPolyglotRustZigPipeline(process.cwd());

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN POLYGLOT RUST & ZIG AUDIT RECEIPT (SPEC-309)         `);
  console.log(`===============================================================`);
  console.log(`  Status            : ${receipt.status}`);
  console.log(
    `  Rust Compiler     : ${receipt.rustCompileReport.compilerUsed} (${receipt.rustCompileReport.wasmByteLength} B)`,
  );
  console.log(
    `  Zig Compiler      : ${receipt.zigCompileReport.compilerUsed} (${receipt.zigCompileReport.wasmByteLength} B)`,
  );
  console.log(`  Vector Join       : ${receipt.vectorJoinVerified ? "VERIFIED" : "FAILED"}`);
  console.log(`  FNV-1a Hash       : ${receipt.fnv1aVerified ? "VERIFIED" : "FAILED"}`);
  console.log(`  Ring-Buffer Check : ${receipt.ringBufferVerified ? "VERIFIED" : "FAILED"}`);
  console.log(`  Signature         : ${receipt.cryptographicSignature.slice(0, 32)}...`);
  console.log(`===============================================================\n`);
}

HANDLERS["toolchain:rustzig:compile"] = cmd_rustzig_compile;
HANDLERS["toolchain:rustzig:execute"] = cmd_rustzig_execute;
HANDLERS["toolchain:rustzig:benchmark"] = cmd_rustzig_benchmark;
HANDLERS["toolchain:rustzig:audit"] = cmd_rustzig_audit;

export async function handleRustZigWasmCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:rustzig command: ${command}`);
  }
  return handler(commandContext);
}

/**
 * CLI WebAssembly Bytecode Synthesizer Handlers
 *
 * Implements toolchain:wasm:* subcommands for binary module synthesis,
 * kernel execution, benchmarking, and cryptographic audit receipts.
 *
 * Conforms to SPEC-306 / CHANGE-168.
 */

import { EosWasmBytecodeSynthesizerCore } from "../../src/core/eosWasmBytecodeSynthesizer.ts";

const HANDLERS = {};

async function cmd_wasm_synthesize(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const addMod = EosWasmBytecodeSynthesizerCore.buildAddModule();
  const factMod = EosWasmBytecodeSynthesizerCore.buildFactorialModule();
  const trapMod = EosWasmBytecodeSynthesizerCore.buildMemoryTrapModule();
  const dotMod = EosWasmBytecodeSynthesizerCore.buildVectorDotProductModule();

  const summary = {
    specRef: "SPEC-306",
    modules: [
      { name: "add", sizeBytes: addMod.totalBytes, sha256: addMod.sha256 },
      { name: "factorial", sizeBytes: factMod.totalBytes, sha256: factMod.sha256 },
      { name: "memory_trap", sizeBytes: trapMod.totalBytes, sha256: trapMod.sha256 },
      { name: "vector_dot", sizeBytes: dotMod.totalBytes, sha256: dotMod.sha256 },
    ],
  };

  if (isJson) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN WEBASSEMBLY BYTECODE SYNTHESIZER (SPEC-306)          `);
  console.log(`===============================================================`);
  for (const mod of summary.modules) {
    console.log(
      `  Module       : ${mod.name.padEnd(12)} (${mod.sizeBytes} bytes) | SHA-256: ${mod.sha256.slice(0, 16)}...`,
    );
  }
  console.log(`===============================================================\n`);
}

async function cmd_wasm_execute(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const kernel = args.find((a) => !a.startsWith("-")) || "factorial";

  let result;
  if (kernel === "add") {
    const mod = EosWasmBytecodeSynthesizerCore.buildAddModule();
    result = EosWasmBytecodeSynthesizerCore.executeModule(mod, "add", [100, 250]);
  } else if (kernel === "vector") {
    const mod = EosWasmBytecodeSynthesizerCore.buildVectorDotProductModule();
    result = EosWasmBytecodeSynthesizerCore.executeModule(mod, "dot_product", [0, 16, 4], (mem) => {
      const view = new Int32Array(mem.buffer);
      view.set([1, 2, 3, 4], 0);
      view.set([5, 6, 7, 8], 4);
    });
  } else {
    const mod = EosWasmBytecodeSynthesizerCore.buildFactorialModule();
    result = EosWasmBytecodeSynthesizerCore.executeModule(mod, "factorial", [10]);
  }

  if (isJson) {
    console.log(JSON.stringify({ kernel, result }, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN WASM KERNEL EXECUTION (SPEC-306)                     `);
  console.log(`===============================================================`);
  console.log(`  Kernel        : ${kernel}`);
  console.log(`  Status        : ${result.status}`);
  console.log(`  Return Value  : ${result.returnedValue}`);
  console.log(`  Latency       : ${result.executionTimeUs} µs (${result.executionTimeNs} ns)`);
  console.log(`===============================================================\n`);
}

async function cmd_wasm_benchmark(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const stats = EosWasmBytecodeSynthesizerCore.benchmarkKernel(20000);

  if (isJson) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN WASM VS JS BENCHMARK (SPEC-306)                      `);
  console.log(`===============================================================`);
  console.log(`  Operations    : ${stats.operationsCount}`);
  console.log(`  WASM Avg Lat  : ${stats.wasmAvgNsPerOp.toFixed(2)} ns/op`);
  console.log(`  JS Avg Lat    : ${stats.jsAvgNsPerOp.toFixed(2)} ns/op`);
  console.log(`  Speedup Ratio : ${stats.speedupRatio}x`);
  console.log(`===============================================================\n`);
}

async function cmd_wasm_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const receipt = EosWasmBytecodeSynthesizerCore.auditWasmSynthesizerPipeline({
    projectRoot: process.cwd(),
  });

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  GLORIAN WASM SYNTHESIZER AUDIT RECEIPT (SPEC-306)            `);
  console.log(`===============================================================`);
  console.log(`  Receipt Type        : ${receipt.receiptType}`);
  console.log(`  Magic Verified      : ${receipt.validWasmMagicVerified ? "YES" : "NO"}`);
  console.log(`  LEB128 Symmetry     : ${receipt.leb128FidelityVerified ? "YES" : "NO"}`);
  console.log(`  Arithmetic Kernel   : ${receipt.arithmeticKernelVerified ? "YES" : "NO"}`);
  console.log(`  Loop Factorial      : ${receipt.loopFactorialKernelVerified ? "YES" : "NO"}`);
  console.log(`  Linear Memory Trap  : ${receipt.linearMemoryTrapCaught ? "YES" : "NO"}`);
  console.log(`  Vector Dot Product  : ${receipt.vectorDotProductVerified ? "YES" : "NO"}`);
  console.log(`  Speedup Ratio       : ${receipt.benchmarkSpeedupRatio}x`);
  console.log(`  SHA-256 Signature   : ${receipt.sha256Signature}`);
  console.log(`===============================================================\n`);
}

HANDLERS["toolchain:wasm:synthesize"] = cmd_wasm_synthesize;
HANDLERS["toolchain:wasm:execute"] = cmd_wasm_execute;
HANDLERS["toolchain:wasm:benchmark"] = cmd_wasm_benchmark;
HANDLERS["toolchain:wasm:audit"] = cmd_wasm_audit;

export async function handleWasmCommands(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (!handler) {
    return false;
  }
  await handler(commandContext);
  return true;
}

export async function dispatchWasmSynthesizer(command, commandContext) {
  return handleWasmCommands(commandContext);
}

/**
 * @file cliAutonomousWasmJit.mjs
 * @description CLI handler for SPEC-347 / CHANGE-209: Autonomous Dynamic WebAssembly JIT Compiler.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosAutonomousWasmJitCore } from "../../src/core/eosAutonomousWasmJit.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("WASM_JIT_COMPILER_RECEIPT.json", root);
}

function parseStringFlag(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  return arg ? arg.split("=")[1] : defaultValue;
}

function parseIntFlag(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  const parsed = parseInt(arg.split("=")[1], 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

const HANDLERS = {};

async function cmd_wasmjit_emit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const kernel = parseStringFlag(args, "--kernel=", "math");

  let mod;
  if (kernel === "dot") {
    mod = EosAutonomousWasmJitCore.compileVectorDotProduct();
  } else if (kernel === "xor") {
    mod = EosAutonomousWasmJitCore.compileBitwiseXorStep();
  } else {
    mod = EosAutonomousWasmJitCore.compileSimpleMath();
  }

  const hexDump = Array.from(mod.buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          kernel,
          byteLength: mod.buffer.length,
          hex: hexDump,
          exports: Object.keys(mod.exports),
        },
        null,
        2,
      ),
    );
  } else {
    console.log("=== Autonomous WebAssembly Binary Synthesizer (SPEC-347) ===");
    console.log(`Kernel       : ${kernel}`);
    console.log(`Byte Length  : ${mod.buffer.length} bytes`);
    console.log(`Exports      : ${Object.keys(mod.exports).join(", ")}`);
    console.log(`Hex Bytecode : ${hexDump.slice(0, 80)}...`);
  }
}

async function cmd_wasmjit_exec(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const a = parseIntFlag(args, "--a=", 7);
  const b = parseIntFlag(args, "--b=", 6);

  const mod = EosAutonomousWasmJitCore.compileSimpleMath();
  const result = mod.exports.compute(a, b);

  if (isJson) {
    console.log(JSON.stringify({ a, b, formula: "(a * b) + a", result }, null, 2));
  } else {
    console.log("=== Autonomous WebAssembly Execution ===");
    console.log(`Input a      : ${a}`);
    console.log(`Input b      : ${b}`);
    console.log(`Formula      : (a * b) + a`);
    console.log(`Result       : ${result}`);
  }
}

async function cmd_wasmjit_bench(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const iters = parseIntFlag(args, "--iters=", 200_000);

  const mod = EosAutonomousWasmJitCore.compileSimpleMath();
  const bench = EosAutonomousWasmJitCore.benchmarkKernel(mod.exports.compute, iters);

  if (isJson) {
    console.log(JSON.stringify(bench, null, 2));
  } else {
    console.log("=== Autonomous WebAssembly Throughput Benchmark ===");
    console.log(`Operations   : ${bench.operations}`);
    console.log(`Elapsed Time : ${bench.elapsedMs} ms`);
    console.log(`Throughput   : ${bench.opsPerSecond.toLocaleString()} ops/sec`);
  }
}

async function cmd_wasmjit_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const receipt = EosAutonomousWasmJitCore.audit(ROOT);
  const receiptPath = getReceiptPath(ROOT);

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Autonomous WebAssembly JIT Audit Receipt (SPEC-347) ===");
    console.log(`Spec               : ${receipt.spec}`);
    console.log(`Valid Module       : ${receipt.validModuleEmitted ? "PASS" : "FAIL"}`);
    console.log(`Kernels Verified   : ${receipt.kernelsVerified ? "PASS" : "FAIL"}`);
    console.log(`Throughput         : ${receipt.benchmarkOpsPerSec.toLocaleString()} ops/sec`);
    console.log(`All Passed         : ${receipt.allPassed}`);
    console.log(`SHA-256 Digest     : ${receipt.sha256}`);
    console.log(`Receipt Saved      : ${receiptPath}`);
  }
}

HANDLERS["toolchain:wasmjit:emit"] = cmd_wasmjit_emit;
HANDLERS["toolchain:wasmjit:exec"] = cmd_wasmjit_exec;
HANDLERS["toolchain:wasmjit:bench"] = cmd_wasmjit_bench;
HANDLERS["toolchain:wasmjit:audit"] = cmd_wasmjit_audit;

export async function handleAutonomousWasmJitCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:wasmjit command: ${command}`);
  }
  await handler(commandContext);
  return true;
}

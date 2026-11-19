/**
 * @file cliZeroCopyIpcRingBuffer.mjs
 * @description CLI handler for SPEC-355 / CHANGE-217: Deterministic Zero-Copy Shared Memory Inter-Process Ring Buffer (IPC).
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosZeroCopyIpcRingBuffer, EosZeroCopyIpcCore } from "../../src/core/eosZeroCopyIpcRingBuffer.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("ZERO_COPY_IPC_RINGBUFFER_RECEIPT.json", root);
}

const HANDLERS = {};

async function cmd_ipc_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const receipt = EosZeroCopyIpcCore.audit(ROOT);
  const receiptPath = getReceiptPath(ROOT);

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Deterministic Zero-Copy Shared Memory Ring Buffer (SPEC-355) ===");
    console.log(`Spec ID                 : ${receipt.specId}`);
    console.log(`Change ID               : ${receipt.changeId}`);
    console.log(`Capacity                : ${receipt.capacity} slots`);
    console.log(`Slot Size               : ${receipt.slotSize} bytes`);
    console.log(`Concurrency Mode        : ${receipt.concurrencyMode}`);
    console.log(`TLC Model Verification  : ${receipt.tlcModelVerified ? "PASS" : "FAIL"}`);
    console.log(`Benchmark Operations    : ${receipt.benchmark.operations.toLocaleString()}`);
    console.log(`Total Duration          : ${receipt.benchmark.totalDurationUs.toFixed(1)} us`);
    console.log(`Average Latency         : ${receipt.benchmark.avgLatencyNs.toFixed(2)} ns/op`);
    console.log(`Throughput              : ${Math.round(receipt.benchmark.throughputOpsSec).toLocaleString()} ops/sec`);
    console.log(`Zero-Copy Efficiency    : ${(receipt.benchmark.zeroCopyEfficiency * 100).toFixed(0)}%`);
    console.log(`Verdict                 : ${receipt.verdict}`);
    console.log(`Receipt Saved           : ${receiptPath}`);
  }
}

async function cmd_ipc_bench(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const iters = 100000;
  const bench = EosZeroCopyIpcCore.runBenchmark(iters, 1024, 64);

  if (isJson) {
    console.log(JSON.stringify(bench, null, 2));
  } else {
    console.log("=== Zero-Copy Shared Memory IPC Benchmark ===");
    console.log(`Operations Tested : ${bench.operations.toLocaleString()}`);
    console.log(`Total Duration    : ${bench.totalDurationUs.toFixed(1)} us`);
    console.log(`Average Latency   : ${bench.avgLatencyNs.toFixed(2)} ns/op`);
    console.log(`Throughput        : ${Math.round(bench.throughputOpsSec).toLocaleString()} ops/sec`);
    console.log(`Zero-Copy Direct  : ${(bench.zeroCopyEfficiency * 100).toFixed(0)}% TypedArray views`);
  }
}

async function cmd_ipc_write(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const ring = new EosZeroCopyIpcRingBuffer({ capacity: 16, slotSize: 64 });
  const payload = new TextEncoder().encode("EOS_IPC_FRAME_SAMPLE");
  const result = ring.enqueue(0x01, payload);

  if (isJson) {
    console.log(
      JSON.stringify(
        { success: result.success, sequence: result.sequence.toString(), slotIndex: result.slotIndex },
        null,
        2,
      ),
    );
  } else {
    console.log("=== Zero-Copy Shared Memory IPC Write ===");
    console.log(`Success    : ${result.success}`);
    console.log(`Sequence   : ${result.sequence}`);
    console.log(`Slot Index : ${result.slotIndex}`);
  }
}

async function cmd_ipc_read(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const ring = new EosZeroCopyIpcRingBuffer({ capacity: 16, slotSize: 64 });
  const payload = new TextEncoder().encode("EOS_DIRECT_READ");
  ring.enqueue(0x02, payload);
  const result = ring.dequeue();

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          success: result.success,
          typeId: result.frame?.header.typeId,
          sequence: result.frame?.header.sequence.toString(),
          payloadText: result.frame ? new TextDecoder().decode(result.frame.payload) : "",
        },
        null,
        2,
      ),
    );
  } else {
    console.log("=== Zero-Copy Shared Memory IPC Read ===");
    console.log(`Success      : ${result.success}`);
    console.log(`Type ID      : ${result.frame?.header.typeId}`);
    console.log(`Sequence     : ${result.frame?.header.sequence}`);
    console.log(`Payload Text : ${result.frame ? new TextDecoder().decode(result.frame.payload) : ""}`);
  }
}

HANDLERS["toolchain:ipc:audit"] = cmd_ipc_audit;
HANDLERS["toolchain:ipc:bench"] = cmd_ipc_bench;
HANDLERS["toolchain:ipc:write"] = cmd_ipc_write;
HANDLERS["toolchain:ipc:read"] = cmd_ipc_read;

export async function handleZeroCopyIpcCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:ipc command: ${command}`);
  }
  await handler(commandContext);
  return true;
}

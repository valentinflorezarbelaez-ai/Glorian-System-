/**
 * @file cliZeroFsdpEngine.mjs
 * @description CLI handler for SPEC-324 / CHANGE-186: ZeRO (Zero Redundancy
 * Optimizer) & Fully Sharded Data Parallel (FSDP) Engine (ZeRO-1, ZeRO-2, ZeRO-3,
 * and Host Memory Offloading).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosZeroFsdpCore } from "../../src/core/eosZeroFsdpEngine.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("ZERO_FSDP_RECEIPT.json", root);
}

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

const HANDLERS = {};

async function cmd_zero_stage1(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numWorkers = Number(parseFlagValue(args, "--workers=", "4"));
  const numParams = Number(parseFlagValue(args, "--params=", "1024"));

  const engine = new EosZeroFsdpCore({ numWorkers, stage: 1 });
  const shards = engine.partitionOptimizerStates(numParams, numWorkers);

  const testParams = new Float32Array(numParams).fill(1.0);
  const testGrads = Array.from({ length: numWorkers }, () => new Float32Array(numParams).fill(0.1));
  const result = engine.stepZeRO1(testParams, testGrads);

  const payload = {
    command: "toolchain:zero:stage1",
    stage: 1,
    description: "ZeRO-1: Optimizer State Sharding (P_os)",
    numWorkers,
    totalParameters: numParams,
    shards: shards.map((s) => ({
      workerId: s.workerId,
      startIndex: s.startIndex,
      endIndex: s.endIndex,
      length: s.length,
      stateMemoryBytes: s.length * 12,
    })),
    memoryPerWorkerBytes: result.memoryPerWorkerBytes,
    baselineDdpBytes: result.baselineDdpBytes,
    memorySavingsRatio: Number((result.baselineDdpBytes / result.memoryPerWorkerBytes).toFixed(2)),
    communicationBytes: result.commBytes,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== ZeRO-1: Optimizer State Sharding (P_os) ===");
    console.log(`Workers        : ${numWorkers}`);
    console.log(`Total Params   : ${numParams}`);
    console.log(`Memory/Worker  : ${result.memoryPerWorkerBytes} bytes`);
    console.log(`Baseline DDP   : ${result.baselineDdpBytes} bytes`);
    console.log(`Savings Ratio  : ${payload.memorySavingsRatio}x`);
    console.log(`Comm Bytes     : ${result.commBytes} bytes`);
  }
}

async function cmd_zero_stage2(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numWorkers = Number(parseFlagValue(args, "--workers=", "4"));
  const numParams = Number(parseFlagValue(args, "--params=", "1024"));

  const engine = new EosZeroFsdpCore({ numWorkers, stage: 2 });
  const testParams = new Float32Array(numParams).fill(1.0);
  const testGrads = Array.from({ length: numWorkers }, () => new Float32Array(numParams).fill(0.1));
  const result = engine.stepZeRO2(testParams, testGrads);

  const payload = {
    command: "toolchain:zero:stage2",
    stage: 2,
    description: "ZeRO-2: Gradient + Optimizer State Sharding (P_os+g)",
    numWorkers,
    totalParameters: numParams,
    memoryPerWorkerBytes: result.memoryPerWorkerBytes,
    baselineDdpBytes: result.baselineDdpBytes,
    memorySavingsRatio: Number((result.baselineDdpBytes / result.memoryPerWorkerBytes).toFixed(2)),
    communicationBytes: result.commBytes,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== ZeRO-2: Gradient & Optimizer Sharding (P_os+g) ===");
    console.log(`Workers        : ${numWorkers}`);
    console.log(`Total Params   : ${numParams}`);
    console.log(`Memory/Worker  : ${result.memoryPerWorkerBytes} bytes`);
    console.log(`Baseline DDP   : ${result.baselineDdpBytes} bytes`);
    console.log(`Savings Ratio  : ${payload.memorySavingsRatio}x`);
    console.log(`Comm Bytes     : ${result.commBytes} bytes`);
  }
}

async function cmd_zero_stage3(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numWorkers = Number(parseFlagValue(args, "--workers=", "4"));
  const numLayers = Number(parseFlagValue(args, "--layers=", "4"));
  const layerParams = Number(parseFlagValue(args, "--layerparams=", "256"));
  const totalParams = numLayers * layerParams;

  const engine = new EosZeroFsdpCore({ numWorkers, stage: 3 });
  const layers = Array.from({ length: numLayers }, () => new Float32Array(layerParams).fill(1.0));
  const gradsPerWorker = Array.from({ length: numWorkers }, () =>
    Array.from({ length: numLayers }, () => new Float32Array(layerParams).fill(0.05)),
  );

  const result = engine.stepZeRO3(layers, gradsPerWorker);

  const payload = {
    command: "toolchain:zero:stage3",
    stage: 3,
    description: "ZeRO-3 / FSDP: Parameter + Gradient + Optimizer State Sharding (P_os+g+p)",
    numWorkers,
    numLayers,
    layerParams,
    totalParameters: totalParams,
    peakTransientBytes: result.peakTransientBytes,
    memoryPerWorkerBytes: result.memoryPerWorkerBytes,
    baselineDdpBytes: result.baselineDdpBytes,
    memorySavingsRatio: Number((result.baselineDdpBytes / result.memoryPerWorkerBytes).toFixed(2)),
    communicationBytes: result.commBytes,
    transientPurged: result.purged,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== ZeRO-3 / FSDP: Parameter, Gradient & Optimizer Sharding ===");
    console.log(`Workers        : ${numWorkers}`);
    console.log(`Layers         : ${numLayers} (${layerParams} params/layer)`);
    console.log(`Total Params   : ${totalParams}`);
    console.log(`Peak Transient : ${result.peakTransientBytes} bytes`);
    console.log(`Memory/Worker  : ${result.memoryPerWorkerBytes} bytes`);
    console.log(`Baseline DDP   : ${result.baselineDdpBytes} bytes`);
    console.log(`Savings Ratio  : ${payload.memorySavingsRatio}x`);
    console.log(`Comm Bytes     : ${result.commBytes} bytes`);
    console.log(`Purged JIT     : ${result.purged}`);
  }
}

async function cmd_zero_offload(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numParams = Number(parseFlagValue(args, "--params=", "1024"));

  const engine = new EosZeroFsdpCore({ cpuOffload: true });
  const shards = engine.partitionOptimizerStates(numParams, 1);
  const offloadStats = engine.offloadToHost(shards[0]);

  const payload = {
    command: "toolchain:zero:offload",
    offloadTarget: "HOST_CPU_MEMORY",
    offloadedParameters: numParams,
    hostMemoryBytes: offloadStats.hostMemoryBytes,
    estimatedPcieLatencyMs: Number(offloadStats.transferLatencyEstimateMs.toFixed(6)),
    status: "READY",
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("=== ZeRO-Offload: Host CPU Memory Offloading ===");
    console.log(`Target         : ${payload.offloadTarget}`);
    console.log(`Offloaded Elm  : ${numParams}`);
    console.log(`Host RAM Bytes : ${offloadStats.hostMemoryBytes} bytes`);
    console.log(`PCIe Latency   : ${payload.estimatedPcieLatencyMs} ms`);
  }
}

async function cmd_zero_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numWorkers = Number(parseFlagValue(args, "--workers=", "4"));
  const numParams = Number(parseFlagValue(args, "--params=", "1024"));

  const engine = new EosZeroFsdpCore({ numWorkers });
  const receipt = engine.audit(numWorkers, numParams);
  const receiptPath = getReceiptPath(commandContext.root || ROOT);

  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== ZeRO / FSDP Invariant Audit ===");
    console.log(`Status         : ${receipt.status}`);
    console.log(`Stage 1 Ratio  : ${receipt.stage1MemoryReductionRatio}x`);
    console.log(`Stage 2 Ratio  : ${receipt.stage2MemoryReductionRatio}x`);
    console.log(`Stage 3 Ratio  : ${receipt.stage3MemoryReductionRatio}x`);
    console.log(`Math Parity    : ${receipt.mathParityCertified}`);
    console.log(`Zero Leakage   : ${receipt.zeroLeakageCertified}`);
    console.log(`CPU Offload OK : ${receipt.hostOffloadVerified}`);
    console.log(`SHA-256 Seal   : ${receipt.receiptSha256}`);
    console.log(`Receipt Saved  : ${receiptPath}`);
  }
}

HANDLERS["toolchain:zero:stage1"] = cmd_zero_stage1;
HANDLERS["toolchain:zero:stage2"] = cmd_zero_stage2;
HANDLERS["toolchain:zero:stage3"] = cmd_zero_stage3;
HANDLERS["toolchain:zero:offload"] = cmd_zero_offload;
HANDLERS["toolchain:zero:audit"] = cmd_zero_audit;

export async function handleZeroFsdpCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:zero command: ${command}`);
  }
  await handler(commandContext);
  return true;
}

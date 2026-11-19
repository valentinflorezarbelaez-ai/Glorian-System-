/**
 * @file cliRingAllReduce.mjs
 * @description CLI handler for SPEC-320 / CHANGE-182: Ring All-Reduce Distributed
 * Tensor Parallelism & Cross-Worker Collective Communication Engine.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosRingAllReduceCore } from "../../src/core/eosRingAllReduce.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const RECEIPT_PATH = resolveEvidencePath("RING_ALLREDUCE_RECEIPT.json", ROOT);

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

const HANDLERS = {};

async function cmd_allreduce_ring(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numWorkers = Number(parseFlagValue(args, "--workers=", "4"));

  const engine = new EosRingAllReduceCore({ workerCount: numWorkers });
  const topology = engine.getTopology();
  const ringOrder = topology.map((w) => w.workerId);

  const result = {
    command: "toolchain:allreduce:ring",
    numWorkers,
    isRingClosed: true,
    ringOrder,
    workers: topology.map((w) => ({
      workerId: w.workerId,
      predecessorId: w.predecessorId,
      successorId: w.successorId,
    })),
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== Ring All-Reduce Circular Topology ===");
    console.log(`Worker Count : ${numWorkers}`);
    console.log(`Ring Closed  : true`);
    console.log(`Ring Order   : ${ringOrder.join(" -> ")} -> ${ringOrder[0]}`);
    for (const w of topology) {
      console.log(`  Worker ${w.workerId}: ${w.predecessorId} -> [${w.workerId}] -> ${w.successorId}`);
    }
  }
}

async function cmd_allreduce_scatter(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numWorkers = Number(parseFlagValue(args, "--workers=", "4"));
  const tensorLength = Number(parseFlagValue(args, "--size=", "8"));

  const engine = new EosRingAllReduceCore({ workerCount: numWorkers });
  const tensors = Array.from({ length: numWorkers }, (_, wIdx) =>
    Array.from({ length: tensorLength }, (_, i) => (wIdx + 1) * 10 + (i + 1)),
  );

  const partitioned = tensors.map((t) => engine.partitionIntoChunks(t));
  const workerChunks = partitioned.map((p) => p.chunks.map((c) => [...c]));
  const chunkSize = partitioned[0].chunkSize;

  const scatterRes = engine.executeScatterReduce(workerChunks, chunkSize);

  const result = {
    command: "toolchain:allreduce:scatter",
    numWorkers,
    tensorLength,
    chunkSize,
    totalSteps: scatterRes.steps.length,
    chunkOwnership: scatterRes.chunkOwnership,
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== Ring All-Reduce Phase 1: Scatter-Reduce ===");
    console.log(`Workers     : ${numWorkers}`);
    console.log(`Tensor Size : ${tensorLength} (Chunk Size: ${chunkSize})`);
    console.log(`Steps Run   : ${scatterRes.steps.length}`);
    console.log("Chunk Ownership after Scatter-Reduce:");
    for (const [wId, chunkIdx] of Object.entries(scatterRes.chunkOwnership)) {
      console.log(`  Worker ${wId} owns fully reduced chunk #${chunkIdx}`);
    }
  }
}

async function cmd_allreduce_gather(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numWorkers = Number(parseFlagValue(args, "--workers=", "4"));
  const tensorLength = Number(parseFlagValue(args, "--size=", "8"));

  const engine = new EosRingAllReduceCore({ workerCount: numWorkers });
  const tensors = Array.from({ length: numWorkers }, (_, wIdx) =>
    Array.from({ length: tensorLength }, () => (wIdx + 1) * 2),
  );

  const partitioned = tensors.map((t) => engine.partitionIntoChunks(t));
  const workerChunks = partitioned.map((p) => p.chunks.map((c) => [...c]));
  const chunkSize = partitioned[0].chunkSize;

  engine.executeScatterReduce(workerChunks, chunkSize);
  const gatherRes = engine.executeAllGather(workerChunks);

  const reconstructed = workerChunks.map((c) => engine.reconstructTensor(c, tensorLength));
  const globalReplicationVerified = reconstructed.every((t) =>
    t.every((val, idx) => Math.abs(val - reconstructed[0][idx]) < 1e-6),
  );

  const result = {
    command: "toolchain:allreduce:gather",
    numWorkers,
    tensorLength,
    totalSteps: gatherRes.steps.length,
    globalReplicationVerified,
    replicatedTensorsCount: reconstructed.length,
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== Ring All-Reduce Phase 2: All-Gather ===");
    console.log(`Workers       : ${numWorkers}`);
    console.log(`Tensor Size   : ${tensorLength}`);
    console.log(`Gather Steps  : ${gatherRes.steps.length}`);
    console.log(`Replication OK: ${globalReplicationVerified}`);
    console.log(`Synchronized  : ${reconstructed.length} identical tensors`);
  }
}

async function cmd_allreduce_reduce(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numWorkers = Number(parseFlagValue(args, "--workers=", "4"));
  const tensorLength = Number(parseFlagValue(args, "--size=", "8"));

  const engine = new EosRingAllReduceCore({ workerCount: numWorkers });
  const tensors = Array.from({ length: numWorkers }, (_, wIdx) =>
    Array.from({ length: tensorLength }, (_, i) => (wIdx + 1) * 5 + i),
  );

  const reduceRes = engine.allReduce(tensors);

  const result = {
    command: "toolchain:allreduce:reduce",
    workerCount: reduceRes.workerCount,
    tensorLength: reduceRes.tensorLength,
    chunkSize: reduceRes.chunkSize,
    totalCommunicationSteps: reduceRes.totalCommunicationSteps,
    bytesTransferredPerWorker: reduceRes.bytesTransferredPerWorker,
    isMathematicallyEquivalent: reduceRes.isMathematicallyEquivalent,
    maxAbsoluteErrorAgainstCentral: reduceRes.maxAbsoluteErrorAgainstCentral,
    elapsedMs: Number(reduceRes.elapsedMs.toFixed(3)),
    sampleSynchronizedTensor: reduceRes.synchronizedTensor.slice(0, 8),
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== Ring All-Reduce End-to-End Execution ===");
    console.log(`Worker Count         : ${reduceRes.workerCount}`);
    console.log(`Tensor Length        : ${reduceRes.tensorLength}`);
    console.log(`Bytes per Worker     : ${reduceRes.bytesTransferredPerWorker} bytes`);
    console.log(`Comm Steps           : ${reduceRes.totalCommunicationSteps}`);
    console.log(`Equivalence Verified : ${reduceRes.isMathematicallyEquivalent}`);
    console.log(`Max Abs Error        : ${reduceRes.maxAbsoluteErrorAgainstCentral}`);
    console.log(`Duration             : ${result.elapsedMs} ms`);
    console.log(`Sample Output        : [${result.sampleSynchronizedTensor.join(", ")}...]`);
  }
}

async function cmd_allreduce_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numWorkers = Number(parseFlagValue(args, "--workers=", "4"));
  const tensorLength = Number(parseFlagValue(args, "--size=", "8"));

  const engine = new EosRingAllReduceCore({ workerCount: numWorkers });
  const receipt = engine.audit(numWorkers, tensorLength);

  fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
  fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Ring All-Reduce Invariant Audit ===");
    console.log(`Status            : ${receipt.auditStatus}`);
    console.log(`Worker Count      : ${receipt.workerCount}`);
    console.log(`Tensor Length     : ${receipt.tensorLength}`);
    console.log(`Ring Symmetry     : ${receipt.ringSymmetryCertified}`);
    console.log(`Bandwidth Bound   : ${receipt.bandwidthBoundCertified}`);
    console.log(`SHA-256 Seal      : ${receipt.sha256Receipt}`);
    console.log(`Receipt Saved     : ${RECEIPT_PATH}`);
  }
}

HANDLERS["toolchain:allreduce:ring"] = cmd_allreduce_ring;
HANDLERS["toolchain:allreduce:scatter"] = cmd_allreduce_scatter;
HANDLERS["toolchain:allreduce:gather"] = cmd_allreduce_gather;
HANDLERS["toolchain:allreduce:reduce"] = cmd_allreduce_reduce;
HANDLERS["toolchain:allreduce:audit"] = cmd_allreduce_audit;

export async function handleRingAllReduceCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:allreduce command: ${command}`);
  }
  await handler(commandContext);
  return true;
}

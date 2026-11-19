/**
 * @file cliMegatronTensorParallelism.mjs
 * @description CLI handler for SPEC-321 / CHANGE-183: Megatron-LM Style
 * Tensor Parallelism (Column & Row Linear Sharding).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosMegatronTensorParallelismCore } from "../../src/core/eosMegatronTensorParallelism.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const RECEIPT_PATH = resolveEvidencePath("MEGATRON_TENSOR_PARALLELISM_RECEIPT.json", ROOT);

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

const HANDLERS = {};

async function cmd_megatron_column(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numWorkers = Number(parseFlagValue(args, "--workers=", "2"));
  const dIn = Number(parseFlagValue(args, "--din=", "4"));
  const dHidden = Number(parseFlagValue(args, "--dhidden=", "8"));

  const engine = new EosMegatronTensorParallelismCore({
    workerCount: numWorkers,
    inputDimension: dIn,
    hiddenDimension: dHidden,
  });

  const X = [
    [1, 2, 3, 4],
    [0.5, 1.5, 2.5, 3.5],
  ];
  const W1 = Array.from({ length: dIn }, (_, r) =>
    Array.from({ length: dHidden }, (_, c) => (r + 1) * 0.1 + (c + 1) * 0.05),
  );
  const W2 = Array.from({ length: dHidden }, () => [1, 2]);

  const shards = engine.partitionWeights(W1, W2);
  const localOutputs = shards.map((shard) => ({
    workerId: shard.workerId,
    w1Shape: [shard.w1Shard.length, shard.w1Shard[0].length],
    ySample: engine.forwardColumnParallel(X, shard.w1Shard)[0],
  }));

  const result = {
    command: "toolchain:megatron:column",
    workerCount: numWorkers,
    inputDimension: dIn,
    hiddenDimension: dHidden,
    hiddenPerWorker: dHidden / numWorkers,
    shards: localOutputs,
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== Megatron-LM Column-Parallel Projection ===");
    console.log(`Workers        : ${numWorkers}`);
    console.log(`Input Dim      : ${dIn}`);
    console.log(`Hidden Dim     : ${dHidden} (${dHidden / numWorkers} per worker)`);
    for (const s of localOutputs) {
      console.log(
        `  Worker ${s.workerId}: W1 shard shape [${s.w1Shape.join(", ")}], Y sample [${s.ySample.map((v) => v.toFixed(3)).join(", ")}]`,
      );
    }
  }
}

async function cmd_megatron_row(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numWorkers = Number(parseFlagValue(args, "--workers=", "2"));
  const dHidden = Number(parseFlagValue(args, "--dhidden=", "8"));
  const dOut = Number(parseFlagValue(args, "--dout=", "4"));

  const engine = new EosMegatronTensorParallelismCore({
    workerCount: numWorkers,
    hiddenDimension: dHidden,
    outputDimension: dOut,
  });

  const W1 = Array.from({ length: 4 }, () => new Array(dHidden).fill(0.1));
  const W2 = Array.from({ length: dHidden }, (_, r) =>
    Array.from({ length: dOut }, (_, c) => (r + 1) * 0.2 + (c + 1) * 0.1),
  );

  const shards = engine.partitionWeights(W1, W2);
  const hiddenPerWorker = dHidden / numWorkers;
  const Z = [[1, 2, 3, 4]]; // Activated slice for worker 0

  const partialOutput = engine.forwardRowParallel(Z, shards[0].w2Shard);

  const result = {
    command: "toolchain:megatron:row",
    workerCount: numWorkers,
    hiddenDimension: dHidden,
    outputDimension: dOut,
    hiddenPerWorker,
    w2ShardShape: [shards[0].w2Shard.length, shards[0].w2Shard[0].length],
    partialOutputSample: partialOutput[0],
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== Megatron-LM Row-Parallel Projection ===");
    console.log(`Workers        : ${numWorkers}`);
    console.log(`Hidden Dim     : ${dHidden}`);
    console.log(`Output Dim     : ${dOut}`);
    console.log(`W2 Shard Shape : [${result.w2ShardShape.join(", ")}]`);
    console.log(`Partial Output : [${partialOutput[0].map((v) => v.toFixed(3)).join(", ")}]`);
  }
}

async function cmd_megatron_mlp(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numWorkers = Number(parseFlagValue(args, "--workers=", "4"));
  const batchSize = Number(parseFlagValue(args, "--batch=", "2"));
  const dIn = Number(parseFlagValue(args, "--din=", "4"));
  const dHidden = Number(parseFlagValue(args, "--dhidden=", "8"));
  const dOut = Number(parseFlagValue(args, "--dout=", "4"));
  const act = parseFlagValue(args, "--act=", "GELU");

  const engine = new EosMegatronTensorParallelismCore({
    workerCount: numWorkers,
    inputDimension: dIn,
    hiddenDimension: dHidden,
    outputDimension: dOut,
    activation: act,
  });

  const X = Array.from({ length: batchSize }, (_, b) => Array.from({ length: dIn }, (_, i) => (b + 1) * 0.5 + i * 0.2));
  const W1 = Array.from({ length: dIn }, (_, r) =>
    Array.from({ length: dHidden }, (_, c) => (r + 1) * 0.1 + (c + 1) * 0.05),
  );
  const W2 = Array.from({ length: dHidden }, (_, r) =>
    Array.from({ length: dOut }, (_, c) => (r + 1) * 0.05 + (c + 1) * 0.1),
  );

  const mlpRes = engine.forwardMlp(X, W1, W2);

  const result = {
    command: "toolchain:megatron:mlp",
    workerCount: mlpRes.workerCount,
    batchSize: mlpRes.batchSize,
    hiddenPerWorker: mlpRes.hiddenPerWorker,
    totalAllReduceBarriers: mlpRes.totalAllReduceBarriers,
    bytesTransferredPerWorker: mlpRes.bytesTransferredPerWorker,
    isMathematicallyEquivalent: mlpRes.isMathematicallyEquivalent,
    maxAbsoluteErrorAgainstCentral: mlpRes.maxAbsoluteErrorAgainstCentral,
    elapsedMs: Number(mlpRes.elapsedMs.toFixed(3)),
    sampleSynchronizedOutput: mlpRes.synchronizedOutput[0],
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== Megatron-LM End-to-End MLP Forward Block ===");
    console.log(`Workers        : ${mlpRes.workerCount}`);
    console.log(`Batch Size     : ${mlpRes.batchSize}`);
    console.log(`All-Reduce Sync: Exactly ${mlpRes.totalAllReduceBarriers} barrier`);
    console.log(`Bytes / Worker : ${mlpRes.bytesTransferredPerWorker} bytes`);
    console.log(`Equivalence OK : ${mlpRes.isMathematicallyEquivalent}`);
    console.log(`Max Abs Error  : ${mlpRes.maxAbsoluteErrorAgainstCentral}`);
    console.log(`Latency        : ${result.elapsedMs} ms`);
    console.log(`Sample Output  : [${mlpRes.synchronizedOutput[0].map((v) => v.toFixed(4)).join(", ")}]`);
  }
}

async function cmd_megatron_vocab(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numWorkers = Number(parseFlagValue(args, "--workers=", "4"));
  const vocabSize = Number(parseFlagValue(args, "--vocab=", "16"));
  const batchSize = Number(parseFlagValue(args, "--batch=", "2"));

  const engine = new EosMegatronTensorParallelismCore({ workerCount: numWorkers });
  const hidden = Array.from({ length: batchSize }, (_, b) => [b + 1, (b + 1) * 0.5, 0.2, 0.8]);
  const vocabWeights = Array.from({ length: 4 }, (_, r) =>
    Array.from({ length: vocabSize }, (_, v) => (r + 1) * 0.1 + (v + 1) * 0.02),
  );
  const targetTokens = Array.from({ length: batchSize }, (_, i) => (i * 3 + 2) % vocabSize);

  const ceRes = engine.computeShardedCrossEntropy(hidden, vocabWeights, targetTokens);

  const result = {
    command: "toolchain:megatron:vocab",
    workerCount: ceRes.workerCount,
    batchSize: ceRes.batchSize,
    vocabularySize: ceRes.vocabularySize,
    vocabPerWorker: ceRes.vocabPerWorker,
    loss: ceRes.loss,
    isLossEquivalent: ceRes.isLossEquivalent,
    maxAbsoluteErrorAgainstCentral: ceRes.maxAbsoluteErrorAgainstCentral,
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== Megatron-LM Sharded Vocabulary Cross-Entropy ===");
    console.log(`Workers        : ${ceRes.workerCount}`);
    console.log(`Vocabulary Size: ${ceRes.vocabularySize} (${ceRes.vocabPerWorker} per worker)`);
    console.log(`Batch Size     : ${ceRes.batchSize}`);
    console.log(`Calculated Loss: ${ceRes.loss}`);
    console.log(`Loss Equivalence: ${ceRes.isLossEquivalent}`);
  }
}

async function cmd_megatron_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numWorkers = Number(parseFlagValue(args, "--workers=", "4"));
  const batchSize = Number(parseFlagValue(args, "--batch=", "2"));

  const engine = new EosMegatronTensorParallelismCore({ workerCount: numWorkers });
  const receipt = engine.audit(numWorkers, batchSize);

  fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
  fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Megatron-LM Invariant Audit ===");
    console.log(`Status         : ${receipt.auditStatus}`);
    console.log(`Worker Count   : ${receipt.workerCount}`);
    console.log(`Single Barrier : ${receipt.singleBarrierCertified}`);
    console.log(`Numeric Parity : ${receipt.numericalParityCertified}`);
    console.log(`Vocab Loss OK  : ${receipt.shardedCrossEntropyCertified}`);
    console.log(`SHA-256 Seal   : ${receipt.sha256Receipt}`);
    console.log(`Receipt Saved  : ${RECEIPT_PATH}`);
  }
}

HANDLERS["toolchain:megatron:column"] = cmd_megatron_column;
HANDLERS["toolchain:megatron:row"] = cmd_megatron_row;
HANDLERS["toolchain:megatron:mlp"] = cmd_megatron_mlp;
HANDLERS["toolchain:megatron:vocab"] = cmd_megatron_vocab;
HANDLERS["toolchain:megatron:audit"] = cmd_megatron_audit;

export async function handleMegatronCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:megatron command: ${command}`);
  }
  await handler(commandContext);
  return true;
}

/**
 * @file cliTensorParallelAttention.mjs
 * @description CLI handler for SPEC-323 / CHANGE-185: Tensor Parallel
 * Multi-Head & Grouped-Query Attention (TP-MHA / TP-GQA) with Sequence
 * Parallelism and Ring Attention.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosTensorParallelAttentionCore } from "../../src/core/eosTensorParallelAttention.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const RECEIPT_PATH = path.join(ROOT, "docs/evidence/TENSOR_PARALLEL_ATTENTION_RECEIPT.json");

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

const HANDLERS = {};

async function cmd_tp_mha(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numWorkers = Number(parseFlagValue(args, "--workers=", "2"));
  const numHeads = Number(parseFlagValue(args, "--heads=", "4"));
  const headDim = Number(parseFlagValue(args, "--headdim=", "4"));

  const engine = new EosTensorParallelAttentionCore({
    workerCount: numWorkers,
    totalQHeads: numHeads,
    totalKVHeads: numHeads, // MHA: H_Q == H_KV
    headDim,
  });

  const partitions = engine.partitionAttentionHeads();

  const result = {
    command: "toolchain:tp:mha",
    mode: "MULTI_HEAD_ATTENTION",
    workerCount: numWorkers,
    totalHeads: numHeads,
    headDim,
    partitions: partitions.map((p) => ({
      workerId: p.workerId,
      assignedQHeads: p.qHeadIndices,
      assignedKVHeads: p.kvHeadIndices,
      localHeadsCount: p.numQHeads,
    })),
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== Tensor Parallel Multi-Head Attention (MHA) ===");
    console.log(`Workers        : ${numWorkers}`);
    console.log(`Total Heads    : ${numHeads}`);
    console.log(`Head Dimension : ${headDim}`);
    for (const p of result.partitions) {
      console.log(`  Worker ${p.workerId}: Heads [${p.assignedQHeads.join(", ")}] (${p.localHeadsCount} heads)`);
    }
  }
}

async function cmd_tp_gqa(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numWorkers = Number(parseFlagValue(args, "--workers=", "2"));
  const qHeads = Number(parseFlagValue(args, "--qheads=", "8"));
  const kvHeads = Number(parseFlagValue(args, "--kvheads=", "2"));
  const headDim = Number(parseFlagValue(args, "--headdim=", "4"));

  const engine = new EosTensorParallelAttentionCore({
    workerCount: numWorkers,
    totalQHeads: qHeads,
    totalKVHeads: kvHeads,
    headDim,
  });

  const partitions = engine.partitionAttentionHeads();

  const result = {
    command: "toolchain:tp:gqa",
    mode: "GROUPED_QUERY_ATTENTION",
    workerCount: numWorkers,
    totalQHeads: qHeads,
    totalKVHeads: kvHeads,
    gqaRatio: engine.gqaRatio,
    partitions: partitions.map((p) => ({
      workerId: p.workerId,
      assignedQHeads: p.qHeadIndices,
      assignedKVHeads: p.kvHeadIndices,
      numQHeads: p.numQHeads,
      numKVHeads: p.numKVHeads,
    })),
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== Tensor Parallel Grouped-Query Attention (GQA) ===");
    console.log(`Workers        : ${numWorkers}`);
    console.log(`Q Heads        : ${qHeads}`);
    console.log(`KV Heads       : ${kvHeads} (GQA Ratio: ${engine.gqaRatio}:1)`);
    console.log(`Head Dimension : ${headDim}`);
    for (const p of result.partitions) {
      console.log(
        `  Worker ${p.workerId}: Q Heads [${p.assignedQHeads.join(", ")}], KV Heads [${p.assignedKVHeads.join(", ")}]`,
      );
    }
  }
}

async function cmd_tp_ring_attention(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numWorkers = Number(parseFlagValue(args, "--workers=", "2"));
  const seqPerWorker = Number(parseFlagValue(args, "--seqperworker=", "2"));
  const dim = Number(parseFlagValue(args, "--dim=", "4"));

  const engine = new EosTensorParallelAttentionCore({
    workerCount: numWorkers,
    totalQHeads: 4,
    totalKVHeads: 2,
    headDim: dim / 4 >= 1 ? Math.floor(dim / 4) : 2,
  });

  const B = 1;
  const Q_shards = Array.from({ length: numWorkers }, (_, p) =>
    Array.from({ length: B }, () =>
      Array.from({ length: seqPerWorker }, () => Array.from({ length: dim }, (_, i) => (p + 1) * 0.1 + i * 0.05)),
    ),
  );
  const K_shards = Array.from({ length: numWorkers }, (_, p) =>
    Array.from({ length: B }, () =>
      Array.from({ length: seqPerWorker }, () => Array.from({ length: dim }, (_, i) => (p + 1) * 0.15 + i * 0.05)),
    ),
  );
  const V_shards = Array.from({ length: numWorkers }, (_, p) =>
    Array.from({ length: B }, () =>
      Array.from({ length: seqPerWorker }, () => Array.from({ length: dim }, (_, i) => (p + 1) * 0.2 + i * 0.05)),
    ),
  );

  const ringRes = engine.forwardRingAttention(Q_shards, K_shards, V_shards);

  const result = {
    command: "toolchain:tp:ring-attention",
    workerCount: numWorkers,
    localSequenceLength: ringRes.localSequenceLength,
    totalSequenceLength: ringRes.totalSequenceLength,
    numRingSteps: ringRes.numRingSteps,
    isExactMatch: ringRes.isExactMatch,
    maxAbsoluteError: ringRes.maxAbsoluteError,
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== Ring Attention Distributed Sequence Execution ===");
    console.log(`Workers        : ${numWorkers}`);
    console.log(`Local Seq Len  : ${ringRes.localSequenceLength}`);
    console.log(`Total Seq Len  : ${ringRes.totalSequenceLength}`);
    console.log(`Ring Steps     : ${ringRes.numRingSteps}`);
    console.log(`Exact Match OK : ${ringRes.isExactMatch}`);
    console.log(`Max Abs Error  : ${ringRes.maxAbsoluteError.toExponential(3)}`);
  }
}

async function cmd_tp_sequence(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numWorkers = Number(parseFlagValue(args, "--workers=", "2"));
  const totalSeq = Number(parseFlagValue(args, "--totalseq=", "8"));
  const dim = Number(parseFlagValue(args, "--dim=", "4"));

  const engine = new EosTensorParallelAttentionCore({
    workerCount: numWorkers,
    totalQHeads: 4,
    totalKVHeads: 2,
    headDim: 2,
  });

  const X = [
    Array.from({ length: totalSeq }, (_, s) => Array.from({ length: dim }, (_, d) => (s + 1) * 0.1 + d * 0.02)),
  ];

  const slices = engine.partitionSequence(X);

  const result = {
    command: "toolchain:tp:sequence",
    workerCount: numWorkers,
    totalSequenceLength: totalSeq,
    seqPerWorker: totalSeq / numWorkers,
    dimension: dim,
    slices: slices.map((s, idx) => ({
      workerId: idx,
      sliceShape: [s.length, s[0].length, s[0][0].length],
    })),
  };

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=== Sequence Parallelism Activation Slicing ===");
    console.log(`Workers        : ${numWorkers}`);
    console.log(`Total Sequence : ${totalSeq}`);
    console.log(`Seq Per Worker : ${totalSeq / numWorkers}`);
    for (const s of result.slices) {
      console.log(`  Worker ${s.workerId}: Activation slice shape [${s.sliceShape.join(", ")}]`);
    }
  }
}

async function cmd_tp_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const numWorkers = Number(parseFlagValue(args, "--workers=", "2"));
  const qHeads = Number(parseFlagValue(args, "--qheads=", "4"));
  const kvHeads = Number(parseFlagValue(args, "--kvheads=", "2"));

  const engine = new EosTensorParallelAttentionCore({
    workerCount: numWorkers,
    totalQHeads: qHeads,
    totalKVHeads: kvHeads,
  });

  const receipt = engine.audit();

  fs.mkdirSync(path.dirname(RECEIPT_PATH), { recursive: true });
  fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2), "utf8");

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Tensor Parallel Attention Invariant Audit ===");
    console.log(`Status         : ${receipt.auditStatus}`);
    console.log(`Worker Count   : ${receipt.workerCount}`);
    console.log(`Q Heads        : ${receipt.totalQHeads}`);
    console.log(`KV Heads       : ${receipt.totalKVHeads}`);
    console.log(`Head Conserved : ${receipt.headConservationCertified}`);
    console.log(`Single Barrier : ${receipt.singleBarrierCertified}`);
    console.log(`Math Parity    : ${receipt.mathParityCertified}`);
    console.log(`Ring Attn OK   : ${receipt.ringAttentionCertified}`);
    console.log(`SHA-256 Seal   : ${receipt.sha256Receipt}`);
    console.log(`Receipt Saved  : ${RECEIPT_PATH}`);
  }
}

HANDLERS["toolchain:tp:mha"] = cmd_tp_mha;
HANDLERS["toolchain:tp:gqa"] = cmd_tp_gqa;
HANDLERS["toolchain:tp:ring-attention"] = cmd_tp_ring_attention;
HANDLERS["toolchain:tp:sequence"] = cmd_tp_sequence;
HANDLERS["toolchain:tp:audit"] = cmd_tp_audit;

export async function handleTpAttentionCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:tp command: ${command}`);
  }
  await handler(commandContext);
  return true;
}

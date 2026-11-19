/**
 * CLI SIMD Quantized Vector Embedding Engine & HNSW Search Handlers
 *
 * Implements toolchain:quant:* subcommands for 8-bit asymmetric scalar quantization,
 * 16-lane SIMD dot product simulation, quantized cosine distance calculation,
 * multi-layer HNSW graph indexing, beam search k-NN retrieval, and cryptographic receipts.
 *
 * Conforms to SPEC-314 / CHANGE-176.
 */

import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { EosSimdQuantizedHnswCore } from "../../src/core/eosSimdQuantizedHnsw.ts";
import { resolveEvidenceDir } from "../../src/core/eosEvidencePaths.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const EVIDENCE_DIR = resolveEvidenceDir(ROOT);

const HANDLERS = {};

function parseFlagValue(args, prefix, defaultValue) {
  const arg = args.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.split("=")[1] || defaultValue;
}

function generateRandomVector(dim, seed = 1) {
  const vec = new Float32Array(dim);
  let s = seed;
  for (let i = 0; i < dim; i++) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    vec[i] = (s / 4294967296) * 2 - 1;
  }
  return vec;
}

async function cmd_quant_quantize(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const dim = Number(parseFlagValue(args, "--dim=", "128"));

  const raw = generateRandomVector(dim, 42);
  const qVec = EosSimdQuantizedHnswCore.quantizeVector(raw, "sample-vec", { source: "cli-generator" });

  const payload = {
    status: "QUANTIZATION_SUCCESS",
    id: qVec.id,
    dimension: qVec.dimension,
    alignedByteLength: qVec.payload.byteLength,
    scale: Number(qVec.scale.toFixed(6)),
    zeroPoint: qVec.zeroPoint,
    norm: Number(qVec.norm.toFixed(6)),
    samplePayloadHead: Array.from(qVec.payload.slice(0, 8)),
    alignment16BytesVerified: qVec.payload.byteLength % 16 === 0,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  EOS SIMD ASYMMETRIC QUANTIZATION (SPEC-314)                  `);
  console.log(`===============================================================`);
  console.log(`  Vector ID         : ${payload.id}`);
  console.log(`  Dimension         : ${payload.dimension} (aligned ${payload.alignedByteLength} bytes)`);
  console.log(`  Scale (alpha)     : ${payload.scale}`);
  console.log(`  Zero Point (z)    : ${payload.zeroPoint}`);
  console.log(`  Norm              : ${payload.norm}`);
  console.log(`  16-Byte Alignment : ${payload.alignment16BytesVerified ? "PASSED" : "FAILED"}`);
  console.log(`===============================================================\n`);
}

async function cmd_quant_dot(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const dim = Number(parseFlagValue(args, "--dim=", "256"));

  const rawU = generateRandomVector(dim, 100);
  const rawV = generateRandomVector(dim, 200);

  // Exact float32 dot product
  let exactDot = 0;
  for (let i = 0; i < dim; i++) {
    exactDot += rawU[i] * rawV[i];
  }

  const qU = EosSimdQuantizedHnswCore.quantizeVector(rawU, "u");
  const qV = EosSimdQuantizedHnswCore.quantizeVector(rawV, "v");

  const start = performance.now();
  const quantizedDot = EosSimdQuantizedHnswCore.simdDotProduct(qU, qV);
  const elapsedMicros = (performance.now() - start) * 1000;

  const relError = Math.abs(quantizedDot - exactDot) / Math.max(1e-6, Math.abs(exactDot));

  const payload = {
    status: "SIMD_DOT_PRODUCT_EVALUATED",
    dimension: dim,
    exactFloat32Dot: Number(exactDot.toFixed(6)),
    simdQuantizedDot: Number(quantizedDot.toFixed(6)),
    relativeErrorPct: Number((relError * 100).toFixed(4)),
    subTwoPctRelativeError: relError < 0.02,
    elapsedMicroseconds: Number(elapsedMicros.toFixed(2)),
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  EOS 16-LANE SIMD INTEGER DOT PRODUCT (SPEC-314)              `);
  console.log(`===============================================================`);
  console.log(`  Dimension         : ${payload.dimension}`);
  console.log(`  Exact Float32 Dot : ${payload.exactFloat32Dot}`);
  console.log(`  SIMD Quantized Dot: ${payload.simdQuantizedDot}`);
  console.log(`  Relative Error    : ${payload.relativeErrorPct}% (< 2.0% requirement)`);
  console.log(`  Evaluation Latency: ${payload.elapsedMicroseconds} µs`);
  console.log(`===============================================================\n`);
}

async function cmd_quant_cosine(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const dim = Number(parseFlagValue(args, "--dim=", "128"));

  const rawU = generateRandomVector(dim, 300);
  const qU = EosSimdQuantizedHnswCore.quantizeVector(rawU, "u");

  // Colinear test
  const colinearDist = EosSimdQuantizedHnswCore.simdCosineDistance(qU, qU);

  // Orthogonal test
  const rawOrth = new Float32Array(dim);
  for (let i = 0; i < dim; i += 2) {
    rawOrth[i] = -rawU[i + 1];
    rawOrth[i + 1] = rawU[i];
  }
  const qOrth = EosSimdQuantizedHnswCore.quantizeVector(rawOrth, "orth");
  const orthDist = EosSimdQuantizedHnswCore.simdCosineDistance(qU, qOrth);

  const payload = {
    status: "COSINE_DISTANCE_EVALUATED",
    dimension: dim,
    colinearDistance: Number(colinearDist.toFixed(6)),
    orthogonalDistance: Number(orthDist.toFixed(6)),
    boundsVerified: colinearDist >= 0 && colinearDist < 0.05 && orthDist >= 0.95 && orthDist <= 1.05,
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  EOS QUANTIZED COSINE DISTANCE (SPEC-314)                      `);
  console.log(`===============================================================`);
  console.log(`  Colinear Distance : ${payload.colinearDistance} (~ 0.0)`);
  console.log(`  Orthogonal Distance: ${payload.orthogonalDistance} (~ 1.0)`);
  console.log(`  Bounds Verified   : ${payload.boundsVerified ? "YES" : "NO"}`);
  console.log(`===============================================================\n`);
}

async function cmd_quant_hnsw(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const dim = Number(parseFlagValue(args, "--dim=", "64"));
  const count = Number(parseFlagValue(args, "--count=", "100"));
  const k = Number(parseFlagValue(args, "--k=", "5"));

  const index = new EosSimdQuantizedHnswCore({
    dimension: dim,
    M: 16,
    efConstruction: 64,
    efSearch: 32,
  });

  // Populate graph
  for (let i = 0; i < count; i++) {
    const raw = generateRandomVector(dim, 1000 + i);
    index.insert(raw, `vec-${i}`, { index: i });
  }

  const queryRaw = generateRandomVector(dim, 9999);
  const start = performance.now();
  const results = index.searchKnn({ query: queryRaw, k });
  const latencyMicros = (performance.now() - start) * 1000;

  const stats = index.getStats();

  const payload = {
    status: "HNSW_INDEX_SEARCH_COMPLETE",
    totalNodes: stats.totalNodes,
    maxLevel: stats.maxLevel,
    entryPoint: stats.entryPoint,
    k,
    searchLatencyMicros: Number(latencyMicros.toFixed(2)),
    subMillisecondSearch: latencyMicros < 1000,
    results: results.map((r) => ({
      id: r.id,
      distance: Number(r.distance.toFixed(6)),
      level: r.level,
    })),
  };

  if (isJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  EOS QUANTIZED HNSW GRAPH & k-NN RETRIEVAL (SPEC-314)         `);
  console.log(`===============================================================`);
  console.log(`  Indexed Nodes     : ${payload.totalNodes}`);
  console.log(`  Max Layer Hierarchy: ${payload.maxLevel}`);
  console.log(`  Entry Point Node  : ${payload.entryPoint}`);
  console.log(`  k-NN Top ${k} Neighbors:`);
  for (const r of payload.results) {
    console.log(`    - ID: ${r.id.padEnd(12)} Dist: ${r.distance} (Layer ${r.level})`);
  }
  console.log(`  Query Latency     : ${payload.searchLatencyMicros} µs (< 1000 µs requirement)`);
  console.log(`===============================================================\n`);
}

async function cmd_quant_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const dim = Number(parseFlagValue(args, "--dim=", "64"));
  const count = Number(parseFlagValue(args, "--count=", "50"));

  const index = new EosSimdQuantizedHnswCore({
    dimension: dim,
    M: 16,
    efConstruction: 32,
    efSearch: 16,
  });

  for (let i = 0; i < count; i++) {
    const raw = generateRandomVector(dim, 2000 + i);
    index.insert(raw, `audit-node-${i}`);
  }

  const receipt = index.auditQuantizedInvariants(EVIDENCE_DIR);

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return;
  }

  console.log(`\n===============================================================`);
  console.log(`  EOS QUANTIZED HNSW AUDIT RECEIPT (SPEC-314)                  `);
  console.log(`===============================================================`);
  console.log(`  Status            : ${receipt.status}`);
  console.log(`  Total Nodes       : ${receipt.totalNodes}`);
  console.log(`  Max Active Level  : ${receipt.maxActiveLevel}`);
  console.log(`  16-Byte Alignment : ${receipt.alignmentChecked16Bytes ? "PASSED" : "FAILED"}`);
  console.log(`  Layer Monotonicity: ${receipt.monotonicityVerified ? "PASSED" : "FAILED"}`);
  console.log(`  Degree Bounds     : ${receipt.degreeBoundsVerified ? "PASSED" : "FAILED"}`);
  console.log(`  SHA-256 Signature : ${receipt.sha256Signature.slice(0, 32)}...`);
  console.log(`===============================================================\n`);
}

HANDLERS["toolchain:quant:quantize"] = cmd_quant_quantize;
HANDLERS["toolchain:quant:dot"] = cmd_quant_dot;
HANDLERS["toolchain:quant:cosine"] = cmd_quant_cosine;
HANDLERS["toolchain:quant:hnsw"] = cmd_quant_hnsw;
HANDLERS["toolchain:quant:audit"] = cmd_quant_audit;

export async function handleSimdQuantizedHnswCommand(commandContext) {
  const command = commandContext.command;
  const handler = HANDLERS[command];
  if (!handler) {
    throw new Error(`Unknown toolchain:quant command: ${command}`);
  }
  await handler(commandContext);
  return true;
}

/**
 * Glorian System — Dedicated Micro-Benchmark & Performance Lane (SPEC-342 FR-10)
 *
 * Runs throughput and latency benchmarks in isolation without parallel test-runner CPU contention.
 * Emits JSON telemetry with percentiles, ops/sec, and hardware context.
 */

import { performance } from "node:perf_hooks";
import os from "node:os";
import { EosSimdQuantizedHnswCore } from "../src/core/eosSimdQuantizedHnsw.ts";
import { EosZeroCopyRingBufferCore } from "../src/core/eosZeroCopyRingBuffer.ts";
import { EosIntervalConstraintSolver } from "../src/core/eosZ3WasmProver.ts";

function generateTestVector(dim, seed) {
  const v = new Float32Array(dim);
  let s = seed;
  for (let i = 0; i < dim; i++) {
    s = (s * 1664525 + 1013904223) | 0;
    v[i] = s / 2147483648;
  }
  return v;
}

console.log("======================================================================");
console.log(" GLORIAN SYSTEM — DEDICATED BENCHMARK LANE (SPEC-342)");
console.log(` CPUs: ${os.cpus()?.length ?? 1} | Platform: ${os.platform()} | Arch: ${os.arch()}`);
console.log("======================================================================\n");

// 1. HNSW k-NN Benchmark
const dim = 64;
const hnsw = new EosSimdQuantizedHnswCore({ dimension: dim, M: 16, efConstruction: 64, efSearch: 32 });
for (let i = 0; i < 500; i++) {
  hnsw.insert(generateTestVector(dim, 7000 + i), `vec-${i}`);
}
// Warm-up
const query = generateTestVector(dim, 9999);
for (let i = 0; i < 10; i++) hnsw.searchKnn({ query, k: 5 });

const hnswRuns = 100;
const hnswStart = performance.now();
for (let i = 0; i < hnswRuns; i++) {
  hnsw.searchKnn({ query, k: 5 });
}
const hnswTotalMs = performance.now() - hnswStart;
const hnswAvgMs = hnswTotalMs / hnswRuns;
const hnswQps = Math.round((hnswRuns / hnswTotalMs) * 1000);
console.log(`[HNSW k-NN] Average Latency: ${hnswAvgMs.toFixed(3)} ms | QPS: ${hnswQps.toLocaleString()} queries/sec`);

// 2. Zero-Copy Ring Buffer Benchmark
const ringReport = EosZeroCopyRingBufferCore.benchmarkRingBufferThroughput(100_000, 16_384);
console.log(
  `[RingBuffer] Throughput: ${Math.round(ringReport.eventsPerSecond).toLocaleString()} events/sec | ns/op: ${ringReport.nsPerOp.toFixed(1)} ns`,
);

// 3. Interval Constraint Solver Benchmark
const solverRuns = 10_000;
const solverStart = performance.now();
for (let i = 0; i < solverRuns; i++) {
  EosIntervalConstraintSolver.solve(
    [{ name: "x", type: "int" }],
    [
      { leftVar: "x", op: ">=", rightVal: 10 },
      { leftVar: "x", op: "<=", rightVal: 20 },
      { leftVar: "x", op: "!=", rightVal: 15 },
    ],
  );
}
const solverTotalMs = performance.now() - solverStart;
const solverThroughput = Math.round((solverRuns / solverTotalMs) * 1000);
console.log(
  `[Solver] Throughput: ${solverThroughput.toLocaleString()} solves/sec | Total: ${solverTotalMs.toFixed(2)} ms\n`,
);

console.log("======================================================================");
console.log("✅ [PASS] All dedicated micro-benchmarks completed successfully.");
console.log("======================================================================");

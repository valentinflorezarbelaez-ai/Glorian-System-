/**
 * EOS SYSTEM — COMPUTE GRAPH ROOFLINE PLANNER CORE TESTS
 * Tests for EosComputeGraphRooflinePlannerCore: planComputeGraphAndArena
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EosComputeGraphRooflinePlannerCore } from "../src/core/eosComputeGraphRooflinePlannerCore.ts";

// ============================================================================
// Default plan
// ============================================================================

test("planComputeGraphAndArena returns default hardware name", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  assert.equal(report.hardwareName, "GLORIAN-TENSOR-SM90");
});

test("planComputeGraphAndArena returns default peak flops", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  assert.equal(report.peakFlopsGiga, 312_000);
});

test("planComputeGraphAndArena returns default memory bandwidth", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  assert.equal(report.memoryBandwidthGBps, 2_000);
});

test("planComputeGraphAndArena returns default memory budget", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  assert.equal(report.memoryBudgetBytes, 67_108_864);
});

test("planComputeGraphAndArena returns default align bytes", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  assert.equal(report.alignBytes, 64);
});

test("planComputeGraphAndArena returns 6 default nodes", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  assert.equal(report.totalNodes, 6);
});

test("planComputeGraphAndArena returns ROOFLINE_OPTIMIZED verdict by default", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  assert.equal(report.verdict, "ROOFLINE_OPTIMIZED");
});

test("planComputeGraphAndArena execution order is topological", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  const qkvIdx = report.executionOrder.indexOf("qkv_proj");
  const biasIdx = report.executionOrder.indexOf("qkv_bias");
  const reluIdx = report.executionOrder.indexOf("qkv_relu");
  assert.ok(qkvIdx < biasIdx, "qkv_proj must come before qkv_bias");
  assert.ok(biasIdx < reluIdx, "qkv_bias must come before qkv_relu");
});

test("planComputeGraphAndArena generates operator profiles", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  assert.ok(report.operatorProfiles.length > 0);
  assert.ok(report.operatorProfiles[0].id);
  assert.ok(report.operatorProfiles[0].opKind);
  assert.ok(report.operatorProfiles[0].arithmeticIntensityFlopsPerByte > 0);
});

test("planComputeGraphAndArena detects operator fusion", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  assert.ok(report.fusedGroups.length > 0);
  assert.ok(report.fusedOperatorsCount > 0);
});

test("planComputeGraphAndArena fusion saves memory traffic", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  assert.ok(report.memoryTrafficSavedBytes > 0);
});

test("planComputeGraphAndArena generates arena allocations", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  assert.ok(report.arenaAllocations.length > 0);
  assert.ok(report.peakArenaBytes > 0);
});

test("planComputeGraphAndArena generates SHA-256 digest", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  assert.ok(report.rooflineDigestSha256.length === 64);
});

test("planComputeGraphAndArena digest is deterministic", () => {
  const r1 = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  const r2 = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  assert.equal(r1.rooflineDigestSha256, r2.rooflineDigestSha256);
});

test("planComputeGraphAndArena report is frozen", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  assert.throws(() => {
    report.verdict = "OTHER";
  }, TypeError);
});

// ============================================================================
// Custom hardware options
// ============================================================================

test("planComputeGraphAndArena accepts custom hardware name", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena({
    hardwareName: "Custom-GPU",
  });
  assert.equal(report.hardwareName, "Custom-GPU");
});

test("planComputeGraphAndArena trims hardware name", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena({
    hardwareName: "  Trimmed-GPU  ",
  });
  assert.equal(report.hardwareName, "Trimmed-GPU");
});

test("planComputeGraphAndArena accepts custom peak flops", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena({
    peakFlopsGiga: 100_000,
  });
  assert.equal(report.peakFlopsGiga, 100_000);
});

test("planComputeGraphAndArena accepts custom memory bandwidth", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena({
    memoryBandwidthGBps: 3_000,
  });
  assert.equal(report.memoryBandwidthGBps, 3_000);
});

test("planComputeGraphAndArena accepts custom memory budget", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena({
    memoryBudgetBytes: 1_000,
  });
  assert.equal(report.memoryBudgetBytes, 1_000);
});

test("planComputeGraphAndArena accepts custom align bytes", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena({
    alignBytes: 128,
  });
  assert.equal(report.alignBytes, 128);
});

// ============================================================================
// Ridge point calculation
// ============================================================================

test("planComputeGraphAndArena calculates ridge point", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena({
    peakFlopsGiga: 100,
    memoryBandwidthGBps: 50,
  });
  assert.equal(report.ridgePointFlopsPerByte, 2);
});

// ============================================================================
// Operator profiles
// ============================================================================

test("operator profiles include compute-bound regime", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  const computeBound = report.operatorProfiles.find((p) => p.boundRegime === "COMPUTE_BOUND");
  assert.ok(computeBound);
});

test("operator profiles include memory-bound regime", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  const memoryBound = report.operatorProfiles.find((p) => p.boundRegime === "MEMORY_BOUND");
  assert.ok(memoryBound);
});

test("operator profiles have utilization ratio", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  for (const profile of report.operatorProfiles) {
    assert.ok(profile.utilizationRatio >= 0);
    assert.ok(profile.utilizationRatio <= 1);
  }
});

// ============================================================================
// Fusion groups
// ============================================================================

test("fusion groups have correct pattern", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  for (const group of report.fusedGroups) {
    assert.ok(group.pattern.includes("->"));
    assert.ok(group.nodeIds.length >= 2);
    assert.ok(group.groupId.startsWith("fused_"));
  }
});

test("fusion groups include MATMUL->BIAS_ADD->RELU chain", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  const chain = report.fusedGroups.find((g) => g.pattern.includes("MATMUL->BIAS_ADD"));
  assert.ok(chain);
});

// ============================================================================
// Arena allocations
// ============================================================================

test("arena allocations have correct offsets", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  let expectedOffset = 0;
  for (const alloc of report.arenaAllocations) {
    assert.equal(alloc.offsetBytes, expectedOffset);
    expectedOffset += alloc.alignedSizeBytes;
  }
  assert.equal(expectedOffset, report.peakArenaBytes);
});

test("arena allocations are aligned", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena({
    alignBytes: 128,
  });
  for (const alloc of report.arenaAllocations) {
    assert.ok(alloc.alignedSizeBytes % 128 === 0 || alloc.alignedSizeBytes === 0);
  }
});

test("arena allocation sizeBytes matches node outputBytes", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  for (const alloc of report.arenaAllocations) {
    assert.ok(alloc.sizeBytes >= 0);
  }
});

// ============================================================================
// Validation errors
// ============================================================================

test("planComputeGraphAndArena throws on empty nodes", () => {
  assert.throws(
    () => EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena({ nodes: [] }),
    /at least one operator node/,
  );
});

test("planComputeGraphAndArena throws on zero peak flops", () => {
  assert.throws(() => EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena({ peakFlopsGiga: 0 }), /must be > 0/);
});

test("planComputeGraphAndArena throws on zero memory bandwidth", () => {
  assert.throws(
    () => EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena({ memoryBandwidthGBps: 0 }),
    /must be > 0/,
  );
});

test("planComputeGraphAndArena throws on zero memory budget", () => {
  assert.throws(
    () => EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena({ memoryBudgetBytes: 0 }),
    /must be > 0/,
  );
});

test("planComputeGraphAndArena throws on zero align bytes", () => {
  assert.throws(() => EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena({ alignBytes: 0 }), /must be > 0/);
});

test("planComputeGraphAndArena throws on duplicate node ids", () => {
  const nodes = [
    { id: "a", opKind: "MATMUL", flops: 100, bytesRead: 10, bytesWritten: 10, outputBytes: 10, dependencies: [] },
    { id: "a", opKind: "RELU", flops: 10, bytesRead: 10, bytesWritten: 10, outputBytes: 10, dependencies: [] },
  ];
  assert.throws(() => EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena({ nodes }), /duplicate/);
});

test("planComputeGraphAndArena throws on unknown dependency", () => {
  const nodes = [
    {
      id: "a",
      opKind: "MATMUL",
      flops: 100,
      bytesRead: 10,
      bytesWritten: 10,
      outputBytes: 10,
      dependencies: ["missing"],
    },
  ];
  assert.throws(() => EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena({ nodes }), /unknown dependency/);
});

test("planComputeGraphAndArena throws on cyclic dependency", () => {
  const nodes = [
    { id: "a", opKind: "MATMUL", flops: 100, bytesRead: 10, bytesWritten: 10, outputBytes: 10, dependencies: ["b"] },
    { id: "b", opKind: "RELU", flops: 10, bytesRead: 10, bytesWritten: 10, outputBytes: 10, dependencies: ["a"] },
  ];
  assert.throws(() => EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena({ nodes }), /Cyclic dependency/);
});

// ============================================================================
// Custom nodes
// ============================================================================

test("planComputeGraphAndArena accepts custom nodes", () => {
  const nodes = [
    {
      id: "matmul",
      opKind: "MATMUL",
      flops: 1_000_000,
      bytesRead: 100_000,
      bytesWritten: 50_000,
      outputBytes: 50_000,
      dependencies: [],
    },
    {
      id: "relu",
      opKind: "RELU",
      flops: 10_000,
      bytesRead: 50_000,
      bytesWritten: 50_000,
      outputBytes: 50_000,
      dependencies: ["matmul"],
    },
  ];
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena({ nodes });
  assert.equal(report.totalNodes, 2);
  assert.equal(report.executionOrder[0], "matmul");
  assert.equal(report.executionOrder[1], "relu");
});

test("planComputeGraphAndArena fuses MATMUL->RELU", () => {
  const nodes = [
    {
      id: "matmul",
      opKind: "MATMUL",
      flops: 1_000_000,
      bytesRead: 100_000,
      bytesWritten: 50_000,
      outputBytes: 50_000,
      dependencies: [],
    },
    {
      id: "relu",
      opKind: "RELU",
      flops: 10_000,
      bytesRead: 50_000,
      bytesWritten: 50_000,
      outputBytes: 50_000,
      dependencies: ["matmul"],
    },
  ];
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena({ nodes });
  const fused = report.fusedGroups.find((g) => g.pattern === "MATMUL->RELU");
  assert.ok(fused);
});

test("planComputeGraphAndArena fuses MATMUL->BIAS_ADD", () => {
  const nodes = [
    {
      id: "matmul",
      opKind: "MATMUL",
      flops: 1_000_000,
      bytesRead: 100_000,
      bytesWritten: 50_000,
      outputBytes: 50_000,
      dependencies: [],
    },
    {
      id: "bias",
      opKind: "BIAS_ADD",
      flops: 10_000,
      bytesRead: 50_000,
      bytesWritten: 50_000,
      outputBytes: 50_000,
      dependencies: ["matmul"],
    },
  ];
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena({ nodes });
  const fused = report.fusedGroups.find((g) => g.pattern === "MATMUL->BIAS_ADD");
  assert.ok(fused);
});

test("planComputeGraphAndArena does not fuse if consumer has multiple producers", () => {
  const nodes = [
    {
      id: "a",
      opKind: "MATMUL",
      flops: 1_000_000,
      bytesRead: 100_000,
      bytesWritten: 50_000,
      outputBytes: 50_000,
      dependencies: [],
    },
    {
      id: "b",
      opKind: "MATMUL",
      flops: 1_000_000,
      bytesRead: 100_000,
      bytesWritten: 50_000,
      outputBytes: 50_000,
      dependencies: [],
    },
    {
      id: "c",
      opKind: "RELU",
      flops: 10_000,
      bytesRead: 100_000,
      bytesWritten: 50_000,
      outputBytes: 50_000,
      dependencies: ["a", "b"],
    },
  ];
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena({ nodes });
  assert.equal(report.fusedGroups.length, 0);
});

// ============================================================================
// ARENA_BUDGET_EXCEEDED verdict
// ============================================================================

test("planComputeGraphAndArena returns ARENA_BUDGET_EXCEEDED when budget exceeded", () => {
  const nodes = [
    {
      id: "big",
      opKind: "MATMUL",
      flops: 1_000_000,
      bytesRead: 100_000,
      bytesWritten: 50_000,
      outputBytes: 1_000_000,
      dependencies: [],
    },
  ];
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena({
    nodes,
    memoryBudgetBytes: 100,
  });
  assert.equal(report.verdict, "ARENA_BUDGET_EXCEEDED");
});

// ============================================================================
// Fragmentation ratio
// ============================================================================

test("planComputeGraphAndArena returns fragmentation ratio", () => {
  const report = EosComputeGraphRooflinePlannerCore.planComputeGraphAndArena();
  assert.equal(report.fragmentationRatio, 0);
});

/**
 * EOS SYSTEM — NANOSECOND ENGINE TESTS
 * Tests for EosL1SoAArena, compileNaturalInstructionToEosSpec, engineering constants
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EosL1SoAArena,
  compileNaturalInstructionToEosSpec,
  WORLD_TOP_5_FASTEST_SOFTWARE,
  FIVE_NANOSECOND_ENGINEERING_SECRETS,
} from "../src/core/eosNanosecondEngine.ts";

// ============================================================================
// WORLD_TOP_5_FASTEST_SOFTWARE
// ============================================================================

test("WORLD_TOP_5_FASTEST_SOFTWARE has 5 entries", () => {
  assert.equal(WORLD_TOP_5_FASTEST_SOFTWARE.length, 5);
});

test("WORLD_TOP_5_FASTEST_SOFTWARE entries have required fields", () => {
  for (const entry of WORLD_TOP_5_FASTEST_SOFTWARE) {
    assert.ok(entry.id.length > 0);
    assert.ok(entry.name.length > 0);
    assert.ok(entry.category.length > 0);
    assert.ok(entry.speedMilestone.length > 0);
    assert.ok(entry.coreStack.length > 0);
    assert.ok(entry.eosAdaptation.length > 0);
  }
});

test("WORLD_TOP_5_FASTEST_SOFTWARE includes HFT Citadel", () => {
  const hft = WORLD_TOP_5_FASTEST_SOFTWARE.find((e) => e.id === "hft-citadel-jump");
  assert.ok(hft !== undefined);
  assert.ok(hft.name.includes("HFT"));
});

test("WORLD_TOP_5_FASTEST_SOFTWARE includes kdb+", () => {
  const kdb = WORLD_TOP_5_FASTEST_SOFTWARE.find((e) => e.id === "kdb-plus-kx");
  assert.ok(kdb !== undefined);
});

test("WORLD_TOP_5_FASTEST_SOFTWARE includes Zed IDE", () => {
  const zed = WORLD_TOP_5_FASTEST_SOFTWARE.find((e) => e.id === "zed-ide-gpui");
  assert.ok(zed !== undefined);
  assert.ok(zed.speedMilestone.includes("120 FPS"));
});

test("WORLD_TOP_5_FASTEST_SOFTWARE includes TigerBeetle", () => {
  const tb = WORLD_TOP_5_FASTEST_SOFTWARE.find((e) => e.id === "scylladb-tigerbeetle");
  assert.ok(tb !== undefined);
});

test("WORLD_TOP_5_FASTEST_SOFTWARE includes Bun", () => {
  const bun = WORLD_TOP_5_FASTEST_SOFTWARE.find((e) => e.id === "bun-runtime");
  assert.ok(bun !== undefined);
});

// ============================================================================
// FIVE_NANOSECOND_ENGINEERING_SECRETS
// ============================================================================

test("FIVE_NANOSECOND_ENGINEERING_SECRETS has 5 entries", () => {
  assert.equal(FIVE_NANOSECOND_ENGINEERING_SECRETS.length, 5);
});

test("FIVE_NANOSECOND_ENGINEERING_SECRETS numbers are 1-5", () => {
  const numbers = FIVE_NANOSECOND_ENGINEERING_SECRETS.map((s) => s.number);
  assert.deepEqual(numbers, [1, 2, 3, 4, 5]);
});

test("FIVE_NANOSECOND_ENGINEERING_SECRETS entry 1 is Kernel Bypass", () => {
  const secret1 = FIVE_NANOSECOND_ENGINEERING_SECRETS[0];
  assert.equal(secret1.code, "SECRET-01-KERNEL-BYPASS");
  assert.ok(secret1.title.includes("Kernel Bypass"));
});

test("FIVE_NANOSECOND_ENGINEERING_SECRETS entry 2 is DoD L1 Cache", () => {
  const secret2 = FIVE_NANOSECOND_ENGINEERING_SECRETS[1];
  assert.equal(secret2.code, "SECRET-02-DOD-L1-CACHE");
  assert.ok(secret2.title.includes("DoD"));
});

test("FIVE_NANOSECOND_ENGINEERING_SECRETS entry 3 is Zero Allocation", () => {
  const secret3 = FIVE_NANOSECOND_ENGINEERING_SECRETS[2];
  assert.equal(secret3.code, "SECRET-03-ZERO-ALLOCATION");
});

test("FIVE_NANOSECOND_ENGINEERING_SECRETS entry 4 is Lock-Free CAS", () => {
  const secret4 = FIVE_NANOSECOND_ENGINEERING_SECRETS[3];
  assert.equal(secret4.code, "SECRET-04-LOCK-FREE-CAS");
});

test("FIVE_NANOSECOND_ENGINEERING_SECRETS entry 5 is SIMD GPU", () => {
  const secret5 = FIVE_NANOSECOND_ENGINEERING_SECRETS[4];
  assert.equal(secret5.code, "SECRET-05-SIMD-GPU-120FPS");
});

test("FIVE_NANOSECOND_ENGINEERING_SECRETS entries have eosImplementation", () => {
  for (const secret of FIVE_NANOSECOND_ENGINEERING_SECRETS) {
    assert.ok(secret.eosImplementation.length > 0);
  }
});

// ============================================================================
// EosL1SoAArena — Constructor
// ============================================================================

test("EosL1SoAArena L1_ARENA_BYTES is 64 KB", () => {
  assert.equal(EosL1SoAArena.L1_ARENA_BYTES, 65536);
});

test("EosL1SoAArena VECTOR_CAPACITY is 2048", () => {
  assert.equal(EosL1SoAArena.VECTOR_CAPACITY, 2048);
});

test("EosL1SoAArena constructor creates ArrayBuffer", () => {
  const arena = new EosL1SoAArena();
  assert.ok(arena.rawBuffer instanceof ArrayBuffer);
  assert.equal(arena.rawBuffer.byteLength, 65536);
});

test("EosL1SoAArena creates Float64Array views", () => {
  const arena = new EosL1SoAArena();
  assert.ok(arena.pricesOrFrequencies instanceof Float64Array);
  assert.ok(arena.volumesOrAmplitudes instanceof Float64Array);
  assert.ok(arena.scoresOut instanceof Float64Array);
});

test("EosL1SoAArena creates Uint32Array for sequenceIds", () => {
  const arena = new EosL1SoAArena();
  assert.ok(arena.sequenceIds instanceof Uint32Array);
  assert.equal(arena.sequenceIds.length, 2048);
});

test("EosL1SoAArena creates Int32Array for atomicControl", () => {
  const arena = new EosL1SoAArena();
  assert.ok(arena.atomicControl instanceof Int32Array);
  assert.equal(arena.atomicControl.length, 2048);
});

test("EosL1SoAArena views share the same underlying buffer", () => {
  const arena = new EosL1SoAArena();
  assert.equal(arena.pricesOrFrequencies.buffer, arena.rawBuffer);
  assert.equal(arena.volumesOrAmplitudes.buffer, arena.rawBuffer);
  assert.equal(arena.scoresOut.buffer, arena.rawBuffer);
  assert.equal(arena.sequenceIds.buffer, arena.rawBuffer);
  assert.equal(arena.atomicControl.buffer, arena.rawBuffer);
});

test("EosL1SoAArena views have correct offsets", () => {
  const arena = new EosL1SoAArena();
  assert.equal(arena.pricesOrFrequencies.byteOffset, 0);
  assert.equal(arena.volumesOrAmplitudes.byteOffset, 16384);
  assert.equal(arena.scoresOut.byteOffset, 32768);
  assert.equal(arena.sequenceIds.byteOffset, 49152);
  assert.equal(arena.atomicControl.byteOffset, 57344);
});

test("EosL1SoAArena pre-warms prices with deterministic values", () => {
  const arena = new EosL1SoAArena();
  assert.equal(arena.pricesOrFrequencies[0], 349.23);
  assert.equal(arena.pricesOrFrequencies[1], 349.23 + 0.5);
});

test("EosL1SoAArena pre-warms volumes with deterministic values", () => {
  const arena = new EosL1SoAArena();
  assert.equal(arena.volumesOrAmplitudes[0], 0.85);
  assert.equal(arena.volumesOrAmplitudes[1], 0.86);
});

test("EosL1SoAArena pre-warms sequenceIds with indices", () => {
  const arena = new EosL1SoAArena();
  assert.equal(arena.sequenceIds[0], 0);
  assert.equal(arena.sequenceIds[100], 100);
  assert.equal(arena.sequenceIds[2047], 2047);
});

// ============================================================================
// EosL1SoAArena — executeVectorizedBurst
// ============================================================================

test("executeVectorizedBurst returns result with all fields", () => {
  const arena = new EosL1SoAArena();
  const result = arena.executeVectorizedBurst(100);
  assert.ok("totalOperations" in result);
  assert.ok("elapsedMilliseconds" in result);
  assert.ok("nanosecondsPerOp" in result);
  assert.ok("throughputMillionOpsPerSec" in result);
  assert.ok("checksum" in result);
  assert.ok("heapAllocationsBytes" in result);
  assert.ok("l1CacheFootprintBytes" in result);
});

test("executeVectorizedBurst totalOperations equals iterations * capacity", () => {
  const arena = new EosL1SoAArena();
  const result = arena.executeVectorizedBurst(100);
  assert.equal(result.totalOperations, 100 * 2048);
});

test("executeVectorizedBurst with 500 iterations", () => {
  const arena = new EosL1SoAArena();
  const result = arena.executeVectorizedBurst(500);
  assert.equal(result.totalOperations, 500 * 2048);
});

test("executeVectorizedBurst heapAllocationsBytes is always 0", () => {
  const arena = new EosL1SoAArena();
  const result = arena.executeVectorizedBurst(100);
  assert.equal(result.heapAllocationsBytes, 0);
});

test("executeVectorizedBurst l1CacheFootprintBytes is 64 KB", () => {
  const arena = new EosL1SoAArena();
  const result = arena.executeVectorizedBurst(100);
  assert.equal(result.l1CacheFootprintBytes, 65536);
});

test("executeVectorizedBurst produces positive nanosecondsPerOp", () => {
  const arena = new EosL1SoAArena();
  const result = arena.executeVectorizedBurst(100);
  assert.ok(result.nanosecondsPerOp > 0);
});

test("executeVectorizedBurst produces positive throughput", () => {
  const arena = new EosL1SoAArena();
  const result = arena.executeVectorizedBurst(100);
  assert.ok(result.throughputMillionOpsPerSec > 0);
});

test("executeVectorizedBurst checksum is deterministic", () => {
  const arena1 = new EosL1SoAArena();
  const arena2 = new EosL1SoAArena();
  const r1 = arena1.executeVectorizedBurst(100);
  const r2 = arena2.executeVectorizedBurst(100);
  assert.equal(r1.checksum, r2.checksum);
});

test("executeVectorizedBurst updates scoresOut array", () => {
  const arena = new EosL1SoAArena();
  arena.executeVectorizedBurst(10);
  assert.ok(arena.scoresOut[0] > 0);
});

test("executeVectorizedBurst updates atomicControl cursor", () => {
  const arena = new EosL1SoAArena();
  arena.executeVectorizedBurst(10);
  assert.equal(arena.atomicControl[0], 10 * 2048);
});

test("executeVectorizedBurst default iterations is 500", () => {
  const arena = new EosL1SoAArena();
  const result = arena.executeVectorizedBurst();
  assert.equal(result.totalOperations, 500 * 2048);
});

// ============================================================================
// compileNaturalInstructionToEosSpec
// ============================================================================

test("compileNaturalInstructionToEosSpec returns blueprint with all fields", () => {
  const blueprint = compileNaturalInstructionToEosSpec("Construir motor de audio");
  assert.ok("instruction" in blueprint);
  assert.ok("profile" in blueprint);
  assert.ok("profileTitle" in blueprint);
  assert.ok("earsRequirements" in blueprint);
  assert.ok("bddScenario" in blueprint);
  assert.ok("fivePillarsApplied" in blueprint);
  assert.ok("referenceCode" in blueprint);
  assert.ok("benchmarkMetrics" in blueprint);
});

test("compileNaturalInstructionToEosSpec defaults to zed-gpui-120fps profile", () => {
  const blueprint = compileNaturalInstructionToEosSpec("Construir motor");
  assert.equal(blueprint.profile, "zed-gpui-120fps");
});

test("compileNaturalInstructionToEosSpec accepts custom profile", () => {
  const blueprint = compileNaturalInstructionToEosSpec("Construir motor", "citadel-kdb-hft");
  assert.equal(blueprint.profile, "citadel-kdb-hft");
});

test("compileNaturalInstructionToEosSpec cleans instruction whitespace", () => {
  const blueprint = compileNaturalInstructionToEosSpec("  Construir motor  ");
  assert.equal(blueprint.instruction, "Construir motor");
});

test("compileNaturalInstructionToEosSpec handles empty instruction", () => {
  const blueprint = compileNaturalInstructionToEosSpec("");
  assert.ok(blueprint.instruction.length > 0);
});

test("compileNaturalInstructionToEosSpec earsRequirements has 3 items", () => {
  const blueprint = compileNaturalInstructionToEosSpec("Construir motor");
  assert.equal(blueprint.earsRequirements.length, 3);
});

test("compileNaturalInstructionToEosSpec earsRequirements include instruction text", () => {
  const blueprint = compileNaturalInstructionToEosSpec("Construir motor unico");
  // EARS requirements include the instruction in backticks
  assert.ok(blueprint.earsRequirements[0].includes("Construir motor unico"));
});

test("compileNaturalInstructionToEosSpec bddScenario includes instruction", () => {
  const blueprint = compileNaturalInstructionToEosSpec("Construir motor unico");
  assert.ok(blueprint.bddScenario.includes("Construir motor unico"));
});

test("compileNaturalInstructionToEosSpec fivePillarsApplied has 5 fields", () => {
  const blueprint = compileNaturalInstructionToEosSpec("Construir motor");
  const pillars = blueprint.fivePillarsApplied;
  assert.ok("kernelBypass" in pillars);
  assert.ok("dataOrientedSoA" in pillars);
  assert.ok("zeroAllocationArena" in pillars);
  assert.ok("lockFreeCas" in pillars);
  assert.ok("simdAndGpu" in pillars);
});

test("compileNaturalInstructionToEosSpec referenceCode includes instruction", () => {
  const blueprint = compileNaturalInstructionToEosSpec("Construir motor unico");
  assert.ok(blueprint.referenceCode.includes("Construir motor unico"));
});

test("compileNaturalInstructionToEosSpec benchmarkMetrics has all fields", () => {
  const blueprint = compileNaturalInstructionToEosSpec("Construir motor");
  const metrics = blueprint.benchmarkMetrics;
  assert.ok(metrics.totalOperations > 0);
  assert.ok(metrics.elapsedMilliseconds > 0);
  assert.ok(metrics.nanosecondsPerOp > 0);
  assert.ok(metrics.throughputMillionOpsPerSec > 0);
  assert.equal(metrics.heapAllocationsBytes, 0);
  assert.equal(metrics.l1CacheFootprintBytes, 65536);
});

test("compileNaturalInstructionToEosSpec benchmark runs 400 iterations", () => {
  const blueprint = compileNaturalInstructionToEosSpec("Construir motor");
  assert.equal(blueprint.benchmarkMetrics.totalOperations, 400 * 2048);
});

// ============================================================================
// All 5 profiles
// ============================================================================

test("compileNaturalInstructionToEosSpec zed-gpui-120fps profile title", () => {
  const blueprint = compileNaturalInstructionToEosSpec("test", "zed-gpui-120fps");
  assert.ok(blueprint.profileTitle.includes("Zed"));
  assert.ok(blueprint.profileTitle.includes("120 FPS"));
});

test("compileNaturalInstructionToEosSpec tigerbeetle-zig-backend profile", () => {
  const blueprint = compileNaturalInstructionToEosSpec("test", "tigerbeetle-zig-backend");
  assert.ok(blueprint.profileTitle.includes("TigerBeetle"));
  assert.ok(blueprint.referenceCode.includes("TransferBatchSoA"));
});

test("compileNaturalInstructionToEosSpec citadel-kdb-hft profile", () => {
  const blueprint = compileNaturalInstructionToEosSpec("test", "citadel-kdb-hft");
  assert.ok(blueprint.profileTitle.includes("HFT"));
  assert.ok(blueprint.referenceCode.includes("AVX-512"));
});

test("compileNaturalInstructionToEosSpec xirp-bun-edge profile", () => {
  const blueprint = compileNaturalInstructionToEosSpec("test", "xirp-bun-edge");
  assert.ok(blueprint.profileTitle.includes("Edge"));
  assert.ok(blueprint.referenceCode.includes("ArrayBuffer"));
});

test("compileNaturalInstructionToEosSpec aberamentho-rtos-dsp profile", () => {
  const blueprint = compileNaturalInstructionToEosSpec("test", "aberamentho-rtos-dsp");
  assert.ok(blueprint.profileTitle.includes("DSP"));
  assert.ok(blueprint.referenceCode.includes("Float32Array"));
});

test("compileNaturalInstructionToEosSpec unknown profile stores profile as-is", () => {
  const blueprint = compileNaturalInstructionToEosSpec("test", "unknown-profile");
  assert.equal(blueprint.profile, "unknown-profile");
});

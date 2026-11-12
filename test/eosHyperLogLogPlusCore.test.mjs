/**
 * @file eosHyperLogLogPlusCore.test.mjs
 * @description BDD test suite for Layer-0 HyperLogLog++ cardinality estimation engine.
 * BDD-1179..BDD-1183 / SPEC-232 / CHANGE-117
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EosHyperLogLogPlusCore } from "../src/core/eosHyperLogLogPlusCore.ts";

describe("EosHyperLogLogPlusCore (SPEC-232 / CHANGE-117)", () => {
  // BDD-1179: 64-Bit Hashing and Register Update Invariants
  it("BDD-1179: should extract 64-bit hash components and update registers within bounds", () => {
    const p = 10;
    const hll = new EosHyperLogLogPlusCore({ precision: p });
    assert.equal(hll.m, 1024);

    const testKeys = ["user_identity_alpha_992", "ledger_block_hash_0x8f2a", "telemetry_stream_span_441"];

    for (const key of testKeys) {
      const components = hll.hashComponents(key);
      assert.ok(components.registerIndex >= 0 && components.registerIndex < 1024);
      assert.ok(components.leadingZeros >= 1 && components.leadingZeros <= 64 - p + 1);
    }

    // Add 100 items
    for (let i = 0; i < 100; i++) {
      hll.add(`entity_key_${i}`);
    }

    const regs = hll.getRegisters();
    assert.equal(regs.length, 1024);

    let nonZeroCount = 0;
    for (let i = 0; i < regs.length; i++) {
      assert.ok(regs[i] >= 0 && regs[i] <= 64 - p + 1);
      if (regs[i] > 0) nonZeroCount++;
    }

    assert.ok(nonZeroCount > 0, "At least some registers should be non-zero");
    assert.ok(hll.getZeroRegisters() < 1024, "Zero register count must decrease");
  });

  // BDD-1180: Cardinality Estimation Accuracy Across Small and Large Sets
  it("BDD-1180: should estimate 5,000 items with < 3% error at precision p=14", () => {
    const hll = new EosHyperLogLogPlusCore({ precision: 14 }); // m = 16,384, std error ~0.81%
    const exactCount = 5000;

    for (let i = 0; i < exactCount; i++) {
      hll.add(`transaction_payload_uuid_${i}_${i * 37}`);
    }

    const estimate = hll.estimate();
    const relativeError = Math.abs(estimate - exactCount) / exactCount;

    // Must be well within +/- 3% (typically < 1%)
    assert.ok(
      relativeError < 0.03,
      `Estimated ${estimate} for exact ${exactCount} (error: ${(relativeError * 100).toFixed(2)}% > 3%)`,
    );

    const stats = hll.stats();
    assert.equal(stats.precision, 14);
    assert.equal(stats.registerCount, 16384);
    assert.equal(stats.estimate, estimate);
  });

  // BDD-1181: Linear Counting and Small-Range Bias Correction
  it("BDD-1181: should accurately estimate small sets (50 items) via Linear Counting", () => {
    const hll = new EosHyperLogLogPlusCore({ precision: 12 }); // m = 4096
    const exactCount = 50;

    for (let i = 0; i < exactCount; i++) {
      hll.add(`sparse_small_set_item_${i}`);
    }

    const estimate = hll.estimate();

    // In small regime with empty registers V > 0, Linear Counting gives near-exact results
    assert.ok(
      estimate >= 45 && estimate <= 55,
      `Estimated ${estimate} should be tightly bounded between 45 and 55 for exact 50`,
    );
  });

  // BDD-1182: Commutative and Associative Distributed Sketch Merging
  it("BDD-1182: should guarantee commutative, associative sketch union with exact equivalence", () => {
    const hllA = new EosHyperLogLogPlusCore({ precision: 12 });
    const hllB = new EosHyperLogLogPlusCore({ precision: 12 });
    const hllC = new EosHyperLogLogPlusCore({ precision: 12 });

    // Set A: 0..499
    for (let i = 0; i < 500; i++) hllA.add(`elem_${i}`);
    // Set B: 300..799 (overlap with A)
    for (let i = 300; i < 800; i++) hllB.add(`elem_${i}`);
    // Set C: 600..1099 (overlap with B)
    for (let i = 600; i < 1100; i++) hllC.add(`elem_${i}`);

    // Commutativity: A.merge(B) === B.merge(A)
    const ab = hllA.merge(hllB);
    const ba = hllB.merge(hllA);

    assert.equal(ab.estimate(), ba.estimate(), "Commutativity: ab.estimate() === ba.estimate()");
    assert.deepEqual(ab.getRegisters(), ba.getRegisters(), "Registers must be byte-identical");

    // Associativity: (A.merge(B)).merge(C) === A.merge(B.merge(C))
    const ab_c = ab.merge(hllC);
    const a_bc = hllA.merge(hllB.merge(hllC));

    assert.equal(ab_c.estimate(), a_bc.estimate(), "Associativity: (A+B)+C === A+(B+C)");
    assert.deepEqual(ab_c.getRegisters(), a_bc.getRegisters(), "Registers must be byte-identical");

    // In-place merge
    const inPlaceA = new EosHyperLogLogPlusCore({ precision: 12 });
    for (let i = 0; i < 500; i++) inPlaceA.add(`elem_${i}`);
    inPlaceA.mergeInPlace(hllB);
    assert.equal(inPlaceA.estimate(), ab.estimate());
  });

  // BDD-1183: Compact Binary Serialization and Deserialization
  it("BDD-1183: should serialize and deserialize sketch restoring identical registers and estimate", () => {
    const hll = new EosHyperLogLogPlusCore({ precision: 10 }); // m = 1024 registers
    for (let i = 0; i < 300; i++) {
      hll.add(`serialize_test_item_${i}`);
    }

    const originalEstimate = hll.estimate();
    const serialized = hll.serialize();

    // 12 bytes header + 1024 registers = 1036 bytes
    assert.equal(serialized.length, 12 + 1024);

    const restored = EosHyperLogLogPlusCore.deserialize(serialized);
    assert.equal(restored.precision, 10);
    assert.equal(restored.m, 1024);
    assert.equal(restored.estimate(), originalEstimate);
    assert.deepEqual(restored.getRegisters(), hll.getRegisters());
  });
});

/**
 * @file eosCuckooFilterCore.test.mjs
 * @description BDD test suite for Layer-0 Cuckoo Filter engine.
 * BDD-1174..BDD-1178 / SPEC-231 / CHANGE-116
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EosCuckooFilterCore } from "../src/core/eosCuckooFilterCore.ts";

describe("EosCuckooFilterCore (SPEC-231 / CHANGE-116)", () => {
  // BDD-1174: Deterministic Partial-Key Cuckoo Hashing and Invertibility
  it("BDD-1174: should compute symmetric and perfectly invertible bucket indices", () => {
    const filter = new EosCuckooFilterCore({ capacity: 512, fingerprintBits: 8 });

    const testKeys = [
      "user_session_918237",
      "invoice_tx_772145",
      "glorian_proof_alpha",
      "telemetry_metric_rate",
      "merkle_leaf_0xdeadbeef",
    ];

    for (const key of testKeys) {
      const { fingerprint, i1, i2 } = filter.computeHashPair(key);

      // Verify non-zero fingerprint
      assert.ok(fingerprint > 0 && fingerprint <= 0xff, `Fingerprint ${fingerprint} must be in [1, 255]`);

      // Verify symmetry
      const derivedI1 = filter.getAltIndex(i2, fingerprint);
      const derivedI2 = filter.getAltIndex(i1, fingerprint);

      assert.equal(derivedI1, i1, `getAltIndex(i2, fp) must equal i1 for key ${key}`);
      assert.equal(derivedI2, i2, `getAltIndex(i1, fp) must equal i2 for key ${key}`);
    }
  });

  // BDD-1175: Element Insertion and Membership Lookup Accuracy
  it("BDD-1175: should guarantee zero false negatives and <= 3% false positives", () => {
    const filter = new EosCuckooFilterCore({ capacity: 1000, fingerprintBits: 8 });
    const insertedKeys = [];
    const itemCount = 500;

    for (let i = 0; i < itemCount; i++) {
      const key = `item_key_${i}_${i * 17}`;
      insertedKeys.push(key);
      const result = filter.insert(key);
      assert.equal(result.success, true, `Insert should succeed for key ${key}`);
    }

    // Zero false negatives: all 500 must return true
    for (const key of insertedKeys) {
      assert.equal(filter.contains(key), true, `Inserted key ${key} must be detected`);
    }

    // False positive test: test 500 uninserted keys
    let falsePositives = 0;
    const testCount = 500;
    for (let i = 0; i < testCount; i++) {
      const uninsertedKey = `uninserted_negative_key_${i}_${i * 31}`;
      if (filter.contains(uninsertedKey)) {
        falsePositives++;
      }
    }

    const fpRate = falsePositives / testCount;
    // NFR-231-C: False positive rate <= 3% (0.03) for 8-bit
    assert.ok(
      fpRate <= 0.03,
      `False positive rate (${fpRate * 100}%, count: ${falsePositives}/${testCount}) must be <= 3%`,
    );

    const stats = filter.stats();
    assert.equal(stats.count, itemCount);
    assert.ok(stats.loadFactor > 0);
  });

  // BDD-1176: True Dynamic Item Deletion
  it("BDD-1176: should cleanly delete items without degrading remaining items", () => {
    const filter = new EosCuckooFilterCore({ capacity: 500 });
    const keys = ["alpha", "beta", "gamma", "delta"];

    for (const k of keys) {
      filter.insert(k);
    }

    assert.equal(filter.contains("beta"), true);

    // Delete beta
    const deleted = filter.delete("beta");
    assert.equal(deleted, true, "delete('beta') must return true");

    // Beta should now be gone
    assert.equal(filter.contains("beta"), false, "contains('beta') must return false after deletion");

    // Other keys must remain completely unaffected
    assert.equal(filter.contains("alpha"), true, "alpha must still be present");
    assert.equal(filter.contains("gamma"), true, "gamma must still be present");
    assert.equal(filter.contains("delta"), true, "delta must still be present");

    // Deleting non-existent element should return false
    const deleteNonExistent = filter.delete("non_existent_element");
    assert.equal(deleteNonExistent, false, "Deleting absent element must return false");
  });

  // BDD-1177: Cuckoo Kick Displacements and High Load Factor
  it("BDD-1177: should resolve collisions via cuckoo kick displacements", () => {
    // Very small bucket count to force multiple collisions and kicks
    const filter = new EosCuckooFilterCore({ bucketCount: 8, slotsPerBucket: 4, maxKicks: 500 });

    let totalKicks = 0;
    const inserted = [];

    // Capacity is 8 * 4 = 32 slots. Insert 28 items (~87.5% load factor)
    for (let i = 0; i < 28; i++) {
      const key = `dense_cluster_key_${i}`;
      inserted.push(key);
      const res = filter.insert(key);
      assert.equal(res.success, true, `Insert should succeed for item ${i}`);
      totalKicks += res.kickedCount;
    }

    // At high load factor in small table, cuckoo kicks must occur
    assert.ok(totalKicks > 0, `Expected at least some cuckoo kicks, got ${totalKicks}`);

    // All 28 items must be discoverable despite displacements
    for (const key of inserted) {
      assert.equal(filter.contains(key), true, `Item ${key} must be found after cuckoo displacements`);
    }
  });

  // BDD-1178: Compact Binary Serialization and Deserialization
  it("BDD-1178: should serialize and deserialize filter maintaining identical state", () => {
    // 8-bit filter
    const filter8 = new EosCuckooFilterCore({ capacity: 400, fingerprintBits: 8 });
    const keys = [];
    for (let i = 0; i < 200; i++) {
      const key = `serialization_test_key_${i}`;
      keys.push(key);
      filter8.insert(key);
    }

    const buf8 = filter8.serialize();
    assert.ok(buf8.length >= 20, "Serialized buffer must contain at least 20 bytes header");

    const restored8 = EosCuckooFilterCore.deserialize(buf8);
    assert.equal(restored8.stats().count, filter8.stats().count);
    assert.equal(restored8.stats().fingerprintBits, 8);

    for (const key of keys) {
      assert.equal(restored8.contains(key), true, `Restored filter must contain ${key}`);
    }
    assert.equal(restored8.contains("non_existent_key_999"), false);

    // 16-bit filter
    const filter16 = new EosCuckooFilterCore({ capacity: 400, fingerprintBits: 16 });
    for (let i = 0; i < 150; i++) {
      filter16.insert(`u16_key_${i}`);
    }
    const buf16 = filter16.serialize();
    const restored16 = EosCuckooFilterCore.deserialize(buf16);
    assert.equal(restored16.stats().count, 150);
    assert.equal(restored16.stats().fingerprintBits, 16);
    assert.equal(restored16.contains("u16_key_42"), true);
    assert.equal(restored16.contains("u16_key_absent"), false);
  });
});

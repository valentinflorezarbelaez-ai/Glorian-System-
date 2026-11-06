/**
 * EOS SYSTEM — SPEC-070 BDD TEST SUITE
 * Merkle Mountain Range (MMR) & O(log N) Inclusion Proofs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { EosMerkleMountainRange } from '../src/core/eosMerkleMountainRange.ts';

test('BDD-215: Merkle Mountain Range Peak Bagging and Monotonic Root Invariant', () => {
  const mmr = new EosMerkleMountainRange();

  // Insert 7 leaves
  for (let i = 1; i <= 7; i++) {
    mmr.appendLeaf({ eventId: `event-${i}`, value: i * 10 });
  }

  assert.equal(mmr.getLeafCount(), 7);

  // 7 has binary decomposition 4 + 2 + 1 -> exactly 3 peaks
  const peaks = mmr.getPeaks();
  assert.equal(peaks.length, 3);
  assert.equal(peaks[0].height, 2); // tree with 4 leaves
  assert.equal(peaks[1].height, 1); // tree with 2 leaves
  assert.equal(peaks[2].height, 0); // tree with 1 leaf

  const baggedRoot = mmr.getBaggedRoot();
  assert.equal(baggedRoot.length, 64);

  // Append 8th leaf -> merges all into 1 single peak of height 3
  mmr.appendLeaf({ eventId: 'event-8', value: 80 });
  assert.equal(mmr.getPeaks().length, 1);
  assert.equal(mmr.getPeaks()[0].height, 3);
});

test('BDD-216: O(log N) Inclusion Proof Generation and Independent Verification', () => {
  const mmr = new EosMerkleMountainRange();
  const sampleEvents = [];

  for (let i = 0; i < 10; i++) {
    const ev = { txId: `tx-${i}`, amount: (i + 1) * 100 };
    sampleEvents.push(ev);
    mmr.appendLeaf(ev);
  }

  const baggedRoot = mmr.getBaggedRoot();

  // Test proof for leaf index 3
  const proof = mmr.generateInclusionProof(3);
  assert.equal(proof.leafIndex, 3);
  assert.equal(proof.baggedRoot, baggedRoot);

  // Valid proof verification
  const isValid = EosMerkleMountainRange.verifyInclusionProof(sampleEvents[3], proof, baggedRoot);
  assert.equal(isValid, true);

  // Adulterated payload verification failure
  const isAdulteratedValid = EosMerkleMountainRange.verifyInclusionProof(
    { txId: 'tx-3', amount: 999999 },
    proof,
    baggedRoot
  );
  assert.equal(isAdulteratedValid, false);

  // Verify persistence in SQLite WAL ledger
  const recordResult = mmr.recordRootInLedger(':memory:');
  assert.equal(recordResult.recorded, true);
  assert.equal(recordResult.receiptHash.length, 64);
});

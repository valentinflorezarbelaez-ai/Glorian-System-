/**
 * EOS SYSTEM — SPEC-080 BDD TEST SUITE
 * Multi-Party Threshold Cryptography Engine (Shamir / FROST)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { EosThresholdCryptography } from '../src/core/eosThresholdCryptography.ts';

test('BDD-235: Exact Secret Reconstruction with Threshold Shares', () => {
  const tss = new EosThresholdCryptography();
  const originalSecret = 98765432101234567890987654321n;

  // Split into 5 shares with threshold 3
  const shares = tss.splitSecret(originalSecret, 3, 5);
  assert.equal(shares.length, 5);

  // Reconstruct with any 3 shares: {0, 2, 4} (shares 1, 3, 5)
  const subsetA = [shares[0], shares[2], shares[4]];
  const reconstructedA = tss.reconstructSecret(subsetA, 3);
  assert.equal(reconstructedA, originalSecret);

  // Reconstruct with another 3 shares: {1, 3, 4} (shares 2, 4, 5)
  const subsetB = [shares[1], shares[3], shares[4]];
  const reconstructedB = tss.reconstructSecret(subsetB, 3);
  assert.equal(reconstructedB, originalSecret);
});

test('BDD-236: Mathematical Impossibility of Reconstruction with Insufficient Shares', () => {
  const tss = new EosThresholdCryptography();
  const originalSecret = 112233445566778899n;

  const shares = tss.splitSecret(originalSecret, 3, 5);

  // Only 2 shares provided (threshold is 3) -> must fail precondition
  const insufficientShares = [shares[0], shares[1]];
  assert.throws(() => {
    tss.reconstructSecret(insufficientShares, 3);
  }, /Insufficient shares/);
});

test('BDD-336: CSPRNG Polynomial Coefficients Never Repeat Across Splits', () => {
  const tss = new EosThresholdCryptography();
  const secret = 424242424242424242n;

  // Freeze the wall clock so the assertion is deterministic. Coefficients
  // derived from the secret plus Date.now() repeat for identical inputs, which
  // collapses the polynomial entropy and breaks Shamir's guarantee that any
  // coalition of < t shares has zero information about the secret.
  const originalNow = Date.now;
  Date.now = () => 1700000000000;
  try {
    const first = tss.splitSecret(secret, 3, 5).map((share) => share.yHex);
    const second = tss.splitSecret(secret, 3, 5).map((share) => share.yHex);
    assert.notDeepEqual(first, second, 'polynomial coefficients were reused (predictable entropy)');
  } finally {
    Date.now = originalNow;
  }

  // Reconstructability is preserved with a fresh split.
  const shares = tss.splitSecret(secret, 3, 5);
  const reconstructed = tss.reconstructSecret([shares[0], shares[2], shares[4]], 3);
  assert.equal(reconstructed, secret);
});

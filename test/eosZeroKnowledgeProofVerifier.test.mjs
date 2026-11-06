/**
 * EOS SYSTEM — SPEC-077 BDD TEST SUITE
 * Zero-Knowledge Proof of Invariant Verifier (Schnorr / Fiat-Shamir)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { EosZeroKnowledgeProofVerifier } from '../src/core/eosZeroKnowledgeProofVerifier.ts';

test('BDD-229: Valid Zero-Knowledge Proof Generation and Verification', () => {
  const verifier = new EosZeroKnowledgeProofVerifier();

  // Prover holds secret authorization x
  const secretX = 9876543210123456789n;
  const contextMessage = 'deploy:production:enclave-seal';

  const proof = verifier.createProof(secretX, contextMessage);
  assert.ok(proof.statementY.length > 0);
  assert.ok(proof.commitmentR.length > 0);
  assert.ok(proof.responseS.length > 0);
  assert.equal(proof.contextMessage, contextMessage);

  // Verifier checks without ever knowing secretX
  const result = verifier.verifyProof(proof);
  assert.equal(result.valid, true);
  assert.equal(result.statementY, proof.statementY);
  assert.equal(result.attestationSha256.length, 64);
});

test('BDD-230: Rejection of Forged or Tampered Zero-Knowledge Proofs', () => {
  const verifier = new EosZeroKnowledgeProofVerifier();
  const secretX = 1234567890987654321n;
  const contextMessage = 'execute:ledger:transaction';

  const proof = verifier.createProof(secretX, contextMessage);

  // 1. Altered context message
  const tamperedContextProof = { ...proof, contextMessage: 'execute:ledger:unauthorized' };
  const r1 = verifier.verifyProof(tamperedContextProof);
  assert.equal(r1.valid, false);

  // 2. Forged response
  const forgedResponseProof = { ...proof, responseS: 'deadbeef' };
  const r2 = verifier.verifyProof(forgedResponseProof);
  assert.equal(r2.valid, false);

  // 3. Forged commitment
  const forgedCommitmentProof = { ...proof, commitmentR: '123456' };
  const r3 = verifier.verifyProof(forgedCommitmentProof);
  assert.equal(r3.valid, false);
});

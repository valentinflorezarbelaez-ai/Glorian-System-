/**
 * EOS SYSTEM — SPEC-076 BDD TEST SUITE
 * 256-Bit Sparse Merkle Tree (SMT) & Audit Exclusion Proofs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { EosSparseMerkleTree } from '../src/core/eosSparseMerkleTree.ts';

test('BDD-227: Sparse Merkle Tree Deterministic Root and Membership Proof', () => {
  const depth = 16; // 16 levels for fast unit test execution
  const smt = new EosSparseMerkleTree(depth);
  const initialRoot = smt.getRoot();
  assert.equal(initialRoot.length, 64);

  // Insert key-value
  const newRoot = smt.set('account:stripe:001', 'balance:1000');
  assert.notEqual(newRoot, initialRoot);
  assert.equal(smt.get('account:stripe:001'), 'balance:1000');

  // Generate proof
  const proof = smt.prove('account:stripe:001');
  assert.equal(proof.isNonMembership, false);
  assert.equal(proof.value, 'balance:1000');
  assert.equal(proof.siblings.length, depth);

  // Verify proof
  const verified = EosSparseMerkleTree.verifyProof(proof, depth);
  assert.equal(verified, true);

  // Tamper check
  const tamperedProof = { ...proof, value: 'balance:999999' };
  const tamperedVerified = EosSparseMerkleTree.verifyProof(tamperedProof, depth);
  assert.equal(tamperedVerified, false);
});

test('BDD-228: Cryptographic Non-Membership Proof for Unset Keys', () => {
  const depth = 16;
  const smt = new EosSparseMerkleTree(depth);

  // Insert some valid keys
  smt.set('user:alice', 'role:admin');
  smt.set('user:bob', 'role:developer');

  // Prove non-membership of nonexistent user:eve
  assert.equal(smt.get('user:eve'), null);
  const nonMembershipProof = smt.prove('user:eve');
  assert.equal(nonMembershipProof.isNonMembership, true);
  assert.equal(nonMembershipProof.value, null);

  const verified = EosSparseMerkleTree.verifyProof(nonMembershipProof, depth);
  assert.equal(verified, true);
});

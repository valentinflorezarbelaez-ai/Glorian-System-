/**
 * Glorian System — Byzantine Quorum Attestation & Cross-Fleet Deterministic Snapshot Test Suite
 * Governed by SPEC-379 / CHANGE-241 / BDD-2065..1634
 *
 * Verifies PBFT/HotStuff supermajority quorum geometry (N = 3f + 1), cryptographic
 * vote attestation and Quorum Certificate synthesis, double-signing equivocation
 * detection and slashing, WASM linear memory SWAR popcount bitmask aggregation,
 * idempotent TLC receipt preservation, and end-to-end fleet audit receipts.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { EosByzantineQuorumGovernorCore } from "../src/core/eosByzantineQuorumGovernor.ts";
import { pureSha256 } from "../src/core/eosKernelPrimitives.ts";
import { TLC_EVIDENCE_MODES, runTlcVerification } from "../scripts/run-tlc.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

describe("SPEC-379: Byzantine Quorum Attestation, Cross-Fleet Deterministic Snapshot & Idempotent Verification Gate", () => {
  // -------------------------------------------------------------------------
  // BDD-2065: Byzantine Supermajority Threshold Calculation and Deterministic Epoch Proposal
  // -------------------------------------------------------------------------
  it("BDD-2065: calculates N = 3f + 1 quorum geometry (f = 2, Q = 5 for N = 7) and deterministic proposalId", () => {
    const validators = ["val-1", "val-2", "val-3", "val-4", "val-5", "val-6", "val-7"];
    const governor = new EosByzantineQuorumGovernorCore(validators);
    const geometry = governor.getGeometry();

    assert.equal(geometry.totalValidators, 7);
    assert.equal(geometry.maxByzantineFaults, 2);
    assert.equal(geometry.supermajorityQuorum, 5);
    assert.ok(geometry.safetyIntersectionCount >= geometry.maxByzantineFaults + 1);

    const proposal = governor.proposeEpochSnapshot({
      epochHeight: 1,
      fleetMerkleRoot: pureSha256("MERKLE_ROOT_EPOCH_1"),
      crdtConvergenceHash: pureSha256("CRDT_CONVERGENCE_1"),
      proposerId: "val-1",
      createdAtIso: "2026-11-16T00:00:00.000Z",
    });

    assert.equal(typeof proposal.proposalId, "string");
    assert.equal(proposal.proposalId.length, 64);
    assert.equal(proposal.epochHeight, 1);
    assert.equal(proposal.proposerId, "val-1");
  });

  // -------------------------------------------------------------------------
  // BDD-2066: Supermajority Quorum Certificate Formation on Honest Attestations
  // -------------------------------------------------------------------------
  it("BDD-2066: seals QUORUM_COMMITTED QuorumCertificate upon reaching 2f + 1 honest votes", () => {
    const validators = ["val-1", "val-2", "val-3", "val-4", "val-5", "val-6", "val-7"];
    const governor = new EosByzantineQuorumGovernorCore(validators);
    const rootHash = pureSha256("HONEST_ROOT_EPOCH_1");
    const crdtHash = pureSha256("CRDT_EPOCH_1");

    const proposal = governor.proposeEpochSnapshot({
      epochHeight: 1,
      fleetMerkleRoot: rootHash,
      crdtConvergenceHash: crdtHash,
    });

    // First 4 votes (< Q = 5) do not yet commit quorum
    for (let i = 0; i < 4; i++) {
      const vote = governor.signVote({
        validatorId: validators[i],
        epochHeight: 1,
        proposalId: proposal.proposalId,
        stateRootHash: rootHash,
        crdtConvergenceHash: crdtHash,
      });
      const res = governor.submitVote(vote);
      assert.equal(res.accepted, true);
      assert.equal(res.quorumReached, false);
      assert.equal(res.certificate, null);
    }

    // 5th honest vote reaches Q = 5 supermajority
    const fifthVote = governor.signVote({
      validatorId: validators[4],
      epochHeight: 1,
      proposalId: proposal.proposalId,
      stateRootHash: rootHash,
      crdtConvergenceHash: crdtHash,
    });
    const outcome = governor.submitVote(fifthVote);

    assert.equal(outcome.accepted, true);
    assert.equal(outcome.quorumReached, true);
    assert.ok(outcome.certificate);
    assert.equal(outcome.certificate.status, "QUORUM_COMMITTED");
    assert.equal(outcome.certificate.validVotesCount, 5);
    assert.equal(outcome.certificate.participatingValidators.length, 5);
    assert.equal(outcome.certificate.bitmaskResult.popcountHammingWeight, 5);
  });

  // -------------------------------------------------------------------------
  // BDD-2067: Byzantine Equivocation Detection, Slashing Proof, and Vote Exclusion
  // -------------------------------------------------------------------------
  it("BDD-2067: detects double-signing at same epoch, emits EquivocationSlashProof, and quarantines validator", () => {
    const validators = ["val-1", "val-2", "val-3", "val-4"];
    const governor = new EosByzantineQuorumGovernorCore(validators);
    const rootA = pureSha256("STATE_ROOT_A");
    const rootB = pureSha256("CONFLICTING_STATE_ROOT_B");
    const crdtHash = pureSha256("CRDT_EPOCH_2");

    const proposal = governor.proposeEpochSnapshot({
      epochHeight: 2,
      fleetMerkleRoot: rootA,
      crdtConvergenceHash: crdtHash,
    });

    const voteA = governor.signVote({
      validatorId: "val-2",
      epochHeight: 2,
      proposalId: proposal.proposalId,
      stateRootHash: rootA,
      crdtConvergenceHash: crdtHash,
    });
    const firstOutcome = governor.submitVote(voteA);
    assert.equal(firstOutcome.accepted, true);

    // val-2 equivocates at epoch 2 with conflicting stateRootHash
    const voteB = governor.signVote({
      validatorId: "val-2",
      epochHeight: 2,
      proposalId: proposal.proposalId,
      stateRootHash: rootB,
      crdtConvergenceHash: crdtHash,
    });
    const secondOutcome = governor.submitVote(voteB);

    assert.equal(secondOutcome.accepted, false);
    assert.equal(secondOutcome.equivocationDetected, true);
    assert.ok(secondOutcome.slashProof);
    assert.equal(secondOutcome.slashProof.validatorId, "val-2");
    assert.equal(secondOutcome.slashProof.epochHeight, 2);
    assert.equal(secondOutcome.slashProof.firstStateRootHash, rootA);
    assert.equal(secondOutcome.slashProof.conflictingStateRootHash, rootB);
    assert.equal(secondOutcome.slashProof.sha256Evidence.length, 64);

    const valRecord = governor.getValidator("val-2");
    assert.ok(valRecord);
    assert.equal(valRecord.status, "SLASHED_QUARANTINED");
    assert.equal(valRecord.slashedAtEpoch, 2);

    // Subsequent votes from quarantined validator are rejected
    const thirdOutcome = governor.submitVote(voteA);
    assert.equal(thirdOutcome.accepted, false);
  });

  // -------------------------------------------------------------------------
  // BDD-2068: WASM Linear Memory Voter Bitmask Aggregation and Popcount Acceleration
  // -------------------------------------------------------------------------
  it("BDD-2068: aggregates voter participation bitmask in WebAssembly.Memory with exact SWAR popcount", () => {
    const result = EosByzantineQuorumGovernorCore.aggregateQuorumBitmaskLinearMemory(
      9,
      [0, 2, 4, 6, 8, 2, 4], // includes duplicate indices to verify idempotent bit setting
      pureSha256("BITMASK_TEST_ROOT"),
    );

    assert.equal(result.totalValidators, 9);
    assert.deepEqual(result.activeVoterIndices, [0, 2, 4, 6, 8]);
    assert.equal(result.popcountHammingWeight, 5);
    assert.ok(result.bitmaskHex.startsWith("0x"));
    assert.equal(result.commitmentHash.length, 64);
    assert.ok(result.durationNs >= 0);
  });

  // -------------------------------------------------------------------------
  // BDD-2069: Idempotent Receipt Preservation and Non-Downgrade Deferred Verification
  // -------------------------------------------------------------------------
  it("BDD-2069: preserves audit receipt timestamps across repeated runs and emits DEFERRED_TO_CI without dirtying TLC receipt", () => {
    const tmpAuditPath = path.join(os.tmpdir(), `eos-bft-idempotent-${process.pid}-${Date.now()}.json`);
    const tmpTlcPath = path.join(os.tmpdir(), `eos-tlc-deferred-${process.pid}-${Date.now()}.json`);

    try {
      const firstAudit = EosByzantineQuorumGovernorCore.auditByzantineQuorumPipeline({
        projectRoot: ROOT,
        receiptPath: tmpAuditPath,
      });
      const secondAudit = EosByzantineQuorumGovernorCore.auditByzantineQuorumPipeline({
        projectRoot: ROOT,
        receiptPath: tmpAuditPath,
      });

      assert.equal(secondAudit.timestampIso, firstAudit.timestampIso);
      assert.equal(secondAudit.linearMemoryDurationNs, firstAudit.linearMemoryDurationNs);
      assert.equal(secondAudit.sha256Signature, firstAudit.sha256Signature);

      const deferredReceipt = runTlcVerification({
        receiptPath: tmpTlcPath,
        forceMock: true,
      });
      assert.equal(deferredReceipt.executionMode, TLC_EVIDENCE_MODES.DEFERRED_TO_CI);
      assert.equal(deferredReceipt.status, TLC_EVIDENCE_MODES.DEFERRED_TO_CI);
      assert.equal(deferredReceipt.reproducibleByMergeGate, false);
    } finally {
      for (const p of [tmpAuditPath, tmpTlcPath]) {
        try {
          if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch {
          // ignore cleanup error
        }
      }
    }
  });

  // -------------------------------------------------------------------------
  // BDD-2070: End-to-End Cross-Fleet Byzantine Quorum Audit Receipt Generation
  // -------------------------------------------------------------------------
  it("BDD-2070: audits all 9 fleet projects, verifies quorum and slashing, and emits BYZANTINE_QUORUM_RECEIPT.json", () => {
    const canonicalPath = path.join(ROOT, "docs/evidence/BYZANTINE_QUORUM_RECEIPT.json");
    const tmpReceiptPath = path.join(os.tmpdir(), `eos-byzantine-quorum-${process.pid}-${Date.now()}.json`);

    try {
      const receipt = EosByzantineQuorumGovernorCore.auditByzantineQuorumPipeline({
        projectRoot: ROOT,
        receiptPath: tmpReceiptPath,
      });

      assert.equal(receipt.specRef, "SPEC-379");
      assert.equal(receipt.changeRef, "CHANGE-241");
      assert.equal(receipt.status, "VERIFIED");
      assert.equal(receipt.fleetProjectsSnapshotCount, 9);
      assert.equal(receipt.geometryVerified.totalValidators, 9);
      assert.equal(receipt.geometryVerified.maxByzantineFaults, 2);
      assert.equal(receipt.geometryVerified.supermajorityQuorum, 7);
      assert.equal(receipt.quorumCommitted, true);
      assert.equal(receipt.equivocationSlashedCount, 1);
      assert.equal(receipt.linearMemoryPopcountVerified, true);
      assert.equal(receipt.idempotentReceiptVerified, true);
      assert.equal(receipt.sha256Signature.length, 64);
      assert.ok(fs.existsSync(tmpReceiptPath), "Temporary receipt must be written to disk");
      assert.ok(fs.existsSync(canonicalPath), "Canonical BYZANTINE_QUORUM_RECEIPT.json must exist in repository");

      // Second invocation on same tmpReceiptPath preserves idempotent timestampIso
      const secondReceipt = EosByzantineQuorumGovernorCore.auditByzantineQuorumPipeline({
        projectRoot: ROOT,
        receiptPath: tmpReceiptPath,
      });
      assert.equal(secondReceipt.timestampIso, receipt.timestampIso);
      assert.equal(secondReceipt.sha256Signature, receipt.sha256Signature);
    } finally {
      try {
        fs.unlinkSync(tmpReceiptPath);
      } catch {
        // ignore cleanup error
      }
    }
  });
});

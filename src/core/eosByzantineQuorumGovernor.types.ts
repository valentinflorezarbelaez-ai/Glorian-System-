/**
 * Glorian System — Byzantine Quorum Attestation & Cross-Fleet Deterministic Snapshot Types
 * Governed by SPEC-379 / CHANGE-241 / ADR-171
 *
 * Defines formal data contracts for PBFT/HotStuff supermajority quorum geometry (N = 3f + 1),
 * epoch snapshot proposals, cryptographic validator attestations, double-signing equivocation
 * slash proofs, WASM linear memory voter bitmask aggregation, and audit receipts.
 *
 * Strict Zero Runtime Dependencies (Law V). Node 24 Strip-Only TS Compatible.
 */

export type ValidatorStatus = "ACTIVE" | "SLASHED_QUARANTINED";

export type QuorumCertificateStatus = "QUORUM_COMMITTED" | "QUORUM_PENDING" | "QUORUM_REJECTED_BYZANTINE";

export interface ByzantineQuorumGeometry {
  readonly totalValidators: number;
  readonly maxByzantineFaults: number;
  readonly supermajorityQuorum: number;
  readonly safetyIntersectionCount: number;
}

export interface ValidatorNodeRecord {
  readonly validatorId: string;
  readonly index: number;
  readonly status: ValidatorStatus;
  readonly slashedAtEpoch: number | null;
}

export interface EpochSnapshotProposal {
  readonly proposalId: string;
  readonly epochHeight: number;
  readonly fleetMerkleRoot: string;
  readonly crdtConvergenceHash: string;
  readonly proposerId: string;
  readonly createdAtIso: string;
}

export interface ValidatorVote {
  readonly validatorId: string;
  readonly epochHeight: number;
  readonly proposalId: string;
  readonly stateRootHash: string;
  readonly crdtConvergenceHash: string;
  readonly signatureHex: string;
  readonly votedAtIso: string;
}

export interface EquivocationSlashProof {
  readonly slashProofId: string;
  readonly validatorId: string;
  readonly epochHeight: number;
  readonly firstStateRootHash: string;
  readonly firstSignatureHex: string;
  readonly conflictingStateRootHash: string;
  readonly conflictingSignatureHex: string;
  readonly detectedAtIso: string;
  readonly sha256Evidence: string;
}

export interface LinearMemoryBitmaskResult {
  readonly totalValidators: number;
  readonly activeVoterIndices: readonly number[];
  readonly bitmaskHex: string;
  readonly popcountHammingWeight: number;
  readonly commitmentHash: string;
  readonly durationNs: number;
}

export interface QuorumCertificate {
  readonly certificateId: string;
  readonly proposalId: string;
  readonly epochHeight: number;
  readonly stateRootHash: string;
  readonly crdtConvergenceHash: string;
  readonly status: QuorumCertificateStatus;
  readonly geometry: ByzantineQuorumGeometry;
  readonly validVotesCount: number;
  readonly participatingValidators: readonly string[];
  readonly bitmaskResult: LinearMemoryBitmaskResult;
  readonly aggregateSignatureHex: string;
  readonly committedAtIso: string;
}

export interface VoteSubmissionOutcome {
  readonly accepted: boolean;
  readonly equivocationDetected: boolean;
  readonly slashProof: EquivocationSlashProof | null;
  readonly quorumReached: boolean;
  readonly certificate: QuorumCertificate | null;
}

export interface ByzantineQuorumAuditReceipt {
  readonly specRef: "SPEC-379";
  readonly changeRef: "CHANGE-241";
  readonly status: "VERIFIED";
  readonly timestampIso: string;
  readonly fleetProjectsSnapshotCount: number;
  readonly geometryVerified: ByzantineQuorumGeometry;
  readonly quorumCommitted: boolean;
  readonly equivocationSlashedCount: number;
  readonly linearMemoryPopcountVerified: boolean;
  readonly linearMemoryDurationNs: number;
  readonly idempotentReceiptVerified: boolean;
  readonly sha256Signature: string;
}

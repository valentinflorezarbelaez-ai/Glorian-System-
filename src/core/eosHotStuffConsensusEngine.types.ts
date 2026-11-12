/**
 * EOS Layer-0 HotStuff Pipelined BFT Consensus Engine Types (SPEC-223)
 * Strict Zero Runtime Dependencies (EOS Law I & V), Node 24 Strip-Only TypeScript.
 */

export type HotStuffNodeId = string;
export type HotStuffView = number;
export type HotStuffPhase = "prepare" | "precommit" | "commit" | "decide";

export interface HotStuffQuorumCertificate {
  readonly view: HotStuffView;
  readonly blockHash: string;
  readonly phase: HotStuffPhase;
  readonly signatures: Readonly<Record<HotStuffNodeId, string>>;
  readonly qcHash: string;
}

export interface HotStuffBlock {
  readonly hash: string;
  readonly parentHash: string;
  readonly view: HotStuffView;
  readonly proposer: HotStuffNodeId;
  readonly payload: unknown;
  readonly justify: HotStuffQuorumCertificate;
  readonly timestamp: string;
}

export interface HotStuffVote {
  readonly view: HotStuffView;
  readonly blockHash: string;
  readonly phase: HotStuffPhase;
  readonly voter: HotStuffNodeId;
  readonly signature: string;
}

export interface HotStuffCommitResult {
  readonly committedBlocks: readonly HotStuffBlock[];
  readonly highQC: HotStuffQuorumCertificate;
  readonly lockedQC: HotStuffQuorumCertificate;
  readonly currentView: HotStuffView;
  readonly receipt: HotStuffReceipt;
}

export interface HotStuffSlashingReceipt {
  readonly receiptId: string;
  readonly violator: HotStuffNodeId;
  readonly view: HotStuffView;
  readonly reason: string;
  readonly vote1: HotStuffVote;
  readonly vote2: HotStuffVote;
  readonly timestamp: string;
  readonly receiptSha256: string;
}

export type HotStuffOperationType = "propose" | "vote" | "commit" | "view_change" | "slash";

export interface HotStuffReceipt {
  readonly receiptId: string;
  readonly operation: HotStuffOperationType;
  readonly view: HotStuffView;
  readonly timestamp: string;
  readonly digest: string;
  readonly receiptSha256: string;
}

export interface HotStuffEngineStatus {
  readonly nodeId: HotStuffNodeId;
  readonly currentView: HotStuffView;
  readonly currentLeader: HotStuffNodeId;
  readonly highQC: HotStuffQuorumCertificate;
  readonly lockedQC: HotStuffQuorumCertificate;
  readonly committedCount: number;
  readonly pendingCount: number;
  readonly clusterNodes: readonly HotStuffNodeId[];
  readonly quorumSize: number;
  readonly receipt: HotStuffReceipt;
}

export interface HotStuffEngineOptions {
  readonly faultTolerance?: number;
  readonly pacemakerTimeoutMs?: number;
}

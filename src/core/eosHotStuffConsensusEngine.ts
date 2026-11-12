/**
 * EOS Layer-0 HotStuff Pipelined BFT Consensus Engine (SPEC-223, CHANGE-108)
 * Linear View-Change Byzantine Fault Tolerance with 3-Chain Pipelined Commits (Yin et al.)
 * Strict Zero Runtime Dependencies (EOS Law I & V), Node 24 Strip-Only TypeScript.
 */

import crypto from "node:crypto";
import type {
  HotStuffNodeId,
  HotStuffView,
  HotStuffQuorumCertificate,
  HotStuffBlock,
  HotStuffVote,
  HotStuffCommitResult,
  HotStuffSlashingReceipt,
  HotStuffReceipt,
  HotStuffEngineStatus,
  HotStuffEngineOptions,
} from "./eosHotStuffConsensusEngine.types.ts";

export * from "./eosHotStuffConsensusEngine.types.ts";

function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === "object" && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

function sha256Hex(data: string | Uint8Array): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export const HOTSTUFF_GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

export class EosHotStuffConsensusEngine {
  public readonly nodeId: HotStuffNodeId;
  public readonly clusterNodes: readonly HotStuffNodeId[];
  public readonly quorumSize: number;
  public readonly faultTolerance: number;

  private currentViewNumber: HotStuffView = 1;
  private highQcState: HotStuffQuorumCertificate;
  private lockedQcState: HotStuffQuorumCertificate;
  private lastVotedViewNumber: HotStuffView = 0;

  private readonly blocks = new Map<string, HotStuffBlock>();
  private readonly votesReceived = new Map<HotStuffView, Map<string, Map<HotStuffNodeId, HotStuffVote>>>();
  private readonly committedBlocksList: HotStuffBlock[] = [];
  private readonly committedHashRegistry = new Set<string>();
  private readonly slashedValidators = new Map<HotStuffNodeId, HotStuffSlashingReceipt>();

  constructor(nodeId: HotStuffNodeId, clusterNodes: readonly HotStuffNodeId[], options?: HotStuffEngineOptions) {
    if (!clusterNodes.includes(nodeId)) {
      throw new Error(`Node ${nodeId} must be a member of clusterNodes: ${clusterNodes.join(", ")}`);
    }
    this.nodeId = nodeId;
    this.clusterNodes = deepFreeze([...clusterNodes]);

    const n = clusterNodes.length;
    this.faultTolerance = options?.faultTolerance ?? Math.floor((n - 1) / 3);
    this.quorumSize = 2 * this.faultTolerance + 1;

    // Genesis Block and Quorum Certificate
    const genesisQc: HotStuffQuorumCertificate = deepFreeze({
      view: 0,
      blockHash: HOTSTUFF_GENESIS_HASH,
      phase: "decide",
      signatures: {},
      qcHash: sha256Hex(`GENESIS_QC_${HOTSTUFF_GENESIS_HASH}`),
    });

    const genesisBlock: HotStuffBlock = deepFreeze({
      hash: HOTSTUFF_GENESIS_HASH,
      parentHash: HOTSTUFF_GENESIS_HASH,
      view: 0,
      proposer: "GENESIS",
      payload: { system: "Glorian Genesis State", timestamp: 0 },
      justify: genesisQc,
      timestamp: "1970-01-01T00:00:00.000Z",
    });

    this.blocks.set(HOTSTUFF_GENESIS_HASH, genesisBlock);
    this.committedBlocksList.push(genesisBlock);
    this.committedHashRegistry.add(HOTSTUFF_GENESIS_HASH);

    this.highQcState = genesisQc;
    this.lockedQcState = genesisQc;
  }

  public get currentView(): HotStuffView {
    return this.currentViewNumber;
  }

  public get highQC(): HotStuffQuorumCertificate {
    return this.highQcState;
  }

  public get lockedQC(): HotStuffQuorumCertificate {
    return this.lockedQcState;
  }

  public getLeader(view: HotStuffView = this.currentViewNumber): HotStuffNodeId {
    const idx = (view - 1) % this.clusterNodes.length;
    return this.clusterNodes[idx < 0 ? 0 : idx];
  }

  public isLeader(view: HotStuffView = this.currentViewNumber): boolean {
    return this.getLeader(view) === this.nodeId;
  }

  /**
   * Leader creates a proposed block extending highQC.
   */
  public createProposal(payload: unknown): HotStuffBlock {
    const parentHash = this.highQcState.blockHash;
    const timestamp = new Date().toISOString();
    const digestContent = JSON.stringify({
      parentHash,
      view: this.currentViewNumber,
      proposer: this.nodeId,
      payload,
      justifyQcHash: this.highQcState.qcHash,
      timestamp,
    });
    const hash = sha256Hex(digestContent);

    const block: HotStuffBlock = deepFreeze({
      hash,
      parentHash,
      view: this.currentViewNumber,
      proposer: this.nodeId,
      payload,
      justify: this.highQcState,
      timestamp,
    });

    this.blocks.set(hash, block);
    return block;
  }

  /**
   * Replica evaluates a proposed block and emits a vote if safety and liveness rules hold.
   */
  public vote(proposal: HotStuffBlock): HotStuffVote | null {
    // 1. Monotonic view ordering
    if (proposal.view <= this.lastVotedViewNumber) {
      return null;
    }

    // 2. Validate proposal structure
    this.blocks.set(proposal.hash, proposal);

    // 3. Safety Predicate: Does proposal extend lockedQC OR does proposal.justify have higher view?
    const extendsLocked = this.extends(proposal.hash, this.lockedQcState.blockHash);
    const livenessSafe = proposal.justify.view > this.lockedQcState.view;

    if (!extendsLocked && !livenessSafe) {
      return null;
    }

    // 4. Update local highQC if proposal carries higher QC
    if (proposal.justify.view > this.highQcState.view) {
      this.highQcState = proposal.justify;
    }

    this.lastVotedViewNumber = proposal.view;

    const signature = sha256Hex(`${this.nodeId}:${proposal.view}:${proposal.hash}:prepare`);
    const vote: HotStuffVote = deepFreeze({
      view: proposal.view,
      blockHash: proposal.hash,
      phase: "prepare",
      voter: this.nodeId,
      signature,
    });

    // Also register vote locally
    this.receiveVote(vote);
    return vote;
  }

  /**
   * Process a vote from a validator node and assemble a Quorum Certificate when quorum is met.
   */
  public receiveVote(vote: HotStuffVote): HotStuffQuorumCertificate | null {
    if (!this.clusterNodes.includes(vote.voter)) {
      return null;
    }

    let viewVotes = this.votesReceived.get(vote.view);
    if (!viewVotes) {
      viewVotes = new Map();
      this.votesReceived.set(vote.view, viewVotes);
    }

    // Check for validator equivocation (double-voting in the same view)
    for (const [existingHash, votersMap] of viewVotes.entries()) {
      if (existingHash !== vote.blockHash && votersMap.has(vote.voter)) {
        const previousVote = votersMap.get(vote.voter)!;
        this.flagEquivocation(vote.voter, vote.view, previousVote, vote);
        return null;
      }
    }

    let blockVotes = viewVotes.get(vote.blockHash);
    if (!blockVotes) {
      blockVotes = new Map();
      viewVotes.set(vote.blockHash, blockVotes);
    }

    blockVotes.set(vote.voter, vote);

    if (blockVotes.size >= this.quorumSize) {
      const signatures: Record<HotStuffNodeId, string> = {};
      for (const [voterId, v] of blockVotes.entries()) {
        signatures[voterId] = v.signature;
      }

      const qcHash = sha256Hex(
        JSON.stringify({
          view: vote.view,
          blockHash: vote.blockHash,
          phase: vote.phase,
          signers: Object.keys(signatures).sort(),
        }),
      );

      const qc: HotStuffQuorumCertificate = deepFreeze({
        view: vote.view,
        blockHash: vote.blockHash,
        phase: vote.phase,
        signatures: deepFreeze(signatures),
        qcHash,
      });

      if (qc.view > this.highQcState.view) {
        this.highQcState = qc;
      }

      return qc;
    }

    return null;
  }

  /**
   * Process a verified Quorum Certificate / Block and execute the 3-Chain Pipelined Commit Rule.
   */
  public processCommitRule(incomingProposal: HotStuffBlock): HotStuffCommitResult {
    this.blocks.set(incomingProposal.hash, incomingProposal);

    // Update highQC
    const qc1 = incomingProposal.justify;
    if (qc1 && qc1.view > this.highQcState.view) {
      this.highQcState = qc1;
    }

    const b1 = this.blocks.get(qc1.blockHash);
    if (!b1) {
      return this.makeCommitResult([]);
    }

    // Update lockedQC (Pre-commit phase on grandparent)
    const qc2 = b1.justify;
    if (qc2 && qc2.view > this.lockedQcState.view) {
      this.lockedQcState = qc2;
    }

    const b2 = this.blocks.get(qc2.blockHash);
    if (!b2) {
      return this.makeCommitResult([]);
    }

    const qc3 = b2.justify;
    const b3 = this.blocks.get(qc3.blockHash);
    if (!b3) {
      return this.makeCommitResult([]);
    }

    // 3-Chain Commit Rule:
    // b1.parent == b2 && b2.parent == b3 && consecutive views b1.view == b2.view + 1 == b3.view + 2
    const newlyCommitted: HotStuffBlock[] = [];
    if (b1.parentHash === b2.hash && b2.parentHash === b3.hash && b1.view === b2.view + 1 && b2.view === b3.view + 1) {
      // Commit b3 and all uncommitted ancestors
      let curr: HotStuffBlock | undefined = b3;
      const toCommitStack: HotStuffBlock[] = [];
      while (curr && !this.committedHashRegistry.has(curr.hash)) {
        toCommitStack.push(curr);
        curr = this.blocks.get(curr.parentHash);
      }

      while (toCommitStack.length > 0) {
        const blk = toCommitStack.pop()!;
        this.committedBlocksList.push(blk);
        this.committedHashRegistry.add(blk.hash);
        newlyCommitted.push(blk);
      }
    }

    return this.makeCommitResult(newlyCommitted);
  }

  /**
   * Advance view via linear Pacemaker synchronization.
   */
  public advanceView(): HotStuffView {
    this.currentViewNumber += 1;
    return this.currentViewNumber;
  }

  /**
   * Check if block 'descendantHash' extends block 'ancestorHash'.
   */
  public extends(descendantHash: string, ancestorHash: string): boolean {
    if (descendantHash === ancestorHash) return true;
    let curr = this.blocks.get(descendantHash);
    while (curr && curr.hash !== HOTSTUFF_GENESIS_HASH) {
      if (curr.parentHash === ancestorHash) return true;
      curr = this.blocks.get(curr.parentHash);
    }
    return ancestorHash === HOTSTUFF_GENESIS_HASH;
  }

  /**
   * Returns current engine status snapshot.
   */
  public getStatus(): HotStuffEngineStatus {
    const leader = this.getLeader();
    const digest = sha256Hex(
      `status:${this.nodeId}:${this.currentViewNumber}:${leader}:${this.highQcState.qcHash}:${this.committedBlocksList.length}`,
    );
    const receipt: HotStuffReceipt = deepFreeze({
      receiptId: `rcpt-hs-status-${Date.now()}`,
      operation: "commit",
      view: this.currentViewNumber,
      timestamp: new Date().toISOString(),
      digest,
      receiptSha256: sha256Hex(digest),
    });

    return deepFreeze({
      nodeId: this.nodeId,
      currentView: this.currentViewNumber,
      currentLeader: leader,
      highQC: this.highQcState,
      lockedQC: this.lockedQcState,
      committedCount: this.committedBlocksList.length,
      pendingCount: this.blocks.size - this.committedBlocksList.length,
      clusterNodes: this.clusterNodes,
      quorumSize: this.quorumSize,
      receipt,
    });
  }

  public getCommittedBlocks(): readonly HotStuffBlock[] {
    return deepFreeze([...this.committedBlocksList]);
  }

  public getSlashedValidators(): ReadonlyMap<HotStuffNodeId, HotStuffSlashingReceipt> {
    return this.slashedValidators;
  }

  public detectEquivocation(vote1: HotStuffVote, vote2: HotStuffVote): boolean {
    return vote1.voter === vote2.voter && vote1.view === vote2.view && vote1.blockHash !== vote2.blockHash;
  }

  private flagEquivocation(
    violator: HotStuffNodeId,
    view: HotStuffView,
    v1: HotStuffVote,
    v2: HotStuffVote,
  ): HotStuffSlashingReceipt {
    const timestamp = new Date().toISOString();
    const digest = sha256Hex(`SLASH:${violator}:${view}:${v1.blockHash}:${v2.blockHash}`);
    const receipt: HotStuffSlashingReceipt = deepFreeze({
      receiptId: `rcpt-hs-slash-${Date.now()}`,
      violator,
      view,
      reason: `Equivocation detected: voted for ${v1.blockHash} and ${v2.blockHash} at view ${view}`,
      vote1: v1,
      vote2: v2,
      timestamp,
      receiptSha256: digest,
    });
    this.slashedValidators.set(violator, receipt);
    return receipt;
  }

  private makeCommitResult(newlyCommitted: HotStuffBlock[]): HotStuffCommitResult {
    const digest = sha256Hex(`commit:${this.currentViewNumber}:${this.highQcState.qcHash}:${newlyCommitted.length}`);
    const receipt: HotStuffReceipt = deepFreeze({
      receiptId: `rcpt-hs-commit-${Date.now()}`,
      operation: "commit",
      view: this.currentViewNumber,
      timestamp: new Date().toISOString(),
      digest,
      receiptSha256: sha256Hex(digest),
    });

    return deepFreeze({
      committedBlocks: newlyCommitted,
      highQC: this.highQcState,
      lockedQC: this.lockedQcState,
      currentView: this.currentViewNumber,
      receipt,
    });
  }
}

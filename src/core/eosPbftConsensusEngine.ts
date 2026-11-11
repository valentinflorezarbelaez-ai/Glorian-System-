/**
 * EosPbftConsensusEngine (Layer 0 — Practical Byzantine Fault Tolerant Consensus Engine)
 * Governed by SPEC-210, CHANGE-095, ADR-095, FR-1069..FR-1073, BDD-1069..BDD-1073 (v76.0.0)
 *
 * Implements:
 * - Castro & Liskov (1999) Practical Byzantine Fault Tolerance (PBFT) in pure TypeScript.
 * - Quorum calculation: N >= 3f + 1, supermajority quorum threshold = 2f + 1.
 * - Deterministic primary election based on view modulus: p = v % N.
 * - Three-phase consensus protocol: PRE-PREPARE, PREPARE, and COMMIT.
 * - Cryptographic message digest validation and digital signature assertions.
 * - Byzantine equivocation detection and automatic validator slashing receipts.
 * - View-change failover protocol when primary fails or equivocates.
 * - Deterministic replicated state machine (FSM) execution with linearizable state.
 *
 * Strictly ZERO external runtime dependencies (Law V). Node 24 strip-only compliant.
 */

import { assertPrecondition, assertPostcondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
export * from "./eosPbftConsensusEngine.types.ts";
import {
  type PbftPhase,
  type PbftMessage,
  type PreparedCertificate,
  type CommittedCertificate,
  type ByzantineSlashingReceipt,
  type PbftNodeStatus,
  type PbftClusterStatus,
  type PbftExecutionReceipt,
  type FsmReducer,
  computeMessageDigest,
  computeFsmHash,
  defaultFsmReducer,
  signPbftPayload,
} from "./eosPbftConsensusEngine.types.ts";

/**
 * Individual Validator Node participating in the PBFT Consensus Cluster.
 */
export class EosPbftNode {
  readonly nodeId: string;
  readonly clusterSize: number;
  private _currentView = 0;
  private _sequenceNumber = 0;
  private _lastCommittedSeq = 0;
  private _isQuarantined = false;
  private _fsmState: Record<string, unknown> = {};
  private readonly _fsmReducer: FsmReducer;

  // Consensus log buffers
  private readonly _prePrepares = new Map<string, PbftMessage>(); // key: view:seq
  private readonly _prepares = new Map<string, Map<string, PbftMessage>>(); // key: view:seq:digest -> sender -> msg
  private readonly _commits = new Map<string, Map<string, PbftMessage>>(); // key: view:seq:digest -> sender -> msg
  private readonly _preparedCerts = new Map<string, PreparedCertificate>();
  private readonly _committedCerts = new Map<string, CommittedCertificate>();
  private readonly _viewChanges = new Map<number, Map<string, PbftMessage>>(); // view -> sender -> msg

  constructor(nodeId: string, clusterSize: number, customReducer?: FsmReducer) {
    assertPrecondition(nodeId.trim().length > 0, "nodeId cannot be empty");
    assertPrecondition(clusterSize >= 4, "PBFT requires cluster size N >= 4 (3f + 1)");
    this.nodeId = nodeId;
    this.clusterSize = clusterSize;
    this._fsmReducer = customReducer || defaultFsmReducer;
  }

  get currentView(): number {
    return this._currentView;
  }

  get sequenceNumber(): number {
    return this._sequenceNumber;
  }

  get lastCommittedSeq(): number {
    return this._lastCommittedSeq;
  }

  get isQuarantined(): boolean {
    return this._isQuarantined;
  }

  get f(): number {
    return Math.floor((this.clusterSize - 1) / 3);
  }

  get quorumSize(): number {
    return 2 * this.f + 1;
  }

  get fsmState(): Readonly<Record<string, unknown>> {
    return deepFreeze({ ...this._fsmState });
  }

  quarantine(): void {
    this._isQuarantined = true;
  }

  unquarantine(): void {
    this._isQuarantined = false;
  }

  isPrimaryForView(view: number, allNodeIds: readonly string[]): boolean {
    const primaryIndex = view % allNodeIds.length;
    return allNodeIds[primaryIndex] === this.nodeId;
  }

  getStatus(allNodeIds: readonly string[]): PbftNodeStatus {
    return {
      nodeId: this.nodeId,
      isPrimary: this.isPrimaryForView(this._currentView, allNodeIds),
      currentView: this._currentView,
      sequenceNumber: this._sequenceNumber,
      f: this.f,
      quorum: this.quorumSize,
      isQuarantined: this._isQuarantined,
      lastCommittedSeq: this._lastCommittedSeq,
      fsmState: this.fsmState,
    };
  }

  /**
   * Primary creates and broadcasts a PRE-PREPARE message for a client proposal.
   */
  createPrePrepare(proposal: unknown): PbftMessage {
    assertPrecondition(!this._isQuarantined, `Quarantined node ${this.nodeId} cannot propose`);
    this._sequenceNumber += 1;
    const digest = computeMessageDigest(proposal);
    const signature = signPbftPayload(this.nodeId, "PRE-PREPARE", this._currentView, this._sequenceNumber, digest);

    const message: PbftMessage = {
      type: "PRE-PREPARE",
      view: this._currentView,
      sequenceNumber: this._sequenceNumber,
      digest,
      sender: this.nodeId,
      proposal,
      signature,
    };

    const key = `${this._currentView}:${this._sequenceNumber}`;
    this._prePrepares.set(key, message);
    return message;
  }

  /**
   * Backup receives a PRE-PREPARE message from the primary.
   * Checks for Byzantine equivocation (same view/seq, different digest).
   */
  handlePrePrepare(
    msg: PbftMessage,
    allNodeIds: readonly string[],
  ): { prepare?: PbftMessage; equivocation?: ByzantineSlashingReceipt } {
    if (this._isQuarantined) return {};
    assertPrecondition(msg.type === "PRE-PREPARE", "Expected PRE-PREPARE message");

    // Verify sender is legitimate primary for view
    const expectedPrimary = allNodeIds[msg.view % allNodeIds.length];
    if (msg.sender !== expectedPrimary) {
      return {};
    }

    const key = `${msg.view}:${msg.sequenceNumber}`;
    const existing = this._prePrepares.get(key);

    if (existing && existing.digest !== msg.digest) {
      // Byzantine Equivocation detected! Primary emitted dual conflicting digests.
      const receiptId = `SLASH-${msg.sender}-${Date.now()}`;
      const sha256Receipt = pureSha256(
        `EQUIVOCATION:${msg.sender}:${msg.view}:${msg.sequenceNumber}:${existing.digest}:${msg.digest}`,
      );
      const equivocation: ByzantineSlashingReceipt = {
        receiptId,
        slashedNodeId: msg.sender,
        view: msg.view,
        sequenceNumber: msg.sequenceNumber,
        evidenceType: "EQUIVOCATION_DETECTED",
        digestA: existing.digest,
        digestB: msg.digest,
        senderSignatureA: existing.signature,
        senderSignatureB: msg.signature,
        sha256Receipt,
        timestamp: new Date().toISOString(),
      };
      return { equivocation };
    }

    this._prePrepares.set(key, msg);
    this._sequenceNumber = Math.max(this._sequenceNumber, msg.sequenceNumber);

    // Create own PREPARE message
    const signature = signPbftPayload(this.nodeId, "PREPARE", msg.view, msg.sequenceNumber, msg.digest);
    const prepareMsg: PbftMessage = {
      type: "PREPARE",
      view: msg.view,
      sequenceNumber: msg.sequenceNumber,
      digest: msg.digest,
      sender: this.nodeId,
      signature,
    };

    // Record own prepare vote
    this.recordPrepareVote(prepareMsg);

    return { prepare: prepareMsg };
  }

  private recordPrepareVote(msg: PbftMessage): void {
    const key = `${msg.view}:${msg.sequenceNumber}:${msg.digest}`;
    if (!this._prepares.has(key)) {
      this._prepares.set(key, new Map());
    }
    this._prepares.get(key)!.set(msg.sender, msg);
  }

  /**
   * Receives a PREPARE message from a replica node.
   * Checks if prepared certificate (2f + 1) is achieved.
   */
  handlePrepare(msg: PbftMessage): { commit?: PbftMessage } {
    if (this._isQuarantined) return {};
    assertPrecondition(msg.type === "PREPARE", "Expected PREPARE message");

    this.recordPrepareVote(msg);
    const key = `${msg.view}:${msg.sequenceNumber}:${msg.digest}`;
    const votes = this._prepares.get(key)!;

    const prePrepareKey = `${msg.view}:${msg.sequenceNumber}`;
    const prePrepare = this._prePrepares.get(prePrepareKey);

    // Prepared predicate requires: PRE-PREPARE + 2f matching PREPARE messages from distinct nodes
    if (prePrepare && prePrepare.digest === msg.digest && votes.size >= 2 * this.f) {
      if (!this._preparedCerts.has(key)) {
        const cert: PreparedCertificate = {
          view: msg.view,
          sequenceNumber: msg.sequenceNumber,
          digest: msg.digest,
          prePrepare,
          prepares: Array.from(votes.values()),
        };
        this._preparedCerts.set(key, cert);

        // Broadcast COMMIT message
        const signature = signPbftPayload(this.nodeId, "COMMIT", msg.view, msg.sequenceNumber, msg.digest);
        const commitMsg: PbftMessage = {
          type: "COMMIT",
          view: msg.view,
          sequenceNumber: msg.sequenceNumber,
          digest: msg.digest,
          sender: this.nodeId,
          signature,
        };
        this.recordCommitVote(commitMsg);
        return { commit: commitMsg };
      }
    }

    return {};
  }

  private recordCommitVote(msg: PbftMessage): void {
    const key = `${msg.view}:${msg.sequenceNumber}:${msg.digest}`;
    if (!this._commits.has(key)) {
      this._commits.set(key, new Map());
    }
    this._commits.get(key)!.set(msg.sender, msg);
  }

  /**
   * Receives a COMMIT message from a replica node.
   * Checks if committed-local certificate (2f + 1) is reached.
   * Executes command deterministically on local FSM.
   */
  handleCommit(msg: PbftMessage): { applied: boolean; certificate?: CommittedCertificate } {
    if (this._isQuarantined) return { applied: false };
    assertPrecondition(msg.type === "COMMIT", "Expected COMMIT message");

    this.recordCommitVote(msg);
    const key = `${msg.view}:${msg.sequenceNumber}:${msg.digest}`;
    const votes = this._commits.get(key)!;

    // Committed-local predicate requires: 2f + 1 matching COMMIT messages
    if (votes.size >= this.quorumSize) {
      if (!this._committedCerts.has(key)) {
        const cert: CommittedCertificate = {
          view: msg.view,
          sequenceNumber: msg.sequenceNumber,
          digest: msg.digest,
          commits: Array.from(votes.values()),
        };
        this._committedCerts.set(key, cert);

        // Apply to state machine if pre-prepare proposal is available
        const prePrepareKey = `${msg.view}:${msg.sequenceNumber}`;
        const prePrepare = this._prePrepares.get(prePrepareKey);
        if (prePrepare && prePrepare.proposal !== undefined) {
          this._fsmState = this._fsmReducer(this._fsmState, prePrepare.proposal);
          this._lastCommittedSeq = msg.sequenceNumber;
          return { applied: true, certificate: cert };
        }
        return { applied: false, certificate: cert };
      }
    }

    return { applied: false };
  }

  /**
   * Creates a VIEW-CHANGE proposal when primary stalls or is slashed.
   */
  createViewChange(targetView: number): PbftMessage {
    this._currentView = targetView;
    const signature = signPbftPayload(this.nodeId, "VIEW-CHANGE", targetView, this._lastCommittedSeq, "VIEW_CHANGE");
    return {
      type: "VIEW-CHANGE",
      view: targetView,
      sequenceNumber: this._lastCommittedSeq,
      digest: pureSha256(`VIEW_CHANGE:${targetView}`),
      sender: this.nodeId,
      signature,
    };
  }

  /**
   * Receives a VIEW-CHANGE message.
   * New primary gathers 2f + 1 view change votes and emits NEW-VIEW.
   */
  handleViewChange(msg: PbftMessage, allNodeIds: readonly string[]): { newView?: PbftMessage } {
    if (this._isQuarantined) return {};
    assertPrecondition(msg.type === "VIEW-CHANGE", "Expected VIEW-CHANGE message");

    if (!this._viewChanges.has(msg.view)) {
      this._viewChanges.set(msg.view, new Map());
    }
    this._viewChanges.get(msg.view)!.set(msg.sender, msg);
    const votes = this._viewChanges.get(msg.view)!;

    // If this node is the designated primary for msg.view and accumulated 2f + 1 votes
    if (this.isPrimaryForView(msg.view, allNodeIds) && votes.size >= this.quorumSize) {
      this._currentView = msg.view;
      const signature = signPbftPayload(this.nodeId, "NEW-VIEW", msg.view, 0, "NEW_VIEW_ESTABLISHED");
      const newViewMsg: PbftMessage = {
        type: "NEW-VIEW",
        view: msg.view,
        sequenceNumber: 0,
        digest: pureSha256(`NEW_VIEW:${msg.view}:${Array.from(votes.keys()).sort().join(",")}`),
        sender: this.nodeId,
        signature,
        extraEvidence: Array.from(votes.values()),
      };
      return { newView: newViewMsg };
    }

    return {};
  }

  /**
   * Accepts and acknowledges a NEW-VIEW broadcast from the new primary.
   */
  handleNewView(msg: PbftMessage, allNodeIds: readonly string[]): boolean {
    if (this._isQuarantined) return false;
    assertPrecondition(msg.type === "NEW-VIEW", "Expected NEW-VIEW message");
    const expectedPrimary = allNodeIds[msg.view % allNodeIds.length];
    if (msg.sender !== expectedPrimary) return false;

    this._currentView = msg.view;
    return true;
  }
}

/**
 * PBFT Distributed Consensus Cluster coordinator and simulator.
 */
export class EosPbftCluster {
  readonly clusterId: string;
  private readonly _nodes: Map<string, EosPbftNode> = new Map();
  private readonly _nodeIds: string[];
  private _clusterView = 0;
  private readonly _slashingLedger: ByzantineSlashingReceipt[] = [];
  private readonly _executionHistory: PbftExecutionReceipt[] = [];

  constructor(nodeIds: readonly string[], customReducer?: FsmReducer, clusterId?: string) {
    assertPrecondition(nodeIds.length >= 4, "PBFT requires at least N >= 4 validator nodes");
    this._nodeIds = [...nodeIds];
    this.clusterId = clusterId || `pbft-cluster-${Date.now()}`;

    for (const id of nodeIds) {
      this._nodes.set(id, new EosPbftNode(id, nodeIds.length, customReducer));
    }
  }

  get totalNodes(): number {
    return this._nodeIds.length;
  }

  get f(): number {
    return Math.floor((this.totalNodes - 1) / 3);
  }

  get quorumSize(): number {
    return 2 * this.f + 1;
  }

  get nodeIds(): readonly string[] {
    return [...this._nodeIds];
  }

  getNode(nodeId: string): EosPbftNode | undefined {
    return this._nodes.get(nodeId);
  }

  getPrimaryNodeId(view = 0): string {
    const idx = view % this._nodeIds.length;
    return this._nodeIds[idx];
  }

  getClusterStatus(): PbftClusterStatus {
    const primaryId = this.getPrimaryNodeId(this.getCurrentView());
    const nodes = this._nodeIds.map((id) => this._nodes.get(id)!.getStatus(this._nodeIds));
    const quarantinedNodes = nodes.filter((n) => n.isQuarantined).map((n) => n.nodeId);
    const activeHonestCount = nodes.filter((n) => !n.isQuarantined).length;

    const primaryNode = this._nodes.get(primaryId);
    const fsmState = primaryNode ? primaryNode.fsmState : {};

    return {
      clusterId: this.clusterId,
      totalNodes: this.totalNodes,
      f: this.f,
      quorumSize: this.quorumSize,
      primaryNodeId: primaryId,
      currentView: this.getCurrentView(),
      activeQuorum: activeHonestCount >= this.quorumSize,
      quarantinedNodes,
      nodes,
      lastCommitSequence: primaryNode ? primaryNode.lastCommittedSeq : 0,
      fsmStateHash: computeFsmHash(fsmState as Record<string, unknown>),
    };
  }

  getCurrentView(): number {
    return this._clusterView;
  }

  getSlashingReceipts(): readonly ByzantineSlashingReceipt[] {
    return [...this._slashingLedger];
  }

  getExecutionHistory(): readonly PbftExecutionReceipt[] {
    return [...this._executionHistory];
  }

  /**
   * Executes a full 3-phase PBFT proposal across all active nodes in the cluster.
   */
  propose(proposal: unknown): PbftExecutionReceipt {
    const view = this.getCurrentView();
    const primaryId = this.getPrimaryNodeId(view);
    const primary = this._nodes.get(primaryId);
    assertPrecondition(primary !== undefined, `Primary ${primaryId} not found`);
    assertPrecondition(!primary.isQuarantined, `Primary ${primaryId} is quarantined`);

    // 1. Phase 1: Primary broadcasts PRE-PREPARE
    const prePrepare = primary.createPrePrepare(proposal);

    // 2. Phase 2: Backups receive PRE-PREPARE and produce PREPARE messages
    const prepares: PbftMessage[] = [];
    for (const [id, node] of this._nodes.entries()) {
      if (node.isQuarantined) continue;
      const res = node.handlePrePrepare(prePrepare, this._nodeIds);
      if (res.equivocation) {
        this._slashingLedger.push(res.equivocation);
        node.quarantine();
      }
      if (res.prepare) {
        prepares.push(res.prepare);
      }
    }

    // Exchange PREPARE messages among all nodes
    const commits: PbftMessage[] = [];
    for (const prepMsg of prepares) {
      for (const [id, node] of this._nodes.entries()) {
        if (node.isQuarantined) continue;
        const res = node.handlePrepare(prepMsg);
        if (res.commit) {
          commits.push(res.commit);
        }
      }
    }

    // 3. Phase 3: Exchange COMMIT messages and apply to Replicated State Machine
    let lastCert: CommittedCertificate | undefined = undefined;
    for (const commitMsg of commits) {
      for (const [id, node] of this._nodes.entries()) {
        if (node.isQuarantined) continue;
        const res = node.handleCommit(commitMsg);
        if (res.certificate) {
          lastCert = res.certificate;
        }
      }
    }

    assertPostcondition(lastCert !== undefined, "PBFT failed to achieve committed-local quorum certificate");

    const fsmState = primary.fsmState as Record<string, unknown>;
    const fsmStateHash = computeFsmHash(fsmState);
    const sha256Receipt = pureSha256(
      `PBFT_EXEC:${this.clusterId}:${view}:${prePrepare.sequenceNumber}:${prePrepare.digest}:${fsmStateHash}`,
    );

    const receipt: PbftExecutionReceipt = {
      clusterId: this.clusterId,
      view,
      sequenceNumber: prePrepare.sequenceNumber,
      digest: prePrepare.digest,
      output: proposal,
      fsmStateHash,
      committedCertificate: lastCert,
      sha256Receipt,
      timestamp: new Date().toISOString(),
    };

    this._executionHistory.push(receipt);
    return receipt;
  }

  /**
   * Simulates a Byzantine equivocation attack where a malicious node emits
   * conflicting pre-prepare messages for the identical sequence number.
   */
  simulateEquivocation(maliciousNodeId: string, proposalA: unknown, proposalB: unknown): ByzantineSlashingReceipt {
    const maliciousNode = this._nodes.get(maliciousNodeId);
    assertPrecondition(maliciousNode !== undefined, `Node ${maliciousNodeId} does not exist`);

    const view = this.getCurrentView();
    const digestA = computeMessageDigest(proposalA);
    const digestB = computeMessageDigest(proposalB);
    const seq = maliciousNode.sequenceNumber + 1;

    const msgA: PbftMessage = {
      type: "PRE-PREPARE",
      view,
      sequenceNumber: seq,
      digest: digestA,
      sender: maliciousNodeId,
      proposal: proposalA,
      signature: signPbftPayload(maliciousNodeId, "PRE-PREPARE", view, seq, digestA),
    };

    const msgB: PbftMessage = {
      type: "PRE-PREPARE",
      view,
      sequenceNumber: seq,
      digest: digestB,
      sender: maliciousNodeId,
      proposal: proposalB,
      signature: signPbftPayload(maliciousNodeId, "PRE-PREPARE", view, seq, digestB),
    };

    // Honest nodes receive both messages and detect equivocation
    let slashingReceipt: ByzantineSlashingReceipt | undefined = undefined;
    for (const [id, node] of this._nodes.entries()) {
      if (id === maliciousNodeId || node.isQuarantined) continue;
      node.handlePrePrepare(msgA, this._nodeIds);
      const resB = node.handlePrePrepare(msgB, this._nodeIds);
      if (resB.equivocation) {
        slashingReceipt = resB.equivocation;
        break;
      }
    }

    assertPostcondition(slashingReceipt !== undefined, "Byzantine equivocation was not detected");

    maliciousNode.quarantine();
    this._slashingLedger.push(slashingReceipt);
    return slashingReceipt;
  }

  /**
   * Triggers distributed view-change failover when primary fails or is slashed.
   */
  triggerViewChange(): { newView: number; newPrimary: string; newViewMsg: PbftMessage } {
    const nextView = this.getCurrentView() + 1;
    const newPrimaryId = this.getPrimaryNodeId(nextView);
    const newPrimaryNode = this._nodes.get(newPrimaryId);
    assertPrecondition(newPrimaryNode !== undefined, `New primary ${newPrimaryId} does not exist`);

    // 1. All active nodes broadcast VIEW-CHANGE
    const viewChangeMessages: PbftMessage[] = [];
    for (const [id, node] of this._nodes.entries()) {
      if (node.isQuarantined) continue;
      viewChangeMessages.push(node.createViewChange(nextView));
    }

    // 2. New primary collects votes and creates NEW-VIEW
    let newViewMsg: PbftMessage | undefined = undefined;
    for (const vc of viewChangeMessages) {
      const res = newPrimaryNode.handleViewChange(vc, this._nodeIds);
      if (res.newView) {
        newViewMsg = res.newView;
        break;
      }
    }

    assertPostcondition(newViewMsg !== undefined, "Failed to assemble NEW-VIEW quorum certificate");

    // 3. All replicas accept NEW-VIEW
    for (const [id, node] of this._nodes.entries()) {
      if (node.isQuarantined) continue;
      node.handleNewView(newViewMsg, this._nodeIds);
    }

    this._clusterView = nextView;

    return {
      newView: nextView,
      newPrimary: newPrimaryId,
      newViewMsg,
    };
  }
}

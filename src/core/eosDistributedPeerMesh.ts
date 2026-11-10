/**
 * EosDistributedPeerMesh (Layer 0 — Decentralized Peer Mesh & Gossip Engine)
 * SPEC-188: Decentralized Distributed Peer Mesh Engine
 * CHANGE-073: Distributed Peer Mesh Engine
 *
 * Implements the SWIM (Structured Weakly-consistent Infection-style Process Group Membership Protocol)
 * failure detection architecture with Lamport / Vector Clock causal consistency.
 *
 * Designed for multi-agent and multi-node sovereign control plane coordination,
 * zero-dependency edge peer clustering, and deterministic conflict resolution.
 *
 * Strictly ZERO external runtime dependencies.
 */

import { assertPrecondition, assertPostcondition, assertInvariant } from "./eosKernelPrimitives.ts";

export type PeerStatus = "ALIVE" | "SUSPECT" | "DEAD";

export type ClockCausality = "DOMINATES" | "PRECEDED" | "EQUAL" | "CONCURRENT";

export interface PeerNode {
  readonly nodeId: string;
  readonly address: string;
  readonly port: number;
  status: PeerStatus;
  incarnation: number;
  metadata: Record<string, unknown>;
  lastSeenTimestamp: number;
}

export type VectorClock = Record<string, number>;

export interface ClusterStateEntry<T = unknown> {
  key: string;
  value: T;
  clock: VectorClock;
  updatedAt: number;
  updatedBy: string;
}

export interface GossipMembershipDelta {
  nodeId: string;
  address: string;
  port: number;
  status: PeerStatus;
  incarnation: number;
  metadata?: Record<string, unknown>;
}

export interface GossipSyncPacket {
  senderId: string;
  senderIncarnation: number;
  timestamp: number;
  membershipDeltas: GossipMembershipDelta[];
  stateDeltas: ClusterStateEntry[];
}

export interface PeerMeshConfig {
  localNodeId: string;
  address?: string;
  port?: number;
  gossipFanout?: number;
  suspectTimeoutMs?: number;
  deadTimeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export interface PeerMeshMetrics {
  totalPeers: number;
  alivePeers: number;
  suspectPeers: number;
  deadPeers: number;
  stateKeysCount: number;
  gossipRoundsRun: number;
  incarnation: number;
}

/**
 * Decentralized Distributed Peer Mesh
 */
export class EosDistributedPeerMesh {
  public readonly localNodeId: string;
  public readonly address: string;
  public readonly port: number;
  public readonly gossipFanout: number;
  public readonly suspectTimeoutMs: number;
  public readonly deadTimeoutMs: number;

  private _incarnation: number;
  private _peers: Map<string, PeerNode>;
  private _vectorClock: VectorClock;
  private _clusterState: Map<string, ClusterStateEntry>;
  private _gossipRoundsRun: number;

  constructor(config: PeerMeshConfig) {
    assertPrecondition(
      typeof config?.localNodeId === "string" && config.localNodeId.trim().length > 0,
      "EosDistributedPeerMesh: localNodeId must be a non-empty string",
    );

    this.localNodeId = config.localNodeId.trim();
    this.address = config.address ?? "127.0.0.1";
    this.port = config.port ?? 8000;
    this.gossipFanout = Math.max(1, config.gossipFanout ?? 3);
    this.suspectTimeoutMs = Math.max(10, config.suspectTimeoutMs ?? 1000);
    this.deadTimeoutMs = Math.max(10, config.deadTimeoutMs ?? 3000);

    this._incarnation = 0;
    this._peers = new Map();
    this._vectorClock = { [this.localNodeId]: 0 };
    this._clusterState = new Map();
    this._gossipRoundsRun = 0;

    // Register self as the first ALIVE node in the membership table
    const now = Date.now();
    this._peers.set(this.localNodeId, {
      nodeId: this.localNodeId,
      address: this.address,
      port: this.port,
      status: "ALIVE",
      incarnation: this._incarnation,
      metadata: config.metadata ? { ...config.metadata } : {},
      lastSeenTimestamp: now,
    });

    assertInvariant(
      this._peers.has(this.localNodeId),
      "Local node must be present in membership table after initialization",
    );
  }

  // ============================================================================
  // 1. MEMBERSHIP LIFECYCLE & FAILURE DETECTION
  // ============================================================================

  /**
   * Registers or updates a peer in the local cluster membership table.
   */
  public registerPeer(
    peer: Omit<PeerNode, "lastSeenTimestamp" | "metadata"> & {
      metadata?: Record<string, unknown>;
      lastSeenTimestamp?: number;
    },
  ): PeerNode {
    assertPrecondition(
      typeof peer?.nodeId === "string" && peer.nodeId.trim().length > 0,
      "registerPeer: peer nodeId must be a non-empty string",
    );

    const now = peer.lastSeenTimestamp ?? Date.now();
    const existing = this._peers.get(peer.nodeId);

    if (existing) {
      // Apply SWIM incarnation precedence rules
      if (peer.incarnation > existing.incarnation) {
        existing.status = peer.status;
        existing.incarnation = peer.incarnation;
        existing.lastSeenTimestamp = now;
        if (peer.metadata) {
          existing.metadata = { ...existing.metadata, ...peer.metadata };
        }
      } else if (peer.incarnation === existing.incarnation) {
        // Within same incarnation: SUSPECT overrides ALIVE, DEAD overrides SUSPECT
        if (this._isMoreSevereStatus(peer.status, existing.status)) {
          existing.status = peer.status;
          existing.lastSeenTimestamp = now;
        }
      }
      return existing;
    }

    const newPeer: PeerNode = {
      nodeId: peer.nodeId,
      address: peer.address,
      port: peer.port,
      status: peer.status,
      incarnation: peer.incarnation ?? 0,
      metadata: peer.metadata ? { ...peer.metadata } : {},
      lastSeenTimestamp: now,
    };

    this._peers.set(peer.nodeId, newPeer);

    // Track peer in vector clock if not already initialized
    if (this._vectorClock[peer.nodeId] === undefined) {
      this._vectorClock[peer.nodeId] = 0;
    }

    assertPostcondition(this._peers.has(peer.nodeId), "Peer must be registered in cluster membership table");
    return newPeer;
  }

  /**
   * Retrieves a peer by its node ID.
   */
  public getPeer(nodeId: string): PeerNode | undefined {
    return this._peers.get(nodeId);
  }

  /**
   * Returns a copy of peers matching optional status filters.
   */
  public listPeers(filter?: { status?: PeerStatus }): PeerNode[] {
    const list: PeerNode[] = [];
    for (const peer of this._peers.values()) {
      if (!filter?.status || peer.status === filter.status) {
        list.push({ ...peer, metadata: { ...peer.metadata } });
      }
    }
    return list;
  }

  /**
   * Returns the count of ALIVE peers in the cluster.
   */
  public getActivePeerCount(): number {
    let count = 0;
    for (const peer of this._peers.values()) {
      if (peer.status === "ALIVE") count++;
    }
    return count;
  }

  /**
   * Records an explicit heartbeat acknowledgment from a peer node.
   * If the peer was in SUSPECT state, resets it to ALIVE.
   */
  public recordHeartbeat(nodeId: string, timestamp?: number): void {
    const peer = this._peers.get(nodeId);
    if (!peer) return;

    const ts = timestamp ?? Date.now();
    peer.lastSeenTimestamp = ts;

    if (peer.status === "SUSPECT") {
      peer.status = "ALIVE";
    }
  }

  /**
   * Increments the local node's incarnation epoch to refute false suspicion.
   */
  public refuteSuspicion(): number {
    this._incarnation++;
    const selfPeer = this._peers.get(this.localNodeId);
    if (selfPeer) {
      selfPeer.incarnation = this._incarnation;
      selfPeer.status = "ALIVE";
      selfPeer.lastSeenTimestamp = Date.now();
    }
    return this._incarnation;
  }

  /**
   * Evaluates failure detection criteria across all remote peers.
   * Transitions nodes from ALIVE to SUSPECT, and SUSPECT to DEAD when timeouts expire.
   */
  public evaluateFailureDetector(now: number = Date.now()): {
    transitionedToSuspect: string[];
    transitionedToDead: string[];
  } {
    const transitionedToSuspect: string[] = [];
    const transitionedToDead: string[] = [];

    for (const peer of this._peers.values()) {
      // Never transition local node
      if (peer.nodeId === this.localNodeId) continue;

      const elapsed = now - peer.lastSeenTimestamp;

      if (peer.status === "ALIVE" && elapsed >= this.suspectTimeoutMs) {
        peer.status = "SUSPECT";
        transitionedToSuspect.push(peer.nodeId);
      } else if (peer.status === "SUSPECT" && elapsed >= this.suspectTimeoutMs + this.deadTimeoutMs) {
        peer.status = "DEAD";
        transitionedToDead.push(peer.nodeId);
      }
    }

    return { transitionedToSuspect, transitionedToDead };
  }

  // ============================================================================
  // 2. VECTOR CLOCK CAUSALITY & SHARED STATE
  // ============================================================================

  /**
   * Returns an immutable copy of the local vector clock.
   */
  public getVectorClock(): Readonly<VectorClock> {
    return { ...this._vectorClock };
  }

  /**
   * Increments local node's counter in the vector clock.
   */
  public incrementVectorClock(): VectorClock {
    this._vectorClock[this.localNodeId] = (this._vectorClock[this.localNodeId] ?? 0) + 1;
    return { ...this._vectorClock };
  }

  /**
   * Monotonically merges two vector clocks using element-wise maximums.
   */
  public static mergeVectorClocks(a: VectorClock, b: VectorClock): VectorClock {
    const merged: VectorClock = { ...a };
    for (const [nodeId, counter] of Object.entries(b)) {
      merged[nodeId] = Math.max(merged[nodeId] ?? 0, counter);
    }
    return merged;
  }

  /**
   * Determines the causal relationship between two vector clocks:
   * - DOMINATES: clock A is strictly newer or identical to B on all nodes, strictly greater on at least one.
   * - EQUAL: identical on all nodes.
   * - PRECEDED: clock A is strictly older than B.
   * - CONCURRENT: some nodes have A > B, others have B > A (conflict requiring tie-break).
   */
  public static compareVectorClocks(a: VectorClock, b: VectorClock): ClockCausality {
    const allNodes = new Set([...Object.keys(a), ...Object.keys(b)]);
    let aGreater = false;
    let bGreater = false;

    for (const node of allNodes) {
      const valA = a[node] ?? 0;
      const valB = b[node] ?? 0;

      if (valA > valB) aGreater = true;
      if (valB > valA) bGreater = true;
    }

    if (!aGreater && !bGreater) return "EQUAL";
    if (aGreater && !bGreater) return "DOMINATES";
    if (!aGreater && bGreater) return "PRECEDED";
    return "CONCURRENT";
  }

  /**
   * Sets a cluster-wide key-value state entry.
   * Increments local vector clock and updates state entry with causal metadata.
   */
  public setState<T>(key: string, value: T): ClusterStateEntry<T> {
    assertPrecondition(typeof key === "string" && key.trim().length > 0, "setState: key must be a non-empty string");

    this.incrementVectorClock();
    const entry: ClusterStateEntry<T> = {
      key: key.trim(),
      value,
      clock: { ...this._vectorClock },
      updatedAt: Date.now(),
      updatedBy: this.localNodeId,
    };

    this._clusterState.set(entry.key, entry as ClusterStateEntry);
    return entry;
  }

  /**
   * Retrieves a cluster-wide key-value state entry.
   */
  public getState<T>(key: string): T | undefined {
    const entry = this._clusterState.get(key);
    return entry ? (entry.value as T) : undefined;
  }

  /**
   * Retrieves full state metadata entry including vector clock.
   */
  public getStateEntry<T>(key: string): ClusterStateEntry<T> | undefined {
    const entry = this._clusterState.get(key);
    return entry ? (entry as ClusterStateEntry<T>) : undefined;
  }

  /**
   * Merges incoming remote state entries using causal clock dominance
   * with Last-Write-Wins (LWW) deterministic tie-break for concurrent updates.
   */
  public mergeStateEntries(remoteEntries: ClusterStateEntry[]): {
    appliedKeys: string[];
    ignoredKeys: string[];
  } {
    const appliedKeys: string[] = [];
    const ignoredKeys: string[] = [];

    for (const remote of remoteEntries) {
      if (!remote?.key) continue;

      const local = this._clusterState.get(remote.key);
      if (!local) {
        this._clusterState.set(remote.key, { ...remote, clock: { ...remote.clock } });
        this._vectorClock = EosDistributedPeerMesh.mergeVectorClocks(this._vectorClock, remote.clock);
        appliedKeys.push(remote.key);
        continue;
      }

      const relation = EosDistributedPeerMesh.compareVectorClocks(remote.clock, local.clock);

      if (relation === "DOMINATES") {
        this._clusterState.set(remote.key, { ...remote, clock: { ...remote.clock } });
        this._vectorClock = EosDistributedPeerMesh.mergeVectorClocks(this._vectorClock, remote.clock);
        appliedKeys.push(remote.key);
      } else if (relation === "CONCURRENT") {
        // Deterministic Last-Write-Wins (LWW) with node ID lexicographical tie-break
        const remoteWins =
          remote.updatedAt > local.updatedAt ||
          (remote.updatedAt === local.updatedAt && remote.updatedBy > local.updatedBy);

        if (remoteWins) {
          this._clusterState.set(remote.key, { ...remote, clock: { ...remote.clock } });
          this._vectorClock = EosDistributedPeerMesh.mergeVectorClocks(this._vectorClock, remote.clock);
          appliedKeys.push(remote.key);
        } else {
          this._vectorClock = EosDistributedPeerMesh.mergeVectorClocks(this._vectorClock, remote.clock);
          ignoredKeys.push(remote.key);
        }
      } else {
        // EQUAL or PRECEDED: local state already matches or dominates
        ignoredKeys.push(remote.key);
      }
    }

    return { appliedKeys, ignoredKeys };
  }

  // ============================================================================
  // 3. GOSSIP SYNC & PACKET DISSEMINATION
  // ============================================================================

  /**
   * Generates a gossip sync packet containing membership deltas and cluster state.
   */
  public createGossipPacket(): GossipSyncPacket {
    this._gossipRoundsRun++;

    const membershipDeltas: GossipMembershipDelta[] = [];
    for (const peer of this._peers.values()) {
      membershipDeltas.push({
        nodeId: peer.nodeId,
        address: peer.address,
        port: peer.port,
        status: peer.status,
        incarnation: peer.incarnation,
        metadata: { ...peer.metadata },
      });
    }

    const stateDeltas: ClusterStateEntry[] = [];
    for (const entry of this._clusterState.values()) {
      stateDeltas.push({
        ...entry,
        clock: { ...entry.clock },
      });
    }

    return {
      senderId: this.localNodeId,
      senderIncarnation: this._incarnation,
      timestamp: Date.now(),
      membershipDeltas,
      stateDeltas,
    };
  }

  /**
   * Selects k random active peer recipients for epidemic gossip dissemination.
   */
  public selectGossipTargets(fanout: number = this.gossipFanout): PeerNode[] {
    const candidates = this.listPeers({ status: "ALIVE" }).filter((p) => p.nodeId !== this.localNodeId);

    if (candidates.length <= fanout) {
      return candidates;
    }

    // Modern Fisher-Yates partial shuffle to select k random targets
    const targets: PeerNode[] = [];
    const pool = [...candidates];
    for (let i = 0; i < fanout; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      targets.push(pool.splice(idx, 1)[0]!);
    }
    return targets;
  }

  /**
   * Ingests and processes an incoming gossip sync packet from a remote peer.
   */
  public processGossipPacket(packet: GossipSyncPacket): {
    appliedMembershipUpdates: number;
    appliedStateUpdates: number;
  } {
    assertPrecondition(
      packet && typeof packet.senderId === "string",
      "processGossipPacket: valid GossipSyncPacket is required",
    );

    let appliedMembership = 0;

    // 1. Process membership deltas
    if (Array.isArray(packet.membershipDeltas)) {
      for (const delta of packet.membershipDeltas) {
        if (!delta || !delta.nodeId) continue;

        // If the update is about the local node:
        if (delta.nodeId === this.localNodeId) {
          if (delta.status === "SUSPECT" || delta.status === "DEAD") {
            if (delta.incarnation >= this._incarnation) {
              // Refute the suspicion immediately by elevating local incarnation
              this.refuteSuspicion();
              appliedMembership++;
            }
          }
          continue;
        }

        // Apply to remote peer
        const updated = this.registerPeer({
          nodeId: delta.nodeId,
          address: delta.address,
          port: delta.port,
          status: delta.status,
          incarnation: delta.incarnation,
          metadata: delta.metadata,
          lastSeenTimestamp: packet.timestamp,
        });

        if (updated) {
          appliedMembership++;
        }
      }
    }

    // 2. Process cluster state deltas
    let appliedState = 0;
    if (Array.isArray(packet.stateDeltas) && packet.stateDeltas.length > 0) {
      const result = this.mergeStateEntries(packet.stateDeltas);
      appliedState = result.appliedKeys.length;
    }

    return {
      appliedMembershipUpdates: appliedMembership,
      appliedStateUpdates: appliedState,
    };
  }

  // ============================================================================
  // 4. METRICS & TELEMETRY
  // ============================================================================

  /**
   * Returns current peer mesh diagnostic metrics.
   */
  public getMeshMetrics(): PeerMeshMetrics {
    let alive = 0;
    let suspect = 0;
    let dead = 0;

    for (const peer of this._peers.values()) {
      if (peer.status === "ALIVE") alive++;
      else if (peer.status === "SUSPECT") suspect++;
      else if (peer.status === "DEAD") dead++;
    }

    return {
      totalPeers: this._peers.size,
      alivePeers: alive,
      suspectPeers: suspect,
      deadPeers: dead,
      stateKeysCount: this._clusterState.size,
      gossipRoundsRun: this._gossipRoundsRun,
      incarnation: this._incarnation,
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private _isMoreSevereStatus(newStatus: PeerStatus, currentStatus: PeerStatus): boolean {
    const severity: Record<PeerStatus, number> = {
      ALIVE: 1,
      SUSPECT: 2,
      DEAD: 3,
    };
    return severity[newStatus] > severity[currentStatus];
  }
}

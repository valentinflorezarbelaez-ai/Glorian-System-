/**
 * @fileoverview Type definitions for EosMultiNodeSwarmMesh.
 *
 * Implements SPEC-365 / CHANGE-227: Decentralized Multi-Node Swarm Clustering & P2P Mesh Gossip.
 * Strict Layer-0 types with zero external dependencies.
 */

export type NodeId = string;

export type NodeState = "OFFLINE" | "JOINING" | "ONLINE" | "SUSPECT" | "EVICTED";

export type GossipMessageType =
  "HELLO_PEER" | "HEARTBEAT" | "GOSSIP_DIGEST" | "TX_DELTA" | "WORK_STEAL_REQ" | "WORK_STEAL_RESP";

export type MeshVectorClock = Record<NodeId, number>;

export interface PeerDescriptor {
  readonly nodeId: NodeId;
  readonly address: string;
  readonly port: number;
  readonly state: NodeState;
  readonly lastSeenMs: number;
  readonly versionVector: MeshVectorClock;
  readonly taskQueueDepth: number;
}

export interface GossipDigest {
  readonly originNodeId: NodeId;
  readonly round: number;
  readonly versionVector: MeshVectorClock;
  readonly timestamp: number;
  readonly digestHash: string;
}

export interface DistributedTransaction {
  readonly txId: string;
  readonly originNodeId: NodeId;
  readonly payload: Record<string, unknown>;
  readonly merkleParentHash: string;
  readonly txHash: string;
  readonly signature: string;
}

export interface WorkStealContract {
  readonly stealId: string;
  readonly thiefNodeId: NodeId;
  readonly donorNodeId: NodeId;
  readonly tasksTransferred: number;
  readonly timestamp: number;
  readonly contractDigest: string;
}

export interface MeshClusterConfig {
  readonly localNodeId?: string;
  readonly listenPort?: number;
  readonly seedPeers?: readonly string[];
  readonly gossipIntervalMs?: number;
  readonly heartbeatTtlMs?: number;
  readonly bftQuorumThreshold?: number;
}

export interface MeshClusterStatus {
  readonly localNodeId: NodeId;
  readonly state: NodeState;
  readonly activePeersCount: number;
  readonly totalClusterNodes: number;
  readonly clusterMerkleRoot: string;
  readonly gossipRoundsCompleted: number;
  readonly totalTasksInMesh: number;
}

export interface EosMultiNodeSwarmMeshReceipt {
  readonly receiptId: string;
  readonly specId: "SPEC-365";
  readonly changeId: "CHANGE-227";
  readonly timestamp: number;
  readonly localNodeId: string;
  readonly clusterSize: number;
  readonly convergenceLatencyMs: number;
  readonly checks: {
    readonly layerZeroP2PTransport: "PASS" | "FAIL";
    readonly peerDiscoveryHandshake: "PASS" | "FAIL";
    readonly epidemicAntiEntropyGossip: "PASS" | "FAIL";
    readonly merkleDagLedgerReplication: "PASS" | "FAIL";
    readonly byzantineFaultTolerance: "PASS" | "FAIL";
    readonly crossNodeTaskWorkStealing: "PASS" | "FAIL";
    readonly zeroDependencyPurity: "PASS" | "FAIL";
  };
  readonly integrityHash: string;
}

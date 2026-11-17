/**
 * EOS SYSTEM — DISTRIBUTED CONSISTENT HASHING VECTOR MESH TYPES (SPEC-315 / CHANGE-177).
 *
 * Defines contracts for consistent hash rings with virtual nodes, Raft-replicated
 * partition membership, multi-replica fault domain placement, and federated scatter-gather search.
 */

import type { SimdHnswSearchResult, SimdQuantizedVector } from "./eosSimdQuantizedHnsw.types.ts";

export type MeshNodeState = "ACTIVE" | "JOINING" | "LEAVING" | "DOWN";

export interface MeshNode {
  readonly nodeId: string;
  readonly host: string;
  readonly port: number;
  readonly state: MeshNodeState;
  readonly vnodeCount: number;
  readonly faultDomain?: string;
}

export interface VirtualToken {
  readonly token: number;
  readonly nodeId: string;
}

export interface ConsistentHashRingConfig {
  readonly vnodesPerNode: number;
  readonly replicationFactor: number;
  readonly shardCapacityLimit?: number;
}

export interface PartitionShard {
  readonly shardId: string;
  readonly rangeStart: number;
  readonly rangeEnd: number;
  readonly primaryNodeId: string;
  readonly replicaNodeIds: string[];
  readonly vectorCount: number;
  readonly status: "HEALTHY" | "SPLITTING" | "REBALANCING";
}

export interface MeshRaftState {
  readonly currentTerm: number;
  readonly votedFor: string | null;
  readonly role: "LEADER" | "FOLLOWER" | "CANDIDATE";
  readonly leaderId: string | null;
  readonly commitIndex: number;
}

export interface MeshRaftLogEntry {
  readonly term: number;
  readonly index: number;
  readonly type: "MEMBERSHIP_JOIN" | "MEMBERSHIP_LEAVE" | "SHARD_SPLIT" | "REBALANCE";
  readonly payload: Record<string, unknown>;
}

export interface FederatedSearchResult extends SimdHnswSearchResult {
  readonly primaryShard: string;
  readonly nodeId: string;
}

export interface MeshClusterStats {
  readonly totalPhysicalNodes: number;
  readonly activeNodes: number;
  readonly totalVnodes: number;
  readonly totalShards: number;
  readonly totalVectors: number;
  readonly leaderId: string | null;
  readonly term: number;
  readonly loadVariancePct: number;
}

export interface DistributedVectorMeshReceipt {
  readonly specRef: "SPEC-315";
  readonly engine: "Distributed Consistent Hashing Vector Partition Mesh";
  readonly timestampIso: string;
  readonly totalNodes: number;
  readonly totalVnodes: number;
  readonly totalKeys: number;
  readonly replicationFactor: number;
  readonly quorumSatisfied: boolean;
  readonly ringContinuityVerified: boolean;
  readonly status: "VERIFIED" | "INVARIANT_BREACH";
  readonly sha256Signature: string;
}

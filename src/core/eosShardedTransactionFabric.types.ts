/**
 * EOS Sharded Transaction Fabric & State Mesh — Types
 *
 * SPEC-351 / CHANGE-213: Autonomous Quantum-Resilient Distributed Transaction Fabric & Sharded State Mesh.
 * Strictly pure Layer-0: zero runtime external dependencies.
 */

export interface Vnode {
  readonly vnodeId: string;
  readonly shardId: string;
  readonly token: bigint;
}

export interface HashRingConfig {
  readonly vnodesPerShard: number;
  readonly hashAlgorithm: "sha384" | "sha256";
}

export interface MvccVersion<T = unknown> {
  readonly txId: string;
  readonly commitTimestamp: number;
  readonly value: T;
  readonly isDeleted?: boolean;
}

export interface MvccRecord<T = unknown> {
  readonly key: string;
  readonly versions: MvccVersion<T>[];
}

export interface TransactionWriteOp<T = unknown> {
  readonly key: string;
  readonly value: T;
  readonly isDeleted?: boolean;
}

export interface TwoPhaseCommitRequest<T = unknown> {
  readonly txId: string;
  readonly readSnapshotTimestamp: number;
  readonly writes: TransactionWriteOp<T>[];
  readonly compensatingWrites?: TransactionWriteOp<T>[];
}

export interface PrepareVote {
  readonly shardId: string;
  readonly txId: string;
  readonly vote: "YES" | "NO";
  readonly reason?: string;
  readonly hmacSignature: string;
}

export interface CommitReceipt {
  readonly txId: string;
  readonly status: "COMMITTED" | "ABORTED";
  readonly commitTimestamp: number;
  readonly shardsInvolved: string[];
  readonly hmacSignature: string;
  readonly compensatingRollbackExecuted?: boolean;
}

export interface ShardedFabricAuditReceipt {
  readonly timestamp: string;
  readonly totalShards: number;
  readonly totalVnodes: number;
  readonly ringBalanceStandardDeviation: number;
  readonly mvccIsolationVerified: boolean;
  readonly twoPhaseCommitVerified: boolean;
  readonly rollbackSoundnessVerified: boolean;
  readonly postQuantumHmacVerified: boolean;
  readonly tlcModelPass: boolean;
  readonly status: "HEALTHY" | "DEGRADED";
}

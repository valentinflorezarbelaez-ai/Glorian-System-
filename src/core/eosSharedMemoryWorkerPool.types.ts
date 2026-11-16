/**
 * Glorian System — Shared-Memory Worker Pool & Multi-Process Jepsen WAL Recovery Types
 * Governed by SPEC-311 / CHANGE-173 / ADR-173
 *
 * Strictly Zero Runtime Dependencies (Law V).
 */

export interface SharedWasmArenaReport {
  readonly initialPages: number;
  readonly maxPages: number;
  readonly byteLength: number;
  readonly isSharedArrayBuffer: boolean;
  readonly atomicHeaderOffsetBytes: number;
  readonly payloadOffsetBytes: number;
}

export interface ParallelSharedArenaReductionReport {
  readonly elementCount: number;
  readonly workerCount: number;
  readonly totalSum: number;
  readonly maxElement: number;
  readonly atomicCompletedWorkers: number;
  readonly sharedMemoryVerified: boolean;
  readonly durationMs: number;
}

export interface ElasticFleetShardAuditItem {
  readonly shardId: number;
  readonly projectIds: readonly string[];
  readonly projectsAudited: number;
  readonly shardDigestSha256: string;
}

export interface ParallelElasticFleetAuditReport {
  readonly totalProjects: number;
  readonly shardCount: number;
  readonly atomicProgressCount: number;
  readonly shards: readonly ElasticFleetShardAuditItem[];
  readonly fleetMerkleRoot: string;
  readonly durationMs: number;
}

export interface MultiProcessWalCrashRecoveryReport {
  readonly committedRecordsExpected: number;
  readonly committedRecordsRecovered: number;
  readonly uncommittedDirtyRecordsLeaked: number;
  readonly walModeVerified: boolean;
  readonly crashSignalSimulated: string;
  readonly merkleRootBeforeCrash: string;
  readonly merkleRootAfterRecovery: string;
  readonly zeroDataLossVerified: boolean;
  readonly durationMs: number;
}

export interface SharedMemoryWorkerPoolReceipt {
  readonly timestampIso: string;
  readonly specRef: "SPEC-311";
  readonly changeRef: "CHANGE-173";
  readonly status: "SHARED_MEMORY_WORKERS_AND_JEPSEN_VERIFIED";
  readonly sharedArenaReport: SharedWasmArenaReport;
  readonly parallelReductionReport: ParallelSharedArenaReductionReport;
  readonly fleetShardReport: ParallelElasticFleetAuditReport;
  readonly walCrashRecoveryReport: MultiProcessWalCrashRecoveryReport;
  readonly inWasmSimdLoopNsPerOp: number;
  readonly cryptographicSignature: string;
}

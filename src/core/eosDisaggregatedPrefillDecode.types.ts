/**
 * Glorian System — Disaggregated Prefill & Decode Serving Engine Types
 * Governed by SPEC-332 / CHANGE-194 / ADR-194-001..003
 *
 * Invariant: Pure Layer-0 TypeScript. Zero external runtime dependencies.
 * Maximum lines <= 800 (SPEC-250 compliant).
 */

export type WorkerNodeRole = "PREFILL_WORKER" | "DECODE_WORKER";

export interface WorkerNodeState {
  nodeId: string;
  role: WorkerNodeRole;
  activeRequests: number;
  capacity: number;
  memoryAllocatedBytes: number;
  totalMemoryBytes: number;
  isSaturated: boolean;
}

export interface PrefillChunkDescriptor {
  requestId: string;
  chunkIndex: number;
  totalChunks: number;
  startToken: number;
  tokenCount: number;
  completed: boolean;
  flushedAtMs: number;
}

export interface KvPageDescriptor {
  pageId: string;
  tokenStartIndex: number;
  tokenCount: number;
  keyTensor: Float32Array;
  valueTensor: Float32Array;
  pageChecksumSha256: string;
}

export interface KvMigrationDescriptor {
  migrationId: string;
  requestId: string;
  sourceNodeId: string;
  targetNodeId: string;
  totalPages: number;
  totalTokens: number;
  pages: KvPageDescriptor[];
  migrationChecksumSha256: string;
  timestampIso: string;
}

export interface InferenceRequest {
  requestId: string;
  promptTokens: number[];
  maxOutputTokens: number;
  assignedPrefillNodeId: string | null;
  assignedDecodeNodeId: string | null;
  prefillCompleted: boolean;
  generatedTokens: number[];
  ttftMs: number | null;
  tpotMs: number | null;
  isCompleted: boolean;
  submittedAtMs: number;
}

export interface ClusterTopologyMetrics {
  prefillWorkersCount: number;
  decodeWorkersCount: number;
  pendingPrefillQueueDepth: number;
  activeDecodeStreamsCount: number;
  totalMigratedKvPages: number;
  avgTtftMs: number;
  avgTpotMs: number;
  headOfLineBlockingDetected: boolean;
}

export interface DisaggregatedAuditReceipt {
  specRef: string;
  engine: string;
  timestampIso: string;
  prefillNodes: number;
  decodeNodes: number;
  requestsServed: number;
  noHeadOfLineBlocking: boolean;
  kvIntegrityVerified: boolean;
  slaIsolationVerified: boolean;
  status: string;
  sha256Signature: string;
}

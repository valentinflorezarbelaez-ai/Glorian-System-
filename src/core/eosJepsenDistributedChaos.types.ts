/**
 * EOS SYSTEM — JEPSEN-GRADE DISTRIBUTED NETWORK CHAOS TYPES
 * Governed by SPEC-313 / CHANGE-175
 */

export const JepsenFaultType = {
  SYMMETRIC_PARTITION: "SYMMETRIC_PARTITION",
  ASYMMETRIC_PARTITION: "ASYMMETRIC_PARTITION",
  PACKET_LOSS: "PACKET_LOSS",
  CLOCK_SKEW: "CLOCK_SKEW",
  LATENCY_JITTER: "LATENCY_JITTER",
} as const;

export type JepsenFaultType = (typeof JepsenFaultType)[keyof typeof JepsenFaultType];

export const JepsenOperationType = {
  READ: "READ",
  WRITE: "WRITE",
} as const;

export type JepsenOperationType = (typeof JepsenOperationType)[keyof typeof JepsenOperationType];

export const JepsenOperationStatus = {
  INVOKED: "INVOKED",
  OK: "OK",
  FAIL: "FAIL",
} as const;

export type JepsenOperationStatus = (typeof JepsenOperationStatus)[keyof typeof JepsenOperationStatus];

export interface JepsenRegisterEntry {
  key: string;
  value: unknown;
  timestamp: number;
  nodeOrigin: string;
  vectorClock: Record<string, number>;
}

export interface JepsenNodeState {
  nodeId: string;
  wallClockOffsetMs: number;
  vectorClock: Record<string, number>;
  registerStore: Record<string, JepsenRegisterEntry>;
  sentCount: number;
  receivedCount: number;
  droppedCount: number;
}

export interface JepsenNetworkPacket {
  packetId: string;
  sourceId: string;
  targetId: string;
  payload: {
    type: "GOSSIP_UPDATE" | "CLIENT_WRITE" | "ANTI_ENTROPY_SYNC";
    entries: JepsenRegisterEntry[];
    senderClock: Record<string, number>;
  };
  timestamp: number;
  deliveryTick: number;
  dropped: boolean;
}

export interface JepsenPartitionRule {
  type: "SYMMETRIC" | "ASYMMETRIC";
  subsets?: string[][];
  severedLinks?: Array<{ from: string; to: string }>;
}

export interface JepsenClusterConfig {
  nodeCount: number;
  seed: number;
  defaultLatencyMs?: number;
  jitterMs?: number;
  packetLossRate?: number;
}

export interface JepsenOperationRecord {
  opId: string;
  type: JepsenOperationType;
  nodeId: string;
  key: string;
  value?: unknown;
  status: JepsenOperationStatus;
  invokeTime: number;
  completeTime?: number;
}

export interface JepsenConvergenceResult {
  converged: boolean;
  rounds: number;
  stateHash: string;
  divergentNodes: string[];
  nodeSnapshots: Record<string, Record<string, unknown>>;
}

export interface JepsenConsistencyAuditResult {
  totalOperations: number;
  okOperations: number;
  failedOperations: number;
  linearizabilityViolations: number;
  staleReadsDetected: number;
  violations: string[];
}

export interface JepsenAuditReceipt {
  timestampIso: string;
  specRef: string;
  seed: number;
  nodeCount: number;
  totalOperations: number;
  totalPackets: number;
  droppedPackets: number;
  linearizabilityViolations: number;
  converged: boolean;
  sha256: string;
}

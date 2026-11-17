/**
 * Glorian System — Deterministic Discrete-Event Simulation Hypervisor & Time-Travel Fault Injection Engine (DESH)
 * Governed by SPEC-334 / CHANGE-196 / ADR-196-001..003
 *
 * Invariant: Pure Layer-0 TypeScript, zero external runtime dependencies.
 */

export type SimulationNodeStatus = "RUNNING" | "STOPPED" | "CRASHED" | "PARTITIONED";

export type FaultType =
  | "PACKET_DROP"
  | "PACKET_DUPLICATION"
  | "PACKET_CORRUPTION"
  | "NETWORK_PARTITION"
  | "CLOCK_SKEW"
  | "NODE_CRASH"
  | "NODE_RESTART"
  | "ASYNC_STALL";

export interface DiscreteEvent<T = unknown> {
  id: string;
  scheduledTimeNs: number;
  priority: number;
  sequenceId: number;
  sourceNodeId: string;
  targetNodeId: string;
  eventType: string;
  payload: T;
  metadata?: Record<string, unknown>;
}

export interface VirtualNodeState {
  nodeId: string;
  role: string;
  status: SimulationNodeStatus;
  clockOffsetNs: number;
  inbox: DiscreteEvent[];
  customState: Record<string, unknown>;
}

export interface FaultRule {
  faultId: string;
  type: FaultType;
  probability: number;
  sourceNodeId?: string;
  targetNodeId?: string;
  partitionA?: string[];
  partitionB?: string[];
  clockSkewDeltaNs?: number;
  stallDurationNs?: number;
  active: boolean;
}

export interface SimulationCheckpoint {
  checkpointId: string;
  virtualTimeNs: number;
  sequenceCounter: number;
  prngState: string;
  eventQueue: DiscreteEvent[];
  nodeStates: Record<string, VirtualNodeState>;
  injectedFaultsCount: number;
  createdAt: string;
  stateHash: string;
}

export interface StateInvariant {
  name: string;
  description?: string;
  check: (state: {
    virtualTimeNs: number;
    nodeStates: Record<string, VirtualNodeState>;
    pendingEvents: DiscreteEvent[];
  }) => boolean;
}

export interface DeshStepResult {
  stepped: boolean;
  event?: DiscreteEvent;
  virtualTimeNs: number;
  faultApplied?: string;
  invariantViolation?: string;
}

export interface DeshAuditReceipt {
  runId: string;
  seed: string;
  virtualTimeNs: number;
  eventsProcessed: number;
  faultsInjected: number;
  checkpointsCreated: number;
  virtualTimeMonotonicity: boolean;
  prngDeterminism: boolean;
  snapshotConsistency: boolean;
  invariantsEvaluated: number;
  violationsCount: number;
  auditHash: string;
  timestamp: string;
}

export interface SimulationConfig {
  seed?: bigint | number | string;
  maxEvents?: number;
  maxVirtualTimeNs?: number;
}

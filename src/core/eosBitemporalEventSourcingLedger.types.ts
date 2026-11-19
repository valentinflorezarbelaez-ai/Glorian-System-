/**
 * EOS Bitemporal Dynamic State Machine & Event Sourcing Hyper-Ledger — Type Definitions
 *
 * SPEC-357 / CHANGE-219: Autonomous Bitemporal Dynamic State Machine & Event Sourcing Hyper-Ledger.
 * Provides formal type definitions for immutable 2D bitemporal Datoms, LIDR Agentic SDLC lifecycle events,
 * cryptographic Merkle block checkpoints, and time-travel state projection queries.
 *
 * @module eosBitemporalEventSourcingLedger.types
 */

/**
 * Mutation operator for Datomic-style facts: ASSERT adds a fact, RETRACT negates it.
 */
export type DatomOperation = "ASSERT" | "RETRACT";

/**
 * Immutable atomic Fact Datom with 2D bitemporal coordinates:
 * - Transaction Time (txTime): Monotonic engine record counter
 * - Valid Time (validFrom..validTo): Real-world interval when fact holds true
 */
export interface BitemporalDatom<V = unknown> {
  readonly entityId: string;
  readonly attribute: string;
  readonly value: V;
  readonly txTime: number;
  readonly validFrom: number;
  readonly validTo: number;
  readonly op: DatomOperation;
}

/**
 * LIDR Agentic Engineering SDLC Lifecycle Event Types.
 */
export type LidrSdlcEventType =
  | "SPEC_PROPOSED"
  | "SPEC_APPROVED"
  | "TASK_CLAIMED"
  | "CODE_APPLIED"
  | "EVIDENCE_RECORDED"
  | "SPEC_DRIFT_DETECTED"
  | "GATE_SEALED";

/**
 * Structured payload for a LIDR Agentic SDLC lifecycle transition.
 */
export interface LidrSdlcEventPayload {
  readonly specId: string;
  readonly agentId: string;
  readonly phase: string;
  readonly details: Record<string, unknown>;
}

/**
 * Cryptographic ledger block containing chained Datoms and Merkle root.
 */
export interface LedgerBlock {
  readonly blockIndex: number;
  readonly previousHash: string;
  readonly datoms: readonly BitemporalDatom[];
  readonly merkleRoot: string;
  readonly blockHash: string;
  readonly timestamp: string;
}

/**
 * 2D bitemporal query filter for time-travel state reconstruction.
 */
export interface BitemporalQueryFilter {
  readonly entityId?: string;
  readonly attribute?: string;
  readonly asOfTx?: number;
  readonly asOfValid?: number;
}

/**
 * Reconstructed state projection of an entity at a given (Tx, Vt) coordinate.
 */
export type EntityState = Record<string, unknown>;

/**
 * High-throughput benchmark performance telemetry.
 */
export interface LedgerBenchmarkResult {
  readonly transactionsAppended: number;
  readonly totalDurationUs: number;
  readonly throughputTps: number;
  readonly avgQueryLatencyUs: number;
  readonly merkleVerified: boolean;
}

/**
 * Formal verification audit receipt emitted by EosBitemporalLedgerCore.
 */
export interface BitemporalAuditReceipt {
  readonly specId: "SPEC-357";
  readonly changeId: "CHANGE-219";
  readonly timestamp: string;
  readonly blocksCount: number;
  readonly totalDatomsCount: number;
  readonly lidrEventsTracked: number;
  readonly benchmark: LedgerBenchmarkResult;
  readonly tlcModelVerified: boolean;
  readonly verdict: "CONFORMANT" | "DEVIATION_DETECTED";
  readonly epistemicState: "PRODUCTION_READY_WITHIN_TESTED_SCOPE";
}

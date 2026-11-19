/**
 * EOS Distributed Bitemporal CRDT Memory Synchronizer Types (SPEC-348)
 *
 * Provides type contracts for Hybrid Logical Clocks (HLC), conflict-free replicated
 * data types (LWW-Register, OR-Set, PN-Counter), and bitemporal ledger transactions.
 */

export interface HlcTimestamp {
  physicalTime: number;
  logicalCounter: number;
  nodeId: string;
  formatted: string;
}

export interface LwwRegister<T = unknown> {
  key: string;
  value: T;
  timestamp: HlcTimestamp;
  validFrom: number;
  validTo?: number | null;
  txTime: number;
}

export interface OrSetElement<T = unknown> {
  elementId: string;
  value: T;
  timestamp: HlcTimestamp;
  tag: string;
  validFrom: number;
  validTo?: number | null;
  txTime: number;
}

export interface OrSetState<T = unknown> {
  adds: Record<string, OrSetElement<T>>;
  tombstones: string[];
}

export interface PnCounterState {
  P: Record<string, number>;
  N: Record<string, number>;
}

export interface BitemporalRecord<T = unknown> {
  id: string;
  key: string;
  value: T;
  validFrom: number;
  validTo: number | null;
  txFrom: number;
  txTo: number | null;
  nodeId: string;
  hlc: HlcTimestamp;
}

export interface CrdtMemoryState {
  nodeId: string;
  registers: Record<string, LwwRegister>;
  sets: Record<string, OrSetState>;
  counters: Record<string, PnCounterState>;
  bitemporalLedger: BitemporalRecord[];
  lastHlc: HlcTimestamp;
}

export interface CrdtAuditReceipt {
  receiptId: string;
  timestamp: string;
  specId: string;
  status: "VERIFIED" | "FAILED";
  convergenceVerified: boolean;
  commutativityVerified: boolean;
  bitemporalFidelityVerified: boolean;
  activeNodes: string[];
  registerCount: number;
  setCount: number;
  counterCount: number;
  ledgerRecordCount: number;
  checksumSha256: string;
}

export interface AsOfQueryOptions {
  asOfValidTime?: number;
  asOfTxTime?: number;
}

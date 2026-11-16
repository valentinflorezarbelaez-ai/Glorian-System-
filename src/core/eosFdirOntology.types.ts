/**
 * GLORIAN SYSTEM — FDIR CLINICAL FIREWALL FOR KNOWLEDGE ONTOLOGY TYPES
 *
 * Formal contracts for semantic graph integrity inspection, orphan link quarantine,
 * surgical purging, Tarjan's SCC cycle isolation, and cryptographic audit receipts.
 *
 * Governed by SPEC-305 (FR-305-01..FR-305-06, BDD-1605..BDD-1610).
 * Strict Law V: Zero third-party runtime dependencies.
 */

export interface OrphanLinkAnomaly {
  readonly edgeId: string;
  readonly fromId: string;
  readonly toId: string;
  readonly predicate: string;
  readonly reason: "ORPHAN_SOURCE_NODE" | "ORPHAN_TARGET_NODE" | "ORPHAN_BOTH_NODES";
  readonly detectedAtIso: string;
}

export interface TarjanCycleReport {
  readonly cycleId: string;
  readonly nodes: readonly string[];
  readonly length: number;
  readonly severedEdgeId?: string;
}

export interface GraphIntegrityReport {
  readonly status: "OPTIMAL_HARMONY" | "REMEDIATION_REQUIRED";
  readonly totalNodes: number;
  readonly totalEdges: number;
  readonly orphanLinksCount: number;
  readonly orphanAnomalies: readonly OrphanLinkAnomaly[];
  readonly cyclesCount: number;
  readonly cycles: readonly TarjanCycleReport[];
  readonly scannedAtIso: string;
}

export interface SurgicalPurgeResult {
  readonly healed: boolean;
  readonly purgedEdgesCount: number;
  readonly cyclesBrokenCount: number;
  readonly remainingAnomaliesCount: number;
  readonly purgedEdgeIds: readonly string[];
  readonly timestampIso: string;
}

export interface FdirOntologyAuditReceipt {
  readonly receiptType: "EOS_FDIR_ONTOLOGY_AUDIT";
  readonly timestampIso: string;
  readonly specRef: "SPEC-305";
  readonly totalNodesEvaluated: number;
  readonly totalEdgesEvaluated: number;
  readonly orphanLinksPurged: number;
  readonly cyclesResolved: number;
  readonly harmonyRestored: boolean;
  readonly sha256Signature: string;
}

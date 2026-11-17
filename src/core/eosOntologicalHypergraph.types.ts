/**
 * Glorian System — Autonomous Ontological Hypergraph & Bitemporal Entity Resolution Engine
 * Governed by SPEC-333 / CHANGE-195 / ADR-195-001..003
 *
 * Provides high-assurance bitemporal knowledge representation, N-ary hyperedges,
 * deterministic entity deduplication, and fail-closed Multilevel Security (MLS).
 *
 * Invariant: Zero external runtime dependencies. Strict Layer-0 TypeScript.
 */

export type SecurityClassification = "UNCLASSIFIED" | "CONFIDENTIAL" | "SECRET" | "TOP_SECRET";

export interface SecurityContext {
  readonly clearance: SecurityClassification;
  readonly compartments: readonly string[];
}

export interface BitemporalInterval {
  readonly validFrom: number;
  readonly validTo: number;
  readonly txFrom: number;
  readonly txTo: number;
}

export interface OntologicalEntity {
  readonly entityId: string;
  readonly canonicalId: string;
  readonly name: string;
  readonly kind: string;
  readonly aliases: readonly string[];
  readonly attributes: Record<string, unknown>;
  readonly classification: SecurityClassification;
  readonly compartments: readonly string[];
  readonly temporal: BitemporalInterval;
  readonly confidenceScore: number;
  readonly source: string;
  readonly checksumSha256: string;
}

export interface HyperedgeParticipant {
  readonly entityId: string;
  readonly role: string;
}

export interface OntologicalHyperedge {
  readonly edgeId: string;
  readonly relation: string;
  readonly participants: readonly HyperedgeParticipant[];
  readonly properties: Record<string, unknown>;
  readonly classification: SecurityClassification;
  readonly compartments: readonly string[];
  readonly temporal: BitemporalInterval;
  readonly checksumSha256: string;
}

export interface EntityResolutionMatch {
  readonly sourceId: string;
  readonly canonicalId: string;
  readonly confidenceScore: number;
  readonly matchedAttributes: readonly string[];
  readonly method: "EXACT_IDENTIFIER" | "DETERMINISTIC_FINGERPRINT" | "LEXICAL_SIMILARITY";
}

export interface AsOfQueryFilter {
  readonly validTime: number;
  readonly asOfTxTime: number;
  readonly kind?: string;
  readonly relation?: string;
}

export interface HypergraphBlastRadiusResult {
  readonly rootEntityId: string;
  readonly impactedEntities: readonly {
    readonly entityId: string;
    readonly depth: number;
    readonly path: readonly string[];
  }[];
  readonly maxDepth: number;
  readonly totalImpacted: number;
}

export interface HypergraphAuditReceipt {
  readonly timestampIso: string;
  readonly specRef: "SPEC-333";
  readonly totalEntities: number;
  readonly totalHyperedges: number;
  readonly bitemporalMonotonicity: boolean;
  readonly mlsLatticeContainment: boolean;
  readonly referentialIntegrity: boolean;
  readonly deduplicationResolved: boolean;
  readonly sha256Digest: string;
}

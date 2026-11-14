/**
 * Type contracts for EosKnowledgeGraphEngine (SPEC-145 / SPEC-151).
 * Extracted into standalone types module per SPEC-250 / CHANGE-126 structural headroom discipline.
 */

export type NodeType = "SPEC" | "CHANGE" | "PLAN" | "ADR" | "BDD" | "MODULE" | "EVIDENCE";

export type EdgeRelation =
  | "IMPLEMENTS"
  | "VERIFIES"
  | "DECIDED_BY"
  | "MODIFIES"
  | "TOUCHES"
  | "DEPENDS_ON"
  | "SUPERSEDES"
  | "HAS_SCENARIO"
  | "INSTRUMENTS"
  | "COVERED_BY";

export interface GraphNode {
  readonly id: string;
  readonly type: NodeType;
  readonly title: string;
  readonly file: string;
  readonly metadata: Record<string, unknown>;
  readonly sha256: string;
  readonly updatedAt: number;
}

export interface GraphEdge {
  readonly sourceId: string;
  readonly targetId: string;
  readonly relation: EdgeRelation;
  readonly weight: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: number;
}

export interface BlastRadiusResult {
  readonly rootNodeId: string;
  readonly maxDepth: number;
  readonly direction: "BOTH" | "OUT" | "IN";
  readonly totalReachable: number;
  readonly nodes: Array<GraphNode & { depth: number; path: string }>;
  readonly edges: GraphEdge[];
  readonly durationMs: number;
}

export interface MemoryClosureResult {
  readonly rootNodeId: string;
  readonly maxDepth: number;
  readonly reachableNodeIds: readonly string[];
  readonly totalReachable: number;
  readonly depth: number;
  readonly executionUs: number;
  readonly index: "memory-adjacency";
}

export interface OrphanReport {
  readonly totalOrphans: number;
  readonly specsWithoutBdd: string[];
  readonly bddsWithoutSpec: string[];
  readonly unanchoredModules: string[];
  readonly disconnectedNodes: string[];
  readonly coverageRatio: number;
  readonly durationMs: number;
}

export interface GraphStats {
  readonly totalNodes: number;
  readonly totalEdges: number;
  readonly nodesByType: Record<string, number>;
  readonly edgesByRelation: Record<string, number>;
  readonly density: number;
  readonly graphSha256: string;
  readonly topHubs: Array<{ id: string; type: NodeType; degree: number }>;
}

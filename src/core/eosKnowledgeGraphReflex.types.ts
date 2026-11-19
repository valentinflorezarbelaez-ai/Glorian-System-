/**
 * Glorian System — Closed-Loop Knowledge Graph & Semantic Reflex Engine Types
 * Governed by SPEC-345 / CHANGE-207
 *
 * Invariant: Pure Layer-0 types with zero external dependencies.
 */

export type NodeType = "SPECIFICATION" | "INVARIANT" | "FILE" | "FLEET_REPO" | "DECISION" | "FINDING" | "CONCEPT";

export type EdgeType = "GOVERNS" | "DEPENDS_ON" | "PRESERVES" | "RESOLVES" | "MUTATES" | "VIOLATES";

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  properties?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  weight?: number;
  properties?: Record<string, unknown>;
}

export interface EosKnowledgeGraphState {
  nodes: Map<string, GraphNode>;
  outEdges: Map<string, GraphEdge[]>;
  inEdges: Map<string, GraphEdge[]>;
  edges: Map<string, GraphEdge>;
  txSequence: number;
  stateHash: string;
}

export interface BlastRadiusOptions {
  maxDepth?: number;
  direction?: "DOWNSTREAM" | "UPSTREAM" | "BIDIRECTIONAL";
  edgeTypes?: EdgeType[];
}

export interface ImpactedNode {
  id: string;
  type: NodeType;
  depth: number;
  path: string[];
}

export interface BlastRadiusReport {
  rootId: string;
  direction: "DOWNSTREAM" | "UPSTREAM" | "BIDIRECTIONAL";
  maxDepth: number;
  impactedNodes: ImpactedNode[];
  severityScore: number;
}

export interface CycleDetectionReport {
  hasCycles: boolean;
  cycleCount: number;
  cycles: string[][];
}

export interface TopologicalSortReport {
  isDag: boolean;
  orderedNodeIds: string[];
  unresolvedCount: number;
}

export interface PageRankOptions {
  dampingFactor?: number;
  maxIterations?: number;
  tolerance?: number;
}

export interface PageRankReport {
  ranks: Record<string, number>;
  iterations: number;
  dampingFactor: number;
  convergenceDelta: number;
}

export interface ReflexTriggerEvent {
  triggerEntityId: string;
  eventType: "NODE_ADDED" | "NODE_UPDATED" | "NODE_DELETED" | "EDGE_ADDED" | "EDGE_DELETED";
  payload?: Record<string, unknown>;
  depth?: number;
  lineage?: string[];
}

export interface ReflexAction {
  id: string;
  triggerEntityId: string;
  eventType: string;
  actionType: "INVALIDATE_CACHE" | "TRIGGER_TEST" | "FLAG_VIOLATION" | "AUDIT_ALERT";
  actionPayload: Record<string, unknown>;
  depth: number;
}

export type ReflexHookHandler = (event: ReflexTriggerEvent, graph: EosKnowledgeGraphState) => ReflexAction[] | void;

export interface KnowledgeGraphAuditReceipt {
  spec: string;
  timestamp: string;
  nodeCount: number;
  edgeCount: number;
  cyclesDetected: boolean;
  topologicalSortValid: boolean;
  blastRadiusVerified: boolean;
  reflexCascadeBounded: boolean;
  allPassed: boolean;
  sha256: string;
}

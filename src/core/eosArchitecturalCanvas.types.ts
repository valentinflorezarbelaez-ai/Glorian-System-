/**
 * SPEC-358 / CHANGE-220: Live Self-Introspecting Architectural Canvas & Bi-Directional Interactive Topology Engine
 * Type Definitions & Contracts.
 */

export type CanvasNodeType = "CORE_MODULE" | "OPENSPEC" | "TLA_MODEL" | "FLEET_REPO" | "LAYER_BOUNDARY";

export type CanvasEdgeType = "DEPENDS_ON" | "SPECIFIES" | "VERIFIED_BY" | "GOVERNS" | "EXPORTS_TO";

export type CanvasRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface CanvasNode {
  readonly id: string;
  readonly label: string;
  readonly type: CanvasNodeType;
  layer: number;
  x: number;
  y: number;
  width: number;
  height: number;
  readonly metadata: Record<string, unknown>;
}

export interface CanvasEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly type: CanvasEdgeType;
  readonly label?: string;
}

export interface CanvasTopology {
  readonly nodes: readonly CanvasNode[];
  readonly edges: readonly CanvasEdge[];
  readonly totalLayers: number;
  readonly width: number;
  readonly height: number;
}

export interface BlastRadiusReport {
  readonly targetNodeId: string;
  readonly upstreamImpacted: readonly string[];
  readonly downstreamDependencies: readonly string[];
  readonly riskLevel: CanvasRiskLevel;
  readonly totalImpactedCount: number;
}

export interface CanvasBenchmarkResult {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly layoutDurationUs: number;
  readonly blastRadiusDurationUs: number;
  readonly svgRenderDurationUs: number;
  readonly cyclesDetected: number;
}

export interface CanvasAuditReceipt {
  readonly specId: "SPEC-358";
  readonly changeId: "CHANGE-220";
  readonly timestamp: string;
  readonly nodesHarvested: number;
  readonly edgesHarvested: number;
  readonly benchmark: CanvasBenchmarkResult;
  readonly tlcModelVerified: boolean;
  readonly verdict: "CONFORMANT";
  readonly epistemicState: "PRODUCTION_READY_WITHIN_TESTED_SCOPE";
}

export interface CanvasLayoutConfig {
  readonly horizontalSpacing: number;
  readonly verticalSpacing: number;
  readonly nodeWidth: number;
  readonly nodeHeight: number;
  readonly padding: number;
}

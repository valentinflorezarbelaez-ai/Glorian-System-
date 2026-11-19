/**
 * Glorian System — Closed-Loop Knowledge Graph & Semantic Reflex Engine Core
 * Governed by SPEC-345 / CHANGE-207
 *
 * Invariants:
 * 1. Pure Layer-0 implementation (dependencies: {}).
 * 2. Strict module line ceiling <= 800 lines with >= 12 lines headroom.
 * 3. Bounded reflex cascades (depth <= 10).
 * 4. Deterministic Tarjan SCC and Kahn DAG algorithms in O(V+E) time.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveEvidencePath } from "./eosEvidencePaths.ts";
import type {
  BlastRadiusOptions,
  BlastRadiusReport,
  CycleDetectionReport,
  EdgeType,
  EosKnowledgeGraphState,
  GraphEdge,
  GraphNode,
  ImpactedNode,
  KnowledgeGraphAuditReceipt,
  NodeType,
  PageRankOptions,
  PageRankReport,
  ReflexAction,
  ReflexHookHandler,
  ReflexTriggerEvent,
  TopologicalSortReport,
} from "./eosKnowledgeGraphReflex.types.js";

export const MAX_REFLEX_CASCADE_DEPTH = 10;

export class EosKnowledgeGraphCore {
  private readonly state: EosKnowledgeGraphState;
  private readonly reflexHooks: Map<string, ReflexHookHandler[]>;

  constructor() {
    this.state = {
      nodes: new Map(),
      outEdges: new Map(),
      inEdges: new Map(),
      edges: new Map(),
      txSequence: 0,
      stateHash: "",
    };
    this.reflexHooks = new Map();
    this.updateStateHash();
  }

  public getState(): EosKnowledgeGraphState {
    return this.state;
  }

  public addNode(node: GraphNode): void {
    const existing = this.state.nodes.get(node.id);
    const now = new Date().toISOString();
    const updated: GraphNode = {
      ...node,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.state.nodes.set(node.id, updated);
    if (!this.state.outEdges.has(node.id)) this.state.outEdges.set(node.id, []);
    if (!this.state.inEdges.has(node.id)) this.state.inEdges.set(node.id, []);
    this.state.txSequence++;
    this.updateStateHash();

    this.dispatchReflex({
      triggerEntityId: node.id,
      eventType: existing ? "NODE_UPDATED" : "NODE_ADDED",
      depth: 0,
      lineage: [node.id],
    });
  }

  public addEdge(edge: GraphEdge): void {
    if (!this.state.nodes.has(edge.source) || !this.state.nodes.has(edge.target)) {
      throw new Error(`Cannot add edge: source '${edge.source}' or target '${edge.target}' does not exist.`);
    }
    this.state.edges.set(edge.id, edge);

    const outList = this.state.outEdges.get(edge.source) ?? [];
    outList.push(edge);
    this.state.outEdges.set(edge.source, outList);

    const inList = this.state.inEdges.get(edge.target) ?? [];
    inList.push(edge);
    this.state.inEdges.set(edge.target, inList);

    this.state.txSequence++;
    this.updateStateHash();

    this.dispatchReflex({
      triggerEntityId: edge.id,
      eventType: "EDGE_ADDED",
      payload: { source: edge.source, target: edge.target, type: edge.type },
      depth: 0,
      lineage: [edge.id],
    });
  }

  public removeNode(id: string): boolean {
    if (!this.state.nodes.has(id)) return false;

    const outEdges = this.state.outEdges.get(id) ?? [];
    for (const edge of outEdges) {
      this.state.edges.delete(edge.id);
      const targetIn = this.state.inEdges.get(edge.target) ?? [];
      this.state.inEdges.set(
        edge.target,
        targetIn.filter((e) => e.id !== edge.id),
      );
    }

    const inEdges = this.state.inEdges.get(id) ?? [];
    for (const edge of inEdges) {
      this.state.edges.delete(edge.id);
      const sourceOut = this.state.outEdges.get(edge.source) ?? [];
      this.state.outEdges.set(
        edge.source,
        sourceOut.filter((e) => e.id !== edge.id),
      );
    }

    this.state.outEdges.delete(id);
    this.state.inEdges.delete(id);
    this.state.nodes.delete(id);
    this.state.txSequence++;
    this.updateStateHash();

    this.dispatchReflex({
      triggerEntityId: id,
      eventType: "NODE_DELETED",
      depth: 0,
      lineage: [id],
    });

    return true;
  }

  public removeEdge(id: string): boolean {
    const edge = this.state.edges.get(id);
    if (!edge) return false;

    this.state.edges.delete(id);
    const outList = this.state.outEdges.get(edge.source) ?? [];
    this.state.outEdges.set(
      edge.source,
      outList.filter((e) => e.id !== id),
    );

    const inList = this.state.inEdges.get(edge.target) ?? [];
    this.state.inEdges.set(
      edge.target,
      inList.filter((e) => e.id !== id),
    );

    this.state.txSequence++;
    this.updateStateHash();

    this.dispatchReflex({
      triggerEntityId: id,
      eventType: "EDGE_DELETED",
      payload: { source: edge.source, target: edge.target },
      depth: 0,
      lineage: [id],
    });

    return true;
  }

  public getNode(id: string): GraphNode | undefined {
    return this.state.nodes.get(id);
  }

  public listNodes(): GraphNode[] {
    return Array.from(this.state.nodes.values());
  }

  public listEdges(): GraphEdge[] {
    return Array.from(this.state.edges.values());
  }

  /**
   * Tarjan's Strongly Connected Components (SCC) algorithm for O(V+E) cycle detection.
   */
  public findCycles(): CycleDetectionReport {
    let index = 0;
    const indices = new Map<string, number>();
    const lowlinks = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    const sccs: string[][] = [];

    const strongConnect = (v: string): void => {
      indices.set(v, index);
      lowlinks.set(v, index);
      index++;
      stack.push(v);
      onStack.add(v);

      const edges = this.state.outEdges.get(v) ?? [];
      for (const edge of edges) {
        const w = edge.target;
        if (!indices.has(w)) {
          strongConnect(w);
          const vLow = lowlinks.get(v) ?? 0;
          const wLow = lowlinks.get(w) ?? 0;
          lowlinks.set(v, Math.min(vLow, wLow));
        } else if (onStack.has(w)) {
          const vLow = lowlinks.get(v) ?? 0;
          const wIdx = indices.get(w) ?? 0;
          lowlinks.set(v, Math.min(vLow, wIdx));
        }
      }

      if (lowlinks.get(v) === indices.get(v)) {
        const scc: string[] = [];
        let w = "";
        do {
          w = stack.pop() ?? "";
          onStack.delete(w);
          scc.push(w);
        } while (w !== v && stack.length > 0);

        if (scc.length > 1) {
          sccs.push(scc);
        } else if (scc.length === 1) {
          const selfEdges = this.state.outEdges.get(scc[0]) ?? [];
          if (selfEdges.some((e) => e.target === scc[0])) {
            sccs.push(scc);
          }
        }
      }
    };

    for (const nodeId of this.state.nodes.keys()) {
      if (!indices.has(nodeId)) {
        strongConnect(nodeId);
      }
    }

    return {
      hasCycles: sccs.length > 0,
      cycleCount: sccs.length,
      cycles: sccs,
    };
  }

  /**
   * Kahn's algorithm for deterministic topological DAG sequencing.
   */
  public topologicalSort(): TopologicalSortReport {
    const inDegree = new Map<string, number>();
    for (const nodeId of this.state.nodes.keys()) {
      const edges = this.state.inEdges.get(nodeId) ?? [];
      inDegree.set(nodeId, edges.length);
    }

    const queue: string[] = [];
    for (const [nodeId, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(nodeId);
    }

    queue.sort(); // Deterministic tie-breaking
    const ordered: string[] = [];

    while (queue.length > 0) {
      const u = queue.shift()!;
      ordered.push(u);

      const outEdges = this.state.outEdges.get(u) ?? [];
      for (const edge of outEdges) {
        const v = edge.target;
        const currentDeg = (inDegree.get(v) ?? 1) - 1;
        inDegree.set(v, currentDeg);
        if (currentDeg === 0) {
          queue.push(v);
          queue.sort();
        }
      }
    }

    const isDag = ordered.length === this.state.nodes.size;
    return {
      isDag,
      orderedNodeIds: ordered,
      unresolvedCount: this.state.nodes.size - ordered.length,
    };
  }

  /**
   * Blast radius calculation with directional traversal and depth limits.
   */
  public computeBlastRadius(rootId: string, options: BlastRadiusOptions = {}): BlastRadiusReport {
    const maxDepth = options.maxDepth ?? 5;
    const direction = options.direction ?? "DOWNSTREAM";
    const allowedTypes = options.edgeTypes ? new Set(options.edgeTypes) : null;

    if (!this.state.nodes.has(rootId)) {
      return {
        rootId,
        direction,
        maxDepth,
        impactedNodes: [],
        severityScore: 0,
      };
    }

    const visited = new Set<string>([rootId]);
    const impacted: ImpactedNode[] = [];
    const queue: Array<{ id: string; depth: number; path: string[] }> = [{ id: rootId, depth: 0, path: [rootId] }];

    while (queue.length > 0) {
      const { id, depth, path: curPath } = queue.shift()!;
      if (depth >= maxDepth) continue;

      const candidates: Array<{ targetId: string; edge: GraphEdge }> = [];

      if (direction === "DOWNSTREAM" || direction === "BIDIRECTIONAL") {
        const outList = this.state.outEdges.get(id) ?? [];
        for (const e of outList) {
          if (!allowedTypes || allowedTypes.has(e.type)) {
            candidates.push({ targetId: e.target, edge: e });
          }
        }
      }

      if (direction === "UPSTREAM" || direction === "BIDIRECTIONAL") {
        const inList = this.state.inEdges.get(id) ?? [];
        for (const e of inList) {
          if (!allowedTypes || allowedTypes.has(e.type)) {
            candidates.push({ targetId: e.source, edge: e });
          }
        }
      }

      for (const { targetId } of candidates) {
        if (!visited.has(targetId)) {
          visited.add(targetId);
          const targetNode = this.state.nodes.get(targetId);
          if (targetNode) {
            const nextPath = [...curPath, targetId];
            impacted.push({
              id: targetId,
              type: targetNode.type,
              depth: depth + 1,
              path: nextPath,
            });
            queue.push({ id: targetId, depth: depth + 1, path: nextPath });
          }
        }
      }
    }

    const severityScore = impacted.reduce((acc, curr) => acc + 1 / curr.depth, 0);

    return {
      rootId,
      direction,
      maxDepth,
      impactedNodes: impacted,
      severityScore: Math.round(severityScore * 100) / 100,
    };
  }

  /**
   * Deterministic PageRank computation via power iteration.
   */
  public computePageRank(options: PageRankOptions = {}): PageRankReport {
    const d = options.dampingFactor ?? 0.85;
    const maxIter = options.maxIterations ?? 50;
    const tol = options.tolerance ?? 1e-5;

    const nodeIds = Array.from(this.state.nodes.keys());
    const n = nodeIds.length;
    if (n === 0) {
      return { ranks: {}, iterations: 0, dampingFactor: d, convergenceDelta: 0 };
    }

    let ranks: Record<string, number> = {};
    for (const id of nodeIds) ranks[id] = 1 / n;

    let delta = 1;
    let iteration = 0;

    while (iteration < maxIter && delta > tol) {
      const nextRanks: Record<string, number> = {};
      const baseRank = (1 - d) / n;

      for (const id of nodeIds) nextRanks[id] = baseRank;

      for (const u of nodeIds) {
        const outList = this.state.outEdges.get(u) ?? [];
        if (outList.length === 0) {
          const share = (d * (ranks[u] ?? 0)) / n;
          for (const v of nodeIds) nextRanks[v] += share;
        } else {
          const share = (d * (ranks[u] ?? 0)) / outList.length;
          for (const edge of outList) {
            nextRanks[edge.target] = (nextRanks[edge.target] ?? 0) + share;
          }
        }
      }

      delta = 0;
      for (const id of nodeIds) {
        delta += Math.abs((nextRanks[id] ?? 0) - (ranks[id] ?? 0));
      }

      ranks = nextRanks;
      iteration++;
    }

    return {
      ranks,
      iterations: iteration,
      dampingFactor: d,
      convergenceDelta: Math.round(delta * 1e7) / 1e7,
    };
  }

  public registerReflexHook(eventType: string, handler: ReflexHookHandler): void {
    const list = this.reflexHooks.get(eventType) ?? [];
    list.push(handler);
    this.reflexHooks.set(eventType, list);
  }

  public dispatchReflex(event: ReflexTriggerEvent): ReflexAction[] {
    const depth = event.depth ?? 0;
    if (depth >= MAX_REFLEX_CASCADE_DEPTH) {
      return [
        {
          id: `reflex-halt-${Date.now()}`,
          triggerEntityId: event.triggerEntityId,
          eventType: event.eventType,
          actionType: "AUDIT_ALERT",
          actionPayload: {
            reason: "MAX_REFLEX_CASCADE_DEPTH_REACHED",
            depth,
            lineage: event.lineage,
          },
          depth,
        },
      ];
    }

    const actions: ReflexAction[] = [];
    const handlers = this.reflexHooks.get(event.eventType) ?? [];

    for (const handler of handlers) {
      const result = handler(event, this.state);
      if (Array.isArray(result)) {
        for (const action of result) {
          actions.push(action);
          // Chain cascading trigger if needed
          if (action.actionType === "INVALIDATE_CACHE") {
            const nextEvent: ReflexTriggerEvent = {
              triggerEntityId: action.triggerEntityId,
              eventType: "NODE_UPDATED",
              payload: action.actionPayload,
              depth: depth + 1,
              lineage: [...(event.lineage ?? []), action.id],
            };
            const chained = this.dispatchReflex(nextEvent);
            actions.push(...chained);
          }
        }
      }
    }

    return actions;
  }

  private updateStateHash(): void {
    const sortedNodes = Array.from(this.state.nodes.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, n]) => `${id}:${n.type}:${n.label}`);
    const sortedEdges = Array.from(this.state.edges.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, e]) => `${id}:${e.source}->${e.target}:${e.type}`);

    this.state.stateHash = createHash("sha256")
      .update(sortedNodes.join("|") + "##" + sortedEdges.join("|"))
      .digest("hex");
  }
}

export function createKnowledgeGraph(): EosKnowledgeGraphCore {
  return new EosKnowledgeGraphCore();
}

/**
 * Executes full deterministic verification of Knowledge Graph and Reflex Engine.
 */
export function auditKnowledgeGraphReflex(projectRoot = process.cwd()): KnowledgeGraphAuditReceipt {
  const kg = createKnowledgeGraph();

  // 1. Add Nodes
  kg.addNode({ id: "SPEC-345", type: "SPECIFICATION", label: "Knowledge Graph Spec" });
  kg.addNode({ id: "INV-GRAPH-01", type: "INVARIANT", label: "Cycle-Free Invariant" });
  kg.addNode({ id: "SRC-CORE", type: "FILE", label: "eosKnowledgeGraphReflex.ts" });
  kg.addNode({ id: "FLEET-A", type: "FLEET_REPO", label: "Aberamentho Fleet" });

  // 2. Add Acyclic Edges
  kg.addEdge({ id: "E1", source: "SPEC-345", target: "INV-GRAPH-01", type: "PRESERVES" });
  kg.addEdge({ id: "E2", source: "INV-GRAPH-01", target: "SRC-CORE", type: "GOVERNS" });
  kg.addEdge({ id: "E3", source: "SRC-CORE", target: "FLEET-A", type: "DEPENDS_ON" });

  // 3. Test DAG Topological Sort
  const topo1 = kg.topologicalSort();
  const topoValid = topo1.isDag && topo1.orderedNodeIds.length === 4;

  // 4. Test Blast Radius
  const blast = kg.computeBlastRadius("SPEC-345", { maxDepth: 3 });
  const blastValid = blast.impactedNodes.length === 3;

  // 5. Test Cycle Detection
  const kgCyclic = createKnowledgeGraph();
  kgCyclic.addNode({ id: "A", type: "CONCEPT", label: "Node A" });
  kgCyclic.addNode({ id: "B", type: "CONCEPT", label: "Node B" });
  kgCyclic.addNode({ id: "C", type: "CONCEPT", label: "Node C" });
  kgCyclic.addEdge({ id: "E-AB", source: "A", target: "B", type: "DEPENDS_ON" });
  kgCyclic.addEdge({ id: "E-BC", source: "B", target: "C", type: "DEPENDS_ON" });
  kgCyclic.addEdge({ id: "E-CA", source: "C", target: "A", type: "DEPENDS_ON" });
  const cycles = kgCyclic.findCycles();
  const cyclesDetected = cycles.hasCycles && cycles.cycleCount === 1;

  // 6. Test Reflex Boundedness
  let hookCallCount = 0;
  kg.registerReflexHook("NODE_UPDATED", (ev) => {
    hookCallCount++;
    return [
      {
        id: `act-${hookCallCount}`,
        triggerEntityId: ev.triggerEntityId,
        eventType: "NODE_UPDATED",
        actionType: "INVALIDATE_CACHE",
        actionPayload: { count: hookCallCount },
        depth: ev.depth ?? 0,
      },
    ];
  });

  const actions = kg.dispatchReflex({
    triggerEntityId: "SRC-CORE",
    eventType: "NODE_UPDATED",
    depth: 0,
    lineage: ["SRC-CORE"],
  });

  const reflexCascadeBounded = actions.some((a) => a.actionPayload.reason === "MAX_REFLEX_CASCADE_DEPTH_REACHED");

  const allPassed = topoValid && blastValid && cyclesDetected && reflexCascadeBounded;

  const receipt: KnowledgeGraphAuditReceipt = {
    spec: "SPEC-345",
    timestamp: new Date().toISOString(),
    nodeCount: kg.listNodes().length,
    edgeCount: kg.listEdges().length,
    cyclesDetected,
    topologicalSortValid: topoValid,
    blastRadiusVerified: blastValid,
    reflexCascadeBounded,
    allPassed,
    sha256: "",
  };

  const receiptPayload = JSON.stringify(receipt, null, 2);
  receipt.sha256 = createHash("sha256").update(receiptPayload).digest("hex");

  const receiptPath = resolveEvidencePath("KNOWLEDGE_GRAPH_REFLEX_RECEIPT.json", projectRoot);
  try {
    const parentDir = path.dirname(receiptPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
  } catch {
    // Hermetic receipt write fallback
  }

  return receipt;
}

/**
 * EOS Sovereign Control Plane — Layer-0 Pure TypeScript
 * Module: Episodic Memory Graph & Cross-Project Experience Synapse
 * Specification: SPEC-369 / CHANGE-231
 * Requirements: FR-369-01 through FR-369-07
 * Invariants: Zero external dependencies, pure mechanical sympathy, line ceiling <= 800
 */

import { createHash } from "node:crypto";
import type {
  CausalTraversalPath,
  EpisodeIngestInput,
  EpisodicMemoryGraphReceipt,
  EpisodicMemoryStats,
  EpisodicNode,
  EpisodicQueryResult,
  SynapseEdgeType,
  SynapticEdge,
} from "./eosEpisodicMemoryGraph.types.js";

export const FLEET_REPOSITORIES = [
  "aberamentho",
  "atp-strength",
  "biblioteca-gnostica-1",
  "control-de-asistencia-abopack",
  "crud-slack",
  "donaciones",
  "eos-system",
  "performance-talent-group",
  "portafolio",
] as const;

function sha256Hex(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function tokenize(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9_-]+/)
        .filter((t) => t.length > 2),
    ),
  );
}

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Episodic Memory Graph & Cross-Project Experience Synapse Engine.
 */
export class EosEpisodicMemoryGraph {
  private nodes: Map<string, EpisodicNode> = new Map();
  private edges: SynapticEdge[] = [];
  private nodeCounter = 0;
  private maxCapacity: number;
  private prunedCount = 0;

  public constructor(maxCapacity = 100) {
    this.maxCapacity = maxCapacity;
    this.seedDefaultFleetKnowledge();
  }

  private seedDefaultFleetKnowledge(): void {
    const seeds: EpisodeIngestInput[] = [
      {
        repoId: "eos-system",
        symptom: "TLC model checker timeout under parallel multicore load",
        rootCause: "Subprocess spawn concurrency exceeded default 60s timeout budget",
        solutionPatch: "Elevate timeoutMs to 180s and isolate isolated metadir per spec run",
        pinned: true,
      },
      {
        repoId: "crud-slack",
        symptom: "Dual blind judge consensus deadlock on ambiguous requirements",
        rootCause: "Unbounded review loops without deterministic stopping condition",
        solutionPatch: "Cap adversarial iterations to 2 and escalate to architect on mismatch",
        pinned: true,
      },
      {
        repoId: "portafolio",
        symptom: "Cross-session memory drift and vector index fragmentation",
        rootCause: "Missing periodic tombstone compaction in persistent KV store",
        solutionPatch: "Execute background K-way merge compaction on LSM segments",
        pinned: true,
      },
    ];

    for (const seed of seeds) {
      this.ingestEpisode(seed);
    }
  }

  public ingestEpisode(input: EpisodeIngestInput): EpisodicNode {
    this.nodeCounter++;
    const id = `EP-${Date.now().toString(36).toUpperCase()}-${this.nodeCounter.toString().padStart(4, "0")}`;
    const tokens = tokenize(`${input.symptom} ${input.rootCause} ${input.solutionPatch}`);
    const receipt = input.verificationReceipt ?? sha256Hex(JSON.stringify(input));

    const node: EpisodicNode = {
      id,
      repoId: input.repoId,
      symptom: input.symptom,
      rootCause: input.rootCause,
      solutionPatch: input.solutionPatch,
      verificationReceipt: receipt,
      tokens,
      weight: 1.0,
      accessCount: 0,
      lastAccessedAt: Date.now(),
      createdAt: Date.now(),
      pinned: input.pinned ?? false,
    };

    // Construct synaptic edges to existing nodes based on similarity
    for (const existing of this.nodes.values()) {
      const sim = jaccardSimilarity(node.tokens, existing.tokens);
      if (sim > 0.15) {
        let edgeType: SynapseEdgeType = "SIMILAR_SYMPTOM";
        if (node.rootCause.toLowerCase().includes(existing.rootCause.toLowerCase())) {
          edgeType = "CAUSAL_DEPENDENCY";
        } else if (node.solutionPatch.toLowerCase().includes(existing.solutionPatch.toLowerCase())) {
          edgeType = "SHARED_SOLUTION";
        }

        this.edges.push({
          sourceId: existing.id,
          targetId: node.id,
          edgeType,
          weight: Math.round(sim * 100) / 100,
          confidence: Math.min(1.0, sim * 1.5),
        });
      }
    }

    this.nodes.set(id, node);

    // Enforce capacity bound
    if (this.nodes.size > this.maxCapacity) {
      this.pruneColdNodes();
    }

    return node;
  }

  public queryAssociative(queryText: string, requestingRepo?: string, limit = 5): EpisodicQueryResult[] {
    const qTokens = tokenize(queryText);
    const scored: { node: EpisodicNode; score: number }[] = [];

    for (const node of this.nodes.values()) {
      const sim = jaccardSimilarity(qTokens, node.tokens);
      // Weight boosted by historical access and node weight
      const compositeScore = sim * (0.7 + Math.min(node.weight, 3.0) * 0.1);
      if (compositeScore > 0.05 || sim > 0) {
        scored.push({ node, score: compositeScore });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, limit);

    return top.map(({ node, score }) => {
      // Reinforce accessed node
      node.weight = Math.min(10.0, node.weight + 0.25);
      node.accessCount++;
      node.lastAccessedAt = Date.now();

      // Find causal chain from incoming edges
      const causalChain: string[] = [];
      for (const e of this.edges) {
        if (e.targetId === node.id && e.edgeType === "CAUSAL_DEPENDENCY") {
          causalChain.push(e.sourceId);
        }
      }

      const crossRepoTransfer = Boolean(requestingRepo && node.repoId !== requestingRepo);

      return {
        node,
        similarityScore: Math.round(score * 100) / 100,
        crossRepoTransfer,
        synapticHops: causalChain.length,
        causalChain,
      };
    });
  }

  public getCausalPath(originId: string, maxDepth = 5): CausalTraversalPath {
    const path: string[] = [originId];
    const visited = new Set<string>([originId]);
    let currentId = originId;
    let confidence = 1.0;

    for (let depth = 0; depth < maxDepth; depth++) {
      const nextEdge = this.edges.find((e) => e.sourceId === currentId && !visited.has(e.targetId));
      if (!nextEdge) break;

      visited.add(nextEdge.targetId);
      path.push(nextEdge.targetId);
      confidence *= nextEdge.confidence;
      currentId = nextEdge.targetId;
    }

    return {
      originId,
      path,
      cumulativeConfidence: Math.round(confidence * 100) / 100,
    };
  }

  public applyTemporalDecay(decayRate = 0.1): void {
    for (const node of this.nodes.values()) {
      if (!node.pinned) {
        node.weight = Math.max(0.1, Math.round((node.weight - decayRate) * 100) / 100);
      }
    }
  }

  public pruneColdNodes(): void {
    if (this.nodes.size <= this.maxCapacity) return;

    // Find non-pinned candidate with lowest weight
    let candidate: EpisodicNode | null = null;
    for (const node of this.nodes.values()) {
      if (node.pinned) continue;
      if (!candidate || node.weight < candidate.weight) {
        candidate = node;
      }
    }

    if (candidate) {
      const toRemoveId = candidate.id;
      this.nodes.delete(toRemoveId);
      this.edges = this.edges.filter((e) => e.sourceId !== toRemoveId && e.targetId !== toRemoveId);
      this.prunedCount++;
    }
  }

  public getStats(): EpisodicMemoryStats {
    const repoDistribution: Record<string, number> = {};
    let totalWeight = 0;

    for (const node of this.nodes.values()) {
      repoDistribution[node.repoId] = (repoDistribution[node.repoId] ?? 0) + 1;
      totalWeight += node.weight;
    }

    const totalNodes = this.nodes.size;
    const averageWeight = totalNodes === 0 ? 0 : Math.round((totalWeight / totalNodes) * 100) / 100;

    return {
      totalNodes,
      totalEdges: this.edges.length,
      repoDistribution,
      averageWeight,
      prunedNodesCount: this.prunedCount,
    };
  }

  public getNodes(): EpisodicNode[] {
    return Array.from(this.nodes.values());
  }

  public getEdges(): SynapticEdge[] {
    return [...this.edges];
  }

  public audit(requestingRepo = "eos-system-control-plane"): EpisodicMemoryGraphReceipt {
    const stats = this.getStats();
    const receiptId = `RCP-MEMSYNAPSE-${Date.now().toString(36).toUpperCase()}`;
    const topEpisodes = Array.from(this.nodes.values()).slice(0, 5);

    const raw = JSON.stringify({ receiptId, requestingRepo, stats, topEpisodes });
    return {
      receiptId,
      sha256: sha256Hex(raw),
      stats,
      topEpisodes,
      generatedAt: new Date().toISOString(),
    };
  }

  public static audit(requestingRepo?: string): EpisodicMemoryGraphReceipt {
    return new EosEpisodicMemoryGraph().audit(requestingRepo);
  }
}

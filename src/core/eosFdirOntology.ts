/**
 * GLORIAN SYSTEM — FDIR CLINICAL FIREWALL FOR KNOWLEDGE ONTOLOGY
 *
 * Core control plane governor for semantic graph integrity inspection,
 * orphan link detection and quarantine isolation ("La Sanación del Grafo"),
 * Tarjan's SCC cycle detection, surgical edge purging, and 24/7 heartbeat integration.
 *
 * Governed by SPEC-305 (FR-305-01..FR-305-06, BDD-1605..BDD-1610).
 * Strict Law V: Zero third-party runtime dependencies.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pureSha256, deepFreeze, assertPrecondition } from "./eosKernelPrimitives.ts";
import { EosOntologyCyclotron, type OntologyEdge } from "./eosOntologyCyclotron.ts";
import type {
  OrphanLinkAnomaly,
  TarjanCycleReport,
  GraphIntegrityReport,
  SurgicalPurgeResult,
  FdirOntologyAuditReceipt,
} from "./eosFdirOntology.types.ts";

export * from "./eosFdirOntology.types.ts";

export class EosFdirOntology {
  /**
   * Scans an ontology cyclotron graph for orphan links, missing endpoints, and cyclic deadlocks.
   */
  public static scanGraphIntegrity(
    cyclotron: EosOntologyCyclotron,
    asOfTime: number = Date.now(),
  ): GraphIntegrityReport {
    assertPrecondition(Boolean(cyclotron), "Ontology cyclotron instance is required");

    const nodeIds = new Set(cyclotron.getAllNodeIds(asOfTime));
    const edges = cyclotron.getAllEdges(asOfTime);

    const orphanAnomalies: OrphanLinkAnomaly[] = [];

    for (const edge of edges) {
      const fromExists = nodeIds.has(edge.from);
      const toExists = nodeIds.has(edge.to);

      if (!fromExists || !toExists) {
        let reason: OrphanLinkAnomaly["reason"];
        if (!fromExists && !toExists) {
          reason = "ORPHAN_BOTH_NODES";
        } else if (!fromExists) {
          reason = "ORPHAN_SOURCE_NODE";
        } else {
          reason = "ORPHAN_TARGET_NODE";
        }

        orphanAnomalies.push({
          edgeId: edge.id,
          fromId: edge.from,
          toId: edge.to,
          predicate: edge.predicate,
          reason,
          detectedAtIso: new Date().toISOString(),
        });
      }
    }

    const cycles = this.detectTarjanCycles(cyclotron, asOfTime);
    const hasAnomalies = orphanAnomalies.length > 0 || cycles.length > 0;

    return deepFreeze({
      status: hasAnomalies ? "REMEDIATION_REQUIRED" : "OPTIMAL_HARMONY",
      totalNodes: nodeIds.size,
      totalEdges: edges.length,
      orphanLinksCount: orphanAnomalies.length,
      orphanAnomalies,
      cyclesCount: cycles.length,
      cycles,
      scannedAtIso: new Date().toISOString(),
    });
  }

  /**
   * Detects circular dependency deadlocks using Tarjan's Strongly Connected Components (SCC) algorithm.
   */
  public static detectTarjanCycles(
    cyclotron: EosOntologyCyclotron,
    asOfTime: number = Date.now(),
  ): readonly TarjanCycleReport[] {
    assertPrecondition(Boolean(cyclotron), "Ontology cyclotron instance is required");

    const nodeIds = cyclotron.getAllNodeIds(asOfTime);
    const edges = cyclotron.getAllEdges(asOfTime);

    // Build adjacency list for active nodes
    const adj = new Map<string, Array<{ to: string; edgeId: string }>>();
    for (const id of nodeIds) {
      adj.set(id, []);
    }
    for (const edge of edges) {
      if (adj.has(edge.from) && adj.has(edge.to)) {
        adj.get(edge.from)!.push({ to: edge.to, edgeId: edge.id });
      }
    }

    let index = 0;
    const stack: string[] = [];
    const inStack = new Set<string>();
    const indices = new Map<string, number>();
    const lowlink = new Map<string, number>();
    const sccs: string[][] = [];

    function strongConnect(v: string) {
      indices.set(v, index);
      lowlink.set(v, index);
      index++;
      stack.push(v);
      inStack.add(v);

      const neighbors = adj.get(v) || [];
      for (const edge of neighbors) {
        const w = edge.to;
        if (!indices.has(w)) {
          strongConnect(w);
          lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
        } else if (inStack.has(w)) {
          lowlink.set(v, Math.min(lowlink.get(v)!, indices.get(w)!));
        }
      }

      if (lowlink.get(v) === indices.get(v)) {
        const component: string[] = [];
        let w = "";
        do {
          w = stack.pop()!;
          inStack.delete(w);
          component.push(w);
        } while (w !== v);

        if (component.length > 1) {
          sccs.push(component);
        }
      }
    }

    for (const node of nodeIds) {
      if (!indices.has(node)) {
        strongConnect(node);
      }
    }

    return deepFreeze(
      sccs.map((nodes, idx) => ({
        cycleId: `cycle-scc-${idx + 1}`,
        nodes,
        length: nodes.length,
      })),
    );
  }

  /**
   * Surgically purges orphan edges and breaks cycle deadlocks, restoring relational harmony.
   */
  public static healGraphAnomalies(
    cyclotron: EosOntologyCyclotron,
    asOfTime: number = Date.now(),
  ): SurgicalPurgeResult {
    assertPrecondition(Boolean(cyclotron), "Ontology cyclotron instance is required");

    const report = this.scanGraphIntegrity(cyclotron, asOfTime);
    const purgedEdgeIds: string[] = [];

    // 1. Purge orphan edges
    for (const orphan of report.orphanAnomalies) {
      const removed = cyclotron.removeEdge(orphan.edgeId);
      if (removed) {
        purgedEdgeIds.push(orphan.edgeId);
      }
    }

    // 2. Break cycles by severing an internal loop edge
    let cyclesBroken = 0;
    const cycles = this.detectTarjanCycles(cyclotron, asOfTime);
    for (const cycle of cycles) {
      if (cycle.nodes.length >= 2) {
        const cycleNodesSet = new Set(cycle.nodes);
        let severed = false;
        for (const nodeId of cycle.nodes) {
          const outgoing = cyclotron.getOutgoing(nodeId, undefined, asOfTime);
          for (const edge of outgoing) {
            if (cycleNodesSet.has(edge.to)) {
              cyclotron.removeEdge(edge.id);
              purgedEdgeIds.push(edge.id);
              cyclesBroken++;
              severed = true;
              break;
            }
          }
          if (severed) break;
        }
      }
    }

    const postScan = this.scanGraphIntegrity(cyclotron, asOfTime);

    return deepFreeze({
      healed: postScan.status === "OPTIMAL_HARMONY",
      purgedEdgesCount: purgedEdgeIds.length,
      cyclesBrokenCount: cyclesBroken,
      remainingAnomaliesCount: postScan.orphanLinksCount + postScan.cyclesCount,
      purgedEdgeIds,
      timestampIso: new Date().toISOString(),
    });
  }

  /**
   * Audits end-to-end FDIR knowledge ontology pipeline and emits cryptographic proof receipt.
   */
  public static auditFdirOntologyPipeline(options: { projectRoot?: string } = {}): FdirOntologyAuditReceipt {
    const projectRoot = options.projectRoot || process.cwd();
    const cyclotron = new EosOntologyCyclotron();

    const now = Date.now();

    // Register 4 valid entities
    cyclotron.registerNode("fleet:control-plane", "CORE_SERVICE", { name: "Glorian Control Plane" }, now);
    cyclotron.registerNode("fleet:auth-enclave", "SECURITY_SERVICE", { name: "Hardware TEE" }, now);
    cyclotron.registerNode("fleet:agent-mesh", "AGENT_RUNTIME", { name: "Automerge CRDT Mesh" }, now);
    cyclotron.registerNode("fleet:sqlite-wal", "STORAGE_SERVICE", { name: "SQLite FTS5 Storage" }, now);

    // Register valid relationships
    cyclotron.registerEdge("fleet:control-plane", "fleet:auth-enclave", "SECURED_BY", 1.0, now);
    cyclotron.registerEdge("fleet:control-plane", "fleet:agent-mesh", "SYNCHRONIZES_WITH", 1.0, now);
    cyclotron.registerEdge("fleet:control-plane", "fleet:sqlite-wal", "PERSISTS_TO", 1.0, now);

    // Baseline scan: must be optimal
    const initialScan = this.scanGraphIntegrity(cyclotron, now);
    assertPrecondition(initialScan.status === "OPTIMAL_HARMONY", "Initial graph must be healthy");

    // Inoculate anomaly 1: Orphan Edge pointing to missing node
    cyclotron.registerEdge("fleet:control-plane", "ghost:non-existent-service", "DEPENDS_ON", 1.0, now);

    // Inoculate anomaly 2: Cyclic deadlock loop (auth-enclave -> agent-mesh -> auth-enclave)
    cyclotron.registerEdge("fleet:auth-enclave", "fleet:agent-mesh", "DELEGATES_TO", 1.0, now);
    cyclotron.registerEdge("fleet:agent-mesh", "fleet:auth-enclave", "VERIFIES_WITH", 1.0, now);

    // Post-anomaly scan: must be REMEDIATION_REQUIRED
    const infectedScan = this.scanGraphIntegrity(cyclotron, now);
    assertPrecondition(infectedScan.status === "REMEDIATION_REQUIRED", "Infected graph must require remediation");
    assertPrecondition(infectedScan.orphanLinksCount === 1, "Must detect exactly 1 orphan link");
    assertPrecondition(infectedScan.cyclesCount >= 1, "Must detect at least 1 cyclic component");

    // Surgical healing
    const healingResult = this.healGraphAnomalies(cyclotron, now);
    assertPrecondition(healingResult.healed === true, "Graph healing must succeed");
    assertPrecondition(healingResult.remainingAnomaliesCount === 0, "Zero remaining anomalies expected");

    const finalScan = this.scanGraphIntegrity(cyclotron, now);
    assertPrecondition(finalScan.status === "OPTIMAL_HARMONY", "Final healed graph must achieve optimal harmony");

    const timestampIso = new Date().toISOString();
    const signature = pureSha256(
      `FDIR-ONTOLOGY-SPEC-305|${timestampIso}|${finalScan.totalNodes}|${finalScan.totalEdges}|${healingResult.purgedEdgesCount}|true`,
    );

    const receipt: FdirOntologyAuditReceipt = deepFreeze({
      receiptType: "EOS_FDIR_ONTOLOGY_AUDIT",
      timestampIso,
      specRef: "SPEC-305",
      totalNodesEvaluated: finalScan.totalNodes,
      totalEdgesEvaluated: finalScan.totalEdges,
      orphanLinksPurged: healingResult.purgedEdgesCount,
      cyclesResolved: healingResult.cyclesBrokenCount,
      harmonyRestored: true,
      sha256Signature: signature,
    });

    const outPath = join(projectRoot, "docs", "evidence", "FDIR_ONTOLOGY_RECEIPT.json");
    try {
      mkdirSync(join(projectRoot, "docs", "evidence"), { recursive: true });
      writeFileSync(outPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");
    } catch {
      // Best-effort in sandboxes
    }

    return receipt;
  }
}

/**
 * EOS System — Distributed Deadlock Detection & Wait-For Graph (WFG) Cycle Governor
 * SPEC-285 (CHANGE-147) — Transaction Concurrency, Cycle Detection & Wound-Wait Resolution
 * Pure Layer-0 TypeScript (dependencies: {})
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

export interface TransactionNode {
  txId: string;
  timestamp: number;
  holds: string[];
  waitingFor: string[];
}

export interface WaitForEdge {
  from: string;
  to: string;
  resource: string;
}

export interface WaitForGraph {
  graphId: string;
  vertices: string[];
  edges: WaitForEdge[];
  transactions: Record<string, TransactionNode>;
}

export interface DeadlockReport {
  graphId: string;
  hasDeadlock: boolean;
  cycles: string[][];
  victims: string[];
  recommendedRollbacks: string[];
}

export interface WoundWaitDecision {
  requestingTx: string;
  holdingTx: string;
  decision: "WOUND" | "WAIT" | "DIE";
  reason: string;
}

export interface DeadlockReceipt {
  graphId: string;
  hasDeadlock: boolean;
  cyclesCount: number;
  victimsCount: number;
  timestamp: string;
  sha256Signature: string;
}

export class EosDeadlockDetectionGovernor {
  /**
   * Constructs a directed Wait-For Graph (WFG) from transaction hold/wait states.
   */
  public static buildWfg(transactions: TransactionNode[], graphId = `wfg-${Date.now()}`): WaitForGraph {
    const vertices: string[] = [];
    const edges: WaitForEdge[] = [];
    const txMap: Record<string, TransactionNode> = {};
    const resourceHolders: Record<string, string> = {};

    for (const tx of transactions) {
      vertices.push(tx.txId);
      txMap[tx.txId] = tx;
      for (const res of tx.holds) {
        resourceHolders[res] = tx.txId;
      }
    }

    for (const tx of transactions) {
      for (const requestedRes of tx.waitingFor) {
        const holderId = resourceHolders[requestedRes];
        if (holderId && holderId !== tx.txId) {
          edges.push({
            from: tx.txId,
            to: holderId,
            resource: requestedRes,
          });
        }
      }
    }

    return {
      graphId,
      vertices,
      edges,
      transactions: txMap,
    };
  }

  /**
   * Identifies all elementary directed cycles in the Wait-For Graph using 3-color DFS.
   */
  public static detectDeadlocks(graph: WaitForGraph): DeadlockReport {
    const adj: Record<string, string[]> = {};
    for (const v of graph.vertices) {
      adj[v] = [];
    }
    for (const edge of graph.edges) {
      if (adj[edge.from]) {
        adj[edge.from].push(edge.to);
      }
    }

    const cycles: string[][] = [];
    const visited: Record<string, "WHITE" | "GRAY" | "BLACK"> = {};
    for (const v of graph.vertices) {
      visited[v] = "WHITE";
    }

    const currentPath: string[] = [];

    const dfs = (u: string) => {
      visited[u] = "GRAY";
      currentPath.push(u);

      for (const v of adj[u] || []) {
        if (visited[v] === "GRAY") {
          // Detected back-edge: cycle from v to u
          const cycleStartIndex = currentPath.indexOf(v);
          if (cycleStartIndex !== -1) {
            const cycle = currentPath.slice(cycleStartIndex);
            cycles.push([...cycle, v]);
          }
        } else if (visited[v] === "WHITE") {
          dfs(v);
        }
      }

      currentPath.pop();
      visited[u] = "BLACK";
    };

    for (const v of graph.vertices) {
      if (visited[v] === "WHITE") {
        dfs(v);
      }
    }

    const victims: string[] = [];
    for (const cycle of cycles) {
      // Pick the youngest transaction (largest timestamp) in the cycle as victim
      let youngestTx = cycle[0];
      let maxTimestamp = graph.transactions[youngestTx]?.timestamp || 0;

      for (const txId of cycle) {
        const ts = graph.transactions[txId]?.timestamp || 0;
        if (ts > maxTimestamp) {
          maxTimestamp = ts;
          youngestTx = txId;
        }
      }

      if (!victims.includes(youngestTx)) {
        victims.push(youngestTx);
      }
    }

    return {
      graphId: graph.graphId,
      hasDeadlock: cycles.length > 0,
      cycles,
      victims,
      recommendedRollbacks: victims,
    };
  }

  /**
   * Evaluates Wound-Wait deadlock prevention (preemptive):
   * If requesting is older (ts < holding.ts), older wounds younger -> WOUND.
   * If requesting is younger (ts > holding.ts), younger waits -> WAIT.
   */
  public static evaluateWoundWait(requesting: TransactionNode, holding: TransactionNode): WoundWaitDecision {
    if (requesting.timestamp < holding.timestamp) {
      return {
        requestingTx: requesting.txId,
        holdingTx: holding.txId,
        decision: "WOUND",
        reason: `Older transaction ${requesting.txId} (ts=${requesting.timestamp}) wounds younger transaction ${holding.txId} (ts=${holding.timestamp}).`,
      };
    }
    return {
      requestingTx: requesting.txId,
      holdingTx: holding.txId,
      decision: "WAIT",
      reason: `Younger transaction ${requesting.txId} (ts=${requesting.timestamp}) waits for older transaction ${holding.txId} (ts=${holding.timestamp}).`,
    };
  }

  /**
   * Evaluates Wait-Die deadlock prevention (non-preemptive):
   * If requesting is older (ts < holding.ts), older waits -> WAIT.
   * If requesting is younger (ts > holding.ts), younger dies -> DIE.
   */
  public static evaluateWaitDie(requesting: TransactionNode, holding: TransactionNode): WoundWaitDecision {
    if (requesting.timestamp < holding.timestamp) {
      return {
        requestingTx: requesting.txId,
        holdingTx: holding.txId,
        decision: "WAIT",
        reason: `Older transaction ${requesting.txId} (ts=${requesting.timestamp}) waits for younger transaction ${holding.txId} (ts=${holding.timestamp}).`,
      };
    }
    return {
      requestingTx: requesting.txId,
      holdingTx: holding.txId,
      decision: "DIE",
      reason: `Younger transaction ${requesting.txId} (ts=${requesting.timestamp}) dies upon requesting lock held by older transaction ${holding.txId} (ts=${holding.timestamp}).`,
    };
  }

  /**
   * Resolves detected deadlocks by aborting identified victim transactions.
   */
  public static resolveDeadlocks(graph: WaitForGraph): {
    resolvedGraph: WaitForGraph;
    abortedTxIds: string[];
  } {
    const report = this.detectDeadlocks(graph);
    if (!report.hasDeadlock) {
      return { resolvedGraph: graph, abortedTxIds: [] };
    }

    const abortedSet = new Set(report.victims);
    const newVertices = graph.vertices.filter((v) => !abortedSet.has(v));
    const newEdges = graph.edges.filter((e) => !abortedSet.has(e.from) && !abortedSet.has(e.to));
    const newTxMap: Record<string, TransactionNode> = {};
    for (const v of newVertices) {
      newTxMap[v] = graph.transactions[v];
    }

    const resolvedGraph: WaitForGraph = {
      graphId: `${graph.graphId}-resolved`,
      vertices: newVertices,
      edges: newEdges,
      transactions: newTxMap,
    };

    return {
      resolvedGraph,
      abortedTxIds: report.victims,
    };
  }

  /**
   * Generates a verifiable SHA-256 cryptographic receipt of deadlock analysis.
   */
  public static generateReceipt(report: DeadlockReport, outputPath?: string): DeadlockReceipt {
    const receiptData = {
      graphId: report.graphId,
      hasDeadlock: report.hasDeadlock,
      cyclesCount: report.cycles.length,
      victimsCount: report.victims.length,
      timestamp: new Date().toISOString(),
    };

    const signature = crypto.createHash("sha256").update(JSON.stringify(receiptData)).digest("hex");

    const receipt: DeadlockReceipt = {
      ...receiptData,
      sha256Signature: signature,
    };

    if (outputPath) {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(outputPath, JSON.stringify(receipt, null, 2), "utf8");
    }

    return receipt;
  }
}

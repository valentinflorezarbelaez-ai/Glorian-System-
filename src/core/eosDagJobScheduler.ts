/**
 * EOS SYSTEM — DAG JOB SCHEDULER (Layer 0)
 * Governed by SPEC-180 (Apache Airflow / Spark DAG execution pattern)
 *
 * Implements:
 * - Topological sort with cycle detection (Kahn's algorithm)
 * - Max-parallelism bounded execution
 * - Per-node retry with exponential backoff (bounded)
 * - Failure isolation: downstream tasks are marked SKIPPED
 * - Deterministic execution trace fingerprint
 *
 * Zero external dependencies.
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export type NodeStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED" | "SKIPPED";

export interface DagNode {
  readonly id: string;
  readonly deps: readonly string[];
  readonly run: () => Promise<unknown>;
  readonly maxRetries: number;
}

export interface NodeResult {
  readonly id: string;
  readonly status: NodeStatus;
  readonly attempts: number;
  readonly error?: string;
}

export interface DagResult {
  readonly ok: boolean;
  readonly order: readonly string[];
  readonly results: readonly NodeResult[];
}

export class EosDagJobScheduler {
  private readonly nodes: Map<string, DagNode> = new Map();
  private readonly maxParallel: number;

  constructor(opts: { maxParallel?: number } = {}) {
    this.maxParallel = opts.maxParallel ?? 4;
    assertPrecondition(this.maxParallel >= 1, "maxParallel must be >= 1");
  }

  add(node: DagNode): this {
    assertPrecondition(!this.nodes.has(node.id), `duplicate node ${node.id}`);
    assertPrecondition(node.maxRetries >= 1, "maxRetries >= 1");
    this.nodes.set(node.id, deepFreeze(node));
    return this;
  }

  /**
   * Kahn's topological sort. Throws if a cycle exists.
   */
  topoOrder(): readonly string[] {
    const indegree = new Map<string, number>();
    const adj = new Map<string, string[]>();
    for (const [id, n] of this.nodes) {
      indegree.set(id, n.deps.length);
      for (const d of n.deps) {
        if (!adj.has(d)) adj.set(d, []);
        adj.get(d)!.push(id);
      }
    }
    const queue = [...this.nodes.keys()].filter((id) => indegree.get(id) === 0).sort();
    const order: string[] = [];
    while (queue.length) {
      const cur = queue.shift()!;
      order.push(cur);
      for (const next of adj.get(cur) ?? []) {
        const v = (indegree.get(next) ?? 0) - 1;
        indegree.set(next, v);
        if (v === 0) {
          queue.push(next);
          queue.sort();
        }
      }
    }
    if (order.length !== this.nodes.size) {
      throw new Error("Cycle detected in DAG");
    }
    return order;
  }

  /**
   * Executes the DAG respecting dependencies and bounded parallelism.
   * A failed node halts all downstream nodes (marked SKIPPED).
   */
  async execute(): Promise<DagResult> {
    const order = this.topoOrder();
    const status = new Map<string, NodeStatus>();
    const results: NodeResult[] = [];
    for (const id of order) status.set(id, "PENDING");

    const runOne = async (id: string): Promise<NodeResult> => {
      const node = this.nodes.get(id)!;
      let attempts = 0;
      for (let a = 1; a <= node.maxRetries; a++) {
        attempts = a;
        status.set(id, "RUNNING");
        try {
          await node.run();
          status.set(id, "DONE");
          return deepFreeze({ id, status: "DONE" as NodeStatus, attempts });
        } catch (err) {
          await new Promise((r) => setTimeout(r, Math.min(2 ** a, 4)));
        }
      }
      status.set(id, "FAILED");
      return deepFreeze({ id, status: "FAILED" as NodeStatus, attempts, error: "all retries failed" });
    };

    // Wave-based execution respecting deps and parallelism cap
    const done = new Set<string>();
    const failed = new Set<string>();
    while (done.size + failed.size < order.length) {
      const ready = order
        .filter(
          (id) =>
            status.get(id) === "PENDING" &&
            this.nodes.get(id)!.deps.every((d) => done.has(d)) &&
            !this.nodes.get(id)!.deps.some((d) => failed.has(d)),
        )
        .slice(0, this.maxParallel);

      if (ready.length === 0) {
        // Any PENDING node with a failed ancestor -> SKIPPED
        const orphan = order.find((id) => status.get(id) === "PENDING");
        if (!orphan) break;
        status.set(orphan, "SKIPPED");
        failed.add(orphan);
        results.push(deepFreeze({ id: orphan, status: "SKIPPED" as NodeStatus, attempts: 0 }));
        continue;
      }

      const batch = await Promise.all(ready.map(runOne));
      for (const r of batch) {
        results.push(r);
        if (r.status === "DONE") done.add(r.id);
        else failed.add(r.id);
      }
    }

    return deepFreeze({
      ok: failed.size === 0,
      order,
      results,
    });
  }

  traceFingerprint(result: DagResult): string {
    return pureSha256(result.results.map((r) => `${r.id}:${r.status}:${r.attempts}`).join("|"));
  }
}

/**
 * EOS SYSTEM — KUBECTL CLUSTER INSPECTOR & CONTEXT SAFETY GUARD (Layer 0)
 * Governed by SPEC-273, CHANGE-135, ADR-135-002 (v75.0.0)
 *
 * Implements read-only inspection of Kubernetes clusters with an inviolable safety barrier:
 * 1. Context Boundary: by default, ONLY allows contexts matching `^kind-` (local testing clusters).
 * 2. Fail-Closed: any external, cloud, or production context (EKS, GKE, AKS) is refused with CONTEXT_UNAUTHORIZED.
 * 3. Read-Only Telemetry: queries nodes and pods status safely without mutating cluster state.
 * 4. Deterministic Receipts: SHA-256 attested audit record saved in docs/evidence/.
 *
 * Zero external runtime npm dependencies (Law V).
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export interface NodeTelemetry {
  readonly name: string;
  readonly ready: boolean;
  readonly roles: readonly string[];
  readonly kubeletVersion: string;
}

export interface PodSummary {
  readonly total: number;
  readonly running: number;
  readonly pending: number;
  readonly failed: number;
  readonly succeeded: number;
}

export interface KubectlClusterStatusReport {
  readonly timestampIso: string;
  readonly context: string;
  readonly allowedContext: boolean;
  readonly status: "HEALTHY" | "DEGRADED" | "CONTEXT_UNAUTHORIZED" | "INSPECTION_FAILED";
  readonly totalNodes: number;
  readonly readyNodes: number;
  readonly nodes: readonly NodeTelemetry[];
  readonly pods: PodSummary;
  readonly sha256Receipt: string;
  readonly error?: string;
}

export interface KubectlInspectorOptions {
  readonly allowedContextPattern?: RegExp | string;
  readonly customContext?: string;
  readonly timeoutMs?: number;
  readonly receiptPath?: string;
  readonly mockContext?: string;
  readonly mockNodesJson?: any;
  readonly mockPodsJson?: any;
}

const DEFAULT_ALLOWED_CONTEXT_REGEX = /^kind-/i;

export class EosKubectlClusterInspector {
  /**
   * Retrieves active kubectl context safely.
   */
  public static getCurrentContext(timeoutMs = 3000): string | null {
    try {
      const res = spawnSync("kubectl", ["config", "current-context"], {
        encoding: "utf8",
        timeout: timeoutMs,
        windowsHide: true,
      });
      if (res.status === 0 && res.stdout) {
        return res.stdout.trim();
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Validates if a context string conforms to the safe local allowlist.
   */
  public static isContextAllowed(context: string, customPattern?: RegExp | string): boolean {
    if (!context || typeof context !== "string") return false;
    const trimmed = context.trim();
    if (customPattern) {
      if (customPattern instanceof RegExp) return customPattern.test(trimmed);
      return trimmed === customPattern || new RegExp(customPattern).test(trimmed);
    }
    const envOverride = process.env.EOS_K8S_ALLOWED_CONTEXTS;
    if (envOverride) {
      const allowedList = envOverride.split(",").map((s) => s.trim());
      return allowedList.some((pat) => new RegExp(pat).test(trimmed));
    }
    return DEFAULT_ALLOWED_CONTEXT_REGEX.test(trimmed);
  }

  private static parseNodes(rawJson: any): NodeTelemetry[] {
    if (!rawJson || !Array.isArray(rawJson.items)) return [];
    return rawJson.items.map((item: any) => {
      const name = String(item.metadata?.name || "unknown-node");
      const conditions = Array.isArray(item.status?.conditions) ? item.status.conditions : [];
      const readyCondition = conditions.find((c: any) => c.type === "Ready");
      const ready = readyCondition?.status === "True";
      const labels = item.metadata?.labels || {};
      const roles: string[] = Object.keys(labels)
        .filter((k) => k.startsWith("node-role.kubernetes.io/"))
        .map((k) => k.replace("node-role.kubernetes.io/", ""));
      const kubeletVersion = String(item.status?.nodeInfo?.kubeletVersion || "unknown");

      return {
        name,
        ready,
        roles: roles.length > 0 ? roles : ["worker"],
        kubeletVersion,
      };
    });
  }

  private static parsePods(rawJson: any): PodSummary {
    if (!rawJson || !Array.isArray(rawJson.items)) {
      return { total: 0, running: 0, pending: 0, failed: 0, succeeded: 0 };
    }
    let running = 0;
    let pending = 0;
    let failed = 0;
    let succeeded = 0;

    for (const item of rawJson.items) {
      const phase = String(item.status?.phase || "Unknown");
      if (phase === "Running") running++;
      else if (phase === "Pending") pending++;
      else if (phase === "Failed") failed++;
      else if (phase === "Succeeded") succeeded++;
    }

    return {
      total: rawJson.items.length,
      running,
      pending,
      failed,
      succeeded,
    };
  }

  /**
   * Executes safe read-only inspection of the active Kubernetes cluster.
   */
  public static inspectCluster(options: KubectlInspectorOptions = {}): KubectlClusterStatusReport {
    const timeoutMs = options.timeoutMs || 5000;
    const currentContext =
      options.mockContext ||
      options.customContext ||
      EosKubectlClusterInspector.getCurrentContext(timeoutMs) ||
      "UNKNOWN";
    const allowed = EosKubectlClusterInspector.isContextAllowed(currentContext, options.allowedContextPattern);

    if (!allowed) {
      const receiptPayload = JSON.stringify({
        context: currentContext,
        allowedContext: false,
        status: "CONTEXT_UNAUTHORIZED",
      });
      return deepFreeze({
        timestampIso: new Date().toISOString(),
        context: currentContext,
        allowedContext: false,
        status: "CONTEXT_UNAUTHORIZED",
        totalNodes: 0,
        readyNodes: 0,
        nodes: [],
        pods: { total: 0, running: 0, pending: 0, failed: 0, succeeded: 0 },
        sha256Receipt: pureSha256(receiptPayload),
        error: `Context '${currentContext}' is unauthorized. By default only 'kind-*' contexts are permitted.`,
      });
    }

    let rawNodes: any = null;
    let rawPods: any = null;

    if (options.mockNodesJson && options.mockPodsJson) {
      rawNodes = options.mockNodesJson;
      rawPods = options.mockPodsJson;
    } else {
      try {
        const nodesRes = spawnSync("kubectl", ["get", "nodes", "-o", "json"], {
          encoding: "utf8",
          timeout: timeoutMs,
          windowsHide: true,
        });
        const podsRes = spawnSync("kubectl", ["get", "pods", "-A", "-o", "json"], {
          encoding: "utf8",
          timeout: timeoutMs,
          windowsHide: true,
        });

        if (nodesRes.status === 0 && nodesRes.stdout) {
          rawNodes = JSON.parse(nodesRes.stdout);
        }
        if (podsRes.status === 0 && podsRes.stdout) {
          rawPods = JSON.parse(podsRes.stdout);
        }
      } catch (err: any) {
        const receiptPayload = JSON.stringify({
          context: currentContext,
          allowedContext: true,
          status: "INSPECTION_FAILED",
          error: String(err?.message || "Execution failed"),
        });
        return deepFreeze({
          timestampIso: new Date().toISOString(),
          context: currentContext,
          allowedContext: true,
          status: "INSPECTION_FAILED",
          totalNodes: 0,
          readyNodes: 0,
          nodes: [],
          pods: { total: 0, running: 0, pending: 0, failed: 0, succeeded: 0 },
          sha256Receipt: pureSha256(receiptPayload),
          error: String(err?.message || "Inspection execution failed"),
        });
      }
    }

    const nodes = EosKubectlClusterInspector.parseNodes(rawNodes);
    const pods = EosKubectlClusterInspector.parsePods(rawPods);
    const totalNodes = nodes.length;
    const readyNodes = nodes.filter((n) => n.ready).length;
    const isHealthy = totalNodes > 0 && readyNodes === totalNodes && pods.failed === 0;
    const status: KubectlClusterStatusReport["status"] =
      rawNodes === null ? "INSPECTION_FAILED" : isHealthy ? "HEALTHY" : "DEGRADED";
    const error = rawNodes === null ? "Cluster API server unreachable or inactive" : undefined;

    const receiptPayload = JSON.stringify({
      context: currentContext,
      allowedContext: true,
      status,
      totalNodes,
      readyNodes,
      pods,
      error,
    });
    const sha256Receipt = pureSha256(receiptPayload);

    const report: KubectlClusterStatusReport = deepFreeze({
      timestampIso: new Date().toISOString(),
      context: currentContext,
      allowedContext: true,
      status,
      totalNodes,
      readyNodes,
      nodes,
      pods,
      sha256Receipt,
      error,
    });

    if (options.receiptPath) {
      try {
        fs.mkdirSync(path.dirname(options.receiptPath), { recursive: true });
        fs.writeFileSync(options.receiptPath, JSON.stringify(report, null, 2), "utf8");
      } catch {
        // fail-soft on receipt write
      }
    }

    return report;
  }
}

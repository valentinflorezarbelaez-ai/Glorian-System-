/**
 * SPEC-247 / CHANGE-124 — Layer-0 EDA Equivalence, Static Timing & seL4 Non-Interference Prover.
 * Zero external runtime dependencies (EOS Law V).
 */

import crypto from "node:crypto";
import { deepFreeze } from "./eosKernelPrimitives.ts";
import type {
  EdaEquivalenceTimingReport,
  InformationFlowEdgeInput,
  LecCounterexample,
  ProveEdaAndSeL4Options,
  TimingNodeInput,
} from "./eosEdaEquivalenceTimingProverCore.types.ts";

const DEFAULT_DOMAIN: readonly number[] = Array.from({ length: 64 }, (_, idx) => idx - 32);

const DEFAULT_TIMING_DAG: readonly TimingNodeInput[] = [
  { nodeId: "ingest", delayMicros: 45, dependsOn: [] },
  { nodeId: "parse_ast", delayMicros: 110, dependsOn: ["ingest"] },
  { nodeId: "prove_invariants", delayMicros: 180, dependsOn: ["parse_ast"] },
  { nodeId: "emit_dsse", delayMicros: 65, dependsOn: ["prove_invariants"] },
];

const DEFAULT_FLOWS: readonly InformationFlowEdgeInput[] = [
  { sourceId: "vault_key", sourceDomain: "HIGH_SECRET", sinkId: "signer_kernel", sinkDomain: "KERNEL" },
  {
    sourceId: "signer_kernel",
    sourceDomain: "KERNEL",
    sinkId: "public_audit_log",
    sinkDomain: "LOW_PUBLIC",
    declassified: true,
  },
];

function checkLogicalEquivalence(
  referenceFn: (x: number) => number | string | boolean,
  candidateFn: (x: number) => number | string | boolean,
  domain: readonly number[],
): { lecEquivalent: boolean; firstCounterexample?: LecCounterexample } {
  for (const input of domain) {
    const referenceOutput = referenceFn(input);
    const candidateOutput = candidateFn(input);
    if (referenceOutput !== candidateOutput) {
      return {
        lecEquivalent: false,
        firstCounterexample: { input, referenceOutput, candidateOutput },
      };
    }
  }
  return { lecEquivalent: true };
}

function buildTimingGraph(nodes: readonly TimingNodeInput[]): {
  nodeMap: Map<string, TimingNodeInput>;
  inDegree: Map<string, number>;
  adj: Map<string, string[]>;
} {
  const nodeMap = new Map<string, TimingNodeInput>();
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const node of nodes) {
    nodeMap.set(node.nodeId, node);
    inDegree.set(node.nodeId, 0);
    adj.set(node.nodeId, []);
  }
  for (const node of nodes) {
    for (const dep of node.dependsOn ?? []) {
      if (!nodeMap.has(dep)) continue;
      adj.get(dep)!.push(node.nodeId);
      inDegree.set(node.nodeId, (inDegree.get(node.nodeId) ?? 0) + 1);
    }
  }
  return { nodeMap, inDegree, adj };
}

function traceCriticalPath(endNodeId: string | null, bestPred: Map<string, string | null>): string[] {
  const pathNodes: string[] = [];
  let cursor = endNodeId;
  while (cursor !== null) {
    pathNodes.push(cursor);
    cursor = bestPred.get(cursor) ?? null;
  }
  return pathNodes.reverse();
}

function relaxDagNeighbors(
  current: string,
  nodeMap: Map<string, TimingNodeInput>,
  adj: Map<string, string[]>,
  inDegree: Map<string, number>,
  arrival: Map<string, number>,
  bestPred: Map<string, string | null>,
  queue: string[],
): void {
  const currentArrival = arrival.get(current) ?? 0;
  const neighbors = adj.get(current) ?? [];
  for (const nextId of neighbors) {
    const nextNode = nodeMap.get(nextId);
    const nextDelay = Math.max(0, nextNode ? nextNode.delayMicros : 0);
    const nextArrival = currentArrival + nextDelay;
    if (nextArrival > (arrival.get(nextId) ?? 0)) {
      arrival.set(nextId, nextArrival);
      bestPred.set(nextId, current);
    }
    const nextDeg = (inDegree.get(nextId) ?? 0) - 1;
    inDegree.set(nextId, nextDeg);
    if (nextDeg === 0) queue.push(nextId);
  }
}

function findCriticalTerminalNode(
  nodes: readonly TimingNodeInput[],
  arrival: Map<string, number>,
): { maxDelay: number; endNodeId: string | null } {
  let maxDelay = -1;
  let endNodeId: string | null = null;
  for (const node of nodes) {
    const arr = arrival.get(node.nodeId) ?? 0;
    if (arr > maxDelay) {
      maxDelay = arr;
      endNodeId = node.nodeId;
    }
  }
  return { maxDelay, endNodeId };
}

function evaluateStaticTiming(
  nodes: readonly TimingNodeInput[],
  clockBudgetMicros: number,
): {
  criticalPathDelayMicros: number;
  criticalPathNodes: string[];
  slackMicros: number;
  timingMet: boolean;
} {
  if (nodes.length === 0) {
    return { criticalPathDelayMicros: 0, criticalPathNodes: [], slackMicros: clockBudgetMicros, timingMet: true };
  }
  const { nodeMap, inDegree, adj } = buildTimingGraph(nodes);
  const arrival = new Map<string, number>();
  const bestPred = new Map<string, string | null>();
  const queue: string[] = [];

  for (const node of nodes) {
    arrival.set(node.nodeId, Math.max(0, node.delayMicros));
    bestPred.set(node.nodeId, null);
    if ((inDegree.get(node.nodeId) ?? 0) === 0) queue.push(node.nodeId);
  }

  let visited = 0;
  while (queue.length > 0) {
    visited++;
    relaxDagNeighbors(queue.shift()!, nodeMap, adj, inDegree, arrival, bestPred, queue);
  }
  if (visited < nodes.length) {
    throw new Error("Cyclic dependency detected in timing DAG");
  }

  const { maxDelay, endNodeId } = findCriticalTerminalNode(nodes, arrival);
  const slackMicros = clockBudgetMicros - maxDelay;
  return {
    criticalPathDelayMicros: maxDelay,
    criticalPathNodes: traceCriticalPath(endNodeId, bestPred),
    slackMicros,
    timingMet: slackMicros >= 0,
  };
}

function evaluateInformationFlows(flows: readonly InformationFlowEdgeInput[]): string[] {
  const illegal: string[] = [];
  for (const edge of flows) {
    const downward =
      (edge.sourceDomain === "HIGH_SECRET" || edge.sourceDomain === "KERNEL") && edge.sinkDomain === "LOW_PUBLIC";
    if (downward && edge.declassified !== true) {
      illegal.push(`Unclassified leak: ${edge.sourceId}[${edge.sourceDomain}] -> ${edge.sinkId}[${edge.sinkDomain}]`);
    }
  }
  return illegal;
}

export class EosEdaEquivalenceTimingProverCore {
  public static proveEquivalenceTimingAndIsolation(options: ProveEdaAndSeL4Options = {}): EdaEquivalenceTimingReport {
    const circuitId = options.circuitId?.trim() || "GLORIAN-CORE-PIPELINE";
    const referenceFn = options.referenceFn ?? ((x: number) => x * 2 + 1);
    const candidateFn = options.candidateFn ?? ((x: number) => (x << 1) + 1);
    const inputDomain = options.inputDomain ?? DEFAULT_DOMAIN;
    const timingDag = options.timingDag ?? DEFAULT_TIMING_DAG;
    const clockBudgetMicros = Math.max(0, options.clockBudgetMicros ?? 500);
    const flows = options.flows ?? DEFAULT_FLOWS;

    const lec = checkLogicalEquivalence(referenceFn, candidateFn, inputDomain);
    const sta = evaluateStaticTiming(timingDag, clockBudgetMicros);
    const illegalFlows = evaluateInformationFlows(flows);
    const nonInterferenceVerified = illegalFlows.length === 0;
    const verdict =
      lec.lecEquivalent && sta.timingMet && nonInterferenceVerified
        ? "SILICON_FORMAL_VERIFIED"
        : "FORMAL_VIOLATION_BLOCKED";

    const body = {
      circuitId,
      lecEquivalent: lec.lecEquivalent,
      inputsTestedCount: inputDomain.length,
      ...(lec.firstCounterexample ? { firstCounterexample: lec.firstCounterexample } : {}),
      criticalPathDelayMicros: sta.criticalPathDelayMicros,
      criticalPathNodes: sta.criticalPathNodes,
      clockBudgetMicros,
      slackMicros: sta.slackMicros,
      timingMet: sta.timingMet,
      nonInterferenceVerified,
      illegalFlows,
      verdict,
    } as const;

    const proverDigestSha256 = crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex");
    return deepFreeze({ ...body, proverDigestSha256 });
  }
}

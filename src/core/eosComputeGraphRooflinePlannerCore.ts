/**
 * SPEC-251 / CHANGE-126 — Layer-0 Compute Graph Roofline Planner & Static Arena Allocator.
 * Inspired by NVIDIA TensorRT & DeepMind XLA operator fusion + Roofline modeling.
 * Zero external runtime dependencies (EOS Law V).
 */

import { deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import type {
  ArenaBufferAllocation,
  ComputeGraphNodeInput,
  ComputeGraphRooflineOptions,
  ComputeGraphRooflineReport,
  FusedOperatorGroup,
  OperatorRooflineProfile,
} from "./eosComputeGraphRooflinePlannerCore.types.ts";

const DEFAULT_ROOFLINE_NODES: readonly ComputeGraphNodeInput[] = [
  {
    id: "qkv_proj",
    opKind: "MATMUL",
    flops: 12_800_000_000,
    bytesRead: 4_000_000,
    bytesWritten: 2_000_000,
    outputBytes: 2_000_000,
    dependencies: [],
  },
  {
    id: "qkv_bias",
    opKind: "BIAS_ADD",
    flops: 4_000_000,
    bytesRead: 2_000_000,
    bytesWritten: 2_000_000,
    outputBytes: 2_000_000,
    dependencies: ["qkv_proj"],
  },
  {
    id: "qkv_relu",
    opKind: "RELU",
    flops: 4_000_000,
    bytesRead: 2_000_000,
    bytesWritten: 2_000_000,
    outputBytes: 2_000_000,
    dependencies: ["qkv_bias"],
  },
  {
    id: "ffn_up",
    opKind: "MATMUL",
    flops: 25_600_000_000,
    bytesRead: 8_000_000,
    bytesWritten: 4_000_000,
    outputBytes: 4_000_000,
    dependencies: ["qkv_relu"],
  },
  {
    id: "ffn_relu",
    opKind: "RELU",
    flops: 8_000_000,
    bytesRead: 4_000_000,
    bytesWritten: 4_000_000,
    outputBytes: 4_000_000,
    dependencies: ["ffn_up"],
  },
  {
    id: "ffn_down",
    opKind: "MATMUL",
    flops: 25_600_000_000,
    bytesRead: 8_000_000,
    bytesWritten: 4_000_000,
    outputBytes: 4_000_000,
    dependencies: ["ffn_relu"],
  },
];

function validateGraphInputs(
  nodes: readonly ComputeGraphNodeInput[],
  peakFlopsGiga: number,
  memoryBandwidthGBps: number,
  memoryBudgetBytes: number,
  alignBytes: number,
): Map<string, ComputeGraphNodeInput> {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error("Compute graph requires at least one operator node.");
  }
  if (!(peakFlopsGiga > 0) || !(memoryBandwidthGBps > 0) || !(memoryBudgetBytes > 0) || !(alignBytes > 0)) {
    throw new Error("Hardware peakFlopsGiga, memoryBandwidthGBps, memoryBudgetBytes, and alignBytes must be > 0.");
  }
  const byId = new Map<string, ComputeGraphNodeInput>();
  for (const node of nodes) {
    if (!node.id || byId.has(node.id)) {
      throw new Error(`Invalid or duplicate compute graph node id: '${node.id}'.`);
    }
    byId.set(node.id, node);
  }
  for (const node of nodes) {
    for (const dep of node.dependencies) {
      if (!byId.has(dep)) {
        throw new Error(`Node '${node.id}' references unknown dependency '${dep}'.`);
      }
    }
  }
  return byId;
}

function sortTopologicalDag(
  nodes: readonly ComputeGraphNodeInput[],
  byId: Map<string, ComputeGraphNodeInput>,
): string[] {
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const node of nodes) {
    inDegree.set(node.id, node.dependencies.length);
    children.set(node.id, []);
  }
  for (const node of nodes) {
    for (const dep of node.dependencies) {
      children.get(dep)!.push(node.id);
    }
  }
  const queue = nodes
    .filter((n) => (inDegree.get(n.id) ?? 0) === 0)
    .map((n) => n.id)
    .sort();
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const nextId of children.get(id) ?? []) {
      const nextDeg = (inDegree.get(nextId) ?? 0) - 1;
      inDegree.set(nextId, nextDeg);
      if (nextDeg === 0) {
        queue.push(nextId);
        queue.sort();
      }
    }
  }
  if (order.length !== byId.size) {
    throw new Error("Cyclic dependency detected in compute graph; DAG required.");
  }
  return order;
}

function buildRooflineProfile(
  node: ComputeGraphNodeInput,
  peakFlopsGiga: number,
  memoryBandwidthGBps: number,
  ridgePoint: number,
): OperatorRooflineProfile {
  const traffic = Math.max(1, node.bytesRead + node.bytesWritten);
  const intensity = node.flops / traffic;
  const attainable = Math.min(peakFlopsGiga, intensity * memoryBandwidthGBps);
  const regime = intensity >= ridgePoint ? "COMPUTE_BOUND" : "MEMORY_BOUND";
  return {
    id: node.id,
    opKind: node.opKind,
    arithmeticIntensityFlopsPerByte: Number(intensity.toFixed(4)),
    attainableGflops: Number(attainable.toFixed(4)),
    boundRegime: regime,
    utilizationRatio: Number((attainable / peakFlopsGiga).toFixed(4)),
  };
}

function isFusiblePair(prev: ComputeGraphNodeInput, next: ComputeGraphNodeInput, consumerCount: number): boolean {
  if (consumerCount !== 1 || next.dependencies.length !== 1 || next.dependencies[0] !== prev.id) {
    return false;
  }
  const pair = `${prev.opKind}->${next.opKind}`;
  return pair === "MATMUL->BIAS_ADD" || pair === "MATMUL->RELU" || pair === "BIAS_ADD->RELU";
}

function detectOperatorFusion(
  executionOrder: readonly string[],
  byId: Map<string, ComputeGraphNodeInput>,
): FusedOperatorGroup[] {
  const consumerCount = new Map<string, number>();
  for (const node of byId.values()) {
    for (const dep of node.dependencies) {
      consumerCount.set(dep, (consumerCount.get(dep) ?? 0) + 1);
    }
  }
  const consumed = new Set<string>();
  const groups: FusedOperatorGroup[] = [];
  for (let i = 0; i < executionOrder.length; i += 1) {
    const startNode = byId.get(executionOrder[i])!;
    if (consumed.has(startNode.id)) continue;
    const chain: ComputeGraphNodeInput[] = [startNode];
    let cursorIdx = i;
    while (cursorIdx + 1 < executionOrder.length) {
      const prev = chain[chain.length - 1];
      const next = byId.get(executionOrder[cursorIdx + 1])!;
      if (!isFusiblePair(prev, next, consumerCount.get(prev.id) ?? 0)) break;
      chain.push(next);
      consumed.add(next.id);
      cursorIdx += 1;
    }
    if (chain.length >= 2) {
      consumed.add(startNode.id);
      let saved = 0;
      for (let k = 0; k < chain.length - 1; k += 1) {
        saved += chain[k].bytesWritten + chain[k + 1].bytesRead;
      }
      groups.push({
        groupId: `fused_${groups.length + 1}`,
        nodeIds: chain.map((n) => n.id),
        pattern: chain.map((n) => n.opKind).join("->"),
        memoryTrafficSavedBytes: saved,
      });
    }
  }
  return groups;
}

function allocateStaticArena(
  executionOrder: readonly string[],
  byId: Map<string, ComputeGraphNodeInput>,
  alignBytes: number,
): { readonly allocations: readonly ArenaBufferAllocation[]; readonly peakArenaBytes: number } {
  let cursor = 0;
  const allocations: ArenaBufferAllocation[] = [];
  for (const id of executionOrder) {
    const node = byId.get(id)!;
    const sizeBytes = Math.max(0, Math.trunc(node.outputBytes));
    const alignedSizeBytes = sizeBytes === 0 ? 0 : Math.ceil(sizeBytes / alignBytes) * alignBytes;
    allocations.push({ nodeId: id, offsetBytes: cursor, sizeBytes, alignedSizeBytes });
    cursor += alignedSizeBytes;
  }
  return { allocations, peakArenaBytes: cursor };
}

export class EosComputeGraphRooflinePlannerCore {
  static planComputeGraphAndArena(options: ComputeGraphRooflineOptions = {}): ComputeGraphRooflineReport {
    const hardwareName = options.hardwareName?.trim() || "GLORIAN-TENSOR-SM90";
    const peakFlopsGiga = options.peakFlopsGiga ?? 312_000;
    const memoryBandwidthGBps = options.memoryBandwidthGBps ?? 2_000;
    const memoryBudgetBytes = options.memoryBudgetBytes ?? 67_108_864;
    const alignBytes = options.alignBytes ?? 64;
    const nodes = options.nodes ?? DEFAULT_ROOFLINE_NODES;

    const byId = validateGraphInputs(nodes, peakFlopsGiga, memoryBandwidthGBps, memoryBudgetBytes, alignBytes);
    const executionOrder = sortTopologicalDag(nodes, byId);
    const ridgePointFlopsPerByte = Number((peakFlopsGiga / memoryBandwidthGBps).toFixed(4));
    const operatorProfiles = executionOrder.map((id) =>
      buildRooflineProfile(byId.get(id)!, peakFlopsGiga, memoryBandwidthGBps, ridgePointFlopsPerByte),
    );
    const fusedGroups = detectOperatorFusion(executionOrder, byId);
    const fusedOperatorsCount = fusedGroups.reduce((acc, g) => acc + g.nodeIds.length, 0);
    const memoryTrafficSavedBytes = fusedGroups.reduce((acc, g) => acc + g.memoryTrafficSavedBytes, 0);
    const arena = allocateStaticArena(executionOrder, byId, alignBytes);
    const verdict = arena.peakArenaBytes <= memoryBudgetBytes ? "ROOFLINE_OPTIMIZED" : "ARENA_BUDGET_EXCEEDED";

    const digestPayload = {
      hardwareName,
      ridgePointFlopsPerByte,
      executionOrder,
      fusedGroups,
      peakArenaBytes: arena.peakArenaBytes,
      verdict,
    };

    return deepFreeze({
      hardwareName,
      peakFlopsGiga,
      memoryBandwidthGBps,
      ridgePointFlopsPerByte,
      memoryBudgetBytes,
      alignBytes,
      totalNodes: nodes.length,
      executionOrder,
      operatorProfiles,
      fusedGroups,
      fusedOperatorsCount,
      memoryTrafficSavedBytes,
      arenaAllocations: arena.allocations,
      peakArenaBytes: arena.peakArenaBytes,
      fragmentationRatio: 0,
      verdict,
      rooflineDigestSha256: pureSha256(JSON.stringify(digestPayload)),
    });
  }
}

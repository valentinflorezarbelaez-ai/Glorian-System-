/**
 * EOS Fleet Topology Engine (SPEC-026, CHANGE-019)
 * Pure Layer-0 TypeScript representation of the 14 Sovereign Fleet Nodes,
 * concentric ring coordinates, blast radius calculations, and propagation latency.
 *
 * Invariant: Zero external dependencies (dependencies: {}).
 */

export interface FleetNode {
  id: string;
  name: string;
  tier: "Sovereign Fleet" | "Core Engine" | "Runtime Kernel";
  ring: 1 | 2 | 3;
  color: string;
  dependencies: string[];
  downstream: string[];
  latencyUs: number;
}

export interface BlastRadiusResult {
  nodeId: string;
  name: string;
  directDownstream: string[];
  transitiveBlastRadius: string[];
  blastRadiusCount: number;
  totalSystemNodes: number;
  blastRadiusRatio: number;
  estimatedLatencyUs: number;
}

export const FLEET_TOPOLOGY: Record<string, FleetNode> = {
  aberamentho: {
    id: "aberamentho",
    name: "Aberamentho Streaming Platform",
    tier: "Sovereign Fleet",
    ring: 1,
    color: "#ec4899",
    dependencies: ["dsp-bs1770", "apollo-mesh", "eos-core"],
    downstream: ["client-web", "audio-dsp"],
    latencyUs: 24.5,
  },
  portafolio: {
    id: "portafolio",
    name: "Valentín Flórez Sovereign Portfolio",
    tier: "Sovereign Fleet",
    ring: 1,
    color: "#a855f7",
    dependencies: ["eos-core", "disruptor-ring"],
    downstream: ["global-anycast"],
    latencyUs: 18.2,
  },
  ptg: {
    id: "ptg",
    name: "Performance Talent Group (PTG)",
    tier: "Sovereign Fleet",
    ring: 1,
    color: "#3b82f6",
    dependencies: ["eos-core", "datomic-ledger"],
    downstream: ["talent-mesh"],
    latencyUs: 21.0,
  },
  "eos-system": {
    id: "eos-system",
    name: "EOS System Sovereign Control Plane",
    tier: "Sovereign Fleet",
    ring: 1,
    color: "#10b981",
    dependencies: ["eos-core", "eos-ain", "eos-astral", "eos-elohim", "velo-isis", "apex-router"],
    downstream: ["aberamentho", "portafolio", "ptg"],
    latencyUs: 12.4,
  },
  "eos-core": {
    id: "eos-core",
    name: "EosCore L0 Monad Engine",
    tier: "Core Engine",
    ring: 2,
    color: "#06b6d4",
    dependencies: ["disruptor-ring", "go-wasm-kernel"],
    downstream: ["eos-system", "aberamentho", "portafolio", "ptg"],
    latencyUs: 5.1,
  },
  "eos-ain": {
    id: "eos-ain",
    name: "EosAin Null-State Singularity",
    tier: "Core Engine",
    ring: 2,
    color: "#6366f1",
    dependencies: ["datomic-ledger"],
    downstream: ["eos-system"],
    latencyUs: 6.2,
  },
  "eos-astral": {
    id: "eos-astral",
    name: "EosAstral Telemetric Weaver",
    tier: "Core Engine",
    ring: 2,
    color: "#8b5cf6",
    dependencies: ["apollo-mesh"],
    downstream: ["eos-system"],
    latencyUs: 7.8,
  },
  "eos-elohim": {
    id: "eos-elohim",
    name: "EosElohim Conscious Shocker",
    tier: "Core Engine",
    ring: 2,
    color: "#f59e0b",
    dependencies: ["disruptor-ring"],
    downstream: ["eos-system"],
    latencyUs: 4.9,
  },
  "velo-isis": {
    id: "velo-isis",
    name: "Velo de Isis Cryptographic Barrier",
    tier: "Core Engine",
    ring: 2,
    color: "#ef4444",
    dependencies: ["datomic-ledger"],
    downstream: ["eos-system"],
    latencyUs: 8.5,
  },
  "apex-router": {
    id: "apex-router",
    name: "Apex Frontier Model Router & Squeezer",
    tier: "Core Engine",
    ring: 2,
    color: "#14b8a6",
    dependencies: ["go-wasm-kernel"],
    downstream: ["eos-system"],
    latencyUs: 3.2,
  },
  "go-wasm-kernel": {
    id: "go-wasm-kernel",
    name: "Native Go WebAssembly Kernel",
    tier: "Runtime Kernel",
    ring: 3,
    color: "#00add8",
    dependencies: [],
    downstream: ["eos-core", "apex-router"],
    latencyUs: 0.8,
  },
  "disruptor-ring": {
    id: "disruptor-ring",
    name: "LMAX Disruptor Lock-Free Ring Buffer",
    tier: "Runtime Kernel",
    ring: 3,
    color: "#f97316",
    dependencies: [],
    downstream: ["eos-core", "eos-elohim"],
    latencyUs: 0.15,
  },
  "dsp-bs1770": {
    id: "dsp-bs1770",
    name: "ITU-R BS.1770 -14.0 LUFS Audio Normalizer",
    tier: "Runtime Kernel",
    ring: 3,
    color: "#84cc16",
    dependencies: [],
    downstream: ["aberamentho"],
    latencyUs: 1.1,
  },
  "datomic-ledger": {
    id: "datomic-ledger",
    name: "Datomic Immutable Bitemporal Ledger",
    tier: "Runtime Kernel",
    ring: 3,
    color: "#eab308",
    dependencies: [],
    downstream: ["ptg", "eos-ain", "velo-isis"],
    latencyUs: 1.4,
  },
};

/**
 * Returns all registered Sovereign Fleet nodes as an array.
 */
export function getFleetNodes(): FleetNode[] {
  return Object.values(FLEET_TOPOLOGY);
}

/**
 * Finds a node by ID (case-insensitive).
 */
export function getNodeById(id: string): FleetNode | null {
  const key = id.toLowerCase().trim();
  return FLEET_TOPOLOGY[key] || null;
}

/**
 * Calculates the recursive blast radius (transitive downstream dependents)
 * of a given node in the Sovereign Fleet.
 */
export function calculateBlastRadius(nodeId: string): BlastRadiusResult {
  const startNode = getNodeById(nodeId);
  const totalNodes = Object.keys(FLEET_TOPOLOGY).length;

  if (!startNode) {
    return {
      nodeId,
      name: "Unknown Node",
      directDownstream: [],
      transitiveBlastRadius: [],
      blastRadiusCount: 0,
      totalSystemNodes: totalNodes,
      blastRadiusRatio: 0,
      estimatedLatencyUs: 0,
    };
  }

  const visited = new Set<string>();
  const queue = [...startNode.downstream];
  let maxLatency = startNode.latencyUs;

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (!visited.has(currentId)) {
      visited.add(currentId);
      const curr = getNodeById(currentId);
      if (curr) {
        maxLatency = Math.max(maxLatency, curr.latencyUs);
        queue.push(...curr.downstream);
      }
    }
  }

  const blastRadius = Array.from(visited);
  return {
    nodeId: startNode.id,
    name: startNode.name,
    directDownstream: [...startNode.downstream],
    transitiveBlastRadius: blastRadius,
    blastRadiusCount: blastRadius.length,
    totalSystemNodes: totalNodes,
    blastRadiusRatio: Number((blastRadius.length / totalNodes).toFixed(4)),
    estimatedLatencyUs: maxLatency,
  };
}

/**
 * Computes global graph statistics for the Sovereign Topology.
 */
export function getTopologyMetrics(): {
  totalNodes: number;
  ring1Count: number;
  ring2Count: number;
  ring3Count: number;
  averageLatencyUs: number;
  totalEdges: number;
} {
  const nodes = getFleetNodes();
  let totalLatency = 0;
  let totalEdges = 0;
  let r1 = 0;
  let r2 = 0;
  let r3 = 0;

  for (const n of nodes) {
    totalLatency += n.latencyUs;
    totalEdges += n.dependencies.length;
    if (n.ring === 1) r1++;
    else if (n.ring === 2) r2++;
    else if (n.ring === 3) r3++;
  }

  return {
    totalNodes: nodes.length,
    ring1Count: r1,
    ring2Count: r2,
    ring3Count: r3,
    averageLatencyUs: Number((totalLatency / nodes.length).toFixed(2)),
    totalEdges,
  };
}

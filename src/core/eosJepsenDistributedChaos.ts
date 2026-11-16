/**
 * EOS SYSTEM — JEPSEN-GRADE DISTRIBUTED NETWORK CHAOS ENGINE
 * Governed by SPEC-313 / CHANGE-175
 * High-assurance distributed partition simulator, packet loss emulator, and anti-entropy verifier.
 */

import { createHash } from "node:crypto";
import {
  JepsenOperationStatus,
  JepsenOperationType,
  type JepsenClusterConfig,
  type JepsenConvergenceResult,
  type JepsenConsistencyAuditResult,
  type JepsenNodeState,
  type JepsenNetworkPacket,
  type JepsenOperationRecord,
  type JepsenPartitionRule,
  type JepsenRegisterEntry,
  type JepsenAuditReceipt,
} from "./eosJepsenDistributedChaos.types.ts";

/**
 * Deterministic PRNG using 32-bit LCG algorithm.
 * Guarantees 100% reproducible chaos simulation runs given the same seed.
 */
export class JepsenDeterministicRng {
  private state: number;

  constructor(seed = 42) {
    this.state = seed >>> 0;
    if (this.state === 0) {
      this.state = 1337;
    }
  }

  public next(): number {
    // Numerical Recipes LCG parameters: a = 1664525, c = 1013904223, m = 2^32
    this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  public nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

/**
 * Jepsen-Grade Distributed Network Chaos Cluster.
 */
export class EosJepsenDistributedChaosCore {
  private readonly config: JepsenClusterConfig;
  private readonly rng: JepsenDeterministicRng;
  private readonly nodes: Map<string, JepsenNodeState>;
  private readonly severedLinks: Set<string>;
  private readonly nodeSkewMs: Map<string, number>;
  private readonly packetQueue: JepsenNetworkPacket[];
  private readonly operationHistory: JepsenOperationRecord[];
  private partitionRule: JepsenPartitionRule | null;
  private packetLossRate: number;
  private currentTick: number;
  private totalPacketsCount: number;
  private droppedPacketsCount: number;

  constructor(config: JepsenClusterConfig) {
    if (config.nodeCount < 1) {
      throw new Error("Cluster node count must be at least 1");
    }
    this.config = {
      nodeCount: config.nodeCount,
      seed: config.seed ?? 42,
      defaultLatencyMs: config.defaultLatencyMs ?? 5,
      jitterMs: config.jitterMs ?? 2,
      packetLossRate: config.packetLossRate ?? 0,
    };
    this.rng = new JepsenDeterministicRng(this.config.seed);
    this.nodes = new Map();
    this.severedLinks = new Set();
    this.nodeSkewMs = new Map();
    this.packetQueue = [];
    this.operationHistory = [];
    this.partitionRule = null;
    this.packetLossRate = this.config.packetLossRate ?? 0;
    this.currentTick = 0;
    this.totalPacketsCount = 0;
    this.droppedPacketsCount = 0;

    this.initializeCluster();
  }

  private initializeCluster(): void {
    for (let i = 0; i < this.config.nodeCount; i++) {
      const nodeId = `node-${i}`;
      const vectorClock: Record<string, number> = {};
      for (let j = 0; j < this.config.nodeCount; j++) {
        vectorClock[`node-${j}`] = 0;
      }
      this.nodes.set(nodeId, {
        nodeId,
        wallClockOffsetMs: 0,
        vectorClock,
        registerStore: {},
        sentCount: 0,
        receivedCount: 0,
        droppedCount: 0,
      });
      this.nodeSkewMs.set(nodeId, 0);
    }
  }

  public getNode(nodeId: string): JepsenNodeState {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found in cluster`);
    }
    return node;
  }

  public getAllNodes(): JepsenNodeState[] {
    return Array.from(this.nodes.values());
  }

  public getTick(): number {
    return this.currentTick;
  }

  public getNodeTime(nodeId: string): number {
    const skew = this.nodeSkewMs.get(nodeId) ?? 0;
    return this.currentTick + skew;
  }

  public injectPartition(rule: JepsenPartitionRule): void {
    this.partitionRule = rule;
    this.severedLinks.clear();

    if (rule.type === "SYMMETRIC" && rule.subsets) {
      for (let s1 = 0; s1 < rule.subsets.length; s1++) {
        for (let s2 = s1 + 1; s2 < rule.subsets.length; s2++) {
          const setA = rule.subsets[s1];
          const setB = rule.subsets[s2];
          for (const na of setA) {
            for (const nb of setB) {
              this.severedLinks.add(`${na}->${nb}`);
              this.severedLinks.add(`${nb}->${na}`);
            }
          }
        }
      }
    } else if (rule.type === "ASYMMETRIC" && rule.severedLinks) {
      for (const link of rule.severedLinks) {
        this.severedLinks.add(`${link.from}->${link.to}`);
      }
    }
  }

  public injectPacketLoss(rate: number): void {
    if (rate < 0 || rate > 1) {
      throw new Error("Packet loss rate must be between 0.0 and 1.0");
    }
    this.packetLossRate = rate;
  }

  public injectClockSkew(nodeId: string, skewMs: number): void {
    if (!this.nodes.has(nodeId)) {
      throw new Error(`Cannot skew unknown node ${nodeId}`);
    }
    this.nodeSkewMs.set(nodeId, skewMs);
    const node = this.nodes.get(nodeId);
    if (node) {
      node.wallClockOffsetMs = skewMs;
    }
  }

  public healCluster(): void {
    this.partitionRule = null;
    this.severedLinks.clear();
    this.packetLossRate = 0;
  }

  public canDeliver(sourceId: string, targetId: string): boolean {
    if (sourceId === targetId) return true;
    if (this.severedLinks.has(`${sourceId}->${targetId}`)) {
      return false;
    }
    if (this.packetLossRate > 0 && this.rng.next() < this.packetLossRate) {
      return false;
    }
    return true;
  }

  public write(nodeId: string, key: string, value: unknown): JepsenOperationRecord {
    const node = this.getNode(nodeId);
    const opId = `op-write-${this.operationHistory.length + 1}`;
    const invokeTime = this.getNodeTime(nodeId);

    const record: JepsenOperationRecord = {
      opId,
      type: JepsenOperationType.WRITE,
      nodeId,
      key,
      value,
      status: JepsenOperationStatus.INVOKED,
      invokeTime,
    };
    this.operationHistory.push(record);

    // Increment node-local vector clock
    node.vectorClock[nodeId] = (node.vectorClock[nodeId] ?? 0) + 1;

    const entry: JepsenRegisterEntry = {
      key,
      value,
      timestamp: invokeTime,
      nodeOrigin: nodeId,
      vectorClock: { ...node.vectorClock },
    };
    node.registerStore[key] = entry;

    // Broadcast gossip updates to all other nodes
    this.broadcastUpdate(nodeId, [entry]);

    record.status = JepsenOperationStatus.OK;
    record.completeTime = this.getNodeTime(nodeId);
    return record;
  }

  public read(nodeId: string, key: string): JepsenOperationRecord {
    const node = this.getNode(nodeId);
    const opId = `op-read-${this.operationHistory.length + 1}`;
    const invokeTime = this.getNodeTime(nodeId);

    const entry = node.registerStore[key];
    const record: JepsenOperationRecord = {
      opId,
      type: JepsenOperationType.READ,
      nodeId,
      key,
      value: entry ? entry.value : undefined,
      status: JepsenOperationStatus.OK,
      invokeTime,
      completeTime: this.getNodeTime(nodeId),
    };
    this.operationHistory.push(record);
    return record;
  }

  private broadcastUpdate(sourceId: string, entries: JepsenRegisterEntry[]): void {
    const sourceNode = this.getNode(sourceId);
    for (const targetNode of this.nodes.values()) {
      if (targetNode.nodeId === sourceId) continue;

      this.totalPacketsCount++;
      sourceNode.sentCount++;

      const latency = (this.config.defaultLatencyMs ?? 5) + this.rng.nextInt(0, this.config.jitterMs ?? 2);
      const deliveryTick = this.currentTick + latency;

      const packet: JepsenNetworkPacket = {
        packetId: `pkt-${this.totalPacketsCount}`,
        sourceId,
        targetId: targetNode.nodeId,
        payload: {
          type: "GOSSIP_UPDATE",
          entries: entries.map((e) => ({ ...e })),
          senderClock: { ...sourceNode.vectorClock },
        },
        timestamp: this.currentTick,
        deliveryTick,
        dropped: false,
      };

      this.packetQueue.push(packet);
    }
  }

  public processPackets(maxDeliveries = 100): number {
    let processed = 0;
    this.packetQueue.sort((a, b) => a.deliveryTick - b.deliveryTick);

    const toProcess = this.packetQueue.splice(0, maxDeliveries);
    for (const packet of toProcess) {
      processed++;
      this.currentTick = Math.max(this.currentTick, packet.deliveryTick);

      const targetNode = this.nodes.get(packet.targetId);
      const sourceNode = this.nodes.get(packet.sourceId);

      if (!targetNode || !sourceNode) {
        continue;
      }

      if (this.canDeliver(packet.sourceId, packet.targetId)) {
        // Merge sender clock into target vector clock
        for (const [k, v] of Object.entries(packet.payload.senderClock)) {
          targetNode.vectorClock[k] = Math.max(targetNode.vectorClock[k] ?? 0, v);
        }

        // Apply LWW conflict resolution on register entries
        for (const remoteEntry of packet.payload.entries) {
          const localEntry = targetNode.registerStore[remoteEntry.key];
          if (!localEntry) {
            targetNode.registerStore[remoteEntry.key] = { ...remoteEntry };
          } else {
            // LWW comparison: timestamp first, lexicographical origin tie-breaker
            if (remoteEntry.timestamp > localEntry.timestamp) {
              targetNode.registerStore[remoteEntry.key] = { ...remoteEntry };
            } else if (
              remoteEntry.timestamp === localEntry.timestamp &&
              remoteEntry.nodeOrigin > localEntry.nodeOrigin
            ) {
              targetNode.registerStore[remoteEntry.key] = { ...remoteEntry };
            }
          }
        }
        targetNode.receivedCount++;
      } else {
        packet.dropped = true;
        this.droppedPacketsCount++;
        targetNode.droppedCount++;
      }
    }
    return processed;
  }

  public runAntiEntropySync(maxRounds = 5): JepsenConvergenceResult {
    const allNodes = this.getAllNodes();

    // Round-robin pairwise sync between reachable nodes
    for (let round = 0; round < maxRounds; round++) {
      this.currentTick += 10;
      for (let i = 0; i < allNodes.length; i++) {
        for (let j = i + 1; j < allNodes.length; j++) {
          const nodeA = allNodes[i];
          const nodeB = allNodes[j];

          if (this.canDeliver(nodeA.nodeId, nodeB.nodeId)) {
            this.syncPair(nodeA, nodeB);
          }
          if (this.canDeliver(nodeB.nodeId, nodeA.nodeId)) {
            this.syncPair(nodeB, nodeA);
          }
        }
      }
    }

    return this.verifyConvergence();
  }

  private syncPair(source: JepsenNodeState, target: JepsenNodeState): void {
    for (const [key, sourceEntry] of Object.entries(source.registerStore)) {
      const targetEntry = target.registerStore[key];
      if (!targetEntry) {
        target.registerStore[key] = { ...sourceEntry };
      } else {
        if (sourceEntry.timestamp > targetEntry.timestamp) {
          target.registerStore[key] = { ...sourceEntry };
        } else if (sourceEntry.timestamp === targetEntry.timestamp && sourceEntry.nodeOrigin > targetEntry.nodeOrigin) {
          target.registerStore[key] = { ...sourceEntry };
        }
      }
    }
    for (const [k, v] of Object.entries(source.vectorClock)) {
      target.vectorClock[k] = Math.max(target.vectorClock[k] ?? 0, v);
    }
  }

  public verifyConvergence(): JepsenConvergenceResult {
    const allNodes = this.getAllNodes();
    const nodeSnapshots: Record<string, Record<string, unknown>> = {};
    const stateHashes: string[] = [];

    for (const node of allNodes) {
      const snapshot: Record<string, unknown> = {};
      const sortedKeys = Object.keys(node.registerStore).sort();
      for (const k of sortedKeys) {
        snapshot[k] = node.registerStore[k].value;
      }
      nodeSnapshots[node.nodeId] = snapshot;
      stateHashes.push(createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"));
    }

    const firstHash = stateHashes[0];
    const divergentNodes: string[] = [];
    for (let i = 1; i < stateHashes.length; i++) {
      if (stateHashes[i] !== firstHash) {
        divergentNodes.push(allNodes[i].nodeId);
      }
    }

    return {
      converged: divergentNodes.length === 0,
      rounds: 1,
      stateHash: firstHash,
      divergentNodes,
      nodeSnapshots,
    };
  }

  public auditConsistency(): JepsenConsistencyAuditResult {
    let okOps = 0;
    let failedOps = 0;
    let linearizabilityViolations = 0;
    let staleReadsDetected = 0;
    const violations: string[] = [];

    // Track write completions to detect stale reads
    const latestWrites = new Map<string, { value: unknown; time: number }>();

    for (const op of this.operationHistory) {
      if (op.status === JepsenOperationStatus.OK) {
        okOps++;
      } else {
        failedOps++;
      }

      if (op.type === JepsenOperationType.WRITE && op.completeTime) {
        latestWrites.set(op.key, {
          value: op.value,
          time: op.completeTime,
        });
      }

      if (op.type === JepsenOperationType.READ && op.invokeTime) {
        const lastWrite = latestWrites.get(op.key);
        if (
          lastWrite &&
          op.invokeTime > lastWrite.time &&
          this.severedLinks.size === 0 &&
          op.value !== lastWrite.value
        ) {
          // If network is completely healed, reading an older value violates linearizability
          linearizabilityViolations++;
          staleReadsDetected++;
          violations.push(
            `Stale read on key '${op.key}' at ${op.nodeId}: read ${JSON.stringify(op.value)} expected ${JSON.stringify(lastWrite.value)}`,
          );
        }
      }
    }

    return {
      totalOperations: this.operationHistory.length,
      okOperations: okOps,
      failedOperations: failedOps,
      linearizabilityViolations,
      staleReadsDetected,
      violations,
    };
  }

  public generateReceipt(): JepsenAuditReceipt {
    const convergence = this.verifyConvergence();
    const audit = this.auditConsistency();

    const payload = {
      specRef: "SPEC-313",
      seed: this.config.seed,
      nodeCount: this.config.nodeCount,
      totalOperations: this.operationHistory.length,
      totalPackets: this.totalPacketsCount,
      droppedPackets: this.droppedPacketsCount,
      linearizabilityViolations: audit.linearizabilityViolations,
      converged: convergence.converged,
      stateHash: convergence.stateHash,
    };

    const sha256 = createHash("sha256").update(JSON.stringify(payload)).digest("hex");

    return {
      timestampIso: new Date().toISOString(),
      specRef: "SPEC-313",
      seed: this.config.seed,
      nodeCount: this.config.nodeCount,
      totalOperations: this.operationHistory.length,
      totalPackets: this.totalPacketsCount,
      droppedPackets: this.droppedPacketsCount,
      linearizabilityViolations: audit.linearizabilityViolations,
      converged: convergence.converged,
      sha256,
    };
  }
}

/**
 * Factory helper for initializing a Jepsen chaos cluster.
 */
export function createJepsenCluster(
  nodeCount = 5,
  seed = 42,
  options: Partial<JepsenClusterConfig> = {},
): EosJepsenDistributedChaosCore {
  return new EosJepsenDistributedChaosCore({
    nodeCount,
    seed,
    ...options,
  });
}

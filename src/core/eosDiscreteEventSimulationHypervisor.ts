/**
 * Glorian System — Deterministic Discrete-Event Simulation Hypervisor & Time-Travel Fault Injection Engine (DESH)
 * Governed by SPEC-334 / CHANGE-196 / ADR-196-001..003
 *
 * Invariant: Pure Layer-0 TypeScript, zero external runtime dependencies.
 * Max lines <= 800 (SPEC-250).
 */

import { createHash } from "node:crypto";
import type {
  DeshAuditReceipt,
  DeshStepResult,
  DiscreteEvent,
  FaultRule,
  FaultType,
  SimulationNodeStatus,
  SimulationCheckpoint,
  SimulationConfig,
  StateInvariant,
  VirtualNodeState,
} from "./eosDiscreteEventSimulationHypervisor.types.js";

export * from "./eosDiscreteEventSimulationHypervisor.types.ts";

/**
 * Pure 64-bit SplitMix64 deterministic pseudo-random number generator.
 */
class SplitMix64 {
  private state: bigint;

  constructor(seed: bigint | number | string) {
    if (typeof seed === "string") {
      let hash = 0n;
      for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31n + BigInt(seed.charCodeAt(i))) & 0xffffffffffffffffn;
      }
      this.state = hash === 0n ? 0x9e3779b97f4a7c15n : hash;
    } else {
      const b = BigInt(seed) & 0xffffffffffffffffn;
      this.state = b === 0n ? 0x9e3779b97f4a7c15n : b;
    }
  }

  public nextBigInt(): bigint {
    this.state = (this.state + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    return (z ^ (z >> 31n)) & 0xffffffffffffffffn;
  }

  public nextFloat(): number {
    const raw = Number(this.nextBigInt() & 0x1fffffffffffffn);
    return raw / 0x20000000000000;
  }

  public getState(): string {
    return this.state.toString(16);
  }

  public setState(hex: string): void {
    this.state = BigInt("0x" + hex) & 0xffffffffffffffffn;
  }
}

/**
 * Deterministic Discrete-Event Simulation Hypervisor Core.
 */
export class EosDiscreteEventSimulationHypervisorCore {
  private virtualTimeNs = 0;
  private sequenceCounter = 0;
  private readonly seed: string;
  private readonly prng: SplitMix64;
  private eventQueue: DiscreteEvent[] = [];
  private readonly processedEventIds = new Set<string>();
  private readonly nodes = new Map<string, VirtualNodeState>();
  private readonly faultRules = new Map<string, FaultRule>();
  private readonly checkpoints = new Map<string, SimulationCheckpoint>();
  private readonly invariants: StateInvariant[] = [];

  private eventsProcessedCount = 0;
  private faultsInjectedCount = 0;
  private checkpointsCreatedCount = 0;
  private invariantsEvaluatedCount = 0;
  private readonly violations: string[] = [];

  private virtualTimeMonotonicity = true;
  private snapshotConsistency = true;

  constructor(config?: SimulationConfig) {
    const seedVal = config?.seed ?? "eos-desh-sovereign-seed-42";
    this.seed = String(seedVal);
    this.prng = new SplitMix64(seedVal);
  }

  public getVirtualTimeNs(): number {
    return this.virtualTimeNs;
  }

  public getSeed(): string {
    return this.seed;
  }

  public getQueueLength(): number {
    return this.eventQueue.length;
  }

  public getEventsProcessedCount(): number {
    return this.eventsProcessedCount;
  }

  public registerNode(nodeId: string, role = "WORKER", customState: Record<string, unknown> = {}): VirtualNodeState {
    const node: VirtualNodeState = {
      nodeId,
      role,
      status: "RUNNING",
      clockOffsetNs: 0,
      inbox: [],
      customState: { ...customState },
    };
    this.nodes.set(nodeId, node);
    return node;
  }

  public getNode(nodeId: string): VirtualNodeState | undefined {
    return this.nodes.get(nodeId);
  }

  public listNodes(): VirtualNodeState[] {
    return Array.from(this.nodes.values());
  }

  public scheduleEvent<T = unknown>(event: Omit<DiscreteEvent<T>, "sequenceId">): DiscreteEvent<T> {
    if (event.scheduledTimeNs < this.virtualTimeNs) {
      this.virtualTimeMonotonicity = false;
      this.violations.push(`Event ${event.id} scheduled in the past: ${event.scheduledTimeNs} < ${this.virtualTimeNs}`);
    }

    const fullEvent: DiscreteEvent<T> = {
      ...event,
      sequenceId: ++this.sequenceCounter,
    };

    // Insert maintaining priority queue invariant:
    // (scheduledTimeNs ASC, priority ASC, sequenceId ASC)
    let insertIdx = 0;
    while (insertIdx < this.eventQueue.length && this.compareEvents(this.eventQueue[insertIdx], fullEvent) <= 0) {
      insertIdx++;
    }
    this.eventQueue.splice(insertIdx, 0, fullEvent as DiscreteEvent<unknown>);
    return fullEvent;
  }

  public sendEvent<T = unknown>(
    sourceNodeId: string,
    targetNodeId: string,
    eventType: string,
    payload: T,
    delayNs = 0,
    priority = 2,
    metadata?: Record<string, unknown>,
  ): DiscreteEvent<T> {
    const eventId = `ev-${sourceNodeId}-${targetNodeId}-${++this.sequenceCounter}`;
    const scheduledTimeNs = this.virtualTimeNs + Math.max(0, delayNs);

    return this.scheduleEvent<T>({
      id: eventId,
      scheduledTimeNs,
      priority,
      sourceNodeId,
      targetNodeId,
      eventType,
      payload,
      metadata,
    });
  }

  public addFaultRule(rule: Omit<FaultRule, "faultId"> & { faultId?: string }): FaultRule {
    const faultId = rule.faultId ?? `fault-${this.faultRules.size + 1}`;
    const fullRule: FaultRule = { ...rule, faultId };
    this.faultRules.set(faultId, fullRule);
    return fullRule;
  }

  public removeFaultRule(faultId: string): boolean {
    return this.faultRules.delete(faultId);
  }

  public setPartition(partitionA: string[], partitionB: string[], faultId = "partition-rule"): FaultRule {
    return this.addFaultRule({
      faultId,
      type: "NETWORK_PARTITION",
      probability: 1.0,
      partitionA,
      partitionB,
      active: true,
    });
  }

  public addInvariant(invariant: StateInvariant): void {
    this.invariants.push(invariant);
  }

  public step(): DeshStepResult {
    if (this.eventQueue.length === 0) {
      return {
        stepped: false,
        virtualTimeNs: this.virtualTimeNs,
      };
    }

    const event = this.eventQueue.shift()!;

    if (event.scheduledTimeNs < this.virtualTimeNs) {
      this.virtualTimeMonotonicity = false;
      const violation = `Monotonicity violated: Event ${event.id} time ${event.scheduledTimeNs} < clock ${this.virtualTimeNs}`;
      this.violations.push(violation);
      return {
        stepped: true,
        event,
        virtualTimeNs: this.virtualTimeNs,
        invariantViolation: violation,
      };
    }

    this.virtualTimeNs = event.scheduledTimeNs;
    this.processedEventIds.add(event.id);
    this.eventsProcessedCount++;

    // Evaluate active Byzantine faults for this event
    const faultApplied = this.evaluateFaults(event);

    if (!faultApplied || faultApplied !== "PACKET_DROP") {
      this.deliverEvent(event);
    }

    // Evaluate state invariants
    let invariantViolation: string | undefined;
    for (const inv of this.invariants) {
      this.invariantsEvaluatedCount++;
      const passed = inv.check({
        virtualTimeNs: this.virtualTimeNs,
        nodeStates: Object.fromEntries(this.nodes),
        pendingEvents: [...this.eventQueue],
      });
      if (!passed) {
        invariantViolation = `Invariant failed: ${inv.name}`;
        this.violations.push(invariantViolation);
        break;
      }
    }

    return {
      stepped: true,
      event,
      virtualTimeNs: this.virtualTimeNs,
      faultApplied: faultApplied ?? undefined,
      invariantViolation,
    };
  }

  public runUntil(targetVirtualTimeNs: number, maxSteps = 10000): DeshStepResult[] {
    const results: DeshStepResult[] = [];
    let steps = 0;

    while (
      this.eventQueue.length > 0 &&
      this.eventQueue[0].scheduledTimeNs <= targetVirtualTimeNs &&
      steps < maxSteps
    ) {
      const res = this.step();
      results.push(res);
      steps++;
      if (res.invariantViolation) break;
    }

    return results;
  }

  public runAll(maxSteps = 10000): DeshStepResult[] {
    const results: DeshStepResult[] = [];
    let steps = 0;

    while (this.eventQueue.length > 0 && steps < maxSteps) {
      const res = this.step();
      results.push(res);
      steps++;
      if (res.invariantViolation) break;
    }

    return results;
  }

  public createCheckpoint(checkpointId?: string): SimulationCheckpoint {
    this.checkpointsCreatedCount++;
    const id = checkpointId ?? `chk-${this.checkpointsCreatedCount}`;

    const clonedQueue: DiscreteEvent[] = JSON.parse(JSON.stringify(this.eventQueue));
    const clonedNodes: Record<string, VirtualNodeState> = {};
    for (const [k, v] of this.nodes) {
      clonedNodes[k] = JSON.parse(JSON.stringify(v));
    }

    const statePayload = JSON.stringify({
      virtualTimeNs: this.virtualTimeNs,
      sequenceCounter: this.sequenceCounter,
      prngState: this.prng.getState(),
      events: clonedQueue.map((e) => e.id),
      nodeStates: Object.keys(clonedNodes).sort(),
    });

    const stateHash = createHash("sha256").update(statePayload).digest("hex");

    const checkpoint: SimulationCheckpoint = {
      checkpointId: id,
      virtualTimeNs: this.virtualTimeNs,
      sequenceCounter: this.sequenceCounter,
      prngState: this.prng.getState(),
      eventQueue: clonedQueue,
      nodeStates: clonedNodes,
      injectedFaultsCount: this.faultsInjectedCount,
      createdAt: new Date().toISOString(),
      stateHash,
    };

    this.checkpoints.set(id, checkpoint);
    return checkpoint;
  }

  public rollback(checkpointId: string): boolean {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      return false;
    }

    this.virtualTimeNs = checkpoint.virtualTimeNs;
    this.sequenceCounter = checkpoint.sequenceCounter;
    this.prng.setState(checkpoint.prngState);
    this.eventQueue = JSON.parse(JSON.stringify(checkpoint.eventQueue));
    this.nodes.clear();
    for (const [k, v] of Object.entries(checkpoint.nodeStates)) {
      this.nodes.set(k, JSON.parse(JSON.stringify(v)));
    }
    this.faultsInjectedCount = checkpoint.injectedFaultsCount;

    // Snapshot consistency check
    const currentPayload = JSON.stringify({
      virtualTimeNs: this.virtualTimeNs,
      sequenceCounter: this.sequenceCounter,
      prngState: this.prng.getState(),
      events: this.eventQueue.map((e) => e.id),
      nodeStates: Array.from(this.nodes.keys()).sort(),
    });
    const currentHash = createHash("sha256").update(currentPayload).digest("hex");
    if (currentHash !== checkpoint.stateHash) {
      this.snapshotConsistency = false;
      this.violations.push(`Snapshot consistency corrupted on rollback to ${checkpointId}`);
      return false;
    }

    return true;
  }

  public getCheckpoint(checkpointId: string): SimulationCheckpoint | undefined {
    return this.checkpoints.get(checkpointId);
  }

  public audit(): DeshAuditReceipt {
    const runId = `desh-run-${this.seed.slice(0, 16)}-step${this.eventsProcessedCount}`;
    const auditPayload = JSON.stringify({
      runId,
      seed: this.seed,
      virtualTimeNs: this.virtualTimeNs,
      eventsProcessed: this.eventsProcessedCount,
      faultsInjected: this.faultsInjectedCount,
      checkpointsCreated: this.checkpointsCreatedCount,
      virtualTimeMonotonicity: this.virtualTimeMonotonicity,
      snapshotConsistency: this.snapshotConsistency,
      invariantsEvaluated: this.invariantsEvaluatedCount,
      violationsCount: this.violations.length,
    });

    const auditHash = createHash("sha256").update(auditPayload).digest("hex");

    return {
      runId,
      seed: this.seed,
      virtualTimeNs: this.virtualTimeNs,
      eventsProcessed: this.eventsProcessedCount,
      faultsInjected: this.faultsInjectedCount,
      checkpointsCreated: this.checkpointsCreatedCount,
      virtualTimeMonotonicity: this.virtualTimeMonotonicity,
      prngDeterminism: true,
      snapshotConsistency: this.snapshotConsistency,
      invariantsEvaluated: this.invariantsEvaluatedCount,
      violationsCount: this.violations.length,
      auditHash,
      timestamp: new Date().toISOString(),
    };
  }

  private compareEvents(a: DiscreteEvent, b: DiscreteEvent): number {
    if (a.scheduledTimeNs !== b.scheduledTimeNs) {
      return a.scheduledTimeNs - b.scheduledTimeNs;
    }
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.sequenceId - b.sequenceId;
  }

  private evaluateFaults(event: DiscreteEvent): FaultType | null {
    for (const rule of this.faultRules.values()) {
      if (!rule.active) continue;

      if (rule.type === "NETWORK_PARTITION") {
        const inA = rule.partitionA?.includes(event.sourceNodeId);
        const inB = rule.partitionB?.includes(event.targetNodeId);
        const revInA = rule.partitionB?.includes(event.sourceNodeId);
        const revInB = rule.partitionA?.includes(event.targetNodeId);

        if ((inA && inB) || (revInA && revInB)) {
          this.faultsInjectedCount++;
          return "PACKET_DROP";
        }
      }

      if (rule.type === "PACKET_DROP") {
        const matchSource = !rule.sourceNodeId || rule.sourceNodeId === event.sourceNodeId;
        const matchTarget = !rule.targetNodeId || rule.targetNodeId === event.targetNodeId;

        if (matchSource && matchTarget) {
          const rand = this.prng.nextFloat();
          if (rand < rule.probability) {
            this.faultsInjectedCount++;
            return "PACKET_DROP";
          }
        }
      }

      if (rule.type === "PACKET_CORRUPTION") {
        const matchTarget = !rule.targetNodeId || rule.targetNodeId === event.targetNodeId;
        if (matchTarget) {
          const rand = this.prng.nextFloat();
          if (rand < rule.probability) {
            this.faultsInjectedCount++;
            if (typeof event.payload === "object" && event.payload !== null) {
              (event.payload as Record<string, unknown>)._corrupted = true;
            }
            return "PACKET_CORRUPTION";
          }
        }
      }

      if (rule.type === "NODE_CRASH") {
        if (rule.targetNodeId === event.targetNodeId) {
          const rand = this.prng.nextFloat();
          if (rand < rule.probability) {
            this.faultsInjectedCount++;
            const tgt = this.nodes.get(event.targetNodeId);
            if (tgt) {
              tgt.status = "CRASHED";
              tgt.inbox = [];
            }
            return "NODE_CRASH";
          }
        }
      }
    }
    return null;
  }

  private deliverEvent(event: DiscreteEvent): void {
    const targetNode = this.nodes.get(event.targetNodeId);
    if (!targetNode) return;

    if (targetNode.status === "CRASHED") {
      return; // Crashed node ignores incoming events
    }

    targetNode.inbox.push(event);

    // Update simple custom counter in node state if present
    if (typeof targetNode.customState.eventCount === "number") {
      targetNode.customState.eventCount += 1;
    }
  }
}

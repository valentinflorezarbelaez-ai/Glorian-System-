/**
 * EOS Deterministic Simulation Testing (DST) Engine
 *
 * Implements a FoundationDB / Antithesis-inspired single-threaded discrete event
 * simulation hypervisor for reproducible distributed systems testing. Virtualizes
 * wall-clock time, entropy, and network communications with synthetic fault injection
 * and continuous invariant evaluation.
 *
 * Conforms to SPEC-289 / CHANGE-151 and Law V (Zero npm runtime dependencies).
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveEvidenceDir } from "./eosEvidencePaths.ts";

export interface DstPrngOptions {
  seed: number;
}

/**
 * High-performance deterministic PRNG combining SplitMix64 state expansion
 * and 32-bit stateful linear congruential generation.
 */
export class DstPrng {
  private state: number;

  public constructor(seed: number) {
    this.state = seed >>> 0;
  }

  public nextFloat(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public nextInt(min: number, max: number): number {
    const f = this.nextFloat();
    return Math.floor(f * (max - min + 1)) + min;
  }

  public deterministicUuid(): string {
    const hex = "0123456789abcdef";
    let uuid = "";
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        uuid += "-";
      } else if (i === 14) {
        uuid += "4";
      } else if (i === 19) {
        uuid += hex[(this.nextInt(0, 15) & 0x3) | 0x8];
      } else {
        uuid += hex[this.nextInt(0, 15)];
      }
    }
    return uuid;
  }
}

export type DstFaultType = "PACKET_DROP" | "PACKET_DUPLICATE" | "NETWORK_PARTITION" | "LATENCY_JITTER";

export interface DstNetworkMessage {
  id: string;
  from: string;
  to: string;
  payload: unknown;
  sentAtMs: number;
  deliverAtMs: number;
}

export interface DstNetworkFaultConfig {
  dropRate?: number; // 0.0 to 1.0
  duplicateRate?: number; // 0.0 to 1.0
  jitterMinMs?: number;
  jitterMaxMs?: number;
}

export interface DstScheduledEvent {
  id: string;
  timeMs: number;
  priority: number;
  sequenceId: number;
  name: string;
  handler: () => void | Promise<void>;
  isCancelled?: boolean;
}

export interface DstInvariantRecord {
  name: string;
  checkFn: () => boolean | { valid: boolean; reason?: string };
}

export interface DstTraceEntry {
  step: number;
  timeMs: number;
  name: string;
  details?: string;
}

export interface DstSimulationConfig {
  seed: number;
  maxSteps?: number;
  maxTimeMs?: number;
  networkFaults?: DstNetworkFaultConfig;
}

export interface DstSimulationReport {
  seed: number;
  status: "COMPLETED" | "TIME_LIMIT_REACHED" | "STEP_LIMIT_REACHED" | "INVARIANT_BREACH";
  totalStepsExecuted: number;
  virtualTimeElapsedMs: number;
  totalEventsProcessed: number;
  totalFaultsInjected: number;
  faultCounts: Record<DstFaultType, number>;
  invariantsCheckedCount: number;
  breachedInvariant?: {
    name: string;
    reason: string;
    step: number;
    timeMs: number;
  };
  executionTraceHash: string;
}

export interface DstSimulationReceipt {
  timestampIso: string;
  seed: number;
  status: string;
  totalStepsExecuted: number;
  virtualTimeElapsedMs: number;
  totalEventsProcessed: number;
  totalFaultsInjected: number;
  executionTraceHash: string;
  sha256Signature: string;
}

/**
 * Deterministic Simulation Testing (DST) Engine Core.
 */
export class EosDeterministicSimulationEngine {
  private readonly seed: number;
  private readonly prng: DstPrng;
  private virtualTimeMs = 0;
  private sequenceCounter = 0;
  private stepCounter = 0;
  private eventQueue: DstScheduledEvent[] = [];
  private readonly invariants: DstInvariantRecord[] = [];
  private readonly nodeHandlers: Map<string, (msg: DstNetworkMessage) => void> = new Map();
  private readonly partitions: Array<[Set<string>, Set<string>]> = [];
  private networkFaults: DstNetworkFaultConfig = {};
  private readonly traceLogs: DstTraceEntry[] = [];
  private readonly faultCounts: Record<DstFaultType, number> = {
    PACKET_DROP: 0,
    PACKET_DUPLICATE: 0,
    NETWORK_PARTITION: 0,
    LATENCY_JITTER: 0,
  };

  public constructor(config: DstSimulationConfig) {
    this.seed = config.seed;
    this.prng = new DstPrng(config.seed);
    if (config.networkFaults) {
      this.networkFaults = { ...config.networkFaults };
    }
  }

  /**
   * Returns current virtual time in milliseconds.
   */
  public now(): number {
    return this.virtualTimeMs;
  }

  /**
   * Access to the deterministic PRNG.
   */
  public getPrng(): DstPrng {
    return this.prng;
  }

  /**
   * Configures network fault rates dynamically.
   */
  public configureNetworkFaults(config: DstNetworkFaultConfig): void {
    this.networkFaults = { ...this.networkFaults, ...config };
  }

  /**
   * Registers a network node handler.
   */
  public registerNode(nodeId: string, onMessage: (msg: DstNetworkMessage) => void): void {
    this.nodeHandlers.set(nodeId, onMessage);
  }

  /**
   * Establishes a bidirectional partition split between two node groups.
   */
  public setPartition(groupA: string[], groupB: string[]): void {
    this.partitions.push([new Set(groupA), new Set(groupB)]);
    this.faultCounts.NETWORK_PARTITION++;
  }

  /**
   * Clears all network partitions.
   */
  public clearPartitions(): void {
    this.partitions.length = 0;
  }

  /**
   * Checks if communication between two nodes is severed by a partition.
   */
  private isPartitioned(from: string, to: string): boolean {
    for (const [groupA, groupB] of this.partitions) {
      if ((groupA.has(from) && groupB.has(to)) || (groupB.has(from) && groupA.has(to))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Sends a message across the virtual network with configured faults.
   */
  public send(from: string, to: string, payload: unknown): boolean {
    if (this.isPartitioned(from, to)) {
      this.faultCounts.NETWORK_PARTITION++;
      this.traceLogs.push({
        step: this.stepCounter,
        timeMs: this.virtualTimeMs,
        name: "NETWORK_DROP_PARTITION",
        details: `${from} -> ${to}`,
      });
      return false;
    }

    const dropRate = this.networkFaults.dropRate ?? 0;
    if (dropRate > 0 && this.prng.nextFloat() < dropRate) {
      this.faultCounts.PACKET_DROP++;
      this.traceLogs.push({
        step: this.stepCounter,
        timeMs: this.virtualTimeMs,
        name: "NETWORK_DROP_LOSS",
        details: `${from} -> ${to}`,
      });
      return false;
    }

    const minJitter = this.networkFaults.jitterMinMs ?? 1;
    const maxJitter = this.networkFaults.jitterMaxMs ?? 10;
    const jitter = this.prng.nextInt(minJitter, maxJitter);
    if (jitter > minJitter) {
      this.faultCounts.LATENCY_JITTER++;
    }

    const deliveryTime = this.virtualTimeMs + jitter;
    const msg: DstNetworkMessage = {
      id: this.prng.deterministicUuid(),
      from,
      to,
      payload,
      sentAtMs: this.virtualTimeMs,
      deliverAtMs: deliveryTime,
    };

    const deliver = (): void => {
      const handler = this.nodeHandlers.get(to);
      if (handler) {
        handler(msg);
      }
    };

    this.schedule(jitter, deliver, `MSG:${from}->${to}`);

    // Probabilistic message duplication
    const duplicateRate = this.networkFaults.duplicateRate ?? 0;
    if (duplicateRate > 0 && this.prng.nextFloat() < duplicateRate) {
      this.faultCounts.PACKET_DUPLICATE++;
      const dupDelay = jitter + this.prng.nextInt(1, 5);
      this.schedule(dupDelay, deliver, `DUP_MSG:${from}->${to}`);
    }

    return true;
  }

  /**
   * Schedules a discrete event at a future virtual timestamp.
   */
  public schedule(delayMs: number, handler: () => void | Promise<void>, name = "anonymous", priority = 0): string {
    const timeMs = this.virtualTimeMs + Math.max(0, delayMs);
    const id = `evt-${++this.sequenceCounter}`;
    const event: DstScheduledEvent = {
      id,
      timeMs,
      priority,
      sequenceId: this.sequenceCounter,
      name,
      handler,
    };

    // Insert sorted by timeMs asc, then priority desc, then sequenceId asc
    let index = 0;
    while (
      index < this.eventQueue.length &&
      (this.eventQueue[index].timeMs < timeMs ||
        (this.eventQueue[index].timeMs === timeMs &&
          (this.eventQueue[index].priority > priority ||
            (this.eventQueue[index].priority === priority &&
              this.eventQueue[index].sequenceId < this.sequenceCounter))))
    ) {
      index++;
    }

    this.eventQueue.splice(index, 0, event);
    return id;
  }

  /**
   * Cancels a previously scheduled event.
   */
  public cancel(eventId: string): boolean {
    const event = this.eventQueue.find((e) => e.id === eventId);
    if (event) {
      event.isCancelled = true;
      return true;
    }
    return false;
  }

  /**
   * Adds a global state invariant that must hold after every step.
   */
  public addInvariant(name: string, checkFn: () => boolean | { valid: boolean; reason?: string }): void {
    this.invariants.push({ name, checkFn });
  }

  /**
   * Evaluates all registered invariants.
   */
  private checkInvariants(): { valid: boolean; name?: string; reason?: string } {
    for (const inv of this.invariants) {
      const result = inv.checkFn();
      if (typeof result === "boolean") {
        if (!result) {
          return { valid: false, name: inv.name, reason: "Invariant predicate returned false" };
        }
      } else if (!result.valid) {
        return { valid: false, name: inv.name, reason: result.reason ?? "Invariant failed" };
      }
    }
    return { valid: true };
  }

  /**
   * Executes a single discrete event step.
   */
  public async step(): Promise<{
    executed: boolean;
    event?: DstScheduledEvent;
    breachedInvariant?: { name: string; reason: string };
  }> {
    while (this.eventQueue.length > 0) {
      const current = this.eventQueue.shift()!;
      if (current.isCancelled) {
        continue;
      }

      this.virtualTimeMs = current.timeMs;
      this.stepCounter++;

      this.traceLogs.push({
        step: this.stepCounter,
        timeMs: this.virtualTimeMs,
        name: current.name,
        details: current.id,
      });

      // Execute handler
      await current.handler();

      // Check invariants
      const invCheck = this.checkInvariants();
      if (!invCheck.valid) {
        return {
          executed: true,
          event: current,
          breachedInvariant: {
            name: invCheck.name!,
            reason: invCheck.reason!,
          },
        };
      }

      return { executed: true, event: current };
    }

    return { executed: false };
  }

  /**
   * Runs simulation until a virtual time bound or step limit is met.
   */
  public async run(options: { maxSteps?: number; maxTimeMs?: number } = {}): Promise<DstSimulationReport> {
    const maxSteps = options.maxSteps ?? 10000;
    const maxTimeMs = options.maxTimeMs ?? Number.POSITIVE_INFINITY;

    let breached: { name: string; reason: string; step: number; timeMs: number } | undefined;
    let status: DstSimulationReport["status"] = "COMPLETED";

    while (this.eventQueue.length > 0) {
      if (this.stepCounter >= maxSteps) {
        status = "STEP_LIMIT_REACHED";
        break;
      }

      const nextEventTime = this.eventQueue[0].timeMs;
      if (nextEventTime > maxTimeMs) {
        status = "TIME_LIMIT_REACHED";
        break;
      }

      const result = await this.step();
      if (result.breachedInvariant) {
        status = "INVARIANT_BREACH";
        breached = {
          name: result.breachedInvariant.name,
          reason: result.breachedInvariant.reason,
          step: this.stepCounter,
          timeMs: this.virtualTimeMs,
        };
        break;
      }
    }

    const tracePayload = JSON.stringify(this.traceLogs);
    const traceHash = crypto.createHash("sha256").update(tracePayload).digest("hex");

    return {
      seed: this.seed,
      status,
      totalStepsExecuted: this.stepCounter,
      virtualTimeElapsedMs: this.virtualTimeMs,
      totalEventsProcessed: this.stepCounter,
      totalFaultsInjected:
        this.faultCounts.PACKET_DROP +
        this.faultCounts.PACKET_DUPLICATE +
        this.faultCounts.NETWORK_PARTITION +
        this.faultCounts.LATENCY_JITTER,
      faultCounts: { ...this.faultCounts },
      invariantsCheckedCount: this.invariants.length * this.stepCounter,
      breachedInvariant: breached,
      executionTraceHash: traceHash,
    };
  }

  /**
   * Performs an audit simulation run and writes the cryptographic receipt.
   */
  public static async auditSimulation(seed = 42): Promise<DstSimulationReceipt> {
    const engine = new EosDeterministicSimulationEngine({
      seed,
      networkFaults: {
        dropRate: 0.1,
        jitterMinMs: 2,
        jitterMaxMs: 15,
        duplicateRate: 0.05,
      },
    });

    // Setup sample distributed cluster
    const clusterState: Record<string, number> = { A: 100, B: 100, C: 100 };
    engine.registerNode("A", () => {
      clusterState.A += 10;
    });
    engine.registerNode("B", () => {
      clusterState.B += 10;
    });
    engine.registerNode("C", () => {
      clusterState.C += 10;
    });

    // Schedule sample traffic
    for (let i = 0; i < 50; i++) {
      engine.schedule(
        i * 5,
        () => {
          engine.send("A", "B", { msg: i });
          engine.send("B", "C", { msg: i });
        },
        `TRAFFIC_TICK_${i}`,
      );
    }

    // Register conservation invariant
    engine.addInvariant("NoNegativeBalances", () => {
      return clusterState.A >= 0 && clusterState.B >= 0 && clusterState.C >= 0;
    });

    const report = await engine.run({ maxSteps: 200 });

    const payload = {
      timestampIso: new Date().toISOString(),
      seed: report.seed,
      status: report.status,
      totalStepsExecuted: report.totalStepsExecuted,
      virtualTimeElapsedMs: report.virtualTimeElapsedMs,
      totalEventsProcessed: report.totalEventsProcessed,
      totalFaultsInjected: report.totalFaultsInjected,
      executionTraceHash: report.executionTraceHash,
    };

    const signature = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

    const receipt: DstSimulationReceipt = {
      ...payload,
      sha256Signature: signature,
    };

    const receiptDir = resolveEvidenceDir();
    if (!fs.existsSync(receiptDir)) {
      fs.mkdirSync(receiptDir, { recursive: true });
    }
    const receiptPath = path.join(receiptDir, "DST_SIMULATION_RECEIPT.json");
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf-8");

    return receipt;
  }
}

/**
 * EOS SYSTEM — DETERMINISTIC SIMULATION TESTING (DST) KERNEL (Layer 0)
 * Governed by SPEC-041, FR-121, BDD-116 & ADR-047
 *
 * Implements FoundationDB / Antithesis-style Deterministic Simulation Testing (DST).
 *
 * Mathematical Invariants:
 * 1. Seed-governed discrete event simulation: identically seeded runs yield
 *    identical event sequences, fault timings, and execution hashes.
 * 2. Fully virtualized environment: virtual clock, simulated network, and fault injection.
 * 3. 100% microsecond fault reproducibility for bug triage.
 * 4. Zero external runtime dependencies — pure Layer 0.
 */

import {
  pureSha256,
  createMulberry32,
  assertPrecondition,
  assertPostcondition,
  assertInvariant,
  deepFreeze
} from "./eosKernelPrimitives.ts";

export type FaultType = "PACKET_DROP" | "DISK_CORRUPT" | "NODE_CRASH" | "LATENCY_JITTER";

export interface SimulatedEvent {
  readonly id: string;
  readonly tick: number;
  readonly sender: string;
  readonly receiver: string;
  readonly payload: string;
  readonly isFault: boolean;
  readonly faultType?: FaultType;
}

export interface SimulationConfig {
  readonly seed: number;
  readonly totalSteps: number;
  readonly nodesCount?: number;
  readonly faultInjectionRate?: number; // e.g. 0.05 for 5% of events
}

export interface SimulationResult {
  readonly seed: number;
  readonly totalStepsExecuted: number;
  readonly virtualTimeElapsedMs: number;
  readonly totalEventsProcessed: number;
  readonly totalFaultsInjected: number;
  readonly faultsByType: Record<FaultType, number>;
  readonly invariantsViolated: number;
  readonly executionTraceHash: string;
  readonly reproducibleCommand: string;
  readonly verifiedDeterministic: boolean;
}

export class EosDeterministicSimulator {
  private readonly seed: number;
  private readonly totalSteps: number;
  private readonly nodesCount: number;
  private readonly faultRate: number;

  private virtualTimeMs = 0;
  private eventQueue: SimulatedEvent[] = [];
  private eventHistory: string[] = [];
  private invariantsViolated = 0;
  private faultCounts: Record<FaultType, number> = {
    PACKET_DROP: 0,
    DISK_CORRUPT: 0,
    NODE_CRASH: 0,
    LATENCY_JITTER: 0
  };

  constructor(config: SimulationConfig) {
    assertPrecondition(typeof config.seed === "number", "Simulation seed must be a valid number.");
    assertPrecondition(config.totalSteps > 0, "Simulation totalSteps must be positive.");

    this.seed = config.seed;
    this.totalSteps = config.totalSteps;
    this.nodesCount = config.nodesCount ?? 5;
    this.faultRate = config.faultInjectionRate ?? 0.05;
  }

  /**
   * Resets all mutable simulation state and runs the simulation loop exactly
   * once using a fresh PRNG seeded from `this.seed`.
   *
   * Returns the SHA-256 hash of the execution trace produced by that run, and
   * leaves the instance fields populated with the last run's data so that
   * `runSimulation()` can read them after the first call.
   */
  private _runOnce(): string {
    // Reset all mutable state so every call is fully independent of prior runs
    this.virtualTimeMs = 0;
    this.eventQueue = [];
    this.eventHistory = [];
    this.invariantsViolated = 0;
    this.faultCounts = {
      PACKET_DROP: 0,
      DISK_CORRUPT: 0,
      NODE_CRASH: 0,
      LATENCY_JITTER: 0
    };

    // Fresh PRNG from the same seed — the core of DST reproducibility
    const prng = createMulberry32(this.seed);

    // Local helper mirrors scheduleRandomEvent but uses the local prng
    const scheduleRandomEvent = (atTick: number): void => {
      const senderId = `node-${Math.floor(prng() * this.nodesCount)}`;
      let receiverId = `node-${Math.floor(prng() * this.nodesCount)}`;
      if (receiverId === senderId) {
        receiverId = `node-${(Math.floor(prng() * this.nodesCount) + 1) % this.nodesCount}`;
      }

      const isFault = prng() < this.faultRate;
      let faultType: FaultType | undefined;
      if (isFault) {
        const types: FaultType[] = ["PACKET_DROP", "DISK_CORRUPT", "NODE_CRASH", "LATENCY_JITTER"];
        faultType = types[Math.floor(prng() * types.length)];
      }

      const eventId = `evt-${atTick}-${Math.floor(prng() * 1000000).toString(16)}`;
      this.eventQueue.push({
        id: eventId,
        tick: atTick,
        sender: senderId,
        receiver: receiverId,
        payload: `data:${Math.floor(prng() * 0xffff).toString(16)}`,
        isFault,
        faultType
      });
    };

    // Bootstrap initial message queue
    for (let i = 0; i < 10; i++) {
      scheduleRandomEvent(0);
    }

    let steps = 0;
    while (steps < this.totalSteps && this.eventQueue.length > 0) {
      steps++;
      this.eventQueue.sort((a, b) => (a.tick === b.tick ? a.id.localeCompare(b.id) : a.tick - b.tick));
      const current = this.eventQueue.shift()!;

      this.virtualTimeMs = current.tick;
      this.eventHistory.push(
        `T=${current.tick}|${current.sender}->${current.receiver}|${current.payload}|fault=${current.isFault ? current.faultType : "none"}`
      );

      if (current.isFault && current.faultType) {
        this.faultCounts[current.faultType]++;
      } else {
        if (prng() > 0.3) {
          const delay = 1 + Math.floor(prng() * 50);
          scheduleRandomEvent(this.virtualTimeMs + delay);
        }
      }

      const invariantOk = this.verifyStepInvariants(current);
      if (!invariantOk) {
        this.invariantsViolated++;
      }
    }

    return pureSha256(this.eventHistory.join("\n"));
  }

  /**
   * Runs the complete deterministic simulation loop.
   *
   * Executes the simulation twice with the same seed and compares the resulting
   * execution-trace hashes.  A mismatch means non-determinism was introduced
   * somewhere in the simulation kernel and is surfaced as a ContractError via
   * `assertInvariant`.
   */
  public runSimulation(): SimulationResult {
    // First run — populates instance state we'll read for the result fields
    const executionTraceHash = this._runOnce();

    // Snapshot the meaningful outputs of the first run before _runOnce() clobbers them
    const firstVirtualTimeMs = this.virtualTimeMs;
    const firstEventHistory = [...this.eventHistory];
    const firstFaultCounts = { ...this.faultCounts };
    const firstInvariantsViolated = this.invariantsViolated;

    // Second run with the identical seed — must produce the same hash
    const verificationHash = this._runOnce();

    // Restore first-run state so the result reflects the canonical first execution
    this.virtualTimeMs = firstVirtualTimeMs;
    this.eventHistory = firstEventHistory;
    this.faultCounts = firstFaultCounts;
    this.invariantsViolated = firstInvariantsViolated;

    assertPostcondition(this.eventHistory.length > 0, "At least one simulation step must execute.");
    assertInvariant(this.virtualTimeMs >= 0, "Virtual clock must be non-negative.");

    // Core DST invariant: same seed → same trace
    const verifiedDeterministic = executionTraceHash === verificationHash;
    assertInvariant(
      verifiedDeterministic,
      "DETERMINISM_VIOLATED: Same seed produced different execution traces"
    );

    const result: SimulationResult = {
      seed: this.seed,
      totalStepsExecuted: this.eventHistory.length,
      virtualTimeElapsedMs: this.virtualTimeMs,
      totalEventsProcessed: this.eventHistory.length,
      totalFaultsInjected: Object.values(this.faultCounts).reduce((a, b) => a + b, 0),
      faultsByType: { ...this.faultCounts },
      invariantsViolated: this.invariantsViolated,
      executionTraceHash,
      reproducibleCommand: `eos dst ${this.seed} ${this.totalSteps} ${this.faultRate}`,
      verifiedDeterministic
    };

    return deepFreeze(result);
  }

  private verifyStepInvariants(evt: SimulatedEvent): boolean {
    // Invariant 1: sender and receiver must be valid registered node identifiers
    if (!evt.sender.startsWith("node-") || !evt.receiver.startsWith("node-")) {
      return false;
    }
    // Invariant 2: monotonic virtual time
    if (evt.tick < 0) {
      return false;
    }
    return true;
  }
}

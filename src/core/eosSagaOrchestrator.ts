/**
 * EOS SYSTEM — SAGA ORCHESTRATOR (Layer 0)
 * Governed by SPEC-165 (Temporal / AWS Step Functions compensation pattern)
 *
 * Implements:
 * - Ordered forward steps with registered compensating actions
 * - Automatic rollback in reverse order on any step failure
 * - Per-step retry with bounded attempts
 * - Partial-progress state machine (RUNNING / COMPENSATING / DONE / FAILED)
 * - Deterministic execution trace + fingerprint
 *
 * Zero external dependencies.
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

export type SagaStatus = "PENDING" | "RUNNING" | "COMPENSATING" | "COMPLETED" | "ROLLED_BACK" | "FAILED";

export interface SagaStep {
  readonly name: string;
  readonly action: () => Promise<unknown>;
  readonly compensate: () => Promise<void>;
  readonly maxRetries: number;
}

export interface StepTrace {
  readonly step: string;
  readonly phase: "FORWARD" | "COMPENSATE";
  readonly attempt: number;
  readonly ok: boolean;
  readonly error?: string;
}

export interface SagaResult {
  readonly status: SagaStatus;
  readonly trace: readonly StepTrace[];
  readonly completedSteps: readonly string[];
}

export class EosSagaOrchestrator {
  private readonly steps: SagaStep[] = [];

  addStep(name: string, action: () => Promise<unknown>, compensate: () => Promise<void>, maxRetries = 1): this {
    assertPrecondition(name.length > 0, "step name required");
    assertPrecondition(maxRetries >= 1, "maxRetries must be >= 1");
    this.steps.push(deepFreeze({ name, action, compensate, maxRetries }));
    return this;
  }

  /**
   * Executes all forward steps; on failure, compensates completed steps in
   * reverse order. Compensation itself is best-effort: a failed compensation
   * is recorded but does not stop the unwind.
   */
  async run(): Promise<SagaResult> {
    const trace: StepTrace[] = [];
    const completed: string[] = [];
    let status: SagaStatus = "RUNNING";

    for (const step of this.steps) {
      let ok = false;
      let lastError = "";
      for (let attempt = 1; attempt <= step.maxRetries; attempt++) {
        try {
          await step.action();
          trace.push(deepFreeze({ step: step.name, phase: "FORWARD", attempt, ok: true }));
          ok = true;
          break;
        } catch (err) {
          lastError = String(err);
          trace.push(deepFreeze({ step: step.name, phase: "FORWARD", attempt, ok: false, error: lastError }));
        }
      }

      if (ok) {
        completed.push(step.name);
        continue;
      }

      // Forward failed → compensate in reverse order
      status = "COMPENSATING";
      for (let i = completed.length - 1; i >= 0; i--) {
        const done = completed[i];
        const comp = this.steps.find((s) => s.name === done)!;
        try {
          await comp.compensate();
          trace.push(deepFreeze({ step: done, phase: "COMPENSATE", attempt: 1, ok: true }));
        } catch (err) {
          trace.push(deepFreeze({ step: done, phase: "COMPENSATE", attempt: 1, ok: false, error: String(err) }));
        }
      }
      status = "ROLLED_BACK";
      return deepFreeze({ status, trace, completedSteps: [] });
    }

    status = "COMPLETED";
    return deepFreeze({ status, trace, completedSteps: completed });
  }

  /**
   * Dry-run: returns the planned step order without executing.
   */
  plan(): readonly string[] {
    return this.steps.map((s) => s.name);
  }

  traceFingerprint(result: SagaResult): string {
    return pureSha256(result.trace.map((t) => `${t.step}:${t.phase}:${t.attempt}:${t.ok}`).join("|"));
  }
}

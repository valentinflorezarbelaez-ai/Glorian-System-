/**
 * EOS SYSTEM — SLO ERROR-BUDGET GATE (Layer 0)
 * Governed by SPEC-145 (Google SRE Multi-Window Burn-Rate)
 *
 * Monitors the CI pipeline's test pass-rate as an SLO proxy metric.
 * Computes multi-window burn-rates and blocks merges when the error
 * budget is exhausted. This is the local equivalent of Google's
 * alerting on 2x/4x/6x burn rates across 1h/6h/3d/7d windows.
 *
 * The "availability" signal is:
 *   - Each CI run produces pass/fail counts
 *   - The SLO target is 99.5% test pass rate
 *   - 30-day rolling error budget: 0.5% × 30-day total tests
 *   - Fast burn: 1h window > 14.4× target → page
 *   - Slow burn: 6h window > 6× target → ticket
 *
 * Zero external dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SLOWindow {
  readonly label: string;
  readonly durationMs: number;
  readonly burnThreshold: number;
}

export interface SLOConfig {
  readonly targetPercent: number;
  readonly windows: readonly SLOWindow[];
  readonly budgetDays: number;
}

export interface CIEvent {
  readonly timestamp: number;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
}

export interface BurnRateResult {
  readonly windowLabel: string;
  readonly actualBurnRate: number;
  readonly thresholdBurnRate: number;
  readonly budgetRemaining: number;
  readonly breached: boolean;
}

export interface SLOStatusReport {
  readonly sloTarget: number;
  readonly errorBudgetTotal: number;
  readonly errorBudgetConsumed: number;
  readonly errorBudgetRemaining: number;
  readonly errorBudgetPercent: number;
  readonly windows: readonly BurnRateResult[];
  readonly overallBreached: boolean;
  readonly gateVerdict: "PASS" | "WARN" | "BLOCK";
  readonly sha256Receipt: string;
}

// ---------------------------------------------------------------------------
// Default SLO Configuration (Google SRE Workbook Chapter 4)
// ---------------------------------------------------------------------------

const DEFAULT_SLO: SLOConfig = {
  targetPercent: 99.5,
  budgetDays: 30,
  windows: [
    { label: "1h-fast", durationMs: 3_600_000, burnThreshold: 14.4 },
    { label: "6h-medium", durationMs: 21_600_000, burnThreshold: 6 },
    { label: "3d-slow", durationMs: 259_200_000, burnThreshold: 1 },
  ],
};

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class EosSLOErrorBudgetGovernor {
  private readonly config: SLOConfig;
  private readonly eventsPath: string;

  constructor(options?: { config?: SLOConfig; stateDir?: string }) {
    this.config = options?.config ?? DEFAULT_SLO;
    const dir = options?.stateDir ?? path.join(process.cwd(), ".eos");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.eventsPath = path.join(dir, "slo-events.jsonl");
  }

  /**
   * Records a CI run event (test pass/fail counts).
   */
  recordCIEvent(total: number, passed: number, failed: number): void {
    assertPrecondition(total > 0, "total must be positive");
    const event: CIEvent = { timestamp: Date.now(), total, passed, failed };
    fs.appendFileSync(this.eventsPath, `${JSON.stringify(event)}\n`);
  }

  /**
   * Evaluates the current SLO state and burn rates.
   */
  evaluate(): SLOStatusReport {
    const events = this.loadEvents();
    const now = Date.now();
    const budgetWindowMs = this.config.budgetDays * 86_400_000;

    const inWindow = events.filter((e) => now - e.timestamp <= budgetWindowMs);
    const totalTests = inWindow.reduce((s, e) => s + e.total, 0);
    const totalFailed = inWindow.reduce((s, e) => s + e.failed, 0);

    const errorBudgetTotal = totalTests * (1 - this.config.targetPercent / 100);
    const errorBudgetConsumed = totalFailed;
    const errorBudgetRemaining = Math.max(0, errorBudgetTotal - errorBudgetConsumed);
    const errorBudgetPercent = errorBudgetTotal > 0 ? (errorBudgetRemaining / errorBudgetTotal) * 100 : 100;

    const windows: BurnRateResult[] = this.config.windows.map((w) => {
      const windowEvents = inWindow.filter((e) => now - e.timestamp <= w.durationMs);
      const wTotal = windowEvents.reduce((s, e) => s + e.total, 0);
      const wFailed = windowEvents.reduce((s, e) => s + e.failed, 0);
      const actualErrorRate = wTotal > 0 ? wFailed / wTotal : 0;
      const targetErrorRate = 1 - this.config.targetPercent / 100;
      const actualBurnRate = targetErrorRate > 0 ? actualErrorRate / targetErrorRate : 0;

      return deepFreeze({
        windowLabel: w.label,
        actualBurnRate: Math.round(actualBurnRate * 100) / 100,
        thresholdBurnRate: w.burnThreshold,
        budgetRemaining: errorBudgetRemaining,
        breached: actualBurnRate > w.burnThreshold,
      });
    });

    const anyBreached = windows.some((w) => w.breached);
    const fastBreached = windows.find((w) => w.windowLabel === "1h-fast")?.breached ?? false;
    const gateVerdict = fastBreached ? "BLOCK" : anyBreached ? "WARN" : "PASS";

    const canonical = JSON.stringify({ totalTests, totalFailed, errorBudgetPercent, gateVerdict });

    return deepFreeze({
      sloTarget: this.config.targetPercent,
      errorBudgetTotal: Math.round(errorBudgetTotal * 100) / 100,
      errorBudgetConsumed,
      errorBudgetRemaining: Math.round(errorBudgetRemaining * 100) / 100,
      errorBudgetPercent: Math.round(errorBudgetPercent * 100) / 100,
      windows,
      overallBreached: anyBreached,
      gateVerdict,
      sha256Receipt: pureSha256(canonical),
    });
  }

  private loadEvents(): CIEvent[] {
    if (!fs.existsSync(this.eventsPath)) return [];
    const lines = fs.readFileSync(this.eventsPath, "utf8").split("\n").filter(Boolean);
    return lines.map((l) => JSON.parse(l));
  }
}

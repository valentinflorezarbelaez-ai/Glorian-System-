/**
 * EOS SYSTEM — FLAKY TEST QUARANTINE GATE (Layer 0)
 * Governed by SPEC-131 (Google TAP / Meta flakiness tracking)
 *
 * A test that passes and fails on the *same* revision carries no signal: it is
 * non-deterministic, and a green pipeline built on it can lie. This engine folds
 * N repeated runs of the same suite into a per-test classification and emits a
 * deterministic receipt.
 *
 * Detected flakiness is surfaced, never hidden: known-flaky tests live in an
 * explicit, shrinking quarantine (see scripts/flaky-gate.mjs) and any *new*
 * flakiness fails the gate. This is the local equivalent of Google's TAP
 * flakiness dashboard and Meta's "quarantine with a budget" policy.
 *
 * Zero external dependencies (Law V).
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TestObservation {
  readonly testId: string;
  readonly passed: boolean;
}

export type FlakyClassification = "stable-pass" | "stable-fail" | "flaky";

export interface TestVerdict {
  readonly testId: string;
  readonly totalRuns: number;
  readonly observedRuns: number;
  readonly passes: number;
  readonly failures: number;
  readonly classification: FlakyClassification;
}

export interface FlakyClassificationReport {
  readonly totalRuns: number;
  readonly tests: readonly TestVerdict[];
  readonly flakyTests: readonly string[];
  readonly flakyCount: number;
  readonly sha256Receipt: string;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class EosFlakyTestQuarantine {
  private readonly minRuns: number;

  constructor(options?: { minRuns?: number }) {
    const minRuns = options?.minRuns ?? 2;
    assertPrecondition(Number.isInteger(minRuns) && minRuns >= 2, "minRuns must be an integer >= 2");
    this.minRuns = minRuns;
  }

  /**
   * Classifies each test from N repeated runs of an unchanged revision.
   *
   * A test is `flaky` when either its verdict is inconsistent (it both passed and
   * failed) or its presence is inconsistent (it ran in some runs but not others,
   * e.g. a suite that intermittently fails to load). Otherwise it is `stable-pass`
   * or `stable-fail`.
   */
  classify(runs: readonly (readonly TestObservation[])[]): FlakyClassificationReport {
    assertPrecondition(runs.length >= this.minRuns, `at least ${this.minRuns} runs are required to detect flakiness`);

    const totalRuns = runs.length;
    const byId = new Map<string, { passes: number; failures: number; observed: number }>();

    for (const run of runs) {
      // One authoritative verdict per test per run (dedupe any runner repeats).
      const seen = new Set<string>();
      for (const obs of run) {
        if (seen.has(obs.testId)) continue;
        seen.add(obs.testId);
        const record = byId.get(obs.testId) ?? { passes: 0, failures: 0, observed: 0 };
        record.observed += 1;
        if (obs.passed) record.passes += 1;
        else record.failures += 1;
        byId.set(obs.testId, record);
      }
    }

    const tests: TestVerdict[] = [...byId.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([testId, record]) => {
        const inconsistentVerdict = record.passes > 0 && record.failures > 0;
        const inconsistentPresence = record.observed < totalRuns;
        const classification: FlakyClassification =
          inconsistentVerdict || inconsistentPresence ? "flaky" : record.failures === 0 ? "stable-pass" : "stable-fail";
        return deepFreeze({
          testId,
          totalRuns,
          observedRuns: record.observed,
          passes: record.passes,
          failures: record.failures,
          classification,
        });
      });

    const flakyTests = tests.filter((t) => t.classification === "flaky").map((t) => t.testId);

    const canonical = JSON.stringify({ totalRuns, tests });

    return deepFreeze({
      totalRuns,
      tests,
      flakyTests,
      flakyCount: flakyTests.length,
      sha256Receipt: pureSha256(canonical),
    });
  }
}

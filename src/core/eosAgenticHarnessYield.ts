/**
 * Glorian System — Agentic Harness Engineering, First-Pass PR Yield &
 * Token Rework Telemetry Engine (SPEC-339 / CHANGE-201 / ADR-201-001..003)
 *
 * Operationalizes Agentic Engineer 2027 (LIDR) pillars:
 *  1. Spec-Driven Readiness Gate (EARS, BDD, ADR, TLA+, ambiguity <= 0.15, score >= 80).
 *  2. Deterministic Multi-Stage Validation Harness Loop with bounded self-repair retries.
 *  3. FinOps Telemetry: First-Pass PR Yield (FPY), Rework Amplification Factor (RAF),
 *     Cost-per-Verified-PR, and SDD-vs-Vibe Cohort Benchmarking.
 *
 * Invariant: Pure Layer-0 TypeScript, zero external runtime dependencies, <= 800 lines.
 */

import { createHash } from "node:crypto";
import type {
  AgenticHarnessAuditReceipt,
  CohortBenchmarkReport,
  CohortTelemetrySummary,
  HarnessErrorCode,
  HarnessExecutionConfig,
  HarnessExecutionResult,
  HarnessStageAttempt,
  HarnessStageName,
  PrTelemetryRecord,
  SpecReadinessInput,
  SpecReadinessReport,
} from "./eosAgenticHarnessYield.types.ts";

export * from "./eosAgenticHarnessYield.types.ts";

export const ORDERED_HARNESS_STAGES: readonly HarnessStageName[] = [
  "TYPECHECK",
  "LINT_FORMAT",
  "UNIT_BDD",
  "FORMAL_TLC",
  "SECURITY_HYGIENE",
];

const DEFAULT_STAGE_TOKENS: Record<HarnessStageName, number> = {
  TYPECHECK: 1200,
  LINT_FORMAT: 800,
  UNIT_BDD: 2400,
  FORMAL_TLC: 1800,
  SECURITY_HYGIENE: 1000,
};

const DEFAULT_STAGE_DURATION_MS: Record<HarnessStageName, number> = {
  TYPECHECK: 950,
  LINT_FORMAT: 620,
  UNIT_BDD: 1850,
  FORMAL_TLC: 2400,
  SECURITY_HYGIENE: 780,
};

export const MIN_SPEC_READINESS_SCORE = 80;
export const MAX_SPEC_AMBIGUITY = 0.15;

export class HarnessError extends Error {
  public readonly code: HarnessErrorCode;

  constructor(code: HarnessErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = "HarnessError";
  }
}

function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}

/**
 * Agentic Harness Engineering, First-Pass PR Yield & Token Rework Telemetry Core.
 */
export class EosAgenticHarnessYieldCore {
  /**
   * Evaluate Spec-Driven Development (SDD) readiness without throwing (FR-1).
   */
  public evaluateSpecReadiness(input: SpecReadinessInput): SpecReadinessReport {
    if (
      !input ||
      (input.taskId !== undefined && typeof input.taskId !== "string") ||
      !Number.isInteger(input.earsRequirements) ||
      input.earsRequirements < 0 ||
      !Number.isInteger(input.bddScenarios) ||
      input.bddScenarios < 0 ||
      !Number.isInteger(input.adrCount) ||
      input.adrCount < 0 ||
      typeof input.hasFormalTlaModel !== "boolean" ||
      !Number.isFinite(input.ambiguityScore) ||
      input.ambiguityScore < 0 ||
      input.ambiguityScore > 1
    ) {
      throw new HarnessError("HARNESS_INVALID_PARAMETERS", "invalid specification readiness parameters");
    }

    const taskId = input.taskId?.trim() || "task-unnamed";
    const missingCriteria: string[] = [];

    if (input.earsRequirements < 1) missingCriteria.push("EARS_REQUIREMENTS_MISSING");
    if (input.bddScenarios < 1) missingCriteria.push("BDD_SCENARIOS_MISSING");
    if (input.adrCount < 1) missingCriteria.push("ADR_DECISION_MISSING");
    if (input.ambiguityScore > MAX_SPEC_AMBIGUITY) missingCriteria.push("AMBIGUITY_ABOVE_THRESHOLD");

    const earsPoints = input.earsRequirements >= 1 ? 25 : 0;
    const bddPoints = input.bddScenarios >= 1 ? 25 : 0;
    const adrPoints = input.adrCount >= 1 ? 15 : 0;
    const clarityPoints = (1 - input.ambiguityScore) * 20;
    const tlaPoints = input.hasFormalTlaModel ? 15 : 0;

    const readinessScore = round6(Math.min(100, earsPoints + bddPoints + adrPoints + clarityPoints + tlaPoints));
    if (readinessScore < MIN_SPEC_READINESS_SCORE) {
      missingCriteria.push("READINESS_SCORE_BELOW_80");
    }

    return {
      taskId,
      readinessScore,
      earsRequirements: input.earsRequirements,
      bddScenarios: input.bddScenarios,
      adrCount: input.adrCount,
      hasFormalTlaModel: input.hasFormalTlaModel,
      ambiguityScore: round6(input.ambiguityScore),
      missingCriteria,
      approved: missingCriteria.length === 0,
    };
  }

  /**
   * Enforce the fail-closed Spec-Driven Readiness Gate before harness execution (ADR-201-001).
   */
  public assertSpecReadiness(input: SpecReadinessInput): SpecReadinessReport {
    const report = this.evaluateSpecReadiness(input);
    if (!report.approved) {
      throw new HarnessError(
        "HARNESS_SPEC_INCOMPLETE",
        `spec gate blocked ${report.taskId}: score=${report.readinessScore}, missing=[${report.missingCriteria.join(", ")}]`,
      );
    }
    return report;
  }

  /**
   * Execute deterministic multi-stage harness loop with bounded self-repair retries (FR-2, FR-3).
   */
  public runHarnessLoop(config: HarnessExecutionConfig): HarnessExecutionResult {
    if (!config || !config.spec) {
      throw new HarnessError("HARNESS_INVALID_PARAMETERS", "harness config.spec is required");
    }
    const maxRetries = config.maxRetries ?? 3;
    const tokenCostPer1kUsd = config.tokenCostPer1kUsd ?? 0.003;
    const repairTokensPerRetry = config.repairTokensPerRetry ?? 2800;

    if (
      !Number.isInteger(maxRetries) ||
      maxRetries < 0 ||
      maxRetries > 50 ||
      !Number.isFinite(tokenCostPer1kUsd) ||
      tokenCostPer1kUsd <= 0 ||
      !Number.isInteger(repairTokensPerRetry) ||
      repairTokensPerRetry < 0
    ) {
      throw new HarnessError("HARNESS_INVALID_PARAMETERS", "invalid retry or FinOps cost parameters");
    }

    // Gate 1: Reject underspecified prompts before touching code/validation stages
    const specReport = this.assertSpecReadiness(config.spec);

    const attempts: HarnessStageAttempt[] = [];
    const stagesExecuted: HarnessStageName[] = [];
    let totalRetries = 0;
    let firstPassTokens = 0;
    let reworkTokens = 0;

    for (const stage of ORDERED_HARNESS_STAGES) {
      stagesExecuted.push(stage);
      const stageBaseTokens = config.firstPassStageTokens?.[stage] ?? DEFAULT_STAGE_TOKENS[stage];
      const baseDuration = DEFAULT_STAGE_DURATION_MS[stage];
      if (!Number.isInteger(stageBaseTokens) || stageBaseTokens <= 0) {
        throw new HarnessError("HARNESS_INVALID_PARAMETERS", `invalid token budget for stage ${stage}`);
      }

      const plannedFailures = config.stageFailures?.[stage] ?? 0;
      if (!Number.isInteger(plannedFailures) || plannedFailures < 0) {
        throw new HarnessError("HARNESS_INVALID_PARAMETERS", `negative failure count for stage ${stage}`);
      }

      // Initial pass attempt for the stage
      firstPassTokens += stageBaseTokens;

      if (plannedFailures === 0) {
        attempts.push({
          stage,
          attempt: 1,
          passed: true,
          tokensConsumed: stageBaseTokens,
          reworkTokens: 0,
          durationMs: baseDuration,
        });
        continue;
      }

      // First pass failed; enter bounded self-repair iterations
      attempts.push({
        stage,
        attempt: 1,
        passed: false,
        tokensConsumed: stageBaseTokens,
        reworkTokens: 0,
        durationMs: baseDuration,
      });

      for (let f = 1; f <= plannedFailures; f++) {
        totalRetries += 1;
        if (totalRetries > maxRetries) {
          throw new HarnessError(
            "HARNESS_MAX_RETRIES_EXCEEDED",
            `circuit breaker tripped at stage ${stage}: retry ${totalRetries} exceeds maxRetries=${maxRetries}`,
          );
        }
        const stagePassedOnThisRepair = f === plannedFailures;
        const retryTokens = repairTokensPerRetry + Math.round(stageBaseTokens * 0.5);
        reworkTokens += retryTokens;
        attempts.push({
          stage,
          attempt: f + 1,
          passed: stagePassedOnThisRepair,
          tokensConsumed: retryTokens,
          reworkTokens: retryTokens,
          durationMs: Math.round(baseDuration * 1.15),
        });
      }
    }

    const totalTokens = firstPassTokens + reworkTokens;
    const reworkAmplificationFactor = round6(totalTokens / Math.max(1, firstPassTokens));
    const estimatedCostUsd = round6((totalTokens / 1000) * tokenCostPer1kUsd);

    return {
      taskId: specReport.taskId,
      specReport,
      stagesExecuted,
      attempts,
      firstPassSuccess: totalRetries === 0,
      totalRetries,
      firstPassTokens,
      reworkTokens,
      totalTokens,
      reworkAmplificationFactor,
      estimatedCostUsd,
      prReady: true,
    };
  }

  /**
   * Compute FinOps PR Yield and Rework Amplification summary over a cohort (FR-4).
   */
  public evaluateCohortTelemetry(records: ReadonlyArray<PrTelemetryRecord>): CohortTelemetrySummary {
    if (!Array.isArray(records) || records.length === 0) {
      throw new HarnessError("HARNESS_INVALID_PARAMETERS", "cohort records must be non-empty");
    }
    let firstPassCount = 0;
    let totalTokens = 0;
    let firstPassTokens = 0;
    let wastedReworkTokens = 0;
    let totalCostUsd = 0;

    for (const r of records) {
      if (
        !r ||
        typeof r !== "object" ||
        typeof r.prId !== "string" ||
        !r.prId.trim() ||
        typeof r.firstPassSuccess !== "boolean" ||
        !Number.isInteger(r.retries) ||
        r.retries < 0 ||
        !Number.isFinite(r.firstPassTokens) ||
        !Number.isFinite(r.reworkTokens) ||
        !Number.isFinite(r.totalTokens) ||
        !Number.isFinite(r.costUsd) ||
        r.firstPassTokens <= 0 ||
        r.reworkTokens < 0 ||
        r.totalTokens < r.firstPassTokens ||
        r.totalTokens !== r.firstPassTokens + r.reworkTokens ||
        r.costUsd < 0 ||
        (r.firstPassSuccess && (r.retries > 0 || r.reworkTokens > 0))
      ) {
        throw new HarnessError("HARNESS_INVALID_PARAMETERS", `invalid telemetry record ${r?.prId ?? "unknown"}`);
      }
      if (r.firstPassSuccess) firstPassCount++;
      totalTokens += r.totalTokens;
      firstPassTokens += r.firstPassTokens;
      wastedReworkTokens += r.reworkTokens;
      totalCostUsd += r.costUsd;
    }

    const cohortSize = records.length;
    return {
      cohortSize,
      firstPassCount,
      firstPassYieldRatio: round6(firstPassCount / cohortSize),
      meanReworkAmplificationFactor: round6(totalTokens / firstPassTokens),
      totalTokens,
      firstPassTokens,
      wastedReworkTokens,
      totalCostUsd: round6(totalCostUsd),
      meanCostPerMergedPrUsd: round6(totalCostUsd / cohortSize),
    };
  }

  /**
   * Benchmark a Spec-Driven Harness cohort vs an Unconstrained Vibe-Coding cohort (FR-5).
   */
  public compareSddVsVibeCohorts(
    sddRecords?: ReadonlyArray<PrTelemetryRecord>,
    vibeRecords?: ReadonlyArray<PrTelemetryRecord>,
    tokenCostPer1kUsd = 0.003,
  ): CohortBenchmarkReport {
    const { sdd, vibe } =
      sddRecords && vibeRecords
        ? { sdd: sddRecords, vibe: vibeRecords }
        : this.buildCanonicalBenchmarkCohorts(tokenCostPer1kUsd);

    const sddCohort = this.evaluateCohortTelemetry(sdd);
    const vibeCohort = this.evaluateCohortTelemetry(vibe);

    const yieldUpliftRatio = round6(sddCohort.firstPassYieldRatio - vibeCohort.firstPassYieldRatio);
    const rafReductionRatio = round6(
      vibeCohort.meanReworkAmplificationFactor > 0
        ? (vibeCohort.meanReworkAmplificationFactor - sddCohort.meanReworkAmplificationFactor) /
            vibeCohort.meanReworkAmplificationFactor
        : 0,
    );
    const tokenSavingsRatio = round6(
      vibeCohort.totalTokens > 0 ? (vibeCohort.totalTokens - sddCohort.totalTokens) / vibeCohort.totalTokens : 0,
    );
    const costSavingsUsd = round6(vibeCohort.totalCostUsd - sddCohort.totalCostUsd);

    return {
      sddCohort,
      vibeCohort,
      yieldUpliftRatio,
      rafReductionRatio,
      tokenSavingsRatio,
      costSavingsUsd,
    };
  }

  /**
   * Generate canonical benchmark records modeling 5 equivalent tasks executed under
   * Spec-Driven Harness governance vs unconstrained vibe coding.
   */
  public buildCanonicalBenchmarkCohorts(tokenCostPer1kUsd = 0.003): {
    sdd: PrTelemetryRecord[];
    vibe: PrTelemetryRecord[];
  } {
    const sddSpecs: Array<{ id: string; failures: Partial<Record<HarnessStageName, number>> }> = [
      { id: "PR-SDD-01", failures: {} },
      { id: "PR-SDD-02", failures: {} },
      { id: "PR-SDD-03", failures: { LINT_FORMAT: 1 } },
      { id: "PR-SDD-04", failures: {} },
      { id: "PR-SDD-05", failures: {} },
    ];

    const sdd: PrTelemetryRecord[] = sddSpecs.map((item) => {
      const res = this.runHarnessLoop({
        spec: {
          taskId: item.id,
          earsRequirements: 5,
          bddScenarios: 6,
          adrCount: 3,
          hasFormalTlaModel: true,
          ambiguityScore: 0.04,
        },
        maxRetries: 3,
        stageFailures: item.failures,
        tokenCostPer1kUsd,
      });
      return {
        prId: item.id,
        methodology: "SDD_HARNESS",
        firstPassSuccess: res.firstPassSuccess,
        retries: res.totalRetries,
        firstPassTokens: res.firstPassTokens,
        reworkTokens: res.reworkTokens,
        totalTokens: res.totalTokens,
        costUsd: res.estimatedCostUsd,
      };
    });

    // Unconstrained vibe cohort: same 7200 baseline tokens/PR, high multi-turn rework (2..4 retries per PR)
    const vibeRetryPattern = [3, 2, 4, 3, 2];
    const vibe: PrTelemetryRecord[] = vibeRetryPattern.map((retries, idx) => {
      const fpTokens = 7200;
      const rwTokens = retries * 6800;
      const totTokens = fpTokens + rwTokens;
      return {
        prId: `PR-VIBE-0${idx + 1}`,
        methodology: "VIBE_CODING",
        firstPassSuccess: retries === 0,
        retries,
        firstPassTokens: fpTokens,
        reworkTokens: rwTokens,
        totalTokens: totTokens,
        costUsd: round6((totTokens / 1000) * tokenCostPer1kUsd),
      };
    });

    return { sdd, vibe };
  }

  /**
   * Run structural self-tests and emit SHA-256 signed receipt (FR-6).
   */
  public audit(): AgenticHarnessAuditReceipt {
    let specGateEnforced = false;
    try {
      this.assertSpecReadiness({
        taskId: "vibe-prompt-underspecified",
        earsRequirements: 0,
        bddScenarios: 0,
        adrCount: 0,
        hasFormalTlaModel: false,
        ambiguityScore: 0.72,
      });
    } catch (err) {
      specGateEnforced = err instanceof HarnessError && err.code === "HARNESS_SPEC_INCOMPLETE";
    }

    const convergedRun = this.runHarnessLoop({
      spec: {
        taskId: "audit-converged-pr",
        earsRequirements: 4,
        bddScenarios: 5,
        adrCount: 2,
        hasFormalTlaModel: true,
        ambiguityScore: 0.05,
      },
      maxRetries: 3,
      stageFailures: { UNIT_BDD: 1 },
    });
    const harnessLoopConverged =
      convergedRun.prReady &&
      convergedRun.totalRetries === 1 &&
      !convergedRun.firstPassSuccess &&
      convergedRun.reworkAmplificationFactor > 1.0 &&
      convergedRun.totalTokens === convergedRun.firstPassTokens + convergedRun.reworkTokens;

    let retryCeilingEnforced = false;
    try {
      this.runHarnessLoop({
        spec: {
          taskId: "audit-runaway-retries",
          earsRequirements: 4,
          bddScenarios: 4,
          adrCount: 2,
          hasFormalTlaModel: true,
          ambiguityScore: 0.05,
        },
        maxRetries: 2,
        stageFailures: { UNIT_BDD: 2, FORMAL_TLC: 1 },
      });
    } catch (err) {
      retryCeilingEnforced = err instanceof HarnessError && err.code === "HARNESS_MAX_RETRIES_EXCEEDED";
    }

    const bench = this.compareSddVsVibeCohorts();
    const firstPassYieldComputed =
      bench.sddCohort.cohortSize === 5 &&
      bench.sddCohort.firstPassYieldRatio === 0.8 &&
      bench.vibeCohort.firstPassYieldRatio === 0;
    const sddOutperformsVibe =
      bench.sddCohort.firstPassYieldRatio > bench.vibeCohort.firstPassYieldRatio &&
      bench.sddCohort.meanReworkAmplificationFactor < bench.vibeCohort.meanReworkAmplificationFactor &&
      bench.tokenSavingsRatio > 0.5;

    const allPassed =
      specGateEnforced && harnessLoopConverged && retryCeilingEnforced && firstPassYieldComputed && sddOutperformsVibe;

    const body = {
      specRef: "SPEC-339" as const,
      specGateEnforced,
      harnessLoopConverged,
      retryCeilingEnforced,
      firstPassYieldComputed,
      sddOutperformsVibe,
      sddFirstPassYieldRatio: bench.sddCohort.firstPassYieldRatio,
      vibeFirstPassYieldRatio: bench.vibeCohort.firstPassYieldRatio,
      tokenSavingsRatio: bench.tokenSavingsRatio,
      allPassed,
    };
    return { ...body, sha256Digest: sha256Hex(JSON.stringify(body)) };
  }
}

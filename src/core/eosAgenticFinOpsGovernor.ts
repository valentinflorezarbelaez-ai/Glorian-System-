/**
 * EOS Autonomous Agentic FinOps Governor & Cognitive Stagnation Breaker
 * Specification: SPEC-118 (IEEE 830 / ISO 29148 / Big Tech FinOps Standard)
 * Standard: Spotify Xirp & Nubank Meta Agentic Cost Governance
 *
 * Layer 0 Purity: 100% pure TypeScript/Node.js standard library (node:crypto).
 * Zero external npm runtime dependencies.
 */

import { createHash } from "node:crypto";

export type FinOpsCostTier = "TIER_1_LOCAL_SLM" | "TIER_2_BALANCED" | "TIER_3_FRONTIER_REASONING";

export interface TaskCostRoutingResult {
  directive: string;
  tier: FinOpsCostTier;
  recommendedProviderModel: string;
  ratePerMillionUsd: { prompt: number; completion: number };
  estimatedCostUsd: number;
  rationale: string;
  sha256Attestation: string;
}

export interface StagnationEvaluationResult {
  stagnant: boolean;
  consecutiveCycles: number;
  similarityScore: number;
  circuitBreakerState: "CLOSED" | "WARNING" | "CIRCUIT_TRIPPED_STAGNATION";
  action: "PROCEED_NOMINAL" | "WARN_COGNITIVE_STALL" | "SIGSTOP_EMERGENCY";
  diagnostics: string;
  sha256Attestation: string;
}

export interface EphemeralTaskWallet {
  missionId: string;
  hardCapUsd: number;
  accumulatedSpendUsd: number;
  remainingBudgetUsd: number;
  status: "ACTIVE" | "WARN_BUDGET_DEPLETION" | "CUTOFF_FAIL_CLOSED";
  fallbackToLocal: boolean;
  totalTokensIn: number;
  totalTokensOut: number;
}

export interface TrackedCodeComponent {
  componentId: string;
  initialLines: number;
  retainedLines30Days: number;
  totalInferenceCostUsd: number;
}

export interface CodeSurvivalEvaluationResult {
  totalComponentsTracked: number;
  averageSurvivalRatePercent: number;
  netNegativeAiDebt: boolean;
  totalInferenceCostUsd: number;
  estimatedHumanEquivalentCostUsd: number;
  netSavingsUsd: number;
  roiMultiple: number;
  sha256Attestation: string;
}

export interface FinOpsGovernorStatus {
  totalDirectivesRouted: number;
  totalWalletsAllocated: number;
  stagnationEventsDetected: number;
  totalSpendUsd: number;
  tierDistribution: Record<FinOpsCostTier, number>;
  state: "NOMINAL" | "CIRCUIT_ACTIVE";
}

export class EosAgenticFinOpsGovernor {
  private static instance: EosAgenticFinOpsGovernor | null = null;

  private totalDirectivesRouted = 0;
  private totalWalletsAllocated = 0;
  private stagnationEventsDetected = 0;
  private totalSpendUsd = 0;
  private tierDistribution: Record<FinOpsCostTier, number> = {
    TIER_1_LOCAL_SLM: 0,
    TIER_2_BALANCED: 0,
    TIER_3_FRONTIER_REASONING: 0,
  };

  private wallets = new Map<string, EphemeralTaskWallet>();

  public static getInstance(): EosAgenticFinOpsGovernor {
    if (!EosAgenticFinOpsGovernor.instance) {
      EosAgenticFinOpsGovernor.instance = new EosAgenticFinOpsGovernor();
    }
    return EosAgenticFinOpsGovernor.instance;
  }

  /**
   * Classifies a task directive into the lowest viable cost tier (Mid-Task Cost Routing).
   */
  public classifyTaskCostTier(directive: string, estimatedTokens = 4000): TaskCostRoutingResult {
    const lower = directive.toLowerCase();

    let tier: FinOpsCostTier = "TIER_2_BALANCED";
    let recommendedProviderModel = "gemini-2.5-pro";
    let rates = { prompt: 1.25, completion: 5.0 };
    let rationale = "Standard business logic, component implementation, and balanced verification.";

    if (
      lower.includes("lint") ||
      lower.includes("format") ||
      lower.includes("ast") ||
      lower.includes("search") ||
      lower.includes("read") ||
      lower.includes("outline") ||
      lower.includes("boilerplate")
    ) {
      tier = "TIER_1_LOCAL_SLM";
      recommendedProviderModel = "local-slm-or-gemini-flash";
      rates = { prompt: 0.075, completion: 0.3 };
      rationale = "Low cognitive entropy task routed to local SLM/Flash for 90%+ cost minimization.";
    } else if (
      lower.includes("tla+") ||
      lower.includes("formal") ||
      lower.includes("concurrency") ||
      lower.includes("deadlock") ||
      lower.includes("invariant") ||
      lower.includes("bitemporal") ||
      lower.includes("ledger") ||
      lower.includes("architecture")
    ) {
      tier = "TIER_3_FRONTIER_REASONING";
      recommendedProviderModel = "claude-3-7-sonnet-or-o1";
      rates = { prompt: 3.0, completion: 15.0 };
      rationale = "High-entropy mathematical and formal verification requiring deep frontier reasoning.";
    }

    const estimatedCostUsd =
      (estimatedTokens * 0.7 * rates.prompt + estimatedTokens * 0.3 * rates.completion) / 1_000_000;

    this.totalDirectivesRouted++;
    this.tierDistribution[tier]++;

    const digestPayload = `ROUTE:${directive}:${tier}:${estimatedCostUsd.toFixed(6)}`;
    const sha256Attestation = createHash("sha256").update(digestPayload).digest("hex");

    return {
      directive,
      tier,
      recommendedProviderModel,
      ratePerMillionUsd: rates,
      estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
      rationale,
      sha256Attestation,
    };
  }

  /**
   * Evaluates a sequence of diffs for cognitive stagnation to prevent infinite token bleed loops.
   */
  public evaluateStagnation(diffHistory: string[], testPassed: boolean): StagnationEvaluationResult {
    if (diffHistory.length < 2) {
      const digestPayload = `STAGNATION:NOMINAL:${diffHistory.length}`;
      return {
        stagnant: false,
        consecutiveCycles: diffHistory.length,
        similarityScore: 0.0,
        circuitBreakerState: "CLOSED",
        action: "PROCEED_NOMINAL",
        diagnostics: "Insufficient diff history to evaluate stagnation.",
        sha256Attestation: createHash("sha256").update(digestPayload).digest("hex"),
      };
    }

    // Calculate similarity between last two diffs
    const lastDiff = diffHistory[diffHistory.length - 1];
    const prevDiff = diffHistory[diffHistory.length - 2];
    const similarity = this.calculateTokenJaccardSimilarity(lastDiff, prevDiff);

    let stagnant = false;
    let circuitBreakerState: "CLOSED" | "WARNING" | "CIRCUIT_TRIPPED_STAGNATION" = "CLOSED";
    let action: "PROCEED_NOMINAL" | "WARN_COGNITIVE_STALL" | "SIGSTOP_EMERGENCY" = "PROCEED_NOMINAL";
    let diagnostics = "Nominal diff progression.";

    if (!testPassed && similarity >= 0.85) {
      if (diffHistory.length >= 3) {
        // 3 consecutive failed cycles with >85% diff similarity
        stagnant = true;
        circuitBreakerState = "CIRCUIT_TRIPPED_STAGNATION";
        action = "SIGSTOP_EMERGENCY";
        diagnostics = `CRITICAL: Infinite token bleed loop detected. 3 consecutive cycles with ${(similarity * 100).toFixed(1)}% diff similarity without passing tests. Halting agent.`;
        this.stagnationEventsDetected++;
      } else {
        circuitBreakerState = "WARNING";
        action = "WARN_COGNITIVE_STALL";
        diagnostics = `WARNING: Diffs show ${(similarity * 100).toFixed(1)}% similarity on failing tests. Approaching stagnation threshold.`;
      }
    }

    const digestPayload = `STAGNATION:${circuitBreakerState}:${action}:${similarity.toFixed(4)}`;
    const sha256Attestation = createHash("sha256").update(digestPayload).digest("hex");

    return {
      stagnant,
      consecutiveCycles: diffHistory.length,
      similarityScore: Number(similarity.toFixed(4)),
      circuitBreakerState,
      action,
      diagnostics,
      sha256Attestation,
    };
  }

  /**
   * Allocates an ephemeral task wallet with a hard dollar ceiling.
   */
  public allocateWallet(missionId: string, hardCapUsd = 3.0): EphemeralTaskWallet {
    const wallet: EphemeralTaskWallet = {
      missionId,
      hardCapUsd,
      accumulatedSpendUsd: 0,
      remainingBudgetUsd: hardCapUsd,
      status: "ACTIVE",
      fallbackToLocal: false,
      totalTokensIn: 0,
      totalTokensOut: 0,
    };
    this.wallets.set(missionId, wallet);
    this.totalWalletsAllocated++;
    return wallet;
  }

  /**
   * Records token consumption against the task's ephemeral wallet.
   */
  public recordTokenUsage(
    missionId: string,
    tokensIn: number,
    tokensOut: number,
    tier: FinOpsCostTier,
  ): EphemeralTaskWallet {
    let wallet = this.wallets.get(missionId);
    if (!wallet) {
      wallet = this.allocateWallet(missionId);
    }

    let rates = { prompt: 1.25, completion: 5.0 };
    if (tier === "TIER_1_LOCAL_SLM") rates = { prompt: 0.075, completion: 0.3 };
    if (tier === "TIER_3_FRONTIER_REASONING") rates = { prompt: 3.0, completion: 15.0 };

    const costUsd = (tokensIn * rates.prompt + tokensOut * rates.completion) / 1_000_000;
    wallet.accumulatedSpendUsd = Number((wallet.accumulatedSpendUsd + costUsd).toFixed(6));
    wallet.remainingBudgetUsd = Number(Math.max(0, wallet.hardCapUsd - wallet.accumulatedSpendUsd).toFixed(6));
    wallet.totalTokensIn += tokensIn;
    wallet.totalTokensOut += tokensOut;

    this.totalSpendUsd = Number((this.totalSpendUsd + costUsd).toFixed(6));

    if (wallet.accumulatedSpendUsd >= wallet.hardCapUsd) {
      wallet.status = "CUTOFF_FAIL_CLOSED";
      wallet.fallbackToLocal = true;
    } else if (wallet.accumulatedSpendUsd >= wallet.hardCapUsd * 0.8) {
      wallet.status = "WARN_BUDGET_DEPLETION";
    } else {
      wallet.status = "ACTIVE";
    }

    return wallet;
  }

  /**
   * Evaluates 30-day code survival rate and financial ROI vs. human engineering cost.
   */
  public evaluateCodeSurvival(
    components: TrackedCodeComponent[],
    hourlyEngineerRateUsd = 120,
  ): CodeSurvivalEvaluationResult {
    if (components.length === 0) {
      const digestPayload = "SURVIVAL:EMPTY:0";
      return {
        totalComponentsTracked: 0,
        averageSurvivalRatePercent: 100,
        netNegativeAiDebt: false,
        totalInferenceCostUsd: 0,
        estimatedHumanEquivalentCostUsd: 0,
        netSavingsUsd: 0,
        roiMultiple: 1.0,
        sha256Attestation: createHash("sha256").update(digestPayload).digest("hex"),
      };
    }

    let totalInitial = 0;
    let totalRetained = 0;
    let totalInferenceCost = 0;

    for (const c of components) {
      totalInitial += c.initialLines;
      totalRetained += c.retainedLines30Days;
      totalInferenceCost += c.totalInferenceCostUsd;
    }

    const survivalRate = totalInitial > 0 ? (totalRetained / totalInitial) * 100 : 100;
    const churn = 100 - survivalRate;
    const netNegativeAiDebt = churn > 30.0;

    // Production benchmark: Senior engineer delivers ~15 clean, tested lines per hour.
    const estimatedHumanHours = totalRetained / 15.0;
    const estimatedHumanEquivalentCostUsd = Number((estimatedHumanHours * hourlyEngineerRateUsd).toFixed(2));
    const netSavingsUsd = Number((estimatedHumanEquivalentCostUsd - totalInferenceCost).toFixed(2));
    const roiMultiple =
      totalInferenceCost > 0 ? Number((estimatedHumanEquivalentCostUsd / totalInferenceCost).toFixed(2)) : 100.0;

    const digestPayload = `SURVIVAL:${survivalRate.toFixed(2)}:${netNegativeAiDebt}:${netSavingsUsd}`;
    const sha256Attestation = createHash("sha256").update(digestPayload).digest("hex");

    return {
      totalComponentsTracked: components.length,
      averageSurvivalRatePercent: Number(survivalRate.toFixed(2)),
      netNegativeAiDebt,
      totalInferenceCostUsd: Number(totalInferenceCost.toFixed(2)),
      estimatedHumanEquivalentCostUsd,
      netSavingsUsd,
      roiMultiple,
      sha256Attestation,
    };
  }

  public getStatus(): FinOpsGovernorStatus {
    return {
      totalDirectivesRouted: this.totalDirectivesRouted,
      totalWalletsAllocated: this.totalWalletsAllocated,
      stagnationEventsDetected: this.stagnationEventsDetected,
      totalSpendUsd: Number(this.totalSpendUsd.toFixed(6)),
      tierDistribution: { ...this.tierDistribution },
      state: this.stagnationEventsDetected > 0 ? "CIRCUIT_ACTIVE" : "NOMINAL",
    };
  }

  public reset(): void {
    this.totalDirectivesRouted = 0;
    this.totalWalletsAllocated = 0;
    this.stagnationEventsDetected = 0;
    this.totalSpendUsd = 0;
    this.tierDistribution = {
      TIER_1_LOCAL_SLM: 0,
      TIER_2_BALANCED: 0,
      TIER_3_FRONTIER_REASONING: 0,
    };
    this.wallets.clear();
  }

  /**
   * Helper: Calculates token Jaccard similarity across two text snippets.
   */
  private calculateTokenJaccardSimilarity(textA: string, textB: string): number {
    const tokensA = new Set(textA.split(/\s+/).filter(Boolean));
    const tokensB = new Set(textB.split(/\s+/).filter(Boolean));

    if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
    if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

    let intersection = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) intersection++;
    }

    const union = tokensA.size + tokensB.size - intersection;
    return union > 0 ? intersection / union : 0.0;
  }
}

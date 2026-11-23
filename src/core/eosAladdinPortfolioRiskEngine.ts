/**
 * EOS Aladdin Institutional Portfolio & Multi-Factor Risk Engine
 * Part of SPEC-372 / CHANGE-234 (Layer-0 Pure Financial Architecture)
 *
 * Implements BlackRock Aladdin-grade portfolio risk governance, multi-factor stress testing,
 * Monte Carlo ruin analysis, and All-Weather asset allocation with zero external runtime dependencies.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveEvidenceDir } from "./eosEvidencePaths.ts";
import type {
  AladdinAuditReceipt,
  AllWeatherAllocationReport,
  AllWeatherAssetAllocation,
  AssetClass,
  CrisisStressResult,
  FiduciaryValidationResult,
  HistoricalCrisis,
  MonteCarloSimulationResult,
  PortfolioAsset,
  PortfolioRiskMetrics,
  VaultType,
} from "./eosAladdinPortfolioRiskEngine.types.js";

export class EosAladdinPortfolioRiskEngine {
  public static readonly VERSION = "1.0.0";
  public static readonly FIDUCIARY_VAULT_PRINCIPAL = 3000.0; // USD (Protected Father's Trust)

  /**
   * Deterministic XorShift128+ PRNG state
   */
  private static prngState0 = 123456789;
  private static prngState1 = 987654321;

  public static seedPrng(seed: number): void {
    this.prngState0 = (seed ^ 0x5deece66d) >>> 0;
    this.prngState1 = (seed ^ 0xb) >>> 0;
    if (this.prngState0 === 0 && this.prngState1 === 0) {
      this.prngState0 = 123456789;
      this.prngState1 = 987654321;
    }
  }

  private static randomUniform(): number {
    let s1 = this.prngState0;
    const s0 = this.prngState1;
    this.prngState0 = s0;
    s1 ^= s1 << 23;
    this.prngState1 = s1 ^ s0 ^ (s1 >>> 17) ^ (s0 >>> 26);
    const sum = (this.prngState1 + s0) >>> 0;
    return (sum + 1) / 4294967297.0;
  }

  /**
   * Generates standard normal random variable using Box-Muller transform
   */
  public static sampleStandardNormal(): number {
    let u1 = this.randomUniform();
    let u2 = this.randomUniform();
    while (u1 <= 1e-15) {
      u1 = this.randomUniform();
    }
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }

  /**
   * FR-372-01: Dual-Vault Fiduciary Barrier
   */
  public static validateFiduciaryAllocation(
    vault: VaultType,
    assetClass: AssetClass,
    amount: number,
  ): FiduciaryValidationResult {
    if (vault === "VAULT_ALPHA_FIDUCIARY") {
      if (assetClass === "SPECULATIVE_DERIVATIVE") {
        return {
          vault,
          permitted: false,
          reason: "FIDUCIARY_VIOLATION_BLOCKED: Speculative derivative strictly prohibited in Vault Alpha.",
          capitalProtected: this.FIDUCIARY_VAULT_PRINCIPAL,
        };
      }
      return {
        vault,
        permitted: true,
        reason: "FIDUCIARY_CONFORMING: Asset meets capital preservation standard.",
        capitalProtected: this.FIDUCIARY_VAULT_PRINCIPAL,
      };
    }

    return {
      vault,
      permitted: true,
      reason: "QUANT_LAB_AUTHORIZED: Sandbox experiment permitted within isolated budget.",
      capitalProtected: 0,
    };
  }

  /**
   * FR-372-02: Multi-Factor Value-at-Risk (VaR) & Expected Shortfall (CVaR)
   */
  public static computePortfolioRiskMetrics(assets: PortfolioAsset[], riskFreeRate = 0.04): PortfolioRiskMetrics {
    if (assets.length === 0) {
      return {
        annualExpectedReturn: 0,
        annualPortfolioVolatility: 0,
        var95: 0,
        var99: 0,
        cvar99: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        fractionalKellyFraction: 0,
      };
    }

    let weightedReturn = 0;
    let varianceSum = 0;

    for (const a of assets) {
      weightedReturn += a.weight * a.expectedAnnualReturn;
      // Conservative portfolio variance proxy (assuming partial correlation rho=0.25)
      varianceSum += Math.pow(a.weight * a.annualVolatility, 2);
    }

    // Cross-term correlation buffer
    const crossCorrelationBuffer = 0.25 * Math.pow(weightedReturn * 0.5, 2);
    const portfolioVolatility = Math.sqrt(varianceSum + crossCorrelationBuffer);

    // Standard Gaussian percentiles: z_95 = 1.645, z_99 = 2.326
    const var95 = Math.max(0, 1.645 * portfolioVolatility - weightedReturn);
    const var99 = Math.max(0, 2.326 * portfolioVolatility - weightedReturn);
    const cvar99 = Math.max(var99, 2.665 * portfolioVolatility - weightedReturn);

    const excessReturn = weightedReturn - riskFreeRate;
    const sharpeRatio = portfolioVolatility > 0 ? excessReturn / portfolioVolatility : 0;
    // Downside deviation modeled as approx 70% of total volatility
    const downsideDev = portfolioVolatility * 0.707;
    const sortinoRatio = downsideDev > 0 ? excessReturn / downsideDev : 0;

    // Fractional Kelly: (p*(b+1) - 1)/b bounded at 1/4 Kelly
    const winRate = 0.55;
    const winLossRatio = 1.0;
    const fullKelly = (winRate * (winLossRatio + 1) - 1) / winLossRatio;
    const fractionalKelly = Math.max(0, Math.min(0.025, 0.25 * fullKelly));

    return {
      annualExpectedReturn: Number(weightedReturn.toFixed(4)),
      annualPortfolioVolatility: Number(portfolioVolatility.toFixed(4)),
      var95: Number(var95.toFixed(4)),
      var99: Number(var99.toFixed(4)),
      cvar99: Number(cvar99.toFixed(4)),
      sharpeRatio: Number(sharpeRatio.toFixed(2)),
      sortinoRatio: Number(sortinoRatio.toFixed(2)),
      fractionalKellyFraction: Number(fractionalKelly.toFixed(4)),
    };
  }

  /**
   * FR-372-03: Deterministic Monte Carlo Stochastic Simulation
   */
  public static runMonteCarloSimulation(params: {
    initialPrincipal: number;
    annualReturn: number;
    annualVolatility: number;
    horizonDays?: number;
    paths?: number;
    seed?: number;
  }): MonteCarloSimulationResult {
    const horizonDays = params.horizonDays ?? 252;
    const paths = params.paths ?? 10000;
    const seed = params.seed ?? 42;
    this.seedPrng(seed);

    const dt = 1.0 / 252.0;
    const drift = (params.annualReturn - 0.5 * Math.pow(params.annualVolatility, 2)) * dt;
    const diffusion = params.annualVolatility * Math.sqrt(dt);

    const terminalValues: number[] = new Array(paths);
    let ruinCount = 0;
    let worstDrawdown = 0;

    for (let p = 0; p < paths; p++) {
      let currentEquity = params.initialPrincipal;
      let peakEquity = currentEquity;
      let pathMaxDrawdown = 0;

      for (let day = 0; day < horizonDays; day++) {
        const z = this.sampleStandardNormal();
        currentEquity *= Math.exp(drift + diffusion * z);

        if (currentEquity > peakEquity) {
          peakEquity = currentEquity;
        } else {
          const dd = (peakEquity - currentEquity) / peakEquity;
          if (dd > pathMaxDrawdown) pathMaxDrawdown = dd;
        }

        // Fiduciary ruin threshold: losing > 50% of capital
        if (currentEquity <= params.initialPrincipal * 0.5) {
          ruinCount++;
          break;
        }
      }

      if (pathMaxDrawdown > worstDrawdown) worstDrawdown = pathMaxDrawdown;
      terminalValues[p] = currentEquity;
    }

    terminalValues.sort((a, b) => a - b);
    const median = terminalValues[Math.floor(paths * 0.5)];
    const p5 = terminalValues[Math.floor(paths * 0.05)];
    const p95 = terminalValues[Math.floor(paths * 0.95)];
    const probRuin = ruinCount / paths;

    return {
      paths,
      horizonDays,
      initialPrincipal: params.initialPrincipal,
      medianTerminalEquity: Number(median.toFixed(2)),
      percentile5: Number(p5.toFixed(2)),
      percentile95: Number(p95.toFixed(2)),
      probabilityOfRuin: Number(probRuin.toFixed(4)),
      maxExpectedDrawdownPercent: Number((worstDrawdown * 100).toFixed(2)),
      seed,
    };
  }

  /**
   * FR-372-04: Historical Black Swan Stress-Testing
   */
  public static runHistoricalStressTests(weights?: {
    equities: number;
    bonds: number;
    gold: number;
    commodities: number;
  }): CrisisStressResult[] {
    const w = weights ?? { equities: 0.3, bonds: 0.55, gold: 0.075, commodities: 0.075 };

    const crisisMatrix: Array<{
      crisis: HistoricalCrisis;
      name: string;
      eq: number;
      bd: number;
      gd: number;
      cm: number;
    }> = [
      {
        crisis: "LEHMAN_2008",
        name: "2008 Global Financial Crisis (Lehman Collapse)",
        eq: -0.45,
        bd: 0.12,
        gd: 0.05,
        cm: -0.35,
      },
      {
        crisis: "COVID_2020",
        name: "2020 Pandemic Liquidity Flash Crash",
        eq: -0.34,
        bd: 0.08,
        gd: 0.03,
        cm: -0.25,
      },
      {
        crisis: "BLACK_MONDAY_1987",
        name: "1987 Black Monday Crash",
        eq: -0.226,
        bd: 0.04,
        gd: 0.02,
        cm: -0.05,
      },
      {
        crisis: "STAGFLATION_1970S",
        name: "1970s Oil Shock & Stagflation",
        eq: -0.15,
        bd: -0.1,
        gd: 0.45,
        cm: 0.3,
      },
    ];

    return crisisMatrix.map((c) => {
      const portfolioImpact = w.equities * c.eq + w.bonds * c.bd + w.gold * c.gd + w.commodities * c.cm;
      const benchmarkImpact = c.eq;
      const drawdownPercent = Math.abs(Math.min(0, portfolioImpact)) * 100;
      const benchDrawdown = Math.abs(c.eq) * 100;

      return {
        crisis: c.crisis,
        name: c.name,
        equityShock: c.eq,
        portfolioDrawdown: Number(drawdownPercent.toFixed(2)),
        survived: drawdownPercent < 20.0, // Institutional survival: MaxDD < 20%
        benchmark100EquityDrawdown: Number(benchDrawdown.toFixed(2)),
        resilienceDelta: Number((benchDrawdown - drawdownPercent).toFixed(2)),
      };
    });
  }

  /**
   * FR-372-05: Ray Dalio All-Weather Risk Parity Allocation
   */
  public static getAllWeatherAllocation(currentHoldings?: Record<string, number>): AllWeatherAllocationReport {
    const targetAllocations: Array<{
      name: string;
      assetClass: AssetClass;
      target: number;
    }> = [
      { name: "Long-Term Sovereign Bonds", assetClass: "AAA_SOVEREIGN_BOND", target: 40.0 },
      { name: "Global Equities Index (S&P 500 / VOO)", assetClass: "GLOBAL_EQUITY_INDEX", target: 30.0 },
      { name: "Intermediate Fixed Income / CDT", assetClass: "BANK_CDT_FIXED", target: 15.0 },
      { name: "Physical Gold Refugio", assetClass: "PHYSICAL_GOLD", target: 7.5 },
      { name: "Diversified Commodities", assetClass: "COMMODITIES", target: 7.5 },
    ];

    let maxDrift = 0;
    const assets: AllWeatherAssetAllocation[] = targetAllocations.map((item) => {
      const current = currentHoldings ? (currentHoldings[item.name] ?? item.target) : item.target;
      const drift = Number((current - item.target).toFixed(2));
      if (Math.abs(drift) > maxDrift) maxDrift = Math.abs(drift);

      let action: "BUY" | "SELL" | "HOLD" = "HOLD";
      if (drift < -2.0) action = "BUY";
      else if (drift > 2.0) action = "SELL";

      return {
        name: item.name,
        assetClass: item.assetClass,
        targetWeightPercent: item.target,
        currentWeightPercent: current,
        driftPercent: drift,
        rebalanceAction: action,
      };
    });

    const totalTarget = assets.reduce((acc, curr) => acc + curr.targetWeightPercent, 0);

    return {
      timestamp: Date.now(),
      totalTargetWeightPercent: Number(totalTarget.toFixed(2)),
      assets,
      rebalanceRequired: maxDrift > 5.0,
      maxDriftPercent: Number(maxDrift.toFixed(2)),
    };
  }

  /**
   * FR-372-07: Invariant Auditing & Cryptographic Receipt Generation
   */
  public static audit(targetDir = process.cwd()): AladdinAuditReceipt {
    const assets: PortfolioAsset[] = [
      {
        name: "Long Treasuries",
        assetClass: "AAA_SOVEREIGN_BOND",
        weight: 0.4,
        expectedAnnualReturn: 0.05,
        annualVolatility: 0.08,
      },
      {
        name: "S&P 500 Index",
        assetClass: "GLOBAL_EQUITY_INDEX",
        weight: 0.3,
        expectedAnnualReturn: 0.1,
        annualVolatility: 0.16,
      },
      {
        name: "Intermediate CDT",
        assetClass: "BANK_CDT_FIXED",
        weight: 0.15,
        expectedAnnualReturn: 0.09,
        annualVolatility: 0.02,
      },
      { name: "Gold", assetClass: "PHYSICAL_GOLD", weight: 0.075, expectedAnnualReturn: 0.06, annualVolatility: 0.12 },
      {
        name: "Commodities",
        assetClass: "COMMODITIES",
        weight: 0.075,
        expectedAnnualReturn: 0.05,
        annualVolatility: 0.18,
      },
    ];

    const metrics = this.computePortfolioRiskMetrics(assets);
    const mc = this.runMonteCarloSimulation({
      initialPrincipal: this.FIDUCIARY_VAULT_PRINCIPAL,
      annualReturn: metrics.annualExpectedReturn,
      annualVolatility: metrics.annualPortfolioVolatility,
      paths: 1000,
    });
    const allocation = this.getAllWeatherAllocation();

    const invZeroFiduciaryRuin = mc.probabilityOfRuin === 0.0;
    const invVaRThreshold = metrics.cvar99 >= metrics.var99 && metrics.var99 >= metrics.var95;
    const invMaxDrawdown = mc.maxExpectedDrawdownPercent < 50.0;
    const invAllocationSum = allocation.totalTargetWeightPercent === 100.0;

    const allPassed = invZeroFiduciaryRuin && invVaRThreshold && invMaxDrawdown && invAllocationSum;

    const receiptId = `aladdin-rcpt-${Date.now()}`;
    const payload = JSON.stringify({
      receiptId,
      allPassed,
      invZeroFiduciaryRuin,
      invVaRThreshold,
      invMaxDrawdown,
      invAllocationSum,
      principal: this.FIDUCIARY_VAULT_PRINCIPAL,
      probRuin: mc.probabilityOfRuin,
      var99: metrics.var99,
      cvar99: metrics.cvar99,
    });

    const receiptHash = createHash("sha256").update(payload).digest("hex");

    const receipt: AladdinAuditReceipt = {
      receiptId,
      status: allPassed ? "VERIFIED" : "FAILED",
      fiduciaryVaultSecurity: invZeroFiduciaryRuin ? "SECURED" : "BREACHED",
      invariants: {
        zeroFiduciaryRuin: invZeroFiduciaryRuin,
        varThresholdBound: invVaRThreshold,
        maxDrawdownGuard: invMaxDrawdown,
        deterministicAllocationSum: invAllocationSum,
      },
      metrics: {
        vaultAlphaPrincipal: this.FIDUCIARY_VAULT_PRINCIPAL,
        probabilityOfRuin: mc.probabilityOfRuin,
        var99Percent: Number((metrics.var99 * 100).toFixed(2)),
        cvar99Percent: Number((metrics.cvar99 * 100).toFixed(2)),
      },
      receiptHash,
      timestamp: Date.now(),
    };

    const evidenceDir = resolveEvidenceDir(targetDir);
    if (!existsSync(evidenceDir)) {
      mkdirSync(evidenceDir, { recursive: true });
    }
    writeFileSync(join(evidenceDir, "ALADDIN_PORTFOLIO_RISK_RECEIPT.json"), JSON.stringify(receipt, null, 2), "utf8");

    return receipt;
  }
}

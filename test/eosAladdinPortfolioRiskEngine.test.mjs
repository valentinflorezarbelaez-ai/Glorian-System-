/**
 * Test Suite: Aladdin Institutional Portfolio & Multi-Factor Risk Engine
 * Verifies SPEC-372 / CHANGE-234 (BDD-2012..BDD-2018)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EosAladdinPortfolioRiskEngine } from "../src/core/eosAladdinPortfolioRiskEngine.ts";

describe("SPEC-372: Aladdin Institutional Portfolio & Multi-Factor Risk Engine", () => {
  it("BDD-2012: Dual-Vault Isolation Enforces Zero Fiduciary Ruin", () => {
    // Attempt to allocate speculative derivatives inside Vault Alpha (Father Trust)
    const blockedResult = EosAladdinPortfolioRiskEngine.validateFiduciaryAllocation(
      "VAULT_ALPHA_FIDUCIARY",
      "SPECULATIVE_DERIVATIVE",
      1000,
    );
    assert.equal(blockedResult.permitted, false);
    assert.match(blockedResult.reason, /FIDUCIARY_VIOLATION_BLOCKED/);
    assert.equal(blockedResult.capitalProtected, 3000.0);

    // Permitted asset class in Vault Alpha
    const allowedResult = EosAladdinPortfolioRiskEngine.validateFiduciaryAllocation(
      "VAULT_ALPHA_FIDUCIARY",
      "AAA_SOVEREIGN_BOND",
      1000,
    );
    assert.equal(allowedResult.permitted, true);
    assert.match(allowedResult.reason, /FIDUCIARY_CONFORMING/);

    // Sandbox lab allows experiments
    const labResult = EosAladdinPortfolioRiskEngine.validateFiduciaryAllocation(
      "VAULT_BETA_QUANT_LAB",
      "SPECULATIVE_DERIVATIVE",
      50,
    );
    assert.equal(labResult.permitted, true);
  });

  it("BDD-2013: Parametric and Historical VaR / CVaR Computation", () => {
    const assets = [
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

    const metrics = EosAladdinPortfolioRiskEngine.computePortfolioRiskMetrics(assets);
    assert.ok(metrics.annualExpectedReturn > 0.05);
    assert.ok(metrics.annualPortfolioVolatility > 0.03);
    assert.ok(metrics.cvar99 >= metrics.var99);
    assert.ok(metrics.var99 >= metrics.var95);
    assert.ok(metrics.sharpeRatio > 0);
    assert.ok(metrics.sortinoRatio >= metrics.sharpeRatio);
  });

  it("BDD-2014: Monte Carlo 10,000-Path Stochastic Simulation", () => {
    const mc = EosAladdinPortfolioRiskEngine.runMonteCarloSimulation({
      initialPrincipal: 3000,
      annualReturn: 0.075,
      annualVolatility: 0.06,
      paths: 10000,
      seed: 42,
    });

    assert.equal(mc.paths, 10000);
    assert.equal(mc.initialPrincipal, 3000);
    assert.ok(mc.medianTerminalEquity > 3000);
    assert.equal(mc.probabilityOfRuin, 0.0); // Zero ruin for institutional portfolio
    assert.ok(mc.maxExpectedDrawdownPercent < 50.0);
  });

  it("BDD-2015: Historical Crisis Stress-Testing Execution", () => {
    const results = EosAladdinPortfolioRiskEngine.runHistoricalStressTests();
    assert.equal(results.length, 4);

    for (const r of results) {
      assert.equal(r.survived, true);
      assert.ok(r.resilienceDelta > 0);
      assert.ok(r.portfolioDrawdown < r.benchmark100EquityDrawdown);
    }

    const lehman = results.find((r) => r.crisis === "LEHMAN_2008");
    assert.ok(lehman);
    assert.ok(lehman.portfolioDrawdown < 15.0);
  });

  it("BDD-2016: All-Weather Risk Parity Allocation & Drift Detection", () => {
    const balancedReport = EosAladdinPortfolioRiskEngine.getAllWeatherAllocation();
    assert.equal(balancedReport.totalTargetWeightPercent, 100.0);
    assert.equal(balancedReport.rebalanceRequired, false);

    // Simulate severe drift
    const driftedHoldings = {
      "Long-Term Sovereign Bonds": 25.0, // target is 40.0 (-15% drift)
      "Global Equities Index (S&P 500 / VOO)": 45.0, // target is 30.0 (+15% drift)
    };
    const driftedReport = EosAladdinPortfolioRiskEngine.getAllWeatherAllocation(driftedHoldings);
    assert.equal(driftedReport.rebalanceRequired, true);
    assert.ok(driftedReport.maxDriftPercent >= 15.0);
  });

  it("BDD-2017: Fractional Kelly Guard Bounding", () => {
    const assets = [
      {
        name: "Index",
        assetClass: "GLOBAL_EQUITY_INDEX",
        weight: 1.0,
        expectedAnnualReturn: 0.1,
        annualVolatility: 0.15,
      },
    ];
    const metrics = EosAladdinPortfolioRiskEngine.computePortfolioRiskMetrics(assets);
    assert.ok(metrics.fractionalKellyFraction <= 0.025); // Clamped at 2.5% max
    assert.ok(metrics.fractionalKellyFraction > 0);
  });

  it("BDD-2018: Invariant Audit and Receipt Generation", () => {
    const receipt = EosAladdinPortfolioRiskEngine.audit();
    assert.equal(receipt.status, "VERIFIED");
    assert.equal(receipt.fiduciaryVaultSecurity, "SECURED");
    assert.equal(receipt.invariants.zeroFiduciaryRuin, true);
    assert.equal(receipt.invariants.varThresholdBound, true);
    assert.equal(receipt.invariants.maxDrawdownGuard, true);
    assert.equal(receipt.invariants.deterministicAllocationSum, true);
    assert.ok(receipt.receiptHash.length === 64);
  });
});

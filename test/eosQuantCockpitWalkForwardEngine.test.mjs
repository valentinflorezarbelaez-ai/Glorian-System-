/**
 * Test Suite: Quant Cockpit, Second-59.8 Atomic Trigger & Walk-Forward Calibrator
 * Verifies SPEC-376 / CHANGE-238 (BDD-2041..BDD-2048)
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EosQuantCockpitWalkForwardEngine,
  generateFullIqOptionUniverse153,
  recordAndLoadWalkForwardLedger,
} from "../src/core/eosQuantCockpitWalkForwardEngine.ts";
import { EosUniversalAssetPayoutOptimizerEngine } from "../src/core/eosUniversalAssetPayoutOptimizerEngine.ts";
import { PHASE8_TOOL_DEFINITIONS } from "../src/mcp/tools/eosMcpPhase8ToolDefinitions.ts";
import { createPhase8AgiHandlers } from "../src/mcp/tools/eosMcpPhase8AgiHandlers.ts";

function buildRangingOversoldM1(basePrice = 1.09) {
  const candles = [];
  let p = basePrice;
  for (let i = 0; i < 60; i++) {
    const delta = i < 55 ? (i % 2 === 0 ? 0.0001 : -0.0001) : -0.00018;
    const open = p;
    p += delta;
    let low = Math.min(open, p) - 0.00018;
    let high = Math.max(open, p) + 0.00018;
    if (i === 59) {
      low = p - 0.00055;
      high = Math.max(open, p) + 0.00005;
    }
    candles.push({ open, high, low, close: p });
  }
  return candles;
}

describe("SPEC-376: Autonomous Quant Cockpit, Second-59.8 Trigger & Walk-Forward Engine", () => {
  it("BDD-2041: Unbounded IQ Option Multi-Class Ingestion (153+ Assets) & Candle Normalization", () => {
    const marquee = [
      { asset_id: 1861, name: "EUR/USD", is_open: true, profit_percent: 92, precision: 6 },
      { asset_id: 1912, name: "Gold", is_open: true, profit_percent: 92, precision: 5 },
      { asset_id: 1916, name: "Bitcoin", is_open: true, profit_percent: 90, precision: 4 },
      { asset_id: 1910, name: "Apple Inc.", is_open: true, profit_percent: 92, precision: 4 },
      { asset_id: 1470, name: "US 500", is_open: true, profit_percent: 92, precision: 6 },
      { asset_id: 2145, name: "Pepe (OTC)", is_open: true, profit_percent: 92, precision: 6 },
    ];
    const bulk = new Array(154).fill(0).map((_, i) => ({
      asset_id: 3000 + i,
      name: i % 2 === 0 ? `PAIR${i}/USD` : `SYNTH${i} (OTC)`,
      is_open: true,
      profit_percent: 88,
      precision: 5,
    }));

    const ingested = EosQuantCockpitWalkForwardEngine.ingestIqOptionAssets([...marquee, ...bulk]);
    assert.equal(ingested.length, 160, "Must ingest all assets dynamically without artificial ceiling");

    const cats = new Set(ingested.slice(0, 6).map((a) => a.category));
    assert.ok(cats.has("FOREX") && cats.has("COMMODITIES") && cats.has("CRYPTO") && cats.has("EQUITIES"));
    assert.ok(cats.has("INDICES_ETFS") && cats.has("OTC"));

    const normalized = EosQuantCockpitWalkForwardEngine.normalizeCandles([
      { open: 1.1, max: 1.102, min: 1.098, close: 1.101, from: "2026-11-20T14:00:00Z" },
    ]);
    assert.equal(normalized.length, 1);
    assert.equal(normalized[0].high, 1.102);
    assert.equal(normalized[0].low, 1.098);
  });

  it("BDD-2042: Expert 6-Factor Filter Rejects Manipulation Spikes & Elects Positive-EV Setups", () => {
    const quotes = EosUniversalAssetPayoutOptimizerEngine.generateCatalogQuotes();
    const aligned = quotes[0];
    const cleanM1 = EosQuantCockpitWalkForwardEngine.softenOversizedSignalWick(aligned.candlesM1);
    const spikeM1 = aligned.candlesM1.map((c, idx) =>
      idx === aligned.candlesM1.length - 1
        ? { open: c.open, high: c.open + 0.05, low: c.low, close: c.open + 0.04 }
        : c,
    );
    const flatM1 = new Array(60).fill(0).map(() => ({ open: 1.1, high: 1.1, low: 1.1, close: 1.1 }));

    const [eurAsset, otcAsset, lowAsset] = EosQuantCockpitWalkForwardEngine.ingestIqOptionAssets([
      { asset_id: 1861, name: "EUR/USD", is_open: true, profit_percent: 92 },
      { asset_id: 2145, name: "Pepe (OTC)", is_open: true, profit_percent: 92 },
      { asset_id: 9999, name: "AUD/USD", is_open: true, profit_percent: 72 },
    ]);

    const spikeVerdict = EosQuantCockpitWalkForwardEngine.evaluateExpertAsset(eurAsset, { m1: spikeM1 });
    assert.equal(spikeVerdict.status, "REJECTED_VOLATILITY_SPIKE");

    const flatVerdict = EosQuantCockpitWalkForwardEngine.evaluateExpertAsset(eurAsset, { m1: flatM1 });
    assert.equal(flatVerdict.status, "REJECTED_VOLATILITY_SPIKE");

    const lowVerdict = EosQuantCockpitWalkForwardEngine.evaluateExpertAsset(lowAsset, { m1: aligned.candlesM1 });
    assert.equal(lowVerdict.status, "REJECTED_LOW_PAYOUT");

    const otcBlocked = EosQuantCockpitWalkForwardEngine.evaluateExpertAsset(otcAsset, { m1: aligned.candlesM1 }, false);
    assert.equal(otcBlocked.status, "REJECTED_OTC_POLICY");

    const qualifiedTrend = EosQuantCockpitWalkForwardEngine.evaluateExpertAsset(eurAsset, {
      m15: aligned.candlesM15,
      m5: aligned.candlesM5,
      m1: cleanM1,
    });
    assert.equal(qualifiedTrend.status, "QUALIFIED_STANDBY");
    assert.equal(qualifiedTrend.strategy, "TREND_PULLBACK");
    assert.ok(qualifiedTrend.expectedValuePerDollar > 0);

    const rangeVerdict = EosQuantCockpitWalkForwardEngine.evaluateExpertAsset(eurAsset, {
      m1: buildRangingOversoldM1(),
    });
    assert.notEqual(
      rangeVerdict.status,
      "REJECTED_VOLATILITY_SPIKE",
      "Controlled ranging pullback must stay under 3.0x spike guard",
    );
    assert.ok(
      rangeVerdict.status === "QUALIFIED_STANDBY" || rangeVerdict.status === "REJECTED_CHOPPY_NOISE",
      "Ranging check must run deterministically without throwing",
    );
  });

  it("BDD-2043: Atomic Second-59.8 Trigger Gates Execute & Abort Deterministically", () => {
    const boundaryMs = Date.UTC(2026, 10, 20, 14, 0, 59, 800);
    const armed = EosQuantCockpitWalkForwardEngine.evaluateAtomicTrigger({
      serverEpochMs: boundaryMs,
      clockDriftMs: 10,
      networkLatencyMs: 65,
    });
    assert.equal(armed.status, "ARMED_FIRE");
    assert.equal(armed.safeToExecute, true);

    const openMs = Date.UTC(2026, 10, 20, 14, 1, 0, 150);
    const armedOpen = EosQuantCockpitWalkForwardEngine.evaluateAtomicTrigger({
      serverEpochMs: openMs,
      clockDriftMs: 0,
      networkLatencyMs: 50,
    });
    assert.equal(armedOpen.status, "ARMED_FIRE");
    assert.equal(armedOpen.safeToExecute, true);

    const late = EosQuantCockpitWalkForwardEngine.evaluateAtomicTrigger({
      serverEpochMs: Date.UTC(2026, 10, 20, 14, 1, 2, 0),
      clockDriftMs: 0,
      networkLatencyMs: 50,
    });
    assert.equal(late.status, "ABORT_LATE_ENTRY");
    assert.equal(late.safeToExecute, false);

    const waiting = EosQuantCockpitWalkForwardEngine.evaluateAtomicTrigger({
      serverEpochMs: Date.UTC(2026, 10, 20, 14, 1, 30, 0),
      clockDriftMs: 0,
      networkLatencyMs: 50,
    });
    assert.equal(waiting.status, "WAITING_BOUNDARY");
    assert.equal(waiting.safeToExecute, false);

    const highLat = EosQuantCockpitWalkForwardEngine.evaluateAtomicTrigger({
      serverEpochMs: boundaryMs,
      clockDriftMs: 0,
      networkLatencyMs: 350,
    });
    assert.equal(highLat.status, "ABORT_HIGH_LATENCY");
    assert.equal(highLat.safeToExecute, false);

    const highDrift = EosQuantCockpitWalkForwardEngine.evaluateAtomicTrigger({
      serverEpochMs: boundaryMs,
      clockDriftMs: 280,
      networkLatencyMs: 50,
    });
    assert.equal(highDrift.status, "ABORT_CLOCK_DRIFT");
    assert.equal(highDrift.safeToExecute, false);
  });

  it("BDD-2044: Quarter-Kelly Clamp & Zero-Martingale Enforcement After Loss", () => {
    const baseMs = Date.UTC(2026, 10, 20, 13, 0, 0);
    const strongHistory = new Array(20).fill(0).map((_, i) => ({
      timestampMs: baseMs + i * 60000,
      assetName: "EUR/USD",
      category: "FOREX",
      strategy: "TREND_PULLBACK",
      direction: "CALL",
      stakeUsd: 100,
      payoutPercent: 92,
      result: i < 16 ? "win" : "loss",
      pnlUsd: i < 16 ? 92 : -100,
    }));

    const wfAfterWin = EosQuantCockpitWalkForwardEngine.calibrateWalkForward(strongHistory, 14100.35, false, 1.0);
    assert.ok(wfAfterWin.recommendedKellyPercent >= 0.5 && wfAfterWin.recommendedKellyPercent <= 2.0);
    assert.ok(wfAfterWin.profitFactor > 1.5);

    const wfAfterLoss = EosQuantCockpitWalkForwardEngine.calibrateWalkForward(strongHistory, 14100.35, true, 1.0);
    assert.equal(wfAfterLoss.zeroMartingaleEnforced, true);
    assert.ok(wfAfterLoss.recommendedKellyPercent <= 1.0, "Zero Martingale must prevent increasing stake after a loss");
  });

  it("BDD-2045: Alpha-Decay Automatic Strategy Quarantine (< 52% Over >= 20 Trades)", () => {
    const baseMs = Date.UTC(2026, 10, 20, 15, 0, 0);
    const decayingTrades = new Array(25).fill(0).map((_, i) => ({
      timestampMs: baseMs + i * 60000,
      assetName: "Bitcoin",
      category: "CRYPTO",
      strategy: "RANGE_REVERSAL",
      direction: "PUT",
      stakeUsd: 100,
      payoutPercent: 90,
      result: i < 10 ? "win" : "loss",
      pnlUsd: i < 10 ? 90 : -100,
    }));

    const wf = EosQuantCockpitWalkForwardEngine.calibrateWalkForward(decayingTrades, 14100.35, false, 1.0);
    assert.ok(wf.quarantinedBuckets.includes("STRATEGY:RANGE_REVERSAL"));
    assert.ok(wf.quarantinedBuckets.includes("CATEGORY:CRYPTO"));
    assert.equal(wf.recommendedKellyPercent, 0.5, "Negative-edge Kelly must clamp cleanly to 0.5% floor");
  });

  it("BDD-2046 & BDD-2047: Dual-Vault Shield, Regular Account Lock & Top-1 60s Concurrency HUD", () => {
    const quotes = EosUniversalAssetPayoutOptimizerEngine.generateCatalogQuotes();
    const cleanM1 = EosQuantCockpitWalkForwardEngine.softenOversizedSignalWick(quotes[0].candlesM1);
    const rawAssets = [
      { asset_id: 1861, name: "EUR/USD", is_open: true, profit_percent: 92 },
      { asset_id: 1912, name: "Gold", is_open: true, profit_percent: 93 },
    ];
    const candlesByAssetId = {
      1861: { m15: quotes[0].candlesM15, m5: quotes[0].candlesM5, m1: cleanM1 },
      1912: { m15: quotes[0].candlesM15, m5: quotes[0].candlesM5, m1: cleanM1 },
    };

    const report = EosQuantCockpitWalkForwardEngine.buildCockpitReport({
      balances: [
        { balance_id: 1254340790, amount: 3707.8, currency: "USD", type: "regular" },
        { balance_id: 1254340791, amount: 14100.35, currency: "USD", type: "training" },
      ],
      capabilityMode: "read-only",
      rawAssets,
      candlesByAssetId,
      serverEpochMs: Date.UTC(2026, 10, 20, 14, 0, 59, 800),
      clockDriftMs: 0,
      networkLatencyMs: 60,
      activeOpenPositions: 0,
    });

    assert.equal(report.accountShield.activeAccountType, "training");
    assert.equal(report.accountShield.demoBalanceUsd, 14100.35);
    assert.equal(report.accountShield.regularBalanceLockedUsd, 3707.8);
    assert.equal(report.accountShield.vaultAlphaProtectedUsd, 3000);
    assert.equal(report.expirySeconds, 60);
    assert.ok(report.topSniperSetup !== null);
    assert.equal(report.rankedCandidates.filter((c) => c.status === "TOP_SNIPER_A_PLUS").length, 1);
    assert.ok(report.hudText.includes("GLORIAN SYSTEM — ANTIGRAVITY QUANT COCKPIT HUD"));

    const blockedByConcurrency = EosQuantCockpitWalkForwardEngine.buildCockpitReport({
      balances: [{ balance_id: 1254340791, amount: 14100.35, currency: "USD", type: "training" }],
      rawAssets,
      candlesByAssetId,
      activeOpenPositions: 1,
    });
    assert.equal(
      blockedByConcurrency.topSniperSetup,
      null,
      "Must halt election when an active position is already open",
    );
  });

  it("BDD-2048: Cryptographic Audit Receipt, 156+ Universe, Durable Ledger & Phase-8 MCP Registration", () => {
    const fullCatalog = generateFullIqOptionUniverse153();
    assert.ok(fullCatalog.length >= 153, `Expected >= 153 assets, got ${fullCatalog.length}`);

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eos-wf-ledger-"));
    try {
      const trades = recordAndLoadWalkForwardLedger(tmpRoot, {
        timestampMs: Date.UTC(2026, 10, 20, 15, 0, 0),
        assetName: "EUR/USD",
        category: "FOREX",
        strategy: "TREND_PULLBACK",
        direction: "CALL",
        stakeUsd: 100,
        payoutPercent: 92,
        pnlUsd: 92,
        result: "win",
      });
      assert.equal(trades.length, 1);
      assert.equal(trades[0].assetName, "EUR/USD");
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }

    const receipt = EosQuantCockpitWalkForwardEngine.audit();
    assert.equal(receipt.status, "VERIFIED");
    assert.ok(receipt.metrics.liveSampleAssetsIngested >= 153);
    assert.equal(receipt.metrics.categoriesCovered, 6);
    assert.equal(receipt.receiptHash.length, 64);
    for (const [k, v] of Object.entries(receipt.invariants)) {
      assert.equal(v, true, `Invariant ${k} must hold true`);
    }

    const toolDef = PHASE8_TOOL_DEFINITIONS.find((t) => t.name === "eos_quant_cockpit_walk_forward_audit");
    assert.ok(toolDef, "Phase 8 tool definition for eos_quant_cockpit_walk_forward_audit must exist");

    const handlers = createPhase8AgiHandlers({ projectRoot: process.cwd() });
    assert.equal(typeof handlers.eos_quant_cockpit_walk_forward_audit, "function");
    const mcpRes = handlers.eos_quant_cockpit_walk_forward_audit({});
    assert.equal(mcpRes.status, "VERIFIED");
  });
});

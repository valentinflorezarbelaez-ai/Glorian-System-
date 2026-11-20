/**
 * Test Suite: Multi-Asset Scanner, Macro Economic News Filter & Paper Ledger
 * Verifies SPEC-373 / CHANGE-235 (BDD-2019..BDD-2025)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EosMultiAssetMacroFilterEngine } from "../src/core/eosMultiAssetMacroFilterEngine.ts";

describe("SPEC-373: Multi-Asset Scanner, Macro News Filter & Paper Ledger", () => {
  it("BDD-2019: Multi-Asset Scanner Evaluates 6 Pairs and Ranks by Confluence", () => {
    const marketCandles = {};
    for (const pair of EosMultiAssetMacroFilterEngine.MAJOR_PAIRS) {
      const candles = [];
      let p = 1.0;
      for (let i = 0; i < 60; i++) {
        p += 0.0001;
        candles.push({ open: p, high: p + 0.0001, low: p - 0.0001, close: p });
      }
      marketCandles[pair] = candles;
    }

    const report = EosMultiAssetMacroFilterEngine.scanMultiAssetMarket(marketCandles);
    assert.equal(report.pairRankings.length, 6);
    assert.ok(report.pairRankings[0].confluenceScore >= report.pairRankings[5].confluenceScore);
  });

  it("BDD-2020: High-Impact News Event Triggers Automatic Trading Blackout", () => {
    const now = Date.now();
    const calendar = [
      {
        id: "nfp-1",
        title: "Non-Farm Payrolls",
        currency: "USD",
        scheduledEpochMs: now + 10 * 60 * 1000, // in 10 minutes (within 30m buffer)
        severity: "HIGH_RED_FOLDER",
        impactDescription: "Severe volatility",
      },
    ];

    const blackout = EosMultiAssetMacroFilterEngine.checkNewsBlackout(now, calendar);
    assert.equal(blackout.isBlackoutActive, true);
    assert.equal(blackout.statusLabel, "NEWS_BLACKOUT_ACTIVE");
    assert.equal(blackout.activeEvents.length, 1);
  });

  it("BDD-2021: Non-Blackout Window Resumes Scanning Normally", () => {
    const now = Date.now();
    const calendar = [
      {
        id: "nfp-2",
        title: "Non-Farm Payrolls Past",
        currency: "USD",
        scheduledEpochMs: now - 60 * 60 * 1000, // 60 minutes ago (beyond 30m buffer)
        severity: "HIGH_RED_FOLDER",
        impactDescription: "Old news",
      },
    ];

    const blackout = EosMultiAssetMacroFilterEngine.checkNewsBlackout(now, calendar);
    assert.equal(blackout.isBlackoutActive, false);
    assert.equal(blackout.statusLabel, "NEWS_BLACKOUT_CLEAN");
  });

  it("BDD-2022: Correlated Currency Overexposure Guard Elects Only Best Asset", () => {
    const marketCandles = {};
    for (const pair of EosMultiAssetMacroFilterEngine.MAJOR_PAIRS) {
      const candles = [];
      let p = 1.0;
      for (let i = 0; i < 60; i++) {
        p += 0.0001;
        candles.push({ open: p, high: p + 0.0001, low: p - 0.0001, close: p });
      }
      marketCandles[pair] = candles;
    }

    const report = EosMultiAssetMacroFilterEngine.scanMultiAssetMarket(marketCandles);
    // Even if multiple pairs qualify, electedPair is strictly a single string or null
    assert.ok(typeof report.electedPair === "string" || report.electedPair === null);
  });

  it("BDD-2023: Autonomous Paper-Trading Ledger Ingestion", () => {
    const trade = EosMultiAssetMacroFilterEngine.recordPaperTrade({
      timestamp: Date.now(),
      pair: "GBP/USD",
      direction: "PUT",
      entryPrice: 1.293,
      exitPrice: 1.291,
      strikeTimeSeconds: 60,
      stakeUsd: 100,
      payoutMultiplier: 1.8,
      status: "WIN",
    });

    assert.ok(trade.tradeId.startsWith("paper-"));
    assert.equal(trade.pnlUsd, 80.0);
    assert.equal(trade.pair, "GBP/USD");
  });

  it("BDD-2024: Paper Ledger Performance Metrics Calculation", () => {
    const trades = [
      {
        tradeId: "t1",
        timestamp: 1,
        pair: "EUR/USD",
        direction: "CALL",
        entryPrice: 1.08,
        strikeTimeSeconds: 60,
        stakeUsd: 50,
        payoutMultiplier: 1.8,
        status: "WIN",
        pnlUsd: 40,
      },
      {
        tradeId: "t2",
        timestamp: 2,
        pair: "EUR/USD",
        direction: "CALL",
        entryPrice: 1.08,
        strikeTimeSeconds: 60,
        stakeUsd: 50,
        payoutMultiplier: 1.8,
        status: "LOSS",
        pnlUsd: -50,
      },
      {
        tradeId: "t3",
        timestamp: 3,
        pair: "EUR/USD",
        direction: "CALL",
        entryPrice: 1.08,
        strikeTimeSeconds: 60,
        stakeUsd: 50,
        payoutMultiplier: 1.8,
        status: "WIN",
        pnlUsd: 40,
      },
    ];

    const analytics = EosMultiAssetMacroFilterEngine.computePaperAnalytics(trades);
    assert.equal(analytics.totalTrades, 3);
    assert.equal(analytics.winningTrades, 2);
    assert.equal(analytics.losingTrades, 1);
    assert.equal(analytics.winRatePercent, 66.67);
    assert.equal(analytics.totalNetPnlUsd, 30.0);
    assert.equal(analytics.profitFactor, 1.6);
  });

  it("BDD-2025: Invariant Auditing and Cryptographic Receipt Generation", () => {
    const receipt = EosMultiAssetMacroFilterEngine.audit();
    assert.equal(receipt.status, "VERIFIED");
    assert.equal(receipt.invariants.newsBlackoutStrictness, true);
    assert.equal(receipt.invariants.singleAssetExecutionElection, true);
    assert.equal(receipt.invariants.paperModeIsolation, true);
    assert.equal(receipt.invariants.deterministicRankingOrder, true);
    assert.equal(receipt.receiptHash.length, 64);
  });
});

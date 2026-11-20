/**
 * Test Suite: Tri-Temporal Fractal Alignment Engine, Prop-Firm Governor & WhatsApp Dispatcher
 * Verifies SPEC-374 / CHANGE-236 (BDD-2026..BDD-2032)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { EosTriTemporalPropFirmEngine } from "../src/core/eosTriTemporalPropFirmEngine.ts";

function generateTestCandles(count = 60, startPrice = 1.09, step = 0.0001, lastWick = "none") {
  const candles = [];
  let p = startPrice;
  for (let i = 0; i < count; i++) {
    p += step;
    let high = p + 0.0001;
    let low = p - 0.0001;
    let open = p - step / 2;
    let close = p;

    if (i === count - 1) {
      if (lastWick === "bullish_rejection") {
        low = close - 0.0008; // Long lower rejection wick (BinaryTeach)
        high = close + 0.0001;
      } else if (lastWick === "bearish_rejection") {
        high = close + 0.0008; // Long upper rejection wick
        low = close - 0.0001;
      }
    }
    candles.push({ open, high, low, close });
  }
  return candles;
}

describe("SPEC-374: Tri-Temporal Fractal Prop-Firm Engine & WhatsApp Dispatcher", () => {
  it("BDD-2026: Tri-Temporal Harmonic Alignment Validates 3 Timeframes", () => {
    // M15 Bullish trend
    const m15 = generateTestCandles(60, 1.08, 0.0002);

    // M5 oscillating pullback into Fibonacci golden zone (RSI ~50)
    const m5 = [];
    let p5 = 1.09;
    for (let i = 0; i < 60; i++) {
      const delta = i % 2 === 0 ? 0.0002 : -0.0002;
      p5 += delta;
      m5.push({ open: p5 - delta, high: p5 + 0.0001, low: p5 - 0.0001, close: p5 });
    }

    // M1 Bullish BinaryTeach rejection wick
    const m1 = generateTestCandles(60, 1.092, 0.0001, "bullish_rejection");

    const result = EosTriTemporalPropFirmEngine.evaluateTriTemporalAlignment(m15, m5, m1);
    assert.equal(result.isAligned, true);
    assert.equal(result.harmonicDirection, "CALL");
    assert.ok(result.alignmentConfidence >= 0.85);
    assert.equal(result.m15.bias, "BULLISH");
    assert.equal(result.m5.bias, "BULLISH");
    assert.equal(result.m1.bias, "BULLISH");
  });

  it("BDD-2027: Conflicting Timeframe Blocks Execution Fail-Closed", () => {
    // M15 Bearish trend (descending prices)
    const m15 = generateTestCandles(60, 1.1, -0.0002);
    // M5 Bullish
    const m5 = generateTestCandles(60, 1.09, 0.0001);
    // M1 Neutral
    const m1 = generateTestCandles(60, 1.09, 0.0);

    const result = EosTriTemporalPropFirmEngine.evaluateTriTemporalAlignment(m15, m5, m1);
    assert.equal(result.isAligned, false);
    assert.equal(result.harmonicDirection, null);
    assert.equal(result.alignmentConfidence, 0.5);
  });

  it("BDD-2028: Daily Drawdown Guard Enforces Hard Stop at -4.5%", () => {
    const accountBreach = {
      initialBalanceUsd: 100000,
      currentBalanceUsd: 95400, // -4.6% drawdown from daily peak
      dailyPeakBalanceUsd: 100000,
      allTimePeakBalanceUsd: 100000,
    };

    const status = EosTriTemporalPropFirmEngine.evaluatePropFirmRisk(accountBreach);
    assert.equal(status.status, "DAILY_HALTED");
    assert.ok(status.dailyDrawdownPercent >= 4.5);
    assert.equal(status.dailyLossLimitPercent, 4.5);
  });

  it("BDD-2029: Cumulative Total Drawdown Enforces Hard Stop at -9.0%", () => {
    const accountBreach = {
      initialBalanceUsd: 100000,
      currentBalanceUsd: 90800, // -9.2% total drawdown from all-time peak
      dailyPeakBalanceUsd: 92000,
      allTimePeakBalanceUsd: 100000,
    };

    const status = EosTriTemporalPropFirmEngine.evaluatePropFirmRisk(accountBreach);
    assert.equal(status.status, "TOTAL_HALTED");
    assert.ok(status.totalDrawdownPercent >= 9.0);
    assert.equal(status.totalLossLimitPercent, 9.0);
  });

  it("BDD-2030: WhatsApp Trade Open Alert Payload Generation", () => {
    const alert = EosTriTemporalPropFirmEngine.formatTradeOpenAlert({
      pair: "EUR/USD",
      direction: "CALL",
      entryPrice: 1.09265,
      strikeSeconds: 60,
      confidence: 0.88,
      m15Reason: "M15 institutional bull trend aligned (EMA 9>20>50)",
      m5Reason: "M5 healthy pullback into Fibonacci golden zone",
      m1Reason: "M1 BinaryTeach strong lower rejection wick (58%)",
    });

    assert.equal(alert.messageType, "TRADE_OPEN");
    assert.ok(alert.formattedText.includes("*🚨 GLORIAN TRADE EJECUTADO (MODO DEMO)*"));
    assert.ok(alert.formattedText.includes("*Par:* `EUR/USD`"));
    assert.ok(alert.formattedText.includes("*CALL*"));
    assert.ok(alert.formattedText.includes("1.09265"));
    assert.ok(alert.formattedText.includes("88%"));
    assert.ok(alert.formattedText.includes("BinaryTeach"));
  });

  it("BDD-2031: WhatsApp Outcome Alert & Daily Summary Generation", () => {
    const winCloseAlert = EosTriTemporalPropFirmEngine.formatTradeCloseAlert({
      pair: "GBP/USD",
      direction: "PUT",
      outcome: "WIN",
      pnlUsd: 119.85,
      newBalance: 14220.2,
      currentDailyPnlPercent: 1.85,
    });

    assert.equal(winCloseAlert.messageType, "TRADE_CLOSE");
    assert.ok(winCloseAlert.formattedText.includes("OPERACIÓN GANADA (WIN)"));
    assert.ok(winCloseAlert.formattedText.includes("+$119.85 USD"));

    const summary = EosTriTemporalPropFirmEngine.formatExecutiveDailySummary({
      totalTrades: 5,
      winRate: 80.0,
      netPnlUsd: 385.5,
      propFirmStatus: "EVALUATING (SAFE)",
      dailyDrawdown: 0.85,
    });

    assert.equal(summary.messageType, "DAILY_SUMMARY");
    assert.ok(summary.formattedText.includes("*📊 GLORIAN RESUMEN EJECUTIVO DE SESIÓN*"));
    assert.ok(summary.formattedText.includes("80.0%"));
    assert.ok(summary.formattedText.includes("+$385.50 USD"));
    assert.ok(summary.formattedText.includes("$3,000.00 USD (INTACTO / SEGURO)"));
  });

  it("BDD-2032: Invariant Audit and Receipt Generation", () => {
    const receipt = EosTriTemporalPropFirmEngine.audit();
    assert.equal(receipt.status, "VERIFIED");
    assert.equal(receipt.invariants.triTemporalHarmonicAlignment, true);
    assert.equal(receipt.invariants.propFirmSurvivalInvariant, true);
    assert.equal(receipt.invariants.singleExecutionLock, true);
    assert.equal(receipt.invariants.practiceModeIsolation, true);
    assert.equal(typeof receipt.receiptHash, "string");
    assert.equal(receipt.receiptHash.length, 64);

    const receiptPath = path.resolve(process.cwd(), "docs/evidence/TRI_TEMPORAL_PROP_FIRM_RECEIPT.json");
    assert.ok(fs.existsSync(receiptPath));
  });
});

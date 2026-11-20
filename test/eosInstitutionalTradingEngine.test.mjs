/**
 * @file eosInstitutionalTradingEngine.test.mjs
 * @description BDD test suite for SPEC-371 / CHANGE-233: Sovereign Institutional Quantitative Trading Engine & Byzantine Consensus Crucible.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  computeIndicators,
  scanMarketOpportunity,
  auditRiskInvariants,
  evaluateByzantineCouncil,
  EosInstitutionalTradingEngine,
} from "../src/core/eosInstitutionalTradingEngine.ts";

function generateTestCandles(base = 1.0925, count = 60) {
  const candles = [];
  let p = base;
  for (let i = 0; i < count; i++) {
    const change = Math.sin(i / 5) * 0.0003 + (i % 7 === 0 ? 0.0004 : -0.0002);
    const open = p;
    p += change;
    candles.push({ open, high: Math.max(open, p) + 0.00015, low: Math.min(open, p) - 0.00015, close: p });
  }
  return candles;
}

function getBaseRiskState() {
  return {
    accountType: "training",
    balanceUsd: 14100.35,
    dailyDrawdownPct: 0.0,
    consecutiveLosses: 0,
    dailyProfitNetUsd: 0.0,
    openPositionsCount: 0,
    trailingStopFloorUsd: -120.0,
    isHalted: false,
  };
}

test("BDD-2005: computeIndicators computes deterministic arithmetic indicators across 60 candles", () => {
  const candles = generateTestCandles();
  const ind = computeIndicators(candles);

  assert.ok(Number.isFinite(ind.rsi), "RSI must be finite");
  assert.ok(ind.rsi >= 0 && ind.rsi <= 100, "RSI must be bounded between 0 and 100");
  assert.ok(Number.isFinite(ind.ema9), "EMA9 must be finite");
  assert.ok(Number.isFinite(ind.ema20), "EMA20 must be finite");
  assert.ok(Number.isFinite(ind.ema50), "EMA50 must be finite");
  assert.ok(ind.bollinger.superior > ind.bollinger.media, "BB upper > media");
  assert.ok(ind.bollinger.media > ind.bollinger.inferior, "BB media > lower");
  assert.ok(Number.isFinite(ind.zScore), "Z-score must be finite");
  assert.ok(Number.isFinite(ind.adx), "ADX must be finite");
});

test("BDD-2006: RiskGovernor vetoes trade if daily drawdown or consecutive loss threshold is breached", () => {
  const state = getBaseRiskState();
  state.dailyDrawdownPct = 3.2; // Breached > 3.0%
  state.consecutiveLosses = 3;

  const candles = generateTestCandles();
  const ind = computeIndicators(candles);
  const signals = [
    {
      strategy: "TREND_PULLBACK",
      direction: "CALL",
      confidence: 0.9,
      suggestedExpirySec: 60,
      reasons: ["Strong trend"],
    },
  ];

  const verdict = evaluateByzantineCouncil(signals, ind, state);
  assert.strictEqual(verdict.riskGovernorApproved, false, "RiskGovernor must veto when drawdown breached");
  assert.strictEqual(verdict.consensusReached, false, "Consensus must fail when RiskGovernor vetoes");
  assert.strictEqual(verdict.direction, "NEUTRAL", "Direction must fall back to NEUTRAL");
});

test("BDD-2007: Byzantine Council reaches consensus when strategy judges and RiskGovernor agree", () => {
  const state = getBaseRiskState();
  const candles = generateTestCandles();
  const ind = computeIndicators(candles);

  // Synthesize a signal conforming to technical alignment
  const signals = [
    {
      strategy: "QUANT_MEAN_REVERSION",
      direction: "CALL",
      confidence: 0.89,
      suggestedExpirySec: 60,
      reasons: ["Statistical deviation"],
    },
  ];

  const verdict = evaluateByzantineCouncil(signals, ind, state);
  assert.ok(verdict.receiptHash.length === 64, "Receipt hash must be valid SHA-256");
  assert.ok(verdict.votes.length === 4, "Must have exactly 4 judge votes");
  assert.strictEqual(verdict.riskGovernorApproved, true, "RiskGovernor must approve on valid practice state");
});

test("BDD-2008: Strict concurrency lock forbids new positions when an active trade exists", () => {
  const state = getBaseRiskState();
  state.openPositionsCount = 1; // 1 position already open

  const candles = generateTestCandles();
  const ind = computeIndicators(candles);
  const signals = [
    {
      strategy: "LIQUIDITY_SWEEP",
      direction: "CALL",
      confidence: 0.88,
      suggestedExpirySec: 60,
      reasons: ["Lower sweep"],
    },
  ];

  const verdict = evaluateByzantineCouncil(signals, ind, state);
  assert.strictEqual(verdict.riskGovernorApproved, false, "RiskGovernor must veto when openPositionsCount >= 1");
  assert.strictEqual(verdict.consensusReached, false, "Consensus must be blocked by concurrency lock");
});

test("BDD-2009: auditRiskInvariants identifies breaches of practice mode and concurrency ceiling", () => {
  const safeState = getBaseRiskState();
  const safeAudit = auditRiskInvariants(safeState);
  assert.strictEqual(safeAudit.conforming, true, "Base state must be conforming");
  assert.strictEqual(safeAudit.violations.length, 0, "No violations expected");

  const unsafeState = {
    ...safeState,
    accountType: "regular", // Attempting to run unapproved real money
    openPositionsCount: 2, // Concurrency breach
  };
  const unsafeAudit = auditRiskInvariants(unsafeState);
  assert.strictEqual(unsafeAudit.conforming, false, "Unsafe state must fail audit");
  assert.ok(unsafeAudit.violations.some((v) => v.includes("accountType must be 'training'")));
  assert.ok(unsafeAudit.violations.some((v) => v.includes("exceeds concurrency ceiling of 1")));
});

test("BDD-2010: EosInstitutionalTradingEngine static audit facade produces verified receipt", () => {
  const receipt = EosInstitutionalTradingEngine.audit("EUR/USD");
  assert.strictEqual(receipt.specRef, "SPEC-371");
  assert.strictEqual(receipt.status, "VERIFIED");
  assert.strictEqual(receipt.asset, "EUR/USD");
  assert.ok(receipt.receiptHash.length === 64);
});

test("BDD-2011: scanMarketOpportunity coordinates indicators and Byzantine council", () => {
  const candles = generateTestCandles();
  const state = getBaseRiskState();
  const scan = scanMarketOpportunity("EUR/USD", candles, state);
  assert.strictEqual(scan.asset, "EUR/USD");
  assert.ok(Number.isFinite(scan.spotPrice));
  assert.ok(scan.verdict.receiptHash.length === 64);
});

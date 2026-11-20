/**
 * @file cliInstitutionalTradingEngine.mjs
 * @description CLI handler for SPEC-371 / CHANGE-233: Sovereign Institutional Quantitative Trading Engine & Byzantine Consensus Crucible.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeIndicators,
  scanMarketOpportunity,
  auditRiskInvariants,
} from "../../src/core/eosInstitutionalTradingEngine.ts";
import { resolveEvidencePath } from "../../src/core/eosEvidencePaths.ts";
import { handleMultiAssetMacroCommand } from "./cliMultiAssetMacroEngine.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function getReceiptPath(root = ROOT) {
  return resolveEvidencePath("INSTITUTIONAL_TRADING_ENGINE_RECEIPT.json", root);
}

function getMockCandles(basePrice = 1.0925, count = 60) {
  const candles = [];
  let p = basePrice;
  for (let i = 0; i < count; i++) {
    const change = Math.sin(i / 5) * 0.0003 + (i % 7 === 0 ? 0.0004 : -0.0002);
    const open = p;
    p += change;
    const high = Math.max(open, p) + 0.00015;
    const low = Math.min(open, p) - 0.00015;
    candles.push({ open, high, low, close: p });
  }
  return candles;
}

function getDefaultRiskState() {
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

const HANDLERS = {};

async function cmd_trading_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const riskState = getDefaultRiskState();
  const candles = getMockCandles();
  const scan = scanMarketOpportunity("EUR/USD", candles, riskState);
  const riskAudit = auditRiskInvariants(riskState);

  const receipt = {
    receiptId: `trading-rcpt-${Date.now()}`,
    timestampIso: new Date().toISOString(),
    specRef: "SPEC-371",
    engine: "EosInstitutionalTradingEngine",
    accountType: riskState.accountType,
    concurrencyConforming: riskState.openPositionsCount <= 1,
    riskInvariantsConforming: riskAudit.conforming,
    strategiesRegistered: 4,
    byzantineJudgesCount: 4,
    sampleReceiptHash: scan.verdict.receiptHash,
    status: riskAudit.conforming ? "VERIFIED" : "BREACH_DETECTED",
  };

  const receiptPath = getReceiptPath(ROOT);
  try {
    fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
  } catch (err) {
    console.error(`Warning: Could not persist evidence receipt: ${err.message}`);
  }

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log("=== Sovereign Institutional Quantitative Trading Engine & Byzantine Consensus (SPEC-371) ===");
    console.log(`Receipt ID            : ${receipt.receiptId}`);
    console.log(`Status                : ${receipt.status}`);
    console.log(`Practice Mode (Demo)  : ${receipt.accountType === "training" ? "CONFORMING" : "VIOLATION"}`);
    console.log(`Concurrency Guard     : ${receipt.concurrencyConforming ? "PASS (1 max)" : "FAIL"}`);
    console.log(`Strategies Registered : ${receipt.strategiesRegistered}`);
    console.log(`Byzantine Judges      : ${receipt.byzantineJudgesCount}`);
    console.log(`Receipt Hash          : ${receipt.sampleReceiptHash}`);
  }
  return true;
}

async function cmd_trading_scan(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const asset =
    args.find((a) => !a.startsWith("--") && !a.startsWith("toolchain:") && a !== commandContext?.command) || "EUR/USD";
  const riskState = getDefaultRiskState();
  const candles = getMockCandles();
  const scan = scanMarketOpportunity(asset, candles, riskState);

  if (isJson) {
    console.log(JSON.stringify(scan, null, 2));
  } else {
    console.log(`=== Institutional Quantitative Market Scanner (${scan.asset}) (SPEC-371) ===`);
    console.log(`Spot Price         : ${scan.spotPrice.toFixed(5)}`);
    console.log(`RSI (14)           : ${scan.indicators.rsi.toFixed(2)}`);
    console.log(
      `EMA 9 / 20 / 50    : ${scan.indicators.ema9.toFixed(5)} / ${scan.indicators.ema20.toFixed(5)} / ${scan.indicators.ema50.toFixed(5)}`,
    );
    console.log(`ADX (14)           : ${scan.indicators.adx.toFixed(2)}`);
    console.log(
      `Bollinger (20,2.2) : [Inf: ${scan.indicators.bollinger.inferior.toFixed(5)} | Sup: ${scan.indicators.bollinger.superior.toFixed(5)}]`,
    );
    console.log(`Z-Score            : ${scan.indicators.zScore.toFixed(2)}`);
    console.log("Byzantine Council Votes:");
    scan.verdict.votes.forEach((v) => {
      const mark = v.approved ? "[PASS]" : "[FAIL]";
      console.log(`  ${mark} ${v.judge.padEnd(16)} : Score ${v.score.toFixed(2)} | ${v.reason}`);
    });
    console.log(
      `Final Verdict      : ${scan.verdict.consensusReached ? scan.verdict.direction : "PASSIVE_WAIT (NO TRADE)"}`,
    );
  }
  return true;
}

async function cmd_trading_status(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const riskState = getDefaultRiskState();

  if (isJson) {
    console.log(JSON.stringify(riskState, null, 2));
  } else {
    console.log("=== Trading Risk & Governance State (SPEC-371) ===");
    console.log(`Account Isolation  : ${riskState.accountType.toUpperCase()} (PRACTICE DEMO)`);
    console.log(`Demo Balance       : $${riskState.balanceUsd.toFixed(2)} USD`);
    console.log(`Open Positions     : ${riskState.openPositionsCount} / 1`);
    console.log(`Daily Drawdown     : ${riskState.dailyDrawdownPct.toFixed(2)}% (Max 3.00%)`);
    console.log(`Consecutive Losses : ${riskState.consecutiveLosses} / 3`);
    console.log(`Session Net Profit : $${riskState.dailyProfitNetUsd.toFixed(2)} USD`);
    console.log(`Trailing Floor     : $${riskState.trailingStopFloorUsd.toFixed(2)} USD`);
  }
  return true;
}

async function cmd_trading_confluence(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const candles = getMockCandles();
  const ind = computeIndicators(candles);

  const data = {
    strategies: [
      { name: "Liquidity Sweep & Order Flow Reversal", framework: "ICT / Wyckoff", status: "ACTIVE" },
      { name: "Institutional Trend Pullback", framework: "Nexus / SMC", status: "ACTIVE" },
      { name: "TTM Volatility Squeeze & Velocity", framework: "John Carter", status: "ACTIVE" },
      { name: "Quant Mean-Reversion Oscillator", framework: "Statistical Arbitrage", status: "ACTIVE" },
    ],
    metrics: { rsi: ind.rsi, adx: ind.adx, zScore: ind.zScore },
  };

  if (isJson) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log("=== Multi-Strategy Confluence Matrix (SPEC-371) ===");
    data.strategies.forEach((s) => console.log(`  - ${s.name.padEnd(38)} [${s.framework}] (${s.status})`));
    console.log(`Active Metrics: RSI=${ind.rsi.toFixed(2)} ADX=${ind.adx.toFixed(2)} Z-Score=${ind.zScore.toFixed(2)}`);
  }
  return true;
}

HANDLERS["toolchain:trading:audit"] = cmd_trading_audit;
HANDLERS["toolchain:trading:scan"] = cmd_trading_scan;
HANDLERS["toolchain:trading:status"] = cmd_trading_status;
HANDLERS["toolchain:trading:confluence"] = cmd_trading_confluence;

export async function handleInstitutionalTradingCommand(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (handler) {
    return handler(commandContext);
  }
  return handleMultiAssetMacroCommand(commandContext);
}

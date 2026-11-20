/**
 * @file cliQuantCockpitWalkForwardEngine.mjs
 * @description CLI handler for SPEC-376 / CHANGE-238: Quant Cockpit HUD,
 * Second-59.8 Atomic Trigger, and Walk-Forward Quarter-Kelly Calibrator.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EosQuantCockpitWalkForwardEngine,
  generateFullIqOptionUniverse153,
  recordAndLoadWalkForwardLedger,
} from "../../src/core/eosQuantCockpitWalkForwardEngine.ts";
import { EosUniversalAssetPayoutOptimizerEngine } from "../../src/core/eosUniversalAssetPayoutOptimizerEngine.ts";
import * as TradingSuiteBarrel from "../../src/core/eosTradingSuiteBarrel.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

const HANDLERS = Object.create(null);

function getArgValue(args, prefix) {
  const match = args.find((a) => a.startsWith(prefix));
  if (!match) return undefined;
  return match.slice(prefix.length).replace(/^["']|["']$/g, "");
}

function loadPaperLedgerAsWalkForwardTrades(newSample) {
  return recordAndLoadWalkForwardLedger(ROOT, newSample);
}

function buildFallbackCockpitInput(nowMs) {
  const quotes = EosUniversalAssetPayoutOptimizerEngine.generateCatalogQuotes();
  const fullUniverse = generateFullIqOptionUniverse153();
  const byName = new Map(fullUniverse.map((a) => [a.name.toUpperCase(), a]));
  const rawAssets = [...fullUniverse];
  const candlesByAssetId = {};

  quotes.forEach((q, idx) => {
    const normalizedName = q.symbol.includes("-OTC") ? q.symbol.replace("-OTC", " (OTC)") : q.symbol;
    const matched = byName.get(normalizedName.toUpperCase());
    const assetId = matched ? matched.asset_id : 1800 + idx;
    if (!matched) {
      rawAssets.push({
        asset_id: assetId,
        name: normalizedName,
        is_open: true,
        profit_percent: Math.max(q.binaryPayoutPercent, q.digitalPayoutPercent),
        precision: q.spotPrice < 1 ? 6 : 4,
      });
    }
    candlesByAssetId[assetId] = {
      m15: q.candlesM15,
      m5: q.candlesM5,
      m1: EosQuantCockpitWalkForwardEngine.softenOversizedSignalWick(q.candlesM1),
    };
  });

  return {
    balances: [
      { balance_id: 1254340790, amount: 3707.8, currency: "USD", type: "regular" },
      { balance_id: 1254340791, amount: 14100.35, currency: "USD", type: "training" },
    ],
    capabilityMode: "read-only",
    rawAssets,
    candlesByAssetId,
    tradeHistory: loadPaperLedgerAsWalkForwardTrades(),
    serverEpochMs: nowMs,
    clockDriftMs: 0,
    networkLatencyMs: 65,
    allowOtc: true,
    activeOpenPositions: 0,
  };
}

async function cmd_trading_cockpit(commandContext) {
  const args = commandContext?.args || [];
  const isJson = args.includes("--json");
  const snapshotPath = getArgValue(args, "--live-snapshot=");

  let input;
  if (snapshotPath && fs.existsSync(snapshotPath)) {
    input = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  } else {
    input = buildFallbackCockpitInput(Date.now());
  }

  const report = EosQuantCockpitWalkForwardEngine.buildCockpitReport(input);
  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return true;
  }

  console.log(report.hudText);
  if (report.rankedCandidates.length > 0) {
    console.log("\n📊 TOP CANDIDATOS EVALUADOS CON VELAS REALES/LOCALES:");
    for (const c of report.rankedCandidates.slice(0, 8)) {
      console.log(
        `  - ${c.name.padEnd(22)} | ${c.category.padEnd(12)} | Pay:${c.payoutPercent}% | ${c.status.padEnd(23)} | ${c.reason}`,
      );
    }
  }
  return true;
}

async function cmd_trading_trigger(commandContext) {
  const args = commandContext?.args || [];
  const isJson = args.includes("--json");
  const driftArg = getArgValue(args, "--drift=");
  const latencyArg = getArgValue(args, "--latency=");
  const epochArg = getArgValue(args, "--epoch=");

  const decision = EosQuantCockpitWalkForwardEngine.evaluateAtomicTrigger({
    serverEpochMs: epochArg ? Number(epochArg) : Date.now(),
    clockDriftMs: driftArg ? Number(driftArg) : 0,
    networkLatencyMs: latencyArg ? Number(latencyArg) : 65,
  });

  if (isJson) {
    console.log(JSON.stringify(decision, null, 2));
    return true;
  }

  console.log("========================================================================");
  console.log("⏱️ EOS SYSTEM — ATOMIC SECOND-59.8 / 00 TRIGGER DIAGNOSTIC (SPEC-376)");
  console.log("========================================================================");
  console.log(`  Estado        : ${decision.status} (safeToExecute=${decision.safeToExecute})`);
  console.log(`  UTC / COT     : ${decision.serverIsoUtc} | ${decision.colombiaIsoCot}`);
  console.log(`  Segundo M1    : :${decision.secondsIntoMinute.toFixed(3)}s`);
  console.log(`  Falta p/ 59.8s: ${(decision.msToPreFire598 / 1000).toFixed(3)}s`);
  console.log(`  Deriva / Lat. : drift=${decision.clockDriftMs}ms | latency=${decision.networkLatencyMs}ms`);
  console.log(`  Detalle       : ${decision.reason}`);
  console.log("========================================================================");
  return true;
}

function parseRecordArg(rawSpec) {
  if (!rawSpec) return undefined;
  const [assetName, category, strategy, dir, res, stakeStr, payoutStr] = rawSpec.split(",");
  if (!assetName || !res) return undefined;
  const stakeUsd = Number(stakeStr ?? 100);
  const payoutPercent = Number(payoutStr ?? 92);
  const result = res.toLowerCase() === "win" ? "win" : res.toLowerCase() === "loss" ? "loss" : "equal";
  const pnlUsd =
    result === "win" ? Number(((stakeUsd * payoutPercent) / 100).toFixed(2)) : result === "loss" ? -stakeUsd : 0;
  return {
    timestampMs: Date.now(),
    assetName: assetName.trim(),
    category: category?.trim() || EosQuantCockpitWalkForwardEngine.classifyAssetCategory(assetName),
    strategy: strategy?.trim() || "TREND_PULLBACK",
    direction: dir?.trim().toUpperCase() === "PUT" ? "PUT" : "CALL",
    stakeUsd,
    payoutPercent,
    pnlUsd,
    result,
  };
}

async function cmd_trading_walkforward(commandContext) {
  const args = commandContext?.args || [];
  const isJson = args.includes("--json");
  const newSample = parseRecordArg(getArgValue(args, "--record="));
  const trades = loadPaperLedgerAsWalkForwardTrades(newSample);
  const Engine = TradingSuiteBarrel.EosQuantCockpitWalkForwardEngine || EosQuantCockpitWalkForwardEngine;
  const report = Engine.calibrateWalkForward(trades, 14100.35, false, 1.0);

  if (isJson) {
    console.log(JSON.stringify(report, null, 2));
    return true;
  }

  console.log("========================================================================");
  console.log("⚖️ EOS SYSTEM — WALK-FORWARD QUARTER-KELLY CALIBRATOR (SPEC-376)");
  console.log("========================================================================");
  console.log(`  Trades Cerrados    : ${report.totalClosedTrades}`);
  console.log(`  Win Rate Global    : ${report.winRatePercent}%`);
  console.log(`  Profit Factor      : ${report.profitFactor}`);
  console.log(`  PnL Neto           : $${report.netPnlUsd.toFixed(2)} USD`);
  console.log(`  Quarter-Kelly Bruto: ${report.rawQuarterKellyPercent}%`);
  console.log(
    `  Stake Recomendado  : ${report.recommendedKellyPercent}% ($${report.recommendedFlatStakeUsd.toFixed(2)} USD)`,
  );
  console.log(`  Cero Martingala    : ${report.zeroMartingaleEnforced ? "ACTIVO" : "INACTIVO"}`);
  console.log(
    `  Buckets Cuarentena : ${report.quarantinedBuckets.length > 0 ? report.quarantinedBuckets.join(", ") : "NINGUNO"}`,
  );
  console.log("========================================================================");
  return true;
}

async function cmd_trading_cockpit_audit(commandContext) {
  const args = commandContext?.args || [];
  const isJson = args.includes("--json");
  const receipt = EosQuantCockpitWalkForwardEngine.audit(ROOT);

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return true;
  }

  console.log("========================================================================");
  console.log("🛡️ EOS SYSTEM — AUDITORÍA FORMAL QUANT COCKPIT & WALK-FORWARD (SPEC-376)");
  console.log("========================================================================");
  console.log(`  Estado General          : ${receipt.status}`);
  console.log(`  Universo Dinámico       : ${receipt.invariants.dynamicUniverseUnbounded ? "CUMPLIDO" : "VIOLADO"}`);
  console.log(`  Filtro Experto 6-Fact.  : ${receipt.invariants.expertSixFactorFilterActive ? "CUMPLIDO" : "VIOLADO"}`);
  console.log(
    `  Gatillo Atómico 59.8s   : ${receipt.invariants.atomicTriggerSecond598Enforced ? "CUMPLIDO" : "VIOLADO"}`,
  );
  console.log(
    `  Quarter-Kelly [0.5..2%] : ${receipt.invariants.walkForwardQuarterKellyBounded ? "CUMPLIDO" : "VIOLADO"}`,
  );
  console.log(`  Cuarentena Alpha-Decay  : ${receipt.invariants.alphaDecayQuarantineActive ? "CUMPLIDO" : "VIOLADO"}`);
  console.log(`  Bloqueo Cuenta Real     : ${receipt.invariants.dualVaultRegularLocked ? "CUMPLIDO" : "VIOLADO"}`);
  console.log(
    `  Concurrencia N<=1 / 60s : ${receipt.invariants.singleConcurrency60sEnforced ? "CUMPLIDO" : "VIOLADO"}`,
  );
  console.log(`  Firma SHA-256 Recibo    : ${receipt.receiptHash}`);
  console.log("========================================================================");
  return true;
}

HANDLERS["toolchain:trading:cockpit"] = cmd_trading_cockpit;
HANDLERS["toolchain:trading:trigger"] = cmd_trading_trigger;
HANDLERS["toolchain:trading:walkforward"] = cmd_trading_walkforward;
HANDLERS["toolchain:trading:cockpit-audit"] = cmd_trading_cockpit_audit;

export async function handleQuantCockpitWalkForwardCommand(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (!handler) {
    console.error(`Unknown Quant Cockpit Walk-Forward command: ${commandContext.command}`);
    return false;
  }
  return handler(commandContext);
}

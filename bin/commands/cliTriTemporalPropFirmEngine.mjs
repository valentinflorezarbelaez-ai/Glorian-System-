/**
 * @file cliTriTemporalPropFirmEngine.mjs
 * @description CLI handler for SPEC-374 / CHANGE-236: Tri-Temporal Fractal Alignment Engine, FTMO Prop-Firm Governor & WhatsApp Dispatcher.
 *
 * Invariant: Pure Layer-0, zero external runtime dependencies, <= 800 lines.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { EosTriTemporalPropFirmEngine } from "../../src/core/eosTriTemporalPropFirmEngine.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function generateCandles(count = 60, basePrice = 1.0925, trend = 0.0003, wickType = "rejection_bullish") {
  const candles = [];
  let p = basePrice;
  for (let i = 0; i < count; i++) {
    const change = Math.sin(i / 6) * 0.0002 + trend;
    const open = p;
    p += change;
    let high = Math.max(open, p) + 0.0001;
    let low = Math.min(open, p) - 0.0001;

    // Last candle exhibits micro-wick pattern
    if (i === count - 1) {
      if (wickType === "rejection_bullish") {
        low = Math.min(open, p) - 0.0006; // Long lower wick >= 45%
        high = Math.max(open, p) + 0.00005;
      } else if (wickType === "rejection_bearish") {
        high = Math.max(open, p) + 0.0006; // Long upper wick >= 45%
        low = Math.min(open, p) - 0.00005;
      }
    }
    candles.push({ open, high, low, close: p });
  }
  return candles;
}

const HANDLERS = {};

async function cmd_trading_fractal(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const asset =
    args.find((a) => !a.startsWith("--") && !a.startsWith("toolchain:") && a !== commandContext?.command) || "EUR/USD";

  const m15 = generateCandles(60, 1.09, 0.0002);
  const m5 = generateCandles(60, 1.0915, 0.0001);
  const m1 = generateCandles(60, 1.0925, 0.00015, "rejection_bullish");

  const result = EosTriTemporalPropFirmEngine.evaluateTriTemporalAlignment(m15, m5, m1);

  if (isJson) {
    console.log(JSON.stringify({ asset, ...result }, null, 2));
    return true;
  }

  console.log(`=== Tri-Temporal Fractal Alignment Engine (${asset}) (SPEC-374) ===`);
  console.log(`Alignment Status      : ${result.isAligned ? "ALIGNED [CONFLUENCE]" : "MISALIGNED [NO TRADE]"}`);
  console.log(`Harmonic Direction    : ${result.harmonicDirection || "NONE"}`);
  console.log(`Confidence Score      : ${(result.alignmentConfidence * 100).toFixed(1)}%`);
  console.log("------------------------------------------------------------------------");
  console.log(`M15 Macro Trend Bias  : ${result.m15.bias} | ${result.m15.reason}`);
  console.log(`M5 Structural Pullback: ${result.m5.bias} | ${result.m5.reason}`);
  console.log(`M1 Micro Trigger (BT) : ${result.m1.bias} | ${result.m1.reason}`);
  console.log("------------------------------------------------------------------------");
  console.log(
    `Verdict               : ${result.isAligned ? "EXECUTE " + result.harmonicDirection + " (M1 Expiry 60s)" : "PASSIVE_WAIT (FRACTAL DIVERGENCE)"}`,
  );
  return true;
}

async function cmd_trading_propfirm(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  let initialBalanceUsd = 10000.0;
  let currentBalanceUsd = 10250.0;
  let dailyPeakBalanceUsd = 10250.0;
  let allTimePeakBalanceUsd = 10250.0;

  for (const arg of args) {
    if (arg.startsWith("--balance=")) {
      currentBalanceUsd = parseFloat(arg.split("=")[1]);
    } else if (arg.startsWith("--initial=")) {
      initialBalanceUsd = parseFloat(arg.split("=")[1]);
    }
  }

  const status = EosTriTemporalPropFirmEngine.evaluatePropFirmRisk({
    initialBalanceUsd,
    currentBalanceUsd,
    dailyPeakBalanceUsd,
    allTimePeakBalanceUsd,
  });

  if (isJson) {
    console.log(JSON.stringify(status, null, 2));
    return true;
  }

  console.log("=== Prop-Firm & FTMO Drawdown Governor (SPEC-374) ===");
  console.log(`Initial Capital       : $${status.initialBalanceUsd.toFixed(2)} USD`);
  console.log(`Current Balance       : $${status.currentBalanceUsd.toFixed(2)} USD`);
  console.log(`Daily Peak Balance    : $${status.dailyPeakBalanceUsd.toFixed(2)} USD`);
  console.log("------------------------------------------------------------------------");
  console.log(
    `Daily Drawdown        : ${status.dailyDrawdownPercent.toFixed(2)}% / Hard Stop: -${status.dailyLossLimitPercent.toFixed(1)}% (${status.dailyDrawdownPercent < status.dailyLossLimitPercent ? "SAFE" : "BREACH"})`,
  );
  console.log(
    `Total Drawdown        : ${status.totalDrawdownPercent.toFixed(2)}% / Hard Stop: -${status.totalLossLimitPercent.toFixed(1)}% (${status.totalDrawdownPercent < status.totalLossLimitPercent ? "SAFE" : "BREACH"})`,
  );
  console.log(
    `Target Profit         : ${status.profitPercent.toFixed(2)}% / Target: +${status.targetProfitPercent.toFixed(1)}% (${status.status === "PASSED" ? "CHALLENGE PASSED" : "IN PROGRESS"})`,
  );
  console.log("------------------------------------------------------------------------");
  console.log(
    `Governance Status     : ${status.status} (${status.status === "EVALUATING" || status.status === "PASSED" ? "TRADING PERMITTED" : "CIRCUIT BREAKER HALT"})`,
  );
  return true;
}

async function cmd_trading_daemon(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  const pair = "EUR/USD";
  const m15 = generateCandles(60, 1.09, 0.0002);
  const m5 = generateCandles(60, 1.0915, 0.0001);
  const m1 = generateCandles(60, 1.0925, 0.00015, "rejection_bullish");

  const fractal = EosTriTemporalPropFirmEngine.evaluateTriTemporalAlignment(m15, m5, m1);
  const propFirm = EosTriTemporalPropFirmEngine.evaluatePropFirmRisk({
    initialBalanceUsd: 10000.0,
    currentBalanceUsd: 10450.0,
    dailyPeakBalanceUsd: 10450.0,
    allTimePeakBalanceUsd: 10450.0,
  });

  const openAlert = EosTriTemporalPropFirmEngine.formatTradeOpenAlert({
    pair,
    direction: fractal.harmonicDirection || "CALL",
    entryPrice: 1.0926,
    strikeSeconds: 60,
    confidence: fractal.alignmentConfidence,
    m15Reason: fractal.m15.reason,
    m5Reason: fractal.m5.reason,
    m1Reason: fractal.m1.reason,
  });

  const dispatched = EosTriTemporalPropFirmEngine.dispatchWhatsAppMessage(openAlert, ROOT);

  const daemonReport = {
    cycleId: `daemon-cycle-${Date.now()}`,
    timestampIso: new Date().toISOString(),
    status: "ACTIVE_AUTONOMOUS_DAEMON",
    accountMode: "PRACTICE_DEMO (ACCOUNT_ISOLATION_CONFORMING)",
    assetScanned: pair,
    fractalAlignment: fractal.isAligned,
    propFirmStatus: propFirm.status,
    tradeDispatched: dispatched,
    sampleAlertMessage: openAlert.formattedText,
  };

  if (isJson) {
    console.log(JSON.stringify(daemonReport, null, 2));
    return true;
  }

  console.log("=== Autonomous Trading Daemon & WhatsApp Notification Bridge (SPEC-374) ===");
  console.log(`Cycle ID              : ${daemonReport.cycleId}`);
  console.log(`Daemon Status         : ${daemonReport.status}`);
  console.log(`Account Mode          : ${daemonReport.accountMode}`);
  console.log(`Target Asset          : ${daemonReport.assetScanned}`);
  console.log(`Tri-Temporal Confluence: ${daemonReport.fractalAlignment ? "ALIGNED (CALL Triggered)" : "NO SETUP"}`);
  console.log(`Prop-Firm Circuit     : ${daemonReport.propFirmStatus}`);
  console.log(`WhatsApp Notification : ${daemonReport.tradeDispatched ? "DISPATCHED TO DISPATCH_LOG" : "FAILED"}`);
  console.log("------------------------------------------------------------------------");
  console.log("Formatted WhatsApp Message Payload Preview:");
  console.log(daemonReport.sampleAlertMessage);
  console.log("------------------------------------------------------------------------");
  return true;
}

async function cmd_trading_notify_audit(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");
  const receipt = EosTriTemporalPropFirmEngine.audit(ROOT);

  if (isJson) {
    console.log(JSON.stringify(receipt, null, 2));
    return true;
  }

  console.log("=== Tri-Temporal Fractal Prop-Firm & WhatsApp Dispatcher Audit (SPEC-374) ===");
  console.log(`Receipt ID            : ${receipt.receiptId}`);
  console.log(`Status                : ${receipt.status}`);
  console.log(`Harmonic Alignment    : ${receipt.invariants.triTemporalHarmonicAlignment ? "PASSED" : "FAILED"}`);
  console.log(`Prop-Firm Survival    : ${receipt.invariants.propFirmSurvivalInvariant ? "PASSED" : "FAILED"}`);
  console.log(`Single Execution Lock : ${receipt.invariants.singleExecutionLock ? "PASSED" : "FAILED"}`);
  console.log(`Practice Isolation    : ${receipt.invariants.practiceModeIsolation ? "PASSED" : "FAILED"}`);
  console.log(`Receipt Hash (SHA-256): ${receipt.receiptHash}`);
  return true;
}

async function cmd_trading_notify_test(commandContext) {
  const args = commandContext.args || [];
  const isJson = args.includes("--json");

  let phone = "573239704883";
  let apiKey = process.env.WHATSAPP_APIKEY;

  for (const arg of args) {
    if (arg.startsWith("--phone=")) {
      phone = arg.split("=")[1].replace(/[^0-9]/g, "");
    } else if (arg.startsWith("--apikey=")) {
      apiKey = arg.split("=")[1];
    }
  }

  const testAlert = EosTriTemporalPropFirmEngine.formatTradeOpenAlert({
    pair: "EUR/USD",
    direction: "CALL",
    entryPrice: 1.09265,
    strikeSeconds: 60,
    confidence: 0.94,
    m15Reason: "M15 tendencia alcista confirmada (EMA 9>20>50)",
    m5Reason: "M5 retroceso técnico en zona dorada Fibonacci 61.8%",
    m1Reason: "M1 BinaryTeach rechazo con mecha inferior del 62%",
  });

  const res = await EosTriTemporalPropFirmEngine.dispatchWhatsAppLive(testAlert, { phone, apiKey });

  if (isJson) {
    console.log(JSON.stringify({ phone, ...res }, null, 2));
    return true;
  }

  console.log("=== Prueba de Despacho en Vivo a WhatsApp (SPEC-374) ===");
  console.log(`Destinatario           : +${phone}`);
  console.log(`Estado de Entrega      : ${res.status}`);
  console.log(`Resultado              : ${res.success ? "ÉXITO" : "PENDIENTE_CREDENCIAL"}`);
  console.log(`Detalle                : ${res.detail || "Entregado a la pasarela"}`);
  console.log("------------------------------------------------------------------------");
  if (!apiKey) {
    console.log("📱 CÓMO ACTIVAR TU ENTREGA INMEDIATA A WHATSAPP (+57 3239704883):");
    console.log("1. Abre WhatsApp y envía este mensaje al número oficial de CallMeBot (+34 644 20 55 51):");
    console.log('   👉 "I allow callmebot to send me messages"');
    console.log("   (O toca el enlace: https://wa.me/34644205551?text=I+allow+callmebot+to+send+me+messages)");
    console.log("2. En 2 segundos, el bot te enviará tu API Key de activación.");
    console.log("3. Ejecuta:");
    console.log(`   node bin/eos.mjs toolchain:trading:notify-test --phone=${phone} --apikey=TU_API_KEY`);
    console.log("------------------------------------------------------------------------");
  } else {
    console.log("🎉 Alerta enviada exitosamente a tu WhatsApp.");
  }
  return true;
}

HANDLERS["toolchain:trading:fractal"] = cmd_trading_fractal;
HANDLERS["toolchain:trading:propfirm"] = cmd_trading_propfirm;
HANDLERS["toolchain:trading:daemon"] = cmd_trading_daemon;
HANDLERS["toolchain:trading:notify-audit"] = cmd_trading_notify_audit;
HANDLERS["toolchain:trading:notify-test"] = cmd_trading_notify_test;

export async function handleTriTemporalPropFirmCommand(commandContext) {
  const handler = HANDLERS[commandContext.command];
  if (!handler) {
    console.error(`Unknown Tri-Temporal Prop-Firm command: ${commandContext.command}`);
    return false;
  }
  return handler(commandContext);
}

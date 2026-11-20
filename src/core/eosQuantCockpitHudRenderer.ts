/**
 * EOS Quant Cockpit Asset Classifier, Timezone Formatter & HUD Renderer
 * Part of SPEC-376 / CHANGE-238 (Layer-0 Pure Financial Architecture)
 *
 * Extracted from eosQuantCockpitWalkForwardEngine.ts to maintain clean modularity and SPEC-250 headroom.
 */

import type { NewsBlackoutStatus } from "./eosMultiAssetMacroFilterEngine.types.ts";
import type {
  AtomicTriggerDecision,
  ExpertAssetVerdict,
  IqOptionAssetCategory,
  WalkForwardCalibrationReport,
} from "./eosQuantCockpitWalkForwardEngine.types.ts";

const COMMODITY_KEYWORDS = "GOLD|XAU|SILVER|XAG|CRUDE OIL|WTI|BRENT|PLATINUM|PALLADIUM|COCOA|COFFEE|COTTON|SUGAR".split(
  "|",
);

const INDEX_ETF_KEYWORDS = (
  "ETF|SPDR|ISHARES|ULTRAPRO|ULTRASHORT|US 500|US 100|US 30|US 2000|UK 100|JP 225|HK 33|" +
  "GER 30|FR 40|AU 200|DOLLAR INDEX|YEN INDEX|EURO INDEX|POUND INDEX|S&P|MAGNIFICENT 7|" +
  "AI POWER|AI US|AI EUROPE|LUXURY"
).split("|");

const CRYPTO_KEYWORDS = (
  "BITCOIN|BTC|ETHEREUM|ETH|SOLANA|SOL|RIPPLE|XRP|DASH|PEPE|DOGE|SHIB|LITECOIN|POLKADOT|" +
  "COSMOS|BONK|DOGWIFHAT|JUPITER|TRUMP COIN|ONDO|SUI|HBAR|RENDER|TAO|TERRA|WORLDCOIN|" +
  "1000SATS|ARBITRUM|SEI|FET|HYPERLIQUID|RAYDIUM|FARTCOIN|PUDGY|VAULTA"
).split("|");

/**
 * Classifies an IQ Option asset name dynamically into its financial asset class.
 */
export function classifyIqOptionAssetCategory(name: string): IqOptionAssetCategory {
  const upper = name.toUpperCase().trim();
  if (upper.includes("(OTC)") || upper.endsWith("-OTC")) return "OTC";
  if (INDEX_ETF_KEYWORDS.some((kw) => upper.includes(kw))) return "INDICES_ETFS";
  if (COMMODITY_KEYWORDS.some((kw) => upper.includes(kw))) return "COMMODITIES";
  if (CRYPTO_KEYWORDS.some((kw) => upper.includes(kw))) return "CRYPTO";
  if (/^[A-Z]{3}\/[A-Z]{3}$/.test(upper)) return "FOREX";
  return "EQUITIES";
}

/** Formats epoch milliseconds as Colombia Time (COT / UTC-5) ISO string. */
export function formatCotIso(epochMs: number): string {
  const cotDate = new Date(epochMs - 5 * 3600 * 1000);
  return `${cotDate.toISOString().slice(0, 19)}-05:00`;
}

/** Extracts the hourly COT label used by Walk-Forward intraday heatmaps. */
export function getCotHourLabel(epochMs: number): string {
  const cotDate = new Date(epochMs - 5 * 3600 * 1000);
  return `${String(cotDate.getUTCHours()).padStart(2, "0")}:00 COT`;
}

export interface QuantCockpitHudParams {
  readonly generatedAtIsoUtc: string;
  readonly generatedAtIsoCot: string;
  readonly capabilityMode: string;
  readonly expirySeconds: number;
  readonly minPayoutPercent: number;
  readonly demoBalanceUsd: number;
  readonly activeBalanceId: number | null;
  readonly regularLockedUsd: number;
  readonly vaultAlphaUsd: number;
  readonly totalAssets: number;
  readonly openAssets: number;
  readonly qualifiedPayoutAssets: number;
  readonly evaluatedCount: number;
  readonly byCategory: Readonly<Record<IqOptionAssetCategory, number>>;
  readonly triggerDecision: AtomicTriggerDecision;
  readonly macroBlackout: NewsBlackoutStatus;
  readonly walkForward: WalkForwardCalibrationReport;
  readonly topSniperSetup: ExpertAssetVerdict | null;
  readonly hasOpenPosition: boolean;
}

/** Renders the Antigravity native Bloomberg-style Quant Cockpit HUD. */
export function renderQuantCockpitHud(p: QuantCockpitHudParams): string {
  const sep = "==================================================================================";
  const sub = "----------------------------------------------------------------------------------";
  return [
    sep,
    "🎯 GLORIAN SYSTEM — ANTIGRAVITY QUANT COCKPIT HUD (SPEC-376)",
    sep,
    `  UTC: ${p.generatedAtIsoUtc}  |  COT (GMT-5): ${p.generatedAtIsoCot}`,
    `  Gateway Mode: ${p.capabilityMode.toUpperCase()} | Expiry: ${p.expirySeconds}s (Binary/Digital M1) | N_active <= 1`,
    sub,
    "🛡️ FIDUCIARY & ACCOUNT SHIELD:",
    `  Demo Account (training) : $${p.demoBalanceUsd.toFixed(2)} USD (ID: ${p.activeBalanceId ?? "N/A"})`,
    `  Real Account (regular)  : $${p.regularLockedUsd.toFixed(2)} USD [LOCKED — EXCLUDED FROM EXECUTION]`,
    `  Vault Alpha Protected   : $${p.vaultAlphaUsd.toFixed(2)} USD [COLD SEGREGATED · P_ruin = 0.00%]`,
    sub,
    "🌐 DYNAMIC IQ OPTION UNIVERSE INGESTION:",
    `  Total Ingested: ${p.totalAssets} | Open: ${p.openAssets} | Payout >= ${p.minPayoutPercent}%: ${p.qualifiedPayoutAssets} | Candles Evaluated: ${p.evaluatedCount}`,
    `  Classes -> FOREX:${p.byCategory.FOREX} | COMMODITIES:${p.byCategory.COMMODITIES} | CRYPTO:${p.byCategory.CRYPTO} | EQUITIES:${p.byCategory.EQUITIES} | INDICES/ETFs:${p.byCategory.INDICES_ETFS} | OTC:${p.byCategory.OTC}`,
    sub,
    "⏱️ ATOMIC SECOND-59.8 TRIGGER & MACRO RADAR:",
    `  Trigger State : ${p.triggerDecision.status} (safeToExecute=${p.triggerDecision.safeToExecute}) — ${p.triggerDecision.reason}`,
    `  Macro Radar   : ${p.macroBlackout.statusLabel} (Next Red-Folder Event in ${p.macroBlackout.minutesUntilNextEvent ?? "N/A"} min)`,
    sub,
    "⚖️ WALK-FORWARD QUARTER-KELLY SIZER & ALPHA-DECAY:",
    `  Closed Sample : ${p.walkForward.totalClosedTrades} trades | WR: ${p.walkForward.winRatePercent}% | PF: ${p.walkForward.profitFactor} | Net PnL: $${p.walkForward.netPnlUsd.toFixed(2)}`,
    `  Stake Sizing  : ${p.walkForward.recommendedKellyPercent}% ($${p.walkForward.recommendedFlatStakeUsd.toFixed(2)} USD) [Zero-Martingale: ${p.walkForward.zeroMartingaleEnforced ? "ON" : "OFF"}]`,
    `  Quarantined   : ${p.walkForward.quarantinedBuckets.length > 0 ? p.walkForward.quarantinedBuckets.join(", ") : "NONE"}`,
    sub,
    "🏆 TOP-1 SNIPER SETUP (A+ INSTITUTIONAL FILTER):",
    p.topSniperSetup
      ? `  ELECTED: ${p.topSniperSetup.name} [${p.topSniperSetup.category}] | ${p.topSniperSetup.direction} 60s | Payout ${p.topSniperSetup.payoutPercent}% | Est WR ${(p.topSniperSetup.estimatedWinRate * 100).toFixed(1)}% vs BE ${(p.topSniperSetup.breakEvenWinRate * 100).toFixed(1)}% | EV +$${p.topSniperSetup.expectedValuePerDollar.toFixed(3)}/$1 | Score ${p.topSniperSetup.expertScore}`
      : `  NO TRADE — Passive Wait (${p.hasOpenPosition ? "Active trade lock engaged" : "Awaiting clean A+ positive-EV confluence"})`,
    sep,
  ].join("\n");
}

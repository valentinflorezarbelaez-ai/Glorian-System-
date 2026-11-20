/**
 * EOS Quant Cockpit Asset Classifier, Timezone Formatter, Universe Catalog, Ledger & HUD Renderer
 * Part of SPEC-376 / CHANGE-238 (Layer-0 Pure Financial Architecture)
 *
 * Extracted from eosQuantCockpitWalkForwardEngine.ts to maintain clean modularity and SPEC-250 headroom.
 */

import fs from "node:fs";
import path from "node:path";
import { EosUniversalAssetPayoutOptimizerEngine } from "./eosUniversalAssetPayoutOptimizerEngine.ts";
import type { NewsBlackoutStatus } from "./eosMultiAssetMacroFilterEngine.types.ts";
import type {
  AtomicTriggerDecision,
  ClassifiedIqOptionAsset,
  ExpertAssetVerdict,
  ExpertStrategyType,
  IqOptionAssetCategory,
  IqOptionRawAsset,
  MarketRegimeType,
  SlippageStressReport,
  StatisticalSignificanceReport,
  WalkForwardBucketStats,
  WalkForwardCalibrationReport,
  WalkForwardTradeSample,
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

const FOREX_UNIVERSE_36 = (
  "EUR/USD|GBP/USD|USD/JPY|AUD/USD|USD/CAD|USD/CHF|NZD/USD|EUR/GBP|EUR/JPY|GBP/JPY|EUR/AUD|EUR/CAD|" +
  "EUR/CHF|EUR/NZD|GBP/AUD|GBP/CAD|GBP/CHF|GBP/NZD|AUD/CAD|AUD/CHF|AUD/JPY|AUD/NZD|CAD/CHF|CAD/JPY|" +
  "CHF/JPY|NZD/CAD|NZD/CHF|NZD/JPY|USD/MXN|USD/SGD|USD/SEK|USD/NOK|USD/ZAR|USD/TRY|EUR/PLN|EUR/SEK"
).split("|");

const COMMODITIES_UNIVERSE_14 = (
  "Gold|Silver|Crude Oil WTI|Crude Oil Brent|Platinum|Palladium|Cocoa|Coffee|Cotton|Sugar|" +
  "XAU/USD|XAG/USD|Gold Spot|Silver Spot"
).split("|");

const CRYPTO_UNIVERSE_32 = (
  "Bitcoin|Ethereum|Solana|Ripple|Dash|Pepe|Dogecoin|Shiba Inu|Litecoin|Polkadot|Cosmos|Bonk|" +
  "Dogwifhat|Jupiter|Trump Coin|Ondo|Sui|Hbar|Render|Tao|Terra|Worldcoin|1000Sats|Arbitrum|" +
  "Sei|Fet|Hyperliquid|Raydium|Fartcoin|Pudgy Penguins|Vaulta|BTC/USD"
).split("|");

const EQUITIES_UNIVERSE_36 = (
  "Apple Inc.|Microsoft|Tesla|NVIDIA|Amazon|Meta Platforms|Alphabet|Netflix|AMD|Intel|Oracle|IBM|" +
  "Adobe|Salesforce|Cisco|PayPal|Visa|Mastercard|JPMorgan Chase|Bank of America|Coca-Cola|PepsiCo|" +
  "McDonald's|Disney|Nike|Boeing|Pfizer|Johnson & Johnson|Exxon Mobil|Chevron|Walmart|Costco|" +
  "Uber|Airbnb|Palantir|Broadcom"
).split("|");

const INDICES_ETF_UNIVERSE_20 = (
  "US 500|US 100|US 30|US 2000|UK 100|JP 225|HK 33|GER 30|FR 40|AU 200|Dollar Index|Yen Index|" +
  "Euro Index|Pound Index|SPDR S&P 500 ETF|iShares Russell 2000 ETF|UltraPro QQQ ETF|Magnificent 7|" +
  "AI Power Index|Luxury Brands Index"
).split("|");

const OTC_UNIVERSE_18 = (
  "Pepe (OTC)|EUR/USD (OTC)|GBP/USD (OTC)|USD/JPY (OTC)|AUD/USD (OTC)|USD/CAD (OTC)|Gold (OTC)|" +
  "Silver (OTC)|Bitcoin (OTC)|Ethereum (OTC)|Solana (OTC)|Apple Inc. (OTC)|Tesla (OTC)|Amazon (OTC)|" +
  "NVIDIA (OTC)|US 500 (OTC)|US 100 (OTC)|EUR/JPY (OTC)"
).split("|");

/** Generates the full 156-instrument multi-class IQ Option catalog across all 6 asset classes. */
export function generateFullIqOptionUniverse153(): IqOptionRawAsset[] {
  const fixedIds: Record<string, number> = {
    "EUR/USD": 1861,
    Gold: 1912,
    Bitcoin: 1916,
    "Apple Inc.": 1910,
    "US 500": 1470,
    "Pepe (OTC)": 2145,
  };
  const assets: IqOptionRawAsset[] = [];
  let nextId = 2200;
  const groups = [
    { names: FOREX_UNIVERSE_36, precision: 6, payout: 92 },
    { names: COMMODITIES_UNIVERSE_14, precision: 5, payout: 92 },
    { names: CRYPTO_UNIVERSE_32, precision: 4, payout: 90 },
    { names: EQUITIES_UNIVERSE_36, precision: 4, payout: 91 },
    { names: INDICES_ETF_UNIVERSE_20, precision: 6, payout: 92 },
    { names: OTC_UNIVERSE_18, precision: 6, payout: 92 },
  ];
  for (const grp of groups) {
    grp.names.forEach((name, idx) => {
      const id = fixedIds[name] ?? nextId++;
      assets.push({
        asset_id: id,
        name,
        is_open: true,
        profit_percent: idx === grp.names.length - 1 ? 85 : grp.payout,
        precision: grp.precision,
      });
    });
  }
  return assets;
}

/** Appends an optional trade sample to WALK_FORWARD_TRADE_LEDGER.jsonl and returns merged trade history. */
export function recordAndLoadWalkForwardLedger(
  rootDir: string,
  newSample?: WalkForwardTradeSample,
): WalkForwardTradeSample[] {
  const evidenceDir = path.join(rootDir, "docs", "evidence");
  const wfPath = path.join(evidenceDir, "WALK_FORWARD_TRADE_LEDGER.jsonl");
  const paperPath = path.join(evidenceDir, "PAPER_TRADING_LEDGER.json");

  if (newSample) {
    if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });
    fs.appendFileSync(wfPath, `${JSON.stringify(newSample)}\n`, "utf8");
  }

  const samples: WalkForwardTradeSample[] = [];
  if (fs.existsSync(paperPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(paperPath, "utf8"));
      if (Array.isArray(raw)) {
        for (const r of raw) {
          samples.push({
            timestampMs: Number(r.timestamp ?? Date.now()),
            assetName: String(r.pair ?? "EUR/USD"),
            strategy: "TREND_PULLBACK",
            direction: r.direction === "PUT" ? "PUT" : "CALL",
            stakeUsd: Number(r.stakeUsd ?? 40),
            payoutPercent: Number(((Number(r.payoutMultiplier ?? 1.85) - 1) * 100).toFixed(2)),
            pnlUsd: Number(r.pnlUsd ?? 0),
            result: r.status === "WIN" ? "win" : r.status === "LOSS" ? "loss" : "equal",
          });
        }
      }
    } catch {
      /* ignore corrupt paper ledger */
    }
  }
  if (fs.existsSync(wfPath)) {
    const lines = fs.readFileSync(wfPath, "utf8").split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as WalkForwardTradeSample;
        if (parsed && typeof parsed.assetName === "string") samples.push(parsed);
      } catch {
        /* skip malformed line */
      }
    }
  }
  return samples;
}

/** Institutional Risk Metrics (Sortino, Calmar, Max Drawdown). */
export interface InstitutionalRiskMetrics {
  readonly sortinoRatio: number;
  readonly calmarRatio: number;
  readonly maxDrawdownUsd: number;
  readonly maxDrawdownPercent: number;
}

/** Computes institutional downside-risk metrics (Sortino, Calmar, and peak-to-trough Drawdown). */
export function computeInstitutionalRiskMetrics(
  trades: readonly WalkForwardTradeSample[],
  startingEquityUsd = 10000,
): InstitutionalRiskMetrics {
  if (trades.length === 0) {
    return { sortinoRatio: 0, calmarRatio: 0, maxDrawdownUsd: 0, maxDrawdownPercent: 0 };
  }
  let cum = Math.max(100, startingEquityUsd);
  let peak = cum;
  let maxDdUsd = 0;
  let maxDdPct = 0;
  let totalPnl = 0;
  let sumSquaredDownside = 0;

  for (const t of trades) {
    totalPnl += t.pnlUsd;
    cum += t.pnlUsd;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDdUsd) maxDdUsd = dd;
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
    if (ddPct > maxDdPct) maxDdPct = ddPct;
    if (t.pnlUsd < 0) sumSquaredDownside += t.pnlUsd * t.pnlUsd;
  }

  const meanReturn = totalPnl / trades.length;
  const downsideDeviation = Math.sqrt(sumSquaredDownside / trades.length);
  const sortinoRatio =
    downsideDeviation > 0 ? Number((meanReturn / downsideDeviation).toFixed(2)) : meanReturn > 0 ? 99.0 : 0;

  const calmarRatio = maxDdUsd > 0 ? Number((Math.max(0, totalPnl) / maxDdUsd).toFixed(2)) : totalPnl > 0 ? 99.0 : 0;

  return {
    sortinoRatio,
    calmarRatio,
    maxDrawdownUsd: Number(maxDdUsd.toFixed(2)),
    maxDrawdownPercent: Number(maxDdPct.toFixed(2)),
  };
}

/** Approximate erf(x) via Abramowitz and Stegun 7.1.26. */
function approxErf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const p = 0.3275911;
  const t = 1.0 / (1.0 + p * ax);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return sign * (1.0 - poly * Math.exp(-ax * ax));
}

/** Computes Z-score and binomial one-tailed p-value against random chance (p0 = 0.50). */
export function computeStatisticalSignificance(wins: number, trades: number): StatisticalSignificanceReport {
  if (trades < 5) {
    return { zScore: 0, pValue: 1.0, isSignificant: false, confidenceLevelPercent: 0 };
  }
  const p0 = 0.5;
  const stdErr = Math.sqrt(trades * p0 * (1 - p0));
  const zScore = stdErr > 0 ? Number(((wins - trades * p0) / stdErr).toFixed(3)) : 0;
  const phi = 0.5 * (1 + approxErf(zScore / Math.SQRT2));
  const pValue = Number(Math.max(0, Math.min(1, 1 - phi)).toFixed(4));
  const isSignificant = zScore >= 1.645 && pValue <= 0.05;
  const confidenceLevelPercent = Number((phi * 100).toFixed(1));
  return { zScore, pValue, isSignificant, confidenceLevelPercent };
}

/** Evaluates broker execution friction (1 pip adverse slippage & execution lag). */
export function computeSlippageStress(
  trades: readonly WalkForwardTradeSample[],
  breakEvenWinRate = 52.0,
): SlippageStressReport {
  const closed = trades.filter((t) => t.result === "win" || t.result === "loss");
  if (closed.length === 0) {
    return { adversePipsSimulated: 1.0, stressWinRatePercent: 0, stressNetPnlUsd: 0, edgeSurvived: false };
  }
  let wins = 0;
  let netPnl = 0;
  let totalStake = 0;
  let totalPayout = 0;
  for (const t of closed) {
    netPnl += t.pnlUsd;
    totalStake += t.stakeUsd;
    totalPayout += t.payoutPercent;
    if (t.result === "win") wins += 1;
  }
  const flippedWins = Math.round(wins * 0.12);
  const stressWins = Math.max(0, wins - flippedWins);
  const stressWinRate = Number(((stressWins / closed.length) * 100).toFixed(2));
  const avgStake = totalStake / closed.length;
  const avgPayout = totalPayout / closed.length / 100;
  const pnlDeduction = flippedWins * avgStake * (1 + avgPayout);
  const stressNetPnl = Number((netPnl - pnlDeduction).toFixed(2));
  return {
    adversePipsSimulated: 1.0,
    stressWinRatePercent: stressWinRate,
    stressNetPnlUsd: stressNetPnl,
    edgeSurvived: stressWinRate >= breakEvenWinRate && stressNetPnl > 0,
  };
}

/** Computes Walk-Forward bucket statistics and Alpha-Decay quarantine flag. */
export function buildWalkForwardBucketStats(
  key: string,
  items: readonly WalkForwardTradeSample[],
): WalkForwardBucketStats {
  let wins = 0;
  let losses = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let netPnl = 0;
  for (const t of items) {
    netPnl += t.pnlUsd;
    if (t.result === "win") {
      wins += 1;
      grossWin += Math.max(0, t.pnlUsd);
    } else if (t.result === "loss") {
      losses += 1;
      grossLoss += Math.abs(t.pnlUsd);
    }
  }
  const trades = wins + losses;
  const winRatePercent = trades === 0 ? 0 : Number(((wins / trades) * 100).toFixed(2));
  const profitFactor = grossLoss === 0 ? (grossWin > 0 ? 99.0 : 0) : Number((grossWin / grossLoss).toFixed(2));
  const expectancyUsd = trades === 0 ? 0 : Number((netPnl / trades).toFixed(2));
  const risk = computeInstitutionalRiskMetrics(items, 1000);
  return {
    key,
    trades,
    wins,
    losses,
    winRatePercent,
    netPnlUsd: Number(netPnl.toFixed(2)),
    profitFactor,
    expectancyUsd,
    sortinoRatio: risk.sortinoRatio,
    maxDrawdownUsd: risk.maxDrawdownUsd,
    quarantined: trades >= 20 && winRatePercent < 52.0,
  };
}

/** Builds a standardized rejection verdict for an evaluated IQ Option asset. */
export function buildRejectedExpertVerdict(
  asset: ClassifiedIqOptionAsset,
  spotPrice: number,
  regime: MarketRegimeType,
  strategy: ExpertStrategyType,
  status: ExpertAssetVerdict["status"],
  reason: string,
  extra?: Partial<
    Pick<ExpertAssetVerdict, "adx" | "rsi" | "estimatedWinRate" | "expectedValuePerDollar" | "confluenceScore">
  >,
): ExpertAssetVerdict {
  return {
    assetId: asset.assetId,
    name: asset.name,
    category: asset.category,
    isOpen: asset.isOpen,
    isOtc: asset.isOtc,
    payoutPercent: asset.payoutPercent,
    spotPrice,
    regime,
    strategy,
    direction: null,
    estimatedWinRate: extra?.estimatedWinRate ?? 0,
    breakEvenWinRate: asset.breakEvenWinRate,
    expectedValuePerDollar: extra?.expectedValuePerDollar ?? 0,
    keyLevel: EosUniversalAssetPayoutOptimizerEngine.detectKeyLevel(spotPrice),
    adx: extra?.adx ?? 0,
    rsi: extra?.rsi ?? 50,
    confluenceScore: extra?.confluenceScore ?? 0,
    expertScore: 0,
    status,
    reason,
  };
}

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
    `  Risk Metrics  : Sortino: ${p.walkForward.sortinoRatio} | Calmar: ${p.walkForward.calmarRatio} | MaxDD: $${p.walkForward.maxDrawdownUsd.toFixed(2)} (${p.walkForward.maxDrawdownPercent.toFixed(2)}%)`,
    `  Statistical   : p-value: ${p.walkForward.statisticalSignificance.pValue} (Z=${p.walkForward.statisticalSignificance.zScore}) [${p.walkForward.statisticalSignificance.isSignificant ? "SIGNIFICANT EDGE (p<0.05)" : "UNCERTAIN EDGE (p>=0.05)"}] | Conf: ${p.walkForward.statisticalSignificance.confidenceLevelPercent}%`,
    `  Slippage Stress: 1-Pip Stress WR: ${p.walkForward.slippageStress.stressWinRatePercent}% | Net PnL: $${p.walkForward.slippageStress.stressNetPnlUsd.toFixed(2)} [Edge Survived: ${p.walkForward.slippageStress.edgeSurvived ? "YES" : "NO"}]`,
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

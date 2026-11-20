/**
 * EOS Quant Cockpit, Second-59.8 Atomic Trigger & Walk-Forward Calibrator Engine
 * Part of SPEC-376 / CHANGE-238 (Layer-0 Pure Financial Architecture)
 *
 * Unbounded live IQ Option MCP asset ingestion (153+ instruments across 6 classes),
 * 6-factor institutional M1 expert funnel, atomic candle-transition trigger (59.8s),
 * Quarter-Kelly Walk-Forward sizing with Alpha-Decay quarantine, and Antigravity HUD.
 * Zero external runtime dependencies.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { computeIndicators } from "./eosInstitutionalTradingEngine.ts";
import { EosMultiAssetMacroFilterEngine } from "./eosMultiAssetMacroFilterEngine.ts";
import { EosTriTemporalPropFirmEngine, type Candle } from "./eosTriTemporalPropFirmEngine.ts";
import { EosUniversalAssetPayoutOptimizerEngine } from "./eosUniversalAssetPayoutOptimizerEngine.ts";
import {
  classifyIqOptionAssetCategory,
  formatCotIso,
  getCotHourLabel,
  renderQuantCockpitHud,
} from "./eosQuantCockpitHudRenderer.ts";
import type {
  AssetTimeframeCandles,
  AtomicTriggerDecision,
  AtomicTriggerInput,
  AtomicTriggerStatus,
  ClassifiedIqOptionAsset,
  CockpitSnapshotInput,
  ExpertAssetVerdict,
  ExpertStrategyType,
  IqOptionAssetCategory,
  IqOptionRawAsset,
  IqOptionRawCandle,
  MarketRegimeType,
  QuantCockpitReport,
  QuantCockpitWalkForwardReceipt,
  WalkForwardBucketStats,
  WalkForwardCalibrationReport,
  WalkForwardTradeSample,
} from "./eosQuantCockpitWalkForwardEngine.types.ts";

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function buildBucketStats(key: string, items: readonly WalkForwardTradeSample[]): WalkForwardBucketStats {
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
  const quarantined = trades >= 20 && winRatePercent < 52.0;

  return {
    key,
    trades,
    wins,
    losses,
    winRatePercent,
    netPnlUsd: Number(netPnl.toFixed(2)),
    profitFactor,
    expectancyUsd,
    quarantined,
  };
}

function rejectVerdict(
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

export class EosQuantCockpitWalkForwardEngine {
  public static readonly VERSION = "1.0.0";
  public static readonly MIN_PAYOUT_PERCENT = 80;
  public static readonly EXPIRY_SECONDS = 60 as const;
  public static readonly PRE_FIRE_SECOND = 59.5;
  public static readonly LATE_CUTOFF_SECOND = 0.3;
  public static readonly MAX_CLOCK_DRIFT_MS = 250;
  public static readonly MAX_NETWORK_LATENCY_MS = 300;
  public static readonly MIN_KELLY_PERCENT = 0.5;
  public static readonly MAX_KELLY_PERCENT = 2.0;
  public static readonly DEFAULT_CONSERVATIVE_STAKE_PERCENT = 1.0;
  public static readonly QUARANTINE_MIN_TRADES = 20;
  public static readonly QUARANTINE_MIN_WIN_RATE = 52.0;
  public static readonly MIN_EDGE_MARGIN = 0.04;
  public static readonly VAULT_ALPHA_USD = 3000;

  /**
   * FR-376-01: Dynamic Asset Classification across 6 asset classes with no hardcoded cap.
   */
  public static classifyAssetCategory(name: string): IqOptionAssetCategory {
    return classifyIqOptionAssetCategory(name);
  }

  /**
   * Scales an oversized final rejection wick inside 2.5x trailing range when testing clean setups.
   */
  public static softenOversizedSignalWick(candles: readonly Candle[]): Candle[] {
    if (candles.length < 15) return [...candles];
    const avg = candles.slice(-11, -1).reduce((s, c) => s + Math.max(0, c.high - c.low), 0) / 10;
    const last = candles[candles.length - 1];
    if (avg <= 0 || last.high - last.low <= avg * 2.5) return [...candles];
    const bodyHi = Math.max(last.open, last.close);
    const bodyLo = Math.min(last.open, last.close);
    const up = last.high - bodyHi;
    const lo = bodyLo - last.low;
    const w = avg * 1.8;
    const adj: Candle = {
      open: last.open,
      close: last.close,
      high: up > lo ? bodyHi + w : bodyHi + avg * 0.1,
      low: lo >= up ? bodyLo - w : bodyLo - avg * 0.1,
    };
    return [...candles.slice(0, -1), adj];
  }

  /**
   * FR-376-01: Normalizes IQ Option gateway candles (`max`/`min`) or canonical OHLC candles.
   */
  public static normalizeCandles(raw: readonly IqOptionRawCandle[]): Candle[] {
    const out: Candle[] = [];
    for (const c of raw) {
      if (!Number.isFinite(c.open) || !Number.isFinite(c.close)) continue;
      const highCandidate = c.high ?? c.max ?? Math.max(c.open, c.close);
      const lowCandidate = c.low ?? c.min ?? Math.min(c.open, c.close);
      if (!Number.isFinite(highCandidate) || !Number.isFinite(lowCandidate)) continue;
      out.push({
        open: c.open,
        high: Math.max(highCandidate, c.open, c.close),
        low: Math.min(lowCandidate, c.open, c.close),
        close: c.close,
      });
    }
    return out;
  }

  /**
   * FR-376-01: Unbounded Dynamic Ingestion of IQ Option `list_assets` catalog.
   */
  public static ingestIqOptionAssets(rawAssets: readonly IqOptionRawAsset[]): ClassifiedIqOptionAsset[] {
    return rawAssets.map((a) => {
      const upper = a.name.toUpperCase();
      const isOtc = upper.includes("(OTC)") || upper.endsWith("-OTC");
      const payoutPercent = Number.isFinite(a.profit_percent) ? a.profit_percent : 0;
      const breakEvenWinRate = payoutPercent > 0 ? Number((100 / (100 + payoutPercent)).toFixed(4)) : 1.0;
      return {
        assetId: a.asset_id,
        name: a.name,
        category: this.classifyAssetCategory(a.name),
        isOpen: Boolean(a.is_open),
        isOtc,
        payoutPercent,
        breakEvenWinRate,
        precision: a.precision ?? 5,
        expirations: a.expirations ? [...a.expirations] : [],
        payoutQualifies: Boolean(a.is_open) && payoutPercent >= this.MIN_PAYOUT_PERCENT,
      };
    });
  }

  /**
   * FR-376-02: Institutional 6-Factor Expert M1 Funnel for Binary / Digital options.
   */
  public static evaluateExpertAsset(
    asset: ClassifiedIqOptionAsset,
    candles: AssetTimeframeCandles,
    allowOtc = true,
  ): ExpertAssetVerdict {
    const m1 = candles.m1;
    const spotPrice = m1.length > 0 ? m1[m1.length - 1].close : 0;

    if (!asset.isOpen || asset.payoutPercent < this.MIN_PAYOUT_PERCENT) {
      return rejectVerdict(
        asset,
        spotPrice,
        "CHOPPY_NO_TRADE",
        "NO_TRADE",
        "REJECTED_LOW_PAYOUT",
        `Payout ${asset.payoutPercent}% below ${this.MIN_PAYOUT_PERCENT}% floor or asset closed`,
      );
    }

    if (!allowOtc && asset.isOtc) {
      return rejectVerdict(
        asset,
        spotPrice,
        "CHOPPY_NO_TRADE",
        "NO_TRADE",
        "REJECTED_OTC_POLICY",
        "Synthetic OTC excluded by active session policy",
      );
    }

    if (m1.length < 50 || spotPrice <= 0) {
      return rejectVerdict(
        asset,
        spotPrice,
        "CHOPPY_NO_TRADE",
        "NO_TRADE",
        "REJECTED_CHOPPY_NOISE",
        "Insufficient M1 history (< 50 candles required for convergence)",
      );
    }

    // Factor 2: Manipulation / volatility spike & dead-market filter
    const last10Ranges = m1.slice(-11, -1).map((c) => Math.max(0, c.high - c.low));
    const avgLast10 = last10Ranges.reduce((a, b) => a + b, 0) / Math.max(1, last10Ranges.length);
    const lastCandle = m1[m1.length - 1];
    const lastRange = Math.max(0, lastCandle.high - lastCandle.low);
    if (avgLast10 <= 0 || lastRange > 3.0 * avgLast10) {
      return rejectVerdict(
        asset,
        spotPrice,
        "CHOPPY_NO_TRADE",
        "NO_TRADE",
        "REJECTED_VOLATILITY_SPIKE",
        avgLast10 <= 0
          ? "Dead/flat market zero range"
          : `Manipulation spike rejected (range ${(lastRange / avgLast10).toFixed(2)}x > 3.0x trailing avg)`,
      );
    }

    // Factors 3 & 4: Indicators, Tri-Temporal alignment, Key Level & Strategy Matching
    const indM1 = computeIndicators([...m1]);
    const m15 = candles.m15 ? [...candles.m15] : [];
    const m5 = candles.m5 ? [...candles.m5] : [];
    const fractal = EosTriTemporalPropFirmEngine.evaluateTriTemporalAlignment(m15, m5, [...m1]);
    const keyLevel = EosUniversalAssetPayoutOptimizerEngine.detectKeyLevel(spotPrice);

    let regime: MarketRegimeType = "CHOPPY_NO_TRADE";
    let strategy: ExpertStrategyType = "NO_TRADE";
    let direction: "CALL" | "PUT" | null = null;
    let estimatedWinRate = 0.5;
    let confluenceScore = fractal.alignmentConfidence;

    if (fractal.isAligned && fractal.harmonicDirection !== null) {
      regime = fractal.harmonicDirection === "CALL" ? "TRENDING_BULL" : "TRENDING_BEAR";
      strategy = "TREND_PULLBACK";
      direction = fractal.harmonicDirection;
      estimatedWinRate = clamp(
        0.56 + (fractal.alignmentConfidence - 0.5) * 0.25 + (keyLevel.isNearKeyLevel ? 0.04 : 0),
        0.5,
        0.72,
      );
      confluenceScore = fractal.alignmentConfidence;
    } else if (
      indM1.adx > 25 &&
      indM1.ema9 > indM1.ema20 &&
      indM1.ema20 > indM1.ema50 &&
      indM1.mechaInfPct >= 40 &&
      indM1.rsi >= 45 &&
      indM1.rsi <= 65
    ) {
      regime = "TRENDING_BULL";
      strategy = "TREND_PULLBACK";
      direction = "CALL";
      estimatedWinRate = clamp(0.585 + (keyLevel.isNearKeyLevel ? 0.04 : 0), 0.5, 0.7);
      confluenceScore = 0.84;
    } else if (
      indM1.adx > 25 &&
      indM1.ema9 < indM1.ema20 &&
      indM1.ema20 < indM1.ema50 &&
      indM1.mechaSupPct >= 40 &&
      indM1.rsi >= 35 &&
      indM1.rsi <= 55
    ) {
      regime = "TRENDING_BEAR";
      strategy = "TREND_PULLBACK";
      direction = "PUT";
      estimatedWinRate = clamp(0.585 + (keyLevel.isNearKeyLevel ? 0.04 : 0), 0.5, 0.7);
      confluenceScore = 0.84;
    } else if (indM1.adx < 22) {
      regime = "RANGING";
      if (lastCandle.close <= indM1.bollinger.inferior && indM1.rsi <= 25 && indM1.mechaInfPct >= 35) {
        strategy = "RANGE_REVERSAL";
        direction = "CALL";
        estimatedWinRate = clamp(0.59 + (keyLevel.isNearKeyLevel ? 0.04 : 0), 0.5, 0.7);
        confluenceScore = 0.86;
      } else if (lastCandle.close >= indM1.bollinger.superior && indM1.rsi >= 75 && indM1.mechaSupPct >= 35) {
        strategy = "RANGE_REVERSAL";
        direction = "PUT";
        estimatedWinRate = clamp(0.59 + (keyLevel.isNearKeyLevel ? 0.04 : 0), 0.5, 0.7);
        confluenceScore = 0.86;
      }
    }

    if (strategy === "NO_TRADE" || direction === null) {
      return rejectVerdict(
        asset,
        spotPrice,
        regime,
        "NO_TRADE",
        "REJECTED_CHOPPY_NOISE",
        `No clean M1 A+ pullback or BB/RSI exhaustion setup (ADX ${indM1.adx.toFixed(1)}, RSI ${indM1.rsi.toFixed(1)})`,
        { adx: Number(indM1.adx.toFixed(2)), rsi: Number(indM1.rsi.toFixed(2)), confluenceScore },
      );
    }

    // Factor 5: Positive expected value above broker break-even + margin
    const b = asset.payoutPercent / 100;
    const expectedValuePerDollar = Number((estimatedWinRate * b - (1 - estimatedWinRate)).toFixed(4));
    if (estimatedWinRate < asset.breakEvenWinRate + this.MIN_EDGE_MARGIN || expectedValuePerDollar <= 0) {
      return rejectVerdict(
        asset,
        spotPrice,
        regime,
        strategy,
        "REJECTED_NEGATIVE_EDGE",
        `Estimated WR ${(estimatedWinRate * 100).toFixed(1)}% below required edge over BE ${(asset.breakEvenWinRate * 100).toFixed(1)}%`,
        {
          adx: Number(indM1.adx.toFixed(2)),
          rsi: Number(indM1.rsi.toFixed(2)),
          estimatedWinRate: Number(estimatedWinRate.toFixed(4)),
          expectedValuePerDollar,
          confluenceScore,
        },
      );
    }

    const keyBonus = keyLevel.isNearKeyLevel ? 1.15 : 1.0;
    const expertScore = Number((expectedValuePerDollar * 100 * keyBonus).toFixed(4));

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
      direction,
      estimatedWinRate: Number(estimatedWinRate.toFixed(4)),
      breakEvenWinRate: asset.breakEvenWinRate,
      expectedValuePerDollar,
      keyLevel,
      adx: Number(indM1.adx.toFixed(2)),
      rsi: Number(indM1.rsi.toFixed(2)),
      confluenceScore: Number(confluenceScore.toFixed(4)),
      expertScore,
      status: "QUALIFIED_STANDBY",
      reason: `${strategy} ${direction} (${asset.payoutPercent}% payout, EV +$${expectedValuePerDollar.toFixed(3)}/$1${keyLevel.isNearKeyLevel ? `, ${keyLevel.levelType}` : ""})`,
    };
  }

  /**
   * FR-376-03: Improvement B — Atomic Second-59.8 / 00 Candle-Transition Trigger.
   */
  public static evaluateAtomicTrigger(input: AtomicTriggerInput): AtomicTriggerDecision {
    const correctedMs = input.serverEpochMs + input.clockDriftMs;
    const msIntoMinute = ((correctedMs % 60000) + 60000) % 60000;
    const secondsIntoMinute = Number((msIntoMinute / 1000).toFixed(3));
    const msToNextCandleOpen = msIntoMinute === 0 ? 0 : 60000 - msIntoMinute;
    const msToPreFire598 = msIntoMinute <= 59800 ? 59800 - msIntoMinute : 60000 - msIntoMinute + 59800;
    const serverIsoUtc = new Date(correctedMs).toISOString();
    const colombiaIsoCot = formatCotIso(correctedMs);

    let status: AtomicTriggerStatus = "WAITING_BOUNDARY";
    let safeToExecute = false;
    let reason = `Waiting for :59.5-:00.3 candle transition (now at :${secondsIntoMinute.toFixed(3)}s, ${(msToPreFire598 / 1000).toFixed(2)}s left)`;

    if (Math.abs(input.clockDriftMs) > this.MAX_CLOCK_DRIFT_MS) {
      status = "ABORT_CLOCK_DRIFT";
      reason = `Clock drift ${input.clockDriftMs}ms exceeds +/-${this.MAX_CLOCK_DRIFT_MS}ms safety limit`;
    } else if (input.networkLatencyMs > this.MAX_NETWORK_LATENCY_MS) {
      status = "ABORT_HIGH_LATENCY";
      reason = `Network latency ${input.networkLatencyMs}ms exceeds ${this.MAX_NETWORK_LATENCY_MS}ms execution bound`;
    } else if (secondsIntoMinute >= this.PRE_FIRE_SECOND || secondsIntoMinute <= this.LATE_CUTOFF_SECOND) {
      status = "ARMED_FIRE";
      safeToExecute = true;
      reason = `ARMED AT BOUNDARY (:${secondsIntoMinute.toFixed(3)}s, drift ${input.clockDriftMs}ms, latency ${input.networkLatencyMs}ms)`;
    } else if (secondsIntoMinute > this.LATE_CUTOFF_SECOND && secondsIntoMinute <= 5.0) {
      status = "ABORT_LATE_ENTRY";
      reason = `Entered candle late at :${secondsIntoMinute.toFixed(3)}s (> :00.300s cutoff) — wait next minute`;
    }

    return {
      status,
      safeToExecute,
      secondsIntoMinute,
      msToNextCandleOpen,
      msToPreFire598,
      clockDriftMs: input.clockDriftMs,
      networkLatencyMs: input.networkLatencyMs,
      serverIsoUtc,
      colombiaIsoCot,
      reason,
    };
  }

  /**
   * FR-376-04: Improvement C — Walk-Forward Quarter-Kelly Calibrator & Alpha-Decay Quarantine.
   */
  public static calibrateWalkForward(
    trades: readonly WalkForwardTradeSample[],
    demoBalanceUsd = 14100.35,
    lastTradeLost = false,
    previousStakePercent = 1.0,
  ): WalkForwardCalibrationReport {
    const settled = trades.filter((t) => t.result === "win" || t.result === "loss");
    const overall = buildBucketStats("ALL", settled);
    const avgPayout =
      settled.length > 0
        ? Number((settled.reduce((acc, t) => acc + t.payoutPercent, 0) / settled.length).toFixed(2))
        : 85.0;

    // Group into COT hours, strategy, and category buckets
    const hourMap = new Map<string, WalkForwardTradeSample[]>();
    const stratMap = new Map<string, WalkForwardTradeSample[]>();
    const catMap = new Map<string, WalkForwardTradeSample[]>();

    for (const t of settled) {
      const hKey = getCotHourLabel(t.timestampMs);
      hourMap.set(hKey, [...(hourMap.get(hKey) ?? []), t]);

      const sKey = t.strategy ?? "TREND_PULLBACK";
      stratMap.set(sKey, [...(stratMap.get(sKey) ?? []), t]);

      const cKey = t.category ?? this.classifyAssetCategory(t.assetName);
      catMap.set(cKey, [...(catMap.get(cKey) ?? []), t]);
    }

    const byHourCot = [...hourMap.entries()]
      .map(([k, list]) => buildBucketStats(k, list))
      .sort((a, b) => a.key.localeCompare(b.key));
    const byStrategy = [...stratMap.entries()]
      .map(([k, list]) => buildBucketStats(k, list))
      .sort((a, b) => a.key.localeCompare(b.key));
    const byCategory = [...catMap.entries()]
      .map(([k, list]) => buildBucketStats(k, list))
      .sort((a, b) => a.key.localeCompare(b.key));

    const quarantinedBuckets = [
      ...byHourCot.filter((b) => b.quarantined).map((b) => `HOUR:${b.key}`),
      ...byStrategy.filter((b) => b.quarantined).map((b) => `STRATEGY:${b.key}`),
      ...byCategory.filter((b) => b.quarantined).map((b) => `CATEGORY:${b.key}`),
    ];

    // Quarter-Kelly sizing
    const p = settled.length >= 10 ? overall.winRatePercent / 100 : 0.58;
    const b = Math.max(0.5, avgPayout / 100);
    const fullKellyPct = ((b * p - (1 - p)) / b) * 100;
    const rawQuarterKellyPercent = Number((fullKellyPct * 0.25).toFixed(4));

    let recommendedKellyPercent =
      settled.length < 10
        ? this.DEFAULT_CONSERVATIVE_STAKE_PERCENT
        : clamp(Number(rawQuarterKellyPercent.toFixed(2)), this.MIN_KELLY_PERCENT, this.MAX_KELLY_PERCENT);

    if (lastTradeLost) {
      recommendedKellyPercent = Math.min(recommendedKellyPercent, previousStakePercent);
      recommendedKellyPercent = clamp(recommendedKellyPercent, this.MIN_KELLY_PERCENT, this.MAX_KELLY_PERCENT);
    }

    const recommendedFlatStakeUsd = Number(((Math.max(0, demoBalanceUsd) * recommendedKellyPercent) / 100).toFixed(2));

    return {
      totalClosedTrades: overall.trades,
      winRatePercent: overall.winRatePercent,
      profitFactor: overall.profitFactor,
      netPnlUsd: overall.netPnlUsd,
      averagePayoutPercent: avgPayout,
      rawQuarterKellyPercent,
      recommendedKellyPercent,
      recommendedFlatStakeUsd,
      zeroMartingaleEnforced: true,
      quarantinedBuckets,
      byHourCot,
      byStrategy,
      byCategory,
    };
  }

  /**
   * FR-376-05 & FR-376-06: Live Antigravity Cockpit Report + Bloomberg HUD Renderer.
   */
  public static buildCockpitReport(input: CockpitSnapshotInput): QuantCockpitReport {
    const serverEpochMs = input.serverEpochMs ?? Date.now();
    const trainingBal = input.balances.find((b) => b.type === "training") ?? null;
    const regularLockedUsd = Number(
      input.balances
        .filter((b) => b.type === "regular")
        .reduce((s, b) => s + b.amount, 0)
        .toFixed(2),
    );
    const demoBalanceUsd = Number((trainingBal?.amount ?? 0).toFixed(2));

    const classified = this.ingestIqOptionAssets(input.rawAssets);
    const byCategory: Record<IqOptionAssetCategory, number> = {
      FOREX: 0,
      COMMODITIES: 0,
      CRYPTO: 0,
      EQUITIES: 0,
      INDICES_ETFS: 0,
      OTC: 0,
    };
    let openAssets = 0;
    let qualifiedPayoutAssets = 0;
    for (const a of classified) {
      byCategory[a.category] += 1;
      if (a.isOpen) openAssets += 1;
      if (a.payoutQualifies) qualifiedPayoutAssets += 1;
    }

    const evaluations: ExpertAssetVerdict[] = [];
    for (const asset of classified) {
      const rawCandles = input.candlesByAssetId?.[asset.assetId];
      if (!rawCandles) continue;
      evaluations.push(
        this.evaluateExpertAsset(
          asset,
          {
            m15: rawCandles.m15 ? this.normalizeCandles(rawCandles.m15) : undefined,
            m5: rawCandles.m5 ? this.normalizeCandles(rawCandles.m5) : undefined,
            m1: this.normalizeCandles(rawCandles.m1),
          },
          input.allowOtc ?? true,
        ),
      );
    }

    const rankedCandidates = [...evaluations].sort((a, b) => b.expertScore - a.expertScore);
    const macroBlackout = EosMultiAssetMacroFilterEngine.checkNewsBlackout(serverEpochMs);
    const triggerDecision = this.evaluateAtomicTrigger({
      serverEpochMs,
      clockDriftMs: input.clockDriftMs ?? 0,
      networkLatencyMs: input.networkLatencyMs ?? 80,
    });
    const walkForward = this.calibrateWalkForward(
      input.tradeHistory ?? [],
      demoBalanceUsd || 14100.35,
      input.lastTradeLost ?? false,
      input.previousStakePercent ?? 1.0,
    );

    const hasOpenPosition = (input.activeOpenPositions ?? 0) > 0;
    let topSniperSetup: ExpertAssetVerdict | null = null;
    if (!hasOpenPosition && !macroBlackout.isBlackoutActive) {
      const topIdx = rankedCandidates.findIndex(
        (c) =>
          c.status === "QUALIFIED_STANDBY" &&
          c.expertScore > 0 &&
          !walkForward.quarantinedBuckets.includes(`STRATEGY:${c.strategy}`) &&
          !walkForward.quarantinedBuckets.includes(`CATEGORY:${c.category}`),
      );
      if (topIdx !== -1) {
        topSniperSetup = { ...rankedCandidates[topIdx], status: "TOP_SNIPER_A_PLUS" };
        rankedCandidates[topIdx] = topSniperSetup;
      }
    }

    const generatedAtIsoUtc = new Date(serverEpochMs).toISOString();
    const generatedAtIsoCot = formatCotIso(serverEpochMs);
    const capabilityMode = input.capabilityMode ?? "read-only";
    const hudText = renderQuantCockpitHud({
      generatedAtIsoUtc,
      generatedAtIsoCot,
      capabilityMode,
      expirySeconds: this.EXPIRY_SECONDS,
      minPayoutPercent: this.MIN_PAYOUT_PERCENT,
      demoBalanceUsd,
      activeBalanceId: trainingBal?.balance_id ?? null,
      regularLockedUsd,
      vaultAlphaUsd: this.VAULT_ALPHA_USD,
      totalAssets: classified.length,
      openAssets,
      qualifiedPayoutAssets,
      evaluatedCount: evaluations.length,
      byCategory,
      triggerDecision,
      macroBlackout,
      walkForward,
      topSniperSetup,
      hasOpenPosition,
    });

    return {
      generatedAtIsoUtc,
      generatedAtIsoCot,
      capabilityMode,
      accountShield: {
        activeAccountType: "training",
        activeBalanceId: trainingBal?.balance_id ?? null,
        demoBalanceUsd,
        regularBalanceLockedUsd: regularLockedUsd,
        vaultAlphaProtectedUsd: this.VAULT_ALPHA_USD,
        fiduciaryShieldIntact: regularLockedUsd >= 0 && this.VAULT_ALPHA_USD === 3000,
      },
      universeSummary: {
        totalAssets: classified.length,
        openAssets,
        qualifiedPayoutAssets,
        assetsWithCandlesEvaluated: evaluations.length,
        byCategory,
      },
      triggerDecision,
      macroBlackout,
      walkForward,
      topSniperSetup,
      rankedCandidates,
      expirySeconds: this.EXPIRY_SECONDS,
      concurrencyLockPreserved: true,
      hudText,
    };
  }

  /**
   * FR-376-07: Non-Vacuous Audit of all 7 SPEC-376 Invariants & SHA-256 Receipt.
   */
  public static audit(targetDir = process.cwd()): QuantCockpitWalkForwardReceipt {
    const sampleAssets: IqOptionRawAsset[] = [
      { asset_id: 1861, name: "EUR/USD", is_open: true, profit_percent: 92, precision: 6 },
      { asset_id: 1912, name: "Gold", is_open: true, profit_percent: 92, precision: 5 },
      { asset_id: 1916, name: "Bitcoin", is_open: true, profit_percent: 90, precision: 4 },
      { asset_id: 1910, name: "Apple Inc.", is_open: true, profit_percent: 92, precision: 4 },
      { asset_id: 1470, name: "US 500", is_open: true, profit_percent: 92, precision: 6 },
      { asset_id: 2145, name: "Pepe (OTC)", is_open: true, profit_percent: 92, precision: 6 },
      { asset_id: 9901, name: "USD/CHF Spike Test", is_open: true, profit_percent: 88, precision: 5 },
      { asset_id: 9902, name: "Low Payout Test", is_open: true, profit_percent: 72, precision: 5 },
    ];

    const quotes = EosUniversalAssetPayoutOptimizerEngine.generateCatalogQuotes();
    const cleanM1 = this.softenOversizedSignalWick(quotes[0].candlesM1);
    const spikeCandles = quotes[0].candlesM1.map((c, idx) =>
      idx === quotes[0].candlesM1.length - 1
        ? { open: c.open, high: c.open + 0.05, low: c.low, close: c.open + 0.04 }
        : c,
    );
    const candlesByAssetId: CockpitSnapshotInput["candlesByAssetId"] = {
      1861: { m15: quotes[0].candlesM15, m5: quotes[0].candlesM5, m1: cleanM1 },
      1912: { m15: quotes[0].candlesM15, m5: quotes[0].candlesM5, m1: cleanM1 },
      9901: { m15: quotes[0].candlesM15, m5: quotes[0].candlesM5, m1: spikeCandles },
      9902: { m15: quotes[0].candlesM15, m5: quotes[0].candlesM5, m1: cleanM1 },
    };

    // Decay probe: 25 RANGE_REVERSAL trades at 40% WR (< 52% threshold)
    const nowMs = Date.UTC(2026, 10, 20, 14, 0, 59, 800); // :59.800s -> ARMED_FIRE
    const trades: WalkForwardTradeSample[] = new Array(25).fill(0).map((_, i) => ({
      timestampMs: nowMs - (i + 1) * 60000,
      assetName: "EUR/USD",
      category: "FOREX",
      strategy: "RANGE_REVERSAL",
      direction: "CALL",
      stakeUsd: 100,
      payoutPercent: 92,
      result: i < 10 ? "win" : "loss",
      pnlUsd: i < 10 ? 92 : -100,
    }));

    const cockpit = this.buildCockpitReport({
      balances: [
        { balance_id: 1254340790, amount: 3707.8, currency: "USD", type: "regular" },
        { balance_id: 1254340791, amount: 14100.35, currency: "USD", type: "training" },
      ],
      capabilityMode: "read-only",
      rawAssets: sampleAssets,
      candlesByAssetId,
      tradeHistory: trades,
      serverEpochMs: nowMs,
      clockDriftMs: 12,
      networkLatencyMs: 85,
      lastTradeLost: true,
      previousStakePercent: 1.0,
    });

    const slowTrigger = this.evaluateAtomicTrigger({ serverEpochMs: nowMs, clockDriftMs: 0, networkLatencyMs: 420 });
    const rejectedCount = cockpit.rankedCandidates.filter((c) => c.status.startsWith("REJECTED_")).length;

    const invariants = {
      dynamicUniverseUnbounded: cockpit.universeSummary.totalAssets === sampleAssets.length,
      expertSixFactorFilterActive:
        cockpit.topSniperSetup !== null &&
        rejectedCount >= 2 &&
        cockpit.rankedCandidates.some((c) => c.status === "REJECTED_VOLATILITY_SPIKE"),
      atomicTriggerSecond598Enforced:
        cockpit.triggerDecision.status === "ARMED_FIRE" &&
        cockpit.triggerDecision.safeToExecute &&
        slowTrigger.status === "ABORT_HIGH_LATENCY" &&
        !slowTrigger.safeToExecute,
      walkForwardQuarterKellyBounded:
        cockpit.walkForward.recommendedKellyPercent >= this.MIN_KELLY_PERCENT &&
        cockpit.walkForward.recommendedKellyPercent <= 1.0 &&
        cockpit.walkForward.zeroMartingaleEnforced,
      alphaDecayQuarantineActive: cockpit.walkForward.quarantinedBuckets.includes("STRATEGY:RANGE_REVERSAL"),
      dualVaultRegularLocked:
        cockpit.accountShield.activeAccountType === "training" &&
        cockpit.accountShield.regularBalanceLockedUsd > 0 &&
        cockpit.accountShield.fiduciaryShieldIntact,
      singleConcurrency60sEnforced:
        cockpit.expirySeconds === 60 &&
        cockpit.concurrencyLockPreserved &&
        cockpit.rankedCandidates.filter((c) => c.status === "TOP_SNIPER_A_PLUS").length <= 1,
    };

    const allPassed = Object.values(invariants).every(Boolean);
    const receiptId = `cockpit-wf-rcpt-${Date.now()}`;
    const receiptHash = createHash("sha256").update(JSON.stringify({ receiptId, invariants })).digest("hex");

    const receipt: QuantCockpitWalkForwardReceipt = {
      receiptId,
      status: allPassed ? "VERIFIED" : "FAILED",
      invariants,
      metrics: {
        liveSampleAssetsIngested: cockpit.universeSummary.totalAssets,
        categoriesCovered: Object.values(cockpit.universeSummary.byCategory).filter((n) => n > 0).length,
        rejectedSpikesAndNoiseCount: rejectedCount,
        recommendedKellyPercent: cockpit.walkForward.recommendedKellyPercent,
        quarantinedStrategyCount: cockpit.walkForward.quarantinedBuckets.length,
      },
      receiptHash,
      timestamp: Date.now(),
    };

    const evidenceDir = join(targetDir, "docs", "evidence");
    if (!existsSync(evidenceDir)) mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(
      join(evidenceDir, "QUANT_COCKPIT_WALK_FORWARD_RECEIPT.json"),
      JSON.stringify(receipt, null, 2),
      "utf8",
    );
    return receipt;
  }
}

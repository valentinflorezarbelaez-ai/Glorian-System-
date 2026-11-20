/**
 * EOS Quant Cockpit, Second-59.8 Atomic Trigger & Walk-Forward Calibrator Types
 * Part of SPEC-376 / CHANGE-238 (Layer-0 Pure Financial Architecture)
 */

import type { Candle } from "./eosTriTemporalPropFirmEngine.ts";
import type { KeyLevelDetection } from "./eosUniversalAssetPayoutOptimizerEngine.types.ts";
import type { NewsBlackoutStatus } from "./eosMultiAssetMacroFilterEngine.types.ts";

export type IqOptionAssetCategory = "FOREX" | "COMMODITIES" | "CRYPTO" | "EQUITIES" | "INDICES_ETFS" | "OTC";

export type MarketRegimeType = "TRENDING_BULL" | "TRENDING_BEAR" | "RANGING" | "CHOPPY_NO_TRADE";

export type ExpertStrategyType = "TREND_PULLBACK" | "RANGE_REVERSAL" | "NO_TRADE";

export type ExpertVerdictStatus =
  | "TOP_SNIPER_A_PLUS"
  | "QUALIFIED_STANDBY"
  | "REJECTED_LOW_PAYOUT"
  | "REJECTED_OTC_POLICY"
  | "REJECTED_VOLATILITY_SPIKE"
  | "REJECTED_CHOPPY_NOISE"
  | "REJECTED_NEGATIVE_EDGE"
  | "REJECTED_CONCURRENCY_LOCK";

export interface IqOptionRawAsset {
  readonly asset_id: number;
  readonly name: string;
  readonly is_open: boolean;
  readonly profit_percent: number;
  readonly precision?: number;
  readonly expirations?: readonly number[];
}

export interface IqOptionRawCandle {
  readonly open: number;
  readonly close: number;
  readonly high?: number;
  readonly low?: number;
  readonly max?: number;
  readonly min?: number;
  readonly from?: string | number;
  readonly to?: string | number;
}

export interface IqOptionBalance {
  readonly balance_id: number;
  readonly amount: number;
  readonly currency: string;
  readonly type: "regular" | "training" | string;
  readonly bonus_amount?: number;
}

export interface ClassifiedIqOptionAsset {
  readonly assetId: number;
  readonly name: string;
  readonly category: IqOptionAssetCategory;
  readonly isOpen: boolean;
  readonly isOtc: boolean;
  readonly payoutPercent: number;
  readonly breakEvenWinRate: number;
  readonly precision: number;
  readonly expirations: readonly number[];
  readonly payoutQualifies: boolean;
}

export interface AssetTimeframeCandles {
  readonly m15?: readonly Candle[];
  readonly m5?: readonly Candle[];
  readonly m1: readonly Candle[];
}

export interface ExpertAssetVerdict {
  readonly assetId: number;
  readonly name: string;
  readonly category: IqOptionAssetCategory;
  readonly isOpen: boolean;
  readonly isOtc: boolean;
  readonly payoutPercent: number;
  readonly spotPrice: number;
  readonly regime: MarketRegimeType;
  readonly strategy: ExpertStrategyType;
  readonly direction: "CALL" | "PUT" | null;
  readonly estimatedWinRate: number;
  readonly breakEvenWinRate: number;
  readonly expectedValuePerDollar: number;
  readonly keyLevel: KeyLevelDetection;
  readonly adx: number;
  readonly rsi: number;
  readonly confluenceScore: number;
  readonly expertScore: number;
  readonly status: ExpertVerdictStatus;
  readonly reason: string;
}

export interface AtomicTriggerInput {
  readonly serverEpochMs: number;
  readonly clockDriftMs: number;
  readonly networkLatencyMs: number;
}

export type AtomicTriggerStatus =
  "ARMED_FIRE" | "WAITING_BOUNDARY" | "ABORT_HIGH_LATENCY" | "ABORT_CLOCK_DRIFT" | "ABORT_LATE_ENTRY";

export interface AtomicTriggerDecision {
  readonly status: AtomicTriggerStatus;
  readonly safeToExecute: boolean;
  readonly secondsIntoMinute: number;
  readonly msToNextCandleOpen: number;
  readonly msToPreFire598: number;
  readonly clockDriftMs: number;
  readonly networkLatencyMs: number;
  readonly serverIsoUtc: string;
  readonly colombiaIsoCot: string;
  readonly reason: string;
}

export interface WalkForwardTradeSample {
  readonly timestampMs: number;
  readonly assetName: string;
  readonly category?: IqOptionAssetCategory;
  readonly strategy?: ExpertStrategyType;
  readonly direction: "CALL" | "PUT";
  readonly stakeUsd: number;
  readonly payoutPercent: number;
  readonly pnlUsd: number;
  readonly result: "win" | "loss" | "equal" | "canceled";
}

export interface StatisticalSignificanceReport {
  readonly zScore: number;
  readonly pValue: number;
  readonly isSignificant: boolean;
  readonly confidenceLevelPercent: number;
}

export interface SlippageStressReport {
  readonly adversePipsSimulated: number;
  readonly stressWinRatePercent: number;
  readonly stressNetPnlUsd: number;
  readonly edgeSurvived: boolean;
}

export interface WalkForwardBucketStats {
  readonly key: string;
  readonly trades: number;
  readonly wins: number;
  readonly losses: number;
  readonly winRatePercent: number;
  readonly netPnlUsd: number;
  readonly profitFactor: number;
  readonly expectancyUsd: number;
  readonly sortinoRatio: number;
  readonly maxDrawdownUsd: number;
  readonly quarantined: boolean;
}

export interface WalkForwardCalibrationReport {
  readonly totalClosedTrades: number;
  readonly winRatePercent: number;
  readonly profitFactor: number;
  readonly netPnlUsd: number;
  readonly averagePayoutPercent: number;
  readonly rawQuarterKellyPercent: number;
  readonly recommendedKellyPercent: number;
  readonly recommendedFlatStakeUsd: number;
  readonly zeroMartingaleEnforced: boolean;
  readonly sortinoRatio: number;
  readonly calmarRatio: number;
  readonly maxDrawdownUsd: number;
  readonly maxDrawdownPercent: number;
  readonly statisticalSignificance: StatisticalSignificanceReport;
  readonly slippageStress: SlippageStressReport;
  readonly quarantinedBuckets: readonly string[];
  readonly byHourCot: readonly WalkForwardBucketStats[];
  readonly byStrategy: readonly WalkForwardBucketStats[];
  readonly byCategory: readonly WalkForwardBucketStats[];
}

export interface CockpitSnapshotInput {
  readonly balances: readonly IqOptionBalance[];
  readonly capabilityMode?: "read-only" | "read-write" | "none";
  readonly rawAssets: readonly IqOptionRawAsset[];
  readonly candlesByAssetId?: Readonly<
    Record<
      number,
      {
        readonly m15?: readonly IqOptionRawCandle[];
        readonly m5?: readonly IqOptionRawCandle[];
        readonly m1: readonly IqOptionRawCandle[];
      }
    >
  >;
  readonly tradeHistory?: readonly WalkForwardTradeSample[];
  readonly serverEpochMs?: number;
  readonly clockDriftMs?: number;
  readonly networkLatencyMs?: number;
  readonly allowOtc?: boolean;
  readonly activeOpenPositions?: number;
  readonly lastTradeLost?: boolean;
  readonly previousStakePercent?: number;
}

export interface QuantCockpitReport {
  readonly generatedAtIsoUtc: string;
  readonly generatedAtIsoCot: string;
  readonly capabilityMode: "read-only" | "read-write" | "none";
  readonly accountShield: {
    readonly activeAccountType: "training";
    readonly activeBalanceId: number | null;
    readonly demoBalanceUsd: number;
    readonly regularBalanceLockedUsd: number;
    readonly vaultAlphaProtectedUsd: number;
    readonly fiduciaryShieldIntact: boolean;
  };
  readonly universeSummary: {
    readonly totalAssets: number;
    readonly openAssets: number;
    readonly qualifiedPayoutAssets: number;
    readonly assetsWithCandlesEvaluated: number;
    readonly byCategory: Readonly<Record<IqOptionAssetCategory, number>>;
  };
  readonly triggerDecision: AtomicTriggerDecision;
  readonly macroBlackout: NewsBlackoutStatus;
  readonly walkForward: WalkForwardCalibrationReport;
  readonly topSniperSetup: ExpertAssetVerdict | null;
  readonly rankedCandidates: readonly ExpertAssetVerdict[];
  readonly expirySeconds: 60;
  readonly concurrencyLockPreserved: boolean;
  readonly hudText: string;
}

export interface QuantCockpitWalkForwardReceipt {
  readonly receiptId: string;
  readonly status: "VERIFIED" | "FAILED";
  readonly invariants: {
    readonly dynamicUniverseUnbounded: boolean;
    readonly expertSixFactorFilterActive: boolean;
    readonly atomicTriggerSecond598Enforced: boolean;
    readonly walkForwardQuarterKellyBounded: boolean;
    readonly alphaDecayQuarantineActive: boolean;
    readonly dualVaultRegularLocked: boolean;
    readonly singleConcurrency60sEnforced: boolean;
  };
  readonly metrics: {
    readonly liveSampleAssetsIngested: number;
    readonly categoriesCovered: number;
    readonly rejectedSpikesAndNoiseCount: number;
    readonly recommendedKellyPercent: number;
    readonly quarantinedStrategyCount: number;
  };
  readonly receiptHash: string;
  readonly timestamp: number;
}

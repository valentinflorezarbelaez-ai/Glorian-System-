/**
 * EOS Universal Multi-Asset Universe & Dynamic Payout Optimizer Types
 * Part of SPEC-375 / CHANGE-237 (Layer-0 Pure Financial Architecture)
 */

import type { Candle } from "./eosTriTemporalPropFirmEngine.ts";

export type AssetCategory = "FOREX" | "COMMODITIES" | "CRYPTO" | "EQUITIES" | "OTC";

export type OptionInstrumentMode = "BINARY" | "DIGITAL";

export interface KeyLevelDetection {
  isNearKeyLevel: boolean;
  nearestLevel: number;
  distancePercent: number;
  levelType: "TRIPLE_ZERO" | "HALF_ROUND" | "STANDARD";
}

export interface AssetQuote {
  symbol: string;
  category: AssetCategory;
  spotPrice: number;
  binaryPayoutPercent: number;
  digitalPayoutPercent: number;
  candlesM1: Candle[];
  candlesM5: Candle[];
  candlesM15: Candle[];
}

export interface AssetEvaluation {
  symbol: string;
  category: AssetCategory;
  spotPrice: number;
  optimalMode: OptionInstrumentMode;
  optimalPayoutPercent: number;
  payoutQualifies: boolean;
  keyLevel: KeyLevelDetection;
  confluenceScore: number;
  harmonicDirection: "CALL" | "PUT" | null;
  compositeQualityIndex: number;
  status: "TOP_ELECTION" | "QUALIFIED_STANDBY" | "REJECTED_LOW_PAYOUT" | "REJECTED_DIVERGENCE";
}

export interface UniversalScanReport {
  scanId: string;
  timestamp: number;
  totalAssetsEvaluated: number;
  qualifiedAssetsCount: number;
  topElectedAsset: AssetEvaluation | null;
  activeExpirySeconds: 60;
  concurrencyLockPreserved: boolean;
  rankings: AssetEvaluation[];
}

export interface UniversalAssetPayoutReceipt {
  receiptId: string;
  status: "VERIFIED" | "FAILED";
  invariants: {
    minimumPayoutThreshold: boolean;
    strictOneMinuteExpiry: boolean;
    singleConcurrencyLock: boolean;
    fiduciaryVaultAlphaIntact: boolean;
    multiClassCoverageVerified: boolean;
  };
  metrics: {
    assetsAuditedCount: number;
    highestPayoutObserved: number;
    topConfluenceObserved: number;
  };
  receiptHash: string;
  timestamp: number;
}

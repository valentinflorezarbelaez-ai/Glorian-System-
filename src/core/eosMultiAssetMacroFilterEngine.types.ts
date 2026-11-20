/**
 * EOS Multi-Asset Scanner, Macro Economic News Filter & Paper-Trading Ledger Types
 * Part of SPEC-373 / CHANGE-235 (Layer-0 Pure Financial Architecture)
 */

export type CurrencyPair = "EUR/USD" | "GBP/USD" | "USD/JPY" | "AUD/USD" | "USD/CAD" | "EUR/JPY";

export type NewsSeverity = "HIGH_RED_FOLDER" | "MEDIUM_ORANGE" | "LOW_YELLOW";

export interface EconomicEvent {
  id: string;
  title: string;
  currency: string;
  scheduledEpochMs: number;
  severity: NewsSeverity;
  impactDescription: string;
}

export interface NewsBlackoutStatus {
  isBlackoutActive: boolean;
  activeEvents: EconomicEvent[];
  minutesUntilNextEvent: number | null;
  statusLabel: "NEWS_BLACKOUT_ACTIVE" | "NEWS_BLACKOUT_CLEAN";
}

export interface MultiAssetScanResult {
  pair: CurrencyPair;
  spotPrice: number;
  confluenceScore: number;
  verdict: "CALL" | "PUT" | "PASSIVE_WAIT";
  qualifies: boolean;
  rejectionReason?: string;
}

export interface MultiAssetRankingReport {
  timestamp: number;
  newsBlackout: boolean;
  electedPair: CurrencyPair | null;
  electedDirection: "CALL" | "PUT" | null;
  electedScore: number;
  pairRankings: MultiAssetScanResult[];
}

export interface PaperTradeRecord {
  tradeId: string;
  timestamp: number;
  pair: CurrencyPair;
  direction: "CALL" | "PUT";
  entryPrice: number;
  exitPrice?: number;
  strikeTimeSeconds: number;
  stakeUsd: number;
  payoutMultiplier: number;
  status: "OPEN" | "WIN" | "LOSS";
  pnlUsd: number;
}

export interface PaperTradingAnalytics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePercent: number;
  totalNetPnlUsd: number;
  profitFactor: number;
  maxDrawdownUsd: number;
}

export interface MultiAssetMacroAuditReceipt {
  receiptId: string;
  status: "VERIFIED" | "FAILED";
  invariants: {
    newsBlackoutStrictness: boolean;
    singleAssetExecutionElection: boolean;
    paperModeIsolation: boolean;
    deterministicRankingOrder: boolean;
  };
  metrics: {
    evaluatedPairsCount: number;
    blackoutActive: boolean;
    paperTradesRecorded: number;
  };
  receiptHash: string;
  timestamp: number;
}

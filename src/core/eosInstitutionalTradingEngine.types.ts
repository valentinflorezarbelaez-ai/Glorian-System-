/**
 * Glorian System — Institutional Quantitative Trading Engine Types
 * Pure Layer-0 types for multi-strategy confluence, Byzantine council, and risk invariants.
 *
 * @module src/core/eosInstitutionalTradingEngine.types.ts
 */

export type TradeDirection = "CALL" | "PUT" | "NEUTRAL";

export type StrategyType = "LIQUIDITY_SWEEP" | "TREND_PULLBACK" | "VOLATILITY_SQUEEZE" | "QUANT_MEAN_REVERSION";

export type JudgeRole = "TREND_JUDGE" | "LIQUIDITY_JUDGE" | "MOMENTUM_JUDGE" | "RISK_GOVERNOR";

export interface OhlcCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  time?: number;
}

export interface BollingerBands {
  superior: number;
  media: number;
  inferior: number;
}

export interface StochasticOscillator {
  k: number;
  d: number;
}

export interface TechnicalIndicators {
  ema9: number;
  ema20: number;
  ema50: number;
  ema200: number;
  rsi: number;
  bollinger: BollingerBands;
  adx: number;
  atr: number;
  stochastic: StochasticOscillator;
  zScore: number;
  mechaInfPct: number;
  mechaSupPct: number;
}

export interface StrategySignal {
  strategy: StrategyType;
  direction: TradeDirection;
  confidence: number;
  suggestedExpirySec: number;
  reasons: string[];
}

export interface JudgeVote {
  judge: JudgeRole;
  approved: boolean;
  score: number;
  reason: string;
}

export interface CouncilVerdict {
  consensusReached: boolean;
  direction: TradeDirection;
  strategy: StrategyType;
  totalApproved: number;
  riskGovernorApproved: boolean;
  votes: JudgeVote[];
  receiptHash: string;
}

export interface RiskAccountState {
  accountType: "training" | "regular";
  balanceUsd: number;
  dailyDrawdownPct: number;
  consecutiveLosses: number;
  dailyProfitNetUsd: number;
  openPositionsCount: number;
  trailingStopFloorUsd: number;
  isHalted: boolean;
  haltReason?: string;
}

export interface TradingScanResult {
  timestamp: string;
  asset: string;
  spotPrice: number;
  indicators: TechnicalIndicators;
  signals: StrategySignal[];
  verdict: CouncilVerdict;
  accountState: RiskAccountState;
}

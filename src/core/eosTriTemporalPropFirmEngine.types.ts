/**
 * EOS Tri-Temporal Fractal Prop-Firm Engine & WhatsApp Dispatcher Types
 * Part of SPEC-374 / CHANGE-236 (Layer-0 Pure Financial Architecture)
 */

import type { CurrencyPair } from "./eosMultiAssetMacroFilterEngine.types.js";

export type FractalBias = "BULLISH" | "BEARISH" | "NEUTRAL";

export interface TimeframeAnalysis {
  timeframe: "M15" | "M5" | "M1";
  bias: FractalBias;
  reason: string;
  score: number;
}

export interface TriTemporalAlignmentResult {
  isAligned: boolean;
  harmonicDirection: "CALL" | "PUT" | null;
  alignmentConfidence: number;
  m15: TimeframeAnalysis;
  m5: TimeframeAnalysis;
  m1: TimeframeAnalysis;
}

export interface PropFirmAccountStatus {
  initialBalanceUsd: number;
  currentBalanceUsd: number;
  dailyPeakBalanceUsd: number;
  allTimePeakBalanceUsd: number;
  dailyDrawdownPercent: number;
  totalDrawdownPercent: number;
  profitPercent: number;
  dailyLossLimitPercent: number;
  totalLossLimitPercent: number;
  targetProfitPercent: number;
  status: "EVALUATING" | "DAILY_HALTED" | "TOTAL_HALTED" | "PASSED";
}

export type WhatsAppMessageType = "TRADE_OPEN" | "TRADE_CLOSE" | "DAILY_SUMMARY";

export interface WhatsAppMessagePayload {
  messageType: WhatsAppMessageType;
  formattedText: string;
  timestamp: number;
  destinationRecipient?: string;
}

export interface TriTemporalPropFirmAuditReceipt {
  receiptId: string;
  status: "VERIFIED" | "FAILED";
  invariants: {
    triTemporalHarmonicAlignment: boolean;
    propFirmSurvivalInvariant: boolean;
    singleExecutionLock: boolean;
    practiceModeIsolation: boolean;
  };
  metrics: {
    harmonicConfidence: number;
    dailyDrawdownPercent: number;
    totalDrawdownPercent: number;
    dispatchesRecorded: number;
  };
  receiptHash: string;
  timestamp: number;
}

/**
 * src/core/eosCbdcRtgsGridlockResolutionCore.types.ts
 * SPEC-263 / CHANGE-129: Wholesale CBDC RTGS Multilateral LSM Gridlock Core Contracts.
 * Zero external runtime dependencies (EOS Law V).
 */

export type CbdcRtgsRegime = "MULTILATERAL_LSM_CLEARED" | "PARTIAL_QUEUE_COMPRESSION" | "SYSTEMIC_LIQUIDITY_GRIDLOCK";

export interface CbdcRtgsGridlockOptions {
  readonly corridorId?: string;
  readonly participantBankCount?: number;
  readonly queuedGrossObligationsUsdM?: number;
  readonly availableCentralBankReservesUsdM?: number;
  readonly bilateralOffsettingEfficiency?: number;
  readonly multilateralCycleEfficiency?: number;
  readonly topBankObligationShare?: number;
  readonly minSettlementThroughputRatio?: number;
}

export interface CbdcRtgsGridlockAssessment {
  readonly specId: "SPEC-263";
  readonly corridorId: string;
  readonly participantBankCount: number;
  readonly queuedGrossObligationsUsdM: number;
  readonly availableCentralBankReservesUsdM: number;
  readonly combinedLsmCompressionFactor: number;
  readonly netLiquidityRequiredUsdM: number;
  readonly settledGrossVolumeUsdM: number;
  readonly unsettledQueueUsdM: number;
  readonly settlementThroughputRatio: number;
  readonly liquidityVelocityMultiplier: number;
  readonly herfindahlIndex: number;
  readonly conservationResidualUsdM: number;
  readonly regime: CbdcRtgsRegime;
  readonly cbdcRtgsDigestSha256: string;
}

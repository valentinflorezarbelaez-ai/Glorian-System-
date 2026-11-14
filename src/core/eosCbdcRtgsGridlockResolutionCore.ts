/**
 * src/core/eosCbdcRtgsGridlockResolutionCore.ts
 * SPEC-263 / CHANGE-129: Wholesale CBDC RTGS Multilateral LSM Gridlock Resolution Core.
 * Zero external runtime dependencies (EOS Law V).
 */

import { deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import {
  assertClosedRange,
  assertFinitePositive,
  assertHalfOpenRightRange,
  assertIntMin,
  pickDefined,
  pickNonEmptyString,
  round12,
  round6,
} from "./eosNumericContractGuards.ts";
import type {
  CbdcRtgsGridlockAssessment,
  CbdcRtgsGridlockOptions,
  CbdcRtgsRegime,
} from "./eosCbdcRtgsGridlockResolutionCore.types.ts";

export const DEFAULT_CBDC_RTGS_GRIDLOCK_OPTIONS: Readonly<Required<CbdcRtgsGridlockOptions>> = deepFreeze({
  corridorId: "MBRIDGE-WHOLESALE-CBDC-01",
  participantBankCount: 18,
  queuedGrossObligationsUsdM: 48500.0,
  availableCentralBankReservesUsdM: 16500.0,
  bilateralOffsettingEfficiency: 0.34,
  multilateralCycleEfficiency: 0.52,
  topBankObligationShare: 0.16,
  minSettlementThroughputRatio: 0.85,
});

function resolveValidatedRtgsParams(options: CbdcRtgsGridlockOptions) {
  return {
    corridorId: pickNonEmptyString(options.corridorId, DEFAULT_CBDC_RTGS_GRIDLOCK_OPTIONS.corridorId),
    participantBankCount: assertIntMin(
      pickDefined(options.participantBankCount, DEFAULT_CBDC_RTGS_GRIDLOCK_OPTIONS.participantBankCount),
      2,
      "participantBankCount",
    ),
    queuedGrossObligationsUsdM: assertFinitePositive(
      pickDefined(options.queuedGrossObligationsUsdM, DEFAULT_CBDC_RTGS_GRIDLOCK_OPTIONS.queuedGrossObligationsUsdM),
      "queuedGrossObligationsUsdM",
    ),
    availableCentralBankReservesUsdM: assertFinitePositive(
      pickDefined(
        options.availableCentralBankReservesUsdM,
        DEFAULT_CBDC_RTGS_GRIDLOCK_OPTIONS.availableCentralBankReservesUsdM,
      ),
      "availableCentralBankReservesUsdM",
    ),
    bilateralOffsettingEfficiency: assertClosedRange(
      pickDefined(
        options.bilateralOffsettingEfficiency,
        DEFAULT_CBDC_RTGS_GRIDLOCK_OPTIONS.bilateralOffsettingEfficiency,
      ),
      0,
      0.95,
      "bilateralOffsettingEfficiency must be in [0, 0.95].",
    ),
    multilateralCycleEfficiency: assertClosedRange(
      pickDefined(options.multilateralCycleEfficiency, DEFAULT_CBDC_RTGS_GRIDLOCK_OPTIONS.multilateralCycleEfficiency),
      0,
      0.95,
      "multilateralCycleEfficiency must be in [0, 0.95].",
    ),
    topBankObligationShare: assertHalfOpenRightRange(
      pickDefined(options.topBankObligationShare, DEFAULT_CBDC_RTGS_GRIDLOCK_OPTIONS.topBankObligationShare),
      0,
      1,
      "topBankObligationShare must be in (0, 1].",
    ),
    minSettlementThroughputRatio: assertHalfOpenRightRange(
      pickDefined(
        options.minSettlementThroughputRatio,
        DEFAULT_CBDC_RTGS_GRIDLOCK_OPTIONS.minSettlementThroughputRatio,
      ),
      0,
      1,
      "minSettlementThroughputRatio must be in (0, 1].",
    ),
  };
}

function classifyRtgsRegime(throughput: number, minThroughput: number, hhi: number): CbdcRtgsRegime {
  if (throughput < minThroughput) return "SYSTEMIC_LIQUIDITY_GRIDLOCK";
  if (throughput < 1.0 || hhi > 2500) return "PARTIAL_QUEUE_COMPRESSION";
  return "MULTILATERAL_LSM_CLEARED";
}

export class EosCbdcRtgsGridlockResolutionCore {
  static evaluateCbdcRtgsGridlockResolution(options: CbdcRtgsGridlockOptions = {}): CbdcRtgsGridlockAssessment {
    const p = resolveValidatedRtgsParams(options);
    const combinedLsmCompressionFactor = round6(
      1 - (1 - p.bilateralOffsettingEfficiency) * (1 - p.multilateralCycleEfficiency),
    );
    const netLiquidityRequiredRaw = p.queuedGrossObligationsUsdM * (1 - combinedLsmCompressionFactor);
    const lcr = netLiquidityRequiredRaw > 0 ? p.availableCentralBankReservesUsdM / netLiquidityRequiredRaw : 1.0;
    const throughputRaw = Math.min(1.0, lcr);

    const settledGrossVolumeUsdM = round6(p.queuedGrossObligationsUsdM * throughputRaw);
    const unsettledQueueUsdM = round6(p.queuedGrossObligationsUsdM - settledGrossVolumeUsdM);
    const conservationResidualUsdM = round12(
      Math.abs(p.queuedGrossObligationsUsdM - (settledGrossVolumeUsdM + unsettledQueueUsdM)),
    );
    const settlementThroughputRatio = round6(throughputRaw);
    const liquidityVelocityMultiplier = round6(settledGrossVolumeUsdM / p.availableCentralBankReservesUsdM);

    const restShare = 1 - p.topBankObligationShare;
    const herfindahlIndex = round6(
      (p.topBankObligationShare * p.topBankObligationShare + (restShare * restShare) / (p.participantBankCount - 1)) *
        10000,
    );
    const regime = classifyRtgsRegime(settlementThroughputRatio, p.minSettlementThroughputRatio, herfindahlIndex);

    const payload = {
      specId: "SPEC-263" as const,
      corridorId: p.corridorId,
      participantBankCount: p.participantBankCount,
      queuedGrossObligationsUsdM: p.queuedGrossObligationsUsdM,
      availableCentralBankReservesUsdM: p.availableCentralBankReservesUsdM,
      combinedLsmCompressionFactor,
      netLiquidityRequiredUsdM: round6(netLiquidityRequiredRaw),
      settledGrossVolumeUsdM,
      unsettledQueueUsdM,
      settlementThroughputRatio,
      liquidityVelocityMultiplier,
      herfindahlIndex,
      conservationResidualUsdM,
      regime,
    };
    const cbdcRtgsDigestSha256 = pureSha256(JSON.stringify(payload));
    return deepFreeze({ ...payload, cbdcRtgsDigestSha256 });
  }

  evaluate(options: CbdcRtgsGridlockOptions = {}): CbdcRtgsGridlockAssessment {
    return EosCbdcRtgsGridlockResolutionCore.evaluateCbdcRtgsGridlockResolution(options);
  }
}

export const evaluateCbdcRtgsGridlockResolution = EosCbdcRtgsGridlockResolutionCore.evaluateCbdcRtgsGridlockResolution;

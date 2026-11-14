/**
 * src/core/eosLobAlmgrenChrissVpinCore.ts
 * SPEC-256 / CHANGE-128: Limit Order Book Almgren-Chriss Optimal Execution & VPIN Core.
 * Zero external runtime dependencies (EOS Law V).
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import {
  assertFiniteGreaterThan,
  assertFiniteNonNegative,
  assertFinitePositive,
  assertHalfOpenRightRange,
  assertIntMin,
  pickDefined,
  pickNonEmptyString,
  round6,
} from "./eosNumericContractGuards.ts";
import type {
  LobAlmgrenChrissVpinOptions,
  LobAlmgrenChrissVpinReport,
  LobExecutionVerdict,
  LobOrderSide,
  LobVolumeBucketInput,
} from "./eosLobAlmgrenChrissVpinCore.types.ts";

const DEFAULT_VOLUME_BUCKETS: readonly LobVolumeBucketInput[] = [
  { buyVolume: 5200, sellVolume: 4800 },
  { buyVolume: 4900, sellVolume: 5100 },
  { buyVolume: 5050, sellVolume: 4950 },
  { buyVolume: 5300, sellVolume: 4700 },
];

function validateBuckets(buckets: readonly LobVolumeBucketInput[]): readonly LobVolumeBucketInput[] {
  assertPrecondition(buckets.length >= 1, "volumeBuckets must contain at least one bucket.");
  for (const b of buckets) {
    assertFiniteNonNegative(b.buyVolume, "bucket.buyVolume");
    assertFiniteNonNegative(b.sellVolume, "bucket.sellVolume");
  }
  return buckets;
}

function resolveValidatedLobParams(options: LobAlmgrenChrissVpinOptions) {
  const side: LobOrderSide = options.side === "SELL" ? "SELL" : "BUY";
  const bestBidPrice = assertFinitePositive(pickDefined(options.bestBidPrice, 100.0), "bestBidPrice");
  const bestAskPrice = assertFiniteGreaterThan(
    pickDefined(options.bestAskPrice, 100.04),
    bestBidPrice,
    "bestAskPrice must exceed bestBidPrice (no crossed book).",
  );
  return {
    symbol: pickNonEmptyString(options.symbol, "GLRN-USD"),
    side,
    bestBidPrice,
    bestAskPrice,
    orderSizeShares: assertFinitePositive(pickDefined(options.orderSizeShares, 50000), "orderSizeShares"),
    horizonSlices: assertIntMin(pickDefined(options.horizonSlices, 10), 1, "horizonSlices"),
    dailyVolatilitySigma: assertFiniteNonNegative(
      pickDefined(options.dailyVolatilitySigma, 0.02),
      "dailyVolatilitySigma",
    ),
    riskAversionLambda: assertFiniteNonNegative(pickDefined(options.riskAversionLambda, 1e-5), "riskAversionLambda"),
    temporaryImpactEta: assertFiniteNonNegative(pickDefined(options.temporaryImpactEta, 2e-6), "temporaryImpactEta"),
    permanentImpactGamma: assertFiniteNonNegative(
      pickDefined(options.permanentImpactGamma, 5e-7),
      "permanentImpactGamma",
    ),
    maxImpactBpsThreshold: assertFinitePositive(
      pickDefined(options.maxImpactBpsThreshold, 25.0),
      "maxImpactBpsThreshold",
    ),
    vpinToxicityThreshold: assertHalfOpenRightRange(
      pickDefined(options.vpinToxicityThreshold, 0.45),
      0,
      1,
      "vpinToxicityThreshold must be in (0, 1].",
    ),
    volumeBuckets: validateBuckets(pickDefined(options.volumeBuckets, DEFAULT_VOLUME_BUCKETS)),
  };
}

function inventoryAtStep(orderSizeShares: number, horizonSlices: number, kappaDecay: number, step: number): number {
  if (step === 0) return orderSizeShares;
  if (step === horizonSlices) return 0;
  const kappaT = kappaDecay * horizonSlices;
  if (kappaT <= 1e-4) return orderSizeShares * ((horizonSlices - step) / horizonSlices);
  if (kappaT > 40) return orderSizeShares * Math.exp(-kappaDecay * step);
  return orderSizeShares * (Math.sinh(kappaDecay * (horizonSlices - step)) / Math.sinh(kappaT));
}

function buildAlmgrenChrissSchedule(orderSizeShares: number, horizonSlices: number, kappaDecay: number) {
  const remainingTrajectory: number[] = [];
  for (let t = 0; t <= horizonSlices; t++) {
    remainingTrajectory.push(inventoryAtStep(orderSizeShares, horizonSlices, kappaDecay, t));
  }
  const slices: number[] = [];
  let sumExceptLast = 0;
  for (let j = 1; j < horizonSlices; j++) {
    const slice = round6(remainingTrajectory[j - 1] - remainingTrajectory[j]);
    slices.push(slice);
    sumExceptLast += slice;
  }
  slices.push(round6(Math.max(0, orderSizeShares - sumExceptLast)));
  return { remainingTrajectory, slices };
}

function computeVpin(buckets: readonly LobVolumeBucketInput[]): number {
  let absImbalance = 0;
  let totalVolume = 0;
  for (const b of buckets) {
    absImbalance += Math.abs(b.buyVolume - b.sellVolume);
    totalVolume += b.buyVolume + b.sellVolume;
  }
  assertPrecondition(totalVolume > 0, "Total bucket volume across LOB buckets must be > 0.");
  return round6(absImbalance / totalVolume);
}

export class EosLobAlmgrenChrissVpinCore {
  static evaluateLobAlmgrenChrissVpin(options: LobAlmgrenChrissVpinOptions = {}): LobAlmgrenChrissVpinReport {
    const p = resolveValidatedLobParams(options);
    const midPrice = round6((p.bestBidPrice + p.bestAskPrice) / 2);
    const spreadBps = round6(((p.bestAskPrice - p.bestBidPrice) / midPrice) * 10000);
    const kappaDecay = round6(
      Math.sqrt(
        Math.max(
          0,
          (p.riskAversionLambda * p.dailyVolatilitySigma * p.dailyVolatilitySigma) /
            Math.max(1e-12, p.temporaryImpactEta),
        ),
      ),
    );
    const { remainingTrajectory, slices } = buildAlmgrenChrissSchedule(p.orderSizeShares, p.horizonSlices, kappaDecay);
    const scheduledShareSum = round6(slices.reduce((acc, s) => acc + s, 0));

    const permanentImpactUsd = round6(0.5 * p.permanentImpactGamma * p.orderSizeShares * p.orderSizeShares);
    const temporaryImpactUsd = round6(p.temporaryImpactEta * slices.reduce((acc, n) => acc + n * n, 0));
    const halfSpreadCostUsd = round6(0.5 * (p.bestAskPrice - p.bestBidPrice) * p.orderSizeShares);
    const totalExpectedCostUsd = round6(permanentImpactUsd + temporaryImpactUsd + halfSpreadCostUsd);
    const expectedShortfallBps = round6((totalExpectedCostUsd / (p.orderSizeShares * midPrice)) * 10000);

    let varianceAcc = 0;
    for (let t = 1; t < p.horizonSlices; t++) {
      const invUsd = remainingTrajectory[t] * midPrice * p.dailyVolatilitySigma;
      varianceAcc += (invUsd * invUsd) / p.horizonSlices;
    }
    const executionVarianceUsd2 = round6(varianceAcc);
    const vpin = computeVpin(p.volumeBuckets);

    const verdict: LobExecutionVerdict =
      vpin >= p.vpinToxicityThreshold
        ? "TOXIC_FLOW_VPIN_HALT"
        : expectedShortfallBps > p.maxImpactBpsThreshold || spreadBps > p.maxImpactBpsThreshold
          ? "HIGH_MARKET_IMPACT_WARN"
          : "EXECUTION_TRAJECTORY_OPTIMAL";

    const payload = {
      specId: "SPEC-256" as const,
      symbol: p.symbol,
      side: p.side,
      midPrice,
      spreadBps,
      orderSizeShares: p.orderSizeShares,
      horizonSlices: p.horizonSlices,
      kappaDecay,
      scheduledSlices: slices,
      scheduledShareSum,
      permanentImpactUsd,
      temporaryImpactUsd,
      halfSpreadCostUsd,
      totalExpectedCostUsd,
      expectedShortfallBps,
      executionVarianceUsd2,
      vpin,
      bucketCount: p.volumeBuckets.length,
      verdict,
    };
    const lobVpinDigestSha256 = pureSha256(JSON.stringify(payload));
    return deepFreeze({ ...payload, lobVpinDigestSha256 });
  }
}

export const evaluateLobAlmgrenChrissVpin = EosLobAlmgrenChrissVpinCore.evaluateLobAlmgrenChrissVpin;

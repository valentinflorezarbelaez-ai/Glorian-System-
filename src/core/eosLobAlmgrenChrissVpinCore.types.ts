/**
 * src/core/eosLobAlmgrenChrissVpinCore.types.ts
 * SPEC-256 / CHANGE-128: Limit Order Book Almgren-Chriss Optimal Execution & VPIN Core Contracts.
 * Zero external runtime dependencies (EOS Law V).
 */

export type LobOrderSide = "BUY" | "SELL";

export type LobExecutionVerdict = "EXECUTION_TRAJECTORY_OPTIMAL" | "HIGH_MARKET_IMPACT_WARN" | "TOXIC_FLOW_VPIN_HALT";

export interface LobVolumeBucketInput {
  readonly buyVolume: number;
  readonly sellVolume: number;
}

export interface LobAlmgrenChrissVpinOptions {
  readonly symbol?: string;
  readonly side?: LobOrderSide;
  readonly bestBidPrice?: number;
  readonly bestAskPrice?: number;
  readonly orderSizeShares?: number;
  readonly horizonSlices?: number;
  readonly dailyVolatilitySigma?: number;
  readonly riskAversionLambda?: number;
  readonly temporaryImpactEta?: number;
  readonly permanentImpactGamma?: number;
  readonly maxImpactBpsThreshold?: number;
  readonly vpinToxicityThreshold?: number;
  readonly volumeBuckets?: readonly LobVolumeBucketInput[];
}

export interface LobAlmgrenChrissVpinReport {
  readonly specId: "SPEC-256";
  readonly symbol: string;
  readonly side: LobOrderSide;
  readonly midPrice: number;
  readonly spreadBps: number;
  readonly orderSizeShares: number;
  readonly horizonSlices: number;
  readonly kappaDecay: number;
  readonly scheduledSlices: readonly number[];
  readonly scheduledShareSum: number;
  readonly permanentImpactUsd: number;
  readonly temporaryImpactUsd: number;
  readonly halfSpreadCostUsd: number;
  readonly totalExpectedCostUsd: number;
  readonly expectedShortfallBps: number;
  readonly executionVarianceUsd2: number;
  readonly vpin: number;
  readonly bucketCount: number;
  readonly verdict: LobExecutionVerdict;
  readonly lobVpinDigestSha256: string;
}

/**
 * src/core/eosSubseaCoherentDwdmNonlinearShannonCore.types.ts
 * SPEC-261 / CHANGE-129: Subsea Coherent DWDM Nonlinear Shannon Core Contracts.
 * Zero external runtime dependencies (EOS Law V).
 */

export type SubseaDwdmRegime = "OPTIMAL_NONLINEAR_SHANNON" | "KERR_NONLINEAR_SATURATION" | "OSNR_BELOW_FEC_THRESHOLD";

export interface SubseaDwdmShannonOptions {
  readonly cableId?: string;
  readonly spanCount?: number;
  readonly spanLengthKm?: number;
  readonly fiberAttenuationDbPerKm?: number;
  readonly edfaNoiseFigureDb?: number;
  readonly channelBaudRateGbaud?: number;
  readonly wDMChannelCount?: number;
  readonly launchPowerDbm?: number;
  readonly nonlinearKerrCoeffPerWKm?: number;
  readonly minGeneralizedSnrDb?: number;
}

export interface SubseaDwdmShannonAssessment {
  readonly specId: "SPEC-261";
  readonly cableId: string;
  readonly spanCount: number;
  readonly spanLengthKm: number;
  readonly wDMChannelCount: number;
  readonly channelBaudRateGbaud: number;
  readonly launchPowerDbm: number;
  readonly effectiveLengthKm: number;
  readonly aseNoisePowerWatts: number;
  readonly kerrNliPowerWatts: number;
  readonly generalizedSnrDb: number;
  readonly minGeneralizedSnrDb: number;
  readonly spectralEfficiencyBpsPerHz: number;
  readonly totalFiberPairCapacityTbps: number;
  readonly regime: SubseaDwdmRegime;
  readonly subseaDwdmDigestSha256: string;
}

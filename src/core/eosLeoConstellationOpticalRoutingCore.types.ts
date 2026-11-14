/**
 * SPEC-102 / CHANGE-127 — LEO Constellation Optical ISL & QKD Routing Types.
 */

export type LeoRouteVerdict = "ISL_QUANTUM_LINK_LOCKED" | "ISL_REROUTED_DEGRADED" | "CONSTELLATION_LINK_SEVERED";

export interface OpticalIslLinkEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly distanceKm: number;
  readonly switchingLatencyMs?: number;
  readonly degraded?: boolean;
  readonly primary?: boolean;
}

export interface LeoConstellationRoutingOptions {
  readonly altitudeKm?: number;
  readonly inclinationDeg?: number;
  readonly sourceNodeId?: string;
  readonly destinationNodeId?: string;
  readonly links?: readonly OpticalIslLinkEdge[];
  readonly relativeVelocityKmPerSec?: number;
  readonly qber?: number;
  readonly rawPhotonicKeyRateKbps?: number;
}

export interface LeoConstellationRoutingReport {
  readonly specId: "SPEC-102";
  readonly altitudeKm: number;
  readonly inclinationDeg: number;
  readonly orbitalVelocityKmPerSec: number;
  readonly dopplerShiftRatio: number;
  readonly dopplerOffsetGhzAt1550Nm: number;
  readonly sourceNodeId: string;
  readonly destinationNodeId: string;
  readonly routeReachable: boolean;
  readonly routePath: readonly string[];
  readonly traversedLinkIds: readonly string[];
  readonly hopCount: number;
  readonly totalDistanceKm: number;
  readonly opticalLatencyMs: number;
  readonly fiberEquivalentLatencyMs: number;
  readonly vacuumSpeedupRatio: number;
  readonly qber: number;
  readonly qkdSecretKeyRateKbps: number;
  readonly qkdSecurityThresholdPassed: boolean;
  readonly fallbackRerouted: boolean;
  readonly verdict: LeoRouteVerdict;
  readonly leoRouteDigestSha256: string;
}

/**
 * SPEC-102 / CHANGE-127 — Layer-0 LEO Constellation Optical ISL & QKD Routing Core.
 * Inspired by SpaceX Starlink laser mesh & satellite BB84 quantum key distribution.
 * Zero external runtime dependencies (EOS Law V).
 */

import { assertPrecondition, deepFreeze, pureSha256 } from "./eosKernelPrimitives.ts";
import type {
  LeoConstellationRoutingOptions,
  LeoConstellationRoutingReport,
  LeoRouteVerdict,
  OpticalIslLinkEdge,
} from "./eosLeoConstellationOpticalRoutingCore.types.ts";

export type {
  LeoConstellationRoutingOptions,
  LeoConstellationRoutingReport,
  LeoRouteVerdict,
  OpticalIslLinkEdge,
} from "./eosLeoConstellationOpticalRoutingCore.types.ts";

const EARTH_RADIUS_KM = 6371;
const EARTH_MU_KM3_S2 = 398600.4418;
const SPEED_OF_LIGHT_KM_S = 299792.458;
const FIBER_REFRACTIVE_INDEX = 1.468;
const OPTICAL_CARRIER_GHZ_1550NM = 193414.489;
const BB84_ABORT_QBER = 0.11;

const DEFAULT_WALKER_LINKS: readonly OpticalIslLinkEdge[] = [
  { id: "ISL-AC", from: "SAT-A", to: "SAT-C", distanceKm: 2800, switchingLatencyMs: 0.25, primary: true },
  { id: "ISL-AB", from: "SAT-A", to: "SAT-B", distanceKm: 1650, switchingLatencyMs: 0.25, primary: false },
  { id: "ISL-BC", from: "SAT-B", to: "SAT-C", distanceKm: 1650, switchingLatencyMs: 0.25, primary: false },
  { id: "ISL-BD", from: "SAT-B", to: "SAT-D", distanceKm: 1900, switchingLatencyMs: 0.25, primary: true },
  { id: "ISL-CE", from: "SAT-C", to: "SAT-E", distanceKm: 1750, switchingLatencyMs: 0.25, primary: true },
  { id: "ISL-DF", from: "SAT-D", to: "SAT-F", distanceKm: 1850, switchingLatencyMs: 0.25, primary: false },
  { id: "ISL-EF", from: "SAT-E", to: "SAT-F", distanceKm: 1800, switchingLatencyMs: 0.25, primary: true },
];

function round6(v: number): number {
  return Number(v.toFixed(6));
}

function binaryEntropy(p: number): number {
  if (p <= 0 || p >= 1) return 0;
  return -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
}

interface AdjacencyStep {
  readonly neighbor: string;
  readonly edge: OpticalIslLinkEdge;
  readonly costMs: number;
}

function buildHealthyAdjacency(links: readonly OpticalIslLinkEdge[]): Map<string, AdjacencyStep[]> {
  const adj = new Map<string, AdjacencyStep[]>();
  for (const edge of links) {
    assertPrecondition(edge.id.trim().length > 0, "Each ISL edge must have a non-empty id.");
    assertPrecondition(edge.distanceKm > 0 && Number.isFinite(edge.distanceKm), "ISL distanceKm must be > 0.");
    if (edge.degraded === true) continue;
    const costMs = (edge.distanceKm / SPEED_OF_LIGHT_KM_S) * 1000 + (edge.switchingLatencyMs ?? 0.25);
    const listFrom = adj.get(edge.from) ?? [];
    listFrom.push({ neighbor: edge.to, edge, costMs });
    adj.set(edge.from, listFrom);
    const listTo = adj.get(edge.to) ?? [];
    listTo.push({ neighbor: edge.from, edge, costMs });
    adj.set(edge.to, listTo);
  }
  return adj;
}

function runDijkstraRoute(
  adj: Map<string, AdjacencyStep[]>,
  source: string,
  destination: string,
): { readonly path: readonly string[]; readonly edges: readonly OpticalIslLinkEdge[]; readonly reachable: boolean } {
  if (source === destination) return { path: [source], edges: [], reachable: true };
  const dist = new Map<string, number>([[source, 0]]);
  const prev = new Map<string, { readonly node: string; readonly edge: OpticalIslLinkEdge }>();
  const unvisited = new Set<string>(adj.keys());
  unvisited.add(source);

  while (unvisited.size > 0) {
    let current: string | undefined;
    let best = Number.POSITIVE_INFINITY;
    for (const node of unvisited) {
      const d = dist.get(node) ?? Number.POSITIVE_INFINITY;
      if (d < best) {
        best = d;
        current = node;
      }
    }
    if (!current || best === Number.POSITIVE_INFINITY || current === destination) break;
    unvisited.delete(current);
    for (const step of adj.get(current) ?? []) {
      const candidate = best + step.costMs;
      if (candidate < (dist.get(step.neighbor) ?? Number.POSITIVE_INFINITY)) {
        dist.set(step.neighbor, candidate);
        prev.set(step.neighbor, { node: current, edge: step.edge });
      }
    }
  }

  if (!prev.has(destination)) return { path: [], edges: [], reachable: false };
  const path: string[] = [];
  const edges: OpticalIslLinkEdge[] = [];
  let cursor: string | undefined = destination;
  while (cursor) {
    path.unshift(cursor);
    const back = prev.get(cursor);
    if (!back) break;
    edges.unshift(back.edge);
    cursor = back.node;
  }
  return { path, edges, reachable: true };
}

export class EosLeoConstellationOpticalRoutingCore {
  static planOpticalIslRouteAndQkdBudget(options: LeoConstellationRoutingOptions = {}): LeoConstellationRoutingReport {
    const altitudeKm = options.altitudeKm ?? 550;
    const inclinationDeg = options.inclinationDeg ?? 53;
    const sourceNodeId = (options.sourceNodeId ?? "SAT-A").trim();
    const destinationNodeId = (options.destinationNodeId ?? "SAT-C").trim();
    const links = options.links ?? DEFAULT_WALKER_LINKS;
    const relativeVelocityKmPerSec = options.relativeVelocityKmPerSec ?? 3.2;
    const qber = options.qber ?? 0.025;
    const rawPhotonicKeyRateKbps = options.rawPhotonicKeyRateKbps ?? 120;

    assertPrecondition(
      Number.isFinite(altitudeKm) && altitudeKm >= 300 && altitudeKm <= 2000,
      "altitudeKm must remain inside LEO operational shell [300, 2000] km.",
    );
    assertPrecondition(
      Number.isFinite(inclinationDeg) && inclinationDeg >= 0 && inclinationDeg <= 180,
      "inclinationDeg must be inside [0, 180].",
    );
    assertPrecondition(sourceNodeId.length > 0 && destinationNodeId.length > 0, "Endpoints must be non-empty.");
    assertPrecondition(Number.isFinite(qber) && qber >= 0 && qber <= 0.5, "qber must be inside [0, 0.5].");
    assertPrecondition(links.length > 0, "At least one optical ISL link is required.");

    const orbitalVelocityKmPerSec = round6(Math.sqrt(EARTH_MU_KM3_S2 / (EARTH_RADIUS_KM + altitudeKm)));
    const dopplerShiftRatio = Number((Math.abs(relativeVelocityKmPerSec) / SPEED_OF_LIGHT_KM_S).toPrecision(8));
    const dopplerOffsetGhzAt1550Nm = round6(dopplerShiftRatio * OPTICAL_CARRIER_GHZ_1550NM);

    const adj = buildHealthyAdjacency(links);
    const solved = runDijkstraRoute(adj, sourceNodeId, destinationNodeId);

    const totalDistanceKm = round6(solved.edges.reduce((acc, e) => acc + e.distanceKm, 0));
    const opticalLatencyMs = solved.reachable
      ? round6(
          solved.edges.reduce(
            (acc, e) => acc + (e.distanceKm / SPEED_OF_LIGHT_KM_S) * 1000 + (e.switchingLatencyMs ?? 0.25),
            0,
          ),
        )
      : 0;
    const fiberEquivalentLatencyMs = solved.reachable
      ? round6(((totalDistanceKm * FIBER_REFRACTIVE_INDEX) / SPEED_OF_LIGHT_KM_S) * 1000)
      : 0;
    const vacuumSpeedupRatio =
      solved.reachable && opticalLatencyMs > 0 ? round6(fiberEquivalentLatencyMs / opticalLatencyMs) : 0;

    const qkdSecurityThresholdPassed = qber < BB84_ABORT_QBER;
    const secretFraction = qkdSecurityThresholdPassed ? Math.max(0, 1 - 2 * binaryEntropy(qber)) : 0;
    const qkdSecretKeyRateKbps = round6(rawPhotonicKeyRateKbps * secretFraction);

    const usedNonPrimary = solved.edges.some((e) => e.primary === false);
    const degradedDirectExists = links.some(
      (e) =>
        e.degraded === true &&
        ((e.from === sourceNodeId && e.to === destinationNodeId) ||
          (e.to === sourceNodeId && e.from === destinationNodeId)),
    );
    const fallbackRerouted = solved.reachable && (usedNonPrimary || degradedDirectExists);

    let verdict: LeoRouteVerdict = "ISL_QUANTUM_LINK_LOCKED";
    if (!solved.reachable) {
      verdict = "CONSTELLATION_LINK_SEVERED";
    } else if (!qkdSecurityThresholdPassed || fallbackRerouted) {
      verdict = "ISL_REROUTED_DEGRADED";
    }

    const payload = {
      specId: "SPEC-102" as const,
      altitudeKm,
      inclinationDeg,
      orbitalVelocityKmPerSec,
      dopplerShiftRatio,
      dopplerOffsetGhzAt1550Nm,
      sourceNodeId,
      destinationNodeId,
      routeReachable: solved.reachable,
      routePath: solved.path,
      traversedLinkIds: solved.edges.map((e) => e.id),
      hopCount: solved.edges.length,
      totalDistanceKm,
      opticalLatencyMs,
      fiberEquivalentLatencyMs,
      vacuumSpeedupRatio,
      qber,
      qkdSecretKeyRateKbps,
      qkdSecurityThresholdPassed,
      fallbackRerouted,
      verdict,
    };

    const leoRouteDigestSha256 = pureSha256(JSON.stringify(payload));
    return deepFreeze({ ...payload, leoRouteDigestSha256 });
  }
}

/**
 * EOS SYSTEM — LEO CONSTELLATION OPTICAL ROUTING CORE TESTS
 * Tests for EosLeoConstellationOpticalRoutingCore.planOpticalIslRouteAndQkdBudget
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EosLeoConstellationOpticalRoutingCore } from "../src/core/eosLeoConstellationOpticalRoutingCore.ts";

const Core = EosLeoConstellationOpticalRoutingCore;

// ============================================================================
// Defaults
// ============================================================================

test("defaults: altitudeKm is 550", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget();
  assert.equal(report.altitudeKm, 550);
});

test("defaults: inclinationDeg is 53", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget();
  assert.equal(report.inclinationDeg, 53);
});

test("defaults: sourceNodeId is SAT-A", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget();
  assert.equal(report.sourceNodeId, "SAT-A");
});

test("defaults: destinationNodeId is SAT-C", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget();
  assert.equal(report.destinationNodeId, "SAT-C");
});

test("defaults: qber is 0.025", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget();
  assert.equal(report.qber, 0.025);
});

test("defaults: specId is SPEC-102", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget();
  assert.equal(report.specId, "SPEC-102");
});

// ============================================================================
// Dijkstra Routing
// ============================================================================

test("Dijkstra: SAT-A to SAT-C direct route", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget();
  assert.equal(report.routeReachable, true);
  assert.ok(report.routePath.includes("SAT-A"));
  assert.ok(report.routePath.includes("SAT-C"));
});

test("Dijkstra: hopCount for direct link", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget();
  assert.equal(report.hopCount, 1);
});

test("Dijkstra: totalDistanceKm matches ISL-AC (2800)", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget();
  assert.equal(report.totalDistanceKm, 2800);
});

test("Dijkstra: opticalLatencyMs is positive", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget();
  assert.ok(report.opticalLatencyMs > 0);
});

test("Dijkstra: traversedLinkIds contains ISL-AC", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget();
  assert.ok(report.traversedLinkIds.includes("ISL-AC"));
});

test("Dijkstra: custom links with alternative route", () => {
  const links = [
    { id: "L1", from: "A", to: "B", distanceKm: 1000, switchingLatencyMs: 0.1, primary: true },
    { id: "L2", from: "B", to: "C", distanceKm: 1000, switchingLatencyMs: 0.1, primary: true },
    { id: "L3", from: "A", to: "C", distanceKm: 3000, switchingLatencyMs: 0.1, primary: false },
  ];
  const report = Core.planOpticalIslRouteAndQkdBudget({
    sourceNodeId: "A",
    destinationNodeId: "C",
    links,
  });
  assert.equal(report.routeReachable, true);
  // A→B→C = 2000km is shorter than A→C = 3000km
  assert.equal(report.totalDistanceKm, 2000);
});

test("Dijkstra: unreachable node returns CONSTELLATION_LINK_SEVERED", () => {
  const links = [{ id: "L1", from: "A", to: "B", distanceKm: 1000, switchingLatencyMs: 0.1, primary: true }];
  const report = Core.planOpticalIslRouteAndQkdBudget({
    sourceNodeId: "A",
    destinationNodeId: "Z",
    links,
  });
  assert.equal(report.routeReachable, false);
  assert.equal(report.verdict, "CONSTELLATION_LINK_SEVERED");
});

test("Dijkstra: same source and destination", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget({
    sourceNodeId: "SAT-A",
    destinationNodeId: "SAT-A",
  });
  assert.equal(report.routeReachable, true);
  assert.equal(report.hopCount, 0);
  assert.equal(report.totalDistanceKm, 0);
});

// ============================================================================
// QKD BB84
// ============================================================================

test("QKD: default qber passes security threshold", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget();
  assert.equal(report.qkdSecurityThresholdPassed, true);
});

test("QKD: qber 0.025 produces positive secret key rate", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget();
  assert.ok(report.qkdSecretKeyRateKbps > 0);
});

test("QKD: qber above 0.11 fails security threshold", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget({ qber: 0.15 });
  assert.equal(report.qkdSecurityThresholdPassed, false);
});

test("QKD: qber 0.15 produces zero secret key rate", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget({ qber: 0.15 });
  assert.equal(report.qkdSecretKeyRateKbps, 0);
});

test("QKD: qber 0 produces maximum secret key rate", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget({ qber: 0 });
  assert.ok(report.qkdSecretKeyRateKbps > 0);
  assert.ok(report.qkdSecretKeyRateKbps <= 120);
});

test("QKD: custom rawPhotonicKeyRateKbps", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget({
    qber: 0.025,
    rawPhotonicKeyRateKbps: 200,
  });
  assert.ok(report.qkdSecretKeyRateKbps > 0);
});

// ============================================================================
// Doppler Shift
// ============================================================================

test("Doppler: dopplerShiftRatio is positive", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget();
  assert.ok(report.dopplerShiftRatio > 0);
});

test("Doppler: dopplerOffsetGhzAt1550Nm is positive", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget();
  assert.ok(report.dopplerOffsetGhzAt1550Nm > 0);
});

test("Doppler: orbitalVelocityKmPerSec is ~7.6 km/s for 550km altitude", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget();
  // sqrt(398600.4418 / (6371 + 550)) ≈ 7.57 km/s
  assert.ok(report.orbitalVelocityKmPerSec > 7.5);
  assert.ok(report.orbitalVelocityKmPerSec < 7.7);
});

// ============================================================================
// Fiber Equivalent Latency
// ============================================================================

test("Fiber: fiberEquivalentLatencyMs > opticalLatencyMs", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget();
  assert.ok(report.fiberEquivalentLatencyMs > report.opticalLatencyMs);
});

test("Fiber: vacuumSpeedupRatio > 1", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget();
  assert.ok(report.vacuumSpeedupRatio > 1);
});

// ============================================================================
// Verdicts
// ============================================================================

test("Verdict: ISL_QUANTUM_LINK_LOCKED for default", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget();
  assert.equal(report.verdict, "ISL_QUANTUM_LINK_LOCKED");
});

test("Verdict: ISL_REROUTED_DEGRADED when using non-primary links", () => {
  // Remove the direct primary link ISL-AC, force A→B→C route
  const links = [
    { id: "ISL-AB", from: "SAT-A", to: "SAT-B", distanceKm: 1650, switchingLatencyMs: 0.25, primary: false },
    { id: "ISL-BC", from: "SAT-B", to: "SAT-C", distanceKm: 1650, switchingLatencyMs: 0.25, primary: false },
  ];
  const report = Core.planOpticalIslRouteAndQkdBudget({ links });
  assert.equal(report.verdict, "ISL_REROUTED_DEGRADED");
});

test("Verdict: CONSTELLATION_LINK_SEVERED when unreachable", () => {
  const links = [{ id: "L1", from: "A", to: "B", distanceKm: 1000, switchingLatencyMs: 0.1, primary: true }];
  const report = Core.planOpticalIslRouteAndQkdBudget({
    sourceNodeId: "A",
    destinationNodeId: "Z",
    links,
  });
  assert.equal(report.verdict, "CONSTELLATION_LINK_SEVERED");
});

test("Verdict: ISL_REROUTED_DEGRADED when qber too high", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget({ qber: 0.15 });
  assert.equal(report.verdict, "ISL_REROUTED_DEGRADED");
});

// ============================================================================
// Validations
// ============================================================================

test("Validation: altitudeKm below 300 throws", () => {
  assert.throws(
    () => {
      Core.planOpticalIslRouteAndQkdBudget({ altitudeKm: 200 });
    },
    { message: /altitudeKm/ },
  );
});

test("Validation: altitudeKm above 2000 throws", () => {
  assert.throws(
    () => {
      Core.planOpticalIslRouteAndQkdBudget({ altitudeKm: 3000 });
    },
    { message: /altitudeKm/ },
  );
});

test("Validation: inclinationDeg below 0 throws", () => {
  assert.throws(
    () => {
      Core.planOpticalIslRouteAndQkdBudget({ inclinationDeg: -10 });
    },
    { message: /inclinationDeg/ },
  );
});

test("Validation: inclinationDeg above 180 throws", () => {
  assert.throws(
    () => {
      Core.planOpticalIslRouteAndQkdBudget({ inclinationDeg: 200 });
    },
    { message: /inclinationDeg/ },
  );
});

test("Validation: empty sourceNodeId throws", () => {
  assert.throws(
    () => {
      Core.planOpticalIslRouteAndQkdBudget({ sourceNodeId: "" });
    },
    { message: /Endpoints/ },
  );
});

test("Validation: qber above 0.5 throws", () => {
  assert.throws(
    () => {
      Core.planOpticalIslRouteAndQkdBudget({ qber: 0.6 });
    },
    { message: /qber/ },
  );
});

test("Validation: empty links throws", () => {
  assert.throws(
    () => {
      Core.planOpticalIslRouteAndQkdBudget({ links: [] });
    },
    { message: /link/ },
  );
});

// ============================================================================
// leoRouteDigestSha256
// ============================================================================

test("leoRouteDigestSha256 is 64 hex characters", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget();
  assert.equal(report.leoRouteDigestSha256.length, 64);
  assert.match(report.leoRouteDigestSha256, /^[0-9a-f]{64}$/);
});

test("leoRouteDigestSha256 is deterministic", () => {
  const r1 = Core.planOpticalIslRouteAndQkdBudget();
  const r2 = Core.planOpticalIslRouteAndQkdBudget();
  assert.equal(r1.leoRouteDigestSha256, r2.leoRouteDigestSha256);
});

test("report is frozen", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget();
  assert.equal(Object.isFrozen(report), true);
});

// ============================================================================
// Custom options
// ============================================================================

test("custom altitudeKm", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget({ altitudeKm: 400 });
  assert.equal(report.altitudeKm, 400);
});

test("custom inclinationDeg", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget({ inclinationDeg: 97 });
  assert.equal(report.inclinationDeg, 97);
});

test("custom relativeVelocityKmPerSec", () => {
  const report = Core.planOpticalIslRouteAndQkdBudget({ relativeVelocityKmPerSec: 5.0 });
  assert.ok(report.dopplerShiftRatio > 0);
});

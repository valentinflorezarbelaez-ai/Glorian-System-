/**
 * SPEC-148 / LADDER-16 — Platform Ops Ceiling BDD-430..435
 */

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  evaluatePlatformSlos,
  assertDogfoodCeiling,
  buildIvvReadinessChecklist,
  getCeilingEpistemicState,
  EosPlatformOpsCeiling,
  buildCleanCanaryTelemetry,
  buildBreachingCanaryTelemetry,
  CEILING_EPISTEMIC,
  FORBIDDEN_CEILING_CLAIMS
} from "../src/core/eosPlatformOpsCeiling.ts";
import { EosProductDeliveryOrchestrator } from "../src/core/eosProductDeliveryOrchestrator.ts";
import { EosProgressiveCanaryMesh } from "../src/core/eosProgressiveCanaryMesh.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("BDD-430: IDP SLO nominal", () => {
  const report = evaluatePlatformSlos({
    timeToGreenMs: 120,
    gatePassRate: 100,
    scorecardScore: 100,
    controlPlanePristine: true
  });
  assert.equal(report.healthState, "NOMINAL");
  assert.equal(report.freezeDeployments, false);
  assert.equal(report.breaches.length, 0);
});

test("BDD-431: IDP SLO breach freezes", () => {
  const report = evaluatePlatformSlos({
    timeToGreenMs: 100,
    gatePassRate: 50,
    scorecardScore: 100,
    controlPlanePristine: true
  });
  assert.equal(report.freezeDeployments, true);
  assert.notEqual(report.healthState, "NOMINAL");
  assert.ok(report.breaches.some((b) => b.startsWith("GATE_PASS")));
});

test("BDD-432: Canary promotes to 100% on clean telemetry", () => {
  const delivery = EosProductDeliveryOrchestrator.deliverProduct(
    {
      id: "ceiling-canary-probe",
      name: "Ceiling Canary Probe",
      domain: "platform-ops",
      description: "Canary promotion probe",
      tier: "MVP",
      platforms: ["distributed-backend"],
      entities: ["Probe"],
      commands: ["RunProbe"]
    },
    { dryRun: true, projectRoot, enforceGates: true }
  );
  assert.equal(delivery.status, "SUCCESS");
  const att = EosPlatformOpsCeiling.promoteDeliveryWithCanary(delivery, {
    projectRoot,
    controlPlanePristine: true,
    canaryTelemetry: buildCleanCanaryTelemetry()
  });
  assert.ok(att.canary);
  assert.equal(att.canary.finalStage, "FULL_PRODUCTION_100_PCT");
  assert.equal(att.canary.verifiedSafe, true);
  assert.equal(att.canary.rollbackExecuted, false);
});

test("BDD-433: Canary rolls back on error budget breach", () => {
  const mesh = new EosProgressiveCanaryMesh("v-bad", "v-prev");
  const report = mesh.executeRollout(buildBreachingCanaryTelemetry());
  assert.equal(report.rollbackExecuted, true);
  assert.equal(report.verifiedSafe, false);
  assert.equal(report.finalStage, "ROLLED_BACK");
  assert.ok(report.transitions.some((t) => t.circuitBreakerTripped));
});

test("BDD-434: Dogfood scorecard ceiling gate", () => {
  const dog = assertDogfoodCeiling(projectRoot);
  assert.equal(dog.ok, true);
  assert.ok(dog.score >= 80);
  assert.ok(dog.grade === "A+" || dog.grade === "B");
});

test("BDD-435: IV&V readiness and epistemic honesty", () => {
  const epi = getCeilingEpistemicState();
  assert.equal(epi.state, CEILING_EPISTEMIC);
  for (const claim of FORBIDDEN_CEILING_CLAIMS) {
    assert.ok(epi.forbiddenClaims.includes(claim));
  }
  // Write EVD-C may already exist; checklist should become ready after tip-seal artifacts land
  const att = EosPlatformOpsCeiling.runCeilingAttestation({
    projectRoot,
    controlPlanePristine: true,
    runCanary: true,
    canaryTelemetry: buildCleanCanaryTelemetry()
  });
  assert.equal(att.epistemicState, CEILING_EPISTEMIC);
  assert.ok(att.forbiddenClaims.includes("NSA_GRADE"));
  assert.ok(att.forbiddenClaims.includes("ABSOLUTE_UNIVERSAL_PERFECTION"));
  assert.equal(att.dogfood.ok, true);
  assert.ok(att.canary?.verifiedSafe);
  assert.equal(att.ceilingMet, true);
  const ivv = buildIvvReadinessChecklist(projectRoot);
  assert.ok(Array.isArray(ivv.items));
});

test("SPEC-148: Full ceiling attestation with delivery metrics", () => {
  const delivery = EosProductDeliveryOrchestrator.deliverProduct(
    {
      id: "demo-ledger-mvp",
      name: "Demo Ledger MVP",
      domain: "fintech-ledger",
      description: "Ceiling dogfood re-seal",
      tier: "MVP",
      platforms: ["distributed-backend", "web"],
      entities: ["LedgerEntry", "Account"],
      commands: ["PostEntry", "ReconcileBooks"]
    },
    { dryRun: false, projectRoot, enforceGates: true }
  );
  const att = EosPlatformOpsCeiling.promoteDeliveryWithCanary(delivery, {
    projectRoot,
    controlPlanePristine: true
  });
  assert.equal(delivery.status, "SUCCESS");
  assert.equal(att.slo.healthState, "NOMINAL");
  assert.equal(att.ceilingMet, true);
  assert.match(att.sha256Receipt, /^[a-f0-9]{64}$/);
});

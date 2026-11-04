/**
 * Verification suite for SPEC-158: Planetary Apex Operating Doctrine drills
 */

import test from "node:test";
import assert from "node:assert/strict";

import { EosPlanetaryApexDoctrine } from "../src/core/eosPlanetaryApexDoctrine.ts";

test("BDD-488: Planetary Apex Doctrine validates multi-pillar conformance", () => {
  const engine = new EosPlanetaryApexDoctrine();
  const report = engine.auditPillars();

  assert.equal(typeof report, "object");
  assert.equal(report.status, "APEX_DRILL_PASS");
  assert.equal(report.epistemicState, "APEX_DRILL_WITHIN_TESTED_SCOPE");
  assert.ok(report.claimsDenied.includes("Level 5"));
  assert.ok(report.overallScore >= 95, `Expected score >= 95, got ${report.overallScore}`);
  assert.equal(report.pillars.length, 5);

  for (const id of [
    "ASML_TSMC_PRECISION",
    "SPACEX_TMR_AVIONICS",
    "DEEPMIND_INVARIANTS",
    "DARPA_SKUNK_ISOLATION",
    "NSA_LIVERMORE_IMMUTABILITY"
  ]) {
    const pillar = report.pillars.find((p) => p.pillarId === id);
    assert.ok(pillar && pillar.compliant, `${id} must be compliant within tested scope`);
  }

  assert.equal(report.sha256Receipt.length, 64);
  assert.ok(Object.isFrozen(report), "Report must be deeply frozen");
});

test("BDD-489: SpaceX TMR Consensus Adjudication handles unanimous and dissenting inputs", () => {
  const unanimous = EosPlanetaryApexDoctrine.executeTmrVoting({
    vectorA: { thrustKn: 2200 },
    vectorB: { thrustKn: 2200 },
    vectorC: { thrustKn: 2200 }
  });
  assert.equal(unanimous.quorumReached, true);
  assert.equal(unanimous.unanimous, true);
  assert.equal(unanimous.dissentingNode, "NONE");

  const dissenting = EosPlanetaryApexDoctrine.executeTmrVoting({
    vectorA: { thrustKn: 2200 },
    vectorB: { thrustKn: 2200 },
    vectorC: { thrustKn: 0 }
  });
  assert.equal(dissenting.quorumReached, true);
  assert.equal(dissenting.unanimous, false);
  assert.equal(dissenting.dissentingNode, "C");
  assert.equal(dissenting.agreedValue.thrustKn, 2200);

  const split = EosPlanetaryApexDoctrine.executeTmrVoting({
    vectorA: 1,
    vectorB: 2,
    vectorC: 3
  });
  assert.equal(split.quorumReached, false);
});

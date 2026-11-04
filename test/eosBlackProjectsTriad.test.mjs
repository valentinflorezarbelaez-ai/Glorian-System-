/**
 * Verification suite for SPEC-159: Black Projects Triad Operating Doctrine
 */

import test from "node:test";
import assert from "node:assert/strict";

import { EosBlackProjectsTriad } from "../src/core/eosBlackProjectsTriad.ts";

test("BDD-490: Skunk Works Kelly Johnson Rules Conformance", () => {
  const engine = new EosBlackProjectsTriad();
  const kelly = engine.auditKellyJohnsonRules();

  assert.ok(kelly.compliancePercent >= 90, `Expected >= 90%, got ${kelly.compliancePercent}`);
  assert.equal(kelly.rules.length, 14);
  assert.ok(kelly.rules.every((r) => typeof r.passed === "boolean"));
  assert.equal(kelly.sha256Receipt.length, 64);
  const depsRule = kelly.rules.find((r) => r.ruleId === 3);
  assert.ok(depsRule && depsRule.passed, "Rule 3 must verify zero runtime dependencies");
});

test("BDD-491: DARPA Autonomous OODA Loop Execution", () => {
  const engine = new EosBlackProjectsTriad();
  const ooda = engine.executeDarpaOodaCycle({
    anomalyScore: 0.55,
    errorBudgetBurned: true,
    invariantBroken: false
  });

  assert.ok(ooda.durationUs < 5000, `OODA must complete under 5000µs, got ${ooda.durationUs}`);
  assert.equal(ooda.orient, "DEGRADED");
  assert.equal(ooda.decide, "HEAL");
  assert.equal(ooda.actReceipt.length, 64);
  assert.equal(ooda.compensationSnapshot.length, 64);
  assert.equal(ooda.sha256Receipt.length, 64);
});

test("BDD-492: NRO Synthetic Aperture Radar Multi-Layer Penetration", () => {
  const engine = new EosBlackProjectsTriad();
  const sar = engine.runNroSarDeepScan();

  assert.equal(sar.layers.length, 3);
  assert.ok(sar.layers.some((l) => l.layer === "SURFACE"));
  assert.ok(sar.layers.some((l) => l.layer === "ATMOSPHERIC"));
  assert.ok(sar.layers.some((l) => l.layer === "SUBTERRANEAN"));
  assert.equal(sar.zeroPlainSecrets, true);
  assert.ok(sar.layers.every((l) => l.findings === 0), `Unexpected SAR findings: ${JSON.stringify(sar.layers)}`);
  assert.equal(sar.sha256Receipt.length, 64);
});

test("BDD-493: Full Black Projects Triad audit seals within tested scope", () => {
  const engine = new EosBlackProjectsTriad();
  const report = engine.auditTriad();

  assert.equal(report.status, "TRIAD_DRILL_PASS");
  assert.equal(report.epistemicState, "TRIAD_DRILL_WITHIN_TESTED_SCOPE");
  assert.ok(report.claimsDenied.includes("Level 5"));
  assert.ok(report.claimsDenied.some((c) => /black-budget/i.test(c)));
  assert.ok(report.overallScore >= 95);
  assert.equal(report.pillars.length, 3);
  assert.ok(report.pillars.every((p) => p.compliant));
  assert.equal(report.sha256Receipt.length, 64);
  assert.ok(Object.isFrozen(report));
});

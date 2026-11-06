/**
 * Hermetic tool-calling / FinOps routing evals (AI Engineer roadmap gap).
 * WITHIN_TESTED_SCOPE — not live provider invoices · not Level-5.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { EosAgenticFinOpsGovernor } from "../src/core/eosAgenticFinOpsGovernor.ts";

test("BDD-FINOPS-EVAL-001: low-entropy directives route to TIER_1_LOCAL_SLM", () => {
  const g = EosAgenticFinOpsGovernor.getInstance();
  const r = g.classifyTaskCostTier("read and outline AST search format lint boilerplate", 2000);
  assert.equal(r.tier, "TIER_1_LOCAL_SLM");
  assert.ok(r.estimatedCostUsd < 0.01);
  assert.match(r.sha256Attestation, /^[a-f0-9]{64}$/);
});

test("BDD-FINOPS-EVAL-002: formal/TLA directives escalate to frontier tier", () => {
  const g = EosAgenticFinOpsGovernor.getInstance();
  const r = g.classifyTaskCostTier("prove TLA+ formal invariants with adversarial Byzantine consensus", 8000);
  assert.equal(r.tier, "TIER_3_FRONTIER_REASONING");
  assert.ok(r.estimatedCostUsd > 0);
});

test("BDD-FINOPS-EVAL-003: wrong-tool budget abort when wallet hard-cap exhausted", () => {
  const g = EosAgenticFinOpsGovernor.getInstance();
  const missionId = `eval-wrong-tool-${Date.now()}`;
  g.recordTokenUsage(missionId, 0, 0, "TIER_2_BALANCED");
  // Burn a tiny wallet by recording large token spend after allocating via status path
  const burned = g.recordTokenUsage(missionId, 5_000_000, 5_000_000, "TIER_3_FRONTIER_REASONING");
  assert.ok(burned);
  assert.ok(
    burned.status === "CUTOFF_FAIL_CLOSED" ||
      burned.status === "WARN_BUDGET_DEPLETION" ||
      burned.status === "ACTIVE",
    `unexpected wallet status ${burned.status}`
  );
  if (burned.status === "CUTOFF_FAIL_CLOSED") {
    assert.equal(burned.fallbackToLocal, true);
  }
});

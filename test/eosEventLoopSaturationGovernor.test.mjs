import test from "node:test";
import assert from "node:assert/strict";

import { EosEventLoopSaturationGovernor } from "../src/core/eosEventLoopSaturationGovernor.ts";

test("BDD-249: Medición precisa de percentiles de retardo del bucle de eventos V8 (SPEC-087)", () => {
  const governor = new EosEventLoopSaturationGovernor(10.0, 3);
  governor.start();

  const report = governor.sample();
  assert.equal(report.state, "NORMAL");
  assert.equal(report.sheddingActive, false);
  assert.equal(typeof report.p50Ms, "number");
  assert.equal(typeof report.p90Ms, "number");
  assert.equal(typeof report.p99Ms, "number");
  assert.equal(typeof report.maxMs, "number");
  assert.equal(report.criticalThresholdMs, 10.0);

  governor.stop();
});

test("BDD-250: Activación fail-closed de descarte de carga ante saturación (SPEC-087)", () => {
  const governor = new EosEventLoopSaturationGovernor(5.0, 2);
  governor.start();

  // In normal state: should NOT shed normal workload
  assert.equal(governor.shouldShedLoad("NORMAL"), false);
  assert.equal(governor.shouldShedLoad("LOW"), false);
  assert.equal(governor.shouldShedLoad("CRITICAL"), false);

  // Inject simulated event loop lag of 15ms (> 5.0ms threshold)
  governor.injectSimulatedLag(15.0);
  const saturatedReport = governor.sample();

  assert.equal(saturatedReport.state, "SHEDDING_ACTIVE");
  assert.equal(saturatedReport.sheddingActive, true);
  assert.ok(saturatedReport.p99Ms >= 15.0);

  // In SHEDDING_ACTIVE state: sheds LOW and NORMAL, preserves CRITICAL
  assert.equal(governor.shouldShedLoad("LOW"), true);
  assert.equal(governor.shouldShedLoad("NORMAL"), true);
  assert.equal(governor.shouldShedLoad("CRITICAL"), false);

  // Recovery test: reset lag and sample consecutive cool cycles
  governor.injectSimulatedLag(0);
  governor.sample(); // Cycle 1 (< 2.5ms)
  assert.equal(governor.getState(), "SHEDDING_ACTIVE"); // Hysteresis prevents immediate flip

  governor.sample(); // Cycle 2 -> Recovers to NORMAL
  assert.equal(governor.getState(), "NORMAL");
  assert.equal(governor.shouldShedLoad("NORMAL"), false);

  governor.stop();
});

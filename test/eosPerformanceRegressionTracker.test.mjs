/**
 * BDD Test Suite — EosPerformanceRegressionTracker (SPEC-146)
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { EosPerformanceRegressionTracker } from "../src/core/eosPerformanceRegressionTracker.ts";

describe("SPEC-146: Performance Regression Detection", () => {
  let tmpDir;
  let tracker;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-perf-"));
    tracker = new EosPerformanceRegressionTracker(tmpDir);
  });

  it("BDD-450: no baseline → no regression detected", () => {
    const report = tracker.checkRegression("suite-a", 5000);
    assert.equal(report.regressed, false);
    assert.equal(report.ratio, 1);
  });

  it("BDD-451: stable timings → ratio near 1.0", () => {
    for (let i = 0; i < 10; i++) tracker.record("suite-b", 100 + i);
    const report = tracker.checkRegression("suite-b", 105);
    assert.ok(report.ratio < 1.5);
    assert.equal(report.regressed, false);
  });

  it("BDD-452: 3x spike triggers regression", () => {
    for (let i = 0; i < 10; i++) tracker.record("suite-c", 100);
    const report = tracker.checkRegression("suite-c", 350, 2.0);
    assert.equal(report.regressed, true);
    assert.ok(report.ratio > 2.0);
  });

  it("BDD-453: p95 calculation uses at least 5 samples", () => {
    // 4 samples → uses max
    for (let i = 0; i < 4; i++) tracker.record("suite-d", 80 + i * 10);
    const r4 = tracker.checkRegression("suite-d", 110);
    assert.equal(r4.baselineP95, 110); // max = 110

    // 5 samples → uses p95 percentile
    tracker.record("suite-d", 120);
    const r5 = tracker.checkRegression("suite-d", 100);
    assert.ok(r5.baselineP95 <= 120);
  });

  it("BDD-454: checkAll returns only regressed suites", () => {
    for (let i = 0; i < 10; i++) {
      tracker.record("fast-suite", 50);
      tracker.record("slow-suite", 200);
    }
    tracker.record("fast-suite", 55);
    tracker.record("slow-suite", 500); // 2.5x spike
    const regressions = tracker.checkAll(2.0);
    assert.ok(regressions.length >= 1);
    assert.ok(regressions.every((r) => r.regressed));
  });
});

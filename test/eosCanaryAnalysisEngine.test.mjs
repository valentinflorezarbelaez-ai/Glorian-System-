/**
 * EOS SYSTEM — CANARY ANALYSIS ENGINE TESTS
 * Tests for EosCanaryAnalysisEngine (Netflix Kayenta statistical canary analysis)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EosCanaryAnalysisEngine } from "../src/core/eosCanaryAnalysisEngine.ts";

test("analyze with empty samples returns PASS", () => {
  const engine = new EosCanaryAnalysisEngine();
  const result = engine.analyze({}, {}, [{ name: "latency", importance: "HARD" }]);
  assert.equal(result.verdict, "PASS");
  assert.equal(result.canaryScore, 100);
  assert.equal(result.metrics.length, 1);
  assert.equal(result.metrics[0].verdict, "PASS");
});

test("analyze with identical samples returns PASS", () => {
  const engine = new EosCanaryAnalysisEngine();
  const samples = [10, 20, 30, 40, 50];
  const result = engine.analyze({ latency: samples }, { latency: [...samples] }, [
    { name: "latency", importance: "HARD" },
  ]);
  assert.equal(result.verdict, "PASS");
  assert.equal(result.canaryScore, 100);
  assert.equal(result.metrics[0].baselineMean, 30);
  assert.equal(result.metrics[0].canaryMean, 30);
  assert.equal(result.metrics[0].delta, 0);
});

test("analyze detects FAIL when canary exceeds upper bound", () => {
  const engine = new EosCanaryAnalysisEngine();
  const result = engine.analyze({ latency: [10, 12, 11] }, { latency: [100, 110, 120] }, [
    { name: "latency", importance: "HARD", upperBound: 50 },
  ]);
  assert.equal(result.verdict, "FAIL");
  assert.equal(result.metrics[0].verdict, "FAIL");
  assert.ok(result.canaryScore < 100);
  assert.equal(result.hardFailCount, 1);
});

test("analyze detects FAIL when canary below lower bound", () => {
  const engine = new EosCanaryAnalysisEngine();
  const result = engine.analyze({ throughput: [100, 110, 120] }, { throughput: [10, 12, 11] }, [
    { name: "throughput", importance: "HARD", lowerBound: 50 },
  ]);
  assert.equal(result.verdict, "FAIL");
  assert.equal(result.metrics[0].verdict, "FAIL");
});

test("analyze returns MARGINAL for soft metric with large delta", () => {
  const engine = new EosCanaryAnalysisEngine();
  // Large samples with big difference triggers statistical significance
  const baseline = Array(100).fill(10);
  const canary = Array(100).fill(100);
  const result = engine.analyze({ latency: baseline }, { latency: canary }, [{ name: "latency", importance: "SOFT" }]);
  // With p < 0.01 and delta > 10%, soft metric becomes MARGINAL
  assert.ok(result.metrics[0].verdict === "MARGINAL" || result.metrics[0].verdict === "FAIL");
  assert.ok(result.canaryScore < 100);
});

test("analyze returns FAIL for hard metric statistical difference", () => {
  const engine = new EosCanaryAnalysisEngine();
  const baseline = Array(100).fill(10);
  const canary = Array(100).fill(20);
  const result = engine.analyze({ latency: baseline }, { latency: canary }, [{ name: "latency", importance: "HARD" }]);
  assert.equal(result.metrics[0].verdict, "FAIL");
  assert.equal(result.verdict, "FAIL");
});

test("canary score decreases with hard failures", () => {
  const engine = new EosCanaryAnalysisEngine();
  const result = engine.analyze({ latency: [10, 10, 10] }, { latency: [200, 200, 200] }, [
    { name: "latency", importance: "HARD", upperBound: 50 },
  ]);
  // 1 hard fail: 100 - 40 = 60
  assert.equal(result.canaryScore, 60);
});

test("canary score decreases with soft failures", () => {
  const engine = new EosCanaryAnalysisEngine();
  const result = engine.analyze({ latency: [10, 10, 10] }, { latency: [200, 200, 200] }, [
    { name: "latency", importance: "SOFT", upperBound: 50 },
  ]);
  // 1 soft fail: 100 - 15 = 85
  assert.equal(result.canaryScore, 85);
});

test("multiple metrics produce composite score", () => {
  const engine = new EosCanaryAnalysisEngine();
  const result = engine.analyze(
    { latency: [10, 10, 10], errors: [1, 1, 1] },
    { latency: [200, 200, 200], errors: [50, 50, 50] },
    [
      { name: "latency", importance: "HARD", upperBound: 50 },
      { name: "errors", importance: "SOFT", upperBound: 10 },
    ],
  );
  // 1 hard fail (40) + 1 soft fail (15) = 100 - 55 = 45
  assert.equal(result.canaryScore, 45);
  assert.equal(result.hardFailCount, 1);
  assert.equal(result.softFailCount, 1);
});

test("overall verdict is FAIL when any hard metric fails", () => {
  const engine = new EosCanaryAnalysisEngine();
  const result = engine.analyze(
    { latency: [10, 10, 10], errors: [1, 1, 1] },
    { latency: [200, 200, 200], errors: [2, 2, 2] },
    [
      { name: "latency", importance: "HARD", upperBound: 50 },
      { name: "errors", importance: "SOFT" },
    ],
  );
  assert.equal(result.verdict, "FAIL");
});

test("overall verdict is MARGINAL when soft fail exists", () => {
  const engine = new EosCanaryAnalysisEngine();
  const result = engine.analyze(
    { latency: [10, 10, 10], errors: [1, 1, 1] },
    { latency: [12, 12, 12], errors: [50, 50, 50] },
    [
      { name: "latency", importance: "HARD" },
      { name: "errors", importance: "SOFT", upperBound: 10 },
    ],
  );
  assert.equal(result.verdict, "MARGINAL");
});

test("delta and deltaPercent are calculated correctly", () => {
  const engine = new EosCanaryAnalysisEngine();
  const result = engine.analyze({ latency: [100, 100, 100] }, { latency: [150, 150, 150] }, [
    { name: "latency", importance: "SOFT" },
  ]);
  assert.equal(result.metrics[0].baselineMean, 100);
  assert.equal(result.metrics[0].canaryMean, 150);
  assert.equal(result.metrics[0].delta, 50);
  assert.equal(result.metrics[0].deltaPercent, 50);
});

test("deltaPercent is zero when baseline mean is zero", () => {
  const engine = new EosCanaryAnalysisEngine();
  const result = engine.analyze({ latency: [0, 0, 0] }, { latency: [10, 10, 10] }, [
    { name: "latency", importance: "SOFT" },
  ]);
  assert.equal(result.metrics[0].deltaPercent, 0);
});

test("sha256 receipt is deterministic", () => {
  const engine = new EosCanaryAnalysisEngine();
  const baseline = { latency: [10, 20, 30] };
  const canary = { latency: [12, 22, 32] };
  const configs = [{ name: "latency", importance: "HARD" }];
  const r1 = engine.analyze(baseline, canary, configs);
  const r2 = engine.analyze(baseline, canary, configs);
  assert.equal(r1.sha256Receipt, r2.sha256Receipt);
  assert.ok(r1.sha256Receipt.length === 64);
});

test("Mann-Whitney p-value is between 0 and 1", () => {
  const engine = new EosCanaryAnalysisEngine();
  const baseline = Array(50)
    .fill(10)
    .map(() => 10 + Math.random() * 2);
  const canary = Array(50)
    .fill(10)
    .map(() => 10 + Math.random() * 2);
  const result = engine.analyze({ latency: baseline }, { latency: canary }, [{ name: "latency", importance: "SOFT" }]);
  const p = result.metrics[0].mannWhitneyP;
  assert.ok(p >= 0 && p <= 1, `p-value should be in [0,1], got ${p}`);
});

test("missing metric data defaults to PASS", () => {
  const engine = new EosCanaryAnalysisEngine();
  const result = engine.analyze({ latency: [10, 20, 30] }, {}, [{ name: "latency", importance: "HARD" }]);
  assert.equal(result.metrics[0].verdict, "PASS");
  assert.equal(result.metrics[0].baselineMean, 0);
  assert.equal(result.metrics[0].canaryMean, 0);
});

test("result object is frozen", () => {
  const engine = new EosCanaryAnalysisEngine();
  const result = engine.analyze({ latency: [10, 20] }, { latency: [12, 22] }, [
    { name: "latency", importance: "HARD" },
  ]);
  assert.throws(() => {
    result.verdict = "FAIL";
  }, TypeError);
});

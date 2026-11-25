/**
 * BDD Test Suite — EosPerformanceRegressionTracker (SPEC-146)
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { EosPerformanceRegressionTracker } from "../src/core/eosPerformanceRegressionTracker.ts";

describe("SPEC-146: Performance Regression Detection", () => {
  let tmpDir;
  let tracker;

  beforeEach((t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "eos-perf-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    tmpDir = directory;
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

  it("rebuilds the same suite baselines and summary from disk", () => {
    tracker.record("slow", 80);
    tracker.record("cold", 1_000);
    tracker.record("slow", 200);
    const reloaded = new EosPerformanceRegressionTracker(tmpDir);
    assert.deepEqual(reloaded.checkRegression("slow", 300), tracker.checkRegression("slow", 300));
    assert.deepEqual(reloaded.summarize(), tracker.summarize());
    assert.equal(reloaded.summarize().regressions[0].baselineP95, 80);
  });

  it("counts a suite with a zero baseline as unmeasured", () => {
    tracker.record("cold", 0);
    tracker.record("cold", 100);
    assert.deepEqual(tracker.summarize(), {
      status: "INSUFFICIENT_DATA",
      comparedSuites: 0,
      unmeasuredSuites: 1,
      regressions: [],
    });
  });

  it("excludes historical outliers and reports an unusable latest sample as unmeasured", () => {
    tracker.record("slow", 100_000);
    tracker.record("slow", 300_001);
    tracker.record("slow", 300_000);
    const [regression] = tracker.checkAll();
    assert.equal(regression.baselineP95, 100_000);
    assert.equal(regression.currentMs, 300_000);

    tracker.record("slow", 300_001);
    assert.deepEqual(tracker.summarize(), {
      status: "INSUFFICIENT_DATA",
      comparedSuites: 0,
      unmeasuredSuites: 1,
      regressions: [],
    });
  });

  it("counts a missing active suite and excludes regressions in inactive suites", () => {
    tracker.record("stable", 100);
    tracker.record("stable", 100);
    tracker.record("retired", 100);
    tracker.record("retired", 300);
    assert.deepEqual(tracker.summarize(2, new Set(["stable", "missing"])), {
      status: "PARTIAL",
      comparedSuites: 1,
      unmeasuredSuites: 1,
      regressions: [],
    });
  });

  it("appends a separate JSONL record when an existing ledger lacks a final newline", () => {
    const ledger = path.join(tmpDir, "perf-baseline.jsonl");
    const first = { suite: "slow", durationMs: 100, timestamp: 1 };
    fs.writeFileSync(ledger, JSON.stringify(first));
    const reloaded = new EosPerformanceRegressionTracker(tmpDir);
    reloaded.record("slow", 250);
    const rows = fs
      .readFileSync(ledger, "utf8")
      .trimEnd()
      .split("\n")
      .map((row) => JSON.parse(row));
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], first);
    assert.equal(rows[1].durationMs, 250);
    assert.deepEqual(new EosPerformanceRegressionTracker(tmpDir).checkAll(), reloaded.checkAll());
  });

  it("keeps memory unchanged when appending to the ledger fails", () => {
    const previous = tracker.summarize();
    fs.mkdirSync(path.join(tmpDir, "perf-baseline.jsonl"));
    assert.throws(() => tracker.record("unwritten", 100));
    assert.deepEqual(tracker.summarize(), previous);
  });
});

describe("perf public CLI", () => {
  let cli;
  let ledger;

  beforeEach((t) => {
    // The CLI reads .eos from its installation root, independently of the caller's cwd.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "eos-perf-cli-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const bin = path.join(root, "bin");
    fs.mkdirSync(bin);
    cli = path.join(bin, "eos.mjs");
    fs.copyFileSync(new URL("../bin/eos.mjs", import.meta.url), cli);
    fs.copyFileSync(new URL("../package.json", import.meta.url), path.join(root, "package.json"));
    fs.symlinkSync(fileURLToPath(new URL("../bin/commands/", import.meta.url)), path.join(bin, "commands"), "junction");
    const state = path.join(root, ".eos");
    fs.mkdirSync(state);
    ledger = path.join(state, "perf-baseline.jsonl");
  });

  function reportFor(timings, exitCode) {
    const records = [];
    for (const [suite, durations] of Object.entries(timings)) {
      for (const durationMs of durations)
        records.push(JSON.stringify({ suite, durationMs, timestamp: records.length + 1 }));
    }
    if (records.length) fs.writeFileSync(ledger, records.join("\n") + "\n");
    const result = spawnSync(process.execPath, [cli, "perf", "--json"], { encoding: "utf8" });
    assert.ifError(result.error);
    assert.equal(result.status, exitCode, result.stderr);
    return JSON.parse(result.stdout);
  }

  const cases = [
    { label: "empty history", timings: {}, status: "INSUFFICIENT_DATA", compared: 0, unmeasured: 0 },
    { label: "a first measurement", timings: { cold: [100] }, status: "INSUFFICIENT_DATA", compared: 0, unmeasured: 1 },
    {
      label: "mixed coverage",
      timings: { stable: [100, 100], cold: [100] },
      status: "PARTIAL",
      compared: 1,
      unmeasured: 1,
    },
    {
      label: "exactly twice the baseline",
      timings: { stable: [100, 200] },
      status: "CONFORMING",
      compared: 1,
      unmeasured: 0,
    },
  ];

  for (const { label, timings, status, compared, unmeasured } of cases) {
    it(`perf --json identifies ${label} without reporting a regression`, () => {
      const report = reportFor(timings, 0);
      assert.equal(report.status, status);
      assert.equal(report.comparedSuites, compared);
      assert.equal(report.unmeasuredSuites, unmeasured);
      assert.equal(report.regressionsCount, 0);
      assert.deepEqual(report.regressions, []);
    });
  }

  it("perf --json exits 1 for a measured regression even when another suite lacks a baseline", () => {
    const report = reportFor({ slow: [100, 250], cold: [500] }, 1);
    assert.equal(report.status, "REGRESSIONS_DETECTED");
    assert.equal(report.comparedSuites, 1);
    assert.equal(report.unmeasuredSuites, 1);
    assert.equal(report.regressionsCount, 1);
    assert.deepEqual(report.regressions, [
      { suite: "slow", currentMs: 250, baselineP95: 100, ratio: 2.5, regressed: true },
    ]);
  });

  it("perf --json identifies the malformed line and leaves the ledger unchanged", () => {
    const history = '{"suite":"stable","durationMs":100,"timestamp":1}\n{"durationMs":\n';
    fs.writeFileSync(ledger, history);
    const result = spawnSync(process.execPath, [cli, "perf", "--json"], { encoding: "utf8" });
    assert.ifError(result.error);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /perf-baseline\.jsonl:2\b/);
    assert.equal(fs.readFileSync(ledger, "utf8"), history);
  });

  it("perf explains insufficient data in the human-readable report", () => {
    const result = spawnSync(process.execPath, [cli, "perf"], { encoding: "utf8" });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /INSUFFICIENT|no (?:usable |comparable )?baseline|no .*comparisons/i);
    assert.doesNotMatch(result.stdout, /CONFORMING|all suites within/i);
  });
});

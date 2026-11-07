/**
 * BDD Test Suite — EosSLOErrorBudgetGovernor (SPEC-145)
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { EosSLOErrorBudgetGovernor } from "../src/core/eosSLOErrorBudgetGovernor.ts";

describe("SPEC-145: SLO Error-Budget Gate", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-slo-"));
  });

  it("BDD-440: PASS verdict when all tests pass", () => {
    const gov = new EosSLOErrorBudgetGovernor({ stateDir: tmpDir });
    gov.recordCIEvent(700, 700, 0);
    gov.recordCIEvent(650, 650, 0);
    const report = gov.evaluate();
    assert.equal(report.gateVerdict, "PASS");
    assert.equal(report.errorBudgetPercent, 100);
  });

  it("BDD-441: WARN verdict when slow burn exceeds 1x threshold", () => {
    const gov = new EosSLOErrorBudgetGovernor({ stateDir: tmpDir });
    // 30 failures / 1000 tests = 3% error rate, target allows 0.5% → 6x burn
    gov.recordCIEvent(1000, 970, 30);
    const report = gov.evaluate();
    assert.ok(report.errorBudgetPercent < 100);
    assert.ok(report.overallBreached);
    assert.ok(["WARN", "BLOCK"].includes(report.gateVerdict));
  });

  it("BDD-442: BLOCK verdict when fast 1h burn > 14.4x threshold", () => {
    const gov = new EosSLOErrorBudgetGovernor({ stateDir: tmpDir });
    // 200 failures / 1000 tests = 20% → 40x burn
    gov.recordCIEvent(1000, 800, 200);
    const report = gov.evaluate();
    assert.equal(report.gateVerdict, "BLOCK");
  });

  it("BDD-443: error budget consumed increases with failures", () => {
    const gov = new EosSLOErrorBudgetGovernor({ stateDir: tmpDir });
    gov.recordCIEvent(1000, 990, 10);
    const r1 = gov.evaluate();
    gov.recordCIEvent(1000, 960, 40);
    const r2 = gov.evaluate();
    assert.ok(r2.errorBudgetConsumed > r1.errorBudgetConsumed);
  });

  it("BDD-444: SHA-256 receipt is deterministic", () => {
    const gov = new EosSLOErrorBudgetGovernor({ stateDir: tmpDir });
    gov.recordCIEvent(100, 99, 1);
    const r1 = gov.evaluate();
    const r2 = gov.evaluate();
    assert.equal(r1.sha256Receipt, r2.sha256Receipt);
  });

  it("BDD-445: windows contain expected labels", () => {
    const gov = new EosSLOErrorBudgetGovernor({ stateDir: tmpDir });
    gov.recordCIEvent(100, 100, 0);
    const report = gov.evaluate();
    const labels = report.windows.map((w) => w.windowLabel);
    assert.ok(labels.includes("1h-fast"));
    assert.ok(labels.includes("6h-medium"));
    assert.ok(labels.includes("3d-slow"));
  });

  // -------------------------------------------------------------------------
  // SPEC-143 hardening: these cases exist to KILL surviving mutation-testing
  // mutants in the governor (see scripts/mutation-gate.mjs). Each group pins a
  // distinct branch/boundary so the mutation score cannot silently regress.
  // -------------------------------------------------------------------------

  const HOUR = 3_600_000;
  const DAY = 86_400_000;

  // recordCIEvent always stamps Date.now(), so window-boundary behaviour can
  // only be exercised by seeding the append-only state file it produces.
  function seedEvents(dir, events) {
    fs.writeFileSync(
      path.join(dir, "slo-events.jsonl"),
      `${events.map((e) => JSON.stringify(e)).join("\n")}\n`,
      "utf8",
    );
  }

  it("BDD-446: exposes the Google SRE defaults as a frozen contract", () => {
    const gov = new EosSLOErrorBudgetGovernor({ stateDir: tmpDir });
    gov.recordCIEvent(1000, 1000, 0);
    const report = gov.evaluate();
    assert.equal(report.sloTarget, 99.5);
    const thresholds = Object.fromEntries(report.windows.map((w) => [w.windowLabel, w.thresholdBurnRate]));
    assert.equal(thresholds["1h-fast"], 14.4);
    assert.equal(thresholds["6h-medium"], 6);
    assert.equal(thresholds["3d-slow"], 1);
  });

  it("BDD-447: error budget only counts events inside the 30-day horizon", () => {
    seedEvents(tmpDir, [
      // 30.5 days: inside a 31-day horizon but outside the configured 30 days,
      // which pins the exact budgetDays boundary.
      { timestamp: Date.now() - Math.round(30.5 * DAY), total: 10_000, passed: 10_000, failed: 0 },
      { timestamp: Date.now(), total: 1000, passed: 1000, failed: 0 },
    ]);
    const gov = new EosSLOErrorBudgetGovernor({ stateDir: tmpDir });
    const report = gov.evaluate();
    assert.equal(report.errorBudgetTotal, 5); // 1000 tests * 0.5% — the stale run is excluded
  });

  it("BDD-448: creates a missing (nested) state directory", () => {
    const nested = path.join(tmpDir, "a", "b");
    const gov = new EosSLOErrorBudgetGovernor({ stateDir: nested });
    assert.ok(fs.existsSync(nested), "constructor must create the state dir");
    gov.recordCIEvent(10, 10, 0);
    assert.ok(fs.existsSync(path.join(nested, "slo-events.jsonl")));
  });

  it("BDD-449: rejects a non-positive total but accepts a single test", () => {
    const gov = new EosSLOErrorBudgetGovernor({ stateDir: tmpDir });
    assert.throws(() => gov.recordCIEvent(0, 0, 0), /positive/);
    gov.recordCIEvent(1, 1, 0); // one test is a valid event
    assert.equal(gov.evaluate().gateVerdict, "PASS");
  });

  it("BDD-450: computes exact error-budget arithmetic", () => {
    const gov = new EosSLOErrorBudgetGovernor({ stateDir: tmpDir });
    gov.recordCIEvent(1000, 998, 2);
    const report = gov.evaluate();
    assert.equal(report.errorBudgetTotal, 5); // 1000 * (1 - 0.995)
    assert.equal(report.errorBudgetConsumed, 2);
    assert.equal(report.errorBudgetRemaining, 3); // 5 - 2
    assert.equal(report.errorBudgetPercent, 60); // 3 / 5
  });

  it("BDD-451: clamps an exhausted budget and reports 100% when there is no data", () => {
    const exhausted = new EosSLOErrorBudgetGovernor({ stateDir: path.join(tmpDir, "a") });
    exhausted.recordCIEvent(1000, 990, 10); // budget 5, consumed 10
    const r1 = exhausted.evaluate();
    assert.equal(r1.errorBudgetRemaining, 0);
    assert.equal(r1.errorBudgetPercent, 0);

    const empty = new EosSLOErrorBudgetGovernor({ stateDir: path.join(tmpDir, "b") });
    assert.equal(empty.evaluate().errorBudgetPercent, 100);
    assert.equal(empty.evaluate().gateVerdict, "PASS");

    const single = new EosSLOErrorBudgetGovernor({ stateDir: path.join(tmpDir, "c") });
    single.recordCIEvent(1, 0, 1);
    assert.equal(single.evaluate().errorBudgetPercent, 0);
  });

  it("BDD-452: window burn-rate is the exact error-rate ratio", () => {
    const gov = new EosSLOErrorBudgetGovernor({ stateDir: tmpDir });
    gov.recordCIEvent(1000, 900, 100);
    const fast = gov.evaluate().windows.find((w) => w.windowLabel === "1h-fast");
    assert.equal(fast.actualBurnRate, 20); // (100/1000) / 0.005
  });

  it("BDD-453: a single-test window still computes its burn-rate", () => {
    const gov = new EosSLOErrorBudgetGovernor({ stateDir: tmpDir });
    gov.recordCIEvent(1, 0, 1);
    const fast = gov.evaluate().windows.find((w) => w.windowLabel === "1h-fast");
    assert.equal(fast.actualBurnRate, 200); // (1/1) / 0.005
  });

  it("BDD-454: an empty window reports a zero burn-rate", () => {
    seedEvents(tmpDir, [{ timestamp: Date.now() - 2 * HOUR, total: 1000, passed: 900, failed: 100 }]);
    const gov = new EosSLOErrorBudgetGovernor({ stateDir: tmpDir });
    const fast = gov.evaluate().windows.find((w) => w.windowLabel === "1h-fast");
    assert.equal(fast.actualBurnRate, 0);
  });

  it("BDD-455: BLOCK is driven by the fast window, not the slowest one", () => {
    seedEvents(tmpDir, [
      { timestamp: Date.now() - 2 * HOUR, total: 100_000, passed: 100_000, failed: 0 },
      { timestamp: Date.now(), total: 1000, passed: 700, failed: 300 },
    ]);
    const gov = new EosSLOErrorBudgetGovernor({ stateDir: tmpDir });
    assert.equal(gov.evaluate().gateVerdict, "BLOCK");
  });

  it("BDD-456: a config without the fast window cannot BLOCK", () => {
    const config = {
      targetPercent: 99.5,
      budgetDays: 30,
      windows: [{ label: "slow", durationMs: HOUR, burnThreshold: 1 }],
    };
    const gov = new EosSLOErrorBudgetGovernor({ config, stateDir: tmpDir });
    gov.recordCIEvent(1000, 900, 100); // slow burn 20 > 1
    assert.equal(gov.evaluate().gateVerdict, "WARN");
  });

  it("BDD-457: a burn exactly at a zero threshold is not a breach", () => {
    const config = {
      targetPercent: 99.5,
      budgetDays: 30,
      windows: [{ label: "1h-fast", durationMs: HOUR, burnThreshold: 0 }],
    };
    const gov = new EosSLOErrorBudgetGovernor({ config, stateDir: tmpDir });
    gov.recordCIEvent(100, 100, 0); // burn 0 — not strictly greater than 0
    const report = gov.evaluate();
    assert.equal(report.windows[0].breached, false);
    assert.equal(report.gateVerdict, "PASS");
  });

  it("BDD-458: a 100% target yields a zero error budget with a zero burn-rate", () => {
    const config = {
      targetPercent: 100,
      budgetDays: 30,
      windows: [{ label: "1h-fast", durationMs: HOUR, burnThreshold: 14.4 }],
    };
    const gov = new EosSLOErrorBudgetGovernor({ config, stateDir: tmpDir });
    gov.recordCIEvent(100, 100, 0);
    assert.equal(gov.evaluate().windows[0].actualBurnRate, 0);
  });

  it("BDD-459: the default state directory is `.eos` under the cwd", () => {
    const cwd = process.cwd();
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "eos-slo-cwd-"));
    try {
      process.chdir(sandbox);
      const gov = new EosSLOErrorBudgetGovernor();
      gov.recordCIEvent(10, 10, 0);
      assert.ok(fs.existsSync(path.join(sandbox, ".eos", "slo-events.jsonl")));
    } finally {
      process.chdir(cwd);
    }
  });
});

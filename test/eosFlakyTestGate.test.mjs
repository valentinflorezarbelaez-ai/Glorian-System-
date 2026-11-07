/**
 * EOS SYSTEM — FLAKY TEST GATE (SPEC-131)
 *
 * Covers the Layer-0 classification engine (EosFlakyTestQuarantine), the JUnit
 * per-test parser, the wiring in scripts/flaky-gate.mjs (sandbox-free but run in
 * an isolated fixture repo), and the shrinking-quarantine ratchet.
 */

import { describe, it, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EosFlakyTestQuarantine } from "../src/core/eosFlakyTestQuarantine.ts";
import {
  runFlakyGate,
  parseJUnitOutcomes,
  loadFlakyBudget,
  evaluateFlakyBudget,
  updateFlakyBudget,
} from "../scripts/flaky-gate.mjs";

const obs = (testId, passed) => ({ testId, passed });

// ---------------------------------------------------------------------------
// Classification engine
// ---------------------------------------------------------------------------

describe("SPEC-131: Flaky test classification engine", () => {
  const engine = new EosFlakyTestQuarantine();

  it("classifies a test that passes every run as stable-pass", () => {
    const report = engine.classify([[obs("t", true)], [obs("t", true)], [obs("t", true)]]);
    assert.equal(report.tests[0].classification, "stable-pass");
    assert.equal(report.flakyCount, 0);
    assert.deepEqual(report.flakyTests, []);
  });

  it("classifies a test that fails every run as stable-fail", () => {
    const report = engine.classify([[obs("t", false)], [obs("t", false)]]);
    assert.equal(report.tests[0].classification, "stable-fail");
    assert.equal(report.flakyCount, 0);
  });

  it("flags a test whose verdict varies across runs as flaky", () => {
    const report = engine.classify([[obs("t", true)], [obs("t", false)], [obs("t", true)]]);
    const verdict = report.tests[0];
    assert.equal(verdict.classification, "flaky");
    assert.equal(verdict.passes, 2);
    assert.equal(verdict.failures, 1);
    assert.equal(verdict.observedRuns, 3);
    assert.deepEqual(report.flakyTests, ["t"]);
    assert.equal(report.flakyCount, 1);
  });

  it("flags a test with inconsistent presence as flaky", () => {
    const report = engine.classify([[obs("t", true)], [obs("t", true)], []]);
    assert.equal(report.tests[0].classification, "flaky");
    assert.equal(report.tests[0].observedRuns, 2);
    assert.equal(report.tests[0].passes, 2);
  });

  it("deduplicates repeated verdicts for the same test within a run", () => {
    const report = engine.classify([[obs("t", true), obs("t", true)], [obs("t", true)]]);
    assert.equal(report.tests[0].observedRuns, 2, "three observations collapse to two runs");
    assert.equal(report.tests[0].passes, 2);
    assert.equal(report.tests[0].classification, "stable-pass");
  });

  it("emits a deterministic receipt for identical runs", () => {
    const runs = [[obs("t", true)], [obs("t", true)]];
    assert.equal(engine.classify(runs).sha256Receipt, engine.classify(runs).sha256Receipt);
  });

  it("rejects fewer than the minimum runs", () => {
    assert.throws(() => engine.classify([[obs("t", true)]]), /at least 2 runs/);
  });

  it("rejects an invalid minRuns configuration", () => {
    assert.throws(() => new EosFlakyTestQuarantine({ minRuns: 1 }), /integer >= 2/);
    assert.throws(() => new EosFlakyTestQuarantine({ minRuns: 2.5 }), /integer >= 2/);
  });
});

// ---------------------------------------------------------------------------
// JUnit per-test parser
// ---------------------------------------------------------------------------

test("parseJUnitOutcomes extracts per-test verdicts (pass/fail/skip)", () => {
  const parserRoot = path.resolve(os.tmpdir(), "eos-flaky-parser");
  const filePath = path.join(parserRoot, "test", "a.test.mjs");
  const xml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    "<testsuites>",
    `  <testcase name="passes &amp; stays" time="0.01" classname="test" file="${filePath}"/>`,
    `  <testcase name="fails" time="0.02" classname="test" file="${filePath}">`,
    '    <failure type="AssertionError">boom</failure>',
    "  </testcase>",
    `  <testcase name="skipped" time="0" classname="test" file="${filePath}">`,
    "    <skipped/>",
    "  </testcase>",
    "</testsuites>",
  ].join("\n");

  const outcomes = parseJUnitOutcomes(xml, parserRoot);
  assert.equal(outcomes.length, 2, "skipped cases carry no verdict");
  assert.deepEqual(outcomes[0], { testId: "test/a.test.mjs::passes & stays", passed: true });
  assert.deepEqual(outcomes[1], { testId: "test/a.test.mjs::fails", passed: false });
});

// ---------------------------------------------------------------------------
// Wiring: repeated execution against a fixture repo
// ---------------------------------------------------------------------------

const DETERMINISTIC_TEST = [
  'import { test } from "node:test";',
  'import assert from "node:assert/strict";',
  "",
  'test("deterministic pass", () => {',
  "  assert.equal(1 + 1, 2);",
  "});",
  "",
].join("\n");

const TOGGLING_TEST = [
  'import { test } from "node:test";',
  'import assert from "node:assert/strict";',
  'import fs from "node:fs";',
  'import path from "node:path";',
  "",
  'test("toggles between pass and fail", () => {',
  '  const marker = path.join(process.cwd(), "eos-toggle.marker");',
  "  const seen = fs.existsSync(marker);",
  '  if (!seen) fs.writeFileSync(marker, "1");',
  "  assert.equal(seen, false);",
  "});",
  "",
].join("\n");

function buildFixture(testSource) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "eos-flaky-fixture-"));
  fs.mkdirSync(path.join(root, "test"), { recursive: true });
  fs.writeFileSync(path.join(root, "test", "eosFixtureFlaky.test.mjs"), testSource, "utf8");
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "eos-flaky-fixture", private: true, type: "module" }),
    "utf8",
  );
  return root;
}

describe("SPEC-131: Flaky gate (de-islanding)", () => {
  it("reports no flakiness for a deterministic suite", async () => {
    const root = buildFixture(DETERMINISTIC_TEST);
    const { report } = await runFlakyGate({ root, repeats: 3, files: ["test/eosFixtureFlaky.test.mjs"] });
    assert.equal(report.totalRuns, 3);
    assert.equal(report.flakyCount, 0);
    assert.equal(report.tests[0].classification, "stable-pass");
  });

  it("detects a genuinely flaky test across repetitions", async () => {
    const root = buildFixture(TOGGLING_TEST);
    const { report } = await runFlakyGate({ root, repeats: 3, files: ["test/eosFixtureFlaky.test.mjs"] });
    assert.equal(report.flakyCount, 1);
    const verdict = report.tests.find((t) => t.classification === "flaky");
    assert.ok(verdict, "the toggling test must be classified flaky");
    assert.ok(verdict.passes >= 1 && verdict.failures >= 1);
  });
});

// ---------------------------------------------------------------------------
// Quarantine ratchet
// ---------------------------------------------------------------------------

function buildBudgetRoot(quarantined) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "eos-flaky-budget-"));
  fs.mkdirSync(path.join(root, "docs", "quality"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs", "quality", "flaky-budget.json"), JSON.stringify({ quarantined }), "utf8");
  return root;
}

const entry = (testId, expiresOn = "2999-01-01", owner = "user:valentin-florez-arbelaez") => ({
  testId,
  owner,
  expiresOn,
});
const REFERENCE_DAY = new Date("2026-11-06T00:00:00Z");

describe("SPEC-131: Flaky quarantine ratchet", () => {
  it("treats a missing budget file as an empty quarantine", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "eos-flaky-nobudget-"));
    assert.deepEqual(loadFlakyBudget(root).quarantined, []);
  });

  it("flags a flaky test that is not quarantined (NEW_FLAKY)", () => {
    const root = buildBudgetRoot([]);
    const { violations } = evaluateFlakyBudget({ root, report: { flakyTests: ["a::t"] }, now: REFERENCE_DAY });
    assert.deepEqual(violations, [{ kind: "NEW_FLAKY", testId: "a::t" }]);
  });

  it("passes when the flaky test is quarantined and not expired", () => {
    const root = buildBudgetRoot([entry("a::t")]);
    const { violations } = evaluateFlakyBudget({ root, report: { flakyTests: ["a::t"] }, now: REFERENCE_DAY });
    assert.equal(violations.length, 0);
  });

  it("flags a stale quarantine entry that is no longer flaky (STALE_QUARANTINE)", () => {
    const root = buildBudgetRoot([entry("healed::t")]);
    const { violations } = evaluateFlakyBudget({ root, report: { flakyTests: [] }, now: REFERENCE_DAY });
    assert.deepEqual(violations, [{ kind: "STALE_QUARANTINE", testId: "healed::t" }]);
  });

  it("flags a quarantined test past its expiry (EXPIRED_QUARANTINE)", () => {
    const root = buildBudgetRoot([entry("a::t", "2020-01-01")]);
    const { violations } = evaluateFlakyBudget({ root, report: { flakyTests: ["a::t"] }, now: REFERENCE_DAY });
    assert.deepEqual(violations, [{ kind: "EXPIRED_QUARANTINE", testId: "a::t" }]);
  });

  it("fails closed on a quarantine entry missing an owner or expiry (MALFORMED_QUARANTINE)", () => {
    const root = buildBudgetRoot([{ testId: "a::t" }]);
    const { violations } = evaluateFlakyBudget({ root, report: { flakyTests: [] }, now: REFERENCE_DAY });
    assert.deepEqual(violations, [{ kind: "MALFORMED_QUARANTINE", testId: "a::t" }]);
  });

  it("shrinks the quarantine to still-flaky tests and never adds new ones", () => {
    const root = buildBudgetRoot([entry("healed::t"), entry("still::t")]);
    const { quarantined } = updateFlakyBudget({
      root,
      report: { flakyTests: ["still::t", "new::t"] },
    });
    assert.deepEqual(quarantined, [entry("still::t")]);
    assert.deepEqual(loadFlakyBudget(root).quarantined, [entry("still::t")]);
  });

  it("preserves a malformed entry so the signal is not silently erased", () => {
    const root = buildBudgetRoot([{ testId: "bad::t" }]);
    const { quarantined } = updateFlakyBudget({ root, report: { flakyTests: [] } });
    assert.deepEqual(quarantined, [{ testId: "bad::t" }]);
  });
});

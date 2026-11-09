import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseJUnitReport, runQualityGates } from "../scripts/quality-gates.mjs";

// Deterministic contract tests for the telemetry gate wiring. The engines are
// exercised with a synthetic JUnit report and a throwaway state dir so the
// real `.eos/` history is never touched.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SAMPLE_XML = `<?xml version="1.0" encoding="utf-8"?>
<testsuites>
\t<testcase name="a" time="0.010000" classname="test" file="/repo/test/specA.test.mjs"/>
\t<testcase name="b" time="0.020000" classname="test" file="/repo/test/specA.test.mjs"/>
\t<testcase name="c" time="0.005000" classname="test" file="/repo/test/specB.test.mjs"/>
\t<!-- tests 3 -->
\t<!-- suites 1 -->
\t<!-- pass 2 -->
\t<!-- fail 1 -->
\t<!-- cancelled 0 -->
\t<!-- skipped 0 -->
\t<!-- todo 0 -->
</testsuites>
`;

test("parseJUnitReport extracts aggregate pass/fail counts", () => {
  const report = parseJUnitReport(SAMPLE_XML);
  assert.equal(report.total, 3);
  assert.equal(report.passed, 2);
  assert.equal(report.failed, 1);
});

test("parseJUnitReport aggregates per-suite durations in milliseconds", () => {
  const report = parseJUnitReport(SAMPLE_XML);
  assert.equal(report.suitesMs.get("/repo/test/specA.test.mjs"), 30);
  assert.equal(report.suitesMs.get("/repo/test/specB.test.mjs"), 5);
  assert.equal(report.suitesMs.size, 2);
});

test("runQualityGates feeds both engines from the JUnit report", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-quality-gates-"));
  const reportPath = path.join(tmpDir, "report.xml");
  fs.writeFileSync(reportPath, SAMPLE_XML, "utf8");

  const result = await runQualityGates({ root, reportPath, stateDir: tmpDir });

  // SLO governor received the CI event (1 of 3 failed → fast-burn BLOCK).
  assert.equal(result.total, 3);
  assert.equal(result.passed, 2);
  assert.equal(result.failed, 1);
  assert.equal(result.suiteCount, 2);
  assert.equal(result.sloReport.gateVerdict, "BLOCK");
  assert.equal(result.sloReport.errorBudgetConsumed, 1);

  // Performance tracker: a single sample per suite cannot regress yet.
  assert.deepEqual(result.regressions, []);

  // Both engines persisted their state locally.
  assert.ok(fs.existsSync(path.join(tmpDir, "slo-events.jsonl")), "SLO event log must be written");
  assert.ok(fs.existsSync(path.join(tmpDir, "perf-baseline.jsonl")), "perf baseline must be written");
});

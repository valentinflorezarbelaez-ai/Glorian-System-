import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseJUnitReport, runQualityGates, runStage4QualityTelemetry } from "../scripts/quality-gates.mjs";

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

test("runQualityGates feeds both engines from the JUnit report", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-quality-gates-"));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));
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
  assert.equal(result.performanceStatus, "INSUFFICIENT_DATA");
  assert.equal(result.comparedSuites, 0);
  assert.equal(result.unmeasuredSuites, 2);

  // Both engines persisted their state locally.
  assert.ok(fs.existsSync(path.join(tmpDir, "slo-events.jsonl")), "SLO event log must be written");
  assert.ok(fs.existsSync(path.join(tmpDir, "perf-baseline.jsonl")), "perf baseline must be written");
});

test("Stage 4.4 blocks an unavailable SLO only in enforced mode", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "eos-stage44-slo-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const reportPath = path.join(root, "report.xml");
  fs.writeFileSync(reportPath, SAMPLE_XML.replace("<!-- fail 1 -->", ""));
  const errors = t.mock.method(console, "error", () => {});
  assert.equal(await runStage4QualityTelemetry({ root, reportPath, enforceSlo: false }), false);
  assert.match(errors.mock.calls.at(-1).arguments[0], /WARN.*Missing JUnit summary count: fail/);
  assert.equal(await runStage4QualityTelemetry({ root, reportPath, enforceSlo: true }), true);
  assert.match(errors.mock.calls.at(-1).arguments[0], /FAIL.*Missing JUnit summary count: fail/);
  assert.equal(fs.existsSync(path.join(root, ".eos", "slo-events.jsonl")), false);

  fs.writeFileSync(reportPath, SAMPLE_XML.replace("tests 3", "tests 0"));
  assert.equal(await runStage4QualityTelemetry({ root, reportPath, enforceSlo: true }), true);
  assert.match(errors.mock.calls.at(-1).arguments[0], /Inconsistent JUnit summary counts/);

  fs.writeFileSync(reportPath, SAMPLE_XML);
  fs.mkdirSync(path.join(root, ".eos"));
  fs.writeFileSync(path.join(root, ".eos", "slo-events.jsonl"), "invalid JSONL\n");
  assert.equal(await runStage4QualityTelemetry({ root, reportPath, enforceSlo: true }), true);
  assert.match(errors.mock.calls.at(-1).arguments[0], /FAIL.*SLO evaluation unavailable/);
  assert.equal(fs.readFileSync(path.join(root, ".eos", "slo-events.jsonl"), "utf8"), "invalid JSONL\n");
});

test("Stage 4.4 reports comparisons for active suites and keeps regressions advisory", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "eos-stage44-comparisons-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const reportPath = path.join(root, "report.xml");
  const healthy = SAMPLE_XML.replace("pass 2", "pass 3").replace("fail 1", "fail 0");
  const logs = t.mock.method(console, "log", () => {});
  const warnings = t.mock.method(console, "warn", () => {});
  const partial = healthy.replace("specB", "specC");
  const spike = healthy.replace("specB", "specD").replace("0.010000", "0.100000");
  for (const [xml, expected] of [
    [healthy, "INSUFFICIENT_DATA — compared 0 of 2 active suites (2 unmeasured)"],
    [partial, "PARTIAL — compared 1 of 2 active suites (1 unmeasured)"],
    [partial, "CONFORMING — compared 2 of 2 active suites (0 unmeasured)"],
    [spike, "REGRESSIONS_DETECTED — compared 1 of 2 active suites (1 unmeasured)"],
  ]) {
    logs.mock.resetCalls();
    fs.writeFileSync(reportPath, xml);
    assert.equal(await runStage4QualityTelemetry({ root, reportPath, enforceSlo: true }), false);
    assert.ok(
      logs.mock.calls.some((call) => call.arguments[0].includes(expected)),
      expected,
    );
  }
  assert.ok(warnings.mock.calls.some((call) => /specA\.test\.mjs: 120ms/.test(call.arguments[0])));
});

test("an unreadable performance baseline preserves enforced PASS and BLOCK verdicts", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "eos-stage44-perf-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const reportPath = path.join(root, "report.xml");
  fs.mkdirSync(path.join(root, ".eos"));
  fs.writeFileSync(path.join(root, ".eos", "perf-baseline.jsonl"), "invalid JSONL\n");
  const warnings = t.mock.method(console, "warn", () => {});
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", () => {});

  fs.writeFileSync(reportPath, SAMPLE_XML.replace("pass 2", "pass 3").replace("fail 1", "fail 0"));
  assert.equal(await runStage4QualityTelemetry({ root, reportPath, enforceSlo: true }), false);
  assert.match(warnings.mock.calls.at(-1).arguments[0], /Performance baseline unavailable/);
  fs.writeFileSync(reportPath, SAMPLE_XML);
  assert.equal(await runStage4QualityTelemetry({ root, reportPath, enforceSlo: true }), true);
});

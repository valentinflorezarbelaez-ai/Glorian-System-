#!/usr/bin/env node
/**
 * Quality Telemetry Gates — de-islands the Layer-0 governance engines.
 *
 * Big Tech pattern: the CI test run emits a machine-readable report (JUnit XML)
 * that downstream quality gates consume instead of being fed by hand. This
 * module parses that report and drives two previously-idle engines:
 *
 *   - EosSLOErrorBudgetGovernor  (SPEC-145, Google SRE multi-window burn-rate)
 *   - EosPerformanceRegressionTracker (SPEC-146, p95 regression detection)
 *
 * Zero external dependencies (Law V). Pure parser + thin orchestrator, so the
 * parsing contract is unit-testable without spawning the whole pipeline.
 */

import fs from "node:fs";
import path from "node:path";

/**
 * Parses a `node --test --test-reporter=junit` report.
 *
 * The runner appends aggregate counts as XML comments (`<!-- pass N -->`, ...)
 * and emits one `<testcase ... time="<seconds>" ... file="<path>"/>` per test.
 * We aggregate per-file durations to reconstruct per-suite wall-clock times.
 *
 * @param {string} xml raw JUnit XML
 * @returns {{ total: number, passed: number, failed: number, suitesMs: Map<string, number> }}
 */
export function parseJUnitReport(xml) {
  const count = (label) => {
    const match = xml.match(new RegExp(`<!--\\s*${label}\\s+(\\d+)\\s*-->`));
    return match ? Number(match[1]) : 0;
  };

  // Per-suite (test file) aggregation: sum of testcase durations, in ms.
  const suitesMs = new Map();
  const testcaseRe = /<testcase\b[^>]*\btime="([\d.]+)"[^>]*\bfile="([^"]+)"/g;
  for (const match of xml.matchAll(testcaseRe)) {
    const seconds = Number(match[1]);
    const file = match[2].replace(/\\/g, "/");
    suitesMs.set(file, (suitesMs.get(file) ?? 0) + seconds * 1000);
  }

  return {
    total: count("tests"),
    passed: count("pass"),
    failed: count("fail"),
    suitesMs,
  };
}

/**
 * Feeds a parsed JUnit report into both governance engines and returns verdicts.
 *
 * @param {object} options
 * @param {string} options.root repository root (where `.eos/` state lives)
 * @param {string} options.reportPath path to the JUnit XML report
 * @param {string} [options.stateDir] override for engine state (defaults to `<root>/.eos`)
 * @returns {Promise<{ sloReport: object, regressions: readonly object[], total: number, passed: number, failed: number, suiteCount: number }>}
 */
export async function runQualityGates({ root, reportPath, stateDir }) {
  const xml = fs.readFileSync(reportPath, "utf8");
  const { total, passed, failed, suitesMs } = parseJUnitReport(xml);

  const dir = stateDir ?? path.join(root, ".eos");

  const { EosSLOErrorBudgetGovernor } = await import("../src/core/eosSLOErrorBudgetGovernor.ts");
  const { EosPerformanceRegressionTracker } = await import("../src/core/eosPerformanceRegressionTracker.ts");

  // SLO error-budget: record this CI run, then evaluate rolling burn-rates.
  const slo = new EosSLOErrorBudgetGovernor({ stateDir: dir });
  if (total > 0) slo.recordCIEvent(total, passed, failed);
  const sloReport = slo.evaluate();

  // Performance regression: record per-suite timings, then check against p95.
  const perf = new EosPerformanceRegressionTracker(dir);
  const recordedSuites = new Set();
  for (const [file, ms] of suitesMs) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    recordedSuites.add(rel);
    perf.record(rel, ms);
  }
  const regressions = perf.checkAll(2.0, recordedSuites);

  return { sloReport, regressions, total, passed, failed, suiteCount: suitesMs.size };
}

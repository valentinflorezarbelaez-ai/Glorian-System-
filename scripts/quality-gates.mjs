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
    if (!match) throw new Error(`Missing JUnit summary count: ${label}`);
    return Number(match[1]);
  };

  // Per-suite (test file) aggregation: sum of testcase durations, in ms.
  const suitesMs = new Map();
  const testcaseRe = /<testcase\b[^>]*\btime="([\d.]+)"[^>]*\bfile="([^"]+)"/g;
  for (const match of xml.matchAll(testcaseRe)) {
    const seconds = Number(match[1]);
    const file = match[2].replace(/\\/g, "/");
    suitesMs.set(file, (suitesMs.get(file) ?? 0) + seconds * 1000);
  }

  const total = count("tests");
  const passed = count("pass");
  const failed = count("fail");
  if (![total, passed, failed].every(Number.isSafeInteger) || passed + failed > total) {
    throw new Error("Inconsistent JUnit summary counts");
  }
  return { total, passed, failed, suitesMs };
}

/**
 * Feeds a parsed JUnit report into both governance engines and returns verdicts.
 *
 * @param {object} options
 * @param {string} options.root repository root (where `.eos/` state lives)
 * @param {string} options.reportPath path to the JUnit XML report
 * @param {string} [options.stateDir] override for engine state (defaults to `<root>/.eos`)
 * @returns {Promise<{ sloReport: object, regressions: readonly object[], performanceStatus?: string, comparedSuites?: number, unmeasuredSuites?: number, performanceError?: string, total: number, passed: number, failed: number, suiteCount: number }>}
 */
export async function runQualityGates({ root, reportPath, stateDir }) {
  const xml = fs.readFileSync(reportPath, "utf8");
  const { total, passed, failed, suitesMs } = parseJUnitReport(xml);

  const dir = stateDir ?? path.join(root, ".eos");

  const { EosSLOErrorBudgetGovernor } = await import("../src/core/eosSLOErrorBudgetGovernor.ts");

  // SLO error-budget: record this CI run, then evaluate rolling burn-rates.
  const slo = new EosSLOErrorBudgetGovernor({ stateDir: dir });
  if (total > 0) slo.recordCIEvent(total, passed, failed);
  const sloReport = slo.evaluate();

  const result = { sloReport, total, passed, failed, suiteCount: suitesMs.size };
  try {
    const { EosPerformanceRegressionTracker } = await import("../src/core/eosPerformanceRegressionTracker.ts");
    const perf = new EosPerformanceRegressionTracker(dir);
    const recordedSuites = new Set();
    for (const [file, ms] of suitesMs) {
      const rel = path.relative(root, file).replace(/\\/g, "/");
      recordedSuites.add(rel);
      perf.record(rel, ms);
    }
    const { status: performanceStatus, ...comparison } = perf.summarize(2.0, recordedSuites);
    return { ...result, performanceStatus, ...comparison };
  } catch (err) {
    // A performance baseline is advisory, even when SLO enforcement is enabled.
    return { ...result, regressions: [], performanceError: err.message };
  }
}

/** Runs Stage 4.4 and returns true when the enforced SLO gate must stop verification. */
export async function runStage4QualityTelemetry({ root, reportPath, enforceSlo }) {
  let result;
  try {
    result = await runQualityGates({ root, reportPath });
  } catch (err) {
    const severity = enforceSlo ? "FAIL" : "WARN";
    console.error(`[STAGE 4.4 ${severity}] SLO evaluation unavailable: ${err.message}`);
    return enforceSlo;
  }
  const {
    sloReport,
    regressions,
    performanceError,
    performanceStatus,
    comparedSuites,
    unmeasuredSuites,
    total,
    suiteCount,
  } = result;
  console.log(`[STAGE 4.4] SLO error-budget: ${total} tests recorded across ${suiteCount} suites`);
  console.log(
    `[STAGE 4.4]   budget ${sloReport.errorBudgetPercent}% remaining | verdict [${sloReport.gateVerdict}] | receipt sha256:${sloReport.sha256Receipt.slice(0, 24)}...`,
  );
  for (const w of sloReport.windows) {
    console.log(
      `[STAGE 4.4]   ${w.windowLabel.padEnd(11)} burn=${w.actualBurnRate}x threshold=${w.thresholdBurnRate}x ${w.breached ? "BREACHED" : "ok"}`,
    );
  }

  if (performanceError) {
    console.warn(
      `[STAGE 4.4 ADVISORY] Performance baseline unavailable for ${suiteCount} active suites: ${performanceError}`,
    );
  } else {
    console.log(
      `[STAGE 4.4 ADVISORY] Performance ${performanceStatus} — compared ${comparedSuites} of ${suiteCount} active suites (${unmeasuredSuites} unmeasured).`,
    );
    for (const r of regressions) {
      console.warn(`[STAGE 4.4]   ${r.suite}: ${r.currentMs}ms vs p95 ${r.baselineP95}ms (${r.ratio}x)`);
    }
  }
  if (sloReport.gateVerdict === "BLOCK") {
    if (enforceSlo) {
      console.error("[STAGE 4.4 FAIL] SLO error-budget BLOCK verdict (EOS_SLO_ENFORCE=1).");
      return true;
    }
    console.warn(
      "[STAGE 4.4 ADVISORY] SLO BLOCK verdict (fast burn-rate breached); enforcement disabled locally — set EOS_SLO_ENFORCE=1 to fail-closed.",
    );
  }
  console.log(`[PASS] Stage 4.4/7 — Quality telemetry gates engaged (SLO ${sloReport.gateVerdict}; perf advisory).`);
  return false;
}

#!/usr/bin/env node
/**
 * Flaky Test Gate (opt-in) — de-islands EosFlakyTestQuarantine (SPEC-131).
 *
 * Big Tech pattern (Google TAP, Meta "quarantine with a budget"): run the same
 * suite N times on an unchanged revision and diff the per-test verdicts. A test
 * that does not behave deterministically carries no signal; a green pipeline
 * built on it can lie.
 *
 * Detected flakiness must be fixed or *explicitly* quarantined. The quarantine
 * is a ratchet (`docs/quality/flaky-budget.json`) — a tracked list of known-flaky
 * tests that may only shrink. Every entry is debt with an owner and an expiry
 * date, so a test can never be parked indefinitely:
 *   - a flaky test that is not quarantined     → NEW_FLAKY violation (fail)
 *   - a quarantined test that is now stable    → STALE_QUARANTINE violation (fail)
 *   - a quarantined test past its expiry       → EXPIRED_QUARANTINE violation (fail)
 *   - an entry missing a valid owner/expiry    → MALFORMED_QUARANTINE violation (fail)
 * New flakiness is never auto-added and an expiry is never auto-extended, so a
 * regression can neither be quarantined nor renewed away silently; a human must
 * acknowledge it in the budget file.
 *
 * Usage:
 *   node scripts/flaky-gate.mjs                # detect + verify the ratchet
 *   node scripts/flaky-gate.mjs --repeat=5     # repetitions (default 3)
 *   node scripts/flaky-gate.mjs --update       # prune healed quarantine entries
 *   npm run flaky:gate
 *
 * Zero external dependencies (Law V).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..");

const BUDGET_REL_PATH = "docs/quality/flaky-budget.json";
const DEFAULT_REPEATS = 3;

// ---------------------------------------------------------------------------
// JUnit parsing (per-test verdicts)
// ---------------------------------------------------------------------------

const XML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function unescapeXml(value) {
  return value.replace(/&(amp|lt|gt|quot|apos);/g, (_, entity) => XML_ENTITIES[entity]);
}

/**
 * Extracts the per-test outcome from a `node --test --test-reporter=junit` report.
 * A `<testcase>` with a nested `<failure>` or `<error>` counts as failed; any
 * other case passed. `<skipped>` cases are ignored (they carry no verdict).
 *
 * @param {string} xml raw JUnit XML
 * @param {string} root repository root (to relativize `file` attributes)
 * @returns {Array<{ testId: string, passed: boolean }>}
 */
export function parseJUnitOutcomes(xml, root) {
  const outcomes = [];
  const testcaseRe = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
  for (const match of xml.matchAll(testcaseRe)) {
    const attrs = match[1];
    const inner = match[2] ?? "";
    if (/<skipped\b/.test(inner)) continue;
    const nameMatch = attrs.match(/\bname="([^"]*)"/);
    const fileMatch = attrs.match(/\bfile="([^"]*)"/);
    if (!nameMatch || !fileMatch) continue;
    const file = path.relative(root, unescapeXml(fileMatch[1])).replace(/\\/g, "/");
    const name = unescapeXml(nameMatch[1]);
    outcomes.push({ testId: `${file}::${name}`, passed: !/<failure\b|<error\b/.test(inner) });
  }
  return outcomes;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Runs the suite `repeats` times and classifies every test.
 *
 * @param {object} [options]
 * @param {string} [options.root] repository root
 * @param {number} [options.repeats] repetition count (>= 2)
 * @param {string[]} [options.files] repo-relative suites (default: all test/*.test.mjs)
 * @param {number} [options.timeoutMs] per-run timeout
 * @returns {Promise<{ report: object, runs: object[][], tmpDir: string }>}
 */
export async function runFlakyGate({
  root = repoRoot,
  repeats = DEFAULT_REPEATS,
  files = undefined,
  timeoutMs = 900_000,
} = {}) {
  const { EosFlakyTestQuarantine } = await import("../src/core/eosFlakyTestQuarantine.ts");
  const engine = new EosFlakyTestQuarantine({ minRuns: 2 });

  const suites =
    files ??
    fs
      .readdirSync(path.join(root, "test"))
      .filter((f) => f.endsWith(".test.mjs"))
      .map((f) => `test/${f}`)
      .sort();

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-flaky-"));
  // `node --test` propagates NODE_TEST_CONTEXT to its children, which would
  // neuter the nested runner; strip the knobs so each repetition is a clean,
  // authoritative run (same hazard as the mutation gate).
  const childEnv = { ...process.env };
  delete childEnv.NODE_TEST_CONTEXT;
  delete childEnv.NODE_TEST_REPORTER;

  const runs = [];
  for (let i = 0; i < repeats; i++) {
    const reportPath = path.join(tmpDir, `run-${i}.xml`);
    const args = ["--test", "--test-reporter=junit", `--test-reporter-destination=${reportPath}`, ...suites];
    const run = spawnSync(process.execPath, args, {
      cwd: root,
      timeout: timeoutMs,
      stdio: "ignore",
      env: childEnv,
    });
    // A non-zero exit just means some tests failed in this repetition — those
    // verdicts are exactly what flakiness detection needs. Only a missing report
    // (a crash) is fatal.
    if (!fs.existsSync(reportPath)) {
      throw new Error(`flaky repetition ${i} produced no JUnit report (exit ${run.status})`);
    }
    runs.push(parseJUnitOutcomes(fs.readFileSync(reportPath, "utf8"), root));
  }

  return { report: engine.classify(runs), runs, tmpDir };
}

// ---------------------------------------------------------------------------
// Quarantine ratchet
// ---------------------------------------------------------------------------

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function toIsoDay(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * A quarantine entry is tracked debt: it must name a human owner and an expiry
 * date, otherwise it could be parked forever.
 *
 * @param {unknown} entry
 * @returns {boolean}
 */
export function isValidEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  if (typeof entry.testId !== "string" || entry.testId.length === 0) return false;
  if (typeof entry.owner !== "string" || entry.owner.length === 0) return false;
  if (typeof entry.expiresOn !== "string" || !ISO_DAY.test(entry.expiresOn)) return false;
  const parsed = new Date(`${entry.expiresOn}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && toIsoDay(parsed) === entry.expiresOn;
}

/**
 * Loads the flaky quarantine.
 *
 * @param {string} root repository root
 * @returns {{ quarantined: Array<{testId: string, owner: string, expiresOn: string}> }}
 */
export function loadFlakyBudget(root) {
  const budgetPath = path.join(root, BUDGET_REL_PATH);
  if (!fs.existsSync(budgetPath)) return { quarantined: [] };
  const parsed = JSON.parse(fs.readFileSync(budgetPath, "utf8"));
  return { quarantined: Array.isArray(parsed.quarantined) ? parsed.quarantined : [] };
}

/**
 * Compares the classification against the quarantine. Fail-closed on four kinds
 * of drift: new flakiness, healed-but-still-listed, expired entries, malformed
 * entries.
 *
 * @param {object} options
 * @param {string} options.root repository root
 * @param {{ flakyTests: string[] }} options.report classification report
 * @param {Date} [options.now] reference date (default: now)
 * @returns {{ violations: Array<{kind: string, testId: string}>, quarantined: object[] }}
 */
export function evaluateFlakyBudget({ root, report, now = new Date() }) {
  const today = toIsoDay(now);
  const { quarantined } = loadFlakyBudget(root);
  const flaky = new Set(report.flakyTests);
  const allow = new Set();
  const violations = [];
  for (const entry of quarantined) {
    if (!isValidEntry(entry)) {
      violations.push({ kind: "MALFORMED_QUARANTINE", testId: entry?.testId ?? "(invalid entry)" });
      continue;
    }
    allow.add(entry.testId);
    if (!flaky.has(entry.testId)) {
      violations.push({ kind: "STALE_QUARANTINE", testId: entry.testId });
    } else if (entry.expiresOn < today) {
      violations.push({ kind: "EXPIRED_QUARANTINE", testId: entry.testId });
    }
  }
  for (const testId of report.flakyTests) {
    if (!allow.has(testId)) violations.push({ kind: "NEW_FLAKY", testId });
  }
  return { violations, quarantined };
}

/**
 * Shrinks the quarantine: keeps every malformed entry (so the signal survives
 * until a human fixes it) plus the valid entries that are still flaky. New
 * flakiness is never added and an expiry is never extended — both must be
 * acknowledged explicitly by a human.
 */
export function updateFlakyBudget({ root, report }) {
  const budgetPath = path.join(root, BUDGET_REL_PATH);
  const { quarantined } = loadFlakyBudget(root);
  const stillFlaky = new Set(report.flakyTests);
  const kept = quarantined
    .filter((entry) => !isValidEntry(entry) || stillFlaky.has(entry.testId))
    .sort((a, b) => String(a?.testId ?? "").localeCompare(String(b?.testId ?? "")));
  fs.mkdirSync(path.dirname(budgetPath), { recursive: true });
  fs.writeFileSync(budgetPath, `${JSON.stringify({ quarantined: kept }, null, 2)}\n`, "utf8");
  return { quarantined: kept };
}

// ---------------------------------------------------------------------------
// Standalone execution: `node scripts/flaky-gate.mjs [--repeat=N] [--update]`
// ---------------------------------------------------------------------------

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const update = process.argv.includes("--update");
  const repeatArg = process.argv.find((a) => a.startsWith("--repeat="));
  const repeats = repeatArg
    ? Number(repeatArg.split("=")[1])
    : Number(process.env.EOS_FLAKY_REPEATS) || DEFAULT_REPEATS;

  console.log("======================================================================");
  console.log(" EOS FLAKY TEST GATE — Detecting Non-Determinism  ");
  console.log("======================================================================");
  const { report } = await runFlakyGate({ root: repoRoot, repeats });
  console.log(`  repeats=${report.totalRuns} tests=${report.tests.length} flaky=${report.flakyCount}`);
  console.log(`  receipt sha256:${report.sha256Receipt.slice(0, 24)}...`);
  for (const verdict of report.tests) {
    if (verdict.classification === "flaky") {
      console.log(
        `    FLAKY ${verdict.testId} (${verdict.passes}/${verdict.observedRuns} pass; seen in ${verdict.observedRuns}/${verdict.totalRuns} runs)`,
      );
    }
  }

  if (update) {
    const { quarantined } = updateFlakyBudget({ root: repoRoot, report });
    console.log(`✅ Flaky quarantine ratchet refreshed: ${quarantined.length} entry(ies).`);
    process.exit(0);
  }

  const { violations } = evaluateFlakyBudget({ root: repoRoot, report });
  if (violations.length === 0) {
    console.log("✅ Flaky ratchet OK (no new flakiness; quarantine is current).");
    process.exit(0);
  }
  console.error("❌ Flaky test budget violated:");
  for (const v of violations) {
    console.error(`  ${v.kind}: ${v.testId}`);
  }
  console.error("\nFix the flaky test, or acknowledge it in docs/quality/flaky-budget.json as");
  console.error('{ "testId", "owner", "expiresOn": "YYYY-MM-DD" }. `npm run flaky:gate -- --update`');
  console.error("prunes healed entries but never adds a new one or extends an expiry.");
  process.exit(1);
}

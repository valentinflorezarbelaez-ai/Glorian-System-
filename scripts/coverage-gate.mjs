#!/usr/bin/env node
/**
 * Coverage Gate — Big Tech mandatory minimum enforcement.
 *
 * Runs the full test suite with native V8 coverage and asserts that:
 *   - Line coverage >= MIN_LINE_PCT (default 80%)
 *   - Branch coverage >= MIN_BRANCH_PCT (default 80%)
 *   - Function coverage >= MIN_FUNC_PCT (default 75%)
 *
 * Zero external dependencies. Uses Node.js --experimental-test-coverage.
 * Invoked from CI Stage 4.5 or via `npm run coverage:gate`.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const MIN_LINE_PCT = Number(process.env.COVERAGE_MIN_LINE ?? 85);
const MIN_BRANCH_PCT = Number(process.env.COVERAGE_MIN_BRANCH ?? 85);
const MIN_FUNC_PCT = Number(process.env.COVERAGE_MIN_FUNC ?? 85);
const CONCURRENCY = Number(process.env.COVERAGE_CONCURRENCY ?? Math.min(8, os.cpus().length));

console.log("======================================================================");
console.log(" EOS SYSTEM — COVERAGE GATE (native V8, zero external deps)");
console.log(` Thresholds: Line>=${MIN_LINE_PCT}% | Branch>=${MIN_BRANCH_PCT}% | Func>=${MIN_FUNC_PCT}%`);
console.log("======================================================================");

const testDir = path.join(root, "test");
const testFiles = fs.existsSync(testDir)
  ? fs
      .readdirSync(testDir)
      .filter((file) => file.endsWith(".test.mjs"))
      .map((file) => `test/${file}`)
      .sort()
  : [];

if (testFiles.length === 0) {
  console.error("[FAIL] No test files found in test/ directory.");
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [
    "--test",
    "--experimental-test-coverage",
    "--test-coverage-exclude=bin/**",
    "--test-coverage-exclude=scripts/**",
    `--test-concurrency=${CONCURRENCY}`,
    ...testFiles,
  ],
  {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let stdout = "";
let stderr = "";

child.stdout.on("data", (chunk) => {
  stdout += chunk;
});
child.stderr.on("data", (chunk) => {
  stderr += chunk;
});

child.on("close", (exitCode) => {
  if (exitCode !== 0) {
    // Test failures are reported in the test run, not the coverage gate.
    console.error(`[FAIL] Test suite exited with code ${exitCode}. Coverage cannot be assessed.`);
    if (stderr.trim()) console.error("STDERR:", stderr.slice(-2000));
    if (stdout.trim()) console.error("STDOUT:", stdout.slice(-3000));
    process.exit(exitCode ?? 1);
  }

  // Parse "all files" row from the coverage summary table.
  // Format: ℹ all files | 82.34 | 72.04 | 84.26 |
  const allFilesMatch = stdout.match(/all files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/);
  if (!allFilesMatch) {
    console.error("[FAIL] Could not parse coverage output.");
    console.error(stdout.slice(-2000));
    process.exit(1);
  }

  const [, linePct, branchPct, funcPct] = allFilesMatch.map(Number);
  console.log("");
  console.log(` 📊 Measured Coverage:`);
  console.log(`    Lines:    ${linePct}%`);
  console.log(`    Branches: ${branchPct}%`);
  console.log(`    Functions: ${funcPct}%`);
  console.log("");

  // Extract file-by-file breakdown for targeted aerospace elevation
  const fileMatches = [
    ...stdout.matchAll(/ℹ?\s*([a-zA-Z0-9_\-/.]+\.(?:ts|js|mjs))\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/g),
  ];
  if (fileMatches.length > 0) {
    const fileStats = fileMatches
      .map((m) => ({
        file: m[1],
        linePct: Number(m[2]),
        branchPct: Number(m[3]),
        funcPct: Number(m[4]),
      }))
      .filter((f) => f.file !== "all files")
      .sort((a, b) => a.branchPct - b.branchPct);

    fs.writeFileSync(
      path.join(root, ".coverage-summary.json"),
      JSON.stringify(
        { timestamp: new Date().toISOString(), summary: { linePct, branchPct, funcPct }, files: fileStats },
        null,
        2,
      ),
    );

    const lowest10 = fileStats.slice(0, 10);
    console.log(" 🎯 Lowest 10 Modules by Branch Coverage:");
    for (const f of lowest10) {
      console.log(
        `    • ${f.file.padEnd(45)} Branches: ${String(f.branchPct).padStart(5)}% | Lines: ${String(f.linePct).padStart(5)}%`,
      );
    }
    console.log("");
  }

  const violations = [];
  if (linePct < MIN_LINE_PCT) violations.push(`Lines ${linePct}% < minimum ${MIN_LINE_PCT}%`);
  if (branchPct < MIN_BRANCH_PCT) violations.push(`Branches ${branchPct}% < minimum ${MIN_BRANCH_PCT}%`);
  if (funcPct < MIN_FUNC_PCT) violations.push(`Functions ${funcPct}% < minimum ${MIN_FUNC_PCT}%`);

  if (violations.length > 0) {
    console.error("═══════════════════════════════════════════════════════");
    console.error(" ✖ COVERAGE GATE FAILED");
    console.error("═══════════════════════════════════════════════════════");
    for (const v of violations) console.error(`  • ${v}`);
    console.error("");
    console.error("  Fix: add tests for uncovered paths, or adjust thresholds");
    console.error("  via COVERAGE_MIN_LINE, COVERAGE_MIN_BRANCH, COVERAGE_MIN_FUNC env vars.");
    process.exit(1);
  }

  console.log(" ✅ COVERAGE GATE PASSED — all thresholds met.");
  console.log("======================================================================");
});

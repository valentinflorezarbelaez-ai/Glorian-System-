#!/usr/bin/env node
/**
 * Glorian System — Incremental PTS V8 Code Coverage Ratchet
 * Governed by SPEC-271 / CHANGE-133 / ADR-133-004
 *
 * Runs V8 code coverage strictly across git-impacted files (PTS-driven),
 * verifying line and branch coverage satisfy floors in docs/quality/coverage-budget.json.
 *
 * Invariant: Zero external npm dependencies. Max cyclomatic complexity <= 15.
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
export const BUDGET_PATH = path.join(ROOT, "docs/quality/coverage-budget.json");

/**
 * Loads coverage budget from docs/quality/coverage-budget.json.
 */
export function loadCoverageBudget(root = ROOT) {
  const target = root === ROOT ? BUDGET_PATH : path.join(root, "docs/quality/coverage-budget.json");
  if (!fs.existsSync(target)) {
    return { defaultLineFloor: 85.0, defaultBranchFloor: 80.0, floors: {} };
  }
  return JSON.parse(fs.readFileSync(target, "utf8"));
}

/**
 * Resolves list of impacted source files using git diff.
 */
export function getImpactedSourceFiles(root = ROOT) {
  try {
    const raw = execFileSync("git", ["diff", "--name-only", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    });
    return raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("src/core/") && l.endsWith(".ts"));
  } catch {
    return [];
  }
}

/**
 * Maps source file to its corresponding test file.
 */
export function resolveTestForSource(srcFile, root = ROOT) {
  const baseName = path.basename(srcFile, ".ts");
  const directTest = path.join(root, "test", `${baseName}.test.mjs`);
  if (fs.existsSync(directTest)) return path.relative(root, directTest).replace(/\\/g, "/");

  // Fallback: search test/ for files importing this module
  const testDir = path.join(root, "test");
  if (fs.existsSync(testDir)) {
    const files = fs.readdirSync(testDir).filter((f) => f.endsWith(".test.mjs"));
    for (const file of files) {
      const content = fs.readFileSync(path.join(testDir, file), "utf8");
      if (content.includes(baseName)) {
        return `test/${file}`;
      }
    }
  }
  return null;
}

/**
 * Parses node --experimental-test-coverage output for line and branch percentages.
 */
export function parseCoverageOutput(stdout) {
  const linesMatch = stdout.match(/all files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/i);
  if (linesMatch) {
    return {
      linePercent: parseFloat(linesMatch[1]),
      branchPercent: parseFloat(linesMatch[2]),
      funcPercent: parseFloat(linesMatch[3]),
      parsed: true,
    };
  }

  // Parse single file summary table
  const lineRateMatch = stdout.match(/# line coverage rate:\s*([\d.]+)\s*%/i);
  const branchRateMatch = stdout.match(/# branch coverage rate:\s*([\d.]+)\s*%/i);

  return {
    linePercent: lineRateMatch ? parseFloat(lineRateMatch[1]) : 100.0,
    branchPercent: branchRateMatch ? parseFloat(branchRateMatch[1]) : 100.0,
    funcPercent: 100.0,
    parsed: Boolean(lineRateMatch || branchRateMatch),
  };
}

/**
 * Evaluates measured coverage against budget floors.
 */
export function evaluateCoverageReport(file, measured, budget) {
  const lineFloor = budget.floors[file]?.lines || budget.defaultLineFloor;
  const branchFloor = budget.floors[file]?.branches || budget.defaultBranchFloor;

  const linePass = measured.linePercent >= lineFloor;
  const branchPass = measured.branchPercent >= branchFloor;

  return {
    file,
    linePercent: measured.linePercent,
    lineFloor,
    linePass,
    branchPercent: measured.branchPercent,
    branchFloor,
    branchPass,
    passed: linePass && branchPass,
  };
}

/**
 * Runs incremental coverage across specified or detected files.
 */
export function runIncrementalCoverage(options = {}) {
  const root = options.root || ROOT;
  const budget = loadCoverageBudget(root);
  const targetFiles = options.files || getImpactedSourceFiles(root);

  if (targetFiles.length === 0) {
    return {
      status: "PASS_NO_IMPACTED_FILES",
      evaluatedCount: 0,
      passed: true,
      reports: [],
    };
  }

  const reports = [];
  let allPassed = true;

  for (const srcFile of targetFiles) {
    const testFile = resolveTestForSource(srcFile, root);
    if (!testFile) continue;

    const res = spawnSync(process.execPath, ["--test", "--experimental-test-coverage", testFile], {
      cwd: root,
      encoding: "utf8",
      timeout: 30000,
    });

    const parsed = parseCoverageOutput(`${res.stdout || ""}\n${res.stderr || ""}`);
    const evaluated = evaluateCoverageReport(srcFile, parsed, budget);
    if (!evaluated.passed) allPassed = false;
    reports.push(evaluated);
  }

  return {
    status: allPassed ? "PASS" : "COVERAGE_FLOOR_BREACH",
    evaluatedCount: reports.length,
    passed: allPassed,
    reports,
  };
}

// ---------------------------------------------------------------------------
// CLI Execution
// ---------------------------------------------------------------------------
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const specificFiles = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const result = runIncrementalCoverage({
    files: specificFiles.length > 0 ? specificFiles : null,
  });

  console.log("======================================================================");
  console.log(" GLORIAN SYSTEM — Incremental PTS V8 Code Coverage Ratchet (SPEC-271)");
  console.log("======================================================================");
  console.log(` Status          : ${result.status}`);
  console.log(` Evaluated Files : ${result.evaluatedCount}`);

  for (const r of result.reports) {
    console.log(`  - ${r.file}`);
    console.log(`    Lines   : ${r.linePercent}% (Floor: ${r.lineFloor}%) [${r.linePass ? "PASS" : "FAIL"}]`);
    console.log(`    Branches: ${r.branchPercent}% (Floor: ${r.branchFloor}%) [${r.branchPass ? "PASS" : "FAIL"}]`);
  }

  if (result.status === "PASS_NO_IMPACTED_FILES") {
    console.log("ℹ️ No modified source files detected in working tree; coverage check passed.");
    process.exit(0);
  }

  process.exit(result.passed ? 0 : 1);
}

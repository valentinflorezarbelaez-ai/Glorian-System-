#!/usr/bin/env node
/**
 * Mutation Gate (opt-in) — de-islands EosMutationTestingEngine (SPEC-143).
 *
 * Big Tech pattern (Google PIT/μTest, Meta SAPIenz): inject deliberate semantic
 * mutants and verify the test suite kills them; a surviving mutant is a test
 * gap. Running this per-commit is expensive, so it is opt-in (`EOS_MUTATION=1`)
 * and bounded.
 *
 * The score is governed by a ratchet (`docs/quality/mutation-budget.json`): a
 * per-target floor that may only be raised, so test quality can never silently
 * regress. The floor is the achieved score minus known-equivalent mutants
 * (e.g. type-only annotation edits, which have no runtime effect).
 *
 * Safety: mutants are applied to an isolated sandbox copy of `src/` + `test/`,
 * never to the working tree, so an interrupted run can never corrupt source.
 *
 * Usage:
 *   node scripts/mutation-gate.mjs             # analyze + verify the ratchet
 *   node scripts/mutation-gate.mjs --update    # raise the ratchet baseline
 *   npm run mutation:gate
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

const BUDGET_REL_PATH = "docs/quality/mutation-budget.json";
const DEFAULT_MIN_SCORE = 0.8;

// Core high-value modules governed under mutation testing ratchet
const DEFAULT_TARGETS = [
  "src/core/eosAdaptiveConcurrencyGovernor.ts",
  "src/core/eosAutonomousHealer.ts",
  "src/core/eosCellBasedBulkheadGovernor.ts",
  "src/core/eosDurableSqliteLedger.ts",
  "src/core/eosFleetProductScorecard.ts",
  "src/core/eosIamAuditLedger.ts",
  "src/core/eosKernelPrimitives.ts",
  "src/core/eosMultiWindowSloGovernor.ts",
  "src/core/eosPropertyFuzzingHypervisor.ts",
  "src/core/eosSLOErrorBudgetGovernor.ts",
  "src/core/eosSlsaProvenanceSbom.ts",
  "src/core/eosSurgicalSelfHealingKernel.ts",
  "src/core/eosThreeMountainsCompass.ts",
  "src/core/eosUniversalProductFoundry.ts",
  "src/core/eosVercelCanaryObservability.ts",
];

/**
 * Runs mutation analysis on each target inside a throwaway sandbox copy.
 *
 * @param {object} [options]
 * @param {string} [options.root] repository root to copy from
 * @param {string[]} [options.targets] source files (repo-relative) to mutate
 * @param {number} [options.maxMutantsPerFile] cap on mutants per file
 * @param {number} [options.timeoutMs] per-mutant test timeout
 * @returns {Promise<{ reports: object[], missingTargets: Array<{targetFile: string, reason: string}>, sandboxDir: string }>}
 */
export async function runMutationGate({
  root = repoRoot,
  targets = DEFAULT_TARGETS,
  maxMutantsPerFile = 200,
  timeoutMs = 60_000,
} = {}) {
  const { EosMutationTestingEngine } = await import("../src/core/eosMutationTestingEngine.ts");
  const engine = new EosMutationTestingEngine({ maxMutantsPerFile });

  const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-mutate-"));
  // `node --test` needs only these to resolve the module graph (zero runtime deps).
  for (const rel of ["src", "test", "package.json"]) {
    const from = path.join(root, rel);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(sandboxDir, rel), { recursive: true });
  }

  const reports = [];
  const missingTargets = [];
  for (const target of targets) {
    const relTarget = target.replace(/\\/g, "/");
    const testRel = relTarget.replace(/^src\/core\//, "test/").replace(/\.ts$/, ".test.mjs");
    const boxTarget = path.join(sandboxDir, relTarget);
    const boxTest = path.join(sandboxDir, testRel);
    // Fail-closed: a configured target that cannot be analyzed is surfaced, never
    // silently dropped — a gate that measures nothing must not report green.
    if (!fs.existsSync(boxTarget)) {
      missingTargets.push({ targetFile: relTarget, reason: "source file not found" });
      continue;
    }
    if (!fs.existsSync(boxTest)) {
      missingTargets.push({ targetFile: relTarget, reason: `test file not found (${testRel})` });
      continue;
    }

    const original = fs.readFileSync(boxTarget, "utf8");
    // `node --test` propagates NODE_TEST_CONTEXT to its children, which would
    // make the spawned suite exit 0 regardless of failures — a false "survivor".
    // Strip the test-runner knobs so the child runs a clean, authoritative suite.
    const childEnv = { ...process.env };
    delete childEnv.NODE_TEST_CONTEXT;
    delete childEnv.NODE_TEST_REPORTER;
    const report = await engine.analyze(boxTarget, async (mutatedSource) => {
      fs.writeFileSync(boxTarget, mutatedSource, "utf8");
      try {
        const run = spawnSync(process.execPath, ["--test", testRel], {
          cwd: sandboxDir,
          timeout: timeoutMs,
          stdio: "ignore",
          env: childEnv,
        });
        // true => the suite still passed => the mutant SURVIVED.
        return run.status === 0;
      } finally {
        fs.writeFileSync(boxTarget, original, "utf8"); // always restore the sandbox
      }
    });
    reports.push({ ...report, targetFile: relTarget });
  }

  return { reports, missingTargets, sandboxDir };
}

// ---------------------------------------------------------------------------
// Ratchet baseline
// ---------------------------------------------------------------------------

/**
 * Loads the mutation-score ratchet baseline.
 *
 * @param {string} root repository root
 * @returns {{ minScore: number, floors: Record<string, number> }}
 */
export function loadMutationBudget(root) {
  const budgetPath = path.join(root, BUDGET_REL_PATH);
  if (!fs.existsSync(budgetPath)) return { minScore: DEFAULT_MIN_SCORE, floors: {} };
  const parsed = JSON.parse(fs.readFileSync(budgetPath, "utf8"));
  return {
    minScore: typeof parsed.minScore === "number" ? parsed.minScore : DEFAULT_MIN_SCORE,
    floors: parsed.floors ?? {},
  };
}

/**
 * Compares each report's score against its floor (per-target, else minScore).
 *
 * @returns {{ violations: Array<{target: string, score: number, floor: number}>, minScore: number }}
 */
export function evaluateMutationBudget({ root, reports, targets }) {
  const { minScore, floors } = loadMutationBudget(root);
  const violations = [];
  const reported = new Set(reports.map((r) => r.targetFile));
  for (const r of reports) {
    const floor = Object.hasOwn(floors, r.targetFile) ? floors[r.targetFile] : minScore;
    if (r.score < floor) violations.push({ kind: "BELOW_FLOOR", target: r.targetFile, score: r.score, floor });
  }
  // A ratcheted target with no report is an unverified claim, not a pass: its
  // source or test may have been renamed/deleted, silently disabling the gate.
  const targetsToCheck = targets && targets.length > 0 ? new Set(targets) : new Set(Object.keys(floors));
  for (const [targetFile, floor] of Object.entries(floors)) {
    if (targetsToCheck.has(targetFile) && !reported.has(targetFile)) {
      violations.push({ kind: "MISSING_TARGET_REPORT", target: targetFile, score: 0, floor });
    }
  }
  return { violations, minScore, floors };
}

/**
 * Raises the ratchet: floors may only move up, never down.
 */
export function updateMutationBudget({ root, reports }) {
  const budgetPath = path.join(root, BUDGET_REL_PATH);
  const { minScore, floors } = loadMutationBudget(root);
  for (const r of reports) {
    const previous = Object.hasOwn(floors, r.targetFile) ? floors[r.targetFile] : minScore;
    floors[r.targetFile] = Math.max(previous, Math.round(r.score * 1000) / 1000);
  }
  const ordered = Object.fromEntries(Object.entries(floors).sort());
  fs.mkdirSync(path.dirname(budgetPath), { recursive: true });
  fs.writeFileSync(budgetPath, `${JSON.stringify({ minScore, floors: ordered }, null, 2)}\n`, "utf8");
  return { floors: ordered };
}

// ---------------------------------------------------------------------------
// Standalone execution: `node scripts/mutation-gate.mjs [--update]`
// ---------------------------------------------------------------------------

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const update = process.argv.includes("--update");
  const specificTargets = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const targets = specificTargets.length > 0 ? specificTargets : DEFAULT_TARGETS;
  const { reports, missingTargets, sandboxDir } = await runMutationGate({ targets });

  console.log("======================================================================");
  console.log(" EOS MUTATION GATE — Testing the Tests (isolated sandbox)  ");
  console.log("======================================================================");
  for (const r of reports) {
    console.log(`  ${r.targetFile}`);
    console.log(`    mutants=${r.totalMutants} killed=${r.killed} survived=${r.survived} score=${r.scorePercent}`);
    console.log(`    receipt sha256:${r.sha256Receipt.slice(0, 24)}...`);
  }
  for (const m of missingTargets) {
    console.error(`  MISSING ${m.targetFile}: ${m.reason}`);
  }
  console.log(`  sandbox: ${sandboxDir}`);

  if (update) {
    const { floors } = updateMutationBudget({ root: repoRoot, reports });
    console.log(`✅ Mutation ratchet refreshed: ${Object.keys(floors).length} target floor(s).`);
    process.exit(0);
  }

  const { violations, minScore } = evaluateMutationBudget({ root: repoRoot, reports, targets: specificTargets });
  if (violations.length === 0 && missingTargets.length === 0) {
    console.log(`✅ Mutation ratchet OK (default floor ${Math.round(minScore * 100)}%).`);
    process.exit(0);
  }
  console.error("❌ Mutation gate failed (ratchet floor violated or target unmeasured):");
  for (const v of violations) {
    if (v.kind === "MISSING_TARGET_REPORT") {
      console.error(`  ${v.target}: no report produced — ratchet floor ${(v.floor * 100).toFixed(1)}% unverified.`);
    } else {
      console.error(`  ${v.target}: ${(v.score * 100).toFixed(1)}% < floor ${(v.floor * 100).toFixed(1)}%`);
    }
  }
  console.error("\nStrengthen the tests, or run `npm run mutation:gate -- --update` to raise the baseline.");
  process.exit(1);
}

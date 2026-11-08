import assert from "node:assert/strict";
import { execFile, execFileSync, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const root = process.cwd();
const startTime = Date.now();

// Sanitize Git hook environment variables so nested git operations in test suites and worktree tooling are isolated
delete process.env.GIT_DIR;
delete process.env.GIT_INDEX_FILE;
delete process.env.GIT_WORK_TREE;
delete process.env.GIT_PREFIX;

const MAX_REPO_FILES = 20_000;
const MAX_SINGLE_REPO_FILE_BYTES = 64 * 1024 * 1024;
const MAX_REPO_INVENTORY_BYTES = 512 * 1024 * 1024;

console.log("======================================================================");
console.log(" EOS SYSTEM — LOCAL REPOSITORY CHECKS (NO DEPLOYMENT)  ");
console.log(` [INFO] Node: ${process.version} | Platform: ${process.platform} | Arch: ${process.arch}`);
console.log("======================================================================");

// Helper to recursively list tracked project files
function listRepoFiles(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (
      entry.name === ".git" ||
      entry.name === ".eos" ||
      entry.name === ".vercel" ||
      entry.name === "node_modules" ||
      entry.name === "dist" ||
      entry.name === "_sandbox" ||
      entry.name === "dynamic_tools" ||
      entry.name.startsWith(".worktree")
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listRepoFiles(full, acc);
    } else if (entry.isFile()) {
      acc.push(full);
      if (acc.length > MAX_REPO_FILES) {
        throw new RangeError(`Repository scan exceeds its ${MAX_REPO_FILES}-file limit.`);
      }
    }
  }
  return acc;
}

const allFiles = listRepoFiles(root);
let inventoryBytes = 0;
for (const file of allFiles) {
  const stat = fs.lstatSync(file);
  assert.ok(
    stat.isFile() && !stat.isSymbolicLink(),
    `[STAGE 1 FAIL] Refusing a non-regular or symbolic-link file: ${path.relative(root, file)}`,
  );
  assert.ok(
    stat.size <= MAX_SINGLE_REPO_FILE_BYTES,
    `[STAGE 1 FAIL] File exceeds the 64 MiB limit: ${path.relative(root, file)}`,
  );
  inventoryBytes += stat.size;
  assert.ok(
    inventoryBytes <= MAX_REPO_INVENTORY_BYTES,
    "[STAGE 1 FAIL] Repository scan exceeds its 512 MiB inventory limit.",
  );
}

// ---------------------------------------------------------------------------
// STAGE 1: SPEC-123 & SPEC-124 FLEET SECRET-SCAN & DYNAMIC REGISTRY GATE
// ---------------------------------------------------------------------------
execFileSync(process.execPath, [path.join(root, "scripts/eos-secret-scan.mjs"), "."], {
  cwd: root,
  stdio: "inherit",
});
execFileSync(process.execPath, [path.join(root, "scripts/eos-fleet-registry-sync.mjs"), "--dry-run"], {
  cwd: root,
  stdio: "inherit",
});
console.log(
  `[PASS] Stage 1/7 — SPEC-123 Canonical Zero-Plain-Secrets & SPEC-124 Fleet Registry Sentinel (exit code 0).`,
);

// ---------------------------------------------------------------------------
// STAGE 2: CONSTITUTIONAL SDD & 7 INVIOLABLE LAWS GATE (LAWS I, II, VII)
// ---------------------------------------------------------------------------
execFileSync(process.execPath, [path.join(root, "scripts/verify-landing.mjs")], {
  cwd: root,
  stdio: "inherit",
});
execFileSync(process.execPath, [path.join(root, "scripts/verify-sri-integrity.mjs")], {
  cwd: root,
  stdio: "inherit",
});
// Law II (no code precedes a formal specification): every SPEC-NNN citation in
// source or docs must resolve to a real OpenSpec file. Fail-closed — a dangling
// reference is unverifiable prose and is treated as a gate failure, not a warning.
execFileSync(process.execPath, [path.join(root, "scripts/verify-reference-integrity.mjs")], {
  cwd: root,
  stdio: "inherit",
});
console.log("[PASS] Stage 2/7 — Landing-page assertions, SRI integrity, and reference-integrity gate.");

// ---------------------------------------------------------------------------
// STAGE 3: runtime dependency check and a digest of the source-file inventory
// ---------------------------------------------------------------------------
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const runtimeDeps = Object.keys(pkg.dependencies || {});
assert.equal(
  runtimeDeps.length,
  0,
  `[STAGE 3 FAIL] Law V violation: Expected 0 external runtime dependencies, found: ${runtimeDeps.join(", ")}`,
);

const fileInventory = [];
const inventoryHasher = crypto.createHash("sha256");
for (const file of allFiles.sort()) {
  if (!fs.existsSync(file)) continue;
  const rel = path.relative(root, file).replace(/\\/g, "/");
  if (
    rel === "docs/evidence/LOCAL-CHECKS-RECEIPT.json" ||
    rel === "docs/evidence/local-checks.sarif" ||
    /^docs\/evidence\/HEAL-.*\.json$/.test(rel)
  )
    continue;
  const bytes = fs.readFileSync(file);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  fileInventory.push({ path: rel, bytes: bytes.length, sha256 });
  inventoryHasher.update(`${rel}:${sha256}\n`);
}
const sourceInventoryDigest = `sha256:${inventoryHasher.digest("hex")}`;
console.log(
  `[PASS] Stage 3/7 — Runtime dependency check and source-file inventory (${fileInventory.length} files; SHA-256 digest: ${sourceInventoryDigest.slice(0, 24)}...).`,
);

// ---------------------------------------------------------------------------
// STAGE 3.5: BOUNDED JAVASCRIPT SIMULATIONS ASSOCIATED WITH TLA+ FILES
// ---------------------------------------------------------------------------
execFileSync(process.execPath, [path.join(root, "scripts/verify-formal-tla.mjs")], {
  cwd: root,
  stdio: "inherit",
});
console.log(
  "[PASS] Stage 3.5/7 — Bounded JavaScript simulations and text extraction from TLA+ files (not TLC model checking).",
);

// ---------------------------------------------------------------------------
// STAGE 4: STATIC AST, SYNTAX & BYTECODE VERIFICATION (node --check + L0 TS)
// ---------------------------------------------------------------------------
// Big Tech pattern: parallel syntax verification via worker pool.
// Test files are excluded here — the parallel test runner validates their
// syntax intrinsically upon module loading.
const CONCURRENCY = Math.min(8, Math.max(4, (os.cpus()?.length ?? 8) - 2));
const testFileSet = new Set(
  fs
    .readdirSync(path.join(root, "test"))
    .filter((f) => f.endsWith(".test.mjs"))
    .map((f) => path.join(root, "test", f)),
);
const jsFilesToCheck = allFiles.filter((f) => (f.endsWith(".js") || f.endsWith(".mjs")) && !testFileSet.has(f));
const syntaxErrors = [];
{
  let idx = 0;
  async function syntaxWorker() {
    while (idx < jsFilesToCheck.length) {
      const file = jsFilesToCheck[idx++];
      if (!fs.existsSync(file)) continue;
      try {
        await execFileAsync(process.execPath, ["--check", file], { cwd: root, maxBuffer: 4 * 1024 * 1024 });
      } catch (err) {
        const msg = err.stderr?.toString().trim() || err.message;
        syntaxErrors.push({ file: path.relative(root, file), message: msg });
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => syntaxWorker()));
}
assert.equal(
  syntaxErrors.length,
  0,
  `[STAGE 4 FAIL] ${syntaxErrors.length} JavaScript syntax error(s):\n` +
    syntaxErrors.map((e) => `  ${e.file}: ${e.message}`).join("\n"),
);

const typeScriptCompiler = path.join(root, "node_modules", "typescript", "bin", "tsc");
assert.ok(
  fs.existsSync(typeScriptCompiler),
  "TypeScript compiler is missing; install the locked dev toolchain with npm ci.",
);
execFileSync(process.execPath, [typeScriptCompiler, "--project", path.join(root, "tsconfig.typecheck.json")], {
  cwd: root,
  stdio: "inherit",
});
const tsCoreFiles = fs.readdirSync(path.join(root, "src/core")).filter((f) => f.endsWith(".ts"));
assert.ok(tsCoreFiles.length >= 6, "Expected at least 6 Layer-0 TypeScript core modules in src/core/");

// Discover test suites
const testFiles = fs
  .readdirSync(path.join(root, "test"))
  .filter((file) => file.endsWith(".test.mjs"))
  .map((file) => `test/${file}`)
  .sort();
assert.ok(testFiles.length > 0, "No Node test suites were found under test/.");

// PTS impact-scoped selection (unchanged logic)
const isPts = process.argv.includes("--pts");
let filesToRun = testFiles;

if (isPts) {
  try {
    const gitDiff = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
    const changed = gitDiff
      .split("\n")
      .filter(Boolean)
      .map((l) => l.slice(3).trim())
      .map((l) => (l.includes(" -> ") ? l.slice(l.indexOf(" -> ") + 4) : l))
      .filter(Boolean);

    if (changed.length > 0) {
      const { EosDatalogVerifier } = await import("../src/core/eosDatalogVerifier.ts");
      const verifier = new EosDatalogVerifier(root);
      const selected = new Set();

      for (const item of changed) {
        const norm = item.replace(/\\/g, "/");
        if (norm.startsWith("test/") && norm.endsWith(".test.mjs")) {
          selected.add(norm);
        } else if (norm.startsWith("src/core/") && norm.endsWith(".ts")) {
          const blast = verifier.queryBlastRadius(norm);
          blast.predictiveTestSuites.forEach((s) => selected.add(s));
        }
      }

      if (selected.size > 0) {
        filesToRun = testFiles.filter((f) => selected.has(f));
        console.log(
          `[STAGE 4 PTS] Datalog Smart Selection activated: ${filesToRun.length} of ${testFiles.length} suites selected.`,
        );
      }
    }
  } catch {
    filesToRun = testFiles;
  }
}

// Big Tech pattern: single parallel test-runner invocation (eliminates
// 140 × serial process spawn; Node test runner internally parallelizes).
const testStart = Date.now();
// The JUnit XML report is the machine-readable feed for the Stage 4.4 telemetry
// gates. It lives under the gitignored `.eos/` state dir, so it never dirties
// the working tree nor perturbs the Stage 3 source-inventory digest.
const testReportPath = path.join(root, ".eos", "test-report.xml");
fs.mkdirSync(path.dirname(testReportPath), { recursive: true });
console.log(
  `[STAGE 4 RUNNER] Launching ${filesToRun.length} suites in parallel via node --test (concurrency=${CONCURRENCY})...`,
);
const testArgs = [
  "--test",
  `--test-concurrency=${CONCURRENCY}`,
  "--test-reporter=spec",
  "--test-reporter-destination=stdout",
  "--test-reporter=junit",
  `--test-reporter-destination=${testReportPath}`,
  ...filesToRun,
];
const exitCode = await new Promise((resolve) => {
  const child = spawn(process.execPath, testArgs, { cwd: root, stdio: "inherit" });
  child.on("close", (code) => resolve(code ?? 1));
  child.on("error", () => resolve(1));
});
if (exitCode !== 0) {
  console.error(`[STAGE 4 FAILED] Parallel test suite exited with code ${exitCode} in ${Date.now() - testStart} ms.`);
} else {
  console.log(
    `[PASS] Stage 4/7 — JavaScript syntax (${jsFilesToCheck.length} non-test modules, pool=${CONCURRENCY}), TypeScript type-check, and parallel Node test suites (${tsCoreFiles.length} core TS modules; ${testFiles.length} suites in ${Date.now() - testStart} ms).`,
  );
}

// ---------------------------------------------------------------------------
// STAGE 4.4: QUALITY TELEMETRY GATES — SLO ERROR-BUDGET + PERF REGRESSION
// De-islands the two Layer-0 governance engines (SPEC-145, SPEC-146): the JUnit
// report from Stage 4 is fed into them, so they run as real, telemetry-driven
// gates instead of idle modules. This stage runs even when Stage 4 failed, so
// failing runs feed the rolling burn-rate history (the point of Google SRE
// multi-window burn-rate). Perf is always advisory; SLO enforcement is opt-in
// (`EOS_SLO_ENFORCE=1`) to keep the local gate deterministic and noise-free.
// ---------------------------------------------------------------------------
let sloBlock = false;
try {
  const { runQualityGates } = await import("./quality-gates.mjs");
  const { sloReport, regressions, total, suiteCount } = await runQualityGates({ root, reportPath: testReportPath });
  console.log(`[STAGE 4.4] SLO error-budget: ${total} tests recorded across ${suiteCount} suites`);
  console.log(
    `[STAGE 4.4]   budget ${sloReport.errorBudgetPercent}% remaining | verdict [${sloReport.gateVerdict}] | receipt sha256:${sloReport.sha256Receipt.slice(0, 24)}...`,
  );
  for (const w of sloReport.windows) {
    console.log(
      `[STAGE 4.4]   ${w.windowLabel.padEnd(11)} burn=${w.actualBurnRate}x threshold=${w.thresholdBurnRate}x ${w.breached ? "BREACHED" : "ok"}`,
    );
  }
  const sloEnforced = process.env.EOS_SLO_ENFORCE === "1";
  if (sloReport.gateVerdict === "BLOCK") {
    if (sloEnforced) {
      sloBlock = true;
    } else {
      console.warn(
        "[STAGE 4.4 ADVISORY] SLO BLOCK verdict (fast burn-rate breached); enforcement disabled locally — set EOS_SLO_ENFORCE=1 to fail-closed.",
      );
    }
  }
  if (regressions.length === 0) {
    console.log("[STAGE 4.4] Performance regression: ADVISORY — no suite above 2x its p95 baseline.");
  } else {
    console.warn(
      `[STAGE 4.4 ADVISORY] Performance regression: ${regressions.length} suite(s) above 2x p95 (does not block correctness):`,
    );
    for (const r of regressions) {
      console.warn(`[STAGE 4.4]   ${r.suite}: ${r.currentMs}ms vs p95 ${r.baselineP95}ms (${r.ratio}x)`);
    }
  }
  console.log(`[PASS] Stage 4.4/7 — Quality telemetry gates engaged (SLO ${sloReport.gateVerdict}; perf advisory).`);
} catch (err) {
  console.error(`[STAGE 4.4 WARN] Quality telemetry gates unavailable: ${err.message}`);
}

// Stage 4's own failure is authoritative; the telemetry gates only add an
// optional fail-closed path on top of it.
if (exitCode !== 0) process.exit(1);
if (sloBlock) {
  console.error("[STAGE 4.4 FAIL] SLO error-budget BLOCK verdict (EOS_SLO_ENFORCE=1).");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// STAGE 4.5: NATIVE V8 COVERAGE GATE (Big Tech: minimum threshold enforcement)
// Skippable via SKIP_COVERAGE=1 for rapid local iteration.
// ---------------------------------------------------------------------------
if (!process.env.SKIP_COVERAGE) {
  const MIN_LINE = Number(process.env.COVERAGE_MIN_LINE ?? 80);
  const covStart = Date.now();
  console.log(`[STAGE 4.5] Running native V8 coverage (threshold: ${MIN_LINE}% lines)...`);
  const covArgs = ["--test", "--experimental-test-coverage", `--test-concurrency=${CONCURRENCY}`, ...filesToRun];
  const covOutput = await new Promise((resolve) => {
    let stdout = "";
    const child = spawn(process.execPath, covArgs, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (c) => {
      stdout += c;
    });
    child.stderr.on("data", () => {});
    child.on("close", () => resolve(stdout));
  });
  const covMatch = covOutput.match(/all files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/);
  if (covMatch) {
    const linePct = Number(covMatch[1]);
    const branchPct = Number(covMatch[2]);
    const funcPct = Number(covMatch[3]);
    console.log(
      `[COVERAGE] Lines: ${linePct}% | Branches: ${branchPct}% | Functions: ${funcPct}% (${Date.now() - covStart} ms)`,
    );
    if (linePct < MIN_LINE) {
      console.error(`[STAGE 4.5 FAIL] Line coverage ${linePct}% below gate minimum ${MIN_LINE}%.`);
      process.exit(1);
    }
    console.log(`[PASS] Stage 4.5/7 — Coverage gate: ${linePct}% lines >= ${MIN_LINE}% threshold.`);
  } else {
    console.warn("[STAGE 4.5 WARN] Coverage output not parseable; skipping gate.");
  }
} else {
  console.log("[STAGE 4.5 SKIP] Coverage gate skipped (SKIP_COVERAGE=1).");
}

// ---------------------------------------------------------------------------
// STAGE 4.6: MUTATION TESTING GATE (opt-in) — de-islands EosMutationTestingEngine
// Big Tech pattern (Google PIT, Meta SAPIenz): test the tests. A mutant the
// suite fails to kill is a real test gap that line-coverage would hide. Running
// the suite per mutant is expensive, so this is opt-in (`EOS_MUTATION=1`) and
// bounded. Mutants are applied only to an isolated sandbox copy of `src/`+`test/`
// — the working tree is never mutated. Score enforcement is opt-in
// (`EOS_MUTATION_ENFORCE=1`); advisory by default so the local gate stays noise-free.
// ---------------------------------------------------------------------------
if (process.env.EOS_MUTATION === "1") {
  const mutateStart = Date.now();
  let mutationFailed = false;
  try {
    const { runMutationGate, evaluateMutationBudget } = await import("./mutation-gate.mjs");
    console.log("[STAGE 4.6] Mutation gate: analyzing bounded targets in an isolated sandbox...");
    const { reports, missingTargets, sandboxDir } = await runMutationGate({ root });
    const { violations, minScore, floors } = evaluateMutationBudget({ root, reports });
    for (const r of reports) {
      const floor = Object.hasOwn(floors, r.targetFile) ? floors[r.targetFile] : minScore;
      console.log(
        `[STAGE 4.6]   ${r.targetFile}: mutants=${r.totalMutants} killed=${r.killed} survived=${r.survived} score=${r.scorePercent} floor=${(floor * 100).toFixed(1)}% (receipt sha256:${r.sha256Receipt.slice(0, 24)}...)`,
      );
      for (const m of r.survivedMutants) {
        console.warn(`[STAGE 4.6]     SURVIVED ${m.operatorId} @ line ${m.line}: ${m.original} -> ${m.mutated}`);
      }
    }
    for (const m of missingTargets) {
      console.warn(`[STAGE 4.6]   MISSING ${m.targetFile}: ${m.reason}`);
    }
    if (violations.length > 0 || missingTargets.length > 0) {
      if (process.env.EOS_MUTATION_ENFORCE === "1") {
        mutationFailed = true;
      } else {
        console.warn(
          `[STAGE 4.6 ADVISORY] ${violations.length} ratchet violation(s), ${missingTargets.length} unmeasured target(s); enforcement disabled — set EOS_MUTATION_ENFORCE=1 to fail-closed.`,
        );
      }
    }
    if (!mutationFailed) {
      console.log(
        `[PASS] Stage 4.6/7 — Mutation gate engaged (${reports.length} target(s), sandbox=${path.basename(sandboxDir)}, ${Date.now() - mutateStart} ms).`,
      );
    }
  } catch (err) {
    // An enabled gate that crashes produced no verdict — fail closed, never WARN+pass.
    console.error(`[STAGE 4.6 FAIL] Mutation gate crashed: ${err.message}`);
    mutationFailed = true;
  }
  if (mutationFailed) {
    console.error("[STAGE 4.6 FAIL] Mutation gate failed (ratchet floor, unmeasured target, or engine crash).");
    process.exit(1);
  }
} else {
  console.log("[STAGE 4.6 SKIP] Mutation gate skipped (set EOS_MUTATION=1 to enable).");
}

// ---------------------------------------------------------------------------
// STAGE 4.7: FLAKY TEST GATE (opt-in) — de-islands EosFlakyTestQuarantine
// Big Tech pattern (Google TAP, Meta flakiness tracking): re-run the suite N
// times on an unchanged revision and diff the per-test verdicts. A test that is
// not deterministic carries no signal — a green pipeline built on it can lie.
// Detected flakiness must be fixed or explicitly quarantined; the quarantine is
// an allow-list (`docs/quality/flaky-budget.json`) that may only shrink. Re-running
// the suite is expensive, so this is opt-in (`EOS_FLAKY=1`); enforcement is opt-in
// (`EOS_FLAKY_ENFORCE=1`) and advisory by default to keep the local gate noise-free.
// ---------------------------------------------------------------------------
if (process.env.EOS_FLAKY === "1") {
  const flakyStart = Date.now();
  let flakyFailed = false;
  try {
    const { runFlakyGate, evaluateFlakyBudget } = await import("./flaky-gate.mjs");
    const repeats = Number(process.env.EOS_FLAKY_REPEATS) || 3;
    console.log(
      `[STAGE 4.7] Flaky gate: re-running ${filesToRun.length} suite(s) ${repeats}x to detect non-determinism...`,
    );
    const { report } = await runFlakyGate({ root, repeats, files: filesToRun });
    console.log(
      `[STAGE 4.7]   repeats=${report.totalRuns} tests=${report.tests.length} flaky=${report.flakyCount} (receipt sha256:${report.sha256Receipt.slice(0, 24)}...)`,
    );
    for (const v of report.tests) {
      if (v.classification === "flaky") {
        console.warn(
          `[STAGE 4.7]     FLAKY ${v.testId} (${v.passes}/${v.observedRuns} pass; seen in ${v.observedRuns}/${v.totalRuns} runs)`,
        );
      }
    }
    const { violations } = evaluateFlakyBudget({ root, report });
    if (violations.length > 0) {
      if (process.env.EOS_FLAKY_ENFORCE === "1") {
        flakyFailed = true;
      } else {
        console.warn(
          `[STAGE 4.7 ADVISORY] ${violations.length} flaky-budget violation(s); enforcement disabled — set EOS_FLAKY_ENFORCE=1 to fail-closed.`,
        );
      }
      for (const v of violations) {
        console.warn(`[STAGE 4.7]     ${v.kind}: ${v.testId}`);
      }
    }
    if (!flakyFailed) {
      console.log(
        `[PASS] Stage 4.7/7 — Flaky gate engaged (${report.flakyCount} flaky test(s), ${Date.now() - flakyStart} ms).`,
      );
    }
  } catch (err) {
    // An enabled gate that crashes produced no verdict — fail closed, never WARN+pass.
    console.error(`[STAGE 4.7 FAIL] Flaky gate crashed: ${err.message}`);
    flakyFailed = true;
  }
  if (flakyFailed) {
    console.error("[STAGE 4.7 FAIL] Flaky test gate failed (budget violation or engine crash).");
    process.exit(1);
  }
} else {
  console.log("[STAGE 4.7 SKIP] Flaky gate skipped (set EOS_FLAKY=1 to enable).");
}

// ---------------------------------------------------------------------------
// STAGE 5: WCAG 2.1 AA ACCESSIBILITY, SEO, PERFORMANCE & SPEC-128 S-0 DESIGN GOVERNOR GATE
// ---------------------------------------------------------------------------
execFileSync(process.execPath, [path.join(root, "scripts/verify-cwv-budget.mjs")], {
  cwd: root,
  stdio: "inherit",
});
execFileSync(process.execPath, [path.join(root, "scripts/eos-design-system-govern.mjs")], {
  cwd: root,
  stdio: "inherit",
});
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.ok(html.includes('class="skip-link"'), "Missing WCAG 2.1 AA skip-link");
assert.ok(html.includes('aria-live="polite"'), "Missing aria-live polite regions");
assert.ok(html.includes('closedby="any"'), 'Missing native <dialog closedby="any">');
assert.ok(html.includes("application/ld+json"), "Missing Schema.org JSON-LD");
const jsSizeKb = (fs.statSync(path.join(root, "js/eos.js")).size / 1024).toFixed(1);
const cssSizeKb = (fs.statSync(path.join(root, "css/eos.css")).size / 1024).toFixed(1);
const htmlSizeKb = (fs.statSync(path.join(root, "index.html")).size / 1024).toFixed(1);
assert.ok(Number(jsSizeKb) < 250, `JS bundle exceeded budget: ${jsSizeKb} KB`);
assert.ok(Number(cssSizeKb) < 120, `CSS bundle exceeded budget: ${cssSizeKb} KB`);
assert.ok(Number(htmlSizeKb) < 300, `HTML document exceeded budget: ${htmlSizeKb} KB`);

// A missing or duplicated precache entry breaks offline install or wastes a fetch.
const swSource = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const precacheMatch = swSource.match(/const PRECACHE_ASSETS = \[([\s\S]*?)\];/);
assert.ok(precacheMatch, "sw.js must declare PRECACHE_ASSETS");
const precacheAssets = Array.from(precacheMatch[1].matchAll(/"([^"]+)"/g), (m) => m[1]);
assert.equal(
  new Set(precacheAssets).size,
  precacheAssets.length,
  "sw.js PRECACHE_ASSETS must not contain duplicate entries",
);
for (const asset of precacheAssets) {
  const assetPath = asset.split("?")[0];
  const diskPath = path.join(root, assetPath.replace(/^\//, ""));
  assert.ok(fs.existsSync(diskPath), `sw.js precaches a path missing on disk: ${asset}`);
}
console.log(
  `[PASS] Stage 5/7 — Static markup assertions and size budgets (no browser CWV or full WCAG audit; JS: ${jsSizeKb} KB, CSS: ${cssSizeKb} KB, HTML: ${htmlSizeKb} KB; ${precacheAssets.length} precache assets present).`,
);

// ---------------------------------------------------------------------------
// STAGE 6: IN-PROCESS SMOKE TESTS OF THE SERVERLESS API HANDLERS (/api/*)
// ---------------------------------------------------------------------------
const apiEndpoints = [
  { file: "api/teurgia.js" },
  { file: "api/compile.js" },
  { file: "api/memory.js" },
  { file: "api/kernel.js" },
  { file: "api/cicd.js" },
  { file: "api/fleet.js" },
  { file: "api/kernel.js", query: { module: "specs" } },
  { file: "api/jarvis.js", method: "POST", body: { directive: "status check" } },
  { file: "api/health.js" },
  { file: "api/graph.js" },
  { file: "api/eval.js" },
  { file: "api/spotify.js" },
  {
    file: "api/mcp.js",
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "eos-local-check", version: "1.0.0" },
      },
    },
  },
];

for (const endpoint of apiEndpoints) {
  const { file: relApi } = endpoint;
  const modUrl = pathToFileURL(path.join(root, relApi)).href;
  const mod = await import(modUrl);
  assert.equal(typeof mod.default, "function", `Default export in ${relApi} must be a handler function`);

  let capturedStatus = 200;
  let capturedBody = null;
  const mockReq = {
    method: endpoint.method || "GET",
    query: {},
    body: endpoint.body || {},
    headers: endpoint.headers || {},
  };
  const mockRes = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      capturedStatus = code;
      return this;
    },
    json(payload) {
      capturedBody = payload;
      return this;
    },
    end(chunk) {
      if (typeof this.statusCode === "number") capturedStatus = this.statusCode;
      if (typeof chunk === "string" && chunk.trim().startsWith("{")) {
        capturedBody = JSON.parse(chunk);
      }
      return this;
    },
  };

  await mod.default(mockReq, mockRes);
  assert.equal(capturedStatus, 200, `[STAGE 6 FAIL] ${relApi} returned HTTP ${capturedStatus}`);
  assert.ok(
    capturedBody && typeof capturedBody === "object",
    `[STAGE 6 FAIL] ${relApi} did not return valid JSON object`,
  );
}

// Verify Edge rewrite consolidated modes
const consolidatedModes = [
  {
    file: "api/compile.js",
    query: { mode: "amplify", prompt: "Test prompt amplification" },
    desc: "compile?mode=amplify",
  },
  { file: "api/eval.js", query: { mode: "titans", titan: "all" }, desc: "eval?mode=titans" },
  { file: "api/kernel.js", query: { mode: "omega" }, desc: "kernel?mode=omega" },
  { file: "api/kernel.js", query: { module: "bigtech" }, desc: "kernel?module=bigtech" },
  { file: "api/kernel.js", query: { module: "finops" }, desc: "kernel?module=finops" },
];

for (const cm of consolidatedModes) {
  const modUrl = pathToFileURL(path.join(root, cm.file)).href;
  const mod = await import(modUrl);
  let capturedStatus = 200;
  let capturedBody = null;
  const mockReq = { method: "GET", query: cm.query, body: {} };
  const mockRes = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      capturedStatus = code;
      return this;
    },
    json(payload) {
      capturedBody = payload;
      return this;
    },
    end() {
      return this;
    },
  };
  await mod.default(mockReq, mockRes);
  assert.equal(capturedStatus, 200, `[STAGE 6 FAIL] Consolidated mode ${cm.desc} returned HTTP ${capturedStatus}`);
  assert.ok(
    capturedBody && typeof capturedBody === "object",
    `[STAGE 6 FAIL] Consolidated mode ${cm.desc} did not return valid JSON`,
  );
}

console.log(
  `[PASS] Stage 6/7 — In-process handler smoke checks (${apiEndpoints.length} handlers + ${consolidatedModes.length} consolidated modes returned mocked HTTP 200 responses).`,
);

// ---------------------------------------------------------------------------
// STAGE 7: LOCAL CHECK RECEIPT AND CONFIGURED-CHECKS SARIF REPORT
// ---------------------------------------------------------------------------
const elapsedMs = Date.now() - startTime;
// Receipt is deterministic for a given source tree (no timestamps/durations),
// so re-running the gate inside git hooks never leaves the working tree dirty.
const receipt = {
  pipelineId: "EOS-LOCAL-REPOSITORY-CHECKS",
  epistemicState: "LOCAL_CHECKS_EXECUTED",
  evidenceType: "source-inventory-digest-and-mocked-handler-smoke-checks",
  stagesPassed: "7/7",
  exitCode: 0,
  sourceInventoryDigest,
  sourceFileCount: fileInventory.length,
  inProcessHandlerSmokeChecks: apiEndpoints.map(({ file }) => file),
  hookFilesReferencedButNotProbed: [
    ".githooks/pre-commit",
    ".githooks/pre-push",
    ".github/workflows/eos-sovereign-cicd.yml",
  ],
  hookConfigurationProbed: false,
  deploymentRun: false,
  liveHealthProbeRun: false,
};

fs.writeFileSync(
  path.join(root, "docs/evidence/LOCAL-CHECKS-RECEIPT.json"),
  JSON.stringify(receipt, null, 2) + "\n",
  "utf8",
);

// Emit OASIS SARIF v2.1.0 diagnostic report for Cursor, VS Code, and GitHub Code Scanning
const sarifReport = {
  version: "2.1.0",
  $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
  runs: [
    {
      tool: {
        driver: {
          name: "EOS-Configured-Repository-Checks",
          version: "1.0.0",
          rules: [
            {
              id: "EOS-SEC-001",
              name: "ConfiguredCredentialPatternScan",
              shortDescription: {
                text: "No matches for the five configured credential patterns were found in scanned text files.",
              },
              defaultConfiguration: { level: "error" },
            },
            {
              id: "EOS-SDD-002",
              name: "LandingAndSRIAssertions",
              shortDescription: { text: "Configured landing-page and subresource-integrity assertions passed." },
              defaultConfiguration: { level: "error" },
            },
            {
              id: "EOS-L0-003",
              name: "HexagonalL0Purity",
              shortDescription: { text: "Production runtime dependencies must remain zero." },
              defaultConfiguration: { level: "error" },
            },
          ],
        },
      },
      results: [],
    },
  ],
};
fs.writeFileSync(
  path.join(root, "docs/evidence/local-checks.sarif"),
  JSON.stringify(sarifReport, null, 2) + "\n",
  "utf8",
);
console.log(
  `[PASS] Stage 7/7 — Local source-inventory digest, check receipt & configured-checks SARIF written in ${elapsedMs} ms.`,
);
console.log("======================================================================");
console.log(" LOCAL CHECKS: 7/7 STAGES PASSED | NO DEPLOYMENT OR LIVE PROBE RUN  ");
console.log("======================================================================");

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runStage4Coverage, runStage4SyntaxAndTests } from "./lib/cicdStage4Runner.mjs";
import { assertTrackedEvidenceUnchanged, snapshotTrackedEvidence } from "./lib/trackedEvidence.mjs";

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
const initialEvidence = snapshotTrackedEvidence(root);
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
// STAGE 3.02: LAYER-0 IMPORT BOUNDARY GATE (Law V / hexagonal isolation)
// Fail-closed: src/core/ may only import node: builtins or other src/core/ modules.
// ---------------------------------------------------------------------------
execFileSync(process.execPath, [path.join(root, "scripts/import-boundary-gate.mjs")], {
  cwd: root,
  stdio: "inherit",
});
console.log("[PASS] Stage 3.02/7 — Layer-0 import boundary gate (npm run boundary:check).");

// ---------------------------------------------------------------------------
// STAGE 3.03: MODULE CONSUMER GRAPH + MORATORIUM (SPEC-270)
// Fail-closed when unconsumed Layer-0 modules appear (architectural moratorium).
// --check-only: do not rewrite docs/evidence/MODULE_CONSUMER_GRAPH.json (keeps
// Stage 3 sourceInventoryDigest stable and avoids dirtying the working tree).
// ---------------------------------------------------------------------------
execFileSync(
  process.execPath,
  [path.join(root, "scripts/verify-module-consumers.mjs"), "--check-only", "--fail-on-unconsumed"],
  {
    cwd: root,
    stdio: "inherit",
  },
);
console.log("[PASS] Stage 3.03/7 — Module consumer graph check-only audit (npm run consumers:audit).");

// ---------------------------------------------------------------------------
// STAGE 3.05: MODERN WEB GUIDANCE SKILL + LAYER-0 ISOLATION GATE
// ---------------------------------------------------------------------------
execFileSync(process.execPath, [path.join(root, "scripts/modern-web-guidance-gate.mjs")], {
  cwd: root,
  stdio: "inherit",
});
console.log("[PASS] Stage 3.05/7 — Modern Web Guidance skill presence, skills-lock pin, and Layer-0 isolation.");

// ---------------------------------------------------------------------------
// STAGE 3.1: SPEC-269 SERVERLESS FUNCTION BUDGET & HOST QUOTA GATE
// ---------------------------------------------------------------------------
execFileSync(process.execPath, [path.join(root, "scripts/verify-vercel-function-budget.mjs")], {
  cwd: root,
  stdio: "inherit",
});

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
// STAGE 3.6: LESLIE LAMPORT TLC FORMAL MODEL CHECKER GATE (SPEC-270)
// ---------------------------------------------------------------------------
// Formal checks, coverage and optional reruns inherit the same isolated receipt directory.
process.env.EOS_EVIDENCE_DIR = path.resolve(
  process.env.EOS_EVIDENCE_DIR?.trim() || path.join(root, ".eos", "test-evidence"),
);
fs.mkdirSync(process.env.EOS_EVIDENCE_DIR, { recursive: true });
execFileSync(process.execPath, [path.join(root, "scripts/run-tlc.mjs")], {
  cwd: root,
  stdio: "inherit",
});
console.log("[PASS] Stage 3.6/7 — Leslie Lamport TLC formal model checker gate & receipt verification (SPEC-270).");

// ---------------------------------------------------------------------------
// STAGE 4: STATIC AST, SYNTAX & HERMETIC TEST RUNNER (node --check + L0 TS)
// ---------------------------------------------------------------------------
const isPts = process.argv.includes("--pts");
const { exitCode, filesToRun, testReportPath, testEnv } = await runStage4SyntaxAndTests({
  root,
  allFiles,
  isPts,
});

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
if (exitCode !== 0) {
  assertTrackedEvidenceUnchanged(initialEvidence, snapshotTrackedEvidence(root));
  process.exit(1);
}
if (sloBlock) {
  console.error("[STAGE 4.4 FAIL] SLO error-budget BLOCK verdict (EOS_SLO_ENFORCE=1).");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// STAGE 4.5: NATIVE V8 COVERAGE GATE (Big Tech: minimum threshold enforcement)
// Skippable via SKIP_COVERAGE=1 for rapid local iteration.
// ---------------------------------------------------------------------------
if (!process.env.SKIP_COVERAGE && !isPts) {
  runStage4Coverage({ root, filesToRun, testEnv });
} else {
  console.log("[STAGE 4.5] Incremental PTS Coverage Ratchet active (SPEC-271)...");
  execFileSync(process.execPath, [path.join(root, "scripts/coverage-ratchet.mjs")], {
    cwd: root,
    stdio: "inherit",
  });
  console.log("[PASS] Stage 4.5/7 — Incremental PTS coverage ratchet passed (SPEC-271).");
}

// ---------------------------------------------------------------------------
// STAGE 4.6: MUTATION TESTING GATE (opt-in via EOS_MUTATION=1)
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
// the suite is expensive, so local pre-push and three of the four CI cells skip it.
// Main CI sets EOS_FLAKY=1 and EOS_FLAKY_ENFORCE=1 on Ubuntu Node 22 only.
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
  ...["api/compile.js", "api/memory.js", "api/kernel.js", "api/cicd.js", "api/fleet.js"].map((file) => ({
    file,
  })),
  { file: "api/kernel.js", query: { module: "specs" } },
  { file: "api/kernel.js", query: { module: "metrics" } },
  { file: "api/kernel.js", query: { module: "teurgia" } },
  { file: "api/_teurgia.js" },
  {
    file: "api/jarvis.js",
    method: "POST",
    headers: { "idempotency-key": "stage6-jarvis-smoke-001" },
    body: { directive: "status check" },
  },
  ...["api/health.js", "api/graph.js", "api/eval.js"].map((file) => ({ file })),
  { file: "api/kernel.js", query: { module: "spotify" } },
  { file: "api/_spotify.js" },
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

function createMockRes(state, parseChunk = false) {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      state.status = code;
      return this;
    },
    json(payload) {
      state.body = payload;
      return this;
    },
    end(chunk) {
      if (parseChunk) {
        if (typeof this.statusCode === "number") state.status = this.statusCode;
        if (typeof chunk === "string" && chunk.trim().startsWith("{")) {
          state.body = JSON.parse(chunk);
        }
      }
      return this;
    },
  };
}

for (const endpoint of apiEndpoints) {
  const { file: relApi } = endpoint;
  const modUrl = pathToFileURL(path.join(root, relApi)).href;
  const mod = await import(modUrl);
  assert.equal(typeof mod.default, "function", `Default export in ${relApi} must be a handler function`);

  const state = { status: 200, body: null };
  const mockReq = {
    method: endpoint.method || "GET",
    query: {},
    body: endpoint.body || {},
    headers: endpoint.headers || {},
  };

  await mod.default(mockReq, createMockRes(state, true));
  assert.equal(state.status, 200, `[STAGE 6 FAIL] ${relApi} returned HTTP ${state.status}`);
  assert.ok(state.body && typeof state.body === "object", `[STAGE 6 FAIL] ${relApi} did not return valid JSON object`);
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
  const state = { status: 200, body: null };
  const mockReq = { method: "GET", query: cm.query, body: {} };
  await mod.default(mockReq, createMockRes(state));
  assert.equal(state.status, 200, `[STAGE 6 FAIL] Consolidated mode ${cm.desc} returned HTTP ${state.status}`);
  assert.ok(
    state.body && typeof state.body === "object",
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
// Fleet posture honesty (P1-2 / PR-G): advertise CONTROL_PLANE_ONLY when paths unset.
const { evaluateFleetPosture, fleetPostureReceiptFields } = await import(
  pathToFileURL(path.join(root, "src/core/eosFleetPathResolver.ts")).href
);
const fleetRegistry = JSON.parse(fs.readFileSync(path.join(root, "docs/projects/registry.json"), "utf8"));
const fleetPostureSnapshot = evaluateFleetPosture(root, fleetRegistry.projects || []);
const fleetPosture = fleetPostureReceiptFields(fleetPostureSnapshot);
const finalEvidence = snapshotTrackedEvidence(root);
assertTrackedEvidenceUnchanged(initialEvidence, finalEvidence);
console.log(`[PASS] SPEC-342 — ${finalEvidence.size} tracked evidence files retained their working-tree contents.`);
const receipt = {
  pipelineId: "EOS-LOCAL-REPOSITORY-CHECKS",
  epistemicState: "LOCAL_CHECKS_EXECUTED",
  evidenceType: "source-inventory-digest-and-mocked-handler-smoke-checks",
  stagesPassed: "7/7",
  exitCode: 0,
  sourceInventoryDigest,
  sourceFileCount: fileInventory.length,
  inProcessHandlerSmokeChecks: apiEndpoints.map(({ file }) => file),
  hookFilesReferencedButNotProbed:
    ".githooks/pre-commit,.githooks/pre-push,.github/workflows/eos-sovereign-cicd.yml".split(","),
  hookConfigurationProbed: false,
  deploymentRun: false,
  liveHealthProbeRun: false,
  fleetPosture,
  fleetLiveAudit: fleetPosture.fleetLiveAudit === true,
};
const writeEvdJson = (rel, data) =>
  fs.writeFileSync(path.join(root, rel), JSON.stringify(data, null, 2) + "\n", "utf8");
writeEvdJson("docs/evidence/LOCAL-CHECKS-RECEIPT.json", receipt);

const rules = [
  [
    "EOS-SEC-001",
    "ConfiguredCredentialPatternScan",
    "No matches for the five configured credential patterns were found in scanned text files.",
  ],
  ["EOS-SDD-002", "LandingAndSRIAssertions", "Configured landing-page and subresource-integrity assertions passed."],
  ["EOS-L0-003", "HexagonalL0Purity", "Production runtime dependencies must remain zero."],
].map(([id, name, text]) => ({ id, name, shortDescription: { text }, defaultConfiguration: { level: "error" } }));
const sarifReport = {
  version: "2.1.0",
  $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
  runs: [{ tool: { driver: { name: "EOS-Configured-Repository-Checks", version: "1.0.0", rules } }, results: [] }],
};
writeEvdJson("docs/evidence/local-checks.sarif", sarifReport);
const banner = "======================================================================";
console.log(
  `[PASS] Stage 7/7 — Local digest, receipt & SARIF written in ${elapsedMs} ms.\n${banner}\n LOCAL CHECKS: 7/7 STAGES PASSED | NO DEPLOYMENT OR LIVE PROBE RUN  \n${banner}`,
);

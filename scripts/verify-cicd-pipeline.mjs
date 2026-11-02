import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

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
  assert.ok(stat.isFile() && !stat.isSymbolicLink(), `[STAGE 1 FAIL] Refusing a non-regular or symbolic-link file: ${path.relative(root, file)}`);
  assert.ok(stat.size <= MAX_SINGLE_REPO_FILE_BYTES, `[STAGE 1 FAIL] File exceeds the 64 MiB limit: ${path.relative(root, file)}`);
  inventoryBytes += stat.size;
  assert.ok(inventoryBytes <= MAX_REPO_INVENTORY_BYTES, "[STAGE 1 FAIL] Repository scan exceeds its 512 MiB inventory limit.");
}

// ---------------------------------------------------------------------------
// STAGE 1: SPEC-123 & SPEC-124 FLEET SECRET-SCAN & DYNAMIC REGISTRY GATE
// ---------------------------------------------------------------------------
execFileSync(process.execPath, [path.join(root, "scripts/eos-secret-scan.mjs"), "."], {
  cwd: root,
  stdio: "inherit"
});
execFileSync(process.execPath, [path.join(root, "scripts/eos-fleet-registry-sync.mjs"), "--dry-run"], {
  cwd: root,
  stdio: "inherit"
});
console.log(`[PASS] Stage 1/7 — SPEC-123 Canonical Zero-Plain-Secrets & SPEC-124 Fleet Registry Sentinel (exit code 0).`);

// ---------------------------------------------------------------------------
// STAGE 2: CONSTITUTIONAL SDD & 7 INVIOLABLE LAWS GATE (LAWS I, II, VII)
// ---------------------------------------------------------------------------
execFileSync(process.execPath, [path.join(root, "scripts/verify-landing.mjs")], {
  cwd: root,
  stdio: "inherit"
});
execFileSync(process.execPath, [path.join(root, "scripts/verify-sri-integrity.mjs")], {
  cwd: root,
  stdio: "inherit"
});
console.log("[PASS] Stage 2/7 — Landing-page assertions and SRI integrity check.");

// ---------------------------------------------------------------------------
// STAGE 3: runtime dependency check and a digest of the source-file inventory
// ---------------------------------------------------------------------------
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const runtimeDeps = Object.keys(pkg.dependencies || {});
assert.equal(
  runtimeDeps.length,
  0,
  `[STAGE 3 FAIL] Law V violation: Expected 0 external runtime dependencies, found: ${runtimeDeps.join(", ")}`
);

const fileInventory = [];
const inventoryHasher = crypto.createHash("sha256");
for (const file of allFiles.sort()) {
  if (!fs.existsSync(file)) continue;
  const rel = path.relative(root, file).replace(/\\/g, "/");
  if (rel === "docs/evidence/LOCAL-CHECKS-RECEIPT.json" || rel === "docs/evidence/local-checks.sarif" || /^docs\/evidence\/HEAL-.*\.json$/.test(rel)) continue;
  const bytes = fs.readFileSync(file);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  fileInventory.push({ path: rel, bytes: bytes.length, sha256 });
  inventoryHasher.update(`${rel}:${sha256}\n`);
}
const sourceInventoryDigest = `sha256:${inventoryHasher.digest("hex")}`;
console.log(`[PASS] Stage 3/7 — Runtime dependency check and source-file inventory (${fileInventory.length} files; SHA-256 digest: ${sourceInventoryDigest.slice(0, 24)}...).`);

// ---------------------------------------------------------------------------
// STAGE 3.5: BOUNDED JAVASCRIPT SIMULATIONS ASSOCIATED WITH TLA+ FILES
// ---------------------------------------------------------------------------
execFileSync(process.execPath, [path.join(root, "scripts/verify-formal-tla.mjs")], {
  cwd: root,
  stdio: "inherit"
});
console.log("[PASS] Stage 3.5/7 — Bounded JavaScript simulations and text extraction from TLA+ files (not TLC model checking).");

// ---------------------------------------------------------------------------
// STAGE 4: STATIC AST, SYNTAX & BYTECODE VERIFICATION (node --check + L0 TS)
// ---------------------------------------------------------------------------
const jsFilesToCheck = allFiles.filter((f) => f.endsWith(".js") || f.endsWith(".mjs"));
for (const jsFile of jsFilesToCheck) {
  execFileSync(process.execPath, ["--check", jsFile], { cwd: root, stdio: "pipe" });
}
const typeScriptCompiler = path.join(root, "node_modules", "typescript", "bin", "tsc");
assert.ok(fs.existsSync(typeScriptCompiler), "TypeScript compiler is missing; install the locked dev toolchain with npm ci.");
execFileSync(process.execPath, [typeScriptCompiler, "--project", path.join(root, "tsconfig.typecheck.json")], {
  cwd: root,
  stdio: "inherit"
});
const tsCoreFiles = fs.readdirSync(path.join(root, "src/core")).filter((f) => f.endsWith(".ts"));
assert.ok(tsCoreFiles.length >= 6, "Expected at least 6 Layer-0 TypeScript core modules in src/core/");

// Execute formal native unit test suite, chaos resilience suite, and prometheus omni-model suite (node:test)
const testFiles = fs.readdirSync(path.join(root, "test"))
  .filter((file) => file.endsWith(".test.mjs"))
  .map((file) => `test/${file}`)
  .sort();
assert.ok(testFiles.length > 0, "No Node test suites were found under test/.");

const isPts = process.argv.includes("--pts");
let filesToRun = testFiles;

if (isPts) {
  try {
    const gitDiff = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
    const changed = gitDiff
      .split("\n")
      .map((l) => l.trim().slice(3).trim())
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
        console.log(`[STAGE 4 PTS] Datalog Smart Selection activated: ${filesToRun.length} of ${testFiles.length} suites selected.`);
      }
    }
  } catch {
    filesToRun = testFiles;
  }
}

for (const testFile of filesToRun) {
  console.log(`[STAGE 4 RUNNER] Executing ${testFile}...`);
  execFileSync(process.execPath, ["--test", path.join(root, testFile)], {
    cwd: root,
    stdio: "inherit"
  });
}
console.log(`[PASS] Stage 4/7 — JavaScript syntax, TypeScript type-check, and all discovered Node test suites (${jsFilesToCheck.length} JS/MJS modules; ${tsCoreFiles.length} core TS modules; ${testFiles.length} suites).`);

// ---------------------------------------------------------------------------
// STAGE 5: WCAG 2.1 AA ACCESSIBILITY, SEO, PERFORMANCE & SPEC-128 S-0 DESIGN GOVERNOR GATE
// ---------------------------------------------------------------------------
execFileSync(process.execPath, [path.join(root, "scripts/verify-cwv-budget.mjs")], {
  cwd: root,
  stdio: "inherit"
});
execFileSync(process.execPath, [path.join(root, "scripts/eos-design-system-govern.mjs")], {
  cwd: root,
  stdio: "inherit"
});
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.ok(html.includes('class="skip-link"'), "Missing WCAG 2.1 AA skip-link");
assert.ok(html.includes('aria-live="polite"'), "Missing aria-live polite regions");
assert.ok(html.includes('closedby="any"'), "Missing native <dialog closedby=\"any\">");
assert.ok(html.includes('application/ld+json'), "Missing Schema.org JSON-LD");
const jsSizeKb = (fs.statSync(path.join(root, "js/eos.js")).size / 1024).toFixed(1);
const cssSizeKb = (fs.statSync(path.join(root, "css/eos.css")).size / 1024).toFixed(1);
assert.ok(Number(jsSizeKb) < 250, `JS bundle exceeded budget: ${jsSizeKb} KB`);
assert.ok(Number(cssSizeKb) < 120, `CSS bundle exceeded budget: ${cssSizeKb} KB`);
console.log(`[PASS] Stage 5/7 — Static markup assertions and bundle-size checks (no browser CWV or full WCAG audit; JS: ${jsSizeKb} KB, CSS: ${cssSizeKb} KB).`);

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
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "eos-local-check", version: "1.0.0" } }
    }
  }
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
    headers: endpoint.headers || {}
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
    }
  };

  await mod.default(mockReq, mockRes);
  assert.equal(capturedStatus, 200, `[STAGE 6 FAIL] ${relApi} returned HTTP ${capturedStatus}`);
  assert.ok(capturedBody && typeof capturedBody === "object", `[STAGE 6 FAIL] ${relApi} did not return valid JSON object`);
}

// Verify Edge rewrite consolidated modes
const consolidatedModes = [
  { file: "api/compile.js", query: { mode: "amplify", prompt: "Test prompt amplification" }, desc: "compile?mode=amplify" },
  { file: "api/eval.js", query: { mode: "titans", titan: "all" }, desc: "eval?mode=titans" },
  { file: "api/kernel.js", query: { mode: "omega" }, desc: "kernel?mode=omega" },
  { file: "api/kernel.js", query: { module: "bigtech" }, desc: "kernel?module=bigtech" }
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
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; capturedStatus = code; return this; },
    json(payload) { capturedBody = payload; return this; },
    end() { return this; }
  };
  await mod.default(mockReq, mockRes);
  assert.equal(capturedStatus, 200, `[STAGE 6 FAIL] Consolidated mode ${cm.desc} returned HTTP ${capturedStatus}`);
  assert.ok(capturedBody && typeof capturedBody === "object", `[STAGE 6 FAIL] Consolidated mode ${cm.desc} did not return valid JSON`);
}

console.log(`[PASS] Stage 6/7 — In-process handler smoke checks (${apiEndpoints.length} handlers + ${consolidatedModes.length} consolidated modes returned mocked HTTP 200 responses).`);

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
  hookFilesReferencedButNotProbed: [".githooks/pre-commit", ".githooks/pre-push", ".github/workflows/eos-sovereign-cicd.yml"],
  hookConfigurationProbed: false,
  deploymentRun: false,
  liveHealthProbeRun: false
};

fs.writeFileSync(path.join(root, "docs/evidence/LOCAL-CHECKS-RECEIPT.json"), JSON.stringify(receipt, null, 2) + "\n", "utf8");

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
              shortDescription: { text: "No matches for the five configured credential patterns were found in scanned text files." },
              defaultConfiguration: { level: "error" }
            },
            {
              id: "EOS-SDD-002",
              name: "LandingAndSRIAssertions",
              shortDescription: { text: "Configured landing-page and subresource-integrity assertions passed." },
              defaultConfiguration: { level: "error" }
            },
            {
              id: "EOS-L0-003",
              name: "HexagonalL0Purity",
              shortDescription: { text: "Production runtime dependencies must remain zero." },
              defaultConfiguration: { level: "error" }
            }
          ]
        }
      },
      results: []
    }
  ]
};
fs.writeFileSync(path.join(root, "docs/evidence/local-checks.sarif"), JSON.stringify(sarifReport, null, 2) + "\n", "utf8");
console.log(`[PASS] Stage 7/7 — Local source-inventory digest, check receipt & configured-checks SARIF written in ${elapsedMs} ms.`);
console.log("======================================================================");
console.log(" LOCAL CHECKS: 7/7 STAGES PASSED | NO DEPLOYMENT OR LIVE PROBE RUN  ");
console.log("======================================================================");

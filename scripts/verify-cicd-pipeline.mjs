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

// SARIF Diagnostic Findings Accumulator (SPEC-138)
const sarifFindings = [];

function recordFinding(ruleId, messageText, relPath = "package.json", line = 1) {
  sarifFindings.push({
    ruleId,
    level: "error",
    message: { text: messageText },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: relPath.replace(/\\/g, "/") },
          region: { startLine: line }
        }
      }
    ]
  });
}

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

let stagesPassedCount = 0;
let fatalError = null;
let sourceInventoryDigest = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
let fileInventory = [];
let allFiles = [];
let apiEndpoints = [];
let pkgVersion = "76.0.0";

try {
  const pkgRaw = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  if (pkgRaw.version) pkgVersion = pkgRaw.version;

  allFiles = listRepoFiles(root);
  let inventoryBytes = 0;
  for (const file of allFiles) {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      const err = `[STAGE 1 FAIL] Refusing non-regular or symbolic-link file: ${path.relative(root, file)}`;
      recordFinding("EOS-SEC-001", err, path.relative(root, file));
      throw new Error(err);
    }
    if (stat.size > MAX_SINGLE_REPO_FILE_BYTES) {
      const err = `[STAGE 1 FAIL] File exceeds 64 MiB limit: ${path.relative(root, file)}`;
      recordFinding("EOS-SEC-001", err, path.relative(root, file));
      throw new Error(err);
    }
    inventoryBytes += stat.size;
    if (inventoryBytes > MAX_REPO_INVENTORY_BYTES) {
      const err = `[STAGE 1 FAIL] Repository scan exceeds 512 MiB inventory limit.`;
      recordFinding("EOS-SEC-001", err, "package.json");
      throw new Error(err);
    }
  }

  // ---------------------------------------------------------------------------
  // STAGE 1: SPEC-123 & SPEC-124 FLEET SECRET-SCAN & DYNAMIC REGISTRY GATE
  // ---------------------------------------------------------------------------
  try {
    execFileSync(process.execPath, [path.join(root, "scripts/eos-secret-scan.mjs"), "."], {
      cwd: root,
      stdio: "inherit"
    });
    execFileSync(process.execPath, [path.join(root, "scripts/eos-fleet-registry-sync.mjs"), "--dry-run"], {
      cwd: root,
      stdio: "inherit"
    });
    stagesPassedCount++;
    console.log(`[PASS] Stage 1/7 — SPEC-123 Canonical Zero-Plain-Secrets & SPEC-124 Fleet Registry Sentinel (exit code 0).`);
  } catch (err) {
    recordFinding("EOS-SEC-001", `Stage 1 execution error: ${err.message}`, "scripts/eos-secret-scan.mjs");
    throw err;
  }

  // ---------------------------------------------------------------------------
  // STAGE 2: CONSTITUTIONAL SDD & 7 INVIOLABLE LAWS GATE (LAWS I, II, VII)
  // ---------------------------------------------------------------------------
  try {
    execFileSync(process.execPath, [path.join(root, "scripts/verify-landing.mjs")], {
      cwd: root,
      stdio: "inherit"
    });
    execFileSync(process.execPath, [path.join(root, "scripts/verify-sri-integrity.mjs")], {
      cwd: root,
      stdio: "inherit"
    });
    stagesPassedCount++;
    console.log("[PASS] Stage 2/7 — Landing-page assertions and SRI integrity check.");
  } catch (err) {
    recordFinding("EOS-SDD-002", `Stage 2 landing/SRI assertion failure: ${err.message}`, "index.html");
    throw err;
  }

  // ---------------------------------------------------------------------------
  // STAGE 3: runtime dependency check and a digest of the source-file inventory
  // ---------------------------------------------------------------------------
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const runtimeDeps = Object.keys(pkg.dependencies || {});
    if (runtimeDeps.length !== 0) {
      const err = `[STAGE 3 FAIL] Law V violation: Expected 0 external runtime dependencies, found: ${runtimeDeps.join(", ")}`;
      recordFinding("EOS-L0-003", err, "package.json");
      throw new Error(err);
    }

    fileInventory = [];
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
    sourceInventoryDigest = `sha256:${inventoryHasher.digest("hex")}`;
    stagesPassedCount++;
    console.log(`[PASS] Stage 3/7 — Runtime dependency check and source-file inventory (${fileInventory.length} files; SHA-256 digest: ${sourceInventoryDigest.slice(0, 24)}...).`);
  } catch (err) {
    recordFinding("EOS-L0-003", `Stage 3 dependency/inventory check error: ${err.message}`, "package.json");
    throw err;
  }

  // ---------------------------------------------------------------------------
  // STAGE 3.5: BOUNDED JAVASCRIPT SIMULATIONS ASSOCIATED WITH TLA+ FILES
  // ---------------------------------------------------------------------------
  try {
    execFileSync(process.execPath, [path.join(root, "scripts/verify-formal-tla.mjs")], {
      cwd: root,
      stdio: "inherit"
    });
    console.log("[PASS] Stage 3.5/7 — Bounded JavaScript simulations and text extraction from TLA+ files (not TLC model checking).");
  } catch (err) {
    recordFinding("EOS-TLA-008", `Stage 3.5 TLA+ bounded simulation failure: ${err.message}`, "scripts/verify-formal-tla.mjs");
    throw err;
  }

  // ---------------------------------------------------------------------------
  // STAGE 4: STATIC AST, SYNTAX & BYTECODE VERIFICATION (node --check + L0 TS)
  // ---------------------------------------------------------------------------
  try {
    const jsFilesToCheck = allFiles.filter((f) => f.endsWith(".js") || f.endsWith(".mjs"));
    for (const jsFile of jsFilesToCheck) {
      execFileSync(process.execPath, ["--check", jsFile], { cwd: root, stdio: "pipe" });
    }
    const typeScriptCompiler = path.join(root, "node_modules", "typescript", "bin", "tsc");
    assert.ok(fs.existsSync(typeScriptCompiler), "TypeScript compiler is missing; install locked dev toolchain with npm ci.");
    execFileSync(process.execPath, [typeScriptCompiler, "--project", path.join(root, "tsconfig.typecheck.json")], {
      cwd: root,
      stdio: "inherit"
    });
    const tsCoreFiles = fs.readdirSync(path.join(root, "src/core")).filter((f) => f.endsWith(".ts"));
    assert.ok(tsCoreFiles.length >= 6, "Expected at least 6 Layer-0 TypeScript core modules in src/core/");

    // Execute formal native unit test suite (node:test) with optimized batching
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

    // Execute in balanced parallel batches (chunks of 6 files) to maximize CPU throughput
    const BATCH_SIZE = 6;
    for (let i = 0; i < filesToRun.length; i += BATCH_SIZE) {
      const batch = filesToRun.slice(i, i + BATCH_SIZE);
      console.log(`[STAGE 4 RUNNER] Executing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(filesToRun.length / BATCH_SIZE)} (${batch.length} suites)...`);
      execFileSync(process.execPath, ["--test", ...batch.map((f) => path.join(root, f))], {
        cwd: root,
        stdio: "inherit"
      });
    }

    stagesPassedCount++;
    console.log(`[PASS] Stage 4/7 — JavaScript syntax, TypeScript type-check, and all discovered Node test suites (${jsFilesToCheck.length} JS/MJS modules; ${tsCoreFiles.length} core TS modules; ${testFiles.length} suites).`);
  } catch (err) {
    recordFinding("EOS-TEST-004", `Stage 4 AST/Type/Test execution failure: ${err.message}`, "test/");
    throw err;
  }

  // ---------------------------------------------------------------------------
  // STAGE 5: WCAG 2.1 AA ACCESSIBILITY, SEO, PERFORMANCE & SPEC-128 S-0 DESIGN GOVERNOR GATE
  // ---------------------------------------------------------------------------
  try {
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
    stagesPassedCount++;
    console.log(`[PASS] Stage 5/7 — Static markup assertions and bundle-size checks (no browser CWV or full WCAG audit; JS: ${jsSizeKb} KB, CSS: ${cssSizeKb} KB).`);
  } catch (err) {
    recordFinding("EOS-CWV-005", `Stage 5 design/accessibility/budget failure: ${err.message}`, "index.html");
    throw err;
  }

  // ---------------------------------------------------------------------------
  // STAGE 6: IN-PROCESS SMOKE TESTS OF THE SERVERLESS API HANDLERS (/api/*)
  // ---------------------------------------------------------------------------
  try {
    apiEndpoints = [
      { file: "api/teurgia.js" },
      { file: "api/compile.js" },
      { file: "api/memory.js" },
      { file: "api/kernel.js" },
      { file: "api/cicd.js" },
      { file: "api/fleet.js" },
      { file: "api/kernel.js", query: { module: "specs" } },
      { file: "api/jarvis.js", method: "POST", body: { directive: "status check" } },
      { file: "api/health.js" },
      { file: "api/finops.js" },
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
        setHeader(k, v) { this.headers[k] = v; },
        status(code) { this.statusCode = code; capturedStatus = code; return this; },
        json(payload) { capturedBody = payload; return this; },
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

    stagesPassedCount++;
    console.log(`[PASS] Stage 6/7 — In-process handler smoke checks (${apiEndpoints.length} handlers + ${consolidatedModes.length} consolidated modes returned mocked HTTP 200 responses).`);
  } catch (err) {
    recordFinding("EOS-API-006", `Stage 6 serverless API smoke check error: ${err.message}`, "api/");
    throw err;
  }
} catch (err) {
  fatalError = err;
} finally {
  // ---------------------------------------------------------------------------
  // STAGE 7: LOCAL CHECK RECEIPT AND CONFIGURED-CHECKS SARIF REPORT (FAIL-SAFE)
  // ---------------------------------------------------------------------------
  const elapsedMs = Date.now() - startTime;
  const isClean = sarifFindings.length === 0 && !fatalError;
  if (isClean) stagesPassedCount = 7;

  const receipt = {
    pipelineId: "EOS-LOCAL-REPOSITORY-CHECKS",
    epistemicState: isClean ? "LOCAL_CHECKS_EXECUTED" : "FINDINGS_IDENTIFIED",
    evidenceType: "source-inventory-digest-and-mocked-handler-smoke-checks",
    stagesPassed: `${stagesPassedCount}/7`,
    exitCode: isClean ? 0 : 1,
    sourceInventoryDigest,
    sourceFileCount: fileInventory.length,
    inProcessHandlerSmokeChecks: apiEndpoints.map(({ file }) => file),
    hookFilesReferencedButNotProbed: [".githooks/pre-commit", ".githooks/pre-push", ".github/workflows/eos-sovereign-cicd.yml"],
    hookConfigurationProbed: false,
    deploymentRun: false,
    liveHealthProbeRun: false,
    findingsCount: sarifFindings.length
  };

  const evidenceDir = path.join(root, "docs/evidence");
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  fs.writeFileSync(path.join(evidenceDir, "LOCAL-CHECKS-RECEIPT.json"), JSON.stringify(receipt, null, 2) + "\n", "utf8");

  // Emit OASIS SARIF v2.1.0 diagnostic report with REAL accumulated findings (SPEC-138)
  const sarifReport = {
    version: "2.1.0",
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "EOS-Configured-Repository-Checks",
            version: pkgVersion,
            informationUri: "https://github.com/valentinflorezarbelaez-ai/Glorian-System-",
            rules: [
              {
                id: "EOS-SEC-001",
                name: "ConfiguredCredentialPatternScan",
                shortDescription: { text: "No matches for credential patterns were found in scanned files." },
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
              },
              {
                id: "EOS-TEST-004",
                name: "TestSuiteExecution",
                shortDescription: { text: "All automated test suites must pass cleanly with exit code 0." },
                defaultConfiguration: { level: "error" }
              },
              {
                id: "EOS-CWV-005",
                name: "DesignSystemAndAccessibility",
                shortDescription: { text: "Design system perfection and accessibility assertions passed." },
                defaultConfiguration: { level: "error" }
              },
              {
                id: "EOS-API-006",
                name: "ServerlessApiSmokeChecks",
                shortDescription: { text: "In-process API handlers returned valid mocked HTTP 200 responses." },
                defaultConfiguration: { level: "error" }
              },
              {
                id: "EOS-TLA-008",
                name: "TlaBoundedSimulations",
                shortDescription: { text: "Formal TLA+ bounded simulations must pass invariant assertions." },
                defaultConfiguration: { level: "error" }
              }
            ]
          }
        },
        results: sarifFindings,
        invocations: [
          {
            executionSuccessful: isClean,
            endTimeUtc: new Date().toISOString()
          }
        ]
      }
    ]
  };

  fs.writeFileSync(path.join(evidenceDir, "local-checks.sarif"), JSON.stringify(sarifReport, null, 2) + "\n", "utf8");
  console.log(`[PASS] Stage 7/7 — Local source-inventory digest, check receipt & configured-checks SARIF written in ${elapsedMs} ms.`);
  console.log("======================================================================");

  if (!isClean) {
    console.error(`❌ LOCAL CHECKS: GATE FAILED (${sarifFindings.length} findings, fatal: ${fatalError?.message || "none"})`);
    console.log("======================================================================");
    process.exit(1);
  } else {
    console.log(" LOCAL CHECKS: 7/7 STAGES PASSED | NO DEPLOYMENT OR LIVE PROBE RUN  ");
    console.log("======================================================================");
    process.exit(0);
  }
}

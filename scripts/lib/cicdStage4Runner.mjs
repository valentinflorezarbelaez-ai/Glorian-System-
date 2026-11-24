/**
 * Glorian System — Stage 4 Syntax, Type-Check & Hermetic Test Runner
 * Extracted from scripts/verify-cicd-pipeline.mjs (SPEC-250 headroom compliance).
 * Isolates test-generated receipts via EOS_EVIDENCE_DIR (SPEC-342).
 * Zero external runtime dependencies (Law V).
 */

import assert from "node:assert/strict";
import { execFile, execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function runStage4Coverage({ root, filesToRun, testEnv }) {
  const minLine = testEnv.COVERAGE_MIN_LINE ?? "85";
  const minBranch = testEnv.COVERAGE_MIN_BRANCH ?? "85";
  const concurrency = testEnv.COVERAGE_CONCURRENCY ?? "4";
  console.log(`[STAGE 4.5] Running V8 coverage (lines >= ${minLine}%, branches >= ${minBranch}%).`);
  execFileSync(
    process.execPath,
    [
      "--test",
      "--experimental-test-coverage",
      "--test-coverage-exclude=bin/**",
      "--test-coverage-exclude=scripts/**",
      `--test-coverage-lines=${minLine}`,
      `--test-coverage-branches=${minBranch}`,
      `--test-concurrency=${concurrency}`,
      `--test-reporter=${new URL("./cicdCoverageReporter.mjs", import.meta.url).href}`,
      ...filesToRun,
    ],
    { cwd: root, env: testEnv, stdio: "inherit" },
  );
  console.log("[PASS] Stage 4.5/7 — Coverage test run passed and both V8 thresholds were met.");
}

function collectPtsChangedFiles(repoRoot) {
  const porcelain = execFileSync("git", ["status", "--porcelain"], { cwd: repoRoot, encoding: "utf8" });
  const workingChanged = porcelain
    .split("\n")
    .filter(Boolean)
    .map((l) => l.slice(3).trim())
    .map((l) => (l.includes(" -> ") ? l.slice(l.indexOf(" -> ") + 4) : l))
    .filter(Boolean);
  if (workingChanged.length > 0) return workingChanged;
  try {
    const commitDiff = execFileSync("git", ["diff", "--name-only", "HEAD~2..HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    return commitDiff
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function verifyJsSyntaxParallel(root, allFiles, concurrency) {
  const testFileSet = new Set(
    fs
      .readdirSync(path.join(root, "test"))
      .filter((f) => f.endsWith(".test.mjs"))
      .map((f) => path.join(root, "test", f)),
  );
  const jsFilesToCheck = allFiles.filter((f) => (f.endsWith(".js") || f.endsWith(".mjs")) && !testFileSet.has(f));
  const syntaxErrors = [];
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

  await Promise.all(Array.from({ length: concurrency }, () => syntaxWorker()));
  assert.equal(
    syntaxErrors.length,
    0,
    `[STAGE 4 FAIL] ${syntaxErrors.length} JavaScript syntax error(s):\n` +
      syntaxErrors.map((e) => `  ${e.file}: ${e.message}`).join("\n"),
  );
  return jsFilesToCheck.length;
}

async function selectPtsFiles(root, testFiles) {
  try {
    const changed = collectPtsChangedFiles(root);
    if (changed.length === 0) return testFiles;
    const { EosDatalogVerifier } = await import("../../src/core/eosDatalogVerifier.ts");
    const verifier = new EosDatalogVerifier(root);
    const selected = new Set([
      "test/eosCore.test.mjs",
      "test/eosReleaseDocConsistency.test.mjs",
      "test/eosModuleSizeBudget.test.mjs",
    ]);

    for (const item of changed) {
      const norm = item.replace(/\\/g, "/");
      if (norm.startsWith("test/") && norm.endsWith(".test.mjs")) {
        selected.add(norm);
      } else if (norm.startsWith("src/core/") && norm.endsWith(".ts")) {
        verifier.queryBlastRadius(norm).predictiveTestSuites.forEach((s) => selected.add(s));
      } else if (norm.startsWith("bin/") || norm.startsWith("src/mcp/")) {
        selected.add("test/eosEnterpriseFacade.test.mjs");
        selected.add("test/eosMcpSchemaValidator.test.mjs");
      }
    }

    const filtered = testFiles.filter((f) => selected.has(f));
    console.log(
      `[STAGE 4 PTS] Datalog Smart Selection activated: ${filtered.length} of ${testFiles.length} suites selected.`,
    );
    return filtered;
  } catch {
    return testFiles;
  }
}

export async function runStage4SyntaxAndTests({ root, allFiles, isPts }) {
  const concurrency = Math.min(8, Math.max(4, (os.cpus()?.length ?? 8) - 2));
  const jsCheckedCount = await verifyJsSyntaxParallel(root, allFiles, concurrency);

  const typeScriptCompiler = path.join(root, "node_modules", "typescript", "bin", "tsc");
  assert.ok(
    fs.existsSync(typeScriptCompiler),
    "TypeScript compiler is missing; install the locked dev toolchain with npm ci.",
  );
  execFileSync(process.execPath, [typeScriptCompiler, "--project", path.join(root, "tsconfig.typecheck.json")], {
    cwd: root,
    stdio: "inherit",
  });
  const tsCoreCount = fs.readdirSync(path.join(root, "src/core")).filter((f) => f.endsWith(".ts")).length;
  assert.ok(tsCoreCount >= 6, "Expected at least 6 Layer-0 TypeScript core modules in src/core/");

  const testFiles = fs
    .readdirSync(path.join(root, "test"))
    .filter((file) => file.endsWith(".test.mjs"))
    .map((file) => `test/${file}`)
    .sort();
  assert.ok(testFiles.length > 0, "No Node test suites were found under test/.");

  const filesToRun = isPts ? await selectPtsFiles(root, testFiles) : testFiles;

  // SPEC-342 Hermetic Evidence Isolation: keep tracked docs/evidence/* clean during test runs
  const testEvidenceDir = process.env.EOS_EVIDENCE_DIR || path.join(root, ".eos", "test-evidence");
  fs.mkdirSync(testEvidenceDir, { recursive: true });
  const testEnv = { ...process.env, EOS_EVIDENCE_DIR: testEvidenceDir };

  const testStart = Date.now();
  const testReportPath = path.join(root, ".eos", "test-report.xml");
  fs.mkdirSync(path.dirname(testReportPath), { recursive: true });
  console.log(
    `[STAGE 4 RUNNER] Launching ${filesToRun.length} suites in parallel via node --test (concurrency=${concurrency}, hermetic=${path.relative(root, testEvidenceDir)})...`,
  );
  const testArgs = [
    "--test",
    `--test-concurrency=${concurrency}`,
    "--test-reporter=spec",
    "--test-reporter-destination=stdout",
    "--test-reporter=junit",
    `--test-reporter-destination=${testReportPath}`,
    ...filesToRun,
  ];
  const exitCode = await new Promise((resolve) => {
    const child = spawn(process.execPath, testArgs, { cwd: root, stdio: "inherit", env: testEnv });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
  const testDurationMs = Date.now() - testStart;
  if (exitCode !== 0) {
    console.error(`[STAGE 4 FAILED] Parallel test suite exited with code ${exitCode} in ${testDurationMs} ms.`);
  } else {
    console.log(
      `[PASS] Stage 4/7 — JavaScript syntax (${jsCheckedCount} non-test modules, pool=${concurrency}), TypeScript type-check, and parallel Node test suites (${tsCoreCount} core TS modules; ${testFiles.length} suites in ${testDurationMs} ms).`,
    );
  }

  return {
    exitCode,
    testDurationMs,
    jsCheckedCount,
    tsCoreCount,
    testCount: testFiles.length,
    filesToRun,
    testReportPath,
    testEnv,
  };
}

#!/usr/bin/env node
/**
 * Repository Health Check — single command that runs ALL validation gates.
 *
 * Big Tech standard (Google "repo-doctor", Meta "health-check"): a single
 * command that produces a comprehensive health report of the repository,
 * running independent validation scripts in a bounded parallel worker pool.
 *
 * Usage:
 *   node scripts/repo-health.mjs
 *   npm run health
 *
 * Zero external dependencies (Law V).
 */

import { execFile } from "node:child_process";
import os from "node:os";

const root = process.cwd();
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";

const CHECKS = [
  { name: "Typecheck", cmd: [npmBin, ["run", "typecheck"]], blocking: true },
  { name: "ESLint", cmd: [npmBin, ["run", "lint"]], blocking: true },
  { name: "Prettier Format", cmd: [npmBin, ["run", "format:check"]], blocking: true },
  { name: "Import Boundary (Law V)", cmd: [process.execPath, ["scripts/import-boundary-gate.mjs"]], blocking: true },
  { name: "Code Complexity ≤15", cmd: [process.execPath, ["scripts/complexity-gate.mjs"]], blocking: true },
  { name: "License Audit", cmd: [process.execPath, ["scripts/license-audit.mjs"]], blocking: true },
  { name: "CODEOWNERS Validation", cmd: [process.execPath, ["scripts/codeowners-validate.mjs"]], blocking: true },
  { name: "Markdown Link Checker", cmd: [process.execPath, ["scripts/link-checker.mjs"]], blocking: true },
  { name: "PWA Validation", cmd: [process.execPath, ["scripts/pwa-validate.mjs"]], blocking: true },
  { name: "A11y Static Check", cmd: [process.execPath, ["scripts/a11y-check.mjs"]], blocking: true },
  { name: "Unused Dependencies", cmd: [process.execPath, ["scripts/unused-deps-check.mjs"]], blocking: true },
  { name: "Size Budget", cmd: [process.execPath, ["scripts/size-budget.mjs"]], blocking: true },
  { name: "Bundle Size Budget", cmd: [process.execPath, ["scripts/bundle-budget.mjs"]], blocking: true },
  {
    name: "SBOM Gate (CycloneDX)",
    cmd: [process.execPath, ["scripts/sbom-gate.mjs", "--verify-only"]],
    blocking: true,
  },
  { name: "MCP Smoke Test", cmd: [process.execPath, ["scripts/mcp-smoke-test.mjs"]], blocking: true },
];

function runSingleCheck(check) {
  return new Promise((resolve) => {
    const started = Date.now();
    const isNpm = check.cmd[0] === npmBin;
    execFile(
      check.cmd[0],
      check.cmd[1],
      {
        cwd: root,
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
        shell: isNpm && process.platform === "win32",
      },
      (err, _stdout, stderr) => {
        const durationMs = Date.now() - started;
        if (!err) {
          resolve({ ...check, status: "PASS", durationMs, errorSnippet: "" });
          return;
        }
        const raw = String(stderr || err.message || "").trim();
        const snippet = raw.split("\n").slice(0, 3).join("\n").slice(0, 120);
        resolve({ ...check, status: "FAIL", durationMs, errorSnippet: snippet });
      },
    );
  });
}

async function runChecksInParallel(checks, maxWorkers) {
  const results = new Array(checks.length);
  let cursor = 0;

  async function worker() {
    while (cursor < checks.length) {
      const idx = cursor++;
      results[idx] = await runSingleCheck(checks[idx]);
    }
  }

  const workers = Math.max(1, Math.min(maxWorkers, checks.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

const startTime = Date.now();
const hwCores = os.availableParallelism ? os.availableParallelism() : 4;
const poolSize = Math.max(2, Math.min(hwCores, 6));

console.log("======================================================================");
console.log(` EOS REPOSITORY HEALTH CHECK (parallel pool=${poolSize})`);
console.log(` ${new Date().toISOString()}`);
console.log("======================================================================\n");

const results = await runChecksInParallel(CHECKS, poolSize);

for (const res of results) {
  const icon = res.status === "PASS" ? "✅ PASS" : "❌ FAIL";
  console.log(`  ${res.name}... ${icon} (${res.durationMs}ms)`);
  if (res.status === "FAIL" && res.errorSnippet) {
    console.log(`         ${res.errorSnippet}`);
  }
}

const passed = results.filter((r) => r.status === "PASS").length;
const failed = results.filter((r) => r.status === "FAIL").length;
const blockingFails = results.filter((r) => r.status === "FAIL" && r.blocking).length;

console.log("\n======================================================================");
console.log(` HEALTH REPORT: ${passed} passed, ${failed} failed (${blockingFails} blocking)`);
console.log(` Duration: ${Date.now() - startTime}ms`);
console.log("======================================================================");

if (blockingFails > 0) {
  console.error(`\n ❌ ${blockingFails} blocking check(s) failed. Fix before pushing.`);
  process.exit(1);
}

if (failed > 0) {
  console.log(`\n ⚠️ ${failed - blockingFails} advisory check(s) failed. Review before pushing.`);
}

console.log("\n ✅ All blocking checks passed.");
process.exit(0);

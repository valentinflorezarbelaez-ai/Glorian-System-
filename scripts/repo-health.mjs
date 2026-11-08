#!/usr/bin/env node
/**
 * Repository Health Check — single command that runs ALL validation gates.
 *
 * Big Tech standard (Google "repo-doctor", Meta "health-check"): a single
 * command that produces a comprehensive health report of the repository,
 * running every validation script and reporting pass/fail for each.
 *
 * Usage:
 *   node scripts/repo-health.mjs
 *   npm run health
 *
 * Zero external dependencies (Law V).
 */

import { execFileSync } from "node:child_process";

const root = process.cwd();
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";

const CHECKS = [
  { name: "Typecheck", cmd: [npmBin, ["run", "typecheck"]], blocking: true },
  { name: "ESLint", cmd: [npmBin, ["run", "lint"]], blocking: true },
  { name: "Prettier Format", cmd: [npmBin, ["run", "format:check"]], blocking: true },
  { name: "Import Boundary (Law V)", cmd: [process.execPath, ["scripts/import-boundary-gate.mjs"]], blocking: true },
  { name: "Code Complexity ≤15", cmd: [process.execPath, ["scripts/complexity-gate.mjs"]], blocking: true },
  { name: "License Audit", cmd: [process.execPath, ["scripts/license-audit.mjs"]], blocking: true },
  { name: "CODEOWNERS Validation", cmd: [process.execPath, ["scripts/codeowners-validate.mjs"]], blocking: false },
  { name: "Markdown Link Checker", cmd: [process.execPath, ["scripts/link-checker.mjs"]], blocking: false },
  { name: "PWA Validation", cmd: [process.execPath, ["scripts/pwa-validate.mjs"]], blocking: false },
  { name: "A11y Static Check", cmd: [process.execPath, ["scripts/a11y-check.mjs"]], blocking: false },
  { name: "Unused Dependencies", cmd: [process.execPath, ["scripts/unused-deps-check.mjs"]], blocking: false },
  { name: "Size Budget", cmd: [process.execPath, ["scripts/size-budget.mjs"]], blocking: true },
  { name: "Bundle Size Budget", cmd: [process.execPath, ["scripts/bundle-budget.mjs"]], blocking: false },
  { name: "SBOM Gate (CycloneDX)", cmd: [process.execPath, ["scripts/sbom-gate.mjs"]], blocking: false },
  { name: "MCP Smoke Test", cmd: [process.execPath, ["scripts/mcp-smoke-test.mjs"]], blocking: false },
];

const startTime = Date.now();
const results = [];

console.log("======================================================================");
console.log(" EOS REPOSITORY HEALTH CHECK");
console.log(` ${new Date().toISOString()}`);
console.log("======================================================================\n");

for (const check of CHECKS) {
  process.stdout.write(`  ${check.name}...`);
  try {
    execFileSync(check.cmd[0], check.cmd[1], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
      shell: process.platform === "win32",
    });
    results.push({ ...check, status: "PASS" });
    console.log(" ✅ PASS");
  } catch (err) {
    results.push({ ...check, status: "FAIL" });
    console.log(" ❌ FAIL");
    if (err.stderr) {
      const msg = err.stderr.toString().trim().split("\n").slice(0, 3).join("\n");
      if (msg) console.log(`         ${msg.slice(0, 120)}`);
    }
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

#!/usr/bin/env node
/**
 * scripts/run-coverage.mjs
 * Native V8 Code Coverage runner for EOS System using Node.js native test runner.
 * Zero external NPM dependencies (Node.js 24+ native V8 coverage).
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("======================================================================");
console.log(" EOS SYSTEM — NATIVE V8 TEST COVERAGE RUNNER (ZERO DEPS)");
console.log("======================================================================");

const targetTests = process.argv.slice(2);
const defaultSuites = [
  "test/eosCore.test.mjs",
  "test/eosDisruptorRingEngine.test.mjs",
  "test/eosSapFixAutoshipper.test.mjs",
  "test/eosSlsaProvenanceSbom.test.mjs",
  "test/eosContentAddressableCache.test.mjs",
  "test/eosSmtAutomatedReasoningProver.test.mjs",
  "test/eosProductionChaosMonkey.test.mjs",
  "test/eosBftAgentSwarmSlashing.test.mjs"
];

const suitesToRun = targetTests.length > 0 ? targetTests : defaultSuites;
console.log(`[INFO] Executing coverage across ${suitesToRun.length} representative test suites...\n`);

const args = [
  "--test",
  "--experimental-test-coverage",
  ...suitesToRun.map((s) => path.resolve(projectRoot, s))
];

const result = spawnSync(process.execPath, args, {
  cwd: projectRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_V8_COVERAGE: path.join(projectRoot, ".coverage")
  }
});

if (result.status !== 0) {
  console.error(`\n[FAIL] Coverage test execution exited with code ${result.status}`);
  process.exit(result.status || 1);
}

console.log("\n[PASS] Native V8 coverage run completed successfully (Exit Code 0).");
process.exit(0);

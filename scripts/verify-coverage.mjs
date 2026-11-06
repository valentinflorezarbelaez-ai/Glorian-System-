#!/usr/bin/env node
/**
 * Coverage ratchet using Node's native V8 coverage (zero dependencies).
 *
 * scripts/coverage-baseline.json holds the floor measured on a full green run.
 * Raise the floor after coverage improves; never lower it to make a build pass.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = path.join(root, "scripts", "coverage-baseline.json");

if (!fs.existsSync(baselinePath)) {
  console.error(`[FAIL] Missing ${path.relative(root, baselinePath)}.`);
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const suites = fs
  .readdirSync(path.join(root, "test"))
  .filter((file) => file.endsWith(".test.mjs"))
  .sort()
  .map((file) => path.join("test", file));

if (suites.length === 0) {
  console.error("[FAIL] No test suites found under test/.");
  process.exit(1);
}
// Some suites enforce wall-clock ceilings; keep the coverage run deterministic
// instead of letting parallelism turn load into false failures.
const concurrency = process.env.EOS_TEST_CONCURRENCY ?? "1";

console.log("======================================================================");
console.log(" EOS SYSTEM — COVERAGE RATCHET (native V8, zero dependencies)");
console.log("======================================================================");
console.log(
  ` Floors: lines >= ${baseline.lines}% | branches >= ${baseline.branches}% | functions >= ${baseline.functions}%`
);
console.log(` Concurrency: ${concurrency}`);
console.log("----------------------------------------------------------------------");

const result = spawnSync(
  process.execPath,
  [
    "--test",
    "--test-timeout=180000",
    "--experimental-test-coverage",
    `--test-coverage-lines=${baseline.lines}`,
    `--test-coverage-branches=${baseline.branches}`,
    `--test-coverage-functions=${baseline.functions}`,
    `--test-concurrency=${concurrency}`,
    ...suites
  ],
  { cwd: root, stdio: "inherit", env: { ...process.env } }
);

if (result.status !== 0) {
  console.error("[FAIL] Coverage gate failed; add tests or fix regressions instead of lowering the floor.");
  process.exit(result.status || 1);
}

console.log("[PASS] Coverage ratchet satisfied.");

#!/usr/bin/env node
/**
 * Thin satellite verify:strict — golden-path scaffold (outside Glorian Layer-0).
 * Fail-closed on non-empty package.json dependencies, then run all test/*.test.mjs.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const deps = pkg.dependencies ?? {};
const depKeys = Object.keys(deps);

if (depKeys.length !== 0) {
  console.error(`[verify:strict FAIL] dependencies must be {} (found: ${depKeys.join(", ")})`);
  process.exit(1);
}

console.log("[PASS] dependencies: {}");

const testDir = path.join(root, "test");
if (!fs.existsSync(testDir)) {
  console.error("[verify:strict FAIL] missing test/ directory");
  process.exit(1);
}

const testFiles = fs
  .readdirSync(testDir)
  .filter((name) => name.endsWith(".test.mjs"))
  .map((name) => path.join("test", name))
  .sort();

if (testFiles.length === 0) {
  console.error("[verify:strict FAIL] no test/*.test.mjs files found");
  process.exit(1);
}

console.log(`[verify:strict] running ${testFiles.length} suite(s): ${testFiles.join(", ")}`);

const result = spawnSync(process.execPath, ["--test", ...testFiles], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error(`[verify:strict FAIL] ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);

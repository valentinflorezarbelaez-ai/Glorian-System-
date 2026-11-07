#!/usr/bin/env node
/**
 * Test Shard Runner — parallel test execution across CI matrix shards.
 *
 * Big Tech pattern (Google Bazel shards, Meta test01, Kubernetes test grid):
 * divide the test suite into N shards and run them in parallel across
 * separate CI runners. Each runner executes only its slice, reducing wall
 * time from O(total) to O(total / shards).
 *
 * Usage:
 *   node scripts/test-shard.mjs --index=0 --total=4   # run shard 0 of 4
 *
 * Zero external dependencies (Law V).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

const args = process.argv.slice(2);
function getArg(name) {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? Number(a.split("=")[1]) : null;
}

const shardIndex = getArg("index") ?? 0;
const shardTotal = getArg("total") ?? 1;

if (shardTotal < 1 || shardIndex < 0 || shardIndex >= shardTotal) {
  console.error(`Invalid shard: index=${shardIndex} total=${shardTotal}`);
  process.exit(1);
}

// List all test files
const testDir = path.join(root, "test");
const allTests = fs
  .readdirSync(testDir)
  .filter((f) => f.endsWith(".test.mjs"))
  .sort();

// Divide into shards using round-robin for even distribution
const shardTests = allTests.filter((_, i) => i % shardTotal === shardIndex);

console.log("======================================================================");
console.log(` EOS TEST SHARD ${shardIndex + 1}/${shardTotal}`);
console.log(` ${shardTests.length}/${allTests.length} test suites assigned to this shard`);
console.log("======================================================================");

if (shardTests.length === 0) {
  console.log("[SKIP] No test suites assigned to this shard.");
  process.exit(0);
}

// Run the shard
const concurrency = Math.min(4, shardTests.length);
try {
  execFileSync(
    process.execPath,
    ["--test", `--test-concurrency=${concurrency}`, ...shardTests.map((f) => path.join("test", f))],
    { cwd: root, stdio: "inherit" },
  );
} catch (err) {
  // The test runner already prints failures; just exit with the error code
  process.exit(err.status ?? 1);
}

console.log(`[PASS] Shard ${shardIndex + 1}/${shardTotal} complete.`);

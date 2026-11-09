#!/usr/bin/env node
/**
 * Fast local verification lane for pre-commit.
 *
 * Runs the two checks that catch the most expensive mistakes (credential
 * patterns and type errors) plus only the test suites impacted by the working
 * tree. The full 7-stage gate stays on pre-push and CI (SPEC-030).
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const startTime = Date.now();

delete process.env.GIT_DIR;
delete process.env.GIT_INDEX_FILE;
delete process.env.GIT_WORK_TREE;
delete process.env.GIT_PREFIX;

console.log("======================================================================");
console.log(" EOS SYSTEM — FAST PRE-COMMIT LANE (impacted checks only)");
console.log("======================================================================");

execFileSync(process.execPath, [path.join(root, "scripts/eos-secret-scan.mjs"), "."], {
  cwd: root,
  stdio: "inherit",
});
console.log("[PASS] 1/3 — Configured credential-pattern scan.");

const typeScriptCompiler = path.join(root, "node_modules", "typescript", "bin", "tsc");
if (!fs.existsSync(typeScriptCompiler)) {
  console.error("[FAIL] TypeScript compiler is missing; run npm ci.");
  process.exit(1);
}
execFileSync(process.execPath, [typeScriptCompiler, "--project", path.join(root, "tsconfig.typecheck.json")], {
  cwd: root,
  stdio: "inherit",
});
console.log("[PASS] 2/3 — TypeScript type-check.");

let changed = [];
try {
  const raw = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
  changed = raw
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .map((entry) => (entry.includes(" -> ") ? entry.slice(entry.indexOf(" -> ") + 4) : entry))
    .map((file) => file.replace(/^"|"$/g, "").replace(/\\/g, "/"))
    .filter(Boolean);
} catch {
  console.log("[WARN] git status unavailable; running the default smoke suites.");
}

const { EosDatalogVerifier } = await import("../src/core/eosDatalogVerifier.ts");
const verifier = new EosDatalogVerifier(root);
const selected = new Set();

for (const file of changed) {
  if (file.startsWith("test/") && file.endsWith(".test.mjs")) {
    selected.add(file);
  } else if (file.startsWith("src/core/") && file.endsWith(".ts")) {
    try {
      for (const suite of verifier.queryBlastRadius(file).predictiveTestSuites) {
        selected.add(suite);
      }
    } catch {
      // Unmapped module: the smoke suite below still runs.
    }
  }
}

const touchesRuntimeCode = changed.some((file) => /^(src|api|bin|scripts|js|css)\//.test(file));
if (touchesRuntimeCode || changed.length === 0) {
  // Fallback smoke suite for runtime paths the Datalog graph does not map;
  // the slower end-to-end workflow suite stays in the pre-push gate.
  selected.add("test/eosCore.test.mjs");
}

for (const file of changed) {
  if (/\.(m?js)$/.test(file) && file.startsWith("scripts/")) {
    execFileSync(process.execPath, ["--check", path.join(root, file)], { cwd: root, stdio: "pipe" });
  }
}

const suites = Array.from(selected)
  .filter((file) => fs.existsSync(path.join(root, file)))
  .sort();

if (suites.length === 0) {
  console.log("[PASS] 3/3 — No impacted suites for this change set.");
} else {
  console.log(`[RUN] 3/3 — ${suites.length} impacted suite(s): ${suites.join(", ")}`);
  for (const suite of suites) {
    execFileSync(process.execPath, ["--test", path.join(root, suite)], {
      cwd: root,
      stdio: "inherit",
    });
  }
  console.log(`[PASS] 3/3 — ${suites.length} impacted suite(s).`);
}

console.log(` FAST LANE PASSED in ${Date.now() - startTime} ms — run the full gate before pushing.`);
console.log("======================================================================");

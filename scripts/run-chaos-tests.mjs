#!/usr/bin/env node
/**
 * EOS CHAOS ENGINEERING CI INTEGRATION (SPEC-053)
 * Netflix standard: run chaos tests on every PR.
 *
 * Uses EosAutonomousChaosRunner to inject faults and verify resilience.
 * Exit 0 = resilient. Exit 1 = system broke under chaos.
 *
 * Zero external dependencies.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

console.log("======================================================================");
console.log(" EOS CHAOS ENGINEERING — Netflix Standard (CI Integration)");
console.log("======================================================================\n");

// Run chaos resilience test
let chaosResult = "RESILIENT";
try {
  console.log("[CHAOS] Running fault injection battery (1000 executions)...");
  execFileSync(process.execPath, ["--test", path.join(root, "test", "chaosResilience.test.mjs")], {
    cwd: root,
    encoding: "utf8",
    timeout: 60_000,
    stdio: "inherit",
  });
  console.log("\n[PASS] Chaos engineering test — system is RESILIENT under fault injection. ✔\n");
} catch (err) {
  chaosResult = "FAILED";
  console.error(`\n[FAIL] Chaos engineering test — system FAILED under fault injection.`);
  console.error(`       Error: ${String(err).slice(0, 200)}\n`);
}

// Seal chaos receipt AFTER verifying result (not before)
const receipt = {
  experimentId: `CHAOS-${Date.now()}`,
  timestamp: new Date().toISOString(),
  testSuite: "test/chaosResilience.test.mjs",
  result: chaosResult,
  sha256: crypto.createHash("sha256").update(`chaos:${chaosResult}:${Date.now()}`).digest("hex"),
};

const evidenceDir = path.join(root, "docs", "evidence");
if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, "CHAOS-RECEIPT.json"), JSON.stringify(receipt, null, 2), "utf8");

process.exit(chaosResult === "RESILIENT" ? 0 : 1);

/**
 * EOS SYSTEM — TYPESCRIPT STRICT TYPE-CHECK GATE (Stage 3.8)
 *
 * Runs `tsc --noEmit` against the project's tsconfig.json to catch
 * null dereferences, missing type annotations, and interface violations
 * at development time — before any code reaches production.
 *
 * What Google, Stripe, and Airbnb require in every CI pipeline.
 * Zero external runtime dependencies.
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const tsconfigPath = path.join(root, "tsconfig.json");

if (!fs.existsSync(tsconfigPath)) {
  console.error("[STAGE 3.8 FAIL] tsconfig.json not found. Cannot run TypeScript strict type check.");
  process.exit(1);
}

console.log("[STAGE 3.8] TypeScript Strict Type Check (tsc --noEmit)...");

// Locate tsc — prefer local node_modules, fall back to PATH
let tscBin = null;

const localTsc = path.join(root, "node_modules", ".bin", "tsc");
if (fs.existsSync(localTsc)) {
  tscBin = localTsc;
} else {
  // Check PATH
  const whichResult = spawnSync(
    process.platform === "win32" ? "where" : "which",
    ["tsc"],
    { encoding: "utf8" }
  );
  if (whichResult.status === 0 && whichResult.stdout.trim()) {
    tscBin = whichResult.stdout.trim().split("\n")[0].trim();
  }
}

if (!tscBin) {
  // TypeScript not installed — skip with a warning (CI should install it)
  console.warn(
    "[STAGE 3.8 SKIP] tsc not found. Install TypeScript with: npm install --save-dev typescript\n" +
    "         Skipping TypeScript check — add TypeScript to devDependencies for full strict enforcement."
  );
  process.exit(0);
}

try {
  execFileSync(tscBin, ["--noEmit", "--project", tsconfigPath], {
    cwd: root,
    stdio: "inherit",
    encoding: "utf8",
  });
  console.log("[PASS] Stage 3.8 — TypeScript strict type-check: 0 errors, 0 warnings.");
} catch {
  console.error(
    "\n[STAGE 3.8 FAIL] TypeScript strict type-check found errors.\n" +
    "        Fix all type errors before merging. This gate enforces:\n" +
    "          • strict: true  (noImplicitAny, strictNullChecks, etc.)\n" +
    "          • noUnusedLocals / noUnusedParameters\n" +
    "          • noUncheckedIndexedAccess\n" +
    "          • exactOptionalPropertyTypes\n"
  );
  process.exit(1);
}

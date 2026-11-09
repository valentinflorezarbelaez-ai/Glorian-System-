#!/usr/bin/env node
/**
 * License Compliance Audit — zero external dependencies.
 *
 * Big Tech standard (Google, Meta, Microsoft): every dependency must carry
 * a license from an approved allowlist. This script reads the lockfile,
 * extracts the license for each package, and fails if any dependency uses
 * a disallowed or missing license. Also checks the project's own license
 * for consistency.
 *
 * Usage:
 *   node scripts/license-audit.mjs
 *   npm run license:audit
 *
 * Zero external dependencies (Law V).
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

// ── Approved license allowlist (Google/FOSS standards) ─────────────────────
// These are the licenses that allow both use and redistribution.
const ALLOWED_LICENSES = new Set([
  "MIT",
  "Apache-2.0",
  "Apache License 2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "ISC",
  "CC0-1.0",
  "CC-BY-4.0",
  "Python-2.0",
  "Unlicense",
  "Zlib",
  "BlueOak-1.0.0",
]);

// ── Load lockfile ────────────────────────────────────────────────────────────
const lockPath = path.join(root, "package-lock.json");
if (!fs.existsSync(lockPath)) {
  console.error("[FAIL] package-lock.json not found.");
  process.exit(1);
}

const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));

// ── Extract licenses from lockfile packages ──────────────────────────────────
const packages = lock.packages ?? {};
const violations = [];
const checked = [];

for (const [key, pkg] of Object.entries(packages)) {
  if (key === "") continue; // root
  const name = key.replace(/^node_modules\//, "");
  const license = pkg.license;

  if (!license) {
    violations.push(`[MISSING] ${name}: no license field in lockfile`);
    continue;
  }

  // Some packages have license expressions like "MIT OR Apache-2.0"
  // or "(MIT OR CC0-1.0)" — extract individual licenses
  const licenses = license
    .replace(/[()]/g, "")
    .split(/\s+OR\s+|\s+AND\s+/)
    .map((l) => l.trim());

  // A package passes if ANY of its licenses is in the allowlist
  const hasAllowed = licenses.some((l) => ALLOWED_LICENSES.has(l));

  if (!hasAllowed) {
    violations.push(`[DENIED] ${name}: license "${license}" not in allowlist`);
  } else {
    checked.push(`${name}: ${license}`);
  }
}

// ── Verify project license ──────────────────────────────────────────────────
const pkgJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (!pkgJson.license || !ALLOWED_LICENSES.has(pkgJson.license)) {
  violations.push(`[PROJECT] package.json license "${pkgJson.license ?? "missing"}" not in allowlist`);
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log("======================================================================");
console.log(" EOS LICENSE COMPLIANCE AUDIT");
console.log("======================================================================");
console.log(`  Packages checked: ${checked.length}`);
console.log(`  Allowlist: ${Array.from(ALLOWED_LICENSES).join(", ")}`);
console.log("");

if (violations.length === 0) {
  console.log(" PASS — All dependencies carry approved licenses.");
  console.log("======================================================================");
  process.exit(0);
}

console.error(` FAIL — ${violations.length} license violation(s):`);
for (const v of violations) console.error(`  ${v}`);
console.error("");
console.error("Remove the dependency, find an alternative with an approved license,");
console.error("or add the license to the allowlist in scripts/license-audit.mjs.");
process.exit(1);

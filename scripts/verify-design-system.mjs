#!/usr/bin/env node
/**
 * EOS DESIGN SYSTEM LINTER (Capa 3 — AST Gate)
 * SPEC-052: Visual Governance — Rejects design violations automatically.
 *
 * Scans CSS and HTML files for:
 *   - Raw colors not in the design token set (no-raw-colors)
 *   - Forbidden border-radius values (no-large-radius)
 *   - Generic shadows (no-generic-shadow)
 *   - Inline styles bypassing the token system (no-inline-styles)
 *
 * Exit 0 = clean. Exit 1 = violations found.
 * Zero external dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// ── Import the token validator ──────────────────────────────────────────────
const { validateCssAgainstTokens, validateHtmlAgainstTokens, getTokenSystemSummary } =
  await import("../src/core/eosDesignTokens.ts");

// ── Collect all CSS and HTML files ───────────────────────────────────────────
function collectDesignFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectDesignFiles(full, acc);
    } else if (entry.isFile() && (full.endsWith(".css") || full.endsWith(".html"))) {
      acc.push(full);
    }
  }
  return acc;
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log("======================================================================");
console.log(" EOS DESIGN SYSTEM LINTER — Visual Governance Gate (Capa 3)");
console.log("======================================================================\n");

const summary = getTokenSystemSummary();
console.log(`  Token System: ${summary.totalColors} colors | ${summary.totalAllowedRadii} radii | ${summary.totalAllowedShadows} shadows | ${summary.totalFonts} fonts`);
console.log(`  Rules: no-raw-colors · no-large-radius · no-generic-shadow · no-inline-styles\n`);

const files = collectDesignFiles(root);
let totalViolations = 0;
const allViolations = [];

for (const file of files) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const content = fs.readFileSync(file, "utf8");

  // Skip the design tokens file itself (it defines the allowed values)
  if (rel.includes("eosDesignTokens")) continue;

  const violations = file.endsWith(".css")
    ? validateCssAgainstTokens(content, rel)
    : validateHtmlAgainstTokens(content, rel);

  if (violations.length > 0) {
    allViolations.push(...violations);
    totalViolations += violations.length;
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
if (totalViolations === 0) {
  console.log(`[PASS] Design System Linter — 0 violations across ${files.length} files.`);
  console.log("       All CSS/HTML uses only approved design tokens. ✔\n");
  process.exit(0);
}

console.log(`[FAIL] Design System Linter — ${totalViolations} violation(s) found:\n`);

// Group by rule
const byRule = {};
for (const v of allViolations) {
  if (!byRule[v.rule]) byRule[v.rule] = [];
  byRule[v.rule].push(v);
}

for (const [rule, violations] of Object.entries(byRule)) {
  console.log(`  ${rule} (${violations.length} violations):`);
  for (const v of violations.slice(0, 10)) { // Show first 10 per rule
    console.log(`    ${v.file}:${v.line} — ${v.message}`);
    console.log(`      Value: "${v.value}" → ${v.remediation}`);
  }
  if (violations.length > 10) {
    console.log(`    ... and ${violations.length - 10} more`);
  }
  console.log("");
}

console.log("======================================================================");
console.log(" FIX: Replace raw values with design tokens from eosDesignTokens.ts");
console.log("      Run: node scripts/verify-design-system.mjs to re-check");
console.log("======================================================================\n");

process.exit(1);

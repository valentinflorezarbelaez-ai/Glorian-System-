#!/usr/bin/env node
/**
 * Import Boundary Gate — Layer-0 architectural isolation enforcement.
 *
 * Big Tech standard (Hexagonal/Clean Architecture enforcement at Google,
 * Nubank, Spotify): automated checks that prevent layer violations before
 * they reach production. This script enforces:
 *
 *   1. Files under src/core/ (TypeScript) may ONLY import from:
 *      - node: built-in modules (node:fs, node:path, etc.)
 *      - other src/core/ modules (relative ./ imports)
 *   2. Files under src/core/ (TypeScript) may NEVER import from:
 *      - external npm packages (Law V — zero runtime deps)
 *      - src/mcp/, api/, bin/, scripts/ (layer isolation)
 *      - anything outside src/core/
 *
 * Usage:
 *   node scripts/import-boundary-gate.mjs
 *   npm run boundary:check
 *
 * Zero external dependencies (Law V).
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const coreDir = path.join(root, "src", "core");

const violations = [];
let checked = 0;

// ── Scan all src/core/*.ts files ─────────────────────────────────────────────
const files = fs.readdirSync(coreDir).filter((f) => f.endsWith(".ts"));

for (const file of files) {
  const filePath = path.join(coreDir, file);
  const content = fs.readFileSync(filePath, "utf8");
  checked++;

  // Extract all import statements
  const importRegex = /^\s*import\s+.*?\s+from\s+["']([^"']+)["']/gm;
  const matches = [...content.matchAll(importRegex)];

  for (const m of matches) {
    const importPath = m[1];
    if (importPath.includes("${")) continue; // Template string inside code generator

    // Allowed: node: builtins
    if (importPath.startsWith("node:")) continue;

    // Allowed: relative imports within src/core/
    if (importPath.startsWith("./") || importPath.startsWith("../")) {
      // Resolve relative to the file's directory
      const resolved = path.resolve(path.dirname(filePath), importPath);
      const relToRoot = path.relative(root, resolved).replace(/\\/g, "/");

      // Must stay inside src/core/
      if (relToRoot.startsWith("src/core/")) continue;

      // If it resolves outside src/core/, it's a layer violation
      violations.push(`${file}: imports "${importPath}" → resolves to "${relToRoot}" (outside src/core/)`);
      continue;
    }

    // Anything else is an external package → Law V violation
    violations.push(`${file}: imports external package "${importPath}" (Law V — zero runtime deps)`);
  }

  // Also check dynamic imports (excluding non-JS syntax like @import or word characters preceding import)
  const dynamicImportRegex = /(?<![@\w.$])import\s*\(\s*["']([^"']+)["']\s*\)/g;
  const dynamicMatches = [...content.matchAll(dynamicImportRegex)];

  for (const m of dynamicMatches) {
    const importPath = m[1];
    if (importPath.startsWith("node:")) continue;
    if (importPath.startsWith("./") || importPath.startsWith("../")) {
      const resolved = path.resolve(path.dirname(filePath), importPath);
      const relToRoot = path.relative(root, resolved).replace(/\\/g, "/");
      if (relToRoot.startsWith("src/core/")) continue;
      violations.push(`${file}: dynamic import "${importPath}" → resolves to "${relToRoot}" (outside src/core/)`);
      continue;
    }
    violations.push(`${file}: dynamic import external package "${importPath}" (Law V — zero runtime deps)`);
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log("======================================================================");
console.log(" EOS IMPORT BOUNDARY GATE — Layer-0 Isolation Enforcement (Law V)");
console.log("======================================================================");
console.log(`  Scanned: ${checked} src/core/*.ts files`);

if (violations.length === 0) {
  console.log(" PASS — All Layer-0 imports are isolated (node: builtins + src/core/ only).");
  console.log("======================================================================");
  process.exit(0);
}

console.error(`\n FAIL — ${violations.length} import boundary violation(s):`);
for (const v of violations) console.error(`  [VIOLATION] ${v}`);
console.error("");
console.error("src/core/ modules may only import from node: builtins or other src/core/ files.");
console.error("Fix the imports, or move the shared code into src/core/.");
process.exit(1);

#!/usr/bin/env node
/**
 * Unused Dependency Check — find devDependencies that aren't imported anywhere.
 *
 * Big Tech standard (Google depcheck, Meta's "knip"): devDependencies that
 * aren't referenced in any source file are dead weight. They slow down npm ci,
 * increase the attack surface, and add noise to security scans. This script
 * scans all .ts/.mjs/.js files for import statements and reports any
 * devDependency that is never imported.
 *
 * Usage:
 *   node scripts/unused-deps-check.mjs
 *   npm run deps:check
 *
 * Zero external dependencies (Law V).
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

// Load devDependencies from package.json
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const devDeps = Object.keys(pkg.devDependencies || {});

// Packages that are used via tooling, not imports (config-driven, not code)
const TOOLING_PACKAGES = new Set([
  "prettier", // used via CLI, not imported
  "eslint", // used via CLI, not imported
  "typescript", // used via tsc CLI, not imported
]);

// Scan all source files for import statements
const SOURCE_DIRS = ["src", "bin", "scripts", "api", "test"];
const usedPackages = new Set();

function scanDir(dir) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(abs, entry.name);
    if (entry.isDirectory()) scanDir(path.join(dir, entry.name));
    else if (/\.(ts|mjs|js)$/.test(entry.name)) {
      const content = fs.readFileSync(full, "utf8");
      // Find all import statements
      const importRegex = /(?:import\s+.*?\s+from\s+|import\s*\(\s*)["']([^"']+)["']/g;
      let m;
      while ((m = importRegex.exec(content)) !== null) {
        const imp = m[1];
        // Only count package imports (not relative or node:)
        if (!imp.startsWith(".") && !imp.startsWith("node:")) {
          // Handle scoped packages: @scope/name → @scope/name
          // Handle regular packages: lodash → lodash
          const pkgName = imp.startsWith("@") ? imp.split("/").slice(0, 2).join("/") : imp.split("/")[0];
          usedPackages.add(pkgName);
        }
      }
    }
  }
}

for (const dir of SOURCE_DIRS) scanDir(dir);

// Also check config files that reference packages
const configFiles = ["eslint.config.mjs"];
for (const file of configFiles) {
  const fullPath = path.join(root, file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, "utf8");
    for (const dep of devDeps) {
      if (content.includes(dep)) usedPackages.add(dep);
    }
  }
}

// Find unused devDependencies
const unused = devDeps.filter((dep) => !usedPackages.has(dep) && !TOOLING_PACKAGES.has(dep));

console.log("======================================================================");
console.log(" EOS UNUSED DEPENDENCY CHECK");
console.log("======================================================================");
console.log(`  devDependencies: ${devDeps.length}`);
console.log(`  Used in code:    ${usedPackages.size}`);
console.log(`  Tooling (CLI):   ${[...TOOLING_PACKAGES].filter((p) => devDeps.includes(p)).length}`);

if (unused.length === 0) {
  console.log(" PASS — All devDependencies are used.");
  console.log("======================================================================");
  process.exit(0);
}

console.error(`\n ADVISORY — ${unused.length} unused devDependency(s):`);
for (const dep of unused) console.error(`  ${dep}`);
console.error("\nRemove with `npm uninstall <pkg>` or add to TOOLING_PACKAGES if used via CLI.");
console.log("======================================================================");
// Advisory only — don't fail the build
process.exit(0);

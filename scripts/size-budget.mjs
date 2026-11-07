#!/usr/bin/env node
/**
 * Module Size Budget — architecture fitness function (anti-sprawl ratchet).
 *
 * Big Tech pattern: freeze the current shape of the codebase and block further
 * growth. Modules above the default ceiling are grandfathered at their current
 * size; any growth (or any new oversized module) fails the gate.
 *
 * Usage:
 *   node scripts/size-budget.mjs            # verify (exit 1 on violation)
 *   node scripts/size-budget.mjs --update   # regenerate the ratchet baseline
 *   npm run size:budget                     # via package.json
 */

import fs from "node:fs";
import path from "node:path";

const SOURCE_DIRS = ["src", "bin", "scripts", "api", "js"];
const EXTENSIONS = /\.(ts|mjs|js)$/;
const BUDGET_REL_PATH = "docs/quality/size-budget.json";

const root = process.cwd();
const update = process.argv.includes("--update");

function measure() {
  const sizes = {};
  const walk = (abs, rel) => {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (["node_modules", ".git"].includes(entry.name)) continue;
      const childAbs = path.join(abs, entry.name);
      const childRel = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(childAbs, childRel);
      else if (EXTENSIONS.test(entry.name)) {
        sizes[childRel] = fs.readFileSync(childAbs, "utf8").split("\n").length;
      }
    }
  };
  for (const dir of SOURCE_DIRS) {
    if (fs.existsSync(path.join(root, dir))) walk(path.join(root, dir), dir);
  }
  return sizes;
}

const budgetPath = path.join(root, BUDGET_REL_PATH);
const existing = fs.existsSync(budgetPath)
  ? JSON.parse(fs.readFileSync(budgetPath, "utf8"))
  : { defaultMaxLines: 800, ceilings: {} };
const defaultMaxLines = existing.defaultMaxLines;

const sizes = measure();

if (update) {
  const ceilings = {};
  for (const [file, lines] of Object.entries(sizes).sort()) {
    if (lines > defaultMaxLines) ceilings[file] = lines;
  }
  fs.mkdirSync(path.dirname(budgetPath), { recursive: true });
  fs.writeFileSync(budgetPath, `${JSON.stringify({ defaultMaxLines, ceilings }, null, 2)}\n`, "utf8");
  console.log(
    `✅ Size budget refreshed: ${Object.keys(ceilings).length} grandfathered module(s) over ${defaultMaxLines} lines.`,
  );
  process.exit(0);
}

const violations = [];
for (const [file, lines] of Object.entries(sizes).sort()) {
  const ceiling = Object.hasOwn(existing.ceilings, file) ? existing.ceilings[file] : defaultMaxLines;
  if (lines > ceiling) violations.push(`${file}: ${lines} lines > ceiling ${ceiling}`);
}

// A ceiling entry is stale when its module is gone or already dropped back under
// the default ceiling; keeping it would silently mask future growth.
const stale = Object.entries(existing.ceilings)
  .filter(([file]) => !(file in sizes) || sizes[file] <= defaultMaxLines)
  .map(([file]) => file);

if (violations.length === 0 && stale.length === 0) {
  console.log(
    `✅ Size budget OK: ${Object.keys(sizes).length} modules within budget (default ${defaultMaxLines} lines).`,
  );
  process.exit(0);
}

if (violations.length) {
  console.error(`❌ ${violations.length} module(s) exceed the size budget:\n  ${violations.join("\n  ")}`);
}
if (stale.length) {
  console.error(`❌ ${stale.length} stale ceiling entr(ies):\n  ${stale.join("\n  ")}`);
}
console.error("\nRefactor, or run `npm run size:budget -- --update` to refresh the ratchet baseline.");
process.exit(1);

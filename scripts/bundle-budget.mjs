#!/usr/bin/env node
/**
 * Bundle Size Budget — frontend asset size fitness function.
 *
 * Big Tech pattern (Vercel, Stripe, Linear): track the gzipped size of
 * shipped frontend assets and block merges that exceed the budget. The
 * ratchet may only shrink — a file that drops below its ceiling stays
 * grandfathered at its current size.
 *
 * Usage:
 *   node scripts/bundle-budget.mjs            # verify
 *   node scripts/bundle-budget.mjs --update    # refresh the ratchet
 *
 * Zero external dependencies (Law V).
 */

import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";

const root = process.cwd();
const update = process.argv.includes("--update");

const BUDGET_REL_PATH = "docs/quality/bundle-budget.json";

// Frontend assets to track (relative to project root)
const ASSETS = [
  { file: "js/eos.js", maxGzipKb: 80 },
  { file: "css/eos.css", maxGzipKb: 16 },
  { file: "index.html", maxGzipKb: 30 },
  { file: "js/speculation-rules.json", maxGzipKb: 1 },
  { file: "js/structured-data.jsonld", maxGzipKb: 2 },
];

function gzipSize(filePath) {
  const content = fs.readFileSync(filePath);
  return zlib.gzipSync(content).length;
}

function loadBudget() {
  const budgetPath = path.join(root, BUDGET_REL_PATH);
  if (!fs.existsSync(budgetPath)) return { assets: {} };
  return JSON.parse(fs.readFileSync(budgetPath, "utf8"));
}

function saveBudget(budget) {
  const budgetPath = path.join(root, BUDGET_REL_PATH);
  fs.mkdirSync(path.dirname(budgetPath), { recursive: true });
  fs.writeFileSync(budgetPath, `${JSON.stringify(budget, null, 2)}\n`, "utf8");
}

const existing = loadBudget();

if (update) {
  const assets = {};
  for (const { file } of ASSETS) {
    const abs = path.join(root, file);
    if (!fs.existsSync(abs)) continue;
    const gzKb = Math.ceil(gzipSize(abs) / 1024);
    assets[file] = gzKb;
  }
  saveBudget({ assets });
  console.log(`Bundle budget refreshed: ${Object.keys(assets).length} assets.`);
  for (const [file, kb] of Object.entries(assets)) {
    console.log(`  ${file}: ${kb} KB gzip`);
  }
  process.exit(0);
}

const violations = [];
console.log("======================================================================");
console.log(" EOS BUNDLE SIZE BUDGET — Frontend Gzipped Asset Gate");
console.log("======================================================================");

for (const { file, maxGzipKb } of ASSETS) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) {
    console.log(`  [SKIP] ${file} — not found`);
    continue;
  }
  const gzKb = Math.ceil(gzipSize(abs) / 1024);
  const ceiling = existing.assets?.[file] ?? maxGzipKb;

  const status = gzKb <= ceiling ? "OK" : "FAIL";
  const delta = gzKb - ceiling;
  console.log(`  [${status}] ${file}: ${gzKb} KB gzip (ceiling ${ceiling} KB${delta > 0 ? `, +${delta} KB` : ""})`);

  if (gzKb > ceiling) {
    violations.push(`${file}: ${gzKb} KB > ceiling ${ceiling} KB (+${delta} KB)`);
  }
}

if (violations.length === 0) {
  console.log("All frontend assets within budget.");
  process.exit(0);
}

console.error(`\n${violations.length} asset(s) exceed the bundle budget:`);
for (const v of violations) console.error(`  ${v}`);
console.error("\nOptimize the asset, or run `node scripts/bundle-budget.mjs --update` to refresh the ratchet.");
process.exit(1);

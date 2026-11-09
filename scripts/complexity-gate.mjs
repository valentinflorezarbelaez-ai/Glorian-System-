#!/usr/bin/env node
/**
 * Code Complexity Gate — cyclomatic complexity threshold enforcement.
 *
 * Big Tech standard (SonarQube, Code Climate, Meta's pyre-check): enforce
 * a maximum cyclomatic complexity per function. High complexity correlates
 * with bugs, low test coverage, and maintenance difficulty. This script
 * uses a simple heuristic counting branching statements per function.
 *
 * Threshold: default 15 (SonarQube default). Override per-file in
 * docs/quality/complexity-budget.json.
 *
 * Usage:
 *   node scripts/complexity-gate.mjs
 *   npm run complexity:check
 *
 * Zero external dependencies (Law V).
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const MAX_COMPLEXITY = Number(process.env.MAX_COMPLEXITY ?? 15);
const SOURCE_DIRS = ["src/core", "src/mcp", "bin", "scripts"];
const budgetFile = path.join(root, "docs", "quality", "complexity-budget.json");
const overrides = fs.existsSync(budgetFile) ? JSON.parse(fs.readFileSync(budgetFile, "utf8")) : {};

const violations = [];
let checked = 0;

const PATTERN_SOURCES = [
  "\\bif\\s*\\(",
  "\\belse\\s+if\\b",
  "\\bfor\\s*\\(",
  "\\bwhile\\s*\\(",
  "\\bdo\\s*\\{",
  "\\bcase\\s+",
  "\\bcatch\\s*\\(",
  "&&",
  "\\|\\|",
  "\\?[^=:]",
];
const COMPILED_PATTERNS = PATTERN_SOURCES.map((p) => new RegExp(p, "g"));
const FUNC_REGEX =
  /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{|(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>\s*\{/g;

function stripNonCode(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(new RegExp("/(?:\\\\.|[^/\\\\])+/[gimsuy]*", "g"), '""')
    .replace(/`[\s\S]*?`/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

function countComplexity(rawContent) {
  const content = stripNonCode(rawContent);
  let complexity = 1;
  for (const re of COMPILED_PATTERNS) {
    const matches = content.match(re);
    if (matches) complexity += matches.length;
  }
  return complexity;
}

function findClosingBrace(content, startIndex) {
  let depth = 1;
  let i = startIndex;
  while (i < content.length && depth > 0) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") depth--;
    i++;
  }
  return i;
}

function extractFunctions(content) {
  const funcs = [];
  const regex = new RegExp(FUNC_REGEX.source, "g");
  let match;
  while ((match = regex.exec(content)) !== null) {
    const name = match[1] || match[2];
    const end = findClosingBrace(content, regex.lastIndex);
    const body = content.slice(regex.lastIndex - 1, end);
    funcs.push({ name, body, complexity: countComplexity(body) });
  }
  return funcs;
}

for (const dir of SOURCE_DIRS) {
  const absDir = path.join(root, dir);
  if (!fs.existsSync(absDir)) continue;

  const files = fs.readdirSync(absDir).filter((f) => /\.(ts|mjs)$/.test(f));

  for (const file of files) {
    const filePath = path.join(absDir, file);
    const content = fs.readFileSync(filePath, "utf8");
    checked++;
    const funcs = extractFunctions(content);

    for (const fn of funcs) {
      const rel = path.relative(root, filePath).replace(/\\/g, "/");
      const allowedMax = overrides[`${rel}:${fn.name}`] ?? overrides[rel] ?? MAX_COMPLEXITY;
      if (fn.complexity > allowedMax) {
        violations.push(`${rel}: ${fn.name}() complexity=${fn.complexity} > ${allowedMax}`);
      }
    }
  }
}

console.log("======================================================================");
console.log(` EOS CODE COMPLEXITY GATE — Cyclomatic Complexity (max ${MAX_COMPLEXITY})`);
console.log("======================================================================");
console.log(`  Scanned: ${checked} files across ${SOURCE_DIRS.join(", ")}`);

if (violations.length === 0) {
  console.log(" PASS — All functions within complexity budget.");
  console.log("======================================================================");
  process.exit(0);
}

console.error(`\n FAIL — ${violations.length} function(s) exceed complexity budget:`);
for (const v of violations.slice(0, 30)) console.error(`  ${v}`);
if (violations.length > 30) console.error(`  ... and ${violations.length - 30} more`);
console.error("\nRefactor the function to reduce branching, or increase the threshold");
console.error(`via MAX_COMPLEXITY env var (current: ${MAX_COMPLEXITY}).`);
process.exit(1);

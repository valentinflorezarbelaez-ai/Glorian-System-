#!/usr/bin/env node
/**
 * EOS MUTATION TESTING RUNNER (SPEC-028)
 * Closes the gap between EosMutationTester (which generates mutants)
 * and actually measuring kill scores in CI.
 *
 * Workflow:
 *   1. Read target module source
 *   2. Generate operator-level mutants
 *   3. For each mutant: write to disk, run relevant test suite, check exit code
 *   4. Restore original source regardless of outcome
 *   5. Exit 0 if global mutation score >= threshold, exit 1 otherwise
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

const MUTATION_SCORE_THRESHOLD = parseInt(process.env["EOS_MUTATION_THRESHOLD"] ?? "60", 10);
const MAX_MUTANTS_PER_FILE = parseInt(process.env["EOS_MAX_MUTANTS"] ?? "15", 10);
const MUTANT_TIMEOUT_MS = 12_000;

// ---------------------------------------------------------------------------
// PTS matrix: source file → test file
// ---------------------------------------------------------------------------
const MUTATION_TARGETS = [
  {
    sourceFile: "src/core/eosNeuralVectorCore.ts",
    testFile: "test/eosCore.test.mjs",
    name: "NeuralVectorCore",
  },
  {
    sourceFile: "src/core/eosSemanticGraph.ts",
    testFile: "test/eosSemanticGraph.test.mjs",
    name: "SemanticGraph",
  },
  {
    sourceFile: "src/core/eosTurboEngine.ts",
    testFile: "test/eosTurbo.test.mjs",
    name: "TurboEngine",
  },
  {
    sourceFile: "src/core/eosArchitectureGuard.ts",
    testFile: "test/eosPrometheus.test.mjs",
    name: "ArchitectureGuard",
  },
];

// ---------------------------------------------------------------------------
// Mutation rules — operator-level transformations
// ---------------------------------------------------------------------------
const MUTATION_RULES = [
  { label: "=== → !==", pattern: /(?<![!<>=])===(?!=)/g, replacement: "!==" },
  { label: "!== → ===", pattern: /!==(?!=)/g, replacement: "===" },
  { label: "> 0 → < 0", pattern: />\s*0\b/g, replacement: "< 0" },
  { label: "return true", pattern: /\breturn\s+true\b/g, replacement: "return false" },
  { label: "return false", pattern: /\breturn\s+false\b/g, replacement: "return true" },
  { label: "length > 0", pattern: /\.length\s*>\s*0/g, replacement: ".length < 0" },
  { label: "+ 1 → - 1", pattern: /\+\s*1\b/g, replacement: "- 1" },
  { label: ".size > 0", pattern: /\.size\s*>\s*0/g, replacement: ".size < 0" },
];

// ---------------------------------------------------------------------------
// Mutant generation
// ---------------------------------------------------------------------------
function generateMutants(source) {
  const lines = source.split("\n");
  const mutants = [];
  let id = 0;

  for (let lineIdx = 0; lineIdx < lines.length && mutants.length < MAX_MUTANTS_PER_FILE; lineIdx++) {
    const line = lines[lineIdx];
    const trimmed = line.trim();

    // Skip comments and JSDoc
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;

    for (const rule of MUTATION_RULES) {
      rule.pattern.lastIndex = 0;
      if (!rule.pattern.test(line)) continue;
      rule.pattern.lastIndex = 0;

      const mutatedLine = line.replace(rule.pattern, rule.replacement);
      if (mutatedLine === line) continue;

      const mutatedLines = [...lines];
      mutatedLines[lineIdx] = mutatedLine;

      id++;
      mutants.push({
        id: `MUT-${String(id).padStart(3, "0")}`,
        line: lineIdx + 1,
        label: rule.label,
        original: trimmed.slice(0, 60),
        mutated: mutatedLine.trim().slice(0, 60),
        source: mutatedLines.join("\n"),
        status: "UNTESTED",
      });

      if (mutants.length >= MAX_MUTANTS_PER_FILE) break;
    }
  }
  return mutants;
}

// ---------------------------------------------------------------------------
// Run a single mutant: write → test → restore
// ---------------------------------------------------------------------------
function runMutant(mutant, sourcePath) {
  const origSource = fs.readFileSync(sourcePath, "utf8");
  try {
    fs.writeFileSync(sourcePath, mutant.source, "utf8");
    try {
      execFileSync(process.execPath, ["--test", mutant._testPath], {
        cwd: root,
        timeout: MUTANT_TIMEOUT_MS,
        stdio: "pipe",
      });
      mutant.status = "SURVIVED"; // tests passed with broken code — BAD
    } catch {
      mutant.status = "KILLED"; // tests detected the mutation — GOOD
    }
  } finally {
    fs.writeFileSync(sourcePath, origSource, "utf8"); // always restore
  }
  return mutant;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
console.log("======================================================================");
console.log(` EOS MUTATION TESTING RUNNER (SPEC-028)`);
console.log(` Threshold: ${MUTATION_SCORE_THRESHOLD}% | Max mutants/file: ${MAX_MUTANTS_PER_FILE}`);
console.log("======================================================================\n");

let totalMutants = 0;
let totalKilled = 0;
const allResults = [];

for (const target of MUTATION_TARGETS) {
  const sourcePath = path.join(root, target.sourceFile);
  const testPath = path.join(root, target.testFile);

  if (!fs.existsSync(sourcePath)) {
    console.log(`[SKIP] ${target.name}: ${target.sourceFile} not found`);
    continue;
  }
  if (!fs.existsSync(testPath)) {
    console.log(`[SKIP] ${target.name}: ${target.testFile} not found`);
    continue;
  }

  const source = fs.readFileSync(sourcePath, "utf8");
  const mutants = generateMutants(source).map((m) => ({ ...m, _testPath: testPath }));

  console.log(`[${target.name}] ${mutants.length} mutants generated from ${target.sourceFile}`);

  let killed = 0;
  for (const mutant of mutants) {
    process.stdout.write(`  ${mutant.id} L${mutant.line} [${mutant.label}] `);
    runMutant(mutant, sourcePath);
    if (mutant.status === "KILLED") {
      killed++;
      process.stdout.write("✔ KILLED\n");
    } else {
      process.stdout.write("✘ SURVIVED\n");
    }
  }

  const score = mutants.length > 0 ? Math.round((killed / mutants.length) * 100) : 100;
  const grade = score >= MUTATION_SCORE_THRESHOLD ? "PASS" : "FAIL";
  console.log(`\n[${target.name}] ${killed}/${mutants.length} killed = ${score}% [${grade}]\n`);

  allResults.push({ name: target.name, total: mutants.length, killed, score });
  totalMutants += mutants.length;
  totalKilled += killed;
}

const globalScore = totalMutants > 0 ? Math.round((totalKilled / totalMutants) * 100) : 100;
const passed = globalScore >= MUTATION_SCORE_THRESHOLD;

// Seal evidence receipt
const receipt = {
  runId: `MUTATION-${Date.now()}`,
  timestamp: new Date().toISOString(),
  threshold: MUTATION_SCORE_THRESHOLD,
  globalScore,
  totalMutants,
  totalKilled,
  passed,
  results: allResults,
  sha256: crypto.createHash("sha256").update(JSON.stringify(allResults)).digest("hex"),
};

const evidenceDir = path.join(root, "docs/evidence");
if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, "MUTATION-RECEIPT.json"), JSON.stringify(receipt, null, 2), "utf8");

console.log("======================================================================");
console.log(` GLOBAL MUTATION SCORE : ${totalKilled}/${totalMutants} = ${globalScore}%`);
console.log(` THRESHOLD             : ${MUTATION_SCORE_THRESHOLD}%`);
console.log(` VERDICT               : ${passed ? "PASS ✔" : "FAIL ✘"}`);
console.log(` RECEIPT               : docs/evidence/MUTATION-RECEIPT.json`);
console.log("======================================================================");

if (!passed) {
  console.error(`\n[FAIL] Mutation score ${globalScore}% < threshold ${MUTATION_SCORE_THRESHOLD}%.`);
  console.error("       Surviving mutants expose weak test assertions — add boundary conditions.");
  process.exit(1);
}

process.exit(0);

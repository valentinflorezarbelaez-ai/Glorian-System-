#!/usr/bin/env node
/**
 * GDD Goal Validator CLI — fail-closed schema + protected-path contract.
 *
 * Usage:
 *   node scripts/validate-gdd-goal.mjs docs/goals/example.json
 *   node scripts/validate-gdd-goal.mjs --dir docs/goals
 *   node scripts/validate-gdd-goal.mjs --pr-body path/to/pr-body.md
 *   npm run goal:validate
 *
 * Zero external dependencies (Law V). Imports Layer-0 GDD contract.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractGoalFenceFromPrBody,
  summarizeValidation,
  validateGoalDocument,
} from "../src/core/eosGoalDrivenDevelopmentContract.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

function usage() {
  console.log(`Usage:
  node scripts/validate-gdd-goal.mjs <file.json|file.yaml>
  node scripts/validate-gdd-goal.mjs --dir docs/goals
  node scripts/validate-gdd-goal.mjs --pr-body <markdown-file>
  npm run goal:validate`);
}

function collectGoalFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.(json|ya?ml)$/i.test(e.name))
    .map((e) => path.join(dirPath, e.name))
    .sort();
}

function validateRaw(label, raw) {
  const result = validateGoalDocument(raw);
  const line = summarizeValidation(result);
  if (result.ok) {
    console.log(`[PASS] ${label}: ${line}`);
    return 0;
  }
  console.error(`[FAIL] ${label}: ${line}`);
  for (const issue of result.issues) {
    console.error(`  - ${issue.code} @ ${issue.path}: ${issue.message}`);
  }
  return 1;
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    usage();
    return args.length === 0 ? 1 : 0;
  }

  let exitCode = 0;

  if (args[0] === "--dir") {
    const dir = path.resolve(ROOT, args[1] || "docs/goals");
    const files = collectGoalFiles(dir);
    if (files.length === 0) {
      console.error(`[FAIL] No goal files found under ${dir}`);
      return 1;
    }
    for (const file of files) {
      const raw = fs.readFileSync(file, "utf8");
      exitCode |= validateRaw(path.relative(ROOT, file), raw);
    }
    return exitCode;
  }

  if (args[0] === "--pr-body") {
    const bodyPath = args[1];
    if (!bodyPath) {
      console.error("[FAIL] --pr-body requires a markdown file path");
      return 1;
    }
    const abs = path.resolve(ROOT, bodyPath);
    if (!fs.existsSync(abs)) {
      console.error(`[FAIL] PR body not found: ${bodyPath}`);
      return 1;
    }
    const markdown = fs.readFileSync(abs, "utf8");
    const fence = extractGoalFenceFromPrBody(markdown);
    if (!fence) {
      console.error("[FAIL] No goal YAML/JSON fence found in PR body (```goal|yaml|json).");
      return 1;
    }
    return validateRaw(path.relative(ROOT, abs), fence);
  }

  // Positional file list
  for (const rel of args) {
    if (rel.startsWith("-")) {
      console.error(`[FAIL] Unknown flag: ${rel}`);
      usage();
      return 1;
    }
    const abs = path.resolve(ROOT, rel);
    if (!fs.existsSync(abs)) {
      console.error(`[FAIL] File not found: ${rel}`);
      exitCode = 1;
      continue;
    }
    exitCode |= validateRaw(path.relative(ROOT, abs), fs.readFileSync(abs, "utf8"));
  }

  return exitCode;
}

const code = main(process.argv);
process.exit(code);

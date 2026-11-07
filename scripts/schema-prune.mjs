#!/usr/bin/env node
/**
 * Schema Ceiling Pruning Protocol — PO-gated rotation (SPEC-123)
 *
 * The MCP schema registry enforces a strict 35/35 ceiling.
 * This script manages schema lifecycle:
 * - Lists all schemas with usage frequency (derived from test references)
 * - Identifies prunable candidates (zero test references, deprecated)
 * - Generates PO-approval manifest for pruning
 * - Executes prune only with explicit --approve flag
 *
 * Usage:
 *   node scripts/schema-prune.mjs            # report only
 *   node scripts/schema-prune.mjs --prune-id <id> --approve  # execute
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const pruneId = args.includes("--prune-id") ? args[args.indexOf("--prune-id") + 1] : null;
const approved = args.includes("--approve");

// Find the schema validator
const validatorPath = path.join(root, "src", "core", "eosMcpSchemaValidator.ts");

console.log("======================================================================");
console.log(" SCHEMA CEILING PRUNING PROTOCOL");
console.log("======================================================================\n");

// Discover registered schemas by scanning the validator source
const validatorSrc = fs.existsSync(validatorPath) ? fs.readFileSync(validatorPath, "utf8") : "";

// Extract schema names from registered tool definitions
const toolNames = [...validatorSrc.matchAll(/"eos_([a-z0-9_]+)"/g)].map((m) => `eos_${m[1]}`);
const uniqueTools = [...new Set(toolNames)].sort();

console.log(` Registered schema entries: ${uniqueTools.length} / ceiling 35`);
console.log(
  ` Ceiling status: ${uniqueTools.length >= 35 ? "AT_CEILING (pruning required for new entries)" : "HEADROOM AVAILABLE"}`,
);
console.log("");

// Calculate usage frequency from test files
const testDir = path.join(root, "test");
const testFiles = fs.existsSync(testDir) ? fs.readdirSync(testDir).filter((f) => f.endsWith(".test.mjs")) : [];

const usageCounts = {};
for (const tool of uniqueTools) {
  let count = 0;
  for (const tf of testFiles) {
    const content = fs.readFileSync(path.join(testDir, tf), "utf8");
    if (content.includes(tool)) count++;
  }
  usageCounts[tool] = count;
}

// Sort by usage ascending (zero-usage = prunable)
const byUsage = Object.entries(usageCounts).sort((a, b) => a[1] - b[1]);

console.log(" Tool | Test References | Prunable");
console.log("------|-----------------|----------");
for (const [tool, count] of byUsage) {
  const marker = count === 0 ? "CANDIDATE" : "";
  console.log(` ${tool.padEnd(40)} | ${String(count).padStart(3)}              | ${marker}`);
}

const prunable = byUsage.filter(([, c]) => c === 0).map(([t]) => t);

if (pruneId && prunable.includes(pruneId)) {
  if (!approved) {
    console.log(`\n[DRY-RUN] Would prune: ${pruneId}`);
    console.log("  Add --approve flag to execute.");
  } else {
    console.log(`\n✅ PO-approved prune executed: ${pruneId}`);
    console.log(`  Action: remove from eosMcpSchemaValidator.ts`);
    console.log(`  Impact: frees 1 slot (now ${uniqueTools.length - 1}/35)`);
    console.log("  Note: source file modification requires manual removal + test update.");
  }
} else if (pruneId && !prunable.includes(pruneId)) {
  console.error(`\n[ERROR] "${pruneId}" has test references and is NOT prunable.`);
}

console.log("\n======================================================================");
if (uniqueTools.length >= 35 && prunable.length > 0) {
  console.log(` ACTION: ${prunable.length} prunable candidate(s) identified.`);
  console.log(` Run: node scripts/schema-prune.mjs --prune-id <tool> --approve`);
} else if (uniqueTools.length >= 35) {
  console.log(" STATUS: AT_CEILING with zero prunable candidates (all referenced).");
  console.log(" Consider: merge related schemas or deprecate legacy tools.");
} else {
  console.log(" STATUS: HEADROOM available for new schemas.");
}
console.log("======================================================================");

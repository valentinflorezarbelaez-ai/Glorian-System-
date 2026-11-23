#!/usr/bin/env node
/**
 * Glorian System — Module Consumer Governance & Moratorium Auditor
 * Governed by SPEC-270 / CHANGE-132 / ADR-132-003
 *
 * Scans internal dependency graphs across src/core, src/mcp, api, bin, and scripts.
 * Maps consumer linkages, detects unconsumed leaf modules, and enforces the
 * architectural moratorium against unconsumed Layer-0 specs.
 *
 * Invariant: Zero external npm dependencies. Max cyclomatic complexity <= 15.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_RECEIPT_PATH = path.join(ROOT, "docs/evidence", "MODULE_CONSUMER_GRAPH.json");

const SCAN_DIRS = [
  { label: "core", dir: path.join(ROOT, "src/core"), extensions: [".ts", ".js"] },
  { label: "mcp", dir: path.join(ROOT, "src/mcp"), extensions: [".ts", ".js", ".mjs"] },
  { label: "api", dir: path.join(ROOT, "api"), extensions: [".js", ".mjs"] },
  { label: "bin", dir: path.join(ROOT, "bin"), extensions: [".mjs", ".js"] },
  { label: "scripts", dir: path.join(ROOT, "scripts"), extensions: [".mjs", ".js"] },
];

/**
 * Recursively scans directory for files matching target extensions.
 */
export function scanFiles(dirPath, extensions) {
  if (!fs.existsSync(dirPath)) return [];
  const results = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Extracts import and require targets from source code text.
 */
export function extractImportTargets(sourceText) {
  const targets = new Set();
  const importRegex = /(?:import\s+(?:[\s\S]*?from\s+)?|require\s*\(\s*|import\s*\(\s*)['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(sourceText)) !== null) {
    targets.add(match[1]);
  }
  return targets;
}

/**
 * Checks if an import path targets a specific module base name.
 */
function matchesModuleTarget(importPath, moduleBaseName) {
  const norm = importPath.replace(/\\/g, "/");
  const fileName = norm.split("/").pop();
  if (!fileName) return false;
  return fileName === moduleBaseName || fileName === `${moduleBaseName}.ts` || fileName === `${moduleBaseName}.js`;
}

/**
 * Analyzes consumer graph for all modules in src/core.
 */
export function buildConsumerGraph(root = ROOT) {
  const coreDir = path.join(root, "src/core");
  const coreFiles = scanFiles(coreDir, [".ts"]).sort();

  // Read all scan sources in memory once
  const scannedSources = [];
  for (const { label, dir, extensions } of SCAN_DIRS) {
    const files = scanFiles(dir, extensions);
    for (const filePath of files) {
      const relPath = path.relative(root, filePath).replace(/\\/g, "/");
      const content = fs.readFileSync(filePath, "utf8");
      const imports = extractImportTargets(content);
      scannedSources.push({ label, relPath, imports });
    }
  }

  const moduleGraph = {};
  let consumedCount = 0;

  for (const coreFile of coreFiles) {
    const relFile = path.relative(root, coreFile).replace(/\\/g, "/");
    const baseName = path.basename(coreFile, ".ts");
    const consumers = [];

    for (const source of scannedSources) {
      if (source.relPath === relFile) continue; // ignore self-reference
      for (const imp of source.imports) {
        if (matchesModuleTarget(imp, baseName)) {
          consumers.push({ consumerPath: source.relPath, category: source.label });
          break;
        }
      }
    }

    const isConsumed = consumers.length > 0;
    if (isConsumed) consumedCount++;

    moduleGraph[baseName] = {
      file: relFile,
      baseName,
      isConsumed,
      consumerCount: consumers.length,
      consumers,
    };
  }

  const total = coreFiles.length;
  const unconsumedCount = total - consumedCount;
  const graphDensity = total > 0 ? Number((consumedCount / total).toFixed(4)) : 0;

  return {
    timestampIso: new Date().toISOString(),
    totalModules: total,
    consumedModules: consumedCount,
    unconsumedModules: unconsumedCount,
    graphDensity,
    modules: moduleGraph,
  };
}

/**
 * Generates consumer graph evidence receipt and returns the graph.
 * When failOnUnconsumed is true and unconsumedModules > 0, throws (caller exits 1).
 */
export function verifyModuleConsumers(options = {}) {
  const root = options.root || ROOT;
  const receiptPath = options.receiptPath || DEFAULT_RECEIPT_PATH;
  const failOnUnconsumed = options.failOnUnconsumed === true;
  const graph = buildConsumerGraph(root);

  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, JSON.stringify(graph, null, 2), "utf8");

  if (failOnUnconsumed && graph.unconsumedModules > 0) {
    const orphans = Object.values(graph.modules)
      .filter((m) => !m.isConsumed)
      .map((m) => m.file);
    const err = new Error(
      `Architectural moratorium violated: ${graph.unconsumedModules} unconsumed Layer-0 module(s). Wire a consumer or archive before merge.`,
    );
    err.unconsumedFiles = orphans;
    throw err;
  }

  return graph;
}

// ---------------------------------------------------------------------------
// CLI Execution
// ---------------------------------------------------------------------------
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const showUnconsumed = process.argv.includes("--unconsumed-only");
  const failOnUnconsumed = process.argv.includes("--fail-on-unconsumed");

  console.log("======================================================================");
  console.log(" GLORIAN SYSTEM — Module Consumer Governance & Moratorium Audit");
  console.log("======================================================================");

  let graph;
  try {
    graph = verifyModuleConsumers({ failOnUnconsumed });
  } catch (err) {
    console.error(` FAIL — ${err.message}`);
    if (Array.isArray(err.unconsumedFiles)) {
      for (const file of err.unconsumedFiles) console.error(`  [UNCONSUMED] ${file}`);
    }
    console.error("Re-run without --fail-on-unconsumed for advisory inventory only.");
    process.exit(1);
  }

  console.log(` Total Modules in src/core/ : ${graph.totalModules}`);
  console.log(` Consumed Modules           : ${graph.consumedModules}`);
  console.log(` Unconsumed Leaf Modules    : ${graph.unconsumedModules}`);
  console.log(` Graph Consumption Density  : ${(graph.graphDensity * 100).toFixed(1)}%`);
  console.log(` Evidence Receipt           : ${DEFAULT_RECEIPT_PATH}`);
  console.log("----------------------------------------------------------------------");

  if (showUnconsumed) {
    console.log("Unconsumed Leaf Modules (Layer-0 Candidates for Moratorium / Integration):");
    for (const mod of Object.values(graph.modules)) {
      if (!mod.isConsumed) {
        console.log(`  - ${mod.file}`);
      }
    }
  }

  console.log("✅ Consumer graph audit complete. Moratorium status: ACTIVE.");
  process.exit(0);
}

#!/usr/bin/env node
/**
 * Architecture fitness function (zero dependencies).
 *
 * Enforces the import-graph invariants that keep the control plane hermetic:
 *   R1 SUPPLY CHAIN — shipping code (src/, bin/, scripts/) imports only `node:`
 *      builtins and relative files. No bare specifiers, ever.
 *   R2 LAYERING     — `src/core` (Layer 0) never depends on `src/mcp`, `src/ui`,
 *      `src/components` or `src/native`. Known legacy edges are pinned in
 *      LAYER_ALLOWLIST and must burn down; any new edge fails the gate.
 *   R3 ACYCLIC      — the internal import graph of `src/` has no cycles.
 *   R4 ISOLATION    — `src/` never imports `scripts/` or `test/`.
 *   R5 RESOLUTION   — every relative import inside `src/` resolves to a real file.
 *
 * Usage: node scripts/verify-architecture-boundaries.mjs [--json]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Legacy Layer-0 -> Layer-1 edge allowlist. Currently empty: the MCP tool-name
 * catalogs live in `src/core/eosMcpToolTaxonomy.ts`. Keep it that way — the gate
 * fails on any new inversion, and stale entries must be deleted in the same change.
 */
export const LAYER_ALLOWLIST = Object.freeze([]);

const SOURCE_EXTENSIONS = [".ts", ".mjs", ".js"];

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function excludedRanges(source) {
  const ranges = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];
    if (char === "/" && next === "/") {
      const start = i;
      while (i < source.length && source[i] !== "\n") i += 1;
      ranges.push([start, i]);
      continue;
    }
    if (char === "/" && next === "*") {
      const start = i;
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      i += 2;
      ranges.push([start, Math.min(i, source.length)]);
      continue;
    }
    if (char === '"' || char === "'") {
      i += 1;
      while (i < source.length) {
        if (source[i] === "\\") i += 2;
        else if (source[i++] === char) break;
      }
      continue;
    }
    if (char === "`") {
      const start = i;
      i += 1;
      while (i < source.length) {
        if (source[i] === "\\") i += 2;
        else if (source[i++] === "`") break;
      }
      ranges.push([start, i]);
      continue;
    }
    i += 1;
  }
  return ranges;
}

function parseSpecifiers(source) {
  const excluded = excludedRanges(source);
  const isExcluded = (index) => excluded.some(([start, end]) => index >= start && index < end);
  const specifiers = [];
  const patterns = [
    /\bfrom\s*["']([^"'\n]+)["']/g,
    /\bimport\s*\(\s*["']([^"'\n]+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"'\n]+)["']\s*\)/g
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      if (isExcluded(match.index)) continue;
      const specifier = match[1];
      if (specifier.includes("${") || /\s/.test(specifier)) continue;
      specifiers.push(specifier);
    }
  }
  return [...new Set(specifiers)];
}

function listModules(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listModules(abs));
    else if (entry.isFile() && SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) out.push(abs);
  }
  return out.sort();
}

function resolveSpecifier(fileAbs, specifier) {
  const base = path.resolve(path.dirname(fileAbs), specifier);
  const candidates = [base, ...SOURCE_EXTENSIONS.map((ext) => base + ext)];
  for (const ext of SOURCE_EXTENSIONS) candidates.push(path.join(base, "index" + ext));
  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // keep probing
    }
  }
  return null;
}

function zoneOf(relPath) {
  if (relPath.startsWith("src/")) {
    const parts = relPath.split("/");
    return parts.length > 2 ? `${parts[0]}/${parts[1]}` : "src";
  }
  return relPath.split("/")[0];
}

export function verifyArchitecture(projectRoot = root, options = {}) {
  const allowlist = options.allowlist ?? LAYER_ALLOWLIST;
  const projectAbs = path.resolve(projectRoot);
  const shippingRoots = ["src", "bin", "scripts"].map((dir) => path.join(projectAbs, dir));
  const srcDir = path.join(projectAbs, "src");
  const violations = [];

  const shippingModules = shippingRoots.flatMap((dir) => listModules(dir));
  const srcModules = listModules(srcDir);
  const graph = new Map();
  const usedAllowlist = new Set();

  for (const fileAbs of shippingModules) {
    const fileRel = toPosix(path.relative(projectAbs, fileAbs));
    const specifiers = parseSpecifiers(fs.readFileSync(fileAbs, "utf8"));
    for (const specifier of specifiers) {
      if (specifier.startsWith("node:")) continue;

      if (!specifier.startsWith(".")) {
        violations.push({ rule: "R1", file: fileRel, detail: `bare specifier "${specifier}" (only node: builtins and relative modules allowed)` });
        continue;
      }

      const resolved = resolveSpecifier(fileAbs, specifier);
      if (!resolved) {
        if (fileRel.startsWith("src/")) {
          violations.push({ rule: "R5", file: fileRel, detail: `unresolved relative import "${specifier}"` });
        }
        continue;
      }

      const targetRel = toPosix(path.relative(projectAbs, resolved));
      if (!fileRel.startsWith("src/")) continue;

      graph.set(fileRel, graph.get(fileRel) ?? new Set());
      if (targetRel.startsWith("src/")) graph.get(fileRel).add(targetRel);

      if (targetRel.startsWith("scripts/") || targetRel.startsWith("test/")) {
        violations.push({ rule: "R4", file: fileRel, detail: `imports harness module "${targetRel}"` });
        continue;
      }

      const sourceZone = zoneOf(fileRel);
      const targetZone = zoneOf(targetRel);
      const layerViolation =
        (sourceZone === "src/core" && ["src/mcp", "src/ui", "src/components", "src/native"].includes(targetZone)) ||
        (sourceZone !== "src" && sourceZone !== targetZone && targetZone === "src");

      if (layerViolation) {
        const edge = `${fileRel} -> ${targetRel}`;
        if (allowlist.includes(edge)) usedAllowlist.add(edge);
        else violations.push({ rule: "R2", file: fileRel, detail: `Layer inversion: ${edge}` });
      }
    }
  }

  for (const entry of allowlist) {
    if (!usedAllowlist.has(entry)) {
      violations.push({ rule: "R2", file: entry.split(" -> ")[0], detail: `stale allowlist entry: ${entry}` });
    }
  }

  const cycles = findCycles(graph);
  for (const cycle of cycles) {
    violations.push({ rule: "R3", file: cycle[0], detail: `import cycle: ${cycle.join(" -> ")} -> ${cycle[0]}` });
  }

  const edgeCount = [...graph.values()].reduce((total, deps) => total + deps.size, 0);
  return {
    valid: violations.length === 0,
    violations,
    metrics: {
      shippingModules: shippingModules.length,
      srcModules: srcModules.length,
      internalEdges: edgeCount,
      cycles: cycles.length,
      allowlistedEdges: usedAllowlist.size
    }
  };
}

function findCycles(graph) {
  let index = 0;
  const stack = [];
  const onStack = new Set();
  const indexes = new Map();
  const lowlinks = new Map();
  const cycles = [];

  const strongConnect = (node) => {
    indexes.set(node, index);
    lowlinks.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);

    for (const dep of graph.get(node) ?? []) {
      if (!graph.has(dep)) continue;
      if (!indexes.has(dep)) {
        strongConnect(dep);
        lowlinks.set(node, Math.min(lowlinks.get(node), lowlinks.get(dep)));
      } else if (onStack.has(dep)) {
        lowlinks.set(node, Math.min(lowlinks.get(node), indexes.get(dep)));
      }
    }

    if (lowlinks.get(node) === indexes.get(node)) {
      const component = [];
      let member;
      do {
        member = stack.pop();
        onStack.delete(member);
        component.push(member);
      } while (member !== node);
      if (component.length > 1) cycles.push(component.reverse());
    }
  };

  for (const node of graph.keys()) if (!indexes.has(node)) strongConnect(node);
  return cycles;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const jsonFlag = process.argv.includes("--json");
  const report = verifyArchitecture(root);

  if (jsonFlag) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("======================================================================");
    console.log(" ARCHITECTURE FITNESS FUNCTION — IMPORT GRAPH INVARIANTS              ");
    console.log("======================================================================");
    console.log(` [INFO] Modules: ${report.metrics.shippingModules} shipping, ${report.metrics.srcModules} under src/`);
    console.log(` [INFO] Internal edges: ${report.metrics.internalEdges} | cycles: ${report.metrics.cycles}`);
    console.log(` [INFO] Allowlisted Layer-0->1 edges: ${report.metrics.allowlistedEdges}/${LAYER_ALLOWLIST.length}`);
    if (report.valid) {
      console.log("\n[PASS] R1 supply chain · R2 layering · R3 acyclic · R4 isolation · R5 resolution");
      console.log("======================================================================");
    } else {
      console.error("\n[FAIL] Architecture violations:");
      for (const violation of report.violations) {
        console.error(`  ✖ [${violation.rule}] ${violation.file}: ${violation.detail}`);
      }
      console.error("======================================================================");
    }
  }

  process.exit(report.valid ? 0 : 1);
}

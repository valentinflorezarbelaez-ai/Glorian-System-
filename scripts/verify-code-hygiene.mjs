#!/usr/bin/env node
/**
 * Code hygiene ratchet (zero dependencies).
 *
 * Existing debt is recorded in scripts/code-hygiene-baseline.json. The gate fails
 * when a file grows past its recorded ceiling, gains a new explicit `any`, adds a
 * ts-ignore, starts logging from src, or a workflow action loses its SHA pin.
 * Regenerate the baseline only after deliberately paying debt down:
 *   node scripts/verify-code-hygiene.mjs --write-baseline
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = path.join(root, "scripts", "code-hygiene-baseline.json");
const maxFileLines = 1200;

function listTypeScriptFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTypeScriptFiles(abs));
    else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) out.push(abs);
  }
  return out;
}

function count(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

function collect() {
  const files = listTypeScriptFiles(path.join(root, "src")).sort().map((abs) => {
    const source = fs.readFileSync(abs, "utf8");
    return {
      file: path.relative(root, abs).replace(/\\/g, "/"),
      lines: source.split(/\r?\n/).length,
      any: count(source, /:\s*any\b/g),
      consoleLogs: count(source, /^\s*console\.log\s*\(/gm),
      tsIgnores: count(source, /@ts-(?:ignore|expect-error)/g)
    };
  });

  const workflowsDir = path.join(root, ".github", "workflows");
  const unpinnedActions = [];
  if (fs.existsSync(workflowsDir)) {
    for (const name of fs.readdirSync(workflowsDir).filter((n) => /\.ya?ml$/.test(n))) {
      const source = fs.readFileSync(path.join(workflowsDir, name), "utf8");
      for (const match of source.matchAll(/^\s*(?:-\s*)?uses:\s*["']?([^\s"'#]+)["']?/gm)) {
        const ref = match[1];
        if (ref.startsWith("./") || ref.startsWith("docker://")) continue;
        if (!/@[0-9a-f]{40}$/.test(ref)) unpinnedActions.push(`${name}: ${ref}`);
      }
    }
  }

  return { files, unpinnedActions };
}

function writeBaseline({ files }) {
  const lineCeilings = {};
  const anyBudgets = {};
  const consoleLogBudgets = {};

  for (const file of files) {
    if (file.lines > maxFileLines) lineCeilings[file.file] = file.lines;
    if (file.any > 0) anyBudgets[file.file] = file.any;
    if (file.consoleLogs > 0) consoleLogBudgets[file.file] = file.consoleLogs;
  }

  const sortKeys = (obj) =>
    Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));

  const baseline = {
    note: "Ratchet baseline for scripts/verify-code-hygiene.mjs. Lower values only; regenerate deliberately.",
    maxFileLines,
    lineCeilings: sortKeys(lineCeilings),
    anyBudgets: sortKeys(anyBudgets),
    consoleLogBudgets: sortKeys(consoleLogBudgets)
  };

  fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(
    `[BASELINE] Wrote ${path.relative(root, baselinePath)}: ${files.length} TS files, ` +
      `${Object.keys(lineCeilings).length} size ceilings, ${Object.keys(anyBudgets).length} any budgets.`
  );
}

function verify({ files, unpinnedActions }, baseline) {
  const violations = [];
  const ceiling = baseline.lineCeilings ?? {};
  const anyBudget = baseline.anyBudgets ?? {};
  const logBudget = baseline.consoleLogBudgets ?? {};

  for (const file of files) {
    const lineLimit = ceiling[file.file] ?? baseline.maxFileLines ?? maxFileLines;
    if (file.lines > lineLimit) {
      violations.push(`${file.file}: ${file.lines} lines exceeds ceiling ${lineLimit}; extract modules before growing`);
    }
    const allowedAny = anyBudget[file.file] ?? 0;
    if (file.any > allowedAny) {
      violations.push(`${file.file}: ${file.any} explicit any (budget ${allowedAny}); replace with a concrete type`);
    }
    const allowedLogs = logBudget[file.file] ?? 0;
    if (file.consoleLogs > allowedLogs) {
      violations.push(`${file.file}: ${file.consoleLogs} console.log call(s) in src; use the CLI/logger boundary`);
    }
    if (file.tsIgnores > 0) {
      violations.push(`${file.file}: ${file.tsIgnores} @ts-ignore/@ts-expect-error; fix the type instead`);
    }
  }

  for (const action of unpinnedActions) {
    violations.push(`.github/workflows: ${action} is not pinned to a 40-hex commit SHA`);
  }

  if (violations.length > 0) {
    console.error(`[FAIL] Code hygiene ratchet found ${violations.length} violation(s):`);
    for (const violation of violations.slice(0, 50)) console.error(`  - ${violation}`);
    if (violations.length > 50) console.error(`  ... and ${violations.length - 50} more`);
    process.exit(1);
  }

  console.log(
    `[PASS] Code hygiene ratchet: ${files.length} TS files, ${Object.keys(ceiling).length} size ceilings, ` +
      `${Object.keys(anyBudget).length} any budgets, 0 ts-ignore, ${unpinnedActions.length} unpinned actions.`
  );
}

const collected = collect();

if (process.argv.includes("--write-baseline")) {
  if (collected.unpinnedActions.length > 0) {
    console.error("[FAIL] Refusing to baseline unpinned workflow actions:");
    for (const action of collected.unpinnedActions) console.error(`  - ${action}`);
    process.exit(1);
  }
  writeBaseline(collected);
} else {
  if (!fs.existsSync(baselinePath)) {
    console.error(`[FAIL] Missing ${path.relative(root, baselinePath)}; run with --write-baseline once.`);
    process.exit(1);
  }
  verify(collected, JSON.parse(fs.readFileSync(baselinePath, "utf8")));
}
